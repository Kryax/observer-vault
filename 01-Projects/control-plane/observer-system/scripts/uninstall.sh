#!/usr/bin/env bash
# uninstall.sh — Clean removal of Observer Control Plane system components.
# Reverses setup.sh by removing systemd service, tmpfs secrets mount, git hooks,
# and optionally the data directory and service user.
#
# ISC Criteria satisfied:
#   ISC-S5-1: Stops running service before removing files
#   ISC-S5-2: Data directory removal requires explicit user confirmation
#   ISC-S5-3: Idempotent — safe to run if partially uninstalled
#   ISC-S5-A1: NEVER removes source code or git repository
#
# Usage: sudo ./scripts/uninstall.sh
#
# This script is intentionally conservative. It checks whether each component
# exists before attempting removal, making it safe to run multiple times or
# after a partial uninstall.

set -euo pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

readonly SERVICE_NAME="observer-control-plane"
readonly SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
readonly SECRETS_MOUNT="/run/observer-secrets"
readonly DATA_DIR="/opt/observer-system/data"
readonly SERVICE_USER="observer"

# Resolve the repo root relative to this script's location. The script lives
# at <repo>/scripts/uninstall.sh so the repo root is one directory up.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly SCRIPT_DIR
readonly REPO_ROOT

readonly GIT_HOOKS_DIR="${REPO_ROOT}/.githooks"
readonly PRE_COMMIT_HOOK="${GIT_HOOKS_DIR}/pre-commit"

# ---------------------------------------------------------------------------
# State tracking — records what was actually removed for the summary
# ---------------------------------------------------------------------------

declare -a REMOVED=()
declare -a SKIPPED=()

track_removed() {
    REMOVED+=("$1")
}

track_skipped() {
    SKIPPED+=("$1")
}

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

log_info() {
    echo "[uninstall] INFO: $*"
}

log_warn() {
    echo "[uninstall] WARN: $*" >&2
}

log_error() {
    echo "[uninstall] ERROR: $*" >&2
}

# ---------------------------------------------------------------------------
# Root check
# ---------------------------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)."
    exit 1
fi

echo ""
echo "============================================"
echo " Observer Control Plane — Uninstall"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Stop and disable systemd service (ISC-S5-1)
# ---------------------------------------------------------------------------

log_info "Step 1: Stopping and disabling systemd service..."

if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_info "Service '$SERVICE_NAME' is running. Stopping..."
    systemctl stop "$SERVICE_NAME"
    log_info "Service stopped."
    track_removed "Stopped systemd service: ${SERVICE_NAME}"
else
    log_info "Service '$SERVICE_NAME' is not running."
    track_skipped "Service already stopped: ${SERVICE_NAME}"
fi

if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    log_info "Disabling service '$SERVICE_NAME'..."
    systemctl disable "$SERVICE_NAME"
    log_info "Service disabled."
    track_removed "Disabled systemd service: ${SERVICE_NAME}"
else
    log_info "Service '$SERVICE_NAME' is not enabled."
    track_skipped "Service already disabled: ${SERVICE_NAME}"
fi

# ---------------------------------------------------------------------------
# Step 2: Remove systemd unit file and reload daemon
# ---------------------------------------------------------------------------

log_info "Step 2: Removing systemd unit file..."

if [[ -f "$SERVICE_FILE" ]]; then
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    log_info "Removed unit file and reloaded systemd daemon."
    track_removed "Removed systemd unit file: ${SERVICE_FILE}"
else
    log_info "Unit file does not exist: ${SERVICE_FILE}"
    track_skipped "Unit file already absent: ${SERVICE_FILE}"
fi

# ---------------------------------------------------------------------------
# Step 3: Remove tmpfs secrets mount
# ---------------------------------------------------------------------------

log_info "Step 3: Removing tmpfs secrets mount..."

if mountpoint -q "$SECRETS_MOUNT" 2>/dev/null; then
    # Wipe contents before unmounting for defense in depth.
    find "$SECRETS_MOUNT" -type f -exec shred -u {} \; 2>/dev/null || true
    umount "$SECRETS_MOUNT"
    log_info "Unmounted tmpfs at ${SECRETS_MOUNT}."
    track_removed "Unmounted tmpfs: ${SECRETS_MOUNT}"
else
    log_info "${SECRETS_MOUNT} is not a mountpoint."
    track_skipped "Tmpfs not mounted: ${SECRETS_MOUNT}"
fi

if [[ -d "$SECRETS_MOUNT" ]]; then
    rmdir "$SECRETS_MOUNT" 2>/dev/null || true
    if [[ ! -d "$SECRETS_MOUNT" ]]; then
        log_info "Removed directory ${SECRETS_MOUNT}."
        track_removed "Removed directory: ${SECRETS_MOUNT}"
    else
        log_warn "Could not remove ${SECRETS_MOUNT} (may not be empty)."
        track_skipped "Directory not empty: ${SECRETS_MOUNT}"
    fi
else
    track_skipped "Directory already absent: ${SECRETS_MOUNT}"
fi

# ---------------------------------------------------------------------------
# Step 4: Optionally remove data directory (ISC-S5-2 — requires confirmation)
# ---------------------------------------------------------------------------

log_info "Step 4: Data directory removal (requires confirmation)..."

if [[ -d "$DATA_DIR" ]]; then
    echo ""
    read -rp "Remove data directory ${DATA_DIR}? This cannot be undone. [y/N] " confirm_data
    echo ""
    if [[ "$confirm_data" =~ ^[Yy]$ ]]; then
        rm -rf "$DATA_DIR"
        log_info "Removed data directory: ${DATA_DIR}"
        track_removed "Removed data directory: ${DATA_DIR}"
    else
        log_info "Keeping data directory: ${DATA_DIR}"
        track_skipped "Data directory kept (user declined): ${DATA_DIR}"
    fi
else
    log_info "Data directory does not exist: ${DATA_DIR}"
    track_skipped "Data directory already absent: ${DATA_DIR}"
fi

# ---------------------------------------------------------------------------
# Step 5: Optionally remove service user (ISC-S5-2 — requires confirmation)
# ---------------------------------------------------------------------------

log_info "Step 5: Service user removal (requires confirmation)..."

if id "$SERVICE_USER" &>/dev/null; then
    echo ""
    read -rp "Remove '${SERVICE_USER}' system user? [y/N] " confirm_user
    echo ""
    if [[ "$confirm_user" =~ ^[Yy]$ ]]; then
        userdel "$SERVICE_USER" 2>/dev/null || true
        # Remove the group if it still exists and is not a primary group for
        # another user.
        if getent group "$SERVICE_USER" &>/dev/null; then
            groupdel "$SERVICE_USER" 2>/dev/null || true
        fi
        log_info "Removed system user: ${SERVICE_USER}"
        track_removed "Removed system user: ${SERVICE_USER}"
    else
        log_info "Keeping system user: ${SERVICE_USER}"
        track_skipped "System user kept (user declined): ${SERVICE_USER}"
    fi
else
    log_info "System user does not exist: ${SERVICE_USER}"
    track_skipped "System user already absent: ${SERVICE_USER}"
fi

# ---------------------------------------------------------------------------
# Step 6: Remove git hooks
# ---------------------------------------------------------------------------

log_info "Step 6: Removing git hooks..."

if [[ -f "$PRE_COMMIT_HOOK" ]]; then
    rm -f "$PRE_COMMIT_HOOK"
    log_info "Removed pre-commit hook: ${PRE_COMMIT_HOOK}"
    track_removed "Removed git hook: ${PRE_COMMIT_HOOK}"

    # Remove the .githooks directory if it is now empty.
    if [[ -d "$GIT_HOOKS_DIR" ]] && [[ -z "$(ls -A "$GIT_HOOKS_DIR")" ]]; then
        rmdir "$GIT_HOOKS_DIR"
        log_info "Removed empty .githooks directory."
        track_removed "Removed empty directory: ${GIT_HOOKS_DIR}"
    fi
else
    log_info "Pre-commit hook does not exist: ${PRE_COMMIT_HOOK}"
    track_skipped "Git hook already absent: ${PRE_COMMIT_HOOK}"
fi

# Unset core.hooksPath if it points to our .githooks directory.
if git -C "$REPO_ROOT" config --local core.hooksPath 2>/dev/null | grep -q '\.githooks' 2>/dev/null; then
    git -C "$REPO_ROOT" config --local --unset core.hooksPath 2>/dev/null || true
    log_info "Unset git core.hooksPath configuration."
    track_removed "Unset git config: core.hooksPath"
fi

# ---------------------------------------------------------------------------
# Step 7: Print summary
# ---------------------------------------------------------------------------

echo ""
echo "============================================"
echo " Uninstall Summary"
echo "============================================"
echo ""

if [[ ${#REMOVED[@]} -gt 0 ]]; then
    echo "Removed:"
    for item in "${REMOVED[@]}"; do
        echo "  [x] $item"
    done
    echo ""
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
    echo "Skipped (already absent or user declined):"
    for item in "${SKIPPED[@]}"; do
        echo "  [-] $item"
    done
    echo ""
fi

# ISC-S5-A1: Explicit confirmation that source code was not touched.
echo "Source code and git repository: PRESERVED (never removed by this script)"
echo ""
echo "Uninstall complete."
echo ""
