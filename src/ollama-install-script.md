# Ollama install script

```bash
#!/usr/bin/env bash
# install-ollama
#
# Standalone script. Downloads the latest Ollama Linux x86_64 release
# tarball from GitHub, verifies its sha256 against the upstream
# sha256sum.txt, installs it user-space at ~/.local/opt/ollama/, and
# symlinks the binary into ~/.local/bin/. No service is installed; run
# `ollama serve` manually when needed.
#
# Usage:
#   bash install-ollama.sh              install or upgrade to latest
#   bash install-ollama.sh --uninstall  remove the install tree and symlink
#
# Security note: Ollama does not publish GPG signatures for release
# tarballs (see ollama/ollama#1313, #2323). Verification is sha256-only
# against the same release's published sha256sum.txt, both fetched
# over HTTPS from github.com. This rules out transit corruption and
# CDN-layer tampering but does not protect against a compromise of the
# upstream release pipeline. Switch to gpgv if upstream starts signing.

set -euo pipefail
umask 022  # ensure install dir and files are owner-write only

INSTALL_DIR="$HOME/.local/opt/ollama"
BIN_DIR="$HOME/.local/bin"
SYMLINK="$BIN_DIR/ollama"
TARGET="$INSTALL_DIR/bin/ollama"

say() { printf '%s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# DL_TMP is script-scope so the EXIT trap can clean on any exit path
# including die. Initialized empty; cleanup no-ops until it's set.
DL_TMP=""
cleanup() {
    [ -n "$DL_TMP" ] && rm -rf "$DL_TMP"
    return 0
}
trap cleanup EXIT

install_ollama() {
    local VERSION_FILE="$INSTALL_DIR/.version"
    local RELEASES_URL="https://github.com/ollama/ollama/releases"
    local API_URL="https://api.github.com/repos/ollama/ollama/releases/latest"
    local TARBALL="ollama-linux-amd64.tar.zst"
    local SUMS="sha256sum.txt"
    local VERSION INSTALLED BASE EXPECTED ACTUAL

    case "$(uname -m)" in
        x86_64) ;;
        *) die "unsupported arch: $(uname -m) (script targets x86_64)" ;;
    esac

    command -v wget      >/dev/null || die "wget required but not installed"
    command -v sha256sum >/dev/null || die "sha256sum required but not installed"
    command -v tar       >/dev/null || die "tar required but not installed"
    command -v zstd      >/dev/null || die "zstd required but not installed (apt install zstd)"

    # GitHub's v3 REST API is the documented stable contract for release
    # metadata (vs. parsing the HTML redirect from /releases/latest, which
    # is undocumented). Rate-limited at 60/hour per IP unauthenticated,
    # ample for a personal installer.
    # --https-only enforces TLS across the entire redirect chain (release
    # assets redirect through release-assets.githubusercontent.com → S3).
    say "fetching latest version..."
    VERSION=$(wget --https-only -qO- "$API_URL" \
        | grep -m1 '"tag_name"' \
        | sed -E 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/' \
        | tr -d '\r\n') || true
    [ -n "$VERSION" ] || die "version fetch failed (API_URL=$API_URL)"
    [[ "$VERSION" =~ ^v[0-9]+(\.[0-9]+){1,3}([-+a-zA-Z0-9.]*)?$ ]] \
        || die "version string failed validation: '$VERSION'"
    say "latest version: ${VERSION}"

    if [ -f "$VERSION_FILE" ]; then
        INSTALLED=$(cat "$VERSION_FILE")
        if [ "$INSTALLED" = "$VERSION" ]; then
            say "ollama $VERSION already installed at $INSTALL_DIR"
            return 0
        fi
        say "upgrading from $INSTALLED to $VERSION"
    fi

    DL_TMP=$(mktemp -d) || die "mktemp -d failed"
    BASE="$RELEASES_URL/download/$VERSION"

    say "downloading checksums..."
    wget --https-only -nv -P "$DL_TMP" "$BASE/$SUMS" || die "$SUMS download failed"

    say "downloading $TARBALL..."
    wget --https-only -nv -P "$DL_TMP" "$BASE/$TARBALL" || die "$TARBALL download failed"

    # sha256sum.txt entries are typically `<hash>  ./<file>` but the
    # leading `./` isn't universal; match either form.
    say "verifying tarball hash..."
    EXPECTED=$(awk -v f="$TARBALL" '$2==f || $2=="./" f {print $1}' \
        "$DL_TMP/$SUMS" | head -1) || true
    if ! [[ "$EXPECTED" =~ ^[a-f0-9]{64}$ ]]; then
        say "no hash found for $TARBALL; $SUMS contents follow:"
        cat "$DL_TMP/$SUMS" >&2
        die "hash extraction failed"
    fi
    ACTUAL=$(sha256sum "$DL_TMP/$TARBALL" | awk '{print $1}')
    [ "$EXPECTED" = "$ACTUAL" ] \
        || die "tarball hash mismatch (expected $EXPECTED, got $ACTUAL)"

    # Tarslip defense. Sha256 proves the tarball matches what upstream
    # published; it does not prove upstream's release pipeline wasn't
    # compromised. Reject any entry with absolute paths or `..` traversal
    # before extracting. GNU tar 1.30+ also rejects these by default; this
    # is explicit defense-in-depth that doesn't depend on tar version.
    say "validating archive paths..."
    if tar --zstd -tf "$DL_TMP/$TARBALL" \
        | grep -qE '(^/|(^|/)\.\.(/|$))'; then
        die "archive contains absolute or .. paths; refusing to extract"
    fi

    # Clean any prior install tree so partial/older extractions can't
    # mix with the new one. The version-match path above is the no-op;
    # this is the upgrade path.
    say "installing to $INSTALL_DIR..."
    rm -rf "$INSTALL_DIR" || die "stale install dir cleanup failed"
    mkdir -p "$INSTALL_DIR" || die "mkdir $INSTALL_DIR failed"
    tar --zstd -xf "$DL_TMP/$TARBALL" -C "$INSTALL_DIR" --no-same-owner \
        || { rm -rf "$INSTALL_DIR"; die "extraction failed"; }

    [ -x "$TARGET" ] \
        || { rm -rf "$INSTALL_DIR"; die "extracted tree missing bin/ollama"; }

    printf '%s\n' "$VERSION" > "$VERSION_FILE" \
        || die "version marker write failed"

    say "creating symlink at $SYMLINK..."
    mkdir -p "$BIN_DIR" || die "mkdir $BIN_DIR failed"
    ln -sf "$TARGET" "$SYMLINK" || die "symlink failed"

    say "ollama $VERSION installed; run 'ollama serve' to start the daemon"

    # On Devuan, ~/.profile adds ~/.local/bin to PATH only if the dir
    # already existed at login. First-time installs hit this and `ollama`
    # comes back as command-not-found until next login.
    case ":$PATH:" in
        *":$BIN_DIR:"*) ;;
        *) say "warning: $BIN_DIR not in \$PATH — log out and back in, or run 'export PATH=\"\$HOME/.local/bin:\$PATH\"'" ;;
    esac
}

uninstall_ollama() {
    # Only remove the symlink if it points to our install tree, so a
    # manually-placed binary at $SYMLINK isn't clobbered.
    local found=0

    if [ -L "$SYMLINK" ] && [ "$(readlink "$SYMLINK")" = "$TARGET" ]; then
        say "removing symlink $SYMLINK"
        rm -f "$SYMLINK"
        found=1
    fi

    if [ -d "$INSTALL_DIR" ]; then
        say "removing install dir $INSTALL_DIR"
        rm -rf "$INSTALL_DIR"
        found=1
    fi

    [ "$found" = 1 ] || die "nothing to uninstall (no install dir at $INSTALL_DIR)"

    say "done. ~/.ollama (models) and any autostart entry are left alone;"
    say "remove them by hand if you want them gone."
}

[ "$(id -u)" -ne 0 ] || die "don't run as root; this is a user-space install"

case "${1:-}" in
    "")          install_ollama ;;
    --uninstall) uninstall_ollama ;;
    *)           die "unknown argument: $1 (use --uninstall, or no args to install)" ;;
esac
```