# Leveling up: Part 1

*This guide explains the [borg-simple script](#the-simple-script) below, which wraps Borg so you can make backups (archive) of folders to repos, restore (extract) repos to its original location or a different one, run integrity checks on repos, change passphrases of a repo, rename repos -- located on multiple drives -- with single commands.*
*All you need to do is setup the config and passphrase file once, and then it's one command to execute a function on all your drives.*
*The script comes with built-in defaults so it runs before you write any config (see "Baked defaults and the system repo").*

*In [Part 2](./leveling-up-2.md), you install GPG and encrypt the passphrase file, so that the passphrase file does not sit in plaintext.*

---

## Script functions

1. Once the config and passphrase file is setup, it can backup all the folders or files specified to all the repos on all the drives specified.
No need to run individual commands for each repo and for each drive.
And no need to enter the passphrase for each of those runs.
It also gives you control of what repos to backup for each session; that is, instead of running `backup`, which backs up all the repos specified in the config, you can for a session specify directly which repos you want backed up.
1. It allows you to create new repos on all your drives specified with a single command.
1. With a single command, it can do a deep check on all repos on all  drives.
1. With a single command, it can change the passphrase of all repos on all drives.
1. With a single command, it can rename all your repos.

## Commands

```
backup                       back up every repo
backup <repo>                back up one repo
backup init <repo> <path>... [--drives <labels>...]
                            create a repo: write its config block, store its
                            passphrase, then create it on the drives
backup init [repo]           create already-configured repos (all, or one)
backup extract <repo>        restore a repo's latest snapshot to RESTORE_PATH
backup extract <repo> -i     restore in place, to the folders it came from
backup extract --all-repos   restore every eligible repo (-a; add -i for in place)
backup check [repo]          deep-verify a repo on each mounted drive
backup pass-change <repo>    change a repo's passphrase (needs all its drives)
backup rename <old> <new>    rename a repo (needs all its drives)
backup --help, -h            this list
```


## Config file

```bash
# ~/.borg-config

# ── topology: where drives mount and where things go ────────────────────────
MOUNT_BASE="/media/john"               # each drive is MOUNT_BASE/<label>
ALL_DRIVES="d1 d2 d3 d4"               # the drive pool; `backup_drives all` expands to these
REPO_SUBDIR="borg"                         # optional folder between the drive and the repo ("" = repo at the drive root)
RESTORE_PATH="$HOME/Downloads"         # where `extract` drops restored folders (override per run with --path)
#PASSPHRASE_PATH="$HOME/.borg-pass.pass" # the one passphrase file (.gpg or .pass); "" lets borg prompt

# ── one block per repo: repo_name opens a block, the lines under it configure it ─
repo_name documents
backup_data "$HOME/Documents" "$HOME/Notes"
backup_drives all
keep daily=7 weekly=4 monthly=-1
exclude "*.tmp" "**/cache/**"
compression auto,zstd

repo_name photos
backup_data "$HOME/Pictures"
backup_drives d1 d2
keep last=20
```

`MOUNT_BASE`. This is the directory each drive mounts under. 
Find that for your system.
For details, see [Getting started with Borg](./getting-started-with-borg.md).

`REPO_SUBDIR`. If your borg repos sit inside a folder in the drives, then add the name here. 
For example, the path to one of your repo is `/media/john/borg/photos`, then add `borg` here. 
Empty means the repo sits at the drive home, that is, `/media/john/photos`.
Note that all your drives need to have the same sub folder.
The script doesn't work for the case where only some drives have repos inside a subfolder.

`RESTORE_PATH`. This is where `extract` writes restored folders. 
`--path` overrides it per run.
`-i` which restores in place, to the folders it came from, can also overide it per run.

`PASSPHRASE_PATH`. This is the path to the passphrase file. 
It can be a `.gpg` or a plain text file.
If left empty, script resorts to Borg's native passphrase-prompt; note that, for this, it must be absolute and space-free.

The rest of it is just based on the Borg create command: `borg create /Volumes/backup1/borg::{now} mystuff`.
See Borg docs for details on how compression and prune work.


Inside a repo block (opened by `repo_name`), these directives apply to that repo:

| Directive | Meaning |
|---|---|
| `repo_name <name>` | Opens a new repo block. The name becomes the repo directory on each drive. |
| `backup_data <path>...` | Folders this repo backs up. Each is stored under its own basename, so two folders in one repo may not share a basename. |
| `backup_drives <label>...` or `backup_drives all` | Which drives hold this repo. `all` expands to `ALL_DRIVES`. |
| `keep <key=N>...` | Retention. Keys: `last`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`. `N` is a non-negative integer or `-1` (keep that tier forever). A nonzero `last=N` keeps the N most recent and ignores the bucket keys. Unset defaults: `daily=7 weekly=4 monthly=-1 yearly=-1`, the rest `0`. |
| `exclude <glob>...` | Drop matching paths (shell-style globs: `*` stops at `/`, `**/` crosses directories). |
| `include_only <glob>...` | Repo-wide allowlist: keep only matches, drop the rest. Mutually exclusive with `exclude` and with folder-scoped `include_only`. |
| `include_only <folder> <glob>...` | Folder-scoped allowlist: applies the globs only inside that one `backup_data` folder, leaving the others whole. Composes with `exclude`. |
| `archive yes\|no` | `no` excludes the repo from a `backup` run (and needs no passphrase); `init`, `check`, `extract`, and `pass-change` still act on it. Absent means `yes`. |
| `compression <spec>` | Passed to borg untouched, e.g. `auto,zstd,10`. Omit for borg's default. |

A `repo_name` that is commented out but whose directives are left behind is a parse error, so the tool never silently misattaches orphaned lines.
The old directive names `backup` and `enabled` were renamed to `archive`; a stale line using them fails loudly with a migration message rather than silently re-enabling a repo.

## Passphrase file

The passphrase file is a list of `set_pass` lines, one per Borg repo, and nothing else:

```bash
set_pass documents 'a long passphrase for the documents repo'
set_pass photos    'a different long passphrase for photos'
```

Two formats are supported, chosen by the filename suffix:

- `NAME.pass` — plaintext. Simplest, and the right choice for unattended (cron) runs, since it needs no agent. Protected only by its `chmod 600` and your disk encryption.
- `NAME.gpg` — gpg-encrypted to your key. Stronger at rest, but a run must be able to decrypt it (gpg-agent primed, or a hardware token present to touch).

Whichever you choose, lock it down:

```console
chmod 600 ~/.borg-pass.pass     # or ~/.borg-pass.gpg
```

You do not have to write this file by hand.
`backup init <repo> <path>...` prompts for the passphrase and stores it in this file for you (see the commands below).
If you leave `PASSPHRASE_PATH` empty, there is no file and borg prompts for each repo's passphrase at the terminal.

## Setup

### Step 1 — install borg (and gpg, if you encrypt the passphrase file)

```console
sudo apt install borgbackup
sudo apt install gnupg     # only if your passphrase file ends in .gpg
```

Confirm borg is 1.2.x:

```console
borg --version
```

### Step 2 — create the passphrase file

The passphrase file is a list of `set_pass` lines, one per repo, and nothing else:

```bash
set_pass documents 'a long passphrase for the documents repo'
set_pass photos    'a different long passphrase for photos'
```

Two formats are supported, chosen by the filename suffix:

- `NAME.pass` — plaintext. Simplest, and the right choice for unattended (cron) runs, since it needs no agent. Protected only by its `chmod 600` and your disk encryption.
- `NAME.gpg` — gpg-encrypted to your key. Stronger at rest, but a run must be able to decrypt it (gpg-agent primed, or a hardware token present to touch).

Whichever you choose, lock it down:

```console
chmod 600 ~/.borg-pass.pass     # or ~/.borg-pass.gpg
```

You do not have to write this file by hand.
`backup init <repo> <path>...` prompts for the passphrase and stores it in this file for you (see the commands below).
If you leave `PASSPHRASE_PATH` empty, there is no file and borg prompts for each repo's passphrase at the terminal.

### Step 2 — create the config file

Copy full template, with the topology settings at the top and one block per repo below, open a text file, paste it, and save it in here home folder as, say, `.borg-config`:

Edit the paths, drive labels, and repo names to your own.
`MOUNT_BASE` and `ALL_DRIVES` are the only settings most people change; the other three can stay as shown.

Then restrict permissions on the file so that only you (and other administrator accounts) can read and write to it; no else has access:

```
chmod 600 .borg-config
```


### Step 4 — create the repos and run the first backup

For a repo you have already written into the config, create it on the drives:

```console
backup init documents
```

For a brand-new repo, let `init` write the config block, store the passphrase, and create the repo in one step:

```console
backup init music "$HOME/Music" --drives d1 d2
```

Then back up everything, or one repo:

```console
backup
backup documents
```

## How borg reads the passphrase file

`backup` never holds a repo's cleartext passphrase in its own long-running process.
For each borg call it sets `BORG_PASSCOMMAND` to re-invoke itself through a fixed `bash` on its own absolute path, with a hidden `_emit-pass` step that decrypts the file, reads the one repo's `set_pass` line, and writes that passphrase straight to borg.
Because borg runs the command without a shell and with no guaranteed PATH, `PASSPHRASE_PATH`, the script path, and the bash path must all be space-free.

To know which repos have a stored passphrase (so a `backup` run can skip repos without one rather than make borg prompt), the tool runs a second hidden step, `_pass-names`, that prints only the repo names from the file, never the values.

A `.gpg` file is decrypted once per command to read those names, which for a hardware token means one touch.
That happens only after the tool has confirmed a destination drive is mounted, so an unmounted drive fails before any passphrase prompt.



Notes on `extract`:

- Short flags stack: `-ai` is `--all-repos --in-place`, `-yi` is `--yes --in-place`, and so on.
- An archive other than the latest is selected positionally by name, or by `-N` for the Nth-newest (`backup extract documents -3`).
- `--path <folder>` restores only that folder out of the repo; it may be repeated.
- A first argument containing a slash is treated as a repo path and restored into the current directory with borg prompting, which is the fresh-machine path (see below).

## Baked defaults and the system repo

So the tool runs on a machine that has only the script and no config, it carries built-in defaults.
Your `~/.borg-config` overrides any setting it names, and a setting it omits keeps the baked value:

```text
MOUNT_BASE      /media/john
RESTORE_PATH    $HOME/Downloads
REPO_SUBDIR     (empty)
PASSPHRASE_PATH (empty, so borg prompts)
ALL_DRIVES      d1 d2 d3 d4
```

It also bakes one repo, `system`, defined as `backup_drives all` with no `backup_data`.
That makes `system` extract-only: a fresh machine holding only the script can run `backup extract system` to restore it, but it archives nothing until you give it folders.
A `repo_name system` block in your config overrides this baked one; add `backup_data` lines there if you want `system` to archive as well.

## Restoring on a fresh machine

You do not need a config to restore.
Install borg (and gpg if your passphrase file is `.gpg`), plug in a drive, then point `extract` straight at a repo path:

```console
mkdir -p ~/Downloads
backup extract /media/john/d1/documents
```

A repo path (any argument with a slash) makes borg prompt for the passphrase and restores into the current directory.
Repeat for each repo, then copy what you need out of the restore directory.
Once you recreate `~/.borg-config` and the passphrase file, the named subcommands work as before.

Keep your means of decrypting separate from the backups: for a `.gpg` file, the GPG private key must live somewhere other than only inside the drives (a second offline USB stick, a hardware token, or a printed `paperkey`).

## When something looks wrong

`~/.borg-config not found; create it (chmod 600) before running`
The config does not exist yet. Create it (see Step 3).

`... is reachable by group or other (mode N); run: chmod 600 ...`
The config or passphrase file is too open. Run `chmod 600` on the named file.

`MOUNT_BASE '...' is not a directory`
`MOUNT_BASE` points somewhere that does not exist. Check it with `ls /media/$USER`.

`no drives mounted for the repo(s) to back up`
None of the target repos' drives is mounted. Plug one in and re-run.

`could not read passphrases from ... (for a .gpg: can gpg decrypt it now ...)`
The passphrase file is a `.gpg` that gpg cannot currently decrypt (agent not primed, key absent), or it holds no valid `set_pass` lines.

`no passphrase for <repo> in <file>`
The repo has no `set_pass` line in the passphrase file. Add one, or let `backup init <repo>` store it.

`config: the 'backup' directive is now 'archive' ...`
An old config line uses a renamed directive. Change `backup yes|no` (or `enabled yes|no`) to `archive yes|no`.


## The simple script

> [!NOTE]
> **To devs and reviewers**: 
This script is 1790 lines long.
I can't code, but its the result of vibecoding with Opus 4.7 and 4.8 (and a few times with Fable 5) after 150+ iterations (not kidding).
I have grown to despise Anthropic and hope for local LLMs to become a viable alternative.
Anyway I've tested all the user-facing functions; and they work.
Please review it if you can.
If it's too long, then please consider reviewing the [super simple script](#the-super-simple-script) below.
It contains only the core functions for easy review.
I hope there's nothing malicious.
I have been using it for my daily backup-workflow.

```

#!/bin/bash
# borg-simple
#
# Encrypted, versioned borg backups to USB drives. You keep one config file,
# ~/.borg-config (what to back up, to which drives, how long to keep it); the
# script reads it on every run, and init and rename are the only commands that
# write to it. Passphrases live in one file you point PASSPHRASE_PATH at, a .gpg
# or .pass (chmod 600); with no path set, borg prompts per repo. `backup` backs
# up every repo, `backup <repo>` one, `backup --help` lists the commands.
# Setup, the config format, and cron use are in the guide.

set -euo pipefail

## ─── config location ─────────────────────────────────────────────────
readonly CONFIG_FILE="$HOME/.borg-config"

# Canonical user-facing subcommands, the single source of truth for the CLI surface.
# The dispatch case lists these explicitly, _reject_reserved_name forbids them as
# repo names by reading this list, and _selfcheck asserts each has both a handler
# and a help-banner line. To add or drop a subcommand, edit this list, the dispatch
# case, and the help banner; the reserved-name guard then tracks it for free, and
# _selfcheck catches a forgotten handler or help line.
readonly SUBCOMMANDS=(init extract check pass-change rename)

## ─── baked defaults ──────────────────────────────────────────────────
# Built-in settings, so the script runs with no config file. Your ~/.borg-config
# overrides any line it sets; lines it omits keep the value here.
MOUNT_BASE="/media/$(id -un)"   # drives mount under here, so drive d1 is MOUNT_BASE/d1; override for non-udisks layouts
RESTORE_PATH="$HOME/Downloads"  # extract restores into here; --path overrides it per run
SRC_HOME=""                     # in-place only: foreign home that absolute backup_data paths were written against (e.g. /home/john); remapped to your $HOME on restore; "" = no remap
REPO_SUBDIR=""                  # optional folder between the drive and the repo; "" = repo at the drive root
PASSPHRASE_PATH=""              # one passphrase file: NAME.gpg (encrypted) or NAME.pass (plaintext); "" = borg asks
ALL_DRIVES="d1 d2 d3 d4"        # the drive labels; a repo using `backup_drives all` gets all of these

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
declare -a PASS_SKIPPED=()    # repos skipped this run for a missing passphrase
declare -A PASS=()            # name -> passphrase; set only in the _emit-pass/_pass-names children and the writers, never on a routine run
declare -A PASS_NAMES=()      # name -> 1 for repos with a set_pass entry; learned via the names-only child, values never enter the parent
_PASS_NAMES_LOADED=0
_PASS_NAMES_UNREADABLE=0      # set when PASSPHRASE_PATH is present but the names child failed (no exec, no decrypt, or no set_pass lines)

# Read-only lock bypass. Holds '--bypass-lock' for the current read when the repo
# directory is not writable, so borg can read a repo whose files another user owns,
# or one on read-only media, without creating a lock file. Empty for a writable repo
# (the normal case), so a genuine stale lock on your own repo still fails loudly and
# tells you to break-lock. Set per read by _set_read_lock; never on a write path.
declare -a RO_LOCKOPT=()

# Decide the lock mode for a read of repo dir $1: bypass borg's lock when the
# directory is not writable (another user's files, or read-only media), warning once
# so the dropped concurrency guard is visible; otherwise lock normally. Read-only
# callers only (list, extract, check); a write path must hold the lock, never this.
_set_read_lock() {
    local repo="$1"
    if [[ -w "$repo" ]]; then
        RO_LOCKOPT=()
    else
        RO_LOCKOPT=(--bypass-lock)
        warn "$repo is not writable; reading with borg's lock bypassed (assumes nothing else is writing it)"
    fi
}

# Deduplicated bytes added across one archive run; summed for the final line.
# Counted once per repo (its first archived drive), so mirror drives don't multiply it.
RUN_DEDUP_BYTES=0
declare -A RUN_REPO_DEDUP_COUNTED=()

## ─── retention: a repo is pruned only if it has a keep line ──────────
## ─── these defaults fill in any keys such a line leaves unset ────────
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
say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { printf '%s\n' "$*" >&2; exit 1; }
die_usage() { printf '%s\n' "$*" >&2; exit 2; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 not found; install it first"; }

# Absolute, symlink-resolved path to this script, for the BORG_PASSCOMMAND that
# re-invokes it. A bare $0 (PATH-resolved, e.g. cron) is resolved via command -v;
# a path with a slash is resolved directly. Whitespace is rejected at use.
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

# One backup operation at a time; the fd-9 lock auto-releases on process exit.
_acquire_lock() {
    local lock="${XDG_RUNTIME_DIR:-/tmp}/backup-${UID}.lock"
    exec 9>"$lock"
    flock -n 9 || die "another backup operation is in progress"
}

## ─── config: validators and path resolution ─────────────────────────
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
# (check, init, set-keep, ...) would be unreachable: `backup <name>` dispatches to
# the subcommand instead of archiving the repo. Reserve the dispatch words and the
# help flags for subcommands. Drive labels are never dispatched, so this guards
# repo names only, at the three places a repo_name line is born: the config
# directive, `init` creating a repo, and `rename`.
_reject_reserved_name() {
    local name="$1" w
    for w in "${SUBCOMMANDS[@]}" help -h --help; do
        [[ "$name" == "$w" ]] \
            && die "repo name '$name' is reserved for the '$name' command; pick another name"
    done
    return 0
}

_require_absolute_path() {
    local kind="$1" path="$2"
    [[ "$path" == /* ]] || die "config: $kind path must be absolute (start with /): '$path'"
}

# Resolve a config path: a leading ~/ or a bare relative path is taken under
# $HOME, an absolute path passes through, and empty stays empty. So you can
# drop $HOME in the config and write ~/.config/Thunar or just Documents/foo.
_resolve_home_path() {
    local p="$1" out
    [[ -n "$p" ]] || return 0
    case "$p" in
        /*)    out="$p" ;;
        '~')   out="$HOME" ;;
        # shellcheck disable=SC2088  # a literal "~/" case pattern, expanded by hand below; not a tilde-expansion attempt
        '~/'*) out="$HOME/${p#'~/'}" ;;
        *)     out="$HOME/$p" ;;
    esac
    # Drop a trailing slash so a folder written with or without one resolves
    # identically (a backup_data folder and a folder-scoped include_only must
    # resolve to the same key); never reduce the root "/" to empty.
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
        [[ "$ALL_DRIVES" =~ [^[:space:]] ]] \
            || die "config: backup_drives all needs ALL_DRIVES set above it in $CONFIG_FILE, but it is empty"
        local d
        # shellcheck disable=SC2086  # ALL_DRIVES is a space-separated label list; intentional split
        for d in $ALL_DRIVES; do
            [[ "$d" != all ]] || die "config: ALL_DRIVES may not contain 'all' (it is the reserved expansion word)"
            _validate_segment "drive (from ALL_DRIVES)" "$d"
        done
        REPO_DRIVES["$CURRENT_REPO"]="$ALL_DRIVES"
        return 0
    fi
    local d
    for d in "$@"; do
        [[ "$d" != all ]] || die "config: 'all' is reserved for the ALL_DRIVES pool; a drive may not be named all"
        _validate_segment "drive" "$d"
    done
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
# * stops at /, **/ crosses). A plain drop, so it composes with folder-scoped
# include_only; only a repo-wide include_only, which adds a global drop, is
# mutually exclusive with it (checked at parse).
exclude() {
    _require_open_repo "exclude"
    (( $# >= 1 )) || die "config: exclude needs at least one pattern"
    local pat
    for pat in "$@"; do
        [[ -n "$pat" ]] || die "config: exclude empty pattern"
        REPO_EXCLUDES["$CURRENT_REPO"]+="$pat"$'\n'
    done
}

# Allowlist. With no leading folder it is repo-wide: each glob becomes a '+ sh:'
# include and _archive_one_drive adds the global '- sh:**' that drops the rest. A
# leading argument that resolves to a backup_data folder scopes the allowlist to
# that one folder: its globs are anchored to the folder and a '- sh:<base>/**'
# drops only that folder's rest, leaving the others whole (this replaces the
# former per-folder `filter`). A repo-wide include_only is mutually exclusive with
# exclude and with folder-scoped include_only (checked at parse); folder-scoped
# include_only and exclude compose freely.
include_only() {
    _require_open_repo "include_only"
    (( $# >= 1 )) || die "config: include_only needs at least one glob (or: include_only <folder> <glob>...)"
    local first; first=$(_resolve_home_path "$1")
    # Folder-scoped when the first token resolves to one of this repo's
    # backup_data folders; otherwise every token is a repo-wide glob. The
    # resolver makes every path absolute, so absoluteness cannot tell the two
    # apart; membership can. A wildcard-free first token that is not a known
    # folder is a mistyped folder, not a glob, so reject it rather than
    # silently building a repo-wide allowlist that drops everything.
    local folder_scoped=0
    case $'\n'"${REPO_SRC[$CURRENT_REPO]:-}" in
        *$'\n'"$first"$'\n'*) folder_scoped=1 ;;
    esac
    if (( ! folder_scoped )) && [[ "$1" != *'*'* && "$1" != *'?'* && "$1" != *'['* ]]; then
        die "config: include_only folder '$1' is not a backup_data folder of repo $CURRENT_REPO (list it in backup_data above this line, or write a glob containing * for a repo-wide allowlist)"
    fi
    if (( folder_scoped )); then
        local folder="$1"
        shift
        (( $# >= 1 )) || die "config: include_only $folder needs at least one glob after the folder"
        local key="$CURRENT_REPO"$'\n'"$first"
        [[ -z "${REPO_FINCLUDE_GLOBS[$key]+x}" ]] || die "config: two include_only lines for folder '$folder' in repo $CURRENT_REPO"
        REPO_HAS_FINCLUDE["$CURRENT_REPO"]=1
        local g globs=""
        for g in "$@"; do
            [[ -n "$g" ]] || die "config: include_only empty glob for '$folder'"
            globs+="$g"$'\n'
        done
        REPO_FINCLUDE_GLOBS["$key"]="$globs"
    else
        local g
        for g in "$@"; do
            [[ -n "$g" ]] || die "config: include_only empty glob"
            REPO_INCLUDES["$CURRENT_REPO"]+="$g"$'\n'
        done
    fi
}

# archive no excludes the repo from the archive run and drops its passphrase
# need; init, check, extract, and pass-change ignore it. Absent means yes.
archive() {
    _require_open_repo "archive"
    (( $# == 1 )) || die "config: archive needs one value: yes or no"
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
    [[ -n "$1" ]] || die "config: compression empty spec"
    REPO_COMPRESSION["$CURRENT_REPO"]="$1"
}

# Migration stubs: 'backup' then 'enabled' were the old names for 'archive'. A
# stale line would be swallowed by parse_config's tolerance and silently
# re-enable the repo, so fail loudly. Remove once your config drops the old names.
backup() {
    die "config: the 'backup' directive is now 'archive'; change 'backup yes|no' to 'archive yes|no' in $CONFIG_FILE"
}
enabled() {
    die "config: the 'enabled' directive is now 'archive'; change 'enabled yes|no' to 'archive yes|no' in $CONFIG_FILE"
}

# True unless the repo was turned off with `archive no`.
_repo_archives() { [[ "${REPO_ARCHIVE[$1]:-1}" != 0 ]]; }

# Lives in the passphrase file, keyed by repo name.
set_pass() {
    (( $# == 2 )) || die "pass: set_pass needs: <repo> '<passphrase>'; got $# args"
    [[ -z "${PASS[$1]+x}" ]] || die "pass: passphrase for $1 set more than once in $PASSPHRASE_PATH"
    PASS["$1"]="$2"
}

require_private() {
    local f="$1" mode
    [[ -e "$f" ]] || die "$f not found; create it (chmod 600) before running"
    [[ -r "$f" ]] || die "$f exists but is not readable"
    mode=$(stat -c '%a' "$f") || die "cannot stat $f"
    (( (8#$mode & 8#77) == 0 )) || die "$f is reachable by group or other (mode $mode); run: chmod 600 $f"
}

# Source the config with universal validation. Subcommands add their own.
parse_config() {
    local cfg="$CONFIG_FILE"
    # An absent config is fine: the baked defaults stand and _baked_repos may add
    # repos. When present, tolerate any directive we don't define (a sibling
    # tool's sync_* line, or a stale passphrase_file line from the old per-repo
    # model) rather than abort; _require_repos_valid still catches an empty set.
    if [[ -e "$cfg" ]]; then
        require_private "$cfg"
        # shellcheck disable=SC2317  # bash calls this indirectly when sourcing the config hits an undefined directive; not dead code
        command_not_found_handle() { return 0; }
        # shellcheck source=/dev/null
        source "$cfg" || die "failed to load $cfg (check it for a shell syntax error, e.g. an unbalanced quote)"
        unset -f command_not_found_handle
    fi

    MOUNT_BASE=$(_resolve_home_path "$MOUNT_BASE")
    [[ -n "$MOUNT_BASE" ]] || die "MOUNT_BASE is empty; set it in $CONFIG_FILE or keep the baked default"
    [[ -d "$MOUNT_BASE" ]] || die "MOUNT_BASE '$MOUNT_BASE' is not a directory"
    [[ -z "$REPO_SUBDIR" ]] || _validate_segment "REPO_SUBDIR" "$REPO_SUBDIR"
    RESTORE_PATH=$(_resolve_home_path "$RESTORE_PATH")
    # SRC_HOME is a literal foreign-home prefix for in-place remap, deliberately
    # not run through _resolve_home_path (that resolves against the running user's
    # $HOME, which would defeat its purpose). Absolute or empty; trailing slash dropped.
    if [[ -n "$SRC_HOME" ]]; then
        _require_absolute_path "SRC_HOME" "$SRC_HOME"
        SRC_HOME="${SRC_HOME%/}"
    fi
    PASSPHRASE_PATH=$(_resolve_home_path "$PASSPHRASE_PATH")
    # Passphrase source resolves by suffix and presence: .gpg -> gpg-decrypt,
    # .pass -> plaintext, and empty (or a path with no file) -> borg prompts, the
    # v88 fallback. A set path must be space-free (the passcommand is unsplit).
    case "$PASSPHRASE_PATH" in
        '') ;;
        *[[:space:]]*) die "PASSPHRASE_PATH must be space-free for the passcommand (got: '$PASSPHRASE_PATH')" ;;
        *.gpg|*.pass) ;;
        *) die "PASSPHRASE_PATH must end in .gpg or .pass, or be empty to let borg prompt (got: '$PASSPHRASE_PATH')" ;;
    esac
    _baked_repos
}

# Optional repos baked in, so a fresh machine holding only this script can
# extract by name with no config (borg prompts for the passphrase). Each entry is
# guarded by `_repo_declared NAME ||`, so a config block of the same name wins,
# and is built through the directive functions, so it is shaped like a config
# block. Name drives explicitly: ALL_DRIVES may be empty on a fresh machine.
# Nothing is baked until you uncomment a line here. (`backup extract <path>`
# already recovers a repo by path with no config, so this is rarely needed.)
_baked_repos() {
    : # e.g. _repo_declared system || { repo_name system; backup_drives d1 d2; }
}

# A repo with no backup_data is allowed (it archives nothing yet, reported as
# awaiting data); backup_drives and the filtering rules are required.
_require_repos_valid() {
    (( ${#REPOS[@]} > 0 )) || die "no repos configured; add repo_name blocks to $CONFIG_FILE"
    local r
    for r in "${REPOS[@]}"; do
        [[ -n "${REPO_DRIVES[$r]:-}" ]] || die "config: repo $r has no backup_drives line"
        # A repo-wide include_only emits a global '- sh:**' that allowlists the
        # whole repo. An exclude composes with it (excludes are emitted first, so
        # they override the allowlist); a folder-scoped include_only does not, as
        # two allowlist scopes over one repo are ambiguous.
        if [[ -n "${REPO_INCLUDES[$r]:-}" && -n "${REPO_HAS_FINCLUDE[$r]:-}" ]]; then
            die "config: repo $r has a repo-wide include_only and a folder-scoped one; use a single repo-wide allowlist, or scope every allowlist to a folder"
        fi
    done
}

_repo_declared() { [[ -n "${REPO_SEEN[$1]+x}" ]]; }

# The repo directory on a given drive.
_repo_path() { printf '%s\n' "$MOUNT_BASE/$1${REPO_SUBDIR:+/$REPO_SUBDIR}/$2"; }

## ─── passphrase file: read, write, load ──────────────────────────────
# Backend chosen by extension: *.gpg (decrypt in memory), *.pass (plaintext,
# chmod 600), else none (callers that need it refuse).
_pass_source_kind() {
    case "$PASSPHRASE_PATH" in
        *.gpg)  [[ -e "$PASSPHRASE_PATH" ]] && { printf 'gpg\n';   return; } ;;
        *.pass) [[ -e "$PASSPHRASE_PATH" ]] && { printf 'plain\n'; return; } ;;
    esac
    printf 'none\n'
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
# on disk.
_pass_write() {
    local tmp
    tmp=$(mktemp "${PASSPHRASE_PATH}.XXXXXX") || die "could not create tempfile for $PASSPHRASE_PATH"
    trap 'rm -f "$tmp"; exit 130' INT TERM
    case "$(_pass_source_kind)" in
        plain)
            cat > "$tmp" || { rm -f "$tmp"; die "could not write $tmp"; }
            ;;
        gpg)
            need gpg
            local kids=() kid
            while IFS= read -r kid; do
                [[ -n "$kid" ]] && kids+=( -r "$kid" )
            done < <(gpg --list-packets "$PASSPHRASE_PATH" 2>/dev/null \
                       | sed -n 's/.*keyid \([0-9A-Fa-f]\{8,\}\).*/\1/p')
            (( ${#kids[@]} > 0 )) \
                || { rm -f "$tmp"; die "cannot read the GPG recipients of $PASSPHRASE_PATH to re-encrypt it; re-encrypt the file to your key by hand"; }
            if ! gpg --quiet --yes --encrypt "${kids[@]}" --output "$tmp"; then
                rm -f "$tmp"; die "re-encryption of $PASSPHRASE_PATH failed"
            fi
            gpg --quiet --decrypt "$tmp" >/dev/null 2>&1 \
                || { rm -f "$tmp"; die "re-encrypted $PASSPHRASE_PATH failed to decrypt; original kept"; }
            ;;
        none)
            rm -f "$tmp"; die "no passphrase file at $PASSPHRASE_PATH to update; create it first"
            ;;
    esac
    # chmod after the write: gpg --output can recreate the file under the umask,
    # so set owner-only just before the swap, not before the encrypt.
    chmod 600 "$tmp" || { rm -f "$tmp"; die "could not make $PASSPHRASE_PATH owner-only"; }
    mv "$tmp" "$PASSPHRASE_PATH" || { rm -f "$tmp"; die "could not write $PASSPHRASE_PATH"; }
    trap - INT TERM
}

# The combined passphrase file is never sourced into this long-running process
# on a routine run. borg gets a BORG_PASSCOMMAND that re-invokes the hidden
# _emit-pass child to print one repo's passphrase, and a separate _pass-names
# child reports which repos have an entry, so this process learns the names
# without ever holding a value. The writers below (_store_pass, _update_pass_*)
# still read the file at write time; those are the deliberate cleartext moments.

# Print a BORG_PASSCOMMAND for repo $1, or nothing (borg prompts) when that repo
# has no stored entry. borg splits the command with no shell, so SELF and the
# path must be space-free; fail loudly rather than let borg mis-split.
_repo_passcommand() {
    local repo="$1"
    _repo_has_pass "$repo" || return 0
    # borg runs this with no shell and no guaranteed PATH, so invoke a fixed bash
    # on the script by absolute path: this needs no execute bit on the script
    # (unlike a direct exec, which is what v101/v102 wrongly required) and no PATH
    # lookup. borg splits on whitespace, so all three tokens must be space-free.
    case "$BASH$SELF$PASSPHRASE_PATH" in
        *[[:space:]]*) die "passcommand needs space-free paths, but one of BASH='$BASH', SELF='$SELF', PASSPHRASE_PATH='$PASSPHRASE_PATH' contains whitespace" ;;
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
# undecryptable file leaves PASS_NAMES empty (borg prompts, or archive skips).
_load_pass_names() {
    (( _PASS_NAMES_LOADED )) && return 0
    _PASS_NAMES_LOADED=1
    [[ "$(_pass_source_kind)" != none ]] || return 0
    local out rc=0
    out=$("$BASH" "$SELF" _pass-names "$PASSPHRASE_PATH" 2>/dev/null) || rc=$?
    # The file is present but the names child failed: it could not decrypt (.gpg,
    # gpg-agent not primed or key absent), or holds no valid set_pass lines. Flag
    # it so callers fail loudly rather than treat it as "nothing stored" and skip
    # every repo with a misleading message.
    if (( rc != 0 )); then
        _PASS_NAMES_UNREADABLE=1
        warn "could not read passphrases from $PASSPHRASE_PATH (for a .gpg: can gpg decrypt it now, i.e. is gpg-agent primed and the key present? otherwise: does the file contain 'set_pass <repo> ...' lines?)"
        return 0
    fi
    local n
    while IFS= read -r n; do
        [[ -n "$n" ]] && PASS_NAMES["$n"]=1
    done <<< "$out"
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

# Archive preflight: load the names, then mark archived repos that have folders
# but no stored passphrase as skipped (warned), matching the old skip behaviour.
_archive_pass_preflight() {
    _load_pass_names
    (( _PASS_NAMES_UNREADABLE )) && die "refusing to archive: $PASSPHRASE_PATH is present but unreadable, so every repo would be silently skipped; fix the cause in the warning above and re-run"
    local label missing=()
    for label in "${REPOS[@]}"; do
        _repo_archives "$label" || continue            # archive no
        [[ -n "${REPO_SRC[$label]:-}" ]] || continue   # no folders yet (awaiting data)
        _repo_has_pass "$label" || missing+=("$label")
    done
    if (( ${#missing[@]} > 0 )); then
        warn "no passphrase set for ${missing[*]}; skipped this run (add set_pass lines to $PASSPHRASE_PATH)"
        PASS_SKIPPED=("${missing[@]}")
    fi
}

# Replace the set_pass value for $1 with $2 in the passphrase file. Matching on
# the line rather than splitting it keeps the old value out of any temp file.
_update_pass_value() {
    local label="$1" new_pass="$2"
    local quoted; quoted=$(printf '%q' "$new_pass")
    local found=0 line out=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*set_pass[[:space:]]+([^[:space:]]+)[[:space:]] ]] \
            && [[ "${BASH_REMATCH[1]}" == "$label" ]]; then
            out+="set_pass ${label} ${quoted}"$'\n'
            found=1
        else
            out+="$line"$'\n'
        fi
    done < <(_pass_cleartext)
    (( found )) \
        || die "no set_pass line for $label in $PASSPHRASE_PATH; rotation finished on drives but the file was not updated"
    printf '%s' "$out" | _pass_write
}

# Rewrite the label on the set_pass line, preserving the value and its spacing.
_update_pass_label() {
    local old="$1" new="$2"
    local found=0 line out=""
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^([[:space:]]*set_pass[[:space:]]+)([^[:space:]]+)([[:space:]]+.+)$ ]] \
            && [[ "${BASH_REMATCH[2]}" == "$old" ]]; then
            out+="${BASH_REMATCH[1]}${new}${BASH_REMATCH[3]}"$'\n'
            found=1
        else
            out+="$line"$'\n'
        fi
    done < <(_pass_cleartext)
    (( found )) \
        || { warn "no set_pass line for $old in $PASSPHRASE_PATH; nothing to relabel there"; return 0; }
    printf '%s' "$out" | _pass_write
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
    local tmp; tmp=$(mktemp "${CONFIG_FILE}.XXXXXX") \
        || die "cannot create a temp file beside $CONFIG_FILE"
    trap 'rm -f "$tmp"; exit 130' INT TERM
    if ! { printf '%s' "$out" > "$tmp" && chmod --reference="$CONFIG_FILE" "$tmp" && mv -f "$tmp" "$CONFIG_FILE"; }; then
        rm -f "$tmp"; die "failed to update $CONFIG_FILE"
    fi
    trap - INT TERM
}

## ─── config mutation: append a repo block ─────────────────────────────
# init appends a repo block here; rename rewrites a repo_name line (in its own
# section). Both write atomically through a same-dir tempfile, preserving the
# file's mode, and touch only their target line, so a sibling tool's lines,
# comments, and blanks are left in place. Everything else in the config is
# edited by hand.

# Write new whole-file content over the config atomically, preserving its mode.
_write_config() {
    local content="$1" tmp
    tmp=$(mktemp "${CONFIG_FILE}.XXXXXX") || die "cannot create a temp file beside $CONFIG_FILE"
    trap 'rm -f "$tmp"; exit 130' INT TERM
    printf '%s' "$content" > "$tmp" || { rm -f "$tmp"; die "failed to write $tmp"; }
    if [[ -e "$CONFIG_FILE" ]]; then
        chmod --reference="$CONFIG_FILE" "$tmp" || { rm -f "$tmp"; die "failed to set mode on $tmp"; }
    else
        chmod 600 "$tmp" || { rm -f "$tmp"; die "failed to set mode on $tmp"; }
    fi
    mv -f "$tmp" "$CONFIG_FILE" || { rm -f "$tmp"; die "failed to update $CONFIG_FILE"; }
    trap - INT TERM
}

# Validate a backup_drives value ('all' or a list of labels) the same way the
# directive does, so a bad drive is rejected before a block is written.
_validate_drives_list() {
    local drives="$1" d
    if [[ "$drives" == all ]]; then
        [[ "$ALL_DRIVES" =~ [^[:space:]] ]] \
            || die "drives 'all' needs ALL_DRIVES set in $CONFIG_FILE first, or pass --drives <labels>"
        return 0
    fi
    # shellcheck disable=SC2086  # space-joined label list; intentional split
    for d in $drives; do
        [[ "$d" != all ]] || die "'all' is reserved for the ALL_DRIVES pool; a drive may not be named all"
        _validate_segment "drive" "$d"
    done
}

# Append a new repo block: a backup_data line per resolved path, a backup_drives
# line, and the optional directives as commented templates. No archive line is
# templated: a new repo is archive-on by default, and is turned off by adding
# 'archive no' by hand. Paths are validated like backup_data before any write.
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
    body+=("# include_only '**/wanted'                       # repo-wide allowlist; not with exclude")
    body+=("# include_only \"\$HOME/sub\" '**/wanted'           # allowlist one folder, others whole")
    body+=("# compression auto,zstd,10")
    local existing block content
    existing=$(cat "$CONFIG_FILE")
    printf -v block '%s\n' "${body[@]}"
    # One blank line between the prior content and the new block.
    printf -v content '%s\n\n%s' "$existing" "$block"
    _write_config "$content"
}

# Prompt for repo $1's passphrase twice and store it through the atomic,
# recipient-preserving writer, then populate PASS so the caller can use it at
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
    local p1 p2
    read -rsp "passphrase for $repo: " p1; printf '\n' >&2
    read -rsp "confirm: " p2;             printf '\n' >&2
    [[ -n "$p1" ]]       || die "empty passphrase; nothing stored"
    [[ "$p1" == "$p2" ]] || die "passphrases did not match; nothing stored"
    local esc line
    esc="${p1//\'/\'\\\'\'}"
    printf -v line "set_pass %s '%s'" "$repo" "$esc"
    printf '%s\n%s\n' "$current" "$line" | _pass_write
    unset p1 p2
    PASS_NAMES["$repo"]=1
    say "stored a passphrase for $repo in $PASSPHRASE_PATH"
}

## ─── init: create the repos ───────────────────────────────────────────
_check_usb() {
    mountpoint -q "$MOUNT_BASE/$1" || { warn "$1 not mounted"; return 1; }
}

_init_one() {
    local repo="$1" drive="$2" dir
    dir=$(_repo_path "$drive" "$repo")
    if [[ -d "$dir" ]]; then
        say "$dir already exists"
        return 0
    fi
    if [[ -n "$REPO_SUBDIR" ]]; then
        mkdir -p "$MOUNT_BASE/$drive/$REPO_SUBDIR" \
            || { warn "could not create $MOUNT_BASE/$drive/$REPO_SUBDIR"; return 1; }
    fi
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo")
    [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    if borg init --encryption=repokey "$dir"; then
        say "initialised $dir"
    else
        warn "failed to initialise $dir"
        return 1
    fi
}

cmd_init() {
    need borg; need mountpoint
    # backup init [<repo> [<paths>...] [--drives <labels>...]]. A repo with
    # paths creates a new block; a repo without paths inits an existing repo;
    # no repo inits every configured repo. --drives sets the new block's drives
    # (default 'all'); everything after --drives is a drive label.
    local repo="" sawdrives=0
    local -a paths=() dr=()
    while (( $# )); do
        case "$1" in
            --drives)    sawdrives=1; shift ;;
            --drives=*)  die_usage "use '--drives d1 d2'; '--drives=...' is not supported" ;;
            -*)          die_usage "unknown flag: $1 (usage: backup init [<repo> [<paths>...] [--drives <labels>...]])" ;;
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
    # or as an awaiting-data repo (backup_drives, no backup_data) when none are.
    # Either way init writes the block and creates the borg repos, so a repo can
    # be brought up before it has folders and filled later by hand-adding
    # backup_data lines to its block.
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
        _validate_drives_list "$drives"
        # The passphrase is prompted after the block is written, so confirm that
        # can succeed before changing anything on disk.
        [[ "$(_pass_source_kind)" != none ]] \
            || die "no passphrase file at $PASSPHRASE_PATH yet; create it with your first repo's set_pass line, then init adds the rest"
        [[ -t 0 ]] || die "creating $repo prompts for its passphrase; no terminal to prompt. Run interactively."
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
        if [[ "$drives" == all ]]; then
            REPO_DRIVES["$repo"]="$ALL_DRIVES"
        else
            REPO_DRIVES["$repo"]="$drives"
        fi
        todo=("$repo")
    elif (( ${#paths[@]} > 0 )); then
        # Folders given for a name that is already a repo, or with no name at all.
        [[ -n "$repo" ]] || die_usage "creating a repo needs a name: backup init <repo> <path>..."
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

    local drive available rc=0
    for r in "${todo[@]}"; do
        say "initialising repo $r..."
        available=()
        # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
        for drive in ${REPO_DRIVES[$r]}; do
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
    done
    exit "$rc"
}

## ─── archive: the default action ──────────────────────────────────────
_fmt_duration() {
    local secs="$1" h m s
    h=$(( secs / 3600 )); m=$(( (secs % 3600) / 60 )); s=$(( secs % 60 ))
    if   (( h > 0 )); then printf '%dh%dm%ds' "$h" "$m" "$s"
    elif (( m > 0 )); then printf '%dm%ds' "$m" "$s"
    else                   printf '%ds' "$s"
    fi
}

# Bytes to a short human size via numfmt SI (decimal, powers of 1000: KB, MB, GB),
# dropping a trailing .0 so a round value reads 2MB rather than 2.0MB.
_fmt_size() {
    local s
    s=$(numfmt --to=si --suffix=B --format='%.1f' "$1" 2>/dev/null) || s="${1}B"
    printf '%s' "${s/.0/}"
}

# Comma-join the arguments into "a, b, c"; nothing for an empty list.
_csv() {
    (( $# > 0 )) || return 0
    local acc="$1" x; shift
    for x in "$@"; do acc+=", $x"; done
    printf '%s' "$acc"
}

# One summary group as ", <count> <label> (name, name)", or nothing when the
# list is empty, so an unused category drops out of the line cleanly.
_group() {
    local label="$1"; shift
    (( $# > 0 )) || return 0
    printf ', %d %s (%s)' "$#" "$label" "$(_csv "$@")"
}

# One repo to one drive. Returns 0 on archived-and-verified, 1 if the archive
# was not created, 2 if it was created but failed its quick verification.
_archive_one_drive() {
    local repo="$1" drive="$2"
    local mount="$MOUNT_BASE/$drive"
    if ! mountpoint -q "$mount"; then
        warn "$drive not mounted"
        return 1
    fi
    local -x BORG_REPO; BORG_REPO=$(_repo_path "$drive" "$repo")
    if [[ ! -d "$BORG_REPO" ]]; then
        warn "no $repo repo on $drive"
        return 1
    fi
    local pc; pc=$(_repo_passcommand "$repo")
    [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"

    # Each folder is anchored with /./ so it lands at the archive root under
    # its own basename, regardless of where it lives on disk.
    local -a srcs=() popts=()
    local p
    while IFS= read -r p; do
        [[ -n "$p" ]] || continue
        srcs+=( "$(dirname "$p")/./$(basename "$p")" )
    done <<< "${REPO_SRC[$repo]}"

    # Filtering. borg does the matching; this assembles one ordered list of
    # '+'/'- sh:' patterns (first match wins, unmatched kept). Every exclude is a
    # plain '- sh:' drop emitted before any '+', so an explicit exclude always
    # overrides an allowlist (a secret you exclude stays out even if an allowlist
    # would keep it). A repo-wide include_only then allowlists the whole repo:
    # every glob is a '+' and a trailing global '- sh:**' drops the rest; it
    # composes with exclude but not with a folder-scoped include_only (checked at
    # parse). Otherwise each folder-scoped include_only allowlists one folder
    # ('- sh:<base>/**' drops that folder's rest, leaving the others whole).
    if [[ -n "${REPO_INCLUDES[$repo]:-}" ]]; then
        while IFS= read -r p; do
            [[ -n "$p" ]] && popts+=( --pattern "- sh:$p" )
        done <<< "${REPO_EXCLUDES[$repo]:-}"
        while IFS= read -r p; do
            [[ -n "$p" ]] && popts+=( --pattern "+ sh:$p" )
        done <<< "${REPO_INCLUDES[$repo]}"
        popts+=( --pattern '- sh:**' )
    else
        local base key g
        while IFS= read -r p; do
            [[ -n "$p" ]] && popts+=( --pattern "- sh:$p" )
        done <<< "${REPO_EXCLUDES[$repo]:-}"
        while IFS= read -r p; do
            [[ -n "$p" ]] || continue
            key="$repo"$'\n'"$p"
            [[ -n "${REPO_FINCLUDE_GLOBS[$key]:-}" ]] || continue
            base=$(basename "$p")
            while IFS= read -r g; do
                [[ -n "$g" ]] && popts+=( --pattern "+ sh:$base/$g" )
            done <<< "${REPO_FINCLUDE_GLOBS[$key]}"
        done <<< "${REPO_SRC[$repo]}"
        while IFS= read -r p; do
            [[ -n "$p" ]] || continue
            key="$repo"$'\n'"$p"
            [[ -n "${REPO_FINCLUDE_GLOBS[$key]:-}" ]] || continue
            base=$(basename "$p")
            popts+=( --pattern "- sh:$base/**" )
        done <<< "${REPO_SRC[$repo]}"
    fi

    # borg's default compression is lz4; a `compression` directive overrides it
    # with the user's spec, passed through for borg to validate and apply.
    # Omitted means no --compression flag at all, so borg's own default stands.
    [[ -n "${REPO_COMPRESSION[$repo]:-}" ]] && popts+=( --compression "${REPO_COMPRESSION[$repo]}" )

    # borg's rc: 0 clean, 1 warnings (e.g. a source file changed or vanished
    # mid-run, common for live dotfiles) with the archive still written, 2+ a
    # real error. Treat warnings as success so a changing profile isn't a failure.
    local create_rc=0 create_json
    create_json=$(borg create --json ${popts[@]+"${popts[@]}"} "::{now}" "${srcs[@]}") || create_rc=$?
    if (( create_rc >= 2 )); then
        warn "borg create failed (rc=$create_rc) for $repo on $drive"
        return 1
    fi
    if (( create_rc == 1 )); then
        warn "borg create finished with warnings for $repo on $drive; archive was still created"
    fi

    # borg's own figures: this snapshot's deduplicated size is exactly how much
    # the repo grew, and unique_csize is the repo's on-disk total. Best-effort,
    # a parse miss just drops the size from the line; it never fails the backup.
    # borg 2.0 change point: these JSON fields are renamed (deduplicated_size and
    # unique_csize go away), so the sed patterns below need updating for 2.x.
    local added_bytes repo_bytes size_note=""
    added_bytes=$(printf '%s' "$create_json" | sed -n 's/.*"deduplicated_size"[^0-9]*\([0-9]\{1,\}\).*/\1/p')
    repo_bytes=$(printf '%s' "$create_json"  | sed -n 's/.*"unique_csize"[^0-9]*\([0-9]\{1,\}\).*/\1/p')
    if [[ -n "$added_bytes" ]]; then
        # The same logical data is written to every drive, so count each repo's
        # growth once (its first archived drive); summing per drive would multiply
        # the run total by the drive count. The per-drive note below still shows
        # what was written to that drive.
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

    # A repo-wide include_only whose globs match nothing produces a valid but empty
    # archive that borg and the tripwire below both accept, so a wrong glob would
    # silently back up nothing. Warn when the whole archive comes out empty. A
    # folder-scoped include_only that matches nothing only empties its one folder,
    # which this whole-archive check cannot see; verify those with --dry-run.
    if [[ -n "${REPO_INCLUDES[$repo]:-}" || -n "${REPO_HAS_FINCLUDE[$repo]:-}" ]]; then
        local newest listing
        if newest=$(borg list --last 1 --short) && [[ -n "$newest" ]] \
           && listing=$(borg list "::$newest" --short) \
           && [[ -z "$listing" ]]; then
            warn "archived $repo on $drive but the archive is EMPTY: include_only matched no files; verify the globs with 'borg create --list --dry-run'"
        fi
    fi

    # Pruned only if the repo has a keep line; compact frees the space prune marks.
    # borg 2.0 change point: prune requires an archive glob (a series name), so the
    # bare 'borg prune' forms below must gain one for 2.x.
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

    # Fast tripwire: verify only the archive just made (metadata, not all data).
    # On failure, surface borg's own reason rather than swallowing it.
    local check_out
    if check_out=$(borg check --archives-only --last 1 2>&1); then
        say "archived $repo on $drive$size_note"
        return 0
    fi
    warn "archived $repo on $drive but the new archive FAILED verification; run: backup check $repo"
    warn "$check_out"
    return 2
}

# One repo across its drives. The return code is the repo's outcome for the
# summary, not a plain pass/fail: 0 verified clean on every drive, 3 backed up
# (verified on at least one drive) but a drive was missing or failed
# verification, 4 an archive was written but none verified on any drive, 1 no
# archive was written anywhere. 3 still means a usable backup exists; only 1 and
# 4 mean the repo has no archive you can trust.
_archive_repo() {
    local repo="$1"
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
        warn "repo $repo: an archive was written but failed verification on every drive; run: backup check $repo"
        return 4
    fi
    warn "repo $repo not archived to any drive"
    return 1
}

cmd_archive() {
    (( $# <= 1 )) || die_usage "backup archives all repos, or one named repo; run 'backup --help' for the subcommands"
    local only=""
    (( $# == 1 )) && only="$1"
    need borg; need mountpoint
    parse_config
    _require_repos_valid
    if [[ -n "$only" ]]; then
        _repo_declared "$only" \
            || die_usage "$only is not a configured repo or a known subcommand; run 'backup --help' for the list"
    fi

    local -a run_repos=()
    if [[ -n "$only" ]]; then run_repos=("$only"); else run_repos=("${REPOS[@]}"); fi

    # Check drives before touching the passphrase. A repo that would archive is
    # archive-on and holding backup_data, the same test the preflight and the
    # loop below apply; a drive counts as available when it is mounted, exactly as
    # _check_usb and _archive_one_drive judge it. If repos would archive but none
    # of their drives is mounted, fail here, before decrypting the passphrase (for
    # a GPG file that is a prompt or a hardware-token touch). If nothing would
    # archive at all (every repo archive-off or awaiting data), skip the
    # passphrase entirely and let the run below report that and exit. Only a run
    # that can actually write an archive loads the passphrase.
    local _r _d _has_target=0 _any_drive=0
    local -a _want_drives=()
    for _r in "${run_repos[@]}"; do
        _repo_archives "$_r" || continue
        [[ -n "${REPO_SRC[$_r]:-}" ]] || continue
        _has_target=1
        # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
        for _d in ${REPO_DRIVES[$_r]}; do
            _want_drives+=("$_d")
            mountpoint -q "$MOUNT_BASE/$_d" && _any_drive=1
        done
    done
    if (( _has_target && ! _any_drive )); then
        local _uniq
        _uniq=$(printf '%s\n' "${_want_drives[@]}" | awk '!seen[$0]++' | paste -sd' ' -)
        die "no drives mounted for the repo(s) to back up (looked for: ${_uniq}); plug one in and re-run"
    fi
    (( _has_target )) && _archive_pass_preflight
    # In single-repo mode only this repo's missing-passphrase status should
    # colour the run; another repo lacking a passphrase is not this run's error.
    if [[ -n "$only" ]]; then
        local -a _keep=() _x
        for _x in "${PASS_SKIPPED[@]}"; do [[ "$_x" == "$only" ]] && _keep+=("$_x"); done
        PASS_SKIPPED=("${_keep[@]}")
    fi

    _acquire_lock

    RUN_DEDUP_BYTES=0
    RUN_REPO_DEDUP_COUNTED=()
    local script_start repo r rc=0
    # Each repo lands in one outcome by name. A partial repo is listed in both
    # backed_up and partial: it has a usable archive on a drive (so it counts as
    # backed up) and is also flagged for the drive it missed or that failed.
    local -a backed_up=() partial=() unverified=() failed=() awaiting_data=() archive_off=()
    script_start=$(date +%s)
    for repo in "${run_repos[@]}"; do
        if ! _repo_archives "$repo"; then
            say "skipping archive-off repo $repo"
            archive_off+=("$repo")
            continue
        fi
        if [[ -z "${REPO_SRC[$repo]:-}" ]]; then
            say "skipping $repo: no backup_data yet (awaiting data)"
            awaiting_data+=("$repo")
            continue
        fi
        _repo_has_pass "$repo" || continue   # no stored passphrase; warned and counted via PASS_SKIPPED in the preflight
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
    # every archived repo: a missing archive, an unverified one, a backed-up repo
    # that missed a drive, or an archived repo skipped for a missing passphrase.
    # Archive-off and awaiting-data repos are intentional and never an error.
    if (( ${#failed[@]} > 0 || ${#unverified[@]} > 0 || ${#partial[@]} > 0 || ${#PASS_SKIPPED[@]} > 0 )); then
        rc=1
    fi

    if (( ${#backed_up[@]} == 0 && ${#failed[@]} == 0 && ${#unverified[@]} == 0 && ${#PASS_SKIPPED[@]} == 0 && ${#awaiting_data[@]} == 0 )); then
        if [[ -n "$only" ]]; then
            say "$only is archive-off; set 'archive yes' or remove its 'archive no' line in $CONFIG_FILE"
        else
            say "all configured repos are archive-off; nothing to back up"
        fi
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
    extra+=$(_group "awaiting data" "${awaiting_data[@]}")
    extra+=$(_group "archive off"   "${archive_off[@]}")
    if (( rc == 0 )); then
        printf 'backed up and verified %d %s%s, +%s in %s%s, %s\n' \
            "${#backed_up[@]}" "$noun" "$backed_names" "$added" "$dur" "$extra" "$ts"
    else
        printf 'completed with errors: backed up and verified %d %s%s, +%s in %s%s, %s\n' \
            "${#backed_up[@]}" "$noun" "$backed_names" "$added" "$dur" "$extra" "$ts"
    fi
    exit "$rc"
}

## ─── extract: restore ─────────────────────────────────────────────────
_spec_lists_first() {
    local spec="$1"
    [[ -z "$spec" || "$spec" =~ ^-[0-9]+$ ]]
}

# Resolve a spec to a concrete archive name, with BORG_REPO already set. Empty
# or -1 is the latest; -N is N back; anything else is a literal archive name.
_resolve_archive() {
    local what="$1" spec="$2"
    if [[ -z "$spec" || "$spec" == "-1" ]]; then
        local latest
        latest=$(borg list ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --last 1 --short) || { warn "could not list $what, aborting"; return 1; }
        [[ -n "$latest" ]] || { warn "no archives found in $what, aborting"; return 1; }
        printf '%s\n' "$latest"
    elif [[ "$spec" =~ ^-([0-9]+)$ ]]; then
        local n="${BASH_REMATCH[1]}"
        (( n >= 1 )) || { warn "invalid -N: '$spec' (use -1, -2, ...)"; return 1; }
        local listing arr=()
        listing=$(borg list ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --last "$n" --short) || { warn "could not list $what, aborting"; return 1; }
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
        if _spec_lists_first "$spec"; then
            warn "borg will prompt for the passphrase to $resolved twice: once to list, once to extract (expected)."
        else
            warn "borg will prompt for the passphrase to $resolved."
        fi
    fi
    local archive; archive=$(_resolve_archive "$resolved" "$spec") || return 1
    local dest="$PWD"
    if (( ${#paths[@]} > 0 )); then
        say "extracting ${#paths[@]} path(s) from $resolved (archive: $archive) into $dest..."
        if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "${paths[@]}"; then
            say "restored ${#paths[@]} path(s) into $dest:"; local p; for p in "${paths[@]}"; do say "  $p"; done; return 0
        fi
        warn "extraction from $resolved failed; see borg output above"; return 1
    fi
    say "extracting $resolved (archive: $archive) into $dest..."
    if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive"; then say "restored $resolved into $dest"; return 0; fi
    warn "extraction from $resolved failed; see borg output above"; return 1
}

# Restore one repo's folders to their original parent directories. BORG_REPO
# and BORG_PASSPHRASE must already be set. Returns non-zero on any failure.
_restore_folders_in_place() {
    local repo="$1" archive="$2" drive="$3"
    say "restoring $repo (archive: $archive) in place from $drive..."
    # An in-place restore that covers ~/.borg-config or the passphrase file
    # would overwrite the running tool's own inputs. This run is unaffected (it
    # holds them in memory), but snapshot and warn so you re-check before the next.
    local cfg_before="" pass_before=""
    if [[ -e "$CONFIG_FILE" ]]; then cfg_before=$(sha256sum -- "$CONFIG_FILE" 2>/dev/null) || true; fi
    if [[ -n "$PASSPHRASE_PATH" && -e "$PASSPHRASE_PATH" ]]; then pass_before=$(sha256sum -- "$PASSPHRASE_PATH" 2>/dev/null) || true; fi
    local rc=0 src parent base
    while IFS= read -r src; do
        [[ -n "$src" ]] || continue
        parent=$(dirname "$src"); base=$(basename "$src")
        [[ -n "$SRC_HOME" ]] && parent="${parent/#"$SRC_HOME"/$HOME}"
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

# Confirm a destructive in-place restore. -y or an interactive yes proceeds; no
# tty without -y fails closed, so a scripted run never overwrites in place silently.
_confirm_in_place() {
    local assume_yes="$1" ans
    (( assume_yes )) && return 0
    [[ -t 0 ]] || die "in-place restore overwrites files at their original locations; re-run with -y to confirm (no terminal to prompt)"
    read -rp "in-place restore overwrites files at their original locations; continue? [y/N] " ans
    [[ "$ans" == [Yy] || "$ans" == [Yy][Ee][Ss] ]] || die "aborted"
}

# True if the path is a directory holding at least one entry.
_dir_nonempty() {
    [[ -d "$1" ]] || return 1
    local out
    out=$(ls -A -- "$1" 2>/dev/null) || true
    [[ -n "$out" ]]
}

cmd_extract() {
    (( $# >= 1 )) || die_usage "backup extract needs a repo, a repo path, or --all-repos (try: backup extract <repo> [--path <folder>]... [-N | <archive>] [--in-place | -i])"
    need borg
    local paths=() args=() in_place=0 all_repos=0 assume_yes=0
    while (( $# > 0 )); do
        case "$1" in
            -i|--in-place) in_place=1; shift ;;
            -a|--all-repos) all_repos=1; shift ;;
            -y|--yes) assume_yes=1; shift ;;
            --path)
                (( $# >= 2 )) || die_usage "--path needs a value"
                [[ -n "$2" ]]  || die_usage "--path value must not be empty"
                paths+=("$2"); shift 2 ;;
            --path=*) die_usage "use '--path <value>'; '--path=value' is not supported" ;;
            -[0-9]*) args+=("$1"); shift ;;                 # -N archive spec (e.g. -3); validated downstream
            -[aiy][aiy]*)                                    # stacked value-less shorts: -ai, -yi, ...
                local _cl="${1#-}" _k _ch
                for ((_k=0; _k<${#_cl}; _k++)); do
                    _ch="${_cl:_k:1}"
                    case "$_ch" in
                        i) in_place=1 ;;
                        a) all_repos=1 ;;
                        y) assume_yes=1 ;;
                        *) die_usage "unknown flag: -$_cl (in stacked shorts, only a, i, y combine)" ;;
                    esac
                done
                shift ;;
            -*) die_usage "unknown flag: $1" ;;
            *) args+=("$1"); shift ;;
        esac
    done

    # --all-repos: every repo with a mounted drive and a stored passphrase. -i
    # restores in place, else into a per-repo subdir of RESTORE_PATH. archive no
    # gates archiving, not restore, so archive-off repos are included.
    if (( all_repos )); then
        (( ${#paths[@]} == 0 )) || die_usage "--all-repos restores whole repos; drop --path"
        local spec=""
        if (( ${#args[@]} == 1 )); then
            [[ "${args[0]}" =~ ^-[0-9]+$ ]] || die_usage "--all-repos takes no repo name, only an optional -N archive spec; got '${args[0]}'"
            spec="${args[0]}"
        elif (( ${#args[@]} > 1 )); then
            die_usage "--all-repos takes at most one -N archive spec; got ${#args[@]} positional arguments"
        fi
        need mountpoint
        parse_config
        _require_repos_valid
        if (( ! in_place )); then
            [[ -n "$RESTORE_PATH" ]] || die "RESTORE_PATH is not set in $CONFIG_FILE"
            [[ -d "$RESTORE_PATH" ]] || die "RESTORE_PATH '$RESTORE_PATH' is not a directory; create it first"
        fi
        if (( in_place )); then _confirm_in_place "$assume_yes"; fi
        local rc=0 r d drive probe
        local -a restored=() skipped=() failed=()
        for r in "${REPOS[@]}"; do
            drive=""
            # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
            for d in ${REPO_DRIVES[$r]}; do
                mountpoint -q "$MOUNT_BASE/$d" || continue
                probe=$(_repo_path "$d" "$r")
                [[ -d "$probe" ]] && { drive="$d"; break; }
            done
            if [[ -z "$drive" ]]; then skipped+=("$r (no mounted drive)"); continue; fi
            if ! _repo_has_pass "$r"; then skipped+=("$r (no stored passphrase)"); continue; fi
            if (( ! in_place && ! assume_yes )) && _dir_nonempty "$RESTORE_PATH/$r"; then
                skipped+=("$r (target $RESTORE_PATH/$r not empty; -y to overwrite)"); continue
            fi
            if (
                export BORG_REPO BORG_PASSCOMMAND
                # shellcheck disable=SC2030  # subshell-local by design: each drive runs in its own (...), so its borg env never reaches the parent
                BORG_REPO=$(_repo_path "$drive" "$r")
                _set_read_lock "$BORG_REPO"
                # shellcheck disable=SC2030
                pc=$(_repo_passcommand "$r"); [[ -n "$pc" ]] && BORG_PASSCOMMAND="$pc"
                a=$(_resolve_archive "$BORG_REPO" "$spec") || exit 1
                if (( in_place )); then
                    _restore_folders_in_place "$r" "$a" "$drive"
                else
                    dest="$RESTORE_PATH/$r"
                    mkdir -p "$dest" || { warn "cannot create $dest"; exit 1; }
                    say "extracting $r (archive: $a) from $drive into $dest..."
                    cd "$dest" || { warn "cannot cd to $dest"; exit 1; }
                    if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$a"; then say "restored $r into $dest"
                    else warn "extraction of $r failed; see borg output above"; exit 1; fi
                fi
            ); then restored+=("$r"); else rc=1; failed+=("$r"); fi
        done
        say ""
        local where="in place"; (( in_place )) || where="under $RESTORE_PATH"
        say "restored $where: ${restored[*]:-none}"
        (( ${#failed[@]} == 0 ))  || warn "failed: ${failed[*]} (see output above)"
        (( ${#skipped[@]} == 0 )) || warn "skipped: ${skipped[*]}"
        if (( ${#restored[@]} == 0 && rc == 0 )); then
            die "no eligible repos to restore (need a mounted drive and a stored passphrase)"
        fi
        exit "$rc"
    fi

    (( ${#args[@]} >= 1 )) || die_usage "backup extract needs a repo name, a repo path, or --all-repos"

    # Path mode: a first argument with a slash is a repo path, and so is every
    # argument when there is no config; borg prompts, extract lands in PWD.
    if [[ "${args[0]}" == */* ]] || [[ ! -e "$CONFIG_FILE" ]]; then
        (( ! in_place )) || die_usage "--in-place needs a configured repo, not a repo path"
        local repo="${args[0]}" spec=""
        if (( ${#args[@]} >= 2 )); then
            [[ "${args[1]}" == */* ]] && die_usage "path mode extracts one repo at a time; '${args[1]}' looks like a second path"
            spec="${args[1]}"
        fi
        (( ${#args[@]} <= 2 )) || die_usage "path mode takes one repo path and at most one archive spec; got ${#args[@]}"
        local rc=0
        if (( ${#paths[@]} > 0 )); then
            _borgex_path "$repo" "$spec" "${paths[@]}" || rc=1
        else
            _borgex_path "$repo" "$spec" || rc=1
        fi
        exit "$rc"
    fi

    # Label mode.
    need mountpoint
    parse_config
    _require_repos_valid

    local repo="${args[0]}" spec=""
    _repo_declared "$repo" || die "$repo is not a configured repo (check $CONFIG_FILE)"
    if (( ${#args[@]} == 2 )); then
        spec="${args[1]}"
    elif (( ${#args[@]} > 2 )); then
        die_usage "extract takes one repo and at most one archive spec; got ${#args[@]} positional arguments"
    fi

    # Find a mounted drive that actually has this repo.
    local drive="" d probe
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for d in ${REPO_DRIVES[$repo]}; do
        if ! mountpoint -q "$MOUNT_BASE/$d"; then warn "$d not mounted"; continue; fi
        probe=$(_repo_path "$d" "$repo")
        if [[ -d "$probe" ]]; then drive="$d"; break; fi
        warn "no $repo repo on $d"
    done
    [[ -n "$drive" ]] || die "no mounted drive has the $repo repo"

    # shellcheck disable=SC2031  # a fresh per-call local -x; SC2031's cross-reference to the extract subshell is spurious
    local -x BORG_REPO; BORG_REPO=$(_repo_path "$drive" "$repo")
    _set_read_lock "$BORG_REPO"
    # shellcheck disable=SC2031
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    if [[ -z "${BORG_PASSPHRASE:-}" && -z "${BORG_PASSPHRASE_FD:-}" && -z "${BORG_PASSCOMMAND:-}" ]]; then
        if _spec_lists_first "$spec"; then
            warn "no stored passphrase for $repo; borg will prompt twice: once to list, once to extract."
        else
            warn "no stored passphrase for $repo; borg will prompt."
        fi
    fi

    local archive
    archive=$(_resolve_archive "$BORG_REPO" "$spec") || exit 1

    if (( in_place )); then
        (( ${#paths[@]} == 0 )) || die_usage "--in-place restores whole folders to their origins; drop --path"
        _confirm_in_place "$assume_yes"
        local rc=0
        _restore_folders_in_place "$repo" "$archive" "$drive" || rc=$?
        exit "$rc"
    fi

    [[ -n "$RESTORE_PATH" ]] || die "RESTORE_PATH is not set in $CONFIG_FILE"
    [[ -d "$RESTORE_PATH" ]] || die "RESTORE_PATH '$RESTORE_PATH' is not a directory; create it first"
    cd "$RESTORE_PATH" || die "cannot cd to $RESTORE_PATH"
    local rc=0
    if (( ${#paths[@]} > 0 )); then
        say "extracting ${#paths[@]} path(s) from $repo on $drive (archive: $archive) into $RESTORE_PATH..."
        if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive" "${paths[@]}"; then
            say "restored into $RESTORE_PATH:"; local pp; for pp in "${paths[@]}"; do say "  $pp"; done
        else
            warn "extraction of $repo failed; see borg output above"; rc=1
        fi
    else
        if (( ! assume_yes )); then
            local sp present=() b
            while IFS= read -r sp; do
                [[ -n "$sp" ]] || continue
                b=$(basename "$sp")
                [[ -e "$RESTORE_PATH/$b" ]] && present+=("$b")
            done <<< "${REPO_SRC[$repo]}"
            (( ${#present[@]} == 0 )) || die "$RESTORE_PATH already contains: ${present[*]}; clear them or pass -y to overwrite"
        fi
        say "extracting $repo from $drive (archive: $archive) into $RESTORE_PATH..."
        if borg extract ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} --progress "::$archive"; then
            say "restored $repo into $RESTORE_PATH"
        else
            warn "extraction of $repo failed; see borg output above"; rc=1
        fi
    fi
    exit "$rc"
}

## ─── check: deep-verify a repo on every drive ─────────────────────────
# Fresh function scope per call so BORG_PASSPHRASE never leaks between repos.
_check_one() {
    local repo="$1" dir="$2"
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo"); [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    _set_read_lock "$dir"
    borg check ${RO_LOCKOPT[@]+"${RO_LOCKOPT[@]}"} "$dir"
}

cmd_check() {
    (( $# <= 1 )) || die_usage "usage: backup check [repo]"
    need borg; need mountpoint
    parse_config
    _require_repos_valid
    local -a todo=()
    if (( $# == 1 )); then
        _repo_declared "$1" || die "$1 is not a configured repo (check $CONFIG_FILE)"
        todo=("$1")
    else
        todo=("${REPOS[@]}")
    fi
    local repo drive dir rc=0 checked
    for repo in "${todo[@]}"; do
        checked=0
        # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
        for drive in ${REPO_DRIVES[$repo]}; do
            if ! mountpoint -q "$MOUNT_BASE/$drive"; then warn "$drive not mounted"; continue; fi
            dir=$(_repo_path "$drive" "$repo")
            if [[ ! -d "$dir" ]]; then warn "no $repo repo on $drive"; continue; fi
            say "checking $repo on $drive (reads the whole repo, may be slow)..."
            if _check_one "$repo" "$dir"; then say "$repo on $drive: ok"; checked=1
            else warn "$repo on $drive: FAILED check"; rc=1; checked=1; fi
        done
        (( checked )) || warn "no mounted drive had the $repo repo to check"
    done
    exit "$rc"
}

## ─── pass-change: rotate a repo's passphrase ──────────────────────────
_rotate_one() {
    local repo="$1" dir="$2"
    local -x BORG_REPO="$dir"
    local pc; pc=$(_repo_passcommand "$repo")
    [[ -n "$pc" ]] && local -x BORG_PASSCOMMAND="$pc"
    borg key change-passphrase "$dir"
}

cmd_pass_change() {
    (( $# == 1 )) || die_usage "usage: backup pass-change <repo>"
    local repo="$1"
    need borg; need mountpoint
    parse_config
    _require_repos_valid
    _repo_declared "$repo" || die "$repo is not a configured repo (check $CONFIG_FILE)"
    [[ -t 0 ]] || die "pass-change prompts for the new passphrase; no terminal to prompt. Run interactively."

    _acquire_lock

    local ready=() unmounted=() no_repo=() drive dir
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for drive in ${REPO_DRIVES[$repo]}; do
        dir=$(_repo_path "$drive" "$repo")
        if ! mountpoint -q "$MOUNT_BASE/$drive"; then unmounted+=("$drive")
        elif [[ ! -d "$dir" ]]; then no_repo+=("$drive")
        else ready+=("$drive"); fi
    done
    (( ${#unmounted[@]} == 0 )) || die "all drives for $repo must be mounted; missing: ${unmounted[*]}"
    (( ${#no_repo[@]} == 0 )) || warn "drives without a $repo repo (skipped): ${no_repo[*]}"
    (( ${#ready[@]} > 0 )) || die "no drives have a $repo repo; nothing to rotate"
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

## ─── rename: rename a repo across drives ──────────────────────────────
cmd_rename() {
    (( $# == 2 )) || die_usage "usage: backup rename <old-repo> <new-name>"
    local old="$1" new="$2"
    [[ "$old" != "$new" ]] || die_usage "old and new names are the same: $old"
    _validate_segment "new repo name" "$new"
    _reject_reserved_name "$new"
    need mountpoint
    parse_config
    _require_repos_valid
    _repo_declared "$old" || die "$old is not a configured repo (check $CONFIG_FILE)"
    ! _repo_declared "$new" || die "$new is already a configured repo; pick a different new name"

    _acquire_lock

    local ready=() unmounted=() no_repo=() collide=() drive od nd
    # shellcheck disable=SC2086  # space-joined validated drive tokens; intentional split
    for drive in ${REPO_DRIVES[$old]}; do
        od=$(_repo_path "$drive" "$old"); nd=$(_repo_path "$drive" "$new")
        if ! mountpoint -q "$MOUNT_BASE/$drive"; then unmounted+=("$drive")
        elif [[ ! -d "$od" ]]; then no_repo+=("$drive")
        elif [[ -e "$nd" ]]; then collide+=("$drive")
        else ready+=("$drive"); fi
    done
    (( ${#unmounted[@]} == 0 )) || die "all drives for $old must be mounted; missing: ${unmounted[*]}"
    (( ${#collide[@]} == 0 )) || die "new name $new already exists on: ${collide[*]}; pick another"
    (( ${#no_repo[@]} == 0 )) || warn "drives without a $old repo (skipped): ${no_repo[*]}"
    if (( ${#ready[@]} == 0 )); then
        say "no on-disk archives for $old; updating config and passphrase only."
    else
        say "will rename $old -> $new on: ${ready[*]}"
    fi

    local renamed=() failed=()
    for drive in "${ready[@]}"; do
        od=$(_repo_path "$drive" "$old"); nd=$(_repo_path "$drive" "$new")
        if mv -T "$od" "$nd"; then say "renamed on $drive"; renamed+=("$drive")
        else warn "rename failed on $drive"; failed+=("$drive"); fi
    done
    if (( ${#failed[@]} > 0 )); then
        warn "drives renamed: ${renamed[*]:-none}"
        warn "drives still on old name: ${failed[*]}"
        warn "config and passphrase file NOT updated; rename those back with:"
        warn "  mv $MOUNT_BASE/<drive>${REPO_SUBDIR:+/$REPO_SUBDIR}/$new $MOUNT_BASE/<drive>${REPO_SUBDIR:+/$REPO_SUBDIR}/$old"
        exit 1
    fi
    _update_pass_label "$old" "$new"
    _update_repo_name "$old" "$new"
    say "done; renamed on ${#renamed[@]} drive(s); config and passphrase file updated."
}

## ─── help and dispatch ────────────────────────────────────────────────
usage() {
    cat <<'EOF'
backup: encrypted, versioned borg backups to USB drives

  backup                       back up every repo
  backup <repo>                back up one repo
  backup init <repo> <path>... [--drives <labels>...]
                               create a repo: write its config block, store its
                               passphrase, then create it on the drives
  backup init [repo]           create already-configured repos (all, or one)
  backup extract <repo>        restore a repo's latest snapshot to RESTORE_PATH
  backup extract <repo> -i     restore in place, to the folders it came from
  backup extract --all-repos   restore every eligible repo (-a; add -i for in place)
  backup check [repo]          deep-verify a repo on each mounted drive
  backup pass-change <repo>    change a repo's passphrase (needs all its drives)
  backup rename <old> <new>    rename a repo (needs all its drives)
  backup --help, -h            this list

Retention, excludes, includes, compression, enable/disable, and adding or removing
folders are now ~/.borg-config directives, not subcommands; see the guide. To remove
a repo, comment or delete its block in ~/.borg-config (its archives on the drives and
its set_pass line are left untouched; delete those by hand).
A repo you cannot write (another user's files or read-only media) is read with
borg's lock bypassed automatically, with a warning.
SRC_HOME in the config makes an in-place restore remap that home prefix to yours.
Config format, setup, the passphrase file, and cron use: see the guide.
EOF
}

# Hidden self-test, run before treating a version final (alongside shellcheck). The
# subcommand list, the dispatch case, and the help banner are three hand-kept things,
# so assert every SUBCOMMANDS entry has a cmd_ handler and a line in the banner.
_selfcheck() {
    local w fn rc=0 help_text
    help_text=$(usage)
    for w in "${SUBCOMMANDS[@]}"; do
        fn="cmd_${w//-/_}"
        declare -F "$fn" >/dev/null || { warn "no handler $fn for subcommand '$w'"; rc=1; }
        grep -qw -- "$w" <<<"$help_text" || { warn "subcommand '$w' missing from help banner"; rc=1; }
    done
    (( rc == 0 )) && say "selfcheck ok (${#SUBCOMMANDS[@]} subcommands)"
    return "$rc"
}

main() {
    [[ $- == *x* ]] && die "refusing to run under bash -x: it would trace passphrases; debug with a targeted set -x around a non-secret section"
    # Personal tool: bare 'backup' runs the archive directly, no confirm, under
    # the spec's CLI carve-out; an unknown bare token is treated as a repo name.
    case "${1:-}" in
        _emit-pass)  shift; _emit_pass "$@" ;;   # hidden: borg's passcommand re-invokes this to print one repo's passphrase
        _pass-names) shift; _pass_names "$@" ;;  # hidden: prints repo names that have a stored passphrase
        _selfcheck)  _selfcheck ;;               # hidden: assert the dispatch table is internally consistent
        -h|--help|help) usage ;;
        init)        shift; cmd_init "$@" ;;
        extract)     shift; cmd_extract "$@" ;;
        check)       shift; cmd_check "$@" ;;
        pass-change) shift; cmd_pass_change "$@" ;;
        rename)      shift; cmd_rename "$@" ;;
        "")          cmd_archive ;;
        -*)          die_usage "unknown option: $1 (try: backup --help)" ;;
        *)           cmd_archive "$1" ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

```

## The super-simple script

This script is a single small script for the bare case: archive one folder to one drive, or extract one repo from one drive.
The main motivation is that experts can review quickly the core functions.
It has no repo list, no retention, no in-place restore, no config file.

```console
backup-simple <folder> <drive>     archive <folder> into the drive's repo
backup-simple -e <name> <drive>    extract repo <name> from the drive, into $PWD
backup-simple -h                   help
```

Its three settings live at the top of the file: `MOUNT_BASE`, `REPO_SUBDIR`, and `PASSPHRASE_PATH`.
Point `PASSPHRASE_PATH` at the same combined passphrase file the full tool uses; backup-simple reads one repo's `set_pass` line from it the same way, through `BORG_PASSCOMMAND`.
Set the three to match your full config so both tools see the same repos.

```
#!/bin/bash
# backup-really-simple
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
```