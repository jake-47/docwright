# Git concepts

This post explains important concepts of Git that every knowledge worker must know.
How did you get by without it even, really?

---

## Four core concepts

There are only four ideas you need to understand before using Git.
Everything else is detail.

A repository, or "repo," is a folder that Git is tracking.
It's a normal folder on your computer: your files plus a hidden `.git` subfolder where the history lives.
You never need to open or touch that subfolder.
You interact with Git either through commands in a terminal or through a visual application.

A commit is a snapshot, a saved state of all tracked files at a moment in time.
Every commit has a unique identifier (a long string of letters and numbers), a timestamp, your name, and a message you wrote.

Staging is the act of telling Git which changes you want to include in your next commit.
You might have changed three files but only want to snapshot two of them.
Staging lets you choose.
You stage changes first, then commit them.

A diff is a comparison between two versions of a file.
It shows you exactly which lines were added, removed, or changed.
In any visual diff tool, additions are highlighted in green and deletions in red.
This is the core of what makes version history useful: not just seeing what the file looked like, but seeing precisely what changed.

## How commits actually work

The object model is worth understanding once, early.
It will make every later operation make sense rather than feel arbitrary.

When you commit, Git creates a small number of objects in its internal storage.
For a repo containing three files that you just committed for the first time, Git creates five objects:

1. Three blobs. A blob is the raw content of a file, compressed. One blob per unique file content: the blob carries no filename and no permissions (those live in the tree entry that points at it), so two identical files share one blob, and a file that doesn't change between commits keeps pointing at the same blob. Any edit, however small, produces a whole new blob; Git snapshots content, it does not store diffs at this level.
2. One tree. A tree is a list of filenames paired with the blob (or sub-tree) that holds that file's contents. It's essentially Git's version of a directory listing.
3. One commit object. The commit object points to the root tree (representing the full project state at that moment), carries the metadata (author, date, message), and points to the parent commit or commits. A normal commit has one parent. The initial commit has no parent. A merge commit has two or more parents, one for each branch being merged.

The commit object is the anchor.
Given a commit, you can reconstruct the entire state of the repo at that moment by walking from the commit to its tree, from the tree to its blobs, and from sub-trees to their nested blobs.
Sub-trees are how directories work: a tree entry pairs a name with a hash, and that hash points either at a blob (a file) or at another tree (a subdirectory).
A repo containing `notes/ch1.md` has a root tree with an entry `notes` pointing at a second tree, and that second tree has an entry `ch1.md` pointing at the blob holding the chapter's text.
Reconstruction is a recursive walk: start at the commit's root tree and descend until every entry bottoms out in a blob.
One pleasant consequence: a subdirectory you didn't touch keeps the same sub-tree hash from one commit to the next, so deduplication happens at directory granularity too, with a single reused pointer covering any number of unchanged files.
The commit also points backward to its parent, which points to its parent, and so on, all the way back to the initial commit, which doesn't point to a parent commit because it doesn't have one.
That chain of parent pointers is the history: `git log` is just a walk along it.

Two consequences fall out of this model.

First, Git's deduplication is structural rather than engineered.
Because an object's address is the hash of its own content, identical content cannot be stored twice: if you don't change a file between two commits, both commits' trees point to the same blob.
Systems whose storage isn't content-addressed have to build duplicate-avoidance as machinery (Subversion stores file changes as deltas between revisions; Mercurial's revlogs are per-file delta chains; backup tools like borg and restic implement explicit chunk-level deduplication); in Git it falls out of the addressing scheme.
The one engineered layer Git does add is delta compression inside packfiles, which squeezes similar-but-not-identical blobs during garbage collection; that runs underneath the model and changes nothing about it.
This is why ten years of commits on a slowly-evolving document occupy negligible space.

Second, every commit is immutable.
A commit object is identified by a cryptographic hash of its own contents.
Change anything about it (the message, the author, the parent, even a timestamp) and the hash changes, which means it's now a different commit.
This is why "rewriting history", the family of operations that replace commits with edited copies (amending the last commit, rebasing a series; both covered in § Rewriting history below), is technically a misnomer: you don't edit old commits, you create new commits that replace them.
Old commits still exist in the database until garbage collection eventually removes them, which is why the reflog can still find them weeks later.
One corollary, stated directly: two commits can carry an identical title and still be distinct commits, because the message is only one of the hashed inputs, and their trees, parents, or timestamps differ.
A busy repo accordingly accumulates many commits titled `Merge branch 'main'`.

## Branches as pointers

A branch in Git is a lightweight movable pointer to a commit.
That's it.
The default branch name in Git is `main` (older repos use `master`).

When you make a commit, Git creates a new commit object whose parent is the commit you were previously on.
Then it moves the current branch pointer forward to the new commit.
Every time you commit, the branch pointer advances automatically.

One more pointer completes the picture: HEAD.
HEAD is Git's you-are-here marker; it normally points at a branch, which points at a commit, and committing moves the branch while HEAD rides along.
`HEAD~1`, `HEAD~2`, and so on count backward from wherever HEAD is, which is why the reference doc uses them as the standard way to name recent commits.
HEAD can also point directly at a commit instead of at a branch, the state Git calls detached HEAD, which you enter when you check out an old commit to look around.
Detached HEAD is a read-mostly state, not an error: looking is free, but a commit made there belongs to no branch, so it becomes unreachable the moment you switch away (recoverable from the reflog for ninety days, like everything else).
If you decide to build on an old commit, create a branch right there first; the warning Git prints on detaching says exactly this.

Creating a new branch is just writing a new pointer.
It costs nothing.
Deleting a branch is just removing a pointer, it doesn't delete the commits the branch pointed at (those remain reachable through other branches, or through the reflog).

This is why Git culture encourages using branches liberally.
They are not expensive objects.
They are file names containing a commit hash.
Create one every time you want to try something.
If it works, merge it; if it doesn't, delete it and the experiment vanishes cleanly from your workflow while the commits themselves remain in the reflog for ninety days as a safety net.

The mental model: your main branch (usually called `main`) should always be in a known-good state.
Every piece of in-progress work happens on its own branch, isolated from everything else, and only gets integrated into main when it's ready.
This feels like overhead on day one and feels like oxygen by month six.

## Staging, explained

One distinction comes before staging: tracked versus untracked.
A file Git has never been told about is untracked; it shows up in `git status`, but it belongs to no snapshot, and nothing in Git protects or records it until the first `git add`.
That first `add` is what turns a file from invisible to tracked, and only tracked files participate in anything this document describes.
The classic first-week surprise follows directly: `git commit -a` stages and commits modified tracked files only, so a brand-new file silently stays out of the commit until it has been added once.
When a commit seems to be missing a file, check `git status` for it under "Untracked files" before suspecting anything deeper.

The staging area was designed for a workflow that most solo users, and especially beginners keeping personal version history, don't actually have.
Git was originally built for Linux kernel development, where a single developer might be working on several unrelated changes simultaneously and needs to package them into separate, clean commits before sharing them with other people.

Imagine you sit down to fix a bug, and while you're in there you also notice a typo in a comment, and you decide to rename a variable for clarity.
You've now made three logically unrelated changes to your working files.
If you commit them all together, the history becomes muddy; someone reading it later sees "fixed bug" but the commit also contains the rename and the typo fix, which makes it harder to understand what actually fixed the bug, and much harder to undo just one of those changes later.

The staging area lets you say: "Of all the changes sitting in my files right now, include only these specific lines in the next commit."
You stage the bug fix and commit it with a clean message.
Then you stage the typo fix and commit that separately.
Then the rename.
Three clean commits, each doing one thing, each reversible on its own.
That's the point of staging: it's a workbench where you assemble a commit before finalizing it, rather than being forced to commit everything that's currently different from the last commit.

This matters enormously on collaborative projects where other people will read your history, review your commits, and potentially revert individual ones.
It matters less when you're keeping a personal save-point history of your own work.

Solo workflows are usually "I'm working, I want to save this version, let me commit, now I can keep going, then commit again."
You can absolutely use Git that way.
The command `git commit -a` skips the staging step entirely and commits every tracked change in one go.
In GUIs, most of them have a "stage all and commit" button or a checkbox that selects all changes at once.

There are four levels of staging granularity, from least to most precise.

File-level.
You've modified three files and want to commit only two.
Stage the two with `git add file1 file2`, commit; the third file stays in your working directory, unstaged, waiting for a future commit.

Hunk-level.
A single file contains two unrelated changes; you want to commit one, not the other.
Use `git add -p file`, which walks you through each "hunk" (a contiguous region of changed lines) and asks `y/n/q/a/d/s/e/?`:

1. `y` stages this hunk.
2. `n` skips it.
3. `q` quits.
4. `a` stages this and all remaining hunks in the file.
5. `d` skips this and all remaining hunks.
6. `s` splits the current hunk into smaller hunks when Git has grouped unrelated changes together.
7. `e` opens the hunk in your editor for line-by-line selection.
8. `?` shows help.

Line-level.
Inside the `e` option of `git add -p`, you can hand-pick individual lines.
In the editor, deleting an added line (one starting with `+`) excludes it from staging.
Changing a removed line's `-` to a space keeps the deletion in your working directory without applying it to this commit.
Fiddly the first few times, surgical once you're used to it.
VSCodium's "Stage Selected Ranges" (§ Seeing file changes in VSCodium, below) is the same mechanism with a better interface.

Stage-everything.
`git commit -a -m "message"` grabs every tracked modified file, stages it all, and commits in one shot.
The workflow for people who don't want to think about staging.

Staging is not a one-way door.
`git restore --staged file` unstages without changing the file's contents.
The staging area is a scratch pad, not a commitment.

## When staging actually matters for solo work

Honest answer: for a personal project, line-by-line staging is useful rarely.
Most of the time, on solo work, you'll commit everything and move on.
The elaborate machinery exists, but the situations that actually demand it are uncommon in solo workflows.

Here's where it earns its keep, even alone.
The scenario is almost always the same shape: you sat down intending to do one thing, got distracted or curious along the way, and now your working directory contains two or three logically separate changes mixed together.
You fixed a bug, but while you were in that file you also cleaned up some formatting, and you started sketching a new feature that isn't working yet.
If you commit all of that as one blob with a message like "bug fix and other stuff," you've lost the ability to do a few things later.
You can't revert just the bug fix without also reverting the formatting and the half-done feature.
You can't look back at the history and understand cleanly when or why any one of those changes happened.
And if the half-done feature turns out to be a dead end, you can't throw it away without losing the bug fix that's tangled up with it.

Staging lets you untangle that mess at commit time.
You stage and commit the bug fix with a clear message.
You stage and commit the formatting cleanup with its own message.
The half-done feature stays in your working directory, uncommitted but not lost, and you keep working on it or discard it later.

The second real use case is more specific: the "oh no" moment.
You've been working for two or three hours.
Things are partly working and partly broken.
You realize you want to save the parts that work before you break them further, but you don't want to commit the broken parts because committing broken code even to your own history is annoying.
Staging lets you pick out the working parts, commit them as a solid checkpoint, and keep fiddling with the broken parts without fear.

A realistic usage pattern on a personal project: ninety percent of the time, commit everything together because your changes are coherent.
Maybe eight percent of the time, use file-level staging because two files are changed for unrelated reasons.
Maybe two percent of the time, reach for `git add -p` because you actually need to split changes within a single file.
The line-by-line editing option gets used a handful of times per year.
The tool exists for when you need it.

Don't try to learn staging up front as an abstract concept.
Commit everything together with `git commit -a -m "message"` or the equivalent GUI button, and get comfortable with the basic rhythm.
Eventually you'll hit one of the scenarios above, and at that point staging will stop feeling like arbitrary complexity and start feeling like the right tool.
Learn it then.
The understanding sticks much better when it's attached to an actual problem you're trying to solve.

## Seeing file changes in VSCodium

If a visual diff is easier for you to read than terminal output, VSCodium gives you a Git workflow that makes the diff, the staging step, and the commit itself legible at a glance.
The Source Control panel built into VSCodium covers the daily cycle on its own; the GitLens extension adds blame, history, and visualization on top.

### Built into VSCodium

Open the folder that contains your repo.
VSCodium auto-detects the `.git` folder inside and enables the Source Control panel without any extension installed.

The Source Control icon sits in the left sidebar: a branching-line icon.
Click it.
The panel has two main sections: "Changes" (files you've modified but haven't staged) and "Staged Changes" (files you've added with `git add`).
Below them, a text box for the commit message, and a checkmark button to commit.

Click a changed file to see the diff.
The diff opens in the main editor, showing two columns: the last committed version on the left, your current version on the right.
Green highlights are additions; red highlights are deletions.
Lines with no highlight are unchanged context.

To stage a whole file, hover over its name in the Changes list and click the `+` that appears.
The file moves down to Staged Changes.

To stage a specific hunk within a file (when you only want to commit part of the file's changes), hover over the hunk in the diff view.
A small `+` appears beside it.
Click it.
That hunk stages; the rest remains unstaged.

To stage individual lines, select them in the diff, right-click, and choose "Stage Selected Ranges."
This is the visual equivalent of `git add -p` with the `e` (edit) option covered in § Staging, explained above.
Surgical control, done by mouse selection instead of editor surgery.

Once you have what you want staged, type a message into the text box at the top of the Source Control panel, then either click the checkmark or press Ctrl+Enter.
That's a commit.

### What GitLens adds

Install GitLens from the Extensions panel (search for "GitLens, Git supercharged"; the publisher is `eamodio` on Open VSX, maintained by GitKraken).

GitLens adds several further capabilities worth knowing:

1. Inline blame annotations: the editor shows, for the line your cursor is on, who last changed it, when, and with what commit message. If it becomes distracting you can toggle it off: `GitLens: Toggle Line Blame`.
2. Gutter indicators: thin colored bars in the left margin of the editor mark which lines have been added, modified, or deleted since the last commit. A quick visual of what you've changed in the open file.
3. File history: right-click any file and choose "Open File History" to see every commit that touched it, with previews of each version.
4. Commit graph: a full visualization of your branch structure. Useful when history gets tangled. Free for local and public repos; private-repo access requires a GitLens Pro subscription, as do Worktrees, Visual File History, and the AI features.
5. Compare: you can compare any two branches, or any two commits, and see a combined diff.

This much is enough to replace most command-line usage for a solo writer or developer.
You still drop to the terminal for complex history surgery (filter-repo, reflog recovery, ad-hoc shell tooling), but for the daily edit-stage-commit cycle the GUI is faster and more legible than the terminal.

## Seeing file changes in vim

If you edit in vim, the diff view should also be in vim.
A terminal pager like `git-delta` is a step backward when your editor is already a better diff viewer than any pager: pagers are read-only, they don't honor your keybindings or colorscheme, and you can't act on what you see.

The dominant tool in vim culture is Tim Pope's `vim-fugitive` plugin.
With your repo open in vim, run `:Gdiffsplit` for a horizontal split or `:Gvdiffsplit` for a vertical one.
You get the indexed version of the current file alongside the working-tree version, both as real vim buffers, with synced scrolling, automatic folding of unchanged regions, and full editability on either side.
Vim's diff-mode keybindings worth memorizing:

1. `]c` jumps to the next changed hunk; `[c` jumps to the previous.
2. `do` (diff obtain) pulls the change at the cursor from the other buffer into the current one.
3. `dp` (diff put) pushes your version into the other buffer.
4. `:Gwrite` (fugitive) stages the current buffer (equivalent to `git add` on that file).

The combined effect: read the diff, decide hunk by hunk what stays and what reverts, stage the result, and commit, all without leaving vim.

If you don't want plugins, use vimdiff directly.
Configure it as Git's diff tool once:

```bash
git config --global diff.tool vimdiff
git config --global difftool.prompt false
```

Then `git difftool <file>` opens that file's diff in vim, and `git difftool` with no argument walks every changed file in turn.
Same `]c`, `do`, `dp` keybindings; you just don't get fugitive's tighter integration with `git add`, `git blame`, and the rest.
For comparing arbitrary files outside Git, plain `vimdiff file1 file2` works with no setup.

## Which tool when

The principle: use the diff tool tied to whichever editor you actually live in.
The argument is the same regardless of editor: if you can read the diff and edit either side without leaving the tool you already use all day, the friction of context-switching disappears and the keybindings carry over.
This doc covers vim and VSCodium concretely; other editors (Sublime, JetBrains, Helix, emacs with magit, Zed) have analogous integrations and the principle generalizes.

If you edit in vim, fugitive's `:Gdiffsplit` is the strongest combination of viewer and editor available anywhere.
Both sides are buffers in your editor, you can edit either, you can stage from inside, and the keybindings are the same ones you use all day for everything else.
Nothing else in this list matches it for someone fluent in vim.

If you edit in VSCodium, the built-in Source Control panel plus GitLens is the strongest editor-integrated option available there.
The diff view shows committed and working versions side by side, you can edit the working side directly, and hunk-level staging is one click.

GitHub's web diff is a different category.
It's optimized for reviewing other people's pull requests, with line-level comments and "suggest changes" boxes.
You can't see your own uncommitted local work there at all (you have to push first), and the editing affordances are minimal.
Use it for code review of other people's work, not for your own daily edit-stage-commit cycle.

`git-delta` and similar terminal pagers (`diff-so-fancy`, `diffr`) sit below all of these.
They prettify the read-only diff output you see when you run `git diff` or `git show` in a terminal.
Useful when you're already in the terminal and want a more legible pager than `less`.
Not a workflow tool; it's a nicer view, nothing more.

Plain `git diff` piped through default `less` is the floor: zero setup, ugly but unambiguous, and what you'll see when you ssh into a server you haven't configured.
Worth being comfortable with for that reason.

A two-line decision rule.
If you're editing the file, use the tool tied to your editor.
If you're just reading, use whichever pager is in front of you.

## Commits as communication

Here is the principle that underlies nearly every piece of specific advice that follows: Git is not a backup tool, it's a communication tool.
It happens to also back up your work, but that's a side effect.
What it's really doing is creating a record that communicates your thinking to other people, and the most important "other person" you will ever communicate with through Git is your own future self.
Every decision about how to use Git flows from taking that seriously.

Linus Torvalds, the Bitcoin Core maintainers, the Linux kernel community: what makes their use of Git exemplary isn't technical sophistication, it's that they treat every commit as a message to future readers.
Once that principle is internalized, most of the specific practices become obvious.

## Commit message discipline

From that principle, the first concrete habit: write commit messages that explain why, not what.
The diff already shows what changed.
Anyone can read that.
What the diff can't tell them is why you made the change.

"Fixed bug" is useless.
"Fixed off-by-one error in pagination that caused the last item to be skipped when total count was exactly divisible by page size" is a gift to the future.

The canonical format used by the Linux kernel and adopted by most serious projects:

1. Summary line of fifty characters or less.
2. Blank line.
3. Longer explanation in paragraphs, explaining the context, the reasoning, and any caveats.

Three further conventions go with that format:

1. Imperative mood for the summary. "Add login redirect," not "Added" or "Adds." It reads as completing the sentence "If applied, this commit will...". This is what git itself uses for its own commits ("Merge branch", "Revert", "Update").
2. No trailing period on the summary. It's a one-line label, not a sentence. The period adds visual noise without information.
3. Body wrapped at seventy-two characters. Pairs with the fifty-character summary rule. `git log` indents the body by four spaces (4+72=76, fits an 80-column terminal); email patch workflows quote-prefix replies, and longer lines break across wraps; `git format-patch` and similar tools assume it. Without the wrap, `git log` and any email-based review render ragged.

A full example that obeys all of the above, for code:

```text
Fix dropped last page on exact-multiple counts

The page count used integer division of total by page_size, which
dropped the final page whenever total was an exact multiple of
page_size. A request for the last page returned empty and the item
was never rendered.

Round up so a full final page is always emitted, and add a
regression test covering the exact-multiple boundary.

Closes #214.
```

The summary is imperative, under fifty characters, and has no trailing period.
A blank line separates it from the body.
The body explains why the bug existed and what the fix does, wrapped near seventy-two, and a trailer points at the issue.

The same shape for prose drops the issue trailer and records intent rather than mechanism:

```text
Cut the second paragraph of the intro

It restated the thesis the opening already carried and slowed the
entry into section 1. The argument reads tighter without it.
```

You don't need to follow this rigidly on personal projects, but you should absorb its spirit.
Every commit message should answer the question: "if someone finds this commit in a `git blame` three years from now while debugging, what do they need to know?"

Several short pieces are worth reading once and internalizing.

Chris Beams, "How to Write a Git Commit Message," https://cbea.ms/git-commit/.
The seven rules with worked before-and-after examples; the canonical modern how-to.

David Thompson, "My favourite Git commit," https://dhwthompson.com/2019/my-favourite-git-commit.
A one-character whitespace fix whose message documented the error, the investigation, and the fix, later found by others running `git log --grep` who learned who had hit it before and how they solved it.

Michael Lynch, "No Longer My Favorite Git Commit," https://mtlynch.io/no-longer-my-favorite-git-commit/.
The rebuttal to the piece above: the same commit buries its key point too deep, which is the case for putting the load-bearing line first.

Tim Pope, "A Note About Git Commit Messages" (2008), https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html.
The origin of the fifty/seventy-two/imperative conventions above; nearly universal in serious projects.

A common temptation is to skip the body because the reasoning already lives somewhere else: a changelog, a versioning file, an issue, a design note.
The message and an external file are not interchangeable, for three reasons.

Locality: `git blame` and `git log -L` land you on a specific line tied to a specific hash, with the message right there (both tools are walked through in § Reading history: log and blame, below); an external file forces a second lookup, and assumes it still matches the change and was not reorganized since.

Binding: the message is hashed into the commit and cannot drift, whereas an external file is mutable and over years drifts away from the diffs it once described.

Audience: a changelog is reader- or release-facing, whereas a commit message is maintainer-facing at the grain of one change.

The resolution is a pointer, not duplication.
If the deep rationale genuinely belongs in another file, let the body reference it (an issue number, a doc path, a changelog anchor) rather than restating it.
What stays non-negotiable is the summary line, because that is what `blame` and `log` surface regardless.
A body that is only a durable pointer is fine when the summary is load-bearing; a dead summary like "update" or "fix" is not, because the external file will not be in front of you when the tool puts you on the line.

A related question is which whys belong in the document's own text rather than a commit at all.
The split that holds is current state versus transition.
Rationale about the current state, the thing every future reader of the document needs in front of them, belongs in the prose: it should be visible without running a single Git command.
Rationale about a transition, why you changed something from what it was, belongs in the commit: it is tied to that specific change, and surfacing it in the document would clutter the living text with the history of decisions already made.
A why that you judge not worth surfacing in the document is usually a transition why, and the commit is its proper home.

A further question: does a change so obvious it explains itself need a message at all?
The subject line, always: Git refuses an empty message, and a dead subject like "update" defeats every tool that surfaces it.
The body, only when it carries a why the diff cannot show; "Fix typo in § Hooks" is complete with no body, because the diff is the explanation.
The trap is judging "obvious" by diff size.
The most celebrated message in the reading list above, David Thompson's favourite, decorates a one-character whitespace diff, and the body was the entire value.
Test by recoverable why, not by size: if a stranger reading the diff in three years would still ask why, write the clause.
When in doubt, one sentence of why costs less than the doubt.

A related scoping question: when the repo holds many files and a commit touches one, should the summary name the file?
As a rule, no: the summary names the change, not the file list.
Every tool that surfaces the summary sits next to a tool that surfaces the files (`git show`, `git log --stat`, `git log -- <path>`), so a filename in the summary spends scarce characters on what the diff already carries, and the fifty-character budget is better spent on intent.
The earned exception is the area prefix, the `subsystem: summary` convention from large repos: the Linux kernel writes `net: sched: fix refcount leak` because in a tree that size a summary is unreadable without locating context, and the prose analog is `ch2: tighten opening` in a book-sized repo.
Use the prefix when the change is meaningless without its location; never use the summary as a file inventory.
For session-grain commits the dated enumeration already plays this role, and the path-prefixed body line shown in the session-grain subsection below scopes a why to one file inside the bundle.

For the day-to-day mechanics — the aliases (`git c`, `git ca`, `git last`), the `commit.verbose` setting, the commit message template, and the editor configuration that makes all this comfortable — see the Git reference doc.

## One commit, one logical change

Each commit does one thing.
This is where the discipline of staging becomes valuable, not because you have to use it on every commit, but because the principle of "one commit, one logical change" is what makes history valuable decades later.

A commit that mixes a bug fix, a refactor, and a new feature is nearly impossible to reason about in isolation.
You can't revert part of it.
You can't understand it at a glance.
You can't cherry-pick it to another branch.

Small, focused commits are the atoms of a useful history.

Rule of thumb: if you find yourself writing "and" in a commit message, you probably should have made two commits.

Concretely: one sitting produces a bug fix and a rename, and the single message would have been "Fix dropped last page and rename PageHelper".
Split, it becomes two commits, "Fix dropped last page on exact-multiple counts" (the commit shown in full in the previous section) and "Rename PageHelper to Paginator", each revertable, readable, and cherry-pickable on its own.

## Commit often, curate before sharing

Two practices for handling the gap between "save often" and "history should be legible."
Which fits depends on the repo.
For shared code, multi-author projects, anything that gets reviewed before merging: commit messily while working, then curate before pushing (the workflow below).
For solo writing, single-author docs, exploratory personal projects with no shared history to clean up for: commit at session grain with dated messages (the subsection at the end of this section).
Mixed-author writing projects sit in between — session-grain locally is fine, but commits that ship as releases or get pointed at externally are worth curating.
Pick the model that fits the repo's audience; don't try to apply both.

This resolves what otherwise feels like a contradiction.
"Small focused commits" sounds incompatible with "just save your work as you go."
The answer is that your local in-progress history doesn't have to be clean.
Commit messily while you're working, whenever you hit a checkpoint, with throwaway messages like "wip" or "trying this."
Then, before you push or share, use interactive rebase (`git rebase -i`) to reshape that messy sequence into clean, logical commits with real messages.

Squash the typo fixes into the commits they belong to.
Split large commits that do too many things.
Write proper messages.
This is the workflow experienced maintainers use, and it's what lets their public history look so crisp even though their actual working process is as chaotic as anyone's.
The private draft is scruffy; the published version is polished.

### Session-grain commits

Not every project needs the curate-before-share workflow.
Solo writing, exploratory personal notes, long-running single-author docs — there's no shared history to clean up for, so the curation step adds friction without much payoff.
For these workflows the defensible practice is the dated work-session commit, used as the primary commit grain rather than as scratch to be rewritten later.

The format is a date plus a brief enumeration of areas touched:

```text
2026-05-28 — ch3 revisions, footnotes, intro tightening
```

The date alone is redundant with what `git log` shows; the value is in the enumeration after the em dash, which makes `git log --grep=footnote` or `git log --grep=ch3` find the sessions where you touched a given area.
The commit isn't atomic — it bundles whatever a writing session produced — and the message names the bundle honestly without pretending otherwise.

Two things this is not.
It is not a substitute for one-logical-change commits when the work is shareable; for code or collaborative projects, curate.
It is not an excuse to skip `git diff --staged` before committing — even a session-grain commit benefits from a glance at what's actually in it, especially to catch accidentally-staged secrets or junk files.

Scoping a why to one file inside a bundled session commit.
A session commit gathers several files, but a commit still carries exactly one message; there is no per-file message field.
There are two ways to attach a why to a single file without unbundling the rest.
Put the why in the body on a line prefixed with the file's path, so `git log -- path` and `git blame` surface it against that file later.
Or split that one file into its own commit, so its message is its why, and commit the remaining files under the session line separately.
Which to use is a discoverability call: history views and inline blame show only the subject line, so a why in the body is found by `git log --grep` or `blame`, not by scanning `git log --oneline`.
A light note rides fine in the body; a why heavy enough that a future reader must not miss it is the signal to give that file its own commit, where the message is bound to the change and shows up on its own.

Concretely, the two shapes.
The why riding in the session body, prefixed with the file's path:

```text
2026-06-08 — ch2 pass, refs cleanup, typo sweep

notes/ch2.md: cut the Hodge block quote; it was secondhand via
Berkhof, replaced with a direct citation.
```

And the same why promoted to its own commit, with the session commit shrinking around it:

```text
Cut the Hodge block quote from ch2

It was secondhand via Berkhof; replaced with a direct citation so
the chapter quotes Hodge at first hand.
```

```text
2026-06-08 — refs cleanup, typo sweep
```

The commands for both, multiple `-m` paragraphs and a path-scoped partial commit, are in the Git reference doc.

The hierarchy that matters: curated atomic commits are best when there's shared history, session-grain dated commits are a legitimate practice for solo work where curation buys nothing, and unlabeled `wip` or `update` commits across years are the failure mode this section exists to prevent.
Pick the grain that fits the work; commit at that grain deliberately.

## Rewriting history

Git lets you rewrite history, with caveats.
The mechanisms:

For the most recent commit:

```bash
git commit --amend -m "new message"
```

This replaces the message on the last commit you made.
Without `-m`, `git commit --amend` opens your editor to write a longer message.
You can also amend to add forgotten changes: stage the changes, then `git commit --amend --no-edit` folds them into the previous commit without touching the message.

For older commits:

```bash
git rebase -i HEAD~N
```

`-i` is interactive.
`HEAD~N` means "go back N commits."
Git opens an editor showing those commits as a list, each prefixed with `pick`.
Change `pick` to:

1. `reword` to change the message.
2. `squash` to fold the commit into the one above it (combining both messages).
3. `fixup` to fold in without keeping the message.
4. `edit` to stop at this commit and amend it.
5. `drop` to delete the commit entirely.

Reorder commits by moving lines.
Save and close, and Git walks through your instructions.

The interactive rebase above is the general tool.
For the specific case of "commit C is missing a small change," there's a cleaner shortcut: the fixup + autosquash workflow.
Stage the change, then `git commit --fixup=<C>` records a new commit with the message `fixup! <subject of C>`.
When you later run `git rebase -i --autosquash <C>^`, Git pre-positions the fixup next to C and pre-marks it for squashing — you confirm by saving the editor.
This is the dominant workflow on rebase-based projects (Bitcoin Core, the Linux kernel, CPython) because it skips the manual reorder-and-relabel step that plain interactive rebase requires.

Note that `--amend` itself only operates on HEAD.
There's no syntax to target an older commit; for anything beyond HEAD you need rebase, and the fixup pair is the path of least friction.

For merges specifically, interactive rebase across them requires `--rebase-merges`:

```bash
git rebase -i --rebase-merges HEAD~5
```

Without that flag, rebase flattens out merges, which you probably don't want.

## The safety rule

Rewriting is safe when the commits only exist locally.
The moment you've pushed to a shared remote, rewriting causes problems.
Other people's copies of history diverge from yours, and reconciling it requires force-pushing, which can destroy their work if they've built on top of the commits you rewrote.

For a purely solo project, or where you're the only one pulling, rewrite freely.
For anything shared, the rule of thumb: rewrite only commits that haven't been pushed, and leave pushed history alone.

When you must force-push (amended a commit and need the remote to accept the new version), use `--force-with-lease`:

```bash
git push --force-with-lease
```

This refuses the push if the remote has changed in a way you didn't expect, preventing you from overwriting someone else's work you didn't know had been pushed.
Use it instead of plain `--force` by default.

There's a lighter-weight alternative: `git notes`.
Notes let you attach additional commentary to a commit without rewriting it.
The commit itself is untouched; you add a note alongside it with `git notes add -m "additional context" <sha>`.
Safe on pushed commits because it doesn't alter the commit.
Downsides: notes don't show up in most views by default, and they don't travel between repositories automatically without extra configuration.
A niche tool, useful occasionally.

## The reflog as safety net

`git reflog` is Git's safety net.
It's a log of where HEAD has been, so if you ever feel like you've lost work through a bad rebase or a hard reset or some other destructive operation, the reflog almost certainly still has the commit you're worried about losing.

New users panic about "losing" weeks of work, and it's almost always recoverable through the reflog.
Knowing this exists lets you experiment fearlessly, because Git very rarely actually loses anything: it just moves references around.
The reflog keeps a record of every move for ninety days by default.

The typical recovery pattern:

```bash
git reflog                                # find the sha you want
git reset --hard <sha>                    # go back to it
# or:
git branch recovery <sha>                 # save it as a new branch
```

If you ever find yourself in a state you don't understand after a destructive operation, stop before running more commands.
Read the reflog.
The panic-repair cycle is where people actually lose work, not the original mistake.

## Reading history: log and blame

Good commit hygiene pays off only if you actually read history.
`git log` and `git blame` are the tools that make it worth your while.

`git log --oneline --graph --all --decorate` is the one flag combination worth memorizing.
Compact visual history of every branch.
Aliasing it as `git lg` (see the configuration section below) saves typing.
A sample of what it shows, output illustrative:

```text
$ git lg
* 3f2a91c (HEAD -> main) Tighten §2 opening
* 8c41d07 Add covenant-of-works subsection
| * a19be4f (experiment/first-person) Recast ch1 in first person
|/
* 5d20e83 Cut second intro paragraph
* 2b7f410 Initial commit
```

One line per commit, branch and HEAD labels inline, and the graph column showing where the experiment branch forked from main.

`git log -S "string"` (pickaxe) searches history for commits that added or removed a specific string.
This is how you find "when did this text first appear in the document?" or "when did I delete that paragraph?"

`git log --author="name"` and `git log --since="2 weeks ago"` filter the log by who and when.

`git blame <file>` annotates every line with the commit that last touched it.
Combined with a good commit message, the blame tells you not only when a line was written but why.
This is where the investment in commit messages compounds.
Again illustrative:

```text
$ git blame -L 12,14 notes/ch2.md
8c41d07 (jdoe 2026-05-30 14:02:11 +0530 12) The covenant of works frames
8c41d07 (jdoe 2026-05-30 14:02:11 +0530 13) the argument: obedience as the
3f2a91c (jdoe 2026-06-02 09:41:38 +0530 14) condition, life as the promise.
```

Three lines, two commits: the first two last moved in the subsection commit, the third in a later tightening pass, and `git show 3f2a91c` surfaces the why behind it.

For the full option surface, the manual pages are authoritative: `git-scm.com/docs/git-log` and `git-scm.com/docs/git-blame`.
Pro Git's chapter on viewing history (`git-scm.com/book/en/v2/Git-Basics-Viewing-the-Commit-History`) is the best guided tour of `git log`'s filtering flags.

The habit of looking at history when debugging, "when did this break? what changed around then? why?" is where Git transforms from a save-point tool into something closer to a time machine.

## The commit log as changelog

Before version control, projects maintained changelogs by hand.
A file called `CHANGELOG`, `CHANGES`, or `NEWS` sat at the root of the source tree, and the maintainer added an entry to the top of it at each release: version number, date, a few bullets of what changed.
GNU projects have used `NEWS` files for this since the 1980s; many still do.
The "Keep A Changelog" convention (2014) codified a Markdown format for the same practice.

The problem with hand-written changelogs is drift.
The changelog lives parallel to the actual history.
Maintainers forget to update it.
Entries get written at release time from memory, which is unreliable and selective.
The changelog says one thing, the commits say another, and the commits are right.

Git subsumes the raw version of this work.
The commit log is the changelog, generated automatically from the commits you've been making all along.
For any two points in history, `git log v1.0.0..v1.1.0 --oneline` gives you every commit between them in order, with no effort.
`git shortlog -sn v1.0.0..v1.1.0` groups them by author.
`git log --since="1 month ago"` gives a month's worth.
These generate the changelog; they do not require you to maintain a changelog file.

What Git doesn't replace is the curated release note.
A commit log is for an engineer investigating history.
A release note is for a user deciding whether to upgrade.
Converting the former into the latter is still a writing task: grouping by category (features, bug fixes, breaking changes), discarding commits users don't care about (typo fixes, internal refactors), and translating developer language into user-facing language.
The difference is you're editing a generated draft rather than reconstructing from memory.
You can't miss a commit because the tool is listing all of them.

Tools that bridge the two levels.
`git log v1.0.0..v1.1.0 --oneline` as the starting draft.
On GitHub, `gh release create v1.1.0 --generate-notes` auto-drafts release notes from commits and PRs since the last tag, which you then edit.
Conventional Commits (a convention that prefixes commit messages with `feat:`, `fix:`, `breaking:`) lets tools like `git-cliff` or `release-please` auto-group entries by category; worthwhile for projects that ship often, overkill for solo writing.

For a personal writing repo, the commit log is the changelog, full stop.
You don't need a `CHANGELOG.md` file; readers who care about change history read `git log` or click "History" on the host's web view.
If you want a human-readable summary when you ship a revision, generate it from `git log` at that moment, don't maintain it in parallel.

Per-file history is the same idea at finer grain.
`git log --follow <path>` shows every commit that touched a specific file, following renames across its lifetime.
On GitHub, `https://github.com/<user>/<repo>/commits/<branch>/<path>` is the web rendering of that log.
A blog or reference site can expose this URL as a "History" link in the footer of every page; Simon Willison's `til.simonwillison.net` is the reference implementation.

The decision space behind that link is wider than it looks.
Two questions organize it.
First, who decides what counts as a change: git, which makes no distinction between a typo fix and a paragraph rewrite, or a human curator, which is editorial but requires discipline you have to maintain forever.
Second, who renders the diff: the host (GitHub, Codeberg, GitLab all render commit diffs in their web UI), or you (your build script generates diff pages on your own site).

Three families fall out.
Host-linked: computer decides, host renders.
The pattern above.
For markdown files on GitHub specifically, the commit page has a "Display the rich diff" toggle that renders the markdown and highlights word-level changes inline, close to the prose-diff quality of purpose-built tools like NewsDiffs.
Self-rendered: computer decides, you render.
Same git walking, but your build generates per-page diff pages on your own site.
Worth the work when the repo can't be public or you want full control of the reader's experience; otherwise overkill.
Hand-written: human decides.
A `CHANGELOG.md` in Keep a Changelog format, or a per-post "Revisions" block at the foot of each post.
Same drift problem as the release-note case.

For a personal writing repo, host-linked is almost always the right pick.
Five lines of template, the host does the rendering, and the reader gets a real history view; on GitHub specifically, the rich-diff toggle on each commit gives a rendered prose view (worth a one-line awareness hint in the template).

A note on what "version" means for a blog post.
Git has no version concept for an individual file; every commit is a potential version.
Three habits keep the history view manageable: squash related micro-commits before pushing so each row is one substantive change; write commit messages that read as reader-facing changelog entries, because they are; and prefix non-content commits (typo fixes, formatting tweaks, metadata edits) with a token like `[trivial]` so a build script can filter them when computing the displayed "Last updated" date.
Without that filter, a typo fix advances the date on a two-year-old post whose actual content hasn't moved.

In a log, the filter's input looks like this (output illustrative):

```text
$ git log --oneline -- content/covenant.md
9b3c1e2 [trivial] Fix two typos in covenant post
4f08a77 Add section on Kline's critique
e1d92c0 Publish covenant post
```

The build script skips the `[trivial]` row when computing the date, so "Last updated" stays on the Kline addition.

The lightweight alternative is to skip per-page history machinery and put corrections inline.
A bracketed `[Edit YYYY-MM-DD: ...]` aside placed where a now-wrong claim sits catches the reader at the sentence the correction applies to, no clicking required.
For posts you rarely revise, inline notes are sufficient on their own; the host-linked approach earns its place only when revisions are frequent enough that readers want to inspect them systematically.

See the GitHub reference for the Zola template snippet, including the build-time `git log` script with `[trivial]` filtering.

## Versioning prose documents

The previous section concerns commit-level history: every commit is a potential version, and the log is the changelog.
A separate question is whether documents (essays, reference notes, theological writing) should carry an explicit version number on top of that.

Code projects answer this with semantic versioning, usually called semver: a three-number scheme `MAJOR.MINOR.PATCH` where MAJOR signals a breaking change, MINOR signals a backward-compatible feature, and PATCH signals a bug fix.
For documents the breaking-change concept doesn't translate literally (prose doesn't compile), but it translates cleanly with one substitution.

### The mapping for prose

Translate "breaking change" to "thesis shift."

1. MAJOR: the claim changed. Your view of the subject has moved. Someone who cited the previous version to support an argument may find their citation no longer supports it. This is the prose equivalent of a breaking API change, because readers who built on your earlier conclusion now have work to do.
2. MINOR: the content changed but the claim didn't. You added a section, cut a digression, expanded an example, brought in a new source. The thesis is intact. Readers who remember what you argued don't need to re-read; they only need to look at the new version if they want the fuller treatment.
3. PATCH: the copy changed. Typo fixes, clarified wording, reformatted a list, corrected a date. No change in meaning, no change in content. Readers don't need to do anything.

The mnemonic is three Cs: claim, content, copy.
Claim is the argumentative term; content is the body of substance; copy is the publishing-industry term for the text itself.

Pre-1.0 translates cleanly.
`0.x.y` is a draft you're not yet willing to commit to publicly.
`1.0.0` is the point at which you're standing behind the thesis.
After that, every revision records at what level you've shifted.

### Worked example

A theology essay on covenant theology, first published as 1.0.0.

1. You catch a typo in a footnote, fix a quotation that had the wrong translation, and tighten an awkward sentence. Bump to 1.0.1. Copy only.
2. A month later you add a section on a minor critic you hadn't addressed, cut a digression on an adjacent topic, and expand one example. The thesis hasn't moved. Bump to 1.1.0. Content.
3. A year later you read a Reformed author who convinces you that one of the load-bearing claims was wrong, and you now argue a modified position. Bump to 2.0.0. Claim.

A single revision can cross categories.
If you fix typos and also add a new paragraph in the same pass, the bump is the highest level involved: 1.1.0, not 1.0.1 and then 1.1.0.
Skip MINOR resets on MAJOR bumps too; 2.0.0 starts fresh at .0.0, not carrying forward the prior minor count.

### When to use it

Version numbers are useful only when readers come back.
A blog post nobody returns to doesn't need versioning; a reference doc people cite does.
The break-even is whether someone would need to know whether what they remembered is still what's there.
If yes, version.
If no, don't.

For personal writing in a Git repo, the commit history already records every change, and filename suffixes (`_v2`, `_v3`) mark coarse milestones for workflow reasons.
Semver on top of that is a public-facing contract for readers who don't read the commit log.
The two schemes don't conflict; they operate at different layers.

### Honest gotchas

The claim/content/copy line isn't always clean.
A new section you add might implicitly shift the claim by strengthening one side of an argument you didn't mean to weight more heavily.
If the effect on the thesis is material, bump MAJOR even though mechanically you only added content.
The question is always what the reader would conclude, not what you technically changed.

"Breaking change" for prose is softer than for code.
Code either compiles or it doesn't; a reader's citation either supports their argument or it doesn't, but the line is judgment-bound.
Default to the stricter call: if you're unsure whether the change is MAJOR or MINOR, call it MAJOR.
Over-signaling is cheap; under-signaling breaks trust.

Most prose doesn't accumulate enough revisions to make fine-grained versioning worth the overhead.
The minimum worthwhile use case is something you expect to revise at least a few times a year, across a few years, for an audience that might refer back.

### Recommendation

For any document you plan to maintain and expect to have return readers, use semver with the claim/content/copy mapping.
Start pre-1.0 while drafting; release at 1.0.0 when you're willing to stand behind the thesis publicly; bump per the rules above on every revision.
State the scheme once in a footer or about-page; don't re-explain it per document.

For ephemeral writing (blog posts, one-off essays, anything readers won't revisit), skip versioning entirely.
Filename suffixes in your own repo are enough for you; readers don't need to see them.

## Configuring Git well on day one

A dotfile of accumulated wisdom.
The commands below compound enormously over years.
Set them once; later sections refer to this as the day-one block.

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
git config --global core.editor "codium --wait"
git config --global diff.tool vimdiff
git config --global difftool.prompt false
git config --global pull.rebase true
git config --global push.autoSetupRemote true
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global commit.verbose true
git config --global commit.template ~/.gitmessage
git config --global core.hooksPath ~/.git-hooks
```

What these do:

1. `user.name` and `user.email`: stamped on every commit. The recommended pattern is to omit both from the global config, set `user.useConfigOnly = true`, and bind the identity to a directory via `includeIf gitdir:`, so a repo created outside that directory fails loud rather than committing under whatever was lying around in global config. See § "Identity layers and isolation" for the threat-model reasoning.
2. `init.defaultBranch main`: new repos use `main` instead of `master`.
3. `core.editor`: what opens for commit messages and interactive rebase. VSCodium example; substitute your editor.
4. `diff.tool vimdiff` plus `difftool.prompt false`: sets the diff tool for `git difftool` and skips its per-file confirmation. Substitute another tool if you don't edit in vim.
5. `pull.rebase true`: pulls rebase onto the remote instead of creating merge commits. Linear history, less clutter. The deeper treatment is in § Pull behavior below.
6. `push.autoSetupRemote true`: the first push of a new branch creates the remote branch and sets the upstream automatically (Git 2.37+), instead of refusing until you run `git push -u origin <branch>` once.
7. `fetch.prune true`: every fetch drops remote-tracking branches whose remote branch was deleted, so `git branch -a` reflects reality instead of accumulating ghosts.
8. `rerere.enabled true`: "reuse recorded resolution." Git records merge-conflict resolutions and replays them automatically when the same conflict recurs. The deeper treatment is in § rerere below.
9. `commit.verbose true`: when you commit, the staged diff appears in the editor below your message (stripped on save). Lets you describe what's actually changing rather than what you remember changing.
10. `commit.template ~/.gitmessage`: pre-fills the commit editor with reminders of the 50/72/imperative rules as comment lines (stripped on save). The reference doc has the template content.
11. `core.hooksPath ~/.git-hooks`: redirects Git's hook discovery from the per-repo `.git/hooks/` to a user-managed directory, so the same hooks apply to every repo on your machine. The hooks themselves are covered in the Hooks section below.

Useful aliases, added under `[alias]` in your global `~/.gitconfig`.
The block below is a representative subset; the Git reference doc has the full convergent set used by long-term experts, grouped by purpose, with reliability notes.

```ini
[alias]
    c = commit -m
    ca = !git add -A && git commit -m
    last = show --compact-summary HEAD
    lg = log --oneline --graph --all --decorate
    st = status -s
    co = checkout
    br = branch
    unstage = restore --staged
    caas = commit --amend --no-edit
    pf = push --force-with-lease --force-if-includes
```

The first three are the everyday workflow: `git c "msg"` commits staged changes, `git ca "msg"` stages everything and commits, `git last` shows what you just committed (commit metadata, message, and a compact summary of changed files including new/deleted/mode-changed annotations).
The `pf` alias uses `--force-with-lease --force-if-includes`, which refuses to overwrite the remote if someone else has pushed in the meantime; never alias plain `push --force` to a short name.
For the fuller setup that goes with these — `commit.verbose`, the commit message template, the editor configuration — see the Git reference doc.

Most experienced users have a dotfile of Git configuration that's grown over years and represents accumulated wisdom about friction points.
Start yours now; add to it whenever you find yourself typing the same flag combination twice.
The reference doc is the single source of truth for the alias inventory; come back here only for the principle, not the list.

## Remotes and the distributed model

Everything so far happens inside one folder on one machine, and that is the complete system: Git is distributed, meaning every repo is a full standalone copy carrying the entire history, not a client of some server.
A remote is just a bookmark: a name in your repo's config, conventionally `origin`, pointing at the URL of another copy, whether on a forge like GitHub or Codeberg, on a server of yours, or in another directory on the same disk.
Nothing you do locally (commits, branches, rebases, the lot) leaves your machine until you explicitly push.
For a writer that is worth saying plainly: a Git repo is private by default, and version control does not imply publishing.

Four verbs cover all the traffic.
`clone` copies a remote repo to your machine, history and all, and wires up `origin` for you.
`fetch` downloads what the remote has that you don't and updates your remote-tracking pointers (`origin/main`), touching none of your own work; it is the look-don't-touch verb.
`pull` is fetch plus integrate: it folds the fetched commits into your current branch, and how it folds them is the subject of the next section.
`push` uploads your commits and moves the remote's branch pointer forward, which the remote accepts only when your history contains its current tip, so you cannot silently overwrite work you haven't seen.

Your branch and the remote's copy of it are separate pointers that drift apart whenever either side moves.
Git tracks the pairing (your `main` against `origin/main`, called the upstream), and `git status` reports the drift as ahead, behind, or diverged: ahead means you have commits to push, behind means commits to pull, diverged means both.

Diverged is where merge conflicts can appear.
When both sides changed the same lines and Git is asked to integrate them, it stops, marks the overlapping region in the file, and waits for you to choose; nothing is lost, both versions are right there in the marked block.
A conflict is Git declining to guess between two valid versions, not an error, and on solo single-machine work you may not meet one for months.
The mechanics, markers and all, are in the reference; the integration choice that decides how often you meet them is next.

## Pull behavior: rebase vs merge

The day-one block sets `pull.rebase true`.
The setting changes how `git pull` integrates remote work with yours, and the choice has consequences worth understanding.

### What `git pull` does without `pull.rebase true`

By default, `git pull` is `git fetch` followed by `git merge`.
If you have local commits that the remote doesn't, and the remote has commits that you don't, the merge step produces a merge commit joining the two lines: a commit with two parents, a message like "Merge branch 'main' of <remote>", and no actual content change of its own.
Run this often enough and the log becomes a forest of these no-content merge bubbles.
They're real history (Git is faithfully recording that two divergent lines were joined) but they're noise: nobody wrote those messages, nothing about them is worth reading later, and they obscure the actual commits.

### What `pull.rebase true` does instead

It changes the second step from merge to rebase.
After fetching the new remote commits, Git takes your local commits, sets them aside, fast-forwards your branch to the new remote tip, and replays your local commits one by one on top.
The result is a linear history: remote commits first, then your local commits, no merge bubble.
The log reads as if you'd worked sequentially on the latest version of main all along.

The cost: your local commits get new hashes.
The replay produces new commit objects, because each new parent changes the hash.
This is fine for unpushed work (the old hashes only existed locally), and it's the operational form of the rule "rewrite local history freely, never rewrite pushed history without coordination."
If you've already pushed those local commits to a shared branch, the rebase will diverge from the remote and the next push will need force, which is a different kind of problem.

### When rebase-on-pull is the wrong default

On a feature branch you share with several people who all commit and pull constantly, rebase-on-pull can rewrite commits other people have already based work on.
The merge-on-pull default avoids that by keeping each person's commits stable.
Most modern workflows don't have this problem (feature branches typically belong to one author), but if you find yourself on a shared mutable branch, switch the setting per-repo with `git config pull.rebase false` for that repo.

### What neither setting protects you from

A worry that sounds related but isn't: what if the remote commits themselves are ones you don't want?
Neither pull variant helps, because both integrate them; after either kind of pull, your branch contains the remote's work, and merge versus rebase only chooses the topology of the join.
The guard against suspect remote commits is inspection before integration: `git fetch`, then `git log HEAD..origin/main` to list what arrived (or `git diff HEAD...origin/main` to read it as one diff), then decide what to do.
No alias is needed for the deciding, because `git pull` already takes per-invocation flags that override the configured default for that one pull: `git pull --rebase`, `git pull --no-rebase`, and `git pull --ff-only`.

There is also a third configuration stance worth naming: `git config --global pull.ff only`.
With it, a pull succeeds only when your branch can fast-forward; any divergence makes the pull refuse, and you then choose `--rebase` or `--no-rebase` explicitly for that case.
This is the fail-loud setting, the same philosophy as the identity setup in § Identity layers and isolation: nothing is integrated silently, and every divergence becomes a deliberate decision.
Its cost is friction in the common case, where the divergence is your own work on two machines and rebase was always going to be the answer.
The recommendation here stays `pull.rebase true` for that reason; if you would rather decide every time, ff-only is the principled way to get it.

### The pull-rebase debate, in one paragraph

This is one of the contested edges flagged in the closing caveats.
The "always rebase" camp values clean linear history; the "always merge" camp values not rewriting commits already shared with anyone.
Both are defensible.
The recommendation in this document — `pull.rebase true` as a global default — fits the most common modern pattern (feature branches owned by one person, merged to main via pull request), and is what most contemporary practitioners run.
Adjust per-repo if your situation is different.

## rerere

`rerere` stands for "reuse recorded resolution."
The day-one block enables it.
It's quiet and useful — quiet enough that you may use Git for years without realizing it's working.

### What `rerere` records

When you resolve a merge conflict, Git saves the pre-resolution conflict text and your post-resolution result in `.git/rr-cache/`.
If the same conflict (same context lines, same conflicting hunks) appears later, Git applies your earlier resolution automatically.

### When `rerere` actually fires

It triggers only on identical conflict hunks.
If the surrounding context drifts even slightly, the cache doesn't match and you resolve manually again.
In practice this means rerere pays off when:

1. You rebase a long-lived feature branch against a moving main and the same conflict re-emerges each rebase.
2. You're a maintainer integrating recurring patches and seeing the same merges play out.
3. You're cherry-picking the same commit across multiple branches.

For solo personal work with occasional conflicts on stable files, rerere will almost never fire.
It costs nothing to leave enabled and pays off invisibly when a workflow gets repetitive enough to need it.

### Knowing when rerere helped

The replay is silent.
After a rebase or merge, `git rerere status` shows which paths had recorded resolutions applied, and `git rerere diff` shows the resolution itself.
If a recorded resolution turned out wrong (the surrounding code changed in a way that makes the old resolution incorrect), forget the cache entry with `git rerere forget <path>` and resolve manually.

## Hooks

A Git hook is a script Git runs automatically at a specific point in the workflow.
Hooks let you enforce policy locally: warn before committing under conditions you specify, lint files before push, format code on staging, abort a commit that violates a rule.

Hooks live as executable files in a directory Git inspects when relevant operations run.
The default location is `.git/hooks/` inside each repo.
Files there with the right name (`pre-commit`, `prepare-commit-msg`, `pre-push`, `post-merge`, and others) get executed at their respective stages.

Two facts about hooks worth absorbing early:

1. Hooks are per-machine. The `.git/` folder isn't tracked by the repo itself. Cloning a repo does not give you its hooks. Each developer sets up their own hooks on their own machine. This is by design: hooks run arbitrary code, and pulling a repo would otherwise mean executing whatever the repo's author put in their hooks. Tools like `pre-commit` (the framework) layer a tracked configuration over this so hooks can be shared, but the raw mechanism is local-only.

2. Hooks are opt-in. A fresh repo's `.git/hooks/` directory contains only `.sample` files, none of them executable. Git runs nothing unless you create executable hook scripts yourself.

### `core.hooksPath`

To share hooks across all your repos rather than copying them into each one, set `core.hooksPath` to a user-managed directory (the day-one block sets this to `~/.git-hooks`).
Every repo on the machine then reads hooks from that single directory instead of its own `.git/hooks/`.
Add an executable hook there once and it applies everywhere.
The `git-setup_v12.sh` script uses this pattern to install a rename-safety hook that warns when a rename commit also contains substantial content changes (the failure mode covered in § "What Git silently discards / Renames").

The trade-off: per-repo override is lost.
If one repo genuinely needs different hooks, drop a `.git/hooks/<name>` in that repo and unset `core.hooksPath` for that repo with `git config --unset core.hooksPath`.
For most personal workflows, the global pattern is right; the rare per-repo override is the exception.

## .gitignore hygiene

A `.gitignore` file at the repo root tells Git which files never to track.
Build outputs, dependencies, credentials, OS-generated clutter (`.DS_Store`), editor config, log files.

GitHub maintains a repository of language-specific templates at `github.com/github/gitignore`.
For any new project, grab the relevant template as a starting point.

Global ignore for OS and editor clutter that should never be tracked, regardless of repo:

```bash
git config --global core.excludesfile ~/.gitignore_global
```

Example global ignore:

```gitignore
.DS_Store
Thumbs.db
*.swp
.idea/
.vscode/
```

If you've already committed a file that should be ignored, adding it to `.gitignore` won't untrack it.
You need:

```bash
git rm --cached path/to/file
```

This removes it from Git's tracking without deleting it from disk.
Commit the removal plus the `.gitignore` update together.

Committing things that don't belong in version control (compiled binaries, `node_modules`, API keys) is one of those mistakes that's annoying at best and catastrophic at worst.
The `.gitignore` habit protects you from the whole class of problems.

## Line endings

Line endings are an invisible footgun that fires the moment a repo crosses operating systems.
Windows uses CRLF (`\r\n`) to terminate lines; Linux and macOS use LF (`\n`).
Git stores whatever's in the file.
If one collaborator edits on Windows and another on Linux, every line of every text file will show as changed on the next diff, because the invisible `\r` characters appear and disappear with each save.
The diff becomes useless: the actual change you made is buried under thousands of phantom line modifications.

Even solo work is exposed if you ever clone a repo that was edited cross-platform, or if you switch machines, or if some collaborator opens a file in a Windows editor and saves it back.

The fix is a `.gitattributes` file at the repo root.
The core line:

```gitattributes
* text=auto eol=lf
```

`text=auto` lets Git detect text vs binary files.
`eol=lf` declares that text files should be stored and checked out with LF endings.
The same file also handles per-pattern CRLF overrides for Windows-specific scripts, binary markers, and prose diff settings; see the Git reference for the combined template.

`.gitattributes` is committed to the repo, so every clone gets the same rules.
This is different from `.gitconfig` settings (`core.autocrlf`, `core.eol`), which are per-machine and don't travel with the repo.
Prefer `.gitattributes` for anything that should apply consistently across collaborators.

If you've already accumulated mixed line endings in a repo, fixing them is a one-time renormalization:

```bash
git add --renormalize .
git commit -m "Normalize line endings"
```

This rewrites every text file's stored form to match the `.gitattributes` rules.
After this commit, future diffs are clean.

The cost of setting this up on day one is two lines in a `.gitattributes` file.
The cost of not setting it up and discovering the problem six months in is debugging phantom diffs across hundreds of files.
Add the `.gitattributes` before the first commit.

## Never commit secrets

API keys, passwords, private keys, tokens.
Once committed, they exist in the history forever.
Even if you remove them in a later commit, anyone with access to the repo can find them in the history.

If you accidentally commit a secret:

1. Assume it's compromised. Rotate the key, password, or token immediately at the issuing service.
2. Do the work to purge it from history. This is genuinely difficult; see the Git reference for `git filter-repo` and the `gitdel_v2.sh` script.
3. Force-push the rewritten history.
4. Tell any collaborators to re-clone.

The discipline of storing secrets in environment variables or untracked config files, never in code, needs to be a reflex from day one.
The safest configuration is to never have the secret in a file that's in a Git repo in the first place.

A useful pattern for the case where the application genuinely needs a config file: track `config.example.json` (or `.env.example`) in the repo with empty or dummy values, and gitignore the real `config.json` (or `.env`).
New collaborators clone the repo, copy the example to the real name, fill in their own values.
The schema of required config is version-controlled; the actual values never are.
The example file doubles as documentation — anyone reading the repo can see what config the application expects without ever seeing real credentials.

## Large binaries are permanent

Commit a 50MB PDF or a video file once and every clone of the repo carries that blob forever, even if you delete the file in the next commit.
Git stores objects by content hash; once an object exists in history, it stays there until you rewrite history to remove it.
The deletion commit only records that the working tree no longer contains the file.
The blob itself remains in the pack files, downloaded on every clone, forever.

For solo work this looks tolerable for a while.
Then the repo hits 2GB, clones take minutes, GitHub starts warning about repo size, and the cost compounds.
For writers especially, the temptation is constant: draft PDFs, image assets, audio recordings of dictation, exported ePubs.
Each one feels small in isolation.
Across two years of work they add up to a repo that's mostly historical binaries nobody will ever look at.

The default discipline: don't track binaries in the main repo.
Add patterns to `.gitignore` so the temptation is removed at commit time:

```gitignore
*.pdf
*.docx
*.zip
*.mp4
*.mov
*.mp3
*.wav
```

If you need to ship a binary as part of a release, attach it to the release on the forge (GitHub Releases, Codeberg Releases).
The binary isn't in the repo; it's hosted alongside it.

When you genuinely need to version a binary (an image asset that evolves, a Word file an editor requires you to deliver), the standard tool is Git LFS (Large File Storage).
LFS replaces the binary in the repo with a small pointer file; the actual binary lives on a separate LFS server and is downloaded only when checked out.
The repo stays small and fast even when you're tracking large evolving assets.
Setup is a one-time `git lfs install` plus a `.gitattributes` entry:

```gitattributes
*.psd filter=lfs diff=lfs merge=lfs -text
```

Not every forge supports LFS for free at scale (bandwidth quotas apply on GitHub); check before committing to it.
For small repos with occasional binaries, plain Git plus a strict `.gitignore` is sufficient.

If you've already committed large binaries you wish you hadn't, removing them requires history rewriting via `git filter-repo`, identical to the secrets purge described above.
The reference doc covers the procedure.
Treat it like a secrets incident: rare, deliberate, all-collaborators-affected.
Better to prevent than to clean up.

## Signed commits

To understand signed commits, start with what a normal commit's "author" field actually is.

When you commit, Git stamps the commit with the name and email you set in `git config --global user.name` and `user.email`.
Git takes your word for it.
There's no verification.
Anyone with a clone of your repo can set their config to your name and your email and make commits that look exactly like yours.
Push them to a server and the server has no way to know they didn't come from you.

For most work this doesn't matter.
The threat model is small: nobody is forging your commits, because there's nothing to gain.
But consider what changes when stakes go up.
You're a contributor to Bitcoin Core.
The codebase moves money.
An attacker compromises your GitHub account (phishing, credential reuse, anything).
They push commits as you.
The commits look like they came from you because they have your name and email on them.
Maintainers who trust you might merge them.
Money moves.
By the time anyone realizes, the damage is done.

A signed commit closes this gap.
When you commit with signing turned on, Git uses a cryptographic key (GPG, or more recently SSH) that lives only on your machine to attach a signature to the commit.
The signature is mathematically bound to the commit's contents and to your private key.
Anyone with your public key (which you've uploaded to GitHub) can verify two things: that the commit was made by someone who held your private key, and that the commit hasn't been altered since you signed it.
GitHub displays this verification as a green "Verified" badge next to the commit.

Why this matters: even if an attacker takes over your GitHub account, they don't have your private key (which lives on your laptop, not on GitHub).
They can push unsigned commits or commits signed with the wrong key, but they can't produce signatures that match yours.
Reviewers who require signed commits can reject the unsigned ones.
The compromise gets caught.

This is why Bitcoin Core, the Linux kernel, and most security-critical projects either require or strongly encourage signed commits on the main branch.
The Linux kernel adds another layer: a `Signed-off-by:` line in the commit message, which is a contributor's legal attestation that they have the right to submit the change under the project's license.
That's a different mechanism from cryptographic signing (it's just text), but it serves a related purpose of making the chain of provenance explicit.

For solo work and most personal projects, signing isn't necessary.
Nobody is trying to impersonate you on your hobby blog repo.
The threat model isn't in play.
Skip it; you're not missing anything important.

For high-stakes contributions or projects where you want the assurance, set it up once and forget about it.
Generate a GPG key (or use SSH signing, which is simpler if you already have an SSH key for GitHub).
Tell Git to sign commits by default.
Upload the public key to GitHub.
From then on, every commit gets the green badge automatically.
The Git reference has the exact commands.

One pragmatic note: most developers don't sign, and the ecosystem hasn't fully standardized.
You'll see plenty of unsigned commits from serious developers in serious projects, because the cost of setting up signing across multiple machines and keeping keys in sync isn't trivial, and the benefit only kicks in for projects that actually verify signatures.
Don't read the absence of signatures as carelessness; it's usually just rational triage.
Read the presence of signatures as someone taking the supply-chain question seriously, which is increasingly the right disposition for anyone touching widely-used code.

## Identity layers and isolation

Git and a forge like GitHub treat three things as independent:

1. The git author identity. The `user.name` and `user.email` stamped on each commit. Set locally. Git takes your word for it.
2. The forge account. The entity that owns the repo and appears in PR threads, issues, audit logs, and the contribution graph.
3. The SSH key. What authenticates a push to the forge. Each key is registered to exactly one forge account; the forge rejects the same public key uploaded to two accounts.

These three layers are independent at the protocol level.
Nothing prevents you from stamping commits with one email while pushing them with a key registered to a different account; the forge attributes the push based on the key, and the commit metadata is whatever the local config wrote.
What the key does and does not bind is a frequent point of confusion: an SSH key authenticates the push to an account, but the forge never checks the commit's author name or email against the key, so there is no server-side way to lock a key to an identity.
The lock is client-side, and it is the `includeIf gitdir:` directory binding the git reference describes: when inside the bound directory, the include file sets `user.name`, `user.email`, and `core.sshCommand` together, so the author identity and the key cannot drift apart for repos under that directory.
`user.useConfigOnly = true` then makes a repo outside that directory fail loud rather than guess from whatever identity was lying around in global config.

For a single identity, the setup is to make all three layers describe the same person consistently: configured author identity, key uploaded to your one forge account, and the directory binding selecting them together by location.
The git reference's Identity setup section has the recipe.

For pseudonymous separation, keeping one identity unlinked from another where deanonymization would have real cost, config-level separation on one OS account is not enough.
The protocol independence above means a single slip at any layer links the identities: an author email set wrong once is in commit history forever (unless you rewrite history); a push that goes out with the other identity's key lands in the wrong account; a signature publicly binds a commit to a known key; a host compromise reads both `~/.gitconfig` and `~/.ssh` at once.
The convergent pattern among people who actually need pseudonymous separation, used by Tor developers, Bitcoin Core's pseudonymous contributors, and Qubes users, is OS-level isolation: a separate OS user account, a VM (Whonix on Qubes is the canonical setup), or a separate physical machine.
Different home directory, different `~/.gitconfig`, different `~/.ssh`, different browser, different shell history.
The "wrong terminal" class of failures disappears because the boundaries are real, not procedural.

This guide is single-identity on a single OS account by design.
The git reference's Identity setup section gives the fail-loud directory-bound setup; that's the right tool for keeping one identity coherent, not for separating two.
If you need a pseudonymous identity, run that same setup in a separate OS user account or VM and accept the friction.

## Beyond passphrase keys

A passphrase-protected SSH key on disk is the baseline for any serious setup.
If your threat model warrants more, three axes go further.
None is required; each is the documented next step beyond the previous.

1. *Hardware tokens.* YubiKey or Nitrokey. The private key lives on the hardware token and never touches the filesystem. Even a fully compromised laptop cannot extract the key; an attacker can use the key only while the token is physically present and you've entered its PIN. Two integrations matter: GPG subkeys stored on the token (the long-standing pattern, used by Bitcoin Core maintainers and Debian developers), and FIDO2 SSH keys (`ssh-keygen -t ed25519-sk`, simpler, newer, narrower in scope). YubiKey-with-GPG-subkeys is the most widely-documented setup.

2. *Network metadata via Tor.* Pushing over SSH leaks the source IP to the destination host (which network is doing the push). Routing SSH through Tor with `ProxyCommand` or running git operations from inside Whonix protects this metadata. The destination sees an SSH connection from a Tor exit node; the SSH protocol itself is unchanged. Codeberg publishes an onion service for the same reason. Useful when the *fact* that an identity exists at a given network location is itself sensitive.

3. *Commit signing as an independent layer.* SSH (or GPG) signs commits cryptographically, separate from how the push happens. A signature proves a specific key authored a commit; an attacker who compromises your forge account but not your signing key can push fake commits, but they can't *sign* them. Bitcoin Core requires signed merges to master; the Linux kernel uses GPG-signed tags on maintainer trees. For personal projects, signing matters mainly if the project requires it or if you want a verifiable record of which commits you actually authored.

These are orthogonal.
You can use a YubiKey without Tor, Tor without signing, signing without a YubiKey.
The natural progression is: passphrase keys (current), then signing (cheap to add, no hardware needed), then hardware tokens (real cost, real benefit), then Tor (situational, depends on what metadata you're protecting).

What experts actually do depends on what they're protecting.
Bitcoin Core release maintainers sign with GPG subkeys on YubiKeys, work over SSH on regular Internet (release attribution is the threat, not network metadata).
Tor developers work over Tor inside Whonix (network metadata is the threat, signing is sometimes a separate concern).
For most contributors, a passphrase-protected SSH key plus commit signing (when the project requires it) is the realistic ceiling.

## Tooling worth knowing about

You don't need any of these to start.
Knowing they exist means you can reach for them when you're ready.

1. `git-delta`. Replaces `less` as Git's pager with syntax-highlighted, optionally side-by-side output. Configure with `git config --global core.pager delta`. Useful when you're reading diffs in the terminal; read-only, so for editing while diffing see the vim and VSCodium sections.
2. `tig`. Terminal-based Git history viewer. Faster than any GUI once you're comfortable, and it works over SSH where a GUI can't. Navigate commits with arrow keys, see diffs inline, stage interactively.
3. `lazygit`. Terminal UI for most Git operations. Many long-time command-line users find it more efficient than raw Git or a full GUI. Commit, rebase, cherry-pick, stash, branch management, all with single keystrokes.
4. `gh`. The official GitHub CLI. Create PRs, review them, manage issues, clone your own repos by name, all from the terminal. The GitHub reference covers this.

These are what experienced users accumulate over years.
None is necessary on day one.
Don't install them defensively.
Install them when you feel the specific friction they remove.

## Slow down before destructive commands

The instinct when a Git command gives you an unexpected state is to run more commands trying to "fix" it.
That's how people actually lose work: not from the original problem, but from frantic recovery attempts.

Stop.
Read the output.
Understand what state you're in.
Look up what the recovery actually requires.
Then proceed deliberately.

Ninety-nine percent of Git "disasters" are recoverable if you don't panic.
A small percentage become unrecoverable because someone force-pushed or hard-reset in a moment of frustration without reading the reflog first.

The commands that actually destroy work, in order of danger:

1. `git push --force` (without `--force-with-lease`). Overwrites remote history unconditionally.
2. `git reset --hard` when uncommitted work exists. Throws away the working directory without warning.
3. `git clean -fdx`. Deletes untracked files, including ignored ones.
4. `git rebase` mid-resolution when confused. Produces states that require careful manual surgery to unwind.

When in doubt, make a backup branch first.
`git branch backup-before-i-try-this` costs nothing and buys you a trivial way to undo whatever you're about to do.

---

## What Git silently discards

Git's storage model is lower-level than its surface commands suggest.
Several high-level operations look like they're recording something, but the recording happens by inference at read time, or doesn't happen at all.
The common pattern: the user assumes Git is preserving intent; Git is actually preserving snapshots, and reconstructs intent later by heuristic.
Most of the footguns that catch experienced users belong to this category.

### Renames

The clearest case.
There is no rename operation in Git's object model.
A commit stores trees of blobs — snapshots, not operations.
When you run `git mv old.js new.js`, Git records `old.js` as deleted and `new.js` as added, identical to `rm old.js && cp something new.js`.
The rename intent is thrown away at commit time.

This means `git log --follow` and every rename-aware diff are post-hoc heuristics.
Each invocation re-infers the rename from scratch by comparing content similarity across the delete/add pair.
There is no stored fact to look up — just a guess from content.

Git's default similarity threshold for rename detection is 50%.
`--follow` uses that threshold.
So `--follow` traces through a rename fine as long as the file's similarity score stays above 50%; below that, it loses the thread entirely.
The practical implication: keep rename commits content-pure.
If you must edit a file at the same time you rename it, do the rename in one commit and the edit in a separate one.
A rename-only commit has 100% similarity and is bulletproof for `--follow`; a rename-plus-substantial-edit commit risks dropping below 50% and silently breaking history traversal for that file forever afterward.

The reference doc has a `prepare-commit-msg` hook that inspects every commit as it is being prepared, normal or amend, and warns when it contains a rename below 60% similarity (10 points above the danger floor).
See "One-time setup" there.

This is a known and longstanding criticism of Git's design — renames would need to be first-class objects in the commit format to record intent reliably, not inferred from diffs.
The burden falls on the user to keep renames content-pure so the heuristic can recover what the tool discarded.

### Other things in the same category

Several other footguns are variants of the same pattern: Git's model is lower-level than users expect, so what feels like a high-level operation either discards information at commit time or relies on inference that can fail silently.

1. Amending a pushed commit rewrites history for everyone else. `--amend` doesn't alter the previous commit; it replaces it entirely with a new one that has a different hash. If the original was already pushed, anyone who pulled it now has a diverged history. The rule: only amend commits that haven't been pushed.

2. `git add .` and `git commit -a` stage everything indiscriminately. Easy to commit debug code, credentials, build artifacts, or unrelated changes by accident. The discipline is `git add <file>` explicitly, and reviewing `git diff --staged` before every commit. The staging area was designed to give you control over what's in the next commit; bypassing it gives up the safety it provides.

3. Merge vs rebase is a permanent, often-invisible choice about what history looks like. A merge commit preserves topology — you can see that work happened in parallel. A rebase rewrites commits as if they were always linear, discarding that topology. Most users pick one out of habit without realizing the choice is irreversible once pushed.

4. `.gitignore` doesn't untrack files already tracked. The ignore patterns only filter the untracked set. If you committed a file and then added it to `.gitignore`, Git keeps tracking it. You have to `git rm --cached <file>` to stop tracking — and if the file contained credentials, the secret is still in history unless you also rewrite history (see the purging section of the reference).

5. `git reset --hard` and `git clean -fd` are not symmetric with `git stash`. Reset hard and clean destroy uncommitted working-tree changes permanently. The reflog saves committed history but cannot recover what was never committed. The default assumption that "Git always has a recovery path" only holds for committed work.

6. Submodules are not automatically updated on pull. A repo with submodules cloned without `--recurse-submodules` has empty submodule directories until you run `git submodule update --init --recursive`. People spend hours debugging missing files before discovering this.

The common thread is the same one the rename case makes vivid.
Git stores snapshots and hashes, not intentions.
Every high-level operation that looks like it's recording semantics (rename, track, ignore, amend) either discards the semantics at commit time or infers them after the fact.
Knowing this in advance prevents the class of mistake that comes from assuming the tool is doing more than it actually is.

---

## For writers specifically

Everything above applies to writers as much as to programmers; Git doesn't care what your files contain.
But a writer's relationship to version control has some specific textures that developer-oriented tutorials rarely name.
This section is the pivot.

The deepest principle survives the translation: Git is a communication tool, not a backup tool.
The conversation it enables is with your future self.
For a writer, this is actually more evocative than for a programmer, because writers already know viscerally what it means to lose an earlier version.
The paragraph you cut and wish you hadn't.
The opening you wrote six drafts ago that was somehow closer to the truth than where you ended up.
Git is, fundamentally, the ability to never actually lose any version of anything while still being free to cut ruthlessly in the moment.

### Commit messages as craft notes

The "why not what" rule has a different flavor for prose.
The diff shows which words changed; it doesn't show whether you changed them because the rhythm was off, because a reader said the paragraph confused them, because you realized the character wouldn't actually speak that way, or because you were tired and second-guessing yourself at midnight.
The message is where you record the intention behind the revision, and for a writer that intention is often artistic or emotional rather than technical.

Good commit messages for prose might look like:

1. "Cut the second section; felt like throat-clearing."
2. "Rewrote opening after workshop feedback. Tessa was right, it was starting in the wrong place."
3. "Restored earlier version of dialogue; the revised one lost the flatness I wanted."

These are notes to yourself about craft.
Years later, when you're wondering why a piece evolved the way it did, these messages are a record of your own thinking as a writer.
Worth having for its own sake, separately from the practical use of finding a specific version.

Lucia Berlin's notebooks, Carver's drafts, Didion's edited manuscripts: we treasure these because they reveal the process.
Git gives you, the writer, the ability to keep your own version of this record effortlessly, for your own later study or simply as a form of self-knowledge about how you actually work.

### Rhythm of commits

For a developer, a commit often corresponds to a completed small task.
For a writer, commit at natural pause points: end of a writing session, after a significant revision, after a workshop meeting when you've absorbed feedback, after you've "finished" a draft in the provisional way any draft is ever finished.

Don't try to commit after every sentence.
The unit of meaningful change in prose is usually the paragraph, the scene, the session.

Do commit before any major surgery.
Before you cut a whole section, commit.
Before you restructure, commit.
Before the "what if I rewrote this in first person" experiment, commit.
The freedom to experiment radically comes from knowing the previous version is safe.

The "one commit, one logical change" principle translates as: don't mix unrelated revisions in the same commit.
If you sat down to fix typos and ended up also rewriting the ending, those are two different creative acts and deserve two different commits.
This matters when you want to look back and remember what you changed and why.

### Branches as creative experiments

Branches change meaning for a writer, and arguably become more interesting than they are for most developers.
In code, branches are a logistical tool.
In writing, branches are a tool for actual creative experimentation.
The ability to say "let me try rewriting this story from the sister's point of view, fully, not just as an exercise but as an alternative version I can live inside for a while, while keeping the current version completely safe."

Make a branch.
Do the experiment.
If it works, merge that version in or keep both as separate artifacts.
If it doesn't, delete the branch and return to exactly where you were.

Writers often resist radical experiments in revision because they fear losing what they have; branches dissolve that fear entirely.
This is probably the single most transformative use of Git for creative work, and it's underappreciated because most Git tutorials are aimed at developers who think of branches more prosaically.

### Making prose diff well

Git's default diff works at the line level.
For code that's fine; code is structured by lines.
For prose, a line often contains an entire paragraph, and a one-word change shows the whole paragraph as removed and the whole new version as added.
The actual change drowns in noise.

There are two fixes.
They solve the same problem from opposite directions, and the right choice depends on whether you want to change how you write or how you read.

The write-time fix is semantic line breaks: put each sentence on its own line in the source file.
Markdown renders identically whether sentences sit on separate lines or flow in a paragraph (a single newline becomes a space; a blank line becomes a paragraph break), so the rendered output is unchanged.
But the source-level shape is now line-oriented in the way Git already expects.
Insert a sentence and you touch one line.
Reword a sentence and the diff shows that one line changed, not the whole paragraph.
The default `git diff` does the right thing without any configuration.
This is strictly better for diffs and costs nothing at render time.
New users almost never know this convention exists, because it's invisible in the rendered output; it only pays off once you start reviewing your own history.
Most serious Markdown-based documentation projects on GitHub follow it for exactly this reason.

The trade is editor-side: the source looks ragged in a plain editor, and some auto-formatters will reflow it back into paragraphs (configure them not to, or disable on Markdown).
For documents you'll diff repeatedly across years, the rag is worth the legibility.

The read-time fix is `--word-diff`, which tells Git to highlight changes at the word level even when whole paragraphs are on one line:

```bash
git diff --word-diff
git diff --word-diff=color
```

For a repo-wide default on text file types, add this to a `.gitattributes` file at the repo root:

```gitattributes
*.md    diff=word
*.txt   diff=word
*.tex   diff=word
```

GitLens in VSCodium has similar settings for word-level or character-level diffs.

The two approaches compose: a repo written with semantic line breaks and configured for word-diff gives you the cleanest possible prose diffs at both granularities.
The line-level diff shows which sentences moved or changed; the word-level view shows what changed inside those sentences.
If you only do one, do semantic line breaks.
It's tooling-free, travels with the file rather than the config, and works in every Git interface including forge web views.

### Plain text, not Word

For serious writing work, write in plain text formats (Markdown, reStructuredText, plain text, LaTeX) and only convert to Word or PDF for delivery.
Plain text is what Git is built for.
Word documents technically work but you lose most of the benefit, because you can't see what changed.
Git stores the whole binary as "this file changed" without being able to show a meaningful diff.

If you must use Word (an editor insists, a contract requires it), do the editing in plain text, convert to Word at the final step, and commit the Word file at that point.
Version the markdown.
Deliver the Word.

### Don't let tooling become procrastination

The entire apparatus of version control, tooling, configuration, organizational scaffolding is in service of the actual writing.
It's very easy to spend a whole afternoon perfecting your Git setup as a way of not confronting a difficult scene.

Set things up well once.
Establish simple habits.
Let the system fade into the background.
The writing is the thing.
Git is the frame that keeps the writing safe and legible across time.
If you find yourself thinking about Git more than writing, you've inverted the relationship.

---

## Three things to keep in mind

Three framings worth holding across years of use.
Not commands, not mechanics.
Principles about how to learn Git, what you get out of using it, and how to evaluate advice about it.

### Mental model before commands

Start by internalizing the object model (blobs, trees, commits, refs) and the branches-as-pointers idea.
Once those are solid, specific commands become obvious in shape: what they do, why the flags exist, what they cost.
The reverse path, memorizing commands first and hoping the model assembles itself from fragments, takes longer and produces worse intuition.
It also makes recovery from unfamiliar states harder, because you're pattern-matching to commands rather than reasoning about what's actually in the repo.
Everything in this document is structured around that priority: model first, mechanics second.

### Commit messages are a prose practice

Every commit message forces a small compression: what changed, why, for whom.
Over years the practice sharpens your prose in general, because compressing a thought into a summary line is exactly the skill long-form prose depends on.
Writers who version their work get this benefit twice: the prose they commit improves, and the messages about the prose improve too.
Treat the summary line the way a copy editor treats a headline: one line, specific, load-bearing.
Treat the body the way you treat a good paragraph: context first, reasoning second, caveats last.
This is work you were going to do anyway as a writer.
Git just gives it a daily occasion.

### AI advice on Git has a known asymmetry

AI answers about Git are usually smooth, syntactically correct, sometimes elegant, and can still miss what a practitioner who has lived with a particular failure mode for five years knows.
The gap is widest on judgment calls (when to rebase vs merge, when to sign commits, when to force-push, when to rewrite history) and on edge cases that only surface after thousands of hours of real use.
Weight AI advice accordingly: fine for mechanics and syntax, less reliable for "should I."
For judgment calls and high-stakes operations, cross-check against practitioner sources: Pro Git, kernel mailing list threads, Bitcoin Core maintainer posts, Tim Pope's essay, the `man` page.
The AI gives you a plausible answer quickly; practitioner sources give you the answer that survived contact with real projects over real time.
Both are useful.
Don't confuse them.

---

## Closing: deliberate practice

Git rewards deliberate practice and punishes casual use.
The people whose repositories you admire (Torvalds, the Bitcoin Core maintainers, whoever) didn't arrive at their practices by being naturally gifted.
They arrived by making mistakes early, thinking carefully about what went wrong, adjusting their habits, and being consistent over years.

Every piece of advice in this document is really a variant of "take it seriously, even when the stakes feel low, because the habits you build on small projects are the habits you'll have on consequential ones."

You won't look back in twenty years and thank anyone for any specific command.
You'll thank them, if they've done their job, for conveying that Git is a craft; that the craft is mostly about clarity and discipline rather than cleverness; and that the small investments in doing it well early are what make the later years pleasant rather than painful.

Consistency over cleverness, across time, is the whole game.

### Honest caveats on best practice

Some edges of "best practice" in Git are contested.
The pull-rebase-versus-merge debate.
The squash-versus-preserve-history debate.
The when-to-rewrite-history debate.
Reasonable, experienced people disagree.

Don't take any of this as dogma.
Take it as a strong starting position that will serve you well, and adjust over time as you develop your own views through experience.
The framework matters more than any specific rule within it.

### A floor, not a ceiling

This document is deliberately not comprehensive.
It covers the object model and the habits that pay off over years, and it stops there, because the goal was never to memorize every command but to push you toward seeing what Git actually is underneath.
Everything here rests on one fact: a repository is a small content-addressed database of blobs, trees, and commits, and the everyday commands are a convenience layer over reading and writing those objects.
Once that graph is something you can hold in your head, the commands that used to feel dangerous stop being dangerous, because you are reasoning about what is actually stored rather than pattern-matching to remembered incantations.
That fluency is what makes someone the person a team runs to when history gets tangled.
The single best hour you can spend toward it is Tim Berglund's "Git From the Bits Up" (in Further reading below), which takes Git apart to the raw objects and rebuilds a commit by hand from plumbing alone.
Watch it, then do it yourself once; the day it clicks is the day Git stops being a pile of commands and becomes a database you happen to drive from a command line.

## Where Git came from

Git's design makes more sense once you know what it was reacting against.

Version control before Git was overwhelmingly centralized: one authoritative copy of the history lived on a server, and your working copy was a client of it.
The lineage ran through RCS, then CVS, then Subversion.

RCS (Revision Control System, Walter Tichy, around 1982) versioned one file at a time on a single machine, locking a file so only one person could edit it at once.
CVS (Concurrent Versions System) grew out of RCS: Dick Grune's 1986 shell scripts, rewritten in C by Brian Berliner around 1989.
CVS added a network server and concurrent editing, and it became the de facto standard for open-source projects through the 1990s.
But it inherited RCS's core limitation: it tracked each file's revisions separately, with no notion of a project-wide snapshot, no atomic commit (an interrupted commit could leave the repository half-written), and no real way to follow a file across a rename.

Subversion (CollabNet, begun 2000, 1.0 in February 2004) was built explicitly as "CVS done right."
It fixed the worst of it: commits became atomic and repository-wide, with a single revision number advancing across the whole tree.
But it stayed centralized: the server still held the only complete history, every commit needed the network, and branching and merging remained heavyweight.
At the moment Git appeared, Subversion was the rising standard and CVS the fading one.

The immediate trigger was something else.
The Linux kernel had, from 2002, been using BitKeeper, a proprietary distributed system offered to kernel developers free of charge.
Distributed meant each developer held a full copy of the history rather than renting access to a central one, and the kernel community valued that enough to depend on a closed tool.
In April 2005 the arrangement collapsed: after Andrew Tridgell wrote a tool to interoperate with BitKeeper's protocol, BitMover treated it as a breach of the gratis license and withdrew free access.
The kernel was left without version control it was willing to use.

Linus Torvalds wrote the first version of Git that same month, April 2005, and had it self-hosting within days.
The design was a direct response to the whole lineage above.
Distributed, because BitKeeper had shown the value and the central-server model had shown the cost: every clone is a full, independent copy of the history (developed in Remotes and the distributed model).
Snapshot-based and atomic, because CVS's per-file, non-atomic model was the thing to escape: a commit records the entire tree at once (developed in How commits actually work).
Content-addressed and cryptographically chained, because trust across thousands of contributors required history to be tamper-evident rather than merely stored (developed in the object-model sections, and in the Torvalds talk under Further reading).
Fast at branching and merging, because a kernel-sized project lives or dies by how cheaply work can diverge and rejoin.

Much of what the rest of this document treats as fundamental was, originally, a deliberate correction of something a prior system did badly.

### Further reading

1. Pro Git by Scott Chacon, free at `git-scm.com/book`. Read it once in your first year and once again after a few years of real use. Different sections will matter at different stages. For the object model specifically, the "Git Internals" chapter (`git-scm.com/book/en/v2/Git-Internals-Git-Objects`) walks through building a commit from `git hash-object`, `git write-tree`, and `git commit-tree` by hand.
2. "A Note About Git Commit Messages" by Tim Pope (2008). Short. Internalize and move on.
3. `git help <command>`. The manual pages are dense but accurate. The ability to read them directly, rather than relying on Stack Overflow answers of uncertain quality, is a long-term advantage.
4. "Git for Ages 4 and Up" by Michael Schwern (recording from linux.conf.au 2013; recording at `youtube.com/watch?v=1ffBJ4sVUb4`). Schwern builds a Git repository out of children's construction toys while running the equivalent commands, so the talk shows what is actually happening inside Git rather than teaching the command surface. Blobs, trees, commits, branches, the staging area, remotes, and rebase all become physical objects you can see. The gentlest on-ramp to the object model; watch it first if the graph has never clicked.
5. "Version Control (Git)" by MIT's The Missing Semester of Your CS Education (Lecture 6, 2020; ~1h25m; recording at `youtube.com/watch?v=2sjqTHE0zok`; notes and exercises at `missing.csail.mit.edu/2020/version-control/`). The lecture deliberately teaches Git's data model before the command interface, a repository as a content-addressed store of blobs, trees, and commits forming a DAG, and then derives the everyday commands from it. The fullest free lecture in the data-model-first tradition; watch it once you want the whole model laid out end to end.
6. "Tech Talk: Linus Torvalds on git" (Google Tech Talk, 2007; recording at `youtube.com/watch?v=4XpnKHJAok8`). Torvalds, who wrote Git, explains at Google why it is built the way it is: distributed rather than centralized, content-addressed and cryptographically chained so history is tamper-evident, and optimized for merging and trust across a large contributor base. Not a tutorial but the design-rationale talk that explains the why behind the model the other talks teach; also a candid window into the priorities that shaped the tool.
7. "Git From the Bits Up" by Tim Berglund (JAXConf, 2013; ~55 min; recording at `youtube.com/watch?v=MYP56QJpDr4`). An advanced talk, explicitly not for beginners, that takes Git apart to its raw objects and rebuilds a commit by hand using low-level plumbing. The canonical "see the object graph" talk; watch it once you are comfortable with the daily workflow.
8. "git: not just for source code anymore" by Josh Triplett (linux.conf.au, January 2013; recording at `youtube.com/watch?v=3-vAh9uDItY`). Triplett, a longtime Linux kernel and Debian developer, makes the case that Git is a general-purpose, tamper-evident versioning engine that just happens to be famous for code: the same blobs, trees, and commits version configs, server state, datasets, and entire wikis. Worth watching once to see how much of "Git is for code" was convention rather than design.

Start now.
Be consistent.
The value compounds.