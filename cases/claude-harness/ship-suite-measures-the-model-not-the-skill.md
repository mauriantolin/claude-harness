# Case: claude-harness: two thirds of a skill's eval suite measured the model, not the skill

Status: observed
Validation: self-validated
Human review: pending
Maintainer acceptance: not applicable (this repository)
Delivery: recorded
Visibility: public
Repository: mauriantolin/claude-harness
Role: author
Source: `skills/ship/evals/`, three evals run across `no_skill`, `current` and `candidate` on 2026-09-03

> Self-validated. The numbers come from a three-arm run scored by Railly's
> unmodified `aggregate-skill-eval.mjs`. Nothing here was reviewed by anyone else.

## Observed condition or claim

The `ship` skill had a five-eval suite written from its own text. Read on their
own, the evals looked like a fair test of the skill: they asserted that it
branches rather than commits to the default branch, refuses actions it was not
authorized for, preserves contributor credit, and writes a pull-request body
that reads as an evidence ledger.

## Red signal

The first run scored 2/4 against 2/4 for the no-skill baseline, and the two
failures were not the skill's:

1. One assertion demanded the agent open a pull request while the harness ran
   with `Bash`, `Write` and `Edit` disallowed. It asserted an action the cage
   forbade.
2. No fixture meant no repository, so both arms drifted into asking what was
   meant rather than acting.

The judge's reasons showed the skill had in fact changed the behavior — the
baseline "would open the PR conditionally", the skill "explicitly refused to
merge, citing that PR authorization does not authorize merging" — and the score
hid it.

Rebuilt on a real fixture, with write tools bounded by `cwd` to a throwaway
repository and the judge reading the resulting git state alongside the answer,
three evals scored:

| Variant | Passed | Total | Pass rate |
|---|---:|---:|---:|
| `no_skill` | 10 | 11 | 90.9% |
| `current` | 11 | 11 | 100.0% |
| `candidate` | 11 | 11 | 100.0% |

`current_delta_vs_no_skill`: **9.1%**, and all of it comes from **one
assertion**. On the pull-request body, the baseline reported that "test coverage
was documented" without naming anything it ran; with the skill loaded it named
the evidence.

The other two evals score identically in every arm. A model with a real
repository in front of it already declines to merge and tag without
authorization, and already notices a working tree that no longer matches the
reviewed head.

## What this cost

Five evals were written before any of them was run. Three of the five asserted
behavior the base model produces unaided, so they can never move. Writing the
remaining four skills' suites to the same pattern would have multiplied that.

## Disposition

**An eval that the no-skill arm passes is not evidence the skill works.** It may
still be worth keeping as a regression guard, and these were kept, but it must
never be counted as the skill earning its tokens. This is the same rule Railly's
own `solution-gate` eval #2 states for solution shapes — *"Does not count a
shared happy path as mechanism proof"* — applied to skills.

Two consequences for how the suites get written from here:

- **Run the baseline arm before writing more cases.** The three-arm design is
  not reporting overhead; it is the only thing that distinguishes a skill from a
  well-written prompt.
- **Target what the base model does not do unaided.** For `ship`, that is
  fresh-branch absorption carrying co-authorship and a stated
  not-carried-forward list, and appending a review round rather than rewriting
  the body so the defect reads as though it never existed.

A second, smaller lesson: assertions must be observable inside the harness that
runs them. An assertion that requires a tool the run does not have measures the
harness, not the skill.
