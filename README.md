# claude-harness

The authored half of a Claude Code engineering harness. [Railly Skills](https://github.com/Railly/skills)
is the method (`contract` → `loop` → `verify-setup` → `gate` → `correct`) and comes from its own
marketplace, unmodified. This repository is a marketplace too: the plugins a repository enables
beside Railly's, the command that brings both into a repository, and the eval machinery that keeps
every skill and hook here measured.

Nothing of the harness is global. A machine keeps only context (`~/.claude/CLAUDE.md`, the
profiles); each repository declares its plugins in `.claude/settings.json`, so whoever clones it
gets the same harness, and two repositories never compete with each other's skills or hooks.

```text
skills/<name>/          SKILL.md (<=120 lines) + references/ + evals/{evals.json,triggers.json,fixtures/<fx>/{base,changed}}
hooks/<name>/           hook.mjs or hook.sh (+ what it injects + evals/); hooks/events.json says which event each runs on
hooks/core.json         the harness plugin's hook config, generated from events.json (scripts/build-hooks.mjs)
templates/              .agents/harness.md and .agents/routing.md for a repository's first `harness init`
bin/                    commands on the PATH: harness, perfil
machine/                a new machine: bootstrap, global settings (context only), the global CLAUDE.md template
cases/<repo>/           evidence from real work
foundry/                maturity.json, eval-protocol.md, rounds/NNN-*/ (decisions), runs/ (evidence)
scripts/                validate, doctor, eval and trigger runners; scripts/lib is tested
```

## Plugins

| Plugin | Holds | Enabled by |
|---|---|---|
| `harness` | `route`, `deploy-gate`, and the hooks below | every harnessed repository |
| `harness-design` | `ui-design-language` | a repository without a design system of its own |
| `harness-maintainer` | `maintain` (merge, release, publish) | a repository that publishes packages |

```text
/plugin install harness --marketplace mauriantolin/claude-harness
/plugin install harness-design --marketplace mauriantolin/claude-harness
/plugin install harness-maintainer --marketplace mauriantolin/claude-harness
```

## Where it plugs into Railly's loop

```text
contract ──► [loop-bindings: read .agents/harness.md] ──► route ──► implement ──► observe ──► gate ──► human ──► deliver ──► deploy-gate ──► correct
                                                          │ route-guard blocks an edit     │ verify-before-done blocks a stop
                                                          │ until its owner skill loaded   │ until fresh.sh passes
```

| Piece | Kind | What it does |
|---|---|---|
| `loop-bindings` | PostToolUse(Skill) hook | When `loop` or `contract` loads, injects [bindings.md](hooks/loop-bindings/bindings.md): read the repository's `.agents/harness.md`, route before implementing, observe the deployment after delivery. |
| `route` | skill | Names each surface's owner from `.agents/routing.md` (which wins over its generic table), loads the owners before the first edit, records them in the contract. |
| `route-guard` | PreToolUse(Write\|Edit) hook | Blocks an edit to a path in the `routes` block of `.agents/routing.md` until the agent making it, a subagent included, has loaded every owner of that path. |
| `verify-before-done` | Stop hook | While `.agents/verify/contract.md` exists, a session cannot stop until Railly's `fresh.sh` passes for the exact tree. Railly's kit is built for this hook and Railly does not publish it. |
| `knowledge-root` | SessionStart hook | Points Railly's canonical root (`RAILLY_SKILLS_REPO`) at `.agents/knowledge`, ignored, through `CLAUDE_ENV_FILE`: no `settings.local.json`, any clone or worktree. |
| `deploy-gate` | skill | After delivery: CI to a terminal state and the deployment serving that commit. |
| `restore-repo-skills` | SessionStart hook | Restores the skills a repository locks in `skills-lock.json`. |
| `scan-secrets-pre`, `scan-secrets` | Pre/PostToolUse(Write\|Edit) hooks | Block a high-confidence secret before and after it lands in a file git would commit. |
| `guard-immutable-docs` | PreToolUse(Write\|Edit) hook | Refuses edits under `archive/` and to an accepted ADR. |
| `format-touched` | PostToolUse(Write\|Edit) hook | Formats the touched file with the repository's own prettier (or shfmt), honoring its ignore files. |

Every hook honors an off switch (`HARNESS_<NAME>=off`), which is how an eval measures it against
the same suite without it.

## A repository

```sh
harness init [repo] [--design] [--maintainer] [--local]   # once; never overwrites
harness check [repo]                                      # what is missing or still a stub
```

`init` writes `.claude/settings.json` (both marketplaces, Railly's two plugins and `harness`),
scaffolds Railly's kit into `.agents/verify/`, seeds `.agents/harness.md` and `.agents/routing.md`
from `templates/`, and ignores `.agents/knowledge/` and the per-change contract. `--local` keeps
all of it out of git, for a repository you do not own. Then, in a session there: fill `doctor.sh`,
`check.sh` and the drivers (Railly's `verify-setup`), and write in `harness.md` and `routing.md`
only what is true in that repository. Where a plugin skill and a repository skill claim the same
surface, the repository's `routing.md` names the winner under "Supersedes".

## Daily commands

```sh
npm test                 # scripts/lib, hooks (end to end over the real hook files) and bin
npm run validate         # skills, evals, maturity, marketplace (every skill in exactly one plugin), hooks/core.json fresh
npm run verify-fixtures  # materialize every fixture and run its declared verification command
npm run audit            # skillkit audit, as Railly's CI runs it
npm run doctor           # the machine: Railly at its remote HEAD, nothing of the harness global, hooks and dependencies
npm run check            # test + validate + verify-fixtures + build-hooks --check + claude plugin validate
./install.sh             # bin/ on the PATH; removes what earlier versions linked into ~/.claude
```

## Evals

`run-skill-eval.mjs` runs each eval in each arm and grades it twice: an independent judge reads the
answer and the Skill calls the session stream recorded, and deterministic `checks` read what the
session did (the tool timeline, subagents included) and what it left (the repository):
`loaded_in_order`, `not_loaded`, `loaded_before_edit`, `file_contains`, `ran_command`,
`no_command`, `no_edit`, `origin_empty`. A check no judge can talk around is the evidence that a
step was taken.

| Arm | Sees |
|---|---|
| `no_skill` | no skills at all |
| `bare` | what the working directory offers (its skills, plugins, hooks), without this repository's plugin |
| `current` | the same, told to load the skill (`--nudge`, or `--nudge none` for the prompt as a person types it) |
| `candidate` | this working copy as the `harness` plugin (skills and hooks, copied: a linked plugin loses its hooks) |

A fixture is `fixtures/<name>/{base,changed}`, or `fixture_repo`: a real repository's working state
in a local clone whose origin is an empty bare repository, so a push that escapes every guard never
reaches its remote. That is how a repository measures its own harness end to end, with its suite
in its own tree:

```sh
npm run eval -- route --variants bare,candidate --model sonnet --parallel 4
npm run eval -- loop --evals hooks/loop-bindings/evals/evals.json --variants candidate --nudge experimental:loop
npm run eval -- loop --evals hooks/loop-bindings/evals/evals.json --variants candidate --nudge experimental:loop --env HARNESS_LOOP_BINDINGS=off --env HARNESS_ROUTE_GUARD=off
npm run eval -- loop --evals <repo>/.agents/evals/loop.json --variants bare,candidate --nudge none
npm run triggers -- <skill> [--cwd <repo>] [--triggers <file>]   # loads when it should; --cwd finds a repository's dormant skills
```

The bar for a skill is in `foundry/eval-protocol.md`: an eval the baseline arm passes is not
evidence the skill works. Each round's decision and numbers are in `foundry/rounds/`.

## A new machine

```sh
git clone https://github.com/mauriantolin/claude-harness ~/repos/claude-harness
~/repos/claude-harness/machine/bootstrap-ubuntu.sh
```

Tailscale, Claude Code, Orca, Chrome, the CLIs (gh, aws, gcloud, vercel, neon, supabase, node,
pnpm, bun, uv), RDP, `install.sh`, `machine/settings.mjs` (the model and the two marketplaces,
known and not enabled) and `~/.claude/CLAUDE.md` from `machine/CLAUDE.global.md`. No skills, hooks
or plugins are enabled globally: repositories bring them. `machine/skills.txt` is the catalog of
external skills a repository may lock with `npx skills add <source> -a claude-code -s <skill>`.
Every step checks before it installs; logins are listed at the end, not done for you.

## Profiles: `perfil`

Every CLI session lives in a named profile under `~/.perfiles/<name>/`, never in
the machine's global config, so two projects (or two agent sessions) on
different accounts share the machine without stepping on each other.

```sh
perfil                          # list profiles
perfil <name> estado            # which service has a session or a key
perfil <name> login <service>   # gh, vercel, neon, aws, gcloud; or where a key goes
perfil <name> -- <command...>   # run with the profile's sessions; child processes inherit them
perfil <name> git               # this clone authenticates to GitHub with the profile's gh
```

Generalized from Nomenclator's `pnpm perfil`; the directory layout is the same,
so pointing `NOMENCLATOR_PERFILES` at `~/.perfiles` makes both read one set of
logins.
