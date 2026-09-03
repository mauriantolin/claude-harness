---
name: spec-gate
description: "Check an exact code state against every accepted acceptance ID and must-not-change behavior in the frozen contract, independently of whether tests pass. Use after Software Factory completes and before Review Gate runs, whenever a contract with acceptance IDs exists. Green tests never imply Spec approval. Do not use to judge code quality, style, or design; that is Review Gate's job."
compatibility: Requires a frozen contract with enumerated acceptance IDs, a repository at an exact reviewed head, and its normal verification tools. Read-only on target source.
---

# Spec gate

Standards and Spec are different questions. Review Gate asks whether the code is
good. Spec Gate asks whether it is the code that was agreed to. Run them
separately, on the same exact state, and never let one stand in for the other.

A passing suite is evidence that the tests pass. It is not evidence that an
acceptance ID is met, and it is not evidence that a must-not-change behavior
survived. Read the contract, then read the code.

## 1. Pin the exact state

Record base SHA, reviewed head SHA, and the contract this run judges. Name the
contract by path or by the live artifact that carries it, and record any clause
that a later authorization superseded.

A verdict belongs to one exact tree. If the tree moves, the verdict is void, not
stale. Do not carry a verdict across a rebase, a merge of main, or a new commit.

**Complete when:** base, head, and the active contract are named, with any
supersession stated explicitly.

## 2. Judge every acceptance ID separately

One row per accepted ID. No ID is skipped, merged, or summarized away.

| ID | Requirement | Verdict | Evidence |
| --- | --- | --- | --- |

Verdicts are `Pass`, `Fail`, or `not_provided`. `not_provided` means the change
did not deliver it and says so; it is never a soft pass.

Evidence names what was observed: the path that builds, the test that runs, the
migration that applies, the route that compiles. **Evidence that cites a
force-red outranks evidence that cites a green test** — "removing the row lock
loses accepted rows and fails" proves the guard is load-bearing; "the test
passes" does not.

Do not accept an agent's report of its own completion as evidence. Read the
artifact.

**Complete when:** every accepted ID has a verdict and observed evidence, and no
ID was dropped.

## 3. Judge the must-not-change behaviors

The contract's negative half is where regressions live, and it is the half a
green suite is least likely to cover. Each must-not-change behavior gets its own
line and its own verdict.

Include, whenever the contract named them: prior public surfaces, existing
flags and routes, error shapes, event ordering, failure preservation, and the
behavior of the non-participating path (what an unchanged caller still sees).

**Complete when:** every must-not-change behavior has an explicit pass or fail.

## 4. Record supersession, never silent drop

When a requirement is obsoleted by a later authorized decision, do not mark it
pass and do not delete it. Write a superseded clause naming the requirement, the
authority that superseded it, and what replaced it.

A requirement that quietly disappears between runs is indistinguishable from one
that was never checked.

**Complete when:** every requirement in the contract is present in the report as
pass, fail, not_provided, or superseded with its authority.

## 5. Declare the residual boundary

State what remains true and unprotected at the reviewed head: accepted trust
boundaries, known-unverified platforms, producers that could not be driven. A
named gap is a result. An unnamed gap is a false pass.

**Complete when:** the report's gaps are explicit and a reader can tell what was
not checked.

## 6. Emit the verdict

Status is `pass` only when every accepted ID passes and every must-not-change
behavior holds at the exact reviewed head. Any `Fail` makes the run `fail`. Any
`not_provided` on a `Must-have` makes the run `fail`.

Report shape:

```markdown
# <Repo> PR #<N> Spec gate

Status: pass | fail

Base: `<sha>`

Head: `<sha>`

Active contract: <what it is, and what supersedes what>

## Acceptance review
<the table>

## Must-not-change review
<one bullet per behavior, with verdict>

## Superseded clause
<only when something was superseded>

Residual boundary: <accepted, unprotected truths>
```

Write the report to `.claude/knowledge/foundry/runs/spec/<date>-<repo>-<n>-<head>.md`.

A `fail` returns to the factory at the earliest stage that can move the failing
ID. A `fail` whose cause is that the contract itself was wrong returns to
Solution Gate instead, because no amount of implementation fixes a bad
requirement.

**Complete when:** the report exists at the exact head and its verdict is
unambiguous.
