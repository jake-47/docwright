# Manual Borg and GPG

*[Part 1](./leveling-up-1.md) and [Part 2](./leveling-up-2.md) hand your data to a shell script somebody else wrote.*
*This page explains the same job without the script, for those who prefer to minimize trust.*

*It is not a hand-written copy of the script.*
*Most of what the script does is convenience you will not miss with two pendrives and a bit of patience.*
*What you will miss is the handful of things borg does not do unless you ask*
*Those are what this page is about.*

*It targets borg 1.2 through 1.4, which is what Debian-family systems ship today.*
*Check yours with `borg --version`.*

## What this page assumes

[Getting started with Borg](./getting-started-with-borg.md) covers installing borg, creating a repository, making an archive, listing what is in one, and extracting it again.
Read that first.

Once you can do those four things, you can back up.
What you cannot yet do is trust the result, keep it from filling the drive, or run it without typing a passphrase over and over.

## Several drives are several repositories

This is the idea everything else on this page depends on, and it is the one people get wrong.

Two pendrives holding a repo of the same name are not a mirrored pair.
They are two independent repositories that happen to share a name, each with its own archives, its own key, and its own passphrase.
Nothing keeps them in step except you running the same commands against both.

Three consequences, all of which bite eventually.

Changing a passphrase changes it on one repository.
Do the second drive in the same sitting or you will have two passphrases for one name and no record of which drive holds which.

Renaming is `mv` on each drive, one at a time.

And a drive that was not plugged in last month is a month behind, silently, because nothing anywhere is tracking that.
The only way to know is to look.

This is also why `repokey` is the right encryption mode for drives you carry.
It keeps the key inside the repository, protected by your passphrase, so the drive is openable on any machine with nothing but the passphrase in your head.
`keyfile` keeps the key in `~/.config/borg/keys` instead, which means a stolen drive is useless without a file from your laptop, and a dead laptop leaves you with an unopenable drive.

## Passphrases

Three rungs.
Start on the first, move up when the typing annoys you more than the risk does.

### Rung one, type it

Borg asks, you type, nothing is stored anywhere.
This is the most secure arrangement there is and for two pendrives it is entirely workable.

One thing to know before you decide it is unworkable, and one before you decide it is fine.

It is not one prompt per backup.
Borg asks once per operation that needs the repository key, and a careful run of one repo is three of those: the archive, the prune, and the check.
Two drives makes six.
That is the number people find out about on their second evening, not their first.

And every one of those prompts is a moment you cannot walk away from, which rules out running anything on a timer.

### Rung two, a file borg reads for you

Put the passphrase in a file, tell borg how to fetch it:

```console
(umask 077; printf '%s' 'your long passphrase' > ~/.borg-pass-documents)
export BORG_PASSCOMMAND='cat /home/john/.borg-pass-documents'
```

Borg runs that command whenever it needs the passphrase and reads the answer from its output.
The secret exists only inside that short-lived `cat`, never in borg's environment.

The `umask 077` matters as much as the rest.
The file's permissions are the only thing protecting it, so it is `chmod 600` and stays that way.

What this buys: no typing, and a run you can leave alone.
What it costs: anyone with root on the machine can read the passphrase, and so can anyone holding an unencrypted backup of your home directory.

This is the rung that works from cron, and it is the only one that does.

### Rung three, a gpg-encrypted file

```console
gpg --encrypt --recipient you@example.com --output ~/.borg-pass-documents.gpg ~/.borg-pass-documents
chmod 600 ~/.borg-pass-documents.gpg
gpg --decrypt ~/.borg-pass-documents.gpg
```

That last line is not optional.
Check the file decrypts to what you expect before you delete the plaintext one.

Then:

```console
export BORG_PASSCOMMAND='gpg --quiet --decrypt /home/john/.borg-pass-documents.gpg'
```

Be clear about what this does and does not buy you.

It buys protection at rest.
The passphrase is no longer readable text on your disk, so a stolen drive of your home directory, or a stray copy of an old backup, no longer hands it over.

It does not buy unattended running.
Borg re-runs that command for every operation that needs the key, and each run needs gpg able to decrypt right then.
That means the agent primed, or you answering a prompt, or a hardware token touched, per operation.
On a machine you are sitting at, the agent's cache hides all of it.
On a timer at four in the morning it fails, or worse, hangs.

So rung three is for the machine you use, and rung two is for the machine that backs itself up while you sleep.
They are not an upgrade path; they are two different jobs.
Choosing rung three and then wondering why cron stopped working is the single most common way to end up with a month of backups that did not happen.

### The one to avoid

`BORG_PASSPHRASE` puts the passphrase directly in the environment.

Written inline, as `BORG_PASSPHRASE=hunter2 borg create ...`, it can show up in the process list where every user on the machine can read it.
Borg's own FAQ warns about exactly this.
Written as an `export`, it sits in your shell history and in the environment of every process you start for the rest of the session.

There is a fourth option, `BORG_PASSPHRASE_FD`, which has borg read from a file descriptor you open and is the safest of all of them, at the cost of being awkward to type.
Worth knowing it exists.
Note also that `BORG_PASSPHRASE` overrides `BORG_PASSCOMMAND`, which overrides `BORG_PASSPHRASE_FD`, so a forgotten export from an experiment will quietly win over the arrangement you think you are using.

### Three things about the passcommand

Borg runs it without a shell.
Environment variables like `$HOME` are expanded, but `~` is not, so write the path out in full.

It is split the way a shell splits a command line, so a quoted path with a space in it does survive.
What does not survive is anything that needs a shell to mean anything: no pipes, no redirection, no command substitution.
Put those inside `sh -c 'the whole thing'` and make that the passcommand.

And by hand, one small file per repository is easier than one file holding them all.
The script keeps a combined file because it has parsing code; you do not, and `cat` or `gpg -d` on a single-line file needs none.

## Filtering: order is the whole thing

Borg evaluates `--pattern` arguments in the order you give them, first match wins, and anything unmatched is kept.

That one rule is the only part worth memorising, because it decides something that matters.
Put your drops before your keeps.
An exclude listed first cannot be undone by an allowlist after it, which is what you want for anything you are deliberately keeping out of a backup.
The other way round, an allowlist can pull back in the very thing you were excluding.

Check a pattern set before you trust it:

```console
borg create --list --dry-run "::test" /home/john/Documents --pattern '- sh:**/cache/**'
```

An allowlist that matches nothing produces a perfectly valid, completely empty archive, and no error.
`--dry-run` is how you find that out on the day you write it rather than the day you need it.

## Retention: prune, then compact

Left alone, a repository grows until the drive is full.
Pruning deletes archives by rule:

```console
borg prune --keep-daily 7 --keep-weekly 4 --keep-monthly -1
```

A negative number means no limit, so `-1` keeps that tier forever.
Rules are applied shortest interval first, and an archive kept by one rule does not count towards the next.
Since borg 1.2 the oldest archive is kept whenever a rule could not otherwise meet its target, so your first archive keeps ageing until a newer one qualifies to replace it.

There is no undo, so look before you leap:

```console
borg prune -v --list --dry-run --keep-daily 7 --keep-weekly 4
```

Then the step that is easy to miss and makes the whole exercise pointless if you do:

```console
borg compact
```

`prune` marks archives as deleted.
`compact` is what rewrites the repository and hands the space back to the filesystem.
Prune without compact frees nothing at all, and the drive fills anyway while you are looking at a shorter archive list and assuming otherwise.

Two smaller things.

Prune also clears out checkpoint archives, the partial ones borg leaves behind when a run is interrupted, so if you never prune those accumulate.

And when you run `borg create --stats`, the number worth reading is the deduplicated size.
That is what this archive actually cost you on the drive.
The original and compressed sizes describe the files, not the growth.

## Verification: two kinds of check

Prune is about the drive filling up.
Check is about the drive lying to you, which is the failure that matters and the one nothing announces.

Fast, straight after writing an archive:

```console
borg check --archives-only --last 1
```

That reads the newest archive's metadata and takes seconds.
It catches the write that did not land, which is the common case: a drive pulled early, a cable knocked, a filesystem that went read-only halfway through.
Run it every time.
It costs nothing.

Slow, occasionally:

```console
borg check /media/john/d1/documents
```

That reads the whole repository and verifies every chunk.
On a large repo over USB it can take hours, so this is a thing you start and walk away from.
It is what finds bit rot on an ageing pendrive, and pendrives do rot.

Run the slow one before you rely on a drive you have not touched in a year, and after any incident that involved the drive being unplugged mid-write.
A backup you have never verified is a belief.

## Restoring: mount, not just extract

Getting started covers `borg extract`, and extract is the right tool for putting a whole folder back.

It is the wrong tool for the far more common case, which is that you want one file and you are not sure which archive has the version you mean.
For that, mount the archive:

```console
mkdir -p ~/mnt
borg mount /media/john/d1/documents::2026-07-28T20:30:00 ~/mnt
```

It appears as a read-only filesystem.
Open it in a file manager, look at the file, copy out the one you want, then:

```console
borg umount ~/mnt
```

Leave off the `::archive` and mount the whole repository instead, and every archive appears as its own directory.
That is the quickest way to answer "which version of this do I actually want", and it beats extracting three candidates into three directories.

Two caveats.
It needs FUSE and enough memory and temp space for the archive's metadata.
And it does not reproduce everything, some filesystem flags and ACLs among them, so use mount to find things and extract to restore them properly.

Whichever you use, open a few of the restored files afterwards.
An extract that exits zero has told you the archive was readable, not that its contents are what you remember.

## If you took rung three, get the key out of the machine

This is the part with no recovery, so it goes before anything else you do with gpg.

A key whose only copy is inside an encrypted repository cannot be reached when you need it.
Opening the repository needs the passphrase, the passphrase is encrypted to the key, and the key is in the repository.

```console
gpg --export-secret-keys --armor you@example.com > secret-key.asc
gpg --export --armor you@example.com > public-key.asc
gpg --gen-revoke you@example.com > revoke.asc
```

Export the public key as well as the secret one.
It is not sensitive, and you need it for the paper copy below.

For paper, `paperkey` strips out everything reconstructible from the public key, leaving a much smaller amount to print:

```console
gpg --export-secret-keys you@example.com | paperkey --output secret-key-paper.txt
```

The default output is a hex dump with line numbers and a checksum on each line, meant to be printed and typed back in, and to tell you which line you mistyped when you do.
`--output-type raw` also exists, but that is binary, for feeding a barcode or QR generator, and is not something you can print and read.

Rebuilding needs the printout and the public key together:

```console
paperkey --pubring public-key.asc --secrets secret-key-paper.txt --output secret-key.asc
```

Two things people assume about a paper copy that are not true.

It does not remove the passphrase.
If the secret key was passphrase-protected, the rebuilt one is too, so paper rescues you from a dead disk and not from a forgotten passphrase.

And it is not self-contained.
Without the public key there is nothing to rebuild against, so keep a copy of `public-key.asc` with the printout.

Store all of it away from the backup drives.

## Where this ends up

Doing this by hand for two drives and one folder is perfectly reasonable, and you now know the parts borg will not do for you.

Doing it for four drives and five folders means running the same commands with different arguments, in the right order, remembering the compact after the prune and the check after the create, and noticing the drive that was not plugged in.
Which is to say you will write it down, and then you will write a loop, and at that point you have a backup script.

The only question left is whose, and whether you have read it.

## Borg 2.0

Borg 2.0 changes the surface enough that the commands here will not run unchanged.

`borg init` becomes `borg repo-create`.
`borg list` splits into `borg repo-list` for archives and `borg list` for contents.
The `repo::archive` syntax is replaced by `-r <repo>` plus a separate archive name.
`borg prune` acts on an archive series rather than defaulting to the whole repository.

Debian-family systems still ship the 1.x line at the time of writing.
Check `borg --version` rather than assuming either way.