// One-off authoring step: render every GLB under public/models/ to a 256 px WebP in public/assets/rewards/seed/models/.
// Not part of the app or the build. Needs Playwright's Chromium (preinstalled in cloud sessions) and `sharp`
// (run `npm i --no-save sharp` first). Usage: node scripts/capture_model_thumbnails.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sharp = (await import('sharp')).default;

const root = process.cwd();
const modelsDir = path.join(root, 'public/models');
const outDir = path.join(root, 'public/assets/rewards/seed/models');
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : p.endsWith('.glb') && files.push(p); } })(modelsDir);

const page = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="module" src="/node_modules/@google/model-viewer/dist/model-viewer.min.js"></script>
<model-viewer id="mv" style="width:512px;height:512px;background:transparent" environment-image="neutral" exposure="1.1" shadow-intensity="0" camera-controls disable-zoom interaction-prompt="none"></model-viewer>
</body></html>`;
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/thumb.html') { res.setHeader('content-type', 'text/html'); return res.end(page); }
  const f = path.join(root, url);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await pg.goto(`http://localhost:${port}/thumb.html`);
await pg.waitForFunction(() => customElements.get('model-viewer'));
for (const f of files) {
  const rel = path.relative(modelsDir, f).replace(/\\/g, '/');
  await pg.evaluate(async (src) => {
    const mv = document.getElementById('mv');
    mv.removeAttribute('animation-name');
    mv.setAttribute('camera-orbit', '35deg 70deg auto');
    await new Promise((resolve) => { mv.addEventListener('load', resolve, { once: true }); mv.src = src; });
    const names = mv.availableAnimations || [];
    const idle = names.find((n) => /idle/i.test(n));
    if (idle) { mv.animationName = idle; mv.play(); await new Promise((r) => setTimeout(r, 400)); mv.pause(); }
    await new Promise((r) => setTimeout(r, 250));
  }, `/public/models/${rel}`);
  const png = await pg.screenshot({ omitBackground: true });
  const out = path.join(outDir, rel.replace(/\.glb$/, '.webp'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(png).trim().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 }).toFile(out);
  console.log(rel, Math.round(fs.statSync(out).size / 1024) + ' KB');
}
await browser.close();
server.close();
