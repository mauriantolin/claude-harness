---
name: ship
description: "Turn an approved exact state into a branch, commits, and a pull request whose body is the evidence ledger. Use only after the human authorized a named external action on that exact state, at the promotion gate. Handles branch hygiene, contributor credit when work is absorbed from another PR, and the PR anatomy. Do not use to decide whether to ship, to merge, to release, or to act on an unreviewed head."
compatibility: Requires git, an authenticated `gh`, a reviewed exact head, and explicit human authority naming the action. Refuses to act on a state that differs from the reviewed one.
---

# Ship

Promotion is authority over one named action on one exact state. This skill
performs that action and nothing adjacent to it. Authority to push is not
authority to merge; authority to open a PR is not authority to release.

## 1. Verify the authorized state

Compare the working tree against the reviewed head recorded by Spec Gate and
Review Gate. Any difference — a stray edit, an unstaged file, a merge performed
after review — voids the authorization.

Confirm which action was authorized: commit, push, open a PR, update an existing
PR. Never infer one from another.

**Complete when:** the tree matches the reviewed head and the authorized action
is named.

## 2. Establish the branch

One issue, one branch, one pull request. Branch from the current default branch,
never from another feature branch.

If the work absorbs a previous attempt, the branch is **fresh from
`origin/<default>`** and the absorbed PR is never merged into it. Absorption is
authorship: the recreated branch is new code that carries its own verification
burden, and the original author's passing tests verify their happy paths only.
They never count as a lens pass.

**Complete when:** the branch exists, is based on current default, and its
relationship to any absorbed work is recorded.

## 3. Preserve credit

When any part of the approach, the diagnosis, or the code came from someone
else's issue, PR, or draft, credit is not optional and not a courtesy line in
prose.

- Add `Co-authored-by: Name <email>` trailers to the commits that carry the
  absorbed work.
- Name the source contribution and its author in the PR body's first paragraph:
  *"Recreates the useful parts of #N. Original work by @author is preserved
  through commit co-authorship."*
- State what was **not** carried forward and why. A recreation that silently
  drops half the original reads as a rewrite; one that names the dropped
  mechanisms reads as a decision.

**Complete when:** every external contribution has a trailer and a named
mention, and the not-carried-forward list exists when anything was dropped.

## 4. Compose the body from the ledger

The body is the evidence ledger, not a description of the diff. A reader must be
able to audit the change without running it.

1. **Provenance** — recreates, supersedes, closes, fixes; credit.
2. **Problem** — what breaks, and where the previous approach was wrong. When a
   prior attempt used a primitive that is not equivalent to the correct one, say
   so precisely; that distinction is the reason the recreation exists.
3. **Change** — expressed as a contract: state transitions, what each input
   does, not a list of edited files.
4. **Scope** — what the change explicitly rejects or does not support. An
   enumerated rejection list is a feature of the body.
5. **Verification** — exact-head gates, with counts. A table of accept/reject
   cases when the change is a matcher, a parser, or a trust decision.
6. **Force-red** — which mutations proved the fix is load-bearing, and at which
   call site.
7. **Measured** — before/after table when a performance claim exists.
8. **Independent review** — name the reviewing model family when a cross-family
   challenge ran.
9. **Out of scope** — what was deliberately left, and the stacked follow-up.

**Complete when:** every section that applies is present and every claim in it
names an observation, not an intention.

## 5. Perform exactly the authorized action

Commit with a message whose subject follows the repository's convention and
whose body states why, never what. Push. Open or update the PR.

Open ready-for-review or draft according to the repository's own convention,
recorded in its `conventions.md`; do not assume either.

After review has started, **append commits and merge the default branch into the
branch**. Do not rebase, and do not force-push: a reviewer's position in the
diff is state, and rewriting history destroys it.

Never merge. Never tag. Never release. Never comment on another person's issue
or PR unless that specific action was authorized.

**Complete when:** the authorized action is done, its URL or SHA is reported,
and no adjacent action was taken.

## 6. Append review rounds, never rewrite

When review produces findings and they are fixed, add a `## Round N review
notes` section to the body. Each note says what was wrong, what changed, and how
it was proven — including the force-red that confirmed the new guard.

Editing the original sections to look as though the defect never existed
destroys the audit trail that makes the body worth reading.

**Complete when:** the body records every round, in order, with its evidence.
