# Observer Control Plane -- Installation Guide

Step-by-step installation for the Observer Control Plane JSON-RPC server,
dispatch layer, and supporting infrastructure.

## Prerequisites

Verify each requirement before proceeding. Every check command must succeed.

**Node.js 22 LTS**

```bash
node --version
# Must print v22.x.x or higher
```

**npm 10+**

```bash
npm --version
# Must print 10.x.x or higher
```

**age (encryption tool)**

```bash
age --version
# Must print a version string (e.g., v1.1.1)
```

If `age` is not installed, build from source or install via your distribution's
package manager. The binary must be on `$PATH`.

**openssl**

```bash
openssl version
# Must print a version string
```

**systemd**

```bash
systemctl --version
# Must print a version string
```

**Linux operating system**

```bash
uname -s
# Must print "Linux"
```

All six checks must pass before proceeding.

## Quick Start

```bash
git clone <repository-url> observer-system
cd observer-system
npm ci
cp -n control-plane.example.yaml control-plane.yaml
cp -n execution-backends.example.yaml execution-backends.yaml
```

After cloning and installing, follow the Manual Setup sections for secrets
generation, directory creation, and systemd installation.

## Manual Setup

Each step below corresponds to what a setup script would perform. Run these
commands from the repository root (`observer-system/`).

### 1. Install Dependencies

```bash
npm ci
```

This installs all workspace dependencies (shared, control-plane, dispatch)
using the exact versions from `package-lock.json`.

### 2. Copy Configuration Files

```bash
cp -n control-plane.example.yaml control-plane.yaml
cp -n execution-backends.example.yaml execution-backends.yaml
```

The `-n` flag prevents overwriting existing configuration files. Edit both
files for your deployment. See the Configuration Reference section below.

### 3. Generate Age Keypair

```bash
mkdir -p secrets
age-keygen -o secrets/identity.txt
```

This creates a new age identity (private key) at `secrets/identity.txt`. The
corresponding public key is printed to stdout. Record the public key -- you
will need it for encrypting secrets.

Set restrictive permissions on the identity file:

```bash
chmod 600 secrets/identity.txt
```

### 4. Create Bearer Token

Generate a random bearer token, encrypt it with your age public key, and store
the ciphertext:

```bash
AGE_PUBLIC_KEY=$(age-keygen -y secrets/identity.txt)
echo '["'"$(openssl rand -hex 32)"'"]' | age -r "$AGE_PUBLIC_KEY" -a > secrets/bearer-tokens.json.age
```

This produces an age-encrypted JSON array containing one bearer token. At
runtime, `provision-secrets.sh` decrypts this file to tmpfs before the control
plane starts.

### 5. Create Data Directories

```bash
mkdir -p data/audit workdir
```

- `data/audit/` -- JSONL audit log files and SQLite index
- `workdir/` -- Backend working directories for dispatch

### 6. Install systemd Service

Copy the unit file and register it with systemd:

```bash
sudo cp observer-control-plane.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable observer-control-plane
```

The service unit expects the installation at `/opt/observer-system`. If your
repository lives elsewhere, edit `WorkingDirectory` and related paths in the
unit file before copying.

Create the service user if it does not exist:

```bash
sudo useradd --system --shell /usr/sbin/nologin --home-dir /opt/observer-system observer
```

Set ownership on data directories:

```bash
sudo chown -R observer:observer data/ workdir/ secrets/
```

### 7. Set Up tmpfs for Secrets

Create the tmpfs mount point and mount it:

```bash
sudo mkdir -p /run/observer-secrets
sudo mount -t tmpfs -o size=16m,mode=0700,uid=$(id -u observer),gid=$(id -g observer) tmpfs /run/observer-secrets
```

To persist this mount across reboots, add the following line to `/etc/fstab`:

```
tmpfs /run/observer-secrets tmpfs size=16m,mode=0700 0 0
```

The `provision-secrets.sh` script (called by systemd `ExecStartPre`) decrypts
age-encrypted secrets from `secrets/` to this tmpfs mount at service startup.

### 8. Install Git Hooks

```bash
git config core.hooksPath .githooks
```

This activates the pre-commit hook located at `.githooks/pre-commit`.

## Configuration Reference

Both configuration files use YAML format. The control plane reads them at
startup. Changes require a service restart (no hot-reload by design).

### control-plane.yaml

**server section**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `server.host` | Yes | `127.0.0.1` | Bind address. MUST be `127.0.0.1`. The server rejects `0.0.0.0` at startup. External access uses Tailscale. |
| `server.http_port` | Yes | `9000` | TCP port for HTTP JSON-RPC transport. |
| `server.max_request_size_bytes` | No | `1048576` | Maximum request body size (bytes). Requests exceeding this return a 413 error. |
| `server.shutdown_timeout_seconds` | No | `30` | Seconds to wait for in-flight requests during graceful shutdown. |
| `server.log_level` | No | `info` | Minimum pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |

**auth section**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `auth.token_dir` | Yes | `./secrets/tokens` | Directory containing bearer token files. Each file holds one token. Loaded at startup. |

**policies section**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `policies.default_action` | Yes | `deny` | Fallback action when no rule matches. MUST be `deny`. The config loader rejects any other value. |
| `policies.rules` | Yes | (see example) | Ordered list of policy rules evaluated by priority. First match wins. |

Each rule has the following structure:

```yaml
- id: "rule-name"
  description: "Human-readable description"
  condition:
    type: method_match    # or: client_type_match, intent_contains, rate_check, and, or, not
    methods:
      - "health.status"
  action: "allow"         # or: deny, require_approval, rate_limit
  priority: 10            # lower number = evaluated first
```

**dispatch section**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `dispatch.working_directory` | Yes | `./workdir` | Base directory for backend working directories. Must exist and be writable. |
| `dispatch.allowed_base_dirs` | Yes | (see example) | Paths backends can access. Operations outside these directories are rejected. |

**audit section**

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `audit.jsonl_dir` | Yes | `./data/audit` | Directory for JSONL audit log files. |
| `audit.jsonl_max_size_mb` | No | `100` | Maximum size per JSONL file before rotation. |
| `audit.index_database_path` | Yes | `./data/audit/index.db` | SQLite database path for audit trail indexing. |
| `audit.sanitize_patterns` | No | (see example) | Regex patterns for credential redaction in audit output. |

**sessions, rate_limits, approvals, health sections**

See `control-plane.example.yaml` for the complete set of fields with inline
documentation. The example file contains all available options with
explanations.

### execution-backends.yaml

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `routing_mode` | Yes | `specify` | Backend selection mode. Phase 1 supports `specify` only. |
| `default_backend` | Yes | `claude-code` | Backend used when client omits an explicit backend. Must match a key in `backends`. |
| `dispatch.default_timeout_seconds` | No | `300` | Global dispatch timeout ceiling. |
| `dispatch.max_retries` | No | `1` | Retry count on transient failure. |
| `backends.<name>.command` | Yes | -- | Executable name or absolute path. No shell expansion. |
| `backends.<name>.args_template` | Yes | -- | Argument vector. `{prompt}` is replaced at dispatch time. |
| `backends.<name>.enabled` | Yes | -- | Set `false` to disable without removing config. |
| `backends.<name>.timeout_seconds` | No | (global) | Per-backend timeout override. |
| `backends.<name>.health_check` | No | -- | Lightweight probe command for `health.status`. |

## Secrets Management

The Observer Control Plane uses age encryption for secrets at rest and tmpfs
for secrets at runtime. Secrets never persist to disk in plaintext.

### Keypair Generation

```bash
age-keygen -o secrets/identity.txt
chmod 600 secrets/identity.txt
```

The identity file is the private key. Guard it carefully. The corresponding
public key is derived with:

```bash
age-keygen -y secrets/identity.txt
```

### Encrypting Secrets

Encrypt any file for the control plane identity:

```bash
age -r "$(age-keygen -y secrets/identity.txt)" -a < plaintext.json > secrets/plaintext.json.age
```

All files matching `secrets/*.age` are decrypted at service startup by
`scripts/provision-secrets.sh`.

### tmpfs Lifecycle

**At startup** (handled by `ExecStartPre` in the systemd unit):

1. `provision-secrets.sh` verifies the target directory is on tmpfs
2. Each `*.age` file in `secrets/` is decrypted to `/run/observer-secrets/`
3. Decrypted files receive `0600` permissions and `observer:observer` ownership
4. Required files (e.g., `bearer-tokens.json`) are validated as present and non-empty
5. If any step fails, the service does not start

**At shutdown** (handled by systemd):

When the service stops, tmpfs contents remain until the mount is removed or the
system reboots. For explicit cleanup:

```bash
sudo find /run/observer-secrets -type f -exec shred -u {} \;
sudo umount /run/observer-secrets
```

The `scripts/uninstall.sh` script performs this cleanup automatically.

## Service Management

All commands use systemd. The service name is `observer-control-plane`.

**Start the service:**

```bash
sudo systemctl start observer-control-plane
```

**Stop the service:**

```bash
sudo systemctl stop observer-control-plane
```

**Check service status:**

```bash
sudo systemctl status observer-control-plane
```

**Follow live logs:**

```bash
journalctl -u observer-control-plane -f
```

**View recent logs:**

```bash
journalctl -u observer-control-plane --since "1 hour ago"
```

**Restart after configuration changes:**

```bash
sudo systemctl restart observer-control-plane
```

Configuration is restart-to-reload. The running configuration always matches
the file on disk.

## Verification

After installation and starting the service, verify the system is operational.

### Health Check

```bash
curl -s http://127.0.0.1:9000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"health.status","id":1}' | python3 -m json.tool
```

A healthy response includes `"status": "healthy"` and reports backend
availability.

### Audit Trail Check

Verify the audit directory has been created and is writable:

```bash
ls -la data/audit/
```

After a successful health check, the audit directory should contain at least
one JSONL file.

### Smoke Test

Run the built-in smoke test to validate all subsystems:

```bash
npx tsx scripts/smoke-test.ts
```

This performs 9 checks covering server connectivity, authentication, session
lifecycle, policy enforcement, audit writing, and health reporting.

## Troubleshooting

### Port 9000 already in use

**Symptom:** Service fails to start. Logs show `EADDRINUSE` or
`address already in use`.

**Fix:** Identify the process occupying port 9000 and stop it, or change
`server.http_port` in `control-plane.yaml`:

```bash
ss -tlnp | grep :9000
```

Stop the conflicting process or choose a different port, then restart.

### Permission denied on secrets

**Symptom:** `provision-secrets.sh` fails with permission errors during
decryption or when writing to `/run/observer-secrets`.

**Fix:** Verify the tmpfs mount exists and has correct ownership:

```bash
mount | grep observer-secrets
ls -ld /run/observer-secrets
```

Remount if necessary:

```bash
sudo mount -t tmpfs -o size=16m,mode=0700,uid=$(id -u observer),gid=$(id -g observer) tmpfs /run/observer-secrets
```

Verify the `secrets/identity.txt` file is readable by the `observer` user:

```bash
sudo -u observer test -r /opt/observer-system/secrets/identity.txt && echo "OK" || echo "DENIED"
```

### age not found

**Symptom:** `provision-secrets.sh` exits with
`age binary not found in PATH`.

**Fix:** Install age and verify it is on the system `$PATH`:

```bash
which age
age --version
```

If installed to a non-standard location, add its directory to `$PATH` in the
systemd unit file using an `Environment=PATH=...` directive, or create a
symlink in `/usr/local/bin/`.

### Config parse error at startup

**Symptom:** Service fails immediately. Logs show YAML parse errors or
schema validation failures.

**Fix:** Validate YAML syntax:

```bash
python3 -c "import yaml; yaml.safe_load(open('control-plane.yaml'))"
python3 -c "import yaml; yaml.safe_load(open('execution-backends.yaml'))"
```

Common causes:
- Tabs instead of spaces (YAML requires spaces for indentation)
- Missing quotes around values containing special characters
- `policies.default_action` set to anything other than `deny`

### Node.js version mismatch

**Symptom:** `npm ci` fails or the server crashes on startup with syntax
errors or missing API references.

**Fix:** Verify the installed Node.js version:

```bash
node --version
```

The control plane requires Node.js 22 LTS or higher. If an older version is
installed, upgrade through your distribution's package manager or use a version
manager like `nvm` or `fnm`:

```bash
nvm install 22
nvm use 22
```

### Service fails to start (check journal)

**Symptom:** `systemctl start observer-control-plane` exits with a
non-zero status. `systemctl status` shows `failed`.

**Fix:** Read the full journal output for the failure:

```bash
journalctl -u observer-control-plane --no-pager -n 50
```

Common causes:
- `ExecStartPre` (secret provisioning) failed -- check age identity and
  encrypted files
- `WorkingDirectory` does not exist -- verify the path in the unit file
- The `observer` user does not exist -- create it with `useradd --system`
- `server.host` set to something other than `127.0.0.1` -- the server
  rejects non-localhost bindings

### npm ci fails

**Symptom:** `npm ci` exits with errors about missing `package-lock.json`,
incompatible Node.js version, or network failures.

**Fix:**

Verify `package-lock.json` exists in the repository root:

```bash
ls -la package-lock.json
```

If missing, the repository may be incomplete. Re-clone or run `npm install`
to generate it (then commit the lockfile).

Verify the Node.js version meets the engine requirement:

```bash
node --version
# Must be v22.x.x or higher
```

For network errors behind a proxy, configure npm:

```bash
npm config set proxy http://proxy.example.com:8080
npm config set https-proxy http://proxy.example.com:8080
```

### Server binds to wrong address

**Symptom:** Server starts but is unreachable, or security audit shows it
listening on `0.0.0.0`.

**Fix:** The control plane enforces `127.0.0.1` binding at startup. If
`server.host` in `control-plane.yaml` is set to any value other than
`127.0.0.1`, the server will reject the configuration and refuse to start.
Verify the setting:

```bash
grep -A1 'host:' control-plane.yaml
```

Set `server.host` to `127.0.0.1` and restart.

## Uninstall

To remove the Observer Control Plane and all associated system components:

```bash
sudo ./scripts/uninstall.sh
```

The uninstall script:
- Stops and disables the systemd service
- Removes the systemd unit file
- Unmounts and removes the tmpfs secrets directory
- Optionally removes the data directory (prompts for confirmation)
- Optionally removes the `observer` system user (prompts for confirmation)
- Removes git hooks
- Never removes source code or the git repository
