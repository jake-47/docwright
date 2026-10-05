# Qemu install script

ThThe script that the [QEMU and Whonix guide](./FILENAME.md) has you run in steps 1 and 2. It checks whether your computer can run virtual machines at full speed, installs QEMU or updates it, and adds you to the kvm group if you need it. Hover over the code block and press the copy button to take all of it, then save it in your Downloads folder as `qemu-install.sh`. It is plain text, so read it before you run it; the comments at the top say what each command does. Run it as yourself, not with sudo, and start with `bash qemu-install.sh check`, which changes nothing.

````
#!/bin/bash
# qemu-install, v6
#
# Installs QEMU, the program that runs virtual machines, or updates it to
# the newest version your system offers. If you can't use your processor's
# hardware virtualization yet, it also adds you to the kvm group, so
# virtual machines can use it and run at full speed.
#
# There is nothing to edit. Run it as yourself, not with sudo; it asks for
# your password when it needs it.
#
#   qemu-install check     says whether this computer can run fast virtual
#                          machines, and what to fix if it can't; changes
#                          nothing
#   qemu-install install   installs QEMU, or updates it if it is already
#                          there, and adds you to the kvm group if you
#                          need it; apt shows what it will change and asks
#                          first
#
# Run install again whenever you want the newest QEMU. apt downloads only
# what is new or missing and leaves up-to-date packages alone. You only
# need to log out and back in if install ends by saying so.
#
# It installs four packages. qemu-system-x86 runs Intel and AMD virtual
# machines, qemu-system-gui shows them in a window, qemu-utils makes and
# converts disk images, and ovmf lets virtual machines start with UEFI,
# which some operating systems need. apt's optional extras (its
# "recommends") are left out.

set -euo pipefail

## ─── constants ──────────────────────────────────────────────────────

SELF="$(readlink -f "${BASH_SOURCE[0]}")"
readonly SELF

# All four are on the Whonix project's KVM install list, so installing
# Whonix afterwards adds to this set and replaces nothing.
readonly PACKAGES=(qemu-system-x86 qemu-system-gui qemu-utils ovmf)
readonly GROUP='kvm'

## ─── output ─────────────────────────────────────────────────────────

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die() { printf '%s\n' "$1" >&2; exit "${2:-1}"; }

## ─── identity ───────────────────────────────────────────────────────

# Reads line 2 of this file so the filename, header and version output
# cannot drift apart. readlink -f above makes this correct when the script
# is reached through a symlink on PATH.
version() {
    local line
    line="$(awk 'NR==2' "$SELF")" || die "cannot read $SELF"
    printf '%s\n' "${line#\# }"
}

usage() {
    local name
    name="$(basename "$SELF")"
    cat <<EOF
$(version)

installs qemu so you can run virtual machines, or updates it to the
newest version. if you need it, it also adds you to the kvm group so
they run at full speed.

  $name check
      check whether this computer can run fast virtual machines
  $name install
      install or update qemu; apt shows what it will change and asks first
  $name install --yes
      the same, without apt's question
  $name help
      show this help
  $name version
      show which version this is

run it as yourself, not with sudo; it asks for your password when it
needs it. if install ends by telling you to log out and back in, do
that, then run check. run install again any time to get the newest
qemu; it downloads only what has changed.
EOF
}

## ─── preconditions ──────────────────────────────────────────────────

# Refuses root because the kvm group has to go to the person who will run
# the virtual machines, and under sudo id -un answers root instead.
require_environment() {
    local arch
    [[ "$EUID" -ne 0 ]] \
        || die "run this as yourself, not with sudo; it asks for your password when it needs it" 2
    arch="$(uname -m)"
    case "$arch" in
        x86_64) ;;
        *) die "this installs the x86_64 emulator; this host reports $arch" ;;
    esac
    command -v apt-get >/dev/null || die "no apt-get; this script targets Debian and Devuan"
}

# Maps the cpu vendor to the names the firmware setting and the kvm module
# actually use, so the hints below name the right thing on either vendor
# rather than assuming one.
cpu_vendor() {
    local vendor
    vendor="$(awk -F': ' '/^vendor_id/ {print $2; exit}' /proc/cpuinfo)" || vendor=''
    case "$vendor" in
        GenuineIntel) printf '%s\n' 'intel' ;;
        AuthenticAMD) printf '%s\n' 'amd' ;;
        *) printf '%s\n' 'unknown' ;;
    esac
}

# Two different questions. An account is in a group from the moment
# usermod runs; a login session only has the group after a fresh login.
account_in_group() {
    local groups
    groups=" $(id -nG "$1") " || return 1
    [[ "$groups" == *" $2 "* ]]
}

session_in_group() {
    local groups
    groups=" $(id -nG) " || return 1
    [[ "$groups" == *" $1 "* ]]
}

# Returns 0 when the cpu and the kvm module are ready. Each failing branch
# names the next step, because these states are otherwise silent: qemu
# without -enable-kvm runs the guest under emulation and never says why
# it is slow.
check_hardware() {
    local flags vendor setting module
    flags="$(grep -Ec '(vmx|svm)' /proc/cpuinfo)" || flags=0
    vendor="$(cpu_vendor)"

    case "$vendor" in
        intel) setting='intel virtualization technology, or vt-x'; module='kvm_intel' ;;
        amd) setting='svm mode, or amd-v'; module='kvm_amd' ;;
        *) setting='virtualization, vt-x, or svm'; module='kvm_intel or kvm_amd' ;;
    esac

    if [[ "$flags" -eq 0 ]]; then
        warn "no vmx or svm flag in /proc/cpuinfo"
        warn "hardware virtualization is disabled in firmware, or absent from this cpu"
        warn "enter firmware setup at boot; the key varies by vendor, commonly del, f2, f10 or f1"
        warn "the setting is usually under security or advanced, named: $setting"
        return 1
    fi

    if [[ ! -e /dev/kvm ]]; then
        warn "cpu reports the flag but /dev/kvm is missing, so no kvm module is loaded"
        warn "try: sudo modprobe $module"
        warn "then read: sudo dmesg | grep -i kvm"
        warn "if it says disabled by bios, turn this on in firmware setup: $setting"
        return 1
    fi

    return 0
}

# Returns 0 when this login can use /dev/kvm. The failures need different
# fixes, and telling someone to join a group they are already in sends
# them round in a circle.
check_access() {
    local user
    if [[ -r /dev/kvm && -w /dev/kvm ]]; then
        say "hardware acceleration is available"
        return 0
    fi

    user="$(id -un)"
    if session_in_group "$GROUP"; then
        warn "you are in the $GROUP group, but /dev/kvm still does not let you read and write it"
        warn "look at its permissions with: ls -l /dev/kvm"
    elif account_in_group "$user" "$GROUP"; then
        warn "you are in the $GROUP group, but it takes effect only after you log out and back in"
    else
        warn "/dev/kvm exists but you cannot read and write it"
        warn "run '$(basename "$SELF") install' to join the $GROUP group, then start a new login session"
    fi
    return 1
}

## ─── install ────────────────────────────────────────────────────────

# apt-get installs what is missing, upgrades what is out of date and leaves
# the rest alone, reusing packages it has already downloaded. Handing it the
# whole list every time is what makes a later run an update.
install_packages() {
    local assume_yes="$1"
    local rc version
    local -a answer=()

    # apt asks before it changes anything and gives up when nobody can
    # answer; this says so up front instead of after the package-list refresh.
    if [[ "$assume_yes" == 'yes' ]]; then
        answer=(-y)
    elif [[ ! -t 0 ]]; then
        die "no terminal to prompt and --yes was not given; nothing installed or updated" 2
    fi

    command -v sudo >/dev/null || die "no sudo on PATH; cannot install packages"
    sudo -v || die "sudo failed, so nothing was installed"

    say "refreshing package lists..."
    # --error-on=any stops on any list that failed to refresh, so a run that
    # gets past here really has checked for the newest versions.
    if ! sudo apt-get update --error-on=any; then
        warn "apt-get update failed; the lines above name the package source that failed"
        die "check your internet connection, or fix or remove that source, then run this again"
    fi

    say "installing or updating qemu..."
    rc=0
    sudo apt-get install --no-install-recommends "${answer[@]}" "${PACKAGES[@]}" || rc=$?

    # apt-get exits 1 when its question is answered no, and 100 on errors.
    case "$rc" in
        0) ;;
        1) die "apt stopped without changing anything; nothing was installed or updated" ;;
        *)
            warn "apt could not finish; see its messages above"
            die "if apt could not find a package, this copy of qemu-install may be too old for your system; get a newer copy"
            ;;
    esac

    version="$(qemu-system-x86_64 --version)" \
        || die "qemu was installed but does not start; see the error above"
    say "qemu is up to date: ${version%%$'\n'*}"
}

# Changes nothing when this login can already use /dev/kvm, or already has
# the group, because then logging out would fix nothing. Otherwise the
# log-out line is printed whenever the account has the group but this
# login does not yet, including on a second run before logging out.
join_group() {
    local user
    user="$(id -un)"

    if [[ -r /dev/kvm && -w /dev/kvm ]] || session_in_group "$GROUP"; then
        return 0
    fi
    if ! getent group "$GROUP" >/dev/null; then
        warn "group $GROUP does not exist; skipping"
        return 0
    fi
    if ! account_in_group "$user" "$GROUP"; then
        say "adding $user to $GROUP..."
        sudo usermod -aG "$GROUP" "$user" || die "could not add $user to $GROUP"
    fi
    say "log out and back in before $GROUP takes effect"
}

## ─── dispatch ───────────────────────────────────────────────────────

main() {
    local subcommand="${1:-}"
    local assume_yes='no'

    case "$subcommand" in
        ''|help|-h|--help) usage; return 0 ;;
        version|--version) version; return 0 ;;
        check|install) shift ;;
        *) die "unknown argument: $subcommand (try: $(basename "$SELF") help)" 2 ;;
    esac

    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            -y|--yes) assume_yes='yes' ;;
            *) die "unknown flag: $1 (try: $(basename "$SELF") help)" 2 ;;
        esac
        shift
    done

    require_environment

    case "$subcommand" in
        check)
            check_hardware || return 1
            check_access || return 1
            ;;
        install)
            if ! check_hardware; then
                warn "installing anyway; virtual machines will be slow or fail to start until this is fixed"
            fi
            install_packages "$assume_yes"
            join_group
            ;;
    esac
}

main "$@"

````