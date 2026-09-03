# claude-harness

The parts of the Claude Code setup that are authored here rather than installed
from someone else's registry, kept in git so they survive a disk and reach a
second machine.

Everything else is installed and versioned by its own source: the Railly Skills
plugins come from the `railly-skills` marketplace, and the frontend and Vercel
skills are symlinks into `~/.agents/skills/`, managed by the `skills` CLI. None
of that belongs here.

## What is here

### `skills/`

Four skills recreate the delivery path that `factory-loop` references but the
Railly Skills marketplace does not publish. They are reconstructed from the
observable evidence of Railly's own pull requests, **not** from his private
originals, and nothing may assume they are equivalent:

| Skill | Recreated from |
|---|---|
| `spec-gate` | The three published runs under `foundry/runs/spec/` |
| `ship` | `sunat-cli#103`, the agent-browser conventions on absorption and credit, and the anatomy of 29 pull requests |
| `software-factory-maintenance` | The `chore(release)` pull requests in sunat-cli and agent-browser |
| `deploy-gate` | Rewritten from the retired `cicd-deploy-verifier`; Railly covers no deploy surface |

One skill is ours outright:

| Skill | What it does |
|---|---|
| `frontend-stack` | Indexes the thirteen frontend skills (~46,000 lines across 351 files) and orders them for `software-factory`'s implementation stage. It routes; it restates nothing, so each indexed skill keeps updating from upstream |

### `scripts/railly-inrepo.mjs`

Points the Railly skills' canonical source root at the project being worked on,
so contracts, cases and gate runs version with the code instead of living in a
global checkout.

```sh
node scripts/railly-inrepo.mjs scaffold [project]   # once per repository
```

`scaffold` creates `.claude/knowledge/` with the three markers
`resolve-source-root.mjs` validates, seeds a `conventions.md` carrying the
defaults, and writes `RAILLY_SKILLS_REPO` into the project's
`.claude/settings.local.json`.

**Railly's repository is not modified.** His script reads `RAILLY_SKILLS_REPO`
before any default and validates the markers, so pointing the variable at the
scaffolded directory is enough — verified against his unpatched original. That
keeps `source: github` viable and lets upstream updates land untouched.

Settings `env` values are literal strings with no substitution, so the path must
be absolute. That is why it lives in `settings.local.json`, which is per-machine
and gitignored, rather than the shared `settings.json`.

`scripts/railly-inrepo.mjs patch` remains as an escape hatch. It rewrites every
on-disk copy of `resolve-source-root.mjs` to walk up from the working directory
instead of reading the variable, for a context where the variable cannot be set.
It is not needed for the normal path, and a plugin update discards it harmlessly.

## Install

```sh
./install.sh
```

Symlinks `skills/*` into `~/.claude/skills/` and `scripts/*` into
`~/.claude/scripts/`, matching how the `~/.agents/skills` entries are already
wired. Re-runnable.

## Where the rest lives

| Layer | Location | Versioned by |
|---|---|---|
| Method — Railly Skills | `~/.claude/plugins/` | The `railly-skills` marketplace |
| Method — frontend, Vercel | `~/.agents/skills/` | The `skills` CLI |
| Method — authored here | this repository | this repository |
| Evidence — contracts, cases, runs | `<project>/.claude/knowledge/` | The project's own repository |
