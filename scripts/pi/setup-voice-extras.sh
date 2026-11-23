#!/usr/bin/env bash
# Installs the Pi's voice extras: Kokoro (pre-read bedtime stories with word timings) and
# Moonshine (fast speech-to-text for the Read-Along reading check). Both are free and open
# (Kokoro: Apache 2.0, kokoro-onnx: MIT, Moonshine: MIT). About 400 MB of downloads, once.
# Piper and whisper.cpp stay as they are; the app falls back to them (and the browser voice).
#
# Run from the app folder: bash scripts/pi/setup-voice-extras.sh   (install-extras.sh runs it
# in the background the first time). Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="$HOME/apps/voice-extras"
MODELS="$DIR/models"
RELEASE="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
mkdir -p "$MODELS" "$HOME/.config/systemd/user"

command -v ffmpeg >/dev/null 2>&1 || sudo -n apt-get install -y ffmpeg python3-venv >/dev/null 2>&1 || true
[ -x "$DIR/venv/bin/python" ] || python3 -m venv "$DIR/venv"
"$DIR/venv/bin/pip" install --quiet --upgrade pip
"$DIR/venv/bin/pip" install --quiet "kokoro-onnx>=0.4,<1" soundfile numpy \
  "useful-moonshine-onnx @ git+https://github.com/usefulsensors/moonshine.git#subdirectory=moonshine-onnx"

for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "$MODELS/$f" ]; then
    curl -fsSL --retry 3 -o "$MODELS/$f.tmp" "$RELEASE/$f"
    mv "$MODELS/$f.tmp" "$MODELS/$f"
  fi
done

install -m 0644 scripts/pi/voice-extras/voice_extras.py "$DIR/voice_extras.py"
install -m 0644 scripts/pi/little-heroes-voice-extras.service "$HOME/.config/systemd/user/little-heroes-voice-extras.service"
systemctl --user daemon-reload
systemctl --user enable --now little-heroes-voice-extras.service
systemctl --user restart little-heroes-voice-extras.service

# The app server finds the service through KOKORO_URL / MOONSHINE_URL (default 127.0.0.1:5010).
for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:5010/health 2>/dev/null; then echo; echo "voice extras ready"; exit 0; fi
  sleep 3
done
echo "voice extras installed, but the service did not answer yet: journalctl --user -u little-heroes-voice-extras" >&2
