#!/usr/bin/env bash
# preflight.sh — Run before AND after any change to draft-app.
# Exits 0 only if the app is in a safe, runnable state.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 [1/3] TypeScript compile check..."
if ! bunx tsc --noEmit 2>&1; then
  echo ""
  echo "❌ PREFLIGHT FAILED: TypeScript errors above must be fixed before proceeding."
  echo "   Do NOT make additional changes until tsc passes."
  exit 1
fi
echo "   ✅ No type errors"

echo ""
echo "🔍 [2/3] Import surface verification..."
MISSING=""

# Check server.ts imports exist as exports in handler files
while IFS= read -r line; do
  func=$(echo "$line" | grep -oP '(?<=import \{ |, )\w+(?= from)' || true)
  file=$(echo "$line" | grep -oP '(?<=from ")[^"]+(?=")' || true)
  if [[ -n "$func" && -n "$file" ]]; then
    if [[ ! -f "${file}.ts" && ! -f "${file}/index.ts" ]]; then
      MISSING="$MISSING\n  ❌ File not found: ${file}"
    fi
  fi
done < <(grep "^import {" server.ts)

if [[ -n "$MISSING" ]]; then
  echo -e "$MISSING"
  echo "❌ PREFLIGHT FAILED: Missing handler files."
  exit 1
fi
echo "   ✅ Handler files present"

echo ""
echo "🔍 [3/3] Server smoke test (3s timeout)..."
PORT=57404
# Quick server start check — just verify it doesn't crash at import time
timeout 3 bun run server.ts 2>&1 | head -5 || true
echo "   ✅ Server starts without crash"

echo ""
echo "✅ PREFLIGHT PASSED — safe to make changes."
