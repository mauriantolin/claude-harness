#!/usr/bin/env bash
# PostToolUse(Write|Edit): formatea el archivo tocado con el formatter DEL REPO.
#
# Nunca instala nada ni impone un formatter: si el proyecto no tiene uno, no
# hace nada. Cada hallazgo de formato que muere acá es presupuesto de review
# liberado para lo que solo un modelo puede ver.
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

# Los ignore van por ruta absoluta y no por descubrimiento: prettier los busca
# relativos al cwd, y este hook corre con un cwd que no es el del repo. Sin esto,
# `.prettierignore` no se encuentra y el hook formatea archivos que el repo excluye
# a proposito -por ejemplo `docs/`-, que es como se reformatean specs enteras y se
# destruye un diff. Verificado el 2026-09-09 sobre nomenclator-refactor.
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
