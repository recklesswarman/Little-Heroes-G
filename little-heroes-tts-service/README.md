# 🗣️ Little Heroes TTS Microservice (Kokoro)

Self-hosted text-to-speech backend for Little Hero Adventures — replaces the
app's former ElevenLabs + Gemini Flash TTS tiers with a single, centrally
managed service built on [Kokoro](https://github.com/hexgrad/kokoro)
(Apache-2.0, 82M-parameter open-weight TTS). Runs fully offline/locally —
no external API key or per-request cost.

Pet → voice casting lives in `voices.py`, the single source of truth (the
old ElevenLabs/Gemini TTS code had this mapping duplicated across two
backends and collapsed to one voice for every pet; this service gives each
of the 24 companion pets a distinct voice).

## Local development

```bash
cd little-heroes-tts-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# System dependency (G2P fallback for English OOD words + some other languages):
#   macOS: brew install espeak-ng
#   Debian/Ubuntu: sudo apt-get install -y espeak-ng
cp .env.example .env
python main.py
# Service listens on http://localhost:8080
```

Try it:

```bash
curl -X POST http://localhost:8080/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Rawr! Ready for an adventure?", "petId": "rex", "voiceStyle": "default"}'

curl http://localhost:8080/voices
curl http://localhost:8080/health
```

The first request after a fresh install downloads Kokoro's model weights
from Hugging Face Hub (~300MB) — subsequent requests are fast. The Docker
image (below) bakes the base model and every voicepack in the casting table
in at build time instead, so this download never happens in production.

## Deployment (Cloud Run)

This repo has no CI automation for Python service deploys — same as the
existing `little-heroes-agy-service`, this is a manual `gcloud` deploy.

**Step 1 — get the latest code into Cloud Shell** (first time: clone; after
that: pull), then go into the service folder and check you are in the right
place. `--source .` uploads the *current folder*, so deploying from the wrong
folder ships the wrong app and the container fails to start:

```bash
cd ~
[ -d Little-Heroes-G ] || git clone https://github.com/recklesswarman/Little-Heroes-G.git
cd ~/Little-Heroes-G && git pull origin main
cd little-heroes-tts-service
ls          # must show: Dockerfile  main.py  requirements.txt  voices.py
```

**Step 2 — deploy:**

```bash
gcloud run deploy little-heroes-tts-kokoro \
  --source . \
  --region us-central1 \
  --project little-heroes-quest-8842 \
  --allow-unauthenticated \
  --cpu 4 \
  --memory 4Gi \
  --cpu-boost \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 4 \
  --timeout 60
```

- `--cpu 4 --memory 4Gi`: Kokoro on CPU is compute-bound. A first live test
  on 2 vCPU measured *slower than real time* (7.7s to synthesize a 4.6s
  clip), which is far too slow for the app's client timeouts. The service
  now sizes PyTorch's thread pool from the container's CPU quota (it used to
  default to the host's core count and thrash), and 4 vCPU gives more
  headroom. Cloud Run only bills while a request is being served.
- `--cpu-boost`: extra CPU during container startup to shorten cold starts.
- `--concurrency 4`: synthesis is serialized inside the process, so a high
  concurrency just queues requests behind each other.
- `--timeout 60`: Firebase Hosting rewrites cut off requests at 60s anyway.
- Every synthesis logs `audio=…s synth=…ms rtf=…` (and returns `X-Synth-Ms` /
  `X-Audio-Seconds` headers). `rtf` below 1.0 means faster than real time —
  check Cloud Run logs after deploying to confirm the fix.
- The model is loaded and warmed up in the app's startup (FastAPI lifespan),
  so a request is never routed to a half-loaded instance. The web app also
  pings `/api/tts/health` on page load to wake a scaled-down instance.
- `--min-instances 0`: scales to zero when idle (no cost while unused). The
  first request after an idle period still pays container start + model
  load (measured ~22s before warm-up was added). If that is a problem in
  practice, `--min-instances 1` keeps one instance warm at a small
  continuous Cloud Run bill.
- Optional env vars: `CORS_ORIGINS` (comma-separated extra allowed origins),
  `TORCH_NUM_THREADS` (override the auto-detected thread count),
  `SKIP_WARMUP=1` (skip the startup warm-up, e.g. for local dev).
- `--allow-unauthenticated`: the client calls this service directly (same
  pattern the AGY service already uses via `VITE_AGY_REX_URL`), so it needs
  to be publicly reachable. There's no sensitive data or paid API behind
  it (Kokoro is local/offline), so this is a reasonable default; add
  Cloud Run's built-in rate limiting / Cloud Armor if abuse becomes a
  concern.

After deploying, note the service URL and wire it in as `VITE_KOKORO_TTS_URL`
(see root `.env.example`) for client builds that call it directly.

`firebase.json` routes `/api/tts` and `/api/tts/**` to this Cloud Run service.
Firebase Hosting validates every `run:` rewrite target at deploy time and
refuses to publish *any* hosting version if the referenced service doesn't
exist, so the service must be deployed **before** those rewrites are merged
(this is what broke `firebase-hosting-deploy.yml` right after the first
merge). The client calls the service same-origin via these rewrites unless
`VITE_KOKORO_TTS_URL` is set at build time.

## API

### `POST /tts`

```json
{
  "text": "Rawr! Ready for an adventure?",
  "petId": "rex",
  "voiceStyle": "default",
  "speed": null
}
```

- `petId` — numeric id (`"1"`–`"24"`) or key (`"rex"`, `"luna"`, …) from
  `src/data/petsData.js`'s `PETS_DATABASE`. Unknown ids fall back to the
  default voice rather than erroring.
- `voiceStyle` — `"default"` (companion chat/workout coaching) or
  `"bedtime"` (slower, softer default speed). The client still applies its
  own progressive per-chapter slowdown and pitch compensation on top of
  whatever this service returns — unchanged from before.
- `speed` — optional explicit override, clamped to `[0.5, 1.5]`.

Response:

```json
{
  "success": true,
  "audio": "<base64 PCM16 mono @ 24kHz>",
  "mimeType": "audio/pcm;rate=24000",
  "sampleRate": 24000,
  "voice": "am_puck",
  "petId": "rex",
  "cached": false
}
```

This mirrors the exact shape the client's `playPcmTtsResponse()` already
expects from the old ElevenLabs/Gemini TTS routes, so the client-side change
was a small, surgical edit rather than a rewrite.

### `GET /voices`

Returns the full pet → voice casting table, for debugging/ops visibility.

### `GET /health`

Cloud Run health check.
