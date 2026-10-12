# Project Conventions & Deployment Life-Cycle

## PR, CI & Multi-Deployment Workflow

- **Branch Check & PR Completion**: After making or pushing updates:
  - Check for open branches (`git branch -a`, `git fetch --prune origin`).
  - If a feature/fix branch or PR exists, verify CI checks pass (`ci.yml`: lint, test, build).
  - Complete the pull request and merge into `main`.
  - Always clean up merged branches.
- **Deploy Everywhere (Live Verification)**:
  - Every update pushed to `main` must be confirmed live across all deployment targets:
    1. **GitHub Pages**: Deployed via `.github/workflows/deploy.yml` on push to `main` (`https://recklesswarman.github.io/Little-Heroes-G/`).
    2. **Classic Firebase Hosting**: Deployed via `.github/workflows/firebase-hosting-deploy.yml` on push to `main` (`https://little-heroes-quest-8842.web.app`). Can also be triggered via `npx firebase deploy --only hosting`.
    3. **Firebase App Hosting**: Deployed via backend `littleheroes-g1` (`https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app`). Verify or trigger via `npx firebase apphosting:rollouts:create littleheroes-g1 --git-branch main --force`.
  - Confirm both GitHub Actions deploy workflows finish successfully against the merge commit before concluding the task.

## Cache Sync, Store Migrations & Multi-Host Base Path

- **Atomic Version & Service Worker Cache Bumping**: Whenever publishing
  updates to core catalog items, store schemas, or critical views, increment
  `APP_BUILD_VERSION` in `index.html` and `CACHE_NAME` in `public/sw.js`. The
  PWA Service Worker's `activate` listener must immediately call
  `caches.delete(key)` on all non-matching cache names and invoke
  `self.clients.claim()`. Add defensive diagnostic prompts if the initial app
  mount placeholder remains stuck for more than 3.5 seconds.
- **Non-Destructive Catalog & Store Merging**: Never guard catalog
  synchronization behind a one-time boolean flag in `localStorage` that
  prevents future items from appearing on existing devices. Always perform
  reconciliation in `store.init()` by iterating:
  `CATALOG.forEach(item => { if (!store.items.some(i => i.id === item.id)) store.items.push(item); });`
- **Multi-Host Adaptive Base Path**: `vite.config.js` must account for the
  execution context:
  `base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS === 'true' ? '/Little-Heroes-G/' : '/')`.
  `firebase.json` headers must disallow caching for HTML and JSON
  (`no-cache, no-store, must-revalidate`) while caching immutable versioned
  assets (`public, max-age=31536000, immutable`).

## Testing & Verification

- The regression suite lives in `scratch/` and is driven by `scratch/run_all_tests.js` (`node scratch/run_all_tests.js`). Register any new `verify_*.js`/`test_*.cjs` test file added there.
- `scratch/setup_mock_env.js` provides a mock DOM/`document`/`localStorage` for running view-rendering tests under plain Node.
- Always run `npm run build` to verify zero bundling or syntax errors prior to pushing.
