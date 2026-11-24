# Moving files into their own repo, v2

> - **For:** anyone moving files a repo already tracks into a folder that gets a repo of its own, such as a blog or a book split out of a notes repo.
> - **Before you start:** [Getting started with Git](./git-getting-started.md), and `git-filter-repo` installed (see [Before you start](#before-you-start)).
> - **Reading time:** about 25 minutes. Read it once before running anything: the order of the steps is what matters.
> - **You end with:** the folder in its own repo, the main repo no longer tracking it, and right-click File History on any of its files showing every change back to that file's first commit.

The examples move `notes/tea.md` into `blog/content/tea.md`, and `blog/` becomes a repo of its own. The repo you start from is called the main repo here. Use your own names wherever these appear.

## Decide first: does the folder need its own repo?

Give the folder its own repo only if it has to live apart from the main repo: it's pushed to a remote of its own, to publish a site for instance, or a tool you use expects it to be a repo. If neither is true, don't make one. Move the files with [step 1](#1-move-the-files-in-a-commit-of-their-own) and stop there: the main repo keeps tracking them, and File History works as before.

If the folder does need its own repo, there are two other ways to arrange it, both covered in [A repo inside a repo](./gitconcepts.md#a-repo-inside-a-repo) in the concepts doc. A sibling folder, next to the main repo rather than inside it, avoids every overlap problem on this page. A submodule is rarely worth its friction for personal projects. The rest of this page covers the common case: the folder stays inside the main repo and gets its own repo there.

## How Git sees this

Five facts explain every step and every pitfall below.

1. **A file belongs to the nearest `.git` above it.** Once `blog/` has its own `.git`, Git commands run on `blog/` files use the blog's repo, and so does VSCodium, including right-click File History. Commands run from the main repo's root, with paths like `blog/content/tea.md`, still read the main repo.
2. **Each repo holds only its own history.** A folder repo made with plain `git init` starts empty, so File History inside it begins at its first commit, even though the main repo still has every older commit. To get those commits into the folder's repo, you build it from a filtered copy of the main repo's history. That's what this page does.
3. **Git doesn't record renames; it works them out by comparing content.** A move committed on its own, with no edits, is always found. A move combined with heavy edits can look like one file deleted and another added, and history stops there.
4. **`.gitignore` only hides files a repo isn't tracking yet.** It never makes a repo let go of a file it already tracks. Letting go is a separate step, `git rm --cached`, which removes the file from the repo's records and leaves it on disk.
5. **When a repo lets go of files, its commit shows them as deleted (D).** The files are still on disk and in every older commit. A D in that commit is normal.

## What `git status --short` is telling you

Each line starts with two characters. The first says what's staged, ready for the next commit; the second says what's changed on disk but not staged. A space means nothing in that column. These are the lines you meet on this page, and what each one asks of you:

1. **`?? blog/` in the main repo.** The main repo neither tracks nor ignores the folder. Add `blog/` to the main repo's `.gitignore` and commit that.
2. **`D  blog/...` in the main repo.** The main repo has been told to stop tracking those files, and that isn't committed yet. The files are still on disk. Commit it, as in [step 4](#4-make-the-main-repo-let-go-of-the-folder).
3. **`A  blog/...` in the main repo.** The main repo has been told to start tracking those files again. If you didn't mean that, `git reset -q -- blog` takes it back without touching any file.
4. **` M blog/...` or `MM blog/...` in the main repo.** The main repo still tracks those files, so both repos claim them. See [If the main repo tracks the folder again](#if-the-main-repo-tracks-the-folder-again).
5. **`MM content/tea.md` in the folder's repo.** You staged the file, then changed it again. Both halves are your own work. Commit it in the folder's repo, as in [Working in the folder's repo afterwards](#working-in-the-folders-repo-afterwards).
6. **` M notes/other.md` in the main repo.** An ordinary change of yours, not staged. It has nothing to do with the handoff, and a plain `git commit` leaves it out.

## Before you start

1. Install `git-filter-repo`, once:
   ```bash
   sudo apt install git-filter-repo
   ```
   Expected: apt's usual install output. Afterwards `git filter-repo --version` prints a version.

2. Run every command on this page from the main repo's root, not from inside the folder. Check with:
   ```bash
   git rev-parse --show-toplevel
   ```
   Expected: the main repo's path. If it ends in `/blog`, you're inside the folder's repo; go up one level.

3. Start with a clean tree: `git status --short` prints nothing. Commit or stash anything it lists. If the folder already has its own `.git`, run `git -C blog status --short` too, and skip to [If the folder's repo already exists](#if-the-folders-repo-already-exists).

4. Don't type the angle brackets in placeholders like `<url>`. Bash reads `<` and `>` as file redirections, and the line fails with `syntax error near unexpected token`. Where a command needs a commit hash, this page puts it in a shell variable first, such as `h=71f1d10`, and the commands use `"$h"`. A variable lasts only for that terminal window, so run the steps in one terminal.

## Move the files into their own repo

Use these steps when the folder doesn't have a `.git` yet. The order is what matters: the main repo records the move while it can still see inside the folder, the folder's repo is built from that history, and only then does the main repo let go.

### 1. Move the files, in a commit of their own

```bash
mkdir -p blog/content
git mv notes/tea.md blog/content/tea.md
git commit -m "Move tea.md into blog"
git show --stat -M HEAD
```

Expected: `{notes => blog/content}/tea.md | 0`. The `0` means the content didn't change, so Git counts it as a rename and history carries across it. Move as many files as you like in this commit, but don't edit any of them until it's committed. Dragging files in VSCodium's Explorer works too, as long as `git show --stat -M HEAD` afterwards shows each move as `{old => new}`.

If the folder doesn't need its own repo, you're done.

### 2. List every path the folder's files have had

```bash
git ls-files blog | while IFS= read -r f; do git log --follow --name-only --format= -- "$f"; done | sed '/^$/d' | sort -u > ../paths.txt
cat ../paths.txt
```

Expected: each file's current `blog/...` path and every earlier one, such as `notes/tea.md`. The list is saved outside the repo, next to it. A move made with heavy edits can hide an earlier name; add any you know is missing as its own line.

### 3. Build the folder's repo from that history

Make a filtered copy of the main repo, outside it:

```bash
git clone --no-local --no-tags --single-branch . ../blog-new
cd ../blog-new
git filter-repo --paths-from-file ../paths.txt --path-rename blog/:
git log --oneline --follow -- content/tea.md
cd -
```

Expected: `Cloning into '../blog-new'...`, then filter-repo prints `NOTICE: Removing 'origin' remote`, which is normal: it disconnects the copy so it can't push over the main repo. It ends with `HEAD is now at <hash> Move tea.md into blog`. The log lists the file's commits from before the move, now at its path inside the folder. `cd -` prints the main repo's path.

Only the listed files come along. Other files in the main repo, and its tags, stay out. Commit messages carry over unchanged, including any that mention files left behind.

### 4. Make the main repo let go of the folder

```bash
git rm -r -q --cached blog
```

Then open the main repo's `.gitignore` and add the folder on a line of its own:

```gitignore
blog/
```

Create the file if there isn't one. Then commit both changes together:

```bash
git add .gitignore
git status --short
git commit -m "Stop tracking blog: it has its own repo"
```

Expected: `git status --short` lists `M  .gitignore` (or `A  .gitignore` for a new file) and a `D  blog/...` line for every file in the folder. Those D lines are the main repo dropping its records; the files stay on disk. The commit prints `delete mode 100644 blog/...` for each. Both halves are needed: the `.gitignore` line alone untracks nothing, and `git rm --cached` alone leaves the folder showing as untracked.

### 5. Give the folder its repo

```bash
mv ../blog-new/.git blog/.git
rm -rf ../blog-new
git -C blog status --short
git status --short
```

Expected: both `status` commands print nothing.

The new `.git` has no hooks of its own. If a tool, such as a site script, installs a commit hook into the folder's repo, run that tool again.

### 6. Connect the remote

```bash
git -C blog remote add origin <url>
git -C blog push -u origin HEAD
```

Expected: the usual push output, ending `branch 'main' set up to track 'origin/main'.` If that remote already holds commits, the push is refused; `git -C blog push --force -u origin HEAD` replaces them with this history.

### 7. Check

```bash
git ls-files blog
git -C blog log --oneline --follow -- content/tea.md
```

Expected: the first prints nothing, because the main repo no longer tracks the folder. The second goes back past the move to the file's first commit. In VSCodium, right-click the file and choose File History: see [Seeing a file's history](#seeing-a-files-history).

## If the folder's repo already exists

Use this when the folder got its own repo with plain `git init`, by hand or by a tool, and File History in it starts at the folder repo's first commit. The fix copies the main repo's history for those files into the folder's repo, under its first commit. It gives every commit in the folder's repo a new hash, so if that repo is pushed, it needs one force push, and any other clone of it must be deleted and cloned again.

### A. Make sure the main repo recorded the move and let go

Check which state you're in:

```bash
git ls-files blog | head -3
git log --oneline --diff-filter=D -- blog
```

1. **The first prints nothing, and the second lists a "Stop tracking" commit:** the main repo has let go. Go to B.
2. **The first prints paths:** the main repo still tracks the folder, so both repos claim the same files. `git status` probably shows `M` or `MM` for them. If the main repo's `.gitignore` already has a `blog/` line, delete that line for now, or the next step skips files added to the folder since. Then park the folder's repo outside for a moment, so the main repo can see inside the folder, and record its current state:

   ```bash
   mv blog/.git ../blog.git.aside
   git add -A
   git status --short
   git commit -m "Move notes into blog"
   git show --stat -M HEAD
   ```

   Expected: `status` lists only the moved files, shown as `R  old -> new`, the folder's own changes, and `.gitignore` if you deleted its line; if anything else appears, unstage it with `git restore --staged <file>` before committing. `git show` shows each move as `{old => new}`. Then do [step 4](#4-make-the-main-repo-let-go-of-the-folder) above, and put the folder's repo back:

   ```bash
   mv ../blog.git.aside blog/.git
   git -C blog status --short
   ```

   Expected: no output. The folder's repo and its hooks came back unchanged.

### B. Copy the history into the folder's repo

1. Check that the folder's repo is clean, and back it up. The rewrite in step 6 deletes its old commits for good, so this backup is your undo.

   ```bash
   git -C blog status --short
   cp -a blog/.git ../blog.git.backup
   ```

   Expected: no output from either. If `status` lists files, commit them in the folder's repo first.

2. Find the commit where the main repo let go of the folder:

   ```bash
   git log --oneline --diff-filter=D -- blog
   ```

   Pick the first "Stop tracking" commit, usually the lowest one in the list, and put its hash in a variable. With the hash from your own list in place of `71f1d10`:

   ```bash
   h=71f1d10
   git log -1 --format='%h %s' "$h"
   git show --stat --format= "$h" | tail -1
   ```

   Expected: the "Stop tracking" message, then a line like `246 files changed, 63026 deletions(-)`, counting the files it let go of.

3. List every path those files had:

   ```bash
   git diff --name-only --diff-filter=D "$h^" "$h" | while IFS= read -r f; do git log --follow --name-only --format= "$h^" -- "$f"; done | sed '/^$/d' | sort -u > ../paths.txt
   wc -l ../paths.txt
   ```

   Expected: at least as many lines as files in step 2, since earlier names are listed too. `"$h^"` means the commit just before the "Stop tracking" one: the last point where the main repo still had the files. Files renamed in the folder's repo later don't need listing; that repo already has those renames.

4. Make the filtered copy, from that commit:

   ```bash
   git branch blog-hist "$h^"
   git clone --no-local --no-tags --single-branch --branch blog-hist . ../blog-hist
   git branch -D blog-hist
   cd ../blog-hist
   git filter-repo --paths-from-file ../paths.txt --path-rename blog/:
   git log --oneline | head -3
   cd -
   ```

   Expected: `Cloning into '../blog-hist'...`, then `Deleted branch blog-hist (was <hash>)`; the branch only existed to start the copy at the right commit. filter-repo prints `NOTICE: Removing 'origin' remote`, which is normal, and ends `HEAD is now at <hash> <your move commit's message>`. The log starts with that commit.

5. Attach the copy under the folder repo's first commit:

   ```bash
   git -C blog fetch "$(realpath ../blog-hist)" blog-hist
   git -C blog replace --graft "$(git -C blog rev-list --max-parents=0 HEAD)" FETCH_HEAD
   git -C blog log --oneline | tail -3
   ```

   Expected: `fetch` prints `* branch blog-hist -> FETCH_HEAD`, `replace` prints nothing, and the last lines of the log are now the main repo's oldest commits. Nothing is permanent yet: `git -C blog replace -d "$(git -C blog rev-list --max-parents=0 HEAD)"` takes the attachment off. That form only works before step 6.

6. Make it permanent:

   ```bash
   git -C blog filter-repo --force --replace-refs delete-no-add
   ```

   Expected: `NOTICE: Removing 'origin' remote` on newer filter-repo versions (older ones remove it without saying so), then `HEAD is now at <new hash> <your latest commit in the folder's repo>`. `--force` is needed because the folder's repo isn't a fresh clone; the backup from step 1 covers what that check protects. File contents don't change.

7. Check:

   ```bash
   git -C blog log --oneline --follow -- content/tea.md
   git -C blog status --short
   git -C blog rev-parse 'HEAD^{tree}'
   git --git-dir=../blog.git.backup rev-parse 'HEAD^{tree}'
   ```

   Expected: the log runs from the latest commit, through any renames made in the folder's repo and through the move, to the file's first commit. `status` prints nothing. The last two print the same hash, which proves the folder's files are byte for byte what they were.

   One thing looks odd and is expected. If the folder's repo began with other files and the moved files came in a later commit, such as "initial commit: scaffolding" followed by "add old files", that first commit now shows the moved files as deleted (D), and the later one shows them as added (A). History still runs straight through both.

8. Reconnect the remote and push, if the folder's repo has one:

   ```bash
   git -C blog remote add origin <url>
   git -C blog push --force -u origin HEAD
   ```

   Expected: `+ <old>...<new> HEAD -> main (forced update)` and `branch 'main' set up to track 'origin/main'.` Any other clone of the folder's repo, on another machine or a build host, must be deleted and cloned again.

9. Clean up, once File History looks right:

   ```bash
   rm -rf ../blog-hist ../paths.txt ../blog.git.backup
   ```

## If the main repo tracks the folder again

Use this when the main repo had let go of the folder and has taken it back: a "Stop tracking" commit was reverted or reset, or its files were restored into the main repo with `git restore --source=... --staged`. You can tell because `git ls-files blog` prints paths again and the main repo's `git status` shows ` M` or `MM` for the folder's files. If the main repo never recorded the move at all, use [section A](#a-make-sure-the-main-repo-recorded-the-move-and-let-go) instead.

Nothing is lost. The folder's repo still has its history, and the main repo's older commits are as they were. Letting go again is one commit. Run these from the main repo's root.

1. Check that the folder's repo is still in place:

   ```bash
   ls -d blog/.git
   ```

   Expected: `blog/.git`. If it prints `No such file or directory`, stop and put the folder's repo back first; without it, no repo would track the folder's files once the main repo lets go.

2. Open the main repo's `.gitignore`. If it has no `blog/` line, add one on a line of its own:

   ```gitignore
   blog/
   ```

   Then stage it with `git add .gitignore`.

3. Let go of the folder:

   ```bash
   git rm -r -q --cached blog
   git status --short
   ```

   Expected: a `D  blog/...` line for each file, and `M  .gitignore` if you changed it. Lines that start with a space, such as ` M notes/other.md`, are your own unstaged work, and they stay out of the commit. If one of your own files shows a letter in the first column instead, unstage it with `git restore --staged <file>`.

4. Commit only what's staged:

   ```bash
   git commit -m "Stop tracking blog again"
   ```

   Expected: `delete mode 100644 blog/...` once per file. Use plain `git commit` or the `git c` alias here; `git ca`, `git commit -a` and `git add -A` would sweep your other work into this commit.

5. Check:

   ```bash
   git ls-files blog | head -3
   git -C blog log --oneline | tail -3
   git -C blog status --short
   ```

   Expected: the first prints nothing. The second ends with the main repo's old commits, if you built the folder's repo from them, so the copied history is still in place. The third prints nothing, or only your own uncommitted work in the folder.

This commit only adds to the main repo's history. It doesn't change any older commit, so the move commit and everything before it stay as they were. It doesn't touch the folder's repo or any file on disk either, so no backup is needed. Until you push, `git reset --soft HEAD~1` takes it back off and leaves its changes staged.

## Working in the folder's repo afterwards

Day to day, work in the folder's repo from inside the folder:

```bash
cd blog
git rev-parse --show-toplevel
```

Expected: a path ending in `/blog`. From there every command and alias acts on the folder's repo: `git c "message"` commits what's staged, and `git ca "message"` stages everything and commits it. Not `git caas`: it folds what's staged into the last commit instead of making a new one.

To split your changes into two commits, stage the first group by name, commit it, then commit the rest:

```bash
git add <file1> <file2>
git c "First change"
git ca "Second change"
git status --short
```

Expected: `status` prints nothing at the end. A file listed as `MM` has a staged part and a later, unstaged part. Leave it out of the `git add` and the first commit takes only its staged part; `git ca` picks up the rest.

From the main repo's root, `git -C blog <command>` runs a command in the folder's repo without changing directory. Paths are then written as the folder's repo sees them, without `blog/`.

## Seeing a file's history

In VSCodium, right-click the file and choose GitLens's **Show File History**, and turn on the follow-renames toggle in that view's toolbar. With it off, history stops at the move, because the file had a different path before. The built-in Timeline may also stop there. After changing a repo's history, run **Developer: Reload Window** from the command palette (Ctrl+Shift+P) so VSCodium reads it again.

In the terminal, to see each commit with only that file's changes:

```bash
git -C blog log -p --follow -- content/tea.md
```

Press `q` to leave. For a line count per commit instead of the full changes, use `--stat` in place of `-p`. The `git lf` alias from [one-time setup](./gitreference.md#one-time-setup) can't take `-p`, because it ends in `--`; `git lf -p <file>` fails with `fatal: --follow requires exactly one pathspec`.

The main repo's side of the history can always be read from the main repo's root, even with the folder's `.git` in place:

```bash
git log -p --follow -- blog/content/tea.md
```

This is the only way to see the older history if you skipped building the folder's repo from it. It ends at the "Stop tracking" commit, which shows the file as deleted.

To click through that history in a window instead, `gitk` (`sudo apt install gitk`) shows each commit with only the listed files' changes. Give it both the new and the old path, from the main repo's root:

```bash
gitk -- blog/content/tea.md notes/tea.md
```

## Pitfalls

1. **Running `git init` in the folder before the main repo records the move.** The main repo can no longer see inside the folder, so it never records the move, and if it already tracked files there, both repos now claim them: `git status` keeps showing `M` or `MM` for them after every commit in the folder's repo. [Section A](#a-make-sure-the-main-repo-recorded-the-move-and-let-go) recovers from this.
2. **Editing files in the move commit.** A heavily edited file can come out as a delete plus an add, and history stops at the move. Move in one commit, edit in the next. The commit hook from [one-time setup](./gitreference.md#one-time-setup) warns when a rename is below 60% similar.
3. **Treating the `.gitignore` line as the way to stop tracking.** It hides only files the main repo isn't tracking yet. `git rm -r --cached` is what lets go.
4. **Discarding or restoring the folder's files from the main repo while it still tracks them.** The main repo writes its older copy over the folder repo's work. In VSCodium, don't use Discard on the main repo's entries for that folder, including the D entries of step 4: commit those instead.
5. **Reverting or resetting the "Stop tracking" commit.** It looks like an undo, but Git overwrites files a repo ignores without warning, so the revert silently writes the main repo's older copies over the folder's newer files, and the main repo claims the folder again. If it already happened, see [If the main repo tracks the folder again](#if-the-main-repo-tracks-the-folder-again).
6. **Running `git stash` in the main repo while both repos claim the files.** The stash takes the folder's newer changes with it and puts the main repo's older copies on disk until `git stash pop`. Finish the handoff before stashing in the main repo.
7. **Reading the D lines as lost files.** They appear in every commit where a repo lets go of files. Check with `ls blog`: the files are there.
8. **A remote that's gone after filter-repo.** filter-repo removes `origin` from the repo it rewrites, by design. Re-add it with `git -C blog remote add origin <url>`.
9. **Reading the next push of the main repo as a loss.** Pushing it after step 4 removes the folder from its latest version on the forge. Older commits keep it.
10. **A commit stopped by a hook you don't recognise.** With `core.hooksPath` set, as [one-time setup](./gitreference.md#one-time-setup) does, Git runs the hooks in that folder (`~/.git-hooks`) for every repo, and ignores each repo's own `.git/hooks`. A tool that installs a hook there affects all your repos. `ls ~/.git-hooks` shows what's installed; renaming a hook, for instance to `pre-commit.off`, turns it off.
11. **Letting go of the folder with `git ca`.** It stages everything first, so unrelated changes in the main repo land in the same commit. Commit the letting-go step with plain `git commit`, which takes only what's staged.

## Checks and recovery

Which repo owns the folder:

```bash
git ls-files blog                         # prints nothing once the main repo has let go
git -C blog rev-parse --show-toplevel     # prints the path of blog itself
```

If the second prints the main repo's path instead, `blog/.git` is missing or broken, and Git treats `blog/` as an ordinary folder of the main repo.

Undo step 4's `git rm -r --cached` before committing it:

```bash
git reset -q -- blog
```

Expected: no output, and `git status --short` no longer lists the folder's files. Nothing on disk changes.

Undo section B, any time before you delete the backup:

```bash
rm -rf blog/.git
cp -a ../blog.git.backup blog/.git
git -C blog status --short
```

Expected: no output. The folder's repo is exactly as it was before step 1 of section B, remote included.

## In VSCodium

The Source Control view lists every repo it finds, each with its own changes. During step 4, the main repo's D entries for the folder and the folder repo's entries for the same files can show at the same time: one repo letting go, the other taking over. `git status --short` in each tells them apart.

If the folder's repo is missing from the Repositories list, open it with **Git: Open Repository** from the command palette (Ctrl+Shift+P) and pick the folder. VSCodium finds repos in subfolders only while the `git.autoRepositoryDetection` setting is `true`, the default.

Search skips ignored folders: its `search.useIgnoreFiles` setting, on by default, leaves out whatever `.gitignore` lists, so once step 4 ignores `blog/`, a search from the main repo's folder no longer finds the folder's files. A workspace with each repo as a root of its own brings search back and keeps every repo one click away:

1. Open the main repo's folder as usual.
2. File > Add Folder to Workspace, and pick `blog`. Repeat for each other folder that has a repo of its own.
3. File > Save Workspace As, and save the workspace file, such as `notes.code-workspace`.
4. From then on, open that file with File > Open Workspace from File instead of opening the folder.

Expected: the Explorer shows a root for the main repo and one for each folder repo. Each folder also still appears inside the main repo's root; that's normal, and both show the same files on disk. Search covers every root and groups its results by root, because the main repo's `.gitignore` doesn't apply to a folder that's a root of its own.

If a workspace lists only the folder repos, the main repo has no root in it. Add the main repo's folder with File > Add Folder to Workspace, then File > Save Workspace.

To switch repos, open Source Control (Ctrl+Shift+G). With more than one repo it shows a **Repositories** list: click a repo to see its changes and commit there. The branch name in the status bar, bottom left, follows the repo you picked. If the list is hidden, open the **…** menu at the top of the Source Control view and turn on **Repositories** under **Views**.

Saved inside the main repo, the workspace file shows there as untracked. Add its name to the main repo's `.gitignore` on a line of its own, or commit it so the setup travels with the repo. Saved outside the repo, such as in your home folder, it stays out of both.