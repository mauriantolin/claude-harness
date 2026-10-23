# Harness: <repository>

This repository's binding of Railly's loop. The loop-bindings hook tells every agent to read this file when `loop` or `contract` loads; where it and a generic skill disagree, this file wins. Keep it to what is true only here: the method itself lives in the skills.

## Contract

Where acceptance items come from (issues, a spec directory, product docs) and how they are cited in `.agents/verify/contract.md`. What `trivial`, `normal` and `heavy` mean here: name the paths or subjects that always make a change `heavy`.

## Verify kit

The features under `.agents/verify/drive/` and when each applies. `check.sh` runs <the fast deterministic commands>; what it does not cover and who covers it (CI, a manual run).

## Routing

`.agents/routing.md` names the owner of each surface and what it supersedes. `route` reads it between contract and implement.

## Delivery

Branch names, commit format, how a PR is opened and what its body carries beyond `gate.sh prbody`, what moves the default branch. Every external action (commit, push, PR, merge, deploy) waits for a human's yes that names it.

## Deploy

How a delivered change is seen serving (`deploy-gate`): CI, the deployment, the URL.

## Lessons

Where `correct` puts a durable lesson in this repository (the case itself stays in `.agents/knowledge/`, which is ignored).
