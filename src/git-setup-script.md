<div class="mdb-wide"></div>

# Git setup

`git-setup.sh` sets up Git on a machine in one run, the way the [Git reference](./gitreference.md#one-time-setup) describes it, so you don't type the commands one at a time. It writes the global settings, aliases and commit message template from one-time setup; creates an SSH key with a passphrase if you don't have one; binds your name and email to one folder, so a repo anywhere else refuses to commit rather than guessing who you are; signs your tags and writes the file that `git verify-tag` checks them against; and installs the commit hook that refuses conflict markers and warns about renames Git would lose track of. You edit a short block at the top of the script, run it, and run it again whenever you change that block: it backs up the files it owns before rewriting them, and leaves the rest of your config alone.

Nothing it does is hidden. Each step is one the reference explains, under [SSH setup for GitHub](./gitreference.md#ssh-setup-for-github), [Identity setup](./gitreference.md#identity-setup) and [Signing](./gitreference.md#signing), and [Git concepts](./gitconcepts.md#identity-layers-and-isolation) covers why the setup works this way. Like the gitdel script on [Git history delete](./git-delete.md), it's a shortcut over commands you could run yourself, not a different way of using Git.

````bash
#!/bin/bash
# Git setup, v21

## ─── Usage ───────────────────────────────────────────────────────────────────
## To set up Git and SSH for a single identity, on a fresh machine or one you
## want to bring into line, edit the CONFIG block below, then run in terminal,
## from any directory:
##   bash git-setup.sh
##
## No arguments. Re-runnable: safe to run multiple times; run it again
## whenever you change the CONFIG block.
## CLONE="on":  also clones the repos listed in CLONE_REPOS onto this machine,
##              or fast-forwards them if they're already there. Off by
##              default; see section 7.
## Privacy:     this script contains your real name and email in plain text.
##              Keep it in a PRIVATE dotfiles repo, not a public one.

## ─── Flow ────────────────────────────────────────────────────────────────────
## Steps are numbered like the sections below. Before step 1, a sanity check
## stops the run if the CONFIG block is unedited, git or ssh-keygen is
## missing, or CLONE isn't "on" or "off", and warns if git-revise is missing.
## 1. Set the global config, with no identity in it (see Scope).
## 2. Keep an existing SSH key, warning if it has no passphrase, or generate
##    one with a passphrase prompt; print the public key.
## 3. Write ~/.gitconfig-me (identity, SSH key, tag signing), bind it to
##    REAL_DIR with includeIf, and write the REAL_EMAIL line in
##    ~/.ssh/allowed_signers.
## 4. Set the aliases, and remove the retired fold aliases.
## 5. Write the commit message template, ~/.gitmessage.
## 6. Write the prepare-commit-msg hook: refuse staged conflict markers, and
##    warn on a rename with substantial content changes.
## 7. If CLONE="on": pin GitHub's host key unless it's already known, then
##    clone each repo in CLONE_REPOS into CLONE_DIR, or fast-forward it if
##    it's already there.
## 8. Prune backups of the managed files that are older than 30 days.
## 9. Print the commands that check the setup.

## ─── Scope ───────────────────────────────────────────────────────────────────
## The script touches only:
##   - global Git config (via `git config --global`, never edits ~/.gitconfig
##     directly; Git owns that file)
##   - ~/.ssh/id_ed25519       (SSH key, generated with a passphrase if missing)
##   - ~/.gitmessage           (commit message template, managed file)
##   - ~/.git-hooks/           (commit hook: conflict markers, rename safety)
##   - ~/.gitconfig-me         (identity, managed file)
##   - ~/.ssh/allowed_signers  (signing key for verify-tag; other lines kept)
##   - ~/.ssh/known_hosts      (github.com host key pinned, only when CLONE="on")
##
## Fail-loud identity model: the global config carries NO usable identity and
## sets user.useConfigOnly=true. The identity is bound to a directory via
## includeIf. A repo created outside that directory has no name/email, so Git
## refuses to commit ("Author identity unknown") instead of silently stamping
## whatever was lying around in global config. Put real repos under $REAL_DIR.
## Pre-existing global user.name or user.email is unset on every run (no-op
## on a fresh machine).
##
## Existing files are backed up with a timestamp suffix before being
## rewritten. Backups older than 30 days are pruned at the end of each run.
## Existing SSH keys are never overwritten. A new key is generated with a
## passphrase prompt; an existing key without a passphrase gets a warning
## (add one with ssh-keygen -p; see git_reference § SSH setup for GitHub).
##
## Hook scope: the script sets core.hooksPath = ~/.git-hooks globally, which
## supersedes any per-repo .git/hooks/ directory. A repo that relied on its
## own hooks before this script will silently stop running them; restore by
## setting the repo's own core.hooksPath back to .git/hooks (or unsetting it).
##
## Pseudonymous work: not supported here by design. Config-level identity
## separation on one OS account is structurally weaker than an OS-account or
## VM boundary; a single slip (wrong directory, wrong key, the agent offering
## the wrong key) links the identities, and a host compromise links them at
## once. For a pseudonymous identity, run it from a separate OS user account
## or VM with its own ~/.gitconfig and ~/.ssh, and use this script there too
## if you want the same setup. See git_concepts § Identity layers and
## isolation.

set -euo pipefail
[[ $# -eq 0 ]] || { printf 'Usage: bash git-setup.sh (no arguments; edit the CONFIG block in the script)\n' >&2; exit 2; }

## ─── CONFIG ──────────────────────────────────────────────────────────────────

# Identity. Required. Repos live under REAL_DIR and pick up this identity
# automatically; repos created elsewhere fail loud (see Scope).
REAL_NAME="Your Name"
REAL_EMAIL="you@example.com"
REAL_DIR="$HOME/code/me"                       # directory where repos live (triggers includeIf)

# Editor for commit messages and interactive rebase. Set "" to skip.
EDITOR_CMD="codium --wait"

# Clone repos onto a fresh machine. "off" skips the clone section (section 7)
# entirely. When "on", each "owner/repo" in CLONE_REPOS is cloned into CLONE_DIR,
# or fast-forward updated if already there. Cloning is over SSH and needs the
# key (section 2) already added to your GitHub account.
CLONE="off"
CLONE_DIR="$REAL_DIR"                          # clones land here; under the identity dir so they get the identity
CLONE_REPOS=()                                 # e.g. ("youruser/dotfiles" "youruser/notes")

## ─── Helpers ─────────────────────────────────────────────────────────────────

die() { printf '%s\n' "$*" >&2; exit 1; }
say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }

backup_if_exists() {
    [[ -f "$1" ]] || return 0
    local backup
    backup="$1.backup.$(date +%Y%m%d-%H%M%S)"
    cp "$1" "$backup" || die "backup failed: $1"
    say "  backed up: $1 → $backup"
}

# Unset every existing includeIf.gitdir:*.path entry whose value matches TARGET.
# Used to clear stale entries when REAL_DIR changes between runs. The `|| true`
# on the git config call keeps the pipefail/-e combination from killing the
# script when there are no matches (which is the normal first-run case).
unset_stale_includes() {
    local target="$1" key value
    { git config --global --name-only --get-regexp '^includeIf\.gitdir:.*\.path$' 2>/dev/null || true; } \
        | while read -r key; do
            value=$(git config --global "$key" 2>/dev/null || true)
            if [[ "$value" == "$target" ]]; then
                git config --global --unset "$key" 2>/dev/null || true
                say "  unset stale include: $key"
            fi
        done
}

## ─── Sanity check ────────────────────────────────────────────────────────────

if [[ "$REAL_NAME" == "Your Name" || "$REAL_EMAIL" == "you@example.com" ]]; then
    die "Edit the CONFIG block at the top of this script before running."
fi

if ! command -v git &>/dev/null; then
    die "git not found. Install it first: sudo apt install git"
fi

if ! command -v ssh-keygen &>/dev/null; then
    die "ssh-keygen not found. Install it first: sudo apt install openssh-client"
fi

# git-revise backs the rv alias (section 4). Everything else works without
# it, so a missing one is a warning, not a stop.
if ! command -v git-revise &>/dev/null; then
    warn "git-revise not found; the rv alias needs it: sudo apt install git-revise"
fi

case "${CLONE:-off}" in
    on|off) ;;
    *) die "CLONE must be \"on\" or \"off\", got: $CLONE" ;;
esac

## ─── 1. Core global config ───────────────────────────────────────────────────

say "setting global git config..."
# No global identity by design. useConfigOnly makes a repo outside the
# includeIf directory fail loud rather than commit under whatever was lying
# around in global config. The unsets clear an identity left in the global
# config by any pre-v3 run.
git config --global user.useConfigOnly true
git config --global --unset user.name  || true
git config --global --unset user.email || true
git config --global init.defaultBranch main
if [[ -n "$EDITOR_CMD" ]]; then
    git config --global core.editor "$EDITOR_CMD"
else
    git config --global --unset core.editor 2>/dev/null || true
fi
git config --global diff.tool vimdiff
git config --global difftool.prompt false
git config --global pull.rebase true
git config --global push.autoSetupRemote true
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global commit.verbose true
git config --global commit.template "$HOME/.gitmessage"
git config --global core.hooksPath "$HOME/.git-hooks"

## ─── 2. SSH key ──────────────────────────────────────────────────────────────

say "checking SSH key..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

PRIMARY_KEY="$HOME/.ssh/id_ed25519"
readonly PRIMARY_KEY
if [[ -f "$PRIMARY_KEY" ]]; then
    say "  exists: $PRIMARY_KEY (not regenerated)"
    # -P "" unlocks only a key that has no passphrase, and never prompts.
    if ssh-keygen -y -P "" -f "$PRIMARY_KEY" >/dev/null 2>&1; then
        warn "  WARNING: $PRIMARY_KEY has no passphrase; anything running"
        warn "           as you can push and sign with it. Add one with:"
        warn "           ssh-keygen -p -f $PRIMARY_KEY"
    fi
else
    say "  generating: $PRIMARY_KEY (choose a passphrase when asked)"
    ssh-keygen -t ed25519 -f "$PRIMARY_KEY" -C "$REAL_EMAIL" -q
fi

say ""
say "Public key (copy and add at GitHub → Settings → SSH and GPG keys):"
say ""
cat "$PRIMARY_KEY.pub"
say ""

## ─── 3. Identity (directory-bound) ───────────────────────────────────────────

say "configuring identity (directory-bound under $REAL_DIR)..."

# 3a. ~/.gitconfig-me: this script owns this file entirely. The core.sshCommand
# line pins the SSH key, so repos under REAL_DIR use the right key even if a
# remote URL was never rewritten to a Host alias. Tags are signed with the SSH
# key in SSH-signature mode; commits are not, because one signed tag covers
# all history behind it (git_concepts § Signing). Each value is written via
# `git config --file`, which applies git's own escaping rules so a name or
# email containing #, ;, ", or \ survives the round trip.
backup_if_exists "$HOME/.gitconfig-me"
cat > "$HOME/.gitconfig-me" <<EOF
# Managed by git-setup. Identity, bound by includeIf to $REAL_DIR.
EOF
git config --file "$HOME/.gitconfig-me" user.name       "$REAL_NAME"
git config --file "$HOME/.gitconfig-me" user.email      "$REAL_EMAIL"
git config --file "$HOME/.gitconfig-me" user.signingkey "$HOME/.ssh/id_ed25519.pub"
git config --file "$HOME/.gitconfig-me" gpg.format      ssh
git config --file "$HOME/.gitconfig-me" tag.gpgsign     true
git config --file "$HOME/.gitconfig-me" core.sshCommand "ssh -i $HOME/.ssh/id_ed25519 -o IdentitiesOnly=yes"
git config --file "$HOME/.gitconfig-me" gpg.ssh.allowedSignersFile "$HOME/.ssh/allowed_signers"
chmod 600 "$HOME/.gitconfig-me"
say "  wrote ~/.gitconfig-me (tags SSH-signed, commits unsigned)"

# 3b. includeIf: directory-triggered identity switch. Strip any prior include
# first so changing REAL_DIR between runs doesn't leave the old entry behind.
mkdir -p "$REAL_DIR"
unset_stale_includes "$HOME/.gitconfig-me"
git config --global "includeIf.gitdir:${REAL_DIR}/.path" "$HOME/.gitconfig-me"
say "  repos under $REAL_DIR/ will use this identity automatically"

# 3c. allowed_signers: lets git verify-tag check your signatures. The script
# manages only the line for REAL_EMAIL: lines for other signers are kept, and
# an old line for REAL_EMAIL is replaced, so a changed key takes effect.
SIGNERS="$HOME/.ssh/allowed_signers"
backup_if_exists "$SIGNERS"
{
    if [[ -f "$SIGNERS" ]]; then
        ME="$REAL_EMAIL" awk '$1 != ENVIRON["ME"]' "$SIGNERS"
    fi
    printf '%s namespaces="git" %s\n' "$REAL_EMAIL" "$(cut -d' ' -f1,2 "$PRIMARY_KEY.pub")"
} > "$SIGNERS.tmp"
mv "$SIGNERS.tmp" "$SIGNERS"
say "  wrote $SIGNERS (git verify-tag checks your tags against it)"
say "  NOTE: signed tags show Verified on GitHub only after you also upload"
say "        the key as a Signing Key (see git_reference § Signing)."

## ─── 4. Aliases ──────────────────────────────────────────────────────────────

say "setting aliases..."

# Status
git config --global alias.s   "status"
git config --global alias.st  "status -s"

# Stage
git config --global alias.a   "add"
git config --global alias.ap  "add -p"

# Guard: refuse while a merge, rebase, cherry-pick or revert is in progress,
# or while any file still has unresolved conflicts. The aliases that stage
# everything (ca, caa, caam) and rv run it first; in those states, use plain
# git (git status shows how to finish or abort).
git config --global alias.idle  '!f() { for s in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do if [ -e "$(git rev-parse --git-path "$s")" ]; then echo "git idle: a merge, rebase, cherry-pick or revert is in progress; finish or abort it first (git status shows how)" >&2; return 1; fi; done; if [ -n "$(git ls-files -u)" ]; then echo "git idle: unresolved conflicts; fix each file and git add it first" >&2; return 1; fi; }; f'

# Commit
git config --global alias.c     "commit -m"
git config --global alias.ca    '!git idle && git add -A && git commit -m'
git config --global alias.caa   '!git idle && git add -A && git commit --amend --no-edit'
git config --global alias.caas  "commit --amend --no-edit"
git config --global alias.caam  '!f() { git idle && git add -A && git commit --amend -m "$1"; }; f'
git config --global alias.caams "commit --amend -m"
# cm: each argument becomes its own -m paragraph; no arguments opens the
# editor. bash -c because /bin/sh on Devuan is dash, which has no arrays.
git config --global alias.cm    "!bash -c 'args=(); for m in \"\$@\"; do args+=(-m \"\$m\"); done; git commit \"\${args[@]}\"' --"
git config --global alias.cf    "commit --fixup"
git config --global alias.cs    "commit -s"

# Revise older commits in memory with git-revise (git_reference § Revising
# older commits). git-revise does not check for a rebase in progress, so rv
# runs the guard first.
git config --global alias.rv    '!git idle && git revise'

# Retired: earlier versions set these fold aliases; rv replaces them.
for retired in fixto fixtos rewordto foldinto; do
    if git config --global --get-all "alias.$retired" >/dev/null; then
        git config --global --unset-all "alias.$retired"
        say "  removed retired alias: $retired"
    fi
done

# Diff
git config --global alias.d   "diff"
git config --global alias.dc  "diff --cached"
git config --global alias.ds  "diff --stat"
git config --global alias.dw  "diff --word-diff"

# Log
git config --global alias.lg  "log --oneline --graph --all --decorate"
git config --global alias.ll  "log --oneline"
git config --global alias.lf  "log --follow --"

# Inspect
git config --global alias.last      "show --compact-summary HEAD"
git config --global alias.when      "log -1 --format=%cr --"
git config --global alias.lastfile  "log -1 --format='%cs %s' --"
git config --global alias.who       "shortlog -sne"
git config --global alias.aliases   "config --get-regexp '^alias\\.'"

# Identity (which identity is this repo using?)
git config --global alias.whoami    '!git config user.name; git config user.email; git config user.signingkey'

# Branch / switch
git config --global alias.br   "branch"
git config --global alias.co   "checkout"
git config --global alias.cob  "checkout -b"
git config --global alias.sw   "switch"
git config --global alias.swc  "switch -c"

# Restore
git config --global alias.unstage  "restore --staged"
git config --global alias.discard  "restore"

# Reset
git config --global alias.uncommit  "reset --soft HEAD~1"
git config --global alias.squash    "reset --soft"

# Rebase
git config --global alias.ria  "rebase -i --autosquash"
git config --global alias.rc   "rebase --continue"
git config --global alias.ra   "rebase --abort"

# Stash
git config --global alias.sl  "stash list"
git config --global alias.sa  "stash apply"
git config --global alias.sp  "stash pop"

# Push (safe force)
git config --global alias.pf  "push --force-with-lease --force-if-includes"

## ─── 5. Commit message template ──────────────────────────────────────────────

say "writing ~/.gitmessage..."
backup_if_exists "$HOME/.gitmessage"
cat > "$HOME/.gitmessage" <<'EOF'


# Subject (line 1): imperative, under 50 chars, no period.
# Blank line between subject and body.
# Body (line 3+): wrapped at 72. Explain why, not what.
# The diff below the scissors line shows what.
EOF

## ─── 6. Commit hook ──────────────────────────────────────────────────────────

say "writing prepare-commit-msg hook (conflict markers, rename safety)..."
mkdir -p "$HOME/.git-hooks"
backup_if_exists "$HOME/.git-hooks/prepare-commit-msg"
cat > "$HOME/.git-hooks/prepare-commit-msg" <<'EOF'
#!/bin/sh
# Git runs this hook on git commit and on git rebase --continue
# (pre-commit does not run there); --no-verify does not skip it.
#
# 1. Refuse a commit that adds conflict-marker lines. git add is what marks a
# conflict resolved; Git never looks inside the file. Only the opening and
# closing markers count, because a bare ======= line is also a Markdown
# heading underline.
if git diff --cached --no-color --no-ext-diff --no-textconv -U0 |
    grep -qE '^\+(<<<<<<<|>>>>>>>)( |$)'; then
  echo "Conflict markers are staged. Fix the file, git add it, and retry." >&2
  echo "To commit markers on purpose: git -c core.hooksPath=/dev/null commit ..." >&2
  exit 1
fi
#
# 2. Warn when the commit being prepared contains a rename with substantial
# content changes (similarity <60%). git log --follow loses a file across a
# rename below 50%; 60% leaves a margin. Detection runs at 30%, because at
# Git's default 50% the worst cases show as a delete plus an add and are
# never seen. $2 is the message source; $3 is HEAD when the source is an
# amend.
if [ "$2" = "commit" ] && [ "$3" = "HEAD" ]; then
  base=HEAD~1   # amend: the new commit's parent is HEAD's parent
else
  base=HEAD     # normal commit: the new commit's parent is HEAD
fi
git rev-parse --verify --quiet "$base" >/dev/null || exit 0   # initial commit: nothing to compare
if git diff --cached --find-renames=30% --name-status "$base" | grep '^R' | awk '{score=substr($1,2)+0; if(score<60) found=1} END{exit !found}'; then
  echo "Warning: this commit contains a rename with substantial content changes (similarity <60%). git log --follow may lose history. Rename in one commit; edit in a separate commit." >&2
fi
exit 0
EOF
chmod +x "$HOME/.git-hooks/prepare-commit-msg"

## ─── 7. Clone repos ──────────────────────────────────────────────────────────

# Optional, controlled by CLONE in the CONFIG block. Trusts GitHub's host key by
# pinning its published ed25519 key rather than a blind ssh-keyscan, so a
# man-in-the-middle on first contact cannot have its key silently accepted. Then
# clones or fast-forward updates each repo in CLONE_REPOS into CLONE_DIR.
# The clone pins the SSH key with -i and IdentitiesOnly, matching the
# core.sshCommand discipline used everywhere else, so a loaded agent
# cannot authenticate the clone as the wrong GitHub account.
if [[ "${CLONE:-off}" == "on" ]]; then
    say "cloning repos..."

    # GitHub's published ed25519 host key (docs.github.com, fingerprint
    # SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU). Appended only when
    # github.com is not already a known host, so re-runs do not stack duplicates.
    mkdir -p "$HOME/.ssh"
    chmod 700 "$HOME/.ssh"
    touch "$HOME/.ssh/known_hosts"
    chmod 600 "$HOME/.ssh/known_hosts"
    if ssh-keygen -F github.com >/dev/null 2>&1; then
        say "  github.com already in known_hosts (not re-added)"
    else
        printf '%s\n' 'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' >> "$HOME/.ssh/known_hosts"
        say "  pinned github.com ed25519 host key"
    fi

    if [[ ${#CLONE_REPOS[@]} -eq 0 ]]; then
        warn "  CLONE is \"on\" but CLONE_REPOS is empty; nothing to clone"
    else
        mkdir -p "$CLONE_DIR"
        for repo in "${CLONE_REPOS[@]}"; do
            target="$CLONE_DIR/${repo##*/}"
            if [[ -d "$target/.git" ]]; then
                say "  updating $repo..."
                git -c core.sshCommand="ssh -i $PRIMARY_KEY -o IdentitiesOnly=yes" -C "$target" pull --ff-only \
                    || { warn "  pull not fast-forward for $repo; skipping"; continue; }
            else
                say "  cloning $repo..."
                git -c core.sshCommand="ssh -i $PRIMARY_KEY -o IdentitiesOnly=yes" clone "git@github.com:$repo.git" "$target" \
                    || { warn "  clone failed for $repo; skipping"; continue; }
            fi
        done
    fi
fi

## ─── 8. Prune old backups ────────────────────────────────────────────────────

# Remove timestamped backups older than 30 days, scoped to the four managed
# files this script touches. Keeps $HOME from accumulating decades of backups
# from re-runs; recent backups stay reachable for rollback.
say "pruning managed-file backups older than 30 days..."
for managed in \
    "$HOME/.gitconfig-me" \
    "$HOME/.ssh/allowed_signers" \
    "$HOME/.gitmessage" \
    "$HOME/.git-hooks/prepare-commit-msg"; do
    dir=$(dirname "$managed")
    base=$(basename "$managed")
    [[ -d "$dir" ]] || continue
    find "$dir" -maxdepth 1 -name "${base}.backup.*" -mtime +30 -delete 2>/dev/null || true
done

## ─── 9. Summary ──────────────────────────────────────────────────────────────

say ""
say "Done. Verify:"
say "  git config --list --show-origin   # everything Git sees, with source files"
say "  git aliases                       # your aliases"
say "  git whoami                        # name/email/signingkey for the current repo"
say ""
say "Identity (should resolve under $REAL_DIR):"
say "  mkdir -p $REAL_DIR && cd $REAL_DIR && git init _verify && cd _verify"
say "  git config user.email             # should be $REAL_EMAIL"
say "  cd .. && rm -rf _verify"
say ""
say "Fail-loud check (a repo outside $REAL_DIR MUST error):"
say "  cd /tmp && git init _nowhere && cd _nowhere"
say "  git commit --allow-empty -m test  # should fail: Author identity unknown"
say "  cd .. && rm -rf _nowhere"
if [[ "${CLONE:-off}" == "on" && ${#CLONE_REPOS[@]} -gt 0 ]]; then
    say ""
    say "Cloned or updated under $CLONE_DIR:"
    for repo in "${CLONE_REPOS[@]}"; do
        say "  ${repo##*/}  ($repo)"
    done
fi

````