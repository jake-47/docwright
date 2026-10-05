<div class="mdb-wide"></div>

# Git history delete
<p class="mdb-subtitle">Script to permanently purge files from a git repo</p>

The script below removes files you've already deleted from every commit in a Git repo, so they're gone from its history and not just from the latest version. Use it when a file has to vanish completely, like private notes in a repo you're about to make public. It skips anything still tracked on a branch or tag, so delete the file and commit that first. It wraps `git filter-repo` and rewrites history: every commit from the first one with that file gets a new hash, and you force-push afterwards. If the file held a password or a key, change that first; purging doesn't undo a leak, and [Never commit secrets](./gitconcepts.md#never-commit-secrets) explains why. For details, see [Purging files from history](./gitreference.md#purging-files-from-history) in Git reference.

1. Verify script: read it through before you run it.
2. Copy and save script as `gitdel.sh`.
3. Back up the repo's history: `tar -czf ~/myrepo-git.tar.gz -C ~/projects/myrepo .git`. It prints nothing. If the purge goes wrong, this is your way back; the branch tips the script prints aren't, because filter-repo deletes the old commits as it finishes.
4. Do a dry run: `bash gitdel.sh ~/projects/myrepo --dry-run`. It lists the files it would purge and ends with `Dry-run complete. No changes made.` If something you want to keep is on the list, stop here. If it stops early because `git-filter-repo` isn't installed or you have uncommitted changes, it says what to do.
5. Run `bash gitdel.sh ~/projects/myrepo --save-list ~/Downloads/purge_log.txt`. It prints the same list, a WARNING block, and `Proceed? This rewrites history and cannot be undone. (y/n):`. Type `y`. The filter-repo lines that follow are normal, including a NOTICE that it removed `origin`. It ends with `Done. Git history has been rewritten.` and the `git remote add` and `git push --force` commands for your repo.
6. Run those commands. The branch push shows `(forced update)`; the tag push may only say `Everything up-to-date`, which is fine. Anyone else with a copy of the repo needs to clone it again.

````bash
#!/bin/bash
# purge-deleted, v3
#
# Permanently purge files from git history using git-filter-repo.
# Auto-detects deleted files across all refs, or accepts an explicit
# path list. Rename-aware: walks rename chains and skips chains whose
# final destination is still tracked.

set -euo pipefail

if (( BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 3) )); then
    echo "error: bash 4.3 or newer required (have ${BASH_VERSION})" >&2
    exit 1
fi

VERSION_LINE=$(sed -n '2s/^# //p' "${BASH_SOURCE[0]}")
readonly VERSION_LINE

# ---- Logging ----------------------------------------------------------------
# Graded log set per script-spec rule 29. Info/debug to stdout; warn/error to
# stderr. --quiet/-q suppresses info and below; --verbose/-v enables debug.
# say/die remain available; say aliases log_info, die routes through
# log_error and exits non-zero.

VERBOSITY=info  # quiet | error | warn | info | debug

_should_log() {
    local level=$1
    case "$VERBOSITY" in
        quiet) [[ "$level" == "error" ]] ;;
        error) [[ "$level" == "error" ]] ;;
        warn)  [[ "$level" == "error" || "$level" == "warn" ]] ;;
        info)  [[ "$level" != "debug" ]] ;;
        debug) true ;;
    esac
}

log_info()  { if _should_log info;  then echo "$*";              fi; }
log_warn()  { if _should_log warn;  then echo "warn: $*"  >&2;   fi; }
log_error() { if _should_log error; then echo "error: $*" >&2;   fi; }
log_debug() { if _should_log debug; then echo "debug: $*";       fi; }
say()       { log_info  "$@"; }
die()       { log_error "$@"; exit 1; }

# Indented list lines at a level's filter and stream, so a list never prints
# under --quiet without the header it belongs to.
log_list() {
    local level=$1; shift
    _should_log "$level" || return 0
    case "$level" in
        warn) printf '  %s\n' "$@" >&2 ;;
        *)    printf '  %s\n' "$@" ;;
    esac
}

# ---- Help / version ---------------------------------------------------------

print_help() {
    cat <<'EOF'
usage: purge-deleted <repo-path> [file-list.txt] [options]

Purge files from git history using git-filter-repo. Without a file
list, auto-detects all files ever deleted across every ref. With a
file list, purges exactly those paths.

Renames: if a deleted file was renamed, the full chain back to its
earliest name is purged. If the chain's final destination is still
tracked on any ref, the entire chain is skipped.

Options:
  -n, --dry-run         print the plan; touch nothing
  -L, --save-list FILE  write the final purge list to FILE
  -R, --save-refs FILE  write pre-rewrite refs snapshot to FILE
                        (default: $XDG_RUNTIME_DIR/purge-deleted-refs-<ts>.txt)
  -y, --yes             skip confirmation (review --dry-run first)
  -q, --quiet           suppress info-level output
  -v, --verbose         enable debug output
      help              show this help (aliases: --help, -h)
      version           show identity string (alias: --version)

Operates on the working repo. Run on a throwaway clone dedicated to
the purge, not the canonical working tree. After the rewrite,
re-add the origin remote (filter-repo removes it by design) and
force-push. The script prints those commands at the end.
EOF
}

print_version() { echo "$VERSION_LINE"; }

# Early dispatch: help / version exit before any side effects.
case "${1:-}" in
    help|--help|-h)    print_help;    exit 0 ;;
    version|--version) print_version; exit 0 ;;
esac

# ---- Argument parsing -------------------------------------------------------

REPO_PATH=""
INPUT=""
DRY_RUN=false
SAVE_LIST=""
SAVE_REFS=""
ASSUME_YES=false

# Fills the repo path, then the list file. Also called for everything after
# '--', so a path that starts with '-' can still be given.
add_positional() {
    if   [[ -z "$REPO_PATH" ]]; then REPO_PATH="$1"
    elif [[ -z "$INPUT"     ]]; then INPUT="$1"
    else die "unexpected argument: $1"
    fi
}

while (( $# > 0 )); do
    case "$1" in
        -n|--dry-run)   DRY_RUN=true; shift ;;
        -L|--save-list) [[ $# -ge 2 ]] || die "--save-list requires an argument"
                        SAVE_LIST="$2"; shift 2 ;;
        -R|--save-refs) [[ $# -ge 2 ]] || die "--save-refs requires an argument"
                        SAVE_REFS="$2"; shift 2 ;;
        -y|--yes)       ASSUME_YES=true; shift ;;
        -q|--quiet)     VERBOSITY=quiet; shift ;;
        -v|--verbose)   VERBOSITY=debug; shift ;;
        help|--help|-h) print_help;    exit 0 ;;
        version|--version) print_version; exit 0 ;;
        --)             shift; break ;;
        -*)             die "unknown flag: $1" ;;
        *)              add_positional "$1"; shift ;;
    esac
done
for arg in "$@"; do add_positional "$arg"; done

[[ -n "$REPO_PATH" ]] || die "missing repo path; help for usage"

# ---- Path resolution (after existence checks) -------------------------------

[[ -d "$REPO_PATH" ]] || die "repo path not found or not a directory: $REPO_PATH"
REPO_PATH=$(realpath "$REPO_PATH")

if [[ -n "$INPUT" ]]; then
    [[ -f "$INPUT" ]] || die "input file not found: $INPUT"
    INPUT=$(realpath "$INPUT")
fi

if [[ -n "$SAVE_LIST" ]]; then
    SAVE_LIST_DIR=$(dirname "$SAVE_LIST")
    [[ -d "$SAVE_LIST_DIR" ]] || die "--save-list parent directory does not exist: $SAVE_LIST_DIR"
    SAVE_LIST="$(realpath "$SAVE_LIST_DIR")/$(basename "$SAVE_LIST")"
fi

if [[ -n "$SAVE_REFS" ]]; then
    SAVE_REFS_DIR=$(dirname "$SAVE_REFS")
    [[ -d "$SAVE_REFS_DIR" ]] || die "--save-refs parent directory does not exist: $SAVE_REFS_DIR"
    SAVE_REFS="$(realpath "$SAVE_REFS_DIR")/$(basename "$SAVE_REFS")"
else
    SAVE_REFS="${XDG_RUNTIME_DIR:-/tmp}/purge-deleted-refs-$(date +%Y%m%d-%H%M%S).txt"
fi

# Reject non-interactive invocation without --yes. The confirm prompt
# reads from /dev/tty; without one we'd hang silently.
if [[ "$DRY_RUN" == false && "$ASSUME_YES" == false && ! -t 0 ]]; then
    die "no controlling tty and --yes not given; refusing to hang on confirmation"
fi

# ---- Dependency checks ------------------------------------------------------

command -v git             >/dev/null 2>&1 || die "git not found"
command -v git-filter-repo >/dev/null 2>&1 || die "git-filter-repo not found. install: sudo apt install git-filter-repo"

# ---- Repo state checks ------------------------------------------------------

cd "$REPO_PATH"

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository: $REPO_PATH"

[[ "$(git rev-parse --is-bare-repository)" == "false" ]] || die "bare repo not supported"

# Reject partial clones (--filter=blob:none and friends). filter-repo
# doesn't handle promisor objects cleanly. Their packs carry a .promisor file.
if [[ -n "$(find "$(git rev-parse --git-path objects/pack)" -maxdepth 1 -name '*.promisor' -print -quit)" ]]; then
    die "partial clone detected (promisor pack present); use a full clone"
fi

# A shallow clone stops at its depth: filter-repo writes the oldest commit it
# has as a root, and force-pushing that replaces the remote's full history.
[[ "$(git rev-parse --is-shallow-repository)" == "false" ]] \
    || die "shallow clone detected; the rewrite would cut history off at its depth; use a full clone"

# Empty repo: nothing to purge and the pre-rewrite anchor would fail.
git rev-parse --verify HEAD >/dev/null 2>&1 || die "repo has no commits; nothing to purge"

GIT_ROOT=$(realpath "$(git rev-parse --show-toplevel)")
CWD=$(realpath .)
if [[ "$CWD" != "$GIT_ROOT" ]]; then
    say "switching to repo root: $GIT_ROOT"
    cd "$GIT_ROOT"
fi

git diff --quiet          || die "unstaged changes detected; commit or stash first"
git diff --cached --quiet || die "staged changes detected; commit or stash first"

say "repo: $(pwd -P)"
[[ "$DRY_RUN" == true ]] && say "(dry-run mode -- no changes will be made)"
say ""

# ---- Capture remote URLs before filter-repo removes origin ------------------

declare -A REMOTE_URLS=()
while IFS= read -r remote; do
    [[ -n "$remote" ]] && REMOTE_URLS["$remote"]=$(git remote get-url "$remote")
done < <(git remote)

if (( ${#REMOTE_URLS[@]} == 0 )); then
    log_warn "no remote configured; if this repo is the only copy, the rewrite cannot be undone"
    say ""
fi

# ---- Submodule paths to skip ------------------------------------------------

declare -A SUBMODULE_PATHS=()
if [[ -f ".gitmodules" ]]; then
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*path[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            SUBMODULE_PATHS["${BASH_REMATCH[1]}"]=1
        fi
    done < .gitmodules
fi

# A name filter-repo can take from its path list and a terminal can show: the
# list is one path per line with '==>' meaning a rename, and names arrive raw
# from git (-z), so a control character would reach the terminal unescaped.
_listable() { [[ "$1" != *[[:cntrl:]]* && "$1" != *'==>'* ]]; }

# ---- Rename map across all refs ---------------------------------------------
# RENAMED_FROM: old -> new (one hop). Walked transitively by
# resolve_rename_chain. -M10% catches low-similarity renames, so a live file
# keeps its early history; the cost is that an unrelated file added in the
# same commit can pass for a rename and keep a deleted one out of the purge.
# The dry run lists every such skip.

say "scanning rename history..."
declare -A RENAMED_FROM=()
while IFS= read -r -d '' status; do
    [[ "$status" == R* ]] || continue
    IFS= read -r -d '' old || break
    IFS= read -r -d '' new || break
    if _listable "$old" && _listable "$new"; then
        RENAMED_FROM["$old"]="$new"
    fi
done < <(git log --all --no-merges --no-show-signature -z --pretty=format: \
             --diff-filter=R -M10% --name-status)

# resolve_rename_chain <start>: walk RENAMED_FROM transitively, emit
# each name in order (start ... final). Cycle detection returns 1.
resolve_rename_chain() {
    local current=$1
    local -A visited=()
    while true; do
        if [[ -v visited["$current"] ]]; then
            log_error "rename cycle involving: $current"
            return 1
        fi
        visited["$current"]=1
        echo "$current"
        [[ -v RENAMED_FROM["$current"] ]] || break
        current="${RENAMED_FROM[$current]}"
    done
}

# ---- Tracked-files lookup across all refs -----------------------------------
# filter-repo rewrites all refs, so protection must be all-refs too.
# ls-files only covers HEAD and is insufficient.

say "building tracked-files lookup across all refs..."
declare -A TRACKED_SET=()
while IFS= read -r -d '' f; do
    [[ -n "$f" ]] || continue
    TRACKED_SET["$f"]=1
    # filter-repo takes a listed path as a directory too, so the directories
    # holding tracked files are protected the same way the files are.
    while [[ "$f" == */* ]]; do
        f=${f%/*}
        [[ -v TRACKED_SET["$f"] ]] && break
        TRACKED_SET["$f"]=1
    done
done < <(
    git for-each-ref --format='%(refname)' | while IFS= read -r ref; do
        git ls-tree -r -z --name-only "$ref" 2>/dev/null || true
    done | sort -zu
)

# ---- Collect files to purge -------------------------------------------------

declare -A PURGE_SET=()
PURGE=()
declare -A SKIPPED_TRACKED_SET=()
SKIPPED_TRACKED=()
declare -A SKIPPED_EXISTS_SET=()
SKIPPED_EXISTS=()
declare -A SKIPPED_SUBMODULE_SET=()
SKIPPED_SUBMODULE=()
declare -A SKIPPED_RENAMED=()  # old_path -> live final destination

add_to_purge() {
    local name=$1
    [[ -v PURGE_SET["$name"] ]] && return
    PURGE_SET["$name"]=1
    PURGE+=("$name")
}

# _path_safe <path>: reject absolute paths and any path containing a
# `..` component. Returns 0 if safe, 1 otherwise.
_path_safe() {
    local p=$1
    if [[ "$p" == /* ]]; then return 1; fi
    local IFS=/
    local seg
    for seg in $p; do
        if [[ "$seg" == ".." ]]; then return 1; fi
    done
    return 0
}

validate_and_collect() {
    local f=$1

    if ! _listable "$f"; then
        log_warn "skipping a name with a control character or '==>', which this does not handle: $(printf '%q' "$f")"
        return
    fi

    if ! _path_safe "$f"; then
        die "unsafe input path (absolute or contains '..'): $f"
    fi

    if [[ -v TRACKED_SET["$f"] ]]; then
        if [[ ! -v SKIPPED_TRACKED_SET["$f"] ]]; then
            SKIPPED_TRACKED_SET["$f"]=1
            SKIPPED_TRACKED+=("$f")
        fi
        return
    fi

    if [[ -e "$f" ]]; then
        if [[ ! -v SKIPPED_EXISTS_SET["$f"] ]]; then
            SKIPPED_EXISTS_SET["$f"]=1
            SKIPPED_EXISTS+=("$f")
        fi
        return
    fi

    if [[ -v SUBMODULE_PATHS["$f"] ]]; then
        if [[ ! -v SKIPPED_SUBMODULE_SET["$f"] ]]; then
            SKIPPED_SUBMODULE_SET["$f"]=1
            SKIPPED_SUBMODULE+=("$f")
        fi
        return
    fi

    if [[ -v RENAMED_FROM["$f"] ]]; then
        local chain=()
        local chain_ok=true
        while IFS= read -r name; do
            chain+=("$name")
        done < <(resolve_rename_chain "$f") || chain_ok=false

        if [[ "$chain_ok" == false ]]; then
            log_warn "skipping '$f' due to rename cycle in history"
            return
        fi

        local final="${chain[-1]}"
        if [[ -v TRACKED_SET["$final"] ]]; then
            SKIPPED_RENAMED["$f"]="$final"
        else
            local name
            for name in "${chain[@]}"; do
                if [[ -v TRACKED_SET["$name"] ]]; then
                    log_warn "intermediate rename name '$name' is tracked; skipping that name only"
                else
                    add_to_purge "$name"
                fi
            done
        fi
        return
    fi

    add_to_purge "$f"
}

if [[ -n "$INPUT" ]]; then
    say "reading file list from: $INPUT"
    # The || test keeps a last line that has no newline after it.
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        line="${line#./}"
        line="${line%/}"   # directories are looked up without the slash
        [[ -z "$line" || "$line" == \#* ]] && continue
        validate_and_collect "$line"
    done < "$INPUT"
else
    say "scanning git history for deleted files (all refs)..."
    # --no-renames lists a name that was renamed away as deleted too, so the
    # earlier names of a renamed-then-deleted file are purged, not only its last.
    while IFS= read -r -d '' line; do
        [[ -n "$line" ]] && validate_and_collect "$line"
    done < <(git log --all --no-merges --no-show-signature --no-renames -z \
                 --pretty=format: --name-only --diff-filter=D | sort -zu)
fi

# ---- Report skipped files ---------------------------------------------------

if (( ${#SKIPPED_TRACKED[@]} > 0 )); then
    log_warn "${#SKIPPED_TRACKED[@]} file(s) skipped -- tracked on some ref:"
    log_list warn "${SKIPPED_TRACKED[@]}"
fi

if (( ${#SKIPPED_EXISTS[@]} > 0 )); then
    log_warn "${#SKIPPED_EXISTS[@]} file(s) skipped -- exist on disk but not tracked:"
    log_list warn "${SKIPPED_EXISTS[@]}"
fi

if (( ${#SKIPPED_SUBMODULE[@]} > 0 )); then
    log_warn "${#SKIPPED_SUBMODULE[@]} submodule path(s) skipped -- handle manually:"
    log_list warn "${SKIPPED_SUBMODULE[@]}"
fi

if (( ${#SKIPPED_RENAMED[@]} > 0 )); then
    say "${#SKIPPED_RENAMED[@]} file(s) skipped -- renamed in history, live destination tracked:"
    for old in "${!SKIPPED_RENAMED[@]}"; do
        say "  $old  ->  ${SKIPPED_RENAMED[$old]}"
    done
fi

if (( ${#PURGE[@]} == 0 )); then
    say "no files to purge after validation."
    exit 0
fi

# ---- Show purge list --------------------------------------------------------

say ""
say "files to purge from history (${#PURGE[@]} total):"
log_list info "${PURGE[@]}"
say ""

if [[ -n "$SAVE_LIST" ]]; then
    printf '%s\n' "${PURGE[@]}" > "$SAVE_LIST"
    say "purge list saved to: $SAVE_LIST"
fi

if [[ "$DRY_RUN" == true ]]; then
    say "dry-run complete. no changes made."
    exit 0
fi

# ---- Pre-rewrite refs snapshot ----------------------------------------------
# A record of every ref's tip, not a way back: filter-repo expires the reflogs
# and prunes the old objects as it finishes, so the old commits survive only
# in the repo this was cloned from.

git for-each-ref --format='%(objectname) %(refname)' > "$SAVE_REFS"
say "pre-rewrite refs snapshot: $SAVE_REFS"
say "  a record only: the old commits are pruned, so the way back is the repo you cloned from"
say ""

# ---- Confirm and execute ----------------------------------------------------

say "WARNING: git filter-repo --force rewrites history irreversibly."
say "  - other worktrees pointing here will break"
say "  - the origin remote is removed (by design)"
say "  - reflogs are expired and the old objects pruned at once"
say "  if this is not a throwaway clone, stop now."
say ""

if [[ "$ASSUME_YES" == true ]]; then
    say "proceeding without prompt (--yes specified)."
else
    printf "Proceed? rewrites history, cannot be undone. (y/n): " >/dev/tty
    read -r CONFIRM </dev/tty
    [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || die "aborted"
fi

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
# literal: keeps a name that starts with '#', 'glob:' or 'regex:' from being
# read by filter-repo as a comment or a pattern.
printf 'literal:%s\n' "${PURGE[@]}" > "$TMPFILE"

say ""
say "running git filter-repo..."
git filter-repo --invert-paths --force --paths-from-file "$TMPFILE"

say ""
say "done. history rewritten."
say "note: filter-repo removes the origin remote (by design); other remotes are kept."

if (( ${#REMOTE_URLS[@]} > 0 )); then
    say ""
    say "re-add remote(s) and force-push:"
    for remote in $(printf '%s\n' "${!REMOTE_URLS[@]}" | sort); do
        # Adding a remote that is still there fails, so only the removed one.
        git remote get-url "$remote" >/dev/null 2>&1 \
            || say "  git remote add $remote ${REMOTE_URLS[$remote]}"
        say "  git push --force --all $remote"
        say "  git push --force --tags $remote"
    done
fi

say ""
log_warn "automated sync, CI, or backup jobs pointed at the remote will fail"
log_warn "until you force-push. they will not auto-recover -- trigger manually."

```