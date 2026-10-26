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
image (below) bakes the weights in at build time instead, so this download
never happens in production.

## Deployment (Cloud Run)

This repo has no CI automation for Python service deploys — same as the
existing `little-heroes-agy-service`, this is a manual `gcloud` deploy:

```bash
cd little-heroes-tts-service
gcloud run deploy little-heroes-tts-kokoro \
  --source . \
  --region us-central1 \
  --project little-heroes-quest-8842 \
  --allow-unauthenticated \
  --cpu 2 \
  --memory 2Gi \
  --min-instances 0 \
  --max-instances 5 \
  --concurrency 10
```

- `--min-instances 0`: scales to zero when idle (no cost while unused). Note
  this means the first request after an idle period pays a cold-start cost
  — container start plus loading the Kokoro model into memory (the model
  weights themselves are baked into the image at build time, so this is
  "load into RAM," not "download from the internet," but it's still on the
  order of a few seconds). If that latency becomes a problem in practice,
  raising `--min-instances` to `1` keeps the model warm at the cost of a
  small continuous Cloud Run bill.
- `--allow-unauthenticated`: the client calls this service directly (same
  pattern the AGY service already uses via `VITE_AGY_REX_URL`), so it needs
  to be publicly reachable. There's no sensitive data or paid API behind
  it (Kokoro is local/offline), so this is a reasonable default; add
  Cloud Run's built-in rate limiting / Cloud Armor if abuse becomes a
  concern.

After deploying, note the service URL and wire it in as `VITE_KOKORO_TTS_URL`
(see root `.env.example`) for client builds that call it directly, and
confirm `firebase.json`'s `/api/tts/**` rewrite points at the same service
name/region for the same-origin fallback path used on Firebase Hosting and
GitHub Pages.

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
