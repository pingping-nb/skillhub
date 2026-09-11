#!/usr/bin/env bash
#
# Apply every extension under extensions/ that has an apply.sh.
#
# Extensions are applied in lexicographic order. Each apply.sh is idempotent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

shopt -s nullglob
for apply in "${SCRIPT_DIR}"/*/apply.sh; do
  printf '\n=== %s ===\n' "$(basename "$(dirname "$apply")")"
  "$apply"
done
