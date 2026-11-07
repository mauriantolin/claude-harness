#!/usr/bin/env bash
# SessionStart hook: restores the skills the repository declares in skills-lock.json.
#
# Skills installed with -g live in ~/ and do not travel with the repository; the `skills` CLI
# restores them from the lockfile, and this hook runs it. Idempotent and silent: with no lockfile,
# or nothing missing, it does and prints nothing. It never installs what the repository did not
# declare.
set -uo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$repo_root" || exit 0

lock="skills-lock.json"
[ -f "$lock" ] || exit 0

# The names the lockfile declares, without jq (it may be missing).
declared="$(sed -n 's/^[[:space:]]*"\([a-z0-9][a-z0-9._-]*\)"[[:space:]]*:[[:space:]]*{.*/\1/p' "$lock" | grep -v '^skills$')"
[ -n "$declared" ] || exit 0

missing=""
for s in $declared; do
  if [ ! -e ".claude/skills/$s" ] && [ ! -e ".agents/skills/$s/SKILL.md" ]; then
    missing="$missing $s"
  fi
done

link_into_claude() {
  # experimental_install fills .agents/skills/ but does not link .claude/skills/, where Claude Code
  # looks for skills.
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
    echo "skills-lock.json declares${missing} but npx is not on the PATH; could not restore them." >&2
    exit 0
  }
  npx --yes skills experimental_install >/dev/null 2>&1 || {
    echo "Could not restore the skills of skills-lock.json:${missing}" >&2
    exit 0
  }
fi

link_into_claude
n=$?
if [ "$n" -gt 0 ]; then
  echo "Repository skills restored and linked: $n"
fi
exit 0
