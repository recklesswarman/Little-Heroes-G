#!/usr/bin/env bash
# Connect the family Google Calendar to Little Heroes on the Pi.
#   bash ~/apps/little-heroes/scripts/pi/set-calendar.sh
# Asks for the calendar's "Secret address in iCal format" (typed text stays hidden), saves it
# as GOOGLE_CALENDAR_ICS_URL in ~/apps/little-heroes.env, restarts the app and prints what the
# Fridge Display will show this week.
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/apps/little-heroes}"
ENV_FILE="${ENV_FILE:-$HOME/apps/little-heroes.env}"

echo "Paste the secret iCal address (it starts with https://calendar.google.com/calendar/ical/ and ends in .ics),"
read -rsp "then press Enter: " URL
echo
URL="$(printf '%s' "$URL" | tr -d '[:space:]')"
if [[ ! "$URL" =~ ^https://[^[:space:]]+\.ics$ ]]; then
  echo "That doesn't look like an iCal address (https://... ending in .ics). Nothing was changed." >&2
  exit 1
fi
if ! curl -fsS --max-time 20 "$URL" | head -c 2000 | grep -q 'BEGIN:VCALENDAR'; then
  echo "Google didn't return a calendar for that address. Copy the *secret* address again. Nothing was changed." >&2
  exit 1
fi

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
tmp="$(mktemp)"
grep -v '^GOOGLE_CALENDAR_ICS_URL=' "$ENV_FILE" > "$tmp" || true
printf 'GOOGLE_CALENDAR_ICS_URL=%s\n' "$URL" >> "$tmp"
cat "$tmp" > "$ENV_FILE"
rm -f "$tmp"
echo "Saved to $ENV_FILE."

systemctl --user restart little-heroes.service
echo "Restarted the app."

cd "$APP_DIR"
node --env-file="$ENV_FILE" scripts/pi/calendar-prep.mjs --check
