const https = require('https');

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    const scriptMatch = text.match(/src="[^"]*index-[^"]*\.js"/);
    const titleMatch = text.match(/<title>([^<]*)<\/title>/);
    console.log(`URL: ${url}`);
    console.log(`  Status: ${res.status} ${res.statusText}`);
    console.log(`  Title: ${titleMatch ? titleMatch[1] : 'N/A'}`);
    console.log(`  Script: ${scriptMatch ? scriptMatch[0] : 'N/A'}`);
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
  }
}

async function run() {
  await checkUrl('https://little-heroes-quest-8842.web.app/');
  await checkUrl('https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app/');
}

run();
