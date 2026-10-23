#!/usr/bin/env bash
# PreToolUse(Write|Edit): bloquea escrituras sobre registros históricos.
#
# Un archivo bajo archive/ describe lo que era cierto ENTONCES; "corregirlo"
# destruye justo lo que existe para preservar. Un ADR aceptado se supersede con
# un ADR nuevo, nunca se edita.
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
    deny "Ruta archivada: registra lo que era cierto en su momento. No se corrige — si el hecho cambió, escribí donde vive el hecho actual." ;;
esac

# ADR aceptado: decisions/NNNN-*.md con Status: Accepted
case "$p" in
  */decisions/[0-9][0-9][0-9][0-9]-*.md)
    if [ -f "$p" ] && grep -qiE '^\*\*Status:\*\*[[:space:]]*Accepted' "$p" 2>/dev/null; then
      deny "ADR aceptado: es inmutable. Para revertir la decisión escribí un ADR nuevo con 'Supersedes: NNNN' y cambiá SOLO la línea Status del viejo a 'Superseded by NNNN'."
    fi ;;
esac
exit 0
