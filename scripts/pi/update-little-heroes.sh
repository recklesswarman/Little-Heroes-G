#!/usr/bin/env bash
# Pulls the latest Little Heroes code, rebuilds it, and restarts the Pi app service.
# Usage: update-little-heroes.sh [branch]   (default: main)
set -euo pipefail
BRANCH="${1:-main}"
APP_DIR="$HOME/apps/little-heroes"
NTFY=http://192.168.1.163:8090/pi-alerts
NTFY_AUTH="Authorization: Bearer $(cat "$HOME/.config/ntfy/pi-scripts-token" 2>/dev/null)"
notify(){ curl -s -m 10 -H "$NTFY_AUTH" -H "Title: $1" -H "Tags: $2" -d "$3" "$NTFY" >/dev/null || true; }
trap 'notify "Little Heroes update FAILED" warning "Update to $BRANCH failed - see journalctl --user -u little-heroes"' ERR
if [ ! -d "$APP_DIR/.git" ]; then
  git clone -q https://github.com/recklesswarman/Little-Heroes-G.git "$APP_DIR"
fi
cd "$APP_DIR"
git fetch -q origin "$BRANCH"
git checkout -q -B "$BRANCH" "origin/$BRANCH"
npm ci --no-audit --no-fund --loglevel=error
# Build with the Pi's settings so VITE_* values (e.g. Umami) are baked in; only VITE_*
# names ever reach the browser bundle.
( set -a; [ -f "$HOME/apps/little-heroes.env" ] && . "$HOME/apps/little-heroes.env"; set +a; npm run build --silent >/dev/null )
# Keep the installed copy of this script in step with the repo.
[ -f scripts/pi/update-little-heroes.sh ] && install -m 0755 scripts/pi/update-little-heroes.sh "$HOME/bin/update-little-heroes.sh"
# Sunday parent report timer (scripts/pi/weekly-report.mjs); units live in the repo.
mkdir -p "$HOME/.config/systemd/user"
# Evening calendar heads-up timer (scripts/pi/calendar-prep.mjs) too.
for unit in little-heroes-weekly-report.service little-heroes-weekly-report.timer \
            little-heroes-calendar-prep.service little-heroes-calendar-prep.timer; do
  install -m 0644 "scripts/pi/$unit" "$HOME/.config/systemd/user/$unit"
done
systemctl --user daemon-reload
systemctl --user enable --now little-heroes-weekly-report.timer >/dev/null 2>&1 || true
systemctl --user enable --now little-heroes-calendar-prep.timer >/dev/null 2>&1 || true
# Fridge Display shortcut + launcher (scripts/pi/install-extras.sh).
bash scripts/pi/install-extras.sh || true
systemctl --user restart little-heroes.service
# Wait up to ~60s for the server to start listening before declaring the deploy failed
# (a fixed 3s sleep raced the restart when the Pi was busy).
for i in $(seq 1 30); do
  curl -fsS -m 5 http://127.0.0.1:3000/healthz >/dev/null 2>&1 && break
  if [ "$i" -eq 30 ]; then
    echo "Little Heroes did not answer /healthz within 60s" >&2
    curl -fsS -m 5 http://127.0.0.1:3000/healthz >/dev/null
  fi
  sleep 2
done
notify "Little Heroes updated" rocket "Now running $(git log -1 --format='%h %s' | cut -c1-80)"
echo "Little Heroes is running $(git log -1 --oneline)"
