#!/usr/bin/env bash
# Opens the Little Heroes Fridge Display full screen on the Pi's monitor.
# Launched from the "Fridge Display" desktop shortcut (installed by update-little-heroes.sh).
# Close it with Alt+F4 (or the X in the top corner, which goes back to the normal app).
set -u
URL="${FRIDGE_URL:-http://127.0.0.1:3000/#fridge}"
PROFILE="$HOME/.config/little-heroes-fridge"

# Wait up to 60 s for the app (handy right after the Pi boots).
for _ in $(seq 1 30); do
  curl -fsS -m 2 http://127.0.0.1:3000/healthz >/dev/null 2>&1 && break
  sleep 2
done

BROWSER=""
for b in chromium chromium-browser; do
  command -v "$b" >/dev/null 2>&1 && { BROWSER="$b"; break; }
done
if [ -z "$BROWSER" ]; then
  command -v notify-send >/dev/null 2>&1 && notify-send "Fridge Display" "Chromium is not installed (sudo apt install chromium)."
  exit 1
fi

# Keep the screen on while the fridge display is open.
command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ] && { xset s off; xset -dpms; xset s noblank; } 2>/dev/null

exec "$BROWSER" \
  --user-data-dir="$PROFILE" \
  --kiosk "$URL" \
  --noerrdialogs --disable-infobars --no-first-run \
  --disable-session-crashed-bubble --disable-features=Translate \
  --password-store=basic --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required
