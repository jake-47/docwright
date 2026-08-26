<div class="mdb-wide"></div>

# Borg-simple script

**To devs and reviewers**: 
This script is about 3129 lines long and the result of vibe-coding with Opus 4.7, 4.8, 5, a few times with Fable 5, and about 200 iterations (for real).
Anthropic helped but also exasperates; I can't wait to upgrade my rig and install Qwen or something.
Anyway I've tested all the user-facing functions, and they work.
I'm not a coder, so please review this script if you can.

If this is too long, then please consider reviewing the [core part of the script](./borg-super-simple.md) which contains only the core functions for easy review.
Hopefully, there's nothing malicious.
I've been using the simple script for my daily backup-workflow.

---

````bash
#!/bin/bash
# borg-simple, v192
#
# Encrypted, versioned borg backups to USB drives. You keep one config file,
# ~/.borg-config (what to back up, to which drives, how long to keep it); the
# script reads it on every run, and init and rename are the only commands that
# write to it. Passphrases live in one file you point PASSPHRASE_PATH at, named
# whatever you like (chmod 600), gpg-encrypted or plaintext: the script reads
# which from the file's own bytes. With no path set, borg prompts per repo.
# Run it with no arguments to back up every repo, with a repo name to back up one,
# and with --help for the command list. The name you type is whatever this file was
# installed as, and the help and error messages show that name back to you.
# When a drive's files belong to another user, 'claim' takes ownership of that
# drive's mountpoint and its repo directories after showing what it will take
# and asking; it is the only place this tool uses sudo on a backup path.
# If borg itself is missing, the first command that needs it installs
# borgbackup with apt, so a fresh machine needs only this script. borg 1.4 or
# newer and below 2.0 is required, and anything outside that is refused.
# Setup, the config format, and cron use are in the guide.

set -euo pipefail

## ─── config location ─────────────────────────────────────────────────
# Every path this tool resolves hangs off $HOME, and under set -u an unset HOME
# aborts on the next line with a raw bash error, before help or version can run.
# die() is not defined yet here, so this says it the long way.
if [[ -z "${HOME:-}" ]]; then
    printf '%s\n' "HOME is not set, so the config path cannot be resolved; run from a login shell, or set HOME" >&2
    exit 1
fi
readonly CONFIG_FILE="$HOME/.bc"

# The single source of truth for the CLI surface. The dispatch case lists these,
# _reject_reserved_name forbids them as repo names by reading this list, and
# _selfcheck asserts each has a handler, a dispatch branch and a help-banner line.
readonly SUBCOMMANDS=(init extract list check claim pass-change rename version)

## ─── output ──────────────────────────────────────────────────────────
say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { printf '%s\n' "$*" >&2; exit 1; }
die_usage() { printf '%s\n' "$*" >&2; exit 2; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 not found; install it first"; }

## ─── baked defaults: the settings you edit ───────────────────────────
# Built-in settings, so the script runs with no config file. Your ~/.borg-config
# overrides any line it sets; lines it omits keep the value here.
MOUNT_BASE="/media/$(id -un)"   # drives mount under here, so drive d1 is MOUNT_BASE/d1; override for non-udisks layouts
RESTORE_PATH="$HOME/Downloads"  # extract restores a named repo into here; the whole-suite form uses RESTORE_PATH/<repo>
# SRC_HOME remaps an in-place restore of another machine's backup: folders go
# back to the parent named on each backup_data line, so when those sit under a
# foreign home (say /home/john) set this to it and they land under yours instead.
# "" = off. It cannot help a repo whose backup_data is a home directory itself:
# the archive stores that folder under its own name, so nothing is left to remap.
SRC_HOME=""
REPO_SUBDIR=""                  # optional folder between the drive and the repo; "" = repo at the drive root
PASSPHRASE_PATH=""              # one passphrase file, any name, gpg-encrypted or plaintext (detected from its content); "" = borg asks
ALL_DRIVES="d1 d2 d3 d4"        # the drive labels; a repo using `backup_drives all` gets all of these

## ─── internal state ──────────────────────────────────────────────────
# Repo blocks. CURRENT_REPO tracks the open block while sourcing the config.
CURRENT_REPO=""
declare -a REPOS=()           # repo names, in config order
declare -A REPO_SEEN=()       # name -> 1
declare -A REPO_SRC=()        # name -> newline-joined absolute source folders
declare -A REPO_DRIVES=()     # name -> space-joined drive labels
declare -A REPO_EXCLUDES=()   # name -> newline-joined exclude globs (emitted as '- sh:' patterns)
declare -A REPO_INCLUDES=()   # name -> newline-joined include_only globs
declare -A REPO_ARCHIVE=()    # name -> 1 archived (default), 0 if `archive no`
declare -A REPO_COMPRESSION=() # name -> borg compression spec; empty = borg default (lz4)
declare -A REPO_FINCLUDE_GLOBS=() # "name + newline + abs-folder" -> newline-joined folder-scoped include_only globs
declare -A REPO_HAS_FINCLUDE=()   # name -> 1 if the repo has any folder-scoped include_only line
declare -A REPO_RESTORE_TO=()     # "name + newline + abs-folder" -> absolute parent the folder restores into
declare -a PASS_SKIPPED=()    # repos skipped this run for a missing passphrase
declare -A PASS=()            # name -> passphrase; set only in the _emit-pass/_pass-names children and the writers, never on a routine run
declare -A PASS_NAMES=()      # name -> 1 for repos with a set_pass entry; learned via the names-only child, values never enter the parent
_PASS_NAMES_LOADED=0
_PASS_NAMES_UNREADABLE=0      # PASSPHRASE_PATH is present but the names child failed: no exec, no decrypt, or no set_pass lines

# Holds '--bypass-lock' for the current read when the repo directory is not
# writable, so borg can read a repo whose files another user owns, or one on
# read-only media, without creating a lock file. Empty for a writable repo, so a
# genuine stale lock on your own repo still fails loudly and tells you to
# break-lock. Set per read by _set_read_lock; never on a write path.
declare -a RO_LOCKOPT=()
declare -A _RO_WARNED=()

# Deduplicated bytes added across one archive run, counted once per repo (its
# first archived drive) so mirror drives don't multiply it.
RUN_DEDUP_BYTES=0
declare -A RUN_REPO_DEDUP_COUNTED=()

# Repos whose allowlist has already been checked against borg's matcher this
# run. The answer is a property of the config and the source tree, not of the
# drive being written, so one check per repo covers all its copies.
declare -A RUN_REPO_FILTER_CHECKED=()

# Every drive-level reason a repo came out short, in order. Each was already
# warned, but warn goes to stderr while the summary goes to stdout, so a cron job
# keeping only stdout got the verdict and none of the causes. Replayed on stdout
# just above the summary, so the run is answerable from one stream.
declare -a RUN_ISSUES=()

# What the repo loop last printed, so a blank line can separate a run's per-repo
# blocks: "block", "skip", or "" before anything. Consecutive skips stay grouped,
# since a blank line around every one-liner is noisier than the run it separates.
_RUN_LAST=""

# Retention. A repo is pruned only if it has a keep line; these defaults fill in
# any key such a line leaves unset.
readonly KEEP_LAST_DEFAULT=0
readonly KEEP_HOURLY_DEFAULT=0
readonly KEEP_DAILY_DEFAULT=7
readonly KEEP_WEEKLY_DEFAULT=4
readonly KEEP_MONTHLY_DEFAULT=-1
readonly KEEP_YEARLY_DEFAULT=-1
declare -A SEEN_KEEP=()
declare -A KEEP_LAST=()
declare -A KEEP_HOURLY=()
declare -A KEEP_DAILY=()
declare -A KEEP_WEEKLY=()
declare -A KEEP_MONTHLY=()
declare -A KEEP_YEARLY=()

## ─── helpers ─────────────────────────────────────────────────────────
_note_issue() { RUN_ISSUES+=("$1"); }

# Comma-join the arguments into "a, b, c"; nothing for an empty list.
_csv() {
    (( $# > 0 )) || return 0
    local acc="$1" x; shift
    for x in "$@"; do acc+=", $x"; done
    printf '%s' "$acc"
}

# One wording for an absent drive, everywhere. The path is load-bearing: a drive
# that is plugged in and mounted still reports "not mounted" whenever MOUNT_BASE
# points somewhere else, and only the path tells that apart from an absent drive.
_not_mounted() { printf '%s is not mounted at %s' "$1" "$MOUNT_BASE/$1"; }

# borg is the one dependency a fresh machine will not have, and a fresh machine
# is exactly where this tool has to work, so install it rather than refuse.
ensure_borg() {
    if command -v borg >/dev/null 2>&1; then
        _require_borg_version
        return 0
    fi
    say "borg not found; installing borgbackup..."
    sudo apt-get update                || die "apt-get update failed"
    sudo apt-get install -y borgbackup || die "could not install borgbackup"
    command -v borg >/dev/null 2>&1 || die "borgbackup installed but borg still not on PATH"
    _require_borg_version
}

# Every source folder is handed to borg as <parent>/./<folder> so it lands at the
# archive root under its own basename. That prefix strip is borg's slashdot hack,
# added in the 1.4 series; 1.2.x ignores the /./ silently and stores every item
# under its full path instead. Nothing fails at backup time, so the damage shows
# up only at restore, which is the worst failure direction this tool has.
# The upper bound matters as much: this tool parses deduplicated_size and
# unique_csize out of `borg create --json` (both gone in 2.0), calls a bare
# `borg prune` (2.0 wants an archive glob) and uses the ::archive syntax 2.0
# changed, and Debian trixie ships a borgbackup-is-borgbackup2 package that
# repoints the `borg` command at 2.x. Refuse both ends, and say which was hit.
_require_borg_version() {
    local out ver major minor
    out=$(borg --version 2>/dev/null | head -n1) || die "could not run 'borg --version'"
    [[ -n "$out" ]] || die "'borg --version' printed nothing; cannot confirm borg is 1.4 or newer"
    ver="${out##* }"
    major="${ver%%.*}"
    minor="${ver#*.}"; minor="${minor%%.*}"
    case "$major$minor" in
        ''|*[!0-9]*) die "could not read a version number from 'borg --version' (got: '$out'); this tool needs borg 1.4 or newer, below 2.0" ;;
    esac
    (( major == 1 && minor >= 4 )) && return 0
    (( major >= 2 )) \
        && die "borg $ver is too new; this tool is written against borg 1.x and would fail partway through on 2.x (changed create --json fields, prune arguments, and repo::archive syntax). Install the borgbackup 1.4 package, or check whether borgbackup-is-borgbackup2 has repointed the borg command"
    die "borg $ver is too old; this tool needs borg 1.4 or newer, which is where borg learned to strip the /./ prefix this tool's archive layout depends on. Upgrade borgbackup, or read these repos with borg directly"
}

# Absolute, symlink-resolved path to this script, for the BORG_PASSCOMMAND that
# re-invokes it. A bare $0 (PATH-resolved, e.g. cron) goes through command -v.
_resolve_self() {
    local src="$0" pth
    case "$src" in
        */*) pth="$src" ;;
        *)   pth=$(command -v -- "$src" 2>/dev/null) || pth="$src" ;;
    esac
    readlink -f -- "$pth" 2>/dev/null || printf '%s\n' "$pth"
}
SELF=$(_resolve_self)
readonly SELF

# The name this was invoked as, used by every message that tells you what to
# type. install_scripts deliberately lets a file be stored under one name and
# installed as another, so a message hardcoding either one is wrong for somebody.
CMD="${0##*/}"
readonly CMD

# One backup operation at a time; the fd-9 lock auto-releases on process exit.
# The lock lives beside the config in $HOME, not under $XDG_RUNTIME_DIR or /tmp:
# a $HOME path is per-user by construction, so no other local user can pre-create
# the name as a symlink and have this exec 9> truncate a file you own.
_acquire_lock() {
    local lock="${CONFIG_FILE}.lock"
    exec 9>"$lock"
    flock -n 9 || die "another backup operation is in progress"
}

# The mount-level reasons a write or a chown cannot work, said once for both
# callers so the two wordings can never drift apart. $1 is the mountpoint, $2 its
# fstype, $3 its options, $4 the indent every line carries, $5 the consequence
# clause the caller wants on the read-only line. Returns 1 for a read-only mount,
# 2 for a filesystem that carries no ownership, 0 when neither applies.
_fs_blocker() {
    local mnt="$1" fstype="$2" opts="$3" pad="${4:-}" ro_because="${5:-}"
    case ",$opts," in
        *,ro,*)
            warn "$pad$mnt is mounted read-only, $ro_because"
            warn "$pad  remount it:  sudo mount -o remount,rw $mnt"
            return 1 ;;
    esac
    case "$fstype" in
        vfat|exfat|ntfs|ntfs3|fuseblk)
            warn "$pad$mnt is $fstype, which stores no ownership; the mount's uid= option decides it, so chown cannot help"
            warn "$pad  remount as you:  sudo mount -o remount,uid=\"\$(id -u)\",gid=\"\$(id -g)\" $mnt"
            return 2 ;;
    esac
    return 0
}

# The remedy for an unwritable directory, named for the cause rather than offered
# as a menu. Three things produce the same symptom and only one is fixed by
# taking ownership: a read-only mount refuses the chown too, and vfat/exfat/ntfs
# carry no on-disk ownership at all (the mount's uid= option decides it). Ask the
# mount which case this is and print only that remedy. $1 is the directory, $2
# the drive label when the caller knows it. Advice only; nothing is run here.
_unwritable_hint() {
    local dir="${1:-}" label="${2:-}" fstype="" opts="" mnt=""
    if [[ -n "$dir" ]] && command -v findmnt >/dev/null 2>&1; then
        read -r fstype opts mnt < <(findmnt -no FSTYPE,OPTIONS,TARGET -T "$dir" 2>/dev/null) || true
    fi
    # A chown or remount aimed at / would be aimed at the whole machine, which
    # means the drive is not mounted where the caller thought. Say that instead
    # of printing a command that must not be run.
    if [[ "$mnt" == "/" ]]; then
        warn "  $dir is on your root filesystem, so that drive is not mounted; mount it and re-run"
        return 0
    fi
    if [[ -z "$mnt" ]]; then
        local show="${dir:-<the repo directory>}"
        warn "  inspect:  findmnt -no FSTYPE,OPTIONS -T $show   and   ls -ld $show"
        return 0
    fi
    local blocker=0
    _fs_blocker "$mnt" "$fstype" "$opts" "  " "so nothing can be written to it" || blocker=$?
    case "$blocker" in
        1) warn "  if that fails, the drive may have a physical write-lock switch, or a damaged filesystem"
           return 0 ;;
        2) return 0 ;;
    esac
    warn "  the files under $mnt belong to another user, and borg needs the repo directory itself writable"
    if [[ -n "$label" ]]; then
        warn "  take it:  $CMD claim $label"
    else
        warn "  take it:  $CMD claim <drive>   (or: sudo chown -R \"\$(id -un):\$(id -gn)\" $mnt)"
    fi
    return 0
}

# The first path under a borg repo that cannot be written, printed on stdout, or
# nothing when every one of them can. The top directory is only where borg puts
# its lock file: the archive goes into data/, and config and nonce are rewritten
# on every run, so a repo whose directory is yours and whose contents are not
# passes a top-directory test and then fails several steps into borg with a
# Python traceback. That is what a partly-claimed drive leaves behind. Only paths
# that already exist are tested, so a directory that is not a borg repo at all is
# not accused of a permission problem. Returns 0 either way; read the output.
_first_unwritable() {
    local repo="$1" p
    [[ -w "$repo" ]] || { printf '%s\n' "$repo"; return 0; }
    for p in data config nonce; do
        if [[ -e "$repo/$p" && ! -w "$repo/$p" ]]; then
            printf '%s\n' "$repo/$p"
            return 0
        fi
    done
    return 0
}

# The read mirror of _first_unwritable, same contract and same reason. One extra
# point: --bypass-lock cannot rescue an unreadable repo, since the lock is not
# the obstacle there, which is why _set_read_lock distinguishes the two.
_first_unreadable() {
    local repo="$1" p
    [[ -r "$repo" && -x "$repo" ]] || { printf '%s\n' "$repo"; return 0; }
    for p in config data; do
        [[ -e "$repo/$p" ]] || continue
        if [[ ! -r "$repo/$p" ]] || { [[ -d "$repo/$p" ]] && [[ ! -x "$repo/$p" ]]; }; then
            printf '%s\n' "$repo/$p"
            return 0
        fi
    done
    return 0
}

# Decide the lock mode for a read of repo dir $1: bypass borg's lock when the
# directory is not writable, warning once per directory so a scan across several
# drives does not repeat itself. Read-only callers only (list, extract, check);
# a write path must hold the lock, never this.
_set_read_lock() {
    local repo="$1" label="${2:-}"
    if [[ -w "$repo" ]]; then
        RO_LOCKOPT=()
        return 0
    fi
    RO_LOCKOPT=(--bypass-lock)
    [[ -z "${_RO_WARNED[$repo]:-}" ]] || return 0
    _RO_WARNED["$repo"]=1
    # Say which of the two it is. Bypassing the lock reads an unwritable repo
    # fine; it does nothing for one that cannot be read, and claiming otherwise
    # promises a workaround that borg then fails on a few steps later.
    local blocked; blocked=$(_first_unreadable "$repo")
    if [[ -n "$blocked" ]]; then
        warn "$blocked cannot be read, and no lock option changes that"
    else
        warn "$repo is not writable; reading with borg's lock bypassed (assumes nothing else is writing it)"
    fi
    _unwritable_hint "$repo" "$label"
}

# Offer to take ownership of a drive when there is a terminal, and print the
# remedy when there is not. Returns 0 only when a claim actually ran and
# succeeded, so the caller can re-test rather than assume.
_offer_claim() {
    local drive="$1" dir="$2"
    if [[ -t 0 ]] && _claim_drive "$drive"; then return 0; fi
    _unwritable_hint "$dir" "$drive"
    return 1
}

# Refuse an all-or-nothing operation unless every listed directory is writable,
# offering to claim the drives that are not. $1 names the operation; the rest are
# "<drive>TAB<dir>" pairs. Dies rather than proceeding on a subset: a rename or a
# rotation that lands on some drives and not others leaves the config and the
# repos out of step, which then has to be repaired by hand.
_require_writable() {
    local op="$1"; shift
    local pair drive dir
    local -a blocked=() still=()
    for pair in "$@"; do
        dir="${pair#*$'\t'}"
        [[ -z "$(_first_unwritable "$dir")" ]] || blocked+=("$pair")
    done
    (( ${#blocked[@]} > 0 )) || return 0
    warn "$op needs these to be writable, and they are not:"
    for pair in "${blocked[@]}"; do warn "  ${pair#*$'\t'}"; done
    for pair in "${blocked[@]}"; do
        drive="${pair%%$'\t'*}"; dir="${pair#*$'\t'}"
        _offer_claim "$drive" "$dir" || true
        [[ -z "$(_first_unwritable "$dir")" ]] || still+=("$drive")
    done
    (( ${#still[@]} == 0 )) \
        || die "$op refused: still not writable on ${still[*]}; nothing was changed"
    return 0
}

## ─── config: validators and path resolution ──────────────────────────
_validate_segment() {
    local kind="$1" value="$2"
    case "$value" in
        ''|.|..)           die "config: invalid $kind '$value'" ;;
        -*)                die "config: $kind may not start with '-': '$value'" ;;
        *[!A-Za-z0-9._-]*) die "config: $kind has an unsafe character (allowed: letters, digits, . _ -): '$value'" ;;
    esac
    return 0
}

# Repo names share the command line with subcommands, so a repo named like one
# would be unreachable: `<cmd> <name>` would dispatch to the subcommand instead
# of archiving the repo. Reserve the visible dispatch words, the help flags, and
# the hidden dispatch words. Drive labels are never dispatched, so this guards
# repo names only, at the three places a repo_name line is born: the config
# directive, `init` creating a repo, and `rename`.
_reject_reserved_name() {
    local name="$1" w
    for w in "${SUBCOMMANDS[@]}" help -h --help _emit-pass _pass-names _selfcheck; do
        [[ "$name" == "$w" ]] \
            && die "repo name '$name' is reserved for the '$name' command; pick another name"
    done
    return 0
}

_require_absolute_path() {
    local kind="$1" path="$2"
    [[ "$path" == /* ]] || die "config: $kind path must be absolute (start with /): '$path'"
}

# One validator for a backup_drives value ('all' or a list of labels), used by
# the config directive and by init's --drives, so a bad drive is rejected the
# same way wherever it is written. $1 prefixes every message with its context.
_validate_drives_list() {
    local what="$1" drives="$2" d seen=""
    if [[ "$drives" == all ]]; then
        [[ "$ALL_DRIVES" =~ [^[:space:]] ]] \
            || die "$what: 'all' needs ALL_DRIVES set in $CONFIG_FILE, but it is empty"
        what="$what: ALL_DRIVES"
        drives="$ALL_DRIVES"
    fi
    # shellcheck disable=SC2086  # space-separated label list; intentional split
    for d in $drives; do
        [[ "$d" != all ]] || die "$what: 'all' is reserved for the ALL_DRIVES pool; a drive may not be named all"
        _validate_segment "drive" "$d"
        case " $seen " in *" $d "*) die "$what lists drive '$d' twice" ;; esac
        seen+="$d "
    done
    return 0
}

# Resolve a config path: a leading ~/ or a bare relative path is taken under
# $HOME, an absolute path passes through, and empty stays empty.
_resolve_home_path() {
    local p="$1" out
    [[ -n "$p" ]] || return 0
    # A shellcheck directive is only honoured in front of a complete command, so
    # it sits above the whole case rather than above the one branch it is for:
    # the '~/' pattern below is a literal, expanded by hand on the right-hand
    # side, not a failed tilde expansion. Do not move it onto the branch. There
    # it is a parse error that stops shellcheck and leaves the rest unchecked.
    # shellcheck disable=SC2088
    case "$p" in
        /*)    out="$p" ;;
        '~')   out="$HOME" ;;
        '~/'*) out="$HOME/${p#'~/'}" ;;
        *)     out="$HOME/$p" ;;
    esac
    # Drop a trailing slash so a folder written with or without one resolves
    # identically; never reduce the root "/" to empty.
    [[ "$out" == / ]] || out="${out%/}"
    printf '%s\n' "$out"
}

## ─── config: directives ──────────────────────────────────────────────
# repo_name opens a block; the directives under it attach to this repo until
# the next repo_name. To remove a repo, comment or delete its whole block.
repo_name() {
    (( $# == 1 )) || die "config: repo_name needs exactly one name; got: $*"
    _validate_segment "repo name" "$1"
    _reject_reserved_name "$1"
    [[ -z "${REPO_SEEN[$1]+x}" ]] || die "config: repo $1 declared more than once"
    REPO_SEEN["$1"]=1
    REPOS+=("$1")
    CURRENT_REPO="$1"
}

# A directive with no open repo means a repo_name was commented out but its
# lines were left behind; fail loudly rather than silently misattach them.
_require_open_repo() {
    [[ -n "$CURRENT_REPO" ]] \
        || die "config: $1 with no repo_name above it (did you comment out a repo_name but leave its lines?)"
}

# Folders to back up for the current repo. Each is stored at the archive root
# under its own basename, so two folders in one repo must not share a basename.
backup_data() {
    _require_open_repo "backup_data"
    (( $# >= 1 )) || die "config: backup_data needs at least one folder path"
    local p abs base
    for p in "$@"; do
        abs=$(_resolve_home_path "$p")
        _require_absolute_path "backup_data folder" "$abs"
        base=$(basename "$abs")
        _validate_segment "backup_data folder name (basename)" "$base"
        case $'\n'"${REPO_SRC[$CURRENT_REPO]:-}" in
            *$'\n'*"/$base"$'\n'*)
                die "config: repo $CURRENT_REPO has two folders named '$base'; they would collide at the archive root" ;;
        esac
        REPO_SRC["$CURRENT_REPO"]+="$abs"$'\n'
    done
}

backup_drives() {
    _require_open_repo "backup_drives"
    (( $# >= 1 )) || die "config: backup_drives needs at least one drive (or 'all')"
    if [[ "$1" == all ]]; then
        (( $# == 1 )) || die "config: backup_drives all takes no other arguments (got: backup_drives $*)"
        _validate_drives_list "config: backup_drives all" all
        REPO_DRIVES["$CURRENT_REPO"]="$ALL_DRIVES"
        return 0
    fi
    _validate_drives_list "config: backup_drives" "$*"
    REPO_DRIVES["$CURRENT_REPO"]="$*"
}

# Retention for the repo. Unset keys inherit: daily=7 weekly=4 monthly=-1
# yearly=-1, rest 0 (-1 keeps a tier forever, 0 none). 'last' nonzero keeps the
# N most recent and ignores the bucket keys.
keep() {
    _require_open_repo "keep"
    (( $# >= 1 )) || die "config: keep needs at least one key=N"
    [[ -z "${SEEN_KEEP[$CURRENT_REPO]+x}" ]] || die "config: keep set more than once for repo $CURRENT_REPO"
    SEEN_KEEP["$CURRENT_REPO"]=1
    local pair key value saw_last=0 saw_bucket=0
    for pair in "$@"; do
        [[ "$pair" == *=* ]] || die "config: keep '$pair' must be key=N"
        key="${pair%%=*}"; value="${pair#*=}"
        [[ "$value" =~ ^(-1|[0-9]+)$ ]] \
            || die "config: keep $key value '$value' must be -1 or a non-negative integer"
        case "$key" in
            last)     KEEP_LAST["$CURRENT_REPO"]="$value";     saw_last=1   ;;
            hourly)   KEEP_HOURLY["$CURRENT_REPO"]="$value";   saw_bucket=1 ;;
            daily)    KEEP_DAILY["$CURRENT_REPO"]="$value";    saw_bucket=1 ;;
            weekly)   KEEP_WEEKLY["$CURRENT_REPO"]="$value";   saw_bucket=1 ;;
            monthly)  KEEP_MONTHLY["$CURRENT_REPO"]="$value";  saw_bucket=1 ;;
            yearly)   KEEP_YEARLY["$CURRENT_REPO"]="$value";   saw_bucket=1 ;;
            *) die "config: keep unknown key '$key' (use last|hourly|daily|weekly|monthly|yearly)" ;;
        esac
    done
    if (( saw_last && saw_bucket && ${KEEP_LAST[$CURRENT_REPO]:-0} != 0 )); then
        warn "config: keep for $CURRENT_REPO: last=${KEEP_LAST[$CURRENT_REPO]} active; bucket keys on this line ignored"
    fi
}

# Denylist for the repo: each pattern becomes a '- sh:' borg pattern (shell-style:
# * stops at /, **/ crosses). Excludes are emitted before any allowlist, so an
# explicit exclude always wins; they compose with both kinds of include_only.
exclude() {
    _require_open_repo "exclude"
    (( $# >= 1 )) || die "config: exclude needs at least one pattern"
    local pat
    for pat in "$@"; do
        [[ -n "$pat" ]] || die "config: exclude empty pattern"
        REPO_EXCLUDES["$CURRENT_REPO"]+="$pat"$'\n'
    done
}

# Repo-wide allowlist: each glob becomes a '+ sh:' include and a global '- sh:**'
# drops the rest. Excludes are emitted before any allowlist, so an explicit
# exclude always wins. Mutually exclusive with include_only_in over one repo
# (checked in _require_repos_valid); both compose with exclude.
#
# The two guards below detect a scoped allowlist written with this directive.
# Neither of them picks a scope, since the directive's name does that; they exist
# because getting the scope wrong silently shortens a backup and is found only at
# restore. So a first token that names one of this repo's folders, or that holds
# no wildcard and therefore cannot be a glob, is refused rather than taken as a
# repo-wide pattern.
include_only() {
    _require_open_repo "include_only"
    (( $# >= 1 )) || die "config: include_only needs at least one glob"
    local first; first=$(_resolve_home_path "$1")
    case $'\n'"${REPO_SRC[$CURRENT_REPO]:-}" in
        *$'\n'"$first"$'\n'*)
            die "config: include_only is repo-wide; to scope an allowlist to one folder write: include_only_in $1 <glob>..." ;;
    esac
    [[ "$1" == *'*'* || "$1" == *'?'* || "$1" == *'['* ]] \
        || die "config: include_only '$1' contains no wildcard, so it is not a glob; for one folder's allowlist write: include_only_in $1 <glob>..."
    local g
    for g in "$@"; do
        [[ -n "$g" ]] || die "config: include_only empty glob"
        REPO_INCLUDES["$CURRENT_REPO"]+="$g"$'\n'
    done
}

# Allowlist scoped to one backup_data folder: its globs are anchored to the
# folder's own name and a '- sh:<base>/**' drops only that folder's rest, leaving
# the repo's other folders whole. One line per folder; mutually exclusive with
# the repo-wide include_only over the same repo.
include_only_in() {
    _require_open_repo "include_only_in"
    (( $# >= 2 )) || die "config: include_only_in needs a backup_data folder and at least one glob"
    local folder="$1"; shift
    local first; first=$(_resolve_home_path "$folder")
    case $'\n'"${REPO_SRC[$CURRENT_REPO]:-}" in
        *$'\n'"$first"$'\n'*) ;;
        *) die "config: include_only_in folder '$folder' is not a backup_data folder of repo $CURRENT_REPO (list it in backup_data above this line)" ;;
    esac
    local key="$CURRENT_REPO"$'\n'"$first"
    [[ -z "${REPO_FINCLUDE_GLOBS[$key]+x}" ]] || die "config: two include_only_in lines for folder '$folder' in repo $CURRENT_REPO"
    REPO_HAS_FINCLUDE["$CURRENT_REPO"]=1
    local g globs=""
    for g in "$@"; do
        [[ -n "$g" ]] || die "config: include_only_in empty glob for '$folder'"
        globs+="$g"$'\n'
    done
    REPO_FINCLUDE_GLOBS["$key"]="$globs"
}

# Where one folder lands on a restore that is not in place. The path names the
# parent the folder arrives in, not the folder itself, so it reads the same way
# -i does: a folder at ~/Documents/g1 given a parent of /mnt/spare arrives at
# /mnt/spare/g1. Folders with no line fall back to the run's restore directory;
# a line present but wrong dies here, at config load, rather than at restore time
# when you are least able to deal with it.
restore_to() {
    _require_open_repo "restore_to"
    (( $# == 2 )) || die "config: restore_to needs a backup_data folder and one absolute parent path"
    local folder="$1" target="$2"
    local first; first=$(_resolve_home_path "$folder")
    case $'\n'"${REPO_SRC[$CURRENT_REPO]:-}" in
        *$'\n'"$first"$'\n'*) ;;
        *) die "config: restore_to folder '$folder' is not a backup_data folder of repo $CURRENT_REPO (list it in backup_data above this line)" ;;
    esac
    local key="$CURRENT_REPO"$'\n'"$first"
    [[ -z "${REPO_RESTORE_TO[$key]+x}" ]] || die "config: two restore_to lines for folder '$folder' in repo $CURRENT_REPO"
    [[ -n "$target" ]] || die "config: restore_to for '$folder' has an empty path"
    local abs; abs=$(_resolve_home_path "$target")
    _require_absolute_path "restore_to path for '$folder'" "$abs"
    # Restoring a folder on top of itself is what -i is for, and doing it from
    # this directive would overwrite live data on a command that promises not to.
    [[ "$abs" != "$(dirname "$first")" ]] \
        || die "config: restore_to for '$folder' names its own parent, which would overwrite the live folder; use '$CMD extract $CURRENT_REPO -i' for that"
    REPO_RESTORE_TO["$key"]="$abs"
}

# archive no excludes the repo from the archive run and drops its passphrase
# need; init, check, extract, claim and pass-change ignore it. Absent means yes.
archive() {
    _require_open_repo "archive"
    (( $# == 1 )) || die "config: archive needs one value: yes or no"
    [[ -z "${REPO_ARCHIVE[$CURRENT_REPO]+x}" ]] || die "config: archive set more than once for repo $CURRENT_REPO"
    case "$1" in
        yes) REPO_ARCHIVE["$CURRENT_REPO"]=1 ;;
        no)  REPO_ARCHIVE["$CURRENT_REPO"]=0 ;;
        *)   die "config: archive must be 'yes' or 'no', got '$1'" ;;
    esac
}

# Passed to borg create untouched; borg validates the spec. Omit for lz4 default.
compression() {
    _require_open_repo "compression"
    (( $# == 1 )) || die "config: compression needs one spec, e.g. auto,zstd,10"
    [[ -z "${REPO_COMPRESSION[$CURRENT_REPO]+x}" ]] || die "config: compression set more than once for repo $CURRENT_REPO"
    [[ -n "$1" ]] || die "config: compression empty spec"
    REPO_COMPRESSION["$CURRENT_REPO"]="$1"
}

# True unless the repo was turned off with `archive no`.
_repo_archives() { [[ "${REPO_ARCHIVE[$1]:-1}" != 0 ]]; }

# Lives in the passphrase file, keyed by repo name.
set_pass() {
    (( $# == 2 )) || die "pass: set_pass needs: <repo> '<passphrase>'; got $# args"
    [[ -z "${PASS[$1]+x}" ]] || die "pass: passphrase for $1 set more than once in $PASSPHRASE_PATH"
    PASS["$1"]="$2"
}

# A file holding secrets, or sourced as shell, must be owner-only. A loose mode
# is tightened here rather than refused: chmod only ever narrows, so there is
# nothing destructive to gate. Two cases are refused instead, both for security:
# chmod follows symlinks, so a symlink here would tighten whatever it points at,
# and a file owned by someone else is not one to quietly adjust or trust. The
# chmod does not undo an exposure that already happened, so when the old mode
# granted read to group or other, say so: rotate what was in it.
require_private() {
    local f="$1" mode
    [[ -e "$f" ]] || die "$f not found; create it (chmod 600) before running"
    [[ -r "$f" ]] || die "$f exists but is not readable"
    mode=$(stat -c '%a' "$f") || die "cannot stat $f"
    if (( (8#$mode & 8#77) == 0 )); then return 0; fi
    [[ ! -L "$f" ]] \
        || die "$f is reachable by group or other (mode $mode) and is a symlink; this will not chmod through it, so fix the file it points at"
    [[ "$(stat -c '%u' "$f")" == "$(id -u)" ]] \
        || die "$f is reachable by group or other (mode $mode) and is not owned by you; its owner must run: chmod 600 $f"
    chmod 600 "$f" || die "$f is reachable by group or other (mode $mode) and chmod 600 failed; fix it by hand"
    warn "$f was mode $mode, reachable by group or other; tightened it to 600"
    if (( (8#$mode & 8#44) != 0 )); then
        warn "it was readable by them until now, so treat anything in it as already read; for the passphrase file that means rotating: $CMD pass-change <repo>"
    fi
    return 0
}

# Source the config with universal validation. Subcommands add their own.
parse_config() {
    local cfg="$CONFIG_FILE"
    # An absent config is fine: the baked defaults stand, and a repo named on the
    # command line can still be adopted from a mounted drive by _adopt_drive_repo.
    # When present, an unrecognised directive (a sibling tool's sync_*
    # line, a stale passphrase_file line) is tolerated rather than fatal, but
    # never silent: a mistyped backup_data would otherwise drop a folder from
    # the backup with no output at all, found only at restore time.
    if [[ -e "$cfg" ]]; then
        require_private "$cfg"
        # shellcheck disable=SC2317  # bash calls this indirectly while sourcing the config; not dead code
        command_not_found_handle() { warn "config: ignoring unknown directive '$1'"; return 0; }
        # shellcheck source=/dev/null
        source "$cfg" || die "failed to load $cfg (check it for a shell syntax error, e.g. an unbalanced quote)"
        unset -f command_not_found_handle
        # set_pass belongs in the passphrase file. A set_pass line here would land
        # in PASS (which nothing reads on a routine run) while the repo is then
        # skipped as "no passphrase set"; catch the misplaced line loudly.
        (( ${#PASS[@]} == 0 )) || die "config: set_pass belongs in the passphrase file, not $CONFIG_FILE; move the line there"
    fi

    MOUNT_BASE=$(_resolve_home_path "$MOUNT_BASE")
    [[ -n "$MOUNT_BASE" ]] || die "MOUNT_BASE is empty; set it in $CONFIG_FILE or keep the baked default"
    [[ -d "$MOUNT_BASE" ]] || die "MOUNT_BASE '$MOUNT_BASE' is not a directory"
    [[ -z "$REPO_SUBDIR" ]] || _validate_segment "REPO_SUBDIR" "$REPO_SUBDIR"
    RESTORE_PATH=$(_resolve_home_path "$RESTORE_PATH")
    # SRC_HOME is a literal foreign-home prefix for in-place remap, deliberately
    # not run through _resolve_home_path (that resolves against the running
    # user's $HOME, which would defeat its purpose).
    if [[ -n "$SRC_HOME" ]]; then
        _require_absolute_path "SRC_HOME" "$SRC_HOME"
        SRC_HOME="${SRC_HOME%/}"
    fi
    PASSPHRASE_PATH=$(_resolve_home_path "$PASSPHRASE_PATH")
    # The file's name carries no meaning: _pass_source_kind reads the format out
    # of the file itself. The one real constraint is that a set path be
    # space-free, because borg splits BORG_PASSCOMMAND itself.
    case "$PASSPHRASE_PATH" in
        '') ;;
        *[[:space:]]*) die "PASSPHRASE_PATH must be space-free for the passcommand (got: '$PASSPHRASE_PATH')" ;;
    esac
    # A path set to a file that is not there reads as 'none' everywhere
    # downstream, which is the same state as PASSPHRASE_PATH="" and produces the
    # same silent outcome. Those are very different intentions, so name the gap.
    if [[ -n "$PASSPHRASE_PATH" && ! -e "$PASSPHRASE_PATH" ]]; then
        warn "PASSPHRASE_PATH names $PASSPHRASE_PATH, but no file is there; every repo will be treated as having no stored passphrase"
    fi
}

# A repo with no backup_data is allowed (it archives nothing yet, reported as
# awaiting data); backup_drives and the filtering rules are required.
_require_repos_valid() {
    (( ${#REPOS[@]} > 0 )) || die "no repos configured; add repo_name blocks to $CONFIG_FILE"
    local r
    for r in "${REPOS[@]}"; do
        [[ -n "${REPO_DRIVES[$r]:-}" ]] || die "config: repo $r has no backup_drives line"
        # Two allowlist scopes over one repo are ambiguous; excludes compose with
        # either, so they are not part of this test.
        if [[ -n "${REPO_INCLUDES[$r]:-}" && -n "${REPO_HAS_FINCLUDE[$r]:-}" ]]; then
            die "config: repo $r has both include_only and include_only_in; use one repo-wide allowlist, or scope every allowlist to a folder"
        fi
    done
}

## ─── repo paths and drive membership ─────────────────────────────────
_repo_declared() { [[ -n "${REPO_SEEN[$1]+x}" ]]; }

# The repo directory on a given drive, and the directory holding it.
_repo_path()   { printf '%s\n' "$MOUNT_BASE/$1${REPO_SUBDIR:+/$REPO_SUBDIR}/$2"; }
_repo_parent() { printf '%s\n' "$MOUNT_BASE/$1${REPO_SUBDIR:+/$REPO_SUBDIR}"; }

# What init must be able to write to create a repo on a drive: the REPO_SUBDIR
# when it is already there, otherwise the mountpoint init would create it under.
_init_target_dir() {
    local p; p=$(_repo_parent "$1")
    if [[ -d "$p" ]]; then printf '%s\n' "$p"; else printf '%s\n' "$MOUNT_BASE/$1"; fi
}

# True when a drive label is one of a repo's configured drives. extract, list,
# check and claim all take a drive, and a typo in it should say so rather than
# fall through to "no mounted drive had it", which points at the wrong problem.
_repo_has_drive() {
    local repo="$1" want="$2" d
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for d in ${REPO_DRIVES[$repo]}; do
        [[ "$d" == "$want" ]] && return 0
    done
    return 1
}

# A repo's configured drives, comma-joined, for those error messages.
_repo_drives_csv() {
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    _csv ${REPO_DRIVES[$1]}
}

# One wording for a name the config does not declare, and one for a drive the
# named repo does not use, so every command that takes them says the same thing.
_require_declared_repo() {
    _repo_declared "$1" || die "$1 is not a configured repo (check $CONFIG_FILE)"
}
_require_repo_drive() {
    _repo_has_drive "$1" "$2" \
        || die "$2 is not a configured drive for $1 (it has: $(_repo_drives_csv "$1"))"
}

# Last resort for a bare repo name no config declares. MOUNT_BASE, REPO_SUBDIR
# and ALL_DRIVES are all baked, so a repo directory is fully derivable from the
# name alone: look for one on each mounted drive and, when any turn up, declare
# the repo exactly as a config block would. Nothing is written and no config is
# touched; an in-place restore still refuses, correctly, because there are no
# backup_data lines saying where the folders came from. Returns 1 when nothing
# is found, leaving the caller's existing errors in place.
_adopt_drive_repo() {
    local name="$1" d found=()
    # Cheap shape test rather than _validate_segment, which dies: a name that
    # cannot be a path segment should fall through to the caller's message, not
    # abort with a config-parse error for a word that came from the command line.
    case "$name" in
        ''|.|..|-*|*[!A-Za-z0-9._-]*) return 1 ;;
    esac
    [[ "$ALL_DRIVES" =~ [^[:space:]] ]] || return 1
    # shellcheck disable=SC2086  # space-separated label list; intentional split
    for d in $ALL_DRIVES; do
        mountpoint -q "$MOUNT_BASE/$d" || continue
        [[ -d "$(_repo_path "$d" "$name")" ]] || continue
        found+=("$d")
    done
    (( ${#found[@]} > 0 )) || return 1
    repo_name "$name"
    backup_drives "${found[@]}"
    say "'$name' is not in $CONFIG_FILE; using the repo directory found on: $(_csv "${found[@]}")"
    return 0
}

## ─── passphrase file: read, write, load ──────────────────────────────
# Backend read from the file's content, not its name, so the file may be called
# anything. The test is for what actually distinguishes the two: a plaintext file
# carries set_pass lines in the clear and ciphertext does not. Neither the suffix
# nor the first byte decides it, and a UTF-8 BOM is allowed for explicitly or a
# one-repo file whose only set_pass line is line 1 would read as ciphertext. A
# file merely missing its set_pass lines, or empty, stays plaintext so the caller
# reports that rather than a decrypt failure for a file that was never encrypted.
_pass_source_kind() {
    [[ -n "$PASSPHRASE_PATH" && -e "$PASSPHRASE_PATH" ]] || { printf 'none\n'; return; }
    local bom=$'\xef\xbb\xbf'
    if LC_ALL=C grep -qaE "^(${bom})?[[:space:]]*set_pass[[:space:]]" -- "$PASSPHRASE_PATH"; then
        printf 'plain\n'; return
    fi
    if LC_ALL=C grep -qa '^-----BEGIN PGP MESSAGE-----' -- "$PASSPHRASE_PATH" \
       || LC_ALL=C grep -qa '[^[:print:][:space:]]' -- "$PASSPHRASE_PATH"; then
        printf 'gpg\n'
    else
        printf 'plain\n'
    fi
}

# Emit the passphrase file's cleartext on stdout. For .gpg this decrypts
# through a pipe, so cleartext never lands on disk.
_pass_cleartext() {
    case "$(_pass_source_kind)" in
        plain) require_private "$PASSPHRASE_PATH"; cat -- "$PASSPHRASE_PATH" ;;
        gpg)   need gpg; require_private "$PASSPHRASE_PATH"; gpg --quiet --decrypt "$PASSPHRASE_PATH" || die "could not decrypt $PASSPHRASE_PATH" ;;
        none)  die "no passphrase file at $PASSPHRASE_PATH to read" ;;
    esac
}

# Replace the passphrase file atomically (same-dir tempfile). For .gpg, re-encrypt
# to the file's existing recipients and verify the result decrypts before the
# swap, so a bad re-encrypt cannot replace a good file; cleartext is piped, never
# on disk. The EXIT trap covers a die from anywhere below, which would otherwise
# leave the tempfile behind; no caller of this holds an EXIT trap of its own.
_pass_write() {
    local tmp
    tmp=$(mktemp "${PASSPHRASE_PATH}.XXXXXX") || die "could not create tempfile for $PASSPHRASE_PATH"
    trap 'rm -f "$tmp"' EXIT
    trap 'rm -f "$tmp"; exit 130' INT TERM
    case "$(_pass_source_kind)" in
        plain)
            cat > "$tmp" || die "could not write $tmp"
            ;;
        gpg)
            need gpg
            local kids=() kid
            while IFS= read -r kid; do
                [[ -n "$kid" ]] && kids+=( -r "$kid" )
            done < <(gpg --list-packets "$PASSPHRASE_PATH" 2>/dev/null \
                       | sed -n 's/.*keyid \([0-9A-Fa-f]\{8,\}\).*/\1/p')
            (( ${#kids[@]} > 0 )) \
                || die "cannot read the GPG recipients of $PASSPHRASE_PATH to re-encrypt it; re-encrypt the file to your key by hand"
            gpg --quiet --yes --encrypt "${kids[@]}" --output "$tmp" \
                || die "re-encryption of $PASSPHRASE_PATH failed"
            gpg --quiet --decrypt "$tmp" >/dev/null 2>&1 \
                || die "re-encrypted $PASSPHRASE_PATH failed to decrypt; original kept"
            ;;
        none)
            die "no passphrase file at $PASSPHRASE_PATH to update; create it first"
            ;;
    esac
    # chmod after the write: gpg --output can recreate the file under the umask,
    # so set owner-only just before the swap, not before the encrypt.
    chmod 600 "$tmp" || die "could not make $PASSPHRASE_PATH owner-only"
    mv "$tmp" "$PASSPHRASE_PATH" || die "could not write $PASSPHRASE_PATH"
    trap - EXIT INT TERM
}

# The combined passphrase file is never sourced into this long-running process
# on a routine run. borg gets a BORG_PASSCOMMAND that re-invokes the hidden
# _emit-pass child to print one repo's passphrase, and a separate _pass-names
# child reports which repos have an entry, so this process learns the names
# without ever holding a value. The writers below still read the file at write
# time; those are the deliberate cleartext moments.

# Print a BORG_PASSCOMMAND for repo $1, or nothing (borg prompts) when that repo
# has no stored entry. borg runs it with no shell and no guaranteed PATH, so this
# invokes a fixed bash on the script by absolute path, and all three tokens must
# be free of whitespace and quotes because borg splits the string itself.
_repo_passcommand() {
    local repo="$1"
    _repo_has_pass "$repo" || return 0
    case "$BASH$SELF$PASSPHRASE_PATH" in
        *[[:space:]\'\"\\]*) die "passcommand needs paths free of whitespace, quotes, and backslashes (borg splits BORG_PASSCOMMAND with shlex), but one of BASH='$BASH', SELF='$SELF', PASSPHRASE_PATH='$PASSPHRASE_PATH' contains one" ;;
    esac
    printf '%s %s _emit-pass %s %s\n' "$BASH" "$SELF" "$PASSPHRASE_PATH" "$repo"
}

# Hidden value child: decrypt the file, evaluate its set_pass lines, print the
# one repo's passphrase; exit non-zero (borg fails loudly) if absent. The only
# place a passphrase is materialised on a routine run, in a short-lived process
# handing it straight to borg; tracing is refused in main.
_emit_pass() {
    (( $# == 2 )) || { printf '_emit-pass needs <file> <repo>\n' >&2; exit 2; }
    local file="$1" repo="$2" ct
    PASSPHRASE_PATH="$file"
    [[ "$(_pass_source_kind)" != none ]] || { printf 'no passphrase file at %s\n' "$file" >&2; exit 1; }
    ct=$(_pass_cleartext) || exit 1
    eval "$ct"; unset ct
    [[ -n "${PASS[$repo]:-}" ]] || { printf 'no passphrase for %s in %s\n' "$repo" "$file" >&2; exit 1; }
    printf '%s' "${PASS[$repo]}"
}

# Hidden names child: decrypt the file and print the repo names that have a
# set_pass entry, one per line. Names only; values stay in _emit-pass.
_pass_names() {
    (( $# == 1 )) || { printf '_pass-names needs <file>\n' >&2; exit 2; }
    local file="$1" ct k
    PASSPHRASE_PATH="$file"
    [[ "$(_pass_source_kind)" != none ]] || exit 0
    ct=$(_pass_cleartext) || exit 1
    eval "$ct"; unset ct
    for k in "${!PASS[@]}"; do printf '%s\n' "$k"; done
}

# Populate PASS_NAMES once via the names child, so this process learns which
# repos have a passphrase without holding a value. Tolerant: an absent or
# undecryptable file leaves PASS_NAMES empty and sets _PASS_NAMES_UNREADABLE.
# Call this from the parent before anything reaches _repo_passcommand: that runs
# inside a command substitution, and a first load from there would set these
# globals in a subshell that is then discarded, so the file would be re-read once
# per repo per drive and the unreadable flag would never reach the parent.
_load_pass_names() {
    (( _PASS_NAMES_LOADED )) && return 0
    _PASS_NAMES_LOADED=1
    [[ "$(_pass_source_kind)" != none ]] || return 0
    local out rc=0
    out=$("$BASH" "$SELF" _pass-names "$PASSPHRASE_PATH") || rc=$?
    if (( rc != 0 )); then
        _PASS_NAMES_UNREADABLE=1
        warn "could not read passphrases from $PASSPHRASE_PATH (for a .gpg: can gpg decrypt it now, i.e. is gpg-agent primed and the key present? otherwise: does the file contain 'set_pass <repo> ...' lines?)"
        return 0
    fi
    local n
    while IFS= read -r n; do
        [[ -n "$n" ]] && PASS_NAMES["$n"]=1
    done <<< "$out"
    # The child ran and printed nothing: the file parsed but defined no repo.
    # That is what a line written as an assignment produces; only
    # `set_pass <repo> <pass>`, a directive with two arguments, reaches this tool.
    if (( ${#PASS_NAMES[@]} == 0 )); then
        _PASS_NAMES_UNREADABLE=1
        warn "$PASSPHRASE_PATH defines no repo passphrase; every line must read: set_pass <repo> '<passphrase>' (single quotes: the file is read by bash, so a \$ or a backtick in a double-quoted passphrase is expanded and the passphrase is silently altered)"
    fi
    # Explicit, and load-bearing. The loop above ends in a conditional, so an $out
    # with no usable line would otherwise make this function return 1, which
    # aborts every bare caller under set -e with nothing printed. Do not drop it.
    return 0
}

# True when repo $1 has a stored passphrase (names only; no value read).
_repo_has_pass() { _load_pass_names; [[ -n "${PASS_NAMES[$1]:-}" ]]; }

# Require a stored passphrase for each named repo (presence by name only).
_require_pass() {
    local r missing=()
    for r in "$@"; do _repo_has_pass "$r" || missing+=("$r"); done
    (( ${#missing[@]} == 0 )) \
        || die "no passphrase set for ${missing[*]} (add set_pass lines to $PASSPHRASE_PATH)"
}

# One wording for every "borg does the asking" notice. $1 is why nothing is
# stored, $2 what the prompts are for, and $3 is 'twice' when the operation lists
# before it extracts, so the second prompt is expected rather than a retry.
# Always stderr: it is an advisory about how the run will behave, not a result.
_prompt_notice() {
    local why="$1" what="$2" how="${3:-once}"
    local when="once"
    [[ "$how" != twice ]] || when="twice: once to list, once to extract"
    warn "$why; borg will ask for $what, $when"
}

# True when no passphrase file is configured and there is a terminal, i.e. the
# documented "borg asks" fallback is live for this run. Every command honours it
# the same way, by emitting no BORG_PASSCOMMAND. Tty-gated so an unattended run
# fails closed rather than stalling on a prompt nobody can answer. The prompt is
# per borg invocation, not per repo, so a multi-repo pool is a lot of typing;
# that is the price of keeping the passphrase off disk and out of this process.
_pass_prompt_mode() { [[ -z "$PASSPHRASE_PATH" && -t 0 ]]; }

# Archive preflight for the repos passed in: load the names, then mark those that
# are archived and hold folders but have no stored passphrase as skipped (warned).
# In prompt mode nothing is skipped and no names are loaded; borg does the asking.
# The permission check happens in the parent, before the names child reads the
# file, so a mode notice lands on the run's own output rather than in a process
# whose stdout is being captured.
_archive_pass_preflight() {
    if _pass_prompt_mode; then
        _prompt_notice "no passphrase file configured" "each repo on each drive"
        return 0
    fi
    [[ "$(_pass_source_kind)" == none ]] || require_private "$PASSPHRASE_PATH"
    _load_pass_names
    (( _PASS_NAMES_UNREADABLE )) && die "refusing to archive: $PASSPHRASE_PATH is present but unreadable, so every repo would be silently skipped; fix the cause in the warning above and re-run"
    local label missing=()
    for label in "$@"; do
        _repo_archives "$label" || continue            # archive no
        [[ -n "${REPO_SRC[$label]:-}" ]] || continue   # no folders yet (awaiting data)
        _repo_has_pass "$label" || missing+=("$label")
    done
    if (( ${#missing[@]} > 0 )); then
        if [[ -z "$PASSPHRASE_PATH" ]]; then
            warn "no passphrase file configured and no terminal to prompt; skipped this run: ${missing[*]}"
        else
            warn "no passphrase set for ${missing[*]}; skipped this run (add set_pass lines to $PASSPHRASE_PATH)"
        fi
        PASS_SKIPPED=("${missing[@]}")
    fi
}

# Replace the set_pass value for $1 with $2 in the passphrase file. Matching on
# the line rather than splitting it keeps the old value out of any temp file, and
# printf -v keeps the new one out of a command substitution.
_update_pass_value() {
    local label="$1" new_pass="$2" quoted
    printf -v quoted '%q' "$new_pass"
    local ct; ct=$(_pass_cleartext) || die "could not read $PASSPHRASE_PATH; file left untouched"
    local found=0 line out=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*set_pass[[:space:]]+([^[:space:]]+)[[:space:]] ]] \
            && [[ "${BASH_REMATCH[1]}" == "$label" ]]; then
            out+="set_pass ${label} ${quoted}"$'\n'
            found=1
        else
            out+="$line"$'\n'
        fi
    done <<< "$ct"
    (( found )) \
        || die "no set_pass line for $label in $PASSPHRASE_PATH; rotation finished on drives but the file was not updated"
    printf '%s' "$out" | _pass_write
}

# Rewrite the label on the set_pass line, preserving the value and its spacing.
_update_pass_label() {
    local old="$1" new="$2"
    local ct; ct=$(_pass_cleartext) || die "could not read $PASSPHRASE_PATH; file left untouched"
    local found=0 line out=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^([[:space:]]*set_pass[[:space:]]+)([^[:space:]]+)([[:space:]]+.+)$ ]] \
            && [[ "${BASH_REMATCH[2]}" == "$old" ]]; then
            out+="${BASH_REMATCH[1]}${new}${BASH_REMATCH[3]}"$'\n'
            found=1
        else
            out+="$line"$'\n'
        fi
    done <<< "$ct"
    (( found )) \
        || { warn "no set_pass line for $old in $PASSPHRASE_PATH; nothing to relabel there"; return 0; }
    printf '%s' "$out" | _pass_write
}

## ─── config mutation: append a repo block, rename a repo ─────────────
# init appends a repo block; rename rewrites a repo_name line. Both write
# atomically through a same-dir tempfile, preserving the file's mode, and touch
# only their target line, so a sibling tool's lines, comments and blanks are left
# in place. Everything else in the config is edited by hand.

# Write new whole-file content over the config atomically, preserving its mode.
_write_config() {
    local content="$1" tmp
    tmp=$(mktemp "${CONFIG_FILE}.XXXXXX") || die "cannot create a temp file beside $CONFIG_FILE"
    trap 'rm -f "$tmp"' EXIT
    trap 'rm -f "$tmp"; exit 130' INT TERM
    printf '%s' "$content" > "$tmp" || die "failed to write $tmp"
    if [[ -e "$CONFIG_FILE" ]]; then
        chmod --reference="$CONFIG_FILE" "$tmp" || die "failed to set mode on $tmp"
    else
        chmod 600 "$tmp" || die "failed to set mode on $tmp"
    fi
    mv -f "$tmp" "$CONFIG_FILE" || die "failed to update $CONFIG_FILE"
    trap - EXIT INT TERM
}

# Rewrite the repo_name block header in the config, preserving indentation and
# any trailing comment. Dies if the line is not found, so the directories are
# never silently left out of step with the config.
_update_repo_name() {
    local old="$1" new="$2"
    local found=0 line out=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^([[:space:]]*repo_name[[:space:]]+)([^[:space:]#]+)([[:space:]].*)?$ ]] \
            && [[ "${BASH_REMATCH[2]}" == "$old" ]]; then
            out+="${BASH_REMATCH[1]}${new}${BASH_REMATCH[3]:-}"$'\n'
            found=1
        else
            out+="$line"$'\n'
        fi
    done < "$CONFIG_FILE"
    (( found )) \
        || die "no 'repo_name $old' line in $CONFIG_FILE; drives renamed but the config was not updated"
    _write_config "$out"
}

# Append a new repo block: a backup_data line per resolved path, a backup_drives
# line, and the optional directives as commented templates. No archive line is
# templated: a new repo is archive-on by default. Paths are validated like
# backup_data before any write.
_append_repo_block() {
    local repo="$1" drives="$2"; shift 2
    local p abs base seen="" dq
    local -a body=("repo_name $repo")
    for p in "$@"; do
        abs=$(_resolve_home_path "$p")
        _require_absolute_path "backup_data folder" "$abs"
        base=$(basename "$abs")
        _validate_segment "backup_data folder name (basename)" "$base"
        case $'\n'"$seen" in
            *$'\n'"$base"$'\n'*) die "two folders named '$base' would collide at the archive root: $abs" ;;
        esac
        seen+="$base"$'\n'
        printf -v dq 'backup_data %q' "$abs"
        body+=("$dq")
    done
    body+=("backup_drives $drives")
    body+=("# keep daily=30 weekly=12 monthly=-1")
    body+=("# exclude '**/cache/**' '**/node_modules/**'     # denylist (shell-style globs)")
    body+=("# include_only '**/wanted'                          # repo-wide allowlist")
    body+=("# include_only_in \"\$HOME/sub\" '**/wanted'          # allowlist one folder, others whole")
    body+=("# compression auto,zstd,10")
    local existing block content
    existing=$(cat "$CONFIG_FILE")
    printf -v block '%s\n' "${body[@]}"
    # One blank line between the prior content and the new block.
    printf -v content '%s\n\n%s' "$existing" "$block"
    _write_config "$content"
}

# Prompt for repo $1's passphrase twice and store it through the atomic,
# recipient-preserving writer, then record the name so the caller can use it at
# once. Fails closed with no terminal so a non-interactive run never hangs, and
# requires the passphrase file to exist (the first passphrase is hand-created).
_store_pass() {
    local repo="$1"
    [[ "$(_pass_source_kind)" != none ]] \
        || die "no passphrase file at $PASSPHRASE_PATH yet; create it with your first repo's set_pass line, then init adds the rest"
    [[ -t 0 ]] \
        || die "no passphrase stored for $repo and no terminal to prompt; add a 'set_pass $repo' line to $PASSPHRASE_PATH, then re-run"
    local current repo_re
    current=$(_pass_cleartext) || die "could not read $PASSPHRASE_PATH"
    repo_re="${repo//./\\.}"
    if printf '%s\n' "$current" | grep -qE "^[[:space:]]*set_pass[[:space:]]+${repo_re}([[:space:]]|\$)"; then
        return 0                                     # already stored
    fi
    local p1 p2 line
    read -rsp "passphrase for $repo: " p1; printf '\n' >&2
    read -rsp "confirm: " p2;             printf '\n' >&2
    [[ -n "$p1" ]]       || die "empty passphrase; nothing stored"
    [[ "$p1" == "$p2" ]] || die "passphrases did not match; nothing stored"
    printf -v line 'set_pass %s %q' "$repo" "$p1"
    printf '%s\n%s\n' "$current" "$line" | _pass_write
    unset p1 p2
    PASS_NAMES["$repo"]=1
    say "stored a passphrase for $repo in $PASSPHRASE_PATH"
}

## ─── claim: take ownership of one drive's repos ──────────────────────
# The one place this tool uses sudo on a backup path. Deliberately not a chown -R
# of the whole mountpoint: a drive can hold someone else's files, and taking the
# lot would take those too. What borg needs is the mountpoint itself (its lock
# file is created beside the repo), any REPO_SUBDIR, and each repo directory in
# full, so that is exactly what is taken.
#
# Refuses rather than escalating wherever a chown cannot work or cannot be
# trusted: a path that is not the drive's own mountpoint, so a chown can never
# walk the root filesystem when a drive is not mounted where you thought; a
# read-only mount; a filesystem that carries no ownership. Requires a terminal,
# so a cron run can never sit on a sudo password prompt. Returns 1 on any refusal
# so the caller re-tests rather than assumes. It takes the drive and nothing
# else: naming a subset of the repos leaves the partly-claimed drive borg fails
# several steps into.
_claim_drive() {
    local drive="$1"
    local mount="$MOUNT_BASE/$drive"
    command -v findmnt >/dev/null 2>&1 || { warn "findmnt not found; cannot confirm what $mount is before changing ownership"; return 1; }
    command -v sudo    >/dev/null 2>&1 || { warn "sudo not found; take ownership of $mount by hand"; return 1; }
    mountpoint -q "$mount" || { warn "$(_not_mounted "$drive")"; return 1; }

    local fstype="" opts="" mnt=""
    read -r fstype opts mnt < <(findmnt -no FSTYPE,OPTIONS,TARGET -T "$mount" 2>/dev/null) || true
    [[ "$mnt" == "$mount" ]] \
        || { warn "$mount is not itself a mountpoint (it resolves to ${mnt:-an unknown mount}); refusing to change ownership there"; return 1; }
    _fs_blocker "$mount" "$fstype" "$opts" "" "so ownership cannot be changed" || return 1
    [[ -t 0 ]] || { warn "claiming $drive needs sudo and a terminal to confirm on; run it interactively"; return 1; }

    # What to take: the mountpoint, any REPO_SUBDIR, and every repo the config
    # puts on this drive. A repo directory that is not there yet is not chowned.
    local -a shallow=("$mount") deep=() names=()
    [[ -z "$REPO_SUBDIR" ]] || shallow+=("$mount/$REPO_SUBDIR")
    local r dir
    for r in ${REPOS[@]+"${REPOS[@]}"}; do
        _repo_has_drive "$r" "$drive" || continue
        dir=$(_repo_path "$drive" "$r")
        [[ -d "$dir" ]] && { deep+=("$dir"); names+=("$r"); }
    done

    # The paths share one prefix and the mountpoint is printed above them, so the
    # preview names the scope rather than spelling every path out: what is taken
    # shallow, what is taken in full, and by whom. The refusals above have already
    # established that $mount is this drive's own mountpoint.
    local owner; owner="$(id -un):$(id -gn)"
    say "claiming $drive for $owner, as root, under $mount:"
    if [[ -n "$REPO_SUBDIR" ]]; then
        say "  the mountpoint and $REPO_SUBDIR/ themselves, not their other contents"
    else
        say "  the mountpoint itself, not its other contents"
    fi
    if (( ${#names[@]} > 0 )); then
        say "  these repo directories, recursively: $(_csv "${names[@]}")"
    else
        say "  no configured repo of yours is there yet, so nothing else"
    fi
    local ans
    read -rp "take them? [y/N] " ans
    [[ "$ans" == [Yy] || "$ans" == [Yy][Ee][Ss] ]] || { warn "nothing changed"; return 1; }

    sudo chown "$owner" "${shallow[@]}" || { warn "could not take $mount"; return 1; }
    if (( ${#deep[@]} > 0 )); then
        sudo chown -R "$owner" "${deep[@]}" || { warn "could not take the repo directories on $drive"; return 1; }
    fi
    say "claimed $drive"
}

cmd_claim() {
    (( $# == 1 )) || die_usage "usage: $CMD claim <drive>"
    [[ "$1" != -* ]] || die_usage "usage: $CMD claim <drive>"
    need mountpoint
    local drive="$1"
    _validate_segment "drive" "$drive"
    parse_config
    _claim_drive "$drive" || exit 1
}

## ─── init: create the repos ──────────────────────────────────────────
_check_usb() {
    mountpoint -q "$MOUNT_BASE/$1" || { warn "$(_not_mounted "$1")"; return 1; }
}

_init_one() {
    local repo="$1" drive="$2" dir parent
    dir=$(_repo_path "$drive" "$repo")
    if [[ -d "$dir" ]]; then
        say "$dir already exists"
        return 0
    fi
    # Writability before borg, and before anything is created: an unwritable
    # target fails several steps into borg with a Python traceback otherwise.
    parent=$(_init_target_dir "$drive")
    if [[ -n "$(_first_unwritable "$parent")" ]]; then
        warn "$parent is not writable, so $repo cannot be created on $drive"
        _offer_claim "$drive" "$parent" || true
        [[ -z "$(_first_unwritable "$parent")" ]] || return 1
    fi
    if [[ -n "$REPO_SUBDIR" ]]; then
        mkdir -p "$MOUNT_BASE/$drive/$REPO_SUBDIR" \
            || { warn "could not create $MOUNT_BASE/$drive/$REPO_SUBDIR"; return 1; }
    fi
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    if borg init --encryption=repokey "$dir"; then
        say "initialised $dir"
    else
        warn "failed to initialise $dir"
        return 1
    fi
}

cmd_init() {
    ensure_borg; need mountpoint
    # <cmd> init [<repo> [<paths>...] [--drives <labels>...]]. A repo with paths
    # creates a new block; a repo without paths inits an existing repo; no repo
    # inits every configured repo. --drives sets the new block's drives (default
    # 'all'); everything after --drives is a drive label.
    local repo="" sawdrives=0
    local -a paths=() dr=()
    while (( $# )); do
        case "$1" in
            --drives)    sawdrives=1; shift ;;
            --drives=*)  die_usage "use '--drives d1 d2'; '--drives=...' is not supported" ;;
            -*)          die_usage "unknown flag: $1 (usage: $CMD init [<repo> [<paths>...] [--drives <labels>...]])" ;;
            *)
                if   (( sawdrives )); then dr+=("$1")
                elif [[ -z "$repo" ]]; then repo="$1"
                else paths+=("$1"); fi
                shift ;;
        esac
    done

    parse_config
    # Serialize against a concurrent archive/rename: init writes the config block
    # and creates borg repos, so it must not race another config writer.
    _acquire_lock
    local -a todo=()
    # A repo name not yet in the config means create it: with the folders given,
    # or as an awaiting-data repo when none are.
    local creating=0
    [[ -n "$repo" ]] && ! _repo_declared "$repo" && creating=1
    if (( creating )); then
        _validate_segment "repo name" "$repo"
        _reject_reserved_name "$repo"
        local drives="all"
        if (( sawdrives )); then
            (( ${#dr[@]} > 0 )) || die_usage "--drives needs at least one drive label"
            drives="${dr[*]}"
        fi
        _validate_drives_list "--drives" "$drives"
        # Every drive, mounted and writable, before anything is written. A repo
        # created on two of its four drives is a false redundancy belief: the
        # config says four copies exist and two do, and nothing says so again
        # until a restore needs the drive that was never written. pass-change and
        # rename already refuse a partial set for the same reason.
        local -a want=() missing=() pairs=()
        # shellcheck disable=SC2086  # validated space-separated labels; intentional split
        if [[ "$drives" == all ]]; then want=($ALL_DRIVES); else want=($drives); fi
        local d
        for d in "${want[@]}"; do
            mountpoint -q "$MOUNT_BASE/$d" || missing+=("$d")
        done
        (( ${#missing[@]} == 0 )) \
            || die "creating $repo needs every one of its drives mounted, so all copies start together; missing: ${missing[*]} (looked under $MOUNT_BASE)"
        for d in "${want[@]}"; do pairs+=("$d"$'\t'"$(_init_target_dir "$d")"); done
        _require_writable "creating $repo" "${pairs[@]}"
        # The passphrase is prompted after the block is written, so confirm that
        # can succeed before changing anything on disk.
        if [[ "$(_pass_source_kind)" == none ]]; then
            if [[ -z "$PASSPHRASE_PATH" ]]; then
                die "no passphrase file configured yet; create $CONFIG_FILE with a PASSPHRASE_PATH line pointing at a passphrase file (any name, gpg-encrypted or plaintext, chmod 600), put a 'set_pass $repo' line in that file, then re-run init"
            fi
            die "no passphrase file at $PASSPHRASE_PATH yet; create it with your first repo's set_pass line, then init adds the rest"
        fi
        [[ -t 0 ]] || die "creating $repo prompts for its passphrase; no terminal to prompt, so run it interactively"
        if (( ${#paths[@]} == 0 )); then
            # No folders given: a typo'd name would otherwise provision a junk repo
            # on every drive, so confirm the name and drives before writing.
            say "no folders given: this creates '$repo' as an awaiting-data repo on drives: $drives"
            local ans
            read -rp "create $repo? [y/N] " ans
            [[ "$ans" == [Yy] || "$ans" == [Yy][Ee][Ss] ]] || die "aborted; nothing changed"
        fi
        _append_repo_block "$repo" "$drives" "${paths[@]}"
        if (( ${#paths[@]} == 0 )); then
            say "added repo $repo to $CONFIG_FILE (awaiting data; add 'backup_data <path>' lines to its block)"
        else
            say "added repo $repo to $CONFIG_FILE"
        fi
        REPOS+=("$repo"); REPO_SEEN["$repo"]=1
        # The config line keeps 'all'; the in-memory drive list this init uses
        # must be the expanded pool, matching what backup_drives does at parse.
        REPO_DRIVES["$repo"]="${want[*]}"
        todo=("$repo")
    elif (( ${#paths[@]} > 0 )); then
        # Folders given for a name that is already a repo, or with no name at all.
        [[ -n "$repo" ]] || die_usage "creating a repo needs a name: $CMD init <repo> <path>..."
        die "repo $repo is already in $CONFIG_FILE; edit its block by hand, or pick a new name"
    else
        (( ! sawdrives )) || die_usage "--drives only applies when creating a repo"
        _require_repos_valid
        if [[ -n "$repo" ]]; then
            todo=("$repo")
        else
            todo=("${REPOS[@]}")
        fi
    fi

    # A repo's passphrase is born at init: store a missing one (prompted, failing
    # closed with no terminal) rather than refusing to proceed. Presence comes
    # from the names-only child, so no value enters this process here.
    local r
    for r in "${todo[@]}"; do
        _repo_has_pass "$r" || _store_pass "$r"
    done

    local drive available configured rc=0
    for r in "${todo[@]}"; do
        say "initialising repo $r..."
        available=(); configured=0
        # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
        for drive in ${REPO_DRIVES[$r]}; do
            configured=$(( configured + 1 ))
            if _check_usb "$drive"; then available+=("$drive"); fi
        done
        if (( ${#available[@]} == 0 )); then
            warn "no drives available for $r"
            rc=1
            continue
        fi
        for drive in "${available[@]}"; do
            _init_one "$r" "$drive" || rc=1
        done
        # An existing repo may legitimately be completed one drive at a time, but
        # the gap should not be silent: until every drive has a copy, the config
        # promises redundancy the disks do not have.
        if (( ${#available[@]} < configured )); then
            warn "$r is not on all ${configured} of its drives yet; re-run '$CMD init $r' with the missing drive(s) mounted"
            rc=1
        fi
    done
    exit "$rc"
}

## ─── archive: the default action ─────────────────────────────────────
_fmt_duration() {
    local secs="$1" h m s
    h=$(( secs / 3600 )); m=$(( (secs % 3600) / 60 )); s=$(( secs % 60 ))
    if   (( h > 0 )); then printf '%dh%dm%ds' "$h" "$m" "$s"
    elif (( m > 0 )); then printf '%dm%ds' "$m" "$s"
    else                   printf '%ds' "$s"
    fi
}

# Bytes to a short human size via numfmt SI (decimal, powers of 1000), dropping
# a trailing .0 so a round value reads 2MB rather than 2.0MB.
_fmt_size() {
    local s
    s=$(numfmt --to=si --suffix=B --format='%.1f' "$1" 2>/dev/null) || s="${1}B"
    printf '%s' "${s/.0/}"
}

# One summary group as ", <count> <label> (name, name)", or nothing when the
# list is empty, so an unused category drops out of the line cleanly.
_group() {
    local label="$1"; shift
    (( $# > 0 )) || return 0
    printf ', %d %s (%s)' "$#" "$label" "$(_csv "$@")"
}

# Confirm with borg that a repo's allowlist actually bites before writing an
# archive under it. Args: <repo> <pattern opt>... -- <source>... ; BORG_REPO is
# already set by the caller. Returns 0 when the allowlist both keeps something
# and drops something, 1 otherwise, warning with the reason.
#
# borg's matcher is the only authority on what these patterns do, so this asks
# it rather than reasoning about the globs. `create --dry-run` reads no file data
# and does not unlock the repo key, so the cost is one metadata walk of the
# sources and no passphrase use: no agent prompt, no hardware token touch.
# `--list` writes its per-file status to stderr, not stdout, hence the swap
# below. The archive name is never created, so reusing one is harmless.
#
# Two outcomes are refused. Nothing dropped means the allowlist is inert and the
# folder goes to the drive whole, which is a privacy failure that reports as
# success. Nothing kept means an empty archive; catching it here means nothing is
# written and no retention decision hangs on it.
_assert_filter_bites() {
    local repo="$1"; shift
    local -a popts=() srcs=()
    local a seen=0
    for a in "$@"; do
        if   (( seen ));       then srcs+=("$a")
        elif [[ "$a" == -- ]]; then seen=1
        else                        popts+=("$a"); fi
    done
    (( ${#srcs[@]} > 0 )) || return 0
    local out rc=0
    out=$(borg create --dry-run --list ${popts[@]+"${popts[@]}"} "::{now}" "${srcs[@]}" 2>&1 >/dev/null) || rc=$?
    if (( rc != 0 )); then
        # A dry run that cannot even walk the sources says nothing about the
        # patterns. Do not block the backup on it; the post-create checks stand.
        warn "could not dry-run the filter for $repo (borg exited $rc); the allowlist was not verified"
        return 0
    fi
    local kept dropped
    kept=$(printf '%s\n' "$out" | grep -c '^- ') || true
    dropped=$(printf '%s\n' "$out" | grep -c '^x ') || true
    if (( dropped == 0 )); then
        warn "$repo has an allowlist but it dropped nothing, so the folders would be archived whole; the globs are matching no path borg sees"
        warn "borg matches the source path with its leading slash removed, so a folder at /home/you/proj is matched as home/you/proj/...; check the globs with: borg create --list --dry-run"
        return 1
    fi
    if (( kept == 0 )); then
        warn "$repo has an allowlist and it kept nothing, so the archive would be empty; check the globs with: borg create --list --dry-run"
        return 1
    fi
    return 0
}

# Append one repo-wide glob list to the caller's pattern array as '<sign> sh:'
# patterns. One function for both signs because exclude and include_only must
# anchor identically: an edit reaching one loop and not the other would change
# what a backup holds and say nothing. $1 names the caller's array, $2 is '+' or
# '-', $3 the newline-joined globs, the rest the matcher roots.
_add_repo_wide_patterns() {
    local -n _out="$1"
    local sign="$2" globs="$3"; shift 3
    local p mroot
    while IFS= read -r p; do
        [[ -n "$p" ]] || continue
        if [[ "$p" == /* ]]; then
            _out+=( --pattern "$sign sh:${p#/}" )
        else
            for mroot in "$@"; do _out+=( --pattern "$sign sh:$mroot/**/$p" ); done
        fi
    done <<< "$globs"
}

# One repo to one drive. Returns 0 on archived-and-verified, 1 if the archive was
# not created, 2 if it was created but failed its quick verification.
_archive_one_drive() {
    local repo="$1" drive="$2"
    local mount="$MOUNT_BASE/$drive"
    if ! mountpoint -q "$mount"; then
        warn "$(_not_mounted "$drive")"
        _note_issue "$repo on $drive: not mounted at $mount"
        return 1
    fi
    local -x BORG_REPO; BORG_REPO=$(_repo_path "$drive" "$repo")
    if [[ ! -d "$BORG_REPO" ]]; then
        warn "no $repo repo on $drive"
        _note_issue "$repo on $drive: no repo directory at $BORG_REPO"
        return 1
    fi
    # borg's first act on a write is to create a lock file inside the repo dir,
    # so an unwritable repo fails with a Python traceback several steps in. The
    # preflight already refused the run if no drive had a writable repo; this
    # catches the mixed case, where some drives are fine.
    local blocked; blocked=$(_first_unwritable "$BORG_REPO")
    if [[ -n "$blocked" ]]; then
        warn "$repo on $drive is not writable ($blocked)"
        _unwritable_hint "$BORG_REPO" "$drive"
        _note_issue "$repo on $drive: not writable ($blocked)"
        return 1
    fi
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"

    # Each folder is anchored with /./ so it lands at the archive root under
    # its own basename, regardless of where it lives on disk. The same loop
    # records each folder's matcher root, because the two are not the same path
    # and the filtering below needs the second one.
    local -a srcs=() popts=() roots=()
    local p key g mroot
    while IFS= read -r p; do
        [[ -n "$p" ]] || continue
        srcs+=( "$(dirname "$p")/./$(basename "$p")" )
        roots+=( "${p#/}" )
    done <<< "${REPO_SRC[$repo]}"

    # Filtering. borg does the matching; this assembles one ordered list of
    # '+'/'- sh:' patterns (first match wins, unmatched kept). This is the one
    # place the matcher's addressing is written down; everything else points here.
    #
    # THE MATCHER ROOT. borg matches the source path made relative, i.e. the
    # absolute path with its leading slash off: /home/john/proj reaches the
    # matcher as home/john/proj/... . The /./ anchor changes only the name the
    # item is stored under, never what the matcher sees, so a pattern written
    # against the stored name matches nothing. That failure is silent in the
    # dangerous direction: an allowlist whose '-' never fires archives its folder
    # whole and reports success. Every pattern here is anchored on a folder's
    # matcher root, and _assert_filter_bites has borg confirm it before create.
    #
    # ORDER. Every exclude is a plain drop emitted before any '+', so an explicit
    # exclude always beats an allowlist. Then either a repo-wide allowlist ('+'
    # per glob, global '- sh:**' for the rest) or a folder-scoped one ('+' on
    # that folder's matcher root, '- sh:<root>/**' for its rest, other folders
    # left whole). The two scopes are mutually exclusive, checked at parse.
    #
    # DEPTH, deliberately different per directive. exclude and include_only name
    # no folder, so a bare glob means "anywhere in this repo" and is emitted per
    # root behind '**/', which borg matches at zero directories as well as many.
    # include_only_in has named its folder, so its globs stay anchored there;
    # widening them would let 'src/**' keep a vendored src/ levels down. A glob
    # written as an absolute path is already a matcher path once the leading
    # slash is off, so it passes through unprefixed.
    _add_repo_wide_patterns popts '-' "${REPO_EXCLUDES[$repo]:-}" ${roots[@]+"${roots[@]}"}
    if [[ -n "${REPO_INCLUDES[$repo]:-}" ]]; then
        _add_repo_wide_patterns popts '+' "${REPO_INCLUDES[$repo]}" ${roots[@]+"${roots[@]}"}
        popts+=( --pattern '- sh:**' )
    else
        while IFS= read -r p; do
            [[ -n "$p" ]] || continue
            key="$repo"$'\n'"$p"
            [[ -n "${REPO_FINCLUDE_GLOBS[$key]:-}" ]] || continue
            mroot="${p#/}"
            while IFS= read -r g; do
                [[ -n "$g" ]] && popts+=( --pattern "+ sh:$mroot/$g" )
            done <<< "${REPO_FINCLUDE_GLOBS[$key]}"
            popts+=( --pattern "- sh:$mroot/**" )
        done <<< "${REPO_SRC[$repo]}"
    fi

    # Once per repo per run: the answer is a property of the config and the
    # source tree, not of the drive being written.
    if [[ -n "${REPO_INCLUDES[$repo]:-}${REPO_HAS_FINCLUDE[$repo]:-}" ]] \
       && [[ -z "${RUN_REPO_FILTER_CHECKED[$repo]:-}" ]]; then
        RUN_REPO_FILTER_CHECKED["$repo"]=1
        if ! _assert_filter_bites "$repo" ${popts[@]+"${popts[@]}"} -- "${srcs[@]}"; then
            _note_issue "$repo on $drive: allowlist matched nothing, so nothing was archived"
            return 2
        fi
    fi

    # borg's default compression is lz4; a `compression` directive overrides it
    # with the user's spec, passed through for borg to validate and apply.
    [[ -n "${REPO_COMPRESSION[$repo]:-}" ]] && popts+=( --compression "${REPO_COMPRESSION[$repo]}" )

    # borg's rc: 0 clean, 1 warnings (a source file changed or vanished mid-run,
    # common for live dotfiles) with the archive still written, 2+ a real error.
    # Treat warnings as success so a changing profile isn't a failure. Progress
    # goes to stderr, so gate it on stderr being a terminal: interactive runs get
    # feedback, cron logs stay clean.
    local -a progress=()
    [[ -t 2 ]] && progress=( --progress )
    local create_rc=0 create_json
    create_json=$(borg create --json ${progress[@]+"${progress[@]}"} ${popts[@]+"${popts[@]}"} "::{now}" "${srcs[@]}") || create_rc=$?
    if (( create_rc >= 2 )); then
        warn "borg create failed (rc=$create_rc) for $repo on $drive"
        # borg's own error reached stderr above this line, unredirected, so any
        # remedy printed before it has already scrolled away. The preflight
        # cleared this repo minutes ago; re-test, because a drive that remounts
        # read-only mid-run lands here.
        blocked=$(_first_unwritable "$BORG_REPO")
        if [[ -n "$blocked" ]]; then
            warn "$blocked is not writable now, which is very likely the error above"
            _unwritable_hint "$BORG_REPO" "$drive"
        fi
        _note_issue "$repo on $drive: borg create failed (rc=$create_rc)"
        return 1
    fi
    if (( create_rc == 1 )); then
        warn "borg create finished with warnings for $repo on $drive; archive was still created"
    fi

    # borg's own figures: this snapshot's deduplicated size is how much the repo
    # grew, and unique_csize is the repo's on-disk total. Best-effort; a parse
    # miss just drops the size from the line. borg 2.0 renames both fields.
    local added_bytes repo_bytes size_note=""
    added_bytes=$(printf '%s' "$create_json" | sed -n 's/.*"deduplicated_size"[^0-9]*\([0-9]\{1,\}\).*/\1/p')
    repo_bytes=$(printf '%s' "$create_json"  | sed -n 's/.*"unique_csize"[^0-9]*\([0-9]\{1,\}\).*/\1/p')
    if [[ -n "$added_bytes" ]]; then
        # The same logical data goes to every drive, so count each repo's growth
        # once; summing per drive would multiply the run total by the drive count.
        if [[ -z "${RUN_REPO_DEDUP_COUNTED[$repo]:-}" ]]; then
            RUN_DEDUP_BYTES=$(( RUN_DEDUP_BYTES + added_bytes ))
            RUN_REPO_DEDUP_COUNTED["$repo"]=1
        fi
        if [[ -n "$repo_bytes" ]]; then
            size_note=" (+$(_fmt_size "$added_bytes"), repo $(_fmt_size "$repo_bytes"))"
        else
            size_note=" (+$(_fmt_size "$added_bytes"))"
        fi
    fi

    # An archive can come out empty from a wrong include_only glob or from source
    # folders that hold nothing, and an empty archive is structurally valid, so
    # borg and the verification below both accept it. create --json already
    # reported the file count, so this costs nothing; do not replace it with a
    # listing call. A folder-scoped include_only that matches nothing only
    # empties its one folder, which a whole-archive count cannot see.
    local empty_archive=0 nfiles
    nfiles=$(printf '%s' "$create_json" | sed -n 's/.*"nfiles"[^0-9]*\([0-9]\{1,\}\).*/\1/p')
    if [[ -z "$nfiles" ]]; then
        warn "could not read nfiles from borg create --json for $repo on $drive; the empty-archive check did not run"
    elif (( nfiles == 0 )); then
        warn "archived $repo on $drive but the archive is EMPTY (0 files): check the include_only globs with 'borg create --list --dry-run', or confirm the folders are not empty"
        empty_archive=1
    fi

    # Verify before retention, not after. Prune deletes archives and compact
    # frees their space, so running them first would destroy known-good history
    # on the assumption that the archive just written is good, and test that
    # assumption afterwards. Nothing is pruned unless the new archive both
    # verifies and holds files.
    local check_out="" check_rc=0
    if [[ -n "$pc" ]]; then
        check_out=$(borg check --archives-only --last 1 2>&1) || check_rc=$?
    else
        # With no passcommand borg asks for the passphrase on stderr, so
        # capturing stderr here would hide the prompt and the run would look hung.
        borg check --archives-only --last 1 || check_rc=$?
    fi
    if (( check_rc != 0 )); then
        warn "archived $repo on $drive but the new archive FAILED verification; run: $CMD check $repo"
        if [[ -n "$check_out" ]]; then warn "$check_out"; fi
        warn "retention skipped for $repo on $drive; no archive was pruned"
        _note_issue "$repo on $drive: archive written but failed verification"
        return 2
    fi
    if (( empty_archive )); then
        # Structurally valid but empty: report unverified so it is not counted as
        # a good backup, and keep retention off so it cannot rotate a real one out.
        warn "retention skipped for $repo on $drive; no archive was pruned"
        _note_issue "$repo on $drive: archive written but empty, so it is not counted as a backup"
        return 2
    fi

    # Pruned only if the repo has a keep line; compact frees the space prune
    # marks. borg 2.0 change point: prune there requires an archive glob.
    if [[ -n "${SEEN_KEEP[$repo]+x}" ]]; then
        local kl="${KEEP_LAST[$repo]:-$KEEP_LAST_DEFAULT}"
        if (( kl != 0 )); then
            borg prune --keep-last "$kl" || warn "prune failed for $repo on $drive"
        else
            borg prune \
                --keep-hourly   "${KEEP_HOURLY[$repo]:-$KEEP_HOURLY_DEFAULT}" \
                --keep-daily    "${KEEP_DAILY[$repo]:-$KEEP_DAILY_DEFAULT}" \
                --keep-weekly   "${KEEP_WEEKLY[$repo]:-$KEEP_WEEKLY_DEFAULT}" \
                --keep-monthly  "${KEEP_MONTHLY[$repo]:-$KEEP_MONTHLY_DEFAULT}" \
                --keep-yearly   "${KEEP_YEARLY[$repo]:-$KEEP_YEARLY_DEFAULT}" \
                || warn "prune failed for $repo on $drive"
        fi
        borg compact || warn "compact failed for $repo on $drive"
    fi

    say "archived $repo on $drive$size_note"
    return 0
}

# Set to 1 once a run has printed its summary, so the EXIT trap stays quiet on a
# normal exit. The trap must not disturb the exit status, so it never calls exit
# and never returns non-zero.
_ARCHIVE_REPORTED=0
_archive_exit_notice() {
    local rc=$?
    # Only when stdout is not a terminal. The line exists so a redirected run can
    # be read for its outcome from that one stream: a fatal exit prints its reason
    # on stderr and nothing on stdout, which would otherwise be indistinguishable
    # from a run that never happened.
    if (( rc != 0 && _ARCHIVE_REPORTED == 0 )) && [[ ! -t 1 ]]; then
        printf '%s failed before it could report; the reason is on stderr above (exit %d)\n' "$CMD" "$rc"
    fi
    return 0
}

# One repo across its drives. The return code is the repo's outcome for the
# summary, not a plain pass/fail: 0 verified clean on every drive, 3 backed up
# (verified on at least one) but a drive was missing or failed verification, 4 an
# archive was written but none verified anywhere, 1 no archive written anywhere.
_archive_repo() {
    local repo="$1"
    # borg treats a missing source path as a warning, and the create step maps
    # borg's warning code to success so a dotfile changing mid-run is not a
    # failure. Together those would let a deleted or unmounted folder produce a
    # short archive that reports as good and then rotates a real one out under
    # retention. Refuse the repo instead: the run loses one backup, where
    # proceeding loses an old one.
    local missing_src=() s
    while IFS= read -r s; do
        [[ -n "$s" ]] || continue
        [[ -e "$s" ]] || missing_src+=("$s")
    done <<< "${REPO_SRC[$repo]}"
    if (( ${#missing_src[@]} > 0 )); then
        warn "repo $repo not archived: configured folder(s) missing: $(_csv "${missing_src[@]}")"
        warn "fix the path in $CONFIG_FILE or mount what holds it; existing archives are untouched"
        _note_issue "$repo: configured folder(s) missing: $(_csv "${missing_src[@]}")"
        _RUN_LAST=block
        return 1
    fi
    if [[ -n "$_RUN_LAST" ]]; then say ""; fi
    _RUN_LAST=block
    say "archiving repo $repo..."
    local start drive r any_clean=0 any_unverified=0 any_missing=0
    start=$(date +%s)
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for drive in ${REPO_DRIVES[$repo]}; do
        r=0
        _archive_one_drive "$repo" "$drive" || r=$?
        case "$r" in
            0) any_clean=1 ;;
            2) any_unverified=1 ;;
            *) any_missing=1 ;;
        esac
    done
    local dur; dur=$(_fmt_duration $(( $(date +%s) - start )))
    if (( any_clean )); then
        say "repo $repo done in $dur"
        if (( any_unverified || any_missing )); then return 3; fi
        return 0
    fi
    if (( any_unverified )); then
        warn "repo $repo: an archive was written but failed verification on every drive; run: $CMD check $repo"
        return 4
    fi
    warn "repo $repo not archived to any drive"
    return 1
}

# Refuse a run that cannot succeed, before the passphrase is touched. A repo that
# would archive is archive-on and holds backup_data. Mounted is not enough:
# Mounted is not enough: archive has no read-only fallback the way check and
# extract do. For a GPG passphrase file the passphrase is an agent prompt or a
# hardware-token touch, so nothing is solicited for work that cannot succeed. When the repos on a drive
# are simply owned by someone else, offer to claim it and re-scan once; with no
# terminal there is no offer, and the run fails with the remedy printed.
# Returns 0 when at least one repo would archive, 1 when none would.
_archive_preflight_drives() {
    local r d rp has_target=0 any_drive=0 any_writable=0 offered=0 claimed=0 ever_claimed=0
    local -a want=() unwritable=()
    local -A unwritable_drives=()
    while :; do
        has_target=0; any_drive=0; any_writable=0; claimed=0
        want=(); unwritable=(); unwritable_drives=()
        for r in "$@"; do
            _repo_archives "$r" || continue
            [[ -n "${REPO_SRC[$r]:-}" ]] || continue
            has_target=1
            # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
            for d in ${REPO_DRIVES[$r]}; do
                want+=("$d")
                mountpoint -q "$MOUNT_BASE/$d" || continue
                any_drive=1
                rp=$(_repo_path "$d" "$r")
                [[ -d "$rp" ]] || continue     # reported per drive by _archive_one_drive
                if [[ -z "$(_first_unwritable "$rp")" ]]; then
                    any_writable=1
                else
                    unwritable+=("$r on $d")
                    unwritable_drives["$d"]=1
                fi
            done
        done
        (( ${#unwritable[@]} > 0 )) || break
        warn "repo directory not writable: $(_csv "${unwritable[@]}")"
        (( offered )) && break
        offered=1
        # The cause is a property of the drive, not the repo, so several repos on
        # one drive share one offer and one remedy.
        for d in "${!unwritable_drives[@]}"; do
            if _offer_claim "$d" "$MOUNT_BASE/$d"; then claimed=1; ever_claimed=1; fi
        done
        (( claimed )) || break
    done
    if (( has_target && ! any_drive )); then
        local uniq
        uniq=$(printf '%s\n' "${want[@]}" | awk '!seen[$0]++' | paste -sd' ' -)
        die "no drives mounted for the repo(s) to back up (looked for: ${uniq}); plug one in and re-run"
    fi
    (( has_target && any_drive && ! any_writable )) \
        && die "no writable repo on any mounted drive; nothing can be archived, so the passphrase was not touched"
    (( has_target )) || return 1
    # A claim ran, so its output is finished with; start the run's own on a fresh
    # line rather than running the two together.
    if (( ever_claimed )); then say ""; fi
    return 0
}

cmd_archive() {
    (( $# <= 1 )) || die_usage "$CMD archives all repos, or one named repo; run '$CMD --help' for the subcommands"
    # Every ordinary outcome of a run, including total failure, ends with a
    # summary line on stdout; a fatal exit printed nothing there at all, so a run
    # that died on a config or passphrase problem was indistinguishable from a
    # run that never happened. This is the backup log for a cron-driven tool.
    _ARCHIVE_REPORTED=0
    trap '_archive_exit_notice' EXIT
    # First line of the run, before the config is even read, so a log identifies
    # what produced it even when the run dies in config parsing or the preflight.
    say "$(_identity)"
    local only=""
    (( $# == 1 )) && only="$1"
    ensure_borg; need mountpoint
    parse_config
    _require_repos_valid
    if [[ -n "$only" ]]; then
        _repo_declared "$only" \
            || die_usage "$only is not a configured repo or a known subcommand; run '$CMD --help' for the list"
    fi

    local -a run_repos=()
    if [[ -n "$only" ]]; then run_repos=("$only"); else run_repos=("${REPOS[@]}"); fi

    local has_target=0
    _archive_preflight_drives "${run_repos[@]}" && has_target=1

    # The lock comes before the passphrase, not after: the preflight below runs
    # the _pass-names child, which for a GPG file means an agent prompt or a
    # hardware-token touch, and a second concurrent run should be turned away
    # before it makes you touch anything. Everything above is read-only, so
    # nothing is lost by holding the lock from here.
    _acquire_lock

    # borg reads these from the environment and they override anything decided
    # here, so an exported leftover from an earlier shell would supply the
    # passphrase while the run reports it came from the file or a prompt. Not
    # neutralised, since setting one deliberately is legitimate, but never silent.
    if [[ -n "${BORG_PASSPHRASE:-}" || -n "${BORG_PASSPHRASE_FD:-}" || -n "${BORG_PASSCOMMAND:-}" ]]; then
        warn "a borg passphrase variable is set in the environment and takes precedence over $CONFIG_FILE's passphrase source"
    fi

    (( has_target )) && _archive_pass_preflight "${run_repos[@]}"

    RUN_DEDUP_BYTES=0
    RUN_REPO_DEDUP_COUNTED=()
    RUN_REPO_FILTER_CHECKED=()
    _RUN_LAST=""
    local script_start repo r rc=0
    # Each repo lands in one outcome by name. A partial repo is listed in both
    # backed_up and partial: it has a usable archive on a drive and is also
    # flagged for the drive it missed or that failed.
    local -a backed_up=() partial=() unverified=() failed=() awaiting_data=()
    script_start=$(date +%s)
    for repo in "${run_repos[@]}"; do
        if ! _repo_archives "$repo"; then
            if [[ "$_RUN_LAST" == block ]]; then say ""; fi
            say "skipping archive-off repo $repo"
            _RUN_LAST=skip
            continue
        fi
        if [[ -z "${REPO_SRC[$repo]:-}" ]]; then
            if [[ "$_RUN_LAST" == block ]]; then say ""; fi
            say "skipping $repo: no backup_data yet (awaiting data)"
            _RUN_LAST=skip
            awaiting_data+=("$repo")
            continue
        fi
        # No stored passphrase: skipped, warned and counted via PASS_SKIPPED in
        # the preflight. In prompt mode there is nothing to store, so run it.
        _pass_prompt_mode || _repo_has_pass "$repo" || continue
        r=0
        _archive_repo "$repo" || r=$?
        case "$r" in
            0) backed_up+=("$repo") ;;
            3) backed_up+=("$repo"); partial+=("$repo") ;;
            4) unverified+=("$repo") ;;
            *) failed+=("$repo") ;;
        esac
    done

    # An error run is anything short of a verified archive on every drive of
    # every archived repo. Archive-off and awaiting-data repos are intentional.
    if (( ${#failed[@]} > 0 || ${#unverified[@]} > 0 || ${#partial[@]} > 0 || ${#PASS_SKIPPED[@]} > 0 )); then
        rc=1
    fi

    if (( ${#backed_up[@]} == 0 && ${#failed[@]} == 0 && ${#unverified[@]} == 0 && ${#PASS_SKIPPED[@]} == 0 && ${#awaiting_data[@]} == 0 )); then
        if [[ -n "$_RUN_LAST" ]]; then say ""; fi
        if [[ -n "$only" ]]; then
            say "$only is archive-off; set 'archive yes' or remove its 'archive no' line in $CONFIG_FILE"
        else
            say "all configured repos are archive-off; nothing to back up"
        fi
        _ARCHIVE_REPORTED=1
        exit 0
    fi

    local dur ts added noun=repos backed_names="" extra=""
    dur=$(_fmt_duration $(( $(date +%s) - script_start )))
    ts=$(date '+%a %d %b, %H:%M')
    added=$(_fmt_size "$RUN_DEDUP_BYTES")
    (( ${#backed_up[@]} == 1 )) && noun=repo
    (( ${#backed_up[@]} > 0 )) && backed_names=" ($(_csv "${backed_up[@]}"))"
    extra+=$(_group failed     "${failed[@]}")
    extra+=$(_group unverified "${unverified[@]}")
    extra+=$(_group partial    "${partial[@]}")
    extra+=$(_group skipped    "${PASS_SKIPPED[@]}")
    # An archive-off repo is a standing config fact, already said once per repo
    # in the body above, so it is not restated in the line a cron log is read for.
    extra+=$(_group "without backup_data" "${awaiting_data[@]}")
    if [[ -n "$_RUN_LAST" ]]; then say ""; fi
    # On stdout, immediately above the summary: this is the answer to "why was
    # that repo partial", and it has to reach whoever reads the stream the
    # verdict lands in. Only on an error run, so a clean run keeps its one line.
    if (( rc != 0 && ${#RUN_ISSUES[@]} > 0 )); then
        local issue
        for issue in "${RUN_ISSUES[@]}"; do say "  $issue"; done
        say ""
    fi
    if (( rc == 0 )); then
        printf 'backed up and verified %d %s%s, +%s in %s%s, %s\n' \
            "${#backed_up[@]}" "$noun" "$backed_names" "$added" "$dur" "$extra" "$ts"
    else
        printf 'completed with errors: backed up and verified %d %s%s, +%s in %s%s, %s\n' \
            "${#backed_up[@]}" "$noun" "$backed_names" "$added" "$dur" "$extra" "$ts"
    fi
    _ARCHIVE_REPORTED=1
    exit "$rc"
}

## ─── extract: restore ────────────────────────────────────────────────
# Said by both extract routes that can write over live folders, so it is one
# string: the whole-suite form and the named-repo form must not drift apart.
readonly IN_PLACE_WARNING='in-place restore overwrites files at their original locations'

# True when any of the repo's folders carries a restore_to line. Kept as a scan
# rather than a second map so the two cannot disagree.
_repo_has_restore_to() {
    local repo="$1" src
    while IFS= read -r src; do
        [[ -n "$src" ]] || continue
        [[ -z "${REPO_RESTORE_TO["$repo"$'\n'"$src"]:-}" ]] || return 0
    done <<< "${REPO_SRC[$repo]:-}"
    return 1
}

# Several helpers below build borg's environment in a subshell so BORG_REPO,
# BORG_PASSCOMMAND and RO_LOCKOPT cannot reach the next drive. shellcheck reports
# that as SC2030/SC2031, which is the design rather than a defect, so those
# functions carry a one-line disable; it is never disabled globally.

# True when the spec makes the caller list the archives before extracting, so
# with no stored passphrase the second borg prompt is expected, not a retry.
_spec_lists_first() {
    local spec="$1"
    [[ -z "$spec" || "$spec" =~ ^-[0-9]+$ ]]
}

_require_restore_path() {
    [[ -n "$RESTORE_PATH" ]] || die "RESTORE_PATH is not set in $CONFIG_FILE"
    [[ -d "$RESTORE_PATH" ]] || die "RESTORE_PATH '$RESTORE_PATH' is not a directory; create it first"
}

# `borg list --short` with borg's own reason surfaced rather than left on a
# stderr stream a multi-repo run scrolls past: a wrong passphrase and an
# archive-less repo otherwise both arrive several layers up as "no usable
# archive", which sends you looking at the wrong thing. Only captured when a
# passphrase is already in the environment; with none, borg asks on stderr, and
# redirecting that would hide the prompt and the run would look hung.
_list_archives() {
    local what="$1"; shift
    local rc=0 errf="" reason
    if [[ -n "${BORG_PASSCOMMAND:-}${BORG_PASSPHRASE:-}${BORG_PASSPHRASE_FD:-}" ]]; then
        errf=$(mktemp) || errf=""
    fi
    if [[ -n "$errf" ]]; then
        # BORG_SHOW_SYSINFO=no is what makes the line below the reason. borg logs
        # its own message first and, on an unexpected exception, a traceback and
        # then an environment dump, whose last line is 'SSH_ORIGINAL_COMMAND:
        # None', so the tail of the stream is the dump and never the cause. With
        # the dump off, the last line is the message on an ordinary error and the
        # exception itself on a crash, which is the line worth showing either way.
        BORG_SHOW_SYSINFO=no borg list ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --short "$@" 2>"$errf" || rc=$?
        if (( rc != 0 )); then
            reason=$(grep -v '^[[:space:]]*$' "$errf" | tail -n1)
            warn "could not list $what: ${reason:-borg exited $rc}"
        fi
        rm -f "$errf"
    else
        borg list ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --short "$@" || rc=$?
        (( rc == 0 )) || warn "could not list $what (borg exited $rc)"
    fi
    return "$rc"
}

# Resolve a spec to a concrete archive name, with BORG_REPO already set. Empty
# or -1 is the latest; -N is N back; anything else is a literal archive name,
# passed through unverified, since checking it would cost another borg call and,
# with no stored passphrase, another prompt per drive.
_resolve_archive() {
    local what="$1" spec="$2"
    if [[ -z "$spec" || "$spec" == "-1" ]]; then
        local latest
        latest=$(_list_archives "$what" --last 1) || return 1
        [[ -n "$latest" ]] || { warn "no archives found in $what, aborting"; return 1; }
        printf '%s\n' "$latest"
    elif [[ "$spec" =~ ^-([0-9]+)$ ]]; then
        local n="${BASH_REMATCH[1]}"
        (( n >= 1 )) || { warn "invalid -N: '$spec' (use -1, -2, ...)"; return 1; }
        local listing arr=()
        listing=$(_list_archives "$what" --last "$n") || return 1
        mapfile -t arr <<< "$listing"
        [[ -n "${arr[-1]:-}" ]] || unset 'arr[-1]'
        if (( ${#arr[@]} < n )); then
            warn "$what has only ${#arr[@]} archive(s); cannot extract $spec"
            return 1
        fi
        printf '%s\n' "${arr[0]}"
    else
        printf '%s\n' "$spec"
    fi
}

# Report what actually arrived under $dest for the archive-relative paths asked
# for. borg's positional paths start at a source folder's own basename, because
# every source is anchored with /./ at create time, so a typo matches nothing
# while borg still reports success; check what landed rather than the exit status.
# $2 is the hint printed after a miss. Returns 1 when nothing arrived.
_report_arrivals() {
    local dest="$1" hint="$2"; shift 2
    local p arrived=() missing=()
    for p in "$@"; do
        if [[ -e "$dest/$p" ]]; then arrived+=("$p"); else missing+=("$p"); fi
    done
    if (( ${#missing[@]} > 0 )); then
        warn "nothing was restored for: $(_csv "${missing[@]}")"
        warn "$hint"
    fi
    (( ${#arrived[@]} > 0 )) || return 1
    say "restored into $dest:"
    for p in "${arrived[@]}"; do say "  $p"; done
    return 0
}

# Config-free extract: name the repo by path, the archive lands in the current
# directory, and borg prompts for the passphrase since nothing is stored.
_borgex_path() {
    local repo="$1" spec="$2"; shift 2
    local paths=("$@")
    if [[ ! -d "$repo" ]]; then
        if [[ "$repo" == /* ]]; then die "no directory at $repo"
        else die "no directory at $repo (relative to the current directory, $PWD)"; fi
    fi
    local resolved; resolved=$(readlink -f -- "$repo") || die "cannot resolve path $repo"
    local -x BORG_REPO="$resolved"
    _set_read_lock "$resolved"
    if [[ -z "${BORG_PASSPHRASE:-}" && -z "${BORG_PASSPHRASE_FD:-}" && -z "${BORG_PASSCOMMAND:-}" ]]; then
        local how=once
        _spec_lists_first "$spec" && how=twice
        _prompt_notice "a repo named by path has nothing stored" "$resolved" "$how"
    fi
    local archive; archive=$(_resolve_archive "$resolved" "$spec") || return 1
    local dest="$PWD"
    if (( ${#paths[@]} > 0 )); then
        say "extracting ${#paths[@]} path(s) from $resolved (archive: $archive) into $dest..."
        if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "${paths[@]}"; then
            _report_arrivals "$dest" "a path starts at a source folder's own name, case included; list the archive with: borg list '$resolved::$archive'" "${paths[@]}" \
                || { warn "nothing was restored from $resolved"; return 1; }
            return 0
        fi
        warn "extraction from $resolved failed; see borg output above"; return 1
    fi
    say "extracting $resolved (archive: $archive) into $dest..."
    if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive"; then say "restored $resolved into $dest"; return 0; fi
    warn "extraction from $resolved failed; see borg output above"; return 1
}

# Restore one repo's folders to their original parent directories. BORG_REPO and
# the passphrase environment must already be set. Returns non-zero on failure.
_restore_folders_in_place() {
    local repo="$1" archive="$2" drive="$3"
    say "restoring $repo (archive: $archive) in place from $drive..."
    # An in-place restore covering ~/.borg-config or the passphrase file would
    # overwrite the running tool's own inputs. This run is unaffected (it holds
    # them in memory), but snapshot and warn so you re-check before the next.
    local cfg_before="" pass_before=""
    if [[ -e "$CONFIG_FILE" ]]; then cfg_before=$(sha256sum -- "$CONFIG_FILE" 2>/dev/null) || true; fi
    if [[ -n "$PASSPHRASE_PATH" && -e "$PASSPHRASE_PATH" ]]; then pass_before=$(sha256sum -- "$PASSPHRASE_PATH" 2>/dev/null) || true; fi
    if [[ -z "${REPO_SRC[$repo]:-}" ]]; then
        warn "$repo has no backup_data folders, so there is nothing to restore in place"
        return 1
    fi
    local rc=0 src parent base
    while IFS= read -r src; do
        [[ -n "$src" ]] || continue
        parent=$(dirname "$src"); base=$(basename "$src")
        if [[ -n "$SRC_HOME" && ( "$parent" == "$SRC_HOME" || "$parent" == "$SRC_HOME"/* ) ]]; then
            parent="$HOME${parent#"$SRC_HOME"}"
        elif [[ -n "$SRC_HOME" && "$src" == "$SRC_HOME" ]]; then
            # A source that is the foreign home itself has nothing left to remap:
            # the archive holds it under its own name, so it can only land beside
            # the real one. Say so rather than let the write fail unexplained.
            warn "SRC_HOME cannot remap '$src': the archive stores it as '$base', so it restores to '$parent/$base', not under your home"
        fi
        say "  $base -> $parent/"
        if ! ( mkdir -p "$parent" && cd "$parent" && borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "$base" ); then
            warn "failed to restore '$base' into '$parent'"; rc=1
        fi
    done <<< "${REPO_SRC[$repo]}"
    local cfg_after="" pass_after=""
    if [[ -e "$CONFIG_FILE" ]]; then cfg_after=$(sha256sum -- "$CONFIG_FILE" 2>/dev/null) || true; fi
    if [[ -n "$PASSPHRASE_PATH" && -e "$PASSPHRASE_PATH" ]]; then pass_after=$(sha256sum -- "$PASSPHRASE_PATH" 2>/dev/null) || true; fi
    [[ "$cfg_before"  == "$cfg_after"  ]] || warn "this restore overwrote $CONFIG_FILE; this run still uses the config loaded at start, but re-check that file before your next run"
    [[ "$pass_before" == "$pass_after" ]] || warn "this restore overwrote $PASSPHRASE_PATH; this run still uses the passphrases loaded at start, but re-check it before your next run"
    (( rc == 0 )) && say "restored $repo in place (existing files overwritten, others left as-is)"
    return "$rc"
}

# The one gate every destructive extract path goes through. $1 is the -y flag and
# $2 states what is about to be overwritten, without trailing punctuation, so the
# same sentence serves the prompt and the refusal. -y proceeds, a terminal asks,
# and no terminal fails closed rather than prompting into a void.
_confirm() {
    local assume_yes="$1" what="$2" ans
    (( assume_yes )) && return 0
    [[ -t 0 ]] || die "$what; re-run with -y to confirm (no terminal to prompt)"
    read -rp "$what; continue? [y/N] " ans
    [[ "$ans" == [Yy] || "$ans" == [Yy][Ee][Ss] ]] || die "aborted"
}

# True if the path is a directory holding at least one entry.
_dir_nonempty() {
    [[ -d "$1" ]] || return 1
    local out
    out=$(ls -A -- "$1" 2>/dev/null) || true
    [[ -n "$out" ]]
}

# Every mounted drive holding this repo, in config order, one label per line.
# Empty output means no copy is reachable. Called with 'reasons' as $2 it prints
# why each unusable drive was dropped instead of the labels; both answers come
# from one loop so they cannot drift. Nothing is warned here, because extract
# needs one good copy: the reasons are asked for at the one moment they are the
# answer, when no copy is left. archive and check warn per drive; that is their job.
_extract_candidates() {
    local repo="$1" want="${2:-labels}" d probe parent blocked
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for d in ${REPO_DRIVES[$repo]}; do
        if ! mountpoint -q "$MOUNT_BASE/$d"; then
            if [[ "$want" == reasons ]]; then printf '%s\n' "$(_not_mounted "$d")"; fi
            continue
        fi
        # Before the directory test, not after it: an untraversable parent makes
        # the repo look absent, and "no repo there" would send you looking for a
        # missing copy when the copy is there and closed to you.
        parent=$(_repo_parent "$d")
        if [[ ! -r "$parent" || ! -x "$parent" ]]; then
            if [[ "$want" == reasons ]]; then printf '%s\n' "cannot look inside $parent; take the drive with '$CMD claim $d'"; fi
            continue
        fi
        probe=$(_repo_path "$d" "$repo")
        if [[ ! -d "$probe" ]]; then
            if [[ "$want" == reasons ]]; then printf '%s\n' "no $repo repo on $d (looked at $probe)"; fi
            continue
        fi
        # A copy borg cannot read is not a candidate. Calling borg on it buys a
        # Python traceback in place of a sentence, and the copy is unusable
        # either way, so it is dropped here with the remedy attached.
        blocked=$(_first_unreadable "$probe")
        if [[ -n "$blocked" ]]; then
            if [[ "$want" == reasons ]]; then printf '%s\n' "cannot read $blocked; take the drive with '$CMD claim $d'"; fi
            continue
        fi
        if [[ "$want" == labels ]]; then printf '%s\n' "$d"; fi
    done
    return 0
}

# Resolve the spec against one drive's copy and print the archive name.
# shellcheck disable=SC2030,SC2031  # per-drive borg env is subshelled by the caller's $( )
_archive_on_drive() {
    local repo="$1" drive="$2" spec="$3"
    local -x BORG_REPO; BORG_REPO=$(_repo_path "$drive" "$repo")
    _set_read_lock "$BORG_REPO" "$drive"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    _resolve_archive "$BORG_REPO" "$spec"
}

# One complete restore attempt from a single drive's copy, into $dest or, with
# in_place set, back to the source folders. Returns 1 rather than exiting so the
# caller can fall through to the next copy; the subshell is needed here because
# this cd's, and it also keeps the borg environment off the next drive.
# shellcheck disable=SC2030,SC2031  # per-drive borg env is subshelled on purpose
_extract_from_drive() {
    local repo="$1" drive="$2" archive="$3" in_place="$4" dest="$5"; shift 5
    local paths=("$@")
    (
        local -x BORG_REPO; BORG_REPO=$(_repo_path "$drive" "$repo")
        _set_read_lock "$BORG_REPO" "$drive"
        local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"

        if (( in_place )); then
            _restore_folders_in_place "$repo" "$archive" "$drive" || exit 1
            exit 0
        fi

        mkdir -p "$dest" || { warn "cannot create $dest"; exit 1; }
        cd "$dest"       || { warn "cannot cd to $dest"; exit 1; }

        # restore_to is folder-level, so it applies to a whole-repo restore only.
        # With --path the caller has named archive paths directly and those land
        # under $dest, which is what the flag has always meant.
        if (( ${#paths[@]} == 0 )) && _repo_has_restore_to "$repo"; then
            say "extracting $repo from $drive (archive: $archive)..."
            _restore_folders_to_targets "$repo" "$archive" "$dest" || exit 1
            say "restored $repo"
            exit 0
        fi

        if (( ${#paths[@]} > 0 )); then
            say "extracting ${#paths[@]} path(s) from $repo on $drive (archive: $archive) into $dest..."
            borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "${paths[@]}" || exit 1
            # The archive's own starting names are the answer to a miss, and this
            # repo's backup_data lines hold them, so print them rather than
            # sending the reader off to run list. An adopted repo has none.
            local hint rsrc roots=()
            while IFS= read -r rsrc; do
                [[ -n "$rsrc" ]] || continue
                roots+=("$(basename "$rsrc")")
            done <<< "${REPO_SRC[$repo]:-}"
            if (( ${#roots[@]} > 0 )); then
                hint="a path starts at one of this repo's own folder names, case included: $(_csv "${roots[@]}")"
            else
                hint="a path starts at a source folder's own name, case included; check it against '$CMD list $repo $drive'"
            fi
            # Every requested path missed. That is the same on every copy, since a
            # path is archive-relative, so exit 2 to tell the caller not to spend
            # the other drives on it; a partial hit is a real success and stays 0.
            _report_arrivals "$dest" "$hint" "${paths[@]}" || exit 2
            exit 0
        fi

        say "extracting $repo from $drive (archive: $archive) into $dest..."
        borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" || exit 1
        say "restored $repo into $dest"
        exit 0
    )
}

# Restore one repo's folders, each into the parent its restore_to names, and the
# rest into $dest in a single call. BORG_REPO and the passphrase environment must
# already be set, and the caller must not have cd'd anywhere that matters: this
# cd's per folder. Returns non-zero if any folder failed.
#
# Only reached when the repo has at least one restore_to line, so the plain bare
# `borg extract` is untouched for every other repo. A folder dropped from
# backup_data since the archive was written lands in $dest with the remainder.
_restore_folders_to_targets() {
    local repo="$1" archive="$2" dest="$3"
    local rc=0 src base target key
    local -a skip=()
    while IFS= read -r src; do
        [[ -n "$src" ]] || continue
        base=$(basename "$src")
        key="$repo"$'\n'"$src"
        target="${REPO_RESTORE_TO[$key]:-}"
        [[ -n "$target" ]] || continue
        say "  $base -> $target/"
        if ! ( mkdir -p "$target" && cd "$target" && borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "$base" ); then
            warn "failed to restore '$base' into '$target'"; rc=1
        fi
        skip+=( --exclude "sh:$base" --exclude "sh:$base/**" )
    done <<< "${REPO_SRC[$repo]}"
    # Everything without a restore_to, plus whatever else the archive holds, in
    # one call into $dest. The excludes above are what keep the folders already
    # placed from being written a second time here.
    say "  the rest -> $dest/"
    if ! ( mkdir -p "$dest" && cd "$dest" && borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} ${skip[@]+"${skip[@]}"} --progress "::$archive" ); then
        warn "failed to restore the remainder of $repo into $dest"; rc=1
    fi
    return "$rc"
}

# Order the reachable copies of a repo best-first, printing "<archive>TAB<drive>"
# lines. A copy whose -N or default spec will not resolve is dropped here rather
# than at extract time, so a stub or archive-less repo directory cannot win the
# pick; a literal archive name resolves trivially on every copy, so for that spec
# nothing is dropped and a copy lacking the archive is found at extract time.
#
# Ranking is on the archive name's first ten characters, the date, descending,
# with the config-order index breaking every tie. That ten-character slice is its
# own sort field rather than a character offset into the name: a key range that
# runs past a short field spills into the next one and inverts the tiebreak.
# Compare only the date, never the whole name: names come from borg's {now},
# evaluated once per borg create, and _archive_repo walks a repo's drives in
# config order, so within one run the drive written last always carries the later
# name, and a whole-name sort would rank write order rather than currency.
# Residual: two runs on one day landing on different drives tie on the date and
# go to config order, so the copy chosen can be hours older than the freshest.
_extract_plan() {
    local repo="$1" spec="$2"; shift 2
    local -a cand=("$@")
    local -a found=()
    local i=0 d a
    for d in "${cand[@]}"; do
        if a=$(_archive_on_drive "$repo" "$d" "$spec"); then
            found+=("$(printf '%.10s\t%03d\t%s\t%s' "$a" "$i" "$a" "$d")")
        else
            warn "$repo on $d: no usable archive there, skipping this copy"
        fi
        i=$(( i + 1 ))
    done
    (( ${#found[@]} > 0 )) || return 0

    printf '%s\n' "${found[@]}" | sort -t$'\t' -k1,1r -k2,2n | cut -f3,4
}

# Try each copy in the plan until one restores. Args: <repo> <in_place> <dest>
# <plan entry>... -- <path>..., a plan entry being "<archive>TAB<drive>".
# Returns 0 on success, 1 when every copy failed, 2 when none of the requested
# paths exist in the archive, which is the same on every copy.
_restore_from_plan() {
    local repo="$1" in_place="$2" dest="$3"; shift 3
    local -a plan=() paths=()
    local a seen=0
    for a in "$@"; do
        if   (( seen ));       then paths+=("$a")
        elif [[ "$a" == -- ]]; then seen=1
        else                        plan+=("$a"); fi
    done
    local i archive drive drc
    for (( i = 0; i < ${#plan[@]}; i++ )); do
        archive="${plan[i]%%$'\t'*}"; drive="${plan[i]##*$'\t'}"
        drc=0
        _extract_from_drive "$repo" "$drive" "$archive" "$in_place" "$dest" ${paths[@]+"${paths[@]}"} || drc=$?
        (( drc == 0 )) && return 0
        if (( drc == 2 )); then
            warn "none of the requested paths exist in $repo; nothing was restored, and the other copies hold the same paths"
            return 2
        fi
        warn "extraction of $repo from $drive failed; see borg output above"
        if (( in_place )); then
            warn "whatever borg wrote before the failure is already in place; the rest of $repo was not restored"
        else
            warn "$dest may now hold a partial $repo tree"
        fi
        if (( i + 1 < ${#plan[@]} )); then
            # Name the next copy's archive: it is resolved per drive, so it can be
            # a different point in time from the one that just failed.
            warn "falling through to ${plan[i+1]##*$'\t'} (archive: ${plan[i+1]%%$'\t'*}); it overwrites what the failed attempt left"
        fi
    done
    return 1
}

# Every repo with a mounted drive and a stored passphrase. -i restores in place,
# else into a per-repo subdirectory of RESTORE_PATH. `archive no` gates archiving,
# not restore, so archive-off repos are included. Args: <in_place> <assume_yes>;
# --path is rejected by the caller, so there are no paths to carry.
_extract_all_repos() {
    local in_place="$1" assume_yes="$2"; shift 2
    # No archive spec here, and that includes -1. Counting back needs a drive to
    # count on and no one drive holds every repo, so every -N but the newest is
    # unanswerable; -1 is the newest, which is what this form already does, so
    # accepting it would be a token that changes nothing. One rule, either way.
    (( $# == 0 )) \
        || die_usage "restoring every repo always uses the newest archive; name the repo to choose another: $CMD extract <repo> $1"
    need mountpoint
    parse_config
    _require_repos_valid
    (( in_place )) || _require_restore_path
    # Both branches ask: one omitted word is the whole difference between
    # restoring a repo and restoring every one of them. Asked above the
    # passphrase block, not below it, so nothing physical is asked of you for a
    # restore you have not agreed to yet. The two checks above are free and stay
    # first, so a confirmed run is not turned away a moment later.
    if (( in_place )); then
        _confirm "$assume_yes" "$IN_PLACE_WARNING"
    else
        _confirm "$assume_yes" "restoring every configured repo (${#REPOS[@]}) under $RESTORE_PATH"
    fi
    # An unreadable passphrase file would make every repo below report "no stored
    # passphrase" and end the run on a summary blaming drives and passphrases,
    # when the one cause is this file. Load the names up front and refuse.
    if [[ "$(_pass_source_kind)" != none ]]; then
        _load_pass_names
        (( _PASS_NAMES_UNREADABLE )) && die "refusing to restore: $PASSPHRASE_PATH is present but unreadable, so every repo would be skipped as if it had no passphrase; fix the cause in the warning above, or restore one repo at a time and let borg prompt"
    fi
    # The documented fallback (no passphrase file configured, borg asks) is
    # honoured here as everywhere else, keeping to one copy per repo so the count
    # of prompts is two per repo rather than one per drive plus one.
    local prompt_mode=0 pass_gap=""
    if _pass_prompt_mode; then
        prompt_mode=1
        _prompt_notice "no passphrase file configured" "each repo" twice
    elif [[ -z "$PASSPHRASE_PATH" ]]; then
        pass_gap="no passphrase file configured and no terminal to prompt"
    elif [[ ! -e "$PASSPHRASE_PATH" ]]; then
        pass_gap="no passphrase file at $PASSPHRASE_PATH"
    else
        pass_gap="no set_pass line in $PASSPHRASE_PATH"
    fi
    local rc=0 r rdest rfirst no_drive=0 prc w
    local -a restored=() skipped=() failed=() rcand=() rplan=() rwhy=()
    for r in "${REPOS[@]}"; do
        rcand=()
        mapfile -t rcand < <(_extract_candidates "$r")
        if (( ${#rcand[@]} == 0 )); then
            # Ask the same loop why, rather than calling every empty answer a
            # missing drive: a mounted drive without this repo on it, and one
            # whose copy cannot be read, are different problems with different
            # remedies, and the single-repo path already reports them properly.
            rwhy=()
            mapfile -t rwhy < <(_extract_candidates "$r" reasons)
            for w in ${rwhy[@]+"${rwhy[@]}"}; do
                case "$w" in *"is not mounted at"*) no_drive=1 ;; esac
            done
            skipped+=("$r ($(_csv "${rwhy[@]}"))")
            continue
        fi
        # Only in-place needs the folder list; a restore under RESTORE_PATH
        # unpacks whatever the archive holds and does not consult it.
        if (( in_place )) && [[ -z "${REPO_SRC[$r]:-}" ]]; then
            skipped+=("$r (no backup_data folders to put back)"); continue
        fi
        if ! (( prompt_mode )) && ! _repo_has_pass "$r"; then skipped+=("$r ($pass_gap)"); continue; fi
        rdest="$RESTORE_PATH/$r"
        if (( ! in_place && ! assume_yes )) && _dir_nonempty "$rdest"; then
            skipped+=("$r (target $rdest not empty; leftovers there would look like part of the restore, -y to accept)"); continue
        fi
        rplan=()
        if (( prompt_mode )); then
            # One borg list per drive is one prompt here, so keep to the first
            # reachable copy and accept that a stale one is not demoted.
            if rfirst=$(_archive_on_drive "$r" "${rcand[0]}" ""); then
                rplan=("$rfirst"$'\t'"${rcand[0]}")
            fi
        else
            mapfile -t rplan < <(_extract_plan "$r" "" "${rcand[@]}")
        fi
        if (( ${#rplan[@]} == 0 )); then skipped+=("$r (no usable archive on any copy; see the borg errors above)"); continue; fi
        prc=0
        _restore_from_plan "$r" "$in_place" "$rdest" "${rplan[@]}" -- || prc=$?
        if (( prc == 0 )); then restored+=("$r"); else rc=1; failed+=("$r"); fi
    done
    say ""
    local where="in place"; (( in_place )) || where="under $RESTORE_PATH"
    say "restored $where: ${restored[*]:-none}"
    (( ${#failed[@]} == 0 ))  || warn "failed: ${failed[*]} (see output above)"
    (( ${#skipped[@]} == 0 )) || warn "skipped: ${skipped[*]}"
    # Said once for the whole run rather than per repo: every repo shares one
    # MOUNT_BASE, so a config carried over from another machine misses every
    # drive at once, and the per-repo skip line has no room to say where it
    # looked. Only when a drive really was absent: saying it for a drive that is
    # mounted sends you to edit a setting that was never wrong.
    (( no_drive == 0 )) || warn "drives are looked for under $MOUNT_BASE; if they are mounted somewhere else, that is MOUNT_BASE in $CONFIG_FILE"
    if (( ${#restored[@]} == 0 && rc == 0 )); then
        die "nothing was restored; every repo was skipped for the reason listed against it above"
    fi
    exit "$rc"
}

# Path mode: the repo is named by path, borg prompts since nothing is stored, and
# the extract lands in the current directory. Args: <assume_yes> <args...> --
# <paths...>. This is the rescue route, so it never reads the config.
_extract_by_path() {
    local assume_yes="$1"; shift
    local -a args=() paths=()
    local a seen=0
    for a in "$@"; do
        if   (( seen ));       then paths+=("$a")
        elif [[ "$a" == -- ]]; then seen=1
        else                        args+=("$a"); fi
    done
    local repo="${args[0]}" spec=""
    if (( ${#args[@]} >= 2 )); then
        [[ "${args[1]}" == */* ]] && die_usage "path mode extracts one repo at a time; '${args[1]}' looks like a second path"
        spec="${args[1]}"
    fi
    (( ${#args[@]} <= 2 )) || die_usage "path mode takes one repo path and at most one archive spec; got ${#args[@]}"
    # With --path the collisions are known without asking borg; without it they
    # are not, and finding out would cost another listing and so another
    # passphrase prompt, so "is the directory empty" stands in for it.
    local rc=0 ppresent=() pp
    if (( ${#paths[@]} > 0 )); then
        for pp in "${paths[@]}"; do
            [[ -e "$PWD/$pp" ]] && ppresent+=("$pp")
        done
        (( ${#ppresent[@]} == 0 )) || _confirm "$assume_yes" "$PWD already contains: $(_csv "${ppresent[@]}")"
    elif _dir_nonempty "$PWD"; then
        _confirm "$assume_yes" "$PWD is not empty, and extracting here overwrites whatever the archive also holds"
    fi
    _borgex_path "$repo" "$spec" ${paths[@]+"${paths[@]}"} || rc=1
    exit "$rc"
}

# Label mode: a configured (or adopted) repo, restored into RESTORE_PATH
# or, with -i, back to its source folders. Args: <in_place> <assume_yes>
# <args...> -- <paths...>. The caller has already run parse_config.
_extract_by_label() {
    local in_place="$1" assume_yes="$2"; shift 2
    local -a args=() paths=()
    local a seen=0
    for a in "$@"; do
        if   (( seen ));       then paths+=("$a")
        elif [[ "$a" == -- ]]; then seen=1
        else                        args+=("$a"); fi
    done
    _require_repos_valid

    local repo="${args[0]}" spec="" drive_arg="" tok
    # Everything after the repo is classified by what it is, not by where it sits,
    # so 'extract docs -2 d1' and 'extract docs d1 -2' are the same command. Drive
    # labels are a closed set the config declares and archive names come from
    # borg's {now}, so the two cannot collide in practice; the drive test runs
    # first regardless, because it is a set lookup rather than a guess.
    for tok in ${args[@]+"${args[@]:1}"}; do
        if [[ "$tok" =~ ^-[0-9]+$ ]]; then
            [[ -z "$spec" ]] || die_usage "extract takes one archive spec; got '$spec' and '$tok'"
            spec="$tok"
        elif _repo_has_drive "$repo" "$tok"; then
            [[ -z "$drive_arg" ]] || die_usage "extract takes one drive; got '$drive_arg' and '$tok'"
            drive_arg="$tok"
        else
            case " $ALL_DRIVES " in
                *" $tok "*) _require_repo_drive "$repo" "$tok" ;;
            esac
            [[ -z "$spec" ]] || die_usage "extract takes one archive spec; got '$spec' and '$tok'"
            spec="$tok"
        fi
    done

    # Counting back is drive-relative: two copies hold different numbers of
    # archives whenever a drive was away for a run, so '-3' left to the ranker
    # would mean the third-newest on whichever copy it chose, which need not be
    # the one 'list <repo> <drive>' just showed. Counting back therefore names its
    # drive, and the restore is pinned to that copy with no fallthrough. -1 and a
    # literal archive name mean the same thing on every copy and need no drive.
    if [[ "$spec" =~ ^-([0-9]+)$ ]] && (( BASH_REMATCH[1] >= 2 )); then
        [[ -n "$drive_arg" ]] \
            || die_usage "'$spec' counts back from the newest, and each copy counts separately; name the drive, as in '$CMD extract $repo $spec <drive>' ($repo has: $(_repo_drives_csv "$repo"))"
    fi

    # Every mounted drive that has this repo. One copy failing does not end the
    # restore: the copies are ordered and tried in turn, unless a drive pinned one.
    local -a cand=()
    mapfile -t cand < <(_extract_candidates "$repo")
    if [[ -n "$drive_arg" ]]; then
        local c pinned=""
        for c in ${cand[@]+"${cand[@]}"}; do
            [[ "$c" == "$drive_arg" ]] && pinned="$c"
        done
        if [[ -z "$pinned" ]]; then
            mountpoint -q "$MOUNT_BASE/$drive_arg" \
                || die "$(_not_mounted "$drive_arg"); plug it in and re-run"
            die "no $repo repo on $drive_arg ($(_repo_path "$drive_arg" "$repo"))"
        fi
        cand=("$pinned")
    fi
    if (( ${#cand[@]} == 0 )); then
        warn "no mounted drive has the $repo repo"
        local why
        while IFS= read -r why; do warn "  $why"; done < <(_extract_candidates "$repo" reasons)
        exit 1
    fi

    # Ordering the copies costs one borg list per drive, and each list is one use
    # of the passphrase. Stored, that is silent; unstored, borg would prompt once
    # per drive before anything is extracted, so keep to the first copy and say so.
    local -a plan=()
    # shellcheck disable=SC2031  # reads the caller's environment, not the per-drive exports in the helpers
    if [[ -n "${BORG_PASSPHRASE:-}${BORG_PASSPHRASE_FD:-}${BORG_PASSCOMMAND:-}" ]] || _repo_has_pass "$repo"; then
        mapfile -t plan < <(_extract_plan "$repo" "$spec" "${cand[@]}")
        (( ${#plan[@]} > 0 )) || die "no copy of $repo holds a usable archive; run: $CMD check $repo"
    else
        # Two situations reach here and only one is "no entry for this repo": a
        # passphrase file that is present but could not be read leaves PASS_NAMES
        # empty for every repo, and calling that a missing entry sends you looking
        # for a set_pass line that is already there.
        local pass_why="no stored passphrase"
        (( _PASS_NAMES_UNREADABLE )) && pass_why="could not read $PASSPHRASE_PATH, so no passphrase is available"
        (( ${#cand[@]} == 1 )) \
            || warn "$pass_why for $repo; keeping to the first copy (${cand[0]}) rather than prompting once per drive"
        local how=once
        _spec_lists_first "$spec" && how=twice
        _prompt_notice "$pass_why" "$repo" "$how"
        local first_archive
        first_archive=$(_archive_on_drive "$repo" "${cand[0]}" "$spec") || exit 1
        plan=("$first_archive"$'\t'"${cand[0]}")
    fi

    local dest="$RESTORE_PATH"
    if (( in_place )); then
        (( ${#paths[@]} == 0 )) || die_usage "--in-place restores whole folders to their origins; drop --path"
        # Before the confirm, not after: there is nothing to overwrite, so asking
        # would be asking about an action that cannot happen.
        [[ -n "${REPO_SRC[$repo]:-}" ]] \
            || die "$repo has no backup_data folders, so there is nothing to put back; restore it under $RESTORE_PATH instead by dropping -i"
        _confirm "$assume_yes" "$IN_PLACE_WARNING"
    else
        _require_restore_path
        # A named repo restores flat into RESTORE_PATH, so its folders land
        # under their own names exactly as the archive holds them. That directory
        # is shared with whatever else lives there, so the only thing worth
        # gating on is a name this restore would overwrite. The whole-suite form
        # keeps its per-repo directory and its stricter non-empty gate, because
        # there the directory belongs to the restore and leftovers in it really
        # do read as part of it.
        local sp present=() b
        if (( ${#paths[@]} > 0 )); then
            for sp in "${paths[@]}"; do
                [[ -e "$dest/$sp" ]] && present+=("$sp")
            done
        else
            while IFS= read -r sp; do
                [[ -n "$sp" ]] || continue
                b=$(basename "$sp")
                [[ -e "$dest/$b" ]] && present+=("$b")
            done <<< "${REPO_SRC[$repo]:-}"
        fi
        if (( ${#present[@]} > 0 )); then
            _confirm "$assume_yes" "$dest already contains: $(_csv "${present[@]}"); these are overwritten, and anything else of that name left there stays"
        fi
    fi

    local rc=0
    _restore_from_plan "$repo" "$in_place" "$dest" "${plan[@]}" -- ${paths[@]+"${paths[@]}"} || rc=$?
    (( rc == 0 )) || warn "no copy of $repo could be restored"
    exit "$rc"
}

cmd_extract() {
    ensure_borg
    local paths=() args=() in_place=0 assume_yes=0
    while (( $# > 0 )); do
        case "$1" in
            -i|--in-place) in_place=1; shift ;;
            -y|--yes) assume_yes=1; shift ;;
            --path)
                (( $# >= 2 )) || die_usage "--path needs a value"
                [[ -n "$2" ]]  || die_usage "--path value must not be empty"
                paths+=("$2"); shift 2 ;;
            --path=*) die_usage "use '--path <value>'; '--path=value' is not supported" ;;
            -[0-9]*)                                         # -N archive spec (e.g. -3)
                [[ "$1" =~ ^-[0-9]+$ ]] || die_usage "unknown flag: $1"
                args+=("$1"); shift ;;
            -*) die_usage "unknown flag: $1" ;;
            *) args+=("$1"); shift ;;
        esac
    done

    # An in-place restore writes over the very folders an archive run reads, so
    # it takes the same lock those runs hold. A restore into RESTORE_PATH cannot
    # disturb a concurrent backup, so it is left unlocked.
    (( in_place )) && _acquire_lock

    # No repo named is the whole-suite restore. The test is on the first argument
    # rather than on the presence of a bare word anywhere, because everything is
    # classified relative to the repo and the repo comes first: '-1 docs' is a
    # mis-ordered command either way, and reading the repo out of the middle
    # would start accepting it.
    if (( ${#args[@]} == 0 )) || [[ "${args[0]}" =~ ^-[0-9]+$ ]]; then
        (( ${#paths[@]} == 0 )) || die_usage "with no repo named, extract restores whole repos; name the repo to use --path"
        _extract_all_repos "$in_place" "$assume_yes" ${args[@]+"${args[@]}"}
    fi

    # Routing. An argument containing a slash is a repo path and takes that route
    # before anything is read, so a restore from an explicit path still works
    # when the config is absent or malformed; that is the rescue property. A bare
    # word is decided after parsing, because _adopt_drive_repo needs the
    # MOUNT_BASE and ALL_DRIVES parse_config resolves. A declared repo beats a
    # same-named directory in the current folder.
    if [[ "${args[0]}" == */* ]]; then
        (( ! in_place )) || die_usage "--in-place needs a configured repo, not a repo path"
        _extract_by_path "$assume_yes" "${args[@]}" -- ${paths[@]+"${paths[@]}"}
    fi
    need mountpoint
    parse_config
    if _repo_declared "${args[0]}"; then
        :
    elif [[ -d "${args[0]}" ]]; then
        (( ! in_place )) || die_usage "--in-place needs a configured repo, not a repo path"
        _extract_by_path "$assume_yes" "${args[@]}" -- ${paths[@]+"${paths[@]}"}
    elif _adopt_drive_repo "${args[0]}"; then
        : # adopted: a repo directory of that name is on a mounted drive
    elif [[ " $ALL_DRIVES " == *" ${args[0]} "* ]]; then
        # Nothing else in this chain would name a drive as a drive: it is not a
        # repo, not a directory here, and not adoptable, so without this it
        # reports as a misspelt repo.
        die_usage "'${args[0]}' is a drive, not a repo; a drive says which copy to read, not what to restore (try: $CMD extract <repo> ${args[0]})"
    elif (( ${#REPOS[@]} == 0 )); then
        die "no repos are configured, and there is no directory at '${args[0]}' (relative to the current directory, $PWD); add repo_name blocks to $CONFIG_FILE, or give the repo's path"
    else
        die "'${args[0]}' is not a configured repo (check $CONFIG_FILE), and there is no directory of that name here either (relative to the current directory, $PWD)"
    fi
    _extract_by_label "$in_place" "$assume_yes" "${args[@]}" -- ${paths[@]+"${paths[@]}"}
}

## ─── list: one drive's copy, printed by borg ─────────────────────────
# borg is the thing that knows what is in a repo, so the wrapper's whole job here
# is to find the path, supply the passphrase and step aside. Everything after the
# drive label is handed to borg untouched, which is why --last, --first,
# --sort-by, --glob-archives, --format and --json all work without this script
# growing an opinion about any of them. Nothing is reformatted on the way out.
# local -x scopes the borg environment to this call, so no subshell is needed.
_list_one() {
    local repo="$1" dir="$2"; shift 2
    local -x BORG_REPO="$dir"
    _set_read_lock "$dir"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    borg list ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} "$@"
}

cmd_list() {
    (( $# >= 2 )) || die_usage "usage: $CMD list <repo> <drive> [borg list flags...]"
    # The repo and the drive come first, so a leading flag is an ordering mistake
    # rather than a repo called --last.
    [[ "$1" != -* ]] || die_usage "$CMD list takes the repo and the drive first: $CMD list <repo> <drive> [borg list flags...]"
    local repo="$1" drive="$2"; shift 2
    ensure_borg; need mountpoint
    parse_config
    _require_repos_valid

    _require_declared_repo "$repo"
    _require_repo_drive "$repo" "$drive"
    mountpoint -q "$MOUNT_BASE/$drive" || die "$(_not_mounted "$drive"); plug it in and re-run"
    local dir; dir=$(_repo_path "$drive" "$repo")
    [[ -d "$dir" ]] || die "no $repo repo on $drive ($dir)"

    # shellcheck disable=SC2031  # reads the caller's environment, not the per-drive exports in the helpers
    if ! _repo_has_pass "$repo" \
        && [[ -z "${BORG_PASSPHRASE:-}${BORG_PASSPHRASE_FD:-}${BORG_PASSCOMMAND:-}" ]]; then
        _prompt_notice "no stored passphrase" "$repo"
    fi

    # borg's own exit status, not one of this script's. It is borg's answer.
    local rc=0
    _list_one "$repo" "$dir" "$@" || rc=$?
    exit "$rc"
}

## ─── check: deep-verify a repo on every drive ────────────────────────
# Fresh function scope per call so BORG_REPO and BORG_PASSCOMMAND never leak
# between repos.
_check_one() {
    local repo="$1" dir="$2"
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    _set_read_lock "$dir"
    borg check ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} "$dir"
}

cmd_check() {
    (( $# <= 2 )) || die_usage "usage: $CMD check [repo [drive]]"
    ensure_borg; need mountpoint
    parse_config
    _require_repos_valid
    # Load the names here, in the parent, for the reason _load_pass_names gives.
    # check is read-only and borg's own prompt is a legitimate fallback, so this
    # warns where archive and a whole-suite restore refuse.
    if [[ "$(_pass_source_kind)" != none ]]; then
        _load_pass_names
        if (( _PASS_NAMES_UNREADABLE )); then
            _prompt_notice "no passphrase is available from $PASSPHRASE_PATH" "every repo below"
        fi
    fi
    local -a todo=()
    local want_drive=""
    if (( $# >= 1 )); then
        _require_declared_repo "$1"
        todo=("$1")
    else
        todo=("${REPOS[@]}")
    fi
    # The drive is optional here and required by list, deliberately: losing the
    # all-drives view costs list a convenience, and would cost check the operation
    # itself, since deep-verifying every copy is the whole point of check.
    if (( $# == 2 )); then
        want_drive="$2"
        _require_repo_drive "${todo[0]}" "$want_drive"
    fi
    local repo drive dir rc=0 checked
    for repo in "${todo[@]}"; do
        checked=0
        # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
        for drive in ${REPO_DRIVES[$repo]}; do
            [[ -z "$want_drive" || "$drive" == "$want_drive" ]] || continue
            if ! mountpoint -q "$MOUNT_BASE/$drive"; then warn "$(_not_mounted "$drive")"; continue; fi
            dir=$(_repo_path "$drive" "$repo")
            if [[ ! -d "$dir" ]]; then warn "no $repo repo on $drive"; continue; fi
            say "checking $repo on $drive (reads the whole repo, may be slow)..."
            if _check_one "$repo" "$dir"; then say "$repo on $drive: ok"; checked=1
            else warn "$repo on $drive: FAILED check"; rc=1; checked=1; fi
        done
        (( checked )) || { warn "no mounted drive had the $repo repo to check"; rc=1; }
    done
    exit "$rc"
}

## ─── pass-change: rotate a repo's passphrase ─────────────────────────
_rotate_one() {
    local repo="$1" dir="$2"
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    borg key change-passphrase "$dir"
}

cmd_pass_change() {
    (( $# == 1 )) || die_usage "usage: $CMD pass-change <repo>"
    local repo="$1"
    ensure_borg; need mountpoint
    parse_config
    _require_repos_valid
    _require_declared_repo "$repo"
    [[ -t 0 ]] || die "pass-change prompts for the new passphrase; no terminal to prompt, so run it interactively"

    _acquire_lock

    local ready=() unmounted=() no_repo=() pairs=() drive dir
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for drive in ${REPO_DRIVES[$repo]}; do
        dir=$(_repo_path "$drive" "$repo")
        if ! mountpoint -q "$MOUNT_BASE/$drive"; then unmounted+=("$drive")
        elif [[ ! -d "$dir" ]]; then no_repo+=("$drive")
        else ready+=("$drive"); pairs+=("$drive"$'\t'"$dir"); fi
    done
    (( ${#unmounted[@]} == 0 )) || die "all drives for $repo must be mounted; missing: ${unmounted[*]}"
    (( ${#no_repo[@]} == 0 )) || warn "drives without a $repo repo (skipped): ${no_repo[*]}"
    (( ${#ready[@]} > 0 )) || die "no drives have a $repo repo; nothing to rotate"
    # borg key change-passphrase rewrites the repo's config and takes a lock, so
    # every copy must be writable before any of them is touched: a rotation that
    # lands on some drives and not others leaves the repo on two passphrases.
    _require_writable "rotating the passphrase for $repo" "${pairs[@]}"
    say "will rotate passphrase for $repo on: ${ready[*]}"

    _require_pass "$repo"

    local new_pass new_pass2
    read -rsp "new passphrase: " new_pass; printf '\n' >&2
    read -rsp "confirm new passphrase: " new_pass2; printf '\n' >&2
    [[ -n "$new_pass" ]] || die "passphrase must not be empty"
    [[ "$new_pass" == "$new_pass2" ]] || die "passphrases do not match"
    unset new_pass2

    local -x BORG_NEW_PASSPHRASE="$new_pass"
    local rotated=() failed=()
    for drive in "${ready[@]}"; do
        dir=$(_repo_path "$drive" "$repo")
        if _rotate_one "$repo" "$dir"; then say "rotated on $drive"; rotated+=("$drive")
        else warn "rotation failed on $drive"; failed+=("$drive"); fi
    done
    unset BORG_NEW_PASSPHRASE

    if (( ${#failed[@]} > 0 )); then
        warn "drives now on new passphrase: ${rotated[*]:-none}"
        warn "drives still on old passphrase: ${failed[*]}"
        warn "passphrase file NOT updated; fix the failed drives and re-run, or revert with:"
        warn "  BORG_PASSPHRASE='<new>' BORG_NEW_PASSPHRASE='<old>' borg key change-passphrase <repo-dir>"
        unset new_pass
        exit 1
    fi
    _update_pass_value "$repo" "$new_pass"
    unset new_pass
    say "done; $repo is on the new passphrase on ${#rotated[@]} drive(s), passphrase file updated"
}

## ─── rename: rename a repo across drives ─────────────────────────────
cmd_rename() {
    (( $# == 2 )) || die_usage "usage: $CMD rename <old-repo> <new-name>"
    local old="$1" new="$2"
    [[ "$old" != "$new" ]] || die_usage "old and new names are the same: $old"
    _validate_segment "new repo name" "$new"
    _reject_reserved_name "$new"
    need mountpoint
    parse_config
    _require_repos_valid
    _require_declared_repo "$old"
    ! _repo_declared "$new" || die "$new is already a configured repo; pick a different new name"

    _acquire_lock

    local ready=() unmounted=() no_repo=() collide=() pairs=() drive od nd parent
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for drive in ${REPO_DRIVES[$old]}; do
        od=$(_repo_path "$drive" "$old"); nd=$(_repo_path "$drive" "$new")
        if ! mountpoint -q "$MOUNT_BASE/$drive"; then unmounted+=("$drive")
        elif [[ ! -d "$od" ]]; then no_repo+=("$drive")
        elif [[ -e "$nd" ]]; then collide+=("$drive")
        else ready+=("$drive"); pairs+=("$drive"$'\t'"$(_repo_parent "$drive")"); fi
    done
    (( ${#unmounted[@]} == 0 )) || die "all drives for $old must be mounted; missing: ${unmounted[*]}"
    (( ${#collide[@]} == 0 )) || die "new name $new already exists on: ${collide[*]}; pick another"
    (( ${#no_repo[@]} == 0 )) || warn "drives without a $old repo (skipped): ${no_repo[*]}"
    # A rename needs write permission on the directory holding the repo, not on
    # the repo itself, and it needs it on every drive before the first mv: a
    # rename that succeeds on d1 and is refused on d2 leaves the two drives on
    # different names with the config matching neither, to be repaired by hand.
    if (( ${#ready[@]} > 0 )); then
        _require_writable "renaming $old to $new" "${pairs[@]}"
        say "will rename $old -> $new on: ${ready[*]}"
    else
        say "no on-disk archives for $old; updating config and passphrase only"
    fi

    local renamed=() failed=()
    for drive in "${ready[@]}"; do
        od=$(_repo_path "$drive" "$old"); nd=$(_repo_path "$drive" "$new")
        if mv -T "$od" "$nd"; then say "renamed on $drive"; renamed+=("$drive")
        else warn "rename failed on $drive"; failed+=("$drive"); fi
    done
    if (( ${#failed[@]} > 0 )); then
        parent=$(_repo_parent "<drive>")
        warn "drives renamed: ${renamed[*]:-none}"
        warn "drives still on old name: ${failed[*]}"
        warn "config and passphrase file NOT updated; rename those back with:"
        warn "  mv $parent/$new $parent/$old"
        exit 1
    fi
    # The config first, then the passphrase label: _update_repo_name dies when its
    # line is missing while _update_pass_label only warns, so doing the fatal one
    # first means a failure leaves both files untouched rather than the passphrase
    # file already relabelled against a config that still says the old name.
    _update_repo_name "$old" "$new"
    _update_pass_label "$old" "$new"
    say "done; renamed on ${#renamed[@]} drive(s); config and passphrase file updated"
}

## ─── help and dispatch ───────────────────────────────────────────────
# The identity line is line 2 of this file, so the filename, the header comment
# and `version` output cannot drift from each other the way a separate VERSION
# constant would. Read from $SELF, the resolved path to this script.
_identity() {
    local line=""
    [[ -f "$SELF" ]] && line=$(sed -n '2p' -- "$SELF")
    line="${line#\#}"
    line="${line# }"
    [[ -n "$line" ]] || line="borg-simple, version unknown (could not read line 2 of $SELF)"
    printf '%s\n' "$line"
}

cmd_version() { _identity; }

usage() {
    # Unquoted heredoc so the command word is the name you invoked, not one baked
    # in here. Only two values expand: $CMD and $cfg. Every line in the commands
    # block opens with the same "  $CMD " prefix so the description column stays
    # aligned whatever the name is. $cfg is the config path with the home prefix
    # folded back to a tilde, which stops it drifting from CONFIG_FILE.
    local cfg="$CONFIG_FILE"
    [[ "$cfg" == "$HOME"/* ]] && cfg="~${cfg#"$HOME"}"
    cat <<EOF
$CMD: encrypted, versioned borg backups to USB drives.
Each repo is written to every one of its drives, so any single drive on its
own can restore it. What to back up, and to which drives, is set in the
config file, $cfg.

commands
  $CMD                      back up every repo
  $CMD <repo>               back up that one repo
  $CMD init [...]           set up a repo, or create configured ones
  $CMD extract [repo] [...] restore folders from a repo, or all
  $CMD list <repo> <drive>  show one copy's archives
  $CMD check [repo [drive]] verify copies against their hashes
  $CMD claim <drive>        take ownership of a drive's repo directories
  $CMD pass-change <repo>   change a repo's passphrase everywhere
  $CMD rename <old> <new>   rename a repo everywhere
  $CMD version              name and version of this script  (--version)
  $CMD help                 print this text                  (--help, -h)

init is the only command that writes to the config file.
    $CMD init <repo> <path>...  write the repo's block, store a passphrase,
                                then create it on each of its drives
    $CMD init <repo>            create an already-configured repo
    $CMD init                   the same, for every configured repo
    --drives <label>...         which drives a new repo lives on, default
                                every drive in ALL_DRIVES; every word after
                                it is read as a drive label, so put it last
    Creating a repo needs all of its drives mounted and writable, so every
    copy starts together; completing an existing repo does not.

extract puts a repo's folders under RESTORE_PATH, or back where they
came from with -i. Everything after the repo comes in any order. With no repo
named it restores every repo that has a mounted drive and a passphrase, whole,
and asks first; that form always uses the newest archive.
    -N                     which archive: -1 newest, -2 the one before it,
                           default -1
    <drive>                which copy to read; needed for -2 and lower,
                           since each drive counts back separately
    <archive>              an archive name from list, instead of -N
    --path <path>          restore only that path, a folder or a file;
                           repeat for more
    -i, --in-place         put folders back where they came from
    -y, --yes              overwrite without asking first
    <repo-path>            a repo directory instead of a repo name: no
                           config needed, borg prompts, files land here

claim is for a drive whose files belong to another user, which borg cannot
write to. It takes the drive's mountpoint and its repo directories, never
the whole drive, and shows what it will take before asking. It needs a
terminal, so it never runs under cron.

list hands borg everything after the drive, so --last 20, --sort-by,
--json and the rest work exactly as borg documents them.

examples
    $CMD init docs ~/Documents ~/Notes
        set up a repo named docs holding those two folders
    $CMD
        back up every repo now
    $CMD list docs d1
        what the docs copy on d1 holds
    $CMD extract docs -2 d1 --path Notes
        restore just Notes into RESTORE_PATH, taking the archive one
        back from newest on d1; count on the same drive you listed
    $CMD extract docs -i
        put every folder of docs back where it came from
    $CMD claim d2
        take ownership of d2's repo directories after a permission error

config, $cfg
    Per repo: repo_name, backup_data, backup_drives, keep, exclude,
    include_only, include_only_in, restore_to, compression, archive.
    Above the blocks: MOUNT_BASE, RESTORE_PATH, REPO_SUBDIR,
    PASSPHRASE_PATH, ALL_DRIVES, SRC_HOME.
    To remove a repo, delete its block; its archives and its set_pass
    line stay. The guide has the format and cron use.
EOF
}

# Hidden self-test, run before treating a version final (alongside shellcheck).
# The subcommand list, the dispatch case and the help banner are three hand-kept
# things, so assert every SUBCOMMANDS entry has a cmd_ handler, a branch in the
# dispatch case, and a line in the banner's commands block.
_selfcheck() {
    local w fn rc=0 help_text dispatch
    help_text=$(usage)
    dispatch=$(declare -f main)
    for w in "${SUBCOMMANDS[@]}"; do
        fn="cmd_${w//-/_}"
        declare -F "$fn" >/dev/null || { warn "no handler $fn for subcommand '$w'"; rc=1; }
        # Anchored to a case pattern, so the word occurring in a message or in
        # another function's name cannot stand in for a missing branch.
        grep -qE "(^|[[:space:]|])${w}[[:space:]]*[|)]" <<<"$dispatch" \
            || { warn "subcommand '$w' has no branch in main's dispatch case"; rc=1; }
        # Anchored to a commands-block line, not to the word anywhere in the text:
        # 'list' and 'version' both occur in the banner's prose, so a loose match
        # would pass with the command's own line deleted.
        grep -q "^  $CMD $w\b" <<<"$help_text" || { warn "subcommand '$w' missing from the help banner's commands block"; rc=1; }
    done
    (( rc == 0 )) && say "selfcheck ok (${#SUBCOMMANDS[@]} subcommands)"
    return "$rc"
}

main() {
    [[ $- == *x* ]] && die "refusing to run under bash -x: it would trace passphrases; debug with a targeted set -x around a non-secret section"
    # Personal tool: bare invocation runs the archive directly, no confirm, under
    # the spec's CLI carve-out; an unknown bare token is treated as a repo name.
    # An argument that is the empty string (an unset "$REPO" in a cron line) is a
    # mistake, not a full run, so it is rejected below rather than escalated.
    # cmd_archive exits on every path rather than returning, so the exit here is
    # a net for the day that stops being true, not a live line.
    # shellcheck disable=SC2317  # deliberately unreachable while cmd_archive always exits
    (( $# == 0 )) && { cmd_archive; exit; }
    case "${1:-}" in
        _emit-pass)  shift; _emit_pass "$@" ;;   # hidden: borg's passcommand re-invokes this to print one repo's passphrase
        _pass-names) shift; _pass_names "$@" ;;  # hidden: prints repo names that have a stored passphrase
        _selfcheck)  _selfcheck ;;               # hidden: assert the dispatch table is internally consistent
        -h|--help|help) usage ;;
        version|--version) cmd_version ;;
        init)        shift; cmd_init "$@" ;;
        extract)     shift; cmd_extract "$@" ;;
        list)        shift; cmd_list "$@" ;;
        check)       shift; cmd_check "$@" ;;
        claim)       shift; cmd_claim "$@" ;;
        pass-change) shift; cmd_pass_change "$@" ;;
        rename)      shift; cmd_rename "$@" ;;
        "")          die_usage "empty repo name; run '$CMD' with no arguments to back up every repo, or name a repo" ;;
        -*)          die_usage "unknown option: $1 (try: $CMD --help)" ;;
        *)           cmd_archive "$@" ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````