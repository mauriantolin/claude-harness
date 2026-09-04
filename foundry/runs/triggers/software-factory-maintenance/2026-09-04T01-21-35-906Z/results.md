# software-factory-maintenance trigger eval

Model: haiku. 5/10 matched (50.0%), 4 missed trigger(s), 1 false positive(s).

| Expected | Got | Query |
|---|---|---|
| trigger | silence | Three PRs are approved and green. Merge them and cut release 1.4.0. |
| trigger | silence | Bump the version everywhere, write the release notes with credits, and prepare the release PR. |
| trigger | silence | Clean up the PR queue: which ones are stale, superseded or ready to merge? |
| trigger | silence | Verify the 2.1.0 tarball installs cleanly and the CLI runs before we publish to npm. |
| silence | trigger | Implement the feature from the accepted contract and take it through the factory. |
| silence | silence | Commit this reviewed change on a branch and take it to PR-ready. |
| silence | silence | Review this diff for correctness and security. |
| silence | silence | Watch CI for this push and confirm the deployment is serving. |
| silence | silence | Which open issue should I pick up next? |
| silence | silence | Write a changelog entry for the bug I just fixed. |
