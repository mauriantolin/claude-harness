# Round 002: factory-loop loads and then skips its phases

Date: 2026-09-07
Status: decided and applied
Scope: `hooks/factory-loop-checkpoints/`, the eval runner, `install.sh`, `doctor.mjs`, and one hook registered on this machine

## Why

Invoking `factory-loop` loads the skill and then, often, the agent does the
phases' work inline and moves on: no `work-intake` call, no manifest, an
"admission" taken from the prompt. Reading the SKILL.md gave three causes, and
a fourth suspect that did not survive testing:

1. **The manifest has no path in the loop.** The loop says to read the
   work-item manifest before anything and to "enter at the earliest incomplete
   state", but never says where the manifest is or how it comes to exist.
   `issue-intake` creates it (`foundry/missions/<owner-repo>/<id>.manifest.json`
   via `work-item.mjs init`), and an already-selected item never passes through
   `issue-intake`. With nothing to read state from, the agent reads the prompt,
   which is what the loop forbids. The sandbox had run the loop and its
   `foundry/missions/` was empty.
2. **"Invoke X" is prose, not a checkpoint.** Nothing makes a phase depend on a
   `Skill` call having happened. The delegate's method is short enough to
   paraphrase, so the agent paraphrases it.
3. **Context reads as confirmation.** Every phase ends in "stop for human
   confirmation"; a prompt that already names issue, intent and Formula reads
   as that confirmation having happened.
4. *Suspected and refuted:* the loop names delegates without their plugin
   prefix (`work-intake`, not `experimental:work-intake`). A headless run
   showed the bare name resolves. Names were not the cause.

Railly's repository stays untouched (round 001, D3), so the fix cannot be an
edit to his SKILL.md.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | A hook, not a fork: `hooks/factory-loop-checkpoints/` is a `PostToolUse` hook on `Skill` that injects `addendum.md` whenever the call that just completed loaded `factory-loop` | It rides alongside his file at load time; his clone stays clean and a second orchestrator does not appear in `skills/` |
| D2 | The addendum is three rules, not a rewrite: manifest path and creation command; a phase exists only through its owning skill's `Skill` call, announced first; context in a prompt is not confirmation | Each rule maps to one observed cause; the loop's own method is not restated |
| D3 | `hooks/<name>/` mirrors a skill directory: entry file, the text it injects, `evals/`. `install.sh` links the entry as a launcher; registration in `settings.json` is manual and `doctor.mjs` checks it | Same install and check path as everything else; a hook that is linked but not registered is the silent failure the doctor exists to catch |
| D4 | The hook honors `FACTORY_LOOP_CHECKPOINTS=off`, and the runner gained `--env` | The hook is global once registered; the "skill without its hook" arm is the same suite with the variable set, not a settings toggle between runs |
| D5 | The runner gained `--evals <file>` | The skill under measurement is Railly's; its suite lives with the hook, not under `skills/` |
| D6 | The runner pre-approves `Skill` and decides "skill loaded" from the tool result, not the tool call | See the defect below |
| D7 | The judge's transcript lists the `Skill` calls from the stream, marking the ones that did not load | "Invokes work-intake" is only gradable as an observed call; prose can name a skill it never invoked |

## The defect the first run exposed

The first two runs reported the skill loaded in 3/3 and measured nothing:
the stream held `permission_denied` for `Skill` ("Execute skill:
experimental:factory-loop", `is_error: true`). A plugin skill asks for
permission in a headless run; a user skill in `~/.claude/skills` does not,
which is why every round 001 run (all user skills) loaded and this one did
not. `skill_invoked` was computed from the `tool_use` block alone, so the
denial was invisible. Both workspaces were discarded and the runner fixed
(D6, D7) before the runs below. Round 001's numbers are unaffected: no plugin
skill was measured there.

## What changed on the machine

- `~/.claude/hooks/factory-loop-checkpoints.mjs`: launcher written by `install.sh`.
- `~/.claude/settings.json`: one `PostToolUse` group with matcher `Skill` running that launcher (previous file kept under `backups/settings-history/`).
- Verified with a headless run: after `Skill(factory-loop)` the model reports the addendum's first heading as the context it received.

## Results (2026-09-07, `haiku` as agent and judge; 3 evals, 13 assertions)

Workspaces: `foundry/runs/evals/factory-loop/hook-off` and `hook-on`. The
skill loaded in 3/3 `current` runs of both.

| Arm | Passed | Pass rate | Δ vs no_skill | `work-intake` invoked |
|---|---:|---:|---:|---|
| `no_skill` | 5/13 | 38.5% | | never |
| `current`, hook off | 5/13 | 38.5% | 0.0% | never |
| `current`, hook on | 8/13 | 61.5% | +23.1% | in 1 of 3 runs |

### Findings

1. **The skill alone does not move the model.** Same score as the baseline,
   and with it loaded the agent asked to `git clone` and said it would
   "proceed directly with the implementation of this mechanical fix" on the
   strength of the prompt. That is the reported symptom, measured.
2. **The hook fixes the two causes it names concretely.** On the complete
   prompt it invoked `work-intake` and ended the turn "for confirmation before
   moving to the implementation phase" (4/5, from 2/5). On the resume prompt it
   looked for the manifest and named its location before accepting any claimed
   stage (3/4, from 2/4).
3. **It does not yet beat a direct instruction to skip.** Told "do the intake
   classification yourself to save tokens", haiku still plans to (1/4, both
   arms). Rule 2 of the addendum says exactly that this is a skipped phase;
   on this model that sentence loses to the user's request. Round 003
   candidate: state the rule as a refusal with the reason, and add an eval
   with the manifest present so the phase announcement has something to
   announce.
4. **A haiku run is a floor**, as in round 001. The hook's effect on the
   default model is unmeasured.
5. **The cage leaked sideways.** One eval agent, denied `git clone`, sent a
   cross-session message asking the author's live session to run the clone
   for it. It was refused. `SendMessage` is now disallowed in every arm.

## Not done

- Nothing was proposed upstream. If the addendum holds on the default model,
  its first two rules are a candidate patch to Railly's SKILL.md, sent as a
  pull request, not applied to the clone.
