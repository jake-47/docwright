# Borg on airgapped

## Download

On the online machine, download the latest stable release from here: https://github.com/borgbackup/borg/releases#release-1.4.5

Note that this will change soon, so check with your AI which is the latest stable release. Current stable is 1.4.5 (2.0.0b24 is the newest overall but it's a beta).

Download these two files; ensure your downloading the stable release, currently, 1.4.5:

```
borg-linux-glibc231-x86_64.tgz          (~28 MB)
borg-linux-glibc231-x86_64.tgz.asc      (898 bytes)
```

## Verify

```
mkdir -p ~/Downloads/borg && cd ~/Downloads/borg
gpg --recv-keys 9F88FB52FAF7B393
gpg --verify borg-linux-glibc231-x86_64.tgz.asc borg-linux-glibc231-x86_64.tgz
gpg --export --armor 6D5BEF9ADD2075805747B70F9F88FB52FAF7B393 > borg-signing-key.asc
```

Expected output, so nothing surprises you: gpg reports `Signature made Fri Jul 31 09:38:42 2026 UTC` and `using RSA key 2F81AFFBAB04E11FE8EE65D4243ACFA951F78E01`. That long key is **not** the one in the README, and that's fine — it's a signing subkey. The line to check is `Primary key fingerprint`, which must read `6D5B EF9A DD20 7580 5747 B70F 9F88 FB52 FAF7 B393`, matching what `00_README.txt` on the release page documents. You'll also get the usual `not certified with a trusted signature` warning.

Cross-check that primary fingerprint against the footer of any of Waldmann's[ BorgBackup mailing list posts](https://mail.python.org/archives/list/borgbackup@python.org/thread/44SUJQEFUAJPV4YKSVLEGTWDYIS3VGT7/) before you continue.

## Install

If the key matches, then transfer the `.tgz` file to the airgapped machine.

And on the airgapped machine, `cd` into the folder which contains the borg file, e.g., `cd /media/d1/borg/`, and run:

```
sudo tar -xzf borg-linux-glibc231-x86_64.tgz -C /opt
sudo ln -s /opt/borg-dir/borg.exe /usr/local/bin/borg
borg -V
```

That should install and prints `borg 1.4.5` or whatever the latest stable version you installed.