#!/usr/bin/env bash
set -euo pipefail

MOD_DIR="mode-manager"
MANIFEST="$MOD_DIR/manifest.json"
INDEX_JS="$MOD_DIR/index.js"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

[ -d "$MOD_DIR" ] || fail "Missing folder: $MOD_DIR"
[ -f "$MANIFEST" ] || fail "Missing file: $MANIFEST"
[ -f "$INDEX_JS" ] || fail "Missing file: $INDEX_JS"

command -v jq >/dev/null 2>&1 || fail "jq is required"
jq empty "$MANIFEST" >/dev/null 2>&1 || fail "manifest.json is not valid JSON"

[ "$(jq -r '.id' "$MANIFEST")" != "null" ] || fail "manifest id missing"
[ "$(jq -r '.name' "$MANIFEST")" != "null" ] || fail "manifest name missing"
[ "$(jq -r '.main' "$MANIFEST")" = "index.js" ] || fail "manifest main must be index.js"
[ "$(jq -r '.version' "$MANIFEST")" != "null" ] || fail "manifest version missing"
[ "$(jq -r '.author.name' "$MANIFEST")" != "null" ] || fail "manifest author.name missing"
[ "$(jq -r '.dependencies["subway-builder"]' "$MANIFEST")" != "null" ] || fail "subway-builder dependency missing"

grep -q 'window.SubwayBuilderAPI' "$INDEX_JS" || fail "API check missing"
grep -q 'onGameInit' "$INDEX_JS" || fail "onGameInit hook missing"

echo "PASS: smoke test"
