#!/usr/bin/env bash
# provision-secrets.sh — Decrypt age-encrypted secrets to tmpfs at service startup.
# Called by systemd ExecStartPre= to ensure secrets are available before the
# control plane process starts. Exits non-zero on ANY failure, which blocks
# the service from starting.
#
# ISC Criteria satisfied:
#   ISC-S3-1: Exits non-zero if age binary is missing
#   ISC-S3-2: Decrypted secrets land on tmpfs, not persistent disk
#   ISC-S3-3: File permissions set to 0600 after decryption
#   ISC-S3-4: Validates expected secret files exist before exit
#   ISC-S3-A1: NEVER logs secret values to stdout or stderr
#
# Security: This script handles sensitive cryptographic material. It deliberately
# avoids logging any file contents, decrypted values, or identity key paths
# beyond what is strictly necessary for operational diagnostics.

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (all overridable via environment)
# ---------------------------------------------------------------------------

# Path to the age identity (private key) file used for decryption.
OBSERVER_AGE_IDENTITY="${OBSERVER_AGE_IDENTITY:-/opt/observer-system/secrets/identity.txt}"

# Directory containing *.age encrypted secret files.
OBSERVER_SECRETS_ENCRYPTED="${OBSERVER_SECRETS_ENCRYPTED:-/opt/observer-system/secrets}"

# Tmpfs target directory where decrypted secrets are written.
OBSERVER_SECRETS_DIR="${OBSERVER_SECRETS_DIR:-/run/observer-secrets}"

# Owner for decrypted secret files (user:group).
OBSERVER_SECRETS_OWNER="${OBSERVER_SECRETS_OWNER:-observer:observer}"

# Files that MUST exist after decryption for the service to start.
# Space-separated list of filenames (not paths).
OBSERVER_REQUIRED_SECRETS="${OBSERVER_REQUIRED_SECRETS:-bearer-tokens.json}"

# ---------------------------------------------------------------------------
# Logging helpers — safe status output, never secret content
# ---------------------------------------------------------------------------

log_info() {
    echo "[provision-secrets] INFO: $*"
}

log_error() {
    echo "[provision-secrets] ERROR: $*" >&2
}

# ---------------------------------------------------------------------------
# Step 1: Verify age binary exists (ISC-S3-1)
# ---------------------------------------------------------------------------

if ! command -v age >/dev/null 2>&1; then
    log_error "age binary not found in PATH. Install age (https://github.com/FiloSottile/age) and retry."
    exit 1
fi

log_info "age binary found at $(command -v age)"

# ---------------------------------------------------------------------------
# Step 2: Verify identity file exists
# ---------------------------------------------------------------------------

if [[ ! -f "$OBSERVER_AGE_IDENTITY" ]]; then
    log_error "Age identity file not found: $OBSERVER_AGE_IDENTITY"
    exit 1
fi

# NOTE: We deliberately do NOT log the identity file path beyond confirming
# its existence. The path itself is not secret, but minimising surface area
# in logs is good hygiene.
log_info "Age identity file found."

# ---------------------------------------------------------------------------
# Step 3: Verify encrypted secrets directory and *.age files exist
# ---------------------------------------------------------------------------

if [[ ! -d "$OBSERVER_SECRETS_ENCRYPTED" ]]; then
    log_error "Encrypted secrets directory not found: $OBSERVER_SECRETS_ENCRYPTED"
    exit 1
fi

shopt -s nullglob
encrypted_files=("$OBSERVER_SECRETS_ENCRYPTED"/*.age)
shopt -u nullglob

if [[ ${#encrypted_files[@]} -eq 0 ]]; then
    log_error "No .age files found in $OBSERVER_SECRETS_ENCRYPTED"
    exit 1
fi

log_info "Found ${#encrypted_files[@]} encrypted secret file(s) to decrypt."

# ---------------------------------------------------------------------------
# Step 4: Create tmpfs mount point if it does not exist (ISC-S3-2)
# ---------------------------------------------------------------------------

if [[ ! -d "$OBSERVER_SECRETS_DIR" ]]; then
    log_info "Creating secrets directory: $OBSERVER_SECRETS_DIR"
    mkdir -p "$OBSERVER_SECRETS_DIR"
fi

# Verify the target is on tmpfs. This is the ISC-S3-2 guarantee: secrets
# must never land on persistent disk. We check the filesystem type of the
# target directory (or its parent if just created).
target_fstype=$(df --output=fstype "$OBSERVER_SECRETS_DIR" 2>/dev/null | tail -1 | tr -d '[:space:]')

if [[ "$target_fstype" != "tmpfs" ]]; then
    log_error "SECURITY: $OBSERVER_SECRETS_DIR is NOT on tmpfs (detected: ${target_fstype:-unknown}). Secrets must only be decrypted to tmpfs."
    log_error "Mount tmpfs at $OBSERVER_SECRETS_DIR before running this script."
    log_error "Example: mount -t tmpfs -o size=16m,mode=0700 tmpfs $OBSERVER_SECRETS_DIR"
    exit 1
fi

log_info "Target directory is on tmpfs — secrets will not persist to disk."

# Ensure the directory itself has restrictive permissions.
chmod 0700 "$OBSERVER_SECRETS_DIR"

# ---------------------------------------------------------------------------
# Step 5: Decrypt each .age file to tmpfs (ISC-S3-3)
# ---------------------------------------------------------------------------

decrypt_count=0
fail_count=0

for encrypted_file in "${encrypted_files[@]}"; do
    # Derive the output filename by stripping the .age extension.
    basename_encrypted=$(basename "$encrypted_file")
    target_name="${basename_encrypted%.age}"
    target_path="$OBSERVER_SECRETS_DIR/$target_name"

    log_info "Decrypting: $basename_encrypted"

    # Decrypt with age. Errors from age go to stderr (no secret content leaks
    # because age only prints diagnostic messages, not plaintext, on failure).
    if ! age --decrypt --identity "$OBSERVER_AGE_IDENTITY" --output "$target_path" "$encrypted_file" 2>&1; then
        log_error "Failed to decrypt: $basename_encrypted"
        # Clean up partial output if age created one.
        rm -f "$target_path"
        fail_count=$((fail_count + 1))
        continue
    fi

    # Set restrictive permissions (ISC-S3-3).
    chmod 0600 "$target_path"
    chown "$OBSERVER_SECRETS_OWNER" "$target_path"

    decrypt_count=$((decrypt_count + 1))
    log_info "Decrypted and secured: $target_name (mode 0600, owner $OBSERVER_SECRETS_OWNER)"
done

if [[ $fail_count -gt 0 ]]; then
    log_error "$fail_count file(s) failed to decrypt. Aborting."
    exit 1
fi

log_info "Successfully decrypted $decrypt_count file(s)."

# ---------------------------------------------------------------------------
# Step 6: Validate expected secret files exist (ISC-S3-4)
# ---------------------------------------------------------------------------

missing_count=0

for required_file in $OBSERVER_REQUIRED_SECRETS; do
    required_path="$OBSERVER_SECRETS_DIR/$required_file"
    if [[ ! -f "$required_path" ]]; then
        log_error "Required secret file missing after decryption: $required_file"
        missing_count=$((missing_count + 1))
    elif [[ ! -s "$required_path" ]]; then
        log_error "Required secret file is empty: $required_file"
        missing_count=$((missing_count + 1))
    else
        log_info "Validated required file present: $required_file"
    fi
done

if [[ $missing_count -gt 0 ]]; then
    log_error "$missing_count required secret file(s) missing or empty. Service cannot start."
    exit 1
fi

# ---------------------------------------------------------------------------
# Done — all secrets decrypted, permissions set, required files validated
# ---------------------------------------------------------------------------

log_info "Secret provisioning complete. $decrypt_count file(s) decrypted to tmpfs."
exit 0
