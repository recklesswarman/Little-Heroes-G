const https = require('https');

async function test() {
  const endpoints = [
    { name: 'health', url: 'https://little-heroes-quest-8842.web.app/api/rex/health', method: 'GET' },
    { name: 'chat', url: 'https://little-heroes-quest-8842.web.app/api/rex/chat', method: 'POST', body: { heroId: 'hero_demo_1', message: 'Hello Rex! I just brushed my teeth!' } },
    { name: 'battle-coach', url: 'https://little-heroes-quest-8842.web.app/api/rex/battle-coach', method: 'POST', body: { bossId: 'sugar_bandit', quadrant: 'upper_right', elapsedSeconds: 45, brushCadence: 'vigorous' } },
    { name: 'quest-guide', url: 'https://little-heroes-quest-8842.web.app/api/rex/quest-guide', method: 'POST', body: { heroName: 'Leo', currentChapter: 2, currentWaypoint: 'enamel_falls', completedWaypoints: ['wisdom_tooth_summit'], unlockedSuperpowers: ['sonic_shield'] } },
    { name: 'parent-report', url: 'https://little-heroes-quest-8842.web.app/api/rex/parent-report', method: 'POST', body: { childName: 'Leo', weekLabel: 'Week 40', metricsSummary: { brushingScore: 92, emotionalRegulationCount: 5 } } },
    { name: 'proactive', url: 'https://little-heroes-quest-8842.web.app/api/rex/proactive', method: 'POST', body: { triggerType: 'bedtime_nudge', heroName: 'Leo', streak: 5, brushedEveningToday: false, brushedMorningToday: true, completedQuestsCount: 4, bossesDefeatedCount: 2 } }
  ];

  for (const ep of endpoints) {
    try {
      const opts = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
      if (ep.body) opts.body = JSON.stringify(ep.body);
      const res = await fetch(ep.url, opts);
      const text = await res.text();
      console.log(`=== ${ep.name} (${res.status}) ===`);
      console.log(text.slice(0, 300));
    } catch (err) {
      console.log(`=== ${ep.name} (ERROR) ===`, err.message);
    }
  }
}
test();
