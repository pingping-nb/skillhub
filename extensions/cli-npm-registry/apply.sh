#!/usr/bin/env bash
#
# Apply the "cli-npm-registry" extension.
#
# Copies the overlays over the upstream files and applies the patches. Safe to
# run repeatedly: upstream originals are backed up exactly once.

set -euo pipefail

EXT_NAME="cli-npm-registry"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/overlay.sh
. "${SCRIPT_DIR}/../lib/overlay.sh"

apply_overlay "$EXT_NAME"
apply_patches "$EXT_NAME"

log "done. Set SKILLHUB_CLI_NPM_REGISTRY (or Helm web.cliNpmRegistry) to your private registry."
