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
   - Add environment variable `API_KEY` with value `little-heroes-secret-key` (or your chosen key).
   - Under **Workers AI**, click **Add binding**:
     - Variable name: `AI`
     - Service: `Workers AI`
5. Click **Save and Deploy**.

---

## 🧪 Testing Your Worker

```bash
curl -X POST https://<your-worker-url>/ \
  -H "Authorization: Bearer little-heroes-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "A cute toddler hero in space pajamas reading a glowing star book beside a baby green T-Rex, 3D Pixar style"}' \
  --output test.jpg
```
