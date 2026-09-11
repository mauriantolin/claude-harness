# Case: claude-harness: the eval reported a loaded skill that was never loaded

Status: observed
Validation: self-validated
Human review: pending
Maintainer acceptance: not applicable (this repository)
Upstream status checked: not-applicable
Delivery: recorded
Visibility: public
Repository: mauriantolin/claude-harness
Role: author
Source: the first two `factory-loop` eval workspaces of 2026-09-07 (discarded), their `stream.jsonl`, and [round 002](../../foundry/rounds/002-factory-loop-checkpoints/decision.md)

> Self-validated. The streams were read by the author; nothing here was
> reviewed by anyone else.

## Observed condition or claim

The first measurement of the `factory-loop-checkpoints` hook came back flat:
the `current` arm scored the same with the hook registered as without it, and
the benchmark said the skill had loaded in every `current` run.

## Red signal

The three `current` answers never mentioned a manifest, a phase, or a
delegate, with a 2,400-character addendum supposedly injected right after the
skill loaded. The stream said why: every `Skill(experimental:factory-loop)`
call was followed by

```
{"type":"system","subtype":"permission_denied","tool_name":"Skill","message":"Execute skill: experimental:factory-loop"}
{"type":"tool_result","content":"Execute skill: experimental:factory-loop","is_error":true}
```

The skill was invoked and denied. A `PostToolUse` hook does not fire on a
denied call, so the hook never ran. The runner had granted no `Skill`
permission, because no earlier eval had needed one: every round 001 skill
lives in `~/.claude/skills`, and a user skill loads in a headless run without
asking. A plugin skill asks. And `skill_invoked` was computed from the
`tool_use` block, so a denied load counted as a load.

## What this cost

Two eval workspaces (12 haiku runs plus grading) that measured the model twice
and reported it as the skill, and a first reading of "the hook changes
nothing" that was about to go into a round decision.

## Disposition

**A tool call is not a tool result.** The stream carries both; the runner now
reads the result, pre-approves `Skill`, and shows the judge which invoked
skills actually loaded. The general rule already in the protocol, "what the
agent did outranks what it said", applies to the runner's own bookkeeping
too: the `tool_use` block is what the agent *said* it would do.

Two consequences:

- **Any benchmark's "skill loaded" column is now a claim about results,
  not calls.** Round 001's numbers stand, because no plugin skill was measured
  there; the first plugin skill measured is where this surfaced.
- **When a skill arm equals the baseline, read the stream before the
  decision.** A flat delta has two readings, "the skill does nothing" and
  "the skill was not there", and only the stream distinguishes them.
