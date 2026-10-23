# route trigger eval

Model: sonnet. 10/10 matched (100.0%), 0 missed trigger(s), 0 false positive(s).

| Case | Skill | Expected | Got | Loaded instead | Query |
|---|---|---|---|---|---|
| positive-contract-accepted-which-skills | route | trigger | trigger | harness:route | The contract is accepted and we are about to implement. Which skills own the surfaces this change touches? |
| positive-before-dispatch | route | trigger | trigger | harness:route | Before I dispatch the implementer subagent, tell me which skills it has to load for this change. |
| positive-settings-and-migration | route | trigger | trigger | harness:route, harness:route | This change touches a settings page and a Postgres migration. Decide who owns what before implementation. |
| positive-two-skills-claim | route | trigger | trigger | harness:route | Two skills claim the same surface in this repo. Route the implementation pass. |
| positive-routing-table | route | trigger | trigger | harness:route | Check .agents/routing.md and load the skills this contract needs before we start coding. |
| negative-review-diff | route | silence | silence | code-review | Review this finished diff before I push it. |
| negative-write-contract | route | silence | silence | — | Write the done criteria for this issue before anyone touches code. |
| negative-css-question | route | silence | silence | — | How do I center a div with flexbox? |
| negative-deploy | route | silence | silence | harness:deploy-gate | The PR merged. Is it actually deployed and serving? |
| negative-release | route | silence | silence | harness:maintain | Cut the 1.4.0 release and publish it to npm. |
