# Security Landscape: The Layered Stack

The map. [The security overview](security-overview.md) is the trailhead and the reading order; [why you should secure your system](why-secure-your-system.md) is the reason to bother. This is the terrain in between: what you are actually defending, the layered stack that defends it, how to size your effort, and how far the climb goes. Read it after the overview and before the first rung ([the OS picker](os.md)). You do not need to act on any of it yet; it is orientation, not procedure.


## The six layers

Security on a single Linux workstation is a stack of six layers, not a single decision. Each layer defends against a class of threats the others don't.

1. **Foundation.** Which OS. Devuan is the default this project recommends; Qubes, Tails, or Whonix for specific high-security scenarios.
2. **Confidentiality.** Full-disk encryption plus per-file encryption for sensitive data. LUKS at install time; Borg for backups; age for one-off encryption needs.
3. **Hardening.** Reducing the running system's attack surface. CPU microcode, kernel sysctls, AppArmor, MAC randomization, encrypted DNS, USBGuard, Thunderbolt/DMA authorization, kernel lockdown.
4. **Input vetting.** Scanning the documents and files you receive before opening them. ClamAV plus Didier Stevens' pdfid suite plus YARA, with Firejail as the sandboxed-open layer. The `doc-malware-scan.sh` script in this project is the operational wrapper. The code you install is a second input class this layer does not cover: a package that runs on install is a different vector from a document you open, and its defenses live in `choosing-supply-chain-tools.md`.
5. **Detection.** Catching tampering after it happens. AIDE plus debsums plus auditd is the standard stack.
6. **Compartmentalization.** Isolating credentials and identities across machines, or workloads on one machine. Qubes covers the on-one-machine case; the `bundle-queue` script covers the credential-isolation case.

These layers compose; none of them is a wall on its own. Each shifts the odds rather than guaranteeing anything: a hardened machine running a browser can still be exploited, the exploit just costs more, persists less easily, and is likelier to be caught. Depth is the point.

Plus cross-cutting concerns that aren't a single layer: hardware tokens, Heads coreboot for firmware-level integrity, the Tor-versus-VPN-versus-mesh question, browser hardening, secure messaging, off-machine backups, and the operational-security habits that no software can replace, all covered in the cross-cutting section of [the security overview](security-overview.md).

Everyone should run the baseline: Linux, full-disk encryption, the hardening floor, document scanning, and integrity monitoring. It is low-friction once set and it helps no matter who is after you. From there, climb as far as your time and money allow: add anonymity (Tor, Tails) for sessions that shouldn't trace back to you; add isolation (Qubes, identity separation) for workloads that can't safely share a machine; combine both into the maximal posture (Qubes-Whonix on coreboot hardware) if you're under active targeting and will keep it maintained. The detail is in "The ascent" below.


## The 14 attack surfaces, ranked

First, the broader picture: what attack surfaces actually matter for a normal person's online privacy. The main OS guide compresses this into one paragraph in "Why your OS matters." The fuller version, in rough order of how much practical privacy loss each one accounts for:

1. **The browser.** The single biggest surface. Fingerprinting via canvas, WebGL, fonts, screen resolution, timezone, plugin list. Cookies, supercookies, localStorage, IndexedDB, referrer headers, and the sheer volume of JavaScript execution that can exfiltrate data. Most people spend 90% of their online time here.
2. **DNS.** Almost always leaks where you go even if everything else is encrypted. Your ISP sees every domain you resolve unless you're using encrypted DNS, and even then, the resolver operator sees it all.
3. **Your ISP.** Sees your IP traffic metadata regardless of content encryption. Knows your real identity by contract.
4. **The OS itself.** Telemetry (Windows is catastrophic here), automatic connections to update servers, NTP pings, captive-portal detection. All happen before you do anything deliberately.
5. **Your IP address.** Ties your physical location and ISP identity to everything you connect to. VPNs shift trust to the VPN operator rather than eliminating the problem.
6. **Account linkage.** Logging into any account immediately collapses anonymity across sessions. Email addresses, phone numbers, and OAuth logins are identity anchors.
7. **Metadata on communications.** Even with end-to-end encryption, who you talk to, when, how often, and message sizes are usually visible.
8. **Hardware identifiers.** MAC addresses, hardware serials exposed through the OS or browser, CPU/GPU fingerprinting via timing attacks.
9. **Behavioral fingerprinting.** Typing rhythm, mouse movement patterns, scroll behavior, time-of-day usage patterns. Passive and hard to defeat.
10. **Third-party content.** Trackers, ad networks, CDNs, embedded fonts, and analytics scripts loaded on pages you visit. A single Google Fonts call or Facebook pixel reports your presence to a third party.
11. **Email.** Open-tracking pixels, IP leakage in headers from naive clients, and the fact that your counterparty's provider sees everything.
12. **Mobile devices.** GPS, cell-tower triangulation, accelerometer fingerprinting, app permissions, and the fact that iOS and Android are both hostile to privacy by design.
13. **Payment methods.** Credit cards and PayPal create a permanent financial graph of your activity. Extremely hard to break without cash or privacy-preserving crypto.
14. **Physical layer.** WiFi probe requests broadcast your device's previously connected SSIDs. Bluetooth does similar things. Your router's logs exist.

The browser and DNS together account for the majority of practical privacy loss for most people. Everything else matters, but fixing those two has the highest return. The OS sits at position four, which is why the project's main guide is about switching it. The six layers above are how you systematically address surfaces 1 through 14: foundation (OS at position 4 plus what the OS enables you to defend at positions 1, 2, 5, 10), confidentiality (data at rest, complements 1 and 11), hardening (closes attack surfaces the OS itself opens), input vetting (catches malicious content arriving via surfaces 10 and 11 before it hits the workstation), detection (catches when defenses fail), and compartmentalization (limits damage when one layer falls).


## Sizing your effort

The cheapest security is the exposure you never create. You can't lose a password you never set, leak an account you never opened, or have metadata correlated that you never emitted. Before any tool: shrink your footprint. Fewer accounts, fewer identifiers tied to each other, less posted, less linked, less said. That shrinks every surface on the list above at once and costs nothing but discipline. Do it first, and keep doing it; no tool below recovers privacy you gave away by oversharing.

Then size how much of the rest is worth doing, and in what order. The standard framework is four questions, asked in order.

**What am I protecting?** Be specific. "My data" is too vague. Concrete answers: my financial records and tax history; my private communications with my source; my cryptocurrency wallet's seed phrase; my notes on a sensitive medical condition; my draft of the article that will be published next month; the photos on my phone that no one else should see; the credentials that let me deploy code to production. List them. The list will reveal that you have several different protect-targets and they probably need different layers.

**Who is plausibly trying to get it?** Be honest. For most people: opportunistic malware authors; ad networks and data brokers building behavioral profiles; thieves who would resell a stolen laptop; a vengeful former associate; a corporate employer monitoring its devices; an ISP selling browsing data. For some, additionally: investigators on behalf of a hostile state, a corporate adversary in active litigation, organized criminals targeting cryptocurrency holders, intelligence services targeting journalists' sources. Knowing who is actually after you doesn't cap how far you climb (climb as far as you can afford) but it tells you which surfaces to close first.

**How likely are they to succeed, and against what?** A vague threat model produces vague defenses. If your threat is "opportunistic malware," the question is whether a browser exploit gets your home directory or just your browser sandbox; AppArmor and hardening fix that. If your threat is "stolen laptop," the question is whether the disk is encrypted; LUKS fixes that. If your threat is "ISP-level surveillance," the question is whether encrypted DNS and HTTPS-everywhere cover your traffic; you set those up once. If your threat is "I might be specifically targeted by a state-level actor with physical access to my hardware," the question is whether Heads-coreboot detects the tampering; that's a months-of-work answer with hardware purchases.

**What happens if they succeed?** The effort a defense is worth scales with the cost of failure. If the stakes are "I lose some embarrassing photos," LUKS plus a reasonable browser is enough. If the stakes are "a source is identified and arrested," Qubes-Whonix on Heads coreboot starts to look reasonable. If the stakes are "I lose my cryptocurrency cold-storage seed phrase," the answer involves air-gapped machines and physical paper backups in safe deposit boxes.

Answer all four for each thing you're protecting. The protect-targets usually vary, your photos need baseline protection; your source's identity needs the anonymity branch; your cryptocurrency seed needs cold storage, so the answer is to use different layers for different things rather than apply one setting to everything. A common mistake is fixating on the protect-target that feels most dramatic ("I have a journalist friend, I should run Qubes") while leaving the mundane surfaces that actually get most people (the unencrypted disk, the reused password, the un-vetted PDF) wide open. Close the boring surfaces first.

One more thing, because it cuts against the instinct to remove every annoyance: friction in your setup is often doing protective work you can't see. The LUKS passphrase you type at every boot, the AppArmor profile that breaks one workflow per quarter, the hardware-token tap for sudo, the USBGuard block when a colleague hands you a stick, every one of those is a problem you could "solve," and every such solution removes the friction that was the protection. Some problems are immune systems. Be deliberate about which ones you remove.


## The ascent: do the baseline, then climb as far as you can afford

The old way to read this was "pick the user you are." The better way: everyone does the baseline, then climbs. The goal is to be as safe as you can afford in time and money, not as safe as some adversary forces you to be. Aim high. The only real ceiling is the one in the guardrail at the end of this section: don't build higher than you'll keep running.

### The baseline, everyone, regardless of who's after you

Low-friction once it's set, and it helps against every threat from opportunistic malware to a stolen laptop. Build it in this order; each step assumes the last is done.

1. **Replace the OS.** If you're still on Windows or macOS, this is the first piece of security work and nothing else here matters until it's done. Devuan (this project's default) or Mint; the picker is in `os.md`. The migration closes the entire vendor-surveillance surface in one move.
2. **Full-disk encryption.** Read `choosing-encryption-tools.md` for the tool overview, then run `devuan-luks2-install.sh` on a fresh install. FDE can't be retrofitted painlessly, so do it at install time. Long passphrase, written down and stored separately, plus a LUKS header backup on a USB stick kept in a different room, plus off-machine encrypted backups via Borg. Without all three you don't have working encryption at rest; you have a brick-when-the-disk-dies, a panic-when-you-forget, or a one-fire-from-total-loss setup.
3. **Harden the running system.** `devuan-secure-workstation.md`, the install plus runtime-hardening sections, done in order. Skip kernel lockdown unless you understand the trade-offs (it can break DKMS modules and hibernation). Most of this is `apt install` plus a few config files; hours, not days.
4. **Vet documents before opening them.** Install `doc-malware-scan.sh` (`choosing-document-scanning-tools.md`); it auto-installs the stack on first run. Scan every PDF, EPUB, or Office document from an un-vetted source, then open it in `firejail --net=none` even after a clean scan. Document-borne malware is the most common compromise path for a normal user, and this returns more protection per minute than almost anything else on this list.
5. **Monitor integrity.** `apt install aide debsums auditd rkhunter`, capture a clean baseline with `aideinit`, then cron daily AIDE and weekly debsums/rkhunter (`choosing-hids-tools.md`). The hard part isn't setup, it's reading the output, decide how you'll actually see the reports before you turn monitoring on.

Plus the cross-cutting items below, set up once: a hardware token for SSH and 2FA, encrypted DNS (covered in the hardening step), and a privacy-respecting browser (LibreWolf as default, Tor Browser for sensitive sessions). For most people the baseline is the realistic stopping point, and it is already far harder to attack than what almost anyone runs. A motivated weekend-and-a-half gets you here.

### Going further, two branches, take either or both as you can afford

These are different axes, not later rungs of one ladder; you might want one and not the other.

**Anonymity**: for activity that shouldn't trace back to you. Sessions that need to stay uncorrelated with your daily identity: a journalist's source contact, a whistleblower's disclosure prep, research into hostile groups, coordination before a public action. Tools: Tor Browser for browsing, a Tails USB for amnesic sessions (the live-OS scenario in `os.md`), Whonix for whole-system Tor, a separately-encrypted USB for files that travel with these sessions. The discipline matters more than the tools: never log into a personal account from the anonymous context, never reuse a username across the two, time-separate the patterns. The full landscape of transports is in `choosing-networking-tools.md`; messaging that fits this branch is in `choosing-communication-tools.md`.

**Isolation**: for workloads or identities that can't safely share a machine. When one app being exploited is genuinely dangerous because of what the next app over holds: a developer who also handles sensitive customer data, a cryptocurrency operator, a lawyer with privileged files and a personal life on the same hardware. Qubes OS is the maximalist answer (every app in its own VM; the hardware floor is real, 16GB RAM, IOMMU-capable CPU, supported laptop; the compartmentalized-daily-driver scenario in `os.md`). Short of Qubes, AppArmor gives per-program confinement on hardened Devuan, and `privacy-setup.md` covers identity separation across users and VMs. For credentials specifically, keep the machine that writes separate from the machine that holds push/sign keys: Qubes' split-GPG and split-SSH, or the `bundle-queue` pattern for the git-push case.

**Mobile** runs parallel to all of this and can be climbed any time after step 1. `choosing-phone.md` (Pixel plus GrapheneOS) and `grapheneos-install.md`. At higher postures it stops being optional: a hardened workstation paired with a stock phone that betrays you is a half-measure.

### The maximal posture, for active targeting

Both branches combined, on hardware you've taken control of. This is the stack for someone whose threat model genuinely includes nation-state-class adversaries: journalists where journalism is prosecuted, activists under state-aligned surveillance, people whose community is in an aggressive state's crosshairs. The shape: Qubes-Whonix on Heads-coreboot hardware (the hardware purchase is itself part of the security work, supply-chain interception is in the threat model; `choosing-hardware.md`); LUKS with `/boot` on a USB you carry and Argon2id key derivation; full hardening of every qube template with kernel lockdown and USBGuard enforced; DNS routed over Tor via the Whonix gateway; documents quarantined through a no-network analysis qube before they touch anything; integrity monitoring with off-host log delivery; multiple persona qubes; an air-gapped offline qube for signing; a hardware token for every credential; GrapheneOS on the phone; and operational discipline that treats every network interaction as logged. Setting it up properly is weeks; maintaining it is ongoing. At this level the documents in this project are the entry point, not the destination, read PrivacyGuides.org, the EFF Surveillance Self-Defense guide, Tails' operational-security docs, and the Whonix forum.

### The guardrail

Climb only as high as you will actually keep running. Security you abandon is worse than security you never built: it costs you the setup effort and then pays you back in false confidence, the Qubes install you stopped maintaining, the AIDE reports nobody reads, feel like protection while protecting nothing. "Affordable" includes attention, not just money and a setup weekend. So aim high, but pick the highest posture you'll sustain and run that, not the one that looks most impressive in a threat-model diagram.