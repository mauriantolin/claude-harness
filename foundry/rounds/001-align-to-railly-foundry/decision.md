# Round 001: align the harness to Railly's foundry, and make every skill testable

Date: 2026-09-03
Status: decided and applied
Scope: this repository, and the machine-level setup it installs into

## Why

The harness had every piece and none of the coherence. Two install paths
(junctions from `install.sh`, plus a marketplace entry that duplicated the
`railly-skills` marketplace), two redirection mechanisms for Railly's source
root (a patch applied to his clone *and* `RAILLY_SKILLS_REPO`), eval runs
stored inside the installable skill directories, four of six skills without
evals, a `triggers.json` with no runner, scripts with no tests, and a global
`~/.claude` carrying a hook that failed on every session start, a document for
a workflow deleted a day earlier, and an unversioned skill.

A second orchestrator was also installed: superpowers forces its own process
skills on every message and overlaps work-intake, solution-gate,
software-factory, test-strength, review-gate and ship one for one.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Mirror Railly's layout: `skills/`, `skills/.experimental/`, `cases/`, `foundry/{maturity.json,eval-protocol.md,rounds/,runs/}`, `scripts/` | One structure to learn, and every new skill has an obvious place to be born (`.experimental`) and a defined path to `stable` |
| D2 | One install path: `install.sh` links both catalogs into `~/.claude/skills`; the marketplace lists the same skills for a second machine. The `method` plugin entry is removed; Railly's marketplace already provides it | Two mechanisms that must agree will not |
| D3 | One redirection for Railly's source root: `RAILLY_SKILLS_REPO` in the project's `settings.local.json`. The `patch` command is deleted and every patched copy on disk is reverted | His resolver reads the variable before any default, so modifying his files bought nothing and cost a re-patch on every update |
| D4 | Eval runs move to `foundry/runs/{evals,triggers}/<skill>/<stamp>/`. Gradings and benchmarks are versioned; throwaway repositories, raw outputs and transcripts are ignored | Runs are evidence, not package contents |
| D5 | Every stable skill carries `evals.json` and `triggers.json`, and `validate-skills.mjs` refuses a stable skill without them or with a `TODO` left in place | A skill that cannot be measured cannot be promoted, and a scaffold must not pass as authored |
| D6 | Keep the headless runner (`run-skill-eval.mjs`); add a trigger runner; add `doctor.mjs` for the machine and `validate-skills.mjs` for the repository; test the shared logic with `node:test` | `claude plugin eval` is still early-access on this account. The runner is the only thing that closes the loop |
| D7 | Disable superpowers; remove the empty `ecc` marketplace; keep skill-creator (its `evals.json` and `grading.json` shapes are what the pipeline reads), plugin-dev and vercel | factory-loop is the one process owner |
| D8 | `ui-design-language` moves into this repository as a stable skill | It was the one skill on the machine with no versioned source |

## What changed on the machine

- `~/.claude/plugins/marketplaces/railly-skills`: `git checkout -- .` (6 files), and 18 patched copies under `plugins/cache/` replaced with the clean canonical file. `RAILLY_SKILLS_REPO` verified to resolve with Railly's unmodified resolver.
- `~/.claude/settings.json`: the `session-start-sandbox.sh` hook removed (it invoked `bash.exe` through `cmd /c` with quoting that never worked; its output directory never existed). superpowers set to disabled.
- Removed: `~/.claude/hooks/session-start-sandbox.sh`, `~/.claude/workflows/README.md` (documented the deleted `feature.js`), `plugins/cache/temp_git_*`, the `ecc` marketplace registration.
- Moved: `settings.json.bak` and `settings.json.pre-hooks` to `~/.claude/backups/settings-history/`; `~/.claude/skills/ui-design-language` into `skills/` here.

## Evals written

| Skill | Evals | Fixture | Triggers |
|---|---:|---|---:|
| deploy-gate | 4 | `local-gate-no-remote` (declared gate, CI workflow, no remote) | 10 |
| implementation-routing | 5 | none (routing is prompt-only) | 10 |
| ship | 3 (existing) | `reviewed-select-fix` (existing) | 10 |
| software-factory-maintenance | 4 | `release-candidate` (version declared in four places) | 10 |
| spec-gate | 4 | `contract-select-fix` (green suite that violates A3 and M1) | 9 |
| ui-design-language | 3 | none | 10 |
| frontend-stack | 5 (existing) | none | 20 (existing) |

Every suite carries at least one `Does NOT` assertion, and every fixture was
materialized and its own checks run before the first eval.

## Results (2026-09-03, `haiku` as agent in every arm and as judge)

A haiku run is a pipeline proof and a first baseline, not a promotion round:
the model is the floor, and every number below is a floor. Gradings and
benchmarks are under `foundry/runs/evals/<skill>/` and trigger results under
`foundry/runs/triggers/<skill>/`.

| Skill | no_skill | current | delta | skill loaded | triggers | misses / false+ |
|---|---:|---:|---:|---:|---:|---|
| ship | 3/17 (17.6%) | 11/17 (64.7%) | +47.1% | 3/3 | 8/10 (80.0%) | 2 / 0 |
| spec-gate | 13/20 (65.0%) | 11/20 (55.0%) | -10.0% | 4/4 | 7/9 (77.8%) | 2 / 0 |
| deploy-gate | 6/21 (28.6%) | 17/21 (81.0%) | +52.4% | 4/4 | 8/10 (80.0%) | 2 / 0 |
| software-factory-maintenance | 5/20 (25.0%) | 10/20 (50.0%) | +25.0% | 4/4 | 5/10 (50.0%) | 4 / 1 |
| implementation-routing | 2/21 (9.5%) | 8/21 (38.1%) | +28.6% | 5/5 | 9/10 (90.0%) | 1 / 0 |
| frontend-stack | 4/18 (22.2%) | 3/18 (16.7%) | -5.6% | 5/5 | 10/20 (50.0%) | 10 / 0 |
| ui-design-language | 2/13 (15.4%) | 3/13 (23.1%) | +7.7% | 3/3 | 6/10 (60.0%) | 4 / 0 |

The skill loaded in every skill-arm run (the system-prompt nudge works), so
each delta is about the method, not about whether it was read.

### Findings

1. **Five of seven skills move the model.** ship, deploy-gate,
   software-factory-maintenance, implementation-routing and ui-design-language
   beat the baseline, and the per-eval view shows the gain concentrated where
   it should be: ship's ledger body (2→6/6), deploy-gate's created-is-not-serving
   (1→5/5), maintenance's moved-head refusal (0→4/5), routing's
   conventions-override (1→4/4).
2. **spec-gate regresses on `not-provided-is-not-a-soft-pass` (5→1/5).** With
   the skill loaded, the agent follows §1 "pin the exact state" literally and
   stops to ask for base and head SHAs instead of judging a contract the
   prompt fully describes. The baseline answered. The skill needs a clause for
   the case where the state is given by description rather than by SHA, or
   the eval needs a fixture; that is a candidate for round 002, not a change
   made here.
3. **frontend-stack is flat (−5.6%) and never triggers on user prompts
   (0/10 positives).** Its description positions it as Software Factory's
   stage-1 delegate, and haiku in a near-empty repository invoked no skill at
   all on any UI prompt (not this one, not ui-design-language). The evals
   also assert routing behavior a model with no installed frontend skills to
   route to cannot show. Both the description and the eval design are owed a
   look; the index itself is unmeasured by this round.
4. **software-factory-maintenance has one false positive**: "implement the
   feature from the accepted contract and take it through the factory" loaded
   it. The description's "do not substitute it for the gated Factory Loop"
   clause did not hold with haiku. A description edit is a round-002 candidate.
5. **Positive triggers miss more than negatives fire**, across the board
   (25 misses, 1 false positive over 79 queries). With haiku the cost of the
   harness is silence, not noise. Re-run the triggers on the default model
   before treating any miss as a description defect.
6. **Two runner defects were found and fixed by the run itself**: a
   `--max-turns` stop exits 1 with a complete stream and was counted as a
   failed run; and the haiku judge drifted out of role once and asked for the
   transcript it had been given. The runner now treats a stream with a
   `result` event as a complete run, tells the judge in the prompt that it is
   not the agent, retries once, and can `--regrade` a workspace.

### Maturity

Every skill moves to `evaluated`: a baseline comparison exists and the
evidence is incomplete. Nothing is `validated`; nothing was promoted or
changed on the strength of these numbers.

## Amendment (2026-09-05): byte-compatible with Railly's validator

Running Railly's scripts against this repository (`RAILLY_SKILLS_REPO` set)
established what they can and cannot do here:

- Only `validate-skills.mjs`, `resolve-source-root.mjs` and `work-item.mjs`
  read `RAILLY_SKILLS_REPO`. His eval scripts (`setup-skill-eval`,
  `setup-eval-fixture`, `verify-eval-fixtures`, `aggregate-skill-eval`,
  `lens-coverage`) resolve his own checkout through `import.meta.dir`, which
  is bun-only, and never read another repository.
- On Windows his validator fails against his own repository: skill roots are
  built with `path.join` (backslashes) and compared with the forward-slash
  paths in the marketplace. `skills-doctor` audits junction links under
  `.agents/skills`, an install model this machine does not use.
  `verify-eval-fixtures` needs `python` on PATH. His CI runs ubuntu + bun.
- He has no runner that executes the arms and none that reads
  `triggers.json`; the arms are run by an agent by hand and aggregated after.

Decision: keep this repository Windows-native and make its data shapes pass
his validator unchanged, rather than fork his repository or run it under WSL.

Changes: every trigger case carries a unique `id`; every fixture has
`base/` and `changed/`; every fixture eval declares a `verification`
command and exit code; `scripts/verify-eval-fixtures.mjs` (node port, all
skills) runs them and `npm run check` includes it; `validate-skills.mjs` and
`validateTriggers`/`validateEvalSuite` enforce all three.

Two fixture evals changed prompt so that `changed/` is the diff the eval
starts on: deploy-gate's `unobserved-remote-is-a-gap-not-a-green` now starts
on an unpushed reviewed change (gate green), and software-factory-maintenance's
`release-is-a-reviewed-change-with-version-sync` starts on a half-done bump
(`package.json` at 1.1.0, `version:check` failing). Their round-001 numbers
predate this and are not comparable to the next run of those two evals.

Proof: a scratch clone of his repository with the one `node:path` import in
`validate-skills.mjs` switched to `node:path/posix` reports zero errors
about any skill, trigger, fixture or installer group in this repository; the
errors that remain are about his own foundry contracts, parsed from his clone.

## Amendment (2026-09-05): his validator's remaining rules, and disclosure

Running his validator and his CI's skillkit audit over this repository left
one class of finding: three `SKILL.md` files over his 120-line cap
(spec-gate 123, frontend-stack 143, ui-design-language 167). His own skills
top out at 113 and keep reference material behind links.

Adopted in `validate-skills.mjs`: the 120-line cap; no live foundry output
inside a skill (`cases/`, `evals/runs/`, `evals/radius-dogfood/`);
`type` required in the maturity entry; `expected_output` and `files`
required on every eval; links checked in `README.md` and `foundry/` too.
Added `npm run audit` (skillkit, strict, as his CI runs it).

Restructured, without changing any method:

- spec-gate: the report shape moved to `references/report.md` (100 lines).
- frontend-stack: the index table, load order and duplicate history moved to
  `references/index.md` (115 lines).
- ui-design-language: the twelve recipes and seven guides moved from the skill
  root into `references/`, the shadcn and transitions.dev integration into
  `references/integration.md`, springs and porting into
  `references/catalog.md`; `SKILL.md` gained a "when to read what" table so
  every reference is linked and gated (109 lines).

Proof: his validator (scratch clone, `node:path/posix`) reports zero errors
about this repository; skillkit strict passes 7/7 with 0 findings and now
counts 23 reference files as on-demand instead of 0. The three restructured
skills were re-run on haiku as a regression check; results below.

### Regression run after the restructuring (2026-09-05, haiku agent and judge)

| Skill | no_skill (001 → now) | current (001 → now) | delta | skill loaded |
|---|---|---|---|---:|
| spec-gate | 13/20 (65.0%) → 13/20 (65.0%) | 11/20 (55.0%) → 14/20 (70.0%) | -10.0% → +5.0% | 4/4 |
| frontend-stack | 4/18 (22.2%) → 7/18 (38.9%) | 3/18 (16.7%) → 3/18 (16.7%) | -5.6% → -22.2% | 5/5 |
| ui-design-language | 2/13 (15.4%) → 4/13 (30.8%) | 3/13 (23.1%) → 7/13 (53.8%) | +7.7% → +23.1% | 3/3 |

Read as "did not regress", not as improvement: one haiku run each, and the
`no_skill` arm moved as much as the `current` arm did (frontend-stack's
baseline went from 4 to 7 of 18 with no change on the baseline side), which is
the variance floor of this model. spec-gate's `not-provided-is-not-a-soft-pass`
and frontend-stack's flat result remain the round-002 candidates already
listed. Gradings and benchmarks are under `foundry/runs/evals/<skill>/`.
