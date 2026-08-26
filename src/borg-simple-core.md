<div class="mdb-wide"></div>

# Borg-simple core

This script is a smaller, bare-case version of the [Borg-simple script](./borg-simple.md).
It has only two functions: archive one folder to one drive, or extract one repo from one drive.
The main motivation is that experts can review quickly the core functions.
It has no repo list, no retention, no in-place restore, no config file.

---

````bash
#!/bin/bash
# borg-super-simple, v9

set -euo pipefail
case $- in *x*) printf 'refusing to run under set -x\n' >&2; exit 1 ;; esac

CONFIG_FILE="$HOME/.borg-config"
MOUNT_BASE="/media/$(id -un)"
REPO_SUBDIR=""
PASSPHRASE_PATH=""
ALL_DRIVES=""
SELF=$(readlink -f -- "$0")

declare -A SRC=() DRIVES=() EXCL=() ALLOW=() ARCH=() PASS=()
declare -a REPOS=()
CUR=""

say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { printf '%s\n' "$*" >&2; exit 1; }

# shellcheck disable=SC2088  # '~/' is a literal pattern here, expanded by hand
_abs() { case "$1" in /) printf '/\n' ;; /*) printf '%s\n' "${1%/}" ;;
                      '~') printf '%s\n' "$HOME" ;;
                      '~/'*) printf '%s\n' "$HOME/${1#'~/'}" ;;
                      *) printf '%s\n' "$HOME/${1%/}" ;; esac; }

repo_name()       { CUR="$1"; REPOS+=("$1"); ARCH["$1"]=1; }
backup_data()     { local p; for p in "$@"; do SRC[$CUR]+="$(_abs "$p")"$'\n'; done; }
backup_drives()   { DRIVES[$CUR]="$*"; }
exclude()         { local g; for g in "$@"; do EXCL[$CUR]+="$g"$'\n'; done; }
include_only()    { ALLOW[$CUR]=1; }
include_only_in() { ALLOW[$CUR]=1; }
archive()         { [[ "${1:-}" == no ]] && ARCH[$CUR]=0; return 0; }
set_pass()        { PASS["$1"]="$2"; }
keep() { :; }; restore_to() { :; }; compression() { :; }

require_private() {
    local mode
    [[ -r "$1" ]] || die "$1 not found or not readable"
    mode=$(stat -c '%a' "$1") || die "cannot stat $1"
    (( (8#$mode & 8#77) == 0 )) || die "$1 is reachable by group or other (mode $mode); run: chmod 600 $1"
}

# The version gate the full tool has, for the same reason and with more at stake
# here: this is the tool you reach for on the machine where things have gone
# wrong, so it must not be the one that quietly writes archives of a shape the
# full tool cannot restore. Below 1.4 the /./ anchor is ignored without a word,
# and every folder is stored under its full path instead of its own name, so
# `backup extract -i` later asks borg for 'Documents' and the archive holds
# 'home/john/Documents'. 2.x changed the archive layout and the command surface.
_require_borg() {
    command -v borg >/dev/null 2>&1 || die "borg not found; install it first"
    local out ver major minor
    out=$(borg --version 2>/dev/null) || die "borg is installed but 'borg --version' failed"
    ver="${out##* }"
    major="${ver%%.*}"; minor="${ver#*.}"; minor="${minor%%.*}"
    case "$major$minor" in
        ''|*[!0-9]*) die "cannot read a borg version out of '$out'; expected something like 'borg 1.4.0'" ;;
    esac
    if (( major >= 2 )); then
        die "borg $ver is 2.x, which changed the archive layout; install borg 1.4 or newer and below 2.0"
    fi
    if (( major < 1 || minor < 4 )); then
        die "borg $ver is too old: 1.4 is the first version that stores a folder at the top of the archive under its own name, and older borg ignores that silently, so these archives would hold full paths and 'backup extract -i' would not find the folders. Install borg 1.4 or newer (Debian trixie and Devuan Excalibur ship it; bookworm needs bookworm-backports)"
    fi
    return 0
}

load_config() {
    _require_borg
    require_private "$CONFIG_FILE"
    # An unimplemented directive must not abort the source, but a mistyped one
    # must not vanish either: it would silently drop a folder from the backup.
    # shellcheck disable=SC2317  # bash calls this indirectly while sourcing
    command_not_found_handle() { warn "ignoring unknown config directive '$1'"; return 0; }
    # shellcheck source=/dev/null
    source "$CONFIG_FILE" || die "failed to load $CONFIG_FILE"
    unset -f command_not_found_handle
    MOUNT_BASE=$(_abs "$MOUNT_BASE")
    [[ -d "$MOUNT_BASE" ]] || die "MOUNT_BASE '$MOUNT_BASE' is not a directory"
    [[ -z "$PASSPHRASE_PATH" ]] || PASSPHRASE_PATH=$(_abs "$PASSPHRASE_PATH")
}

# borg re-invokes _emit-pass through this, so the cleartext goes from gpg or cat
# straight into borg and never enters this process. Empty when there is no
# passphrase file, and borg then prompts.
_passcommand() {
    [[ -n "$PASSPHRASE_PATH" && -e "$PASSPHRASE_PATH" ]] || return 0
    case "$BASH$SELF$PASSPHRASE_PATH" in
        *[[:space:]\'\"\\]*) die "borg splits the passcommand without a shell, so these paths must have no whitespace, quotes or backslashes: '$BASH' '$SELF' '$PASSPHRASE_PATH'" ;;
    esac
    printf '%s %s _emit-pass %s %s\n' "$BASH" "$SELF" "$PASSPHRASE_PATH" "$1"
}

# Plain or GPG is decided by content, not by filename, so the same file the full
# tool reads works here whatever it is called.
_emit_pass() {
    (( $# == 2 )) || { printf '_emit-pass needs <file> <repo>\n' >&2; exit 2; }
    local ct
    require_private "$1"
    if LC_ALL=C grep -qaE '^[[:space:]]*set_pass[[:space:]]' -- "$1"; then
        ct=$(cat -- "$1") || exit 1
    elif LC_ALL=C grep -qa '[^[:print:][:space:]]' -- "$1" \
      || LC_ALL=C grep -qa '^-----BEGIN PGP MESSAGE-----' -- "$1"; then
        ct=$(gpg --quiet --decrypt "$1") || exit 1
    else
        ct=$(cat -- "$1") || exit 1
    fi
    eval "$ct"; unset ct
    [[ -n "${PASS[$2]:-}" ]] || { printf 'no passphrase for %s in %s\n' "$2" "$1" >&2; exit 1; }
    printf '%s' "${PASS[$2]}"
}

do_backup() {
    (( $# == 0 )) || die "usage: borg-super-simple backup"
    local repo drive src g root pc rc=0 crc
    local -a srcs pats roots
    for repo in ${REPOS[@]+"${REPOS[@]}"}; do
        (( ${ARCH[$repo]} )) && [[ -n "${SRC[$repo]:-}" ]] || continue
        [[ -z "${ALLOW[$repo]:-}" ]] || { warn "$repo uses include_only; this tool cannot apply allowlists, so it is skipped (use the full tool)"; rc=1; continue; }
        srcs=(); roots=(); pats=()
        while IFS= read -r src; do
            [[ -n "$src" ]] || continue
            srcs+=( "$(dirname "$src")/./$(basename "$src")" )
            roots+=( "${src#/}" )
        done <<< "${SRC[$repo]}"
        # borg matches patterns against the source path with its leading slash
        # off, never against the name the item is stored under, so anchor every
        # glob on each source root. '**/' also matches zero directories.
        while IFS= read -r g; do
            [[ -n "$g" ]] || continue
            if [[ "$g" == /* ]]; then pats+=( --pattern "- sh:${g#/}" )
            else for root in "${roots[@]}"; do pats+=( --pattern "- sh:$root/**/$g" ); done; fi
        done <<< "${EXCL[$repo]:-}"
        pc=$(_passcommand "$repo")
        for drive in ${DRIVES[$repo]:-$ALL_DRIVES}; do
            mountpoint -q "$MOUNT_BASE/$drive" || { warn "$drive not mounted; skipping $repo there"; rc=1; continue; }
            say "archiving $repo to $drive..."
            crc=0
            (
                export BORG_REPO="$MOUNT_BASE/$drive${REPO_SUBDIR:+/$REPO_SUBDIR}/$repo"
                [[ -z "$pc" ]] || export BORG_PASSCOMMAND="$pc"
                [[ -d "$BORG_REPO" ]] || borg init --encryption=repokey || exit 1
                borg create ${pats[@]+"${pats[@]}"} "::{now}" "${srcs[@]}"
            ) || crc=$?
            (( crc <= 1 )) || { warn "$repo on $drive failed (borg exited $crc)"; rc=1; }
        done
    done
    return "$rc"
}

do_extract() {
    (( $# == 2 )) || die "usage: borg-super-simple extract <repo> <drive>"
    local path latest pc
    local -a lock=()
    path="$MOUNT_BASE/$2${REPO_SUBDIR:+/$REPO_SUBDIR}/$1"
    [[ -d "$path" ]] || die "no repo at $path"
    [[ -w "$path" ]] || { lock=(--bypass-lock); warn "$path is not writable; reading with borg's lock bypassed"; }
    pc=$(_passcommand "$1")
    export BORG_REPO="$path"
    [[ -z "$pc" ]] || export BORG_PASSCOMMAND="$pc"
    latest=$(borg list ${lock[@]+"${lock[@]}"} --last 1 --short) || die "could not list $path"
    [[ -n "$latest" ]] || die "no archives in $path"
    say "extracting $1 from $2 (archive: $latest) into $PWD..."
    borg extract ${lock[@]+"${lock[@]}"} "::$latest"
}

case "${1:-}" in
    _emit-pass) shift; _emit_pass "$@" ;;
    backup)     shift; load_config; do_backup "$@" ;;
    extract)    shift; load_config; do_extract "$@" ;;
    *)          die "usage: borg-super-simple backup | borg-super-simple extract <repo> <drive>" ;;
esac

````
