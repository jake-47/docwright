# Full Disk Encryption with LUKS2 + LVM on Devuan

*/boot inside encrypted volume, single passphrase at boot*

**Last updated:** 2026-04-14
**Tested on:** Devuan Daedalus 5.0, amd64, NVMe disk


## Before you begin

Download the non-free firmware ISO from:
```
https://www.devuan.org/get-devuan
```

Look for:
```
devuan_daedalus_5.0_amd64_non-free-firmware.iso
```

Use the non-free firmware ISO — it includes WiFi and other hardware firmware so everything works after install.


## Part 1 — Boot from the Devuan USB

Power on with the Devuan USB inserted. Select **"Install"** from the boot menu.


## Part 2 — Drop to a shell immediately

On the first installer screen, before selecting anything, press **Alt+F2**.

We partition the disk here before the installer touches it. If the installer creates partitions first it holds the disk open and the kernel cannot re-read the partition table — partitions will disappear from `/dev` later.

### Create partitions

```bash
fdisk /dev/nvme0n1
```

Follow each prompt exactly. Commands are in code blocks. What you see on screen is in quotes.


```
g
```
> "Created a new GPT disklabel"


```
n
```
> "Partition number (1-128, default 1):" → **Enter** (default)

> "First sector:" → **Enter** (default)

> "Last sector:"

```
+1G
```

> "Created a new partition 1 of type 'Linux filesystem' and of size 1 GiB"

If prompted: "Partition #1 contains a vfat signature. Do you want to remove the signature?"

```
y
```


```
t
```
> "Partition type or alias (type L to list all):"

```
1
```
> "Changed type of partition 'Linux filesystem' to 'EFI System'"


```
n
```
> "Partition number (1-128, default 2):" → **Enter** (default)

> "First sector:" → **Enter** (default)

> "Last sector:" → **Enter** (uses rest of disk)

If prompted: "Partition #2 contains a signature. Do you want to remove the signature?"

```
y
```


```
p
```

Confirm you see:
- `nvme0n1p1` — 1 GB — EFI System
- `nvme0n1p2` — remainder — Linux filesystem

The 1 MB free space at the top and 335 KB at the bottom are normal GPT gaps — ignore them.


```
w
```
> "The partition table has been altered. Syncing disks."

### Format the ESP

```bash
mkfs.fat -F 32 /dev/nvme0n1p1
```

Warnings about codepage 850 and ANSI conversion are harmless — ignore them.

### Confirm both partitions exist

```bash
ls /dev/nvme0n1*
```
> Expected: `nvme0n1  nvme0n1p1  nvme0n1p2`


## Part 3 — Set up LUKS2

```bash
cryptsetup luksFormat --type luks2 --pbkdf pbkdf2 --cipher aes-xts-plain64 --key-size 512 --hash sha256 /dev/nvme0n1p2
```

> "Are you sure? (Type 'YES' in capital letters):"

```
YES
```

Enter your LUKS passphrase twice.

> **This passphrase encrypts your entire disk. There is no recovery if you forget it. You will type it once at every boot.**

**Why `--pbkdf pbkdf2`?** GRUB cannot process Argon2id, which is LUKS2's default KDF. PBKDF2 allows GRUB to unlock the container at boot. The initramfs uses a keyfile for the second unlock, bypassing the KDF entirely — no security penalty. This is the unavoidable tradeoff of keeping `/boot` inside the encrypted volume.

### Open the container

```bash
cryptsetup luksOpen /dev/nvme0n1p2 crypt
```


## Part 4 — Set up LVM

Check your RAM if you want hibernation:

```bash
free -h
```

| Situation | Swap size |
|---|---|
| No hibernation needed | 4G |
| Want hibernation | Match your RAM (e.g. 16G for 16 GB RAM) |

> **Hibernation** saves everything to disk and powers off. **Suspend** saves to RAM and uses minimal power. Most users want suspend, not hibernation.

```bash
pvcreate /dev/mapper/crypt
vgcreate vg0 /dev/mapper/crypt
lvcreate -L 1G -n boot vg0
lvcreate -L 4G -n swap vg0
lvcreate -L 40G -n root vg0
lvcreate -l 100%FREE -n home vg0
```

**What each volume does:**

| Volume | Size | Purpose |
|---|---|---|
| boot | 1G | Kernel and bootloader files. A few hundred MB used; 1G gives headroom for multiple kernels. |
| swap | 4G | Virtual memory. Match your RAM if you want hibernation. |
| root | 40G | OS, applications, libraries, package cache. Go 60–80G for heavy dev work. |
| home | Remainder | Personal files — documents, downloads, browser profiles, etc. |

### Format the volumes

```bash
mkfs.ext4 /dev/vg0/boot
mkfs.ext4 /dev/vg0/root
mkfs.ext4 /dev/vg0/home
mkswap /dev/vg0/swap
```

### Verify

```bash
ls /dev/mapper/
```
> Expected: `control  crypt  vg0-boot  vg0-home  vg0-root  vg0-swap`

```bash
ls /dev/vg0/
```
> Expected: `boot  home  root  swap`


## Part 5 — Return to installer

Press **Alt+F1**.

Work through the installer screens:

### Language, Location, Keyboard
Select your preferences.

### Network
- **WiFi:** Select the wireless interface (usually `wlan0`), then WPA/WPA2 PSK, then enter your password.
- **Ethernet:** Select the wired interface — connects automatically.

### Hostname
Use something generic like `host` or `workstation`. Avoid your real name or location — the hostname appears in logs and network traffic.

### Domain name
Leave blank, press Enter.

### Root account
Leave the root password **empty** to lock the root account. This disables direct root login. You use `sudo` for all privileged commands instead.

### Full name
Leave blank or use a pseudonym. No functional purpose on a personal machine.

### Username
Lowercase, no spaces. Avoid your real name — it appears in file paths and logs.

### Login password
Used at the login screen and for `sudo`. At least 12 characters, mix of types. **Do not reuse your LUKS passphrase.**


## Part 6 — Partition Disks screen

Select **"Manual"**.

You will see:
```
/dev/nvme0n1 512GB
  1.0MB free space
  #1  1GB   ESP
  (remaining space — no label)
  335KB free space
```

- The 1.0 MB and 335 KB entries are normal GPT gaps — ignore them.
- The unlabelled remaining space is `nvme0n1p2` (your LUKS container) — do not touch it.
- Phantom partitions under `nvme0n1` may appear — stale cached view. Ignore everything under `nvme0n1` except `p1`.

Select **"Configure the Logical Volume Manager"**.

> "Keep current partition layout and configure LVM? Yes/No" → **Yes**

You will see the LVM configuration summary. Select **"Continue"**, then **"Finish"**, then **"Finish"** again.


## Part 7 — Assign mount points

Volumes appear in this order: boot, home, root, swap. For each: select the **#1 entry** → set "Use as" → set mount point → select **"Done setting up the partition"**.

**vg0 LV boot (1.1 GB)**
- Use as: ext4 journaling file system
- Mount point: `/boot`

**vg0 LV home (461 GB)**
- Use as: ext4 journaling file system
- Mount point: `/home`

**vg0 LV root (42.9 GB)**
- Use as: ext4 journaling file system
- Mount point: `/`

**vg0 LV swap (4.3 GB)**
- Use as: swap area

**nvme0n1p1** — already set as EFI System Partition. Leave it alone.

**nvme0n1p2** — do not touch.

> "Bootable flag: off" — leave it off. On GPT/EFI this flag is meaningless.

Confirm your layout:
```
vg0-boot   1.1GB   ext4   /boot
vg0-home   461GB   ext4   /home
vg0-root   42.9GB  ext4   /
vg0-swap   4.3GB   swap
nvme0n1p1  1GB     ESP
```

Select **"Finish partitioning and write changes to disk"**.

If prompted: "No partition table changes... Continue?" → **Yes**

If prompted: "Partition #2 has been written but we have been unable to inform the kernel of the change" → **Ignore** — normal and safe.


## Part 8 — Remaining installer steps

### Mirror and proxy
Select your country mirror. Leave HTTP proxy blank.

### Package usage survey
Select **No**.

### Software selection

| Option | Recommendation |
|---|---|
| Devuan desktop environment | Select |
| XFCE | Recommended — lightweight, stable, low resource use |
| GNOME | Heavier, more modern, higher RAM use |
| KDE Plasma | Feature-rich, highly customisable, higher RAM use |
| Standard system utilities | Always select |

Recommended for a privacy-focused desktop: **XFCE + Standard system utilities**

### Init system
Select **sysvinit** — Devuan's init system, avoids systemd.


## Part 9 — GRUB install

The installer will attempt to install GRUB and fail, because `GRUB_ENABLE_CRYPTODISK=y` is not set yet. You fix this mid-install from the installer's shell, then retry — and it succeeds.

Your firmware may first show prompts:

**"Force GRUB install to EFI removable media path?"** → **Yes**

**"Update NVRAM variables to automatically boot into Devuan?"** → **Yes**

The installer will then show:
> "Unable to install GRUB in dummy — this is a fatal error"

Select **Go Back**. You will be returned to the installer menu.

### Fix GRUB_ENABLE_CRYPTODISK from the installer shell

From the installer menu, select **"Execute a shell"**.

```bash
echo 'GRUB_ENABLE_CRYPTODISK=y' >> /target/etc/default/grub
```

Verify it was written:

```bash
grep GRUB_ENABLE_CRYPTODISK /target/etc/default/grub
```

Should show: `GRUB_ENABLE_CRYPTODISK=y`

```bash
exit
```

### Retry the GRUB install

Back in the installer menu, select **"Install the GRUB boot loader"** again.

This time it will succeed — no fatal error. The installer writes a GRUB EFI image with cryptodisk support baked in, capable of unlocking your LUKS container at boot.

Let the rest of the install finish. **Do not reboot when prompted.**


## Part 10 — Configure before first boot

**This is the most critical part. Do not skip or reorder any steps.**

From the installer menu, select **"Execute a shell"**.

The installer has already mounted everything under `/target`. Confirm before chrooting:

### Check mounts

```bash
mount | grep /target
```

Expect to see: `vg0-root` on `/target`, `vg0-boot` on `/target/boot`, `devtmpfs` on `/target/dev`, `proc` on `/target/proc`, `sysfs` on `/target/sys`, and `nvme0n1p1` on `/target/boot/efi`.

If anything is missing, mount only what is needed:

```bash
mount /dev/vg0/root /target
mount /dev/vg0/boot /target/boot
mount --bind /dev /target/dev
mount --bind /proc /target/proc
mount --bind /sys /target/sys
mkdir -p /target/boot/efi
mount /dev/nvme0n1p1 /target/boot/efi
```

### Chroot into the installed system

```bash
chroot /target
```

Your prompt will change. You are now inside the installed system.

### Confirm cryptsetup-initramfs is installed

```bash
dpkg -l | grep cryptsetup-initramfs
```

If nothing is returned, install it:

```bash
apt install cryptsetup-initramfs
```

The Devuan installer does not set up encryption itself — you did it manually before the installer ran. It may not have pulled in this package. Without it, the initramfs has no crypto support at all: no modules, no unlock scripts. Nothing will work.

### Confirm the LUKS container is mapped

```bash
ls /dev/mapper/crypt
```

If it does not exist, re-open it:

```bash
cryptsetup luksOpen /dev/nvme0n1p2 crypt
```

The initramfs build process needs the LUKS device to be open and mapped. It inspects the live device to determine which crypto modules to pack into the image. If `/dev/mapper/crypt` is missing when `update-initramfs` runs, the resulting initramfs will be missing the modules needed to unlock the disk at boot.

### Create the keyfile

```bash
mkdir -p /etc/luks
dd if=/dev/urandom of=/etc/luks/keyfile.key bs=4096 count=1
chmod 600 /etc/luks/keyfile.key
chown root:root /etc/luks/keyfile.key
```

### Add the keyfile to the LUKS container

```bash
cryptsetup luksAddKey /dev/nvme0n1p2 /etc/luks/keyfile.key
```

Enter your LUKS passphrase when prompted.

### Write crypttab

```bash
echo 'crypt /dev/nvme0n1p2 /etc/luks/keyfile.key luks' > /etc/crypttab
```

### Tell initramfs to include cryptsetup and the keyfile

```bash
echo 'CRYPTSETUP=y' >> /etc/cryptsetup-initramfs/conf-hook
echo 'KEYFILE_PATTERN="/etc/luks/*.key"' >> /etc/cryptsetup-initramfs/conf-hook
```

`CRYPTSETUP=y` forces cryptsetup into the initramfs. In a chroot, auto-detection of encrypted devices can fail — this bypasses it. `KEYFILE_PATTERN` tells the initramfs builder which keyfiles to include. By default it ignores all keyfiles listed in crypttab. Without these lines, the initramfs either lacks crypto support entirely or has no keyfile, and the system drops to an initramfs shell at boot.

### Restrict initramfs permissions

```bash
echo 'UMASK=0077' >> /etc/initramfs-tools/initramfs.conf
```

The initramfs image now contains private key material. This sets the umask so the resulting `/boot/initrd.img-*` files are readable only by root, preventing non-privileged users from extracting the keyfile.

### Rebuild initramfs

```bash
update-initramfs -u -k all
```

Devuan installs two kernels by default — you will see output for both.

### Verify the keyfile is in the initramfs

```bash
ls /boot/initrd.img-*
```

Note the kernel string, then run for each:

```bash
lsinitramfs /boot/initrd.img-<your-kernel-string> | grep "^cryptroot/keyfiles/"
```

Expected: `cryptroot/keyfiles/crypt.key` — the tool renames the keyfile automatically using the first field of crypttab. If nothing is returned, do not reboot — check crypttab and rebuild.

### Exit chroot and return to installer

```bash
exit
exit
```

This returns you to the installer menu. Let the installer finish and reboot from there — it runs cleanup tasks before rebooting.


## Part 11 — What to expect at every boot

1. Firmware loads GRUB from the ESP
2. GRUB prompts: **"Enter passphrase for /dev/nvme0n1p2"** — type your LUKS passphrase **once**
3. GRUB unlocks LUKS2, activates LVM, reads kernel and initramfs from `vg0/boot`
4. Initramfs finds the keyfile (packed inside the initramfs image) and unlocks root automatically
5. Devuan boots to login — **no second passphrase prompt**

**Why is the keyfile secure?** The keyfile is inside the initramfs, which lives on `vg0/boot`, which is inside the LUKS2 container. An attacker with physical access cannot reach the initramfs or keyfile without your passphrase first. The keyfile only becomes accessible after GRUB has already unlocked the container.


## Part 12 — Harden /tmp after first boot

Open a terminal after logging in:

```bash
sudo nano /etc/fstab
```

Add at the bottom:

```
tmpfs /tmp tmpfs defaults,noexec,nosuid,nodev,nosymfollow,size=2G 0 0
```

Save and exit, then verify:

```bash
sudo mount -a
mount | grep tmp
```

You should see `tmpfs` mounted on `/tmp`. If you get an error, check the fstab line for typos before rebooting — a bad fstab entry can drop you into emergency mode.

**What each option does:**

| Option | Effect |
|---|---|
| `noexec` | Nothing in /tmp can be executed — blocks a common malware landing spot |
| `nosuid` | Prevents privilege escalation via setuid binaries in /tmp |
| `nodev` | Prevents device files in /tmp |
| `nosymfollow` | Prevents symlink attacks. Linux-specific (requires kernel 5.10+, Daedalus ships 6.1) |
| `size=2G` | Ceiling, not reserved RAM. tmpfs only uses what it needs. Bump to 4G for heavy compiling or video work |

Contents clear automatically on every reboot.


## Appendix A — Changing the LUKS passphrase later

If you ever need to change your passphrase (without losing the keyfile slot):

```bash
cryptsetup luksChangeKey /dev/nvme0n1p2
```

To see which key slots are in use:

```bash
cryptsetup luksDump /dev/nvme0n1p2 | grep ENABLED
```


## Appendix B — Notes on security tradeoffs

- **PBKDF2 vs Argon2id:** GRUB cannot use Argon2id, so PBKDF2 is required for the LUKS header. This is a known limitation of GRUB-based encrypted `/boot` setups — not a flaw in this guide.
- **Keyfile in initramfs:** The keyfile is encrypted inside the LUKS container and only accessible after your passphrase is entered. It does not weaken security.
- **Root account locked:** No direct root login is possible. All admin actions require `sudo` and your login password.
- **Separate /home:** Keeping `/home` on its own LV allows reinstalling root without wiping personal data (as long as you do not reformat `/home` during reinstall).