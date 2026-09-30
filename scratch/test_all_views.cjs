const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

async function testViews() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = 'c:\\APP\\stitch_little_hero_adventures\\scratch\\edge-debug-profile2';
  
  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9223/json/version', res => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch (e) {}
  }

  const ws = new WebSocket(wsUrl);
  await new Promise(resolve => ws.on('open', resolve));

  let msgId = 1;
  const send = (method, params = {}) => new Promise(resolve => {
    const id = msgId++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) {
        ws.off('message', handler);
        resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const pageWs = new WebSocket(`ws://127.0.0.1:9223/devtools/page/${targetId}`);
  await new Promise(resolve => pageWs.on('open', resolve));

  let pageMsgId = 1;
  const pageSend = (method, params = {}) => new Promise(resolve => {
    const id = pageMsgId++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) {
        pageWs.off('message', handler);
        resolve(msg.result);
      }
    };
    pageWs.on('message', handler);
    pageWs.send(JSON.stringify({ id, method, params }));
  });

  pageWs.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      console.error('[PAGE ERROR]', msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[UNCAUGHT EXCEPTION]', JSON.stringify(msg.params.exceptionDetails));
    }
  });

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');

  await pageSend('Page.navigate', { url: 'https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app/' });
  await new Promise(r => setTimeout(r, 4000));

  // Now simulate an authenticated user with household configured
  console.log('--- Testing authenticated state transition ---');
  const result = await pageSend('Runtime.evaluate', {
    expression: `
      (() => {
        try {
          const store = window.__store__ || null;
          // Trigger guest mode or auth join
          const joinBtn = document.querySelector('button');
          console.log('Buttons on landing page:', Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()));
          return 'done';
        } catch(e) {
          return e.stack;
        }
      })()
    `
  });
  console.log('Landing eval result:', result);

  pageWs.close();
  ws.close();
  browserProc.kill();
}

testViews().catch(console.error);
