#!/usr/bin/env bash
# SessionStart hook — restaura las skills que el repo declara en skills-lock.json.
#
# Por qué existe: las skills instaladas con -g viven en ~/ y NO viajan con el
# repo. Un compañero que clona, o vos en otra máquina, no las tiene. El CLI de
# `skills` ya resuelve esto con un lockfile; esto solo lo dispara solo.
#
# Es idempotente y silencioso: si no hay lockfile, o ya está todo, no hace nada
# y no imprime nada. Nunca instala nada que el repo no haya declarado.
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo_root" || exit 0

lock="skills-lock.json"
[ -f "$lock" ] || exit 0

# Nombres declarados en el lockfile, sin depender de jq (puede no estar).
declared="$(sed -n 's/^[[:space:]]*"\([a-z0-9][a-z0-9._-]*\)"[[:space:]]*:[[:space:]]*{.*/\1/p' "$lock" | grep -v '^skills$')"
[ -n "$declared" ] || exit 0

missing=""
for s in $declared; do
  if [ ! -e ".claude/skills/$s" ] && [ ! -e ".agents/skills/$s/SKILL.md" ]; then
    missing="$missing $s"
  fi
done

link_into_claude() {
  # experimental_install puebla .agents/skills/ pero no linkea a .claude/skills/,
  # que es donde Claude Code descubre. Cerramos ese hueco acá.
  local linked=0
  [ -d .agents/skills ] || return 0
  mkdir -p .claude/skills
  for d in .agents/skills/*/; do
    [ -d "$d" ] || continue
    local name; name="$(basename "$d")"
    [ -f "$d/SKILL.md" ] || continue
    if [ ! -e ".claude/skills/$name" ]; then
      ln -s "../../.agents/skills/$name" ".claude/skills/$name" 2>/dev/null \
        || cp -r "$d" ".claude/skills/$name" 2>/dev/null || continue
      linked=$((linked + 1))
    fi
  done
  return $linked
}

if [ -n "${missing# }" ]; then
  command -v npx >/dev/null 2>&1 || {
    echo "skills-lock.json declara${missing} pero npx no está en el PATH; no pude restaurar." >&2
    exit 0
  }
  npx --yes skills experimental_install >/dev/null 2>&1 || {
    echo "No pude restaurar las skills de skills-lock.json:${missing}" >&2
    exit 0
  }
fi

link_into_claude
n=$?
if [ "$n" -gt 0 ]; then
  echo "Skills del repo restauradas y enlazadas: $n"
fi
exit 0
