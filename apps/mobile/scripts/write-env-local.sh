#!/usr/bin/env bash
# Create .env.local from the shell environment, for cloud workspaces whose environment variables
# already hold the dev-client values. Writes every variable named in .env.local.example that is set.
# Never overwrites an existing .env.local.
set -eu
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  echo "ok: .env.local present, left as is"
  exit 0
fi

names=$(grep -oE '^[A-Z_][A-Z0-9_]*=' .env.local.example | tr -d '=')
written=""
for name in $names; do
  if [ -n "${!name:-}" ]; then
    printf '%s=%s\n' "$name" "${!name}" >> .env.local
    written="$written $name"
  fi
done

if [ -z "$written" ]; then
  echo "MISSING: none of the .env.local.example variables are set in the environment, no .env.local written"
  exit 1
fi
echo "ok: wrote .env.local from the environment:$written"
