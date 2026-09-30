const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function inspect(url) {
  console.log(`\n=================== Inspecting ${url} ===================`);
  const html = await fetch(url);
  console.log('Status:', html.status);
  const versionMatch = html.body.match(/APP_BUILD_VERSION = ['"]([^'"]+)['"]/);
  console.log('App Build Version:', versionMatch ? versionMatch[1] : 'not found');
  const scriptMatch = html.body.match(/src="(\.\/assets\/index-[^">]+)"/);
  console.log('Main Script:', scriptMatch ? scriptMatch[1] : 'not found');
  const hasInlineSplash = html.body.includes('Loading your hero headquarters');
  console.log('Has Inline Splash:', hasInlineSplash);
  const hasDarkStyle = html.body.includes('background-color: #0b0f19');
  console.log('Has Dark Background Inline Style:', hasDarkStyle);
}

async function run() {
  await inspect('https://little-heroes-quest-8842.web.app/');
  await inspect('https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app/');
}

run().catch(console.error);
