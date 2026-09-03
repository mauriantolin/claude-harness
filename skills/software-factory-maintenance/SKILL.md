---
name: software-factory-maintenance
description: "Maintainer-side workflow for queue cleanup, contributor branches, merge, version release, and published-artifact verification. Use when merging approved work, cutting a release, bumping versions, publishing a package, or clearing a stale PR queue. Do not substitute it for the gated Factory Loop: this workflow assumes the change already passed Spec Gate and Review Gate."
compatibility: Requires maintainer write access, an authenticated `gh`, the repository's release tooling, and explicit human authority for each merge, tag, publish, or dispatch. Never runs on an unreviewed head.
---

# Software factory maintenance

The gated loop takes one change to an approved state. This workflow is what a
maintainer does afterwards, and it is separate for a reason: merge, release, and
publish are irreversible in ways that implementation is not.

Every step here needs its own authorization. Approval to merge is not approval
to release.

## 1. Reconcile the queue before touching it

List the open PRs and their live state, not their remembered state. For each,
record: reviewed head still current, checks green, conflicts with default,
whether an owner is active, and whether it is superseded by newer work.

A PR whose head moved since its review is unreviewed. Treat it as such.

Classify each: `ready`, `needs-rebase-or-merge`, `stale`, `superseded`,
`abandoned`. A `superseded` or `abandoned` PR is a candidate for absorption, not
for merge; hand it to the gated loop with its credit obligation intact.

**Complete when:** every open PR has a live classification with evidence.

## 2. Merge only a green, reviewed, current head

Confirm before each merge: Spec Gate passed at this exact head, Review Gate
passed at this exact head, remote checks are green, and the branch contains the
current default.

Prefer merging the default branch into the contributor branch over rebasing it.
A contributor's branch is their state.

Never merge to fix a conflict you have not read. Never merge a PR whose failing
check you have not explained.

**Complete when:** the merge commit exists, or the refusal names the missing
gate.

## 3. Cut the release as its own reviewed change

A release is a pull request, not a command. It carries:

- the version bump across **every** artifact that declares one — package
  manifests, lockfiles, crate versions, installers, docs that name the version;
- release notes with contributor credits;
- an explicit list of which merged PRs the release covers.

Run the repository's version-sync check and require a clean diff. A version that
agrees in three places and disagrees in a fourth is the ordinary failure here.

**Complete when:** the release PR exists, version sync is clean, and its body
names the covered PRs.

## 4. Verify the release the way a user receives it

Building it is not shipping it. The verification is what a stranger gets:

- full suite counts, stated as numbers passed / skipped, not "green";
- audit of dependencies and signatures;
- every build the repository publishes;
- a **clean install from the produced artifact** in an environment that does not
  have the development toolchain on PATH;
- package-contents check: what is actually inside the tarball;
- a smoke run of the primary command from that clean install.

State any destructive capability that was **not** exercised, in the affirmative:
name what was not submitted, not sent, not published to production.

**Complete when:** the artifact was installed and driven from a pristine
environment, and untouched destructive paths are named.

## 5. Gate publication on the publish decision itself

The publish step and the steps that verify a publish must share one condition.
An artifact-verification step that runs when publish was skipped compares a
fresh build against the previously published version and fails for a reason that
has nothing to do with the change.

Whenever a release pipeline branches on "did we publish", every downstream step
that reads published state branches on the same output.

**Complete when:** no post-publish verification can run in a no-publish run.

## 6. Verify in production, then close

After publish, dispatch the release workflow on the default branch and require a
successful run — including the no-publish path, which is the one that rots
unobserved.

Confirm the published version resolves from the public registry or release
surface, and that the installed artifact reports the expected version.

Record the outcome as a case. A release that needed a follow-up fix records what
the pre-release verification failed to observe; that is the lesson, not the fix.

**Complete when:** the published artifact is verified from outside the
repository and the cycle has a durable record.
