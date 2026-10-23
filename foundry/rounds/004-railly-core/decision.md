# Round 004: follow Railly's new core, move the harness into each repository, and enforce instead of asking

Date: 2026-10-23
Status: decided and applied (uncommitted until the human approves)
Scope: every skill and hook here, `machine/`, `bin/harness.mjs`, the eval runners, Nomenclator's harness

## Why

Railly's marketplace (remote HEAD `4c091e7`, 2026-10-16) replaced its seven-ceremony factory with
five skills: `contract` → `loop` → `verify-setup` → `gate` → `correct`, with evidence tied to the
exact tree by a repo-local kit (`.agents/verify/`). Everything here pointed at the retired path:
`factory-loop-checkpoints` injected instructions for skills that no longer exist (and fired on
Nomenclator's own `factory-loop`), `spec-gate` and `ship` duplicated what `contract`, `fresh.sh`
and `gate.sh scope|prbody|drift` now do, and `implementation-routing`/`frontend-stack` routed for
`software-factory`. And all of it was global: 41 skills and 7 hooks in `~/.claude` competed with
each repository's own.

Railly verified at its remote HEAD before any change: `validate-skills` 5/5, `bun test` 31/31,
skillkit audit PASS, every gate and verify-setup script test green (`test-report-gate.sh` only on
a full clone: the marketplace clone is shallow and the test needs `HEAD~1`; doctor warns now).

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Retire `spec-gate`, `ship`, `frontend-stack`, `implementation-routing`, `factory-loop-checkpoints`, `railly-root-worktree`, `railly-inrepo.mjs` | Railly's new core does their job, or their target no longer exists |
| D2 | `route`: the step between contract and implement, reading the repository's `.agents/routing.md` (which wins) | Railly's loop names no implementation skills; the seam is the same as before |
| D3 | Three plugins in this marketplace (`harness`, `harness-design`, `harness-maintainer`); repositories enable them, nothing global | Global skills competed with repository ones (`ui-design-language` vs `ui-nomenclator`); per-repository plugins travel with the clone |
| D4 | Hooks enforce what prose only asked: `route-guard`, `verify-before-done` (with and without a contract), `loop-entry`, `knowledge-root` | Measured below: prose bindings alone moved nothing |
| D5 | `harness init` brings Railly's kit, the plugins and the binding templates into a repository | One command, never overwriting |
| D7 | Plugins are grouped by what a repository enables, not by maturity channel. Railly's validator, pointed here, passes except its installer-group rule (plugin name = channel) | Grouping by channel would give every repository that enables `stable` the design language and the maintainer workflow, the competition D3 removes |
| D6 | Evals grade with deterministic checks from the session stream and the repository, and can run on a real repository (`fixture_repo`) | A judge reading prose cannot tell a loaded skill from a named one |

## Results (sonnet as agent, haiku as judge)

`route` on fixtures (5 evals, `bare` vs `candidate`): the repository-table case 4/8 → 7/8, the
owed-coverage case 2/5 → 5/5, "owners load before the first edit" 6/6 in both arms (the fixture's
skill descriptions say when to load them, so that eval does not discriminate); with a fixture
where only the routing table names the owners, 3/6 → 6/6 in two runs each. `route` also reads every skill the session offers against the contract, not only the tables: for a
surface no table names (a summary generated with the Anthropic API), it loaded the matching
built-in skill in 3/3 runs, the baseline in 0/2. Triggers (sonnet,
scratch repository): `route` 10/10, `deploy-gate` 10/10, `maintain` 9/10.

`loop-bindings` on the acme fixture, two runs per arm. The first comparison was invalid: the
dev plugin linked `hooks/` and Claude Code drops a plugin path that resolves outside the plugin
directory, so neither arm had hooks (runs kept as `r004-invalid-*`; the dev plugin now copies).

| Arm | Run 1 | Run 2 |
|---|---:|---:|
| bindings off | 66.7% | 71.4% |
| bindings on (prose only) | 66.7% | 71.4% |
| bindings + route-guard | 85.7% | 61.9% |
| natural prompt, no harness / full harness (ticket case) | 8/13 | 11/13 |

Prose did not change behavior; `route` loaded in 1 of 4 bound runs. `route-guard` made owner loads
certain wherever an edit happened (verified in real sessions, a subagent included).

The other authored skills, method evals (sonnet, `no_skill` vs `candidate`): `maintain` 35.0% →
75.0%, `ui-design-language` 38.5% → 76.9%, `deploy-gate` 85.7% → 90.5% (the base model already
does most of it).

Nomenclator end to end (`.agents/evals/loop.json`, 4 natural prompts on a clone of its working
state, origin an empty bare repository):

| Arm | Pass rate | `experimental:loop` loaded |
|---|---:|---:|
| Railly only | 68.8% | 0/4 |
| harness, before `loop-entry` | — | 0/4 |
| harness + `loop-entry` (said `Skill(loop)`) | — | 3/4, all Claude Code's built-in `loop` |
| harness + `loop-entry` (`experimental:loop`) + contract-less Stop | 75.0% | 3/4 (the fourth is the "push without a cycle" case, blocked by `pr-gate`) |

`pr-gate` blocked the unreviewed push in every arm (6/6); no push reached the bare origin in any
run. `verify-before-done` blocked a contract-less edit session and drove the copy case to write the
contract and observe; in the classifier case the agent used the second stop to state the gap.

Triggers in Nomenclator (22 natural queries in the repository, sonnet): 15 matched. Dormant on a
question: `ui-nomenclator`, `neon`, `senior-python`, `better-auth`, `route`; `gate` lost to Claude
Code's built-in `code-review`; `correct` never loaded.

Heavy changes: Railly's report validator accepts `human_review` as the independent challenge; with no cross-family runtime on this machine, Nomenclator's heavy changes pass `pnpm gate pass` only with the person's review as that artifact.

Nomenclator's change itself went through the new path: contract (heavy), `classifier` and `check`
observed, `fresh.sh` 0, `gate.sh surfaces` and `scope` pass. An independent reviewer (a subagent,
not the author) found 14 issues, the worst being that `pnpm gate pass` did not tie the verdict to
the reviewed tree; all were fixed, each guard with a test seen red when the guard is reverted.
What is left is the human's: the heavy profile's independent challenge (`human_review`) and the
commit.

## Not decided

- Whether the second stop should stay soft (a stated gap passes) or block again. Today the hard
  stop is `pr-gate` at push time.
