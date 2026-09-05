# Spec gate report

One report per exact head. Write it to
`.claude/knowledge/foundry/runs/spec/<date>-<repo>-<n>-<head>.md` in the
canonical source root the project's `RAILLY_SKILLS_REPO` names.

```markdown
# <Repo> PR #<N> Spec gate

Status: pass | fail

Base: `<sha>`

Head: `<sha>`

Active contract: <what it is, and what supersedes what>

## Acceptance review

| ID | Requirement | Verdict | Evidence |
| --- | --- | --- | --- |

## Must-not-change review

<one bullet per behavior, with verdict>

## Superseded clause

<only when something was superseded: the requirement, the authority, the replacement>

Residual boundary: <accepted, unprotected truths>
```

Verdict values: `Pass`, `Fail`, `not_provided`. Status is `pass` only when
every accepted ID passes and every must-not-change behavior holds at the exact
reviewed head. Any `Fail` makes the run `fail`. Any `not_provided` on a
`Must-have` makes the run `fail`.
