# Focus box: Wifi-bt-remove script

The `wifi-bt-remove` script removes Wi-Fi and Bluetooth from your laptop, and puts them back when you ask but only with wired networking.
Wired networking keeps working the whole time.
It's for Debian or Devuan laptops with Intel Wi-Fi.

## Why

Bloody twitter. So good but so addictive.
If you're dopamine is fried, you need something drastic; drastic solutions for drastic problems.

Switching Wi-Fi off from the panel takes one click, so switching it back on takes one click too.
`wifi-bt-remove` uninstalls the Wi-Fi firmware and the Bluetooth service instead.
Once you've rebooted, getting back online means plugging in a cable and reinstalling them.
That friction is the point: it breaks the reflex, and that helps you get work done.
It's a speed bump, not a lock, since a cable still gets you online.

## Solution

Verify the script. Ask an expert or your trusted AI.

Remove the wifi and bluetooth drives by running:

```bash
sudo ~/.local/bin/wifi-bt-remove remove && sudo reboot
```

That command lists what it will remove and asks `proceed? [y/N]`.
Type `y` to go ahead; just pressing Enter stops it with nothing changed.
Add `-y` to skip the question.
The packages are removed and apt's download cache emptied, so `restore` can't reinstall them without the cable.

Until reboot, the radios are only switched off, and the Wi-Fi switch in the panel turns Wi-Fi back on in one click.
After the reboot they stay off until you run `restore` using a wired connection.
If it warns that rfkill is unavailable instead, the packages are still gone; the reboot switches the radios off.

Get out of the house. Don't go to a place where there's wired internet, so you're not tempted to turn it back on.

## Restore

Plug in a network cable, and run:

```bash
sudo ~/.local/bin/wifi-bt-remove restore && sudo reboot
```

## The script

````bash
#!/bin/bash
# wifi-bt-remove, v12
#
# Remove the Wi-Fi and Bluetooth packages so the radios stop working, and
# reinstall them on request. There is no config file to edit.
#
#   sudo ~/.local/bin/wifi-bt-remove remove    remove them, then reboot
#   sudo ~/.local/bin/wifi-bt-remove restore   reinstall them, then reboot
#
# remove uninstalls the packages, which is the persistent part: after a reboot
# the Wi-Fi driver has no firmware to load and the Bluetooth service (bluez) is
# gone. It also soft-blocks both radios with rfkill, so they go off at once,
# but until that reboot the Wi-Fi switch in the panel turns Wi-Fi back on: the
# driver still holds the firmware it loaded at boot. rfkill is installed
# automatically if missing; if it cannot be made available, the packages are
# still removed and a reboot completes the shutdown. remove asks before it
# runs; -y skips the prompt.
#
# It uses apt remove, not apt purge, so settings files stay on disk and restore
# reuses them. It also empties apt's download cache: apt-get keeps a copy of
# every package it downloads, and restore would reinstall from that copy with
# no cable.
#
# restore unblocks the radios and reinstalls the packages. It pulls from the
# package archive, so a wired connection is needed while Wi-Fi is off. Reboot
# afterwards: the Wi-Fi driver found no firmware at boot and gave up on the
# card, and it only looks again at the next boot.
#
# The drivers live in the kernel and are not removed. Removing bluez also
# removes packages that depend on it (the bluetooth metapackage, blueman,
# gnome-bluetooth) when installed; restore does not bring those back.

set -euo pipefail

# Wi-Fi radio firmware and the Bluetooth service. Removing these two disables
# the radios; nothing else is required. Add iw or wireless-tools here to remove
# the Wi-Fi command-line tools too. wpasupplicant, the Wi-Fi login service, can
# go as well unless a wired link logs in with 802.1X. Before adding a package,
# run 'apt-get -s remove <package>' to see everything apt would take with it.
readonly -a PACKAGES=('firmware-iwlwifi' 'bluez')

ASSUME_YES=0

say()  { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf '%s\n' "$*" >&2; exit 1; }

usage() {
    cat <<EOF
usage: ${0##*/} {remove [-y|--yes] | restore}
  remove    remove the Wi-Fi/Bluetooth packages (${PACKAGES[*]}) and switch the
            radios off (root), then reboot; -y skips the confirmation
  restore   reinstall the packages (root, needs wired link), then reboot
EOF
}
usage_die() { usage >&2; exit 2; }

require_root() { [[ ${EUID} -eq 0 ]] || die "needs root: sudo $0 $1"; }
require_apt()  { command -v apt-get >/dev/null || die "apt-get not found; this tool is apt-only"; }

# Make rfkill available, installing it if missing. Returns non-zero if it still
# is not usable, so the caller can fall back to advising a reboot. rfkill blocks
# the radio at the kernel level and works even while Wi-Fi is connected, so it
# needs no module unloading.
ensure_rfkill() {
    command -v rfkill >/dev/null && return 0
    say "installing rfkill (to switch the radios off without a reboot)..."
    DEBIAN_FRONTEND=noninteractive apt-get -y install rfkill >/dev/null \
        || warn "rfkill install failed"
    command -v rfkill >/dev/null
}

confirm() {
    local p
    say "these packages will be removed:"
    for p in "${PACKAGES[@]}"; do say "  ${p}"; done
    say "plus anything that depends on them (removing bluez also removes the"
    say "bluetooth metapackage, blueman, gnome-bluetooth when installed). the"
    say "drivers stay in the kernel; the radios go off right away if rfkill can be"
    say "installed, otherwise at the next reboot. reboot afterwards to keep wi-fi off."
    (( ASSUME_YES == 1 )) && return 0
    [[ -t 0 ]] || die "not a terminal and --yes not given; refusing to remove"
    local ans
    read -r -p "proceed? [y/N] " ans || true
    case "${ans}" in
        y|Y|yes|YES) return 0 ;;
        *) die "aborted; nothing was changed" ;;
    esac
}

cmd_remove() {
    require_root remove
    require_apt
    confirm

    say "removing: ${PACKAGES[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get -y remove "${PACKAGES[@]}" \
        || die "removal failed. apt refuses all changes while any package is broken; if it names an unrelated one, fix that with 'sudo apt-get -f install' first, then rerun."

    # apt-get keeps what it downloads; restore must not find a copy here.
    say "emptying apt's download cache..."
    apt-get clean || warn "could not empty apt's download cache; run 'sudo apt-get clean' so restore needs the cable"

    if ensure_rfkill; then
        say "switching the radios off..."
        rfkill block wifi      || warn "could not block wifi"
        rfkill block bluetooth || warn "could not block bluetooth"
        say "done. reboot to make it stick; until then the wi-fi switch in the panel turns it back on."
    else
        warn "rfkill unavailable; the packages are removed but the radios are still powered."
        say "done. reboot to switch the radios off."
    fi
}

cmd_restore() {
    require_root restore
    require_apt

    # Unblock first, apart from apt. Until you reboot after remove, the Wi-Fi
    # driver still holds its firmware in memory, so Wi-Fi comes back even if
    # the reinstall fails; after that reboot, only another reboot following the
    # reinstall brings it back. Bluetooth needs bluez reinstalled either way.
    if command -v rfkill >/dev/null; then
        say "unblocking the radios..."
        rfkill unblock wifi      || warn "could not unblock wifi"
        rfkill unblock bluetooth || warn "could not unblock bluetooth"
    fi

    say "refreshing package lists..."
    apt-get update || warn "apt-get update did not fully succeed; continuing with cached lists"
    say "reinstalling: ${PACKAGES[*]}"
    DEBIAN_FRONTEND=noninteractive apt-get -y install "${PACKAGES[@]}" \
        || die "reinstall failed. check the wired connection; if apt names an unrelated broken package, run 'sudo apt-get -f install' first, then rerun."
    say "done. reboot to bring wi-fi and bluetooth back."
}

main() {
    case "${1:-}" in
        remove)
            shift
            local a
            for a in "$@"; do
                case "${a}" in
                    -y|--yes) ASSUME_YES=1 ;;
                    *) warn "unexpected argument: ${a}"; usage_die ;;
                esac
            done
            cmd_remove
            ;;
        restore)
            shift
            (( $# == 0 )) || { warn "unexpected argument: $1"; usage_die; }
            cmd_restore
            ;;
        ''|help|-h|--help) usage ;;
        *)  warn "unknown command: ${1}"; usage_die ;;
    esac
}

main "$@"

````
