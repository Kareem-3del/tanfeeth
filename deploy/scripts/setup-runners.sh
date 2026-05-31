#!/usr/bin/env bash
# Register N self-hosted GitHub Actions runners for a repo as systemd services.
# Usage: setup-runners.sh <repo_url> <registration_token> <count> <name_prefix>
# Get a token with:
#   gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token -q .token
set -euo pipefail

REPO_URL="$1"; REG_TOKEN="$2"; COUNT="${3:-2}"; PREFIX="${4:-tanfeeth}"
BASE="/opt/actions-runner"
RUNNER_VERSION="${RUNNER_VERSION:-2.321.0}"
TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

mkdir -p "$BASE"
if [ ! -f "$BASE/$TARBALL" ]; then
  curl -fsSL -o "$BASE/$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
fi

for i in $(seq 1 "$COUNT"); do
  DIR="$BASE/${PREFIX}-${i}"
  if [ -d "$DIR" ]; then echo "skip existing $DIR"; continue; fi
  mkdir -p "$DIR"; tar xzf "$BASE/$TARBALL" -C "$DIR"
  cd "$DIR"
  RUNNER_ALLOW_RUNASROOT=1 ./config.sh \
    --url "$REPO_URL" --token "$REG_TOKEN" \
    --name "${PREFIX}-$(hostname)-${i}" \
    --labels "self-hosted,tanfeeth,linux,x64" \
    --unattended --replace
  ./svc.sh install root
  ./svc.sh start
  echo "==> runner ${PREFIX}-${i} registered & started"
done
