# Choosing the right operating system: in 2026

A guide for people who want to stop letting Microsoft and Apple own their computer. Written for beginners. Updated as things change.

## TL;DR

If you've never used Linux and you're coming from Windows, install Debian stable with the Cinnamon or XFCE desktop. Modern Debian installs about as easily as anything else, because since Debian 12 it ships the non-free firmware that used to make a first install painful[^debian-firmware], and it sits on the trunk rather than a corporate derivative, so it will still be the right call in five years. If you want the same thing without systemd, install Devuan instead. Linux Mint is still the most Windows-like landing if visual familiarity is the one thing you care about, but it now carries real caveats (see its entry), and this guide no longer steers first-timers to it by default.

Debian or Devuan is a destination, not a waystation; for most people it is where you can stop. If after six months you want to go further, the directions branch. For a leaner no-systemd system, Void. For bleeding edge, Arch. For total control and understanding, Gentoo. For privacy as a first principle, Qubes OS with Whonix templates, or Tails on a USB stick for sessions where nothing should persist.

Do not install Ubuntu in 2026. Its minimum RAM requirement (6GB) is now higher than Windows 11's (4GB), its CPU requirement (2GHz dual-core) is double Windows 11's (1GHz dual-core)[^ubuntu-req], Snap keeps silently replacing apt packages, and a local-root privilege escalation in the default Snap stack (CVE-2026-3888) was disclosed in March 2026[^cve-3888]. Ubuntu is the distro Linux was supposed to be an alternative to.

The rest of this doc shows the work. If you don't know what a "distro" is, start at [Terms you'll need](#terms-you-ll-need).

## Why your OS matters: the biggest attack surface you have

Most people think about privacy the wrong way around. They worry about which browser they use, which VPN they pay for, whether to turn off cookies. These matter, but they're all downstream of a larger question: what operating system is quietly watching you the whole time?

Your OS is the software that runs everything else. It sees every keystroke before your browser does. It sees every file before your password manager encrypts one. It sees every network request before your VPN touches it. If your OS is hostile, nothing you do on top of it is private. This is not theoretical: Windows sends telemetry to Microsoft by default, macOS sends analytics to Apple by default, and both platforms have quietly expanded what "telemetry" means over the last decade without really asking. Windows 11's Recall feature takes periodic screenshots of your screen and stores them. Microsoft account login is now required for setup. Apple scans files on your own machine against a hash list and decides whether to let you open them ("notarization"). You paid for the hardware; they took a seat at the table anyway.

Worse, data brokers have quietly industrialized what used to be the domain of intelligence services. Companies like Palantir and its peers don't need to hack you: they buy you. Location history from weather apps, purchase history from loyalty programs, browsing patterns from the ad SDKs embedded in every free app, social graphs from anywhere you've logged in with Google or Facebook, call and text metadata from telco partnerships, all of it is aggregated, packaged, and resold into detailed profiles that intelligence contractors, law enforcement, and private clients purchase legally. Epstein's little black book was not a fluke of one man's networking. It was a demonstration of what happens when powerful people collect leverage over other powerful people, and in 2026 that same function has been industrialized and automated at scale, except now it's your data too, not just the elite's, and the buyers are not always people you would trust with it. Running Linux does not sever every pipe (your ISP still sees your traffic, your phone still pings towers) but it removes one of the largest and most leaky attack surfaces: the OS itself. Windows telemetry and macOS analytics are direct feeds into ecosystems where Microsoft and Apple are themselves data businesses with partner relationships you've never consented to in any meaningful sense. Linux running a hardened configuration with a decent firewall, combined with a trustworthy DNS resolver, means you've closed the hole that most people don't even know is open. It won't make you invisible, but it stops you from being low-hanging fruit, and in a world where data is used to build leverage, being harder to profile than the next person is not paranoia, it's basic hygiene.

In rough priority order, the largest attack surfaces for a normal person's online privacy are: the browser (fingerprinting, JavaScript, cookies, localStorage); DNS (every domain you resolve is visible to someone upstream unless you use encrypted DNS); your ISP (contractually knows who you are); the OS itself (telemetry, update servers, captive portal checks, NTP pings); your IP address; account linkage (logging in anywhere collapses anonymity across sessions); communication metadata (who-when-how-often is visible even on encrypted chat); hardware identifiers (MAC addresses, CPU serials); behavioral fingerprinting (typing rhythm, mouse patterns); third-party content (ad trackers, analytics, embedded fonts and pixels); email (open-tracking pixels, IP leakage); mobile devices (GPS, cell towers, app permissions, iOS and Android are both hostile by design); payment methods (cards and PayPal are a permanent financial graph); and the physical layer (WiFi probe requests, Bluetooth beacons).

The browser and DNS together account for most of a normal person's practical privacy loss, which is why most advice starts there. So why does this project start with the OS instead of the browser? Because the browser runs on top of the OS, and a hostile OS sees everything the browser does before any browser setting takes effect. Windows 11's Recall feature periodically screenshots your screen; an OS can log your keystrokes before the browser ever receives them. Hardening the browser on Windows or macOS is building on sand, because the substrate underneath can quietly undo it. You cannot fix the OS while you are still on Windows or macOS, because the whole system is designed around a relationship with the vendor. So you switch the OS first, which is the one move that closes the entire vendor category and gives the browser solid ground to stand on, and then you harden the browser early, as the very next thing you do. Starting with the OS is not a claim that the OS matters more than the browser; it is that the browser fix only holds once the OS underneath it is trustworthy.

## A note to privacy experts and freedom fighters

The Iron Law of Oligarchy and the entryism behind it are laid out in [why-secure-your-system.md](why-secure-your-system.md); this section is its distro-watching corollary. People who know how an operating system works have a specific obligation to people who don't. If you are a maintainer, a security researcher, a long-time Linux user, or anyone else who can read a commit graph and recognize a capture pattern when you see one, you are the canary. The rest of us (people who don't know how to build a kernel, who bought the machine to do our actual work) depend on you to tell us when a project has drifted, when a maintainer has been co-opted, when a corporate acquisition has changed what a distro is actually doing underneath. The pursuit of privacy is a never-ending chase because the institutional forces pulling the other way never rest. You are the ones in a position to see it first.

Specifically, if you see evidence that a widely-recommended beginner distribution has been quietly changed (telemetry added, corporate sponsorship introducing policy changes, governance captured, package trust compromised) post about it loudly, write it up, make it findable. Cautionary cases already exist. Ubuntu was the friendly, accessible Linux for a decade; the Snap enforcement and the 2026 system-requirements jump are the current symptoms of a long drift. Linux Mint is the recommendation most experienced users still give to Windows migrants today, and its very popularity makes it the most obvious next target for capture or compromise. The project is currently clean (independent wireshark audits in 2025 found no Mint telemetry beyond basic update-server contact[^mint-telemetry]) but there is already an unexplained Cinnamon memory leak on Mint 22.2 that was reported to the official repository on 22 December 2025, four months ago, and remains open and unassigned as of this writing (GitHub issue linuxmint/cinnamon#13298[^mint-leak]). One open bug does not prove capture, but it does prove the project's quality-control is slipping at exactly the moment its install base is growing fastest on the back of the Windows 10 end-of-life migration. Users who upgraded to Mint 22.2 and noticed their machine getting slower over the winter were not imagining it.

If you're someone who can tell when the pattern is getting worse, please tell us.

The practical takeaway for your own setup: treat every recommendation in this document, including the strong ones, as true right now, not forever. Check on your distro once a year. Read the project's commit history and governance disputes, not just its marketing page. When a project starts behaving differently, leave.

## Contents

- [TL;DR](#tl-dr)
- [Why your OS matters: the biggest attack surface you have](#why-your-os-matters-the-biggest-attack-surface-you-have)
- [A note to privacy experts and freedom fighters](#a-note-to-privacy-experts-and-freedom-fighters)
- [Why Windows and Mac stopped being good](#why-windows-and-mac-stopped-being-good)
- [Terms you'll need](#terms-you-ll-need)
- [Picking a desktop: what Cinnamon, GNOME, XFCE, KDE actually mean](#picking-a-desktop-what-cinnamon-gnome-xfce-kde-actually-mean)
- [Decision shortcut](#decision-shortcut)
- [What not to pick in 2026](#what-not-to-pick-in-2026)
- [How this doc is structured](#how-this-doc-is-structured)
- [What counts as "widely used" in 2026](#what-counts-as-widely-used-in-2026)
- [The install-once-and-forget axis](#the-install-once-and-forget-axis)
- [The systemd problem](#the-systemd-problem)
- [Community politics and the vibe test](#community-politics-and-the-vibe-test)
- [Debian](#debian)
- [Ubuntu](#ubuntu)
- [Linux Mint](#linux-mint)
- [MX Linux](#mx-linux)
- [Fedora](#fedora)
- [Arch Linux](#arch-linux)
- [EndeavourOS, CachyOS, Manjaro (Arch derivatives)](#endeavouros-cachyos-manjaro-arch-derivatives)
- [Omarchy](#omarchy)
- [Devuan](#devuan)
- [Artix](#artix)
- [Void Linux](#void-linux)
- [Gentoo](#gentoo)
- [NixOS](#nixos)
- [Slackware](#slackware)
- [openSUSE Tumbleweed and Leap](#opensuse-tumbleweed-and-leap)
- [OpenMandriva](#openmandriva)
- [Pop!_OS](#pop-os)
- [Zorin OS](#zorin-os)
- [Bazzite and SteamOS (gaming)](#bazzite-and-steamos-gaming)
- [Alpine](#alpine)
- [High-security operating systems: how to pick](#high-security-operating-systems-how-to-pick)
- [Qubes OS](#qubes-os)
- [Whonix (and the VPN question)](#whonix-and-the-vpn-question)
- [Tails](#tails)
- [Kicksecure](#kicksecure)
- [Vendefoul Wolf](#vendefoul-wolf)
- [Trisquel and PureOS (libre)](#trisquel-and-pureos-libre)
- [Where Linux comes from: the Unix lineage](#where-linux-comes-from-the-unix-lineage)
- [BSDs as an adjacent path](#bsds-as-an-adjacent-path)
- [Further reading: how to actually learn Linux](#further-reading-how-to-actually-learn-linux)
- [Changelog](#changelog)

## Why Windows and Mac stopped being good

Windows 10 reached end-of-support on 14 October 2025[^w10-eol]. Microsoft's answer is Windows 11, which requires TPM 2.0, Secure Boot, and a CPU from an approved list; hundreds of millions of otherwise-working machines don't qualify. For the ones that do, the default install now includes: Recall taking periodic screenshots and storing them, a forced Microsoft account at first boot, Copilot wedged into the shell, advertisements in the Start menu and on the lock screen, ads in the file manager, Cortana, and a steady background push toward OneDrive and Microsoft 365 subscription services. Telemetry is on by default and deliberately hard to fully disable, even when you think you've switched everything off in Settings, you haven't fully. Updates install when Microsoft decides, not when you do, and they have bricked machines more than once. You need a Microsoft account just to finish setup. The OS phones home constantly. You are running a surveillance platform that also plays games.

Windows defenders will say "just tweak the settings." The fact that you have to spend hours un-defaulting your way out of corporate surveillance to use your own machine is the indictment, not the defense.

Mac is cleaner and more coherent, and Apple locks you in tighter than anyone. The hardware is proprietary. The software ecosystem is a walled garden. Repairs require Apple's permission, financially if not literally. Gatekeeper actively blocks software Apple hasn't blessed (notarization puts Apple in the middle of software distribution). Every few years Apple drops support for hardware that is still perfectly capable, you paid $3,000 for a machine that Apple will tell you, three to five years later, can no longer run the current OS. Applications get sandboxed more aggressively every release. The M-series chips are fast and efficient; you are also not allowed to know what is running on them at a deep level. The privacy posture Apple markets hard is real only up to the point where Apple's own telemetry starts, and Apple scans files on your own machine against a hash list to decide whether to let you open them. You're not buying a computer. You're renting an expensive aesthetic.

Both companies have decided that your computer is a client for their cloud. Linux is the last mainstream way to run your own computer. It isn't perfect, but it is yours, you choose the kernel, the init, the shell, the filesystem, the package manager, the desktop, and which parts of it phone home (in most distros, none). In 2026 you can also run Linux on the same hardware most people buy, watch Netflix in a browser, join a Teams call, edit photos, write code, and stream to a TV, all without a subscription or a vendor account. For most people, the remaining friction is smaller than the friction of putting up with Windows 11.

### When keeping a Mac for one specific thing is OK

A realistic concession the doc owes you: for some specialized production work, Mac's software stack is genuinely hard to match on Linux, and the honest posture is not "leave Mac, period" but "leave Mac for general computing, and keep a Mac as a dedicated tool if you actually need what it does." Final Cut Pro and Logic Pro have no Linux equivalent. DaVinci Resolve runs on Linux but the free version strips out AAC and MP3 in/out, several codecs need manual workarounds, and driver integration is rougher than on Mac. Adobe refuses to ship for Linux and the open-source alternatives (GIMP, Krita, Inkscape, Kdenlive) are good but not drop-in replacements for a working Creative Cloud pipeline. Logic, Pro Tools, and most of the commercial audio-production ecosystem assumes Mac or Windows.

Bryan Lunduke, who is otherwise one of the louder voices against consumer-OS drift and runs OpenMandriva as his daily driver, still uses a Mac for video production on *The Lunduke Journal*. That isn't a contradiction. It's a working adult's acknowledgment that the right tool for one specific professional workflow is not always the right tool for the rest of computing. A sovereignty-minded posture does not require that every machine in your house run Linux. It requires that your general-purpose computing (the machine you browse on, the machine you write on, the machine that holds your files) is not a surveillance client. A Mac Mini or MacBook kept offline-ish as a dedicated video workstation is a tool, not a surrender. The distinction that matters is whether a given machine is your general computing life or a specialized appliance.

## Terms you'll need

A handful of words get used constantly in the Linux world and almost never defined. If you're new, this section is here so the rest of the doc reads normally.

**Kernel.** The single piece of software that talks directly to your hardware, CPU, RAM, disk, keyboard, screen, network. Every other program asks the kernel instead of touching hardware itself. Linux is, strictly, just a kernel. Linus Torvalds wrote it in 1991 and still runs its development. When people say "Linux," they usually mean a kernel plus a bundle of other software built around it.

**Distribution, or distro.** A specific bundle: the Linux kernel plus a package manager, a set of default applications, a desktop environment, and a bunch of defaults about how things are configured. Ubuntu is a distro. Debian is a distro. Fedora is a distro. There are hundreds. They mostly differ in which bundle they ship and how it's maintained.

**Base distro, upstream, downstream.** Some distros are built from scratch (Debian, Arch, Gentoo, Slackware, Void, Alpine). Others are built *on top of* those. Ubuntu is built on Debian. Linux Mint is built on Ubuntu. When something is fixed, it often gets fixed at the source first and flows down: Debian fixes a bug, Ubuntu pulls the fix from Debian, Mint pulls it from Ubuntu. The distro your distro is built on is called its **upstream**. A distro built on top of yours is **downstream**. This matters mostly for two things: when something breaks, the fix usually originates upstream; and when you search for help, tutorials for your upstream mostly apply to you with small adjustments.

**Package manager.** The tool that installs, removes, and updates software on your system. `apt` on Debian and Ubuntu and Mint, `dnf` on Fedora, `pacman` on Arch, `zypper` on openSUSE, `xbps` on Void, `apk` on Alpine. They are all solving the same problem (don't download installers from random websites; let a vetted repository handle it) with different commands.

**Init system.** The first program the kernel starts after boot. It then starts everything else, networking, logging, your graphical login screen. For two decades the default was a simple script-based system called sysvinit or its descendants (OpenRC, runit). In 2010 a Red Hat engineer named Lennart Poettering started a replacement called systemd. Systemd does much more than just start processes; this is the core of the controversy. See [The systemd problem](#the-systemd-problem) below.

**Desktop environment.** The visible part of Linux: the taskbar, window decorations, file manager, default theme. GNOME, KDE Plasma, Cinnamon, XFCE, MATE are the main ones. A single distro usually offers several; the "flavor" or "edition" you download picks one. See [Picking a desktop](#picking-a-desktop-what-cinnamon-gnome-xfce-kde-actually-mean) below for what each one actually means in practice.

**Rolling release vs stable release.** A rolling distro updates individual packages continuously: Arch, Void, Tumbleweed, Gentoo, Devuan's testing branch. You get new software fast but occasionally something breaks. A stable-release distro freezes the whole package set for two or three years, only shipping security fixes: Debian stable, Ubuntu LTS, Mint, Rocky Linux. You get older software but almost no surprises.

**LTS.** "Long-Term Support." A specific release is promised updates for five or ten years. Ubuntu LTS releases (every two years, supported five years without Ubuntu Pro, ten years with it) are the famous example.

**systemd-free.** Shorthand for distros that still use sysvinit or OpenRC or runit instead of systemd. Devuan, Artix, Void, Gentoo (by default), Alpine, Vendefoul Wolf. See [The systemd problem](#the-systemd-problem).

**Live USB.** You can put Linux on a USB stick and boot your computer from it without installing anything. The distro runs from the USB, touches nothing on your hard drive. Good for trying a distro, or for privacy tools like Tails where the whole point is leaving no trace. If you can't even make a USB stick (locked-down work laptop, no admin, no spare hardware) Fabrice Bellard's JSLinux ([bellard.org/jslinux](https://bellard.org/jslinux/)) runs a Linux shell (Alpine, Buildroot, or Fedora RISC-V) directly in a browser tab via WebAssembly. It is a curiosity, not a distro evaluation: the hardware is fake, so it tells you nothing about whether your real Wi-Fi or trackpad will work, and the demo images are tiny. Good for thirty seconds of "so this is what a shell looks like."

**Flatpak and Snap.** Two different ways to install an application without worrying about system libraries, the app ships with everything it needs. Flatpak is community-run, cross-distro, and generally fine. Snap is Canonical's (Ubuntu's parent company) version; its backend is proprietary and its behavior has been controversial. This is why Linux Mint strips out Snap on install.

**AUR (Arch User Repository).** A community-run collection of build scripts for Arch Linux that makes almost any software installable via a simple command, even if it isn't in the official Arch repos. Roughly 100,000 packages. Only applies to Arch and its derivatives (EndeavourOS, CachyOS, Artix).

**Immutable base filesystem.** A newer approach, used by Fedora Silverblue, Bazzite, and a few others. The core operating-system files are marked read-only and updated as a single transaction, either the whole update succeeds and you reboot into the new system, or it fails and you stay on the old one. You install your applications in a separate layer (usually Flatpak, or a container tool like Distrobox). The practical consequence: you can't easily `apt install` a system package, but you also can't break your system by accident.

**Hardening.** In OS security, "hardening" means changing the defaults so that if something goes wrong, the damage is smaller. Vanilla Linux boots with a lot of features enabled that most people never use (some kernel modules, some network protocols, some permission combinations) and any of those can become an attack surface if a bug turns up. A hardened system switches those off by default and tightens the remaining ones. See the Kicksecure entry for a concrete example.

## Picking a desktop: what Cinnamon, GNOME, XFCE, KDE actually mean

A desktop environment (DE) is the visible part of Linux, the taskbar, the window decorations, the file manager, the default look. The DE is separate from the distribution; most big distros offer several, and you pick the one you want at install time by choosing an "edition" or "flavor" (e.g. "Fedora Workstation" ships GNOME, "Fedora KDE Spin" ships KDE Plasma, same underlying Fedora). Here's what the main options actually are.

**Cinnamon.** Looks like Windows. Taskbar at the bottom, start-menu-style application launcher in the corner, system tray, minimize/maximize/close in the top-right of each window. Moderately heavy, uses more RAM than XFCE but less than GNOME. Developed by the Linux Mint project, which is why it's Mint's flagship edition. Runs well on anything with 4GB of RAM and up. Pick this if you're leaving Windows and want the transition to be invisible. First-class on Linux Mint; available as a package on Debian, Fedora, Arch, and most others.

**GNOME.** Looks like macOS, or like a tablet-first desktop. No taskbar by default; an "Activities" overview for switching apps; a single top bar. Heavy on RAM (roughly 1.5–2.5 GB idle). Minimalist to a fault, many options Windows/KDE users expect require installing extensions. Opinionated in ways that frustrate some users and delight others. Ships as the default on Fedora Workstation, Ubuntu, Pop!_OS, Zorin OS, and Debian's default edition. Pick this if you liked the Mac, or you want a clean, gesture-first desktop and don't mind trading configurability for coherence. Note: GNOME's project leadership has been politically active in ways some readers will care about; see [GNOME's political turn and the Code of Conduct asymmetry](#gnome-s-political-turn-and-the-code-of-conduct-asymmetry) for the record.

**KDE Plasma.** Maximally configurable. Every visible element (panel, menus, widgets, animations, keyboard shortcuts, notification behavior) can be moved, swapped, or reconfigured. Surprisingly lean in recent versions, Plasma 6 idle RAM is competitive with Cinnamon. Ships as the default on openSUSE, Fedora KDE Spin, KDE Neon, Kubuntu, and the KDE edition of Linux Mint. Pick this if you want control over every pixel, or if you're the kind of person who likes tweaking the desktop to match your exact preferences.

**XFCE.** Minimal, lightweight, traditional. Looks approximately like a classic Windows desktop out of the box, taskbar, menu, basic panel. Uses very little RAM (roughly 400–700 MB idle) and runs well on modest hardware. Stays out of your way. Ships as the default on Xubuntu, MX Linux, and the XFCE editions of Linux Mint, Debian, and Manjaro. Pick this for a ten-year-old laptop, or for a daily driver where you want nothing fancy.

**MATE.** A fork of the old GNOME 2 (pre-2011 GNOME, before the GNOME 3 redesign that alienated much of the existing user base). Traditional, stable, modest RAM use. Similar role to XFCE but with a different aesthetic lineage, slightly more polished, slightly less minimal. Ships on Ubuntu MATE and the MATE edition of Linux Mint. Pick this if you specifically liked GNOME 2 or you want a traditional desktop with a bit more finish than XFCE.

Two smaller DEs worth knowing about if your hardware is genuinely old: **LXQt** (lightweight Qt-based desktop, even leaner than XFCE at ~300 MB idle; default on Lubuntu) and **Budgie** (a Solus-project desktop, modern-looking, moderate weight; ships on Ubuntu Budgie and Solus). Neither is a primary recommendation here but you may see them mentioned.

One thing worth naming about XFCE in particular: if you install the XFCE edition of Mint, Debian, Devuan, Artix, Ubuntu, and Void and line them up, they look almost the same out of the box. That's not a coincidence and it's not laziness. XFCE's upstream ships a coherent set of tools (Thunar file manager, xfce4-terminal, Mousepad text editor, Ristretto image viewer, Xarchiver archive manager, xfce4-taskmanager, xfce4-screenshooter, xfce4-appfinder, xfce4-panel, xfwm4 window manager, xfdesktop background) that distros rarely deviate from. The init system underneath (systemd, OpenRC, runit, sysvinit) doesn't change which XFCE apps are installed. Init is the plumbing; the desktop is the visible furniture. Practical consequence: if you learn XFCE on Mint you know XFCE on Devuan and Void; moving between them is a matter of learning the package manager and the init system, not a new desktop.

Practical summary: Cinnamon if you're coming from Windows. GNOME if you're coming from Mac or you want modern-and-minimal. KDE Plasma if you're a tinkerer who wants control. XFCE if your hardware is modest or you're conservative. MATE if you specifically miss GNOME 2.

## Decision shortcut

If you're coming from Windows and want it to feel similar:

1. Primary: Debian stable with the Cinnamon or XFCE desktop. Installs cleanly on modern hardware (firmware included since Debian 12), sits on the trunk rather than a corporate derivative, and is the choice you will not have to revisit. Cinnamon gives you most of Mint's Windows-like layout on the trunk. Pick this unless raw visual familiarity is the only thing you care about.
2. Linux Mint Cinnamon. The closest cosmetic match to Windows, rock-solid feel, huge community, strips out Snap. Pick this if visual familiarity overrides everything else, and read the caveats in the [Linux Mint](#linux-mint) section first (a shipped Cinnamon memory-leak regression, and capture risk that grows with its popularity).
3. Zorin OS. Windows-lookalike polish, explicit migration tooling, GNOME under the hood. Pick this if you want even more hand-holding and are fine paying for Zorin Pro for extra layouts.

If you're coming from Mac and want the craft and cohesion:

1. Primary: Fedora Workstation with GNOME. The closest Linux comes to the Mac "everything designed together" feel. Pick this if you valued the Mac's coherence and you're OK with annual major-version upgrades.
2. openSUSE Tumbleweed with KDE Plasma. Pick this if you want a rolling release with serious testing and you prefer KDE's configurability to GNOME's opinionation.
3. Debian with GNOME. Pick this if you want Fedora's feel without the Red Hat / IBM corporate backing.

If you want something stable, quiet, and long-lived (my pick for most people once they're off training wheels):

1. Primary: Debian stable with XFCE. The default for people who want to install once and stop thinking. Non-corporate governance, massive repo, boring on purpose.
2. Devuan stable. Pick this if you want Debian without systemd. See [The systemd problem](#the-systemd-problem).
3. MX Linux. Pick this if you want Debian stable with nicer defaults and a friendlier installer.

If you want no systemd on principle or practice:

1. Primary: Devuan. Debian-compatible, largest non-systemd ecosystem, supports sysvinit / OpenRC / runit / s6. Pick this if you want `apt` and Debian stability without the systemd dependency tree.
2. Void Linux. Independent from the ground up, runit, xbps, rolling. Pick this if you want something leaner and more modern than Devuan.
3. Artix. Arch minus systemd. Pick this if you want AUR access and rolling-release freshness with init freedom.
4. Gentoo. Pick this if you want source-based compilation and full control over every build flag.

If you want bleeding edge:

1. Primary: Arch Linux. Best wiki in all of Linux, AUR has almost everything, rolling. Pick this if you're comfortable reading documentation and want the canonical Arch experience.
2. EndeavourOS. Pick this if you want Arch with a friendly installer and nothing else added.
3. CachyOS. Pick this if you want Arch tuned for performance on modern CPUs.
4. openSUSE Tumbleweed. Pick this if you want rolling release with real QA behind it.

If privacy is your first principle:

1. Primary: Qubes OS with Whonix templates. Virtualization-based isolation; every app in its own VM; Tor-forced qubes available. Pick this if you have the hardware (16GB+ RAM, compatible CPU) and you're willing to learn the model.
   1.1. Primary: Qubes with default Fedora and Debian templates only, then add Whonix templates once you're comfortable.
   1.2. Qubes with Whonix-Gateway and Whonix-Workstation as the first templates. Pick this if Tor isolation is the reason you're installing Qubes.
2. Tails. Pick this if you want an amnesic live-USB that routes everything through Tor and forgets when you shut down.
3. Whonix on your existing host. Pick this if you want Tor-isolated VMs without the Qubes commitment.
4. Kicksecure. Pick this if you want Whonix's hardening without Tor in the mandatory path.

If you want gaming to just work:

1. Primary: Bazzite. Fedora-based with an immutable base filesystem, preconfigured for Steam/Proton, desktop and handheld variants, HDR/VRR supported.
2. CachyOS. Pick this if you want bleeding-edge kernels and Arch-style maintenance.
3. Nobara. Pick this if you want a Fedora-based approach with a more traditional (mutable) filesystem.
4. OpenMandriva (as a general daily driver that also games). Pick this if you want a community-governed RPM-family distro with KDE Plasma, Proton pre-packaged in the repos, and no corporate owner. Not specialized for gaming the way 1–3 are, but Bryan Lunduke runs it as his primary machine and games on it; if that posture fits your priorities better than frame-rate optimization, this is the pick.

If you want BSD:

1. Primary: OpenBSD. Smallest audited codebase of any general-purpose OS, security-correct by default. Pick this if minimalism-as-security is the goal.
2. FreeBSD. Pick this if you want a production-serious Unix for servers or a NAS.
3. GhostBSD. FreeBSD's base with a MATE desktop, graphical installer, and ZFS-by-default. Pick this if you want FreeBSD for desktop use without the bring-your-own-DE assembly FreeBSD vanilla expects.
4. NetBSD. Pick this if you have unusual hardware or want extreme portability as a principle.

My pick for most readers leaving Windows: Debian stable with the Cinnamon or XFCE desktop on the primary machine, Tails on a USB for anything sensitive. Mint is the fallback only if Windows visual familiarity is the one thing you cannot compromise on. My pick if this doc had to compress into one sentence: Void Linux, independent, lean, no systemd, not owned by a corporation, built by people who ship software instead of running a political project.

## What not to pick in 2026

1. **Ubuntu.** The reason most of this doc exists. Ubuntu 26.04 LTS (released 23 April 2026, same day as this doc) raised the minimum RAM requirement to 6GB, up from 4GB; Windows 11 still lists 4GB minimum. Ubuntu now requires 50% more RAM and double the CPU speed of the proprietary OS it was supposed to be a lightweight alternative to[^ubuntu-req]. Snap installs silently replace `apt install` commands; the Snap backend is proprietary; and in March 2026 Qualys disclosed a local-root privilege escalation (CVE-2026-3888, CVSS 7.8) in the interaction between Snap and systemd-tmpfiles that affects default Ubuntu Desktop 24.04 and later installations[^cve-3888]. An "AI bubble" has driven RAM prices sharply higher at exactly the moment Canonical decided to require more of it. The 2026 RAM bump affects every Ubuntu user at a moment when the project's answer to "why" is essentially "because modern GNOME needs it." This is not the Ubuntu that existed in 2015. Do not install new machines on it. Mint and Debian can both do everything Ubuntu does for you.
2. **Manjaro.** Arch-derived but ships its own delayed repo that's regularly the cause of breakage, and the team has shipped expired SSL certificates on their own website more than once. If you want Arch, use Arch or EndeavourOS. Manjaro is strictly worse.
3. **elementary OS.** Beautiful but the project has been slow since the 2022 co-founder feud. Fine if you're already on it; not a fresh recommendation.
4. **Deepin.** Chinese-state-adjacent, ships its own desktop with closed components, repeated privacy concerns around telemetry. Avoid.
5. **CentOS Stream as a server base.** Red Hat turned CentOS into upstream-of-RHEL rather than downstream. Rocky Linux and AlmaLinux are the real CentOS successors; Debian is the no-corporate-middleman alternative.
6. **Pop!_OS while waiting for COSMIC.** COSMIC is still alpha/beta as of early 2026. If you're starting fresh, start on Fedora or Mint and switch later if COSMIC ships well.
7. **Anything marketed as an "AI Linux" or "crypto-native OS."** These are usually re-themed Ubuntu with a credential-stealing angle.

## How this doc is structured

This is a living reference, not a ranking. The Linux landscape has a stable core (Debian, Fedora, Arch, Slackware, Gentoo) and a churning frontier (immutable distros, Nix-style systems, gaming-focused Fedora remixes). The advice here separates the two so the stable parts age slowly and the volatile parts can be updated without rewriting the doc. Each per-distro entry covers: what it is, who owns it, who it's for, what it's bad at, current trajectory, and roughly where it sits on the community politics axis.

## What counts as "widely used" in 2026

Desktop Linux crossed roughly 4.7% global share in 2025 and is tracking toward 5-6% by end of 2026, driven substantially by Windows 10's October 2025 end-of-support[^linux-share]. The United States crossed 5% in June 2025. India sits at roughly 16% as of mid-2024, the highest major-economy share. Steam's Hardware Survey has Linux at around 2.3-3% through 2025, with SteamOS (Arch-based) the single largest Linux slice.

Distribution-level numbers are fuzzier because most tracking is pageviews or downloads, but roughly: Ubuntu remains the largest desktop Linux by install count, though its enthusiast mindshare has cratered since the Snap controversy. Linux Mint is consistently in DistroWatch's top few and dominates the Windows-refugee segment. Fedora has grown as developers leave Ubuntu. Debian's raw footprint is enormous in hidden form (it is the base of Ubuntu, Mint, Kali, dozens more) but its direct desktop count is smaller. Arch has 17–25% mindshare among technical users depending on how you count derivatives. Gentoo, Void, NixOS, and openSUSE Tumbleweed are each smaller but steady niches with strong retention.

A few specific data points worth knowing (treat all of these as directional, they come from different measurement methods with different biases):

- Stack Overflow's 2024 Developer Survey (65,000+ respondents) has Ubuntu at roughly 27.7% of developer personal use and 27.7% professional use, with Debian around 9.8% personal and 9.1% professional. Other Linux distributions (Arch, Fedora, NixOS, Pop!_OS, etc.) together account for 17.6% personal / 16.7% professional.
- DistroWatch's page-view tracker (which measures community interest, not actual installs) regularly has Linux Mint in the lead at roughly 2,400 daily hits, followed by MX Linux (~2,280), EndeavourOS (~1,640), and Manjaro (~1,400+). Note this under-represents enterprise distributions; RHEL, used by a majority of Fortune 500 companies, ranks in the 50s by page views.
- Enlyft's corporate-adoption data puts Ubuntu at roughly 29% of Linux distribution market share across their tracked deployments.
- Canonical's revenue grew from $175M in 2021 to $251M in 2023, a 43% increase, largely Ubuntu Pro and cloud licensing rather than desktop.
- Red Hat generates roughly $1.87 billion in quarterly revenue after the IBM acquisition, with about 67% share of the paid enterprise server market.
- Arch and its derivatives (EndeavourOS, CachyOS, Manjaro, Garuda, SteamOS) together capture roughly 47% of DistroWatch poll respondents when counted as a family. Among Linux kernel developers specifically, Fedora is the most common distribution at roughly 45%, followed by Arch at roughly 30%.

"Widely used" in this doc = anything on Debian / Ubuntu / Mint / Fedora / Arch / Manjaro-EndeavourOS / openSUSE / Gentoo / Void / NixOS / Devuan / Artix / Pop!_OS / Zorin / Bazzite / Alpine / Qubes / Tails / Whonix, plus the BSDs and a few niche principled entries.

One note on specialized distributions: Kali Linux, Parrot OS, BlackArch, REMnux, and similar distros exist but are not in this guide. They are penetration-testing or security-research tools, live-USB or VM images built to ship with hundreds of offensive-security utilities and with their hardening and defaults tuned for that work, not for daily use. If someone recommends Kali as your first Linux to switch to, that recommendation is wrong; use Mint or Debian. If you later become a security professional and need those tools, you already know where to find them.

## The install-once-and-forget axis

One axis most distro comparisons miss: how much attention a system needs from you per month once it's set up. This is orthogonal to stability and to package freshness.

**Low-attention:** Debian stable, Linux Mint, AlmaLinux, Rocky, Devuan, openSUSE Leap, FreeBSD. You install them and they update cleanly for years; the only reboots are kernel security updates. Debian stable is the canonical example, a Debian 12 install from 2023 will run through 2028 without breaking user-space.

**Medium-attention:** Fedora Workstation, openSUSE Tumbleweed, EndeavourOS, Pop!_OS, NixOS. You'll touch them weekly or monthly. Fedora major upgrades every six months, Tumbleweed's rolling updates, NixOS channel bumps. Nothing breaks often, but you're in the loop.

**High-attention:** Arch, Manjaro, Void, Gentoo, Artix, Kali. The social contract is "read the news before you update." Gentoo adds the compile-time axis. These reward attention and punish neglect; if you disappear for six months and run an update, you will spend an afternoon unwedging things.

The axis matters because the right answer depends on the machine. Daily-driver laptop for work → low-attention. Tinkering machine or homelab → medium or high. Don't put a rolling release on your grandmother's computer.

## The systemd problem

For the first two decades of Linux, the program that started everything else at boot was a small thing called sysvinit: it read shell scripts, it launched daemons, it got out of the way. In 2010, a Red Hat engineer named Lennart Poettering released a replacement called systemd. Technically systemd starts faster and manages service dependencies better than sysvinit did. Culturally, systemd has become one of the most divisive projects in open-source history, for reasons that are now much clearer than they were in 2010.

The first objection was philosophical. Unix has a founding principle: each program should do one thing and do it well, and programs should be composed together with simple interfaces. Systemd does not follow this. It started as an init system and has grown to absorb logging (journald), network management (networkd), device management (udevd), user management (homed), DNS resolution (resolved), time synchronization (timesyncd), container management, and now user database schemas. If a system component touches systemd, it tends to become hard to replace, because systemd provides and consumes its own interfaces. This is the opposite of what Unix was.

The second objection is governance. Red Hat (now IBM) employs many of systemd's core maintainers, and systemd became the default init on nearly every major Linux distribution (Debian, Ubuntu, Fedora, openSUSE, Arch) by a mix of technical argument and ecosystem momentum, over the objections of significant portions of those projects' communities. Debian had a public, bitter vote about adopting systemd in 2014; the people who lost that vote left to create Devuan. The grievance wasn't only technical. Systemd was one of the first major examples of a corporate-employed maintainer successfully imposing a new piece of critical infrastructure on the broader Linux ecosystem over community objections. Once in, it was hard to remove.

The third objection is recent and concrete. In March 2026, systemd merged pull request #40954, adding a `birthDate` field to its user-record schema[^systemd-pr]. The stated reason was compliance with new age-verification laws in California (AB-1043), Colorado (SB26-051), and Brazil (Lei 15.211/2025). The PR was submitted by a first-time contributor and received 37 negative reactions to 1 positive before a Microsoft employee merged it. When the community filed a revert PR the next day (#41179), Lennart Poettering closed and locked it without merging, saying the field was optional and enforced no policy[^systemd-revert]. The community's objection was not the technical merit of an optional JSON field; it was the governance pattern. A critical Linux infrastructure component had its user-identity schema changed to accommodate state age-verification legislation, the change was approved by a corporate-employed maintainer against overwhelming community opposition, and dissent was closed and locked by the project's founder. This is exactly what the Iron Law of Oligarchy looks like in software.

The corporate affiliations that made this possible are worth naming directly, because they're all public record. Kinvolk GmbH, the German systemd-adjacent company, was acquired by Microsoft in April 2021. Lennart Poettering moved from Red Hat to Microsoft around July 2022. Christian Brauner, another core systemd maintainer, moved from Canonical to Microsoft around the same period. Amutable GmbH was incorporated in August 2025 by former Kinvolk / Microsoft personnel and announced publicly in January 2026, seven months after incorporation and roughly two months before the `birthDate` merge. The Sovereign Tech Agency (a German-government program that funds open-source infrastructure) has invested approximately EUR 855,000 into systemd across two funding rounds; the contractor-of-record is not publicly disclosed on the agency's funding page, which is a matter of the agency's choice rather than a conspiracy, but it does mean the money trail can't be independently traced. All of the incorporation filings are retrievable from the German Handelsregister. None of this proves capture on its own. All of it is consistent with the pattern the Iron Law describes: systemd's commercial gravity now sits with a Microsoft-adjacent cluster of personnel, and one of Linux's most critical pieces of infrastructure has a corporate center that is no longer Red Hat.

The fourth objection came two days later. On 17 March 2026, Qualys disclosed CVE-2026-3888, a local privilege escalation in Ubuntu Desktop 24.04 and later[^cve-3888]. The bug arises from the interaction between Canonical's snap-confine and systemd-tmpfiles, neither broken alone, but the combination lets an unprivileged local user gain root by manipulating the timing of systemd's scheduled temp-file cleanup. CVSS 7.8, high severity. The exploit window is a 10-to-30-day delay, which is not safety; it's a timer. This is the kind of failure mode that the "do one thing well" principle exists to prevent: when systemd is responsible for cleaning up temp files, and also indirectly setting up snap sandboxes, and also managing service schedules, the interactions between these responsibilities become the attack surface.

What happened after the investigation was published is the part that's hardest to dismiss as coincidence. TBOTE (the project that compiled the corporate-affiliations record above) documented coordinated automated reconnaissance against its own site in the days after publication: roughly 1,285 requests from 70 IPs traced to Meta infrastructure, 1,659 requests from 18 IPs traced to Microsoft's OpenAI crawlers, over 5,500 requests from 1,100+ IPs in a 72-hour window traced to Google Cloud scanner clusters, and probing by Palo Alto Networks' Cortex Xpanse, an enterprise attack-surface-management product whose licensing runs into six figures per year. None of this is dispositive on its own; corporate infrastructure scrapes a lot of small websites, and a single project's logs are the project's own characterization rather than independently verified evidence. But the pattern of who specifically showed up to map a site that named them, with tools that cost real money, is the kind of empirical correlate the Iron Law predicts. Read TBOTE's logs directly at tboteproject.com if you want to form your own view.

The practical takeaway: systemd is not going away, and on most distros you will use it. But the case for choosing a systemd-free distro (Devuan, Artix, Void, Gentoo with OpenRC, Alpine, Vendefoul Wolf) got materially stronger in March 2026. If you were on the fence, the birthDate merge and CVE-2026-3888 landing in the same week are good reasons to step off.

## Community politics and the vibe test

The distros themselves don't have politics. The communities, founders, and corporate backers do, and that shapes what features get prioritized, what governance disputes erupt, and how a project behaves under pressure. Roughly sorted right to left:

**Right-coded:** Gentoo, Void, Devuan, Artix, Alpine, Slackware, Vendefoul Wolf, OpenMandriva, Omarchy, GhostBSD, OpenBSD. These communities cluster around sovereignty, minimalism, anti-dependency posture, skepticism of corporate and political gravity. Gentoo attracts the purists; Void and Devuan are explicitly reactive against systemd (Red Hat's piece of OS centralization); Alpine's ethos is small-and-audited; Vendefoul Wolf ships with explicit anti-AI, anti-telemetry, anti-Wayland defaults. OpenMandriva is a French 1901 non-profit that has stayed structurally outside corporate orbit and is the most visible non-Mageia continuation of the Mandrake lineage; Omarchy is DHH's opinionated Arch + Hyprland distribution and sits here by the cultural alignment of its maintainer. GhostBSD recently replaced X.Org with XLibre (the fork that split off from X.Org over governance) and is quietly one of the clearest "engineering over ideology" moves any desktop OS made in 2026. OpenBSD sits here by ethos more than politics, Theo de Raadt's project is as far from Silicon Valley progressivism as any mainstream OS gets. These communities will leave you alone if you don't bring politics into their issue trackers.

**Center:** Debian, Linux Mint, MX Linux, Arch Linux, EndeavourOS, openSUSE, Slackware-adjacent projects, FreeBSD. Technocratic-neutral. Debian has a formal democratic constitution and has resisted capture by any single direction; its one major recent political fight was the systemd vote in 2014. Mint is pragmatic and anti-Canonical-bloat. Arch ships software and documents it. openSUSE and FreeBSD have corporate backers but the communities are engineering-first.

**Center-left:** Ubuntu / Canonical, Pop!_OS / System76, Manjaro, Zorin. Silicon-Valley-adjacent defaults. Canonical is a British-headquartered corporate entity with standard corporate apparatus; the Snap controversy is a corporate enclosure move more than a political one, but the overall posture is progressive-corporate. System76 is a Denver hardware company whose politics track standard US tech-left. Zorin is a commercial shop with mainstream progressive branding.

**Left-coded:** Fedora / Red Hat / IBM, GNOME, NixOS, Tails, Trisquel, PureOS, Qubes, Whonix. Fedora is directly a Red Hat property, and Red Hat under IBM runs one of the most visible corporate DEI programs in open source. GNOME has been involved in some of the loudest code-of-conduct fights in desktop Linux over the last decade. NixOS had a major governance crisis in 2024 around military-adjacent contracts (Anduril) and CoC enforcement; the fallout produced the Lix fork and reshaped the NixOS Foundation. Tails is explicitly aligned with activist-left communities, their own documentation links to a tutorial called "Tails for Anarchists." Trisquel and PureOS live inside the FSF's political orbit. Qubes and Whonix are academic-privacy-left in community composition though generally lower-drama in operation.

If you want software whose community will leave you alone: Void, Devuan, Gentoo, Alpine, Debian, OpenBSD. If you want corporate-grade polish and don't mind the cultural package: Fedora, Ubuntu, Pop!_OS. Everyone else is mostly just shipping an OS.

### How the camps see each other

A lighter companion to the previous section. If you want to understand the culture of each camp, listening to what they say about each other is clarifying.

**What Arch users say about Debian:** "Your packages are ancient. You're running software from two years ago and calling it stable." And about the bureaucracy, it takes a formal governance process for a package to enter Debian proper, which Arch users see as sclerotic.

**What Fedora users say about Debian:** "At least we're somewhat current. Debian stable is a museum." And on release cadence: "'Whenever it's ready' means never." Plus a sharper point about technical leadership: Fedora ships new desktop infrastructure first (PipeWire, Wayland, Btrfs by default) while Debian inherits it years later.

**What Debian users say back:** with complete calm, "My server has been running for four years without a reinstall. Can you say the same?" They point out that Debian is the mother of a hundred distros, that Ubuntu exists because of Debian, that `apt` is the most copied package-management model in existence. They also note that Arch users spend more time fixing their system than using it, and Fedora users are essentially unpaid Red Hat beta testers. The Debian user's energy: "We were here before you, we'll be here after you, and we don't care what you think."

**What Arch users say to Devuan users:** respectful, "Good call ditching systemd, but why run a Debian fork when you could run something that doesn't hold your hand at all? Come to Artix." Weird mutual appreciation between the two contrarian camps.

**What Fedora users say to Devuan users:** dismissive, "Why are you clinging to sysvinit like it's 2004? Systemd exists for a reason, just learn it." Fedora is Red Hat's proving ground, and systemd is a Red Hat project, so Fedora users tend to be true believers.

**What Gentoo users say to Arch users:** condescending, "You use Arch because you couldn't setup Gentoo." Gentoo's identity is built around source compilation and USE-flag-level control; from that vantage, Arch's binary-package convenience reads as a shortcut. The meme below is the canonical version of this dynamic.

![Cyanide and Happiness four-panel meme. Panel one: a person asks of a small dog "Does she bite?" Panel two: the owner replies "Yes but she can hurt you in other ways." Panel three: the dog has transformed into a snarling Doberman declaring "You use Arch because you couldn't setup Gentoo." Panel four: the asker is in tears.](arch-gentoo-meme.png)

None of this is meant to decide anything for you. It's a sanity check: whatever distro you pick, here is approximately what the other camps will think about your choice.

### GNOME's political turn and the Code of Conduct asymmetry

GNOME has the highest "loudest CoC fights per capita" rate in desktop Linux, and the pattern that's emerged across 2024–2026 is specific enough to name. Prominent GNOME maintainers, using either the project's own blog network at `blogs.gnome.org` or personal accounts that publicly identify them as GNOME contributors, have repeatedly characterized people and companies they politically disagree with as "Nazis," "fascists," or "racists." The GNOME Code of Conduct[^gnome-coc] explicitly forbids personal attacks, demeaning language, and "any other conduct which could reasonably be considered inappropriate in a professional setting." No publicly disclosed CoC enforcement action has followed any of the incidents below.

The documented record:

- April 2025: Tobias Bernard, a GNOME design contributor, published "The Elephant in the Room" on `blogs.gnome.org` over the suspension of board member Sonny Piers. The post repeatedly closes with the line "Fuck Nazis, GNOME is Antifa." A subsequent post from Allan Day (also `blogs.gnome.org`, also defending the GNOME Foundation's handling of the case) treats this framing as unremarkable rather than flagging it.[^gnome-bernard][^gnome-day]
- July 2025: Jordan Petridis (GNOME release team member, runtime maintainer, GNOME Nightly maintainer, Newcomers experience lead, Podcasts maintainer per his own GNOME wiki page[^petridis-roles]) and Jeremy Bicha (Canonical engineer, Ubuntu/Debian GNOME packager) modify the XLibre wiki page to label the Xorg fork a "Nazi project" / "Nazi bar." XLibre is the engineering fork of Xorg that GhostBSD shipped as default in its 26.1 release, a fork led by a developer they politically disagree with.[^xlibre-deface]
- October 2025: Framework Computer announces sponsorship of the Hyprland project and continues promoting Omarchy (DHH's Arch + Hyprland distribution). The GNOME OS Team responds by stating that Framework "supports Fascist and Racist s***heads" and that GNOME "does not feel comfortable in further collaboration." The GNOME Foundation reportedly opens lines to other projects considering disengaging from Framework over the same issue.[^gnome-framework]
- November 2025: Petridis publishes "DHH and Omarchy: Midlife crisis" on `blogs.gnome.org`, framing DHH's politics as the "alt-right pipeline" and characterizing the Framework partnership as alignment with that pipeline.[^petridis-omarchy]
- April 2026: After Framework ships another pre-release Panther Lake laptop to DHH, Petridis posts on Mastodon: "Framework listens to their audience so much that they send another pre-release laptop to DHH. Enjoy the new Nazibook 13 pro."[^petridis-nazibook]

Two patterns are worth pulling out. First, the Bernard and Petridis posts are hosted on `blogs.gnome.org` itself (the project's own infrastructure) not on personal sites the project could disclaim. Allowing them there is an editorial choice. Second, GNOME's CoC was the same instrument used to remove Sonny Piers from the project in 2024 over a private dispute the Foundation has refused to publicly detail. The CoC moves quickly when a board member becomes inconvenient and not at all when prominent maintainers publicly call paying customers and partner companies Nazis. That asymmetry is the actual signal.

This matters for choosing a desktop because GNOME ships as the default on Fedora Workstation, Ubuntu, Pop!_OS, Zorin OS, and Debian. If you pick GNOME you are picking, by gravitational rather than direct payment, the project that produces this output. KDE Plasma, XFCE, Cinnamon, MATE, and LXQt have not generated comparable patterns. If GNOME's politics are not something you want to subsidize culturally, the desktop choice is where you can opt out without giving up the distro you otherwise want.

### The XLibre / ArchWiki case (April 2026): a contrast

A useful contrast case landed in April 2026. On 15 April, ArchWiki administrator Alad deleted the XLibre project page; the next day, XLibre published a reflection post on X framing the action as part of an "abuse of CoCs as Codes of Censorship," disclaiming `xlibre.net` as outdated, identifying the GitHub README as the project's authoritative source, and announcing plans to "become louder" on CoC abuse, build a central place for third-party XLibre Arch packages, and possibly "liberate some information."[^xlibre-arch-deletion][^xlibre-reflection] The framing wants to slot the deletion into the same bucket as the GNOME pattern above. It doesn't fit, and the reasons it doesn't fit are worth naming.

Arch's stated basis was the Arch CoC's "Respect" clause, which prohibits "maligning other FOSS projects or distributions, or any other operating systems and their users."[^arch-coc] The cited content is real and still live: `xlibre.net`'s About page calls Xorg contributors "toxic elements" and "moles from BigTech," and closes with the slogan "Together we'll make X great again!" XLibre's response argues that `xlibre.net` is outdated and that the GitHub README (from which the "moles" passage was removed in commit 4839966 on 25 July 2025) is the only authoritative source. The site is the project's own domain, runs the project's own copy, and is what a reader Googling "xlibre" lands on. Disclaiming a domain you control while leaving its content in place does not move the rhetoric to a different actor.

The other half of the post's framing is that the Arch CoC is being "applied outside of Arch Linux." Arch removing content from Arch's own wiki is the CoC being applied inside Arch, hosting decisions on community-run infrastructure are exactly where CoCs operate. The page was not removed from XLibre's GitHub. The `xlibre-server` package was not removed from the AUR. Arch chose not to host a documentation page about a project whose public-facing site contains the kind of language Arch's rule was written to exclude.

This matters for the capture-risk frame because it cuts the other way from the GNOME case. The GNOME pattern is asymmetric application: the same CoC that removed Sonny Piers in 2024 has not moved on prominent maintainers calling paying customers and partner companies Nazis on the project's own blog network. The Arch case is symmetric application: a stated rule against maligning other FOSS projects, applied to a project that publicly maligns another FOSS project on its own homepage. You can dislike either CoC regime on principle, but treating the two cases as instances of the same problem flattens a distinction the underlying record actually makes. XLibre is also separately a serious engineering project, the GhostBSD entry below shows an engineering-led BSD adopting it as default specifically over governance turbulence at X.Org, and that judgment stands on technical grounds independent of how the project's public-facing rhetoric has been received elsewhere.

### How different commentators sort distros

Different people filter distros through different lenses. Naming the lenses explicitly helps, because a recommendation makes more sense when you know what it's optimizing for.

**Capture-risk lens (this doc's primary frame).** Who owns this project's governance, and what could change it? Corporate distros score worse because they can be acquired, monetized, or rebuilt around revenue (Red Hat → IBM, elementary OS's funding struggles, Canonical's Snap enclosure). Foundations and democratic projects score better (Debian's constitution, OpenMandriva's French 1901 non-profit, the BSDs' permissively-licensed codebases maintained by independent foundations). The systemd governance story sits at the center of this lens because it shows the Iron Law at work inside infrastructure most users never see.

**Project-culture lens (Bryan Lunduke and adjacent voices).** Does project leadership publicly stake the project on identity-politics or DEI commitments that could override technical merit in hiring, moderation, or roadmap decisions? Lunduke's August 2025 "non-woke software list" names OpenMandriva (his personal daily driver), GhostBSD, Omarchy, and Devuan as his picks on this axis, and he is critical of projects where he reads the leadership's signaling the other way (Mozilla, NixOS after the 2024 governance fight, the recent Debian DPL election). Overlap with the capture-risk lens is real (both flag Mozilla, both flag corporate-IBM Red Hat) but the lenses diverge. Debian scores well on capture-risk (democratic, dispersed, cannot be bought) and ambiguous-to-critical on the project-culture lens depending on how recent governance fights read to you. Fedora scores badly on both.

**Technical-pragmatism lens (Greg Kroah-Hartman, Linus Torvalds, most working kernel developers).** Which distro lets me get work done with the least friction? Torvalds uses Fedora because it stays current and out of his way. Kroah-Hartman uses Arch for the same reason plus the wiki. This lens is indifferent to governance and culture; it only cares whether the distro ships what the user needs and stays out of the way.

**Libre/freedom lens (FSF, Trisquel, PureOS, RMS).** Does the distro ship only free software, and does it refuse non-free firmware even when that means hardware doesn't work? A small but principled axis. Most readers will find it too strict for daily use; a few will find it the only serious axis.

These lenses are not a hierarchy. They're filters. A reader whose primary concern is cultural drift in a project will weight Lunduke's lens heavily; a reader whose primary concern is state or corporate capture will weight the capture-risk lens heavily; a reader whose job is kernel work will weight the pragmatism lens heavily. The distros that score well on more than one lens (Debian, Devuan, OpenBSD, GhostBSD, OpenMandriva) are the ones that tend to show up on multiple people's lists for different reasons.

### Sovereignty-minded figures and their distro choices

Who uses what, when the person has the technical literacy to choose deliberately. Treat specific-person endorsements as dated quickly and re-verify before leaning on any of them.

- **Linus Torvalds:** Fedora. His stated reasoning is roughly "I want a distribution to be easy to install, so that I can just get on with my life, which is mostly kernel." He moved off openSUSE to Fedora in 2020 and has criticized Debian as "too technical." Pragmatic-lens, indifferent to governance.
- **Greg Kroah-Hartman:** Arch Linux since 2019, including for his team's cloud instances. His reasoning: "Their idea of a constantly rolling, forward-moving system is the way to go. It's neutral, it's community-based, it has everything I need." He calls the Arch Wiki "amazing." Keeps test environments on Fedora, Debian, and Gentoo for kernel QA.
- **Lennart Poettering:** spent fourteen years at Red Hat, joined Microsoft in 2022, now reportedly also involved in Amutable GmbH. His distro use has followed his employer.
- **Miguel de Icaza:** GNOME co-founder, switched to macOS in 2013 and has been a vocal critic of Linux desktop fragmentation ever since.
- **Bryan Lunduke:** OpenMandriva as daily driver (since late 2024 / early 2025). Uses a Mac for video production on *The Lunduke Journal*. Has vouched for GhostBSD, Omarchy, and Devuan as the alternatives on his project-culture axis.
- **David Heinemeier Hansson (DHH):** Omarchy, which he created and ships publicly via the Basecamp GitHub org. Arch + Hyprland + full-disk encryption, keyboard-driven, developer-focused.
- **Luke Dashjr:** Gentoo and custom builds, prioritizing maximum control for Bitcoin-related work.
- **Adam Back:** air-gapped systems, typically Debian-based or custom builds.

Among Linux kernel developers as a group, informal reporting puts Fedora at roughly 45%, Arch at roughly 30%, Ubuntu at roughly 15%, openSUSE at roughly 7%, and Gentoo at roughly 3%. Fedora dominates because Torvalds uses it and because Red Hat employs many kernel maintainers. Among serious Bitcoin operators running cold storage or signing hardware, informal community surveys suggest roughly Debian 35% / Arch 25% / Ubuntu 20% / specialized (Qubes, Tails) 15% / Mint 5%, treat those numbers as indicative, not measured.

### A mental shorthand before the per-distro entries

If you want a light mnemonic to keep the families straight before we go distro by distro: the kernel is the bean, and every distro is a different way of preparing it. Debian is the dark roast everyone else blends from. Red Hat and Fedora are the corporate espresso. Arch is the pour-over you make yourself and then tell people about. Gentoo is roasting your own beans. Slackware is your grandfather's percolator. Void is the small-farm import the serious coffee person prefers. Ubuntu and Mint are the friendly café with consistent service, the one most people start at. Windows is instant coffee.

The analogy breaks down where all analogies break down, but it's enough to hold the shape of the landscape in your head before we go through it one entry at a time.

## Debian

The universal operating system. If you don't know what to pick long-term, this is usually the answer.

**Short version for newcomers:** Debian is the slow, stable, conservative grandparent of most Linux distros you've heard of. Ubuntu, Mint, Kali, MX, Raspberry Pi OS, and dozens of others are built on it. When you learn Debian, you understand the foundation every other `apt`-based distro is papering over.

Built on: its own packaging ecosystem (`dpkg`, `apt`), developed since 1993. Governed by a formal constitution and an elected project leader, not owned by any company.

License: FOSS, with non-free firmware for WiFi and GPU support available in a separate opt-in repository.

Good for: servers, long-lived desktops, anything you install once and ignore. The stable release cycle is roughly every two years with about five years of support (three years from the project plus two from LTS). The package repository is vast (~60,000 source packages) and quality is consistently high. A few things worth naming specifically that tend to get lost when people compare distros:

- **`apt` and `dpkg` are mature and battle-tested.** The packaging system has been refined for nearly thirty years. Dependency resolution works. Package metadata is reliable. Edge cases that bite users on newer or less-standardized package managers rarely bite you here.
- **No corporate agenda can be bolted on.** Red Hat / Fedora answer to IBM. Ubuntu answers to Canonical. openSUSE answers to SUSE. Debian is governed by its developers under the Debian Social Contract and the Debian Free Software Guidelines. No company can decide to change the license terms, sunset your version early for revenue reasons, or push a product you didn't ask for. Debian cannot be acquired.
- **Security response is serious.** The Debian Security Team issues advisories and patches promptly. The frozen nature of stable dramatically shrinks the attack surface compared to rolling distros where new code constantly enters the system.
- **Debian runs everywhere.** The same distro runs on x86, ARM, RISC-V, MIPS, POWER, and more architectures than any other general-purpose Linux distribution. If you ever move to embedded systems, servers, or exotic hardware, your knowledge transfers directly.

Bad at: shipping recent desktop software. Debian stable is conservative by design, your GNOME or KDE will be 6–18 months behind upstream. Backports help; Flatpak fills the rest. For cutting-edge desktop software, run Debian testing/sid or use Flatpak aggressively. This is a deliberate trade, and for most people the stability is worth more than the freshness.

Trajectory: stable and essential. Debian 13 "Trixie" released August 2025, current stable through roughly 2028. Not going anywhere.

Use if: you want the universal default, don't want to be on a corporate Linux, and value longevity over freshness.

## Ubuntu

Canonical's commercial Debian derivative. Historically the default beginner distro, now a cautionary tale. See [What not to pick in 2026](#what-not-to-pick-in-2026).

**Short version for newcomers:** Ubuntu is Debian repackaged by a company called Canonical, with some of their own additions on top. For a long time it was the friendliest way into Linux. Over the last few years it has gotten heavier, more corporate, and less aligned with what most users actually want, to the point that Linux Mint (which is built on Ubuntu) strips out Ubuntu's additions on install.

Built on: Debian, plus Canonical's own layers (Snap, Livepatch, Ubuntu Pro).

License: FOSS, including non-free firmware by default for broad hardware support. Some Canonical tooling is source-available but governed by contributor agreements that assign rights to Canonical.

Good for: matching production cloud environments, running on hyperscaler images, following most third-party Linux tutorials without translation. LTS releases (every two years) are supported ten years with Ubuntu Pro (free for personal use).

Bad at: being Debian. Snap is Canonical's proprietary-backend package system that silently replaces `apt install` targets for certain popular packages (`apt install chromium` has installed a Snap for years). Snap performance is noticeably worse than native or Flatpak for many apps. Telemetry is on by default. GNOME is modified in ways that fight upstream. And in 2026, Ubuntu Desktop requires 6GB RAM and a 2GHz dual-core CPU, more than Windows 11 asks for[^ubuntu-req]. As a directional comparison on overall weight, Bryan Lunduke noted in April 2026 that the Ubuntu 24.04 LTS desktop ISO is roughly 6.3 GB while the Windows 11 ISO is roughly 5.8 GB: the free "lightweight alternative" now ships a larger installer than the proprietary OS it was pitched against. ISO size is not runtime weight, but the trend line on both axes (ISO and RAM) points the same direction. The March 2026 CVE-2026-3888 disclosure, which allows local privilege escalation via the Snap-systemd-tmpfiles interaction in default installs, is the most visible recent symptom of that architecture[^cve-3888].

Trajectory: still the largest deployed desktop Linux by install count but visibly losing enthusiast mindshare to Mint, Fedora, and Arch.

Use if: you need Ubuntu specifically (a work requirement, a vendor only ships `.deb` packages for Ubuntu) and can tolerate the direction. Otherwise use Debian for desktop or server.

## Linux Mint

The most Windows-like Linux landing, and for years the reflexive recommendation for non-technical friends leaving Windows. Cinnamon desktop by default, with XFCE and MATE editions. Based on Ubuntu LTS but with Snap completely removed and replaced with Flatpak. This guide no longer makes it the default first install (Debian gets that; see the [TL;DR](#tl-dr) and [Decision shortcut](#decision-shortcut)), and the caveats below are why.

**Short version for newcomers:** Mint is what happens when a small team takes Ubuntu, strips out the parts of Ubuntu they don't like, and ships a friendly, Windows-looking desktop on top. For someone leaving Windows today, Mint is the easiest landing. You'll be productive in an hour.

Built on: Ubuntu LTS, with an insurance-policy branch (LMDE, Linux Mint Debian Edition) that builds directly on Debian instead of Ubuntu.

License: FOSS, including non-free firmware by default for broad hardware support.

Good for: people migrating from Windows. Cinnamon is the closest Linux comes to a traditional Windows layout. The update manager is unintimidating, the community forum is friendly, and the project's identity is partly built on saying no to Canonical's Snap push.

Bad at: being cutting edge. You're on an Ubuntu LTS base, so packages are conservative. Not ideal if you need the latest developer toolchains or very recent hardware support.

Flags (read this if you install Mint): An independent Wireshark-based analysis in February 2025 found no OS-level telemetry from Mint, no analytics, no Canonical callbacks, no hidden logs beyond basic update-server contact[^mint-telemetry]. That's the good news. The less-good news: on 22 December 2025, a bug report filed on the official `linuxmint/cinnamon` GitHub repository (issue #13298) documents the Cinnamon process on Mint 22.2 leaking memory from a clean 3GB post-boot footprint up to 70% of 32GB RAM over about four hours of normal use, forcing the user to run `cinnamon --replace` twice a day as a workaround[^mint-leak]. As of this writing (four months later) the issue is still open, still unassigned, and labeled only as a bug. Multiple other users have reported similar symptoms across forum threads during the same window. If you installed Mint 22.2 during the Windows 10 migration wave and felt your machine getting slower over the winter, you were probably not imagining it. Either a cross-machine memory leak exists in shipped Cinnamon and the Mint team has not addressed it in four months, or something else in the 22.2 release is regressing on real workloads. Either possibility matters. The structural point, separate from this specific bug, is that Mint has become the most-recommended Windows-escape distro on the internet, which makes it the most obvious capture target for anyone who wants to bend a large downstream user base. Mint is currently clean, but a shipped memory-leak regression left unaddressed for months is a quality-control signal, not just one bug, and a project's quality-control slipping while its install base balloons is exactly when to be cautious rather than to make it the default. That is why this guide now points first-time migrants to Debian and keeps Mint as the choice for readers who weight Windows visual familiarity above everything else. Watch the project the way you should watch anything that gets that popular.

Trajectory: strong growth post-Windows-10-EOL. The project has publicly said an LMDE-only future is possible if Canonical ever poisons Ubuntu beyond the point where Mint can work around it.

Use if: Windows visual familiarity is your single overriding priority and you want the fastest cosmetic match with no homework. Otherwise start on Debian, the default this guide now recommends for migrants. If you do start on Mint, plan to move to Debian or Devuan in 6–12 months as you get comfortable.

## MX Linux

Debian-based, developed jointly by the MX Linux team and the antiX community since 2014. Consistently top-three on Distrowatch's most-visited-distros listing for the past five years. Ships sysvinit by default with optional systemd available at boot, meaning the same distro can run either init system depending on what you pick at the boot menu. That property alone makes MX interesting on a sovereignty axis: a Debian-based distro that does not force the systemd choice on you.

Built on: Debian Stable base plus MX-specific repositories that add updated packages where the Debian Stable version is too old to be practical (Firefox, kernel, some user-facing apps). The default desktop is XFCE; KDE Plasma and Fluxbox editions also exist.

License: FOSS, same disposition as Debian Stable (which it inherits from). Non-free firmware is enabled by default for hardware support.

Good for: a working desktop that's faster than Mint on older hardware, more current than pure Debian Stable, and gives you the sysvinit option without leaving the Debian ecosystem. The MX-tools suite (a collection of graphical utilities for system administration, backup, package management, kernel selection, snapshot creation) is genuinely useful and one of the project's distinctive features.

Bad at: nothing in particular for general desktop use. The MX-specific repositories are an additional trust surface compared to pure Debian; not a deal-breaker, but worth knowing.

Trajectory: stable, growing slowly. The combination of Debian-base plus sysvinit-by-default plus active maintenance is rare enough to keep the project alive without needing to chase trends.

Use if: you want a Debian-based desktop that doesn't force systemd, you want better-than-Stable package freshness without going to Testing, or you want MX-tools' graphical-administration suite. Acts as a less ideologically-loaded entry into the no-systemd world than Devuan or Artix.

## Fedora

Red Hat's community-facing distribution, upstream of RHEL. Cutting-edge but carefully tested. GNOME by default; KDE Plasma, XFCE, and others are first-class spins.

**Short version for newcomers:** Fedora is the Linux that developers and Mac refugees tend to end up on. It gets new features first (Wayland, Pipewire, systemd-homed, btrfs) and is more polished out of the box than most alternatives. It is also directly owned by Red Hat, which is owned by IBM, which you may or may not care about.

Built on: its own RPM-based packaging, `dnf`.

License: FOSS, with historically aggressive patent-avoidance. Fedora won't ship MP3 support or certain codecs until their patents expire; RPM Fusion is the third-party repo for the things Fedora won't ship. Non-free firmware for hardware support is available but not enabled by default.

Good for: developers, GNOME fans, anyone who wants recent packages with real QA. Fedora 43 released late 2025; Fedora 44 expected April–May 2026. Fedora Atomic variants (Silverblue, Kinoite, and the Bazzite-adjacent stack) are the interesting frontier, these use the immutable-base-filesystem model described in the glossary.

Bad at: long-term stability. Every six months you do a major-version upgrade; each release is supported about 13 months. Not for set-and-forget machines. And the upstream parent is IBM, which comes with the CentOS Stream controversy, RHEL source-access restrictions, and the general direction Red Hat has taken post-acquisition.

Trajectory: rising sharply as developers leave Ubuntu.

Use if: you want a Mac-like coherent desktop with current software and you're willing to upgrade annually.

## Arch Linux

The hacker's distribution. Minimal by default, rolling release (meaning you get new versions of each package as soon as upstream releases them, with no fixed release cycle), you build the system up from a working shell. The Arch Wiki is the best piece of Linux documentation in existence and is used as a reference by users of every other distro.

**Short version for newcomers:** Not for newcomers. Come back after six months on Mint or Debian. Then the Wiki will reward you.

Built on: `pacman` (its package manager), plus the AUR, a community-run repository of build scripts that covers roughly 100,000 packages. The AUR is one of the main reasons people use Arch, almost any piece of software you can think of is one command away.

License: FOSS. Non-free firmware is available via the `linux-firmware` package, which most users install.

Good for: people who want to understand their system. You choose every component, init, bootloader, desktop, everything. Rolling release puts you within days of upstream for kernel, Mesa, and desktop versions. Greg Kroah-Hartman (the stable kernel maintainer) switched his team to Arch for the rolling model and the wiki.

Bad at: being forgiving. You read the news before updating or you occasionally break things. Not a good fit on a machine you rely on but don't want to maintain.

Trajectory: stable and central. The Arch family (Arch + EndeavourOS + CachyOS + Manjaro + Garuda + SteamOS) is probably the second-largest Linux family after Debian/Ubuntu.

**The "customize Arch once and use it forever" argument.** A strategy experienced users sometimes propose: install Arch, customize it exactly how you want, write a script that rebuilds that setup from scratch, and then run it on all your machines and just maintain it with minor tweaks. It's a legitimate strategy and plenty of people do it. The honest catch is that your rebuild script can't freeze upstream. Rolling release means you're implicitly trusting that every update to every package in the chain plays nicely together, forever. Sometimes it doesn't, a mesa update breaks Wayland, a kernel update and a GPU driver update land a week apart and conflict, systemd changes something subtle. You can pin packages or run a partial local mirror to truly lock things, at which point you're doing more work than Debian stable would have required. Plenty of Arch users run this pattern successfully; just know that the "set it up once and forget it" promise is only honored if breakage is rare enough in your specific setup to ignore, which is a bet you can't make in advance.

Use if: you want bleeding edge and you're OK reading the Wiki regularly.

## EndeavourOS, CachyOS, Manjaro (Arch derivatives)

Three different takes on "Arch, but with an installer."

**EndeavourOS:** the faithful one. Arch plus a graphical installer, a few sane defaults, and a friendly forum. Uses Arch repositories directly (so you get Arch packages at the same time Arch users do) and full AUR access. Once installed it behaves like Arch.

**CachyOS:** Arch tuned for performance. Custom kernel with scheduler tweaks, binaries compiled specifically for modern CPU instruction sets (x86-64-v3 or v4), gaming-optimized defaults. Measurably faster than stock Arch on recent hardware. Growing fast in early 2026.

**Manjaro:** do not use. Ships its own delayed repo (Arch packages held back ~2 weeks) that regularly causes breakage with the AUR (because the AUR expects current Arch, not two-week-old Arch), and the team has shipped expired SSL certs on their own website more than once. Strictly worse than both Arch and EndeavourOS.

Use if: EndeavourOS for vanilla Arch with install ergonomics; CachyOS for gaming or performance.

## Omarchy

Arch + Hyprland, preconfigured and opinionated. DHH's (David Heinemeier Hansson, of Rails and Basecamp) answer to "I want Arch's power but I don't want to spend three days on dotfiles." Maintained under the Basecamp organization on GitHub.

**Short version for newcomers:** Not a newcomer distro. Omarchy is for someone who already knows what Arch is and wants DHH's taste applied to it out of the box. If you're coming from Windows, Mint is your answer, not this.

Built on: Arch Linux. Installs via a dedicated ISO (recommended) or a one-line script on top of a bare Arch install. Uses Hyprland (a tiling Wayland compositor), btrfs, and mandatory LUKS full-disk encryption. Ships Neovim, tmux, Alacritty, Chromium, a curated set of developer tools, and a keyboard-first workflow (no display manager, no login screen after disk-decrypt).

License: FOSS. Arch repos plus a small Omarchy repo for the opinionated pieces.

Good for: developers who want a tiling-window-manager workflow with good defaults. Terminal colors, Neovim theming, Waybar, Hyprlock, and the rest all move together when you switch theme, cohesive in a way a hand-assembled setup usually isn't. Curated themes include Catppuccin, Gruvbox, Tokyo Night, Everforest, Flexoki Light. The Omarchy Menu (Super + Alt + Space) is the main control surface; almost everything happens via keyboard.

Bad at: being flexible about taste. You are installing DHH's preferences, the fonts, the color palettes, the editor, the window-manager keybindings, the software choices. Everything is overridable (they're still config files in `~/.config`) but you're starting from someone else's aesthetic, not a blank slate. Also: no mouse-first workflow (you literally cannot do much without keyboard on first boot), no support for legacy BIOS (UEFI only), and the installer wipes the target drive, dual-boot is awkward and requires two physical disks.

Trajectory: actively developed, growing community, DHH is personally invested. Current releases in the 3.x series as of early 2026.

Use if: you're already Linux-literate, you want a tiling-WM developer setup, and you want someone else's good decisions as the starting point. If your reaction to "mandatory full-disk encryption, keyboard-only, Hyprland-first" is "yes, finally," you're the audience.

## Devuan

Debian minus systemd. Same repositories, same packaging, same support cycle; just sysvinit / OpenRC / runit for init, and `eudev` for device management.

**Short version for newcomers:** Devuan is what you install after you've spent a year on Mint or Debian and decided systemd isn't for you. See [The systemd problem](#the-systemd-problem).

Built on: Debian.

License: FOSS, with the same non-free firmware repository structure as Debian.

Good for: anyone who wants Debian's ecosystem and stability without the systemd dependency chain. If you know Debian, you know Devuan. The delta is intentional and small.

Bad at: cutting-edge packages. Tracks Debian stable. A small maintainer team means security patches occasionally lag upstream by a day or two.

Trajectory: steady. Devuan 6 "Excalibur" (tracking Debian 13 Trixie) released 2025. The project has delivered on time for every Debian stable release for a decade.

Use if: you want Debian without systemd and you want `apt`. Lowest-friction non-systemd path for a Debian user.

## Artix

Arch minus systemd. Supports OpenRC, runit, s6, dinit. Shares Arch's repositories and AUR through a compatibility layer.

Built on: Arch Linux.

License: FOSS, same model as Arch.

Good for: people who want Arch's bleeding edge and the AUR without systemd.

Bad at: being as battle-tested as Arch. Fewer users means fewer people have hit and fixed the edge cases. When an AUR package assumes systemd is present, you're on your own.

Trajectory: small but healthy.

Use if: Arch, but no systemd.

## Void Linux

Independent from the ground up. Not based on anything. Its own package manager (`xbps`), its own init (runit), its own repos, and a choice between glibc and musl C libraries. Rolling release.

**Short version for newcomers:** Not for newcomers, but worth knowing about. Void is the answer to "what if we built a rolling Linux from scratch, kept it lean, and refused corporate sponsorship?" Small community, small repo, very fast.

Built on: itself.

License: FOSS, with non-free firmware available in a separate repository.

Good for: people who want a lean, fast, opinionated rolling distro with no corporate owner, no systemd, no legacy baggage. runit is among the simplest init systems in existence; xbps is noticeably faster than apt or pacman; boot times are short. musl is a real working path if you want a smaller, stricter libc (musl is an alternative to glibc, the GNU C library almost everything else uses, musl is smaller and stricter but some proprietary software expects glibc and won't run on it).

Bad at: ecosystem size. Fewer packages than Arch or Debian; the xbps-src templates are smaller than the AUR. Small community is also its charm.

**Flag worth naming: the 2018–2019 maintainer-absence scare.** Void's original lead developer, Juan RP (xtraeme), disappeared from the project for an extended period in 2018 without warning, no commits, no responses, no handover. For several months the domain registration and infrastructure hung in limbo. The rest of the contributor team eventually organized, moved to a new domain (`voidlinux.org` instead of the original), and distributed the governance so no single maintainer absence could cause the same problem again. The project recovered, kept shipping, and is in good shape in 2026. But the episode is the single clearest bus-factor warning in the independent-distro space, and the lesson stuck: even a well-run small project can have one person whose disappearance freezes the whole thing. Void's governance is more distributed now, but the user base is still small, and "what happens if the maintainers lose interest" is a real question for any independent distro.

Trajectory: slow, steady, healthy. Quiet in the way a good distro should be.

Use if: you want something independent, lean, non-systemd, and opinionated. If someone asked me "what's the distro closest to the spirit of this document," this is it.

## Gentoo

Source-based. You compile everything from Portage, with fine-grained USE flags controlling which features get compiled into each package. OpenRC by default; systemd also supported; rolling release; excellent handbook.

**Short version for newcomers:** Gentoo is the Linux people run when they want to understand every part of their system and don't mind waiting for it to compile. Not a first distro, but probably the best learning distro once you're ready.

Built on: its own build system and ports-style tree.

License: FOSS. Non-free firmware is available if enabled via build flags.

Good for: total control. A full browser compile takes hours; a kernel compile is normal. In exchange you get a system with exactly the features you enabled, compiled for your CPU. ChromeOS is Gentoo-derived.

Bad at: fast iteration. Changing a USE flag globally rebuilds everything that depends on it. World updates can run for hours.

Trajectory: stable, small, beloved. Healthy long-term niche.

**Rolling done right.** Gentoo's init story is one of the cleanest in mainstream Linux. OpenRC is the default, systemd is supported but never imposed, and the choice is a profile selection at install time rather than a compatibility hack grafted on after the fact. `USE=-systemd` at the build level keeps systemd's daemons from being compiled into anything that doesn't strictly need them, so even on a hybrid system the surface area stays small. Compare to Arch, where systemd is the default and the assumption: shipping the same package set without it requires a parallel project (Artix), because Arch's tooling and many AUR packages are written assuming systemd is present. Both are "rolling," but the rolling-distro promise (upstream-fast updates with full control over what your system actually runs) is one Gentoo keeps and Arch only partially does. If init choice and build-level component control matter to you, Gentoo is the only mainstream rolling distro that treats them as first-class.

Use if: you want to understand your system deeply, you have time to compile, and you value control over convenience.

## NixOS

Declarative system configuration. Your entire system (installed packages, services, users, network, firewall, cron jobs) lives in a single `configuration.nix` file. Rebuilds produce a new generation you can roll back to.

Built on: the Nix language and package store.

License: FOSS. Non-free firmware and software available via the `unfree` attribute flag.

Good for: reproducible system configuration, dev environments, anyone who wants infrastructure-as-code for their own machine. Nixpkgs is among the largest package repositories in existence (100,000+). Atomic rollbacks are genuinely useful.

Bad at: being learnable in a weekend. The Nix language is its own thing, documentation has been a long-standing weak spot, and the mental model is different from every other distro.

Flags: significant governance fights in 2024 around the NixOS Foundation, military contracts (Anduril specifically), and CoC enforcement; long-time maintainers left and forked as Lix. The foundation has restructured but the culture isn't fully settled.

Trajectory: powerful, interesting, mid-reset. Evaluate the Lix fork if governance matters to you.

Use if: reproducibility is your top priority and you're willing to learn a new language for it.

## Slackware

The oldest surviving Linux distribution still actively developed. Released in July 1993 by Patrick Volkerding, who remains the sole maintainer. Did not adopt systemd, does not plan to, never will. Used by the contributor who taught Linus Torvalds about Linux. Distinct enough that almost nothing else looks like it.

Built on: its own package format (`.tgz` / `.txz` tarballs) and `pkgtool` for management. No automatic dependency resolution by default, you read the documentation, install what's needed, and the system gets out of your way. Third-party tools like `slackpkg` and `slackbuilds.org` add dependency resolution if you want it.

License: FOSS. Conservative on accepting new code; the project's stated value is stability and predictability over feature pace.

Good for: a sysvinit-style boot (actually BSD-style init scripts, predating sysvinit's later refinements), no telemetry, no scheduled upgrades, no community drama because the project is run by one person who has zero interest in being captured by anything. Slackware 15.0 released February 2022; Slackware-current is the perpetual rolling beta where new packages land. Stable releases come "when ready," which has historically meant 3-6 years between major versions.

Bad at: hand-holding. Slackware assumes you can read documentation and configure things yourself. New users typically struggle with the no-dependency-resolution default; tools like `slackpkg` reduce the friction. The wider ecosystem of "official Slackware spins" is non-existent, there's just Slackware, full stop.

Trajectory: stable in the literal sense. The project has outlived most of its peers and shows no sign of changing course.

Use if: you want the oldest, most conservative, most stable Linux project, run by one person who doesn't take corporate funding and doesn't take input from culture war factions of any political direction. Niche but real. Not recommended for newcomers.

## openSUSE Tumbleweed and Leap

SUSE's community distribution in two flavors: Tumbleweed is rolling; Leap is periodic-release aligned with SUSE Linux Enterprise.

Built on: SUSE's packaging (RPM, `zypper`, YaST).

License: FOSS, with non-free firmware and codecs available in opt-in repositories.

Good for: Tumbleweed is the best-QA'd rolling release available, uses openQA, an automated testing harness, so packages don't land on users' machines until a large matrix of installation and upgrade scenarios has passed. Leap is conservative enterprise-style. YaST is the most polished graphical system-administration tool in any major distro. KDE Plasma is first-class. Btrfs (a modern filesystem) with snapshots by default, so bad-update rollbacks are trivial.

Bad at: mindshare in the US. More popular in Europe, so English-language tutorials often default to Ubuntu or Fedora. SUSE's corporate ownership has changed hands multiple times.

Trajectory: stable and underrated.

Use if: you want a rolling release that has actually been tested before it hits you.

## OpenMandriva

The community continuation of Mandrake / Mandriva, maintained by the OpenMandriva Association, a non-profit established 12 December 2012 under French 1901 associations law. RPM-family, KDE Plasma by default, Clang-built, community-governed. Structurally unusual in that it cannot be acquired: the Association has a member assembly, an elected council, and published bylaws that include dissolution rights. Bryan Lunduke runs it as his personal daily driver and it's what brought OpenMandriva into wider view on the project-culture axis in 2025.

**Short version for newcomers:** An option you probably haven't heard of unless a specific commentator sent you. Possible but not the first Linux to try if you're coming straight from Windows, the community is smaller, documentation is thinner, and Mint will be easier for your first six months. Worth knowing exists for when you want a non-corporate RPM alternative to Fedora.

Built on: its own RPM-based packaging, DNF package manager (same family as Fedora, openSUSE, Mageia). Built with Clang rather than GCC, the first major desktop Linux distribution to make that switch, in 2016. Ships x86_64 builds plus separate znver1-optimized builds for AMD Zen. Two release channels you must not mix: **ROME** (the rolling release, for individual users, current iteration published 11 December 2024) and **Rock / OMLx 6.0** (the fixed point release, codename Vanadium, published 20 April 2025). Rock 6.0 ships KDE Plasma 6 with X11 or Wayland sessions and alternate LXQt, GNOME, XFCE, and COSMIC 1.0 alpha spins.

License: FOSS. Non-free firmware is available.

Good for: someone who wants an RPM-family distro without Fedora's IBM-Red Hat parentage or openSUSE's SUSE-corporate layer. KDE Plasma is first-class and feels closer to a Windows-like layout than GNOME. Proton and Proton Experimental are available directly from the repos, which means Steam / Windows-game compatibility is an `dnf install` away without adding third-party repos. Governance is structurally clean: French 1901 non-profit, published council, treasurer and bureau listed publicly, annual activity-and-accounts reports required.

Bad at: scale. DistroWatch hit-rank bounces around the 30s–40s, roughly an order of magnitude less traffic than Mint, Debian, or Fedora. Smaller forum, fewer tutorials, thinner third-party package coverage. Uses systemd as default init, if your primary objection is systemd, OpenMandriva doesn't solve it (a `runit` package exists in repos but swapping init is DIY and unsupported). The ROSA-lineage part of its ancestry connects back to a Russian Mandriva fork, which is worth naming given the supply-chain frame elsewhere in this guide; the current Association is French and governed independently, but the code history is what it is. Not a gaming-specialized distro in the Bazzite/CachyOS sense, Proton in the repo is a package, not a tuned stack.

Trajectory: steady. Rock 6.0 released on schedule in April 2025. ROME updates continuously. The Association has not had a visible governance crisis. It remains small.

Use if: you want a non-corporate RPM-family distro with a Windows-like KDE desktop, you are OK being on a smaller distro with thinner documentation, and either governance posture or Lunduke's endorsement is what brought you here.

## Pop!_OS

System76's Ubuntu-based distribution. Currently shipping with a heavily-modified GNOME; the COSMIC desktop (a Rust-based rewrite) is in alpha/beta as of early 2026.

Built on: Ubuntu LTS.

License: FOSS, including non-free firmware and NVIDIA drivers by default.

Good for: System76 hardware, NVIDIA GPU users (Pop ships NVIDIA drivers out of the box), tiling-friendly workflow via GNOME extensions.

Bad at: timing. The COSMIC transition has been slow; shipping Pop is in a holding pattern.

Trajectory: in transition. If COSMIC lands well, Pop becomes interesting again.

Use if: you bought a System76 machine, or you're on NVIDIA and want a curated Ubuntu derivative.

## Zorin OS

Commercial Windows-refugee distribution. Heavy migration tooling, Windows-like default layouts. Free core; Zorin Pro adds more layouts and preinstalled apps.

Built on: Ubuntu LTS.

License: FOSS core, including non-free firmware for broad hardware support; Zorin Pro is a paid tier with additional layouts and apps but no core lock-in.

Good for: people nervous about leaving Windows who want maximum hand-holding. Zorin 18 shipped October 14, 2025 (the same day as Windows 10 EOL) with explicit Windows-installer detection, OneDrive integration, and Windows-desktop layouts. The project reported roughly 100,000 downloads in the first two days, most from Windows-origin machines.

Bad at: being interesting. Under the hood it's Ubuntu. The polish is genuine but you're paying for curation rather than anything architecturally different.

Trajectory: rising on the Windows-10-EOL wave.

Use if: you need to migrate a non-technical family member and want the least-friction onboarding. Mint is the free alternative.

## Bazzite and SteamOS (gaming)

**Bazzite:** community-maintained Fedora Atomic variant with Steam, Proton (the Valve tool that lets Windows games run on Linux), gamescope, and HDR/VRR preconfigured. Desktop and handheld variants. Uses the immutable-base-filesystem model, the core OS is read-only and updates atomically, applications live in Flatpak or Distrobox containers. Practically: you can't easily `dnf install` a system package, but you also can't break your system by accident, and rollbacks are trivial.

**SteamOS:** Valve's own Arch-based distribution, officially shipping on the Steam Deck with broader desktop release expected. Bazzite is the practical choice for non-Deck hardware today.

License: FOSS, including non-free firmware, NVIDIA drivers, and codec support needed for gaming.

Good for: gaming hardware you want to think about as little as possible. Proton runs a large majority of top Steam titles as of 2026. HDR and VRR work on supported hardware.

Bad at: being your main development machine. Immutable base means traditional `apt install` / `dnf install` doesn't apply; you work through Distrobox, Flatpak, or Toolbx.

Use if: you want a gaming PC that isn't Windows 11.

## Alpine

Minimalist, security-focused, musl-based. Famous as the default base for Docker containers (~8MB image vs 200MB+ for Ubuntu) but also usable as a server or desktop OS.

Built on: musl libc, BusyBox, OpenRC, its own package manager (`apk`).

License: FOSS. Proprietary firmware blobs are typically not installed by default.

Good for: containers, embedded, small self-hosted servers, security-minded users who want a small attack surface. Position-Independent Executables by default, stack-smashing protection on, minimal base install.

Bad at: desktop use by default. Because Alpine uses musl instead of glibc, some proprietary software that assumes glibc won't work, some games with anti-cheat, some enterprise software, a few Steam titles.

Use if: you run containers or small servers and want the smallest most-audited base.

## High-security operating systems: how to pick

The next several entries (Qubes, Whonix, Tails, Kicksecure, Vendefoul Wolf, Trisquel/PureOS) are operating systems built specifically to defend against serious threat models. Most people don't need them; the entries above (Debian, Devuan, Fedora, Mint) plus the workstation hardening covered separately get you to a perfectly defensible setup for normal use. If you're considering one of these high-security distros, you're answering a specific question: "what's the right system for this scenario?"

The six scenarios that actually drive these choices, and the picks that map to each:

**A. One-off amnesic session for sensitive work.** Booting from a USB stick, doing one specific thing (filing a report, accessing a sensitive account, communicating once), and rebooting back to your normal life with nothing persisted on disk. The system must leave no forensic trace on the host hardware. **Pick: Tails.** Designed for exactly this. Boots from USB, runs entirely in RAM, all network traffic forced through Tor by default, optional encrypted persistent volume only if you opt in.

**B. Persistent Tor-anonymous workspace.** You're working on a project (research, journalism, contributing to a sensitive codebase) over weeks or months under a pseudonym, and every connection it makes should be over Tor with no way for a misconfigured application to leak your real IP. **Pick: Whonix, ideally on Qubes.** The Whonix-Gateway VM forces all traffic from the Workstation through Tor at the network layer; even a compromised application inside the Workstation cannot leak your real IP because it has no non-Tor route. Qubes-Whonix adds whole-machine compartmentalization underneath.

**C. Compartmentalized daily driver.** Your main computer is used for work, banking, personal stuff, untrusted browsing, code from random repos. You want an exploit in your browser not to compromise your banking session. **Pick: Qubes OS.** Each role runs in its own VM. The browser qube getting owned doesn't touch the work qube. Requires real hardware (16GB+ RAM, virtualization extensions, whitelisted laptop) and a learning curve, but no other OS makes per-task isolation this thorough.

**D. Hostile-network field work.** You're traveling and connecting through coffee-shop Wi-Fi, hotel networks, conference networks, foreign infrastructure that may be hostile. **Pick: depends on whether you're carrying a hardened daily-driver laptop or a fresh machine.** If carrying your hardened Devuan workstation, add a Whonix-Gateway VM in front of its networking for the duration of the trip (forces Tor on top of existing hardening). If carrying a fresh laptop and want minimal forensic footprint, Tails on USB. If carrying Qubes hardware, Qubes with sys-net-vpn for the entire trip.

**E. Air-gapped signing or cold storage.** A machine that holds high-value cryptographic material (GPG primary key, Bitcoin wallet keys, code-signing keys) and never connects to the internet. **Pick: hardened Devuan or Debian with networking physically removed (no Wi-Fi card, no Ethernet cable), or Tails for sessions you don't want persisted, or OpenBSD when OS monoculture is itself part of the threat model.** The OS choice matters less than the air-gap discipline. OpenBSD as a signing-machine choice has a specific argument behind it: it's not derived from anything else this doc covers, its codebase is small enough that one person could in principle audit it, and its developers prioritize correctness over feature pace in a way that matches the air-gapped-signing role. Full OpenBSD coverage is in the BSDs section below.

**F. Hardened daily driver that isn't a Tor target.** You want a normal daily-use desktop with strong defaults (disk encryption, hardened kernel, sensible permissions, integrity monitoring) without the cost of running everything through Tor. **Pick: hardened Devuan, Kicksecure, or Vendefoul Wolf.** All three reach roughly the same end state; the difference is whether you want to apply the hardening manually (Devuan + the workstation hardening guide) or inherit it from the distro (Kicksecure, which is Debian-based with hardening defaults; or Vendefoul Wolf, which is Devuan-based with similar defaults).

### Layering: what stacks with what

**Qubes-Whonix** is the strongest desktop setup available. Whonix-Workstation templates run as qubes; Whonix-Gateway runs as a separate qube; other qubes (work, personal, banking) use the Gateway as their network proxy or have direct internet depending on role. The thing Qubes-Whonix is genuinely best at: a browser exploit in the Whonix-Workstation qube cannot leak your real IP (Whonix-Gateway blocks the route) AND cannot reach your work qube's files (Qubes blocks the cross-qube access).

**Whonix on a non-Qubes Linux host** is the fallback when Qubes hardware isn't available. KVM or VirtualBox on a hardened Devuan or Debian host. Worse than Qubes-Whonix because the host OS is now the trust boundary; a host compromise compromises the Whonix session. Better than running anonymous work directly on the host.

**Tails on a personal laptop** versus **Tails on a borrowed machine** is a meaningful distinction. The personal laptop has consistent hardware identifiers (MAC addresses, hardware serial numbers) that, while masked by Tails defaults, persist across sessions. A borrowed machine breaks that linkage; an internet café or library terminal that you don't return to is the strongest version of "amnesic session."

**Hardened Devuan plus Whonix-Gateway** is the lower-commitment version of compartmentalized + Tor-forced. Your daily driver runs on Devuan with the standard hardening; a Whonix-Gateway VM exists on the same host; specific applications (a separate Firefox profile, a specific user account, a Qubes-style "anon qube" that's actually just a separate VM) route through the Gateway. Most work runs on the direct-internet Devuan host with the host's hardening; the Tor-routed activity uses the specific Gateway-routed path.

**Heads or coreboot underneath any of the above.** The firmware layer (BIOS / UEFI) is below the OS, and every OS on this page assumes the firmware loading it is benign. If your threat model includes physical access to your hardware or supply-chain interception, replacing the proprietary firmware with Heads (an open coreboot payload that measures and verifies the boot chain) closes the layer everything else assumes. Hardware-specific; supported laptops include the ThinkPad X220/X230/T420/T430 lineage, Purism Librem, System76 with open firmware, and Dasharo-supported boards.

### Hardware requirements at a glance

- **Tails**: any laptop with 2GB+ RAM that boots from USB. Forgiving.
- **Whonix on Qubes**: Qubes hardware requirements (16GB+ RAM, virtualization extensions, whitelisted laptop). Tight.
- **Whonix on Linux host**: any modern laptop with 8GB+ RAM and KVM/VirtualBox support. Forgiving.
- **Qubes**: 16GB+ RAM minimum, 32GB comfortable, Intel VT-x with VT-d or AMD equivalents, SSD, qubes-hcl whitelist match. Specific.
- **Kicksecure or Vendefoul Wolf**: any laptop that runs Debian or Devuan. Forgiving.
- **Heads / coreboot underneath**: ThinkPad X230/T430/X220/T420 (or Purism / System76 / Dasharo). Specific.

### Threats these systems do not address

Worth being explicit. The high-security distros above defend against software-level threats: browser exploits, malicious applications, network surveillance, forensic recovery from disk. They do not defend against:

- **Physical coercion.** "Unlock this device or you're not getting out of this room" defeats encryption. Defense is jurisdictional (be where coercion is illegal) or operational (plausibly-deniable hidden volumes, duress passwords that wipe), not technical.
- **Side-channel attacks on the hardware.** Power analysis, electromagnetic emanations, acoustic cryptanalysis. Defense is physical (Faraday-shielded room) or hardware-level (open silicon like Precursor), not OS-level.
- **Stylometric fingerprinting.** Your writing style identifies you across pseudonyms. The Whonix wiki explicitly warns about this. No OS can fix it; it's a behavioral discipline.
- **Time-correlation attacks on Tor.** A global passive adversary observing both ends of the Tor network can correlate your traffic. Defense requires more than Tor alone (operations-time discipline, mixing in additional latency, sometimes running operations on a delay).
- **Targeted hardware implants.** A nation-state-level adversary who has interdicted your hardware shipment has access below the OS layer. Defense is supply-chain (buy openly, verify firmware on receipt, prefer hardware you can audit) and physical-security (don't leave the laptop in hotel rooms when traveling).

If your threat model includes any of these, the OS choice is necessary but not sufficient. Behavioral discipline and physical-security practice matter more than which Linux you picked.

### Other "anonymous" distros worth knowing why to skip

- **Kodachi.** Advertised as a "secure anti-forensic Linux," but per a bitsex.net technical review, structurally Ubuntu with theming and shell scripts rather than a system-level hardened distro the way Tails is. The hardening claims don't survive inspection. Skip.
- **Subgraph OS.** The original project went dormant; the team's successor project, Citadel, has not produced production releases as of late 2025. Promising design (Grsecurity-kernel, OZ application sandboxing) but not currently a working option. Wait and see.
- **Parrot OS, Kali Linux.** Penetration-testing distros, not user-privacy distros. They're configured to be useful tools for someone doing offensive security work, not to defend the user running them. Different problem; wrong tool.
- **HardenedBSD.** Real hardening work on FreeBSD (ASLR, W^X, segvguard). Worth considering if you're already a FreeBSD user. For someone coming from a desktop-Linux background, the BSD learning curve is its own commitment; Tails/Whonix/Qubes on Linux are closer to where you already are.

## Qubes OS

Security through compartmentalization. Built on the Xen hypervisor; every application runs in its own virtual machine (a "qube"). Work qube, personal qube, banking qube, untrusted-browsing qube; they share only a clipboard and controlled file transfer.

Built on: Xen hypervisor, with Fedora dom0 (the privileged admin layer) and Fedora/Debian/Whonix templates (the VMs your apps actually run in).

License: FOSS.

Good for: high-sensitivity threat models. Journalists, dissidents, security researchers, anyone whose threat model assumes one app will eventually be exploited. If your browser gets owned, it gets owned inside a disposable VM; the rest of your system is unaffected. Snowden is a public proponent.

Bad at: running on laptops. Needs real hardware, 16GB RAM minimum (32GB comfortable), a recent Intel or AMD CPU with virtualization extensions, and a whitelisted hardware list (check `qubes-hcl` before buying). Battery life takes a hit. GPU passthrough and suspend/resume are historically fragile.

Trajectory: stable and well-maintained. Qubes OS 4.3 released early 2026; 4.2 remains supported.

Use if: your threat model is serious, you have the hardware, and you're willing to invest in the mental model.

## Whonix (and the VPN question)

Two Debian-based virtual machines you run on top of another OS: a **Whonix-Gateway** that forces all traffic through the Tor network, and a **Whonix-Workstation** that only gets internet via the Gateway. Standard deployment is VirtualBox or KVM on a Linux / Mac / Windows host. The most secure deployment is inside Qubes, as Qubes-Whonix.

**Short version for newcomers:** Tor is a free anonymity network that routes your traffic through three volunteer-run servers, each of which only knows one hop, so no single party sees both who you are and what you're doing. Whonix is a pair of VMs that forces every application on your computer to go through Tor whether the app knows about Tor or not. If an application tries to connect directly to the internet, Whonix blocks it. This is the part commercial VPNs cannot do.

Built on: Debian + Tor + a hypervisor (Xen / KVM / VirtualBox).

License: FOSS.

Good for: IP-hiding and anonymity as a persistent state. Unlike Tor Browser alone, Whonix forces every application in the Workstation through Tor, email, chat, VoIP, SSH, crypto wallets, everything. The "fail-closed" design means that if an app tries to bypass, it gets blocked rather than leaking.

Bad at: being a single-install OS. Whonix is the two VMs; it needs somewhere to run. Most users run those VMs on top of a regular host OS (Windows, Mac, or Linux via VirtualBox or KVM), which means the host OS is the weak link, if Windows is compromised, your keystrokes are exposed before Whonix sees them. Qubes-Whonix fixes this by running the Whonix templates inside Qubes, whose dom0 is hardened and not used for normal work. A dedicated bare-metal Whonix-Host OS (based on Kicksecure) is in development but the project explicitly says it is not yet ready for users. Physical isolation (running Gateway and Workstation on two separate physical machines) is supported but now rare. Beyond the deployment question: Tor is slower than direct internet, and some services (Cloudflare-protected sites, streaming services, banking) block Tor exits.

### Is Whonix actually safer?

It depends on what you're comparing to and what you're trying to protect.

**Safer than regular Linux for anonymity, yes.** On regular Linux, applications connect to the internet directly, can see your real IP address, and can be tricked or exploited into leaking it. Whonix's fail-closed design blocks any connection that doesn't go through Tor, so even an exploited application can't leak your IP because the operating system won't let it.

**Safer than Tor Browser alone for anonymity, yes.** Tor Browser only anonymizes what happens inside the browser. Your email client, your chat app, your SSH client, your cryptocurrency wallet, and anything else that touches the network are still connecting directly. Whonix extends Tor to every app on the Workstation.

**Not safer than Qubes OS for compartmentalization.** Different axis. Whonix isolates you from the network. Qubes isolates apps from each other. The best answer is both: run Whonix templates inside Qubes, which is supported and well-documented.

**Not immune to host compromise.** Whatever is acting as the host of your Whonix VMs (your Windows / Mac / Linux desktop, or Qubes dom0) is where attackers will go first. If that layer is owned, your Whonix session is owned, because the host sees your keystrokes before Whonix does. The specific exploit class that crosses the host boundary is **VM escape**: a vulnerability that lets code running inside a guest VM execute on the host. KVM, Xen, and VirtualBox all have CVE history here; escapes are rare and patched quickly but exist. Qubes-Whonix on Xen with a minimal dom0 raises the bar against this class meaningfully higher than Whonix-on-KVM on a general-purpose Linux desktop, which is why Qubes-Whonix is the recommended deployment when the threat model includes active exploitation.

**Not immune to Tor's own limitations.** A sufficiently powerful adversary that can see both ends of the Tor network (for example, a nation-state that monitors both your country's internet and the destination site) can correlate traffic and reduce anonymity even through Tor. This is a real limitation and is why Tor is not a substitute for operational security discipline.

So: Whonix is the best practical tool for IP-level anonymity and app-wide Tor routing on consumer hardware. It is not magic, it does not protect against a compromised host, and it does not replace thinking about what you're actually doing.

### Does using Whonix mean I don't need a VPN?

Yes. Whonix routes all your Workstation traffic through Tor. Tor is the anonymity layer, and it is a much stronger one than any commercial VPN: Tor is a three-hop encrypted anonymization network run by thousands of independent volunteers, whereas a VPN is a one-hop encrypted tunnel run by a single company that knows exactly who you are and could be compelled to say so. Stacking a commercial VPN on top of Tor does not compound privacy, one extra layer run by a single identifiable party does not strengthen three layers run by unrelated volunteers.

The Whonix project's own documentation goes further and describes the VPN-plus-Tor debate as "the law of triviality / bikeshedding", people argue about VPNs because VPNs are easy to argue about, while the real privacy issues (browser fingerprinting, traffic-analysis attacks, keystroke timing, guard-relay discovery) get less attention[^whonix-vpn]. Commercial VPNs also have their own problems: single-party trust, the possibility of logging, the Port Shadow attack disclosed in 2024 affecting shared-port VPN servers, and the fact that VPN companies are routine acquisition targets for surveillance operators.

You can add a VPN to Whonix if you have a specific reason: your ISP blocks Tor and you need to reach Tor through a VPN (user → VPN → Tor → internet), or you want Tor to reach a service that blocks Tor exits (user → Tor → VPN → internet). Both configurations are advanced, explicitly unsupported by the Whonix team, and not leak-tested the way the base setup is. Without one of those specific reasons, don't do it.

The same logic applies to Tails. Tor is the protection; a VPN adds complexity without adding anonymity.

Short answer: use Whonix or Tails, don't bother with a commercial VPN on top.

Trajectory: stable. Funded through 2026 by Power Up Privacy.

Use if: you want Tor-forced anonymity as a persistent workspace. Best inside Qubes; acceptable standalone.

## Tails

The Amnesic Incognito Live System. A Debian-based live USB that runs entirely in RAM, routes all traffic through Tor, and forgets everything on shutdown. Optional encrypted Persistent Storage for things you want to survive reboots. Merged operations with the Tor Project in September 2024.

**Short version for newcomers:** You boot your computer from a USB stick, everything runs in memory, and when you shut down, nothing is left behind, not on the USB, not on the computer, not in the logs of your ISP (because Tor anonymized it). Good for one-off sensitive sessions, research on shared computers, any situation where the computer should remember nothing.

Built on: Debian + Tor + GNOME.

License: FOSS, with non-free firmware blobs included for hardware support (Tails prioritizes booting on arbitrary hardware over strict libre purity).

Good for: specific sessions where nothing should persist. Whistleblowing, research on sensitive sources, using a shared or borrowed computer, any situation that benefits from the machine forgetting. MAC address spoofing, Tor routing, amnesia by default, vetted software selection.

Bad at: being a daily driver. Runs from USB, every session starts clean unless you set up Persistent Storage, no GPU-accelerated gaming, narrower hardware support than a full Debian install.

### What Tails protects against and what it doesn't

Tails routes all traffic through Tor at the network layer, so destination services see a Tor exit IP and not yours. That is the strong property. The weaker property (worth understanding before relying on Tails for high-stakes work) is that Tails runs every application on the same kernel that has the real network interface. The kernel knows your real IP (it is bound to the physical NIC); Tor enforcement is a set of netfilter rules on the same system the apps run on. An exploit that gets code execution at sufficient privilege can read the real IP directly and exfiltrate it out-of-band, bypassing Tor entirely.

This is not hypothetical. The FBI's Playpen operation in February 2015 used a Firefox vulnerability in the Tor Browser bundle to install what the agency called a Network Investigative Technique on visitors' machines; the NIT read the real IP and transmitted it directly to an FBI server in Alexandria, Virginia, outside the Tor network. Roughly 137 federal prosecutions followed.[^playpen-nit] Tails users hit by the same class of exploit would have been deanonymized the same way: the architecture is not different on this axis. Whonix is structurally different here, the Workstation VM has no route to the real network and no awareness of the real IP, so a compromised application inside it cannot leak what isn't there. See the Whonix entry above.

What Tails does to reduce the practical risk:

- **AppArmor confinement on Tor Browser.** A successful Firefox exploit lands inside an AppArmor-restricted process that cannot read most of the filesystem, cannot execute arbitrary binaries, and cannot do much beyond browsing. Reaching the privilege level needed to query network interfaces is a separate exploit on top.
- **Unprivileged user account.** The Tails user runs without sudo by default and the OS is read-only on the USB stick during a session.
- **Amnesia bounds persistence.** A successful compromise dies at reboot. There is no foothold for the attacker to maintain across sessions, which is the property a long-term surveillance operator usually wants.

These do not change the architectural fact that the kernel possesses your real IP. They raise the cost of an exploit that uses that fact and limit how long a successful one lasts. For most users at most threat levels, that is enough. For users whose adversary will burn a browser zero-day in a single session, it is not, and Qubes-Whonix is the answer.

Trajectory: stable, well-funded, well-audited. The Tor Project merger in 2024 strengthened both sides.

Use if: you need amnesic, Tor-forced, leave-no-trace sessions. Keep a Tails USB in a drawer even if you don't use it often.

## Kicksecure

The Whonix team's hardened Debian. Same base as Whonix, same security work, but without Tor in the default path, so you get normal internet speeds and unblocked access to sites that refuse Tor exits.

**Short version for newcomers:** "Hardening" in operating-system security means changing the defaults so that if something goes wrong, the damage is smaller. Vanilla Linux boots with a lot of features enabled that most people never use (some kernel modules, some network protocols, some permission combinations) and any of those can become an attack surface if a bug is found. A hardened system switches those off by default and tightens the remaining ones. Kicksecure does this systematically on top of Debian.

Concretely, Kicksecure applies:

- **AppArmor confinement**, a Linux kernel feature that restricts what specific applications can do, even if they're exploited. An AppArmored Firefox cannot read your SSH keys even if an attacker controls the browser.
- **Kernel-parameter tightening** via `/etc/sysctl.d/` and boot parameters, disables kernel features that enable kernel-level exploits, restricts what processes can see about each other, turns off obscure network protocols most people don't use.
- **Anti-fingerprinting measures**, removes or randomizes some of the data that websites and network observers use to identify your specific machine.
- **Tightened filesystem permissions** on sensitive files and directories.
- **Reduced attack surface**, fewer services running by default, fewer open network ports, smaller installed package set.
- **Hardened memory allocator** options that make certain classes of memory-corruption exploit harder.
- **A hardened web browser** (Tor Browser or a hardened Firefox variant) available by default.

Built on: Debian. Built by the same team that builds Whonix. In fact, Whonix itself is built on top of Kicksecure, the Whonix VMs inherit every Kicksecure hardening measure, then add Tor-forced networking on top. Kicksecure is what you get if you take Whonix and pull the Tor layer off.

License: FOSS, with the same non-free firmware repository structure as Debian.

Good for: someone who wants hardened Debian for general use without Tor in the default path. You get Debian's package ecosystem, Debian's stability, and a security posture significantly better than a default install, but you still use the regular internet at regular speed. If you decide later that you want Tor-forced anonymity, you can add the Whonix-Gateway on top; your Kicksecure install becomes the Workstation.

Bad at: discoverability. The project is the less-famous half of the Whonix team's work and most tutorials don't mention it.

Trajectory: stable. Tracks Debian stable. Active development through 2026.

Use if: you want a Debian desktop with security defaults turned up, and Tor-routed anonymity is not your primary goal. This is also the right choice if you're curious about Whonix but not ready for the full Tor-forced setup, you can graduate to Whonix later without reinstalling.

## Vendefoul Wolf

A small, principled, Devuan-based distribution. Ships with OpenRC instead of systemd, XLibre (a community fork of X.org) instead of Wayland, no telemetry by default, and no AI integration. Preinstalls LibreWolf browser and KeePassXC password manager. Primary development community is Spanish-speaking but the distribution is fully usable in English. Uses the Calamares installer.

Built on: Devuan 6 with a custom kernel.

License: FOSS.

Good for: users whose stated values match the project's stated values, no systemd, no Wayland, no telemetry, no AI. Ready-to-use for common hardware (printers, Bluetooth) out of the box. Fast install via Calamares. Runs lean on modest hardware.

Bad at: ecosystem and bus factor. Small team, repositories largely depend on Devuan upstream, small community. If the lead maintainer loses interest, the project is in trouble. Documentation is Spanish-primary, English-secondary.

Trajectory: active, niche, regularly releasing ISOs through 2026.

Use if: your priorities match the project's stated defaults and you're OK with a small project. Otherwise, Devuan with manual customization gets you most of the way and has a larger base.

## Trisquel and PureOS (libre)

Two of the Free Software Foundation's endorsed fully-libre distributions. Zero proprietary firmware, zero proprietary drivers, zero non-free software in the default repos. Trisquel is Ubuntu-derived; PureOS is Debian-derived (shipped on Purism's Librem hardware).

Good for: anyone who wants to use only free software. The FSF endorsement means every package has been audited for freedom; no closed-source binary blobs anywhere.

License: strictly FOSS, no proprietary firmware or drivers of any kind. Hardware compatibility will be narrow as a direct consequence.

Bad at: modern hardware. Most Wi-Fi cards, almost all GPUs, many laptops, and most printers need proprietary firmware these distros refuse to ship. You need specific hardware to have a working system.

Flags: both distros live inside the FSF's political orbit, which has had its own governance tensions since 2019.

Trajectory: narrow-purpose, stable. Trisquel 12 released 2024; PureOS tracks Debian stable.

Use if: software freedom in the FSF-maximalist sense matters to you.

## Where Linux comes from: the Unix lineage

Before the BSDs make sense on this list, you need the briefest history of where any of this came from. This is the one piece of context the rest of the doc depends on.

In 1969, a small team at Bell Labs in New Jersey (Ken Thompson, Dennis Ritchie, and others) built an operating system they called Unix. It was small, written in a language they also invented (C), and it established most of the ideas that modern operating systems still use: everything is a file, programs should do one thing well and compose together, text is the universal interface.

Unix was licensed by AT&T to universities and companies. One of those universities was Berkeley, where researchers modified Unix heavily and released their own version called BSD (Berkeley Software Distribution) starting in the late 1970s. BSD eventually replaced the original AT&T code, fought a legal battle with AT&T in the early 1990s, won, and became 386BSD, the ancestor of every BSD you'll see today. The main surviving branches are FreeBSD, NetBSD, and OpenBSD. Apple's macOS kernel also descends partly from BSD, which is why macOS feels Unix-like underneath the candy coating.

Linux took a different path. In 1991, a Finnish student named Linus Torvalds wrote a new Unix-like kernel from scratch, no Unix code, no BSD code, just the ideas and the interface conventions. He started because Unix was expensive and Minix (a teaching OS) was limited. His kernel is what we call Linux today, and it is a clean-room reimplementation of Unix ideas, not a descendant of Unix code.

So when you see OpenBSD or FreeBSD on this list, understand:

- They are not "a kind of Linux." They are Linux's cousins from the same family of ideas.
- OpenBSD and FreeBSD contain real lineage from AT&T Unix via Berkeley. Linux does not.
- From a user's perspective they behave almost identically to Linux. Same shell, same file layout, same basic tools. Differences mostly matter to system administrators and kernel developers.
- BSDs tend to be more coherent by design, the kernel and the userland (the tools that run on top of the kernel, shell, file utilities, compiler) are developed together as one project, instead of the Linux model where the kernel and the GNU userland are separate projects stitched together.
- BSD licensing is permissive (do whatever you want with the code, including ship a proprietary product built on it). Linux licensing is copyleft (derivatives must stay open). This has real consequences: Apple's macOS kernel is partly BSD-derived; no major commercial consumer OS is Linux-derived in the same way.

One footnote on the lineage that belongs in any honest telling of it: Minix, the teaching OS Andrew Tanenbaum wrote in the 1980s (the OS Linus Torvalds learned Unix ideas from before writing Linux) is still alive, but in a place you can't see. Intel ships a small Minix 3 instance embedded inside every modern Intel CPU as part of the Management Engine firmware, running underneath your operating system with access to parts of the hardware you do not have. Tanenbaum himself did not know Intel had done this until it was reported publicly. If you are running a modern Intel CPU right now, a Minix instance is running on it that you cannot inspect, disable, or audit. This is not an argument for or against any particular distro; it is a reminder that the software that runs on your computer is not only the software you chose.

This matters for the decision ahead. If you want something that behaves like Unix because it literally descends from Unix, smaller and more conservative and audited more carefully than any Linux distribution, keep reading.

## BSDs as an adjacent path

The BSDs share several properties that distinguish them from Linux: the kernel and base userland are developed as one coherent system, the codebases are smaller and more auditable, licensing is permissive (BSD / ISC) rather than copyleft, and governance is more centralized and engineering-led. They're not on the "sovereignty right" end of the politics axis because they're a different axis entirely, technical conservatism over political alignment.

### OpenBSD

Theo de Raadt's project, forked from NetBSD in 1995. Security and correctness through code auditing, minimalism, and aggressive default hardening. The smallest audited codebase of any general-purpose OS.

License: strictly BSD/ISC. OpenBSD goes further than most BSDs in refusing to ship code it can't audit.

Good for: security-critical servers, firewalls (`pf` is one of the best packet filters in existence), anyone who values a system designed to be correct by construction. Default install is minimal. OpenSSH, LibreSSL, and `pf` are OpenBSD projects that the rest of the world uses.

Bad at: desktop polish, gaming, modern hardware (NVIDIA in particular is not supported), running recent proprietary software.

Use if: you want security through minimalism and you're OK giving up modern desktop conveniences.

### FreeBSD

The largest of the BSDs. Production-serious Unix with a vast ports tree and strong enterprise use. Netflix's CDN runs on FreeBSD; PlayStation's OS is FreeBSD-derived; TrueNAS (the most-deployed storage software in the world) is FreeBSD.

License: BSD.

Good for: servers (especially storage), NAS, coherent Unix desktops (see GhostBSD below for a ready-to-run desktop build). ZFS (a modern filesystem with snapshots, compression, and data-integrity checking) is first-class. Jails are lightweight containers that predate Docker by a decade.

Bad at: Linux-specific software assumptions. Gaming works via Wine + Steam + a compatibility layer but lags Linux meaningfully.

Trajectory: 15.1-RELEASE shipped 16 June 2026, the second point release of stable/15. Supported through 31 March 2027; the 15 series runs through 31 December 2029. 15.0-RELEASE reaches EOL on 30 September 2026, so a fresh install today should target 15.1.

Use if: you want a coherent Unix for a server, a NAS, or a serious desktop, and you don't need Linux-specific software.

### GhostBSD

FreeBSD made desktop-usable. Started by Eric Turgeon in 2009 to make FreeBSD installable and productive for a regular user without reading the FreeBSD Handbook first. MATE is the default desktop, with XFCE and a new Gershwin (GNUstep-based, macOS-like) community edition. The graphical installer handles partitioning and uses ZFS by default. Versioning scheme is `YY.MM-R<FreeBSD base>p<patch>`, for example `26.1-R15.0p2`.

**Short version for newcomers:** Not a first-Linux replacement, because it isn't Linux. For someone who already uses Linux comfortably and is curious what BSD feels like, GhostBSD is by far the easiest way in.

Built on: FreeBSD. Uses FreeBSD's packaging (`pkg`), ports tree, and rc init (FreeBSD does not use systemd and never has).

License: BSD.

Good for: someone who wants FreeBSD's security posture, ZFS-by-default, and jail ecosystem with a working desktop on first boot. No systemd, ever. Excellent ZFS integration. WireGuard and 802.1X enterprise WiFi in the network manager as of the 2026 release. Small project with engineering-led governance, the lead developer switched the default display server from X.Org to XLibre in April 2026 specifically because of the governance turbulence around X.Org's reverts, which is the clearest statement of priorities a distro can make.

Bad at: gaming. Proton runs through FreeBSD's Linuxulator compatibility layer rather than natively, with meaningfully worse coverage and performance than on any Linux distro. Steam is not officially supported on FreeBSD. Bad at: the long tail of Linux-assuming desktop software, one recent reviewer confirmed Obsidian and Joplin won't install; Adobe, Spotify-official, and other proprietary Linux-targeted apps typically don't exist for FreeBSD. Bad at: fractional display scaling (not supported). Bad at: Wayland (X.Org and XLibre only; Wayland is on the roadmap but not shipped). The installer only supports FreeBSD's BIOS loader, no rEFInd, no FreeBSD boot manager option during install. In-place upgrades from 25.02 to 26.1 stay on X.Org; fresh installs boot to XLibre.

Trajectory: 26.1-R15.0p2 shipped 18 April 2026, the first GhostBSD release on FreeBSD 15.0. Default shell switched to zsh. Active small-team development, predictable release cadence aligned with FreeBSD upstream.

Use if: you are Linux-literate, curious about BSD, and want a working desktop on first boot. Not for gaming, not for first-time migrants, not for someone who needs Adobe software.

A note on the XLibre dimension: GhostBSD's adoption of XLibre is an engineering decision and reads cleanly as one (Good for, above). XLibre as a project is messier, its public-facing rhetoric drew an ArchWiki page deletion in April 2026 that doesn't reduce to the GNOME-side CoC asymmetry pattern. See "The XLibre / ArchWiki case (April 2026): a contrast" inside Community politics for the longer treatment.

### NetBSD

The portability project. Runs on more architectures than anything else on this list, desktop PCs, ARM boards, embedded hardware, VAX minicomputers, toasters.

License: BSD.

Good for: unusual hardware, research, education, extreme portability as a design principle.

Use if: you have weird hardware or you like the idea of one OS running on everything.

## Further reading: how to actually learn Linux

Once you've picked a distro and installed it, the natural next question is how to actually understand the system under your hands. The short answer: books build the mental model, websites help you apply it. Most people starting out go straight to websites and Stack Exchange, copying solutions without understanding them, they can operate Linux but don't understand it. Books fix that. Websites are for applying and troubleshooting. The two serve different moments in the learning process.

If you only read one book, read this:

- **The Linux Command Line**, William Shotts. Free online at linuxcommand.org. The best starting point for building real competence at the shell.

From there, in a loose order:

- **How Linux Works**, Brian Ward. Explains what's actually happening under the hood without requiring you to be a programmer. Good second book.
- **Unix and Linux System Administration Handbook**, Nemeth, Snyder, Hein, Whaley. The professional standard. Heavy. Called "the bible" in sysadmin circles.
- **The Linux Programming Interface**, Michael Kerrisk. For understanding how Linux works at the system-call level. Kerrisk maintains the Linux man pages, so this is authoritative.
- **The Unix Programming Environment**, Kernighan and Pike. Written in 1984 and still worth reading. Teaches how Unix was meant to be used and thought about.
- **Advanced Programming in the Unix Environment**, W. Richard Stevens. Stevens was the best technical writer in this space. Dense but authoritative.
- **Linux Kernel Development**, Robert Love. The accessible introduction to kernel internals, for when you want to start understanding what the kernel actually does.
- **Understanding the Linux Kernel**, Bovet and Cesati. Goes deeper than Love's book.

Websites, roughly ordered by when in your journey they're most useful:

- **bellard.org/jslinux.** Fabrice Bellard's in-browser PC emulator. Boots Alpine, Buildroot, Fedora RISC-V, or Windows 2000 in a tab. Useful for playing with a real shell from a machine where you can't install or boot anything.
- **linuxjourney.com.** The best answer for a true newcomer starting from zero. Not tied to any distro. Structured like a course: what is Linux, what is the kernel, how does the filesystem work, in plain language.
- **The Gentoo Handbook.** Even if you never install Gentoo, reading through it teaches you how a Linux system is actually assembled. Partitioning, filesystems, kernel compilation, init systems. Educational.
- **The Arch Wiki.** Your permanent reference. You'll use it for the rest of your Linux life regardless of what distro you run.
- **The Linux Documentation Project (tldp.org).** Dated in places, but guides like the Linux System Administrator's Guide still hold up conceptually.
- **kernel.org documentation.** For when you're past intermediate and want to understand the kernel itself.
- **man pages.** Built into every Linux system. Underused by beginners. Learning to read `man` pages well is a skill in its own right.

A reasonable order: linuxjourney → Shotts → Ward → Gentoo Handbook (read, don't necessarily install) → Nemeth → then branch into whichever direction your work takes you (sysadmin, programming, kernel). The Arch Wiki becomes a constant companion from roughly step three onward.

No amount of reading replaces breaking things and fixing them yourself. Books give you the mental model. Websites help you apply it. But the final teacher is the terminal.