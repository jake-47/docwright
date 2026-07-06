# Why version control
This article introduces and explains important concepts of Git that every knowledge worker must know.
How did you get by without it even, really?

Its companion guide, Git reference, tells you what to type or remember.

## Git, What it is and why it matters

Imagine you are writing a long essay.
You finish a draft on Monday, revise it on Wednesday, rewrite the introduction on Friday, and by the following Tuesday you realize the Wednesday version of the second paragraph was actually better than what you have now.
But it's gone.
You typed over it.
The only version that exists is the one on your screen.

This is the primary problem Git solves.

Git is the best version-control tool invented so far.
It that takes snapshots of your files whenever you tell it to.
Each snapshot is called a commit which, essentially, is just a version of the file or files you chose to save.
You can make indefinite number of versions of a file and record why the changes were made.

## The power of saving versions

There is a difference between a backup and a version history.
A backup saves a file.
A good VCS allows you to save an indefinite number of versions of a file and information on why a change was made, thus showing you both how the file changed over time and why.
A backup says: "This is what the file looked like on 3 March 2027."
A version history says: "This is what the file looked like at 10 am on 3 March 2027, and here's what it looked like at 5 pm, and here is what you changed from the previous versions, and here is the note you wrote to yourself at those times explaining why you made those changes."

A backup protects you against loss.
A version history gives you a record of your own thinking.

Consider what it would mean to maintain a single file, say, your personal notes on a subject you care about, across ten years of committed revisions.
You would be able to open that file at any point in its history and see not just what you believed then, but what you thought was worth changing, what you added, what you removed, and what you said about each change.
Every commit message is a small act of self-examination: you are forced to articulate, even in a sentence, what you did and why.

Over a decade, this accumulates into something genuinely valuable.
You could trace the moment you abandoned a position.
You could see when a new reading reshaped your understanding.
You could watch a paragraph appear, survive three rounds of revision, and then quietly vanish from the document a year later, and read your own note explaining why you cut it.
This is intellectual autobiography at the level of the sentence.

And because identical content across versions is stored only once, with delta compression underneath for the rest, the storage cost is negligible.
A decade of daily commits on a text file might occupy a few megabytes.
So you don't have to choose between versions; you can keep all of them, permanently.
So edit away.

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

## Benefits of Git

Recovering a lost version is only the first application.
The same history gives you several more:
Every tracked file carries its full past, so you can watch the evolution of your ideas and notes over time, down to the individual line.
It allows you to compare any two versions of a file, see exactly what differs, and take the parts you prefer from either side, line by line if you want.
This allows for easy collaboration. 
Hand a copy to anyone, let them edit freely, and see precisely how their version differs from yours before deciding what to keep.
This is handy when you're working with an AI and want it to review or change something for you.
You can easily tell what changed.
Imagine the pain of reviewing and comparing without Git.

As a bonus, you get tamper resistence.
You control what change you allow in.
And because very committed change is sealed to its contents and ancestry, a change to any previous commit requires every commit after it to be changed.

Each commit carries a summary and, if you do it right, a message describing why the file changed; so when others and your future self look back, they aren't baffled by why the change was made.
Commit summary and commit messages are embeded with every commit along with the name and email you choose to provide (it doesn't have to be your real ones).
