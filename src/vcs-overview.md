# Version control overview

<p class="mdb-subtitle">For those who have never kept a history of their drafts</p>

With version control, every draft you commit is saved along with the note you wrote on why you changed it, and you can go back to any of them. [Whys of version control](./vcs-whys.md) makes the case, and gives you the four ideas the rest of the section builds on: repository, commit, staging and diff.

Once you're convinced, jump to [Getting started with Git](./getting-started-with-git.md), where you install Git, make your first two commits, and bring back an old version. If you have never opened a terminal, read [Terminal basics](./terminal-basics.md) first; it takes three minutes. Then read [Git for writers](./git-for-writers.md), which shows how to use Git day to day as a writer. It covers writing commit messages, trying a big change on a branch and dropping it if it doesn't work, seeing which words changed and not just which lines, keeping drafts in plain text instead of Word, and numbering versions of documents that readers come back to.

Whys, Getting started and Git for writers take about 20 minutes to read, and they're enough to use Git every day.

The rest of the section is for later. [Git concepts](./gitconcepts.md) explains how commits and branches work, when it's safe to rewrite history, and how to recover when a command goes wrong. It's long, but you don't have to read it in order; when Git does something you didn't expect, read the section about it. [Git reference](./gitreference.md) is organised by task, so you can look up what you want to do and copy the command. [Git history delete](./git-delete.md) is a script that permanently removes a file from every commit, for example a file of private notes in a repo you're about to make public. If the file held a password, change the password first; [Never commit secrets](./gitconcepts.md#never-commit-secrets) explains why.