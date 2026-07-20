# Choosing Encryption Tools

A guide to encrypting your files, folders, and disks when you've left Windows and Mac for Linux. Written for beginners. Updated as things change.

## TL;DR

If you're still on Windows or macOS and reading this, the highest-leverage move you can make is leaving. Both platforms encrypt your disk by default and then quietly hand the keys to the vendor. BitLocker uploads your recovery key to your Microsoft account. Apple holds your iCloud encryption keys unless you've gone out of your way to turn on Advanced Data Protection. You are not the only one who can decrypt your data on those systems. This is upstream of every other encryption decision you'll make.

Migrate to Linux. The companion OS guide `os.md` covers picking a distro. Once you're there, encryption gets simple:

- **Encrypt your laptop disk.** Enable LUKS at install. Every Linux installer offers a checkbox. This solves "stolen laptop" once and forever.
- **Backups.** The backup tool encrypts the archive itself; choosing among Borg, Restic, and the rest is covered in `choosing-backup-tools.md`.
- **Cloud-synced folders.** Cryptomator on top of whatever sync provider you tolerate, or move to a provider that does end-to-end encryption natively (Proton Drive, Tresorit, Mega).
- **Encrypting a single file to keep for yourself.** GPG to your own key if you already keep one for `pass` and signing, since it adds no new tool and no new key to back up; age if you do not run GPG.
- **Sending an encrypted file to someone.** age. The recipient can install it in one minute on any platform.
- **Encrypted vault on a USB stick that has to work on Linux, Mac, and Windows.** VeraCrypt today; LUKSbox once it leaves pre-1.0; not BitLocker To Go (recovery keys go to Microsoft).
- **GUI drag-and-drop for one file.** Picocrypt.
- **Plausible deniability under coercion.** VeraCrypt hidden volumes, the only tool in this category, and the Windows side of it is at risk through 2026 (more below).

If you've never encrypted a file in your life and you don't know where to start, do this in order: turn on LUKS the next time you reinstall, install Borg and back up your home directory once a week (the backup tools themselves are covered in `choosing-backup-tools.md`), and don't touch the rest of this guide until those two are habits.

What this artifact is not: a how-to. There are no commands here. This is for picking the right tool for the right job and understanding the politics of each. The companion `devuan-luks2-install.sh` in the project covers the actual install procedure for users who want to bypass distro installer wrappers. For the concepts beneath these tools (what encryption, signing, hashing, keys, and the web of trust actually are), the companion `gpg-concepts.md` is the home; this guide assumes those and points there rather than re-explaining.


## Why your encryption choices matter: the surface you're defending

You don't need a threat model that includes nation-states for any of this to matter. The default threat model is much more banal:

- A laptop gets stolen out of a coffee shop or airport. Without encryption, the thief mounts the drive on another machine and has every file you've ever opened, every browser session, every cached credential. With encryption, they have a brick.
- A used SSD gets resold. Modern flash retains data far past what `rm` deletes. Without encryption, the buyer recovers your tax returns. With encryption, they recover noise.
- A cloud provider is compelled to hand over data, gets breached, or has an employee curious about you. Without client-side encryption, the provider can read everything. With it, they hand over ciphertext.
- A backup drive lives in a friend's apartment or a parent's house for off-site storage. Without encryption, anyone in either household can read it. With encryption, the off-site arrangement actually works.

This is the stuff encryption-at-rest defends against. What it does *not* defend against:

- Malware on your unlocked, logged-in machine. The data is decrypted in memory while you're using it; encryption-at-rest does nothing here.
- Keyloggers. If the password gets captured, the math is irrelevant.
- Coercion. A government with rubber hoses gets the password. (The narrow exception below: VeraCrypt hidden volumes.)
- Backups *of the unencrypted versions* of files. If you ever decrypted a file and then synced your home directory to OneDrive in plaintext, that's the version that exists.
- Cold-boot attacks on a powered-on or suspended laptop. RAM holds keys for several seconds after power is cut, longer if cooled. "Locked screen" is not "encryption is engaged." Real protection means powered off.
- Evil-maid attacks on an unattended laptop. An attacker with a few minutes of physical access to a powered-off machine can install a malicious bootloader that captures the password on next boot. Secure Boot, TPM-measured boot, and Heads are partial countermeasures.
- "Self-encrypting" SSDs. Most consumer drives marketed as SEDs were shown by Radboud University researchers in 2018 to have firmware-level flaws that make their hardware encryption effectively useless against a determined attacker. Encrypt at the OS layer regardless of what the drive claims.

### Why proprietary disk encryption is hostile

Both BitLocker and FileVault encrypt your disk competently. That's the easy part. The hostile part is what they do with the keys.

BitLocker, in its default Windows 11 configuration, uploads your recovery key to your Microsoft account during initial setup. The official Microsoft documentation calls this a feature: "If you forget your password, we can help you recover your data." What it actually means is that your encryption key is in Microsoft's possession, available to anyone who can compel Microsoft to hand it over (subpoena, National Security Letter, internal compromise) and exposed in any future Microsoft account breach. There is a way to encrypt without uploading the key (you have to create a local account, refuse online setup, and use `manage-bde` from the command line) but Microsoft makes this path increasingly difficult with each Windows update. The ordinary user enables BitLocker and a copy of their key sits on Microsoft's servers.

Apple's FileVault doesn't upload the disk-encryption key by default. But your iCloud data (including iMessage backups, photos, notes, files in iCloud Drive, and Safari history) is by default encrypted with keys Apple holds. Apple can read it. Apple can hand it over. Apple has handed it over, repeatedly, to law enforcement requests. The opt-out is called Advanced Data Protection, was introduced in iOS 16.2 in late 2022, requires you to set up at least one recovery contact or recovery key, and is off by default. Most Mac users have never heard of it. Their iCloud is end-to-end encrypted in the marketing material and not end-to-end encrypted in fact.

These aren't bugs. They're product decisions. Microsoft and Apple sell convenience and recoverability; they price that against your sovereignty over your own data, and the price is your sovereignty. This is the same pattern as Recall (Windows 11's screenshot-everything feature), notarization (Apple deciding what software you can run on your own machine), and account-required setup. The OS vendor takes a seat at the table you didn't offer them.

The Linux equivalent (LUKS) does not phone home. The key derivation runs locally; the master volume key never leaves your machine; there is no recovery service. If you forget your password, the data is gone. That's the deal. It's a worse experience for the careless user and a categorically better one for everyone else.

This is the upstream argument for migrating in the first place: the encryption layer on Windows and Mac is not on your side. The companion OS guide covers what to migrate *to*. This guide covers what to do once you're there.

### A note on phones

Modern Android (since 10) and modern iOS encrypt the user data partition by default, tied to the screen lock. This is competent, hardware-backed encryption and for typical threat models you don't need to do more. The tools below are for desktops, laptops, and external storage. If you've migrated your computer to Linux but your phone is still iOS or pre-GrapheneOS Android, that's a separate conversation; see GrapheneOS, CalyxOS, and the phone section in the OS guide.

Out of scope here: password managers (KeePassXC, Bitwarden), encrypted messaging (Signal, Matrix), and email encryption layered on top of plaintext mail.


## Four families of tool

Encryption-at-rest tools cluster into four families. The right tool depends almost entirely on which family fits the job.

**Whole-disk / full-disk.** The whole partition or disk is encrypted. You unlock it once at boot with a password; everything on it is then transparently readable until shutdown. Examples: LUKS (Linux), VeraCrypt system encryption. Use case: laptop or external drive that you want to be a brick if stolen.

**Container vault.** A single file (often hundreds of MB or several GB) that mounts as a virtual drive when unlocked. Inside it looks like a folder; outside it looks like one opaque blob. Examples: VeraCrypt containers, Tomb, LUKSbox. Use case: a vault on top of an otherwise-unencrypted system, or a portable encrypted volume on a USB stick.

**Per-file or per-folder.** Each file is encrypted individually, and the encrypted output is a file you can move around, sync, or share. Some present as a transparent virtual folder where you drop plaintext and it gets encrypted on save. Examples: age, GnuPG, Picocrypt, Cryptomator, gocryptfs. Use case: cloud-syncable encryption, sharing a single encrypted file with someone, or per-directory encryption on Linux.

**Encrypted backup archive.** A backup-format-first tool where encryption is built into the format. The output is a deduplicated, compressed, encrypted archive that only the backup tool understands. These are backup tools first, with encryption as a property of the format rather than the point of the tool; choosing among them (Borg, Restic, and the rest) is covered in `choosing-backup-tools.md`, and this guide does not re-select them. Use case: serious backup of large amounts of data to local or remote storage.

A sub-mode that crosses these categories: filesystem-native encryption. ZFS native encryption and Linux's fscrypt operate at the filesystem layer, neither block-level (whole-disk) nor application-level (per-file). They appear once in the tools list below but conceptually they sit alongside the four families rather than inside any one of them.


## The tools

For each, a short description, who maintains it, what it fits, its political and ideological lineage, and the main tradeoff. Each entry closes with a "Use if:" line.

### LUKS / dm-crypt

The Linux kernel's native full-disk encryption. dm-crypt is the kernel module; LUKS is the standard on-disk format on top of it; cryptsetup is the userspace tool. Every mainstream Linux distribution offers it as the "Encrypt my disk?" checkbox in its installer.

Maintainers: Linux kernel team. Milan Broz is the most prominent userspace maintainer.

Fits: laptop disk encryption, encrypted partitions, encrypted external drives that will only ever be used on Linux.

LUKS comes in two on-disk formats. LUKS1 is the original; LUKS2 (default on most distributions since around 2019) supports Argon2id key derivation, multiple keyslots with stronger metadata, and re-encryption of an existing volume. New installs should use LUKS2. Stay on LUKS1 only if your bootloader doesn't support LUKS2 yet, which is increasingly rare.

A related modern variant: systemd-homed, which encrypts each user's home directory in its own LUKS image rather than encrypting the whole disk. This gives "home only" protection (your data is encrypted; system files aren't) and lets the encryption follow the user across machines. Politically it's part of the systemd ecosystem and inherits everything that comes with that; see the systemd discussion in `os.md`.

For users who don't want to type a password every boot, modern Linux supports TPM2-backed unlock via Clevis or systemd-cryptenroll. The TPM holds the key and releases it only if the boot chain hasn't been tampered with. Convenient; not appropriate against an attacker who has physical access to the powered-off device.

For users who want to skip the distro installer and configure LUKS by hand, the project's `devuan-luks2-install.sh` is a worked example: GPT + LUKS2 + LVM + ext4 with keyfile-in-initramfs and GRUB cryptodisk, on Devuan. Read it before you run it.

Political leaning: Linux-kernel mainstream. The boring engineering option. Ships in every distribution, gets used at industrial scale, has no political enemies to make. Trusts the Linux kernel security model implicitly.

Tradeoff: Linux-only. An encrypted LUKS partition is not natively readable from Windows or macOS.

Use if: you have a Linux laptop, period. There is essentially no reason not to enable this.

### VeraCrypt

The successor to TrueCrypt, the legendary tool that mysteriously shut itself down in 2014 with the cryptic message "WARNING: Using TrueCrypt is not secure." VeraCrypt forked from TrueCrypt 7.1a, fixed the bugs the audit had found, and continued. It does whole-disk encryption, encrypted container files, and (uniquely) *hidden volumes*: a volume inside a volume, where you give one password to reveal the outer (decoy) contents and a different password to reveal the inner (real) contents. The point is plausible deniability under coercion: if forced to surrender a password, you give up the decoy.

Maintainer: Mounir Idrassi at IDRIX (France). Effectively a single-person project. Audits funded by OSTIF (Open Source Technology Improvement Fund).

Fits: cross-platform encrypted containers (works on Linux, Windows, macOS); Windows full-disk encryption; the rare cases where hidden-volume plausible deniability genuinely matters.

Political leaning: post-cypherpunk, Snowden-era state-resistant. TrueCrypt was the tool of choice for journalists, dissidents, and activists; VeraCrypt inherits that lineage. Hidden volumes only make sense as a feature if you take seriously the threat of compelled disclosure by a state actor.

Current state matters. Version 1.26.27 (September 2025) added Argon2id, modernizing the password hashing. But in early 2026, Microsoft terminated Mounir Idrassi's developer account without explanation. He has been unable to sign new Windows drivers or bootloaders since. Linux and macOS releases are unaffected; the most recent upload to SourceForge is from late April 2026. Existing Windows installs continue to work, but the certificate authority used for the VeraCrypt bootloader expires in late June 2026 and Microsoft is revoking it in July 2026, after which Secure Boot may refuse to load new VeraCrypt installations on Windows. Idrassi has called the situation a potential "death sentence" for VeraCrypt-on-Windows. This is not a cryptographic failure or a state-vs-encryption story; it's a platform-vendor termination story, and the lesson is that even hardcore state-resistant tools depend on cooperation from the platforms they ship through. Note that this is also a strong argument for migrating *off* Windows, the same gatekeeping that's killing VeraCrypt is what makes BitLocker the default.

Tradeoff: single-maintainer risk, now actively materializing on the Windows side. On Linux and macOS the tool is unaffected.

Use if: you need a cross-platform encrypted container right now, you're on Linux or Mac, and LUKSbox isn't mature enough yet. For Windows specifically, plan for migration off either Windows or VeraCrypt before mid-2026.

### LUKSbox

A Rust-based encrypted-container tool from Sébastien Dudek at Penthertz (a French pentesting firm). Released as v0.1.0 on 7 May 2026, two days before this guide. Cross-platform: Linux and macOS via FUSE3, Windows via WinFsp. AES-256-GCM-SIV by default with Argon2id (256 MiB / 3 / 4) for password-based keyslots. FIDO2 (YubiKey, Titan, Nitrokey, Windows Hello) and TPM 2.0 keyslots for hardware-bound unlock. Hybrid post-quantum keyslots using ML-KEM-768 or ML-KEM-1024 with separate `.kyber` seed files. Detached header sidecar, the vault file alone is opaque random with no magic bytes, so plausible-deniability via detached-header is built in. Anchor sidecar for external rollback detection. Apache 2.0.

Maintainer: Sébastien Dudek, Penthertz.

Fits: cross-platform encrypted containers, especially when stored in untrusted cloud, on shared media, or on USB sticks that travel. Direct competitor to VeraCrypt with all of VeraCrypt's known issues (single-maintainer-but-newer, no PQ until very recently, no hardware keys, C/C++ codebase, Microsoft-signing dependency) addressed by design choices.

Political leaning: hybrid lineage. The threat model is straight cypherpunk, the README's "harvest now, decrypt later" framing for the post-quantum slot is canonical post-Snowden paranoia. The tooling lineage is modernist: Rust, Apache 2.0, hardware-key-first, post-quantum-first, FUZZing-and-audit-first development culture. Sits at the intersection of the two camps in a way no other tool on this list does. The fact that it ships from a French pentesting firm rather than a single maintainer or a German privacy company is worth noting, that's a different funding base than any of the established tools.

Current state: pre-1.0. Nine internal audit rounds. 200+ tests passing, 30M+ fuzz iterations across 10 harnesses. No external audit yet (engagement scope package available on request). The on-disk format is locked; the cryptographic primitives are NIST/RFC standards built on RustCrypto.

Tradeoff: it's brand new. The pre-1.0 status is real: for sensitive data today, VeraCrypt's ten-year track record matters more than LUKSbox's better design. Watch this project. If it gets an external audit and reaches 1.0 cleanly, it likely becomes the default cross-platform recommendation, especially given the VeraCrypt-on-Windows situation.

Use if: you're paying attention to where the encrypted-container space is going. For production use today, default to VeraCrypt unless you specifically need FIDO2 or TPM keyslots and accept the pre-1.0 risk.

### Cryptomator

Per-file encryption purpose-built for cloud sync. You create a "vault" (really a directory tree of individually encrypted files, with encrypted filenames) and point it at your Dropbox / Google Drive / OneDrive / iCloud folder. Cryptomator presents the vault as a virtual unencrypted drive locally; you work with it normally; the sync client uploads only the encrypted versions.

Maintainer: Skymatic GmbH (Germany). Cryptolib audits by Cure53.

Fits: storing sensitive files in commercial cloud storage without the provider being able to read them. Probably the best UX in the entire space for non-technical users.

Political leaning: Eurocentric privacy-commerce. The product assumes you've already adopted commercial cloud storage and want a layer of privacy on top, not that you're going to self-host. Freemium business model, desktop free, full mobile functionality paid. Audited, professionally maintained, GDPR-compliance-shaped, sponsorship-funded. Calling this "least ideological" misses the politics: GDPR-Europe privacy-as-a-product is itself a stance, distinct from American surveillance-capitalism-with-encryption-as-an-afterthought and distinct again from cypherpunk self-hosting.

An alternative to the Cryptomator-over-Dropbox stack: pick a cloud provider that does end-to-end encryption natively. Tresorit (Swiss, proprietary, expensive), Proton Drive (Swiss, partially open-source clients, Proton ecosystem), and Mega (New Zealand, open-source clients) all encrypt client-side by design. You trade Cryptomator's provider-independence for a more integrated experience and the politics of whichever provider you pick. For users still on iCloud or OneDrive, Cryptomator on top of those services is one of the few ways to make commercial-cloud use defensible.

Tradeoff: filenames and contents are encrypted, but file count, individual file sizes, and modification timestamps leak to the cloud provider. Mobile apps cost money. Single-company project, not a community.

Use if: you're keeping a commercial-cloud sync provider and want them not to read your files.

### age

A modern, minimalist file encryption tool, designed as an explicit reaction against GnuPG. The philosophy is in the README: "small explicit keys, no config options, UNIX-style composability." Public keys are short strings starting with `age1...`; private keys are short strings starting with `AGE-SECRET-KEY-1...`. There are no key servers, no web of trust, no signing, no compression options, no hash algorithm choices. There is one cipher (ChaCha20-Poly1305 at the symmetric layer, X25519 at the asymmetric layer), and it works. age can also encrypt directly to an SSH public key, so anyone with an `ssh-ed25519` key already has an age recipient, which makes distributing to a small team as simple as sharing the SSH keys they already publish.

Maintainers: Filippo Valsorda (independent maintainer, sponsorship-funded; previously crypto lead at Cloudflare and on the Go standard library) and Ben Cox.

Fits: encrypting a single file or directory to send to someone; encrypting CI/CD secrets (sops integrates with age); encrypting backups for archival; replacing every old "I use gpg -c for this" workflow.

Political leaning: post-PGP modernist. The age project is implicitly an indictment of GnuPG and the FSF-era cryptographic UX. Filippo's writing makes this explicit: GPG is a "legacy" tool, age does "one thing brilliantly." Stylistically and ideologically, age sits in the Go-ecosystem, Stripe-Cloudflare, modern-minimalist-crypto school. Funded by independent sponsorships from companies like Ava Labs, which gives it a more commercial-tech-adjacent profile than the FSF crowd would prefer. Reproducible builds attested via Sigsum, which is a real distinguisher from the older tools.

Current state: 1.3.0 (December 2025) added an X25519+ML-KEM-768 hybrid post-quantum recipient. Builds are reproducible and Sigsum-attested. A fully compatible Rust port, `rage`, reads and writes the same file and key format, for anyone who prefers a single static binary or the Rust toolchain.

Tradeoff: deliberately doesn't sign. If you need authenticated provenance ("this file came from me"), you combine age with signify, minisign, or `ssh-keygen -Y sign`. There's no built-in revocation story.

Use if: you want to send an encrypted file or directory to someone, or you want to encrypt one for yourself and do not already keep a GPG key. If you do keep a GPG key for `pass` and signing, encrypting your own at-rest files to that key consolidates onto one key you already protect; see the GnuPG entry. This is still the right default for "I want to encrypt this thing" when no GPG key is already in the picture. For the conceptual comparison of age versus GPG, what each does cryptographically and why age drops signing and the web of trust, see `gpg-concepts.md`.

### GnuPG / GPG

The old guard. The canonical implementation of the OpenPGP standard. Encryption, signing, key management, web of trust, key servers, smartcard integration. It does everything; it does most of it badly by 2026 UX standards; and it remains essential because so many existing systems (apt signing, git commit signing, legacy email encryption, OS package distribution) depend on it.

Maintainer: Werner Koch and the GnuPG team. The funding situation has been precarious at multiple points, with bursts of corporate sponsorship after each near-collapse becomes news.

Fits: legacy interop, verifying package signatures, signing git commits, encrypting email under PGP/MIME, anything that already speaks OpenPGP. Also encrypting your own files at rest when you already keep a GPG key for `pass` and signing, where using that one key avoids adding a second encryption tool and a second key to back up. Rarely the right starting point for a new file-encryption workflow that has no GPG key behind it already.

Political leaning: FSF-adjacent cypherpunk old guard. GPL-licensed. Built around the web-of-trust philosophy of the 1990s, that key authenticity should be established peer-to-peer rather than via certificate authorities; `gpg-concepts.md` covers how the web of trust actually works and why it never scaled. The project's institutional rhythm is famously slow, the UX is famously hostile, and the codebase is famously baroque. Modernizers (age, Sequoia-PGP) treat it as the cautionary tale.

Tradeoff: the worst available choice for someone with a free hand and no existing GPG key, since age is the cleaner file primitive; the sensible choice when you already hold a GPG key and want one key to cover signing, `pass`, and your own files at rest.

Use if: you need to interoperate with an existing OpenPGP system, or you already keep a GPG key for `pass` and signing and want to encrypt your own at-rest files to it rather than maintain a separate age identity. To send a file to someone who does not already use GPG, age.

### Picocrypt

A very small, very simple, GUI-first file encryption tool. Drag a file in, set a password, get an encrypted blob out. Cross-platform, written in Go, distributed as a single binary that needs no install. Uses XChaCha20 with Argon2id key derivation. Optional Reed-Solomon error correction for long-term archival. A "paranoid pack" includes reproducible builds, source archives, and backup binaries.

Maintainer: Evan Su (single developer).

Fits: occasional encryption of one or several files via a GUI. The "I just want to put a password on this PDF and email it to my accountant" use case.

Political leaning: minimalist tooling with cypherpunk-flavored populism. The cryptographic primitives are modern (XChaCha20, Argon2id) and the interface is austere in the age tradition, but the marketing copy invokes "three-letter agencies like the NSA", that's a cultural tell about who the project imagines its user is. Sits between age (austere, developer-focused) and VeraCrypt (heavy, cypherpunk-traditional). The "paranoid pack" with reproducible builds is a supply-chain-trust marker shared with age and LUKSbox.

Tradeoff: single-developer project. Limited CLI; the workflow really wants the GUI. Not designed for cloud sync, each operation produces a static encrypted file.

Use if: a non-technical relative needs to put a password on a file and you want them to succeed on the first try.

### Tomb

A shell script wrapping LUKS to give you "tombs", `.tomb` files that act like portable encrypted folders. Created by the dyne.org foundation, the same Italian hacker collective that has been making Free Software for two decades. The whole tool is a few thousand lines of Zsh.

Maintainer: Denis "Jaromil" Roio at Dyne.org. Active since 2007; recent FIDO2 security key support added.

Fits: an encrypted vault on a Linux box, with a workflow simpler than VeraCrypt and more discoverable than raw cryptsetup. Steganographic key hiding (in JPEG images) is supported.

Political leaning: explicitly hacker-collective and autonomist-leaning. Dyne.org's other projects (Devuan-friendly tooling, dyne:bolic, free-culture audio software) sit in the European free-software-as-political-practice tradition. Of all the tools on this list, Tomb is the most explicitly ideological: the project's documentation and its surrounding community make no secret of where they sit politically.

Tradeoff: Linux-only. Bash- and Zsh-based, which some find fragile. CLI-first; GUI wrappers exist but vary in quality.

Use if: you want a Linux-only LUKS-backed vault with a friendlier workflow than raw cryptsetup, and you're sympathetic to the dyne.org political register.

### gocryptfs

A FUSE-based encrypted overlay filesystem. You point it at a directory of encrypted files, give it a password, and it mounts a virtual directory where the files appear in plaintext. Per-file encryption with encrypted filenames. Designed as the modern successor to EncFS, which had known cryptographic weaknesses.

Maintainer: Jakob Unterwurzacher.

Fits: encrypted home directory or per-user encrypted folders on Linux/macOS; cloud sync where you want each file individually encrypted (similar use case to Cryptomator, but as a CLI/FUSE primitive rather than a polished app).

Political leaning: engineering-pragmatist; no ideology. The "do EncFS again, but correctly" project.

Tradeoff: Linux/macOS only (FUSE-dependent). Not a sync tool itself; you bring your own.

Use if: you want Cryptomator-style per-file encryption but as a CLI primitive you can script.

### ZFS native encryption

Filesystem-level encryption built into OpenZFS. Each ZFS dataset can be independently encrypted with its own key, using AES-256-GCM or AES-256-CCM. Encrypted datasets can be sent and received between machines without the destination ever seeing plaintext (`zfs send -w`).

Maintainer: OpenZFS project, originally Sun (now Oracle for the legacy Solaris fork; OpenZFS is the community fork that runs on Linux, FreeBSD, and macOS).

Fits: serious storage setups, TrueNAS systems, ZFS-based backup destinations, large local pools where you want encryption granular to the dataset rather than the whole disk. Particularly strong for replicating encrypted backups across machines.

Political leaning: enterprise-storage-pragmatist. Originated at Sun, now driven by a mix of corporate (iXsystems, Lawrence Livermore) and community contributors. CDDL-licensed, which causes friction with the GPL Linux kernel and is itself a small political artifact. No threat-model ideology beyond getting filesystem semantics right.

Tradeoff: requires you to be on ZFS in the first place, which is its own significant decision. CDDL/GPL incompatibility means ZFS support on Linux ships out-of-tree and depends on DKMS or precompiled modules. Not appropriate for someone who just wants to encrypt a folder.

Use if: you're already on ZFS or building a NAS / backup target and you want filesystem-native encryption that supports `zfs send -w` to untrusted destinations.

### rclone crypt

Rclone's encrypted backend. Rclone is "rsync for cloud storage" and supports something like 70+ providers; the crypt backend wraps any of them in transparent client-side encryption. Filename encryption is optional.

Maintainer: Nick Craig-Wood.

Fits: encrypted sync to almost any cloud storage backend you can name. Often paired with Restic or Borg for the backup-format layer.

Political leaning: pragmatist sysadmin. Trust nothing in particular, use anything you have to.

Tradeoff: rclone itself has a learning curve. The crypt layer is straightforward once rclone is set up.

Use if: your backup or sync destination is a cloud provider rclone speaks and you want client-side encryption layered on top.

### Mentions and exclusions

EncFS is deprecated due to known cryptographic weaknesses. Use gocryptfs.

CryFS and securefs are alternative FUSE-based encrypted filesystems. CryFS chunks everything into fixed-size blocks to hide file sizes; securefs is smaller and less actively maintained. Either is usable; for most people gocryptfs has more momentum.

7-Zip with AES is encryption tacked on top of an archiver and has had crypto bugs in past versions. Functional for casual use, not crypto-first design.

eCryptfs (per-directory encryption that Ubuntu used to ship for `~/.private`) is essentially abandoned. fscrypt (kernel-native per-directory encryption in ext4 / f2fs / UBIFS) is the current Linux successor and is fine if you want native kernel support without FUSE. Like ZFS encryption, it's filesystem-native rather than fitting cleanly into the four families above.

Sequoia-PGP is a Rust rewrite of OpenPGP, German-funded, the most credible modernization attempt for the GnuPG ecosystem. Worth knowing about if you're stuck with OpenPGP for legacy reasons but want a less hostile codebase. Not a starting point for someone who has a free choice, pick age instead.

Kryptor is a single-developer age-like project with solid cryptography but a much smaller user base. Mentioned for completeness; not recommended over age.

DiskCryptor was a Windows-only TrueCrypt-era full-disk encryption tool. Abandoned; ignore older recommendations for it.

BitLocker (Windows) and FileVault (macOS) are excluded from the comparison because they're proprietary and OS-vendor-controlled. See the "Why proprietary disk encryption is hostile" section above for what's wrong with them. Section 6 covers what to do with existing BitLocker / FileVault volumes when migrating to Linux.


## Decision matrix

Pick the row that describes your use case. The recommended tool is in column two; alternatives are in column three.

| Use case | Pick | Reasonable alternative |
|---|---|---|
| Laptop is stolen, want disk unreadable | LUKS during install | VeraCrypt system encryption (cross-platform, with caveats) |
| External drive that's Linux-only | LUKS |, |
| External drive that needs to be readable on Windows/Mac too | VeraCrypt container | LUKSbox (once 1.0+; pre-1.0 today) |
| Encrypted "vault" on existing Linux system | Tomb | VeraCrypt container, LUKSbox |
| Encrypted home directory only (not full disk) | systemd-homed or fscrypt | gocryptfs |
| Plausible deniability under coercion | VeraCrypt hidden volumes (Linux/Mac viable; Windows uncertain through 2026) | LUKSbox detached-header (when 1.0+) |
| Encrypted backup, local or SSH or cloud | The backup tool encrypts the archive; see `choosing-backup-tools.md` | , |
| Encrypted ZFS pool / dataset replication | ZFS native encryption |, |
| Cloud-synced encrypted folder (Dropbox / Google Drive / iCloud) | Cryptomator | gocryptfs + sync client; rclone crypt; or move to a natively E2EE provider |
| Encrypted sync to any rclone backend | rclone crypt |, |
| Encrypt a single file to keep for yourself, at rest | GnuPG, to the key you already keep for `pass` and signing | age, if you keep no GPG key |
| Send a single encrypted file to someone with no existing setup | age | Picocrypt (if they want a GUI) |
| Encrypt secrets or config inside a git repo, keeping it reviewable | sops with the age backend | plain age (whole-file, but the file is no longer diffable) |
| Send to someone who already uses GPG | GnuPG |, |
| GUI drag-and-drop for one or two files | Picocrypt | Cryptomator (if vault model fits) |
| Per-directory encryption inside ext4 / f2fs | fscrypt | gocryptfs |
| Verify package or git signatures (signing, not encryption) | GnuPG |, |

The last row is for completeness: signing and encryption are different operations. If your goal is signing, GnuPG and `ssh-keygen -Y sign` are the practical options; the rest of this guide is about encryption. Why the two operations differ, and what authenticity and integrity each give you, is covered in `gpg-concepts.md`.

Two pieces of practical advice not captured in the matrix.

First: full-disk encryption on the system you actually use is the highest-value action by a wide margin. Everything else here addresses narrower problems. A stolen unencrypted laptop is the typical real-world threat; LUKS solves it in one checkbox. If you're still on Windows or Mac, the answer is the same as the answer everywhere else in this guide: migrate.

Second: don't try to learn all of these. Pick one tool per job and stick with it. The most common failure mode in this space is people stacking three encryption layers, forgetting one of the passwords two years later, and losing the data permanently. Encryption is the most reliable way to lose your own data. Account for that in the choice.


## Political leaning summary

Encryption-at-rest tools cluster into several ideological lineages. Knowing which one your tool belongs to predicts its threat model, its funding sustainability, and how it's likely to behave under stress.

**Linux-kernel mainstream.** LUKS, fscrypt. Engineering-above-ideology, ships in every distribution, gets used at industrial scale, has no political enemies to make. The least flashy category and by far the most reliable.

**Self-hosting sysadmin.** rclone crypt, gocryptfs, ZFS native encryption. FOSS-pragmatist by temperament, but with a discernible preference for "your own server, your own disks" deployment patterns. Less ideological than the cypherpunks but more opinionated than pure infrastructure-as-utility. Stable funding because these tools are the backbone of competent self-hosting. The backup tools that also sit in this lineage (Borg, Restic) are covered in `choosing-backup-tools.md`.

**Cypherpunk / post-Snowden state-resistant.** VeraCrypt, GnuPG. Built around the assumption that adversaries include nation-states. Hidden volumes, web of trust, paranoid threat models, sometimes-difficult UX as a feature rather than a bug. Currently the most fragile category, the VeraCrypt-Microsoft situation in early 2026 is a state-resistant tool being shut down not by a state but by a platform vendor, and the lesson is that even hardcore cypherpunk tools depend on cooperation from the platforms they ship through.

**Modern minimalist / post-PGP.** age, with Sequoia-PGP as a sibling on the OpenPGP-modernization side. A reaction against GnuPG complexity by a younger generation of cryptographers. Smaller maintainer pools, smaller surface area, far better ergonomics, less institutional inertia. Funded by individual sponsorships and tech-company patronage rather than foundations. Reproducible builds and signed-binary attestation (Sigsum, transparency logs) are markers of this lineage.

**Cypherpunk-flavored populism.** Picocrypt. Modern primitives, austere interface, but explicitly populist threat-model framing, the marketing names the NSA. Sits between modernist tooling and the older cypherpunk culture.

**Modernist-cypherpunk hybrid.** LUKSbox. Cypherpunk threat model (post-quantum, hardware-key, detached header for plausible deniability) implemented with modernist tooling (Rust, Apache 2.0, fuzzing-and-audit-first development, cross-platform via FUSE3 / WinFsp). The first tool on this list to combine those two camps deliberately. Funded by a French pentesting firm rather than a maintainer-of-one or a privacy-product company.

**Eurocentric privacy-commerce.** Cryptomator. Built for the user who already uses Dropbox and wants the provider not to read the files. Freemium business model, professional German company, audited, GDPR-shaped. The most commercially mature project on the list and the easiest to recommend to non-technical people. The politics aren't absent; they're "European data-protection law as a market position," which is its own coherent stance.

**Hacker-collective / autonomist.** Tomb (Dyne.org). The most explicitly political category. European free-software-as-political-practice tradition. Bash-script aesthetics, KISS philosophy, leftist hacker culture.

The takeaway: the encryption itself is not the interesting variable. AES-256, ChaCha20-Poly1305, Argon2id, these are mature primitives and any of the actively maintained tools above gets the math right. What differs is the threat model the project assumes, the funding base that sustains it, and the behaviors you're being signed up for when you adopt their workflow. Pick on those.


## Migration from Windows or Mac

The companion OS guide makes the case for leaving in detail. The encryption story is one piece of that case. Here's how to handle the encryption layer during the migration itself.

**If you're on Windows with BitLocker.** Decrypt the BitLocker drive before migration: Settings → Privacy & security → Device encryption → Off, or `manage-bde -off` from an admin command prompt. Wait for decryption to complete, back up the unencrypted contents to an external drive, install Linux fresh with LUKS enabled at install time, copy the data back. Don't try to dual-boot a BitLocker-encrypted Windows partition alongside a LUKS-encrypted Linux partition with shared data, the boot complexity isn't worth it.

If you can't or won't decrypt the original BitLocker drive (you're keeping Windows as a fallback during transition, or the drive is read-only legacy), `dislocker` on Linux can mount BitLocker volumes read-only with the recovery key. Use it for one-time data extraction; not a long-term workflow.

For cross-platform portable drives going forward, use VeraCrypt today; LUKSbox once it reaches 1.0. Don't use BitLocker To Go, Microsoft uploads recovery keys to your account.

For files that were in OneDrive: assume Microsoft has read them. If they're sensitive, treat them as compromised and rotate any credentials they contained. Going forward, Cryptomator on top of OneDrive (or a switch to Proton Drive / Tresorit / self-hosted Nextcloud) closes the leak.

**If you're on macOS with FileVault.** Same pattern: decrypt FileVault before migration (System Settings → Privacy & Security → FileVault → Turn Off), back up cleanly, install Linux fresh with LUKS.

`apfs-fuse` on Linux can read APFS volumes including FileVault-encrypted ones with the password, but it's read-only in most configurations and not maintained by Apple. Use it for one-time data extraction.

For files that were in iCloud Drive: check whether you had Advanced Data Protection turned on. If yes, your data was end-to-end encrypted and Apple couldn't read it, clean migration. If no (the default), Apple held the keys; assume any sensitive content was readable to Apple and treat it as compromised. Move to Proton Drive, Cryptomator over your sync provider of choice, or self-hosted storage going forward.

**General advice for both directions.** Decrypt and copy is almost always cleaner than trying to read foreign-OS encrypted volumes natively. Schedule the migration when you have time to sit through a full decrypt-backup-reinstall-restore cycle, ideally with two separate copies of the data on different physical drives. Encryption migration is the most common point at which people lose data permanently; budget extra paranoia for it.

**Once you're on Linux.** Default starting setup: LUKS at install on the system disk, plus one secondary tool for whichever specific job is in front of you (Borg for backups, Cryptomator for cloud-synced folders, age for one-off files). Add others only when a new job genuinely requires them. The companion `devuan-luks2-install.sh` covers the LUKS-LVM-Devuan install procedure in detail for users who want full control over the install.


## How to think about choosing

Three questions, in order:

1. **What threat are you defending against?** Laptop theft → whole-disk. Cloud-provider snooping → per-file or container. Compelled disclosure → hidden volumes (rare; high stakes). Long-term archive integrity → backup tool with authenticated encryption.
2. **Who else needs to read the data, and on what?** Just you, on Linux → most options work. You and your future Mac or your Windows colleague → cross-platform (VeraCrypt, LUKSbox once 1.0+, Cryptomator, age, Picocrypt). A specific other person → age (modern) or GnuPG (legacy).
3. **How much UX friction can you absorb?** Zero → LUKS (set it once at install, never see it again). Low → Cryptomator. Medium → VeraCrypt, LUKSbox, Picocrypt, Tomb. Higher but more powerful → age, Borg, Restic, rclone.

A fourth consideration that's not really a question but matters more than any of the above: **don't lose your keys.** Encryption is the most reliable way to permanently lose your own data. The typical failure looks like this: someone enables full-disk encryption, picks a strong password, doesn't write it down (because writing down a password feels insecure), uses the laptop for two years, takes a long break, comes back to a locked screen and a blanked memory. There is no recovery from that.

Concrete countermeasures, in increasing order of paranoia:

- Write the password down on paper and put the paper somewhere a thief wouldn't look but you would (a sealed envelope in a filing cabinet, a safe-deposit box, a trusted family member's house). Physical paper is not a meaningful threat surface for the attacks encryption defends against, and it's the most reliable backup medium humans have for short secrets.
- Use a password manager (KeePassXC, Bitwarden) and back up its database, but the master password itself has to live somewhere outside the password manager, so this just shifts the problem.
- For LUKS specifically, save the LUKS header to a separate medium. If the header gets corrupted on the disk, the data is unrecoverable even with the correct password; the backup header restores recoverability. The command and the full procedure live in `devuan-secure-workstation.md` and the `devuan-luks2-install.sh` script, not here.
- For backups, keep at least two physically separated copies of any encrypted archive plus the password to decrypt it. The backup is no good if the password died with the laptop.

Most people who go from "no encryption" to a single working LUKS-plus-Borg setup, with the password written down in a sealed envelope at home and the LUKS header backed up to a USB stick in a different room, get more real-world security than people who spend a year reading about hidden volumes and never finish setting anything up.
