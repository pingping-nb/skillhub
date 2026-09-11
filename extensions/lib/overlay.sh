#!/usr/bin/env bash
#
# Shared helpers for SkillHub extensions.
#
# An "overlay" is a file under extensions/<ext>/overlays/ whose path mirrors a
# path in the repository root. Applying an overlay copies it over the upstream
# file, after recording the upstream original so it can be restored.
#
# This library is intentionally dependency-free (POSIX-ish bash + git) so it
# works in CI and on a fresh clone.

set -euo pipefail

# Repository root = two levels up from this file (extensions/lib/overlay.sh).
OVERLAY_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${OVERLAY_LIB_DIR}/../.." && pwd)"
EXTENSIONS_DIR="${REPO_ROOT}/extensions"
BACKUP_DIR="${EXTENSIONS_DIR}/.backup"

log()  { printf '[overlay] %s\n' "$*" >&2; }
warn() { printf '[overlay] WARN: %s\n' "$*" >&2; }
die()  { printf '[overlay] ERROR: %s\n' "$*" >&2; exit 1; }

# apply_overlay <extension-name>
# Copies every file under extensions/<ext>/overlays/ into the repo root,
# backing up the upstream original first. Idempotent.
apply_overlay() {
  local ext="$1"
  local overlay_root="${EXTENSIONS_DIR}/${ext}/overlays"
  [ -d "$overlay_root" ] || die "no overlays directory for extension '${ext}'"

  local rel src dst backup
  while IFS= read -r -d '' src; do
    rel="${src#"$overlay_root"/}"
    dst="${REPO_ROOT}/${rel}"
    backup="${BACKUP_DIR}/${ext}/${rel}"

    # Back up the pristine upstream file exactly once.
    if [ -f "$dst" ] && [ ! -f "$backup" ]; then
      mkdir -p "$(dirname "$backup")"
      cp -p "$dst" "$backup"
      log "backed up ${rel}"
    fi

    mkdir -p "$(dirname "$dst")"
    cp -p "$src" "$dst"
    log "applied ${rel}"
  done < <(find "$overlay_root" -type f -print0)

  log "extension '${ext}' applied"
}

# revert_overlay <extension-name>
# Restores every backed-up upstream file and removes files that did not exist
# upstream (i.e. overlays that added new files).
revert_overlay() {
  local ext="$1"
  local overlay_root="${EXTENSIONS_DIR}/${ext}/overlays"
  local backup_root="${BACKUP_DIR}/${ext}"
  [ -d "$overlay_root" ] || die "no overlays directory for extension '${ext}'"

  local rel src dst backup
  while IFS= read -r -d '' src; do
    rel="${src#"$overlay_root"/}"
    dst="${REPO_ROOT}/${rel}"
    backup="${backup_root}/${rel}"

    if [ -f "$backup" ]; then
      cp -p "$backup" "$dst"
      log "restored ${rel}"
    else
      rm -f "$dst"
      log "removed added file ${rel}"
    fi
  done < <(find "$overlay_root" -type f -print0)

  rm -rf "$backup_root"
  log "extension '${ext}' reverted"
}

# check_overlay <extension-name>
# Reports whether each applied overlay still matches what is on disk, and
# whether the upstream file has drifted since the overlay was derived.
check_overlay() {
  local ext="$1"
  local overlay_root="${EXTENSIONS_DIR}/${ext}/overlays"
  [ -d "$overlay_root" ] || die "no overlays directory for extension '${ext}'"

  local rel src dst status
  while IFS= read -r -d '' src; do
    rel="${src#"$overlay_root"/}"
    dst="${REPO_ROOT}/${rel}"
    if [ ! -f "$dst" ]; then
      status="MISSING"
    elif cmp -s "$src" "$dst"; then
      status="applied"
    else
      status="DRIFTED"
    fi
    printf '%-12s %s\n' "$status" "$rel"
  done < <(find "$overlay_root" -type f -print0)
}

# apply_patches <extension-name>
# Applies every *.patch under extensions/<ext>/patches/ with `git apply --3way`.
apply_patches() {
  local ext="$1"
  local patch_root="${EXTENSIONS_DIR}/${ext}/patches"
  [ -d "$patch_root" ] || return 0

  local patch
  for patch in "$patch_root"/*.patch; do
    [ -e "$patch" ] || continue
    log "applying patch $(basename "$patch")"
    git -C "$REPO_ROOT" apply --3way "$patch" \
      || die "patch failed: $(basename "$patch")"
  done
}

# revert_patches <extension-name>
# Reverses every *.patch under extensions/<ext>/patches/ in reverse order.
revert_patches() {
  local ext="$1"
  local patch_root="${EXTENSIONS_DIR}/${ext}/patches"
  [ -d "$patch_root" ] || return 0

  local patch
  # Reverse order so later patches are undone before earlier ones.
  for patch in $(ls -r "$patch_root"/*.patch 2>/dev/null); do
    [ -e "$patch" ] || continue
    log "reverting patch $(basename "$patch")"
    git -C "$REPO_ROOT" apply --reverse --3way "$patch" \
      || die "patch revert failed: $(basename "$patch")"
  done
}

# ---------------------------------------------------------------------------
# CLI dispatcher
#
# When executed directly (not sourced), expose the helpers as subcommands:
#   overlay.sh apply  <ext>
#   overlay.sh revert <ext>
#   overlay.sh check  <ext>
# ---------------------------------------------------------------------------
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  cmd="${1:-}"
  ext="${2:-}"
  case "$cmd" in
    apply)  [ -n "$ext" ] || die "usage: overlay.sh apply <ext>";  apply_overlay "$ext"; apply_patches "$ext" ;;
    revert) [ -n "$ext" ] || die "usage: overlay.sh revert <ext>"; revert_patches "$ext"; revert_overlay "$ext" ;;
    check)  [ -n "$ext" ] || die "usage: overlay.sh check <ext>";  check_overlay "$ext" ;;
    *)      die "usage: overlay.sh {apply|revert|check} <ext>" ;;
  esac
fi
