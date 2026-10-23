#!/usr/bin/env bash
# PreToolUse(Write|Edit): bloquea ANTES de que el secreto toque el disco.
# Inspecciona el contenido que se va a escribir, no el archivo.
set -uo pipefail
payload="$(cat)"

f="$(printf '%s' "$payload" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
p="${f//\\//}"
case "$p" in *.env.example|*.env.sample|*.lock) exit 0 ;; esac
# Destino gitignoreado = lugar legítimo para un secreto.
[ -n "$p" ] && git -C "$(dirname "$p")" check-ignore -q "$p" 2>/dev/null && exit 0

# El contenido entrante: content (Write) y new_string (Edit).
body="$(printf '%s' "$payload" | sed -n 's/.*"\(content\|new_string\)"[[:space:]]*:[[:space:]]*"\(.*\)/\2/p')"
[ -n "$body" ] || exit 0

kind="$(printf '%s' "$body" | grep -Eo \
  -e '-----BEGIN [A-Z ]*PRIVATE KEY-----' \
  -e 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' \
  -e 'sbp_[a-f0-9]{40}' \
  -e '(ghp|gho|ghs)_[A-Za-z0-9]{36}' \
  -e 'github_pat_[A-Za-z0-9_]{60,}' \
  -e 'sk-[A-Za-z0-9]{32,}' \
  -e 'AKIA[0-9A-Z]{16}' \
  -e 'postgres(ql)?://[^:/@[:space:]]+:[^@[:space:]]{6,}@' \
  2>/dev/null | head -1 | cut -c1-14)"

[ -n "$kind" ] || exit 0
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Se iba a escribir un secreto en %s (prefijo: %s). No aterrizó. Usá una variable de entorno, o escribilo en el .env local que ya está gitignoreado. Si es un ejemplo, que el valor sea obviamente falso."}}\n' \
  "$(basename "${p:-el archivo}")" "$kind"
exit 0
