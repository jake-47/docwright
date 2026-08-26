# Leveling up: Part 2, v5

*[Part 1](./leveling-up-1.md) left you with working backups and one weak point: the passphrases to every repo are sitting in a readable file in your home directory.*
*This part encrypts that file with GPG.*

*Read the last two sections before you start.*
*This rung costs you unattended backups, and it hands you a key that you can lose in a way that destroys every backup you own.*
*It is worth doing anyway, for most people, most of the time.*

*[Doing this without the script](#doing-this-without-the-script), near the end, is the same arrangement in plain gpg and borg commands.*

## What you are actually fixing

In Part 1, `~/.borg-pass` is protected by exactly one thing: its file permissions.

That is enough to stop another ordinary user on the same machine.
It is not enough for anything else.
Anyone with root can read it.
An unencrypted backup of your home directory contains it in the clear.
A laptop that is stolen while running, or with an unencrypted disk, gives it up.
And the file is the whole game: it holds every repo's passphrase, so it opens every archive on every drive at once.

Encrypting it moves the secret from "protected by a permission bit" to "protected by a key that lives somewhere else."

It does not protect you from a machine that is compromised while you are using it.
When you run a backup, the file is decrypted, in memory, on that machine.
Nothing in this part changes that, and no arrangement of files can.

## What GPG is, in one paragraph

GPG gives you a key pair.
The public key encrypts, the private key decrypts, and only the private key can undo what the public key did.
The private key is itself protected by a passphrase, which you type.
A background program, the GPG agent, remembers that passphrase for a while so you are not retyping it every few seconds.

So after this part you have two layers.
The borg passphrases are encrypted to your GPG key, and your GPG key is protected by its own passphrase.
That second passphrase is the one thing you must never lose and must never write into the backups.

## What changes in the tool: nothing

This is the good news, and it is why this part is short.

The tool does not decide what kind of passphrase file it has from the filename.
It reads the file.
A file whose lines start with `set_pass` is plain text.
A file that begins with `-----BEGIN PGP MESSAGE-----`, or that contains bytes that are not printable text, is treated as GPG-encrypted and decrypted before use.

So you encrypt the file where it already sits.
`PASSPHRASE_PATH` does not change.
`~/.borg-config` does not change.
No command changes.
The next `backup` run notices the file is now ciphertext and asks GPG to open it.

You may rename it to something like `~/.borg-pass.gpg` if you find that clearer, and if you do, update `PASSPHRASE_PATH` to match.
The tool does not care either way.

## Doing it

### Step 1 — install gpg and make a key

```console
sudo apt install gnupg
```

The `backup` script installs borg for you but not gpg, so this one is yours to run.

If you do not already have a key:

```console
gpg --full-generate-key
```

Take the defaults, use a real email address as the identity, and give it a long passphrase.
Then find its identifier:

```console
gpg --list-secret-keys --keyid-format=long
```

### Step 2 — get the private key out of the machine, first

Do this before you encrypt anything.
The order matters, because after step 3 the key is the only route to your backups.

```console
gpg --export-secret-keys --armor you@example.com > secret-key.asc
gpg --export --armor you@example.com > public-key.asc
gpg --gen-revoke you@example.com > revoke.asc
```

Export the public key as well as the secret one.
It is not sensitive, and you need it to rebuild from paper.

Put both on a USB stick that is not one of your backup drives, and keep it somewhere physically separate.
Consider a paper copy as well:

```console
sudo apt install paperkey
gpg --export-secret-keys you@example.com | paperkey --output secret-key-paper.txt
```

`paperkey` strips out everything reconstructible from the public key, leaving a much smaller amount to print.
The output is a hex dump with line numbers and a checksum on each line, so it can be typed back in and will tell you which line you got wrong.
A printed key in a drawer survives things a USB stick does not.

Rebuilding later needs the printout and the public key together:

```console
paperkey --pubring public-key.asc --secrets secret-key-paper.txt --output secret-key.asc
```

Two things a paper copy does not do.
It does not remove the passphrase, so if the secret key was protected by one the rebuilt key is too; paper rescues you from a dead disk, not from a forgotten passphrase.
And it is not self-contained, so store `public-key.asc` with the printout or there is nothing to rebuild against.

Then delete `secret-key.asc` from your disk once it is safely elsewhere.

### Step 3 — encrypt the passphrase file in place

```console
gpg --encrypt --recipient you@example.com --output ~/.borg-pass.new ~/.borg-pass
chmod 600 ~/.borg-pass.new
```

Check that it actually decrypts before you throw the original away:

```console
gpg --decrypt ~/.borg-pass.new
```

You should see your `set_pass` lines.
If you do, swap the files in:

```console
mv ~/.borg-pass.new ~/.borg-pass
```

Confirm the whole thing still works end to end:

```console
backup check
```

If that verifies your repos, the tool decrypted the file and used the passphrases.

### Step 4 — get rid of the plain text copy

The original is gone from that path, but it may still exist elsewhere.
Check your editor's backup files, your Downloads folder, and any place you copied it while following Part 1.

More importantly, the plaintext version is already inside your existing archives.
Every backup you took during Part 1 contains it.
That is not fixable by deleting a file; those archives are what they are.
If it matters to you, take the view that the old archives are as sensitive as the old file was, and let retention age them out.

## What it costs you

**Cron becomes unreliable.**
An unattended run needs the GPG agent already primed with your key passphrase, and an agent's cache expires.
A backup that fires at 20:30 on a machine you have not touched since morning will find no primed agent and fail, or hang waiting for a prompt that nobody will answer.
This is why the cron section lives in Part 1 and not here.
If you want both, keep the plain text file and rely on full-disk encryption instead; that is a legitimate choice, not a lesser one.

**Every borg call reopens the file.**
This surprises people, so it is worth being exact.
The tool never holds your passphrases in its own long-running process.
It hands borg a command to fetch a passphrase, and borg runs that command fresh for each borg operation that needs the key.
One repo on one drive involves an archive, then a prune if you set retention, then a verification pass, and each of those is a separate borg process that fetches the passphrase again.
Add one more at the start of every run, when the tool works out which repos have a stored passphrase at all.

With the agent holding your key passphrase, you will not notice; each decryption is silent.
With a hardware token that requires a physical touch per operation, you will notice a great deal, because it is one touch per decryption rather than one per run.

**One more thing to install on a new machine.**
Recovery now needs gpg present and your private key imported before the passphrase file is of any use.

## The danger, stated plainly

If you lose the GPG private key, or forget its passphrase, the passphrase file cannot be opened.
If the passphrase file cannot be opened, the borg repos cannot be opened.
If the borg repos cannot be opened, every backup you have is a directory of random-looking data, permanently.

There is no recovery, no reset, and nobody to appeal to.
This is not a flaw in the design; it is what encryption is.

Three rules follow from that, and none of them is optional.

**The private key must exist outside the backups.**
If your only copy of the key is inside an encrypted repo, you have built a lock whose key is inside the box.
The repo needs a passphrase, the passphrase is encrypted to the key, the key is in the repo.
Keep the export and the paper copy on separate media, in a separate place.
Note that neither covers a forgotten passphrase: both rebuild a key that is still protected by it.

**At least one repo's passphrase must be recoverable without any of this.**
Written down, in a safe, in a password manager on your phone, on paper in an envelope, whatever suits you.
On a dead machine you restore that one repo by pointing borg at it directly and typing the passphrase, which gets your config and passphrase file back, and everything else follows.
Without that, a lost GPG key is total.

**Test the recovery, once, on purpose.**
Import your key onto a different machine or a fresh user account, copy a drive's repo over, and restore something.
An untested recovery is a belief, not a backup.

## Rotating a passphrase after this

`backup pass-change <repo>` still works exactly as before.

It changes the repo's passphrase on every drive, then rewrites the passphrase file.
When that file is encrypted it re-encrypts to the same recipients the file already had, checks that the result decrypts before replacing anything, and leaves the original in place if that check fails.
So a failed re-encryption cannot destroy a good file.

If the tool cannot work out who the file was encrypted to, it stops and tells you to re-encrypt by hand rather than guess.

## Doing this without the script

The script's only role here is reading the encrypted file for you.
Everything in this part is gpg, and you can keep the same arrangement without it.

**Keep the passphrases wherever you like and hand one to borg by hand.**
The simplest version has no file at all: let borg prompt.

```console
export BORG_REPO=/media/john/d1/documents
borg create "::{now}" /home/john/./Documents
```

Borg asks, you type, nothing is stored.
This is the most secure arrangement there is, and the least convenient.

**Or keep one encrypted file and feed it to borg without the script.**
Borg takes a command to run whenever it needs a passphrase:

```console
export BORG_REPO=/media/john/d1/documents
export BORG_PASSCOMMAND="gpg --quiet --decrypt /home/john/.borg-documents.gpg"
borg create "::{now}" /home/john/./Documents
```

Where that file holds nothing but the one repo's passphrase, encrypted:

```console
printf '%s' 'the passphrase' | gpg --encrypt --recipient you@example.com \
    --output ~/.borg-documents.gpg
chmod 600 ~/.borg-documents.gpg
```

One file per repo, rather than one file holding them all.
That is more files but a smaller blast radius, and it removes the parsing step entirely.
Note the two rules the script enforces and you now have to keep yourself: the file must be readable by you alone, and the path in `BORG_PASSCOMMAND` must have no spaces, quotes or backslashes, because borg splits that string without a shell.

**Never do this instead.**

```console
export BORG_PASSPHRASE='the passphrase'
```

It reaches borg, and it also reaches your shell history, anything that dumps your environment, and every process running as you through `/proc`.
`BORG_PASSCOMMAND` exists so you do not have to.

**Rotate a passphrase by hand.**

```console
BORG_REPO=/media/john/d1/documents borg key change-passphrase
BORG_REPO=/media/john/d2/documents borg key change-passphrase
```

One call per drive, because every copy has its own key file, and then re-encrypt whatever file holds it.
A rotation that reaches three drives out of four leaves the fourth on the old passphrase with nothing to tell you.

**Re-encrypt the combined file after an edit.**

```console
gpg --decrypt ~/.borg-pass > /dev/shm/pass.tmp
# edit /dev/shm/pass.tmp
gpg --encrypt --recipient you@example.com --output ~/.borg-pass.new /dev/shm/pass.tmp
gpg --decrypt ~/.borg-pass.new                 # confirm it opens before you swap
mv ~/.borg-pass.new ~/.borg-pass
shred -u /dev/shm/pass.tmp
```

Decrypt to `/dev/shm`, which is memory rather than disk, and check the new file decrypts before replacing the old one.
Those two habits are what the script's rotation does for you, and they are the two that people skip.

## When something looks wrong

`could not read passphrases from <file> (for a .gpg: can gpg decrypt it now ...)`
The agent is not primed, the key is not present, or the file is not what you think it is.
Test it directly with `gpg --decrypt <file>`.

`refusing to archive: <file> is present but unreadable, so every repo would be silently skipped`
The right behaviour, and worth understanding.
Rather than treat an undecryptable file as "no passphrases stored" and quietly back up nothing, the run stops.

`cannot read the GPG recipients of <file> to re-encrypt it`
A rotation got as far as the drives but could not rewrite the passphrase file.
The drives are on the new passphrase and the file is not, so fix the file by hand before the next run, using the message the tool printed.

Prompts that never appear under cron.
See the cost section above.
This is expected, not a bug.

## Where to go next

[Manual borg and gpg use](./manual-borg-and-gpg.md) drops the script entirely and shows you every command underneath, borg and GPG alike, in more depth than the section above.

`borg-super-simple` is a much shorter script that reads the same config and the same passphrase file, GPG or plain, and decides which from the file's own bytes rather than its name.
It backs up every repo and extracts one repo from one drive, and nothing else.
Keep it for the day the main script will not run.

The [reference](./borg-reference.md) covers the borg versions the tool accepts, how a passphrase reaches borg without touching a command line, and the parts these three guides do not need.