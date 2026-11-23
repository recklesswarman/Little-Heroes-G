#!/usr/bin/env bash
# Pi desktop extras for Little Heroes. Run from the app folder (~/apps/little-heroes) by
# update-little-heroes.sh and by the "Deploy to family Pi" workflow. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p "$HOME/bin" "$HOME/.config/systemd/user"
# Evening "get ready for tomorrow" calendar heads-up (scripts/pi/calendar-prep.mjs, 6:30 PM).
for unit in little-heroes-calendar-prep.service little-heroes-calendar-prep.timer; do
  install -m 0644 "scripts/pi/$unit" "$HOME/.config/systemd/user/$unit"
done
systemctl --user daemon-reload >/dev/null 2>&1 || true
systemctl --user enable --now little-heroes-calendar-prep.timer >/dev/null 2>&1 || true
# District school calendar (no-school days): refreshed July 1 and August 1
# (scripts/pi/school-calendar.mjs); the first run happens now if there is no saved copy yet.
for unit in little-heroes-school-calendar.service little-heroes-school-calendar.timer; do
  install -m 0644 "scripts/pi/$unit" "$HOME/.config/systemd/user/$unit"
done
systemctl --user daemon-reload >/dev/null 2>&1 || true
systemctl --user enable --now little-heroes-school-calendar.timer >/dev/null 2>&1 || true
if [ ! -f "${SCHOOL_CALENDAR_FILE:-$HOME/apps/little-heroes-school-calendar.json}" ]; then
  systemctl --user start --no-block little-heroes-school-calendar.service >/dev/null 2>&1 || true
fi
# Math Lab: offline copies of the PhET math sims (served at /phet/ by the app). Downloads only the
# missing ones, in the background; run `node scripts/pi/phet-sims.mjs --force` to update them.
(node scripts/pi/phet-sims.mjs >/dev/null 2>&1 &) || true
# Fridge Display: launcher script, app icon, and a "Fridge Display" shortcut on the desktop
# and in the app menu (scripts/pi/fridge-display.sh opens #fridge full screen in Chromium).
install -m 0755 scripts/pi/fridge-display.sh "$HOME/bin/fridge-display.sh"
mkdir -p "$HOME/.local/share/icons" "$HOME/.local/share/applications" "$HOME/Desktop"
install -m 0644 public/icon-512.png "$HOME/.local/share/icons/little-heroes.png"
sed "s#@HOME@#$HOME#g" scripts/pi/little-heroes-fridge.desktop > "$HOME/.local/share/applications/little-heroes-fridge.desktop"
install -m 0755 "$HOME/.local/share/applications/little-heroes-fridge.desktop" "$HOME/Desktop/little-heroes-fridge.desktop"
gio set "$HOME/Desktop/little-heroes-fridge.desktop" metadata::trusted true >/dev/null 2>&1 || true
# Let the desktop open the shortcut without an "Execute?" prompt (pcmanfm / libfm).
LIBFM="$HOME/.config/libfm/libfm.conf"
if [ -f "$LIBFM" ] && ! grep -q '^quick_exec=' "$LIBFM"; then
  sed -i '/^\[config\]/a quick_exec=1' "$LIBFM" || true
fi
echo "Fridge Display shortcut is on the desktop: $HOME/Desktop/little-heroes-fridge.desktop"
