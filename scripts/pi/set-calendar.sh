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
URL="$(printf '%s' "$URL" | tr -d '[:space:]\r"'"'"'<>')"
if [[ ! "$URL" =~ ^https://[^[:space:]]+\.ics$ ]]; then
  echo "That doesn't look like an iCal address (https://... ending in .ics). Nothing was changed." >&2
  exit 1
fi
# Download to a temp file first: piping curl into head/grep under pipefail reports a
# good download as a failure when the reader stops early (curl error 23).
ics="$(mktemp)"
trap 'rm -f "$ics"' EXIT
status="$(curl -sS -L --max-time 30 -o "$ics" -w '%{http_code}' "$URL" || true)"
if [[ "$status" == "404" || "$status" == "403" || "$status" == "401" ]]; then
  echo "Google says that address doesn't exist (HTTP $status). That usually means it's the *public* address," >&2
  echo "or the secret address was reset. In Google Calendar > Settings > your calendar > Integrate calendar," >&2
  echo "copy the one under \"Secret address in iCal format\" (it ends in basic.ics). Nothing was changed." >&2
  exit 1
fi
if [[ "$status" != "200" ]] || ! grep -q 'BEGIN:VCALENDAR' "$ics"; then
  echo "Couldn't read a calendar from that address (HTTP ${status:-no answer}). Check the Pi's internet and try again. Nothing was changed." >&2
  exit 1
fi
echo "Found your calendar ($(grep -c '^BEGIN:VEVENT' "$ics" || true) events)."

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
