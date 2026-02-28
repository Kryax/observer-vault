#!/usr/bin/env bash
# =============================================================================
# Observer Control Plane -- First-Run Setup Script
# =============================================================================
#
# Interactive setup for the Observer Control Plane monorepo.
# Checks prerequisites, installs dependencies, generates configs,
# bootstraps secrets, creates data directories, installs systemd unit
# and git hooks, validates config, runs a smoke test, and prints a summary.
#
# ISC Criteria:
#   ISC-S6-1: Exits early with clear message if prerequisite missing
#   ISC-S6-2: Idempotent -- re-run safe without destroying existing config
#   ISC-S6-3: Config generation NEVER overwrites existing files
#   ISC-S6-4: Smoke test validates service starts and health responds
#   ISC-S6-5: Prints summary with all relevant paths and next steps
#   ISC-S6-6: Every step has clear success or failure message
#   ISC-S6-A1: Never stores passwords or tokens in shell history
#   ISC-S6-A2: Never runs with set -e disabled in critical sections
#
# Usage:
#   sudo ./setup.sh          # Full setup including systemd and service user
#   ./setup.sh --no-systemd  # Skip systemd and service user (dev mode)
#
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SERVICE_NAME="observer-control-plane"
readonly SERVICE_USER="observer"
readonly SERVICE_GROUP="observer"
readonly HEALTH_PORT=9000
readonly MIN_NODE_MAJOR=22
readonly MIN_NPM_MAJOR=10

# ---------------------------------------------------------------------------
# Color output
# ---------------------------------------------------------------------------
readonly GREEN='\033[0;32m'
readonly RED='\033[0;31m'
readonly YELLOW='\033[1;33m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly RESET='\033[0m'

ok()   { printf "  ${GREEN}[ok]${RESET}    %s\n" "$1"; }
fail() { printf "  ${RED}[fail]${RESET}  %s\n" "$1"; }
skip() { printf "  ${YELLOW}[skip]${RESET}  %s\n" "$1"; }
info() { printf "  ${CYAN}[info]${RESET}  %s\n" "$1"; }
step() { printf "\n${BOLD}==> Step %s: %s${RESET}\n" "$1" "$2"; }

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
ERRORS=0
SKIP_SYSTEMD=false
NEED_SUDO=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --no-systemd) SKIP_SYSTEMD=true ;;
    --help|-h)
      echo "Usage: $0 [--no-systemd]"
      echo "  --no-systemd  Skip systemd unit install and service user creation (dev mode)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--no-systemd]"
      exit 1
      ;;
  esac
done

# Detect if we need sudo for system operations
if [ "$SKIP_SYSTEMD" = false ]; then
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
      NEED_SUDO=true
      info "Not running as root. Will use sudo for system operations."
    else
      fail "Not running as root and sudo is not available."
      fail "Run as root or use --no-systemd for dev mode."
      exit 1
    fi
  fi
fi

# Helper: run command with sudo if needed
run_privileged() {
  if [ "$NEED_SUDO" = true ]; then
    sudo "$@"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Check prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
  step "1" "Check prerequisites"

  local missing=0

  # Node.js
  if command -v node >/dev/null 2>&1; then
    local node_version
    node_version="$(node --version)"
    local node_major
    node_major="$(echo "$node_version" | sed 's/^v//' | cut -d. -f1)"
    if [ "$node_major" -ge "$MIN_NODE_MAJOR" ]; then
      ok "Node.js $node_version (>= v${MIN_NODE_MAJOR} required)"
    else
      fail "Node.js $node_version found but >= v${MIN_NODE_MAJOR} required"
      missing=$((missing + 1))
    fi
  else
    fail "Node.js not found (>= v${MIN_NODE_MAJOR} required)"
    missing=$((missing + 1))
  fi

  # npm
  if command -v npm >/dev/null 2>&1; then
    local npm_version
    npm_version="$(npm --version)"
    local npm_major
    npm_major="$(echo "$npm_version" | cut -d. -f1)"
    if [ "$npm_major" -ge "$MIN_NPM_MAJOR" ]; then
      ok "npm $npm_version (>= ${MIN_NPM_MAJOR} required)"
    else
      fail "npm $npm_version found but >= ${MIN_NPM_MAJOR} required"
      missing=$((missing + 1))
    fi
  else
    fail "npm not found (>= ${MIN_NPM_MAJOR} required)"
    missing=$((missing + 1))
  fi

  # age
  if command -v age >/dev/null 2>&1; then
    ok "age $(age --version 2>/dev/null || echo '(version unknown)')"
  else
    fail "age not found (required for secret encryption)"
    missing=$((missing + 1))
  fi

  # git
  if command -v git >/dev/null 2>&1; then
    ok "git $(git --version | head -1)"
  else
    fail "git not found"
    missing=$((missing + 1))
  fi

  # systemd (only if not skipping)
  if [ "$SKIP_SYSTEMD" = false ]; then
    if command -v systemctl >/dev/null 2>&1; then
      ok "systemd $(systemctl --version 2>/dev/null | head -1 || echo '(present)')"
    else
      fail "systemd not found (use --no-systemd to skip)"
      missing=$((missing + 1))
    fi
  else
    skip "systemd check (--no-systemd)"
  fi

  # openssl (for token generation)
  if command -v openssl >/dev/null 2>&1; then
    ok "openssl $(openssl version 2>/dev/null | head -1)"
  else
    fail "openssl not found (required for token generation)"
    missing=$((missing + 1))
  fi

  # age-keygen
  if command -v age-keygen >/dev/null 2>&1; then
    ok "age-keygen available"
  else
    fail "age-keygen not found (required for secret bootstrap)"
    missing=$((missing + 1))
  fi

  if [ "$missing" -gt 0 ]; then
    echo ""
    fail "Missing $missing prerequisite(s). Install them and re-run this script."
    exit 1
  fi

  ok "All prerequisites satisfied"
}

# ---------------------------------------------------------------------------
# Step 2: Create service user (optional, with prompt)
# ---------------------------------------------------------------------------
create_service_user() {
  step "2" "Create service user"

  if [ "$SKIP_SYSTEMD" = true ]; then
    skip "Service user creation (--no-systemd)"
    return
  fi

  if id "$SERVICE_USER" >/dev/null 2>&1; then
    ok "User '$SERVICE_USER' already exists"
    return
  fi

  echo ""
  printf "  Create dedicated service user '%s'? [y/N] " "$SERVICE_USER"
  read -r response
  case "$response" in
    [yY]|[yY][eE][sS])
      run_privileged useradd \
        --system \
        --shell /usr/sbin/nologin \
        --home-dir /nonexistent \
        --no-create-home \
        --comment "Observer Control Plane service" \
        "$SERVICE_USER" 2>/dev/null || true

      if id "$SERVICE_USER" >/dev/null 2>&1; then
        ok "Created system user '$SERVICE_USER'"
      else
        fail "Failed to create user '$SERVICE_USER'"
        ERRORS=$((ERRORS + 1))
      fi
      ;;
    *)
      skip "Service user creation (declined)"
      info "The systemd unit expects user '$SERVICE_USER'. Update the unit file if using a different user."
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Step 3: Install dependencies
# ---------------------------------------------------------------------------
install_dependencies() {
  step "3" "Install dependencies"

  if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    fail "package.json not found at $SCRIPT_DIR"
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [ -f "$SCRIPT_DIR/package-lock.json" ]; then
    info "Running npm ci from monorepo root..."
    if (cd "$SCRIPT_DIR" && npm ci --ignore-scripts 2>&1 | tail -3); then
      ok "Dependencies installed (npm ci)"
    else
      fail "npm ci failed"
      ERRORS=$((ERRORS + 1))
    fi
  else
    info "No package-lock.json found. Running npm install..."
    if (cd "$SCRIPT_DIR" && npm install 2>&1 | tail -3); then
      ok "Dependencies installed (npm install)"
    else
      fail "npm install failed"
      ERRORS=$((ERRORS + 1))
    fi
  fi
}

# ---------------------------------------------------------------------------
# Step 4: Generate configs (NEVER overwrite existing)
# ---------------------------------------------------------------------------
generate_configs() {
  step "4" "Generate configuration files"

  local configs_created=0

  # Control plane config
  local cp_example="$SCRIPT_DIR/control-plane.example.yaml"
  local cp_active="$SCRIPT_DIR/control-plane.yaml"

  if [ -f "$cp_active" ]; then
    skip "control-plane.yaml already exists (not overwriting)"
  elif [ -f "$cp_example" ]; then
    cp -- "$cp_example" "$cp_active"
    ok "Created control-plane.yaml from example"
    configs_created=$((configs_created + 1))
  else
    fail "Example config not found: $cp_example"
    ERRORS=$((ERRORS + 1))
  fi

  # Execution backends config
  local eb_example="$SCRIPT_DIR/execution-backends.example.yaml"
  local eb_active="$SCRIPT_DIR/execution-backends.yaml"

  if [ -f "$eb_active" ]; then
    skip "execution-backends.yaml already exists (not overwriting)"
  elif [ -f "$eb_example" ]; then
    cp -- "$eb_example" "$eb_active"
    ok "Created execution-backends.yaml from example"
    configs_created=$((configs_created + 1))
  else
    fail "Example config not found: $eb_example"
    ERRORS=$((ERRORS + 1))
  fi

  if [ "$configs_created" -eq 0 ]; then
    info "No new configs created (all already exist or examples missing)"
  else
    info "Created $configs_created config file(s). Edit them for your deployment."
  fi
}

# ---------------------------------------------------------------------------
# Step 5: Bootstrap secrets
# ---------------------------------------------------------------------------
bootstrap_secrets() {
  step "5" "Bootstrap secrets"

  local secrets_dir="$SCRIPT_DIR/secrets"
  local tokens_dir="$secrets_dir/tokens"
  local identity_file="$secrets_dir/identity.txt"

  # Create secrets directory structure
  mkdir -p "$tokens_dir"
  chmod 700 "$secrets_dir"
  chmod 700 "$tokens_dir"
  ok "Secrets directory structure created"

  # Generate age keypair if none exists
  if [ -f "$identity_file" ]; then
    skip "Age identity already exists at $identity_file"
  else
    # age-keygen writes the public key to stderr and private key to the file
    age-keygen -o "$identity_file" 2>/dev/null
    chmod 600 "$identity_file"
    ok "Generated age keypair at $identity_file"
  fi

  # Extract public key for encryption
  local public_key
  public_key="$(age-keygen -y "$identity_file" 2>/dev/null)"
  info "Age public key: $public_key"

  # Generate bearer token if no encrypted token file exists
  local token_file="$secrets_dir/bearer-tokens.json.age"
  if [ -f "$token_file" ]; then
    skip "Encrypted bearer token file already exists"
  else
    # ISC-S6-A1: Never store tokens in shell history or variables
    # Use process substitution to pipe token directly to age
    # The token is generated, formatted as JSON, and encrypted in a single pipeline
    {
      printf '{"tokens":[{"token":"%s","client_id":"cli-default","scope":"cli"}]}' \
        "$(openssl rand -hex 32)"
    } | age --recipient "$public_key" --armor > "$token_file"
    chmod 600 "$token_file"
    ok "Generated and encrypted bearer token"
    info "Decrypt with: age --decrypt -i $identity_file $token_file"
  fi

  # Set ownership if service user exists and we have privilege
  if [ "$SKIP_SYSTEMD" = false ] && id "$SERVICE_USER" >/dev/null 2>&1; then
    run_privileged chown -R "$SERVICE_USER:$SERVICE_GROUP" "$secrets_dir" 2>/dev/null || true
  fi
}

# ---------------------------------------------------------------------------
# Step 6: Create data directories
# ---------------------------------------------------------------------------
create_data_directories() {
  step "6" "Create data directories"

  local audit_dir="$SCRIPT_DIR/data/audit"
  local workdir="$SCRIPT_DIR/workdir"

  # Audit JSONL directory
  if [ -d "$audit_dir" ]; then
    skip "Audit directory already exists: $audit_dir"
  else
    mkdir -p "$audit_dir"
    ok "Created audit directory: $audit_dir"
  fi

  # Working directory for dispatch
  if [ -d "$workdir" ]; then
    skip "Working directory already exists: $workdir"
  else
    mkdir -p "$workdir"
    ok "Created working directory: $workdir"
  fi

  # Set ownership if service user exists
  if [ "$SKIP_SYSTEMD" = false ] && id "$SERVICE_USER" >/dev/null 2>&1; then
    run_privileged chown -R "$SERVICE_USER:$SERVICE_GROUP" "$SCRIPT_DIR/data" 2>/dev/null || true
    run_privileged chown -R "$SERVICE_USER:$SERVICE_GROUP" "$workdir" 2>/dev/null || true
    ok "Set ownership to $SERVICE_USER:$SERVICE_GROUP"
  fi

  ok "Data directories ready"
}

# ---------------------------------------------------------------------------
# Step 7: Install systemd unit
# ---------------------------------------------------------------------------
install_systemd_unit() {
  step "7" "Install systemd unit"

  if [ "$SKIP_SYSTEMD" = true ]; then
    skip "Systemd unit install (--no-systemd)"
    return
  fi

  local unit_source="$SCRIPT_DIR/$SERVICE_NAME.service"
  local unit_target="/etc/systemd/system/$SERVICE_NAME.service"

  if [ ! -f "$unit_source" ]; then
    fail "Systemd unit file not found: $unit_source"
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Copy unit file (always update to pick up changes)
  run_privileged cp -- "$unit_source" "$unit_target"
  run_privileged chmod 644 "$unit_target"
  ok "Installed systemd unit to $unit_target"

  # Reload systemd daemon
  run_privileged systemctl daemon-reload
  ok "Reloaded systemd daemon"

  # Enable (but do not start) the service
  run_privileged systemctl enable "$SERVICE_NAME" 2>/dev/null || true
  ok "Enabled $SERVICE_NAME (will start on boot)"

  info "Start manually with: systemctl start $SERVICE_NAME"
}

# ---------------------------------------------------------------------------
# Step 8: Install git hooks
# ---------------------------------------------------------------------------
install_git_hooks() {
  step "8" "Install git hooks"

  local hooks_source="$SCRIPT_DIR/.githooks/pre-commit"
  local git_dir

  # Find the git root directory
  if ! git_dir="$(cd "$SCRIPT_DIR" && git rev-parse --git-dir 2>/dev/null)"; then
    skip "Not inside a git repository. Skipping hook installation."
    return
  fi

  if [ ! -f "$hooks_source" ]; then
    fail "Pre-commit hook not found: $hooks_source"
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Ensure the hook is executable
  chmod +x "$hooks_source"
  ok "Pre-commit hook is executable"

  # Configure git to use the .githooks directory
  (cd "$SCRIPT_DIR" && git config core.hooksPath "$SCRIPT_DIR/.githooks")
  ok "Configured git core.hooksPath to $SCRIPT_DIR/.githooks"

  info "Pre-commit hook scans for credential leaks in staged files"
}

# ---------------------------------------------------------------------------
# Step 9: Validate config
# ---------------------------------------------------------------------------
validate_config() {
  step "9" "Validate configuration"

  local cp_config="$SCRIPT_DIR/control-plane.yaml"
  local eb_config="$SCRIPT_DIR/execution-backends.yaml"

  # Check that config files exist
  if [ ! -f "$cp_config" ]; then
    fail "control-plane.yaml not found. Run step 4 first."
    ERRORS=$((ERRORS + 1))
    return
  fi

  if [ ! -f "$eb_config" ]; then
    fail "execution-backends.yaml not found. Run step 4 first."
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Dry-run: attempt to parse YAML files with Node.js
  # This validates that the YAML syntax is correct and the files are loadable
  local validate_script
  validate_script=$(cat <<'VALIDATE_EOF'
const fs = require("fs");
const path = require("path");

// Use js-yaml if available, otherwise basic YAML parse via JSON roundtrip check
let yaml;
try {
  yaml = require("js-yaml");
} catch {
  // Try the workspace's yaml dependency
  try {
    yaml = require(path.join(process.argv[2], "node_modules", "yaml"));
    // 'yaml' package has a different API: yaml.parse()
    if (typeof yaml.load !== "function" && typeof yaml.parse === "function") {
      yaml.load = yaml.parse;
    }
  } catch {
    console.error("No YAML parser available. Install js-yaml or yaml.");
    process.exit(1);
  }
}

const errors = [];
const files = process.argv.slice(3);

for (const file of files) {
  try {
    const content = fs.readFileSync(file, "utf-8");
    const parsed = yaml.load(content);
    if (parsed === null || parsed === undefined) {
      errors.push(`${path.basename(file)}: parsed to null/undefined`);
    }
  } catch (e) {
    errors.push(`${path.basename(file)}: ${e.message}`);
  }
}

if (errors.length > 0) {
  errors.forEach((e) => console.error(e));
  process.exit(1);
}
VALIDATE_EOF
)

  if echo "$validate_script" | node - "$SCRIPT_DIR" "$cp_config" "$eb_config" 2>&1; then
    ok "control-plane.yaml: valid YAML"
    ok "execution-backends.yaml: valid YAML"
  else
    fail "Config validation failed (see errors above)"
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Additional structural checks
  # Verify server.host is 127.0.0.1 (security invariant)
  local host_check
  host_check=$(cat <<'HOST_EOF'
const fs = require("fs");
const path = require("path");
let yaml;
try { yaml = require("js-yaml"); } catch {
  try {
    yaml = require(path.join(process.argv[2], "node_modules", "yaml"));
    if (typeof yaml.load !== "function" && typeof yaml.parse === "function") {
      yaml.load = yaml.parse;
    }
  } catch { process.exit(0); }
}
const config = yaml.load(fs.readFileSync(process.argv[3], "utf-8"));
if (config && config.server && config.server.host !== "127.0.0.1") {
  console.error("SECURITY: server.host must be 127.0.0.1, got: " + config.server.host);
  process.exit(1);
}
if (config && config.policies && config.policies.default_action !== "deny") {
  console.error("SECURITY: policies.default_action must be 'deny', got: " + config.policies.default_action);
  process.exit(1);
}
HOST_EOF
)

  if echo "$host_check" | node - "$SCRIPT_DIR" "$cp_config" 2>&1; then
    ok "Security invariants verified (127.0.0.1 binding, default-deny)"
  else
    fail "Security invariant check failed (see errors above)"
    ERRORS=$((ERRORS + 1))
  fi
}

# ---------------------------------------------------------------------------
# Step 10: Run smoke test
# ---------------------------------------------------------------------------
run_smoke_test() {
  step "10" "Run smoke test"

  if [ "$SKIP_SYSTEMD" = true ]; then
    info "Skipping systemd-based smoke test (--no-systemd)"
    info "Running in-process smoke test instead..."

    # Check if the TypeScript smoke test script exists
    local smoke_script="$SCRIPT_DIR/scripts/smoke-test.ts"
    if [ -f "$smoke_script" ]; then
      if command -v npx >/dev/null 2>&1; then
        if (cd "$SCRIPT_DIR" && npx tsx "$smoke_script" 2>&1); then
          ok "Smoke test passed (in-process)"
        else
          fail "Smoke test failed"
          ERRORS=$((ERRORS + 1))
        fi
      else
        skip "npx not available. Skipping in-process smoke test."
        info "Run manually: cd $SCRIPT_DIR && npx tsx scripts/smoke-test.ts"
      fi
    else
      skip "Smoke test script not found at $smoke_script"
    fi
    return
  fi

  # Systemd-based smoke test
  if ! systemctl is-enabled "$SERVICE_NAME" >/dev/null 2>&1; then
    fail "Service $SERVICE_NAME is not installed. Run step 7 first."
    ERRORS=$((ERRORS + 1))
    return
  fi

  info "Starting $SERVICE_NAME..."
  if ! run_privileged systemctl start "$SERVICE_NAME"; then
    fail "Failed to start $SERVICE_NAME"
    run_privileged journalctl -u "$SERVICE_NAME" --no-pager -n 20 2>/dev/null || true
    ERRORS=$((ERRORS + 1))
    return
  fi

  # Wait for service to be ready
  info "Waiting for service to start..."
  sleep 3

  # Check if service is running
  if ! systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1; then
    fail "Service $SERVICE_NAME failed to stay running"
    run_privileged journalctl -u "$SERVICE_NAME" --no-pager -n 20 2>/dev/null || true
    ERRORS=$((ERRORS + 1))
    return
  fi
  ok "Service is running"

  # Hit health endpoint (try JSON-RPC first, then plain HTTP)
  local health_ok=false

  if curl -sf -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"health.status"}' \
    "http://127.0.0.1:${HEALTH_PORT}" \
    -o /dev/null 2>/dev/null; then
    health_ok=true
    ok "Health endpoint responded (JSON-RPC)"
  elif curl -sf "http://127.0.0.1:${HEALTH_PORT}/health" -o /dev/null 2>/dev/null; then
    health_ok=true
    ok "Health endpoint responded (HTTP GET /health)"
  else
    fail "Health endpoint did not respond on port $HEALTH_PORT"
    ERRORS=$((ERRORS + 1))
  fi

  # Stop service
  info "Stopping $SERVICE_NAME..."
  run_privileged systemctl stop "$SERVICE_NAME"
  ok "Service stopped"

  if [ "$health_ok" = true ]; then
    ok "Smoke test passed"
  fi
}

# ---------------------------------------------------------------------------
# Step 11: Print summary
# ---------------------------------------------------------------------------
print_summary() {
  step "11" "Summary"

  echo ""
  printf "${BOLD}${CYAN}%s${RESET}\n" "============================================================"
  printf "${BOLD}${CYAN}  Observer Control Plane -- Setup Complete${RESET}\n"
  printf "${BOLD}${CYAN}%s${RESET}\n" "============================================================"
  echo ""

  if [ "$ERRORS" -gt 0 ]; then
    printf "  ${RED}%d error(s) occurred during setup.${RESET}\n" "$ERRORS"
    printf "  Review the output above and fix any issues.\n"
    echo ""
  else
    printf "  ${GREEN}All steps completed successfully.${RESET}\n"
    echo ""
  fi

  printf "${BOLD}  Paths:${RESET}\n"
  printf "    Monorepo root:        %s\n" "$SCRIPT_DIR"
  printf "    Control plane config: %s\n" "$SCRIPT_DIR/control-plane.yaml"
  printf "    Backends config:      %s\n" "$SCRIPT_DIR/execution-backends.yaml"
  printf "    Secrets directory:    %s\n" "$SCRIPT_DIR/secrets/"
  printf "    Audit data:           %s\n" "$SCRIPT_DIR/data/audit/"
  printf "    Working directory:    %s\n" "$SCRIPT_DIR/workdir/"
  if [ "$SKIP_SYSTEMD" = false ]; then
    printf "    Systemd unit:         /etc/systemd/system/%s.service\n" "$SERVICE_NAME"
  fi
  printf "    Git hooks:            %s\n" "$SCRIPT_DIR/.githooks/"
  echo ""

  if [ -f "$SCRIPT_DIR/secrets/identity.txt" ]; then
    local pubkey
    pubkey="$(age-keygen -y "$SCRIPT_DIR/secrets/identity.txt" 2>/dev/null || echo '(unknown)')"
    printf "${BOLD}  Secrets:${RESET}\n"
    printf "    Age public key:       %s\n" "$pubkey"
    printf "    Identity file:        %s\n" "$SCRIPT_DIR/secrets/identity.txt"
    printf "    Encrypted tokens:     %s\n" "$SCRIPT_DIR/secrets/bearer-tokens.json.age"
    echo ""
  fi

  printf "${BOLD}  Next steps:${RESET}\n"
  echo "    1. Edit control-plane.yaml for your deployment"
  echo "    2. Edit execution-backends.yaml to configure backends"
  echo "    3. Decrypt and review bearer tokens:"
  echo "         age --decrypt -i secrets/identity.txt secrets/bearer-tokens.json.age"
  if [ "$SKIP_SYSTEMD" = false ]; then
    echo "    4. Start the service:"
    echo "         sudo systemctl start $SERVICE_NAME"
    echo "    5. Check service status:"
    echo "         sudo systemctl status $SERVICE_NAME"
    echo "    6. View logs:"
    echo "         sudo journalctl -u $SERVICE_NAME -f"
  else
    echo "    4. Start in development mode:"
    echo "         cd $SCRIPT_DIR && node packages/control-plane/src/server/server.js"
    echo "    5. Run tests:"
    echo "         cd $SCRIPT_DIR && npm test"
  fi
  echo "    7. Run smoke test manually:"
  echo "         cd $SCRIPT_DIR && npx tsx scripts/smoke-test.ts"
  echo ""

  if [ "$ERRORS" -gt 0 ]; then
    printf "  ${YELLOW}Setup completed with %d error(s). See above for details.${RESET}\n" "$ERRORS"
    echo ""
    exit 1
  else
    printf "  ${GREEN}Setup completed successfully. The Observer is ready.${RESET}\n"
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  printf "${BOLD}${CYAN}%s${RESET}\n" "============================================================"
  printf "${BOLD}${CYAN}  Observer Control Plane -- First-Run Setup${RESET}\n"
  printf "${BOLD}${CYAN}%s${RESET}\n" "============================================================"
  echo ""
  info "Monorepo root: $SCRIPT_DIR"
  if [ "$SKIP_SYSTEMD" = true ]; then
    info "Mode: development (--no-systemd)"
  else
    info "Mode: production (with systemd)"
  fi
  echo ""

  check_prerequisites
  create_service_user
  install_dependencies
  generate_configs
  bootstrap_secrets
  create_data_directories
  install_systemd_unit
  install_git_hooks
  validate_config
  run_smoke_test
  print_summary
}

main
