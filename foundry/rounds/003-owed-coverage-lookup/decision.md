# Round 003: a missing skill is owed, and nobody goes looking for it

Date: 2026-09-17
Status: decided and applied
Scope: `skills/implementation-routing/`, `hooks/factory-loop-checkpoints/addendum.md`

## Why

Asked whether the factory loop, before dispatching, checks for skills it could
download. It did not. `factory-loop` never names `find-skills`; the addendum
covered manifest, Skill calls and confirmation only; `software-factory`
"discovers" repository commands, not skills. `implementation-routing` and
`frontend-stack` record an absent skill as `unavailable` with its coverage
owed, which is right, and stop there. No eval asked for a lookup: the existing
ones (`absent-skill-is-owed-not-substituted`, routing eval 5) only check that
nothing is substituted.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | The lookup lives in `implementation-routing` §5, runs only for owed or uncovered surfaces, and uses `find-skills`' read-only search | Routing is where "owed" is computed; a fully covered change must not pay for a search |
| D2 | Installing is a human decision on a named package, like a push. A dispatched agent installs nothing and returns `pending-human` | An install changes the environment every later stage runs in, and the loop blocks on unpinned skill revisions |
| D3 | A found skill is not coverage; the surface stays owed until the skill is installed and loaded | Keeps the applied/owed receipt honest |
| D4 | Addendum rule 4: the loop invokes `implementation-routing` in its own session before `software-factory` and before any agent is dispatched | A dispatched agent cannot reach the human, so a missing skill found there arrives after the only cheap point to install it |

## Results (2026-09-17, `haiku` as agent and judge; 9 evals, 40 assertions)

Four evals added: 6 owed skill is looked up and offered, 7 surface with no row
is looked up, 8 fully covered change does not search, 9 dispatched agent returns
candidates without waiting. Eval 9 was tightened after a first baseline in which
a `no_skill` agent picked Recharts itself and the judge still passed it; that
baseline was discarded and rerun.

Workspaces: `foundry/runs/evals/implementation-routing/r003-before` and `r003-after`.

| Arm | Suite | Evals 6–9 | Lookup assertions (6, 7, 9) |
|---|---:|---:|---:|
| `no_skill` (before / after) | 30.0% / 22.5% | | 0/3 |
| `current`, before | 30/40 (75.0%) | 12/19 | 0/3 |
| `current`, after | 36/40 (90.0%) | 17/19 | 3/3 |

`find-skills` was loaded in 6, 7 and 9, and not in 8. Evals 1–5 moved 18/21 →
19/21, within run-to-run noise.

### Findings

1. **The gap was real and the change closes it on haiku.** Before, no run
   searched; the Postgres case even printed `npx skills add supabase/agent-skills`
   from memory. After, every owed case loaded `find-skills` and stopped for a
   human, and the dispatched case returned `pending-human` instead of "no blockers".
2. **Eval 6 contradicts the machine.** It says `supabase-postgres-best-practices`
   is not installed; it is, and the agent reported it available. The failure is
   the fixture's, not the skill's. Round 004 candidate: name a skill that is
   really absent.
3. **Eval 7 loaded `find-skills` six times.** With Bash denied the search cannot
   run and the agent retried instead of recording "not run". Cost, not a wrong
   answer.
4. **Rule 4 is unmeasured.** A loop-level eval needs a manifest at phase 4, which
   needs a fixture, and a fixture run gets Bash with permissions skipped, so a
   failing arm could really run `npx skills add -g`. Not run until the runner can
   deny that command.
5. **A haiku run is a floor**, as in rounds 001 and 002.
