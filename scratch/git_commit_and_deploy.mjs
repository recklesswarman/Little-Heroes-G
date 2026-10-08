import { execSync } from 'child_process';

console.log('--- Staging and committing changes ---');
try {
  execSync('git add .github/workflows/deploy.yml firebase.json index.html scratch/verify_fragmentation_and_rewards_fixes.mjs src/main.js vite.config.js dist/', { stdio: 'inherit' });
  execSync('git commit -m "fix: resolve GitHub Pages subpath base, preview auth bypass, and hosting cache headers"', { stdio: 'inherit' });
  console.log('✅ Committed successfully!');
  execSync('git push origin main', { stdio: 'inherit' });
  console.log('✅ Pushed to origin/main successfully!');
} catch (err) {
  console.error('Git error:', err.message);
}
