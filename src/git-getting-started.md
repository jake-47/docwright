# Getting started with Git
<p class="mdb-subtitle">Learn the basics of Git: install, commit, compare, restore.</p>

> - **For:** writers and other knowledge workers who have never used Git.
> - **Before you start:** [Whys of version control](./vcs-whys.md), and the terminal (see [Terminal basics](./terminal-basics.md)).
> - **Reading time:** about 6 minutes.
> - **You end with:** Git installed, a folder under version control, two commits, and an old version brought back.

## 1. Install Git

### On Debian-based Linux

```bash
sudo apt install git -y
```

### On macOS

Apple ships Git with its command line tools. Install them:

```bash
xcode-select --install
```

A window asks whether to install the tools; click Install, agree to the licence, and wait a few minutes. If the terminal says the command line tools are already installed, you already have Git. If you installed Homebrew for Borg, `brew install git` works too.

### On Windows

If you followed [Terminal basics](./terminal-basics.md), you installed Git for Windows to get Git Bash, and Git came with it. Run everything on this page in Git Bash.

Whichever route you took, run `git --version`; if it prints a version number, you're ready.

## 2. Create the repo

A repo is just a folder Git is tracking. You have to do this step only once per folder.

### 2.1. Name the main branch

Run this once, ever:

```bash
git config --global init.defaultBranch main
```

It prints nothing. Git calls a line of history a branch, and this names the first one `main` in every repo you create from now on. Without it, the next command may print a long hint about the name `master`; it's harmless, but this makes it go away for good.

### 2.2. Make the folder a repo

Make a folder for your writing, move into it, and turn it into a repo:

```bash
mkdir ~/writing
cd ~/writing
git init
```

Git replies with something like `Initialized empty Git repository in /home/your-name/writing/.git/`. That hidden `.git` folder is where the history lives; you never need to open it.

### 2.3. Tell Git who you are

From inside the folder, run:

```bash
git config user.name "Your Name"
git config user.email "you@example.com"
```

Both print nothing. Every commit is stamped with this name and email, and they don't have to be your real ones. Without `--global`, they apply to this repo only; [Identity setup](./gitreference.md#identity-setup) in Git reference shows how to bind one identity to a whole folder of repos once you have more than one.

## 3. Commit

Create a file. In the terminal, `echo` with `>` writes a line into a file, creating the file if it isn't there. Any text editor works just as well; save the file in `~/writing`.

```bash
echo "The first line of my essay." > essay.md
```

Now ask Git what it sees:

```bash
git status
```

It lists `essay.md` in red under "Untracked files": Git sees the file but isn't keeping its history yet. Stage it, then commit it with a one-line message:

```bash
git add essay.md
git commit -m "Start the essay"
```

You should see something like this:

```text
[main (root-commit) 4b6a9ed] Start the essay
 1 file changed, 1 insertion(+)
 create mode 100644 essay.md
```

Congratulations. That's your first commit: a snapshot of `essay.md` as it is now, with your message attached. `4b6a9ed` is the start of its unique identifier; yours will differ. The message says what the commit does, in the imperative ("Start", not "Started"), short and with no full stop; [Commit message discipline](./gitconcepts.md#commit-message-discipline) explains why.

## 4. Change and compare

Now change the file. `>>` adds a line to the end of a file instead of replacing it:

```bash
echo "A second line, added on Wednesday." >> essay.md
```

Before you commit, look at exactly what changed:

```bash
git diff
```

```text
diff --git a/essay.md b/essay.md
index 0ee63b7..e9e29ee 100644
--- a/essay.md
+++ b/essay.md
@@ -1 +1,2 @@
 The first line of my essay.
+A second line, added on Wednesday.
```

Ignore the first five lines for now. The line with no sign is unchanged, shown for context. The line starting with `+`, in green, is what you added; a line you deleted would start with `-`, in red. That's a diff: exactly what changed since your last commit.

Stage and commit, the same two steps as before:

```bash
git add essay.md
git commit -m "Add the Wednesday line"
```

That's the whole loop: change, look at the diff, stage, commit. Everything else in Git builds on it.

## 5. Get an old version back

### 5.1. Find the version

List your commits, newest first:

```bash
git log --oneline
```

```text
acb427b Add the Wednesday line
4b6a9ed Start the essay
```

If the list is longer than the screen, Git shows it a page at a time; press <kbd>q</kbd> to get back to the prompt. Copy the identifier of the version you want, here `4b6a9ed`, the first one.

### 5.2. Look at it

To read the file as it was in that commit, without changing anything, give the identifier, a colon, and the file's name:

```bash
git show 4b6a9ed:essay.md
```

It prints `The first line of my essay.` You can copy a passage you miss straight out of the terminal.

### 5.3. Bring it back

> [!CAUTION]
> Commit before you do this. `git restore` overwrites the file, and any change you haven't committed is gone for good.

To put that version back into the file itself:

```bash
git restore --source=4b6a9ed essay.md
```

It prints nothing, and `cat essay.md` shows the old version. `git status` now lists `essay.md` as modified: the old text is in your file, and the history is untouched. Stage and commit it if you want to keep it, or return to the latest version with:

```bash
git restore essay.md
```

Either way, nothing was lost: every version you committed is still in the history. Congratulations. And that's how easy it is to get an old version back.

If you'd rather see changes in an editor than in the terminal, Git concepts shows how [in VSCodium](./gitconcepts.md#seeing-file-changes-in-vscodium) and [in vim](./gitconcepts.md#seeing-file-changes-in-vim).

Next, [Git for writers](./git-for-writers.md): what all of this means when the files are prose.