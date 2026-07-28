<div class="mdb-wide"></div>

# Script: Borg super-simple

This script is a smaller, bare case, version of the [simple-borg script](./borg-simple.md).
It has only two functions: archive one folder to one drive, or extract one repo from one drive.
The main motivation is that experts can review quickly the core functions.
It has no repo list, no retention, no in-place restore, no config file.

---

````bash
#!/bin/bash
# backup-simple, v6
#
# Minimal borg wrapper: archive one folder to one drive, or extract one repo
# from one drive. No repo list, no drive list, no retention, no in-place modes.
# borg does the work; this only resolves the repo path and the passphrase.
#
# An extraction of the full `backup` script's core, for the bare-minimum case and
# for anyone who would rather read ~160 lines than 2000. The full tool adds
# multiple repos, multiple drives, retention, in-place restore, and a config.
#
#   backup-simple <folder> <drive>     archive <folder> into the drive's repo
#   backup-simple -e <name> <drive>    extract repo <name> from the drive, into $PWD
#   backup-simple -h                   this help
#
# The repo for a folder lives at  MOUNT_BASE/<drive>[/REPO_SUBDIR]/<folder-basename>
# (the REPO_SUBDIR segment is dropped when REPO_SUBDIR is empty) and holds
# timestamped archives of that folder. The first archive of a folder creates the
# repo. Extract restores the latest archive into the current directory, so cd to
# where you want the files before running it.
#
# Reading a repo whose files belong to another user (restoring on a fresh box
# under a different account), or one on read-only media, is automatic: when the
# repo is not writable borg cannot create its lock, so -e reads with the lock
# bypassed and warns. Archiving is unaffected; it must write and needs permission.
#
# Passphrase: PASSPHRASE_PATH points at the SAME combined file the full backup
# tool uses, one file holding `set_pass <repo> '<passphrase>'` lines, as either a
# .gpg (gpg-encrypted) or a .pass (plaintext, chmod 600). borg fetches a repo's
# passphrase by re-invoking this script's hidden `_emit-pass` step through
# BORG_PASSCOMMAND, which decrypts the file, reads that one repo's line, and hands
# the cleartext straight to borg; it never enters the foreground process. With no
# such file, borg prompts. The file must be chmod 600. The path must be absolute
# (a leading ~ is expanded) and space-free, because borg runs the passcommand
# without a shell.
#
# borg version: this targets borg 1.2 through 1.4. borg 2.0 renames the commands
# used here (init -> repo-create, list -> repo-list) and changes repo::archive to
# -r <repo> plus a separate archive name, so the borg lines below need updating for
# 2.x (and 2.0 also drops --bypass-lock).

set -euo pipefail
case $- in *x*) printf 'refusing to run under set -x: it would trace the passphrase\n' >&2; exit 1 ;; esac

# ── settings ────────────────────────────────────────────────────────────────
MOUNT_BASE="/media/$(id -un)"   # drives mount under here; override for non-udisks layouts
REPO_SUBDIR=""
PASSPHRASE_PATH=""    # the combined set_pass file (.gpg or .pass); empty = borg prompts
# ──────────────────────────────────────────────────────────────────────────────

declare -A PASS=()    # repo -> passphrase; filled only inside the hidden _emit-pass child

say()       { printf '%s\n' "$*"; }
warn()      { printf '%s\n' "$*" >&2; }
die()       { printf '%s\n' "$*" >&2; exit 1; }
die_usage() { printf '%s\n' "$*" >&2; exit 2; }
need()      { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

# Absolute, symlink-resolved path to this script, for the BORG_PASSCOMMAND that
# re-invokes it. A bare $0 (PATH-resolved, e.g. under cron) is resolved via
# command -v; a path with a slash is resolved directly.
_resolve_self() {
    local src="$0" pth
    case "$src" in
        */*) pth="$src" ;;
        *)   pth=$(command -v -- "$src" 2>/dev/null) || pth="$src" ;;
    esac
    readlink -f -- "$pth" 2>/dev/null || printf '%s\n' "$pth"
}
SELF=$(_resolve_self)

# Refuse a passphrase file reachable by group or other: the cleartext, or the key
# that decrypts it, must be owner-only. Mirrors the full backup script's check.
require_private() {
    local f="$1" mode
    [[ -e "$f" ]] || die "$f not found; create it (chmod 600) before running"
    [[ -r "$f" ]] || die "$f exists but is not readable"
    mode=$(stat -c '%a' "$f") || die "cannot stat $f"
    (( (8#$mode & 8#77) == 0 )) || die "$f is reachable by group or other (mode $mode); run: chmod 600 $f"
}

# Directive, valid only inside the combined passphrase file. Records one repo's
# passphrase into PASS; the file is a list of these lines and nothing else.
set_pass() {
    (( $# == 2 )) || die "set_pass needs: <repo> '<passphrase>'; got $# args"
    PASS["$1"]="$2"
}

# Point borg at this script's hidden _emit-pass step for repo $1's passphrase, so
# the cleartext goes from gpg/cat straight into borg, never into this process.
# With no file, BORG_PASSCOMMAND stays unset and borg prompts at the terminal.
load_passphrase() {  # load_passphrase <repo>
    local repo="$1" p="${PASSPHRASE_PATH/#\~/$HOME}"
    [[ -n "$p" && -e "$p" ]] || return 0
    case "$p" in
        *.gpg)  need gpg ;;
        *.pass) ;;
        *)      die "PASSPHRASE_PATH must end in .gpg or .pass (got: $p)" ;;
    esac
    require_private "$p"
    case "$BASH$SELF$p" in
        *[[:space:]]*) die "passcommand needs space-free paths (BASH='$BASH' SELF='$SELF' PASSPHRASE_PATH='$p')" ;;
    esac
    export BORG_PASSCOMMAND="$BASH $SELF _emit-pass $p $repo"
}

# Hidden value child: decrypt the combined file, evaluate its set_pass lines, and
# print one repo's passphrase. Re-invoked by borg via BORG_PASSCOMMAND. The only
# place a passphrase is materialised, in a short-lived process handing it to borg;
# the set -x guard above keeps it out of a trace.
do_emit() {
    (( $# == 2 )) || { printf '_emit-pass needs <file> <repo>\n' >&2; exit 2; }
    local file="$1" repo="$2" ct
    require_private "$file"
    case "$file" in
        *.gpg)  need gpg; ct=$(gpg --quiet --decrypt "$file") || { printf 'could not decrypt %s\n' "$file" >&2; exit 1; } ;;
        *.pass) ct=$(cat -- "$file") ;;
        *)      printf 'PASSPHRASE_PATH must end in .gpg or .pass\n' >&2; exit 1 ;;
    esac
    eval "$ct"; unset ct
    [[ -n "${PASS[$repo]:-}" ]] || { printf 'no passphrase for %s in %s\n' "$repo" "$file" >&2; exit 1; }
    printf '%s' "${PASS[$repo]}"
}

repo_path() {  # repo_path <drive> <name>
    printf '%s\n' "$MOUNT_BASE/$1${REPO_SUBDIR:+/$REPO_SUBDIR}/$2"
}

do_archive() {
    (( $# == 2 )) || die_usage "usage: backup-simple <folder> <drive>"
    need borg
    local src="$1" drive="$2" repo name rc=0
    [[ -d "$src" ]] || die "not a directory: $src"
    [[ -d "$MOUNT_BASE/$drive" ]] || die "drive not found at $MOUNT_BASE/$drive"
    name=$(basename "$src")
    repo=$(repo_path "$drive" "$name")
    load_passphrase "$name"
    if [[ ! -d "$repo" ]]; then
        say "initialising repo $repo..."
        mkdir -p "$(dirname "$repo")" || die "could not create $(dirname "$repo")"
        borg init --encryption=repokey "$repo" || die "borg init failed for $repo"
    fi
    say "archiving $src to $repo..."
    borg create --compression auto,zstd --stats "$repo::{now}" "$src" || rc=$?
    (( rc <= 1 )) || die "borg create failed (rc=$rc)"
    (( rc == 0 )) || warn "borg create finished with warnings; the archive was created"
}

do_extract() {
    (( $# == 2 )) || die_usage "usage: backup-simple -e <name> <drive>"
    need borg
    local name="$1" drive="$2" repo latest
    local lock=()
    repo=$(repo_path "$drive" "$name")
    [[ -d "$repo" ]] || die "no repo at $repo"
    # A repo whose files another user owns, or one on read-only media, is not
    # writable, so borg cannot create its lock; read it with the lock bypassed.
    # A writable repo (the normal case) locks normally, so a real stale lock on
    # your own repo still fails loudly.
    if [[ ! -w "$repo" ]]; then
        lock=(--bypass-lock)
        warn "$repo is not writable; reading with borg's lock bypassed (assumes nothing else is writing it)"
    fi
    load_passphrase "$name"
    latest=$(borg list ${lock[@]+"${lock[@]}"} "$repo" --last 1 --short) || die "could not list $repo"
    [[ -n "$latest" ]] || die "no archives in $repo"
    say "extracting $repo::$latest into $PWD..."
    borg extract ${lock[@]+"${lock[@]}"} "$repo::$latest"
}

usage() {
    cat <<'EOF'
backup-simple: archive one folder to one drive, or extract one repo

  backup-simple <folder> <drive>     archive <folder> into the drive's repo
  backup-simple -e <name> <drive>    extract repo <name> from the drive, into $PWD
  backup-simple -h, --help           this help

Repo path: MOUNT_BASE/<drive>[/REPO_SUBDIR]/<name>. Settings are at the top of
this file; point PASSPHRASE_PATH at the same combined passphrase file your full
backup config uses. Extract restores into the current directory, so cd there first.
EOF
}

case "${1:-}" in
    _emit-pass)     shift; do_emit "$@" ;;
    -e|--extract)   shift; do_extract "$@" ;;
    -h|--help|help) usage ;;
    "")             die_usage "usage: backup-simple <folder> <drive>  (or: -e <name> <drive>)" ;;
    -*)             die_usage "unknown option: $1" ;;
    *)              do_archive "$@" ;;
esac

````
