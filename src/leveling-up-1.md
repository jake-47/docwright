# Leveling up: Part 1

*This is the first of three guides to borg-simple, a set of shell scripts that wrap [BorgBackup](https://www.borgbackup.org/).*
*The command you type is `backup`.*
*It makes encrypted, versioned backups of the folders you name, to every USB drive you name, from one command.*

*This part sets everything up with your passphrases in a plain text file that only you can read.*
*That is the simplest arrangement, it is the only one that works unattended from cron (automated backups), and it is where you should start.*

*[Part 2](./leveling-up-2.md) encrypts that file with GPG, which has stronger security at rest, but it costs you the ability to run automated backups with a timer.*
*[Manual borg and gpg use](./manual-borg-and-gpg.md) throws the scripts away and shows you every command that it was running for you.*

## What you need

A Linux machine.
These were written on Devuan; Debian, Ubuntu, Mint and their relatives all work the same way.

One or more USB drives.
Two is comfortable, three is generous, four is careful.
They do not have to match in size or brand.

The [backup script](./borg-simple.md), saved somewhere you can find it.

About fifteen minutes.

You do not need to know how to program.
If you can copy a command into a terminal and edit a text file, you have everything.

## The words you will meet

You will see these words in every message the tool prints, so it is worth ten minutes now.

**Drive label.**
When you plug a USB drive in, your system mounts it, which means it makes the contents appear at a path.
On most desktop Linux that path is `/media/your-name/something`.
That last part is the drive label.
It is usually the name you gave the drive when you formatted it.
`d1`, `d2`, `d3` are good labels because they are short and you will type them.

**Repository, or repo.**
A folder on the drive where borg keeps backups.
Think of it as a vault with one lock.
Everything inside one repo shares one passphrase.

**Archive.**
One snapshot inside a repo.
Every time you run `backup`, each repo gets a new archive, named with the date and time.
Yesterday's archive does not go away when today's is written, which is what "versioned" means.

**Deduplication.**
Borg splits your files into chunks and stores each distinct chunk once.
A second archive of a folder you barely touched costs almost nothing.
This is why you can keep months of daily snapshots on a drive that is not much bigger than the data.

**Retention, or pruning.**
Deleting old archives on a rule, so the repo does not grow forever.
"Keep seven daily, four weekly, every monthly" is a recommended retention rule.

**Passphrase.**
The secret that opens one repo.
Borg encrypts everything with it.
Lose it and the backup is a pile of noise to you or anyone who steals the drive.

## Why not just type borg commands

Borg is a good program, and you can drive it by hand.
However, with the script, this is what you stop doing.

1. You don't have to install borg first; if it is missing, the first command that needs it installs borgbackup for you.
2. You don't have to run a command per folder; `backup` archives every repo you configured.
3. You don't have to rerun the command per drive; each repo goes to all of its drives in the same run.
4. You don't have to remember which folder belongs in which repo, or which repo lives on which drive; you wrote it down once.
5. You don't have to type a passphrase per repo per drive; it is handed to borg automatically.
6. You don't have to leave a passphrase in your shell history or in an exported variable; a short-lived helper process passes it straight to borg and exits.
7. You don't have to assemble the repository path out of the mount point, the drive label and the repo name.
8. You don't have to abandon the run because one drive is not plugged in; the missing drive is reported and the others still get their backup.
9. You don't have to spell out `--exclude` patterns on the command line; they live in the one-time-setup config file.
10. You don't have to remember borg's `/./` trick, the one that makes a folder land at the top of the archive under its own name no matter where it lives on disk.
11. You don't have to run `borg prune` as a second command; retention runs straight after the archive, for every repo that has a `keep` line.
12. You don't have to remember that pruning alone frees nothing, and that `borg compact` is what actually returns the space.
13. You don't have to interpret borg's exit codes; a file that changed mid-copy is reported as a warning on a successful run, and a real error is reported as a failure.
14. You don't have to add up sizes; the run tells you how much it added and how large the repo is now, counting the same data once even when it went to four drives.
15. You don't have to reconstruct what happened from a screen of output; the run ends in one line that counts repos by outcome and stamps the time.
16. You don't have to run `borg init` once per repo per drive; `backup init` creates all of them.
17. You don't have to write a new repo's config block by hand either; `backup init <repo> <path>...` writes the block, asks for the passphrase, stores it, and creates the repo on every drive.
18. You don't have to look up an archive's name to restore it; `backup extract <repo>` takes the newest.
19. You don't have to count backwards through a listing to reach an older one; `-3` means the third newest.
20. You don't have to `cd` into the right parent directory before restoring; `-i` puts each folder back where it came from.
21. You don't have to restore repos one at a time; `--all-repos` does every one it can reach.
22. You don't have to own a config file at all to restore; point `extract` at a repo path on the drive and borg asks for the passphrase itself.
23. You don't have to remember which drive holds a repo when you restore; the first mounted drive that has it is used.
24. You don't have to invoke borg once per repo per drive to see what you have; `backup list` prints every mounted drive's archives, newest first.
25. You don't have to walk the drives to verify them; `backup check` deep-verifies each repo on each mounted drive.
26. You don't have to rotate a passphrase on each drive separately and then remember to update your notes; `backup pass-change` rotates on every drive and rewrites the passphrase file.
27. You don't have to `mv` a repo directory on four drives and then edit two files; `backup rename` does the directories, the config and the passphrase file, or refuses and changes nothing.
28. You don't have to make sure two backups never overlap; the tool takes a lock and the second one says so and stops.
29. You don't have to remember to lock down the passphrase file; the tool refuses to read one that anybody else on the machine can open.
30. You don't have to worry about a debug session printing a passphrase into a log; the tool refuses to run under `bash -x` at all.
31. You don't have to notice on your own that a mistyped filter backed up nothing; an archive that comes out empty is called out.

Numbers 5, 6, 29 and 30 are the reason the file layout below is worth following exactly.
The rest is convenience.

## The two files you keep

Everything you configure lives in two files in your home directory.
Nothing else is stored anywhere.

**The config file, always at `~/.borg-config`.**
It answers three questions: where do drives appear, what folders go into which repo, and which drives does that repo live on.
The path is fixed.
The tool does not take a `--config` flag and does not read one from anywhere else, so a config that is not at `~/.borg-config` is not in use.

**The passphrase file, wherever you point `PASSPHRASE_PATH`.**
It holds one line per repo, and nothing else:

```bash
set_pass documents 'a long passphrase for the documents repo'
set_pass photos    'a different long passphrase for photos'
```

Give it any name you like.
The tool works out whether it is plain text or GPG-encrypted by reading the file itself, not by looking at the name, so `~/.borg-pass` is as good as `~/.borg-pass.pass`.
Part 2 uses that: you encrypt this file in place and change nothing else.

Two constraints on the path.
It must be readable and writable by you alone, because the tool refuses a file that grants any access to group or other.
And it must contain no spaces, quotes or backslashes, because borg runs the command that fetches your passphrase without a shell to unpick them.

In this guide, the file is plain text.
Its only protection is its permissions and whatever disk encryption you have.
Not a big deal but it is a real risk, and the subject of Part 2, and it is also the only arrangement that can run without you present.

## Setup

Five steps, in order.

### Step 1 — save the script and run it once

Copy the whole `backup` script.
Open a text editor, paste it in, and save it somewhere you will not lose it.
`~/Documents/backup.sh` is a good choice, and it is the one the installer's examples use later.

Pick a folder whose path has no spaces, quotes or backslashes in it.
The script re-invokes itself by absolute path to fetch a passphrase, and borg runs that without a shell, so a path like `~/My Documents/backup.sh` will stop the tool with an error the first time it needs a passphrase.

Mark it runnable:

```console
chmod +x ~/Documents/backup.sh
```

Then check that it works:

```console
bash ~/Documents/backup.sh --help
```

You should get a list of commands.

That `bash ~/Documents/backup.sh` is how you run it until you install it properly, which is a section near the end of this guide.
For the rest of this guide, commands are written the short way, as `backup init` and `backup list`.
Until you have installed it, type `bash ~/Documents/backup.sh init` and so on instead.

You do not need to install borg.
The first command that needs it will run `sudo apt-get install borgbackup` for you and ask for your password.
If you would rather do it yourself, or you are not on a Debian-family system, install it now:

```console
sudo apt install borgbackup
```

### Step 2 — find your drive labels

Plug in every drive you intend to back up to, and wait a few seconds.
Then:

```console
ls /media/$USER
```

You will see one entry per drive:

```
d1   d2
```

or, if you never renamed them:

```
MY-BACKUP   SEAGATE-2TB
```

Write these down.
They go in the config in step 4.
Short names are easier to live with; you can rename a drive in your file manager if you want to.

The directory those labels sit in, `/media/your-name`, is the mount base.
If your system puts drives somewhere else, note that path instead.

### Step 3 — write the passphrase file

Pick a passphrase for each repo you are about to create.
Make them long.
A passphrase you cannot remember is fine here, because you are about to write it down; a short one is not.

Create the file:

```console
touch ~/.borg-pass
chmod 600 ~/.borg-pass
```

Then open it in a text editor and put one line per repo in it:

```bash
set_pass documents 'a long passphrase for the documents repo'
set_pass photos    'a different long passphrase for photos'
```

Single quotes around the passphrase.
If the passphrase itself contains a single quote, write it as `'\''`.

You must write the first line by hand.
Later on, `backup init <repo> <path>...` will prompt you for a new repo's passphrase and append it here for you, but it will only do that if this file already exists.

The `chmod 600` is not decoration.
Without it the tool stops and tells you to run it.

### Step 4 — write the config

Create `~/.borg-config` with the template below, then `chmod 600 ~/.borg-config`.

```bash
# ~/.borg-config   (chmod 600)

# ── topology: where the drives mount, and where things go ──────────────────
MOUNT_BASE="/media/john"                # each drive is MOUNT_BASE/<label>
ALL_DRIVES="d1 d2 d3 d4"                # the drive pool; `backup_drives all` expands to these
REPO_SUBDIR=""                          # optional folder between the drive and the repo ("" = repo at the drive root)
RESTORE_PATH="$HOME/Downloads"          # where `extract` drops restored folders (--path overrides it per run)
PASSPHRASE_PATH="$HOME/.borg-pass"      # the one passphrase file; "" lets borg prompt for every repo
SRC_HOME=""                             # in-place restore only: a foreign home prefix to remap onto yours

# ── one block per repo: repo_name opens a block, the lines under it configure it ──
repo_name documents
backup_data "$HOME/Documents" "$HOME/Notes"
backup_drives all
keep daily=7 weekly=4 monthly=-1
exclude "*.tmp" "**/cache/**"
compression auto,zstd

repo_name photos
backup_data "$HOME/Pictures"
backup_drives d1 d2
keep last=20
```

### Step 5 — create the repos and take the first backup

Plug in the drives and create the repositories:

```console
backup init
```

That walks every repo in the config, creates it on each of its mounted drives, and skips the ones that already exist.
Then:

```console
backup
```

The first run is the slow one, because nothing has been seen before.
Every run after it only stores what changed.

## What to edit, and why

Of the six settings at the top, two are yours and four can usually stay as they are.

`MOUNT_BASE` is the directory your drives appear in, from step 2.
Get this wrong and the tool reports that no drives are mounted, because it is looking in the wrong place.

`ALL_DRIVES` is the list of labels from step 2.
It exists so you write your drives down once; a repo that says `backup_drives all` gets this whole list, so adding a fourth drive is one edit rather than one per repo.

`REPO_SUBDIR` is for people who keep their repos inside a folder on the drive rather than at its top.
If `/media/john/d1/borg/photos` is where your repo goes, this is `borg`.
Empty means `/media/john/d1/photos`.
It applies to every drive; the tool cannot handle a subfolder on some drives and not others.

`RESTORE_PATH` is where a restore drops its files.
It defaults to your Downloads folder, which is a good place for it, because a restore should land somewhere you can inspect before you trust it.

`PASSPHRASE_PATH` points at the file from step 3.
Leave it empty and borg will prompt you for every repo on every drive, which defeats most of the list above.

`SRC_HOME` is for one situation only: restoring in place on a machine where your username changed.
If the archives were made under `/home/john` and you are now `/home/jane`, set it to `/home/john` and an in-place restore will redirect to your home.
Leave it empty otherwise.

Below the settings, a `repo_name` line opens a block and every line under it belongs to that repo until the next `repo_name`.
To stop backing something up, comment out or delete its whole block.
Comment out the `repo_name` line alone and the tool will stop and tell you, rather than quietly attach the orphaned lines to the repo above.

## The directives inside a repo block

`backup_data <path>...` lists the folders this repo archives.
Each is stored at the top of the archive under its own basename, so two folders in one repo may not share a name.
You may leave it out; a repo with drives but no folders is legal, is reported as "awaiting data", and archives nothing until you give it some.

`backup_drives <label>...` lists the drives this repo is written to.
The single word `all` expands to `ALL_DRIVES`.

`keep <key=N>...` sets retention.
The keys are `last`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`.
`N` is a whole number, or `-1` to keep that tier forever.
A repo with no `keep` line is never pruned, which is the safe default and also the one that fills a drive.
Unset keys on a line that exists default to `daily=7 weekly=4 monthly=-1 yearly=-1` and zero for the rest.
A nonzero `last=N` keeps the N newest archives and ignores the other keys.

`exclude <glob>...` drops matching paths.
`*` stays inside one path segment and `**/` crosses directories, so `**/cache/**` catches every cache folder at any depth.

`include_only <glob>...` is the opposite: keep only what matches, drop everything else.
Given a `backup_data` folder as its first argument it applies to that folder alone and leaves the repo's other folders whole.
An `exclude` always wins over an `include_only`, so a secret you exclude stays out even if an allowlist would have kept it.

`compression <spec>` is passed to borg untouched, for example `auto,zstd,10`.
Leave it out for borg's default.

`archive no` takes the repo out of the backup run while leaving `init`, `check`, `extract` and `pass-change` working on it.
Absent means yes.

If you have an old config using `backup yes|no` or `enabled yes|no`, those were renamed to `archive`, and the tool will stop and tell you rather than quietly ignore the line.

## Everyday commands

```console
backup                       back up every repo
backup <repo>                back up one repo
backup list                  archives on each mounted drive, newest first
backup list <repo> -l 30     as above, thirty deep, one repo
backup check                 deep-verify every repo on every mounted drive
backup extract <repo>        restore the newest archive into RESTORE_PATH
backup extract <repo> -3     restore the third newest instead
backup extract <repo> -i     restore in place, over the originals
backup extract --all-repos   restore everything it can reach
backup init <repo> <path>... create a new repo, block and passphrase and all
backup pass-change <repo>    rotate a repo's passphrase on every drive
backup rename <old> <new>    rename a repo everywhere it exists
backup --help                the list
```

`pass-change` and `rename` need every one of the repo's drives plugged in, and refuse to start otherwise.
Half a rotation across four drives is worse than no rotation, so they check first and change nothing if they cannot finish.

`extract` without `-i` writes into `RESTORE_PATH` and stops if something with the same name is already sitting there, unless you pass `-y`.
`extract -i` overwrites the originals, asks you to confirm, and fails rather than proceed if there is no terminal to ask at.

## Using an alias

Everything above works with the long form.
This makes it short, and it is also what the schedule section below needs.

Linux looks for commands in the directories listed in your PATH, and `~/.local/bin` is the conventional place for your own.
Copy the script there under the name you want to type:

```console
mkdir -p ~/.local/bin
cp ~/Documents/backup.sh ~/.local/bin/backup
chmod +x ~/.local/bin/backup
```

Open a new terminal and try `backup --help` from any directory.

If your shell cannot find it, `~/.local/bin` is not on your PATH.
Add this line to the end of `~/.bashrc`, then open a new terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

The copy in `~/.local/bin` is the one that runs.
Editing `~/Documents/backup.sh` afterwards changes nothing until you copy it over again, which is the usual way people end up debugging a version they are not running.

Once you have a few scripts to deploy this way, doing it by hand gets tedious and easy to get wrong.
`install_scripts` is a small script that does it for a list: you write down each file and the command name it should install as, and it copies them all into `~/.local/bin` and tells you if your PATH is not set up.
It has its own page.

If you want something shorter still, an alias in `~/.bashrc` is the place for it, not a second copy of the script:

```bash
alias bkp='backup'
```

Aliases work at your keyboard only.
Cron and desktop launchers do not see them, which is why the schedule below uses the full path.

## Running it on a schedule

This is the part that only works here, in Part 1.
Cron runs when you are not there, so nothing may stop to ask you anything, and a plain text passphrase file is the only kind that never does.
Once you move to the GPG file in Part 2, unattended runs stop being dependable.

Two things cron cannot do for you.
It cannot plug a drive in, and it cannot mount one.
So a scheduled backup makes sense for a drive that lives in the machine or stays plugged in, and a drive you carry is still a drive you run `backup` for by hand.

Open your crontab with `crontab -e` and add:

```
30 20 * * * /home/john/.local/bin/backup >> /home/john/.borg-backup.log 2>&1
```

Use the full path.
Cron's PATH is nearly empty and will not find `backup` on its own.

Redirect both streams to a log.
Without the redirect, cron mails you the output, and on a desktop machine with no mail set up that means it goes nowhere and you never learn that four weeks of backups failed.
Check the log now and then; the last line of each run says what happened.

You do not need to guard against overlap.
The tool takes an exclusive lock at the start of a run, so if a long backup is still going when the next one fires, the second says another operation is in progress and exits.

A drive that is not mounted at 20:30 is not an error that stops the run.
It is reported, the repos on the other drives still get archived, and the run finishes with a nonzero exit code so your log shows it was not a clean night.

## Starting over on a new machine

This is the whole reason for the exercise, so it is worth reading before you need it.

Your two files, `~/.borg-config` and your passphrase file, are inside the backups.
Make sure of that now: at least one repo's `backup_data` must cover them, either by backing up your home directory or by putting both in a folder that a repo covers.
A backup you cannot open is not a backup.

On the new machine:

Copy the `backup` script over, from a USB stick, a repo you can clone, or a printout if it comes to that.
Save it as in step 1; you can install it onto your PATH later, once things are calm.

Plug in one of your drives and look at what is on it:

```console
ls /media/$USER/d1
```

Restore the repo that holds your two files, by path, with no config anywhere:

```console
cd ~
bash ~/Documents/backup.sh extract /media/john/d1/documents
```

Any argument containing a slash is treated as a repo path.
The tool skips its config entirely, borg asks you for that repo's passphrase, and the archive is unpacked into the directory you are standing in.
This is the step that needs nothing but the drive and the passphrase in your head or on paper, which is why the passphrase for at least one repo has to be recoverable from outside the backups.

Now put the two files where they belong.
The config path is fixed, so it has to be moved rather than pointed at:

```console
cp ~/Documents/.borg-config ~/.borg-config
chmod 600 ~/.borg-config
cp ~/Documents/.borg-pass ~/.borg-pass
chmod 600 ~/.borg-pass
```

Open `~/.borg-config` and check three things against the new machine.
`MOUNT_BASE` still has your username in it if you wrote it out in full, and the new machine's username may differ.
`PASSPHRASE_PATH` must point at where you just put the passphrase file.
`ALL_DRIVES` should still match your labels, which it will unless you replaced a drive.

From here everything is normal:

```console
backup list
backup extract --all-repos
```

If your username changed and you want folders back at their original paths, set `SRC_HOME` to the old home directory and use `backup extract --all-repos -i`.

## When something looks wrong

`borg not found; installing borgbackup...`
Expected on a fresh machine.
It will ask for your password and carry on.

`<file> is reachable by group or other (mode N); run: chmod 600 <file>`
The config or the passphrase file is readable by someone else.
Run the command it gives you.

`MOUNT_BASE '<path>' is not a directory`
`MOUNT_BASE` is wrong.
Check it with `ls /media/$USER`.

`no drives mounted for the repo(s) to back up (looked for: ...)`
None of the drives those repos want is plugged in and mounted.
Note that this is checked before anything reads your passphrase file.

`could not read passphrases from <file>`
The file has no valid `set_pass` lines, or, once you are on Part 2, it cannot be decrypted right now.

`no passphrase set for <repo>; skipped this run`
That repo has no `set_pass` line.
Add one, or let `backup init <repo>` store it.

`no passphrase file at <file> yet; create it with your first repo's set_pass line`
`init` will add lines to an existing file but will not create the file.
Do step 3.

`passcommand needs paths free of whitespace, quotes, and backslashes`
The script, or the passphrase file, is saved somewhere with a space or a quote in the path.
Move it somewhere plainer and update `PASSPHRASE_PATH` if that is what moved.

`config: the 'backup' directive is now 'archive'`
An old config line.
Change `backup yes|no` to `archive yes|no`.

`archived <repo> on <drive> but the archive is EMPTY`
An `include_only` pattern matched nothing.
Check it with `borg create --list --dry-run`.

`another backup operation is in progress`
A previous run has not finished.
Wait for it.

`refusing to run under bash -x`
Tracing would print your passphrase.
Debug a specific section instead.

## Where to go next

[Part 2](./leveling-up-2.md) encrypts the passphrase file with GPG, so the passphrases are not sitting in readable text on your disk.
Read it before you decide, because it costs you unattended backups and it introduces a key you can lose.

[Manual borg and gpg use](./manual-borg-and-gpg.md) is the same job done by hand, one borg command at a time.
Read it if you want to know exactly what is being done on your behalf, or if you would rather not run someone else's shell script over your data at all.