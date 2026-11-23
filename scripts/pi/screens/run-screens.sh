#!/usr/bin/env bash
# Screen checks on the family Pi: pictures the Fridge Display and kid screens of the app that is
# running now (http://127.0.0.1:3000) and compares them with the last good pictures.
#
#   run-screens.sh            check (first run saves the pictures to compare against)
#   run-screens.sh --accept   the changes are fine: keep today's pictures as the new good ones
#
# A broken screen (app crashed, drew nothing, script errors) fails and sends a pi-alerts note.
# A changed picture is reported (pi-alerts note + the before/after pictures in the GitHub run),
# then kept as the new good picture, so each deploy is compared with the one before it.
# Pictures live in SCREENS_DIR (default ~/apps/screen-checks).
set -uo pipefail
APP_DIR="${APP_DIR:-$HOME/apps/little-heroes}"
export SCREENS_DIR="${SCREENS_DIR:-$HOME/apps/screen-checks}"
NTFY=http://192.168.1.163:8090/pi-alerts
NTFY_AUTH="Authorization: Bearer $(cat "$HOME/.config/ntfy/pi-scripts-token" 2>/dev/null)"
notify(){ curl -s -m 10 -H "$NTFY_AUTH" -H "Title: $1" -H "Tags: $2" -d "$3" "$NTFY" >/dev/null || true; }

cd "$APP_DIR"
mkdir -p "$SCREENS_DIR"
CONFIG=scripts/pi/screens/playwright.config.mjs

if [ "${1:-}" = "--accept" ]; then
  npx playwright test -c "$CONFIG" --update-snapshots=all >/dev/null 2>&1
  echo "Saved today's screens as the good pictures."
  exit 0
fi

# No system Chromium: use Playwright's own copy (downloaded once).
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 && [ -z "${CHROME_BIN:-}" ]; then
  npx playwright install chromium >/dev/null 2>&1 || true
fi

first_run=0
[ -d "$SCREENS_DIR/baseline" ] || first_run=1
rm -rf "$SCREENS_DIR/last-run" "$SCREENS_DIR/pictures"
npx playwright test -c "$CONFIG"
status=$?

report="$SCREENS_DIR/report.json"
summary=$(node scripts/pi/screens/summarize.mjs "$report" 2>/dev/null || echo '{"broken":[],"changed":[],"total":0}')
broken=$(node -e 'const s=JSON.parse(process.argv[1]);console.log(s.broken.join(", "))' "$summary")
changed=$(node -e 'const s=JSON.parse(process.argv[1]);console.log(s.changed.join(", "))' "$summary")
# Keep this run's before/after pictures (a later --update-snapshots run clears last-run).
[ -d "$SCREENS_DIR/last-run" ] && cp -r "$SCREENS_DIR/last-run" "$SCREENS_DIR/pictures"
commit=$(git log -1 --format='%h %s' | cut -c1-70)

if [ -n "$broken" ]; then
  notify "Screen check: broken screens" warning "After $commit these screens look broken: $broken"
  echo "::error::Broken screens: $broken"
  exit 1
fi
if [ "$first_run" = 1 ]; then
  notify "Screen check ready" camera "Saved the first screen pictures to compare future updates with."
  echo "Saved the first screen pictures."
  exit 0
fi
if [ -n "$changed" ]; then
  # Keep the changed pictures as the new good ones (the before/after stay in pictures/).
  npx playwright test -c "$CONFIG" --update-snapshots=changed >/dev/null 2>&1 || true
  notify "Screen check: screens changed" eyes "After $commit these screens look different: $changed. Before/after pictures are on the GitHub run."
  echo "::warning::Screens changed: $changed"
  exit 0
fi
[ "$status" = 0 ] || { echo "::error::Screen check did not run"; exit 1; }
echo "All screens look the same."
