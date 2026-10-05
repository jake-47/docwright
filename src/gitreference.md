# Git reference

> - **For:** anyone who knows what they want Git to do and needs the command.
> - **Before you start:** [Getting started with Git](./git-getting-started.md).
> - **Reading time:** about 42 minutes end to end, but it's a lookup: find your task and read that section.
> - **You end with:** Git set up once, and the command for whatever you need to do next.

Lookup by task. The [concepts doc](./gitconcepts.md) covers the mental model and the why; this one tells you the command.

Conventions in this doc:

1. Commands shown with `bash` tags.
2. Angle-bracket placeholders like `<file>` or `<sha>` mean substitute your own value.
3. `HEAD~N` means "N commits before the current one." `HEAD~1` is the previous commit.
4. Anything marked "local only" rewrites history; never run on commits that have been pushed to a shared remote.


## One-time setup

Set your identity. Stamped on every commit; run once per machine.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Recommended: don't set a global identity. Turn on fail-loud and bind the identity to a directory instead, so a repo created outside that directory errors rather than committing under whatever was lying around in global config. See [Identity setup](#identity-setup).

Set the default branch name to `main` so new repos use it.

```bash
git config --global init.defaultBranch main
```

Set the editor Git opens for commit messages and interactive rebase.

```bash
git config --global core.editor "codium --wait"
```

Set vim as the diff tool for `git difftool`. Skips the per-file confirmation prompt. Use this if you read diffs in vim (with or without vim-fugitive); see [Which tool when](./gitconcepts.md#which-tool-when) in the concepts doc for how this fits among the other diff-viewing options.

```bash
git config --global diff.tool vimdiff
git config --global difftool.prompt false
```

Make `git pull` rebase instead of merge. Keeps history linear; no noise commits.

```bash
git config --global pull.rebase true
```

Push new branches without the `-u` dance. With this set, the first push of a new branch creates the remote branch and sets the upstream automatically (Git 2.37+); without it, Git refuses until you run `git push -u origin <branch>` once.

```bash
git config --global push.autoSetupRemote true
```

Prune deleted remote branches on every fetch. Without it, branches deleted on the remote linger in `git branch -a` output indefinitely.

```bash
git config --global fetch.prune true
```

Enable `rerere` (reuse recorded resolution). Git remembers how you resolved a merge conflict and applies the same resolution if the conflict recurs.

```bash
git config --global rerere.enabled true
```

Make `git commit` show the staged diff in the editor (below a scissors line; the diff gets stripped on save). Reading the diff while writing the message is what most experienced users do reflexively. Available since Git 2.9.

```bash
git config --global commit.verbose true
```

Point Git at a commit message template. The template pre-fills the editor with reminders of the 50/72/imperative rules as comment lines (which get stripped on save).

```bash
git config --global commit.template ~/.gitmessage
```

Create the template file:

```bash
cat > ~/.gitmessage <<'EOF'


# Subject (line 1): imperative, under 50 chars, no period.
# Blank line between subject and body.
# Body (line 3+): wrapped at 72. Explain why, not what.
# The diff below the scissors line shows what.
EOF
```

The two leading blank lines are intentional: that's where the cursor lands when the editor opens.

Codium settings for commit-message editing. Open Settings, click the JSON icon top-right, merge into `settings.json`:

```json
"[git-commit]": {
    "editor.rulers": [50, 72],
    "editor.wordWrap": "wordWrapColumn",
    "editor.wordWrapColumn": 72
}
```

Vertical rulers at columns 50 and 72; word wrap activates at column 72.

Install a rename-safety hook. Git records renames as delete+add and re-infers them post-hoc when you run `git log --follow`; that inference is content-similarity based, and `--follow` loses the thread when the rename commit's similarity drops below Git's 50% default. The hook below inspects the commit being prepared, normal or amend, and warns when it contains a rename below the 60% safety margin (10 points above the floor). See the concepts doc, [What Git silently discards](./gitconcepts.md#what-git-silently-discards), for the fuller framing.

```bash
mkdir -p ~/.git-hooks
cat > ~/.git-hooks/prepare-commit-msg << 'EOF'
#!/bin/sh
# Warn when the commit being prepared contains a rename with substantial
# content changes (similarity <60%); such commits break `git log --follow`.
# Renames are detected down to 10% similarity: at Git's default of 50%, the
# worst ones show up as a delete plus an add and never reach the check.
# $2 is the message source; $3 is HEAD when the source is an amend.
if [ "$2" = "commit" ] && [ "$3" = "HEAD" ]; then
  base=HEAD~1   # amend: the new commit's parent is HEAD's parent
else
  base=HEAD     # normal commit: the new commit's parent is HEAD
fi
git rev-parse --verify --quiet "$base" >/dev/null || exit 0   # initial commit: nothing to compare
if git diff --cached --find-renames=10% --name-status "$base" | grep '^R' | awk '{score=substr($1,2)+0; if(score<60) found=1} END{exit !found}'; then
  echo "Warning: this commit contains a rename with substantial content changes (similarity <60%). git log --follow may lose history. Rename in one commit; edit in a separate commit." >&2
fi
exit 0
EOF
chmod +x ~/.git-hooks/prepare-commit-msg
```

Point Git at that hooks directory globally:

```bash
git config --global core.hooksPath ~/.git-hooks
```

The hook checks the staged diff against the commit's actual future parent: `HEAD` for a normal commit, `HEAD~1` for an amend, whose parent is the old commit's parent and whose content the index already holds at hook time. It covers both the fresh rename-plus-edit commit and the pure-rename commit about to receive edits via amend, skips cleanly on a repo's first commit, and warns without ever blocking.

Useful aliases. Add to `~/.gitconfig` under `[alias]`, or set with `git config --global alias.<name> '<value>'`. The set below is built on the convergent core that shows up across long-stable expert configurations (mwhite, Haacked, Pro Git, Atlassian, oh-my-zsh's `git` plugin, GitHub's published dotfiles), grouped by purpose. Each line is what gets typed; the comment is what it does.

```ini
[alias]
    # Status
    s   = status                              # full status
    st  = status -s                           # short, one line per file

    # Stage
    a   = add
    ap  = add -p                              # interactive hunks (atomic commits)

    # Commit
    c       = commit -m                       # one-line message
    ca      = !git add -A && git commit -m    # stage everything + one-line message
    caa     = !git add -A && git commit --amend --no-edit
                                              # stage everything + fold into prev commit, keep message
    caas    = commit --amend --no-edit        # fold ALREADY-STAGED into prev commit, keep message
    caam    = "!f() { git add -A && git commit --amend -m \"$1\"; }; f"
                                              # stage everything + fold into prev commit, NEW message
    caams   = commit --amend -m               # fold ALREADY-STAGED into prev commit, NEW message
    cm      = commit                          # opens editor for substantive message
    cf      = commit --fixup                  # mark fixup; pair with ria
    fixto   = "!f() { sha=$(git rev-parse \"$1\") && git add -A && git commit --fixup \"$sha\" && if base=$(git rev-parse -q --verify \"$sha^\"); then GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash \"$base\"; else GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --root; fi; }; f"
                                              # stage everything + fold into <commit>, root-aware; note 8
    fixtos  = "!f() { sha=$(git rev-parse \"$1\") && git commit --fixup \"$sha\" && if base=$(git rev-parse -q --verify \"$sha^\"); then GIT_SEQUENCE_EDITOR=: git rebase -i --autostash --autosquash \"$base\"; else GIT_SEQUENCE_EDITOR=: git rebase -i --autostash --autosquash --root; fi; }; f"
                                              # fold ALREADY-STAGED into <commit>, root-aware; note 8
    rewordto = "!f() { sha=$(git rev-parse \"$1\") && if [ -n \"${2:-}\" ]; then target_subject=$(git log -1 --format=\"%s\" \"$sha\") && git commit --allow-empty -m \"amend! $target_subject\" -m \"$2\"; else git commit --allow-empty --fixup=reword:\"$sha\"; fi && if base=$(git rev-parse -q --verify \"$sha^\"); then GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash \"$base\"; else GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --root; fi; }; f"
                                              # replace message of <commit>; editor or inline; no content change; note 9
    foldinto = "!f() { git diff --quiet && git diff --cached --quiet || { echo \"foldinto: working tree not clean; commit or stash first\" >&2; return 1; }; orig=$(git rev-parse HEAD) && tgt_subj=$(git log -1 --format=%s \"$2\") && if base=$(git rev-parse -q --verify \"$2^\"); then base_arg=\"$base\"; else base_arg=\"--root\"; fi && git rewordto \"$1\" \"fixup! $tgt_subj\" && GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash \"$base_arg\" || { git rebase --abort 2>/dev/null; git reset --hard \"$orig\" >/dev/null; echo \"foldinto: fold conflicts; restored to $orig. Resolve manually with: git rebase -i <target>^\" >&2; return 1; }; }; f"
                                              # fold existing <commit> into <target>; clean-tree, atomic; note 10
    cs      = commit -s                       # signoff (DCO projects)

    # Diff
    d   = diff
    dc  = diff --cached                       # the about-to-commit diff
    ds  = diff --stat                         # filenames + line counts
    dw  = diff --word-diff                    # word-level (good for prose)

    # Log
    lg  = log --oneline --graph --all --decorate    # standard pretty log
    ll  = log --oneline                              # quick scan, no graph
    lf  = log --follow --                            # file history, follows renames

    # Inspect
    last     = show --compact-summary HEAD          # what you just committed
    when     = log -1 --format=%cr --               # last touch on a file (relative)
    lastfile = log -1 --format='%cs %s' --          # last touch (date + subject)
    who      = shortlog -sne                        # contributors with counts
    aliases  = config --get-regexp '^alias\\.'      # list your own aliases

    # Branch / switch
    br  = branch
    co  = checkout
    cob = checkout -b
    sw  = switch                              # modern checkout (branches only)
    swc = switch -c                           # modern checkout -b

    # Restore
    unstage = restore --staged
    discard = restore                         # discard working-tree edits to file

    # Reset (commit rewriting)
    uncommit = reset --soft HEAD~1            # undo last commit, keep changes staged
    squash   = reset --soft                   # use as: git squash HEAD~3, then git commit
    # Rebase
    ria = rebase -i --autosquash              # auto-orders --fixup commits
    rc  = rebase --continue
    ra  = rebase --abort

    # Stash
    sl  = stash list
    sa  = stash apply
    sp  = stash pop

    # Push
    pf  = push --force-with-lease --force-if-includes    # the safe force push
```

Reliability notes on the alias set above.

1. `pf` uses `--force-with-lease --force-if-includes`, not plain `--force`. The lease form refuses to push if the remote has new commits since your last fetch; `--force-if-includes` (Git 2.30+) additionally verifies your local history includes everything from the remote ref before allowing the push. Together they prevent silent overwrites of someone else's work. Never alias plain `--force` to a short name.
2. There are four amend-related aliases (`caa`, `caas`, `caam`, `caams`) and a deliberate one omitted (`commit -a --amend`). `caas` and `caams` operate on already-staged changes; you control what gets folded in, with `caams` also taking a new message. `caa` and `caam` both run `git add -A` first, which stages new files in addition to modified ones. `commit -a --amend` only stages modified tracked files, not new ones, which can lead to commits that omit the file you thought you were including. If you want one-step "stage everything and amend," prefer `caa`/`caam` over `commit -a --amend`. All three of these rewrite the previous commit, so the local-only rule applies: don't run on pushed commits without a force-with-lease push afterwards.
3. There is deliberately no alias for `reset --hard` or `clean -fdx`. The typing friction is the safety. Reflog can recover lost commits but cannot recover uncommitted working-tree changes a hard reset destroys.
4. `sw` / `swc` (Git 2.23+) and `restore` separate what `checkout` did into two cleaner commands. They refuse some operations that `checkout` would silently complete, which is desirable. The older `co` / `cob` are kept for muscle memory; both forms work indefinitely.
5. The `cf` + `ria` pair is the standard atomic-commit fixup workflow used on Bitcoin Core and other projects with rebase-based PR review. `git cf <sha>` records a fixup against an earlier commit; `git ria <base>` runs interactive rebase with autosquash, which automatically orders and squashes the fixups into their targets.
6. Shell-form aliases (the ones starting with `!`) are `ca`, `caa`, `caam`, `fixto`, `fixtos`, `rewordto`, `foldinto`, and `whoami`. The leading `!` makes git run a shell command rather than a git subcommand. Shell aliases execute from the repo root, not the directory where git was invoked. For the ones that call `git add -A` (`ca`, `caa`, `caam`, `fixto`) that changes nothing, because `git add -A` always operates from the repo root regardless of where you invoke from, which is what you want for snapshot-style commits but worth knowing if you ever expected scoped staging.
7. The `aliases` entry uses `'^alias\\.'` with a doubled backslash. That's gitconfig escaping: the value is parsed before being passed to the regexp engine, so `\\` becomes `\` and the pattern matches a literal dot. If you copy this pattern outside gitconfig (into a shell script, for instance), unescape back to a single backslash. Relatedly, a value containing `;` or `#` must be wrapped in double quotes in gitconfig, since both characters otherwise begin a comment; that is why `caam`, `fixto`, `fixtos`, `rewordto`, and `foldinto` are double-quoted above.
8. `fixto` resolves its argument to a hash with `rev-parse` before committing, because creating the fixup commit shifts every `HEAD~N` name by one; without the resolution, `fixto HEAD~1` would record the fixup against the wrong commit. It stages everything (`git add -A`, so the `ca`/`caa` caveat in note 2 applies), then runs the autosquash rebase non-interactively by setting `GIT_SEQUENCE_EDITOR=:`, which accepts the generated todo unchanged. Both `fixto` and the staged-only `fixtos` are root-aware: when the target is the root commit they rebase with `--root`, because the target's parent `<hash>^` does not exist and naming it aborts the rebase and strands the `fixup!` commit at HEAD. `fixtos` differs only in that it skips `git add -A`, folding just the staged index, and adds `--autostash` so the unstaged remainder it leaves does not block the rebase, which refuses to run on a dirty working tree. Either form rewrites every commit from the target forward, so the local-only rule applies; the fold conflicts when a later commit changed the lines around your change, because the patch's context no longer matches at the target, and on that conflict the rebase stops as usual: resolve and `git rc`, or back out with `git ra`.
9. `rewordto` is the message-only sibling of `fixto`, with two interfaces selected by whether you pass a second positional argument. With no second arg (`git rewordto <sha>`), it uses `git commit --allow-empty --fixup=reword:<sha>` (Git 2.32+, June 2021, shorthand for `--fixup=amend:<sha> --only`), which creates an empty `amend!` commit and opens the editor with the target's old message pre-filled for you to refine; save and close, and the autosquash rebase folds it in. With a second arg (`git rewordto <sha> "new title"`), it constructs the `amend!` commit manually with two `-m` flags (the target's subject becomes the first, prefixed with `amend!`; your inline argument becomes the body, which is what autosquash installs as the target's replacement message), bypassing the editor entirely. The two forms exist because `-m` and `--fixup=reword:` are mutually exclusive at the git level (`fatal: options '-m' and '--fixup:reword' cannot be used together`), so the inline form has to go through the manual `amend!` construction; the editor form goes through `--fixup=reword:` because it gives you the target's old message as the starting point and lets `commit.verbose` and `commit.template` apply. Use the inline form for single-line subject changes (the common case); use the editor form for multi-line message rewrites where you want the editor as your composition surface. `--allow-empty` is defensive in both branches; the commit has the same tree as its parent. Same root-awareness as `fixto`. Same local-only constraint: the rewrite changes the target's hash and every descendant hash, so don't run on commits already pushed to a shared remote. The commit hooks fire on the empty commit too; the rename-safety hook is a no-op there (no rename in an empty diff), but any custom hook that fails on empty commits will block this alias. The `amend!` autosquash lands on the commit named by `<sha>`, not on whichever commit happens to share its subject: because the rebase is based at the target's parent, the target is the oldest commit in the range, and autosquash attaches the `amend!` to the oldest in-range commit with the matching subject, so a duplicate subject newer in range loses to the target and any older duplicate sits below the base untouched. The same `<sha>^`-windowing protects `fixto`, `fixtos`, and `foldinto`.
10. `foldinto` folds an existing commit into an earlier existing commit, the case `fixto` and `fixtos` cannot reach because their source is the working tree or index rather than a commit. It marks the source as `fixup! <target subject>` by calling `rewordto`, then runs an autosquash rebase based at the target's parent (`--root` when the target is the root commit), so the operation is two rebases: the message rewrite, then the fold. The fold lands on the commit you name regardless of duplicate subjects, by the same `<sha>^`-windowing noted for `rewordto` in note 9: basing at the target's parent makes the target the oldest commit in range, autosquash folds into the oldest in-range match, older duplicates sit below the base, and newer in-range duplicates lose. It requires a clean working tree and refuses otherwise, so its failure path can hard-reset to the starting commit without endangering uncommitted work; on a conflict it aborts the rebase, resets to the HEAD it captured on entry, and reports that you should redo the fold by hand with `git rebase -i <target>^`. This is the one place the fold family does not leave you inside the rebase to resolve in place: `fixto` and `fixtos` stop for `git rc`, but `foldinto` restores and hands the conflict back. Same local-only constraint as the rest of the family: it rewrites the target and every descendant hash, so don't run it on commits already pushed to a shared remote without a coordinated force-with-lease push afterwards. It depends on `rewordto` being defined.

Check what's configured.

```bash
git config --list
git config --list --show-origin   # values + which file each came from
git config --global --edit        # opens the global config file directly
git aliases                       # list just your aliases (after adding the alias above)
```

`git config --list --show-origin` is the unified view: every effective setting and the file it came from (system, global, per-repo, `includeIf` chains). Run inside a repo to confirm the identity is resolving correctly; run outside any identity directory to see the fail-loud state (no `user.email` set anywhere).

### Dotfiles repo: the convention experts use

The commands above get you set up on one machine. The convention for multi-machine setup, used widely across the Linux and privacy-focused dev world, is a *dotfiles repo*: a private Git repository containing your `~/.gitconfig`, your `~/.gitmessage` (and often `~/.bashrc`, `~/.vimrc`, anything else you customise). On a fresh machine you clone the dotfiles repo, put the files in place, and you're done.

Two tools make the dotfiles repo pattern smoother but neither is required:

1. GNU Stow (`sudo apt install stow`) symlinks files from the dotfiles repo into `~` so the repo stays the source of truth. Lightweight, no templating, Devuan/Debian native. The most common pick.
2. chezmoi is the heavier alternative with templating (different machines can render the same dotfile differently) and built-in age encryption for secrets. Worth it once you're managing several machines or want secrets in the repo without plaintext exposure.

If the dotfiles repo is private and on encrypted storage, plain files are fine. If it's pushed to GitHub or similar, encrypt anything you'd rather not publish with `git-crypt` or chezmoi's built-in age support.

### Pseudonymous work

This setup is single-identity by design. For a pseudonymous identity (separate from your real identity), use a separate OS user account, a VM (Whonix on Qubes is the canonical setup), or a separate physical machine. Repeat this setup there with that identity's name and email.

The reason is structural. Config-level identity separation on one OS account leaves several footguns intact: a repo placed under the wrong directory, a remote pointed at the wrong account, the SSH agent offering the wrong key, a host compromise that reads both identities at once. The convergent pattern among Tor developers, Bitcoin Core's pseudonymous contributors, and Qubes users is OS-level isolation: different home directory, different `~/.gitconfig`, different `~/.ssh`, different browser, different shell history. The "wrong terminal" class of failures disappears because the boundaries are real, not procedural.

See the concepts doc, [Identity layers and isolation](./gitconcepts.md#identity-layers-and-isolation), for the threat-model reasoning, and [Beyond passphrase keys](./gitconcepts.md#beyond-passphrase-keys) for the optional next tiers (hardware tokens, Tor transport, independent commit signing).

## Starting a repo

Initialise a new repo in the current folder.

```bash
git init
```

Clone an existing remote repo.

```bash
git clone <url>
git clone <url> <folder-name>   # clone into a specific folder
```


## The daily cycle

Check what has changed and what's staged.

```bash
git status
git status -s   # short output, one line per file
```

Stage specific files for the next commit.

```bash
git add <file>
git add <file1> <file2>
```

Stage everything that has changed, including new files.

```bash
git add -A
```

Stage only changed tracked files (ignores new untracked files).

```bash
git add -u
```

Stage hunks interactively. Walks you through each change and asks `y/n`. Use `s` to split a hunk, `e` to hand-edit line-by-line.

```bash
git add -p <file>
```

Commit staged changes with an inline one-line message.

```bash
git commit -m "short summary of the change"
```

Commit and open the editor for a longer message (summary line, blank line, body).

```bash
git commit
```

Skip staging and commit all tracked changes in one step. Does not include new untracked files.

```bash
git commit -a -m "message"
```

Stage and commit in one interactive hunk-by-hunk pass.

```bash
git commit -p
```

Commit just one path (or a few) out of many changed, leaving every other change uncommitted. Useful for splitting one file's distinct rationale into its own commit while the rest stays bundled. Takes the working-tree content of the named paths and does not touch the index for anything else, so you need not stage first.

```bash
git commit -m "Drop rebase glossary entry: duplicates concepts doc" -- glossary.md
```


## Everyday workflow

Six commands cover most days, assuming the aliases from [one-time setup](#one-time-setup) are in place. The principles behind these (commits as communication, atomic commits, message discipline) are in the [Git concepts doc](./gitconcepts.md#commits-as-communication).

Stage everything that changed and commit with a one-line message:

```bash
git ca "fix login redirect"
```

Commit already-staged changes with a one-line message:

```bash
git c "fix login redirect"
```

See what you just committed (metadata, message, and compact summary of changed files):

```bash
git last
```

Stage everything and fold it into the previous commit, keeping the previous commit's message. Use this when you commit and immediately notice you missed something (a file, a typo fix, a forgotten change in the same logical unit):

```bash
git caa
```

Fold already-staged changes into the previous commit, keeping the previous commit's message. Use this when you staged precisely what you want and don't want `add -A` picking up unrelated working-tree changes:

```bash
git caas
```

Stage everything and fold it into the previous commit, but with a new message. Use this when you want to also change the previous commit's title or message:

```bash
git caam "new commit title"
```

`caa`, `caas`, and `caam` all rewrite the previous commit (new hash). Safe locally; on already-pushed commits you'll need `git pf` afterwards.

When the everyday six aren't enough.

For a multi-paragraph commit from the command line, subject plus one or more body paragraphs, pass `-m` multiple times. Git concatenates the values as separate paragraphs separated by blank lines. Documented git behaviour, no alias needed.

```bash
git commit -m "subject" -m "body paragraph"
git commit -m "subject" -m "first paragraph" -m "second paragraph"
```

The same form scopes a body note to one file in a commit that touches several: prefix the body line with the file's path.

```bash
git commit -m "2026-06-03 — intro, glossary, bibliography" \
           -m "glossary.md: dropped the rebase entry; it duplicated the concepts doc and would drift."
```

`git log -- glossary.md` surfaces that line against the file later.

Combined with staging:

```bash
git add -A && git commit -m "subject" -m "body paragraph"
```

To start a message with `-m` and finish in the editor (useful when you've typed the subject and want the editor for the body, with rulers and diff visible):

```bash
git commit -m "subject" -e
```

For a fully substantive message, anything where you want auto-wrap at 72, the diff visible while writing, and no shell quoting hassles, drop the `-m` entirely and let the editor open:

```bash
git add -A
git commit
```

The template pre-fills the editor with rule reminders, the codium rulers mark columns 50 and 72, and the staged diff is appended below a scissors line so you can read the changes while writing the message. Save and close the tab to commit.

To fix the previous commit's message or fold forgotten changes into it:

```bash
git commit --amend          # opens editor with previous message preloaded
git commit --amend --no-edit # keeps message, folds in newly staged changes (long form of caas)
```

To fold staged changes into a commit older than HEAD, use the fixup + autosquash pair. Local only, rewrites every commit from the target forward.

```bash
git add <files>
git cf <hash>          # records "fixup! <subject>" against <hash>
git ria <hash>^        # interactive rebase, autosquash slots the fixup into place
```

For the common case of folding changes into the commit before HEAD (e.g., you committed something, then committed something else, then realised the earlier commit was incomplete):

```bash
git add <files>
git cf HEAD~1
git ria HEAD~3
```

Why `HEAD~3` and not `HEAD~2`: the fixup commit itself moves HEAD, so the target that was `HEAD~1` is `HEAD~2` by rebase time, and the rebase base must be the target's parent, one further back. The sha-based general form above is immune to this shift, because a hash doesn't move when HEAD does. The rebase opens the editor with the fixup pre-positioned next to its target and pre-marked as a fixup. Save and close to apply. `--amend` itself only operates on HEAD; there's no syntax to point it at an arbitrary commit.

The `fixto` alias from one-time setup wraps the whole sequence and resolves the target to a hash first, so the shift cannot bite. Its `fixtos` sibling does the same for staged-only changes:

```bash
git fixto HEAD~1       # stage everything, fold into the commit before last
git fixto <sha>        # same, into any earlier commit
git fixtos <sha>       # fold ONLY staged changes; leaves unstaged work untouched
```

`fixto` stages everything (`add -A`, the same caveat as `ca` and `caa`) and runs the autosquash rebase without opening the editor. `fixtos` skips the `add -A`, so only the staged index folds in, and adds `--autostash` to set the unstaged remainder aside during the rebase and restore it after. Both are root-aware: targeting the root commit rebases with `--root` rather than the nonexistent `<root>^`, which would otherwise abort and strand a stray `fixup!` commit. The fold conflicts when a later commit changed the lines around your change, since the patch's context no longer matches at the target; on a conflict it stops like any rebase: resolve and `git rc`, or back out with `git ra`.

To replace the message of an older commit without changing its content, use `rewordto`. It has two forms selected by whether you pass a new message as a second positional argument.

```bash
git rewordto HEAD~1 "New subject for the prior commit"   # inline form, no editor
git rewordto <sha>  "New subject for an earlier commit"  # same, against any earlier commit
git rewordto HEAD~1                                       # editor form, opens with old message pre-filled
git rewordto <sha>                                        # same, against any earlier commit
```

The inline form constructs the `amend!` commit manually with two `-m` flags (target's subject prefixed with `amend!` becomes the first; your new message becomes the body, which autosquash installs as the target's replacement message), and is fastest for the common case of changing a single-line subject. The editor form goes through `git commit --fixup=reword:<sha>` (Git 2.32+, June 2021) and opens the editor with the target's old message pre-filled; preferred for multi-line message rewrites where the editor is a better composition surface than the command line. The two paths exist because `-m` and `--fixup=reword:` are mutually exclusive at the git level, so the inline form has to go through the manual `amend!` construction.

Either form runs the autosquash rebase non-interactively, leaving the target's tree unchanged and its message reading as the one you wrote. Same root-awareness and same local-only constraint as `fixto`; the rewrite changes the target's hash and every descendant. Don't use this on a commit you've already pushed to a shared remote without a coordinated force-with-lease push afterwards.

To fold an existing commit into an earlier one, rather than folding the working tree or index, use `foldinto`. This reaches the case `fixto` and `fixtos` cannot: the change you want to absorb is already its own commit, not staged work.

```bash
git foldinto HEAD~1 HEAD~3      # fold the commit at HEAD~1 into the commit at HEAD~3
git foldinto <source> <target>  # by hash; source first (dissolved), target second (absorbs it)
```

The argument order is source then target: the first commit is dissolved, the second absorbs its diff and keeps its own message. It requires a clean working tree and refuses otherwise, so that its conflict recovery can hard-reset to the starting commit without endangering uncommitted work. Targeting is by the commit you name, not by subject text: a duplicate subject elsewhere does not misdirect the fold, because the rebase is based at the target's parent, which makes the target the oldest commit in range (note 10). Unlike `fixto` and `fixtos`, which stop inside the rebase on a conflict for you to resolve and `git rc`, `foldinto` restores you to the exact starting state and reports it; redo the fold by hand with `git rebase -i <target>^`, reorder the source under the target, and mark it `fixup`. Same local-only constraint: it rewrites the target and every descendant, so don't run it on commits already pushed to a shared remote without a coordinated force-with-lease push afterwards.

The aliases used above (`c`, `ca`, `caa`, `caas`, `caam`, `caams`, `last`, `cf`, `ria`, `fixto`, `fixtos`, `rewordto`, `foldinto`) are defined in [one-time setup](#one-time-setup). The fallback editor flow uses `commit.verbose`, `commit.template`, and the codium settings, all also in one-time setup.

Note on shell quoting: every form that takes a message in quotes (the aliases and all `-m` variants) is subject to shell rules. Apostrophes, parens, `$`, `!`, and `*` need escaping or careful quoting. If a message would need heavy escaping, use editor mode instead.


## Remotes

List remotes.

```bash
git remote -v
```

Add a remote.

```bash
git remote add origin <url>
```

Change a remote URL.

```bash
git remote set-url origin <new-url>
```

Remove a remote.

```bash
git remote remove origin
```

Fetch from remote without merging.

```bash
git fetch origin
```

Fetch and clean up references to branches deleted on the remote. Without `--prune`, deleted remote branches linger in `git branch -a` output indefinitely.

```bash
git fetch --prune
git fetch -p
```

Make pruning automatic for all fetches ([one-time setup](#one-time-setup) sets this):

```bash
git config --global fetch.prune true
```

Pull (fetch plus merge or rebase depending on config).

```bash
git pull
```

Push the current branch, setting upstream the first time. With `push.autoSetupRemote` from one-time setup, a plain `git push` does this automatically; `-u` is only needed where that setting is absent.

```bash
git push -u origin main
git push              # after upstream is set
```

Push a new branch.

```bash
git push -u origin <branch-name>
```

Delete a remote branch.

```bash
git push origin --delete <branch-name>
```

Force-push. Overwrites remote history. Use `--force-with-lease --force-if-includes` instead of plain `--force`: the lease refuses the push if the remote changed unexpectedly, and `--force-if-includes` (Git 2.30+) additionally verifies your local history contains everything on the remote ref. Aliased as `git pf` in one-time setup.

```bash
git push --force-with-lease --force-if-includes
```

Keep a linear history on pull instead of generating merge commits. Rebase your local commits on top of what you fetched, ad hoc or as the default.

```bash
git pull --rebase
git config --global pull.rebase true        # make rebase the default for every pull
git config --global pull.ff only            # otherwise, refuse pulls that aren't fast-forward
```

Setting `pull.rebase true` is the durable choice for solo work: when local and remote have both moved, a plain `git pull` rebases instead of stopping with an error (Git 2.33.1 and later) or making a merge bubble (older Git).

Set or retarget the upstream-tracking branch without pushing. Use when a branch was created or pushed without `-u`, or to point it at a different remote branch.

```bash
git branch -u origin/<branch>
git branch --set-upstream-to=origin/<branch>     # long form
```


## Removing and renaming tracked files

Both operations stage their change immediately, so the next commit records them.

Remove a tracked file from the repo and the working tree.

```bash
git rm <file>
git rm -r <dir>                      # recursively, for a directory
```

Rename or move a tracked file. Git records a rename as a delete plus an add and re-infers it later by content similarity, so do the rename in its own commit and edit the file's contents in a separate commit. A combined rename-and-edit commit can drop the similarity below Git's detection threshold and break `git log --follow`, `git blame` across the rename, and GitLens history.

```bash
git mv <old> <new>
```

To stop tracking a file while keeping it on disk (the inverse of `git add`), see `git rm --cached` under [Ignoring files](#ignoring-files).


## Ignoring files

Create a `.gitignore` at the repo root. Each line is a pattern.

```gitignore
# comments start with hash, at the start of a line only
*.log
node_modules/
.env
.DS_Store
build/
# leading slash: only at repo root
/dist
# negation: don't ignore this one
!important.log
```

Start from a language-specific template at [github.com/github/gitignore](https://github.com/github/gitignore).

Global ignore for OS and editor clutter that should never be tracked.

```bash
git config --global core.excludesfile ~/.gitignore_global
```

Stop tracking a file that's already tracked, without deleting it locally. Needed because `.gitignore` only affects untracked files.

```bash
git rm --cached <file>
```

Ignore a file in this repo only, without committing a change to the shared `.gitignore`. Patterns go in `.git/info/exclude`, which lives in the repo's `.git` directory and is never committed. Use it for personal editor or scratch files that shouldn't be imposed on collaborators.

```gitignore
# .git/info/exclude  --  same pattern syntax as .gitignore
.scratch/
notes-to-self.md
```


## .gitattributes template

A `.gitattributes` file at the repo root tells Git how to handle specific file types: line endings, binary detection, diff strategy. Committed to the repo, so every clone gets the same rules. Overrides per-machine `core.*` settings, which is why it's preferred for anything that should apply consistently across collaborators.

Combined template covering line endings and binary markers:

```gitattributes
# Line endings: normalize to LF in repo, convert on checkout as needed
* text=auto eol=lf

# Files that must keep CRLF (Windows-specific scripts)
*.bat   text eol=crlf
*.cmd   text eol=crlf

# Binary files: don't normalize, don't try to diff
*.png   binary
*.jpg   binary
*.gif   binary
*.pdf   binary
*.zip   binary
*.mp4   binary
*.mov   binary
*.mp3   binary
```

Word-level diffs inline (Git has no setting that makes them the default; `git dw` from [one-time setup](#one-time-setup) is the short form):

```bash
git diff --word-diff
git diff --word-diff=color
```

If a repo already has mixed line endings, renormalise once after adding the template:

```bash
git add --renormalize .
git commit -m "Normalize line endings"
```

Per-machine line-ending fallback. Use only when `.gitattributes` isn't an option (e.g., contributing to a repo whose maintainers haven't adopted the file). Travels with the machine, not the repo, so it's the inferior choice when you control the repo:

```bash
git config --global core.autocrlf input     # Linux/macOS
git config --global core.autocrlf true      # Windows
```
## Inspecting state and history

Show the full log.

```bash
git log
```

Show a compact one-line-per-commit log.

```bash
git log --oneline
```

Visualise all branches as a graph.

```bash
git log --oneline --graph --all --decorate
```

Filter log by author.

```bash
git log --author="name"
```

Filter log by date range.

```bash
git log --since="2 weeks ago"
git log --since="2026-01-01" --until="2026-03-01"
```

Search commit history for a string that was added or removed (pickaxe).

```bash
git log -S "search string"
git log -G "regex pattern"   # regex variant
```

Show what changed in a specific commit.

```bash
git show <sha>
```

Show a file as it existed at a specific commit.

```bash
git show <sha>:path/to/file
git show HEAD~3:path/to/file
```

Diff: unstaged changes against the staging area.

```bash
git diff
```

Diff: what's staged for the next commit.

```bash
git diff --staged
```

Diff between two commits.

```bash
git diff <sha1> <sha2>
git diff HEAD~3 HEAD
```

Diff between two branches (any branch name works as a ref).

```bash
git diff main..feature-branch
git diff main feature-branch        # same thing, two-dot form omitted
```

Diff against the upstream-tracking branch. Useful for "what am I about to push" before `git push`.

```bash
git diff @{u}..                     # current branch vs its upstream
git log @{u}..                      # local commits not yet on upstream
git log ..@{u}                      # upstream commits not yet local
```

Diff against an earlier state of HEAD (from the reflog). Useful for "what changed in my last reset/rebase/merge."

```bash
git diff HEAD@{1}                   # current state vs HEAD one move ago
git diff HEAD@{1}..HEAD             # commits only, leaving out uncommitted work
git diff HEAD@{yesterday}           # time-based reflog reference
```

Diff at word level (better for prose than line level).

```bash
git diff --word-diff
```

Who last modified each line of a file, and in which commit.

```bash
git blame <file>
git blame -L 20,40 <file>   # limit to lines 20-40
```

Find which commit introduced a bug by binary search.

```bash
git bisect start
git bisect bad                    # current commit is broken
git bisect good <sha>             # known good commit
# git checks out a midpoint; you test it and run:
git bisect good   # or: git bisect bad
# repeat until git names the culprit, then:
git bisect reset
```

Automate the search by handing bisect a test command instead of judging each step by hand. Git runs the command at every midpoint and reads its exit code: 0 is good, 1 to 127 except 125 is bad, 125 means skip this commit as untestable. The command can be a test script, a one-liner, or a compiler invocation, and bisect names the first bad commit with no further interaction.

```bash
git bisect start HEAD <known-good-sha>
git bisect run ./test.sh
git bisect reset
```

Show every commit that touched a file, following it across renames. Without `--follow` the history stops at the rename; keeping renames content-pure is what makes `--follow` reliable (see the [concepts doc](./gitconcepts.md#renames)). Aliased as `git lf`.

```bash
git log --follow -- <file>
git log --oneline --follow -- <file>
```

Show a file's history with the actual diffs, or with per-commit change stats.

```bash
git log -p -- <file>        # full patch at each commit touching the file
git log --stat              # files changed and line counts per commit
```

Show the history of specific lines or a single function, with the diff at each step. The line-range form takes start and end; the function form names the symbol and lets Git find its bounds. This is the time axis to `blame -L`'s snapshot: blame says who last touched each line, `-L` says how the region got there.

```bash
git log -L 40,60:path/to/file        # history of lines 40-60
git log -L :funcName:path/to/file    # history of one function, bounds auto-detected
```

Search tracked content. Faster than a plain recursive grep, respects `.gitignore`, and can search any revision rather than just the working tree.

```bash
git grep "pattern"
git grep "pattern" <sha>            # search the tree at a past commit
git grep -n "pattern"               # show line numbers
```

Find which branches or tags contain a given commit. Answers "which release shipped this fix."

```bash
git branch --contains <sha>
git tag --contains <sha>
```

Diff a branch against the point where it diverged, not against the other branch's current tip. The three-dot form diffs from the merge-base, so it shows only what your branch added; the two-dot form above mixes in the other branch's later commits.

```bash
git diff main...feature             # changes on feature since it forked from main
```

Compare two versions of a commit series, such as a branch before and after a rebase, or v1 against v2 of the same work. It pairs commits up by content and shows a diff of the diffs, so you can confirm a rewrite changed only what you meant it to. The reflog form `feature@{1}` is the quickest before-and-after right after a rebase.

```bash
git range-diff main..feature@{1} main..feature   # this branch, before vs after the last rebase
git range-diff <base> <v1-tip> <v2-tip>          # explicit three-arg form
```

Keep `git blame` readable across bulk-reformat commits. List the reformat commits' shas in a `.git-blame-ignore-revs` file (one per line) and blame skips them, attributing each line to its last meaningful change instead.

```bash
git blame --ignore-rev <sha> <file>
git config blame.ignoreRevsFile .git-blame-ignore-revs    # apply the file by default
```


## Undoing

Discard unstaged changes to a file. Destroys your edits.

```bash
git restore <file>
git restore .   # all files in current directory
```

Unstage a file (moves it from staged back to modified, does not change its contents).

```bash
git restore --staged <file>
```

Fix the most recent commit's message. Local only.

```bash
git commit --amend -m "new message"
```

Add forgotten changes to the most recent commit. Local only.

```bash
git add <forgotten-file>
git commit --amend --no-edit
```

Undo the last amend, restoring the pre-amend commit. The amend replaced HEAD with a new commit and left the original in the reflog; this points HEAD back at it. The target is `HEAD@{1}` (the reflog entry of the original commit), not `HEAD~1` (its parent): `reset --soft HEAD~1` would undo the original commit along with the amend. `--soft` keeps everything the amend touched staged, so nothing is lost.

```bash
git reset --soft HEAD@{1}
git reset --hard HEAD@{1}    # discard the amend's changes too; destructive
```

`HEAD@{1}` is correct only if the amend was the most recent action that moved HEAD. If you've committed, checked out, or reset since, read `git reflog` and reset to the original commit's explicit sha instead.

Re-stamp the author of the last commit. Use after a commit lands under the wrong identity (the bug the [Identity setup](#identity-setup) section warns about). `--reset-author` re-reads the current `user.name` and `user.email`; the explicit form sets a specific author.

```bash
git commit --amend --reset-author --no-edit
git commit --amend --author="Name <email>" --no-edit
```

Rewrites the commit (new hash), so it's local-only or force-push with `git pf` after.

Undo the last commit but keep the changes staged.

```bash
git reset --soft HEAD~1
```

Undo the last commit and unstage the changes (keep them in working directory).

```bash
git reset HEAD~1
```

Undo the last commit and discard the changes entirely. Destructive.

```bash
git reset --hard HEAD~1
```

Create a new commit that reverses a previous one. Safe on pushed history.

```bash
git revert <sha>
```

Revert a merge commit. Plain `git revert` fails on a merge because it can't tell which parent to treat as mainline; `-m 1` selects the first parent (the branch you merged into).

```bash
git revert -m 1 <merge-sha>
```

Reset vs revert: `reset` rewrites history and is local-only safe; `revert` adds a new commit that undoes the target and is safe to push.

Preview untracked files Git would delete (always run this before `git clean -fd`). The `-n` flag is dry-run; nothing is deleted.

```bash
git clean -nd
git clean -ndx     # also include ignored files
```

Actually delete untracked files. Destructive: files not tracked by Git are gone, including any new work you forgot to add. Run `-nd` first.

```bash
git clean -fd      # untracked files and directories
git clean -fdx     # also ignored files (.env, build artifacts)
```

Restore one file to its state at another commit or branch, leaving everything else untouched. Unlike `git restore <file>` (which discards to the staged version), `--source` pulls the file's content from any ref.

```bash
git restore --source=<sha> <file>
git restore --source=main <file>     # the version on another branch
```

Undo a just-completed merge, rebase, or pull. Each of these sets `ORIG_HEAD` to the tip before the operation, so a hard reset to it backs the whole operation out.

```bash
git reset --hard ORIG_HEAD
```

For an operation still in progress (conflicts unresolved), use `--abort` instead; `ORIG_HEAD` is for one that already completed.


## Quick recipes for common messes

Committed to the wrong branch.

```bash
git reset --soft HEAD~1         # undo the commit, keep the changes staged
git stash                        # save them
git switch <correct-branch>
git stash pop                    # changes come back unstaged
git add -A
git commit -m "message"
```

Accidentally committed a huge file.

```bash
git reset HEAD~1                # undo the commit
# remove or gitignore the huge file, then recommit
```

Works only while the commit is unpushed; once pushed, the blob is in history and needs the [Purging](#purging-files-from-history) section.

Accidentally committed a secret. Rotate the secret first (assume it's compromised). Then purge from history with the gitdel script from [Git history delete](./git-delete.md) or `git filter-repo`. Force-push.

Rolled back too far with `git reset --hard`.

```bash
git reflog                       # find the sha from before the reset
git reset --hard <sha>
```

Want to throw away all local changes and match the remote exactly.

```bash
git fetch origin
git reset --hard origin/main
```

Want to see who changed a line and why, three years later.

```bash
git blame <file>                 # find the sha
git show <sha>                   # read the commit message
```


## Branches

List local branches. Current branch is marked with `*`.

```bash
git branch
```

List all branches including remotes.

```bash
git branch -a
```

Create a branch (stays on current branch).

```bash
git branch <name>
```

Switch to an existing branch.

```bash
git switch <name>
```

Create and switch in one step.

```bash
git switch -c <name>
```

Look at an old commit without affecting any branch (detached HEAD). Useful for inspecting a historical state. Switch back to a real branch when done; commits made in detached HEAD without a branch become unreferenced.

```bash
git switch --detach <commit-sha>
git switch -                 # back to previous branch
```

Older equivalent still widely used.

```bash
git checkout <name>
git checkout -b <name>
```

Rename the current branch.

```bash
git branch -m <new-name>
```

Delete a branch that has been merged.

```bash
git branch -d <name>
```

Force-delete a branch that hasn't been merged. Destroys unmerged work on that branch.

```bash
git branch -D <name>
```

Merge another branch into the current one.

```bash
git merge <other-branch>
```

Abort a merge in progress (after conflicts).

```bash
git merge --abort
```

Rebase current branch onto another. Local only if the current branch has been pushed.

```bash
git rebase <base-branch>
git rebase --abort        # back out mid-rebase
git rebase --continue     # after resolving conflicts
```

List branches by merge status, to see what's safe to delete and what still has unmerged work.

```bash
git branch --merged main            # already merged into main; safe to delete
git branch --no-merged main         # still hold unmerged commits
```

Control how a merge is recorded. `--no-ff` forces a merge commit even when a fast-forward is possible, preserving the branch as a visible unit; `--ff-only` refuses to merge unless it can fast-forward, rejecting anything that would create a merge commit.

```bash
git merge --no-ff <branch>
git merge --ff-only <branch>
```

Drop the current commit during a rebase. Use only when the rebase stops on a commit whose changes are already present upstream and applying it is redundant. Anywhere else, `--skip` throws that commit's changes out of the result; in a fixup/autosquash rebase that means the fix you queued silently vanishes. When in doubt, resolve and continue, or `git rebase --abort` and rethink.

```bash
git rebase --skip
```

Transplant a range of commits onto a new base, or drop a range. `--onto` takes the new base, the old base (an exclusive lower bound), and the branch to move.

```bash
git rebase --onto <newbase> <upstream> <branch>
git rebase --onto HEAD~3 HEAD~1     # replay HEAD onto HEAD~3, dropping HEAD~1 and HEAD~2
```

Read it as: replay the commits in `<upstream>..<branch>` on top of `<newbase>`.


## Merge conflicts

When `git merge`, `git pull`, or `git rebase` stops with conflicts, `git status` lists the conflicted files. Each conflicted file contains markers:

```text
<<<<<<< HEAD
your version
=======
their version
>>>>>>> other-branch
```

Edit the file to the final desired content, remove all three markers, then:

```bash
git add <file>
git commit              # if merging
git rebase --continue   # if rebasing
```

To abandon the attempt entirely:

```bash
git merge --abort
git rebase --abort
```

Take one whole side of a conflicted file instead of editing markers by hand, then stage it.

```bash
git checkout --ours <file>          # keep your side
git checkout --theirs <file>        # take the incoming side
git add <file>
```

The meaning inverts between merge and rebase. In a merge, `--ours` is your current branch and `--theirs` is the branch being merged in. In a rebase the sides are swapped: `--ours` is the branch you're replaying onto and `--theirs` is your own commit being replayed. Check which operation you're in before picking a side.


## Stashing

Save uncommitted changes and revert the working directory to the last commit.

```bash
git stash push -m "what I was working on"
```

List stashes.

```bash
git stash list
```

Reapply the most recent stash and remove it from the stash list.

```bash
git stash pop
```

Reapply a stash but keep it in the list.

```bash
git stash apply stash@{0}
```

Drop a stash without applying.

```bash
git stash drop stash@{0}
```

Clear all stashes.

```bash
git stash clear
```

Promote a stash to a branch. Creates a new branch from the commit the stash was made on, then applies the stash on top. Useful when a stash turns out to be larger than expected or conflicts with the current branch.

```bash
git stash branch <new-branch-name>
git stash branch <new-branch-name> stash@{1}   # specific stash
```

Include untracked files in the stash. Plain `git stash` leaves new (untracked) files in the working directory, a common cause of "my stash didn't save everything."

```bash
git stash push -u -m "what I was working on"
git stash -u                         # short form, no message
```

Inspect a stash's contents before applying it.

```bash
git stash show -p stash@{0}          # full diff of the stash
git stash show stash@{0}             # summary only
```


## Rewriting history (local only)

Interactive rebase opens an editor with the last N commits listed, each prefixed with `pick`. Change the prefix to alter what happens to that commit:

1. `reword`: keep the commit, change the message.
2. `squash` (or `s`): fold this commit into the one above, combining messages.
3. `fixup` (or `f`): fold into the one above, discarding this commit's own message.
4. `edit`: stop at this commit so you can amend it, then `git rebase --continue`.
5. `drop` (or `d`): remove the commit entirely. Same effect as deleting its line.

Reorder commits by reordering lines in the editor.

```bash
git rebase -i HEAD~5
```

Skip the todo-list editor for a straight squash-all-into-first via environment variable; Git still opens the editor once, for the combined message:

```bash
GIT_SEQUENCE_EDITOR="sed -i 's/^pick/squash/; 1s/squash/pick/'" git rebase -i HEAD~5
```

Non-interactive shortcut for the collapse-all-into-one case: `reset --soft` plus a fresh commit. Cleaner than interactive rebase when all you want is to combine the last N commits into one new commit with a new message.

```bash
git reset --soft HEAD~4
git commit -m "your message"
```

`reset --soft` moves the branch pointer back N commits but keeps all the changes staged. The single new commit captures everything. No editor. Limited to the straight-collapse case; use `rebase -i` for reorder, edit, drop, or selective squash. The aliased forms `uncommit` (for HEAD~1) and `squash` (general) are defined in the [one-time setup](#one-time-setup).

Rebase preserving merge commits.

```bash
git rebase -i --rebase-merges HEAD~5
```

Apply a single commit from elsewhere onto the current branch.

```bash
git cherry-pick <sha>
git cherry-pick <sha1> <sha2> <sha3>
```

When a cherry-pick hits a conflict, resolve and continue, drop the conflicting commit, or back out entirely.

```bash
git cherry-pick --continue           # after staging the resolution
git cherry-pick --skip               # drop this commit, keep going
git cherry-pick --abort              # undo the whole cherry-pick
```


## Recovery

The reflog is your safety net. It records every move of HEAD for ninety days by default, including operations that "lost" commits, though an entry for a commit the current tip can no longer reach expires after thirty. Almost nothing is truly gone.

Show the reflog.

```bash
git reflog
```

Recover a commit by its sha from the reflog.

```bash
git checkout <sha>                               # look at it
git branch recovery <sha>                        # save it as a branch
git update-ref refs/heads/<branch> <sha>         # force a branch to point at it
```

Recover after a bad reset. Find the sha of the commit you were on before the reset in the reflog, then:

```bash
git reset --hard <sha>
```

Find dangling commits that the reflog doesn't surface.

```bash
git fsck --lost-found
```


## Tags

List tags.

```bash
git tag
```

Create a lightweight tag (just a pointer).

```bash
git tag v1.0.0
```

Create an annotated tag (recommended for releases; carries a message and metadata).

```bash
git tag -a v1.0.0 -m "First stable release"
```

Push a specific tag.

```bash
git push origin v1.0.0
```

Push commits plus any annotated tags reachable from them in a single operation. Useful when releases are tagged on commits you're about to push; avoids the two-step push + push --tags.

```bash
git push --follow-tags
```

Push all tags.

```bash
git push --tags
```

Delete a local tag.

```bash
git tag -d v1.0.0
```

Delete a remote tag.

```bash
git push origin --delete v1.0.0
```

Get a human-readable name for the current commit relative to the most recent tag. Output like `v1.2.0-5-gabc123` means five commits after `v1.2.0`, at commit `abc123`.

```bash
git describe --tags
git describe --tags --dirty          # append -dirty if the working tree has changes
```


## SSH setup for GitHub

Generate a key.

```bash
ssh-keygen -t ed25519 -C "you@example.com"
```

Start the agent and add the key.

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

Copy the public key to paste into GitHub at `Settings > SSH and GPG keys > New SSH key`.

```bash
cat ~/.ssh/id_ed25519.pub
```

Verify the connection.

```bash
ssh -T git@github.com
```

Use SSH URLs for remotes (`git@github.com:user/repo.git`) rather than HTTPS URLs once SSH is set up.


## Identity setup

Single-identity setup with directory binding and fail-loud safety. The global config carries no identity; the identity is bound to a directory via `includeIf gitdir:`. A repo created outside that directory errors instead of committing under whatever happened to be in global config.

For pseudonymous work see [Pseudonymous work](#pseudonymous-work) under One-time setup, above; this section is the mechanics for one identity on this OS account.

### Fail-loud global

The global config carries no usable identity. `user.useConfigOnly` (Git 2.8+) then makes a repo outside the configured identity directory refuse to commit ("Author identity unknown") instead of silently stamping whichever identity happened to be global.

```bash
git config --global user.useConfigOnly true
git config --global --unset user.name     # remove any existing global identity
git config --global --unset user.email
```

`useConfigOnly` only stops Git guessing or falling back to a default; on its own it does nothing if a global `user.name`/`user.email` is still set. The unset lines are what close the fallback.

### Identity include file

The identity lives in its own include file that sets name, email, signing config, and the SSH key to use. The `core.sshCommand` line pins the key by directory, so the right key is used even when a remote URL was never rewritten to a Host alias.

`~/.gitconfig-me`:

```ini
[user]
    name = Your Name
    email = you@example.com
    signingkey = ~/.ssh/id_ed25519.pub
[gpg]
    format = ssh
[commit]
    gpgsign = true
[core]
    sshCommand = ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes
```

Set the file to `chmod 600` so other local users on the same machine can't read it.

### Bind the identity to a directory

In `~/.gitconfig`:

```ini
[includeIf "gitdir:~/code/me/"]
    path = ~/.gitconfig-me
```

A repo under `~/code/me/` resolves the identity; anything elsewhere has no identity and fails loud. Three caveats on the match:

1. The trailing slash matters. Git turns `~/code/me/` into `~/code/me/**`, which matches everything inside; without the slash the pattern has to match a repo's `.git` path exactly, so `~/code/me` matches no repo under it at all.
2. `gitdir:` matches the canonicalised path of the repo's `.git`. A repo reached through a symlinked parent can miss the match; point the condition at real paths.
3. Use `gitdir/i:` instead of `gitdir:` for a case-insensitive match on a case-insensitive filesystem.

### Alternative: bind by remote URL

If your repos won't all live under one identity directory, key the include off the remote URL instead (Git 2.36+, April 2022):

```ini
[includeIf "hasconfig:remote.*.url:git@github.com:youruser/**"]
    path = ~/.gitconfig-me
```

One trap: you cannot define a remote inside a file included this way. The condition needs the remote to exist before the file that would define it is read, so a `[remote]` block there is a circular dependency Git rejects; keep remotes in the repo's own config. Directory binding sets identity at `git init`, before any remote exists; remote binding activates only once a remote is set, so a fresh repo has no identity until then. Prefer directory binding by default.

### Check the active identity

Before committing in an unfamiliar repo, confirm who you are. Add an alias once:

```bash
git config --global alias.whoami '!git config user.name; git config user.email; git config user.signingkey'
```

Then, inside any repo:

```bash
git whoami                              # name, email, signing key for this repo
git config --show-origin user.email     # and which file set it
```

With the fail-loud global in place, a repo in an uncategorised directory comes back empty here instead of resolving an identity. That empty result is the safety net, not a misconfiguration.


## Signed commits

Sign commits so GitHub (and similar) show a "Verified" badge. Two methods: SSH (Git 2.34+, GitHub support since 2022) and GPG. SSH reuses your existing SSH key and is simpler to set up; GPG is the long-standing standard. Pick one; don't combine.

### SSH signing

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

For local verification (`git log --show-signature`), Git needs an `allowed_signers` file listing trusted keys. Without it, signature verification produces an error rather than a result.

```bash
echo "$(git config --get user.email) namespaces=\"git\" $(cat ~/.ssh/id_ed25519.pub)" >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

Run that inside a repo under your identity directory. With the fail-loud global from [Identity setup](#identity-setup), `git config --get user.email` comes back empty anywhere else, and the line goes in with no email.

The `namespaces="git"` annotation is what tells `ssh-keygen` (and Git through it) that this key is authorised for Git-namespace signatures specifically, not other SSH-signed contexts.

Upload the same public key as a *Signing Key* in GitHub at *Settings > SSH and GPG keys > New SSH key*, with the key type set to *Signing Key* (a separate entry from the authentication key, even when the key material is identical).

The `gpg.format ssh` and `commit.gpgsign true` setting names are misleading. They control all signing, including SSH; the config keys retained `gpg` in their names from before SSH signing existed.

### GPG signing

```bash
git config --global user.signingkey <key-id>
git config --global commit.gpgsign true
git commit -S -m "signed commit"
```

List your GPG keys.

```bash
gpg --list-secret-keys --keyid-format=long
```

Skip signing entirely for solo work unless you want the badge. Required by some security-sensitive projects.

Verify signatures rather than create them. The first shows signature status inline in the log; the others check a specific commit or tag and exit nonzero on failure.

```bash
git log --show-signature
git verify-commit <sha>
git verify-tag <tag>
```

SSH-signature verification needs the `allowed_signers` file from the SSH signing setup above; without it these report an error instead of a verdict.


## Worktrees

Check out a second branch in a parallel working directory without cloning the repo again. Useful for quick context switches.

```bash
git worktree add ../other-branch-folder <branch>
git worktree list
git worktree remove ../other-branch-folder
```


## Submodules and LFS

Both are advanced features that usually cause more friction than they solve for personal projects. See [Large binaries are permanent](./gitconcepts.md#large-binaries-are-permanent) and the submodule item in [What Git silently discards](./gitconcepts.md#what-git-silently-discards), both in the concepts doc, for why. Minimal commands when you do need them.

Add a submodule (pin another repo at a specific commit inside this repo).

```bash
git submodule add <url> <path>
git submodule update --init --recursive
```

Clone a repo that has submodules (without this, the submodule directories will be empty).

```bash
git clone --recurse-submodules <url>
```

LFS install and track. Requires `git-lfs` installed (`sudo apt install git-lfs`).

```bash
git lfs install                        # one-time per user
git lfs track "*.psd"                  # tell LFS to handle this pattern
git add .gitattributes                 # the track command writes here
```

Files matching tracked patterns are stored in LFS instead of the regular git object store.

## Purging files from history

Removing a file in a commit does not remove it from history; earlier commits still contain it. To actually purge a file from every commit in every branch, history has to be rewritten.

The tool depends on what's being scrubbed:

1. Specific deleted files, with rename-chain awareness: the gitdel script from [Git history delete](./git-delete.md), this project's wrapper around `git filter-repo`.
2. Files matching a glob, or files over a size threshold: BFG Repo-Cleaner.
3. Secrets or other content inside files to be kept: BFG `--replace-text` or `git filter-repo --replace-text`.
4. Surgical edits to the last N commits (unpushed or coordinated): `git rebase -i`. See the [Rewriting history (local only)](#rewriting-history-local-only) section above for commands.
5. Never: `git filter-branch`. Not recommended by the git project itself.

After any rewrite: force-push, then assume platform-side caches (forks, PR pages, mirror clones, search indices) still hold the old content. Rewrite is the start of a leak response, not the end.

### git filter-repo

The modern tool. The `filter-branch` man page now points users here. Python-based, supports path filtering, content replacement, ref renaming, and per-blob callbacks. Refuses to operate on non-fresh clones by default; `--force` bypasses, which is what the gitdel script uses internally because the wrapper performs its own working-tree cleanliness checks. The typical trigger on a follow-up invocation is a prior rewrite in the same repo whose `.git/filter-repo/` directory has since been removed (the gitdel script and the crash fix below both remove it): the first run took out `origin`, so the check fails with "expected one remote, origin" even though the working tree is otherwise clean. While that directory is in place, follow-up runs skip the check.

Install: `sudo apt install git-filter-repo`.

Purge a single file from all history.

```bash
git filter-repo --invert-paths --path secret.env
```

Purge multiple paths listed in a file, one per line.

```bash
git filter-repo --invert-paths --paths-from-file paths-to-purge.txt
```

Rename a path across all of history, so the file reads under the new name from the commit that first added it and no rename event appears. The argument is matched against the full repo-relative path from the root, at path-component boundaries rather than as a raw string prefix. A path matches only when it equals OLD exactly or continues with a `/` after it, so `old/path:new/path` rewrites `old/path` and everything under `old/path/` but leaves `old/path2` and `old/path-archive` untouched even though they share the leading text. It rewrites every commit from the add point forward, with new hashes, broken signatures, and a force-push, so the post-rewrite hygiene below applies.

```bash
git filter-repo --path-rename old/path:new/path
```

Operational points about this flag. A trailing slash makes the argument a directory rename bounded to that directory's contents: `old-dir/:new-dir/` moves everything under `old-dir/` and does not match a file literally named `old-dir`. The slashes must agree on both sides; filter-repo errors on `old/:new` or `old:new/`, accepting only both-slash, neither-slash, or an empty side (`old-dir/:` lifts the directory's contents to the repo root). Without slashes the argument names a single path component, file or directory: `old.md:new.md` renames the file `old.md`, or if `old.md` is a directory it renames the directory and everything under it, but never a sibling like `old.md.bak` whose name merely starts with the same text. A colon makes filter-repo error, it does not silently mis-split: the argument is split on every colon and must yield exactly two fields, so any path containing a colon aborts with "expects one colon"; rename such paths with `--paths-from-file` using an `==>` line, which is split on `==>` and tolerates colons in the path. The rename never selects paths: a bare `--path-rename` keeps every other path and only relabels matches, so files vanish only when a `--path` filter is also present, which is a whitelist that drops everything unmatched, or when a rename lands on a path that already exists in the tree, which is silently overwritten. A rename collision inside a single commit errors loudly with "File renaming caused colliding pathnames!" unless one side is a deletion or the two blobs are identical, so two distinct files folded onto one name fail fast rather than losing data quietly. filter-repo rewrites every ref by default (heads, tags, stashes), so a single `--path-rename` invocation propagates the rename across every branch and tag in the repo; this is what you usually want for a file-shape change but is the same blast-radius point that the gitdel script's `TRACKED_SET` block already documents.

This rewrites history, removes the `origin` remote and its remote-tracking refs by design, and breaks other clones of the repo. After running, re-add `origin` and force-push, and tell any collaborators to re-clone from scratch.

### If filter-repo refuses with "not a fresh clone"

`Aborting: Refusing to destructively overwrite repo history since this does not look like a fresh clone. (expected freshly packed repo) ... Please operate on a fresh clone instead. If you want to proceed anyway, use --force.`

This is filter-repo's pre-rewrite safety check, refusing to start because the repo doesn't look like a fresh clone; the reason in brackets names the test that failed, here the pack state. The check exists because the standard recovery from a bad rewrite is to discard the clone and re-clone, and that recovery only works if a forge copy holds the pre-rewrite state and you have no local-only commits the forge doesn't.

Two paths.

Add `--force` to the same command and re-run when the repo mirrors to a forge you can re-clone from, has no local-only commits, and you accept that the throw-the-clone-away recovery posture is now provided by the forge mirror, not by the check. This is what the gitdel script does internally for exactly this reason.

```bash
git filter-repo --path-rename old/path:new/path --force
```

Re-clone fresh into a sibling directory, from the forge, or from your working copy when it holds commits the forge doesn't; run the rewrite there, `git push --mirror` to every mirror, and discard the original working copy once the rewrite checks out. This is the path the check is enforcing. Choose it when the repo is local-only, when you have any local commits the forge doesn't (verify with `git log @{u}..HEAD` per branch), or when you've forgotten whether you've pushed.

```bash
git clone --mirror <forge-url> /tmp/repo.git     # or the path to your working copy
cd /tmp/repo.git
git filter-repo --path-rename old/path:new/path
git push --mirror <forge-url>
```

The `--mirror` clone preserves every ref, so the rewrite covers every branch and tag the forge holds, not just the current branch.

### If filter-repo crashes after writing new history

`New history written in N seconds; now repacking/cleaning...` followed by a Python traceback such as `FileNotFoundError: ...first-changed-commits` means the rewrite finished but filter-repo died in its post-rewrite metadata step before refreshing the working tree. Refs already point at the rewritten history; the index and working tree still show the pre-rewrite snapshot, so a casual `ls` makes it look as if nothing changed.

This happens specifically when filter-repo finds `.git/filter-repo/already_ran` from an earlier rewrite older than a day, prompts `Treat this run as a continuation of filtering in the previous run (Y/N)?`, you answer Y, and the prior metadata is incomplete or written by a filter-repo version that didn't yet emit `first-changed-commits`. The bare avoidance is to answer N to that prompt for any new rewrite (the docs say a rewrite shouldn't count as a continuation once the earlier one's commits have been shared); the bare fix when you have already answered Y and hit the traceback is below.

First verify HEAD has the rewrite before doing anything destructive.

```bash
git ls-tree -r HEAD | grep <new-name>
```

If that prints a line, refs are correct. The fix is to repoint the working tree and finish the cleanup filter-repo aborted.

```bash
git reset --hard HEAD
rm -rf .git/filter-repo/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

`reset --hard HEAD` replaces the stale index and working tree with what HEAD already points to. Removing `.git/filter-repo/` clears state from the partial run; left in place and older than a day, it triggers the same continuation prompt on the next filter-repo invocation in this repo, and another Y answer reproduces the same crash. The `reflog expire` plus aggressive `gc` is the cleanup filter-repo would have done if it had reached the end; run it only after `ls-tree HEAD` verification, since it drops the unreachable-objects grace window that the [Recovery](#recovery-1) section below relies on for restoring a botched rewrite.

If `ls-tree HEAD` does not show the new path, the rewrite did not match. `--path-rename` is literal and root-anchored, so a bare filename matches only a file at the repo root. Clean up and re-run with the full repo-relative path on both sides.

```bash
rm -rf .git/filter-repo/
git filter-repo --path-rename docs/old.md:docs/new.md --force
```

`--force` is needed on the re-run because the repo is no longer a fresh clone after the prior rewrite, but the prior rewrite was a no-op (it matched no paths), so the force-bypass is safe here.

The gitdel script pre-cleans `.git/filter-repo/` before invoking filter-repo for exactly this reason; the crash mode above is only reachable when filter-repo is invoked directly without the wrapper.

### gitdel

For a safer, validated purge that auto-detects deleted files, handles renames, protects files still live on any branch, and prints the tip of every branch and tag before it rewrites, use the gitdel script on [Git history delete](./git-delete.md).

```bash
bash gitdel.sh <repo-path> [file-list.txt] [--dry-run] [--save-list <file>] [--yes]
```

Always run with `--dry-run` first.

```bash
bash gitdel.sh ~/projects/myrepo --dry-run
bash gitdel.sh ~/projects/myrepo --save-list ~/purge_log.txt
```

Without a file list, it scans git history for every deleted file and offers to purge them. With a file list, it purges only those paths (after validation).

### BFG Repo-Cleaner

JVM tool, multi-threaded, can be significantly faster than filter-repo on large repos, especially for size-based stripping. Two distinctive features:

1. `--strip-blobs-bigger-than 100M`: remove every blob over a size threshold without enumerating files.
2. `--replace-text rules.txt`: rewrite blob contents to redact secrets in-place. The file stays in history; the secret does not.

Weaknesses: no rename awareness, HEAD-only working-tree protection by default, no concept of "files that were deleted but might be on another branch." Best for size-driven or pattern-driven scrubs, not exact-set surgery.

### git filter-branch

Not recommended. The git man page actively recommends against it: orders of magnitude slower than filter-repo, with subtle semantic bugs in path filtering. Mentioned only because old Stack Overflow answers still recommend it. Don't.

If the only available tool is `filter-branch` (locked environment, no Python, no JVM), the right move is to install one of the alternatives. The cost of a one-time install is dwarfed by the cost of getting `filter-branch` wrong on a real repo.

### git rebase -i for recent surgical edits

For dropping or amending a few specific recent commits. Works when:

1. The change is recent (within reach of an interactive rebase).
2. The commits are unpushed, or the force-push is coordinated with everyone holding the branch.
3. The scope is a few specific commits, not "every commit that touched file X."

Beyond that, use `filter-repo` or BFG. See the [Rewriting history (local only)](#rewriting-history-local-only) section above for the commands.

### Removing specific versions of a file from history

Use case: a tracked file has accumulated history, and you want to erase exactly two (or N) historical versions from the repo while keeping every other version of that file, every other file, and the surrounding commits intact. Common reason: a draft you don't want preserved, accidentally-committed content that shouldn't have been there, content you want to archive externally and then scrub from history.

Step 1, find the commits if you don't already have the SHAs:

```bash
git log --all --follow -- path/to/file
git log --all -S 'distinctive substring from the version' -- path/to/file
```

`--follow` walks renames. `-S` (pickaxe) finds commits that added or removed a specific string.

Step 2, extract each version to a location outside the repo before doing anything destructive:

```bash
git show <SHA_A>:path/to/file > ~/safekeeping/file_va.txt
git show <SHA_B>:path/to/file > ~/safekeeping/file_vb.txt
```

`git show <sha>:<path>` prints the file's exact contents as of that commit. Verify the extracts are what you wanted before continuing.

Step 3, decide which path to use.

Path A: drop the commits entirely. Use this when the target commits only changed that file, or when you accept losing everything else they did. Cleanest history afterward.

```bash
git rebase -i <parent-of-earliest-target>
# in the editor, change `pick` to `drop` on the two target lines
```

Path B: surgical erase of just the file content at those commits, keeping the commits themselves and any other changes they carried. Use when the target commits touched other files you want to keep.

Find the two blob hashes (the IDs Git uses for the file contents at each commit):

```bash
git ls-tree <SHA_A> path/to/file
git ls-tree <SHA_B> path/to/file
# output format: <mode> blob <hash> <path>
```

Rewrite to blank just those blobs:

```bash
git filter-repo --force --blob-callback '
if blob.original_id in (b"<blob_a_hash>", b"<blob_b_hash>"):
    blob.data = b""
'
```

The two commits remain in history with their other changes intact; the file at those commits is empty. Other versions of the file in other commits survive untouched because they point to different blobs. Anything else with exactly the same content is emptied too, since Git stores identical content as one blob: the same file in later commits that left it unchanged, and any other file holding the same text, including in your current checkout. List what else holds it before you run the callback:

```bash
git log --all --oneline --name-status --find-object=<blob_a_hash>
```

Caveat on Path B: a downstream commit that "added paragraph X" relative to an erased blob will produce an unusual diff afterward, because its parent's content at that path is now empty. If history readability at those points matters more than commit preservation, prefer Path A.

Post-rewrite for Path A:

```bash
git push --force-with-lease
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

Path B's filter-repo run has already expired the reflog and pruned, and it removes `origin`, so the lease push above fails there; re-add the remote and force-push as in [After the rewrite](#after-the-rewrite).

If the repo is on a forge (GitHub, Codeberg), forks, PR pages, mirror clones, and search indices may retain the old blobs. If the hidden content is sensitive, assume it's been seen and rotate whatever the content protected. See [Anti-patterns](#anti-patterns) below for the rest of the post-rewrite hygiene.

### git replace

The non-rewriting alternative: keep the old commits, graft a replacement in front. Doesn't propagate to clones unless `refs/replace/*` is explicitly pushed (rare). Useful for hiding history locally when force-push isn't available. Not a real secret-scrub mechanism; the original blob still exists in the repo.

### Decision tree

Start at the top. Stop at the first match.

1. Need to remove a specific known set of deleted files, with rename awareness? Use the gitdel script.
2. Need to strip blobs over a size threshold? Use BFG `--strip-blobs-bigger-than`.
3. Need to redact secrets inside files to keep? Use BFG or filter-repo `--replace-text`.
4. Need to drop or edit specific recent commits? Use `git rebase -i`.
5. Need to remove specific historical versions of a still-tracked file (not the whole file)? Use the [Removing specific versions of a file from history](#removing-specific-versions-of-a-file-from-history) recipe above.
6. Need to remove every file matching a glob, accepting path-literal matching with no rename chasing? Use filter-repo or BFG with the appropriate path filter directly.
7. Need to hide history locally without force-pushing? Use `git replace`.

### Anti-patterns

1. Running the rewrite on the canonical working clone. Always use a throwaway. filter-repo's fresh-clone check exists for a reason.
2. Force-pushing without coordinating with anyone else holding the branch. Their local history diverges silently; the next merge reintroduces what was scrubbed.
3. Assuming `git gc` reclaims space automatically. It doesn't. Run `git reflog expire --expire=now --all && git gc --prune=now --aggressive` to actually free disk.
4. Treating "rewrite succeeded" as "secret is gone." Platform caches, PR pages, mirror clones, search indices, IDE history, backup systems may all still hold it. Rotate the credential at its source regardless.
5. Rewriting signed commits without re-signing. Signatures don't survive a commit-hash change; filter-repo strips them, so downstream verifiers see unsigned commits.
6. Running `filter-branch` in 2026. Stop.

### Recovery

The gitdel script prints the tip of every branch and tag before filter-repo runs. Restore with `git update-ref <refname> <sha>` if the rewrite goes wrong, as long as the old objects still exist (see below).

For broader coverage across every branch, tag, and the top of the stash stack, capture all refs before the rewrite:

```bash
git for-each-ref --format='%(objectname) %(refname)' > /tmp/pre-rewrite-refs.txt
```

If the rewrite is wrong, restore each ref:

```bash
while IFS=' ' read -r sha ref; do
    git update-ref "$ref" "$sha"
done < /tmp/pre-rewrite-refs.txt
```

This works only while the original objects still exist. As its last step, filter-repo expires the reflog and runs `git gc --prune=now`, which deletes every object no ref reaches any more, so after a completed filter-repo run, including the gitdel script's, `update-ref` fails with "nonexistent object" in that clone. The old commits then survive only on the forge until you force-push, in another clone, or in the tarball below. A rewrite that doesn't clean up after itself, such as an interactive rebase, leaves them in place until gc prunes them. So: don't run aggressive gc until the rewrite is verified.

Belt and braces: tarball the entire `.git` directory before the rewrite. Cheap, and recovers from any failure mode including gc-eaten objects.

### After the rewrite

1. Force-push every remote: `git push --force --all && git push --force --tags`. filter-repo removes the `origin` remote by design, so it needs re-adding first; the gitdel script prints those commands.
2. Rotate the leaked credential at its source. Treat the rewrite as evidence of disclosure, not as a cure.
3. Notify collaborators. Anyone with a local clone needs to re-clone or carefully re-base their work; existing branches reference commit hashes that no longer exist.
4. Expect platform caches to lag. GitHub, GitLab, and Codeberg may keep old refs accessible via the API or PR pages for some window. Contact platform support for accelerated removal if the leak is severe.
5. Verify: clone fresh, `git log --all --oneline -- <path>` should show no trace of the purged paths.
