# deploy-gate trigger eval

Model: sonnet. 10/10 matched (100.0%), 0 missed trigger(s), 0 false positive(s).

| Case | Skill | Expected | Got | Loaded instead | Query |
|---|---|---|---|---|---|
| positive-pr-merged-confirm-actually | deploy-gate | trigger | trigger | harness:deploy-gate | The PR merged. Confirm it actually built, passed CI and is serving on staging before we tell the client. |
| positive-watch-ci-push-completion | deploy-gate | trigger | trigger | harness:deploy-gate | Watch the CI run for this push to completion and verify the deployment carries this commit. |
| positive-deploy-gate-main | deploy-gate | trigger | trigger | harness:deploy-gate | Run the deploy gate on main. |
| positive-ci-shows-one-job | deploy-gate | trigger | trigger | harness:deploy-gate | CI shows one job cancelled and one failed. Is the release live or not? |
| negative-implement-retry-logic-upload | deploy-gate | silence | silence | — | Implement the retry logic for the upload client. |
| negative-review-diff-push | deploy-gate | silence | silence | — | Review this diff before I push it. |
| negative-commit-reviewed-change-branch | deploy-gate | silence | silence | — | Commit the reviewed change on a branch and open the PR. |
| negative-write-github-actions-workflow | deploy-gate | silence | silence | — | Write a GitHub Actions workflow that runs the tests on every push. |
| negative-cut-release-publish-npm | deploy-gate | silence | silence | harness:maintain | Cut release 2.4.0 and publish it to npm. |
| negative-why-docker-build-slow | deploy-gate | silence | silence | — | Why is the Docker build slow? Optimize the layers. |
