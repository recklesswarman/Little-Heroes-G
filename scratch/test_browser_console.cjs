const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('ws');

async function testUrl(targetUrl) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = 'c:\\APP\\stitch_little_hero_adventures\\scratch\\edge-debug-profile';
  
  const browserProc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check'
  ]);

  // Wait for remote debugging port
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const data = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:9222/json/version', res => {
          let body = '';
          res.on('data', d => body += d);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('Failed to connect to Edge debugging port.');
    browserProc.kill();
    return;
  }

  console.log('Connected to Edge CDP:', wsUrl);
  const ws = new WebSocket(wsUrl);

  await new Promise(resolve => ws.on('open', resolve));

  let msgId = 1;
  const send = (method, params = {}) => {
    return new Promise(resolve => {
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
  };

  // Create a new target/page
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const pageWsUrl = `ws://127.0.0.1:9222/devtools/page/${targetId}`;
  const pageWs = new WebSocket(pageWsUrl);
  await new Promise(resolve => pageWs.on('open', resolve));

  let pageMsgId = 1;
  const pageSend = (method, params = {}) => {
    return new Promise(resolve => {
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
  };

  pageWs.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log(`[CONSOLE ${msg.params.type.toUpperCase()}]`, msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[UNCAUGHT EXCEPTION]', msg.params.exceptionDetails);
    }
  });

  await pageSend('Runtime.enable');
  await pageSend('Page.enable');
  await pageSend('Log.enable');

  console.log(`Navigating to ${targetUrl}...`);
  await pageSend('Page.navigate', { url: targetUrl });

  // Wait 6 seconds to observe logs & exceptions
  await new Promise(r => setTimeout(r, 6000));

  const evalResult = await pageSend('Runtime.evaluate', {
    expression: 'document.getElementById("app")?.innerHTML?.slice(0, 300)'
  });
  console.log('App DOM content:', evalResult?.result?.value);

  pageWs.close();
  ws.close();
  browserProc.kill();
}

testUrl(process.argv[2] || 'https://littleheroes-g1--little-heroes-quest-8842.us-east4.hosted.app/')
  .catch(console.error);
