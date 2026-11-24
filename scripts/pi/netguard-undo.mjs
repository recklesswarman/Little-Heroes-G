#!/usr/bin/env node
// Removes everything the kids' tablet internet feature put in Pi-hole: the little-heroes-kids and
// little-heroes-bedtime groups, every list entry whose comment starts with "little-heroes:", and
// the tablets' client entries it made (others get their old groups back). Clears the saved settings.
//   node ~/apps/little-heroes/scripts/pi/netguard-undo.mjs
// The same thing as Parent Portal > Screen Time > "Remove all tablet rules from the Pi-hole".
import { createNetGuardService } from '../../server/netGuardService.js';

const service = createNetGuardService();
if (!service.config.local) {
  console.log('Pi-hole was not found on this machine; nothing to undo.');
  process.exit(0);
}
try {
  await service.act({ action: 'remove-all' });
  console.log('Removed the tablet internet rules from Pi-hole.');
} catch (err) {
  console.error('Could not undo:', err?.message || err);
  process.exit(1);
}
