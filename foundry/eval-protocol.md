# Behavior eval protocol

Adapted from [Railly's protocol](https://github.com/Railly/skills/blob/main/foundry/eval-protocol.md).
The files under `skills/*/evals/` are fixture definitions. They are not proof
that a skill works until a run records outcomes for the required arms.

## Run matrix

| Arm | Purpose | How the runner builds it |
|---|---|---|
| `no_skill` | The model's baseline behavior | `claude -p --disable-slash-commands` |
| `current` | The installed skill | `claude -p` with the skill linked into `~/.claude/skills`, and a system-prompt line telling the agent to load it |
| `candidate` | A proposed change | `claude -p --plugin-dir <working copy>`, same line naming `<plugin>:<skill>` |

The skill arms are *told* to load the skill, exactly as skill-creator hands its
executor the skill path: this layer measures the method, not the trigger. The
user prompt is identical in every arm. Each run records whether the skill was
actually loaded (`skill_invoked`, from the session stream), and the benchmark
shows it per arm: a `current` arm that never loaded the skill measured the
model, and its numbers are not evidence about the skill.

```sh
npm run eval -- <skill>                      # no_skill vs current
npm run eval -- <skill> --variants no_skill,current,candidate --candidate-dir <dir>
npm run eval -- <skill> --model haiku --judge haiku --parallel 4   # cheap smoke
```

Same prompt, same fixture, same tools and permissions in every arm. Only the
visible skills differ.

**An eval the `no_skill` arm passes is not evidence the skill works.** It may
stay as a regression guard, but it never counts as the skill earning its
tokens. Run the baseline arm before writing more cases; target what the base
model does not do unaided. This is the lesson of
[the first ship run](../cases/claude-harness/ship-suite-measures-the-model-not-the-skill.md).

## Layers

1. **Trigger.** `evals/triggers.json`: positive prompts load the skill, near
   misses do not. `npm run triggers -- <skill>` reads the headless session's
   stream for `Skill` invocations. A trigger that fires on a near miss costs
   context on every unrelated task.
2. **Method.** `evals/evals.json` assertions on observable behavior: gates in
   order, no invented evidence, artifacts preserved across handoffs. Every
   suite carries at least one `Does NOT ...` assertion; a positive assertion is
   structurally unable to catch "and it also did Y".
3. **Outcome.** For a fixture run the judge reads the repository state after
   the run, not only the answer. What the agent did outranks what it said.
4. **Transfer.** At least one eval outside the originating scenario, with
   incidental names changed and one tempting but irrelevant path present.

## Assertions must be observable inside the harness that runs them

A run without a fixture has read-only tools. An assertion that requires
committing, writing a file or opening a pull request in such a run measures
the cage, not the skill. Give the eval a fixture, or phrase the assertion as
what the agent says it would do and why.

## Fixtures are proven before they are used

A fixture is `fixtures/<name>/base/` (committed as the first commit) plus
`changed/` (copied over it, left uncommitted), so the run starts on a
repository with a live diff. Every eval that names a fixture declares a
`verification` (`{ "command": [...], "expected_exit": n }`) that states what
the materialized fixture is: a green suite, a failing version check.
`npm run verify-fixtures` materializes each one and runs that command, and
`npm run check` includes it. A fixture whose claim cannot be reproduced by a
command is not a fixture yet.

## Judge discipline

The judge (`--judge`, default `haiku`) receives the assertions and the
transcript, never the skill, and returns one verdict per assertion so a soft
one cannot carry the others. Absence of evidence is a failure. Deterministic
checks belong in `validate-skills.mjs`, not in a judge prompt.

## Promotion

A skill moves from `skills/.experimental/` to `skills/` when:

- `npm run validate` passes with no placeholders;
- trigger accuracy is at or above the threshold on both polarities;
- the `current` arm beats `no_skill` on at least one intended behavior, and
  regresses on none;
- a human read the gradings, not only the table.

Record the run in `foundry/rounds/NNN-<topic>/decision.md` and update
`foundry/maturity.json`. A green table with a zero delta is a finding, not a
promotion.
