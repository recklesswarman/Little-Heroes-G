# 🎨 Little Heroes Free AI Image Generation Worker

Free AI image generation backend for Little Hero Adventures Bedtime Storybook illustrations, powered by **Cloudflare Workers AI** (100,000 free calls/day).

---

## 🚀 Deployment Options

### Option A: One-Command CLI Deployment (Wrangler)
If you have your **Cloudflare Account ID** and **Cloudflare API Token**:

1. Set your environment variables (or paste in terminal):
```powershell
$env:CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
$env:CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"
```

2. Run the deployment:
```bash
cd cloudflare-worker
npx wrangler deploy
```

3. Note your live URL:
```
https://little-heroes-free-image-api.<your-subdomain>.workers.dev
```

---

### Option B: Cloudflare Dashboard (Browser)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages** > **Create application** > **Create Worker**.
2. Name it `little-heroes-free-image-api` and click **Deploy**.
3. Click **Edit code**, paste the contents of `worker.js`, and click **Deploy**.
4. Go to **Settings** > **Variables and Secrets**:
   - Under **Workers AI**, click **Add binding**:
     - Variable name: `AI`
     - Service: `Workers AI`
   - (Optional) Add a **Rate limiting** binding named `RATE_LIMITER` (30 requests / 60 s).
   - (Optional) Add a text variable `ALLOWED_ORIGINS` to override the default allowed origins.
5. Click **Save and Deploy**.

---

## 🔒 Access Control (no API key)

This Worker deliberately has **no shared API key**. The browser calls it directly, so any key
would be public. Instead:

- **Origin allow-list:** POST requests must carry an `Origin` header that exactly matches one of
  `ALLOWED_ORIGINS` (comma-separated). The default list is in `worker.js`
  (`DEFAULT_ALLOWED_ORIGINS`: GitHub Pages, Firebase Hosting, App Hosting, `localhost:3000`).
  CORS is only granted to those origins (never `*`).
- **Rate limit:** 30 requests per 60 seconds per IP via the `RATE_LIMITER` binding in `wrangler.toml`.
- **Guards:** only the four listed models are accepted and prompts are capped at 4000 characters.

An `Origin` header can be forged by non-browser clients, so this limits casual abuse only; the
free Workers AI quota is the real ceiling. For a stronger second layer, add a Cloudflare WAF
rate-limiting rule for this Worker's route in the dashboard.

If you previously deployed a version that used an `API_KEY` secret, remove it after deploying:
```bash
npx wrangler secret delete API_KEY
```

---

## 🧪 Testing Your Worker

```bash
curl -X POST https://<your-worker-url>/ \
  -H "Origin: https://little-heroes-quest-8842.web.app" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cute toddler hero in space pajamas reading a glowing star book beside a baby green T-Rex, 3D Pixar style"}' \
  --output test.jpg
```

Requests without an allowed `Origin` header return `403`.
