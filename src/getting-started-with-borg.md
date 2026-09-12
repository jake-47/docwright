# Getting started with Borg
<p class="mdb-subtitle">Learn the basics of Borg: install, backup, restore.</p>


## 1. Install Borg

> [!NOTE]
> **OS**: Borg runs on Mac and Linux, not Windows directly. Windows users, what are you still doing there? If you really cannot migrate away from Windows, you can run Borg through WSL (Windows Subsystem for Linux): install WSL, then follow the Linux steps below inside it.
>
> **Prerequisites**: You will need the terminal; if you've never used one before, see this [brief guide](./terminal-basics.md).
>
> **Video demo**: If you prefer first watching a demo on how Borg works, see the [official demo](https://asciinema.org/a/133292?autoplay=1&speed=1.8). It's old but good.

### On Debian Linux

```bash
sudo apt install borgbackup -y
```

### On macOS

Install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

When Homebrew finishes it prints a couple of lines starting with `eval` or `export` that tell you how to finish setup; copy those, paste them in, and press Enter. Then install Borg:

```bash
brew analytics off
brew install borgbackup
```

### On airgapped

To install on a Debian-based airgapped computer, see [this guide](./unlisted/borg-airgap.md).


## 2. Create the repo

Borg calls the backup folder a repository: an encrypted, compressed container that holds your data. You have to do this step only once per drive unless, of course, you lose or damage your drive.

### 2.1. Get the path to your drive

Plug in your external drive or USB stick, and find the path to it.

> [!NOTE]
> **On macOS**: It appears at `/Volumes/your-label`. > To read the exact path on a Mac, open the drive in Finder, press <kbd>Cmd + Opt + C</kbd> to copy it as a pathname, and paste it anywhere; you will see something like `/Volumes/your-usb-label`; e.g. `/Volumes/backup1`.
>
> **On Linux**: It usually appears at `/media/your-name/your-usb-label`; e.g. `/media/john/backup1/`.

> [!TIP]
> If you have no spare drive, you can still test Borg by using a folder on your system, say`~/Documents`. But note that the whole point of backing up to a drive is so that if your laptop fails or gets stolen, your backup is not lost with it.

### 2.2. Name and create the repo

Name the repo anything you like, and run the command to create the repo (after editing the path and repo name to match yours):

```bash
borg init --encryption=repokey /Volumes/backup1/borg
```

On Linux that path should look something like `/media/john/backup1/borg`. And if you are testing Borg on your system, then it should look something like `~/Documents/borg`.

### 2.3. Enter the passphrase twice

Pick a strong one. For tips on creating a secure passphrase, see [Creating passphrase](./creating-passphrase.md). When it asks whether to show the passphrase for verification, type `n`.

> [!CAUTION]
> Write this passphrase on paper and keep it somewhere away from the laptop. If you lose both the passphrase and the key, your backups are gone for good, with no reset.

That's it. That's the whole one time setup with Borg. From here on, unless you lose your drive, it's just one command per drive to backup (well two if you count 'cd' into your); and two, to restore. If you level up and start using scripts, then it's one command to backup to all your drives; and one command to restore from any one of them. See [Levelling up](./leveling-up-1.md) details.

If you keep a second drive labelled `backup2`, set it up and backup the same way (`borg init --encryption=repokey /Volumes/backup2/borg`); just change `backup1` to `backup2` in the path.

## 3. Back up

> [!NOTE]
> From here, every command below uses `/Volumes/backup1/borg`; replace it with your own path.

Using the terminal, navigate to the folder that contains the folder you want to back up. Say the folder you want to backup is `mystuff` and it lives in your Documents folder, run:

```bash
cd ~/Documents
borg create -s /Volumes/backup1/borg::{now} ~/Documents/./mystuff
```

Congratulations. You've successfully backed up your folder to your borg repo. You should see something like this.

![alt text](attachments/borg-create.png)

<aside>

If you don't add the slashdot `/./` before the folder you are backing, but run `create` with `~/Documents/mystuff`, Borg backs up the whole path such that then when you extract you get the whole tree `home/<user>/Documents/mystuff`. While if you use the slashdot hack, or even `cd` to the parent, then extract gives you just the folder you backed up.

`{now}` names this backup with the date and time you make the backup, so each backup stays separate. If you would rather name it yourself, swap `{now}` for anything; e.g. `::archive`. Borg requires archive names within the same repository to be unique.  If you try to create a new archive with an existing name, Borg will fail with an error similar to: `Archive already exists: <archive-name>`. This is by design because each archive is an immutable snapshot. A common practice used by those who back up more than one machine use `::{hostname}-{now}` so each machine's backups are labelled and sort together; for one folder on one machine, `{now}` is all you need.

`-s` stands for stats, shown in the image above.
You may remove that if you don't care about it.

The first backup copies everything, so it takes a while: roughly two to three minutes for 10 GB to a fast external drive, and longer, ten minutes or more, to a cheap USB stick. After that Borg remembers what it already saved and only adds what changed, so every backup after the first is usually done in seconds to a minute.

</aside>


> [!TIP]
> If you do not use the terminal a lot, the next time you want to make a backup, you do not have to retype the command: plug in the drive, wait for it to mount, open the terminal, press the up arrow until you see the `borg create` line appears, and press <kbd>Enter</kbd>.

> [!IMPORTANT]
> Back up after every change you care about. You could also back up on a schedule you will actually keep, once a day or once a week, but definitely before you switch or wipe a laptop.
>
> Keep one of your drives somewhere else: at work, with family, or in a safe.
Two drives in the same drawer both die in the same fire or theft; the one stored elsewhere is the one that saves you.

## 4. Restore


### 4.1. Select archive

First get the list of archives. From anywhere on the terminal, run the command:

```bash
borg list /Volumes/backup1/borg
```

This produces a list of every backup you have made, with the latest at the bottom. If you used {now} as your archive name, each line starts with a timestamp like `2026-05-09T19:15:31`. Usually only the latest archive is of concern; older ones matter only if the latest is damaged.

![alt text](attachments/borg-list.png)

Copy the archive name (which in this case is the timestamp) of the backup you want from the list.

### 4.2. Extract

Navigate to wherever you want to extract your backup; e.g. `Downloads`. Then paste your timestamp in place of the one shown:

```bash
cd ~/Downloads
borg extract --progress /Volumes/backup1/borg::2026-05-09T19:15:31
```

You should see your folder extracted to the extract location. Congratulations. And that's how easy it is to use Borg.

> [!TIP]
> If you want to extract just one file or folder from the archive, instead of extracting the whole archive, extract only the file using `borg extract repo::archive-name path/to/file`; for example `borg extract --progress /Volumes/backup1/borg::2026-05-09T19:15:31 test-file.md`.

## 5. Verify extracts

You've learnt how to make a backup and restore it, all good, but that's not the same as being sure of what the archive holds rather than what you think it holds. Borg will not tell you that. A mistyped path, a folder you meant to include and did not, an exclude that caught more than you intended: each of those produces a clean backup but is quietly missing things. There is no warning, because from Borg's side nothing went wrong.

So before you delete anything, or start relying on this, spend a few minutes checking. Do it straight after making an archive and extracting, while the source has not changed underneath you. Open the last saved file, and check if the contents are present.

If you have a spare or second machine, restore the backup there; or use a fresh user account, with nothing but the drive and the passphrase. That is the situation you are trying to guard yourself against, yet that is where many find out that the only copy of the passphrase they had was on the machine that died. So don't skip this step. Test it at least once while nothing is wrong, so you're confident of restoring from backup on a new system.
