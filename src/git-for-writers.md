# Git for writers

> - **For:** writers who keep their work in Git, or are about to.
> - **Before you start:** [Getting started with Git](./getting-started-with-git.md).
> - **Reading time:** about 10 minutes.
> - **You end with:** habits for committing prose, branches as a place to experiment, readable diffs for paragraphs, and a version-number scheme for documents readers come back to.

Everything about Git applies to writers as much as to programmers; Git doesn't care what your files contain. But a writer's relationship to version control has some specific textures that developer-oriented tutorials rarely name. This page is the pivot.

The deepest principle survives the translation: Git is a [communication tool](./gitconcepts.md#commits-as-communication), not a backup tool. The conversation it enables is with your future self. For a writer, this is actually more evocative than for a programmer, because writers already know viscerally what it means to lose an earlier version. The paragraph you cut and wish you hadn't. The opening you wrote six drafts ago that was somehow closer to the truth than where you ended up. Git is, fundamentally, the ability to never actually lose any version of anything while still being free to cut ruthlessly in the moment.

## Commit messages as craft notes

The ["why not what" rule](./gitconcepts.md#commit-message-discipline) has a different flavour for prose. The diff shows which words changed; it doesn't show whether you changed them because the rhythm was off, because a reader said the paragraph confused them, because you realised the character wouldn't actually speak that way, or because you were tired and second-guessing yourself at midnight. The message is where you record the intention behind the revision, and for a writer that intention is often artistic or emotional rather than technical.

Good commit messages for prose might look like:

1. "Cut the second section; felt like throat-clearing."
2. "Rewrote opening after workshop feedback. Tessa was right, it was starting in the wrong place."
3. "Restored earlier version of dialogue; the revised one lost the flatness I wanted."

These are notes to yourself about craft. Years later, when you're wondering why a piece evolved the way it did, these messages are a record of your own thinking as a writer. Worth having for its own sake, separately from the practical use of finding a specific version.

Lucia Berlin's notebooks, Carver's drafts, Didion's edited manuscripts: we treasure these because they reveal the process. Git gives you, the writer, the ability to keep your own version of this record effortlessly, for your own later study or simply as a form of self-knowledge about how you actually work.

## Rhythm of commits

For a developer, a commit often corresponds to a completed small task. For a writer, commit at natural pause points: end of a writing session, after a significant revision, after a workshop meeting when you've absorbed feedback, after you've "finished" a draft in the provisional way any draft is ever finished.

Don't try to commit after every sentence. The unit of meaningful change in prose is usually the paragraph, the scene, the session.

Do commit before any major surgery. Before you cut a whole section, commit. Before you restructure, commit. Before the "what if I rewrote this in first person" experiment, commit. The freedom to experiment radically comes from knowing the previous version is safe.

The ["one commit, one logical change"](./gitconcepts.md#one-commit-one-logical-change) principle translates as: don't mix unrelated revisions in the same commit. If you sat down to fix typos and ended up also rewriting the ending, those are two different creative acts and deserve two different commits. This matters when you want to look back and remember what you changed and why.

## Branches as creative experiments

Branches change meaning for a writer, and arguably become more interesting than they are for most developers. In code, branches are a logistical tool. In writing, branches are a tool for actual creative experimentation. The ability to say "let me try rewriting this story from the sister's point of view, fully, not just as an exercise but as an alternative version I can live inside for a while, while keeping the current version completely safe."

Make a branch. Do the experiment. If it works, merge that version in or keep both as separate artefacts. If it doesn't, delete the branch and return to exactly where you were. The commands are under [Branches](./gitreference.md#branches) in Git reference, and the idea underneath them is [Branches as pointers](./gitconcepts.md#branches-as-pointers) in Git concepts.

Writers often resist radical experiments in revision because they fear losing what they have; branches dissolve that fear entirely. This is probably the single most transformative use of Git for creative work, and it's underappreciated because most Git tutorials are aimed at developers who think of branches more prosaically.

## Making prose diff well

Git's default diff works at the line level. For code that's fine; code is structured by lines. For prose, a line often contains an entire paragraph, and a one-word change shows the whole paragraph as removed and the whole new version as added. The actual change drowns in noise.

There are two fixes. They solve the same problem from opposite directions, and the right choice depends on whether you want to change how you write or how you read.

The write-time fix is semantic line breaks: put each sentence on its own line in the source file. Markdown renders identically whether sentences sit on separate lines or flow in a paragraph (a single newline becomes a space; a blank line becomes a paragraph break), so the rendered output is unchanged. But the source-level shape is now line-oriented in the way Git already expects. Insert a sentence and you touch one line. Reword a sentence and the diff shows that one line changed, not the whole paragraph. The default `git diff` does the right thing without any configuration. This is strictly better for diffs and costs nothing at render time. New users almost never know this convention exists, because it's invisible in the rendered output; it only pays off once you start reviewing your own history. Many serious Markdown-based documentation projects on GitHub follow it for exactly this reason.

The trade is editor-side: the source looks ragged in a plain editor, and some auto-formatters will reflow it back into paragraphs (configure them not to, or disable on Markdown). For documents you'll diff repeatedly across years, the rag is worth the legibility.

The read-time fix is `--word-diff`, which tells Git to highlight changes at the word level even when whole paragraphs are on one line:

```bash
git diff --word-diff
git diff --word-diff=color
```

Git has no setting that makes word-level diffs the default, so give the command a short alias instead:

```bash
git config --global alias.dw "diff --word-diff"
```

From then on, `git dw` gives you the word-level view in any repo. [One-time setup](./gitreference.md#one-time-setup) in Git reference includes the same alias among its others.

GitLens in VSCodium has similar settings for word-level or character-level diffs.

The two approaches compose: a repo written with semantic line breaks and read with word-diff gives you the cleanest possible prose diffs at both granularities. The line-level diff shows which sentences moved or changed; the word-level view shows what changed inside those sentences. If you only do one, do semantic line breaks. It's tooling-free, travels with the file rather than the config, and works in every Git interface including forge web views.

## Plain text, not Word

For serious writing work, write in plain text formats (Markdown, reStructuredText, plain text, LaTeX) and only convert to Word or PDF for delivery. Plain text is what Git is built for. Word documents technically work but you lose most of the benefit, because you can't see what changed. Git stores the whole binary as "this file changed" without being able to show a meaningful diff.

If you must use Word (an editor insists, a contract requires it), do the editing in plain text, convert to Word at the final step, and commit the Word file at that point. Version the Markdown. Deliver the Word.

## Versioning prose documents

[The commit log as changelog](./gitconcepts.md#the-commit-log-as-changelog), in Git concepts, concerns commit-level history: every commit is a potential version, and the log is the changelog. A separate question is whether documents (essays, reference notes, theological writing) should carry an explicit version number on top of that.

Code projects answer this with semantic versioning, usually called semver: a three-number scheme `MAJOR.MINOR.PATCH` where MAJOR signals a breaking change, MINOR signals a backward-compatible feature, and PATCH signals a bug fix. For documents the breaking-change concept doesn't translate literally (prose doesn't compile), but it translates cleanly with one substitution.

### The mapping for prose

Translate "breaking change" to "thesis shift".

1. MAJOR: the claim changed. Your view of the subject has moved. Someone who cited the previous version to support an argument may find their citation no longer supports it. This is the prose equivalent of a breaking API change, because readers who built on your earlier conclusion now have work to do.
2. MINOR: the content changed but the claim didn't. You added a section, cut a digression, expanded an example, brought in a new source. The thesis is intact. Readers who remember what you argued don't need to re-read; they only need to look at the new version if they want the fuller treatment.
3. PATCH: the copy changed. Typo fixes, clarified wording, reformatted a list, corrected a date. No change in meaning, no change in content. Readers don't need to do anything.

The mnemonic is three Cs: claim, content, copy. Claim is the argumentative term; content is the body of substance; copy is the publishing-industry term for the text itself.

Pre-1.0 translates cleanly. `0.x.y` is a draft you're not yet willing to commit to publicly. `1.0.0` is the point at which you're standing behind the thesis. After that, every revision records at what level you've shifted.

### Worked example

A theology essay on covenant theology, first published as 1.0.0.

1. You catch a typo in a footnote, fix a quotation that had the wrong translation, and tighten an awkward sentence. Bump to 1.0.1. Copy only.
2. A month later you add a section on a minor critic you hadn't addressed, cut a digression on an adjacent topic, and expand one example. The thesis hasn't moved. Bump to 1.1.0. Content.
3. A year later you read a Reformed author who convinces you that one of the load-bearing claims was wrong, and you now argue a modified position. Bump to 2.0.0. Claim.

A single revision can cross categories. If you fix typos and also add a new paragraph in the same pass, the bump is the highest level involved: 1.1.0, not 1.0.1 and then 1.1.0. A MAJOR bump resets MINOR and PATCH too: 2.0.0 starts fresh at .0.0, not carrying forward the prior minor count.

### When to use it

Version numbers are useful only when readers come back. A blog post nobody returns to doesn't need versioning; a reference doc people cite does. The break-even is whether someone would need to know whether what they remembered is still what's there. If yes, version. If no, don't.

For personal writing in a Git repo, the commit history already records every change, and filename suffixes (`_v2`, `_v3`) mark coarse milestones for workflow reasons. Semver on top of that is a public-facing contract for readers who don't read the commit log. The two schemes don't conflict; they operate at different layers.

### Honest gotchas

The claim/content/copy line isn't always clean. A new section you add might implicitly shift the claim by strengthening one side of an argument you didn't mean to weight more heavily. If the effect on the thesis is material, bump MAJOR even though mechanically you only added content. The question is always what the reader would conclude, not what you technically changed.

"Breaking change" for prose is softer than for code. Code either compiles or it doesn't; a reader's citation either supports their argument or it doesn't, but the line is judgment-bound. Default to the stricter call: if you're unsure whether the change is MAJOR or MINOR, call it MAJOR. Over-signalling is cheap; under-signalling breaks trust.

Most prose doesn't accumulate enough revisions to make fine-grained versioning worth the overhead. The minimum worthwhile use case is something you expect to revise at least a few times a year, across a few years, for an audience that might refer back.

### Recommendation

For any document you plan to maintain and expect to have return readers, use semver with the claim/content/copy mapping. Start pre-1.0 while drafting; release at 1.0.0 when you're willing to stand behind the thesis publicly; bump per the rules above on every revision. State the scheme once in a footer or about-page; don't re-explain it per document.

For ephemeral writing (blog posts, one-off essays, anything readers won't revisit), skip versioning entirely. Filename suffixes in your own repo are enough for you; readers don't need to see them.

## Don't let tooling become procrastination

The entire apparatus of version control, tooling, configuration, organisational scaffolding is in service of the actual writing. It's very easy to spend a whole afternoon perfecting your Git setup as a way of not confronting a difficult scene.

Set things up well once. Establish simple habits. Let the system fade into the background. The writing is the thing. Git is the frame that keeps the writing safe and legible across time. If you find yourself thinking about Git more than writing, you've inverted the relationship.

You now know enough to use Git for your writing. If you want to know why Git behaves the way it does, read [Git concepts](./gitconcepts.md); you don't have to read it all at once.