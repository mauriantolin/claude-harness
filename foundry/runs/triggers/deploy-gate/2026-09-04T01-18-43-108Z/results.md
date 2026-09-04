# deploy-gate trigger eval

Model: haiku. 8/10 matched (80.0%), 2 missed trigger(s), 0 false positive(s).

| Expected | Got | Query |
|---|---|---|
| trigger | trigger | The PR merged. Confirm it actually built, passed CI and is serving on staging before we tell the client. |
| trigger | silence | Watch the CI run for this push to completion and verify the deployment carries this commit. |
| trigger | trigger | Run the deploy gate on main. |
| trigger | silence | CI shows one job cancelled and one failed. Is the release live or not? |
| silence | silence | Implement the retry logic for the upload client. |
| silence | silence | Review this diff before I push it. |
| silence | silence | Commit the reviewed change on a branch and open the PR. |
| silence | silence | Write a GitHub Actions workflow that runs the tests on every push. |
| silence | silence | Cut release 2.4.0 and publish it to npm. |
| silence | silence | Why is the Docker build slow? Optimize the layers. |
