# Choosing Networking Tools

How to choose a VPN, mesh, or overlay network in a way that doesn't reintroduce the central trusted third party you were trying to escape. Covers commercial VPNs, self-hosted point-to-point, mesh with central coordinator, coordinator-less mesh, Nostr-rooted mesh, anonymity overlays, censorship-evasion proxies, and off-grid radio mesh.

This doc is the dedicated landscape for the cross-cutting concern that `security-overview.md` opens with its "Tor versus VPN versus self-hosted mesh" section. That section frames the choice at a high level; this doc fills in the rest of the space.

---

## TL;DR

Most readers don't need a VPN at all. HTTPS-everywhere plus encrypted DNS (set up in `devuan-secure-workstation.md`) plus a hardened browser closes most of what commercial VPN marketing claims to solve. The legitimate use cases:

1. Mesh between your own devices over hostile networks: self-hosted WireGuard or Headscale; Tailscale if convenience outweighs the corporate-coordinator capture risk.
2. Anonymity: Tor (or I2P for app-aware use). Commercial VPN is structurally weaker than Tor and not a substitute. Against a global passive adversary (nation-state-scale traffic observation), NYM's mixnet defends where Tor's onion routing doesn't.
3. Bypassing geographic blocks or hostile-ISP restrictions: Mullvad or IVPN; pay in cash or Bitcoin.
4. Active censorship (deep packet inspection, Tor blocking): Tor with pluggable transports and bridges, or censorship-evasion proxies (Shadowsocks, v2ray, Hysteria, Outline).
5. Off-grid communication when the internet is unavailable or untrusted: Reticulum over LoRa, Meshtastic, or Briar's Bluetooth mesh.

Sovereignty-frontier projects to track but not yet deploy as a daily driver: nostr-vpn[^nostr-vpn] plus its underlying FIPS[^fips] mesh protocol. Both alpha-grade in 2026 but architecturally aligned with the Bitcoin / Nostr lens of no-trusted-third-parties.

What this doc is not: a deep-dive into any specific tool's setup. Each entry names the tool's positioning and the capture-risk shape; setup procedures live elsewhere.

---

## The capture-risk frame for networking

Every networking tool answers two architectural questions: what identifies a node, and who coordinates which nodes can talk to each other. The combination of those answers is the tool's threat model.

**Commercial VPNs** answer the first with a company-issued account and the second with a company-operated coordinator. The company holds both your identity and your traffic. The company can be subpoenaed, hacked, acquired, or compelled to log. This is the architecture most "VPN for privacy" marketing sold to people who wanted stronger.

**Self-hosted point-to-point** answers both with cryptographic keys you generated and infrastructure you operate. No company holds anything. The cost is setup and ongoing maintenance.

**Mesh with central coordinator** (Tailscale, NetBird, ZeroTier in their default modes) answers the first with your own cryptographic keys but the second with a company-operated coordinator. The coordinator sees who talks to whom and when (metadata, not content) and can be subpoenaed for that metadata. Headscale and self-hosted NetBird close this by letting you operate the coordinator yourself.

**Coordinator-less mesh** (Yggdrasil, cjdns, Nebula after PKI bootstrap, Innernet after admin signature) answers both with cryptographic identities and a routing protocol that converges without any central party. Hardest to misconfigure into a capture-risk; also hardest to set up.

**Nostr-rooted mesh** (nostr-vpn on top of FIPS) answers the first with a Nostr keypair (the same secp256k1 identity used for Nostr signing and for messaging via the Nostr-rooted apps covered in `choosing-communication-tools.md`) and the second with FIPS's self-organizing mesh routing, with peer discovery and NAT traversal happening over public Nostr relays via gift-wrapped messages. Sovereignty-aligned by construction.

**Anonymity overlays** (Tor, I2P, Lokinet) answer the first with rotating ephemeral identities and the second with volunteer-run relay networks where no single party knows both who you are and what you're doing. **Mixnets** (NYM) go further on the second question, adding cover traffic and timing-mixing so that even a global observer watching the whole network can't correlate flows: the defense onion routing doesn't provide.

**Censorship-evasion proxies** (Shadowsocks, v2ray, Trojan, Hysteria, Outline) answer neither question: they're not privacy tools; they're "make encrypted traffic look like benign TLS so the DPI box doesn't drop it" tools. They live alongside the other tiers and stack on top.

---

## Tier 1: Commercial VPNs

The "trust one company instead of your ISP" tier. Tolerable for narrow use cases (bypassing geographic blocks, hostile-ISP restrictions, traveler-laptop on a hotel network); not a privacy tool.

### Mullvad

Swedish, founded 2009. The most-recommended commercial VPN in privacy circles because of three properties uncommon among peers: account identifiers are 16-digit account numbers with no associated email or phone, payment in cash by mail is supported, and the no-logs claim has held under independent audit and under a 2023 Swedish police raid that retrieved no user data[^mullvad-raid]. Mullvad Browser is the Tor-collaboration project covered in `security-overview.md`.

What you trade: still a single trusted company. The Swedish jurisdiction provides EU data-protection benefits but does not eliminate the structural capture risk any commercial VPN carries.

Pick this if you specifically need a commercial VPN, understand the trust-shift not trust-elimination property, and you're paying in cash or Bitcoin.

### IVPN

Gibraltar-based, similar privacy posture to Mullvad: account numbers not emails, accepts Bitcoin and Monero, regular independent security audits, source-available clients. Smaller server footprint than Mullvad. Pick this as a redundancy second to Mullvad or where Mullvad's server locations don't suit.

### Proton VPN

Swiss, owned by Proton AG (the Proton Mail company). The most-mainstream privacy-marketed commercial VPN. Free tier exists; the free tier's economics depend on paid subscribers, so the free tier is real but limited. Proton AG has a public foundation structure (Proton Foundation, Swiss) governing the parent company.

Flag worth naming: Proton AG drew sustained criticism in 2024 from segments of the privacy community over CEO Andy Yen's public political alignments. This is a community-politics flag, not a technical one, and how much it matters depends on your frame.

### What to avoid

Free commercial VPNs that aren't a free tier of a paid product (NordVPN, ExpressVPN, free apps in mobile stores). The business model that pays for the infrastructure is either logging-and-selling or malware. The "you are the product if it's free" frame applies here particularly cleanly.

---

## Tier 2: Self-hosted point-to-point

The "your own infrastructure, no company in the middle" tier. The right answer for accessing your home network from your laptop, or for connecting two specific machines you own.

### WireGuard

The protocol. Designed by Jason Donenfeld, in-kernel on Linux since 5.6, in-tree on FreeBSD since 13.0, and the foundation that everything in Tier 3 and most of Tier 4 builds on. Configuration is a handful of public/private key pairs and a peer list. Static peer configuration: no coordinator needed if both endpoints have routable addresses.

Userspace implementations exist for cases where the kernel module isn't an option: `wireguard-go` (Go, the reference userspace implementation), `boringtun` (Rust, originally Cloudflare's implementation, used in early nostr-vpn releases before the FIPS data-plane migration). On Linux with a recent kernel, the in-kernel module is the right choice; the userspace implementations matter for iOS sandbox limitations, certain embedded environments, and as building blocks for higher-level tools.

What this gets you: an encrypted tunnel between two endpoints with formally-verified cryptography, near-line-rate throughput, and no third party. What it doesn't give you: NAT traversal when both endpoints are behind NAT, or convenient onboarding of more than a handful of peers. Those are the problems Tier 3 solves.

Pick this for two specific machines you control with at least one having a routable address (your home server plus your laptop; two VPSes in different regions; a colo box plus your office). Configuration via `wg-quick` and `/etc/wireguard/*.conf`; no daemon to run beyond what the kernel provides.

### OpenVPN

The pre-WireGuard incumbent. Still widely deployed; still works. Slower than WireGuard, larger attack surface (TLS-based, lots of options), older crypto stack. Reasons to still use it: a corporate VPN concentrator you don't control still speaks OpenVPN, or you need TCP-mode tunneling for hostile-network reasons (some restrictive networks block UDP). Otherwise use WireGuard.

### SSH tunnels and `sshuttle`

The poor-person's VPN. `ssh -D` opens a SOCKS proxy through any SSH server you can reach; `sshuttle` wraps it so all traffic to a configured subnet transparently routes via SSH. Not a real VPN (no kernel-level integration, no UDP support), but the right answer when all you need is to bounce traffic through a remote host you already have access to. Zero infrastructure beyond an existing SSH server.

---

## Tier 3: Mesh with central coordinator

The "convenience of a managed service, with the privacy properties of WireGuard between peers" tier. Each peer holds its own keys and talks WireGuard (or similar) directly to other peers; a central coordinator handles peer discovery, key distribution, and access policy. The coordinator does not see content but does see metadata (who talked to whom, when, from what IP).

### Tailscale

The category-defining product. WireGuard data plane, proprietary closed-source coordinator. Founded 2019 (David Crawshaw, Avery Pennarun, David Carney), Toronto-based, raised $275M+ across four rounds; Series C of $160M in April 2025[^tailscale-funding]. Acquired Border0 in March 2026. 318 employees as of April 2026[^tailscale-headcount].

Authentication requires a third-party identity provider (Google, Microsoft, GitHub, Apple, Okta) which means signing into your mesh requires signing into a corporate account.

Capture-risk shape: late-stage VC-funded enterprise networking company. The mandatory third-party identity provider authentication is the single largest sovereignty problem. The product is excellent technically; the structural position is the opposite of sovereignty-aligned. Pivoting toward AI-agent governance and enterprise data-residency as of 2026[^tailscale-ai-pivot], which is the direction late-stage networking startups go when looking for exits.

Pick this only if convenience genuinely outweighs the capture-risk, you're using it for mesh between machines you control rather than for any privacy property, and you understand you're authenticating through Google or Microsoft.

### Headscale

Open-source reimplementation of Tailscale's control server, started by Juan Font[^headscale]. Talks the same protocol the official Tailscale clients use, so you keep the Tailscale client UX while running the coordinator yourself. Active development; v0.26.x current as of early 2026. Pairs well with Headplane (open-source web UI) since Headscale itself ships only the daemon.

This is the sovereignty-aligned migration path off Tailscale that keeps the operational experience intact. Pick this if you already use Tailscale clients across devices and want to move the coordinator under your control without retraining users.

What you trade: you run the coordinator (a small Go binary plus Postgres or SQLite); you maintain compatibility with Tailscale client releases. Tailscale Funnel, Tailscale Serve, and some MDM features are Tailscale-proprietary and don't work with Headscale.

### NetBird

Fully open-source mesh VPN (Apache 2.0), Berlin-based, founded 2021. Both client and management server are open source. SSO via standard identity providers (Keycloak, Authentik, Okta, Auth0); first-class DNS management; access policies and groups built in[^netbird]. Available as a cloud-hosted service from NetBird the company, or fully self-hostable in production.

Capture-risk shape: same as Tailscale architecturally if you use their hosted service, but with the escape hatch that self-hosting is fully supported and well-documented. Smaller company, earlier-stage, less VC pressure than Tailscale.

Pick this if you want a Tailscale-equivalent built from the ground up as open source, with a self-hosted-or-cloud choice you can flip later. Currently the best one-stop answer in Tier 3 for users who don't already have Tailscale clients deployed.

### ZeroTier

Open-source clients (BSL 1.1 license), commercial coordinator service operated by ZeroTier Inc. (Irvine, California). Self-hostable controller exists (`my-zerotier-controller`) but is less polished than the hosted service. Older than Tailscale by several years; uses its own protocol rather than WireGuard.

Capture-risk shape: closer to Tailscale than to NetBird because the self-hosting story is workable but not the primary path. The BSL license on clients is a yellow flag (BSL is source-available, not OSI-approved free software).

Pick this only if you specifically need ZeroTier's older Layer-2 emulation (it can bridge Ethernet broadcast domains in a way WireGuard-based mesh can't) for a use case like running legacy multicast-dependent protocols across sites.

### Others worth knowing

The Tier 3 class has more entrants than the four above; these are the architectural classes worth naming, and the rest mostly recombine the same trade-offs. Briefly, for completeness: Firezone (WireGuard-based, open-source, self-hostable, policy-driven access), Netmaker (WireGuard mesh with a self-hostable control plane, kernel-WireGuard performance focus), OpenZiti (zero-trust overlay with application-embedded networking rather than host-level tunnels), Defguard (open-source WireGuard with enterprise SSO and MFA), and Twingate (closed-source zero-trust access, commercial, the most Tailscale-like in positioning). These are commercial-backed startups for the most part; expect some to be acquired or to pivot. Evaluate any of them against the same two questions the capture-risk frame poses: who holds the identity, and who operates the coordinator. If the answer to the second is "a company, with no self-hosting path," it's a Tier 1 risk shape wearing Tier 3 clothes.

---

## Tier 4: Coordinator-less mesh

The "after bootstrap, no central party exists" tier. The setup step is heavier (you generate certificates or signed configurations once); the running mesh has no coordinator that could be compelled to produce logs.

### Nebula

Open-source mesh built at Slack and open-sourced in 2019; the original authors (Nate Brown and Ryan Huber) left Slack in 2020 to found Defined Networking, which now maintains Nebula and sells a managed Nebula-based product. The open-source project itself remains independent.

PKI-based: you stand up a certificate authority once, sign peer certificates with it, and after that peers authenticate to each other using the CA's signature. No coordinator runs continuously; "lighthouses" exist to help peers find each other across NAT but hold no authority, any peer can be a lighthouse. UDP-based, kernel-bypass userspace networking via tun/tap.

Slack-to-Salesforce note: Slack was acquired by Salesforce in 2021; Nebula itself predates that acquisition and the maintainers spun out a year before it closed. The Nebula codebase has no Salesforce dependency.

Pick this if you're operating a fleet (dozens to thousands of machines) and want PKI-style host-to-host authentication without an always-on coordinator. Heavier ops burden than Tailscale-style products; pays off at scale.

### Innernet

Rust-based mesh from `tonarino`, MIT licensed. CIDR-based organization rather than flat-list-of-peers: a network is a CIDR, sub-CIDRs are sub-networks, hosts get IPs within their CIDR. Admin-signed peer invitations bootstrap new nodes; after bootstrap there's no coordinator. Quieter project than the others in this tier; not enterprise-targeted.

Pick this if the CIDR-based mental model fits your use case (it does for some homelab configurations) and you want a smaller, more focused codebase than Nebula.

### Yggdrasil

End-to-end encrypted IPv6 overlay network. Tree-based routing with public-key-derived addresses (your IPv6 address is a hash of your Yggdrasil public key). Can operate as a public global network (the default, anyone running Yggdrasil can reach anyone else), as a private mesh (filter peer connections to specific keys), or layered (private mesh peered with the public network).

Mature: development since 2017, current 0.5.x series, in Debian and Devuan repositories, kernel module supported via the `yggdrasil-go` userspace daemon.

Pick this for: a private IPv6 overlay between machines without setting up your own CA or coordinator (you exchange public keys with peers and that's it); a fallback identity-routed network during real-internet disruptions; an experimental sovereignty overlay that interoperates with a public mesh.

### cjdns

The Hyperboria project's network protocol. End-to-end encrypted IPv6, source-routed (each packet carries its path), keypair-derived addresses similar to Yggdrasil. Older than Yggdrasil (2011 onward); smaller deployment today but the design influenced Yggdrasil heavily.

Pick this if you specifically want to connect to Hyperboria or you have a use case where source-routing is the right primitive. For most readers, Yggdrasil is the more practical answer in the same shape.

---

## Tier 5: Nostr-rooted mesh (sovereignty frontier)

The newest entry in the landscape. Two projects, two authors; this section names the distinction because secondary commentary tends to conflate them.

### FIPS (Free Internetworking Peering System)

The underlying mesh networking protocol, built by `jcorgan` (jmcorgan on GitHub)[^fips]. Rust, MIT licensed. Uses Nostr secp256k1 keypairs as node identities (your `npub` is your network address; `node_addr` is a SHA-256 hash for routing). Designed to operate over any transport, UDP overlay on the existing internet today, with Ethernet, Bluetooth, Tor, and serial transports as design targets. Tor transport support landed in v0.2.0 (March 2026)[^fips-v020].

Architecture in one sentence: a self-organizing encrypted mesh where nodes establish peer connections, authenticate each other via Nostr keys, and route traffic for each other without any central authority or global topology knowledge. End-to-end encrypted between any two nodes regardless of hop count, with re-encryption at every hop.

Status: v0.1.0 alpha as of self-description, v0.2.0 current. The author's framing is direct: "if it breaks, you get to keep both pieces." Passed simulation testing and small-scale deployments; not production-stable.

Note on the acronym: clashes with the well-known U.S. cryptographic-standard FIPS, which has drawn public criticism[^fips-acronym]. Worth knowing if you reference the project in your own writing.

### nostr-vpn

Tailscale-style mesh VPN application built by Martti Malmi (`mmalmi`)[^nostr-vpn], the Bitcoin developer who worked alongside Satoshi in 2009-2011 and received the first Bitcoin transaction. Uses FIPS as its data plane per the current README. Earlier releases (v0.2.x in March 2026) used WireGuard tunnels via `boringtun` with Nostr relays for signaling; the architecture migrated to FIPS-backed during the version-4 series, with v4.x current as of late May 2026 and rapid iteration ongoing (the project has been shipping multiple releases per week through the v4 series, so any specific version number in this doc should be assumed stale by the time you read it; check the GitHub releases page).

Authorship-split: Malmi built the user-facing nostr-vpn application. FIPS (which the secondary commentary tends to credit to "Bitcoin developer Malmi") was built by jcorgan, who is a separate person. Both are sovereignty-aligned developers; only one of them is the Satoshi-era figure.

What the May 2026 v4 release line added (Malmi's announcement, May 19): native multiplatform desktop apps (macOS, Linux, Windows), Android app, Nostr-based multihop routing for when NAT holepunching fails, improved network management UX, FIPS as the unified data plane. Shipped 11 releases in seven days from v0.2.2 through v0.2.13 in March; the v4 series followed in April-May with ongoing rapid iteration. Production-grade nowhere near.

What's worth picking up today: read the README, run it between two machines you control, learn the model, contribute back. What's not worth picking up today: replacing your daily mesh setup with it. The right time to migrate is when FIPS leaves alpha and nostr-vpn settles a release cadence longer than days.

Capture-risk shape: zero by construction if the implementation is correct. Your identity is a keypair you generated; coordination happens over a set of Nostr relays you can choose, run, or rotate; routing happens through other FIPS nodes that authenticate each other via Nostr keys. No company exists in the protocol's threat model.

Why it matters now even though it's not deployable yet: the design is the proof-of-concept for the sovereignty frame applied to networking infrastructure, the same way Bitcoin was the proof-of-concept for the sovereignty frame applied to money. The architecture is what to learn from. The bits work today; the polish doesn't.

Adjacent sovereignty stack: the Nostr-rooted ecosystem these tools sit in extends beyond networking. White Noise (`choosing-communication-tools.md`) is the messaging-layer counterpart, using MLS encryption over Nostr signaling via the Marmot protocol. Blossom is the Nostr-native file-hosting standard that Marmot uses for media transport. The shared infrastructure (Nostr relays, secp256k1 keypairs, Bitcoin-community-funded development) is one of the project's sovereignty-frontier signals to watch.

### Adjacent frontier: the Holepunch/Pear stack

Not Nostr-rooted, and not a transport.
This note is parked in Tier 5 as a sovereignty-frontier signal to follow, alongside the Nostr-rooted stack above, until the project has a dedicated file-sharing doc to house it.

PearDrive is a peer-to-peer file-sharing and storage tool built on the Pear Runtime, the same Holepunch P2P stack that powers Keet.[^peardrive][^pear-runtime]
You create or join a "network" with a shared network key, then upload files and pull them directly from connected peers, with peer identities surfaced as public keys and network access shareable by QR code.[^peardrive-cli]
An archive mode turns a node into a full replica that stores every file on the network, the project's answer to availability when the original uploader goes offline.[^peardrive-cli]

Substrate and funding shape: Pear Runtime is open-source infrastructure (the Hypercore family: Hyperswarm, HyperDHT, Hyperdrive) created by Holepunch, a company funded by Tether and Bitfinex, with Tether's Paolo Ardoino as a co-founder and the project framed in explicitly Bitcoin terms.[^pear-runtime][^holepunch-launch]
In this project's lens that is a double signal: Bitcoin-aligned capital behind genuinely no-server infrastructure on one side, a single dominant corporate sponsor behind the runtime on the other, which is a concentration risk the volunteer-relay and grant-funded models elsewhere in this doc do not carry.
PearDrive itself is published under its own AGPL-3.0 JavaScript repository (the `peardrive` GitHub org), separate from Holepunch's own apps, so it inherits the substrate's funding shape without being a Holepunch in-house product.[^peardrive-cli]

Status: a pre-beta proof of concept by its authors' own account.[^peardrive]
The CLI carries a v4.x tag, but its own README still flags network deletion as unimplemented and file-change syncing as not working until a later PearDriveCore release, so this is a thing to read, run, and learn from, not to entrust files to.[^peardrive-cli]
Name-collision caveat for anyone citing it: this is PearDrive (peardrive.com, Pear/Holepunch stack), distinct from the older and unrelated PeerDrive (peerdrive.org), an alpha-stage Erlang distributed filesystem.[^peerdrive-erlang]
Revisit when it reaches a tagged beta and file-change sync lands.

---

## Tier 6: Anonymity overlays

Different goal from everything above. Tier 1 through 5 are "encrypt the link"; this tier is "hide who you are." Cross-referenced from `security-overview.md`'s "Tor versus VPN versus self-hosted mesh" section.

### Tor

Three-hop volunteer-run onion network. Your guard node knows who you are but not what you do; the middle relay knows neither; the exit knows what you do but not who you are. Deanonymization requires controlling or observing both the guard and the exit, which is exponentially harder than compromising a single VPN.

This is the right answer for anonymity. Slow (three hops globally), incompatible with sites that block Tor exits (Cloudflare-protected sites in particular). Run it via Tor Browser for sensitive browsing or via Whonix for whole-system anonymity (see `os.md` and the Whonix VM-compartmentalization section of `devuan-secure-workstation.md`).

Tor is not a substitute for the mesh tiers above. Tor anonymizes you from destinations; it does not connect your laptop to your home server.

**Onion services as a hosting primitive.** Beyond using Tor as a client, you can publish a service on Tor that's reachable only through Tor. Onion services (v3, ed25519-based, 56-character addresses ending in `.onion`) provide end-to-end encryption to the service plus location-hiding for the host. Use cases: SSH access to a home server without exposing a public IP; private file sharing (OnionShare); whistleblowing intake (SecureDrop, GlobaLeaks). The hosting primitive is the same architecture the anonymity uses, applied in reverse.

**Bridges and pluggable transports for blocked networks.** When your ISP or country blocks Tor directly, the project provides two layers of evasion. Bridges are unlisted Tor relays not published in the public directory; the censor doesn't know to block them. Pluggable transports obfuscate Tor traffic to look like something else:

- **obfs4.** The workhorse. Disguises Tor traffic as random bytes, frustrating naive DPI.
- **Meek.** Tunnels Tor through major CDN services (currently meek-azure via Azure). The censor sees you talking to Azure; blocking Azure breaks half the internet. Slower than obfs4 due to CDN routing.
- **Snowflake.** Routes Tor traffic through ephemeral browser-based volunteer proxies (Chrome and Firefox users running the Snowflake extension act as proxies). Each connection looks like ordinary WebRTC traffic. The censor would have to block WebRTC to block Snowflake, which is collateral-damage-heavy.

Pick obfs4 by default; Snowflake when obfs4 is blocked too; Meek when both are blocked. The Tor Browser ships all three; selection is a settings choice.

### I2P

Application-aware anonymity overlay. Where Tor exits to the regular internet, I2P is mostly an internal network with its own services (eepsites, IRC, BitTorrent over I2P). The threat model is similar to Tor's but the use cases differ: Tor is "be anonymous on the regular web"; I2P is "participate in an anonymous internal network."

Pick I2P if you specifically need to participate in I2P-internal services. For anonymous regular-web browsing, Tor is the practical answer.

### Lokinet

Onion-routing overlay developed by the Loki Project (now Oxen). Architecturally similar to Tor in being a hidden-service network but using its own service-node infrastructure rather than Tor's volunteer network. Used as the transport for Session messenger (see `choosing-communication-tools.md`) and as a standalone anonymity overlay.

Capture-risk shape: token-economic incentive structure for service nodes (Oxen token), a flag for some sovereignty-minded operators who prefer the volunteer-funding model Tor uses. Smaller network than Tor by orders of magnitude, which has both privacy and reliability implications.

Pick Lokinet if: you're already on Session and want to use the same network for general traffic, or you specifically want an alternative anonymity overlay to Tor for diversity reasons. Otherwise Tor is the more practical answer.

### NYM (NymVPN)

The mixnet entry, architecturally distinct from everything else in this tier. Tor, I2P, and Lokinet are onion-routing networks: they hide who-talks-to-whom by relaying through unrelated hops, but a global passive adversary who can observe the whole network's traffic timing can still correlate flows. NYM defends against exactly that adversary by being a mixnet: it adds cover traffic (dummy messages that carry no payload) and mixes traffic timing at each hop, so the timing-correlation attack that works against Tor doesn't work against NYM[^nym].

Built by Nym Technologies S.A. (Swiss), based on the Loopix mixnet design; Chief Scientist Claudia Diaz was formerly a tenured professor at KU Leuven and is one of the better-known academic figures in mixnet and network-privacy research. The architecture descends from peer-reviewed mixnet literature rather than from a startup's whiteboard, which is the durability signal worth naming.

NymVPN (the client) offers two modes. Anonymous Mode routes through a 5-hop Sphinx-based mixnet with continuous cover traffic (the strong-anonymity, higher-latency mode), recommended for messaging, crypto transactions, and email rather than streaming. Fast Mode is a 2-hop WireGuard path (running AmneziaWG, the same DPI-obfuscated WireGuard fork covered in Tier 7) for VPN-comparable speed when you want IP-hiding without the full mixnet latency cost. Rust, open source (GPL-3), clients for Linux, macOS, Windows, iOS, Android. Anonymous onboarding via 24-word access keys; payment in BTC or XMR. v2026.4 (March 2026) added desktop ad/tracker blocking.

Capture-risk shape: the mixnet itself is decentralized with no single operator that sees the whole topology. The flag worth naming is the NYM utility token, service nodes are incentivized via a token economy (bond-and-delegate-stake model), which is the same token-economic structure flagged for Lokinet and which some sovereignty-minded operators weigh against the volunteer-funded Tor model. Whether token incentives or volunteer incentives produce a more durable network is a genuinely open question; NYM is the most serious current bet on the token-incentivized side.

Pick NYM if: your threat model includes a global passive adversary (the nation-state-scale observer that can watch traffic across the whole network), which is the specific case Tor doesn't fully defend against. Use Anonymous Mode for the high-value low-bandwidth traffic that case implies. For ordinary anonymity against a non-global adversary, Tor remains the larger, more battle-tested network; NYM's advantage is specifically the metadata-timing defense against the strongest adversary class.

---

## Tier 7: Censorship-evasion proxies

Not VPNs and not anonymity overlays, these are protocol-obfuscation tools designed to make encrypted traffic survive deep packet inspection. They stack on top of the other tiers: you might run WireGuard inside Shadowsocks inside a TLS tunnel to bypass a censor that blocks WireGuard's UDP signature.

The threat model: a censor (state-level or corporate) running DPI on egress traffic to identify and block "circumvention tools." The defense: make your traffic look like ordinary HTTPS or QUIC so the DPI signature doesn't fire.

### Shadowsocks

Originally developed inside China in 2012 to circumvent the Great Firewall. Lightweight SOCKS5 proxy with encrypted transport; later versions (Shadowsocks 2022, AEAD-based) much improved on the original cryptographic shortcomings. Deployable on any VPS with a 5-minute setup. The model: you (in a censored country) connect to a Shadowsocks server you operate (in a non-censored country); the server proxies your traffic out.

Pick Shadowsocks for: bridging into the open internet from a censored network where you control a VPS in a non-censored jurisdiction. The classic deployment is "VPS in Singapore for someone in mainland China."

### v2ray / Xray

Multi-protocol proxy framework that includes Shadowsocks plus several other transport protocols (VMess, VLess, Trojan-Go). More flexible than Shadowsocks alone; correspondingly more complex. Xray is the actively-maintained fork of v2ray. Used widely in the Chinese circumvention community.

Pick v2ray/Xray for: more advanced censorship cases where Shadowsocks alone is being detected; situations requiring TLS-mimicry transports like Trojan or VLess+Reality.

### Trojan

A proxy protocol designed to be indistinguishable from ordinary HTTPS traffic. The Trojan server speaks valid TLS on port 443; if you don't know the password it behaves like a normal HTTPS server (typically configured to proxy to a real website). DPI can't distinguish Trojan traffic from ordinary HTTPS because it isn't trying to: the cover traffic is genuine.

Pick Trojan for: high-stakes circumvention where active probing (the censor sending test traffic to your server to identify it) is part of the threat model. The "looks exactly like a web server" property is harder to detect than Shadowsocks-style obfuscation.

### Hysteria

UDP-based proxy using QUIC, designed for hostile-network conditions where TCP performance collapses under high packet loss. Performs significantly better than Shadowsocks or v2ray over poor links. Trade-off: UDP is more often blocked outright than TCP, so Hysteria works best where UDP traffic is allowed but TCP is throttled.

Pick Hysteria for: poor-link or high-latency environments where the throughput improvement matters. Frequently paired with v2ray for the TCP fallback case.

### Outline

Open-source Shadowsocks-based proxy from Jigsaw (Google's research arm), with management tooling that simplifies VPS-based deployment[^outline]. Targets the journalist and activist use case specifically: the Outline Manager lets a less-technical user provision proxy servers for distribution to contacts in censored networks.

Capture-risk shape: Jigsaw is part of Alphabet, so the management tooling and the Outline Manager update channel are Google-operated. The proxy server itself is open source and runs on your own VPS; the censor cannot tell Outline traffic from ordinary Shadowsocks. Pick Outline if: the management UX is the gating factor for your deployment (you're provisioning proxies for non-technical contacts) and you accept Google's role in the tooling chain.

### AmneziaWG

A WireGuard fork designed for the DPI-survival case[^amneziawg]. Released by the Amnezia VPN team; the protocol implementation lives at `amneziawg-go` on GitHub. Preserves WireGuard's cryptographic core (Curve25519, ChaCha20-Poly1305, Noise_IK) (the security argument doesn't change) and modifies only the transport layer to evade DPI signature detection.

AmneziaWG 1.x (2024) replaced WireGuard's fixed 32-bit message-type headers (the 1/2/3/4 values that make WireGuard trivially identifiable) with configurable magic values, padded handshake packets to vary their size, and added pre-handshake junk packets to confuse signature-based detection.

AmneziaWG 2.0 (March 2026) added active protocol mimicry. The transport layer now disguises traffic as one of several common UDP protocols (DNS queries, QUIC sessions, SIP calls) with packet sizes that vary during transmission rather than being fixed. The DPI box sees what looks like ordinary DNS or QUIC; the censor's signature-based detection no longer fires.

Trade-off: like Shadowsocks and the other proxies in this tier, your traffic terminates at the AmneziaWG server, which knows your IP and your destinations. The privacy frame is single-trusted-party, same as commercial VPNs in Tier 1. The censorship-survival frame is what differs. Pick AmneziaWG if: you specifically want WireGuard's performance and operational mental model (point-to-point tunnel between machines you control) plus DPI survival in a censored network. Self-host on a VPS in a non-censored jurisdiction; deploy via Amnezia's official tooling or one of the community installers.

Adjacent commercial-VPN-side development: Mullvad rolled out QUIC obfuscation for WireGuard on its desktop clients in 2026, disguising WireGuard traffic as ordinary QUIC web traffic to bypass DPI in heavily-censored regions. Same convergence point (WireGuard plus DPI-survival obfuscation) from the commercial-VPN direction. The category to watch is "WireGuard with protocol obfuscation"; AmneziaWG and Mullvad's QUIC obfuscation are two implementations of it.

---

## Tier 8: Off-grid mesh and radio-grade

When the internet is unavailable, untrusted, or actively hostile. Different physical layer from everything above.

### Reticulum

A network stack designed to work over any transport that can carry packets: LoRa radios, WiFi, Bluetooth, serial connections, I2P tunnels, the regular internet. Cryptographic-identity-routed (similar conceptual lineage to FIPS): your address is derived from your public key, and the network finds you without DNS or coordinators[^reticulum]. AES-128-CBC end-to-end encryption with ephemeral keys per packet; sender identity hidden from relays. Active development by Mark Qvist; v1.3.0 released May 21, 2026.

The use case Reticulum nails: a single logical network spanning LoRa radio + WiFi + serial + Tor simultaneously. A remote-forest LoRa node and an urban WiFi node and a serial-link emergency relay can all be on the same logical mesh and reach each other transparently. This is the design Yggdrasil and FIPS gesture at; Reticulum implements it for the post-internet case specifically.

Pair with `LXMF` (the Reticulum messaging format) and `Nomadnet` (terminal app) for off-grid messaging. RNode is the recommended hardware (open-source LoRa transceiver).

Pick this for off-grid messaging where the threat model includes "the internet is unavailable", disaster scenarios, remote sites, jurisdictions where bulk internet surveillance is the default. Also pick this if you specifically want a single network that bridges radio and IP transports.

### Meshtastic

LoRa-based mesh, open source, hardware-focused. Cheaper and simpler than Reticulum; the standard answer for community LoRa mesh networks. Floods messages across the mesh rather than routing intelligently like Reticulum, fine at small scale, degrades at large scale (>100 nodes).

Pick this for: a community mesh in a city neighborhood, hiking-group communication, hobbyist LoRa networking. Pair with Meshtastic-compatible hardware like the LilyGO T-Beam or the Heltec LoRa boards.

### MeshCore

Newer entrant (2025) targeting embedded systems with custom routing requirements. Integration at the firmware level rather than through consumer apps. Picks this if you're building embedded mesh systems and Meshtastic's flood-routing doesn't fit; otherwise Meshtastic or Reticulum.

### B.A.T.M.A.N. (batman-adv)

The WiFi-mesh routing protocol that real-world community networks actually run on. Where Reticulum and Meshtastic are LoRa-and-radio mesh and bitchat/Briar are Bluetooth mesh, B.A.T.M.A.N. (Better Approach To Mobile Ad-hoc Networking) is the protocol that turns a fleet of ordinary WiFi nodes into a self-organizing mesh[^batman]. Developed by Germany's Freifunk community since 2006; the batman-adv kernel module has been part of the mainline Linux kernel since 2.6.38 (2011); current release batman-adv 2025.4 (October 2025); controlled via `batctl`; packaged in Debian and Devuan.

Architecture: batman-adv operates at Layer 2 (it routes Ethernet frames, not IP packets), which means it emulates one giant virtual network switch spanning every node in the mesh. Every node appears link-local to every other; higher-layer protocols (IPv4, IPv6, DHCP) run on top unaware of the mesh topology underneath. The routing intelligence is decentralized by design: no single node holds the full network map; each node knows only the best next-hop toward each destination, computed from link-quality metrics (the TQ, transmit-quality value). This is the distance-vector approach that scales where flat flooding (Meshtastic's model) collapses.

Capture-risk shape: none. It's a kernel routing protocol, not a service; there's no operator, no account, no coordinator. The mesh is whoever's running batman-adv on the same physical or VPN-bridged Layer-2 segment.

Pick B.A.T.M.A.N. for: building a community WiFi mesh (the Freifunk model, neighborhood-scale resilient internet that survives any single ISP or node), bridging multiple physical sites into one Layer-2 network over WiFi or VPN transports, or any case where you want a kernel-native mesh protocol rather than an application-layer overlay. This is the heaviest-infrastructure entry in Tier 8 and the most production-proven at community scale; Freifunk has run city-scale deployments on it for over a decade. Pair with OpenWrt on the node hardware for the standard community-mesh stack. For single-link or small-peer-count cases, the overlay-network options in Tier 4 (Yggdrasil especially) are simpler; B.A.T.M.A.N. earns its complexity at the scale of dozens-to-thousands of WiFi nodes.

### Briar's offline mesh

Briar is a P2P messenger (covered in `choosing-communication-tools.md`) that includes Bluetooth and WiFi-direct mesh as transports alongside Tor over the internet. This puts it at the messenger / networking boundary: it's primarily a messenger, but the transport layer it ships is real mesh networking. Latest stable release 1.5.9 (January 2024), so development has slowed; the architecture remains sound but project velocity is a flag.

For the messenger landscape including Briar's positioning, see `choosing-communication-tools.md`. For purely-networking off-grid use, prefer Reticulum or Meshtastic.

---

## What to avoid

**"VPN for privacy" as a frame.** It was always a marketing frame, never a privacy frame. Encrypted DNS plus HTTPS-everywhere closes most of what commercial VPNs claim to solve, without any trusted third party. Use a commercial VPN for specific narrow reasons (geographic bypass, hostile-ISP bypass, hotel-network defense); don't use one as a generic privacy upgrade.

**Free commercial VPNs that aren't free tiers of a paid product.** The business model is logging-and-selling or malware. There are no exceptions.

**WireGuard "VPN apps" with closed clients.** WireGuard the protocol is fine; some commercial VPN apps claim to use WireGuard but ship closed clients with proprietary modifications. If the client isn't open source, you're back in Tier 1 even if the marketing says otherwise.

**Browser-based "VPN" extensions.** Browser proxies. Useful for specific bypass cases; not a VPN in any meaningful sense. Mozilla VPN, Brave's built-in VPN, etc. are commercial VPN re-sells, not browser-side architecture.

**Tailscale or any centralized-coordinator mesh as a "privacy" tool.** Convenient mesh networking, real engineering, but the coordinator sees your metadata. The privacy frame collapses when one party knows the entire topology of who-talks-to-whom.

**Censorship-evasion proxies as anonymity tools.** Shadowsocks, v2ray, Trojan, Hysteria, Outline are great at evading DPI; they're not anonymity tools. Your traffic still terminates at your proxy server, which knows your IP and your destinations. Don't conflate these with Tor.

---

## Where to start

A flowchart of common cases.

**"I want my laptop on my home network when I travel."** Self-hosted WireGuard between laptop and home server (Tier 2). If the home server is behind a CGNAT or you have multiple devices, Headscale (Tier 3) is the next step up.

**"I want a few machines to all see each other."** Same answer: Headscale plus WireGuard, or NetBird if you don't already have Tailscale clients deployed. Self-host both.

**"I want anonymity from my destination."** Tor (Tier 6). Use Tor Browser for browsing; use Whonix for whole-system Tor. If your adversary is nation-state-scale (can observe traffic across the whole network), NYM's Anonymous Mode (Tier 6) adds the cover-traffic mixnet defense Tor lacks, at a latency cost.

**"I want anonymity from my ISP."** Tor again. A commercial VPN gives you "trust one company instead of your ISP," not anonymity. If you have a specific reason a VPN works better here (Tor blocked by your ISP, sites you need block Tor exits), Mullvad in Tier 1.

**"I want to bypass a geographic block."** Commercial VPN, Tier 1. Mullvad or IVPN. Pay in cash or Bitcoin.

**"Tor is blocked on my network."** Tor with pluggable transports. Try obfs4 first; Snowflake if obfs4 is blocked; Meek if both are blocked. Distribute Tor Browser ships all three (Settings → Connection → Bridges).

**"Everything is blocked on my network."** Shadowsocks or v2ray to a VPS you control in a non-censored jurisdiction (Tier 7). Trojan if you're being actively probed. Hysteria if the link quality is bad. AmneziaWG if you want WireGuard's performance and operational mental model in the same DPI-survival posture.

**"I want a sovereignty-aligned mesh that doesn't depend on any company."** Today: Yggdrasil or Nebula (Tier 4), depending on whether you prefer IPv6-overlay simplicity (Yggdrasil) or PKI-based explicit-trust (Nebula). Tomorrow (when alpha lifts): nostr-vpn plus FIPS (Tier 5).

**"I want communication that works when the internet doesn't."** Reticulum with RNode hardware for the serious case; Meshtastic for the community-mesh case (Tier 8).

**"I want to build a neighborhood-scale resilient WiFi network."** B.A.T.M.A.N. (batman-adv) on OpenWrt node hardware (Tier 8). This is the Freifunk model, city-scale mesh that survives any single ISP or node failure, proven over a decade.

**"I want all of the above stacked."** Reticulum can transport over Yggdrasil which can transport over Tor; the layering is the design. This is the maximalist configuration and is real ops work to operate; don't start here unless you've operated each layer individually first.

---

## Maturity table

Read the entries above for the substance; this table is the at-a-glance map.

| Tool | Tier | Status | Capture-risk shape |
|------|------|--------|---------------------|
| Mullvad | 1 | Production, audited | Single Swedish company |
| IVPN | 1 | Production, audited | Single Gibraltar company |
| Proton VPN | 1 | Production | Single Swiss company + foundation |
| WireGuard | 2 | Production, in-kernel | None (your infrastructure) |
| OpenVPN | 2 | Production, dated | None (your infrastructure) |
| `sshuttle` | 2 | Production | None |
| Tailscale | 3 | Production, late-stage VC | Closed coordinator + mandatory third-party SSO |
| Headscale | 3 | Production | None (your coordinator) |
| NetBird | 3 | Production | Optional company-hosted; self-hostable |
| ZeroTier | 3 | Production, BSL-licensed | Closed coordinator (self-host possible) |
| Nebula | 4 | Production | None after PKI bootstrap |
| Innernet | 4 | Maintenance | None after admin signature |
| Yggdrasil | 4 | Production, mature | None |
| cjdns | 4 | Maintenance | None |
| nostr-vpn | 5 | Alpha, v4.x, fast churn | None by design |
| FIPS | 5 | Alpha (v0.2.0) | None by design |
| Tor | 6 | Production, mature | Trust-no-single-party (volunteers) |
| I2P | 6 | Production | Trust-no-single-party (volunteers) |
| Lokinet | 6 | Production, smaller | Token-economic service nodes |
| NYM (NymVPN) | 6 | Production (v2026.4) | Mixnet; token-economic service nodes |
| Shadowsocks | 7 | Production, widely deployed | Your VPS knows your traffic |
| v2ray / Xray | 7 | Production | Your VPS knows your traffic |
| Trojan | 7 | Production | Your VPS knows your traffic |
| Hysteria | 7 | Production | Your VPS knows your traffic |
| Outline | 7 | Production | Your VPS + Jigsaw management tooling |
| AmneziaWG | 7 | Production, v2.0 (March 2026) | Your VPS knows your traffic |
| Reticulum | 8 | Production (v1.3.0) | None |
| Meshtastic | 8 | Production | None |
| MeshCore | 8 | Early | None |
| B.A.T.M.A.N. (batman-adv) | 8 | Production, in-kernel | None |
| Briar mesh | 8 | Maintenance | None |

---

[^nostr-vpn]: Martti Malmi, *nostr-vpn*, GitHub repository: <https://github.com/mmalmi/nostr-vpn>. README description: "nostr-vpn is a Tailscale-style private mesh VPN built around a FIPS-backed data plane. It includes the nvpn CLI/daemon, a shared native app core, and native shells for desktop and mobile platforms." Malmi's release announcement on X, 19 May 2026: <https://x.com/marttimalmi/status/2056616263925854570>. Malmi's bio: "Bitcoin dev in 2009-2011." Current release v4.0.47 on the GitHub releases page as of 28 May 2026; the project ships multiple releases per week, so the live version number drifts faster than this doc updates.

[^fips]: jcorgan, *FIPS: The Free Internetworking Peering System*, GitHub repository: <https://github.com/jmcorgan/fips>. Project website: <https://fips.network/>. Announcement on Nostr (jcorgan): "FIPS is a mesh networking protocol that makes a Nostr keypair your network identity. Nodes find each other and route traffic using npubs directly. No DNS registrars, no IP address allocation, no routing authorities. Just keypairs and encrypted links." Protocol design documentation: `docs/design/fips-intro.md`.

[^fips-v020]: Nostr Compass #15 newsletter, 25 March 2026: <https://nostrcompass.org/en/newsletters/2026-03-25-newsletter/>. Documents FIPS v0.2.0 adding Tor transport support, reproducible builds, sidecar example connecting through a Nostr relay, and Nostr release publishing in the OpenWrt package workflow.

[^fips-acronym]: Lobsters discussion of FIPS, February 2026: <https://lobste.rs/s/fxljxx/fips_free_internetworking_peering>. The acronym clashes with the U.S. National Institute of Standards and Technology's Federal Information Processing Standards, which has been the dominant referent for "FIPS" in cryptography contexts for decades.

[^mullvad-raid]: Mullvad blog, *Mullvad VPN was subject to a search warrant. Customer data not compromised*, 20 April 2023: <https://mullvad.net/en/blog/mullvad-vpn-was-subject-to-a-search-warrant-customer-data-not-compromised>. Documents Swedish police executing a search warrant; the company demonstrated it held no customer activity data the warrant could compel production of.

[^tailscale-funding]: Tracxn company profile, *Tailscale - 2026 Company Profile, Team, Funding & Competitors*: <https://tracxn.com/d/companies/tailscale/__HoO0OVaODdbZEsDLJ7_OTsp344lrcNrb7eGx_aw5Lrk>. $275M total across four rounds; Series C of $160M on 8 April 2025; valuation $778M as of May 2022. PitchBook profile documents Tailscale's acquisition of Border0 on 17 March 2026: <https://pitchbook.com/profiles/company/268781-05>.

[^tailscale-headcount]: Tracxn (same profile as above): "As of Apr 30, 2026, the latest employee count at Tailscale is 318."

[^tailscale-ai-pivot]: SiliconANGLE, *Secure networking startup Tailscale launches identity-linked governance for AI tools and agents*, 17 February 2026: <https://siliconangle.com/2026/02/17/secure-networking-startup-tailscale-launches-identity-linked-governance-ai-tools-agents/>.

[^headscale]: Juan Font, *Headscale*, GitHub repository: <https://github.com/juanfont/headscale>. Open-source reimplementation of the Tailscale control server. v0.26.1 as of early 2026.

[^netbird]: NetBird, *NetBird - Connect your devices into a single secure private WireGuard®-based mesh network*: <https://netbird.io/>. Apache 2.0 licensed; both client and management server open source. Berlin-based company; founded 2021.

[^outline]: Outline by Jigsaw, project website: <https://getoutline.org/>. Open-source Shadowsocks-based proxy with Outline Manager for VPS deployment. Source on GitHub: <https://github.com/Jigsaw-Code/outline-server>.

[^amneziawg]: Amnezia VPN, *AmneziaWG 2.0 Is Here*, blog post: <https://amnezia.org/blog/amneziawg-2-0-available-for-self-hosted>. Open-source implementation: <https://github.com/amnezia-vpn/amneziawg-go>. Documentation: <https://docs.amnezia.org/documentation/amnezia-wg/>. Technical analysis of v2.0's transport-layer obfuscation: <https://dev.to/bivlked/amneziawg-20-self-host-an-obfuscated-wireguard-vpn-that-bypasses-dpi-4692>. Mullvad's parallel QUIC-obfuscation-for-WireGuard rollout reported by TechRadar via Yahoo, 2026: <https://tech.yahoo.com/vpn/articles/mullvad-deploys-quic-obfuscation-wireguard-150302808.html>.

[^reticulum]: Mark Qvist, *Reticulum Network Stack*, project site: <https://reticulum.network/>. Reference implementation v1.3.0 released 21 May 2026. Design summary from third-party 2026 coverage: "a single Reticulum network can run simultaneously over LoRa radios + WiFi networks + I2P tunnels + serial connections." Reticulum manual: <https://reticulum.network/manual/Reticulum%20Manual.pdf>.

[^nym]: Nym Technologies, *Nym mixnet* and *NymVPN*: <https://nym.com/> and <https://nym.com/mixnet>. Loopix design documentation: <https://nym.com/docs/network/concepts/loopix>. FOSDEM 2026 talk, *NymVPN: The First Real-World Decentralized Noise-Generating Mixnet for Anonymity*: <https://fosdem.org/2026/schedule/event/U3UCKS-nym-mixnet/> (Chief Scientist Claudia Diaz, formerly KU Leuven). Source: <https://github.com/nymtech/nym> and the NymVPN client <https://github.com/nymtech/nym-vpn-client>. GPL-3, Rust. Two-mode design (5-hop Sphinx mixnet Anonymous Mode; 2-hop AmneziaWG Fast Mode), 24-word access key onboarding, BTC/XMR payment, v2026.4 desktop ad-blocking per March 2026 release notes.

[^batman]: B.A.T.M.A.N. (Better Approach To Mobile Ad-hoc Networking), Freifunk / Open Mesh project: <https://www.open-mesh.org/>. batman-adv has been part of the mainline Linux kernel since 2.6.38 (2011); current release batman-adv 2025.4 (24 October 2025) per the project version history. Layer-2 routing protocol controlled via `batctl`; packaged in Debian and Devuan. Developed by the German Freifunk community since 2006 to replace OLSR for large-scale community wireless mesh. Freifunk overview: <https://en.wikipedia.org/wiki/Freifunk>.

[^peardrive]: PearDrive project site: <https://peardrive.com/>. Describes a peer-to-peer file-sharing system and states the software is currently a proof of concept, not yet production-ready, with a beta launch in progress. Retrieved June 2026.

[^peardrive-cli]: PearDrive CLI, GitHub: <https://github.com/peardrive/PearDriveCLI>. AGPL-3.0, JavaScript; npm package `@peardrive/cli`; runs on Pear Runtime (`pear run`). README documents network keys, peer public keys, QR sharing, and archive mode, and flags that network deletion is unimplemented and that file-change syncing will not work as intended until a future PearDriveCore release. Latest release v4.0.0 (29 October 2025).

[^pear-runtime]: Holepunch, *Pear Runtime* launch announcement, 14 February 2024 (Pears.com): <https://pears.com/news/holepunch-unveils-groundbreaking-open-source-peer-to-peer-app-development-platform-pear-runtime/>. Open-source peer-to-peer app platform created by Holepunch, described as Tether-backed, with Keet as the first flagship app.

[^holepunch-launch]: Tether, *Tether, Bitfinex and Hypercore Launch Holepunch*: <https://tether.io/news/tether-bitfinex-and-hypercore-launch-holepunch-a-platform-for-building-fully-encrypted-peer-to-peer-applications/>. Funding provided by Tether and Bitfinex; Paolo Ardoino appointed Chief Strategy Officer; Keet named as the first peer-to-peer application.

[^peerdrive-erlang]: PeerDrive: <http://peerdrive.org/> and <https://github.com/peerdrive/peerdrive>. An unrelated, earlier project, an Erlang-based distributed filesystem its authors describe as early alpha. Named here only to prevent conflation with peardrive.com.