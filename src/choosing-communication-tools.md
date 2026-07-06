# Choosing Communication Tools, v9

How to choose a messenger or email setup when the goal isn't "what does my contact use" but "what threat model does the tool actually defend against." Covers centrally-coordinated messengers, federated networks, decentralized cryptography, P2P and offline-capable messengers, Nostr-rooted messaging, radio-grade off-grid messaging, and (in a dedicated second half) the email landscape: encrypted-mailbox providers, privacy-respecting standard providers, self-hosted mail, encryption layers, clients, and aliasing.

This doc complements `choosing-networking-tools.md` (the L3/L4 networking layer) by covering the application-layer messaging and email space. The two intersect at Briar and at Reticulum's LXMF: both projects appear in both docs but with different framings.

---

## TL;DR

The right default messenger depends entirely on your contacts. The right default messenger for sovereignty-minded readers who can influence their contacts is Signal for mass-market reach, with SimpleX as the sovereignty-aligned upgrade for the contacts who'll move with you.

Beyond the default:

1. Mass-market, US-jurisdiction-tolerant: Signal.
2. Mass-market, US-jurisdiction-averse: SimpleX or Threema.
3. Tor-only, metadata-resistant: Cwtch.
4. Offline mesh capability: bitchat for Bluetooth-mesh on iOS and Android (Dorsey's sovereignty-aligned project, deployed at scale in Uganda's 2026 election), Briar for the Bluetooth-plus-Tor case on Android, Reticulum/LXMF for the radio-grade case.
5. Self-sovereign keypair identity over Nostr with mature forward-secrecy: White Noise (MLS via the Marmot protocol).
6. Self-sovereign keypair identity over Nostr with broader client ecosystem: Damus, Amethyst, 0xchat via NIP-17.
7. Federation-preferring: Matrix via Element / Element X, or XMPP via Conversations.
8. Voice and video focus: Jami.
9. Email-bridge: DeltaChat for users who already have email and want PGP-grade encryption without learning a new app.

For email specifically (the second half of this doc), the ordering is by how much you can verify rather than how polished the product is. The open-source-and-auditable endpoint is self-hosting: Stalwart or mailcow on a clean-IP VPS is the only configuration where you control and can inspect the whole stack instead of trusting a provider's server. Hosted providers are the convenience tier: Posteo or Mailbox.org for client-free standard IMAP/SMTP on your own domain, then Proton Mail or Tuta for encrypted-at-rest mailboxes (open clients, closed servers, single-jurisdiction court-compulsion exposure). Thunderbird or nmail for clients; SimpleLogin or addy.io for aliasing; own a custom domain early so changing providers never changes your address, which is what makes the climb toward self-hosting possible at all. Be wary of newer entrants: AtomicMail is too new and not fully open to recommend, and Skiff shows why, bought and shut down inside four years. The honest baseline, stated once and meant: email leaks metadata by design, so for genuinely sensitive communication use a messenger from the first half, not email.

Avoid: WhatsApp, Telegram (the default-unencrypted product, not the Secret Chats), iMessage cross-platform, Discord for anything you care about, Wickr (Amazon-owned, end-of-life uncertain). For email: Gmail, Outlook / Microsoft 365, Yahoo for anything sensitive.

---

## The capture-risk frame for messengers

Three architectural questions structure the messenger landscape:

**What identifies the user?** Phone number (Signal, WhatsApp, Telegram), email (Wire, Threema for backup), username (Threema, Matrix, XMPP), random ID (Session, Briar, Cwtch), no identifier at all (SimpleX), or a cryptographic keypair generated locally (Nostr clients including White Noise, Reticulum).

**Who routes the messages?** A single company (Signal, Threema, WhatsApp), a federation of servers (Matrix, XMPP, DeltaChat over email), a peer-to-peer overlay (Briar, Cwtch, Berty, Jami), a content-addressed network of relays (Nostr, SimpleX), or volunteer-run radio infrastructure (Reticulum, Meshtastic).

**What's the company's incentive?** Subscription revenue (Threema, ProtonMail), donations and grants (Signal Foundation, Briar, Tor), VC-funded growth toward an exit (no current example in this list survives this filter), or commercial-and-consortium hybrid (SimpleX is building toward this with its 2026 Foundation/Consortium launch[^simplex-consortium]).

The combination of those three answers is the messenger's threat model. Signal answers "phone number + Signal Foundation servers + donations", strong cryptography, real funding model, US-jurisdiction exposure. SimpleX answers "no identifier + your-choice-of-relays + commercial + foundation", eliminates the metadata that the others handle imperfectly. White Noise answers "Nostr keypair + your-choice-of-relays + MLS encryption + Bitcoin-community-funded", sovereignty by construction at the cost of UX maturity. Nostr DMs (NIP-17) answer the same as White Noise but with weaker forward-secrecy and no native multi-device.

Two more lenses run through both halves of this doc. The first is that open source is a floor, not a bonus: a tool whose source you cannot read is a tool whose behavior you are taking on faith, so fully-open-source-and-auditable tools are prioritized here, partially-open tools (open client and closed server, or open stack and closed app) are named as exactly that, and closed tools are flagged. Open source is necessary but not sufficient, because for any hosted service you still cannot verify that the server runs the code it publishes, which is why the sovereign endpoint in both halves is something you run yourself rather than a provider you trust. The second lens is that longevity is itself a security property: a tool that has operated for a decade through funding scares and legal pressure has demonstrated resilience a six-month-old startup cannot, and the VC-funded-toward-an-exit pattern named above is the specific failure mode to fear. Skiff, in the Email section, is the worked example, a polished, partly-open, well-funded privacy startup acquired and shut down inside four years, stranding its users with no clean migration path. New is not disqualifying, and several of the strongest entries here are recent, but new is unproven, so unproven tools carry a maturity stamp here rather than a recommendation.

### A note on MLS (Messaging Layer Security)

MLS is the IETF-standardized group messaging cryptography (RFC 9420, July 2023). It provides forward secrecy (compromise of current keys doesn't expose past messages), post-compromise security (compromise self-heals as the ratchet advances), and end-to-end encrypted groups that scale to thousands of members without rekeying every pair separately. Apple, Google, Mozilla, Cisco, Wire, and Wickr were among the participants in standardization.

Adoption in 2026: Wire was the early production deployment; Element X is migrating Matrix from Olm/Megolm to MLS; White Noise is the first Nostr-native MLS messenger via the Marmot protocol; the IETF MIMI working group is building cross-network MLS interop on top. MLS is the trajectory most serious-use messengers are converging toward.

The MIMI (More Instant Messaging Interoperability) IETF working group is the cross-network interop layer being built on top of MLS. Four drafts are active as of early 2026: `draft-ietf-mimi-arch` (the architecture), `draft-ietf-mimi-protocol` (the MIMI-over-HTTPS-and-MLS transport spec), `draft-ietf-mimi-room-policy` (room policies for groups and multimedia conferences), and `draft-ietf-mimi-content` (the message-content format)[^mimi]. Authors include Richard Barnes (Cisco), Matthew Hodgson and Travis Ralston (Matrix.org Foundation), Konrad Kohbrok and Raphael Robert (Phoenix R&D), and Rohan Mahy. The Matrix-side participation is heavy; Element X's MLS migration is the most visible implementation track. What MIMI lets you do at the spec level once it lands: a user on provider A and a user on provider B exchange E2E messages without either provider operating a bridge. The bridge becomes a protocol, not a piece of infrastructure. Trajectory for the next 18 to 24 months; not deployable yet.

---

## Tier 1: Centrally-coordinated, mass-market

The "one company, professional ops, strong crypto" tier. The right answer when reach matters and the threat model tolerates trusting a single well-resourced operator.

### Signal

US-based, Signal Foundation governance, Signal Technology Foundation legal entity. Founded by Moxie Marlinspike, current president Meredith Whittaker since 2022. End-to-end encryption via the Signal Protocol (Double Ratchet, X3DH, post-quantum extension via PQXDH since 2023), which is the cryptography most other secure messengers also use under the hood (WhatsApp, the Skype business of Microsoft, Google RCS). Open-source clients on every major platform; server source-available with some lag relative to deployment.

Phone-number identity is the recurring flag. Sign-up requires a phone number; the number is also your visible identifier to contacts by default. Username support shipped in 2024 to mask the phone number from new contacts but the number remains the account anchor. SIM-swap attacks are real against any phone-rooted identity system.

US-jurisdiction shape: Signal Foundation is a US 501(c)(3); the legal compulsion model is "the FBI asks, the Foundation provides what's technically possible to provide," which is by design very little (account creation date, last connection date, no message content, no contact list). The 2016 Eastern District of Virginia subpoena response is the canonical example: the Foundation provided account-creation timestamp and last-connection timestamp; that was all it had to provide.

Community-politics flag: Meredith Whittaker's public political alignments are explicit and well-known (anti-corporate AI surveillance, AI Now Institute background); how much weight that carries varies by reader. The technical posture of Signal under her presidency has remained strong (post-quantum protocol upgrade, username feature, no telemetry-creep, no monetization-creep).

Pick Signal as the default mass-market messenger if: your contacts will install it (the largest "your contacts will install it" surface area of any privacy messenger by an order of magnitude), and you understand the phone-number flag. The cryptography is genuinely strong; the structural risks are jurisdiction and phone-rooted identity, not the crypto.

### Threema

Swiss, founded 2012, paid (one-time purchase, currently around €4.99). Identity is a Threema ID, eight characters, randomly generated, no phone number, no email required at registration. Optional verification of email or phone for friend-finding only; not required.

Open-source clients since 2020; the server stack remains closed. Audited multiple times; cryptography is solid (NaCl-based, custom protocol). Used by the Swiss government for internal communications, which is a credible operational endorsement.

Capture-risk shape: single Swiss company, paid subscriber base. Swiss jurisdiction provides EU-level data protections plus a cultural reluctance to assist foreign-government subpoenas. Smaller user base than Signal by far.

Pick Threema if you want the no-phone-number property, you're willing to pay (the payment is the user-not-product signal you actually want here), and your contacts will install it. Common in DACH-region (Germany, Austria, Switzerland) friend and family networks.

---

## Tier 2: Federated

The "no single company can shut you off; multiple operators can interoperate" tier. The trade-off is more configuration and a thinner UX layer.

### Matrix (via Element, Element X, or alternatives)

Federated network of servers (homeservers) running the Matrix protocol. Element (formerly Riot) is the reference client, made by Element Software (formerly New Vector), the same company that maintains the spec. Element X is the rewrite shipping since 2024, Rust core, native iOS and Android, designed around MLS as the encryption layer rather than the legacy Olm/Megolm pair. Matrix.org is the largest single homeserver; tens of thousands more exist across self-hosted and community deployments.

End-to-end encryption: Olm/Megolm in legacy Element; MLS-based migration underway in Element X with the goal of cross-net Mimi interop. Element X ships MLS-enabled rooms by default for new conversations on supported homeservers as of 2026. The migration story for existing rooms is incremental.

Capture-risk shape: federation gives you the right to leave any homeserver and take your identity (via cross-signing keys and exported backups). The reality is messier: if you've been on matrix.org and that homeserver goes down, you can rejoin rooms from a new server but the operational hassle is real. Element Software the company has had funding turbulence (2023-2024); the protocol survives the company.

Pick Matrix if: you want federation as a structural property, you have contacts already using it (Linux communities, security communities, FOSS projects), and the UX rough edges don't deter you. Self-hosting your own homeserver (Synapse, Dendrite, or Conduit) is the sovereignty-aligned configuration.

### XMPP (via Conversations or other clients)

The older federation protocol; an open IETF standard. Conversations (Android) is the reference modern client; Gajim (desktop) and Snikket (turnkey self-hosted server) round out the practical stack. OMEMO is the end-to-end encryption layer, based on the Signal Protocol.

Smaller user base than Matrix; older codebase; fewer feature creep risks. The protocol itself has been stable for two decades.

Pick XMPP if: you want a protocol that has outlasted multiple companies and several federation experiments, you're comfortable picking your own server (or running one), and you don't need the rich-media UX Matrix invests in. Some sovereignty-minded operators specifically prefer XMPP over Matrix on the "older, simpler, more outlasted-companies" axis.

---

## Tier 3: Decentralized cryptography

The "no central party knows the topology, even if the relay set is fixed" tier.

### SimpleX Chat

The most architecturally interesting current entry. No user identifiers of any kind, not even random ones[^simplex-no-ids]. Conversations are routed via temporary pairwise queue identifiers; each conversation typically uses two different relay servers chosen by the participants. Your contact list isn't on any server because there's no server-side notion of "you." Tor support built-in for IP-address protection.

Cryptography is end-to-end with quantum-resistant key agreement and the Double Ratchet for ratcheting. Trail of Bits cryptographic design review in 2024[^simplex-tob]; reproducible builds; clients on iOS, Android, Windows, macOS, Linux (Flatpak, AppImage, .deb, console).

Current version v6.5 (April 30, 2026). The April 2026 release announced SimpleX Channels (publishing with participation privacy: channel content visible to relays but participants and authors anonymous to relays and each other) and the SimpleX Network Foundation and SimpleX Network Consortium structure, a Foundation that holds the protocol IP and a Consortium agreement between Foundation and SimpleX Chat Ltd that survives the company being sold or shut down[^simplex-consortium]. This is the governance structure the sovereignty frame asks for.

Capture-risk shape: the architecture eliminates the user-identifier capture risk by construction. The relay operators still see traffic patterns (encrypted content, but timing and volume); the Tor option closes the IP-address leak. The Foundation/Consortium structure addresses the "what if the company is bought" question explicitly.

Pick SimpleX if: you can persuade your contacts to install it (smaller than Signal but growing), you want the strongest current architectural privacy guarantees in a usable mass-market-style app, and you're aligned with the structural choices the Foundation is making.

### Session

Loki/Oxen Network-based, no phone number, no email, no central server. Forked from Signal in 2019; uses the Session Protocol (a modified Signal Protocol that drops forward-secrecy in exchange for asynchronous delivery without a central server). Routes through the Oxen service node network using Lokinet onion routing.

Australian-headquartered (Session was originally a Loki Project initiative). The Oxen Network has had token-economy turbulence over the years.

Pick Session if: you want a fully decentralized routing model, you accept the forward-secrecy trade for the offline-delivery property, and the Oxen Network's continued operation matches your time horizon. Smaller user base than SimpleX; less active development as of 2026.

---

## Tier 4: P2P and offline-capable

The "no internet required" tier. Either pure peer-to-peer or with internet as one transport among several.

### Briar

P2P messenger built around Tor for the internet case plus Bluetooth and WiFi-direct for the offline-mesh case. Messages can also be transferred via USB stick (the "censorship-resistant" use case the project explicitly designs for).

Android-first; desktop clients (Windows, macOS, Linux) exist; Linux mobile support in beta. No accounts, no phone numbers, no email; identity is a cryptographic keypair generated on the device.

The unique property: works without any internet connectivity at all. Two Briar users in the same building can communicate over Bluetooth indefinitely. Two users in adjacent buildings can communicate over WiFi-direct. Two users in the same city with no internet can relay messages via a third user who's seen them both.

Status flag: last stable release v1.5.9 (January 2024). Active development continues per the project's GitLab but release velocity has slowed. The protocol and architecture remain sound; treat as production for the use case it solves but watch the project's health.

Pick Briar if: your threat model includes "the internet might go away" (protest scenarios, infrastructure disruption, hostile-state censorship), or you specifically want offline-mesh capability in your standard messenger stack. Pair with Reticulum/LXMF (Tier 7) for the radio-grade extension of the same idea.

### Cwtch

Tor-only messenger built by Open Privacy Research Society (Sarah Jamie Lewis and contributors). Every conversation runs over Tor v3 onion services; no central server, no Cwtch service to compromise. Metadata-resistant: the protocol is designed so even traffic analysis between peers can't reveal who's talking to whom.

Smaller user base than Briar; cleaner architecture in some respects (no Bluetooth/WiFi-direct complexity). Desktop and Android clients.

Pick Cwtch if: your threat model is "metadata is the threat" (journalists protecting sources, activists in hostile jurisdictions, anyone whose social graph is the sensitive data) and you accept that everyone in your conversation must also be on Cwtch.

### Jami

P2P SIP-based messenger and voice/video conferencing tool by Savoir-faire Linux (Montréal), free software, GPL-3. The closest thing to "Signal for voice and video with no central server." Identity is a cryptographic keypair (RingID); discovery via OpenDHT (a distributed hash table); audio and video routed peer-to-peer where possible, with optional TURN-relay fallback you can self-host.

Capture-risk shape: no central server at all. Savoir-faire Linux maintains the software and runs default DHT bootstrap nodes, but the company can be removed from the loop with self-hosted bootstrap. Available on Linux, Windows, macOS, Android, iOS, including Devuan native packages.

Pick Jami if: voice and video are first-class needs (not bolted onto a chat app), and you want serverless P2P architecture. Particularly useful for self-hosting in family or small-organization contexts where the user count is low enough that DHT discovery latency isn't an issue.

### Berty

P2P over Bluetooth and Tor, similar conceptual space to Briar but with iOS support (which Briar lacks). Identity is a cryptographic keypair. Smaller project; less mature than Briar.

Pick Berty over Briar if: you need iOS support. Otherwise Briar is the more established choice in this space.

### Keet

Peer-to-peer messenger built by Holepunch and backed by Tether and Bitfinex, the companies behind the USDT stablecoin and the Bitfinex exchange. Built on the Pear Runtime and the Hypercore protocol stack: identity is a cryptographic keypair, peers locate each other through a distributed hash table, and there are no servers in the middle at all. End-to-end encrypted text, voice, and video, plus unlimited-size file transfer (files move device to device with no server to cap them), with integrated Bitcoin Lightning and USDT payments. Launched in 2022, downloaded millions of times, with a download surge through early 2026[^keet].

Open-source status, stated precisely because it is the flag for this audience: the foundation is open source (the Pear Runtime, Hypercore, and Hyperswarm are published under permissive licenses and are reusable by any developer for any P2P app), but the Keet client application itself is not open source. NixOS packages it as unfree, and a 2022 promise to open-source the app has gone substantially unfulfilled as of 2026. So Keet is an open-source P2P stack wrapped in a closed-source client, which is weaker than Signal (open clients, source-available server) and weaker than the fully-open P2P messengers in this tier: Briar, Cwtch, and Jami are open source end to end.

Capture-risk shape: zero servers by construction, so no operator to compel; the residual concerns are the closed client (you cannot audit what the app does with your keys) and, as with any DHT-based system, that the network maps your public key to your IP address to route traffic, so your IP is visible to the peers you connect with unless you add a network-layer cover such as a VPN or Tor. Funding flag: Tether and Bitfinex backing is what frees Holepunch from chasing subscription or ad revenue, and is also a commercial crypto-conglomerate dependency a sovereignty-minded reader should weigh on its own terms.

Pick Keet if: you want serverless P2P text with high-quality voice and video, no account and no phone number, you are aligned with the Bitcoin and stablecoin ecosystem it is built around, and the closed client is a trade you will accept for the architecture, the unlimited file transfer, and the payments. If end-to-end open source is the priority, Jami covers the same serverless-P2P-with-voice-and-video ground fully open.

### bitchat

Decentralized messaging over Bluetooth Low Energy mesh, with internet-connected geohash channels via Nostr as an optional second layer. End-to-end encryption via the Noise Protocol Framework (XX pattern), no servers, no accounts, no phone numbers, no email. Built by Jack Dorsey (Twitter co-founder, Block CEO, and one of the most visible Bitcoin advocates in the technology industry) under his "and Other Stuff" open-source development collective, with significant community contribution since[^bitchat]. Repositories: `github.com/permissionlesstech/bitchat` (iOS, Swift, Unlicense / public domain) and `github.com/permissionlesstech/bitchat-android` (Android, Kotlin, GPL-3). iOS v1.5.x and Android v1.7.x current as of early 2026.

Architecture. Each device acts as both client and server in a BLE mesh; messages hop up to seven times to reach recipients outside direct range (~30m per hop). End-to-end encryption uses Noise XX, which provides mutual authentication and forward secrecy. Identity is a Noise static Curve25519 keypair plus an Ed25519 signing keypair, generated on first launch and stored in the device keychain. A user's verifiable fingerprint is the SHA-256 hash of their Noise static public key, readable aloud or scanned via QR for out-of-band verification. Messages live only in device memory by default and self-delete unless explicitly saved. Channel-based group chats (IRC-style `/join`, `/msg`, `/who`) with optional password protection; store-and-forward to offline peers; emergency wipe via triple-tap.

Hybrid Bluetooth-plus-Nostr design. Geohash channels (added in 2025-2026 development) use an internet connection to bridge Bluetooth-mesh-local conversations with peers in the same geographic area who aren't in BLE range. This puts bitchat at the boundary between Tier 4 (offline mesh) and Tier 5 (Nostr-rooted): primarily a Bluetooth-mesh messenger, with Nostr as the internet-connected complementary layer when one is available. The Tor transport for Nostr is shipped in the Android client via the self-compiled `arti` library (Rust Tor implementation), reducing APK size meaningfully versus earlier embedded Tor builds. Background persistence on Android lets a device serve as a mesh relay even when the user isn't actively in the app.

Adoption signal worth naming. Ahead of Uganda's January 2026 general election, opposition leader Bobi Wine urged citizens to use bitchat to bypass anticipated internet shutdowns. Ugandan search interest for "bitchat" surged in the run-up to the election per Google Trends. The use case bitchat was architected for (protest communication when telecom infrastructure is throttled or shut down) is the use case it's actually being deployed for at scale in 2026. TestFlight beta hit its 10,000-slot cap within hours of Dorsey's July 2025 announcement; iOS App Store reach (25.1k GitHub stars on the iOS repo as of early 2026) gives bitchat a distribution surface that Briar's Android-first reach can't match. This is the rare case where a sovereignty-aligned messenger reached the mainstream-app-store audience without compromising the architecture.

Sovereignty frame. bitchat occupies the same architectural slot in messaging that nostr-vpn (`choosing-networking-tools.md`) occupies in networking: a Bitcoin-aligned developer applies the no-trusted-third-parties pattern to infrastructure that used to require centralized servers, ships open source, and lets the architecture speak. Dorsey's funding via "and Other Stuff" rather than via VC or corporate roadmap puts the project structurally in the same class as Knots and as Malmi's work. The two flags worth naming are the iOS-side closed-app-store distribution (same flag every iOS app carries; the source is open and Android builds from source are fully supported) and Block's commercial position (Bitcoin financial-services company; Dorsey's personal funding is what backs bitchat, not Block's corporate strategy).

Capture-risk shape: zero by construction (no servers, no operator). Residual concerns are the iOS distribution channel and your trust in the binary build chain; both are addressable by building from source on Android.

Pick bitchat for: dense-Bluetooth scenarios where physical proximity is the use case (concerts, protests, dense urban areas, conference floors); jurisdictions where internet shutdowns are a real threat model (Uganda 2026 is the documented example; similar cases will recur); the Apple-ecosystem case where Briar's Android-first reach doesn't help; and any sovereignty-aligned stack where mainstream-app-store distribution matters for contact onboarding. Pair bitchat (Bluetooth mesh) with Briar (Bluetooth + WiFi-direct + Tor) and Reticulum + LXMF (LoRa mesh) for layered offline-capable messaging across physical-layer options.

---

## Tier 5: Nostr-rooted

The newest application-layer messaging stack. Your identity is a secp256k1 keypair you generated; messages are signed and (for DMs) encrypted, then published to one or more Nostr relays that you choose. No accounts on any server; relays can be operated by anyone; you can run your own.

Two architectural sub-tiers inside Nostr-rooted messaging: the protocol-level DM specification (NIP-17, used by most current clients) and the MLS-based approach via the Marmot protocol (used by White Noise). The two have meaningfully different threat-model properties; pick the right one for your use case.

### White Noise

The sovereignty-frontier Nostr messenger as of 2026[^whitenoise]. Built by Erskin Gardner (`erskingardner`) and Max Hillebrand (founder of Sound Money Solutions); aligned with the Bitcoin community. Built on the Marmot protocol[^marmot], which sits on top of three primitives: Nostr (identity and signaling), Blossom (Nostr file hosting standard for media), and MLS (RFC 9420 Messaging Layer Security for the cryptography).

What MLS gets you that NIP-17 doesn't:

- **Forward secrecy.** Compromise of current keys doesn't expose past messages; the ratchet is per-message, not per-conversation-key.
- **Post-compromise security.** The ratchet self-heals after compromise; future messages become inaccessible to an attacker who got the current key but doesn't keep getting them.
- **Native multi-device.** MLS treats each device as a leaf node in the group; you can join the same conversation from phone, laptop, and tablet without retransmitting messages to each pair-key separately. Each device holds its own keys; nothing about the multi-device support requires uploading a master key to any server.
- **Scaled group chat.** MLS was designed for groups of thousands without rekeying every pair separately on each membership change. Native group support that NIP-17 lacks.

Sender-recipient unlinkability over relays: Marmot wraps the MLS messages in Nostr events in a way that hides the actual participants from relay operators, similar to NIP-17's gift-wrapping but with MLS as the cryptographic floor instead of NIP-44.

Status: alpha. Mobile app via Apple TestFlight (Android paths under iteration); desktop builds available. Open-source alpha; the team explicitly requests audits and community feedback. Production-ready nowhere near; architecturally the most advanced Nostr messenger by some distance.

Pick White Noise if: you want forward secrecy and multi-device on Nostr-rooted identity, you can persuade your contacts to install an alpha-grade messenger, and you're aligned with the Bitcoin community's sovereignty frame. The architecture is what to learn from; deployment for daily use comes when the alpha stabilizes.

### Nostr DMs (NIP-17) and the client landscape

The protocol-level direct-message specification has gone through two NIPs (Nostr Implementation Possibilities):

- NIP-04: the original DM spec. Encrypted but leaked metadata (sender and recipient pubkeys visible to relays, plus message timestamps and event IDs). Deprecated.
- NIP-17: gift-wrapped DMs[^nip17]. The current spec. Three layers: a sealed event (NIP-59) wraps the actual message (NIP-44 encrypted) inside an unrelated-looking gift-wrap event with random keys. Relays see only the gift-wrap; sender and recipient identities and the timestamp are hidden from relay operators.

Most modern Nostr clients support NIP-17. The trade-offs versus Signal-style messengers (and versus White Noise specifically): no forward secrecy (NIP-44 uses long-term keys, not ratcheting) and no native multi-device key sync. Multi-device requires either sharing your nsec (the secret half of your Nostr keypair) across devices, or using remote-signing protocols like NIP-46 / NIP-49[^nip49] to keep the key in one place.

Client landscape:

- **Damus** (iOS, macOS): the most-polished iOS Nostr client. Built by William Casarin.
- **Amethyst** (Android): the most-featureful Android Nostr client. Built by Vitor Pamplona.
- **Iris** (web, Android): built by Martti Malmi (the same nostr-vpn author from `choosing-networking-tools.md`). Web-first; reasonable mobile experience.
- **0xchat** (iOS, Android, desktop): privacy-focused Nostr client, NIP-17 DMs as default, recently added group-chat support.
- **Primal** (iOS, Android, web): UX-polished cross-platform client; integrated Lightning wallet for zaps; sometimes feels closer to a Twitter-replacement than a messenger but the DM support is real.

### Status

Ethereum-rooted decentralized messenger, peer of the Nostr-rooted projects in spirit but built on the Waku protocol (libp2p-based) and the Logos network rather than Nostr relays. Identity is a public-key derived address; no email or phone; integrated cryptocurrency wallet.

Status has been in development for years; the project's positioning has shifted over time. Production-grade in 2026 but smaller user base than Nostr clients. Token-economic structure exists which is a flag for some sovereignty-minded operators (who prefer the Nostr-rooted projects' relay-as-a-service model over token-incentivized infrastructure).

Pick Status if: you're already Ethereum-aligned and prefer that protocol stack over Nostr; otherwise White Noise or NIP-17 clients are the more active sovereignty-frontier messengers.

### Capture-risk shape (Nostr-rooted, all variants)

Zero by construction if the implementation is correct and you choose relays you trust. Your keypair is yours; relays you can swap out; messages are encrypted such that relays can't read them. The remaining risk is the client itself (closed-source clients on closed-source app stores remain a closed-source-client-on-a-closed-source-app-store risk, the same as for any messenger).

What's mature: protocol-level NIP-17 support across many clients; identity portability across clients via your single nsec; relay portability by changing your relay list. What's young: White Noise as the production-grade MLS upgrade path; Marmot protocol standardization; cross-client UX for forward-secrecy expectations.

### Adjacent frontier: Pubky (Synonym)

Not a messenger today, and not Nostr-rooted.
This note is parked at the end of Tier 5 as a sovereignty-frontier watch entry beside the Nostr-rooted stack, because Pubky's stated comparison target is Nostr and a reader weighing Nostr will meet Pubky's claims.

Pubky is Synonym's open protocol for key-based identity and public data publishing.[^pubky]
It replaces accounts with an Ed25519 keypair: your public key (the project calls it your pubky) doubles as a sovereign domain name.[^pubky-repos]
PKARR (Public Key Addressable Resource Records) publishes small signed DNS-style records under that key to BitTorrent's Mainline DHT, a network of over ten million nodes, and PKDNS resolves those records like a DNS server.[^pubky-repos]
The record points at a homeserver: a conventional web server that stores your data per public key, grants apps write access only to the paths you approve, and serves everything under `/pub/` publicly by default.[^pubky]
Moving providers means republishing one PKARR record; the project calls this credible exit, and it is the architectural answer to the discovery contrast below.

The user-facing pieces: Pubky Ring (iOS and Android key manager, MIT, v1.15 June 2026) holds the keypair and authorizes apps; pubky.app is the beta reference social app; Pubky Explorer browses what any key has published.[^pubky-repos]
Signup to the flagship homeserver is gated by invite code, SMS verification, or a Bitcoin Lightning payment as anti-spam measures.[^pubky]
The SMS route links a phone number to the keypair, so anyone running an anonymous identity should take the invite or Lightning path, never SMS.

The Nostr contrast, which is the reason this note lives here.
Nostr replicates your events across whichever relays you choose; portability is your nsec plus a relay list, and discovery means querying relays and hoping the right ones hold your data.
Pubky keeps your data in one authoritative home and publishes a signed pointer to it on the DHT, so discovery is deterministic but availability hangs on a single homeserver until you migrate.
Synonym CEO John Carvalho positions Pubky as "a strict upgrade" to Nostr on exactly this discovery axis; treat that as the vendor's framing.[^pubky-nostr]
What Nostr has that Pubky does not: a far larger client and relay ecosystem, NIP-17 encrypted DMs in daily use, and Lightning zaps.
What Pubky has that Nostr does not: deterministic data location, and a DNS-replacement layer (PKDNS) that is useful beyond social.

Funding and capture-risk shape: Synonym Software was founded by Tether in November 2021, with Tether CTO Paolo Ardoino as Synonym's CTO at launch, the same single-sponsor concentration the Keet entry above and the Holepunch/Pear note in `choosing-networking-tools.md` carry; Pubky also succeeded Synonym's earlier Slashtags project, which ran on the same Hypercore stack Keet runs on.[^synonym-tether]
On the other side of the ledger everything is MIT-licensed open source with a Rust core, and homeservers are self-hostable, including a community Umbrel package.[^pubky-repos]

Status: beta and public-data-only.
There is no end-to-end encryption yet; the project's own FAQ states Pubky is currently optimized for public data, with private and encrypted features planned under Pubky Noise, which exists as an early Rust repository.[^pubky]
So today Pubky is an identity and public-publishing layer, not a messenger, and nothing sensitive belongs on a homeserver unless you encrypt it yourself first.
The sovereignty-complete configuration is a self-hosted homeserver; using the flagship homeserver is trusting one operator, softened by the migration path.
Revisit when Pubky Noise ships usable end-to-end encryption and signup ungates; until then this is a thing to try with throwaway data and to watch.

---

## Tier 6: Email-as-transport

The "use the protocol every internet user already has" tier.

### DeltaChat

A messenger UX over the email protocol. Sends and receives messages via standard IMAP/SMTP against any email provider. End-to-end encryption via Autocrypt (an OpenPGP profile designed for transparent in-band key exchange) by default with other DeltaChat users; falls back to ordinary unencrypted email with non-DeltaChat contacts.

The advantage: you can talk to anyone with an email address: they see an email; you see a chat. The disadvantage: the email infrastructure leaks the same metadata it always leaks (your provider sees who you talk to, when).

Pick DeltaChat if: you already have email, you want PGP-grade encryption without learning a separate app, and you have contacts who'll install it. Particularly useful in mixed-tech-comfort family networks where "I'll send you an email" works and "install this messenger" doesn't. For the email infrastructure DeltaChat rides on (which provider, self-hosting, encryption layers) see the Email section below.

---

## Tier 7: Radio-grade and off-grid

When the internet is unavailable and Bluetooth-range isn't enough. Network-layer treatment of these tools lives in `choosing-networking-tools.md`; this section covers the messaging layer on top.

### LXMF on Reticulum

Reticulum's messaging format. Reticulum is the network stack (covered in the other doc); LXMF is the application-level protocol that runs on top of it for store-and-forward messaging. Pair with Nomadnet (terminal-based) or Sideband (mobile, desktop) for the user-facing app.

Threat model: a fully sovereign messenger that works over LoRa radios, WiFi mesh, serial links, or Tor, any transport Reticulum supports. Cryptographic identity, end-to-end encryption, sender identity hidden from intermediate relays.

Pick LXMF if: you've decided to operate a Reticulum-capable mesh (RNode hardware, LoRa radios) and you want a messenger that runs natively on it. Also pick this for "messaging the bunker scenario" use cases where IP infrastructure can't be assumed.

### Meshtastic messaging

Meshtastic's built-in text messaging, over LoRa. Channel-based (groups of devices share a channel key). Floods messages across the mesh; works at small community-mesh scale (hiking groups, neighborhood resilience networks).

Pick Meshtastic messaging if: you've deployed Meshtastic hardware for the community-resilience reasons (cheaper than RNode, simpler protocol) and want messaging as one of the use cases. Not metadata-resistant in the way Reticulum is; not E2E-encrypted between specific pairs (channel-key based).

---

## What to avoid

**WhatsApp.** Meta-owned, phone-number-rooted, metadata extensively logged and shared with Meta's ad targeting graph. Cryptography (Signal Protocol) is fine; everything around the cryptography is the problem. The 2021 privacy-policy update explicitly authorized broader data sharing with Meta. Backups in iCloud/Google Drive are not E2E-encrypted by default.

**Telegram for anything sensitive.** Default chats are not end-to-end encrypted; only "Secret Chats" are, and they're not the default mode. Group chats are never end-to-end encrypted regardless of mode. Pavel Durov's 2024 arrest in France and Telegram's subsequent policy adjustments on cooperation with law enforcement closed a chapter where Telegram could be framed as a privacy tool; it never was, and the marketing has caught up.

**iMessage for cross-platform.** Apple-only end-to-end encryption. When messaging to an Android user it falls back to SMS or RCS (RCS over Google's network is also E2E now but the iMessage/RCS bridge had a turbulent rollout); the green-bubble cross-platform message often is not E2E. iCloud message backups are E2E only if Advanced Data Protection is explicitly enabled.

**Discord for anything you care about.** Not encrypted at rest from Discord's perspective. Discord employees can read your messages. The terms of service authorize this.

**Wickr.** Acquired by Amazon in 2021; AWS Wickr is now the only continuing product; the consumer Wickr Me product was end-of-lifed. Don't start new use on it.

**Snapchat, Instagram DMs, X DMs (formerly Twitter).** Not end-to-end encrypted by default; metadata extensively logged; the platforms' business models depend on the data. X has experimented with E2E DMs in limited capacity but the rollout has been incomplete.

---

## Where to start

Common scenarios.

**"I want a default messenger to use with my phone contacts."** Signal. The crypto is strong, the user base is large, and persuading one contact at a time to install it is a tractable project. Accept the phone-number flag or use the username feature for new contacts.

**"I want a sovereignty-aligned default with one or two contacts I can move with me."** SimpleX. Architecturally the strongest current mass-market-style messenger. The contacts who move with you will be the ones who care about the same things.

**"I want a messenger that works when the internet is down."** bitchat for the Bluetooth-mesh case (iOS plus Android, App Store reach, deployed in Uganda 2026); Briar for the Bluetooth-plus-Tor-plus-WiFi-direct case (Android-first; slower release velocity); Reticulum with LXMF for the LoRa/radio case; Meshtastic for the community-LoRa case.

**"I'm a journalist protecting sources."** Signal as the contact-acceptance default; SecureDrop for the actual source-onboarding flow; Cwtch for sources who are themselves metadata-sensitive. Read EFF's SSD on this scenario specifically.

**"I already use Nostr; I want my DMs to live there too, with forward secrecy and multi-device."** White Noise via the Marmot protocol. Accept that it's alpha-grade; contribute back when you find rough edges.

**"I already use Nostr and I'm fine with NIP-17 DMs for now."** Damus (iOS), Amethyst (Android), 0xchat (cross-platform), or Iris (web). Accept the no-forward-secrecy and no-native-multi-device trade-offs; plan to migrate to White Noise once it matures.

**"I want federation as a structural property."** Matrix via Element X (the MLS-future-proofed client) or XMPP via Conversations. Self-host the server for the sovereignty-aligned configuration. Pair with a homeserver you operate (Synapse for Matrix, Snikket for XMPP).

**"I want voice and video without a central server."** Jami. Self-hostable bootstrap nodes; no signup; works across desktop and mobile.

**"I want PGP-grade encryption but my contacts will only use email."** DeltaChat. Both sides install it; both sides keep using their existing email; the encryption is automatic.

**"I want every property at once."** You're picking a Pareto frontier. The sovereignty-aligned stacked stack: White Noise as primary (when stable), SimpleX as the SMS/Signal-replacement secondary, Briar as offline backup, LXMF on Reticulum as the off-grid layer. None of these is Signal in terms of contact reach; the trade-off is real.

---

## Maturity table

| Tool | Tier | Open source | Status | Forward secrecy | Multi-device | Capture-risk shape |
|------|------|-------------|--------|-----------------|--------------|---------------------|
| Signal | 1 | Yes (server lag) | Production, mature | Yes (Double Ratchet) | Yes (linked devices) | US Foundation; phone-number identity |
| Threema | 1 | Partial (client only) | Production, mature | Yes | Yes | Swiss company; paid; ID-based |
| Matrix / Element | 2 | Yes | Production | Yes (Olm/Megolm) | Yes | Federation; Element Software has had turbulence |
| Matrix / Element X | 2 | Yes | Migrating to MLS | Yes (MLS) | Yes | As above; MLS migration in progress |
| XMPP / Conversations | 2 | Yes | Production, mature | Yes (OMEMO) | Yes | Open standard; pick-your-server |
| SimpleX | 3 | Yes | Production, v6.5; Foundation launching | Yes (Double Ratchet, PQ-resistant) | Yes (mobile profile) | No user identifiers; commercial + foundation |
| Session | 3 | Yes | Production | No (deliberate trade) | Limited | Oxen Network token economy |
| Briar | 4 | Yes | Stable (slowed) | Yes | No (single-device) | None; P2P |
| Cwtch | 4 | Yes | Production | Yes | Limited | None; Tor-only |
| Jami | 4 | Yes (GPL-3) | Production, mature | Yes | Yes (account portability) | None; P2P over DHT |
| Berty | 4 | Yes | Production, smaller | Yes | Yes | None; P2P |
| Keet | 4 | Stack only (client closed) | Production | Not documented | Yes (device sync) | None; serverless P2P over DHT; Tether/Bitfinex-backed |
| bitchat | 4 | Yes | Production (iOS v1.5.x, Android v1.7.x) | Yes (Noise XX) | No (single-device) | None; Bluetooth-mesh-plus-Nostr-geohash |
| White Noise | 5 | Yes | Alpha | Yes (MLS) | Yes (MLS leaf nodes) | None by design; Nostr-rooted |
| Nostr DMs (NIP-17) | 5 | Yes | Production protocol; client UX varies | No | No native (nsec sharing or NIP-46) | None by design |
| Damus / Amethyst / 0xchat / Iris | 5 | Yes | Production | No (NIP-17 limit) | No native | None |
| Status | 5 | Yes | Production | Yes | Limited | Ethereum/Logos; token-economic |
| DeltaChat | 6 | Yes | Production | Limited (Autocrypt) | Per-account | Whatever your email provider's capture-risk is |
| LXMF on Reticulum | 7 | Yes | Production | Yes (ephemeral keys) | Limited | None |
| Meshtastic messaging | 7 | Yes | Production | No (channel keys) | No | None |

---

## Email

Everything above is messaging. This second half covers email, which is a different animal and deserves its own frame.

### Why email is structurally weaker than the messengers above

Email is a 1970s federated protocol. The store-and-forward design means the metadata (who you email, who emails you, timestamps, and the subject line in transit) leaks by construction. SMTP between servers is opportunistically encrypted (TLS if both ends support it, plaintext fallback otherwise), and the message sits decrypted on the receiving server unless you've layered encryption on top. End-to-end encryption (PGP) is bolted on, not native, and even when used it protects the body, not the metadata.

The realistic goal for email is therefore narrower than for the messengers: provider trust plus encryption-at-rest plus optional PGP for body content. You do not get the metadata elimination that SimpleX or the gift-wrapped Nostr DMs achieve. The honest baseline, stated once and meant: for genuinely sensitive communication, use a messenger from the first half of this doc, not email. Email is for the half of your life that has to interoperate with everyone else's email, which is most of it, which is why this section exists.

The capture-risk frame for email asks three questions, same shape as the messenger frame: who can read the body (the provider, unless E2E), who can see the metadata (always the provider and the network, PGP doesn't fix this), and what's the provider's incentive (subscription, donation, or advertising-against-your-content).

### Encrypted-mailbox providers

These encrypt your mailbox at rest with a key derived from your password, so the provider cannot read stored mail. Two catches apply to all of them. First, the encryption is end-to-end only between users of the same provider; mail to an outside address either goes out plaintext (subject to normal SMTP TLS) or uses a password-protected-link workaround. Second, and more important for the open-source lens this doc applies, their clients are open source but their servers are not, and even where source is published you cannot verify that the server you are talking to actually runs it, so an encrypted-mailbox provider is a trust-the-operator model no matter how good the client. That trust is bounded by a single company in a single jurisdiction, and both leading providers have a documented case of being legally compelled to act against a user, below.

**Proton Mail.** Swiss, operated by Proton AG under the non-profit Proton Foundation, in service since 2014. Zero-knowledge encryption at rest, open-source clients across platforms (the server is not open source), post-quantum cryptography rolling out, the most polished UX in the category, and a broader stack (Mail, VPN, Calendar, Drive, Pass) if you want one vendor for several things. The Bridge app provides IMAP/SMTP to desktop clients such as Thunderbird and nmail by running a local decryption proxy.

How Proton has misbehaved, on the record. In 2021 Proton received a legally binding order from the Swiss Federal Department of Justice, originating with French police and routed through Europol, and was compelled to log and hand over the IP address and device type of an account used by the Youth for Climate collective in Paris, which led to an arrest[^proton-ip]. Message contents were never exposed because the zero-access encryption held, but the metadata was, and the episode mattered because Proton's homepage had until then boasted that it kept no IP logs and put your privacy first; Proton quietly deleted that boast and reworded its privacy policy to state that a user under Swiss criminal investigation can be compelled to have their IP logged. The structural lesson is the one that recurs in this section: zero-access encryption protects stored content, but a single-jurisdiction provider can be forced to log IP and metadata on a targeted account going forward, and marketing that implied otherwise was overstatement corrected only after it was caught.

On the controlled-opposition charge. Parts of the privacy and Bitcoin community characterize Proton as controlled opposition, a service that exists to gather privacy-seekers into one auditable place, pointing to the IP-logging episode, Proton's 2022 World Economic Forum Technology Pioneer designation, and CEO Andy Yen's December 2024 public praise for a Trump antitrust nominee[^proton-ip]. The primary-source record supports the narrower claims, namely Swiss court-compulsion exposure, a marketing-versus-reality reversal, and establishment-adjacent signaling a sovereignty-minded reader may legitimately weigh, but it does not establish the strong claim of deliberate intelligence control: Proton is governed by a non-profit foundation, is headquartered outside the Five and Fourteen Eyes alliances, and the Yen episode was a narrow antitrust comment the company walked back as not reflecting an official position. Treat the strong-form label as an unproven inference, and treat the narrower facts as the actual basis for deciding how much to trust a Swiss single-company mailbox.

Pick Proton if you want the most-polished encrypted mailbox, you accept Swiss-single-company trust and the court-compulsion exposure above, and an open client is enough verification for you in the absence of an open server.

**Tuta.** German, operated by Tutao GmbH since 2011, renamed from Tutanota in November 2023[^tuta]. Encrypts more than the others, subject lines included, using its own TutaCrypt protocol with post-quantum key exchange rather than PGP, and its clients are open source. The hard trade: no PGP interoperability and no IMAP/SMTP at all, so you are locked to Tuta's own clients (web, desktop, mobile) with no third-party-client escape hatch, at the cheapest paid tier in the category.

How Tuta has misbehaved, on the record, with the important caveat that Tuta fought it. In 2020 a regional court in Cologne ordered Tutanota to build a function to monitor a single account used in a blackmail case, and in 2021 Germany's Federal Court of Justice upheld a version of this, requiring three months of monitoring across the implicated accounts[^tuta-courts]. The monitoring applies only to mail the account receives after the order and delivers only unencrypted messages, since Tuta cannot decrypt content already stored at rest; Tuta argued all the way to the Federal Court that it is not a telecommunications service, and lost. Germany is a Fourteen-Eyes jurisdiction under strong GDPR-plus protections. The lesson mirrors Proton's: at-rest encryption protects stored mail, but a single-jurisdiction provider can be compelled to monitor future incoming mail on a targeted account, and resisting the order in court delays it rather than defeating it.

Pick Tuta if subject-line encryption, an open client, and price matter more than PGP interop and client freedom, and you accept German-single-company trust and the court-compulsion exposure above.

The structural catch worth repeating: encrypted-mailbox providers solve at-rest confidentiality against the provider, not metadata exposure and not in-transit confidentiality to non-users. They are a real improvement over Gmail; they are not a messenger.

### Privacy-respecting standard providers

These run ordinary IMAP/SMTP (so any client works) and compete on policy and jurisdiction rather than on cryptographic-at-rest gimmicks. You trust the provider not to read your mail rather than making it cryptographically impossible. The trade is interoperability and client freedom in exchange for giving up the at-rest guarantee Proton and Tuta offer.

**Posteo** (German, in service since 2009, around one euro per month, runs on green energy, strips IP metadata from outgoing mail, anonymous signup and payment, no custom domains). **Mailbox.org** (German, since 2014, supports custom domains, integrated office suite, PGP via the webmail with server-side key handling as an option). **Disroot** (Dutch, a donation-funded collective running on free software since 2015, part of a broader libre-services suite, activist-aligned). **Mailfence** (Belgian, run by the long-established ContactOffice group, built-in PGP keystore, calendar and documents, custom domains). These run proprietary server stacks, Disroot excepted (its stack is free software), and in every case you are trusting the operator rather than verifying the server, the same bound as the encrypted-mailbox providers but without the at-rest guarantee.

Pick one of these if you want client freedom (use Thunderbird, nmail, neomutt, whatever), custom-domain support, or a specific privacy-respecting jurisdiction, and you're comfortable with provider-trust rather than zero-knowledge as the model. Posteo and Mailbox.org are the two most-recommended in privacy circles; Disroot if the activist-collective alignment fits.

### Newer and unproven, and why longevity matters

This doc treats how long a service has operated as a security signal, so newer entrants get a maturity stamp rather than a recommendation, and recently-shut-down services get named as the reason why.

**AtomicMail.** A new encrypted-mailbox service, EU-based (an Estonian company with servers in Germany, GDPR-compliant), whose mobile client shipped in 2025[^atomicmail]. It offers zero-access encryption, anonymous signup with no phone number, and seed-phrase account recovery. Two things keep it out of the recommended set on this doc's own criteria. First, it is not fully open source: its code is not fully published, which by the open-source-is-a-floor lens means its behavior is taken on faith, and it carries a higher trust requirement than even Proton or Tuta. Second, it uses its own proprietary Atomic Encryption (built on AES-256 and ECIES) rather than OpenPGP, which reproduces Tuta's client lock-in without Tuta's decade of operation, and there is no published independent security audit. The encryption claims may well be sound; the point is that with a closed, unaudited, very young service you cannot check, and the whole reason to leave Gmail is to stop taking such things on faith. Revisit AtomicMail if it opens its source and publishes an independent audit; until then it is one to watch, not one to trust with anything that matters.

**Skiff, the cautionary tale.** Skiff was a polished end-to-end-encrypted mail, calendar, and document suite, founded in 2020, partially open source, and well funded, having raised 14.2 million dollars from investors including Sequoia[^skiff]. In February 2024 it was acquired by Notion, and by August 2024 the entire product was shut down, with mail forwarding limping on only until February 2025, leaving users to migrate everything out under a deadline. The lesson is the one this doc builds the longevity lens around: a slick, partly-open, VC-funded privacy startup is the profile most likely to be acquired and killed, because the funding model points at an exit rather than at operating the same service for twenty years. Weight a provider's years in operation and its funding model accordingly, and prefer the boring decade-old options for anything you cannot afford to migrate on someone else's timeline.

### Self-hosted mail

Maximum sovereignty, highest operational cost in this entire project series. Running your own mail means you control everything and trust no provider; it also means you own the single hardest self-hosting problem there is.

**Stalwart.** The sovereignty-frontier pick[^stalwart]. Rust, single binary, AGPL-3, native JMAP (RFC 8621, the modern API that supersedes IMAP) plus IMAP4rev2, POP3, SMTP, CalDAV, CardDAV, WebDAV, the whole stack in one process where the traditional approach chains Postfix, Dovecot, and Rspamd. Built-in DKIM/SPF/DMARC/ARC, statistical spam filter, web admin, automatic TLS via ACME, encrypted-at-rest mailboxes, OpenID Connect for SSO. Two independent security audits by Radically Open Security. Runs comfortably on a 512MB-1GB VPS. The modern choice; smaller community than mailcow but the trajectory is clear.

**mailcow.** The battle-tested pick. Docker-compose stack (Postfix, Dovecot, Rspamd, SOGo webmail, admin UI), mature, well-documented, large community, the safe default if you want a full email server replacing Google Workspace. Heavier than Stalwart (2GB+ RAM). **Maddy** (Go, single binary, simpler and smaller scope than either; good for a personal domain). **Mailu** (Docker, Postfix/Dovecot-based, simpler than mailcow).

The hard truth, named prominently because every "self-host your mail" pitch glosses it: deliverability is the problem, not the software. To not land in Gmail's and Outlook's spam folders you need four correct DNS records (MX, SPF, DKIM, DMARC), a matching PTR reverse-DNS record, and (critically) a sending IP with clean reputation that isn't on any blocklist. Residential ISP connections fail this by default: port 25 is commonly blocked outbound, and residential IP ranges are blocklisted as a class. So self-hosted mail belongs on a VPS with a clean IP and unblocked port 25, not on a home connection, unless you front outbound mail through a relay.

**StartOS, and why home-hosted mail is the hard case.** StartOS (Start9, formerly EmbassyOS; renamed; 0.4.0 unveiled March 2026; MIT-licensed, Rust backend; serves a graphical interface as a private website; runs services over Tor v3 with clearnet hosting also supported)[^startos] is the leading plug-and-play sovereign-computing OS: it lets non-sysadmins discover, install, configure, back up, and monitor self-hosted services on a home appliance from a web UI. For Nextcloud, a Bitcoin full node, Vaultwarden, a Lightning node, media servers, and most of the self-hosting catalog, it is an excellent answer and squarely in this project's sovereignty frame. Start9 sells preflashed Server One hardware or you can DIY-install on your own box.

Mail is the exception, and it's worth being precise about why. StartOS does not currently ship a turnkey mail server in its marketplace (its FAQ confirms a service has to meet packaging requirements and mail isn't a first-class offering today). More fundamentally, a StartOS box lives on your home connection, exactly the residential-IP, port-25-blocked, blocklisted-by-class situation that makes home-hosted outbound mail land in spam. So StartOS is a great home for self-hosted services generally and a legitimate host for a relay-fronted mail setup (where a clean-IP VPS or a transactional relay handles outbound delivery and your StartOS box holds the mailboxes), but it is not a one-click fix for the thing that actually makes self-hosted mail hard. If your goal is sovereign mail specifically, a Stalwart instance on a clean-IP VPS is the more honest path than mail on a home appliance. StartOS's fuller treatment as a sovereign-computing platform belongs in `os.md`; here it's named for the self-hosted-mail-deployment question only.

### The ladder to self-hosted mail

Sovereign mail is a climb, not a switch, and the single move that makes the climb possible is owning a custom domain from the start, because then every rung is a provider swap rather than a change of address that breaks all your accounts and contacts. The rungs, in increasing order of control and operational cost:

Rung 0, harden a hosted mailbox. Use Proton or Tuta for at-rest encryption, add per-service aliases (below), and add PGP for bodies where a correspondent supports it. You own nothing yet, but you have shrunk what the provider and a passive network can see.

Rung 1, standard provider on your own domain. Move to Posteo or Mailbox.org on a custom domain you control. You still trust the operator, but the address is now yours, so the rest of the ladder no longer costs you your identity.

Rung 2, provider holds the mailboxes, you hold the domain and the keys. Keep a hosted mailbox but treat it as replaceable infrastructure: your domain, your PGP keys, your aliases, and a local archive in Thunderbird or nmail. At this point you can change providers in an afternoon.

Rung 3, self-host on a clean-IP VPS. Run Stalwart (or mailcow) on a VPS with a clean IP and unblocked port 25. You now control and can audit the whole stack, and the only thing you are renting is the IP reputation, which is the hard part of email. This is the honest sovereign-mail endpoint for most people.

Rung 4, self-host at home, relay-fronted. Hold the mailboxes on your own hardware or a StartOS box at home, and front outbound delivery through a clean-IP relay so your residential, port-25-blocked, blocklisted-by-class connection does not sink your mail into spam folders. Maximum control, maximum operational burden, worth it only if you will keep it running.

The deliverability problem from the self-hosted section sets where the climb gets steep: rungs 0 through 2 inherit someone else's clean IP, rung 3 rents a clean one, and rung 4 is hard precisely because a home connection cannot supply one. Climb only as high as you will maintain.

### Encryption layers on top of any email

Independent of provider, you can add body encryption.

**PGP / OpenPGP.** Thunderbird has OpenPGP built in (no Enigmail plugin needed since Thunderbird 78). This is the standard way to encrypt email bodies end-to-end across any provider, provided your correspondent also uses PGP. The honest limitations: key management is a real burden, there's no forward secrecy (compromise of your long-term key exposes all past mail encrypted to it), and the metadata still leaks. These limitations are precisely why the messenger tiers in the first half of this doc exist. For the mechanics of PGP keys, hardware-token storage, and the web-of-trust, see `gpg-concepts.md` rather than re-deriving it here.

**age-encrypted attachments.** For sending a sensitive file over any email, encrypting it with age (a modern, simple file-encryption tool, see `choosing-encryption-tools.md`) and attaching the ciphertext sidesteps the PGP-email complexity entirely: the email is just a transport for an independently-encrypted blob. Lower-ceremony than PGP-email for the specific case of "send this one file securely."

**Autocrypt.** The in-band key-exchange profile that DeltaChat (Tier 6 above) uses to make PGP transparent. Some other clients support it. It trades a little security (keys exchanged opportunistically in headers) for the usability that hand-managed PGP lacks.

### Email clients

Per the apt-primary, build-from-source-only-when-needed approach: most of these are in Debian/Devuan repositories.

**Thunderbird / Betterbird.** The default graphical client, cross-platform, OpenPGP built in, works with any IMAP/SMTP provider and with Proton via the Bridge. Betterbird is a Thunderbird fork with extra features and fixes, for users who want them. The right default for most people.

**Terminal clients.** **neomutt** (the actively-maintained mutt fork, maximally configurable, the long-standing power-user choice). **aerc** (modern, async, Git-friendly, good for plaintext and patch workflows). **nmail** (d99kris; C++/ncurses; IMAP+SMTP; local cache in optionally-AES256-encrypted SQLite; address book auto-generated from messages; Alpine/Pine-style UI; setup wizards for Gmail/iCloud/Outlook; compose in `$EDITOR`, view in `$PAGER`; MIT; v5.11.4)[^nmail]. **meli** (Rust terminal client, newer). nmail's distinguishing traits for this audience: the encrypted local cache and the familiar Pine-style interface; note it's deliberately not designed to interoperate with other clients' Maildir, so treat it as a self-contained client rather than one tool in a multi-client setup.

**Mobile.** **Thunderbird for Android** (formerly K-9 Mail, which Thunderbird adopted and rebranded) and **FairEmail** (privacy-focused, granular controls) on Android; on iOS the choices are more constrained, with Proton's and Tuta's own apps the sovereignty-aligned options for those providers.

### Aliasing and forwarding

A unique email alias per service means a breach or data-sale at one service exposes only that alias, and you can sever any sender by killing one alias without changing your real address. Sovereignty-aligned because it decouples your identity from any single provider and from the senders.

**SimpleLogin** (open-source, now Proton-owned, self-hostable). **addy.io** (formerly AnonAddy; open-source, self-hostable, generous free tier). **Firefox Relay** (Mozilla, simplest, fewest features). Pick SimpleLogin or addy.io for the self-hostable open-source options; both can run on your own domain so the aliasing itself doesn't introduce a new trusted third party.

### What to avoid for email

**Gmail, Outlook / Microsoft 365, Yahoo for anything sensitive.** Content is scanned, the business model monetizes what it learns about you, and the mailbox is readable by the provider and anyone who compels the provider. Fine for low-stakes mail and mailing-list signups; not for anything you'd mind being read. The "free that isn't a free tier of a paid product" frame from `choosing-networking-tools.md` applies identically: if the email is free and the company is an advertising company, you are the product.

### Email maturity table

| Tool | Type | Open source | Status | Capture-risk shape |
|------|------|-------------|--------|---------------------|
| Proton Mail | Encrypted mailbox | Client only | Production, mature (since 2014) | Swiss single company; zero-knowledge at rest; court-compulsion exposure |
| Tuta | Encrypted mailbox | Client only | Production, mature (since 2011) | German single company; no IMAP/PGP; subject-line encryption; court-compulsion exposure |
| AtomicMail | Encrypted mailbox | No | Newer; not recommended (mobile 2025) | EU single company; proprietary crypto; unaudited |
| Posteo | Privacy standard provider | No | Production (since 2009) | German single company; provider-trust model |
| Mailbox.org | Privacy standard provider | No | Production (since 2014) | German single company; custom domains |
| Disroot | Privacy standard provider | Yes (FOSS stack) | Production (since 2015) | Dutch donation collective |
| Mailfence | Privacy standard provider | No | Production (since 2013) | Belgian single company; built-in PGP |
| Stalwart | Self-hosted server | Yes (AGPL-3) | Production (Rust, audited) | None (your VPS); deliverability is the cost |
| mailcow | Self-hosted server | Yes | Production, mature | None (your VPS); deliverability is the cost |
| Maddy | Self-hosted server | Yes | Production, smaller | None (your VPS) |
| StartOS | Self-hosting platform | Yes (MIT) | Production (0.4.0) | None; but home-IP mail deliverability is hard; no turnkey mail service today |
| Thunderbird / Betterbird | Client | Yes | Production, mature | Client only |
| neomutt / aerc / nmail / meli | Client (terminal) | Yes | Production | Client only |
| SimpleLogin | Aliasing | Yes | Production | Proton-owned; self-hostable |
| addy.io | Aliasing | Yes | Production | Self-hostable |

---

[^simplex-no-ids]: SimpleX Chat, project home page: <https://simplex.chat/>. "The first messenger without user IDs. Other apps have user IDs: Signal, Matrix, Session, Briar, Jami, Cwtch, etc. SimpleX does not, not even random numbers. ... To deliver messages, instead of user IDs used by all other platforms, SimpleX uses temporary anonymous pairwise identifiers of message queues, separate for each of your connections, there are no long term identifiers."

[^simplex-tob]: SimpleX Chat blog, *SimpleX network: cryptographic design review by Trail of Bits, v6.1 released with better calls and user experience*, 14 October 2024: <https://simplex.chat/blog/20241014-simplex-network-v6-1-security-review-better-calls-user-experience.html>. The Trail of Bits review followed an earlier 2022 audit: <https://simplex.chat/blog/20221108-simplex-chat-v4.2-security-audit-new-website.html>.

[^simplex-consortium]: SimpleX Chat blog, *SimpleX Channels, SimpleX Network Consortium and Community Crowdfunding, to Preserve Freedom of Speech*, 30 April 2026: <https://simplex.chat/blog/20260430-simplex-channels-v6-5-consortium-crowdfunding-freedom-of-speech.html>. "No single company should control protocols and network that people depend on to speak freely. ... we're launching SimpleX Network Consortium within a few months, the agreement between the new SimpleX Network Foundation and SimpleX Chat company that will govern protocols and licensing, perpetual, irrevocable, surviving if any party is sold or shut down."

[^nip17]: Nostr Improvement Possibilities, *NIP-17: Private Direct Messages*: <https://github.com/nostr-protocol/nips/blob/master/17.md>. Specifies gift-wrapped DMs using NIP-44 encryption (versioned ChaCha20-Poly1305) inside NIP-59 sealed events, with a third gift-wrap event using random keys to hide sender and recipient identities from relays.

[^mimi]: IETF More Instant Messaging Interoperability (MIMI) Working Group: <https://datatracker.ietf.org/wg/mimi/about/>. Active drafts as of early 2026: *An Architecture for More Instant Messaging Interoperability* (draft-ietf-mimi-arch, R. Barnes, Cisco): <https://datatracker.ietf.org/doc/draft-ietf-mimi-arch/>; *More Instant Messaging Interoperability (MIMI) using HTTPS and MLS* (draft-ietf-mimi-protocol, R. Barnes / M. Hodgson / K. Kohbrok / R. Mahy / T. Ralston / R. Robert): <https://datatracker.ietf.org/doc/draft-ietf-mimi-protocol/>; *Room Policy for the MIMI Protocol* (draft-ietf-mimi-room-policy, R. Mahy): <https://datatracker.ietf.org/doc/draft-ietf-mimi-room-policy/>; *MIMI message content* (draft-ietf-mimi-content, R. Mahy): <https://datatracker.ietf.org/doc/draft-ietf-mimi-content/>.

[^nip49]: Nostr Improvement Possibilities, *NIP-49: Private Key Encryption*: <https://github.com/nostr-protocol/nips/blob/master/49.md>. Specifies a `ncryptsec` format for password-encrypted Nostr private keys, the Nostr analog of an encrypted SSH or GPG private key.

[^whitenoise]: White Noise, project home page: <https://www.whitenoise.chat/>. GitHub repository: <https://github.com/parres-hq/whitenoise> and Rust core at <https://github.com/marmot-protocol/whitenoise-rs>. Architectural summary from the project FAQ as cited by gigazine.net coverage, 14 July 2025: <https://gigazine.net/gsc_news/en/20250714-whitenoise-chat-secure-messaging-nostr/>. Atlas21 founder interview with Max Hillebrand, 21 July 2025: <https://atlas21.com/white-noise-is-born-the-private-messaging-app-based-on-nostr/>. Bitcoin Magazine launch coverage: <https://bitcoinmagazine.com/news/white-noise-anonymous-nostr-dms-and-encrypted-group-chat>. Apple TestFlight beta: <https://testflight.apple.com/join/c6Z7PpxC>.

[^marmot]: Marmot Protocol, organization on GitHub: <https://github.com/marmot-protocol>. Combines Nostr (identity, signaling), Blossom (file hosting on Nostr), and MLS (RFC 9420 Messaging Layer Security) into a single protocol stack for sovereign messaging. White Noise is the reference application.

[^bitchat]: bitchat, GitHub organization: <https://github.com/permissionlesstech>. iOS repository: <https://github.com/permissionlesstech/bitchat>. Android repository: <https://github.com/permissionlesstech/bitchat-android>. Technical whitepaper: <https://github.com/permissionlesstech/bitchat/blob/main/WHITEPAPER.md>. Jack Dorsey's launch announcement on X, 6 July 2025; Engadget coverage of the iOS App Store release, 28 July 2025: <https://tech.yahoo.com/apps/articles/jack-dorseys-bluetooth-messaging-app-185000506.html>. "and Other Stuff" is Dorsey's open-source development collective backing the project. Uganda 2026 election adoption documented in 2026 coverage of opposition leader Bobi Wine urging citizens to use bitchat ahead of anticipated internet shutdowns; Google Trends documented the corresponding Uganda search-interest surge. Wikipedia summary entry: <https://en.wikipedia.org/wiki/BitChat>.

[^tuta]: Tuta (formerly Tutanota), project site: <https://tuta.com/>. Rebranded from Tutanota to Tuta on 7 November 2023 (former tutanota.com redirects to tuta.com). German company Tutao GmbH, established 2011, over 10 million users as of June 2023. TutaCrypt post-quantum encryption protocol; encrypts subject lines, bodies, and attachments at rest; no PGP interoperability and no IMAP/SMTP (clients only). Wikipedia entry: <https://en.wikipedia.org/wiki/Tuta_(email)>.

[^stalwart]: Stalwart Mail Server, project site: <https://stalw.art/>. GitHub: <https://github.com/stalwartlabs/stalwart>. All-in-one mail and collaboration server in Rust (SMTP, IMAP4rev2, POP3, JMAP, CalDAV, CardDAV, WebDAV), AGPL-3, by Stalwart Labs Ltd. Built-in DKIM/SPF/DMARC/ARC, statistical spam filter, ACME TLS, encrypted-at-rest mailboxes, OIDC SSO. Two independent security audits by Radically Open Security. NLnet/NGI0 funding history: <https://nlnet.nl/project/Stalwart/>.

[^startos]: StartOS by Start9 Labs (formerly EmbassyOS), project site: <https://start9.com/>. GitHub: <https://github.com/Start9Labs/start-os>. MIT-licensed Linux distribution for self-hosting; graphical interface served as a private website; services historically run over Tor v3 with clearnet hosting supported (Tor requirement dropped following OS v0.4.0). 0.4.0 unveiled by Start9 CEO Matt Hill on 27 March 2026. Marketplace of self-hosted services: <https://marketplace.start9.com/>. Per the Start9 services FAQ, not every self-hosted service is packaged and mail is not a first-class turnkey offering. Founded 2020 in Denver, Colorado.

[^nmail]: nmail by Kristofer Berggren (d99kris), GitHub: <https://github.com/d99kris/nmail>. Terminal-based email client for Linux and macOS, C++/ncurses, Alpine/Pine-style UI. IMAP and SMTP; local cache in optionally-AES256-encrypted SQLite; auto-generated address book; setup wizards for Gmail, iCloud, and Outlook/Hotmail; compose in `$EDITOR`, view in `$PAGER`. MIT License; v5.11.4 (March 2025). Per its documentation, deliberately not designed to interoperate with other clients' Maildir.

[^proton-ip]: Proton Mail's 2021 logging episode and 2024 political controversy. TechCrunch, "ProtonMail logged IP address of French activist after order by Swiss authorities," 6 September 2021: <https://techcrunch.com/2021/09/06/protonmail-logged-ip-address-of-french-activist-after-order-by-swiss-authorities/>. Proton stated it received a legally binding order from the Swiss Federal Department of Justice, originating with French police via Europol, concerning an account used by the Youth for Climate collective in Paris; message contents were not accessed. Threatpost, "ProtonMail Forced to Log IP Address of French Activist," 7 September 2021, documents the removal of the "we don't log your IP" claim from the homepage and the reworded privacy policy: <https://threatpost.com/protonmail-log-ip-address-french-activist/169242/>. Andy Yen's December 2024 praise of the Gail Slater antitrust nomination and Proton's subsequent neutrality statement: The Intercept, "Proton Mail Says It's 'Politically Neutral' While Praising Republican Party," 28 January 2025: <https://theintercept.com/2025/01/28/proton-mail-andy-yen-trump-republicans/>. Proton's non-profit governance and non-Five/Fourteen-Eyes jurisdiction are the structural facts that weigh against the strong-form controlled-opposition reading.

[^tuta-courts]: Tuta (Tutanota) court-ordered monitoring. TechCrunch, "German secure email provider Tutanota forced to monitor an account, after regional court ruling," 8 December 2020: <https://techcrunch.com/2020/12/08/german-secure-email-provider-tutanota-forced-to-monitor-an-account-after-regional-court-ruling/>. The Cologne regional court ordered a monitoring function for a single account in an extortion case, applying only to mail received after the order and delivering only unencrypted messages, since at-rest content cannot be decrypted. CyberScoop, "Court rules encrypted email provider Tutanota must monitor messages," May 2021, reports the Federal Court of Justice (BGH) requiring three months of monitoring across the implicated accounts after Tutanota argued it is not a telecommunications service: <https://cyberscoop.com/court-rules-encrypted-email-tutanota-monitor-messages/>.

[^atomicmail]: Atomic Mail, project site: <https://atomicmail.io/>. Estonian company (Tallinn) with servers in Germany, GDPR-compliant; zero-access architecture using a proprietary "Atomic Encryption" built on AES-256 and ECIES rather than OpenPGP; anonymous signup with seed-phrase recovery. Mobile web client launched 25 March 2025 per the company announcement carried by Barchart: <https://www.barchart.com/story/news/31558429/atomic-mail-releases-mobile-version-for-private-email>. Independent assessment that its code is not fully open and that it carries a higher trust requirement than Tuta or Proton: the GitHub-hosted email-provider comparison at <https://opensourcereviews.github.io/email/index.html>.

[^skiff]: Skiff (email service). Founded 2020 by Andrew Milich and Jason Ginsberg; raised 14.2 million dollars from investors including Sequoia; acquired by Notion in February 2024; all services shut down 9 August 2024 with mail forwarding continuing only until 9 February 2025; partially open source. TechCrunch, "Notion acquires privacy-focused productivity platform Skiff," 9 February 2024: <https://techcrunch.com/2024/02/09/notion-acquires-privacy-focused-productivity-platform-skiff/>. Wikipedia entry, "Skiff (email service)": <https://en.wikipedia.org/wiki/Skiff_(email_service)>.

[^keet]: Keet by Holepunch, project site: <https://keet.io/>. Backed by Tether and Bitfinex; built on the Pear Runtime and the Hypercore protocol (Holepunch GitHub organization: <https://github.com/holepunchto>); serverless peer-to-peer over a distributed hash table, end-to-end encrypted text, voice, and video with Bitcoin Lightning and USDT payments; launched 2022. The Pear Runtime, Hypercore, and Hyperswarm are open source under permissive licenses; the Keet client application itself is not open source, packaged by NixOS as unfree (<https://github.com/NixOS/nixpkgs/issues/208506>), and a 2022 intention to open-source the app remains substantially unfulfilled as of 2026.

[^pubky]: Pubky Core documentation: <https://pubky.org/>. Getting-started flow documenting Pubky Ring install, the invite/SMS/Lightning signup gates, path-scoped app authorization, and `/pub/` being public by default: <https://pubky.org/getting-started/>. FAQ stating the MIT license, that Pubky is currently optimized for public data with private and encrypted features planned via Pubky Noise, and that Slashtags was the predecessor Synonym project on Hypercore: <https://pubky.org/faq/>. Retrieved June 2026.

[^pubky-repos]: Pubky GitHub organization: <https://github.com/pubky>. pubky-core (MIT, Rust, "an open protocol for per-public-key backends for censorship resistant web applications"), pkarr (MIT, Rust; README states Ed25519 keys and publication to the BitTorrent peer-to-peer network of over ten million nodes), pkdns (MIT, Rust, a DNS server resolving pkarr self-sovereign domains), pubky-ring (MIT, TypeScript/React Native; v1.15 released 2 June 2026; site <https://pubkyring.app/>), pubky-noise (Rust, early), and a community Umbrel App Store repository hosting the Pubky Homeserver. All actively pushed as of June 2026.

[^pubky-nostr]: Bitfinex blog, "What is Pubky?", interview with Synonym CEO John Carvalho, August 2025: <https://blog.bitfinex.com/education/what-is-pubky/>. Carvalho calls Pubky "a strict upgrade" to Nostr and argues that Nostr lacks a discovery method once a hosting server censors a user, whereas Pubky resolves the current data location via PKDNS.

[^synonym-tether]: Cointelegraph, "Tether launches Synonym to boost Bitcoin adoption through Lightning Network," 16 November 2021: <https://cointelegraph.com/news/tether-launches-synonym-to-boost-bitcoin-adoption-through-lightning-network>, reporting Synonym Software as a company founded by Tether Holdings. Launch coverage recording Tether and Bitfinex CTO Paolo Ardoino as Synonym's CTO at launch: Bitcoin Takeover, "John Carvalho Presents Synonym," 16 November 2021: <https://bitcoin-takeover.com/john-carvalho-presents-synonym-the-hyperbitcoinization-company/>. Tether's own newsroom pairing the companies in the Pear Credit announcement, 28 October 2022: <https://tether.io/news/tether-holepunch-and-synonym-launch-pear-credit-a-p2p-credit-system/>. The synonym.to footer carries a Tether endorsement mark; current legal entity Synonym Software, S.A. DE C.V. Retrieved June 2026.