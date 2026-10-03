# Project conventions for Claude Code

## PR and deployment workflow

- Always open a pull request for completed work pushed to a branch — do not
  wait to be asked each time.
- Always drive a task through to completion: watch CI on the PR, merge once
  it is green and mergeable, then verify the change is actually live —
  this repo deploys on push to `main` via two separate workflows
  (`.github/workflows/deploy.yml` → GitHub Pages, and
  `.github/workflows/firebase-hosting-deploy.yml` → Firebase Hosting), so
  confirm both complete successfully against the real merge commit before
  considering the task done.
- This repo has no `pull_request`-triggered workflow beyond `ci.yml`
  (lint/test/build) — the two deploy workflows intentionally only trigger on
  `push: main`, so they never run against an unmerged PR.

## Testing

- The regression suite lives in `scratch/` and is driven by
  `scratch/run_all_tests.js` (`node scratch/run_all_tests.js`). Register any
  new `verify_*.js`/`test_*.cjs` test file added there.
- `scratch/setup_mock_env.js` provides a mock DOM/`document`/`localStorage`
  for running view-rendering tests under plain Node.
