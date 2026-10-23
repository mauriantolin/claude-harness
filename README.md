# claude-harness

The authored half of a Claude Code engineering harness. Railly Skills is the
method layer and comes from its own marketplace; this repository holds what
that marketplace does not publish, plus the machinery that keeps every skill
here measured. The layout mirrors Railly's so there is one structure to learn.

```text
skills/<name>/                stable skills: SKILL.md (<=120 lines) + references/ + evals/{evals.json,triggers.json,fixtures/<fx>/{base,changed}}
skills/.experimental/<name>/  where every new skill is born
hooks/<name>/                 hook.mjs or hook.sh (+ what it injects + evals/); hooks/events.json says which event each runs on
bin/                          commands installed on the PATH (perfil)
machine/                      a new machine: bootstrap, settings, global skills, the global CLAUDE.md template
cases/<repo>/                 evidence from real work
foundry/maturity.json         channel + maturity per skill (the registry)
foundry/eval-protocol.md      the three-arm protocol and the promotion bar
foundry/rounds/NNN-*/         decisions, one directory per round
foundry/runs/{evals,triggers} run evidence (gradings and benchmarks are versioned)
scripts/                      validate, doctor, scaffold, eval and trigger runners; scripts/lib is tested
```

## Skills

| Skill | Role in factory-loop | Origin |
|---|---|---|
| `ship` | promotion → commit, push, PR with the evidence ledger | recreated from sunat-cli#103, agent-browser conventions, 29 PRs |
| `spec-gate` | independent Spec check between software-factory and review-gate | recreated from Railly's three published spec runs |
| `software-factory-maintenance` | maintainer workflow after the loop: queue, merge, release, publish | recreated from the `chore(release)` PRs |
| `deploy-gate` | after ship: watch CI, verify the deployment serves this commit | ours; Railly covers no deploy surface |
| `implementation-routing` | software-factory stage 1: which skill owns which surface, and a lookup for what is owed | ours |
| `frontend-stack` | the frontend index that routing delegates to | ours |
| `ui-design-language` | the design language frontend-stack routes to | derived from `oa-design` (MIT) |

The recreated skills are reconstructed from Railly's observable pull requests,
not from his private originals. Nothing may assume they are equivalent.
Maturity is tracked in `foundry/maturity.json`; being stable means
factory-loop needs it installed, not that it is validated.

## Hooks

A hook is how this repository changes the behavior of a skill it does not
author without touching its files. Railly's marketplace clone stays clean;
the patch rides alongside at load time.

| Hook | Event | What it does |
|---|---|---|
| `railly-root-worktree` | `SessionStart` | A worktree a tool created starts without `.claude/settings.local.json`; copies `RAILLY_SKILLS_REPO` from the main worktree, or scaffolds one. |
| `restore-repo-skills` | `SessionStart` | Restores the skills a repository declares in `skills-lock.json`. Silent when there is nothing to do. |
| `scan-secrets-pre` / `scan-secrets` | `PreToolUse` / `PostToolUse` on `Write|Edit` | Blocks a high-confidence secret before it lands, and again if one lands in a file git would commit. Gitignored files are left alone. |
| `guard-immutable-docs` | `PreToolUse` on `Write|Edit` | Refuses edits under `archive/` and to an accepted ADR. |
| `format-touched` | `PostToolUse` on `Write|Edit` | Formats the touched file with the repository's own prettier (or shfmt), honoring its ignore files. Never installs a formatter. |
| `factory-loop-checkpoints` | `PostToolUse` on `Skill` | When the call that just completed loaded `factory-loop`, injects `addendum.md`: where the work-item manifest lives and how to create it, that a phase exists only through its owning skill's `Skill` call, and that context in a prompt is not human confirmation. Silent on every other tool call. |

`./install.sh` links `hooks/<name>/hook.{mjs,sh}` to `~/.claude/hooks/<name>.{mjs,sh}`
as a launcher. `node machine/settings.mjs` registers every hook in
`hooks/events.json` in `~/.claude/settings.json` (or edit it by hand), and
`npm run doctor` checks both:

```json
{ "hooks": { "PostToolUse": [ { "matcher": "Skill", "hooks": [
  { "type": "command", "command": "node \"C:\\Users\\<you>\\.claude\\hooks\\factory-loop-checkpoints.mjs\"", "timeout": 10 }
] } ] } }
```

A hook is measured against the skill it patches, with the same runner. The
hook is global once registered, so the "skill without its hook" arm is the
same suite with the hook switched off by the variable it honors:

```sh
E=hooks/factory-loop-checkpoints/evals/evals.json
npm run eval -- factory-loop --evals $E --model haiku --judge haiku --parallel 3 --env FACTORY_LOOP_CHECKPOINTS=off
npm run eval -- factory-loop --evals $E --model haiku --judge haiku --parallel 3
```

The judge sees the `Skill` calls the session stream recorded, and whether each
one actually loaded, so an assertion that a delegate was *invoked* is
observable, not taken from prose. Why this hook exists, and the runner defect
its first run exposed, are in
[round 002](foundry/rounds/002-factory-loop-checkpoints/decision.md).

## Daily commands

```sh
npm test                      # scripts/lib unit tests (node:test, no dependencies)
npm run validate              # repository content: frontmatter, links, evals, triggers, maturity, marketplace, cases
npm run verify-fixtures       # materialize every fixture and run its declared verification command
npm run audit                 # skillkit audit, as Railly's CI runs it (needs bun; network on first run)
npm run doctor                # the machine: binaries, plugins, links, factory-loop dependencies, clean Railly clone
npm run check                 # test + validate + verify-fixtures + claude plugin validate
./install.sh                  # link skills and script launchers into ~/.claude (re-runnable)
```

## Adding a skill

```sh
npm run new-skill -- <name>   # scaffolds skills/.experimental/<name>, registers it
# author SKILL.md, evals/evals.json, evals/triggers.json; remove every TODO
npm run validate
./install.sh
npm run triggers -- <name>                       # loads when it should, and only then
npm run eval -- <name> --model haiku --judge haiku --parallel 4    # cheap first baseline
npm run eval -- <name>                           # no_skill vs current on the default model
```

Promote by moving the directory to `skills/`, setting `channel: "stable"` in
`foundry/maturity.json`, moving its path in `.claude-plugin/marketplace.json`,
and recording the run in a new `foundry/rounds/` entry. The bar is in
`foundry/eval-protocol.md`: an eval the `no_skill` arm passes is not evidence
the skill works.

## Evals

`run-skill-eval.mjs` runs each eval in each arm (`no_skill`, `current`,
`candidate`), grades every assertion with an independent judge that reads the
answer and, for fixture runs, the repository state after the run, then
aggregates into `benchmark.json` and `benchmark.md`. `run-trigger-eval.mjs`
sends each query from an empty directory and reads the stream for `Skill`
invocations. Both need the skill linked into `~/.claude/skills`, which is what
`install.sh` does.

`claude plugin eval` is early-access on this account; when it opens up, the
suites here are close enough to its shape to port.

### Progressive disclosure

`SKILL.md` is the method and stays under 120 lines, as Railly's validator
requires. Anything a reader needs only sometimes (report shapes, index tables,
recipes, catalogs) lives in `references/` behind a link whose sentence says
when to read it ("read X when Y"). `npm run validate` enforces the line cap
and the links; `npm run audit` enforces that every reference is linked and
gated.

### Compatibility with Railly's tooling

`evals.json`, `triggers.json` (with a unique `id` per case) and the
`fixtures/<name>/{base,changed}` layout with a `verification` command per
fixture eval are the shapes Railly's `validate-skills.mjs` accepts, and it
passes over this repository when pointed at it with `RAILLY_SKILLS_REPO`.
His scripts themselves are Linux tooling (bun, `import.meta.dir`, forward-slash
paths, CI on ubuntu) and his eval scripts only look at his own checkout; this
repository carries node ports of the pieces that matter for testing skills,
and the runners he does not have. Details in
`foundry/rounds/001-align-to-railly-foundry/decision.md`.

## External dependencies factory-loop needs

`solution-gate` delegates to Ryan Singer's `shaping` skill (and resumes it
for breadboarding after a pass), and says not to recreate it locally. It is
not part of Railly's marketplace, so it is installed the way its README says:

```sh
git clone https://github.com/rjs/shaping-skills.git ~/.local/share/shaping-skills
# then link shaping/ and breadboarding/ into ~/.claude/skills (junctions on Windows)
```

`npm run doctor` checks every installed Railly skill's `Skill(...)` list, so a
missing delegate shows up as an error before an agent has to report it as a
gap. `herdr` is the one dependency Railly's own text calls optional; the
doctor warns instead of failing.

## Working in a project

Railly's skills write contracts, cases and gate runs to a canonical source
root. To keep that inside the project instead of a global checkout:

```sh
node scripts/railly-inrepo.mjs scaffold [project]   # once per repository
```

It creates `.claude/knowledge/` with the markers Railly's resolver validates,
seeds `cases/<repo>/conventions.md`, and writes `RAILLY_SKILLS_REPO` into the
project's `.claude/settings.local.json`. Railly's files are never modified;
his resolver reads the variable before any default, and the scaffold proves
it by running his unmodified resolver at the end.

## A new machine

```sh
git clone https://github.com/mauriantolin/claude-harness ~/repos/claude-harness
~/repos/claude-harness/machine/bootstrap-ubuntu.sh
```

The base and nothing else: Tailscale, Claude Code, Orca, Google Chrome (the
`.deb`, which Claude in Chrome needs), the CLIs (gh, aws, gcloud, vercel, neon,
supabase, node, pnpm, bun, uv), RDP through GNOME Remote Desktop, this
repository's install, the hooks registered, the global skills in
`machine/skills.txt`, the plugins, and `~/.claude/CLAUDE.md` from
`machine/CLAUDE.global.md`. Every step checks before it installs, so it is safe to
run again. Logins are not done for you; the script ends by listing them.

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

## Where the rest lives

| Layer | Location | Versioned by |
|---|---|---|
| Method: Railly Skills | `~/.claude/plugins/` | the `railly-skills` marketplace |
| Method: frontend and Vercel skills | `~/.agents/skills/` | the `skills` CLI |
| Method: authored here | this repository | this repository |
| Evidence: contracts, cases, runs of a project | `<project>/.claude/knowledge/` | the project |
| Evidence: this harness's own evals | `foundry/runs/` | this repository |
