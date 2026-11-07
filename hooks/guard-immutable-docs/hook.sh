#!/usr/bin/env bash
# PreToolUse(Write|Edit): denies writes to historical records.
#
# A file under archive/ records what was true at the time; correcting it destroys what it exists
# to keep. An accepted ADR is superseded by a new one, never edited.
set -uo pipefail
payload="$(cat)"
f="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$f" ] || exit 0
p="${f//\\//}"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

case "$p" in
  */archive/*|*/.archive/*)
    deny "Archived path: it records what was true at the time and is not corrected. If the fact changed, write where the current fact lives." ;;
esac

# An accepted ADR: decisions/NNNN-*.md with Status: Accepted
case "$p" in
  */decisions/[0-9][0-9][0-9][0-9]-*.md)
    if [ -f "$p" ] && grep -qiE '^\*\*Status:\*\*[[:space:]]*Accepted' "$p" 2>/dev/null; then
      deny "Accepted ADR: it is immutable. To reverse the decision write a new ADR with 'Supersedes: NNNN' and change ONLY the Status line of the old one to 'Superseded by NNNN'."
    fi ;;
esac
exit 0
