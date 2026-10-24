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
#!/usr/bin/env bash
set -euo pipefail

# Git delete, v7

## ─── Usage ────────────────────────────────────────────────────────────────────
## To permanently purge files from a git repo in say ~/projects/myrepo, run in terminal:
##   bash gitdel.sh <repo-path> [file-list.txt] [--dry-run] [--save-list <file>] [--yes]
##   example: bash gitdel.sh ~/projects/myrepo --save-list ~/Downloads/purge_log.txt
##
## Without a file list: auto-detects all deleted files in history (all refs).
## With a file list:    purges those files and their other names (see
##                      Renames); same validation rules apply.
## Renames: if a deleted file was renamed, all historical names back to its
##          original are purged. If its final name is still tracked, the
##          entire chain is skipped. Where another file reused a name in the
##          chain, or the chain loops, gitdel warns or skips instead of
##          guessing; check those by hand.
## --dry-run:           shows what would be purged, touches nothing.
## --save-list <file>:  saves the final purge list to a file.
## --yes / -y:          skip the interactive confirm prompt. Use only in
##                      non-interactive contexts where you have already
##                      reviewed the dry-run output.

## ─── Flow ─────────────────────────────────────────────────────────────────────
## 1. Parse arguments into REPO_PATH, INPUT, DRY_RUN, SAVE_LIST, ASSUME_YES.
## 2. Validate dependencies, repo state, and working tree cleanliness.
## 3. Capture remote URLs before filter-repo wipes them.
## 4. Detect submodule paths to skip them during purge.
## 5. Build a rename map in both directions (old -> new, new -> old) across all branches.
## 6. Build a lookup of all currently tracked files across every ref.
## 7. Collect files to purge: from input list or by scanning deleted files in history.
## 8. Validate each candidate: skip tracked, on-disk, submodule, or live-renamed files.
## 9. For renamed files whose final destination is also gone, resolve and purge the full chain, earlier names included.
## 10. Report skipped files, show purge list, optionally save it.
## 11. In dry-run mode, exit here.
## 12. Confirm with user (unless --yes), record pre-rewrite ref tips, run filter-repo, print remote re-add and force-push instructions.

## ─── Scope ────────────────────────────────────────────────────────────────────
## Deletions and renames are scanned across all refs (--all). TRACKED_SET is
## built from the union of every ref's tree, so a file live on any branch,
## tag, or stash is protected from purge.
##
## Merge-only renames (renames recorded only in merge commits) are invisible
## to the rename scan because --no-merges skips them. If you know a file was
## renamed during conflict resolution in a merge commit, list those paths in
## the file list (the second argument).
##
## Rename-similarity threshold is -M10%, which catches low-similarity renames
## at the cost of occasional false positives on repos with many near-identical
## files (generated code, lockfiles). A false positive links two unrelated
## files. If the later one is still tracked, the earlier one is skipped
## (under-purge, the safer direction). If both are deleted, purging either
## one also lists the other; the purge list shows it before you confirm.
##
## Path scans run under core.quotePath=false so that non-ASCII paths are
## emitted verbatim rather than C-quoted; without this a tracked non-ASCII
## file could be misread as untracked and purged, and the purge list handed
## to filter-repo could match nothing. One residual limitation remains: a
## path containing a literal tab or newline byte cannot be round-tripped
## through the newline-delimited scan and is not handled; such paths are
## vanishingly rare and must be purged manually.

## ─── Argument parsing ─────────────────────────────────────────────────────────

REPO_PATH=""
INPUT=""
DRY_RUN=false
SAVE_LIST=""
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --save-list)
            [[ $# -lt 2 ]] && { echo "Error: --save-list requires an argument."; exit 1; }
            SAVE_LIST="$2"
            shift 2
            ;;
        --yes|-y)
            ASSUME_YES=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Usage: bash gitdel.sh <repo-path> [file-list.txt] [--dry-run] [--save-list <file>] [--yes]"
            exit 1
            ;;
        *)
            if [[ -z "$REPO_PATH" ]]; then
                REPO_PATH="$1"
            elif [[ -z "$INPUT" ]]; then
                INPUT="$1"
            else
                echo "Unexpected argument: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

if [[ -z "$REPO_PATH" ]]; then
    echo "Usage: bash gitdel.sh <repo-path> [file-list.txt] [--dry-run] [--save-list <file>] [--yes]"
    exit 1
fi

REPO_PATH="$(realpath "$REPO_PATH")"
[[ -n "$INPUT" ]] && INPUT="$(realpath "$INPUT")"

if [[ -n "$SAVE_LIST" ]]; then
    SAVE_DIR="$(dirname "$SAVE_LIST")"
    [[ ! -d "$SAVE_DIR" ]] && { echo "Error: --save-list parent directory does not exist: $SAVE_DIR"; exit 1; }
    SAVE_LIST="$(realpath "$SAVE_DIR")/$(basename "$SAVE_LIST")"
fi

## ─── Dependency check ─────────────────────────────────────────────────────────

if ! command -v git-filter-repo &>/dev/null; then
    echo "git-filter-repo not found. Install it with:"
    echo "  sudo apt install git-filter-repo"
    exit 1
fi

## ─── Repo validation ──────────────────────────────────────────────────────────

if [[ ! -d "$REPO_PATH" ]]; then
    echo "Repo path not found or not a directory: $REPO_PATH"
    exit 1
fi

cd "$REPO_PATH"

if ! git rev-parse --git-dir &>/dev/null; then
    echo "Not inside a git repository: $REPO_PATH"
    exit 1
fi

GIT_ROOT="$(git rev-parse --show-toplevel)"
if [[ "$(pwd -P)" != "$GIT_ROOT" ]]; then
    echo "Switching to repo root: $GIT_ROOT"
    cd "$GIT_ROOT"
fi

git diff --quiet          || { echo "Unstaged changes detected. Commit or stash them first."; exit 1; }
git diff --cached --quiet || { echo "Staged changes detected. Commit or stash them first."; exit 1; }

echo "Repo: $(pwd -P)"
[[ "$DRY_RUN" == true ]] && echo "(dry-run mode — no changes will be made)"
echo ""

## ─── Capture remote URLs before filter-repo removes them ─────────────────────

declare -A REMOTE_URLS=()
while IFS= read -r remote; do
    url="$(git remote get-url "$remote" 2>/dev/null || true)"
    if [[ -z "$url" ]]; then
        echo "WARNING: remote '$remote' has no URL configured; omitting it from re-add instructions."
        continue
    fi
    REMOTE_URLS["$remote"]="$url"
done < <(git remote)

if [[ ${#REMOTE_URLS[@]} -eq 0 ]]; then
    echo "WARNING: No remote detected. If something goes wrong, history cannot be recovered."
    echo "Consider pushing to a backup remote before proceeding."
    echo ""
fi

## ─── Submodule detection ──────────────────────────────────────────────────────

declare -A SUBMODULE_PATHS=()
if [[ -f ".gitmodules" ]]; then
    ## || [[ -n "$line" ]] keeps a last line that has no newline after it;
    ## without it, read reports end of file and the loop drops that line.
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*path[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            SUBMODULE_PATHS["${BASH_REMATCH[1]}"]=1
        fi
    done < .gitmodules
fi

## ─── Build rename map (across all branches) ───────────────────────────────────
## RENAMED_FROM: old_path -> immediate new_path; RENAMED_TO: the reverse.
## One hop each. RENAME_OUT / RENAME_IN count the distinct names a path was
## renamed to / from; above 1, two files shared that name at different times.
## -F'\t' is required — paths can contain spaces; default awk splitting breaks them.
## -M10% lowers the similarity threshold from the default 50% so that low-similarity
## renames are still detected. This may produce occasional false positives on repos
## with many near-identical files, but missing a rename is worse than a false positive
## here because an undetected rename leaves stale history under the old name.

echo "Scanning rename history..."
declare -A RENAMED_FROM=()
declare -A RENAMED_TO=()
declare -A RENAME_SEEN=()   # old<TAB>new pairs already counted
declare -A RENAME_OUT=()
declare -A RENAME_IN=()

while IFS=$'\t' read -r old new; do
    [[ -z "$old" || -z "$new" ]] && continue
    RENAMED_FROM["$old"]="$new"
    RENAMED_TO["$new"]="$old"
    pair="$old"$'\t'"$new"
    if [[ ! -v RENAME_SEEN["$pair"] ]]; then
        RENAME_SEEN["$pair"]=1
        RENAME_OUT["$old"]=$(( ${RENAME_OUT["$old"]:-0} + 1 ))
        RENAME_IN["$new"]=$(( ${RENAME_IN["$new"]:-0} + 1 ))
    fi
done < <(git -c core.quotePath=false log --all --no-merges --pretty=format: --diff-filter=R -M10% --name-status \
         | awk -F'\t' '/^R[0-9]*\t/{print $2"\t"$3}')

## resolve_rename_chain <path>
##
## Writes <path>'s rename chain to stdout, one name per line, oldest first:
## the earlier names found by walking RENAMED_TO back, then <path>, then the
## later names found by walking RENAMED_FROM forward. The last line is the
## final name.
##
## Requires bash 4.3+. The binding constraint is the negative array index
## ${chain[-1]} used below, which bash introduced in 4.3; the 'declare -A'
## scoping and '-v' key tests this function also relies on are older (4.0
## and 4.2 respectively). Debian and Devuan stable ship bash 5.x, so this
## is not a concern in practice, but do not run on bash < 4.3.
##
## Cycle detection: keeps a visited associative array; if a name reappears
## the chain is corrupt — emit an error to stderr and return non-zero, and
## the caller skips the file.
##
## Reused names: a count above 1 in RENAME_IN or RENAME_OUT means two files
## shared a name at different times. Walking back, the walk stops before
## such a name and warns, so the earlier names are kept (under-purge, the
## safe direction). Walking forward, it cannot tell which name the file
## ended under, so it returns non-zero, as for a cycle.

resolve_rename_chain() {
    local start="$1" current prev i
    local back=()
    declare -A visited=()
    visited["$start"]=1

    current="$start"
    while [[ -v RENAMED_TO["$current"] ]]; do
        prev="${RENAMED_TO[$current]}"
        if (( ${RENAME_IN["$current"]:-0} > 1 || ${RENAME_OUT["$prev"]:-0} > 1 )); then
            echo "WARNING: rename history before '$current' is ambiguous; earlier names are not purged. Check them by hand." >&2
            break
        fi
        if [[ -v visited["$prev"] ]]; then
            echo "ERROR: rename cycle detected involving: $prev" >&2
            return 1
        fi
        visited["$prev"]=1
        back+=("$prev")
        current="$prev"
    done

    for (( i=${#back[@]}-1; i>=0; i-- )); do
        echo "${back[i]}"
    done

    current="$start"
    echo "$current"
    while [[ -v RENAMED_FROM["$current"] ]]; do
        if (( ${RENAME_OUT["$current"]:-0} > 1 )); then
            echo "ERROR: '$current' was renamed to more than one name; cannot tell which one is current." >&2
            return 1
        fi
        current="${RENAMED_FROM[$current]}"
        if [[ -v visited["$current"] ]]; then
            echo "ERROR: rename cycle detected involving: $current" >&2
            return 1
        fi
        visited["$current"]=1
        echo "$current"
    done
}

## ─── Build tracked-files lookup (across all refs) ─────────────────────────────
## git ls-files only lists HEAD, which is narrower than what filter-repo
## rewrites (all refs). Build TRACKED_SET from every ref's tree so a file
## live on any branch, tag, or stash is protected from purge.

echo "Building tracked-files lookup across all refs..."
declare -A TRACKED_SET=()
while IFS= read -r f; do
    [[ -n "$f" ]] && TRACKED_SET["$f"]=1
done < <(
    git for-each-ref --format='%(refname)' | while IFS= read -r ref; do
        git -c core.quotePath=false ls-tree -r --name-only "$ref" 2>/dev/null || true
    done | sort -u
)

## ─── Collect files to purge ───────────────────────────────────────────────────

declare -A PURGE_SET=()   # used for deduplication
PURGE=()

## Single associative array: skipped_renamed["old_path"]="final_path"
declare -A SKIPPED_TRACKED_SET=()
SKIPPED_TRACKED=()
declare -A SKIPPED_EXISTS_SET=()
SKIPPED_EXISTS=()
declare -A SKIPPED_SUBMODULE_SET=()
SKIPPED_SUBMODULE=()
declare -A SKIPPED_RENAMED=()   # old_path -> live final destination

add_to_purge() {
    local name="$1"
    if [[ ! -v PURGE_SET["$name"] ]]; then
        PURGE_SET["$name"]=1
        PURGE+=("$name")
    fi
}

validate_and_collect() {
    local f="$1"

    if [[ "$f" == /* ]]; then
        echo "ERROR: absolute path not supported: $f"
        exit 1
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

    if [[ -v RENAMED_FROM["$f"] || -v RENAMED_TO["$f"] ]]; then
        local chain_out
        local chain=()
        ## Command substitution, not < <(...): a process substitution's exit
        ## status is lost, so a cycle would go unnoticed.
        if ! chain_out="$(resolve_rename_chain "$f")"; then
            echo "ERROR: skipping '$f' due to an ambiguous rename history. Inspect manually." >&2
            return
        fi
        mapfile -t chain <<< "$chain_out"

        local final="${chain[-1]}"

        if [[ -v TRACKED_SET["$final"] ]]; then
            SKIPPED_RENAMED["$f"]="$final"
        else
            for name in "${chain[@]}"; do
                if [[ -v TRACKED_SET["$name"] ]]; then
                    echo "WARNING: rename chain name '$name' is currently tracked; skipping that name only." >&2
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
    echo "Reading file list from: $INPUT"
    ## || [[ -n "$line" ]] keeps a last line that has no newline after it;
    ## without it, read reports end of file and the loop drops that line.
    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        f="${line#./}"
        f="${f%$'\r'}"
        validate_and_collect "$f"
    done < "$INPUT"
else
    echo "Scanning git history for deleted files (all branches)..."
    while IFS= read -r line; do
        [[ -n "$line" ]] && validate_and_collect "$line"
    done < <(git -c core.quotePath=false log --all --no-merges --pretty=format: --name-only --diff-filter=D | sort -u)
fi

## ─── Report skipped files ─────────────────────────────────────────────────────

if (( ${#SKIPPED_TRACKED[@]} > 0 )); then
    echo "WARNING: ${#SKIPPED_TRACKED[@]} file(s) skipped — currently tracked on some ref:"
    printf '  %s\n' "${SKIPPED_TRACKED[@]}"
fi

if (( ${#SKIPPED_EXISTS[@]} > 0 )); then
    echo "WARNING: ${#SKIPPED_EXISTS[@]} file(s) skipped — exist on disk but not tracked:"
    printf '  %s\n' "${SKIPPED_EXISTS[@]}"
fi

if (( ${#SKIPPED_SUBMODULE[@]} > 0 )); then
    echo "WARNING: ${#SKIPPED_SUBMODULE[@]} submodule path(s) skipped — handle these manually:"
    printf '  %s\n' "${SKIPPED_SUBMODULE[@]}"
fi

if (( ${#SKIPPED_RENAMED[@]} > 0 )); then
    echo "INFO: ${#SKIPPED_RENAMED[@]} file(s) skipped — renamed in history, live destination is tracked:"
    for old in "${!SKIPPED_RENAMED[@]}"; do
        echo "  $old  ->  ${SKIPPED_RENAMED[$old]}"
    done
fi

if (( ${#PURGE[@]} == 0 )); then
    echo "No files to purge after validation."
    exit 0
fi

## ─── Show purge list ──────────────────────────────────────────────────────────

echo ""
echo "Files to purge from history (${#PURGE[@]} total):"
printf '  %s\n' "${PURGE[@]}"
echo ""

## ─── Optionally save the list ─────────────────────────────────────────────────

if [[ -n "$SAVE_LIST" ]]; then
    printf '%s\n' "${PURGE[@]}" > "$SAVE_LIST"
    echo "File list saved to: $SAVE_LIST"
fi

## ─── Dry-run exit ─────────────────────────────────────────────────────────────

if [[ "$DRY_RUN" == true ]]; then
    echo "Dry-run complete. No changes made."
    exit 0
fi

## ─── Confirm and execute ──────────────────────────────────────────────────────

echo ""
echo "WARNING: git filter-repo --force bypasses the fresh-clone check."
echo "  - Stashes will be discarded."
echo "  - Other worktrees pointing at this repo will break."
echo "  - Remote-tracking refs will be cleared (by design)."
echo "  - Reflog entries may be expired by subsequent gc."
echo "If this repo is not a throwaway clone dedicated to this purge, stop now."
echo ""

if [[ "$ASSUME_YES" == true ]]; then
    echo "Proceeding without prompt (--yes specified)."
else
    printf "Proceed? This rewrites history and cannot be undone. (y/n): " >/dev/tty
    read -r CONFIRM </dev/tty
    [[ "$CONFIRM" == "y" ]] || { echo "Aborted."; exit 0; }
fi

TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT
printf '%s\n' "${PURGE[@]}" > "$TMPFILE"

## Recovery anchors: filter-repo rewrites every ref, so record the tip of
## each ref (not just HEAD) before force-pushing. If the rewrite is wrong,
## `git update-ref <refname> <sha>` restores any ref to its pre-rewrite
## tip without depending on reflog retention.
echo "Pre-rewrite ref tips (record these; recover any ref with: git update-ref <refname> <sha>):"
git for-each-ref --format='  %(refname) %(objectname)' refs/heads refs/tags
echo ""

## Pre-clean filter-repo metadata directory. A prior gitdel run (or any
## prior filter-repo run) leaves state under .git/filter-repo/. If that
## directory persists for more than a day and we hit filter-repo's
## continuation prompt, answering Y to it makes filter-repo try to chain
## off the prior metadata, which can crash in `_record_metadata` with
## `FileNotFoundError: ...first-changed-commits` after the rewrite has
## already been written to refs. Removing the directory here ensures no
## continuation prompt fires and no chaining attempts occur.
rm -rf "$GIT_ROOT/.git/filter-repo"

git filter-repo --invert-paths --force --paths-from-file "$TMPFILE"

echo ""
echo "Done. Git history has been rewritten."
echo "Verify a path was purged with: git log --all --oneline -- <path>  (should print nothing)."
echo "Note: remotes and remote-tracking refs are cleared by filter-repo by design."
echo ""

if [[ ${#REMOTE_URLS[@]} -gt 0 ]]; then
    echo "Re-add your remote(s) and force-push:"
    ## Sort remotes for deterministic output
    for remote in $(printf '%s\n' "${!REMOTE_URLS[@]}" | sort); do
        echo "  git remote add $remote ${REMOTE_URLS[$remote]}"
        echo "  git push --force --all $remote"
        echo "  git push --force --tags $remote"
    done
    echo ""
fi

echo "WARNING: Any automated sync scripts, CI pipelines, or backup jobs pointed"
echo "at this remote will fail until you have manually force-pushed. They will"
echo "not auto-recover — trigger them manually after the force-push completes."

````