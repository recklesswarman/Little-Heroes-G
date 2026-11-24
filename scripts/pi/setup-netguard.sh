#!/usr/bin/env bash
# Kids' tablet internet (Pi-hole): lets the Little Heroes app manage the tablets' Pi-hole groups.
# Run by install-extras.sh on every deploy. Safe to run again. Changes nothing in Pi-hole itself:
# the groups and rules are only made when a parent adds a tablet in Parent Portal > Screen Time.
# Undo everything: node ~/apps/little-heroes/scripts/pi/netguard-undo.mjs
set -euo pipefail
if [ ! -f /etc/pihole/pihole.toml ]; then
  echo "Tablet internet: Pi-hole v6 not found (/etc/pihole/pihole.toml), skipping."
  exit 0
fi
# Pi-hole's CLI password file (/etc/pihole/cli_pw) is readable by the "pihole" group. The app's
# server reads it to call the Pi-hole API (lists, groups and clients only). Until the Pi restarts
# the app falls back to "sudo -n cat" for that one file.
if ! id -nG "$USER" | tr ' ' '\n' | grep -qx pihole; then
  if sudo -n usermod -aG pihole "$USER" 2>/dev/null; then
    echo "Tablet internet: added $USER to the pihole group (takes full effect after the next restart)."
  else
    echo "Tablet internet: could not add $USER to the pihole group (no passwordless sudo). Run: sudo usermod -aG pihole $USER"
  fi
fi
if [ "$(sudo -n pihole-FTL --config webserver.api.cli_pw 2>/dev/null || echo true)" = "false" ]; then
  echo "Tablet internet: Pi-hole's CLI password is turned off. Set PIHOLE_PASSWORD (an app password) in ~/apps/little-heroes.env."
fi
echo "Tablet internet: ready. Add the kids' tablets in Parent Portal > Screen Time."
