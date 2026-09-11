#!/usr/bin/env bash
#
# Revert the "cli-npm-registry" extension.
#
# Restores every backed-up upstream file and removes files the extension added,
# returning the repository to pristine upstream state.

set -euo pipefail

EXT_NAME="cli-npm-registry"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/overlay.sh
. "${SCRIPT_DIR}/../lib/overlay.sh"

revert_patches "$EXT_NAME"
revert_overlay "$EXT_NAME"

log "done. Repository restored to upstream state."
