#!/usr/bin/env bash
# PostToolUse(Write|Edit): formats the touched file with the repository's own formatter.
#
# It never installs or imposes a formatter: a project without one gets nothing.
set -uo pipefail
payload="$(cat)"
f="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$f" ] || exit 0
f="${f//\\//}"
[ -f "$f" ] || exit 0

case "$f" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.scss|*.md|*.mdx|*.yml|*.yaml) ;;
  *.sh|*.bash) command -v shfmt >/dev/null 2>&1 && shfmt -w "$f" >/dev/null 2>&1; exit 0 ;;
  *) exit 0 ;;
esac

root="$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -x "$root/node_modules/.bin/prettier" ] || exit 0

# The ignore files go by absolute path: prettier looks for them relative to the cwd, and this
# hook runs with a cwd that is not the repository's, so it would format files the repository
# excludes on purpose.
if [ -f "$root/.prettierignore" ] && [ -f "$root/.gitignore" ]; then
  "$root/node_modules/.bin/prettier" --write --ignore-unknown --ignore-path "$root/.gitignore" --ignore-path "$root/.prettierignore" "$f" >/dev/null 2>&1 || true
elif [ -f "$root/.prettierignore" ]; then
  "$root/node_modules/.bin/prettier" --write --ignore-unknown --ignore-path "$root/.prettierignore" "$f" >/dev/null 2>&1 || true
elif [ -f "$root/.gitignore" ]; then
  "$root/node_modules/.bin/prettier" --write --ignore-unknown --ignore-path "$root/.gitignore" "$f" >/dev/null 2>&1 || true
else
  "$root/node_modules/.bin/prettier" --write --ignore-unknown "$f" >/dev/null 2>&1 || true
fi
exit 0
