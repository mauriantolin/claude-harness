# maintain trigger eval

Model: sonnet. 9/10 matched (90.0%), 1 missed trigger(s), 0 false positive(s).

| Case | Skill | Expected | Got | Loaded instead | Query |
|---|---|---|---|---|---|
| positive-three-prs-approved-green | maintain | trigger | trigger | harness:maintain | Three PRs are approved and green. Merge them and cut release 1.4.0. |
| positive-bump-version-everywhere-write | maintain | trigger | trigger | harness:maintain | Bump the version everywhere, write the release notes with credits, and prepare the release PR. |
| positive-clean-up-pr-queue | maintain | trigger | trigger | harness:maintain | Clean up the PR queue: which ones are stale, superseded or ready to merge? |
| positive-verify-tarball-installs-cleanly | maintain | trigger | silence | — | Verify the 2.1.0 tarball installs cleanly and the CLI runs before we publish to npm. |
| negative-implement-feature-accepted-contract | maintain | silence | silence | — | Implement the feature from the accepted contract and take it through the factory. |
| negative-commit-reviewed-change-branch | maintain | silence | silence | — | Commit this reviewed change on a branch and take it to PR-ready. |
| negative-review-diff-correctness-security | maintain | silence | silence | code-review | Review this diff for correctness and security. |
| negative-watch-ci-push-confirm | maintain | silence | silence | harness:deploy-gate | Watch CI for this push and confirm the deployment is serving. |
| negative-open-issue-pick-up | maintain | silence | silence | — | Which open issue should I pick up next? |
| negative-write-changelog-entry-bug | maintain | silence | silence | — | Write a changelog entry for the bug I just fixed. |
