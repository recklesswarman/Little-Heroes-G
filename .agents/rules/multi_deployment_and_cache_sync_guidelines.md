---
name: multi-deployment-and-cache-sync-guidelines
description: Mandatory post-update pipeline for branch verification, PR completion, merging to main, CI validation, and multi-target deployments (GitHub Pages, Firebase Hosting, Firebase App Hosting), PWA cache-busting, and localStorage catalog migrations
trigger: model_decision
---

# Multi-Deployment, CI & Git Lifecycle Guidelines

## 1. Post-Update Git Lifecycle & Branch Cleanup
Whenever making, completing, or pushing any update or change:
1. **Check for Open Branches & PRs**:
   - Inspect active local and remote branches (`git branch -a`, `git fetch --prune origin`).
   - If work was done on a feature/fix branch (or if a PR is open for the changes):
     - Ensure all commits are pushed to the branch.
     - Complete/review the Pull Request.
     - Validate CI status (lint, tests, build) passes before merging.
     - Merge the PR/branch into `main` (fast-forward or merge commit as appropriate).
     - Clean up stale merged branches locally and remotely.
   - If working directly on `main`, verify `git status` is clean and pushed to `origin/main`.

## 2. Multi-Target Deployment & Verification (Live Everywhere)
Every update pushed to `main` MUST be confirmed live across all target environments:
1. **GitHub Pages**:
   - Driven automatically by `.github/workflows/deploy.yml` on push to `main` (builds with `VITE_BASE_PATH: '/Little-Heroes-G/'`).
   - Confirm the workflow triggers and completes successfully.
2. **Classic Firebase Hosting**:
   - Driven automatically by `.github/workflows/firebase-hosting-deploy.yml` on push to `main` to `https://little-heroes-quest-8842.web.app`.
   - If running locally or verifying CLI directly: run `npx firebase deploy --only hosting --project little-heroes-quest-8842`.
3. **Firebase App Hosting**:
   - Backend `littleheroes-g1` (`https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app`) is connected to the GitHub repository on `main`.
   - Verify rollout or trigger rollout via: `npx firebase apphosting:rollouts:create littleheroes-g1 --git-branch main --force --project little-heroes-quest-8842`.

## 3. Atomic Version & Service Worker Cache Bumping
- Whenever publishing updates to core catalog items, store schemas, or critical views, increment `APP_BUILD_VERSION` in `index.html` and `CACHE_NAME` in `public/sw.js`.
- The PWA Service Worker `activate` listener must immediately call `caches.delete(key)` on all non-matching cache names and invoke `self.clients.claim()`.
- Add defensive diagnostic prompts if the initial app mount placeholder remains stuck for more than 3.5 seconds.

## 4. Non-Destructive Catalog & Store Merging
- Never guard catalog synchronization behind a one-time boolean flag in `localStorage` that prevents future items from appearing on existing devices.
- Always perform reconciliation in `store.init()` by iterating:
  `CATALOG.forEach(item => { if (!store.items.some(i => i.id === item.id)) store.items.push(item); });`

## 5. Multi-Host Adaptive Base Path
- Ensure `vite.config.js` accounts for the execution context:
  `base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS === 'true' ? '/Little-Heroes-G/' : '/')`
- Configure `firebase.json` headers to disallow caching for HTML and JSON (`no-cache, no-store, must-revalidate`) while caching immutable versioned assets (`public, max-age=31536000, immutable`).
