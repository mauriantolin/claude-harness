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
4. **Eval 7 and the loop share a weakness**; see the rule 4 results below.
5. **A haiku run is a floor**, as in rounds 001 and 002.

## Rule 4 at the loop (same day)

Measuring the loop needed a manifest at phase 4, so a fixture, and a fixture run
has Bash with permissions skipped: a failing arm could really run
`npx skills add -g` on this machine. The runner gained two guards first:

| # | Decision | Why |
|---|---|---|
| D5 | `--deny <rule>` appends to `--disallowed-tools` in every arm | A canary (`Bash(echo canary-deny:*)`) showed a disallowed rule still holds under `--dangerously-skip-permissions` |
| D6 | Each run lists `~/.claude/skills` and `~/.agents/skills` before and after, and records `environment_changed` | A prefix rule is not an intent: `bash -c "npx skills add ..."` passes it. What was denied is prevented; what slipped through is at least seen |
| D7 | A suite passed with `--evals` keeps its fixtures beside it (`hooks/<name>/evals/fixtures/`) | factory-loop is not ours, so its fixture cannot live under `skills/` |

Eval 4 (`routes-and-offers-skills-before-dispatch`) materializes `acme/invoices`
with its own knowledge root: an admitted contract for a server-side PDF invoice
plus a download button, and a manifest whose intake and solution passed with
pinned revisions. The before arm ran the addendum and routing skill as of
`08ff893`, restored afterwards. Three runs per arm, `haiku`, installs denied.
No run changed the skill directories.

Workspaces: `foundry/runs/evals/factory-loop/r003-dispatch-{before,after}-{1,2,3}`.

| Arm | Passed | Routed before `software-factory` | Stopped before implementing | Looked up PDF coverage |
|---|---:|---:|---:|---:|
| before | 0/15 | 0/3 | 0/3 | 0/3 |
| after | 8/15 | 3/3 | 2/3 | 1/3 |

1. **Without rule 4 the loop implements immediately.** All three before runs
   went from `factory-loop` straight into `software-factory`, wrote the PDF
   code, and one reached `ship` asking to commit. That is the question that
   opened this round, answered: nobody asked about skills.
2. **Rule 4 moves routing ahead of dispatch every time.** In two of three it
   also held the gate; in the third it routed, then dispatched anyway.
3. **The lookup itself is the weak link.** Only one run searched and offered PDF
   candidates. Another labelled PDF rendering "implementation-driven, no skill
   needed" and offered to install `frontend-stack`, which is already installed.
   Routing lets the model decide a surface needs no skill, and that exit is
   taken. Round 004 candidate: a surface without a routed owner is looked up,
   with no judgement about whether it deserves a skill.
4. **The judge cannot see file reads.** "Reads the manifest" failed in runs that
   plainly acted on it; the transcript lists Skill calls and repository state,
   not Read or Bash calls.
