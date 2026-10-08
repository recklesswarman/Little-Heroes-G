---
name: multi-deployment-and-cache-sync-guidelines
description: Invariants for multi-host deployments (Firebase Hosting, App Hosting, GitHub Pages), PWA cache-busting, and localStorage catalog migrations
trigger: model_decision
---

# Multi-Deployment & Cache Synchronization Guidelines

## 1. Atomic Version & Service Worker Cache Bumping
- Whenever publishing updates to core catalog items, store schemas, or critical views, increment `APP_BUILD_VERSION` in `index.html` and `CACHE_NAME` in `public/sw.js`.
- The PWA Service Worker `activate` listener must immediately call `caches.delete(key)` on all non-matching cache names and invoke `self.clients.claim()`.
- Add defensive diagnostic prompts if the initial app mount placeholder remains stuck for more than 3.5 seconds.

## 2. Non-Destructive Catalog & Store Merging
- Never guard catalog synchronization behind a one-time boolean flag in `localStorage` that prevents future items from appearing on existing devices.
- Always perform reconciliation in `store.init()` by iterating:
  `CATALOG.forEach(item => { if (!store.items.some(i => i.id === item.id)) store.items.push(item); });`

## 3. Multi-Host Adaptive Base Path
- Ensure `vite.config.js` accounts for the execution context:
  `base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS === 'true' ? '/Little-Heroes-G/' : '/')`
- Configure `firebase.json` headers to disallow caching for HTML and JSON (`no-cache, no-store, must-revalidate`) while caching immutable versioned assets (`public, max-age=31536000, immutable`).

## 4. Multi-Target Cloud Rollout Verification
- When deploying live changes across Firebase ecosystems:
  1. Push code to `main` for GitHub Pages and Cloud Build triggers.
  2. Deploy Classic Firebase Hosting: `npx firebase deploy --only hosting`.
  3. Verify or trigger Firebase App Hosting rollout: `npx firebase apphosting:rollouts:create <backendId> --git-branch main --force`.
