# claude-harness

The authored half of a Claude Code engineering harness. Railly Skills is the
method layer and comes from its own marketplace; this repository holds what
that marketplace does not publish, plus the machinery that keeps every skill
here measured. The layout mirrors Railly's so there is one structure to learn.

```text
skills/<name>/                stable skills: SKILL.md (<=120 lines) + references/ + evals/{evals.json,triggers.json,fixtures/<fx>/{base,changed}}
skills/.experimental/<name>/  where every new skill is born
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
| `implementation-routing` | software-factory stage 1: which skill owns which surface | ours |
| `frontend-stack` | the frontend index that routing delegates to | ours |
| `ui-design-language` | the design language frontend-stack routes to | derived from `oa-design` (MIT) |

The recreated skills are reconstructed from Railly's observable pull requests,
not from his private originals. Nothing may assume they are equivalent.
Maturity is tracked in `foundry/maturity.json`; being stable means
factory-loop needs it installed, not that it is validated.

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

## Where the rest lives

| Layer | Location | Versioned by |
|---|---|---|
| Method: Railly Skills | `~/.claude/plugins/` | the `railly-skills` marketplace |
| Method: frontend and Vercel skills | `~/.agents/skills/` | the `skills` CLI |
| Method: authored here | this repository | this repository |
| Evidence: contracts, cases, runs of a project | `<project>/.claude/knowledge/` | the project |
| Evidence: this harness's own evals | `foundry/runs/` | this repository |
