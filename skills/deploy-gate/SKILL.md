---
name: deploy-gate
description: "Confirm that a pushed branch or merged change actually builds, deploys, and serves — by running the repository's own pre-push gate, watching remote CI to completion, verifying the deployment where one exists, and repairing what fails until it is green or an attempt cap is reached. Use after ship, or after a merge, whenever the repository deploys. Reports red honestly rather than declaring a success it did not observe."
compatibility: Requires an authenticated `gh`, the repository's CI configuration, and its deployment CLI when one exists. Degrade explicitly when a surface is unavailable; never substitute a local build for an observed deployment.
---

# Deploy gate

Railly Skills stops at promotion. This gate covers what happens after: the
change is pushed, and the question is whether it works where users meet it.

The failure this gate exists to prevent is the confident green report about a
pipeline nobody watched finish.

## 1. Run the repository's own gate first

Find and run whatever the repository already uses before a push — a `gate.sh`, a
pre-push hook, a `verify` script, a CI-equivalent make target. Do not invent a
substitute check when the repository declares one.

A local gate that passes proves nothing about CI, but a local gate that fails
means the push is already known-bad, and remote minutes should not be spent on
it.

**Complete when:** the declared gate ran and its result is recorded, or its
absence is stated.

## 2. Watch the remote run to completion

Identify the checks the push actually triggered. Watch them to a terminal state.

Do not report on a run that is still in progress. Do not infer a result from a
partially reported matrix: a fail-fast matrix that cancels siblings reports
`cancelled`, which is neither pass nor fail, and the cancelled legs are
unverified.

Record per check: name, conclusion, and — when it failed — the log excerpt that
names the cause, not the summary line.

**Complete when:** every triggered check reached a terminal state and each
non-success has a cited cause.

## 3. Verify the deployment, not the build

A successful build job is not a deployment, and a created deployment is not a
serving one. Where the repository deploys:

- resolve the deployment URL the run produced;
- request it and assert a real response, not merely a 200 from a placeholder;
- confirm the served artifact corresponds to this commit, by version endpoint,
  build id, or a marker the change itself introduced.

When the deployment is protected by authentication, use the platform's own
authenticated access path. A login wall answering 401 is not a deployment
failure, and reporting it as one is a false red.

**Complete when:** the deployment served a response traceable to this exact
commit, or the reason it could not be reached is named.

## 4. Repair what fails, within a cap

For each failure, diagnose from the cited log before changing anything. Fix the
cause, push, and return to step 2.

Stop at the attempt cap. Three attempts on the same failing check without a
changed diagnosis means the diagnosis is wrong, not that another attempt is
needed.

Never disable a check, mark a test skipped, loosen a threshold, or retry a
flaking job to get green, unless that change is the actual fix and is stated as
such in the report.

**Complete when:** every check is green, or the cap was reached and the
remaining reds are reported with their causes.

## 5. Report what was observed

State it plainly:

- checks run, with counts and conclusions;
- the deployment URL and what proved it carries this commit;
- attempts used against the cap;
- what remains red, and why;
- what could not be verified, named as a gap.

**A truthful red report is a correct outcome of this gate.** A green claim about
a run that was never observed to finish is the one result this gate must never
produce.

**Complete when:** the report distinguishes observed from inferred, and every
unverified surface is named.
