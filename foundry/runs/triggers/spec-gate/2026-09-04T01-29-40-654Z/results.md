# spec-gate trigger eval

Model: haiku. 7/9 matched (77.8%), 2 missed trigger(s), 0 false positive(s).

| Expected | Got | Query |
|---|---|---|
| trigger | trigger | The factory finished and tests are green. Check the head against every acceptance ID in the contract before review. |
| trigger | trigger | Run the spec gate on this exact head against CONTRACT.md. |
| trigger | silence | Did this change actually deliver A1 through A5 and keep the must-not-change behaviors? Judge it against the frozen contract, not the suite. |
| trigger | silence | Requirement R3 was dropped by the maintainer mid-review. How should the acceptance report record that? |
| silence | silence | Review this diff for correctness, style and security. |
| silence | silence | Write the acceptance criteria for the export feature before we implement it. |
| silence | silence | The tests fail on CI but pass locally. Find out why. |
| silence | silence | Commit this on a branch and open the PR. |
| silence | silence | Make the suite stronger: mutate the fix and prove the tests go red. |
