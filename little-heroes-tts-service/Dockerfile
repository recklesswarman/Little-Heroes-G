FROM python:3.11-slim

# Kokoro's G2P fallback path (misaki) needs espeak-ng for English
# out-of-distribution words and several non-English languages.
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bake the Kokoro model weights into the image at build time (instead of
# downloading them on first request) so a scale-to-zero cold start only pays
# for container start + model load into memory, not a ~300MB network fetch.
ENV HF_HOME=/app/.cache/huggingface
# Also pre-download every voicepack in the casting table -- Kokoro otherwise
# fetches each voice's .pt file from Hugging Face on its first use.
RUN python -c "from kokoro import KPipeline; from voices import KNOWN_VOICES; p = KPipeline(lang_code='a'); [p.load_voice(v) for v in sorted(KNOWN_VOICES)]"

# Cloud Run expects PORT env var
ENV PORT=8080
EXPOSE 8080

CMD ["python", "main.py"]
