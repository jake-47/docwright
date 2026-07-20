# Security Overview

Secure your system. The long answer for why you must secure it is [explained here](why-secure-your-system.md). The short answer is that it's the prudent thing to do. Before the steps, [the security landscape](security-landscape.md) maps what you are defending and how far the climb goes. It's a long journey, but the guides below will help you get through the steps in order. They place concepts before procedures and climb slowly, each reducing more attack surface. The early ones (OS, encryption) are the foundation the rest assume. You don't have to reach the summit on day one, but you can start climbing today.

1. [**Replace the OS**](os.md). Compare distros, leave Windows or Mac, pick one, migrate. The largest single cut to your attack surface, and the foundation every guide above it assumes.
2. [**Encrypt**](choosing-encryption-tools.md). Disk and file encryption. Read the [GPG concepts guide](gpg-concepts.md) alongside it for the key, signing, and identity model behind those choices; that one is concept, not procedure.
3. [**Separate identities, manage keys**](privacy-setup.md). Identity separation across users and VMs, SSH and GPG key strategy, hardware tokens, behavioral discipline.
4. [**Secure messaging**](choosing-communication-tools.md). Signal at the base, up through federated, Nostr-rooted, P2P, off-grid, and email.
5. [**Sovereign transport**](choosing-networking-tools.md). VPN, mesh, overlay, Tor, censorship-evasion, off-grid radio.
6. [**Detect compromise**](choosing-hids-tools.md). Host integrity monitoring; the shift from prevention to detection.
7. [**Vet documents**](choosing-document-scanning-tools.md). Scanning and metadata hygiene for files you receive, before you open them.
8. [**Dedicated hardware**](choosing-hardware.md). A desktop built from parts, Linux or coreboot laptops, hardware tokens; raises the floor the apex guides stand on.
9. [**Harden the whole workstation**](devuan-secure-workstation.md). The desktop apex: LUKS, VM compartmentalization, USBGuard, nftables, kernel hardening, encrypted DNS. Driven by the [install script](devuan-luks2-install.sh).
10. [**Harden mobile**](choosing-phone.md). The phone apex, a parallel track you can climb any time after step 1: Pixel plus GrapheneOS, flashed per [the GrapheneOS install guide](grapheneos-install.md).


## Cross-cutting concerns

Things that don't belong cleanly to any one layer but matter to the overall stack.

### Hardware tokens

A small USB device that holds cryptographic keys and performs operations with them without ever releasing the keys to the host. The key material lives inside tamper-resistant hardware; an attacker who compromises the laptop cannot extract the keys without physically having the token.

Uses:

- **SSH authentication.** SSH keys live in the token. `ssh` calls into the token via FIDO or PKCS#11 to sign authentication challenges. The host never has the private key. Lost or stolen laptop is no longer "and now they have my SSH keys", they have a laptop with no SSH access until they steal the token too.
- **GPG / OpenPGP.** Same idea for GPG keys (encryption, signing, certification). YubiKey and Nitrokey both support OpenPGP keys natively; the `gpg-agent` integration is straightforward on Devuan.
- **Sudo authentication / PAM.** `pam_u2f` lets you require a token tap for sudo, sudo-rights operations, or login. Tightens the local-attacker threat model substantially.
- **2FA for online accounts.** WebAuthn / FIDO2 for every service that supports it. Strictly better than TOTP because the token signs the origin domain, so a phishing site can't replay the second factor.
- **LUKS unlock.** Niche but real: a token can hold a keyfile that unlocks LUKS, used in combination with a passphrase.

The major options:

- **YubiKey.** The dominant brand. YubiKey 5 series supports FIDO2, OpenPGP, PIV, OATH, OTP, basically everything. Closed-source firmware that is not updatable: if a vulnerability is found in the firmware (as in the September 2024 EUCLEAK side-channel disclosure against YubiKey 5), you replace the device rather than apply a patch. Available everywhere; works on every platform. FIDO Level 2 Certification (higher than the open-source competitors' current certifications).
- **Nitrokey.** German company. The Nitrokey 3 series runs fully open-source firmware called Trussed (Rust-based, jointly developed with SoloKeys). Older Nitrokey models (Pro, Start) are partially open, the underlying smartcard chips have proprietary firmware. For users who care about firmware auditability, the Nitrokey 3 is the meaningful pick; for users who care less about auditability and more about feature breadth, YubiKey wins.
- **Solo / SoloKey.** Open-source hardware and firmware. First open-source FIDO2 security key, launched 2018 via Kickstarter. Solo 2 series shares the Trussed firmware framework with Nitrokey 3. FIDO2-focused, no OpenPGP or OATH; simpler scope.
- **OnlyKey.** Open-source firmware. Acts as a USB keyboard and types stored passwords on a button press. Six physical buttons on the device plus a PIN entered on the device itself. Stores up to 24 accounts on-device. Different model from the others (password manager on hardware) rather than just a FIDO key.

Recommendation: a Nitrokey 3 (open-source firmware) for users who care about that property; a YubiKey 5 for users who want the broadest software support. Always buy two, one daily, one in a safe deposit box, both registered to the same accounts. A single hardware token that gets lost or destroyed locks you out of everything it protected. Don't repeat that mistake; everyone tells the same story about it.

Integration on Devuan is straightforward:

```bash
sudo apt install libpam-u2f yubikey-manager
```

Configuration depends on what you're protecting; the Arch Wiki entries for `pam_u2f`, `gpg-agent`, and `OpenSSH FIDO` are the practical references.

### Heads coreboot

Open-source firmware that replaces the proprietary UEFI/BIOS on supported hardware. Built on coreboot; uses a YubiKey or similar token to verify that the boot path hasn't been tampered with.

What it defends against:

The evil-maid attack. An attacker with physical access to a powered-off laptop modifies the firmware or bootloader. On a normal laptop, the user has no way to detect this; they boot, type the LUKS passphrase, and the modified firmware captures it. On a Heads-equipped laptop, the firmware itself is measured at boot, the measurement is checked against a signature on the token, mismatch triggers a visible alert before the user types anything sensitive.

The cost:

Hardware-specific. Heads runs on a specific list of supported machines, mostly older ThinkPads (X230, T440, T530, X1 Carbon up to specific generations) and some Purism Librem and Insurgo PrivacyBeast models. Flashing Heads is real work; failures can brick the laptop. There are vendors (Insurgo, Mullvad's PrivacyBeast partnership) that sell Heads-preinstalled hardware at a premium, which is the cleaner path for most users.

Heads also has trade-offs in daily use: firmware updates require re-signing the boot measurement; kernel updates require re-signing too. Recovery from a forgotten token PIN or a corrupted token is non-trivial. For users with the threat model that justifies it, the trade-off is correct; for users without that threat model, Heads is overkill and the recovery friction is worse than the protection is worth.

Where to read more: osresearch.net for the project itself, plus Insurgo and Mullvad for purchase options.

### Tor versus VPN versus self-hosted mesh

A frequent question. The short answer: three different things often grouped under "VPN," each with a different threat model.

1. **Commercial VPN.** Single-hop tunnel to one company that knows who you are. Replaces your ISP with one trusted company. The "VPN for privacy" frame; structurally weaker than Tor and not an anonymity tool.
2. **Self-hosted or mesh VPN.** WireGuard between machines you control; Tailscale-style mesh with the coordinator either centralized or self-hosted (Headscale, NetBird). Not an anonymity tool; the right answer for connecting your own devices over hostile networks.
3. **Tor.** Multi-hop volunteer-run onion network. The actual answer for anonymity.

For the commercial-VPN versus Tor question:

A commercial VPN encrypts your traffic between your device and the VPN provider. From the VPN's exit, your traffic continues to its destination over normal internet, unencrypted at that hop unless the destination uses HTTPS (which it usually does in 2026). What a commercial VPN gets you:

- Your ISP sees encrypted traffic to the VPN, not your destinations.
- The VPN sees your traffic and your destinations.
- The destinations see the VPN's IP, not yours.

The commercial-VPN threat model is "I don't trust my ISP." The VPN replaces the ISP with a single company that you trust more (or that you think you trust more). If the VPN is compromised, logs are subpoenaed, or the VPN itself is hostile, all your traffic is exposed. This is not a hypothetical: VPN companies have been compromised, have been compelled to log, and have been acquired by surveillance-adjacent parents.

Tor encrypts your traffic and routes it through three unrelated volunteer-run nodes, each of which only knows one hop. The entry guard knows who you are but not what you're doing; the middle relay knows nothing useful; the exit knows what you're doing but not who you are. For any single party to deanonymize you, they need to control or observe both your guard and your exit, which is exponentially harder than compromising a single VPN.

Tor's threat model is "I don't trust any single party with both who I am and what I'm doing." It is structurally stronger than any commercial VPN can be.

For the self-hosted and mesh case:

WireGuard between machines you control gives you an encrypted tunnel with no third party. Tailscale, NetBird, and ZeroTier add convenient mesh networking on top, with a central coordinator that handles peer discovery and access control. Self-hosting that coordinator (Headscale for Tailscale clients; NetBird in self-hosted mode) closes the structural capture-risk that the hosted-coordinator products introduce. None of this is an anonymity tool; it's an "encrypted private network between your devices" tool.

The Nostr-rooted frontier is nostr-vpn plus its underlying FIPS protocol, a sovereignty-aligned mesh where your identity is a Nostr keypair and coordination happens over public Nostr relays. Alpha-grade in 2026; the architecture is what to learn from now, deployment comes later.

The exception worth naming:

A commercial VPN may make sense as a transport for getting to Tor when your ISP blocks Tor directly. User → VPN → Tor → internet. This is the "Tor over VPN" configuration and is the only legitimate use of a VPN alongside Tor that the Whonix project documents. It is advanced, not leak-tested at the level of the base Whonix setup, and is unnecessary unless your ISP actually blocks Tor. For the more general case of accessing Tor in a censored environment, Tor's pluggable transports (Snowflake, Meek, obfs4) and bridges are the project's own answer.

For the typical user with no specific reason: use Tor (via Tor Browser or Whonix) when you need anonymity; use WireGuard or Headscale when you need a private network between your own devices; don't bother with a commercial VPN unless you have a narrow specific reason (geographic bypass, hostile-ISP bypass). The whole "VPN for privacy" marketing of the 2010s and 2020s sold a weaker product to people who wanted stronger.

For the full landscape of VPN, mesh, overlay, anonymity, and off-grid networking options, see `choosing-networking-tools.md`.

### Browser hardening

The browser is the largest attack surface most users have. Several real options.

- **Tor Browser.** Firefox-based, configured by the Tor Project, ships through Tor. The right choice for sensitive sessions and the only choice for genuine browser-level anonymity. Slow (Tor is slow), incompatible with sites that block Tor exits (Cloudflare-protected sites in particular). Not a daily-driver browser.
- **LibreWolf.** Firefox without telemetry, configured for privacy by default, with the worst Firefox-tracking-defaults flipped. Available in Devuan or via Flatpak. The right default daily-driver browser for a privacy-conscious user. Comes with `uBlock Origin` and reasonable defaults.
- **Mullvad Browser.** Firefox-based, made by the Mullvad VPN company in collaboration with the Tor Project. Designed to give Tor Browser's anti-fingerprinting properties without Tor itself; designed to be used over a VPN for users who want Tor-level browser anonymity without Tor-level speed costs. A reasonable middle ground if you're already on Mullvad's VPN; less interesting otherwise.
- **arkenfox user.js.** Not a browser; a configuration file for stock Firefox that flips the same privacy settings LibreWolf does, plus a configurable amount more. The right answer for users who want stock Firefox's update cadence with LibreWolf's defaults.

Don't use Chrome. Don't use Edge. Don't use Safari. The threat model these documents target includes the vendor of the browser as part of the threat.

For Devuan plus the hardening doc, the right browser stack is LibreWolf as default plus Tor Browser available for specific sessions. Add Firefox Multi-Account Containers (or arkenfox's container patterns) to keep work, personal, and miscellaneous browsing isolated within the same browser.

This document doesn't cover browser hardening in more detail; there are dedicated projects that do it better. PrivacyGuides.org has up-to-date recommendations and is independent of any commercial party. A future `choosing-browser-hardening.md` is on the roadmap.

### Credential isolation across machines

The pattern: separate the machine that writes code (or composes emails, or signs documents) from the machine that holds the credentials to push code (send emails, distribute signed documents).

The threat model: an attacker who compromises the writing machine should not automatically gain credentials to act as you on the network. Compromise of the writing machine leaks code-in-progress, draft emails, unsigned documents, bad, but bounded. Without credential isolation, compromise of the writing machine leaks the credentials too, much worse, because the attacker can now act as you on the network and the bad version of every project gets pushed. The IronWorm npm worm in June 2026 was exactly this cascade: it stole developers' npm publish credentials and republished itself into their own packages. The supply-chain section below covers the defenses; `why-secure-your-system.md` has the case.

The Qubes pattern is the cleanest: split GPG and split SSH. A dedicated credential-holding qube has the keys; work qubes don't. When a work qube needs to sign something or push something, it makes a qubes-rpc call to the credential qube; the credential qube performs the operation and returns the result. The credentials never leave the credential qube. The work qube can be wiped and rebuilt without losing the credentials.

The non-Qubes version is `bundle-queue.sh` for the git-push case. The work machine creates a git bundle (no credentials needed); the bundle travels by sneakernet or by a controlled transport to a separate credential-holding machine; the credential machine pushes the bundle to the remote. The work machine never holds the remote's credentials.

Similar patterns for other workflows:

- **Email**: write on the work machine, transport drafts (encrypted) to a separate machine that holds the SMTP credentials.
- **Signing**: prepare the document on the work machine; transport to an air-gapped signing machine (Tails or a Qubes offline qube); transport the signed artifact back.
- **Cryptocurrency**: hot wallet for small transactions and balance display; cold wallet on an air-gapped machine for the bulk; transfer to hot wallet only what you'll spend.

When to pick into this layer: when you've identified a specific credential whose compromise would unacceptably cascade. A personal GitHub credential probably doesn't justify it. A code-signing key for production software does. An SSH key for production infrastructure does. The cryptocurrency case where balance is meaningful does.

### Supply chain hygiene

The code you install is an attack surface in its own right, separate from the documents you open.
Every dependency you pull through apt, Flatpak, npm, cargo, pip, or a curl-piped install script is code that runs on your machine, often the moment it installs, with your privileges and your secrets in reach.
The IronWorm npm worm in June 2026 is the live example: a binary that fired on install, swept the machine for cloud, npm, AI, and wallet credentials, then republished itself through the victims' own publishing credentials.
The credential-isolation pattern above is half the defense: keep the credentials that publish or sign off the machine that installs and builds, so a compromised build environment cannot act as you.
The rest, disabling install hooks where the ecosystem allows it, pinning dependencies by hash, vetting what you add, sandboxing the build of code you have not reviewed, and hardening how you publish, is in `choosing-supply-chain-tools.md`.

### Backup as the final answer

Backups aren't a layer in the defensive stack; they're the recovery answer when the defensive stack fails. The detection layer tells you that compromise happened; backups tell you how to come back.

The operational floor: Borg with daily automated snapshots to a local encrypted external drive, plus monthly rotation of a second external drive to an off-site location, plus a verified-working restore procedure. Choosing the backup tool and the discipline around it (3-2-1, off-site rotation, append-only, restore testing) is in `choosing-backup-tools.md`; the Devuan procedure that implements this floor is in `devuan-secure-workstation.md` Part 3.1.

The threat model where backups specifically matter: ransomware, disk failure, theft, fire, your own mistake (`rm -rf` to the wrong directory). For all of these, the answer is "restore from yesterday's snapshot." For the off-site-fire case specifically, the answer requires the off-site copy; backups in the same building as the original are one bad day from being no backups.

The hardest part of backups is not the technology; it's the routine. A backup that's never tested doesn't restore. A backup whose passphrase is in the head of someone who's now in the hospital doesn't restore. Test the restore quarterly; document the recovery procedure somewhere a trusted person can find it.


## Out of scope, deliberately

Things this project does not cover and where to find the equivalent treatment for each.

**Browser hardening details.** The cross-cutting section above gives the framework. The deep dive belongs to PrivacyGuides.org and the arkenfox project. A future `choosing-browser-hardening.md` in this project is on the roadmap.

**Operational security in general.** The discipline of not leaking metadata, not reusing names, not posting on schedules, not getting photographed at the same coffee shop where you do anonymous work. This is the layer no software can provide. Read the EFF SSD, Grugq's older essays on operational security, and the Tails operational-security documentation.

**Compliance, audit logging, fleet management.** This project is for individual workstations. Enterprise security at scale is a different conversation.

---