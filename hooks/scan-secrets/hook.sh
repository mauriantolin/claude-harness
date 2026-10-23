#!/usr/bin/env bash
# PostToolUse(Write|Edit): bloquea si un secreto de alta confianza aterrizó en un
# archivo que SE VA A COMMITEAR.
#
# La regla que evita falsos positivos: si el archivo está gitignoreado (.env.local
# y compañía), un secreto ahí es normal y no se toca. Solo importa lo versionable.
set -uo pipefail
payload="$(cat)"
f="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$f" ] || exit 0
f="${f//\\//}"
[ -f "$f" ] || exit 0

case "$f" in *.env.example|*.env.sample|*.lock|*.md.bak) exit 0 ;; esac
# Gitignoreado = destino legítimo de secretos.
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

# Reportar el patrón y la línea, NUNCA el valor.
lines="$(printf '%s\n' "$hits" | sed 's/:.*//' | tr '\n' ',' | sed 's/,$//')"
kinds="$(printf '%s\n' "$hits" | sed 's/^[0-9]*://' | cut -c1-12 | sort -u | tr '\n' ' ')"
printf '{"decision":"block","reason":"Posible secreto en %s (línea/s %s, prefijo/s: %s). No commitees esto: movelo a una variable de entorno, o al .env local que ya está gitignoreado. Si es un ejemplo, usá un valor obviamente falso."}\n' \
  "$(basename "$f")" "$lines" "$kinds"
exit 0
