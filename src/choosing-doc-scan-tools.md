# Choosing Document Scanning Tools

A comparison of the open-source tools that vet PDF, EPUB, and other documents on a Devuan workstation before you open them. Parallel in structure to `choosing-hids-tools.md` and `choosing-encryption-tools.md`. Recommends a specific stack at the end; the rest of the document is the reasoning that defends the recommendation.

If you came here from `security-overview.md` looking for the input-vetting specialist, the short answer is: ClamAV plus Didier Stevens' pdfid suite plus YARA, with VirusTotal as an optional consensus check and Firejail as the open-it-safely layer. Operational companion is `doc-malware-scan.sh` in this project. Read the rest if you want to understand why those and not the alternatives.


## TL;DR

Document scanning is the layer between "this PDF arrived" and "I'm now reading it." It does not prevent attacks; it catches known-bad and flags suspicious-structured documents before you open them. The tools are mostly mature, mostly in Debian and Devuan repositories, and require modest configuration to be useful.

The standard stack: ClamAV for signature matching, Didier Stevens' pdfid plus pdf-parser for PDF structural triage, YARA for rule-based pattern matching, Firejail as the sandboxed-opening layer. Four tools, each doing one thing well, plus optional VirusTotal hash lookup for multi-engine consensus. Total configuration time on a fresh install: a one-time `apt install`, a small Didier Stevens download, and an optional YARA-rules clone.

The operational companion is `doc-malware-scan.sh` in this project, which wires all of these together with first-run auto-install and folder-recursion support.

Tools that compete with ClamAV in the open-source AV space (Linux Malware Detect / maldet) lose on coverage and freshness. Tools in the same category as pdfid for PDF analysis (peepdf, mutool) are complementary rather than replacements. Sandboxed-reader alternatives to Firejail (Bubblewrap, Flatpak's portal model) are usable but require more setup.


## What document scanning means and what it doesn't

Document scanning is a category that sometimes gets confused with antivirus generally and with HIDS specifically. It's neither. Distinguishing the categories before naming the tools makes the trade-offs clearer.

**Structural analysis.** Decompose a document into its constituent objects and report on suspicious structural features. For PDFs: embedded JavaScript, launch actions, font-decoder paths historically used for exploits, embedded files. pdfid lists; pdf-parser walks. PDFs only. Latency: seconds. Output: a feature inventory. This is forensic triage, not a verdict.

**Signature scanning.** Match the file against a database of known-bad hashes and byte patterns. ClamAV is the open-source default. Catches known malware families; weak on novel. Latency: seconds, dominated by signature load. Output: pass or a family name on hit.

**Rule-based pattern matching.** Write rules that describe malware features (specific byte sequences, structural conditions, magic-number tests, embedded-string tests) and scan files against the ruleset. YARA is the de facto standard. Catches malware families that haven't been added to AV signatures yet but match documented patterns. Latency: sub-second. Output: list of rules matched.

**Multi-engine consensus.** Submit a file (or, privacy-preserving, just its hash) to a service that runs many AV engines and aggregate the results. VirusTotal is the public-facing default. Catches what your single AV missed because a different engine caught it. Latency: bounded by network. Output: engine-by-engine verdict plus aggregate counts.

A serious vetting workflow uses three of the four (structural for PDFs, signatures for any format, consensus for second opinion) and treats the fourth (YARA) as optional. They are not redundant. pdfid catches a malicious PDF whose hash isn't yet in any AV database, by reading its structure. ClamAV catches the file whose name has changed but whose body matches a known sample. VirusTotal catches what your locally-fresh ClamAV missed because a different engine has the signature. The three overlap at the edges but each has a unique core.

Plus the sandbox tier: even with all of the above passing, the safest open is in a Firejail sandbox with no network, so any active content that does execute can't phone home or reach the filesystem outside its sandbox.

Adjacent categories worth knowing but not the focus here:

- **HIDS (host integrity monitoring).** Watches the system for post-compromise changes. `choosing-hids-tools.md` covers this layer. Different category: HIDS catches an attack after success; document scanning catches it before success.
- **Endpoint AV in the Windows sense.** Continuously scans every file the OS touches. Linux versions exist (ClamAV's clamd daemon, ClamWin, ESET for Linux) but the Linux threat model rarely justifies the resource cost; on-demand scanning of documents you receive covers most of the realistic threat.
- **Network-level scanning.** Mail gateways and proxy filters that scan attachments before they reach the workstation. Out of scope for single-workstation usage; relevant if you operate a mail server or HTTP proxy.


## The tool comparison

The tools are organized by the categories above, plus auxiliary inspection tools and the sandboxing layer that sits after the scan.

### Structural analysis: PDF

#### pdfid.py / pdf-parser.py (Didier Stevens)

Public-domain Python scripts by a long-running malware analyst at the SANS Internet Storm Center. Not packaged in Debian or Devuan; requires manual download from didierstevens.com to a script directory of your choosing (typically `~/bin`).

License: effectively public domain (Didier Stevens releases his work for general use; check the specific release).

What they do: pdfid produces a one-page summary of suspicious-tag counts (/JavaScript, /JS, /OpenAction, /AA, /Launch, /JBIG2Decode, /RichMedia, /EmbeddedFile, /XFA) plus general object counts. pdf-parser walks the PDF object graph and lets you extract specific objects by ID, filter by content, or dump decoded streams.

Strengths:

- The forensic gold standard for PDF triage. CERTs and DFIR teams reach for these first.
- Fast (seconds even on large PDFs).
- Output is small, readable, and stable across versions.
- Each tool does one thing.

Weaknesses:

- Not packaged. Manual download means manual update tracking.
- Single-developer project (Didier Stevens). Stable over twenty years but vulnerable to bus factor.

When to pick: always, for PDF triage. There is no substitute that's both as accurate and as widely deployed.

#### peepdf

Active community fork of the original Jose Miguel Esparza project (the original was Python 2 and unmaintained; the active fork is Python 3 and incorporates additional features). License: GPLv3.

What it does: interactive PDF analysis. Decodes streams, detects JavaScript, runs some pattern detection against known exploits, lets you navigate the PDF object tree.

Strengths:

- More featureful than pdf-parser for deep inspection.
- Interactive shell makes complex walks faster than pdf-parser's command-line invocation pattern.

Weaknesses:

- Upstream maintenance is forky and harder to evaluate.
- More moving parts than pdfid/pdf-parser; more places for bugs.

When to pick: when pdfid plus pdf-parser have flagged a PDF as suspicious and you want to do a deeper interactive walk. Not a replacement for the Stevens tools.

#### mupdf-tools (mutool)

Part of the MuPDF project (Artifex Software, behind Ghostscript). Packaged in Debian and Devuan as `mupdf-tools`. License: AGPLv3 (commercial alternative available from Artifex).

What it does: structural inspection of PDFs, not security-focused. `mutool show file.pdf trailer` shows the trailer dictionary; `mutool clean -d file.pdf out.pdf` rewrites with streams decompressed and visible.

Strengths:

- Lets you look at what's actually in a stream object without pdfid's interpretation layer.
- Fast, in the repos.
- Useful for the "is this stream what it claims to be" question.

Weaknesses:

- Not a security tool. Won't tell you if a stream is malicious; only what it is.

When to pick: when you've already established that a PDF object is suspicious and you want to see its decoded content with no analysis layer in between.

### Structural analysis: EPUB

EPUBs are zip archives of XHTML, CSS, JavaScript, and images. There is no dedicated EPUB malware-analysis tool. The standard workflow is extract, inspect, and scan with ClamAV (which recurses into zips automatically).

#### epubcheck

Java tool from the W3C / DAISY consortium. Packaged in Debian and Devuan as `epubcheck`. License: BSD 3-Clause.

What it does: validates EPUB conformance against the EPUB 2 and EPUB 3 specifications.

Strengths:

- In the repos.
- Surfaces malformed EPUBs that often correlate with suspicious origin (legitimate publisher EPUBs almost always pass epubcheck).

Weaknesses:

- Not a malware tool. Validates structure, doesn't detect malice.

When to pick: as a heuristic check on EPUBs from non-publisher sources. Run alongside, not instead of, the extract-and-scan workflow.

### Signature scanning

#### ClamAV

The dominant open-source antivirus engine. Originally a small project (Tomasz Kojm, 2001), now developed under Cisco's Talos security organization since the 2007 acquisition of Sourcefire. Packaged in Debian and Devuan as `clamav` (CLI) and `clamav-daemon` (clamd).

License: GPLv2.

What it does: scans files against a signature database for known malware. Recurses into archives (zip, rar, 7z, tar) and document containers (Office, PDF, EPUB) natively. Two main invocation modes: `clamscan` loads signatures on every invocation (slow); `clamdscan` queries a running `clamd` daemon (fast). `freshclam` updates signatures.

Strengths:

- In the repos.
- Native archive recursion (so EPUBs and zipped attachments get scanned automatically).
- Signature updates are regular and free, no paid subscription.
- Cisco Talos backing means the project is well-funded and unlikely to disappear.
- The de facto Linux AV.

Weaknesses:

- Weak on novel zero-day malware (the limitation of any signature-based approach).
- `clamscan` startup is slow (~5-10 seconds for signature load) which adds up over many files; `clamdscan` fixes this but requires a running daemon.
- Cisco ownership is a trust consideration for users wary of US-headquartered security vendors. The signature database is open and inspectable, mitigating this for paranoid users willing to audit.

When to pick: always, as the signature-scanning layer. No other open-source option comes close.

### Rule-based pattern matching

#### YARA

Originally a VirusTotal project (Victor Manuel Alvarez, then at VirusTotal, now at Google). Packaged in Debian and Devuan as `yara`. License: BSD-3-Clause.

What it does: pattern-matching engine for malware research. You write rules (specific strings, byte patterns, structural conditions, file-size and magic-number tests); YARA scans files and reports which rules matched.

Strengths:

- In the repos.
- Fast (sub-second on most files).
- The de facto malware-pattern-matching standard; almost every malware report includes YARA rules.
- Community ruleset at `github.com/Yara-Rules/rules` covers most known families and is regularly updated.

Weaknesses:

- The ruleset is what does the work. Without good rules, YARA is just a string-matching engine.
- Community rulesets are uneven; some rules generate false positives. Pruning is part of operational use.
- VirusTotal / Google lineage is a trust consideration similar to ClamAV / Cisco. The engine is open and self-contained, mitigating this.

When to pick: when you want to catch novel-but-pattern-matching malware that ClamAV signatures don't yet flag. Useful supplement to ClamAV, not a replacement.

### Multi-engine consensus

#### VirusTotal

Public service started 2004, acquired by Google 2012, now operated as a Google subsidiary. Free public API with rate limits (4 requests per minute); paid tiers for higher rates and additional features.

What it does: maintains hashes and metadata for billions of files, plus runs roughly 70 AV engines against new submissions. Two interaction modes: upload a file (file is scanned and added to the database, shared with VT's industry partners); look up a hash (returns the existing record if the file has been seen before, otherwise NotFound).

Strengths:

- 70-ish engines is broader coverage than any locally-runnable stack.
- Mature, well-funded, fast.
- Hash lookup is privacy-safe: the hash reveals which file but not its contents.

Weaknesses:

- Uploads leak file contents to Google and to VT's AV-vendor partners. Anything you upload becomes part of an industry-shared database.
- Google ownership is a trust consideration. The privacy policy permits significant data sharing.
- Rate limits on the free tier mean it's not viable as a primary scan layer; treat it as a confirmation step.

When to pick: hash lookup on every file (privacy-safe, fast). Full upload only when you've already established suspicion and you want the strongest available second opinion, and only for files whose contents you're willing to share with the AV industry.

### Auxiliary inspection

#### exiftool

Long-running Perl tool by Phil Harvey (since 2003). Packaged in Debian and Devuan as `libimage-exiftool-perl`. License: GPLv1 or Artistic (Perl's dual license).

What it does: reads, writes, and edits metadata in a vast range of file formats. For document analysis: exposes authoring tools, creation timestamps, embedded thumbnails, EXIF and IPTC fields.

Strengths:

- In the repos.
- Mature, well-tested, broad format coverage.
- Useful for provenance triage (does this PDF's authoring metadata match where it claims to come from?).

Weaknesses:

- Not a malware tool. Exposes metadata, doesn't analyze threats.

When to pick: when you want to know who made a file and when, or when you suspect fabricated provenance.

#### binwalk

Originally created by Craig Heffner; the project's lineage includes a period of funding from ReFirm Labs (acquired by Microsoft in 2021). Packaged in Debian and Devuan as `binwalk`. License: MIT.

What it does: scans files for embedded files of known formats. Originally built for firmware analysis (finding filesystems and bootloaders inside firmware blobs); useful generally for "is there something hidden inside this thing?"

Strengths:

- In the repos.
- Fast, mature, large signature database for embedded formats.

Weaknesses:

- Not document-focused. Useful for the specific question "is there a payload hidden inside this seemingly-innocent file" but doesn't analyze the document content itself.
- Microsoft-adjacent lineage via the ReFirm acquisition is a trust consideration for some users; the project itself remains open-source and community-maintained.

When to pick: when other tools have flagged a document as suspicious and you want to check for embedded content (an executable hidden in an image, a zip appended to a PDF).

### Sandboxing for actual opening

#### Firejail

SUID-based namespace sandbox. Packaged in Debian and Devuan as `firejail`. License: GPLv2.

What it does: runs a process in a namespace sandbox with restricted filesystem access, optional network isolation, seccomp filters, and capability dropping. Profile system covers most common applications.

Strengths:

- In the repos.
- Simple command-line usage (`firejail --net=none atril doc.pdf`).
- Default profiles for hundreds of applications.
- Lower friction than VM-level isolation.

Weaknesses:

- SUID-root binary, which means a sandbox-escape bug becomes a privilege-escalation bug. Firejail has had such bugs in the past; the project's response has improved but the architectural concern remains.
- Profiles can be incomplete; a misconfigured profile gives less protection than expected.

When to pick: opening untrusted documents always. The SUID trade-off is acceptable for the use case (the alternative is opening the document without any sandbox, which is worse).

#### Bubblewrap

User-namespace-based sandbox without SUID. Packaged in Debian and Devuan as `bubblewrap`. License: LGPLv2.

What it does: same general purpose as Firejail (process isolation via Linux namespaces) but without requiring SUID. Used as the sandbox foundation by Flatpak.

Strengths:

- In the repos.
- No SUID, so no privilege-escalation risk from sandbox-escape bugs.
- The Flatpak ecosystem's sandboxing is built on bubblewrap, which means it's heavily exercised in production.

Weaknesses:

- No profile system. You construct each sandbox invocation manually with explicit `--ro-bind`, `--bind`, `--unshare-*` flags.
- The construction is fiddly enough that most users won't bother for one-off document opening.

When to pick: if you've decided Firejail's SUID is unacceptable for your threat model and you're willing to write wrapper scripts. For most users, Firejail's profile system wins on usability.


## Political and lineage clustering

Less politically charged than encryption tools — no Snowden-era controversies to navigate. The tools fall into three lineages, distinguished by funding base and project culture:

**Original-author / security-community lineage.** Didier Stevens' pdfid and pdf-parser, exiftool, ClamAV in its early years. Long-running solo or small-team projects with strong individual stewardship. Stable for decades. Vulnerable to bus factor but otherwise low-controversy.

**Corporate-FOSS lineage.** ClamAV (Cisco-funded since 2007), YARA (Google-funded via VirusTotal), Firejail (community plus occasional corporate contributions), Bubblewrap (Red Hat / Flatpak ecosystem). The corporate funding hasn't measurably changed project direction or compromised the open-source nature; both projects' code is inspectable and the funding has stabilized rather than co-opted them. Trust here is mostly an issue for users who object to the parent corporation on principle (US-headquartered, large, surveillance-adjacent for ClamAV / Cisco; advertising-funded for YARA / Google).

**Multi-engine consensus with privacy cost.** VirusTotal (Google subsidiary). The trade-off is explicit: roughly 70 engines of coverage in exchange for your files entering a Google-owned, AV-industry-shared database. Hash-only lookups avoid the file-disclosure cost; full uploads accept it.

There's no equivalent here to the VeraCrypt-Microsoft situation in the encryption space or to the systemd-Lennart-Poettering controversies in the init space. The trade-offs are about coverage versus privacy and about project maturity versus complexity, not about competing ideological camps.


## How to think about choosing

Three questions, in order:

1. **What documents are you vetting?** PDFs only → pdfid plus pdf-parser plus ClamAV. Mixed PDF and EPUB → add EPUB extract-and-grep plus epubcheck. Office documents (Word, Excel, PowerPoint) → add oletools (mentioned below). Academic papers and ebooks → the vanilla stack covers; oletools if you handle Office.

2. **How much configuration time can you absorb?** Zero → ClamAV alone with weekly cron of Downloads. Low → add pdfid for the PDFs that actually come through. Medium → the full stack via `doc-malware-scan.sh`. High (this is your job) → custom YARA rules tuned to your specific threat surface, plus a clamd daemon for fast scans.

3. **What's your response posture on a hit?** If a hit will be ignored or routinely dismissed, none of this matters. The minimum posture: structural-suspicion hit → don't open without sandbox; signature hit → don't open at all without inspection; critical hit → don't open, quarantine, investigate origin. Pre-decide before the first hit, because the first hit will arrive at an inconvenient moment.


## The recommendation

ClamAV + Didier Stevens' pdfid suite + YARA + Firejail. Plus VirusTotal hash lookup if you have an API key (free tier sufficient for casual use).

Operational companion: `doc-malware-scan.sh` in this project. First run auto-installs everything; subsequent runs scan files or folders.

One-time setup (also done automatically by the script on first invocation):

```bash
sudo apt install clamav yara epubcheck firejail file unzip curl git
sudo freshclam
mkdir -p ~/bin && cd ~/bin
wget https://didierstevens.com/files/software/pdf-tools_V0_2_8.zip
unzip pdf-tools_V0_2_8.zip && rm pdf-tools_V0_2_8.zip
chmod +x pdfid.py pdf-parser.py
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
git clone https://github.com/Yara-Rules/rules.git ~/yara-rules
```

Optional VirusTotal API key (free tier from virustotal.com after account creation):

```bash
echo 'export VT_API_KEY="your_key_here"' >> ~/.bashrc
```

Weekly scan of Downloads via cron (in root's or your own crontab):

```bash
0 6 * * 0 /usr/local/bin/doc-malware-scan.sh -y "$HOME/Downloads" | logger -t doc-scan
```

After every legitimate apt upgrade that bumped ClamAV, the post-install hook usually runs freshclam; if signatures look stale (older than seven days), run `sudo freshclam` manually.


## What about other document formats

The doc-malware-scan workflow above targets PDF and EPUB explicitly. Adjacent formats are worth knowing about even if they're not the focus of this project.

**Office documents (docx, xlsx, pptx, and the legacy doc, xls, ppt).** The Linux user is less likely to encounter these but the threat is real for anyone who does. `oletools` (apt: `python3-oletools`) gives Office-format equivalents to pdfid: `olevba` extracts macros, `oledump` inspects OLE objects, `mraptor` flags suspicious VBA patterns. LibreOffice itself will warn before running macros from untrusted documents, but the warning is bypassable by user habituation. Treat Office documents like PDFs: pre-scan with ClamAV plus oletools; if they have macros, open in a VM with no network or don't open at all.

**Archives (zip, rar, 7z, tar, gz).** ClamAV recurses into archives natively, which covers the contained files. The additional concern is decompression bombs: small archives that expand to terabytes and exhaust disk or memory. Check uncompressed size before extracting (`unzip -l archive.zip`, `7z l archive.7z`); refuse anything implausibly large. Standard apt-installed tools include the size limits as defaults but the limits aren't enforced by `unzip` itself.

**Images (jpg, png, webp, svg).** Generally low risk on Linux for direct exploitation (image-decoder bugs do exist and have been exploited historically, but Linux image libraries are well-fuzzed). The auxiliary concerns: EXIF metadata can leak location and authoring information (use exiftool to inspect and strip); steganographic payloads can hide data inside images (steghide, stegseek to detect, rarely justified for normal threat models); SVG files are XML and can contain JavaScript (treat SVG like HTML and only open in sandbox).

**HTML files.** Identical risk profile to opening a web page. Open in a sandboxed browser only; never let your default reader render HTML directly without isolation.

**KFX (Amazon's Kindle format) from non-publisher sources.** Harder to inspect without Calibre or Amazon's own tools; the practical guidance is to convert KFX to EPUB first and then scan, or to read KFX only on the Kindle device itself.


## Out of scope, deliberately

**Real-time on-access scanning.** Continuously scanning every file the OS touches (the Windows-AV model) is possible on Linux via `clamd`'s on-access mode but rarely worth the resource cost on a single-user workstation. On-demand scanning of documents you actually open covers the realistic threat.

**Mail-gateway scanning.** Workstation-level. If you operate a mail server, the same tools (ClamAV plus pdfid via amavisd or rspamd) apply at the mail gateway. Different deployment pattern, same engines.

**Sandbox-execution detonation (the cuckoo-sandbox model).** Run the suspicious document in an instrumented VM, observe what it does. Real category, real value for security researchers, way too much infrastructure for a workstation user. If you need it, REMnux ships pre-configured.

**Specialized formats (CAD files, scientific data formats).** Format-specific. Most don't have meaningful malware exposure; the ones that do (DWG, certain GIS formats) have their own niche analysis tools.

**QR-code analysis.** A QR code is a URL container; the threat is the URL it encodes, not the QR code itself. Scanning the URL with a reputation service (urlscan.io, VirusTotal URL endpoint) handles the actual question. Tooling like `zbarimg` decodes the QR; deciding whether the decoded URL is hostile is a different category of work than document scanning. Worth knowing about; deliberately not in the doc-malware-scan workflow.

**HTML email with tracking pixels.** Email tracking pixels (1x1 transparent images served from a tracking domain) leak read-receipts to the sender. Defense is at the mail-client layer (block remote image loading by default; Thunderbird and Geary both support this) rather than the scanning layer. Out of scope here because the question is mail-client configuration, not document scanning.

**Downloaded-binary signature verification.** Verifying a downloaded binary's GPG signature or shasum is a separate workflow from scanning a document. The procedure (download `.asc` plus binary, `gpg --verify`, or compare `sha256sum` against the publisher's published value) is mechanical and covered in `privacy-setup.md` and `gpg-concepts.md`. The document-scanning workflow can apply afterward (scanning the verified-as-authentic binary for completeness) but the primary defense for binaries is signature verification, not pdfid.
