import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = 5188;
const DIST_DIR = path.resolve('dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        }
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

await new Promise(resolve => server.listen(PORT, resolve));
console.log(`Test server running on port ${PORT}`);

// Launch Chrome
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9333',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  'about:blank'
]);

// Wait for debugging port
let targets = null;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 200));
  try {
    const res = await fetch('http://127.0.0.1:9333/json');
    targets = await res.json();
    if (targets && targets.length > 0) break;
  } catch (e) {}
}

if (!targets || !targets[0]) {
  console.error('Failed to connect to Chrome debugging endpoint');
  chromeProc.kill();
  server.close();
  process.exit(1);
}

const target = targets.find(t => t.type === 'page') || targets[0];
const ws = new WebSocket(target.webSocketDebuggerUrl);

let msgId = 1;
const pending = new Map();

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(data.error);
    else resolve(data.result);
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise(resolve => ws.onopen = resolve);

// Enable necessary domains
await send('Page.enable');
await send('Runtime.enable');
await send('DOM.enable');

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

const viewports = [
  { name: 'Narrow Fold (320x650)', width: 320, height: 650 },
  { name: 'Galaxy S8 / Pixel (360x740)', width: 360, height: 740 },
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'iPhone 14 Pro (393x852)', width: 393, height: 852 }
];

for (const vp of viewports) {
  console.log(`\n=== Testing Viewport: ${vp.name} ===`);
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.navigate', { url: `http://localhost:${PORT}/` });
  await new Promise(r => setTimeout(r, 1500));

  // Check page overflow
  const docMetrics = await evaluate(`
    ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
    })
  `);
  console.log('Doc metrics:', docMetrics);

  // Check task check buttons BEFORE click
  const beforeStats = await evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('.task-check-btn, .habit-check-btn'));
      return btns.map(b => {
        const r = b.getBoundingClientRect();
        return {
          id: b.getAttribute('data-task-id') || b.getAttribute('data-habit-id'),
          width: Math.round(r.width),
          height: Math.round(r.height),
          left: Math.round(r.left),
          right: Math.round(r.right),
          top: Math.round(r.top),
          viewportWidth: window.innerWidth,
          isOverflowingRight: r.right > window.innerWidth,
          isUnderMinTapSize: r.width < 44 || r.height < 44
        };
      });
    })()
  `);
  console.log('Task/habit buttons before click (first 2):', beforeStats.slice(0, 2));

  // Now click the first task check button
  const clickResult = await evaluate(`
    (() => {
      const btn = document.querySelector('.task-check-btn');
      if (!btn) return { error: 'No task check button found' };
      const preRect = btn.getBoundingClientRect();
      btn.click();
      return {
        clickedId: btn.getAttribute('data-task-id'),
        preRect: { width: Math.round(preRect.width), right: Math.round(preRect.right), left: Math.round(preRect.left) }
      };
    })()
  `);
  console.log('Clicked task check button:', clickResult);

  // Wait for state update and re-render
  await new Promise(r => setTimeout(r, 800));

  // Close reward modal if opened
  await evaluate(`
    (() => {
      const coolBtn = document.getElementById('reward-modal-cool-btn');
      if (coolBtn) coolBtn.click();
      const closeCelebration = document.getElementById('interactive-celebration-close-btn');
      if (closeCelebration) closeCelebration.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  // Now measure the clicked task card and button AFTER click
  const afterStats = await evaluate(`
    (() => {
      const taskId = '${clickResult?.clickedId || ''}';
      const card = document.querySelector('[data-task-card-id="' + taskId + '"]');
      const btn = card ? card.querySelector('.task-check-btn') : null;
      const docScrollWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      if (!btn) return { error: 'Button not found after click', cardFound: !!card };
      const r = btn.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        taskId,
        btnRect: {
          width: Math.round(r.width),
          height: Math.round(r.height),
          left: Math.round(r.left),
          right: Math.round(r.right)
        },
        cardRect: {
          width: Math.round(cardRect.width),
          left: Math.round(cardRect.left),
          right: Math.round(cardRect.right)
        },
        viewportWidth: winWidth,
        docScrollWidth,
        hasDocOverflow: docScrollWidth > winWidth,
        isButtonClippedRight: r.right > winWidth,
        isButtonClippedByCard: r.right > cardRect.right
      };
    })()
  `);
  console.log('Task card & button AFTER click:', afterStats);

  // Check all interactive buttons for touch targets under 44px
  const smallButtons = await evaluate(`
    (() => {
      const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
      return allBtns
        .map(b => {
          const r = b.getBoundingClientRect();
          return {
            tag: b.tagName,
            id: b.id || b.className.slice(0, 30),
            text: b.innerText.slice(0, 20).trim(),
            width: Math.round(r.width),
            height: Math.round(r.height),
            left: Math.round(r.left),
            right: Math.round(r.right),
            visible: r.width > 0 && r.height > 0 && r.bottom > 0
          };
        })
        .filter(b => b.visible && (b.width < 44 || b.height < 44 || b.right > window.innerWidth));
    })()
  `);
  console.log(`Small or overflowing buttons count on ${vp.name}:`, smallButtons.length);
  if (smallButtons.length > 0) {
    console.log('Sample small/overflowing buttons:', smallButtons.slice(0, 10));
  }
}

ws.close();
chromeProc.kill();
server.close();
console.log('\nTesting complete.');
process.exit(0);
