# Choosing Supply Chain Tools

How to defend the code you install. This is the question the other input-vetting work does not answer: `choosing-document-scanning-tools.md` covers the files you open, this covers the code you install and build. It sits alongside the detection layer (`choosing-hids-tools.md`, which catches tampering after the fact) and the credential-isolation cross-cutting concern in the master overview (which keeps a compromised build environment from acting as you). The motivation, including the IronWorm npm worm that makes this concrete, is in `why-secure-your-system.md`. Recommends a baseline at the end; the rest is the reasoning that defends it.


## TL;DR

The code you install runs on your machine, often the instant it installs, with your privileges and your secrets within reach. That is a different attack surface from the documents you open, and the document scanner does not touch it.

The baseline, in order of return per minute of effort:

1. Prefer the distribution. Install from apt main and backports, then Flatpak from Flathub, before reaching into language ecosystems. Fewer trust roots is the cheapest win.
2. Never pipe `curl` into a shell, especially as root. Read installers first.
3. Pin and verify by hash. Commit the lockfile for every project and install from it with hash checking: `npm ci`, `pip install --require-hashes`, `cargo build --locked`.
4. Contain install-time execution. Set npm to ignore install scripts by default; for ecosystems that cannot disable it (cargo, apt), run the install or build of any code you have not reviewed inside a disposable, network-restricted, credential-free sandbox.
5. Keep the credentials that publish, sign, or unlock value off the machine that installs and builds. The most common payload is an environment-variable sweep, so the build machine should not hold your cloud, npm, AI, or wallet secrets.

No single one of these stops every attack. Depth is the point, the same as everywhere else in this project. Detection after the fact is `choosing-hids-tools.md`; recovery is backups, in the overview.


## The shape of the threat

Almost every package manager will run code supplied by a dependency at install or build time, before you have done anything deliberate with the package. npm runs lifecycle scripts (`preinstall`, `postinstall`). pip runs the build backend of a source distribution. cargo runs build scripts and procedural macros while compiling. apt runs maintainer scripts as root. That install-time execution is the foothold; everything else is what the foothold is used for.

The IronWorm npm worm in June 2026 is the worked example, and it is worth understanding mechanically because it exercised four structural weaknesses at once[^ironworm]:

- Permissive install hooks. A Rust binary ran from a `preinstall` script the moment the package installed, before dependency resolution finished, with no build step and no confirmation.
- Trusted-publishing abuse. It propagated using stolen credentials, including the short-lived OIDC tokens of npm's Trusted Publishing workflow, so it could publish from a victim's own pipeline.
- Forged commit metadata. It planted back-dated commits across nine organizations under the names of trusted automation, dependabot, github-actions, and "claude," to blend in with routine work.
- SemVer-tolerant updates. The malicious versions were minor or patch bumps, designed to be picked up automatically by lockfiles configured to accept them.

The result was self-propagating: it stole a developer's publish credentials, republished itself into that developer's packages, and infected the next person who installed them. The lesson for defense is that the package manager's convenience features (run-on-install, automatic version updates, stored publish tokens) are the attack surface, and the defenses below are mostly about removing or containing each one.


## The ecosystems, one at a time

The ecosystems differ enough that one rule does not fit all. Worst-to-best for your ability to disable install-time execution: cargo (cannot), apt (cannot, and it is root), pip (partly, by preferring wheels), npm (yes, with a flag and a cost), Flatpak (sandboxed regardless).

### apt and Devuan repositories

The Debian and Devuan archives are cryptographically signed, and apt verifies the release signature against trusted keys before installing anything. The main archive is not the threat. The threat is what you add to it and what you run around it.

apt runs maintainer scripts (`preinst`, `postinst`) as root at install time, so a compromised package or repository is a root-level install-time execution problem, the highest-privilege version of the npm hook issue. You cannot easily sandbox `dpkg`, so the defense is trusting the source rather than containing it.

What to do:

- Minimize third-party repositories. Prefer Devuan and Debian main and backports, then Flatpak, over downloading upstream `.deb` files or adding vendor repositories.
- When you must add a repository, install its signing key to `/etc/apt/keyrings/` and bind the repository to that key with a `Signed-By:` line in the `.sources` entry, so a different key cannot silently sign updates.
- Never pipe `curl` into `sh`, and never as root. These installers bypass the package manager, its signatures, and its uninstall path entirely. Download, read, then run if you trust it.
- `apt-listchanges` and `apt-listbugs` surface what an upgrade is about to do before it does it.

### Flatpak

Flatpak is the one ecosystem here whose runtime model helps you. Apps run in a `bubblewrap` sandbox with access mediated by portals, so a malicious or compromised app is constrained by what it was granted. The weakness is the grant: an app with broad static permissions (`filesystem=host`, broad device access, or the ability to talk to the Flatpak control interface) has escaped the sandbox in practice.

What to do:

- Prefer Flathub "verified" apps, which are published by the upstream project rather than a third party.
- Inspect permissions before installing: `flatpak info --show-permissions <app>`.
- Tighten over-broad permissions with `flatpak override` or the Flatseal GUI. Never leave `filesystem=host` on an app that does not need it.
- Treat broad device access or session-bus access as a red flag worth understanding before granting.

### npm

npm gives you the most direct control over install-time execution, at a cost.

Contain install hooks. Disable lifecycle scripts globally and re-enable per project only when a package genuinely needs a native build:

```bash
npm config set ignore-scripts true
```

For a single install in CI or on a project you do not fully trust:

```bash
npm ci --ignore-scripts
```

The mitigation that Microsoft recommended after the March 2026 Axios compromise was exactly this[^axios]. Two honest caveats. First, the January 2026 "PackageGate" disclosure found zero-days in npm, pnpm, vlt, and Bun that undermined lifecycle-script disabling itself, so this is a layer, not a wall[^packagegate]. Second, some legitimate packages need their scripts to build native code, so blanket disabling has a real cost and you will re-enable selectively.

Pin and verify. Commit `package-lock.json` and install from it with `npm ci`, which installs exactly the locked versions and verifies each package against the integrity hash in the lockfile. Do not run `npm install` in CI, which can drift.

Detect downgraded trust. pnpm 10.21 and later ship a `trustPolicy` setting whose `no-downgrade` mode refuses to install a package whose publish-time trust level has dropped, for example a package that used to ship with provenance and now does not, which is an early signal of a compromised account[^pnpm].

Screen before you add. Socket and `npq` screen packages for suspicious behavior before installation. Check maintainer history, download counts, and repository activity, and be especially careful with package names suggested by an AI assistant, which can hallucinate a name that an attacker has since registered.

Hardening what you publish is in the cross-cutting section below.

### pip and PyPI

pip's install-time execution depends on the artifact. A source distribution runs its build backend (historically `setup.py`) at install; a wheel does not run arbitrary install code, though it still executes on import. Prefer wheels where you can (`--only-binary :all:` for the dependencies that ship them).

Pin and verify by hash. Hash-checking mode forces every dependency, including transitive ones, to be pinned with a verified hash:

```bash
pip install --require-hashes -r requirements.txt
```

Generate the hashed lock file with uv or pip-tools rather than by hand[^pip]:

```bash
uv pip compile requirements.in --generate-hashes -o requirements.txt
# or, with pip-tools:
pip-compile --generate-hashes requirements.in
```

Audit. Run `pip-audit` in CI to catch dependencies with known advisories before they ship.

Dependency confusion. If you use private packages, pin the index and use a resolver strategy that will not silently pull a public package that happens to share an internal name; uv's first-match index strategy is built for this.

Publishing hardening is in the cross-cutting section.

### cargo and crates.io

cargo is the hard case, because by design it executes arbitrary code at build time through build scripts (`build.rs`) and procedural macros[^cargoexec]. There is no clean equivalent of `--ignore-scripts`, because the code runs as part of compilation rather than as an optional hook.

It is worse than that. The RustSec maintainer's guidance is to not run any `cargo` command on a project you have not reviewed, because every cargo command invokes Cargo, which can be made to execute arbitrary code, and that includes the supply-chain tools themselves: `cargo audit`, `cargo deny`, and `cargo vet` all go through Cargo and can be turned into code execution, for instance via a `.cargo/config.toml` alias in the repository[^cargountrusted]. The practical consequence is that the auditing tools are not a safe way to inspect untrusted code; they are a way to check code you already intend to build.

So for cargo the defense is review and sandboxing, not flags:

- Commit `Cargo.lock` and build with `cargo build --locked` (or `--frozen` offline), which pins exact versions and verifies registry checksums.
- Run the build, and any cargo command, on code you have not reviewed inside the same disposable, network-restricted sandbox you would use for an untrusted install.
- Inside that trusted-build context, the RustSec tooling earns its place: `cargo audit` and `cargo deny` (with the `cargo-deny-action` in CI) flag advisories, and let you also gate licenses and crate sources[^rustsec]. `cargo-vet` and `cargo-crev` record human audit attestations. `cargo-supply-chain` lists who you are trusting. `cargo-auditable` embeds the dependency tree into the compiled binary so the result stays auditable.

### Tarballs and source you build yourself

The same principle applies to a tarball or a `git clone` you build with `make`: the build runs whatever the `Makefile` and configure scripts say, with your privileges. Verify the download against a signature or a published checksum from the project (not from the same place you got the file), read the build files if the source is unfamiliar, and build untrusted source in a sandbox.


## Cross-cutting defenses

These apply across every ecosystem above.

### Pin and verify by hash

A lockfile that records exact versions and integrity hashes, committed to the repository and verified on every install, is the baseline that turns "install whatever resolves today" into "install exactly what was reviewed." `npm ci`, `pip install --require-hashes`, and `cargo build --locked` are the per-ecosystem forms. Lockfiles do not fully cover git-based dependencies, so pin those to a commit, not a branch.

### Disable or sandbox install-time execution

Where the ecosystem lets you disable run-on-install (npm), do it by default. Where it does not (cargo, apt, source builds), contain it instead: run the install or build of any code you have not personally reviewed inside a disposable environment that has no network it does not need and none of your credentials. A throwaway container, a VM, or Firejail per the hardening doc (`devuan-secure-workstation.md`) all work; Qubes makes it the default. This is the single highest-value habit in this document, because it holds regardless of ecosystem and regardless of whether a specific control was bypassed: install-time code that runs in an empty, network-restricted sandbox cannot sweep secrets that are not there.

### Keep publishing and signing credentials off the build machine

This is the credential-isolation cross-cutting concern in the overview, applied to packaging. The machine that installs and builds should not also hold the credentials that publish packages, sign releases, or unlock funds, so that a compromised build environment cannot act as you.

For publishing specifically:

- Use OIDC trusted publishing instead of a stored long-lived token. PyPI Trusted Publishers exchange a short-lived OIDC token for upload rights, so there is no `PYPI_PUBLISH_PASSWORD` secret to steal[^pypitp]; npm's Trusted Publishing does the same and additionally produces provenance attestations.
- If you must use a token, scope it narrowly and rotate it.
- Treat the CI pipeline as part of the supply chain: pin GitHub Actions to commit SHAs rather than tags, start workflows with minimal permissions, and require manual approval for release workflows. OIDC is not a silver bullet, because a compromised workflow file or a malicious action can trigger a legitimate token exchange and publish malicious packages, which is how the LiteLLM and GhostAction incidents worked[^ci].
- Protect the registry account with WebAuthn-based 2FA.

### Secret hygiene on the machine that installs

Because the most common payload is an environment-variable and credential-file sweep, the machine that runs `npm install`, `pip install`, or `cargo build` should not have your AWS, GCP, Vault, npm, Anthropic, OpenAI, or wallet secrets sitting in environment variables, shell rc files, or unencrypted dotfiles. Keep them in a secrets manager that releases them per process, or on a separate user or VM (`privacy-setup.md`), so an install-time sweep finds nothing. A meaningful crypto seed should never be on the build machine at all; cold storage on an air-gapped machine is the credential-isolation pattern for funds.

### Screen before you add, but know the limits

Screen new dependencies with the per-ecosystem scanners: Socket or `npq` for npm, `pip-audit` or `osv-scanner` for pip, `cargo audit` or `cargo deny` (sandboxed) for cargo. Check the human signals too: maintainer history, repository activity, and whether the name is one an AI assistant suggested and an attacker may have registered. The limits are real: these tools catch known-bad and some heuristic-bad, not a novel implant in an otherwise-trusted package, and as noted the cargo plugins are unsafe to point at untrusted code.


## Recommendation

For a single-user Devuan workstation, in order:

1. Prefer apt main and backports, then Flathub verified apps, before language ecosystems.
2. Never pipe `curl` into a shell; read installers first.
3. For Flatpak, review and tighten permissions with Flatseal; no `filesystem=host` on apps that do not need it.
4. For every language project, commit the lockfile and install from it with hash verification (`npm ci`, `pip install --require-hashes`, `cargo build --locked`).
5. Set npm to ignore install scripts by default; re-enable per project only when a package needs a native build.
6. Run the install or build of any dependency set you have not reviewed inside a disposable, network-restricted, credential-free sandbox.
7. Keep cloud, npm, AI, and wallet credentials off the machine that installs, per the credential-isolation pattern.

Add if you publish packages: OIDC trusted publishing with no stored tokens, WebAuthn 2FA on the registry account, provenance attestations, and GitHub Actions pinned to commit SHAs with minimal permissions and manual release approval.

Add if you hold meaningful crypto: the seed never lives on the build machine; cold storage on an air-gapped machine.

The axis driving this order is security first, then the long term, per the project defaults. Item 6 is the load-bearing one: sandboxing the build of unreviewed code is the control that still works when ignore-scripts is bypassed, when a stolen OIDC token publishes a bad version, or when the registry serves a swapped release. The rest raise the cost of an attack; item 6 contains the blast radius when one gets through.


## The honest limits

No single control stops every supply-chain attack, and the marketing around each one oversells it. Trusted publishing does not help if your package manager runs preinstall scripts from every dependency, and blocking those scripts does not help if an attacker replaces a version at the registry level. PackageGate showed that the lifecycle-script-disabling defense itself had bypasses. OIDC eliminates the stored token but not the compromised workflow that mints a legitimate one. Lockfiles do not fully cover git dependencies. cargo cannot disable build-time execution at all, which is why review and sandboxing carry the weight there.

These defenses shift the odds and contain the damage; they do not guarantee safety. Detecting a compromise after it lands is a different layer (`choosing-hids-tools.md`), and coming back from one is backups (the overview). Depth across all of these is the posture, not faith in any one of them.


[^ironworm]: JFrog Security Research, "IronWorm: Shai-Hulud's rustier cousin," 3 June 2026, <https://research.jfrog.com/post/iron-worm-shai-hulud-rustier-cousin/>. Corroborated by BleepingComputer, "New IronWorm malware hits 36 packages in npm supply-chain attack," <https://www.bleepingcomputer.com/news/security/new-ironworm-malware-hits-36-packages-in-npm-supply-chain-attack/>. Disclosed via the compromised `asteroiddao` npm account in the Arweave/WeaveDB ecosystem; reported package count ranges from 36 to 43; 86 environment variables and 20 credential-file paths targeted; 57 back-dated commits across nine organizations under automation identities including dependabot, github-actions, and "claude."

[^axios]: Microsoft Security Blog, "Mitigating the Axios npm supply chain compromise," 1 April 2026, <https://www.microsoft.com/en-us/security/blog/2026/04/01/mitigating-the-axios-npm-supply-chain-compromise/>. Recommends `npm ci --ignore-scripts` or `npm config set ignore-scripts true`, and adopting OIDC trusted publishing to eliminate stored credentials.

[^packagegate]: Bastion, "npm Supply Chain Attacks 2026: Defense Guide," 17 February 2026, <https://bastion.tech/blog/npm-supply-chain-attacks-2026-saas-security-guide>, reporting the January 2026 "PackageGate" zero-days (disclosed by Koi) affecting npm, pnpm, vlt, and Bun that undermined lifecycle-script disabling.

[^pnpm]: pnpm documentation, "Mitigating supply chain attacks," <https://pnpm.io/supply-chain-security>. The `trustPolicy` setting with `no-downgrade` blocks installation of a package whose publish-time trust level has decreased.

[^pip]: pip documentation, hash-checking mode, <https://pip.pypa.io/en/stable/cli/pip_hash/> and `--require-hashes`; uv and pip-tools `--generate-hashes` for producing the hashed lock file, per "Defense in Depth: A Practical Guide to Python Supply Chain Security," bernat.tech, 10 March 2026, <https://bernat.tech/posts/securing-python-supply-chain/>.

[^pypitp]: Python Packaging Authority, "Publishing to PyPI with a Trusted Publisher," <https://docs.pypi.org/trusted-publishers/>. OIDC short-lived identity tokens replace stored API tokens for uploads.

[^cargoexec]: Rust Security Response WG advisories for the Cargo package, <https://advisories.gitlab.com/pkg/cargo/cargo>: "by design Cargo allows code execution at build time."

[^cargountrusted]: Sergey Davidoff, "Do not run any Cargo commands on untrusted projects," <https://shnatsel.medium.com/do-not-run-any-cargo-commands-on-untrusted-projects-4c31c89a78d6>. Any command starting with `cargo` can execute arbitrary code, including the cargo-audit, cargo-deny, and cargo-vet plugins, because they invoke Cargo, which can be redirected via `.cargo/config.toml`.

[^rustsec]: RustSec Advisory Database, <https://rustsec.org/>. `cargo audit` scans `Cargo.lock` against the database; `cargo deny` (with `cargo-deny-action`) adds advisory, license, and source policy enforcement; `cargo-auditable` embeds the dependency tree into compiled binaries.

[^ci]: PyPI security best practices and the LiteLLM and GhostAction incidents, per <https://github.com/lirantal/pypi-security-best-practices> and the BerriAI/litellm Trusted Publishers migration issue, <https://github.com/BerriAI/litellm/issues/24542>: a compromised CI/CD pipeline can publish malicious versions even with trusted publishing enabled, so pin Actions to commit SHAs, use minimal permissions, and require manual release approval.