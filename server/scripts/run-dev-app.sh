#!/usr/bin/env bash

set -euo pipefail

SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${SPRING_PROFILES_ACTIVE:-local}"

# Load local secrets (e.g. LDAP credentials) from server/.env.local (gitignored).
# Format: KEY=VALUE lines; comments and blank lines are skipped.
ENV_LOCAL_FILE="$SERVER_DIR/.env.local"
if [[ -f "$ENV_LOCAL_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_LOCAL_FILE"
  set +a
fi

cd "$SERVER_DIR"

./mvnw -pl skillhub-app -am clean package -DskipTests >/dev/null

APP_JAR="$(find skillhub-app/target -maxdepth 1 -type f -name 'skillhub-app-*.jar' ! -name '*.original' | head -n 1)"
if [[ -z "$APP_JAR" ]]; then
  echo "Could not locate packaged skillhub-app jar under skillhub-app/target" >&2
  exit 1
fi

exec "${JAVA_BIN:-java}" -jar "$APP_JAR" --spring.profiles.active="$PROFILE" "$@"
