# Loop bindings (claude-harness)

Injected when Railly's `experimental:loop` or `experimental:contract` loads. It changes nothing in Railly's method; it names the three places where this machine's harness plugs into it.

## 1. The repository's binding comes first

Read `.agents/harness.md` now if it exists. It is this repository's binding of the loop: where the contract's acceptance items come from, how size classes map to its own risk rules, which verify features exist, how delivery and promotion work there. Where it and a generic skill disagree, the repository wins. If the file does not exist, say so once and follow Railly's method unchanged.

## 2. Route before implementing

Between the contract and loop step 2 (implement), load `Skill(harness:route)` and let it name the skill that owns each surface the change touches, then load those skills with the Skill tool before the first edit. When implementation is delegated to a subagent, its prompt names those skills and tells it to load them first. Writing code for a surface before its owning skill is loaded is a skipped step, not a shortcut: where `.agents/routing.md` has a `routes` block, the route-guard hook blocks that edit until the agent making it (a subagent included) has loaded the owners.

## 3. After delivery, observe the deployment

When the human approves a push or merge and the repository deploys, the change is not done at the push: load `Skill(harness:deploy-gate)` (or the skill `.agents/routing.md` names for it) and observe CI and the deployment serving that commit, or report the red as it is.

The verify-before-done Stop hook runs `.agents/verify/fresh.sh` while a contract exists: a session cannot end claiming done with a contract feature unobserved on the current tree.
