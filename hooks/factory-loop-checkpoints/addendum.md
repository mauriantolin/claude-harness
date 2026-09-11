# factory-loop checkpoints (claude-harness addendum)

Injected every time factory-loop loads. It changes nothing in the loop's method; it closes three gaps in how the loop is entered, which is where phases get skipped.

## 1. The manifest is the state, and it has a path

Resolve the canonical root before anything else: `node <root>/scripts/resolve-source-root.mjs`. In a scaffolded project the root is `.claude/knowledge`, named by `RAILLY_SKILLS_REPO` in `.claude/settings.local.json`. The work-item manifest is `<root>/foundry/missions/<owner-repo>/<id>.manifest.json`, beside its Issue Contract `<id>.md` (seeded from `<root>/foundry/missions/_template.md`).

- **Manifest present:** the earliest incomplete phase is the first stage in its `stages` whose status is not `pass`, in this order: intake, solution, implementation, spec, test_strength, resilience, review, before_after, promotion, handoff, case. Nothing said in the prompt or remembered from the transcript overrides a `pending` stage.
- **Manifest absent:** every phase is incomplete, whatever the prompt claims was done. Create it in phase 1 (this is issue-intake's selected-state seed) with `node <root>/scripts/work-item.mjs init <root>/foundry/missions/<owner-repo>/<id>.manifest.json --source <locator> --repository <owner/repo> --cwd <repository path>`, then seed the contract from the template. If the root cannot be resolved or the write is blocked, report exactly that and stop. Do not continue without a manifest.

## 2. A phase happens only through its owning skill

Before each phase, write one line — `phase N → Skill(<name>)` — and then make that Skill tool call. The phase is not entered until the call appears in this session. Reproducing the delegate's method inline, however faithfully, is a skipped phase, and being asked to skip the call does not change that. Owning skills: issue-intake, work-intake, solution-gate, software-factory, spec-gate, review-gate, before-after, ship, handoff, workstream-reconcile, record-a-case.

## 3. Context is not confirmation

A prompt that already names the issue, the intent, the Formula and the fix admits nothing. Phase 2 ends the turn with work-intake's assessment and waits. Only a human reply that arrives after that assessment and names the Formula admits it. The promotion gate works the same way: the reply must name the action and the exact head.
