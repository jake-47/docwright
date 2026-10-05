# Borg on airgapped

> - **For:** installing Borg on a machine that never touches a network.
> - **Before you start:** an online machine to download on, and a USB stick.
> - **Reading time:** about 2 minutes.
> - **You end with:** Borg installed and verified on the airgapped machine.

## Download

On the online machine, download the latest stable release from [borg's releases page](https://github.com/borgbackup/borg/releases). Take the release GitHub marks **Latest**, not a beta marked **Pre-release**. The version numbers below are from 1.4.5, the stable release at the time of writing; swap in whatever the current one is.

Download these two files:

```text
borg-linux-glibc231-x86_64.tgz          (~28 MB)
borg-linux-glibc231-x86_64.tgz.asc      (about 1 KB)
```

## Verify

```bash
mkdir -p ~/Downloads/borg && cd ~/Downloads/borg
gpg --recv-keys 9F88FB52FAF7B393
gpg --verify borg-linux-glibc231-x86_64.tgz.asc borg-linux-glibc231-x86_64.tgz
gpg --export --armor 6D5BEF9ADD2075805747B70F9F88FB52FAF7B393 > borg-signing-key.asc
```

Expected output, so nothing surprises you: gpg reports a `Signature made <date>` line and `using RSA key <a long id>`. That long key is **not** the one in the README, and that's fine: it's a signing subkey. The line to check is `Primary key fingerprint`, which must read `6D5B EF9A DD20 7580 5747 B70F 9F88 FB52 FAF7 B393`, matching what `00_README.txt` on the release page documents. You'll also get the usual `not certified with a trusted signature` warning.

Cross-check that primary fingerprint against the footer of any of Waldmann's [BorgBackup mailing list posts](https://mail.python.org/archives/list/borgbackup@python.org/thread/44SUJQEFUAJPV4YKSVLEGTWDYIS3VGT7/) before you continue.

## Install

If the key matches, copy all three files to the USB stick: the `.tgz`, the `.asc`, and `borg-signing-key.asc`.

On the airgapped machine, verify once more, so the copy that crossed the stick is the copy you checked. `cd` into the folder that holds the files, e.g. `cd /media/john/d1/borg/`, and run:

```bash
gpg --import borg-signing-key.asc
gpg --verify borg-linux-glibc231-x86_64.tgz.asc borg-linux-glibc231-x86_64.tgz
```

The `Primary key fingerprint` line must match the one you cross-checked online. Then install:

```bash
sudo tar -xzf borg-linux-glibc231-x86_64.tgz -C /opt
sudo ln -s /opt/borg-linux-glibc231-x86_64/borg.exe /usr/local/bin/borg
borg -V
```

`tar` prints nothing; `ls /opt` then shows one new directory named after the tarball, and the executable inside it really is called `borg.exe`, even on Linux. If your directory's name differs, point the `ln -s` at the one you got. `borg -V` should print `borg 1.4.5`, or whichever version you installed.