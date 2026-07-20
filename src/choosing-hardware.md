# Choosing Hardware for Linux in 2026

What to put Linux on. Three sovereignty tiers — desktop you built, Linux-friendly laptop, phone with a keyboard — with a clear nudge away from Macs in any tier. Companion to the OS guide; updated as things change.

## TL;DR

If you already own a working PC that isn't a Mac, install Linux on it and stop reading. This document is for the case where you are actually buying.

Three tiers, ordered by sovereignty and by my recommendation strength:

1. **A desktop you built from parts.** Most sovereign hardware available at consumer prices. AMD Ryzen, AMD Radeon GPU, Intel Wi-Fi card, ECC RAM if the budget allows. No vendor in the firmware chain you didn't put there yourself. The boring-correct pick if you have a desk.
2. **Framework 13/16, current ThinkPad (X1 Carbon Gen 14, T14 Gen 7, T16 Gen 5), or a refurbished X230/T480 with Libreboot.** The practical sovereign-laptop tier. Framework for modularity (swap the mainboard to upgrade the CPU generation). Current ThinkPad T-series now matches Framework on iFixit's repairability score (10/10 at MWC 2026)[^thinkpad-mwc] while remaining the keyboard and battery-life champion. Refurbished X230/T480 if you want open boot firmware and don't mind a 2012/2018 machine.
3. **Pixel 8 or newer plus USB-C dock plus external display, running GrapheneOS with its experimental desktop mode.** Android 16's polished Desktop Mode (shipped with the March 2026 Pixel Feature Drop as part of QPR3, built on Samsung DeX's foundations per Google's I/O 2025 announcement)[^android16-desktop] is on stock Pixel today; GrapheneOS users get experimental desktop mode usable now with the same hardware path, and the stable version is expected via Android 17 release uplift[^grapheneos-desktop]. PostmarketOS on a Pixel, plus the dedicated Linux phones (PinePhone Pro, Librem 5), are more radical paths and are not daily-driver-ready in 2026.

Do not buy a MacBook to install Linux on. Asahi Linux work covers M1/M2 well, but M3 boots without a working GPU, M4 development stalled after Apple's architecture changes broke the project's reverse-engineering tooling, M5 bring-up just started, and the project founder left in early 2025 over kernel-upstreaming politics[^asahi-state][^asahi-martin]. You'd be paying Apple's hardware margin for a machine optimized for an OS you intend to replace, then chasing a target Apple's silicon team does not want you to hit.

Do not buy a Mac for general computing if sovereignty is the question this document is trying to answer. The companion piece `os.md` covers when keeping a Mac for one specialized workflow (video, audio, Adobe) is a reasonable concession; that concession does not extend to "buy a new Mac for general computing."


## How this fits with the OS guide

The OS guide (`os.md`) is upstream of this one. Pick a distro first; pick hardware to match. Most readers already have a working PC and the question "what to put Linux on" is answered by "the machine you already own, unless it's a Mac." This document is for the case where you are actually buying.

The sovereignty axis used here is the same one the OS guide uses: the question is not "which vendor is best" but "which vendor is in the conversation forever, and on what terms." Apple expects to be in the conversation forever and dictates the terms. Microsoft is increasingly putting itself in the conversation through firmware (Pluton's integration into AMD Ryzen 6000+ and selected Intel chips, pushed through Windows-certified OEM hardware). Google, on Pixel hardware, sells you the device and then leaves the software conversation entirely if you install GrapheneOS. The vendors who sell explicitly for Linux (Framework, System76, Tuxedo, Star Labs, Purism) sit lower on the vendor-presence axis. The desktop you built yourself, from commodity parts, sits lowest.


## Tier 1: A desktop you built from parts

A self-assembled desktop is the most sovereign general-purpose computer you can own in 2026 short of exotica. Every component is commoditized; you can replace any single piece without replacing the rest; nothing on the board expects an OEM telemetry pipeline.

**CPU.** AMD Ryzen (7000-series Zen 4, 9000-series Zen 5) over Intel for Linux in 2026. AMD's PSP (Platform Security Processor) is no better than Intel's ME at the firmware-blob layer — both are closed-source coprocessors with their own privileged execution environments — so don't pick AMD for that reason. Pick it because the kernel-side support story is cleaner: Ryzen's Linux performance, idle power, and scheduler interactions track upstream tightly, while Intel's E-core/P-core hybrid scheduling has had multiple regressions on mainline kernels. AMD Ryzen also makes ECC RAM accessible at consumer prices (covered below).

**GPU.** AMD Radeon over Nvidia for any machine that runs a Linux desktop. The open-source `amdgpu` driver is in mainline, Wayland-native, handles HDR/VRR/FreeSync, suspends and resumes correctly, and has zero out-of-tree dependencies. Nvidia's situation has improved (GSP firmware lets the open `nouveau` driver work for non-gaming use, and Nvidia's proprietary driver has gained Wayland support), but you are still chasing a moving target where the open and closed drivers behave differently, Wayland sessions have subtle issues, and suspend remains unreliable. Exception: if you do ML/CUDA work, Nvidia remains the practical pick despite the friction, and a second small AMD machine becomes the general-computing answer.

**Wi-Fi and Bluetooth.** Intel AX2xx-series cards (AX210, AX211, BE200) work mainline-out-of-box with nothing beyond `linux-firmware`. MediaTek MT7921/MT7922 are the second pick. Avoid Realtek and Broadcom — driver support ranges from "binary blob from the vendor that breaks every kernel" to "no support at all." On a desktop you can always swap the card; a single bad pick is not catastrophic.

**RAM.** ECC if the budget allows. The argument is not theoretical cosmic-ray bit-flips; the argument is that ECC modules are paired with more conservative validation and chip binning, so they fail less often even when ECC correction is not actively kicking in. AMD Ryzen plus an ASRock/ASUS Pro motherboard is the cheap path to ECC at consumer prices; on Intel you're paying Xeon tax for the same feature.

**Storage.** NVMe over SATA. Boring brand names with mature Linux support — Samsung 9xx Pro, WD SN850X, Crucial T700 — over budget controllers with intermittent NVMe-disconnect issues under heavy I/O.

**Case, PSU, motherboard.** Boring. Fractal, Corsair, BeQuiet, Seasonic. The boring choice is the right choice.

**What this tier dominates.** No proprietary EC firmware running parallel to the OS. No fingerprint reader or webcam talking to a Windows-only driver you'll have to fight. Every component is replaceable. The OS install is the only software that touches the hardware. That's the whole pitch.

What this tier costs you: portability. If you cannot accept a desktop in your home or office, skip to Tier 2.


## Tier 2: Laptops

In rough sovereignty order. One note before the picks: the "Linux-certified" Dell XPS / HP / Lenovo Linux SKUs from major OEMs exist, the certification is real, the hardware works — but you're still buying from a vendor whose primary business is shipping Windows machines with vendor telemetry baked into the firmware, and the Linux SKU is a side product. The dedicated-Linux vendors below are competitive on price and better aligned on incentives.

### Framework — primary recommendation

Framework 13 and Framework 16 are the most modular mainstream x86 laptops available in 2026. The motherboard is socketed; you can swap CPU generations without buying a new laptop. The ports are modular expansion cards; you choose USB-A/USB-C/HDMI/DisplayPort/MicroSD/storage per slot. Every internal part is sold individually with public service manuals. The April 2026 Panther Lake release shipped with explicit Linux support, including Fedora and Ubuntu OEM images.

What it does well: Linux compatibility is excellent and vendor-tested before release. Battery life on the current AMD Ryzen Framework 13 is competitive with current ThinkPads. The 16" model accepts a discrete GPU expansion bay if you want gaming or ML on a portable.

What it does less well: per-unit cost is higher than a comparable ThinkPad. The hinge on the earliest Framework 13 generations was a weak point (fixed in current units; check before buying refurbished). The 16" model is bulky for its screen size. The keyboard is good, not great — the ThinkPad X1 Carbon remains better.

On repairability scoring: iFixit gave the current Lenovo T14 Gen 7 and T16 Gen 5 the same 10/10 rating Framework has held for years[^thinkpad-mwc]. iFixit measures whether parts are accessible and replaceable. It does not measure whether you can swap the mainboard for a CPU generation upgrade or whether the ports themselves are user-configurable. Framework still wins on those two dimensions; the generic "most repairable" claim now has competition.

The political flag: GNOME-side commentators have called Framework everything from "supports Fascist and Racist s***heads" (GNOME OS Team, October 2025) to "Nazibook 13 pro" (GNOME contributor Jordan Petridis, April 2026, on Mastodon), after Framework's continued partnership with DHH (David Heinemeier Hansson) on his Omarchy distribution and its sponsorship of Hyprland. The OS guide treats this pattern as a community-politics flag for GNOME, not for Framework; from the capture-risk frame the same pattern reads as inadvertent endorsement of Framework, since the actors attacking it are the ones most willing to weaponize CoC enforcement against engineering work they oppose politically. See `os.md` → "GNOME's political turn and the Code of Conduct asymmetry" for the full chronology and primary sources.

### Current ThinkPad T-series and X-series

The 2026 generation refresh landed at MWC 2026 in early March: ThinkPad X1 Carbon Gen 14 (Panther Lake)[^thinkpad-x1c], T14 Gen 7, T16 Gen 5, and T14s Gen 7[^thinkpad-mwc]. T14 Gen 7 and T16 Gen 5 both ship with Intel Core Ultra Series 3 (vPro) or AMD Ryzen AI Pro 400 Series options, larger speakers, an optional 5MP camera, and iFixit's 10/10 repairability rating. Lenovo officially supports Linux on most current ThinkPad SKUs (Ubuntu and Fedora are tested upstream). The keyboard is the best in the laptop industry. Fingerprint readers, webcams, and Thunderbolt work mainline on most current generations.

The flag worth naming: Lenovo is Chinese-owned (Beijing-headquartered, listed on the Hong Kong exchange), and the supply-chain argument that applies to any vendor with a national-government overlay applies here. For a single-machine threat model where state-level interest in your hardware is implausible, this is moot. For a higher-stakes threat model, it is one of the inputs.

### Refurbished ThinkPad X230 or T480 with Libreboot

The sovereignty-maximalist laptop path. Both the X230 (2012, Ivy Bridge) and the T480 (2018, Coffee Lake) have full Libreboot ports as of recent releases:

- X230 has been a Libreboot staple for years.
- T480/T480s support was implemented by Mate Kukri and landed in Libreboot 20241206 (December 2024)[^libreboot-t480]; Libreboot 26.01 (30 January 2026) refined it further with headphone-jack detection fixes[^libreboot-2601]. Thunderbolt support landed in 26.01 RC1 but was pulled before the stable release after S3-resume regressions on some units; expect that to return in a later release.

Both machines use `me_cleaner` to neuter Intel ME to the legal minimum; the X230 with Libreboot additionally uses `deguard` to handle ME configuration, and the T480 port uses the same `deguard` rewrite that now supports both boards.

What you get: a laptop whose boot firmware is open, auditable, and built from source you can read.

What you give up: it's a 2012 or 2018 laptop with the hardware ceilings of those years. On the X230, the original BIOS whitelists which Wi-Fi cards will boot; Libreboot removes the whitelist, so you can drop in a current AX210 card. The T480 has no Wi-Fi whitelist to begin with. Batteries on units this old will need replacement; community vendors still sell fresh cells.

Pick this if your threat model specifically includes "the firmware on the laptop matters and I want to verify it." For most readers, the current ThinkPad above does the same job at much higher performance for similar money.

### System76

US-based hardware company in Denver, ships Pop!_OS preinstalled, runs `system76-firmware` on most current models, funds the COSMIC desktop. The hardware itself is rebranded Clevo/Sager whitebooks (true of most boutique Linux vendors), but the firmware customization is real.

What it does well: ships with Linux configured correctly, the company is actively in the Linux conversation, NVIDIA driver integration is the smoothest of any vendor.

What it does less well: Pop!_OS is Ubuntu-based and the OS guide currently recommends against a fresh Pop!_OS install while COSMIC is alpha/beta. The hardware ranges from "good" to "fine" but doesn't reach Framework's modularity or ThinkPad's keyboard quality.

### Tuxedo Computers and Star Labs

Tuxedo Computers (German) and Star Labs (British) ship Linux preinstalled. Tuxedo offers the broader range, including AMD configurations. Star Labs makes a smaller line — StarBook, StarLite, StarFighter — and has done public work on opening their firmware (partial coreboot ports on some models). Both are smaller companies; warranty and resale logistics favor EU buyers.

Pick if: you're in the EU and want a vendor in your jurisdiction, or you specifically value Star Labs' open-firmware work.

### Purism Librem 14

The most libre laptop available, sold by the most politically explicit vendor. PureBoot firmware (Coreboot plus Heads), hardware kill switches for camera/microphone and Wi-Fi/Bluetooth, designed around the FSF's free-as-in-freedom criteria.

What it does well: the political posture you're paying for is real, not marketing — the kill switches break the circuit physically, the firmware is auditable, PureBoot uses a YubiKey for tamper-evident attestation.

What it does less well: performance is a generation behind, the company has had fulfillment delays (the Librem 5 phone took years to ship after the campaign closed), and the per-unit price is high relative to specs.

Pick this if sovereignty matters to you to the point that "every component must be replaceable and every blob removable" is the floor.

### NitroPad (Heads-flashed ThinkPad from Nitrokey)

The pre-flashed-with-Heads option. Nitrokey (German, open-firmware hardware-token vendor; see `privacy-setup.md`) sells refurbished ThinkPads — currently the X230, T430, and X1 Carbon — with Heads coreboot pre-installed and a Nitrokey USB token paired to the laptop for verified-boot attestation. The pairing is the value-add: at each boot, Heads measures the boot chain, computes an HMAC, and lights a green-or-red LED on the paired Nitrokey indicating whether the measurement matches what was last enrolled. Tamper produces a red LED before you type your passphrase.

What it does well: gets you a working Heads/coreboot machine without flashing it yourself. Flashing Heads requires SOIC clips, an external programmer (Raspberry Pi or similar), and the time to follow the (long) procedure correctly the first time. NitroPad pays for that work plus the QA. Comes with the verified-boot-token integration ready to use.

What it does less well: you're paying for a used ThinkPad plus Heads-flashing-as-a-service. The hardware is old (xx30 generation is 2012-2013); current Heads-compatible hardware doesn't include modern chips. Indian shipping plus import duty roughly doubles the EU street price.

Pick this if you want Heads/coreboot working today, don't want to do the flashing yourself, and the X230/T430/X1 Carbon performance envelope is enough for your work. Order at `nitrokey.com/nitropad`.

### Dasharo-supported hardware (the modern coreboot frontier)

For users who want coreboot on current-generation hardware rather than xx30-generation ThinkPads, Dasharo (Polish, 3mdeb) is the active modern coreboot distribution. Supported hardware as of 2026: NovaCustom laptops (NV4x, NV41 series), MSI desktop boards (the PRO Z690-A series and selected newer models), Protectli vault hardware, several Raptor Computing boards.

Dasharo is positioned differently from Heads: Heads is a Coreboot payload focused on tamper-detection-via-TPM-attestation; Dasharo is a coreboot distribution-with-firmware-stack that may or may not use Heads as a payload. Dasharo-with-Heads is supported on some boards (the NovaCustom NV4x lineup specifically). For users who want the "open firmware on current hardware" property, Dasharo is the only meaningful answer; Purism Librem and System76 are the alternatives but more vertically integrated (you buy from them or you don't).

Pick Dasharo-supported hardware if you're at Tier 1 (built-it-yourself desktop) and want coreboot from a vendor whose only business is the firmware. Documentation at `dasharo.com`.

### The MacBook trap

Don't buy a MacBook to install Linux on. Asahi Linux's situation in 2026 is roughly:

- M1 and M2 are well supported via Fedora Asahi Remix 43, which shipped 18 March 2026 with 120Hz display and M2 Pro/Max microphone fixes. Apple Silicon Mac Pro support landed in this release[^asahi-fedora-43].
- M3 boots but the GPU does not work and KDE runs in software rendering (LLVMpipe). One driver developer in January 2026 described the state as "ONLY the internal SSD, display, keyboard, and trackpad work"[^asahi-m3].
- M4 development has stalled. Apple's M4 architecture changes broke the project's reverse-engineering tooling (the SPTM-at-GL2 plus MMU-enabled-EL2 changes that Sven Peter described as "rather painful"). A Linux 6.17 regression set the schedule back further[^asahi-state].
- M5 bring-up is in its earliest phase; no public confirmation of basic Linux boot as of early 2026[^asahi-state].
- Hector Martin, the project founder, left in early 2025 over kernel-upstreaming politics — specifically the Rust-in-kernel argument and the difficulty of getting 1000+ downstream patches accepted upstream. The seven-person successor team is focused on upstreaming, not new hardware[^asahi-martin].

Translated: buying a MacBook with the intention of running Linux on it means either buying an M1/M2 used machine where the work is mostly done (the realistic path) or buying an M3+ machine where you're chasing a target Apple is actively making harder to hit. Either way, you've paid Apple's hardware margin for a machine optimized for an OS you're going to replace. Buy a Framework or ThinkPad. They're cheaper, modular, and supported on every distro the OS guide names.


## Tier 3: A phone with a keyboard

The provocative tier. PostmarketOS sits at the OS layer; the Pixel and the dedicated Linux phones sit at the hardware layer. The rungs below are organized by hardware first, with OS options inside each.

### Pixel 8 or newer — the practical hardware

Pixel 8/8a/9/9a/9 Pro/10/10 Pro/10a all support DisplayPort Alt Mode over USB-C; everything before Pixel 8 lacks the hardware. The Pixel 9a at roughly ₹38,000 is the value pick; see `choosing-phone.md` for the device argument.

Hardware setup, common to both OS options below:

- USB-C hub with DisplayPort Alt Mode and HDMI out plus PD passthrough for charging. Anker, Plugable, and UGreen sell working models. Cheap charge-only USB-C cables do not pass video; look for "DisplayPort Alt Mode" or "USB-C 4K" on the spec sheet[^plugable].
- External monitor — 1080p or 1440p in practice; the Pixel can negotiate 4K 60Hz on some configurations but most setups land at 1920x1080 or 2560x1440 today.
- Bluetooth keyboard and mouse, or a USB keyboard/mouse via the hub.

#### Option A: GrapheneOS with experimental desktop mode (practical)

The stable polished Android 16 Desktop Mode (QPR3 baseline, taskbar, freeform windows, multi-monitor support) shipped on stock Pixel with the March 2026 Pixel Feature Drop, built on Samsung DeX's foundations per Google's I/O 2025 confirmation[^android16-desktop][^pixel-march-2026]. GrapheneOS users do not get that polished build immediately: Google's 2026 AOSP cadence means QPR3 features are not flowing downstream to custom AOSP forks the way they used to, and the stable Desktop Mode on GrapheneOS is widely expected to arrive via the Android 17 release uplift[^grapheneos-desktop]. In the meantime, GrapheneOS ships an experimental desktop mode that is usable today with the same USB-C dock plus keyboard plus mouse hardware path[^grapheneos-desktop]. It works; it's not as polished as stock QPR3.

What you get: a real desktop with a taskbar, resizable windowed apps, and the phone screen functioning independently — calls and messages still arrive on the phone display while the desktop session runs on the monitor. Browser with many tabs works. Google Docs, Gmail, Lightroom, and spreadsheets work. Terminal-via-Termux works.

What you don't get: heavy creative work, gaming, or anything that wants discrete GPU power. Some Android apps adapt cleanly to windowed mouse-driven use; some are barely usable in window mode. The trackpad-emulation story is still rough.

The Termux companion: install Termux from F-Droid (the Google Play build is deprecated and stale; F-Droid is the live channel), `pkg install openssh tmux mosh`, ssh out to a real machine, and run your real work there. This combination — Pixel plus GrapheneOS plus Termux plus mosh to a remote desktop or cloud machine — is, for some workflows, a complete substitute for a laptop. Code review, writing, server administration, light scripting, and anything browser-centric all fit comfortably.

This setup is sovereignty-maximal in a specific way: you carry one device that is also your phone; the OS on that device (GrapheneOS) is one of the most hardened consumer OSes shipping; and your actual work lives on a machine you control somewhere else. Loss or seizure of the device costs you the device, not the work.

#### Option B: PostmarketOS on the same Pixel (more radical)

PostmarketOS is Alpine Linux for phones. The current stable release is v25.12 (December 2025); v26.06 is in development[^pmos-current]. As of February 2026, PostmarketOS supports an estimated 723 device models, including the Pixel 3a, OnePlus 6T, Fairphone 4/5, PinePhone, PinePhone Pro, and a long tail of older hardware[^pmos-state]. The strategic shift in 2026 is toward generic mainline kernels — one kernel image bootable across many devices via Device Tree overlays — replacing the per-device kernel-fork model that previously throttled the project's pace[^pmos-state].

What it gives you: real Linux on phone hardware. GNOME Mobile, Phosh, Plasma Mobile, or Sxmo as the desktop. No Android base, no Play Services, no advertising identifier, no vendor analytics. Alpine's `apk` package manager.

What it costs you: app compatibility. Most Android apps run via Waydroid (a container) with caveats; banking apps that require device attestation typically do not work, even with microG. Camera support is uneven (the camera-stack on many mobile SoCs has no mainline driver). Cellular modem support varies by device. Independent coverage in 2026 characterizes the platform as "a credible development target and an increasingly functional enthusiast platform" rather than a daily-driver replacement for Android or iOS[^pmos-state].

Pick this over Option A if: you want full Linux on the phone hardware itself rather than hardened Android, you can tolerate the rough edges, and you're prepared to roll back to GrapheneOS or stock if something doesn't work. For most readers, Option A is the better trade.

### Dedicated Linux phones — PinePhone Pro and Librem 5 (most radical)

The PinePhone Pro (Pine64, approximately $399 base) and Librem 5 (Purism, approximately $799 with current promos) are phones designed for Linux from the ground up. PinePhone Pro runs PostmarketOS, Mobian, or one of several other distros; Librem 5 runs PureOS by default. Both have hardware kill switches for the radios and cameras — a feature no Pixel offers.

What you get: an open Linux mobile device with hardware designed around the open Linux mobile stack. The kill switches are physical circuit breaks, not software toggles.

What you give up: battery life is measured in hours, not days (PinePhone Pro especially is known for 3–5 hours of active use). Camera quality is below 2019 Android-flagship level. Cellular reliability ranges from "fine on common bands" to "intermittent." Purism's fulfillment history is poor (multi-year delays on the original Librem 5 deliveries). Software maturity remains rough enough that long-time users describe both phones with affection-tinged frustration.

Pick this if: hardware kill switches are non-negotiable, the phone is primarily a Linux mobile device rather than a working daily phone, and you have patience for the maturity gap.

For most readers asking "phone as workstation," the Pixel hardware path above is the answer.


## What to avoid

- **Microsoft Surface devices.** Linux runs (the `linux-surface` kernel-fork project exists and is competent), but Microsoft's hardware roadmap does not target you, touch and pen integration are half-supported, and you're paying the Surface premium to fight the platform.
- **Laptops with Nvidia Optimus (discrete GPU plus Intel iGPU switching).** Suspend-resume is unreliable on most Linux configurations, switching the active GPU is fiddly, and battery life suffers. If you need Nvidia, prefer a discrete-only laptop or a desktop.
- **Anything with a vendor-locked bootloader you can't disable.** Most Chromebooks (though the Crostini path exists for those who commit to it), Microsoft Surface laptops with Pluton enforced, and "AI PC" hardware with vendor-mandated NPU firmware running continuously.
- **2-in-1 / tablet hybrids.** Touch support on Linux is competent on GNOME and KDE but worse than on Android, iPadOS, or Windows. If you want a tablet, get an iPad and accept it for what it is, or get a phone with desktop mode (Tier 3 above).

The MacBook case has its own subsection inside Tier 2 (`#the-macbook-trap`) and is not repeated here.


[^thinkpad-mwc]: Engadget, *Lenovo's ThinkPads get a spec bump at MWC 2026*, 1 March 2026: <https://www.engadget.com/computing/laptops/lenovos-thinkpads-get-a-spec-bump-at-mwc-2026-230100419.html>. Confirms ThinkPad T14 Gen 7 and T16 Gen 5 starting at $1,799 with Intel Core Ultra Series 3 (vPro) or AMD Ryzen AI Pro 400 Series CPUs, optional 5MP camera with computer vision/vHDR, larger speakers, and an iFixit 10/10 repairability score. T14s Gen 7 starts at $1,899. Most devices shipping Q2 2026.

[^thinkpad-x1c]: NotebookCheck, *Now available to order in many countries: Panther Lake powered Lenovo ThinkPad X1 Carbon Gen 14 releases*, 9 March 2026: <https://www.notebookcheck.net/Lenovo-releases-new-14-inch-ThinkPad-globally-with-120-Hz-VRR-OLED.1246063.0.html>. X1 Carbon Gen 14 with Intel Panther Lake replaces the Lunar Lake-based Gen 13. Three Thunderbolt 4 ports, 58 Wh battery, optional 120 Hz VRR OLED display. Configurable without an OS at a £50/€60 discount.

[^android16-desktop]: Techlicious, *Turn your Pixel into a PC with the new Desktop Mode*, 26 March 2026: <https://www.techlicious.com/tip/pixel-desktop-mode/>. Plugable, *How to Use Android 16 Desktop Mode with a Pixel Phone and USB-C Hub or Adapter*, knowledge-base article current as of 1 April 2026: <https://kb.plugable.com/how-to-use-android-16-desktop-mode-with-a-pixel-phone-and-usb-c-display-or-hub>. Confirms Desktop Mode requires a Pixel device that supports DisplayPort Alt Mode over USB-C (Pixel 8 series and newer); shipped on stable Android 16 (March 2026 Feature Drop, Android 16 QPR3 baseline); Google confirmed at I/O 2025 the implementation is built on Samsung DeX's foundations.

[^grapheneos-desktop]: PiunikaWeb, *Why GrapheneOS users will have to wait for stable Android 17 to get Google's new desktop mode*, 16 April 2026: <https://piunikaweb.com/2026/04/16/grapheneos-android-17-desktop-mode/>. Explains that QPR3 made the polished desktop session generally available on supported Pixel and Samsung devices, but that Google's 2026 AOSP cadence has slowed downstream propagation to custom OS projects; GrapheneOS already has an experimental desktop mode usable today with USB-C to HDMI/DP setup plus keyboard and mouse, with the stable user-facing option expected when GrapheneOS moves to Android 17.

[^pixel-march-2026]: Droid Life, *2026 March Pixel Update is here, what's in it?*, 3 March 2026: <https://www.droid-life.com/2026/03/03/2026-march-pixel-update-download/>. Records the March 2026 Pixel Feature Drop as both a Feature Drop and the quarterly Android 16 QPR3 update.

[^pmos-state]: SitePoint, *State of Linux Mobile 2026: PostmarketOS & F-Droid Updates*, 27 February 2026: <https://www.sitepoint.com/postmarketos-fdroid-2026-status/>. Source for the "credible development target and an increasingly functional enthusiast platform" characterization and the estimate of ~723 supported device models as of February 2026. Also documents the generic mainline kernel strategy and the postmarketOS 25.06 reorganization of device categories.

[^pmos-current]: postmarketOS, *Install postmarketOS* (current stable version): <https://postmarketos.org/install/>. Confirms v25.12 as current stable; v26.06 in development per the 10 May 2026 update post: <https://postmarketos.org/blog/2026/05/10/pmOS-update-2026-04/>.

[^plugable]: Plugable, *How to Use Android 16 Desktop Mode with a Pixel Phone and USB-C Hub or Adapter*: <https://kb.plugable.com/how-to-use-android-16-desktop-mode-with-a-pixel-phone-and-usb-c-display-or-hub>. Names DisplayPort Alt Mode as the required cable/hub feature and confirms that charge-only USB-C cables will not pass video.

[^libreboot-t480]: Libreboot release notes, *Libreboot 20241206 released! ThinkPad T480 added. Plus U-Boot UEFI on x86. Fixes for OptiPlex 3050 Micro.*, 6 December 2024: <https://libreboot.org/news/libreboot20241206.html>. T480/T480s support implemented by Mate Kukri with testing and hardware logs provided by Leah Rowe; uses Mate's rewritten `deguard` for ME configuration, which now supports the 3050, T480, and T480S with machine-specific configurations. Install procedure: <https://libreboot.org/docs/install/t480.html> — both `me_cleaner` and `deguard` applied; Intel graphics, internal screen, ethernet, USB, WLAN, HDA verbs working.

[^libreboot-2601]: Libreboot release notes, *Libreboot 26.01 RC1 "Tenacious Tomato" released!*, 25 December 2025: <https://libreboot.org/news/libreboot2601rc1.html>. Refinements for T480/T480s including headphone-jack detection (pavucontrol no longer required to switch the port manually). Linuxadictos coverage, *Libreboot 26.01 expands support to HP Pro 3500, Topton X2E N150, ThinkPad T580 and Dell Latitude E7240*, 5 February 2026: <https://en.linuxadictos.com/Libreboot-26.01-expands-support-to-HP-Pro-3500--Topton-X2e-N150--ThinkPad-T580--and-Dell-Latitude-E7240.html>. Documents 26.01 stable on 30 January 2026 and notes that T480/T480s Thunderbolt support was added in RC1 then removed before the final 26.01 release due to S3-resume regressions on some units.

[^asahi-fedora-43]: LinuxTeck, *Fedora Asahi Remix 43 Arrives — And It's The Most Complete Apple Silicon Linux Release To Date*, 19 March 2026: <https://www.linuxteck.com/fedora-asahi-remix-43-apple-silicon/>. Documents 18 March 2026 joint release of Fedora Asahi Remix 43 by the Asahi Linux project and the Fedora community: Mac Pro with Apple Silicon support added; 120Hz display refresh on MacBook Pro; M2 Pro/Max internal microphone fix; RPM 6.0 plus DNF5 packaging.

[^asahi-m3]: AppleInsider, *It's not usable yet but Asahi Linux runs on M3 Macs now*, 27 January 2026: <https://appleinsider.com/articles/26/01/27/its-not-usable-yet-but-asahi-linux-runs-on-m3-macs-now>. Reports Fedora 43 Asahi Remix running on an M3 Mac with KDE Plasma in software rendering (LLVMpipe); contributor IntegralPilot posted the photo. Quote on M3 state ("Basically ONLY the internal SSD, display, keyboard, and trackpad work") attributed to one of the driver creators.

[^asahi-state]: Phoronix, *Asahi Linux Has Experimental Code For DisplayPort, Apple M3/M4/M5 Bring-Up Still Ongoing*, 31 December 2025: <https://www.phoronix.com/news/Asahi-Linux-EOY-2025-CCC>. Coverage of Sven Peter's 39C3 presentation. Documents that M4/M5 changes have broken the existing Asahi Linux reverse-engineering tools, that the display controller and GPU driver remain the biggest pieces not yet upstreamed for M1/M2, and that M4/M5 Linux support is expected to take significant additional time. Original Sven Peter Mastodon post from April 2025 characterizing M4 support as "rather painful" referenced in earlier Phoronix and Apple Insider coverage; SPTM-at-GL2 / MMU-at-EL2 detail from the same post.

[^asahi-martin]: How-To Geek, *Asahi Linux Gets a Reboot, Still Working On M3 & M4 Mac Support*, 13 February 2025: <https://www.howtogeek.com/asahi-linux-reorganization-m3-m4-mac-support/>. Documents Hector Martin's departure from the Asahi Linux project, the seven-person successor team's organizational restructure, and the focus on upstreaming the 1000+ downstream patches before prioritizing new hardware. Quotes Martin on the difficulty of being "in a position to have to upstream code across practically every Linux subsystem, touching drivers of all categories as well as some common code"; also covers the Rust-in-kernel argument as a contributing factor.