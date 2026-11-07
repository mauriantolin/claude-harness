#!/usr/bin/env bash
# PostToolUse(Write|Edit): blocks when a high-confidence secret landed in a file that will be
# committed. A gitignored file (.env.local and the like) may hold secrets.
set -uo pipefail
payload="$(cat)"
f="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$f" ] || exit 0
f="${f//\\//}"
[ -f "$f" ] || exit 0

case "$f" in *.env.example|*.env.sample|*.lock|*.md.bak) exit 0 ;; esac
# A gitignored file is a legitimate place for secrets.
git -C "$(dirname "$f")" check-ignore -q "$f" 2>/dev/null && exit 0

hits="$(grep -nEo \
  -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' \
  -e 'sbp_[a-f0-9]{40}' \
  -e '(ghp|gho|ghs)_[A-Za-z0-9]{36}' \
  -e 'github_pat_[A-Za-z0-9_]{60,}' \
  -e 'sk-[A-Za-z0-9]{32,}' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'postgres(ql)?://[^:/@[:space:]]+:[^@[:space:]]{6,}@' \
  "$f" 2>/dev/null | head -5)"

[ -n "$hits" ] || exit 0

# Report the pattern and the line, never the value.
lines="$(printf '%s\n' "$hits" | sed 's/:.*//' | tr '\n' ',' | sed 's/,$//')"
kinds="$(printf '%s\n' "$hits" | sed 's/^[0-9]*://' | cut -c1-12 | sort -u | tr '\n' ' ')"
printf '{"decision":"block","reason":"Possible secret in %s (line(s) %s, prefix(es): %s). Do not commit it: move it to an environment variable or to the local .env, which is gitignored. If it is an example, use an obviously fake value."}\n' \
  "$(basename "$f")" "$lines" "$kinds"
exit 0
