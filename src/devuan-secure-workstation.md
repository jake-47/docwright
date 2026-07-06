# Devuan Secure Workstation

A complete install-plus-hardening procedure for a single-user Devuan workstation with full-disk encryption. Covers everything from the USB stick to a hardened daily driver. Written for someone who already chose Devuan per the OS guide and wants the secure default rather than the default default.

The companion executable `devuan-luks2-install.sh` performs the partitioning, LUKS setup, debootstrap, and base configuration. This document explains what that script does, what to do before running it, and the post-install steps the script deliberately does not perform.

---

## TL;DR

The script gets you a working LUKS-LVM Devuan install with a single passphrase prompt at boot. After first login you do this, in order:

1. Back up the LUKS header off the disk before anything else.
2. Set a GRUB superuser password.
3. Set a firmware (BIOS/UEFI) supervisor password.
4. Set up off-machine encrypted backups with Borg, before adding any data you care about.
5. Install CPU microcode for your vendor.
6. Update vendor firmware (BIOS, Thunderbolt, NVMe) via `fwupd` where available.
7. Set up unattended security-only updates.
8. Apply kernel hardening sysctls and boot parameters.
9. Install and enable AppArmor profiles.
10. Set up MAC address randomization for WiFi and Ethernet.
11. Switch to encrypted DNS via dnscrypt-proxy.
12. Install USBGuard with a whitelist of your existing devices.
13. Authorize Thunderbolt devices explicitly via `boltctl` and tighten IOMMU settings (if your hardware has Thunderbolt).
14. Set up a default-deny host firewall with nftables.
15. (Optional, breaks things) Enable kernel lockdown mode.

Items 1 through 14 are mandatory for any threat model that includes a stolen laptop or a network you don't fully control. Item 15 trades capability for reduction in post-compromise damage; enable it only if you understand what it costs.

---

## What this produces

A Devuan workstation with the following properties when complete:

- Full-disk encryption with a single passphrase prompt before GRUB
- Encrypted swap (the swap LV sits inside the LUKS container)
- Encrypted `/tmp` and `/home` (likewise inside LUKS) plus tmpfs `/tmp` for runtime
- No systemd (sysvinit, OpenRC, or runit as the init system; default sysvinit)
- A signed bootloader chain you can verify against the LUKS header backup
- AppArmor mandatory access control on top of standard Unix permissions
- Kernel hardened against the common local-privilege-escalation paths
- Off-machine encrypted backups via Borg
- Encrypted DNS resolution
- MAC randomization on network interfaces
- USB device whitelist enforcement
- Thunderbolt devices require explicit authorization on first connect (where applicable)
- Off-machine alerts on host-integrity changes (see the companion HIDS guide)

What this is not. Not a Tor-routed system by default (use Tails or Whonix for that — Part 4.5 covers the Whonix-on-this-workstation option). Not amnesic (use Tails). Not the maximalist VM compartmentalization model (use Qubes for that). Not signed-boot-enforced from firmware (Secure Boot is off; see the trade-off in the next section). The threat model assumes a competent attacker with physical access to a powered-off laptop, network-level observers, and ordinary malware — not a nation-state with hardware implants.

---

## Architectural costs

Three deliberate choices the install makes against the most-paranoid alternative, so you know what you're trading.

**LUKS2 with PBKDF2, not Argon2id.** Argon2id is the modern key derivation function (memory-hard, side-channel-resistant). PBKDF2 is older and weaker against GPU attacks. The install uses PBKDF2 because GRUB's LUKS2 support does not yet handle Argon2id; if you format with Argon2id, GRUB cannot read `/boot` and the system does not boot. Two ways out: put `/boot` on a separate USB stick that you don't unlock via GRUB (covered in Part 4.2, full Argon2id becomes possible), or accept PBKDF2 with a long, high-entropy passphrase. The script picks the second, with PBKDF2 hardened by `LUKS_ITER_TIME=5000` (default) — five seconds of derivation per guess, ~2.5× the cryptsetup default. This is the strongest PBKDF2 setting that doesn't pessimize boot.

This constraint has an expiry date. GRUB 2.14, released 13 January 2026, adds native Argon2 KDF support. Devuan Excalibur (and Debian Trixie behind it) ships GRUB 2.12 and will keep PBKDF2 for the lifetime of this release. The next Devuan stable (Freia, based on Debian Forky, no fixed release date yet) is expected to ship GRUB 2.14 or later, at which point the PBKDF2 workaround stops being necessary and a re-encrypt to Argon2id (`cryptsetup luksConvertKey --pbkdf argon2id`) becomes the cleanup task.

**Secure Boot off.** Devuan does not ship signed shim/grub binaries for Secure Boot the way Ubuntu and Fedora do. Leaving Secure Boot on would mean either signing your own bootloader chain (real work, breaks on every kernel update unless automated) or running an unsigned bootloader that Secure Boot then refuses. The script assumes Secure Boot is off. The cost: a sufficiently determined evil-maid attacker can install a malicious bootloader. Mitigations covered in Part 4.

**No TPM-sealed unlock by default.** A TPM2-sealed LUKS key with PCR binding gives unlock-without-typing-the-passphrase, with the unlock conditional on the firmware and bootloader being unmodified. It's a real security improvement but it interacts badly with firmware updates and kernel updates, and the recovery path is harder. The default install uses passphrase prompt. TPM2-sealed unlock is covered as an optional upgrade in Part 4.1.

GRUB 2.14 also adds a native TPM2 key protector. On the current Excalibur GRUB 2.12, the TPM2 enrollment path is `clevis-luks-bind` plus `clevis-tpm2` (Part 4.1). Once Devuan Freia ships GRUB 2.14, native TPM2 unlock at the bootloader level becomes the cleaner path and clevis-on-Devuan becomes the legacy approach.

### What's outside encryption

Exactly one partition: the EFI System Partition (ESP), `/dev/<disk>1`, 1 GiB, FAT32, mounted at `/boot/efi`. Everything else — the kernel, the initramfs, `/boot` proper, `/`, `/home`, swap — sits inside the LUKS2 container on `/dev/<disk>2`. The LUKS header (the first ~16 MiB of `<disk>2`) is also on disk but is encrypted-metadata, not plaintext.

The ESP cannot be encrypted in this architecture because UEFI firmware needs to read it before any decryption could happen. This is the structural reason "evil maid" is the residual threat — an attacker with physical access to a powered-off machine can modify `grubx64.efi` on the ESP to inject a passphrase-capturing payload, and your next boot types the LUKS passphrase straight into their malware. Secure Boot would defend against this by refusing to load a tampered grubx64.efi, but Devuan ships unsigned GRUB so Secure Boot is off, so this defense is unavailable in the stock setup.

The genuinely strongest configurations for "nothing sensitive in cleartext on the laptop's internal storage":

| Path | What lives in cleartext on the laptop | Evil-maid surface |
|---|---|---|
| Default install (this doc, Parts 1–3) | ESP with grubx64.efi on the internal disk | Modify grubx64.efi on the internal ESP |
| /boot on separate USB (Part 4.2) | Nothing on the internal disk | Modify grubx64.efi on the USB you carry |
| Heads / coreboot (Part 4.3) | A measured open firmware in the SPI flash chip | Open laptop, clip onto SPI flash with specialized hardware |

Genuine "everything inside encryption including the ESP" is impossible because something has to boot first. The closest practical answer for "nothing sensitive in cleartext on the laptop's internal storage" is `/boot` on a separate USB key (Part 4.2); the closest answer for "even the firmware loading the bootloader is integrity-protected" is Heads/coreboot (Part 4.3). The Knots-lens / cold-storage operator practice converges on running one or both.

A note on the script's GRUB install behavior. The script writes the bootloader to `/EFI/devuan/grubx64.efi` and creates an NVRAM boot entry pointing at it. With `INSTALL_REMOVABLE_PATH=true` it also writes `/EFI/BOOT/BOOTX64.EFI` (firmware fallback path), which adds reliability (NVRAM-clear by firmware update or motherboard battery failure still boots) at the cost of one more ESP file an attacker with physical access could swap. Default is `false` for minimum attack surface. The reliability cost is asymmetric: if NVRAM gets cleared without the fallback, you boot from the install USB and run `grub-install` again, ~5 minutes' work. The attack-surface cost is permanent until the file is removed. Set the toggle to `true` only when your firmware is known to ignore NVRAM (some older Macs, some buggy UEFI), or when the disk needs to boot on multiple machines.

---

## Order of operations

This document is structured so that you can read it once, top to bottom, on a fresh install. The order matters: later parts assume the earlier parts are done. If you skip ahead, check the section preamble for prerequisites.

Part 1: Install. Pre-install preparation, then run `devuan-luks2-install.sh`.

Part 2: First-boot essentials. Three things you must do before anything else (LUKS header backup, GRUB password, /tmp tightening that the install script already configured but you should verify).

Part 3: Runtime hardening, in priority order. Each part is independently applicable.

Part 4: Architectural upgrades. Optional, more disruptive, do these last.

Part 5: Recovery from failed boot. Reference material for when something breaks.

---

# Part 1: Install

## 1.1 What you need before running the script

- A target machine that boots UEFI (the script refuses non-UEFI). Disable Secure Boot in firmware setup before booting the installer.
- A spare USB stick of at least 4 GB to write the Devuan installer to.
- A second USB stick of at least 1 GB for the LUKS header backup (Part 2.1). Can be smaller; a 1 GB stick is just what you'll find lying around.
- A passphrase plan. The LUKS passphrase needs to be long and memorable and you must not lose it. See the Encryption Tools companion guide for guidance on passphrase construction and backup.

## 1.2 Downloading and verifying the installer ISO

Get the Devuan netinst ISO from `https://www.devuan.org/os/download` for the current stable release. As of this writing that's Excalibur 6.1 (point release dated 2 January 2026), based on Debian Trixie, shipping Linux 6.12 LTS, cryptsetup 2.7.x, and GRUB 2.12. Devuan publishes SHA256SUMS and SHA256SUMS.asc alongside the ISO. Verify both.

```bash
sha256sum -c SHA256SUMS --ignore-missing
gpg --verify SHA256SUMS.asc SHA256SUMS
```

If gpg complains it doesn't know the signing key, fetch it from the Devuan keyring page (linked from the download page) and verify the key fingerprint against multiple independent sources before trusting it. The fingerprint of the Devuan release key has been stable; cross-check it against the project's official channels (devuan.org, the Devuan announce mailing list archive, the dev1galaxy forum) rather than a single source.

Write the ISO to USB:

```bash
sudo dd if=devuan_excalibur_amd64_netinst.iso of=/dev/sdX bs=4M status=progress conv=fsync
```

Replace `sdX` with the actual device. Get this wrong and you overwrite a different disk. `lsblk` before, `lsblk` after.

## 1.3 Boot the installer in live mode

Boot the target machine from the USB stick. At the Devuan installer menu, choose "Live with Xfce" (or another live option). You want to get to a shell, not run the graphical installer; the script handles partitioning and base install in one pass without the installer's interactive prompts.

Once at the desktop, open a terminal. The user is `devuan` with sudo. Confirm internet works (`ping -c 2 deb.devuan.org`) and that you booted in UEFI mode:

```bash
ls /sys/firmware/efi
```

The directory should exist. If it doesn't, reboot into firmware setup and switch to UEFI mode.

## 1.4 Get the install script onto the live system

Copy `devuan-luks2-install.sh` from wherever you keep it. Easiest path: keep it on a separate USB stick or pull it from a git remote you trust.

```bash
chmod +x devuan-luks2-install.sh
```

## 1.5 Edit the configuration block at the top

Open the script. The first 40 lines are the configuration block. The fields you must set:

- `DISK_NAME` — the device name without `/dev/` prefix (e.g. `sda`, `nvme0n1`). Get this from `lsblk`; pick the disk you want to wipe.
- `HOSTNAME` — what the machine calls itself.
- `USERNAME` — your unprivileged login.

The fields you should consider:

- `LOCALE`, `TIMEZONE`, `KEYMAP` — default to US English / UTC / US keyboard.
- `SWAP_SIZE` — default 4G. Set to `""` to skip swap entirely (acceptable on 16GB+ RAM machines). For hibernation, swap needs to be at least the size of RAM; this is incompatible with the kernel lockdown step in Part 3.12, pick one.
- `ROOT_SIZE` — default 40G. The script puts everything except `/boot` and `/home` on the root LV; 40G is comfortable for a workstation with most data in `/home`.
- `LUKS_PBKDF` — default `pbkdf2`. The KDF used to derive the LUKS master key from your passphrase. Stays at `pbkdf2` until either Devuan ships GRUB 2.14 (which adds native Argon2 support) or you move `/boot` to a separate USB key (Part 4.2). Setting to `argon2id` on an internal-disk `/boot` will produce an unbootable system.
- `LUKS_ITER_TIME` — default `5000` (milliseconds). Target derivation time per passphrase guess. Raises offline-attack cost by ~2.5× over the cryptsetup default of 2 seconds, at the cost of ~3 extra seconds per boot. The maximum hardening PBKDF2 allows without pessimizing boot.
- `INSTALL_REMOVABLE_PATH` — default `false`. When `false`, GRUB installs only at `/EFI/devuan/` via an NVRAM entry — one bootloader file on the ESP, minimum attack surface. Set to `true` only if your firmware ignores NVRAM (some older Macs, some buggy UEFI) or if the disk needs to boot on multiple machines.
- `DEVUAN_SUITE` — default `excalibur`. Use the current stable codename.
- `INIT_SYSTEM` — default `sysvinit-core`. Alternatives `openrc` or `runit-init`. Pick sysvinit unless you have a specific reason to prefer otherwise.
- `DESKTOP` — default `xfce`. Alternatives `mate`, `lxqt`, `kde`, `cinnamon`, or empty for headless. XFCE is the default for resource use and stability.

The fields you should leave blank to be prompted for:

- `LUKS_PASSPHRASE` — leave blank. The script will prompt and not echo, which keeps the passphrase out of script history and out of any shoulder-surfer's view.
- `USER_PASSWORD` — same.
- `ROOT_PASSWORD` — default `LOCK`. This locks the root account, forcing all privileged operations through sudo (which leaves audit trail and respects PAM). Change to a real password only if you have a reason.

## 1.6 Run the script

```bash
sudo ./devuan-luks2-install.sh
```

The script asks for confirmation before wiping the disk. Type `YES` (literal, uppercase) to proceed. It then:

1. Wipes the disk, creates a GPT partition table, makes a 1 GB EFI System Partition and a LUKS partition spanning the rest.
2. Formats the LUKS partition with LUKS2, using `LUKS_PBKDF` (default `pbkdf2`) at `LUKS_ITER_TIME` milliseconds (default `5000`), AES-XTS-256.
3. Creates an LVM volume group inside LUKS containing logical volumes for /boot, swap, /, and /home.
4. Formats those as ext4 and swap.
5. Mounts everything and runs debootstrap to install Devuan base.
6. Configures `/etc/fstab` (note: tmpfs `/tmp` with nosuid,nodev,size=50% is set here), `/etc/crypttab`, hostname, hosts, apt sources, network interfaces.
7. Generates a random keyfile, adds it as a second LUKS key, embeds it in the initramfs, configures cryptsetup to use it. This is what makes the boot prompt the passphrase exactly once at the GRUB stage, with the keyfile unlocking everything else.
8. Installs kernel, firmware, microcode (Intel and AMD packages both, the right one runs), GRUB EFI, ifupdown, sudo, the chosen init system, and the chosen desktop.
9. Configures GRUB with `GRUB_ENABLE_CRYPTODISK=y` and installs to the `devuan` NVRAM entry. If `INSTALL_REMOVABLE_PATH=true`, also installs to the firmware fallback path (`/EFI/BOOT/BOOTX64.EFI`).
10. Verifies the initramfs contains the keyfile (catches a common mis-configuration that would prompt twice for the passphrase).
11. Creates the user, sets passwords, locks root if you chose `LOCK`.

The whole thing typically takes 10-30 minutes depending on disk and network.

## 1.7 First boot

Reboot, remove the USB stick. GRUB starts, prompts for the LUKS passphrase, decrypts /boot, loads the kernel and initramfs, initramfs uses the embedded keyfile to unlock the same LUKS container without re-prompting, init takes over, you reach the login screen. Single passphrase prompt total.

Log in as your user. You now have a working Devuan install. The hardening starts here.

---

# Part 2: First-boot essentials

Three things to do before anything else.

## 2.1 LUKS header backup

The LUKS header sits in the first few megabytes of the encrypted partition. It contains the encryption parameters and the key slots that hold copies of the master key encrypted under each passphrase. Corrupt those few megabytes (one bad write, one filesystem bug, one stray `dd` to the wrong device) and the entire disk is unrecoverable even with the correct passphrase. The header backup is the single most important file you can keep about this machine.

Identify the LUKS partition. It's `/dev/<disk>2` or `/dev/<disk>p2` depending on whether the disk uses `p` partition naming:

```bash
sudo cryptsetup luksDump /dev/nvme0n1p2 | head -5
```

If that reports a LUKS2 header, that's the right device.

Plug in the spare USB stick you set aside in Part 1.1. Identify its partition with `lsblk`. Mount it. Then:

```bash
sudo cryptsetup luksHeaderBackup /dev/nvme0n1p2 \
    --header-backup-file ~/luks-header.bin
```

Encrypt the backup before it leaves the machine. The Knots-lens / cold-storage operator choice here is GPG symmetric encryption rather than age. GPG (OpenPGP) is older, has a formal RFC, has multiple independent implementations, has been battle-tested for thirty years, and the format will still be readable in 2050. age is well-designed but is a single-developer Go project (Filippo Valsorda, 2019) with no formal audit and a comparatively short track record. For a file you need to be able to decrypt twenty years from now from a recovery USB, GPG wins on the durability axis.

```bash
gpg --symmetric --cipher-algo AES256 \
    --s2k-mode 3 --s2k-count 65011712 --s2k-digest-algo SHA512 \
    -o ~/luks-header.bin.gpg ~/luks-header.bin
shred -u ~/luks-header.bin
```

The flags pick AES-256 and the strongest available S2K (string-to-key) parameters: SHA-512 hashing with a 65-million-iteration count, which makes the passphrase-to-key derivation deliberately slow. GPG prompts for a passphrase. Use a different passphrase than the LUKS passphrase. Store this passphrase on paper, in a different physical location than the USB stick. The threat model: if both the laptop and the USB stick are stolen together, the attacker has the encrypted header but not the passphrase to decrypt either.

Copy `~/luks-header.bin.gpg` to the USB stick. Then to a second USB stick. Then to a third location (encrypted off-site backup, trusted family member's house, safe-deposit box). Three copies in three locations is the minimum.

Verify each copy decrypts:

```bash
gpg -d ~/luks-header.bin.gpg > /tmp/test-header.bin
cmp /tmp/test-header.bin <(sudo cryptsetup luksHeaderBackup /dev/nvme0n1p2 --header-backup-file /dev/stdout)
shred -u /tmp/test-header.bin
```

The `cmp` should report no output (the files are identical). If it doesn't, the backup is bad and you need to redo it.

The age alternative remains valid for users who prefer simpler tooling and accept the durability tradeoff: `age -p -o ~/luks-header.bin.age ~/luks-header.bin` produces a working encrypted backup that age 1.x and forward will read. For maximum long-term durability, GPG symmetric is the safer default.

After every passphrase change (Appendix A), redo the header backup. The old backup will not unlock the new passphrase; if you forget the new passphrase and your only header backup is from before the change, you've trapped yourself with the old passphrase that no longer works.

## 2.2 GRUB superuser password

GRUB without a superuser password lets anyone who reaches the GRUB menu edit the kernel command line, add `init=/bin/bash`, and boot into a root shell. That root shell runs against your decrypted root filesystem, which is in memory from the moment the LUKS passphrase was entered. An attacker with a few seconds at your unlocked-but-not-logged-in machine can use this. Set a GRUB password.

Generate a PBKDF2 hash of the password (different from the LUKS passphrase; this one is recoverable, not catastrophic-if-lost):

```bash
grub-mkpasswd-pbkdf2
```

Enter a password, confirm, copy the output (`grub.pbkdf2.sha512.10000.AAAA...`).

Create `/etc/grub.d/40_custom_password`:

```bash
sudo tee /etc/grub.d/40_custom_password > /dev/null <<'EOF'
#!/bin/sh
exec tail -n +3 $0
set superusers="root"
password_pbkdf2 root grub.pbkdf2.sha512.10000.PASTE_YOUR_HASH_HERE
EOF
sudo chmod +x /etc/grub.d/40_custom_password
```

Replace `PASTE_YOUR_HASH_HERE` with the full string from `grub-mkpasswd-pbkdf2`.

Update GRUB:

```bash
sudo update-grub
```

Reboot to verify. You should still be prompted for the LUKS passphrase (which is GRUB unlocking /boot to read the kernel). Then if you try to edit a menu entry (press `e`), GRUB now demands the `root` username and the password you just set.

Trade-off: this prevents an attacker from modifying boot parameters but does not prevent them from rebooting from external media. That's what Part 4 is for.

## 2.3 BIOS/UEFI password

The GRUB password (Part 2.2) sits above the firmware. An attacker with physical access can still enter the firmware setup, change boot order to a USB stick, disable Secure Boot if it was on, or in some cases reset the boot password via a CMOS clear. Setting a firmware password closes most of those.

Two firmware passwords are typically available, with different roles:

- **Supervisor password** (sometimes called admin or BIOS password). Required to enter setup. Without it, an attacker can't change firmware settings, can't toggle Secure Boot, can't change boot order, can't disable hardware features. This is the one to set.
- **Power-on password** (sometimes called user password). Required to boot the machine at all. Forces a prompt before the firmware even loads the bootloader. Stronger but more disruptive — every cold boot needs the password, before GRUB and before LUKS.

For most threat models, the supervisor password alone is sufficient. The power-on password adds a layer at the cost of an additional prompt; pick based on whether your threat model includes attackers who can casually power on your laptop.

The procedure is firmware-vendor-specific. Generic path:

1. Reboot, enter firmware setup (F2, F12, Del, or Esc during POST — varies by vendor; the screen usually tells you).
2. Navigate to a Security tab.
3. Find "Supervisor Password," "Admin Password," or "BIOS Password" — set it.
4. (Optional) Also set "Power-on Password" or "User Password."
5. Save and exit.

Honest framing of the limits. Firmware passwords on consumer hardware are not strong against a determined attacker with the machine in their possession for hours:

- **CMOS clear.** Many laptops have a clear-CMOS jumper or coin-cell battery that, when removed for a minute, resets firmware settings including passwords. ThinkPads use a security chip and don't fully reset on CMOS clear, but most other vendors do. Check your laptop's service manual.
- **EEPROM access.** A skilled attacker with bench tools (SOIC clip, external SPI programmer) can directly read or write the firmware chip, bypassing any password. This is the same threat surface as Heads/coreboot mitigates by replacing the firmware itself.
- **Vendor recovery procedures.** Some vendors (Dell, HP) have documented service procedures to bypass firmware passwords with proof of ownership. An attacker with social engineering access and your laptop can sometimes exploit these.

For threat models worried about CMOS clear and EEPROM access, the answer is Heads/coreboot (Part 4.3), not a firmware password. The firmware password is a useful defense against casual physical access (lost laptop, opportunistic theft) — not against a determined adversary who has the device for a week with bench tools.

**Recovery if you forget your own firmware password.** Different vendors handle this differently and the recovery story is part of what to know before setting the password:

- **ThinkPad supervisor password.** Stored in the security chip, not in CMOS. Clearing CMOS does NOT reset the supervisor password — this is the security chip's main job. The official recovery procedure is the Lenovo Service Center with proof of ownership; Lenovo can flash-reset the chip but does not provide consumer-side master passwords. Practically: if you forget, the laptop is bricked from a firmware-config perspective until a Service Center session, which is days-to-weeks of turnaround. Write the password down somewhere offline before setting it.
- **Dell BIOS password.** Tied to the laptop's service tag. Dell has a documented procedure for owners to request a master password with proof of purchase; the password is generated from the service tag. The procedure is real, has worked historically, and is also an attack surface — anyone who can social-engineer Dell support with a stolen laptop's service tag may get the same recovery.
- **HP BIOS password.** Varies by model. Older business-class laptops (EliteBook, ProBook) have HP-side recovery via a service technician; consumer-class HP often requires motherboard replacement to recover.
- **Most other vendors.** A CMOS clear (remove the coin-cell battery for 60 seconds with AC disconnected) resets the firmware password on most consumer hardware. This is why the firmware password limits subsection earlier in this section names CMOS clear as a defeat: on non-ThinkPad hardware, your own forgetfulness and a determined attacker face the same low bar.

Net guidance: set the password, write it down on paper, store the paper with your LUKS-header-backup USB stick (Part 2.1). If your hardware is ThinkPad-grade with a real security chip, the password is meaningful protection against an attacker; on most consumer hardware, the password is meaningful only against casual access, with CMOS clear closing the gap for a determined attacker.

## 2.4 Verify /tmp hardening

The install script wrote `tmpfs /tmp tmpfs defaults,nosuid,nodev,size=50% 0 0` into fstab. Confirm it took effect:

```bash
mount | grep ' /tmp '
```

Should report `type tmpfs` with `nosuid` and `nodev` in the options. If not, reboot once and check again.

`nosuid` means setuid binaries placed in `/tmp` don't run with elevated privileges, killing one common privilege-escalation path. `nodev` means device nodes in `/tmp` don't work. `size=50%` caps memory usage so a runaway process can't OOM the machine by filling `/tmp`.

The same treatment for `/var/tmp` requires more care because some software stores cross-reboot state there. The conservative path: leave `/var/tmp` alone for now.

---

# Part 3: Runtime hardening

Each section is independently applicable. The order is by importance: do them top to bottom and stop wherever your patience runs out. Doing the first three (backup, microcode, sysctls) catches the largest fraction of realistic threats.

## 3.1 Off-machine encrypted backup with Borg

The single most important reliability item. Disks fail. Ransomware encrypts. Laptops vanish. Without backup, any of those is total loss. Do this before adding any data you care about, so the first snapshot captures the clean state and every later snapshot is an incremental delta.

Why Borg as the default. Borg (borgbackup) is older, written in Python with the hot paths in C, and has been the de-facto default for serious operators for over a decade. The on-disk format is documented and stable across versions; the codebase has been audited multiple times by independent reviewers; the Python ecosystem means you can audit one library at a time. restic is also good — single static Go binary, simpler mental model, better cloud-native backends — but the Knots-lens / cold-storage operator preference leans Borg for the same reason it leans GPG over age: fewer dependencies, longer track record, more eyes on the format. Both encrypt, both deduplicate, both compress. Either is dramatically better than no backup. For this procedure the destination is a local encrypted drive, where Borg is the clear default; restic's advantage is cloud object storage, which this procedure does not use. The full tool comparison and the backup discipline (3-2-1, off-site rotation, append-only, restore testing) are in `choosing-backup-tools.md`; this section is the Devuan procedure that implements them.

Install:

```bash
sudo apt install borgbackup
```

### Prepare an external disk

Plug in an external drive. Get the device name from `lsblk`. Treat the next step as destructive; double-check the device.

LUKS-encrypt the external disk:

```bash
sudo cryptsetup luksFormat --type luks2 /dev/sdX1
sudo cryptsetup open /dev/sdX1 backup
sudo mkfs.ext4 -L backup /dev/mapper/backup
```

Mount:

```bash
sudo mkdir -p /mnt/backup
sudo mount /dev/mapper/backup /mnt/backup
sudo chown $USER:$USER /mnt/backup
```

### Initialize the Borg repository

```bash
borg init --encryption=repokey-blake2 /mnt/backup/borg-repo
```

The `repokey-blake2` mode stores the encrypted master key inside the repo itself (protected by your passphrase) and uses BLAKE2b for the MAC instead of HMAC-SHA256 — faster and equally secure. The passphrase here must be different from your LUKS passphrases. Borg uses it to unwrap the master key in the repo; lose it and every archive in this repo is unrecoverable. Store it the same way you store the LUKS passphrase: paper, separate location.

For a paranoid-mode variant, `--encryption=keyfile-blake2` stores the master key in `~/.config/borg/keys/` instead of in the repo. The repo itself then leaks no key material. Cost: you have to back up the keyfile separately (otherwise losing the workstation loses the backup). Use repokey-blake2 unless you have a specific reason to want keyfile mode.

### A daily snapshot

Create `/usr/local/sbin/borg-backup`:

```bash
sudo tee /usr/local/sbin/borg-backup > /dev/null <<'EOF'
#!/bin/bash
set -euo pipefail

export BORG_REPO=/mnt/backup/borg-repo
export BORG_PASSCOMMAND="cat /root/.borg-password"

ARCHIVE_NAME="$(hostname)-$(date +%Y-%m-%dT%H:%M:%S)"

borg create \
    --verbose --filter AME --list --stats --show-rc \
    --compression zstd,9 \
    --exclude-caches \
    --exclude '/home/*/.cache' \
    --exclude '/home/*/.local/share/Trash' \
    --exclude '/var/cache' \
    --exclude '/var/tmp' \
    --exclude '/tmp' \
    "::${ARCHIVE_NAME}" \
    /home /etc /root /usr/local

borg prune --list \
    --keep-daily 14 --keep-weekly 8 --keep-monthly 12 \
    --show-rc

borg compact
EOF
sudo chmod 700 /usr/local/sbin/borg-backup
```

Write the repo passphrase to `/root/.borg-password` (root-only readable):

```bash
sudo touch /root/.borg-password
sudo chmod 600 /root/.borg-password
sudo nano /root/.borg-password   # paste the passphrase, one line, no trailing newline
```

Test the backup manually first:

```bash
sudo /usr/local/sbin/borg-backup
```

It should report files processed and an archive ID. List archives:

```bash
sudo BORG_REPO=/mnt/backup/borg-repo BORG_PASSCOMMAND="cat /root/.borg-password" borg list
```

Schedule via cron. On Devuan with sysvinit, `cron` is the right job runner (not systemd timers). Edit root's crontab:

```bash
sudo crontab -e
```

Add (runs at 03:17 daily; mount the backup disk first or skip if not mounted):

```
17 3 * * * /usr/local/sbin/borg-backup 2>&1 | logger -t borg-backup
```

### Three locations, monthly rotation

Every backup that lives in the same building as the original is one fire, flood, or break-in away from being no backup. The operational floor for long-term durability is three encrypted drives in three physical locations:

- **Drive A**, attached to the workstation (or nightly-mountable from it), receives the nightly cron snapshot.
- **Drive B**, identical setup, stored at a different physical location — a relative's house, a safe-deposit box, an office locker. Rotated with Drive A monthly: you bring B home, swap them, take A back to the off-site location, B is now the nightly target. The off-site drive is at most one month stale.
- **Drive C**, deep-archive — stored in a third location (different city, with family, at a friend's), updated quarterly or semi-annually. Survives the case where both your home and your monthly off-site location are compromised simultaneously (fire across a neighborhood, regional natural disaster, coordinated theft).

Borg makes drive-to-drive sync straightforward — `borg list` and `borg export-tar` work on any mounted repo. A simpler pattern: keep all three drives as independent Borg repos and run the same backup script against each in turn during the rotation.

### Biannual restore drill

Untested backup is not a backup. Twice a year, do a full restore drill to a sacrificial location:

```bash
sudo mkdir -p /mnt/restore-drill
sudo BORG_REPO=/mnt/backup/borg-repo BORG_PASSCOMMAND="cat /root/.borg-password" \
    borg extract --list ::"$(borg list --short | tail -1)" \
    --strip-components 0 -- '*'
# inspect, verify a sample of files match production
# then clean up:
sudo rm -rf /mnt/restore-drill
```

Pick a specific calendar date — January 1st and July 1st, or your birthday and the six-month-offset day. Block it on your calendar. The restore drill catches: silently-corrupted repos, passphrase memory drift (you remembered the wrong word), encryption-tool API drift between Borg versions, drive failure that hadn't surfaced yet. Find the failure during the drill, not during the emergency.

### Save the LUKS header to the backup drive too

The LUKS header backup from Part 2.1 should also live on the backup drive (in addition to the other locations). It's small; replicate it everywhere reasonable.

```bash
cp ~/luks-header.bin.gpg /mnt/backup/
```

### If you're already on restic

restic remains a valid choice. `apt install restic`, the v3 procedure with `restic init --repo`, `restic backup`, `restic forget --keep-daily / --keep-weekly / --keep-monthly --prune` still works and is well-tested. The Knots-lens default is Borg; the practical-equivalence default is whichever tool you'll actually maintain.

## 3.2 CPU microcode

Closes the speculative-execution attack family (Spectre, Meltdown, Downfall, Inception, Zenbleed, and the others that will be discovered next year). Microcode is loaded by the bootloader before the kernel; on Devuan the relevant package installs it into the initramfs automatically.

Find your CPU vendor:

```bash
grep -m1 vendor_id /proc/cpuinfo
```

If it says `GenuineIntel`:

```bash
sudo apt install intel-microcode
```

If it says `AuthenticAMD`:

```bash
sudo apt install amd64-microcode
```

The install script in Part 1 already installs both packages so the right one is in place. This step is the verify-and-confirm pass for an existing install.

Reboot, then verify the microcode loaded:

```bash
dmesg | grep -i microcode
```

You should see a line about microcode being updated early, naming a revision number. If you see "microcode updated late" or nothing at all, the package isn't installed for your vendor or the initramfs isn't pulling it in. Re-run `update-initramfs -u -k all` and reboot again.

## 3.3 Firmware updates via fwupd

Microcode (Part 3.2) closes CPU-level speculative-execution vulns but leaves three other firmware attack surfaces untouched: BIOS/UEFI firmware on the motherboard, Thunderbolt controller firmware (which lives on the TB chip, not the OS), and NVMe SSD firmware. Each of these has had publicly-disclosed vulnerabilities in the last five years, sits below the OS, and is invisible to every other hardening item in this document.

fwupd is the Linux Vendor Firmware Service (LVFS) client. Vendors publish signed firmware capsules to LVFS; fwupd fetches, verifies, and applies them. Works on Devuan because fwupd is dbus + udev based, not systemd-coupled.

Install and refresh metadata:

```bash
sudo apt install fwupd
sudo fwupdmgr refresh
sudo fwupdmgr get-devices
```

`get-devices` lists hardware that fwupd recognizes — usually the system BIOS, Thunderbolt controllers, dock firmware where applicable, some NVMe drives, some external displays. Hardware not in the list either has no LVFS-published firmware (older or niche hardware) or isn't supported by the running fwupd version.

Check for and apply updates:

```bash
sudo fwupdmgr get-updates
sudo fwupdmgr update
```

BIOS updates typically require a reboot and a brief firmware-side update phase. Don't run BIOS updates from a laptop on battery without grid power — power loss mid-flash bricks the firmware chip. Tether to mains, charge to >50%, then update.

For hardware not in LVFS — older ThinkPads, anything pre-2018, some niche brands — check the vendor's support page for a UEFI Capsule file. The flow is usually: download capsule, copy to ESP, boot to firmware setup, select "update from file," follow vendor prompts. Lenovo, Dell, HP, and System76 all publish capsules this way for hardware that pre-dates their LVFS participation.

The Knots-lens / cold-storage operator practice diverges here: on signing machines that update rarely, firmware updates are deferred and applied on a manual schedule with verification (read the changelog, verify it doesn't change firmware in unexpected ways). On a daily-driver online workstation, prompt firmware updates win because the attack window matters more than the deterministic-state property. This doc is the daily-driver case.

After firmware updates, take a fresh LUKS header backup (Part 2.1). Some firmware updates change how UEFI variables are read, which can change how the LUKS volume mounts, which is harmless until it isn't.

## 3.4 Unattended security updates

`apt upgrade` discipline is part of every hardening guide ever written and people don't run it because they forget. The fix is to make it automatic. `unattended-upgrades` from Debian (Devuan inherits) does this — runs `apt update` and applies security-only updates without prompting.

Critical detail: security-only, NOT all updates. Full unattended upgrades break things (a major version bump of a library can break userland; a kernel update can change boot behavior). Security-only updates are scoped to the `${distro_codename}-security` apt suite and ship strictly security fixes.

Install:

```bash
sudo apt install unattended-upgrades apt-listchanges
```

Configure:

```bash
sudoedit /etc/apt/apt.conf.d/50unattended-upgrades
```

The key section:

```
Unattended-Upgrade::Origins-Pattern {
    "origin=Devuan,codename=${distro_codename}-security";
};

Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::MinimalSteps "true";
```

`Automatic-Reboot "false"` — never reboot without your knowledge. You notice when the system tells you a reboot is needed; you reboot at a moment that suits you.

`apt-listchanges` shows package changelogs in apt output so you can see what changed since the last upgrade. Configure to email or just display:

```bash
sudoedit /etc/apt/listchanges.conf
```

Set `frontend=pager` for interactive display, `frontend=mail` plus `email_address=` for email.

Enable the daily run:

```bash
sudo dpkg-reconfigure -plow unattended-upgrades
```

This prompts whether to enable automatic updates; answer yes.

Verify the next-day apt run:

```bash
cat /var/log/unattended-upgrades/unattended-upgrades.log
```

The Knots-lens divergence is worth flagging again: on signing machines and cold-storage adjacents, disable this entirely and update on a manual schedule with verification. The reasoning is that deterministic, manually-verified state matters more than promptness. For an online daily-driver workstation, the calculus flips — the attack window from a known unpatched CVE is the larger risk.

## 3.5 Kernel hardening

A short list of sysctl tweaks closes most local-privilege-escalation paths a generic Linux machine is exposed to. The standard set:

```bash
sudo tee /etc/sysctl.d/99-hardening.conf > /dev/null <<'EOF'
# Hide kernel pointers from non-root
kernel.kptr_restrict=2

# Restrict kernel log read to root only
kernel.dmesg_restrict=1

# Disable unprivileged eBPF (a steady source of local-priv-esc CVEs)
kernel.unprivileged_bpf_disabled=1
net.core.bpf_jit_harden=2

# Restrict ptrace to same-user only, no cross-user even with same UID
kernel.yama.ptrace_scope=2

# Protect against symlink/hardlink/FIFO/regular-file attacks in /tmp-style dirs
fs.protected_hardlinks=1
fs.protected_symlinks=1
fs.protected_fifos=2
fs.protected_regular=2

# Address space layout randomization at full strength
kernel.randomize_va_space=2

# Network hardening
net.ipv4.tcp_syncookies=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv6.conf.default.accept_redirects=0
net.ipv4.conf.all.send_redirects=0
net.ipv4.conf.default.send_redirects=0
net.ipv4.conf.all.accept_source_route=0
net.ipv6.conf.all.accept_source_route=0
net.ipv4.conf.all.log_martians=1
EOF
```

Apply without rebooting:

```bash
sudo sysctl --system
```

Verify a sample setting took:

```bash
sysctl kernel.kptr_restrict
```

Should return `kernel.kptr_restrict = 2`.

Trade-offs that may matter:

- `kernel.unprivileged_bpf_disabled=1` breaks eBPF tools (bpftrace, bcc-tools) when run as non-root. Workstation use is fine; if you actively use bpftrace as your user, run it under sudo or remove the line.
- `kernel.yama.ptrace_scope=2` blocks cross-user ptrace. Your own programs can still strace/gdb each other. Debugging other users' processes requires sudo.
- A `kernel.unprivileged_userns_clone=0` line would tighten further but breaks Firefox's sandbox, Flatpak, and rootless containers. Don't add unless you run none of those.

### Kernel command-line hardening parameters

The sysctls above are runtime kernel settings. The kernel command line sets boot-time parameters that aren't reachable via sysctl — they alter how the kernel allocates memory, randomizes layout, and exposes interfaces. Several are worth adding for a max-security configuration.

Edit `/etc/default/grub`:

```bash
sudoedit /etc/default/grub
```

Find `GRUB_CMDLINE_LINUX_DEFAULT` and extend it. The current line is typically `GRUB_CMDLINE_LINUX_DEFAULT="quiet"`. The hardened form:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet slab_nomerge init_on_alloc=1 init_on_free=1 page_alloc.shuffle=1 vsyscall=none randomize_kstack_offset=on debugfs=off"
```

Update GRUB and reboot:

```bash
sudo update-grub
sudo reboot
```

What each parameter does:

- `slab_nomerge` — prevents the kernel slab allocator from merging caches of identically-sized objects. Forces an attacker exploiting a slab vulnerability to target a specific cache rather than a merged one. Negligible perf cost.
- `init_on_alloc=1` — zeroes kernel heap allocations at allocation time. Closes a class of uninitialized-memory information leaks. ~1-3% perf cost on most workloads.
- `init_on_free=1` — zeroes memory at free time. Closes use-after-free information leaks. ~3-7% perf cost; combine with init_on_alloc.
- `page_alloc.shuffle=1` — randomizes free-list ordering in the page allocator. Mitigates heap-spray exploits. ~0% perf cost.
- `vsyscall=none` — disables the legacy vsyscall mechanism (a small fixed-address syscall page from the early 2000s). Almost no modern userland still uses it; closes a ROP-gadget surface.
- `randomize_kstack_offset=on` — adds per-syscall randomization to the kernel stack offset. Mitigates kernel-stack-based exploits. ~1% perf cost.
- `debugfs=off` — disables debugfs at boot. Closes an information-disclosure surface useful only when actively debugging the kernel.

Verify after reboot:

```bash
cat /proc/cmdline
```

Should show your full command line including the new parameters.

A heavier option for the truly paranoid: `mitigations=auto,nosmt`. This enables all CPU bug mitigations including disabling SMT (hyperthreading). SMT-off is the only way to fully close the L1TF and MDS class of side-channel attacks. The cost is a significant performance hit — roughly half of total CPU throughput on Intel and AMD chips that depend on SMT. Knots-lens / cold-storage operators on signing machines enable this without hesitation; daily-driver users typically don't. Decision per-machine, per-workload.

If `mitigations=auto,nosmt` breaks something, fall back to `mitigations=auto` (full mitigations but keep SMT on).

## 3.6 AppArmor profiles

The Unix permission model assumes that processes run by your user are equally trusted with everything your user can read. Firefox running as you can read your SSH keys. AppArmor adds a second kernel-level permission system that confines individual programs to a declared subset of files, network endpoints, and Linux capabilities. An AppArmored Firefox cannot read `~/.ssh/`, full stop, regardless of what an attacker controlling the browser tries to do.

Devuan ships AppArmor in the kernel. Confirm:

```bash
cat /sys/module/apparmor/parameters/enabled
```

Should report `Y`.

Install profiles and tooling:

```bash
sudo apt install apparmor apparmor-utils apparmor-profiles apparmor-profiles-extra
sudo aa-enabled
```

`aa-enabled` should report `Yes`. If not, you need to enable AppArmor on the kernel command line. Edit `/etc/default/grub`, find `GRUB_CMDLINE_LINUX_DEFAULT`, add `apparmor=1 security=apparmor`, then `sudo update-grub` and reboot.

List installed profiles:

```bash
sudo aa-status
```

The profiles directory is `/etc/apparmor.d/`. Profiles in there are either enforced (blocking), in complain mode (logging only), or disabled. Put profiles into complain mode first to find what they break before enforcing:

```bash
sudo aa-complain /etc/apparmor.d/usr.bin.firefox
```

Use Firefox for a while, watch the audit log:

```bash
sudo grep apparmor /var/log/kern.log
```

If nothing important breaks, switch to enforce:

```bash
sudo aa-enforce /etc/apparmor.d/usr.bin.firefox
```

Repeat per profile. Reasonable defaults to enforce: any browser profile, any chat client profile, any PDF reader profile, the man-page and command-line tool profiles in `apparmor-profiles-extra`.

Profile names vary by Devuan release. Don't take any specific filename from this document as gospel; list what `/etc/apparmor.d/` actually contains on your machine.

## 3.7 MAC address randomization

Your network card's MAC address is a hardware identifier visible on every network you join. Coffee shops, hotels, conferences, airports all log MACs into their captive-portal systems; the database is sold or breached often enough that "I was at this WiFi on this date" is a queryable fact about you years later. MAC randomization breaks this linkage.

Devuan with ifupdown and no NetworkManager needs manual MAC randomization via `macchanger`. Install:

```bash
sudo apt install macchanger
```

The installer asks whether to randomize MAC on every interface up. Answer yes.

For a per-interface hook that randomizes on connection, create `/etc/network/if-pre-up.d/random-mac`:

```bash
sudo tee /etc/network/if-pre-up.d/random-mac > /dev/null <<'EOF'
#!/bin/sh
# Randomize MAC address before bringing the interface up.
# Skip loopback and any interface name starting with 'tun' or 'tap' (VPNs).
case "$IFACE" in
    lo|tun*|tap*) exit 0 ;;
esac
/usr/bin/macchanger -r "$IFACE" >/dev/null 2>&1 || true
EOF
sudo chmod +x /etc/network/if-pre-up.d/random-mac
```

If you use NetworkManager instead of ifupdown (some XFCE installs pull it in), it has its own MAC randomization configuration. Create `/etc/NetworkManager/conf.d/99-mac-randomize.conf`:

```bash
sudo tee /etc/NetworkManager/conf.d/99-mac-randomize.conf > /dev/null <<'EOF'
[device-mac-randomization]
wifi.scan-rand-mac-address=yes

[connection-mac-randomization]
wifi.cloned-mac-address=random
ethernet.cloned-mac-address=random
EOF
```

To check which path applies on your machine, look for both processes:

```bash
pgrep -a NetworkManager
pgrep -a ifup
```

If NetworkManager is running, use the NetworkManager config. If only ifupdown is in play, use the if-pre-up.d script. On a default XFCE install with `task-xfce-desktop`, NetworkManager is typically the path; on a no-desktop install or after explicit removal, ifupdown alone is the path.

Restart networking. Verify with `ip link show` and look at the `link/ether` value; it should change between interface ups.

Trade-offs:

- Networks that use MAC address whitelisting (some corporate WiFi, some captive portals that "remember" you) will reject the randomized MAC. Per-network exceptions need to use static MACs for those specific SSIDs.
- A handful of WiFi adapters report MAC changes incorrectly. Test that connectivity actually works before relying on randomization.

## 3.8 Encrypted DNS via dnscrypt-proxy

Every domain you resolve is visible to your DNS provider, which by default is your ISP or whatever the DHCP server hands out. ISPs sell that data. Captive portals manipulate it. A network attacker can spoof responses. Encrypted DNS closes those holes by sending DNS over an encrypted channel to a resolver you choose.

Check that nothing else is already bound to port 53:

```bash
sudo ss -tulnp | grep ':53 '
```

On a default Devuan with no resolved/dnsmasq, this returns nothing and you're free to bind. If something is listed, identify and stop it before continuing (`sudo service <name> stop && sudo update-rc.d <name> disable` on sysvinit).

Install:

```bash
sudo apt install dnscrypt-proxy
```

Configure. The default `/etc/dnscrypt-proxy/dnscrypt-proxy.toml` is verbose. The minimum useful tweaks:

```bash
sudo nano /etc/dnscrypt-proxy/dnscrypt-proxy.toml
```

Find and set:

```
listen_addresses = ['127.0.0.1:53', '[::1]:53']
require_dnssec = true
require_nolog = true
require_nofilter = true
```

The `require_nolog` constraint filters to resolvers that publicly commit to not logging queries. The `require_nofilter` constraint filters out resolvers that block specific domains (the "family-friendly" filtering some public DNS services offer). The full list of public resolvers and their properties lives in `/usr/share/dnscrypt-proxy/example-public-resolvers.md`.

Start the service. The command depends on your init system:

```bash
# sysvinit
sudo service dnscrypt-proxy start
sudo update-rc.d dnscrypt-proxy enable

# OpenRC
sudo rc-service dnscrypt-proxy start
sudo rc-update add dnscrypt-proxy default

# runit
sudo ln -s /etc/sv/dnscrypt-proxy /var/service/
```

Point the system at the local resolver. Edit `/etc/resolv.conf`:

```
nameserver 127.0.0.1
options edns0
```

To prevent DHCP from overwriting this on every connect, on ifupdown:

```bash
sudo tee /etc/network/if-up.d/no-resolvconf > /dev/null <<'EOF'
#!/bin/sh
# Lock resolv.conf to local dnscrypt-proxy.
chattr -i /etc/resolv.conf 2>/dev/null || true
echo "nameserver 127.0.0.1" > /etc/resolv.conf
echo "options edns0" >> /etc/resolv.conf
chattr +i /etc/resolv.conf 2>/dev/null || true
EOF
sudo chmod +x /etc/network/if-up.d/no-resolvconf
```

Verify queries are going through the encrypted resolver. The log file location depends on the init system; check your dnscrypt-proxy.toml `log_file` setting or use the service's logging mechanism:

```bash
dig +short example.com
# sysvinit (logging to /var/log/dnscrypt-proxy/ if enabled)
sudo tail -20 /var/log/dnscrypt-proxy/dnscrypt-proxy.log 2>/dev/null
# runit
sudo tail -20 /var/log/dnscrypt-proxy/current 2>/dev/null
```

The query should resolve. Then visit `dnsleaktest.com` and confirm the reported DNS server is the encrypted resolver, not your ISP.

## 3.9 USBGuard

USB is the largest privileged attack surface most laptops have. A malicious USB device (BadUSB, Rubber Ducky, USB Killer) plugged into a running machine can simulate keystrokes, mount a fake network adapter, or dump the bus. The same applies to malicious cables: O.MG-class cables (Hak5 / Mike Grover) embed a microcontroller plus a wireless radio in what looks like an ordinary USB-C or Lightning cable, present the attached peripheral's HID descriptor on one channel, and silently inject keystrokes on another. USBGuard whitelists USB devices you actually use and blocks everything else; that whitelist covers cable-internal microcontrollers the same way it covers rogue peripherals, because both ultimately register as USB devices the kernel binds to.

Install:

```bash
sudo apt install usbguard
```

Before starting the service, generate a policy from currently-attached devices (so your existing peripherals don't get blocked the moment you enable enforcement):

```bash
sudo usbguard generate-policy > /tmp/rules.conf
sudo mv /tmp/rules.conf /etc/usbguard/rules.conf
sudo chmod 600 /etc/usbguard/rules.conf
```

Review the rules. Each line is an `allow` (or `block`) for a specific device descriptor. Comment out any line for a device you don't recognize. Confirm your keyboard, mouse, and built-in USB hubs are all in the allow list — getting locked out of a USB keyboard mid-session is a recoverable inconvenience but worth avoiding.

Start the service (commands match your init system, as in Part 3.8).

Test by plugging in a USB stick you haven't whitelisted. It should be blocked. Check the policy:

```bash
sudo usbguard list-devices
```

Devices in state `block` are not allowed. To temporarily allow a new device this session:

```bash
sudo usbguard allow-device <device-id>
```

To allow permanently, add an `allow` rule for it. The friendliest workflow: keep the policy file in your dotfiles repo (encrypted), edit it manually when adding new permanent peripherals.

Trade-off: you will get blocked at least once by your own USBGuard config when you plug in a colleague's stick or a new printer. The fix is one command. The threat model where this matters: a hostile peripheral plugged into a logged-in machine; physical attacks on a powered-on laptop; supply-chain attacks via "free" USB sticks or cables from untrusted sources.

## 3.10 Thunderbolt and DMA hardening

Thunderbolt is PCIe-over-cable. A malicious Thunderbolt device gets the same kind of DMA access to memory that an internal PCIe card would, beneath the USB descriptor layer that USBGuard enforces. Thunderspy (Björn Ruytenberg, 2020) showed Thunderbolt 1, 2, and 3 are fundamentally vulnerable to attacks against an unlocked machine where the attacker can plug something into a Thunderbolt port. The practical defenses are Kernel DMA Protection (Linux 5.x and later, requires IOMMU configured and turned on) plus an explicit per-device authorization model so unknown devices are blocked until you say otherwise. Thunderbolt 4 hardware mandates Kernel DMA Protection by default; Thunderbolt 3 hardware does not. Hardware choice matters here; `choosing-hardware.md` covers the IOMMU/Kernel-DMA-Protection state across current laptop options.

If you do not use Thunderbolt at all, disable it in BIOS. This is the cleanest defense and ends the section.

If you do use Thunderbolt, three things together:

**Enable IOMMU at the kernel command line.** Without IOMMU, DMA protection has nothing to enforce. Edit `/etc/default/grub`:

```bash
sudo nano /etc/default/grub
```

For Intel, append to `GRUB_CMDLINE_LINUX_DEFAULT`:

```
intel_iommu=on iommu=pt
```

For AMD, append:

```
amd_iommu=on iommu=pt
```

The `iommu=pt` (passthrough) mode is the performance-friendly default: devices that aren't actively isolated use direct mapping. Update GRUB and reboot:

```bash
sudo update-grub
sudo reboot
```

Verify:

```bash
dmesg | grep -i -E "iommu|dmar"
```

On Intel you should see `DMAR: IOMMU enabled` plus per-device enable messages. On AMD you should see `AMD-Vi: AMD IOMMUv2 loaded` or `AMD-Vi: Found IOMMU at 0000:00:00.2`. If `dmesg` shows nothing matching, IOMMU isn't on; check BIOS for an "Intel VT-d" or "AMD-Vi" / "IOMMU" setting and enable it there first, then re-verify after reboot.

**Set Thunderbolt security level in firmware.** Most laptop BIOSes expose a Thunderbolt security level setting: SL0 (none, allow everything), SL1 (user authorization required), SL2 (require signed firmware), SL3 (DisplayPort-only, no PCIe). Set it to at least SL1. SL2 if your hardware supports it. SL3 if you only ever use Thunderbolt to drive an external monitor.

**Install bolt for per-device authorization at runtime.**

```bash
sudo apt install bolt
```

The `bolt` package provides `boltd` (the daemon) and `boltctl` (the CLI). It works on Devuan because it speaks to udev and dbus rather than depending on systemd directly; on Devuan with elogind installed (the default on the XFCE flavor) bolt detects sessions correctly. List currently-attached Thunderbolt devices:

```bash
boltctl list
```

When a new Thunderbolt device is plugged in, it shows up in the `authorized: no` state. Authorize it for this boot only:

```bash
boltctl authorize <uuid>
```

Authorize and remember it across reboots:

```bash
boltctl enroll <uuid>
```

Inspect a specific device:

```bash
boltctl info <uuid>
```

Forget an enrolled device (a previously-trusted dock you want to revoke):

```bash
boltctl forget <uuid>
```

Trade-offs. First time you plug a Thunderbolt dock, eGPU, or external storage, it requires the enroll step; until you do it the device shows up but doesn't function. If `boltd` isn't running, the kernel falls back to whatever the BIOS security level allows, so confirm the service is active (`pgrep -a boltd`). Some old laptops have firmware that claims IOMMU is enabled when it isn't; `dmesg` is the ground truth, not the BIOS setting screen. Thunderbolt 4 hardware gets Kernel DMA Protection automatically, but the per-device authorization model is still worth using.

The threat model where this matters: an unattended logged-in machine left in a hotel room or a conference venue; a "found" docking station offered for charging; a TB-equipped peripheral handed over by a stranger. Pre-Thunderbolt-4 hardware where the IOMMU isn't actually enabled is wide open even with `boltd` running, because DMA protection has nothing to enforce.

## 3.11 Host firewall with nftables

A workstation on a shared network is by default reachable on every port for which something is listening. The sysctl tightening in Part 3.5 closes some network-level issues; an active firewall closes the rest. Devuan ships nftables in modern releases; iptables is a legacy alternative for the same job.

Install:

```bash
sudo apt install nftables
```

Default-deny inbound, allow outbound, allow established and related (the standard workstation policy). Create `/etc/nftables.conf`:

```bash
sudo tee /etc/nftables.conf > /dev/null <<'EOF'
#!/usr/sbin/nft -f
flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy drop;

        # Allow already-established connections and related (e.g. ICMP responses)
        ct state established,related accept
        ct state invalid drop

        # Allow loopback
        iif lo accept

        # Allow ICMP (ping, traceroute, MTU discovery)
        ip protocol icmp icmp type { echo-request, destination-unreachable, time-exceeded, parameter-problem } accept limit rate 4/second
        ip6 nexthdr icmpv6 icmpv6 type { echo-request, destination-unreachable, packet-too-big, time-exceeded, parameter-problem, nd-router-solicit, nd-router-advert, nd-neighbor-solicit, nd-neighbor-advert } accept

        # Allow DHCP responses (if you use DHCP)
        udp sport 67 udp dport 68 accept

        # mDNS (Avahi, for local network discovery) — comment out if you don't use it
        # ip daddr 224.0.0.251 udp dport 5353 accept
        # ip6 daddr ff02::fb udp dport 5353 accept

        # Log and drop everything else (sample 1 in 50 to keep logs sane)
        limit rate 10/minute log prefix "nft_input_drop: " level info
    }

    chain forward {
        type filter hook forward priority 0; policy drop;
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}
EOF
sudo chmod 600 /etc/nftables.conf
```

Apply and enable:

```bash
sudo nft -f /etc/nftables.conf
sudo service nftables start
sudo update-rc.d nftables enable    # sysvinit
# OpenRC: sudo rc-service nftables start; sudo rc-update add nftables default
# runit:  sudo ln -s /etc/sv/nftables /var/service/
```

Verify the ruleset loaded:

```bash
sudo nft list ruleset
```

You should see the rules above. Drop logs go to syslog (sysvinit) or to the journal where present.

Add per-application allow rules only when you need them. Examples:

```
# Allow SSH from the local network only (don't open to the internet)
ip saddr 192.168.0.0/16 tcp dport 22 accept

# Allow Syncthing peer connections
tcp dport 22000 accept
udp dport 22000 accept

# Allow KDE Connect
tcp dport 1714-1764 accept
udp dport 1714-1764 accept
```

Trade-offs and notes:

- If you run any locally-listening service that a remote machine needs to reach (file sharing, a self-hosted dev server, an audio jack server), you'll add an allow rule for it. Default-deny means new services start invisible from the network until you whitelist them, which is what you want.
- If you run a VPN client (WireGuard, OpenVPN), the VPN tunnel interface (typically `wg0`, `tun0`) needs `iif wg0 accept` (or equivalent for your interface name) in the input chain to allow VPN-side traffic in.
- This is a workstation policy. Servers, routers, and machines that need to forward traffic need different rule shapes; the forward chain stays drop here and that's correct for a workstation.
- After making changes to `/etc/nftables.conf`, run `sudo nft -f /etc/nftables.conf` to apply. To test before persisting, use `sudo nft -c -f /etc/nftables.conf` (dry-run; `-c` is check-only).

## 3.12 Kernel lockdown mode

Kernel lockdown prevents even root from loading unsigned kernel modules, writing to `/dev/mem`, modifying running kernel state, or kexec'ing a custom kernel. It closes the post-compromise rootkit vector: once an attacker has root on a lockdown-enforced system, they cannot install a kernel-level rootkit without breaking out of lockdown first.

This is the most disruptive item in this document. Read the trade-offs before enabling.

Edit `/etc/default/grub`:

```bash
sudo nano /etc/default/grub
```

Find:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet"
```

Change to:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet lockdown=confidentiality"
```

Update GRUB and reboot:

```bash
sudo update-grub
sudo reboot
```

Verify after reboot:

```bash
cat /sys/kernel/security/lockdown
```

Should show `none integrity [confidentiality]` with the active mode bracketed.

Trade-offs:

- Hibernation requires signed kernel images and is incompatible with `lockdown=confidentiality` on most distros. If you sized swap to enable hibernation (Part 1.5), test that resume works after enabling lockdown; if it doesn't, fall back to `lockdown=integrity` or remove the parameter entirely.
- DKMS modules (NVIDIA proprietary drivers, ZFS-on-Linux, VirtualBox host modules) need to be signed by your own Machine Owner Key (MOK) to load under lockdown. Configuration is more work; consult the Devuan secure-boot/DKMS docs.
- The fallback is `lockdown=integrity`, which still blocks kernel modification but allows reading kernel memory. Less protection but more compatibility.
- If something breaks unrecoverably, edit GRUB at boot (you set a GRUB password in Part 2.2, so this requires the password) and remove `lockdown=confidentiality` from the kernel line for one boot.

---

# Part 4: Architectural upgrades

These items move the threat model. Part 4.1 (TPM2-sealed unlock) detects firmware/bootloader tampering after the fact; Part 4.2 (`/boot` on USB) closes the evil-maid surface that exists on the laptop's internal disk; Part 4.3 (Heads / coreboot) replaces the firmware itself with measured, open firmware; Part 4.5 (VM compartmentalization) closes the cross-application blast radius that single-user hardening cannot; Part 4.6 (TPM2 PIN-binding) extends Part 4.1 to require user presence at unlock. Together they address the residual threats that Parts 1-3 leave open.

The Knots-lens / cold-storage operator convergence is that any threat model genuinely worried about physical access to the powered-off machine includes Part 4.2 (carry your bootloader) at minimum. The most paranoid operators also run Part 4.3 (Heads). Part 4.1 (with the 4.6 PIN extension for laptops) is useful but is not a substitute for either.

## 4.1 TPM2-sealed unlock with PCR binding

A TPM2 chip on the motherboard can hold an unlock secret released only when the system's firmware and bootloader measurements match a previously-recorded state. With this enrolled, the LUKS unlock happens without a passphrase prompt at boot, and any tampering with the firmware or bootloader (the evil-maid case) breaks the unlock.

The trade-off: when you legitimately update the firmware or kernel or GRUB, the PCR measurements change, the TPM refuses to release the secret, the system falls back to passphrase prompt. This is the correct behavior. It is also the behavior that bites people who update their firmware and then can't remember the LUKS passphrase because they've been TPM-unlocking for months.

This procedure is not in this document, on purpose. It's not because it's bad (it's a real security improvement) but because the recovery story matters more than the install story, and the recovery story varies by hardware and firmware vendor. Before you enroll TPM2 unlock:

- Verify the LUKS passphrase still works. Power off, power on, type the passphrase. If it doesn't work, the LUKS passphrase is already broken and TPM enrollment will silently mask the problem.
- Have at least two independent LUKS header backups (Part 2.1).
- Confirm a recovery USB boots and can decrypt the disk manually with the passphrase.

The actual enrollment is one command (`clevis-luks-bind -d /dev/<luks-part> tpm2 '{"pcr_ids":"7"}'` on Devuan via `clevis-luks` and `clevis-tpm2`; `systemd-cryptenroll --tpm2-device=auto` exists but Devuan's no-systemd default makes clevis the natural path). Both tools have good upstream documentation that's better than what would fit here. Read theirs before enrolling.

A note on what's coming. GRUB 2.14 (January 2026) introduces a native TPM2 key protector that performs the unlock at the bootloader stage rather than relying on a userspace tool like clevis. Excalibur's GRUB 2.12 doesn't have it; this section describes the clevis-based path that works on the current Devuan. When Devuan Freia ships, the GRUB-native path will be the cleaner option and clevis-on-Devuan will be the fallback for retrofitting older installs.

Important interaction: if you do Part 4.2 (`/boot` on USB), the TPM2 approach here becomes lower-priority because the same threat (boot-chain tampering) is closed differently. Don't stack both unless you understand what each adds.

## 4.2 Separate USB key for /boot

**Recommended for any threat model that includes physical access to the powered-off machine.** This was previously framed as optional. On the security-and-durability axis, it isn't — it's the single highest-leverage architectural change available within the project's threat model.

What this gets you:

1. The laptop without the USB stick is unbootable. A thief who steals the laptop without your keychain gets a brick; you don't have to assume they got both.
2. With `/boot` no longer needing to be readable by GRUB on the internal LUKS volume, you can re-format the internal LUKS with Argon2id key derivation instead of PBKDF2. Argon2id is memory-hard and GPU-resistant in a way PBKDF2 is not; this is the real KDF answer, not a workaround.
3. The ESP-tampering evil-maid surface moves off the laptop's internal disk. An attacker who gets physical access to the laptop alone cannot modify the bootloader because the bootloader isn't there.

What you trade:

- A USB stick to carry. Lose it and the laptop is unbootable until you reconstruct `/boot` from the recovery USB.
- A duplicate USB stored separately, generated at the same time, kept current with firmware/kernel updates. You don't want the duplicate to be three GRUB versions behind when you need it.

Procedure in concept: move `/boot` contents to a small FAT/ext4 partition on a USB stick, update `/etc/fstab` and `/etc/crypttab`, reinstall GRUB to the USB ESP, re-encrypt the internal LUKS with Argon2id (`cryptsetup luksConvertKey --pbkdf argon2id`). The failure modes are real (lose both USBs, lose access until reconstruction from backups), which is why two USBs is the operational minimum.

If you do this, redo the LUKS header backup (Part 2.1) with the new Argon2id parameters; the old header is no longer valid for unlocking the re-formatted volume.

The detailed procedure is a multi-section walkthrough that would double this document's length; the Knots-lens reference setup for it lives in the Bitcoin Knots / OpenTimestamps / Tails-developer communities, where the carry-the-bootloader pattern is standard practice. A separate companion guide for this is planned; until then, the upstream pointers are: Arch Wiki's "dm-crypt/Encrypting an entire system" with `/boot` on USB variant, and Tails Project's documentation on separated boot media.

## 4.3 Heads / coreboot

The layer below everything in this document. UEFI firmware loading GRUB (whether GRUB lives on the internal ESP per Part 1-3 or on a USB key per Part 4.2) is itself a black box you cannot audit. Heads is an open-source boot firmware based on coreboot that measures itself plus the kernel and initramfs into a TPM, verifies signatures, and refuses to proceed if anything was tampered with. The cleartext-on-the-laptop equivalent moves from "the ESP on internal storage" to "the SPI flash chip on the motherboard," which is a different physical chip than the SSD/NVMe and requires specialized hardware (SOIC clips, an external flasher) to modify undetectably.

Heads is hardware-specific. Supported hardware as of 2026 includes the ThinkPad X230, T430, T530, W530, X230T (the classic xx20/xx30-generation coreboot-friendly ThinkPad lineage); the Purism Librem laptops; the System76 laptops with their open firmware; the Dasharo-supported NovaCustom and MSI boards. Newer ThinkPads (post-2015 generally) have signed-firmware lockdowns that make coreboot installation harder or impossible without hardware modification. Haswell-generation ThinkPads (xx40 / W541 / T440p) have coreboot mainboard support but Heads payloads on those boards are less mature and the community support is thinner; treat them as research-grade rather than turnkey.

Why this matters for the Knots-lens / cold-storage operator threat model: every other item in this document assumes the firmware loading your OS is benign. If the firmware itself is compromised (BIOS rootkit, supply-chain interception, evil maid with a flasher), nothing in Parts 1-3 helps. Heads is the layer that makes that assumption checkable. It's not in this document as a procedure because hardware-specific install procedures don't generalize. It's named here, in Part 4, because the priority ordering for long-term security is: backups (3.1) → bootloader on USB (4.2) → Heads (4.3). Heads is the third leg.

If you're going to buy or repurpose hardware deliberately for this setup, Heads compatibility is the constraint to plan around. The classic answer is a used ThinkPad X230 or T430 in good condition; the modern answer is a Dasharo-supported board if you can afford new hardware. Documentation lives at osresearch.net (Heads) and dasharo.com.

**Haswell-generation ThinkPads (xx40 / T440p / X240 / T540p / W541).** This generation has coreboot mainboard support but the Heads payload on these boards is in a different state than on xx30 hardware. The T440p has the most active community work (the T440p-coreboot hackathon project has produced working images), and the X240 is reasonably documented. W541 and T540p have mainboard support but smaller user communities and rougher payload integration. The functional difference compared to X230/T430: install procedure is longer (often requires reflashing the embedded controller separately), the keyboard situation is contentious (the xx40 series shipped with a chiclet keyboard that many users replace with the older 7-row layout via aftermarket parts), and you're closer to "research user contributing back" than "stable user just running it." If you specifically want Haswell-generation hardware with Heads, plan on a weekend of setup work rather than the few hours that xx30 takes. The threat-model payoff is the same as xx30 (verified-boot via TPM, tamper-evident boot, modifiable everything); the per-user cost is higher.

**Pre-flashed Heads as an alternative to flashing yourself.** Nitrokey sells refurbished ThinkPads (currently X230, T430, X1 Carbon) with Heads pre-installed and a Nitrokey USB token paired to the laptop for boot attestation — green/red LED indicating whether the boot-chain measurement matches what was enrolled. This is the "I want Heads working without learning to use an SOIC clip" path. Covered in `choosing-hardware.md` under the NitroPad subsection. Hardware is xx30-generation so the Heads payload is mature; you pay for Nitrokey's flashing labor and QA rather than doing it yourself.

**Alternative for users not committing to Heads: Secure Boot with custom keys.** Devuan ships unsigned GRUB so the stock setup runs with Secure Boot off (named in the Architectural costs subsection of Part 1). Users who want to close the evil-maid ESP-tampering surface without going to Heads can replace Microsoft's default Secure Boot keys with their own, then sign their own GRUB and kernel images. The firmware will then refuse to load any boot artifact not signed by your key. Two tools cover this on Debian-family systems: `shim-signed` plus a custom Machine Owner Key enrolled via `mokutil`, or the `sbctl` userspace tool that handles key generation, enrollment, and signing in one workflow. The cost compared to Heads: the firmware itself remains a black box, only the boot chain above the firmware is verified — so an attacker who can modify the firmware (CMOS clear plus EEPROM write, supply-chain interception) defeats this. Heads checks the firmware itself; Secure-Boot-with-custom-keys checks only what the firmware loads. For supply-chain or nation-state threat models, Heads remains the answer. For lost-laptop or opportunistic-physical-access models, Secure Boot with custom keys is a meaningful step up from stock with much lower setup cost than Heads.

## 4.4 Btrfs root at next reinstall

The install script uses ext4 because it's the conservative default. Btrfs offers snapshots (instant point-in-time copies of the filesystem state, useful for "undo this kernel upgrade") and built-in compression. The cost: more complexity, occasional historical reports of corruption that ext4 doesn't have, and a different mental model.

If you're going to switch, do it at next reinstall rather than converting in place. Modify the install script's `mkfs.ext4` calls and the fstab options to use Btrfs with subvolumes for `@`, `@home`, `@var`, etc. The `snapper` package handles automated snapshot lifecycle. The detailed procedure is too long for this guide; consult upstream Btrfs documentation.

## 4.5 VM compartmentalization for Tor-routed work

When you need a Tor-anonymized workspace as a regular thing — research, source communication, anonymous accounts, IP-sensitive operations — running Tor or Tor Browser directly on the hardened host is the wrong answer. Non-browser apps still see the real network, browser fingerprinting bleeds across contexts, and one misconfigured app leaks the real IP. The right answer is Whonix: two VMs (Gateway plus Workstation) where the Workstation has no network interface other than the Gateway's internal NIC. The Workstation literally cannot see your real IP — by architecture, not by configuration discipline.

There are three isolation rungs. This section is the procedure for the recommended rung; the other two are referenced for completeness.

1. **Whonix VMs under your daily user account.** Full process isolation (VMs are separate kernels), full network isolation (Whonix architectural guarantee). Trust boundary: the Devuan host kernel plus KVM. If the host is compromised, both VMs are compromised. The working default.
2. **Whonix VMs under a separate Linux user account.** Adds a second boundary: if your daily-driver browser gets exploited, the attacker is in `user1` and cannot read `user2`'s VM images, libvirt sockets, or running VM memory. Conversely if the Workstation is popped and the attacker manages a guest-to-host escape, they land in `user2` with no access to your daily files. **The configuration this section walks through.**
3. **Whonix VMs under Qubes.** The maximalist configuration. Out of scope for this document — see `os.md` for the Qubes-Whonix entry. If your threat model supports Qubes, do Qubes-Whonix on Heads-coreboot hardware rather than the procedure below.

What rung 2 gets you that rung 1 doesn't:

- **X11 process isolation.** X11 has no inter-client isolation within a single X server: any X client can keylog any other, screen-grab any other, and inject keystroke events. Running virt-manager as the same user as your daily browser means a popped browser can spy on the VM management UI and the Workstation console. Running it as a separate user on a separate X server (separate VT, fresh greeter login) gives you real isolation. Same X server with `su` or `sudo -i` does **not** isolate — the new process inherits `$DISPLAY` and is just another client on the same server.
- **libvirtd socket access.** The system libvirt socket (`/var/run/libvirt/libvirt-sock`) is restricted to the `libvirt` group. If only the security user is in that group, the daily user cannot list, manage, or interact with the VMs at all.
- **VM disk file permissions.** qcow2 files in `/var/lib/libvirt/images/` are owned by `libvirt-qemu` and group-readable by the `libvirt` group. Daily user not in libvirt — cannot read the disk image at rest.
- **Running VM memory.** QEMU runs as `libvirt-qemu`, not as either of your users. Neither user can ptrace or `/proc/PID/mem`-read a running VM. The `libvirt` group membership is the only userspace handle on management; reading VM memory directly requires kernel-level escape.

What rung 2 trades:

- Two accounts to maintain. Updates, configuration drift, two sets of dotfiles.
- One switch-user step per anonymized session via LightDM's "Switch User" (or `dm-tool switch-to-greeter` from the command line).
- The Devuan host kernel is still the shared trust boundary. A kernel exploit or DMA attack against the host defeats both rungs equally. If that's your threat model, the answer is Heads plus Qubes-Whonix, not this.

### Install KVM and libvirt

Run at root:

```bash
sudo apt update
sudo apt install --no-install-recommends \
  qemu-system-x86 qemu-utils \
  libvirt-daemon-system libvirt-clients \
  virt-manager gir1.2-spiceclientgtk-3.0 \
  dnsmasq
```

`--no-install-recommends` keeps the closure tight. The Whonix wiki's KVM install page uses the same dependency set under the Debian alias `qemu-kvm` (which is a transitional package pointing at `qemu-system-x86`).

Start libvirtd. Devuan default is sysvinit; adjust for openrc/runit:

```bash
# sysvinit
sudo service libvirtd start
sudo update-rc.d libvirtd defaults

# OpenRC: sudo rc-service libvirtd start && sudo rc-update add libvirtd default
# runit:  sudo ln -s /etc/sv/libvirtd /var/service/
```

### Create the security user

```bash
sudo adduser secuser
sudo chmod 700 /home/secuser
sudo adduser secuser libvirt
sudo adduser secuser kvm
```

The whole point of the second account is that libvirt management is scoped to it. **Do not** add your daily user to `libvirt` or `kvm`. If your daily user is already in those groups from a previous setup:

```bash
sudo deluser <daily-user> libvirt
sudo deluser <daily-user> kvm
```

Confirm:

```bash
groups <daily-user>   # libvirt and kvm should be absent
groups secuser        # libvirt and kvm should be present
```

Group changes require a logout/login to take effect.

### USBGuard rule for the security user

Part 3.9 enables USBGuard with a default-deny posture for unknown devices. If you plan to pass USB devices into a Whonix VM (a hardware token, an audio interface, a specific USB stick for file transfer), the device must be allowlisted on the host before libvirt can pass it through. This is intentional: USBGuard is the first line; libvirt's device passthrough is the second.

Allow your device by adding to `/etc/usbguard/rules.conf`:

```
allow id 1050:0407 name "YubiKey 5" serial "..." via-port "1-2"
```

Replace VID:PID, name, serial, and via-port with what `usbguard list-devices` reports for your device. Reload:

```bash
sudo service usbguard restart
```

### Download and verify Whonix images

Log out of your daily user. Log in as `secuser` via the LightDM greeter. From `secuser`'s session, do the download in `secuser`'s home directory — not as the daily user with a `cp` across, since the daily user's downloads directory is outside the trust boundary you just established.

Get the current KVM image and signature from `https://www.whonix.org/wiki/KVM`. The current release at time of writing is 18.1.6.4 (April 2026); check the wiki for the version of the moment.

```bash
cd ~
wget https://download.whonix.org/libvirt/<current>/Whonix-XFCE-<version>.Intel_AMD64.qcow2.libvirt.xz
wget https://download.whonix.org/libvirt/<current>/Whonix-XFCE-<version>.Intel_AMD64.qcow2.libvirt.xz.asc
```

Verify the signature. The Whonix project's signing key is Patrick Schleizer's; fetch and verify the fingerprint per the procedure at `https://www.whonix.org/wiki/Whonix_Signing_Key`. Do not skip this step — the `.libvirt.xz` file is a multi-gigabyte blob from which you will be running code with kernel privileges inside the guest.

```bash
# Per the procedure on whonix.org/wiki/Whonix_Signing_Key:
gpg --import patrick.asc
gpg --fingerprint <key-id>   # confirm against the fingerprint published on whonix.org
gpg --verify Whonix-XFCE-*.libvirt.xz.asc Whonix-XFCE-*.libvirt.xz
```

The output must say "Good signature" and the fingerprint must match the one published on the Whonix Signing Key wiki page. Anything else: stop and re-download from a different mirror.

Extract:

```bash
tar -xvf Whonix-XFCE-*.libvirt.xz
```

This produces two qcow2 images (`Whonix-Gateway-*.qcow2`, `Whonix-Workstation-*.qcow2`), two network XML files (`Whonix_external*.xml`, `Whonix_internal*.xml`), and two VM definition XML files (`Whonix-Gateway*.xml`, `Whonix-Workstation*.xml`).

### Import into libvirt

The Whonix images need to live where `libvirt-qemu` can read them. Default pool is `/var/lib/libvirt/images/`:

```bash
sudo mv Whonix-Gateway-*.qcow2 /var/lib/libvirt/images/
sudo mv Whonix-Workstation-*.qcow2 /var/lib/libvirt/images/
sudo chown libvirt-qemu:libvirt-qemu /var/lib/libvirt/images/Whonix-*.qcow2
sudo chmod 600 /var/lib/libvirt/images/Whonix-*.qcow2
```

Define and start the two networks:

```bash
virsh -c qemu:///system net-define Whonix_external*.xml
virsh -c qemu:///system net-define Whonix_internal*.xml
virsh -c qemu:///system net-autostart Whonix-External
virsh -c qemu:///system net-start Whonix-External
virsh -c qemu:///system net-autostart Whonix-Internal
virsh -c qemu:///system net-start Whonix-Internal
```

`Whonix-External` is a NAT'd network connecting the Gateway to the host's outbound interface. `Whonix-Internal` is an isolated network between Gateway and Workstation — no route to the host, no DHCP from libvirt's dnsmasq, no path to the internet except through the Gateway's Tor process. This is the architectural property that makes Whonix's IP-leak resistance hold.

Define and start the VMs (Gateway first; Workstation will not get network until Gateway is up):

```bash
virsh -c qemu:///system define Whonix-Gateway*.xml
virsh -c qemu:///system define Whonix-Workstation*.xml
virsh -c qemu:///system start Whonix-Gateway
virsh -c qemu:///system start Whonix-Workstation
```

First boot will prompt you to accept the Whonix license, choose persistent or live mode, and run `upgrade-nonroot` to apply outstanding security updates. Follow the on-screen prompts. To make the VMs start automatically when `secuser` logs in:

```bash
virsh -c qemu:///system autostart Whonix-Gateway
virsh -c qemu:///system autostart Whonix-Workstation
```

### Interactions with the rest of this doc

**AppArmor (Part 3.6).** The `libvirt-daemon-system` package installs an AppArmor profile for libvirtd and dynamically generates a per-VM profile (`libvirt-<uuid>`) when each VM starts. These work with your existing AppArmor setup without configuration changes. Run `sudo aa-status` after first VM start; the dynamic profiles appear in the enforced list. That is the desired state.

**Encrypted DNS (Part 3.8).** dnscrypt-proxy on the host runs on `127.0.0.1:53` and the host's `resolv.conf` points there. The Whonix Gateway runs its own DNS (Tor's DNSPort) and the Workstation queries the Gateway — neither VM touches the host's dnscrypt-proxy. This is correct: you do not want your Tor-routed DNS lookups going through your clearnet resolver even when that resolver is encrypted.

**MAC randomization (Part 3.7).** libvirt generates MAC addresses for each VM's virtual NIC; these are stable per-VM by default and serve as VM identifiers, not real hardware addresses. The host's physical-NIC randomization continues to work; the VMs do not see the host's MAC.

**USBGuard (Part 3.9).** Covered above. The host's USBGuard policy is the gatekeeper; libvirt's USB passthrough cannot pass a device that USBGuard has blocked.

**Thunderbolt and IOMMU (Part 3.10).** VT-d / AMD-Vi is already enabled per Part 3.10. KVM uses IOMMU for safe device passthrough; no additional configuration. If you do PCI passthrough of a discrete device into a VM (rare for Whonix; common for graphics-accelerated VMs), the IOMMU groups from Part 3.10 are what you'll be working against.

**nftables (Part 3.11).** libvirt manages its own iptables/nft rules for `virbr0` (the default NAT bridge) and for the Whonix-External NAT. These rules live in libvirt-managed chains and do not conflict with the default-deny INPUT chain from Part 3.11. Confirm with `sudo nft list ruleset | grep libvirt` after libvirtd starts. If your Part 3.11 ruleset sets the FORWARD chain to default-drop, allow libvirt's forward chain explicitly or set FORWARD to accept and let libvirt's per-network rules do the filtering.

**Kernel lockdown (Part 3.12).** If you enabled Part 3.12, KVM's kernel module loading is unaffected (modules are signed by the distribution kernel build). Custom out-of-tree KVM modules would need MOK signing per Part 3.12's DKMS note.

### Daily workflow

To use the anonymous workspace from your daily session: open XFCE's user menu and select "Switch User" (which calls LightDM), or from a terminal:

```bash
dm-tool switch-to-greeter
```

Log in as `secuser` from the greeter. This spawns a fresh X server on a fresh VT. If autostart is configured, the Whonix VMs come up at login; otherwise:

```bash
virsh -c qemu:///system start Whonix-Gateway
virsh -c qemu:///system start Whonix-Workstation
virt-manager
```

To return to your daily session: shut the VMs cleanly first (`virsh -c qemu:///system shutdown Whonix-Workstation`, then Gateway), log out of `secuser`, which kills its X session. Switch back to your daily session via the LightDM greeter or the appropriate VT (typically Ctrl+Alt+F7 or F8 depending on slot).

**Do not** use `su - secuser` or `sudo -u secuser virt-manager` from your daily session. That puts virt-manager on your daily X server with `$DISPLAY` inherited, defeating the X11 isolation that was the entire point of the separate account.

### What this configuration does not defend against

- **Kernel exploits and DMA attacks against the Devuan host.** Both rung 1 and rung 2 share the host kernel; either gets you fully owned by a host-kernel exploit. If this is your threat model: Heads coreboot plus Qubes-Whonix, not Devuan.
- **Operational deanonymization.** Logging into a real-name account from the Whonix Workstation. Reusing usernames or browser fingerprints across personas. Posting on a schedule that correlates with your identified accounts. The OS does not save you from yourself; this is the layer no software can provide.
- **Compromised Whonix image at download.** Signature verification per the procedure above covers the case of a tampered file at the mirror. It does not cover the case where the signing key itself is compromised or the Whonix project is compelled to sign a backdoored image. Use the Tor-routed download mirror from the Whonix wiki for that, and pin the signing key once you have it.
- **Side channels between guest and host.** Spectre-class CPU side-channels can leak across VM boundaries. Microcode (Part 3.2) and `mitigations=auto,nosmt` on the kernel command line (Part 3.5) reduce the surface; they do not close it. For threat models that include side-channel attackers, the answer is physically separate hardware, not VMs on shared hardware.

## 4.6 TPM2 PIN-binding

Plain TPM2-sealed unlock (Part 4.1) ties the LUKS unlock to PCR measurements of the boot chain — the disk decrypts automatically if the boot chain looks unchanged. This solves the "passphrase prompt at boot" usability problem but introduces a different failure: an attacker who steals the laptop and just boots it gets the disk decrypted as far as the login screen. PCR-binding alone does not require the legitimate user to be present; it only requires the legitimate boot chain.

TPM2 PIN-binding adds a typed PIN to the unlock condition. The TPM releases the LUKS key only if BOTH the PCR measurements match AND the user types the correct PIN within a small number of attempts. The PIN is rate-limited at the TPM level (typically 32 attempts before lockout, with the count persisting across reboots), so brute-forcing the PIN through the TPM is infeasible even with weak PINs. A six-digit PIN is sufficient against the TPM's rate-limiting; an eight-digit PIN is overkill.

Configuration with systemd-cryptenroll (available on Devuan via systemd-utilities, even though Devuan doesn't use systemd as init):

```bash
# enroll the TPM2 with both PCR binding and PIN
sudo systemd-cryptenroll \
    --tpm2-device=auto \
    --tpm2-pcrs=0+1+2+3+7 \
    --tpm2-with-pin=yes \
    /dev/nvme0n1p2

# remove the previous TPM2 entry (without PIN) if you had one
sudo systemd-cryptenroll --wipe-slot=tpm2 /dev/nvme0n1p2
# then re-enroll with PIN per above
```

At boot, the initramfs prompts for the PIN. If the PIN matches AND the PCR state matches, the TPM releases the LUKS unlock key and the boot continues. If either condition fails, the boot falls through to the passphrase fallback (your original LUKS passphrase from the install script), so you're not locked out — you've just lost the convenience.

When PIN-binding makes sense:

- Laptop you carry. Loss/theft is part of the threat model. The TPM-only setup gives an attacker the disk; TPM+PIN forces the attacker to either know the PIN, brute-force through TPM rate-limiting (infeasible), or fall back to attacking the LUKS passphrase directly (which they could have done without TPM2 anyway).
- You want the TPM2 convenience but not the security regression of plain TPM2.

When plain TPM2 (4.1) without PIN is enough:

- Desktop in a physically secured space (locked office, secured home), so theft-while-running is not the threat model. The TPM-only setup gives convenience for the legitimate user; the threat model assumes the attacker doesn't get the physical machine.
- The threat model worries about disk theft (the disk is removed from the machine), not whole-machine theft. Plain TPM2 covers this — the disk alone won't decrypt without the TPM it was paired with.

Pick PIN-binding for laptops, plain TPM2 only for physically secured desktops. The PIN prompt at boot is faster than the LUKS passphrase prompt (the PIN is much shorter than a LUKS passphrase by design) so the usability hit is modest. PCR list `0+1+2+3+7` covers firmware, option ROMs, kernel measurements, and Secure Boot policy — adjust based on what you want the boot chain to be sensitive to.

A note on Devuan specifically: systemd-cryptenroll lives in the `systemd-utilities` package and works without systemd as init, since the cryptenroll tool is a userspace utility that just talks to the TPM and writes LUKS metadata. The initramfs side, where the TPM is queried at boot, uses the `tpm2-tools` package and a custom unlock script (systemd's `systemd-cryptsetup` is not available without systemd as init). The Arch Wiki's dm-crypt page documents the manual initramfs hook required. This is the kind of work that's "doable but not turnkey" on Devuan — the kernel support is fine, the tooling exists, the initramfs glue requires manual setup.

---

# Part 5: Recovery from failed boot

When something breaks, the recovery path is: boot from the install USB in live mode, manually decrypt the LUKS volume, mount it, chroot in, fix the thing.

```bash
# Live USB shell, after booting the Devuan installer in live mode
sudo cryptsetup open /dev/nvme0n1p2 crypt
sudo vgchange -ay vg0
sudo mount /dev/vg0/root /mnt
sudo mount /dev/vg0/boot /mnt/boot
sudo mount /dev/vg0/home /mnt/home
sudo mount /dev/nvme0n1p1 /mnt/boot/efi
sudo mount --bind /dev /mnt/dev
sudo mount --bind /dev/pts /mnt/dev/pts
sudo mount --bind /proc /mnt/proc
sudo mount --bind /sys /mnt/sys
sudo mount --bind /run /mnt/run
sudo chroot /mnt
```

You're now inside the broken system as root. Common fixes from here:

- Bad GRUB kernel parameter: edit `/etc/default/grub`, `update-grub`.
- Broken initramfs: `update-initramfs -u -k all`.
- Bad package: `apt install --reinstall <package>` or `dpkg --remove --force-all <package>` and reinstall fresh.
- Forgotten user password: `passwd <username>`.
- Locked-out from sudo: `usermod -aG sudo <username>`.

After fixes, exit the chroot:

```bash
exit
sudo umount -R /mnt/dev /mnt/proc /mnt/sys /mnt/run
sudo umount /mnt/boot/efi /mnt/boot /mnt/home /mnt
sudo vgchange -an vg0
sudo cryptsetup close crypt
sudo reboot
```

If the LUKS volume itself refuses to open with the correct passphrase, the header is damaged. Restore the header backup from Part 2.1:

```bash
age -d ~/luks-header.bin.age > /tmp/luks-header.bin
sudo cryptsetup luksHeaderRestore /dev/nvme0n1p2 --header-backup-file /tmp/luks-header.bin
shred -u /tmp/luks-header.bin
```

This is destructive (it overwrites the on-disk header with the backup). Be sure you have the right backup file before running it.

---

# Appendix A: Changing the LUKS passphrase

Every six to twelve months, or whenever you suspect the passphrase may have been observed, change it. The procedure is:

```bash
sudo cryptsetup luksChangeKey /dev/nvme0n1p2
```

Enter the existing passphrase, then the new one, twice. The change takes a few seconds (PBKDF2 iterations).

After the change:

1. Take a new LUKS header backup per Part 2.1. The old backup contains the old passphrase's key slot and will not unlock with the new one.
2. Destroy the old encrypted header backup files. Replace them with the new one in every location they live.
3. If you have TPM2-sealed unlock enrolled (Part 4.1), re-enroll it; the old TPM-sealed key references the old key slot.

To add a second passphrase (recovery passphrase, written on paper, kept in a safe) without removing the first:

```bash
sudo cryptsetup luksAddKey /dev/nvme0n1p2
```

Enter an existing passphrase to authenticate, then the new one. Two passphrases now unlock the disk; either works at boot. Useful for a high-entropy daily passphrase plus a written recovery passphrase you'd never type but could find in an emergency.

To remove a passphrase:

```bash
sudo cryptsetup luksRemoveKey /dev/nvme0n1p2
```

It prompts for the passphrase to remove (the one you're getting rid of, not the one you're keeping). Confirm the remaining passphrase still works before walking away from the keyboard.

---

# Appendix B: Threat model and trade-offs

This setup defends against:

- A stolen powered-off laptop. The disk is encrypted; the thief gets a brick.
- Casual local users on a logged-in but locked machine. The screen lock plus tmpfs `/tmp` permissions plus AppArmor confines what a curious passerby can do.
- Most opportunistic malware. AppArmor confines browsers and document viewers; the sysctl tightening closes the standard local-priv-esc paths; kernel lockdown denies rootkit persistence; encrypted DNS prevents the most common network manipulation.
- Network observers on shared WiFi. MAC randomization plus encrypted DNS plus regular HTTPS gives a normal user a hostile-network posture comparable to what a corporate VPN gives a remote employee.
- Long-term data linkability via ISP DNS logs. Encrypted DNS to a no-log resolver moves the trust point from "definitely logged" to "claims not to log."

It does not defend against:

- A powered-on laptop with the screen unlocked. The data is decrypted in memory; nothing here helps once the attacker has hands on the keyboard with a logged-in session.
- A nation-state with physical access to a powered-off machine. Cold-boot attacks on suspended laptops, evil-maid attacks on a stationary target, firmware-level implants, supply-chain interception. Kernel lockdown plus Heads coreboot plus a TPM with PCR-bound unlock raises the bar but does not close the category. If this is your threat model, Qubes-Whonix on Heads-coreboot hardware is the starting point, not Devuan.
- A user who runs malware as themselves. AppArmor mitigates; it does not prevent. The user clicked the thing.
- Compelled disclosure. A government with rubber hoses gets the passphrase. The narrow technical exception (VeraCrypt hidden volumes) is not part of this setup and is high-stakes in its own right.
- Backup loss. Off-machine backups are good; they don't help if both the original and the backup live in the same building during a fire.

---

# Appendix C: What this doesn't cover

Things deliberately out of scope:

- **Host integrity monitoring** (file integrity, package integrity, configuration drift). Covered in the separate `choosing-hids-tools.md` companion. Recommendation: install AIDE, debsums, and auditd from the apt repository; do not write a bespoke monitor.
- **Browser hardening**. Tor Browser, LibreWolf, and arkenfox are the three meaningful tracks. Browser choice is a separate document and is part of a separate decision (privacy from websites, not from local attackers).
- **Hardware tokens** (open-hardware preferred). Worth using for SSH keys, sudo authentication, GPG signing, and 2FA. The integration is straightforward (`pam_u2f`, `gpg-agent`, OpenSSH FIDO support). For a sovereignty-focused setup, the default is Nitrokey 3 (German, firmware open-source, Trussed framework in Rust, mature ecosystem). Open-all-the-way-down options are Tillitis TKey (RISC-V, fully open hardware, measured-boot-per-application model) and Precursor (open silicon, FPGA-based, pocket-device form factor; the answer when you mean "verify everything yourself"). YubiKey is widely used and reliable but its firmware is closed and unauditable — coherent only if you accept "trust Yubico's claims" as a primitive. Covered more fully in the master security overview and in the privacy-setup companion guide.
- **Password manager**. KeePassXC is the standard open answer — local-first (no cloud sync forced on you), C++ with a long track record, format compatible with the broader KeePass ecosystem (KeePass2 on Windows, KeePassDX on Android, MacPass on macOS). For cloud-sync, syncthing the KDBX database across machines or store it in your Borg backup. Don't use anything where the vendor has the keys.
- **Air-gapped signing machine**. The Knots-lens / cold-storage operator practice is to keep high-value cryptographic operations (Bitcoin signing, GPG primary-key operations, code release signing) on a separate, never-online machine. This document covers the daily-driver online workstation; the air-gapped machine is a different setup with different priorities (deterministic boot, manual update discipline, no networking hardware). The two-machine architecture is the Knots-default; this doc is one half of it.
- **Whonix-Gateway as a network filter**. A lighter alternative to the full two-VM Whonix setup in Part 4.5: run only the Gateway and point a specific browser or VM at its SOCKS port. Lower friction; protects only the applications you remember to route through it. The full configuration (both VMs, optionally on a separate user account) lives in Part 4.5 of this doc. Broader Whonix context and the Qubes-Whonix path are in `os.md`.
- **Dotfiles management** (storing shell config, SSH config, GIT config across machines under version control with encrypted-secrets support). Covered in `privacy-setup.md`. Key keys (SSH and GPG private keys) do NOT belong in any dotfiles repo, encrypted or not; the repo configures the *use* of keys, the keys themselves are separately managed.
- **fail2ban for SSH brute-force protection.** This document does not install an SSH server by default; without `sshd`, fail2ban has nothing to protect and is unused. If you enable sshd for remote access (`apt install openssh-server`), install fail2ban as the standard companion (`apt install fail2ban`). Default configuration ships with sensible jails for sshd and a 10-minute ban after 5 failed attempts. Disable password authentication in `/etc/ssh/sshd_config` (set `PasswordAuthentication no`) and require key-based auth as a pre-condition; fail2ban then protects against brute-force on the key-auth side and against script-kiddie scanning generally.
