<div class="mdb-wide"></div>

# Bootstrap-mdbook script

The script scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview.
For more details, see [Publish a book or a knowledge base](./publish-book.md).


````bash
#!/bin/bash
# bootstrap-mdbook.sh, v39 — bootstrap an mdBook project and deploy it to
# GitHub Pages. Linux x86_64 only.
#
# Installs the current mdBook release, writes a ready-to-edit book under
# PROJECT_DIR/BOOK_TITLE, wires a first-party GitHub Pages deploy workflow pinned to
# that mdBook version and its exact bytes, and opens a live preview. After the first
# push, enable Pages once by hand: Settings -> Pages -> Source -> "GitHub Actions"
# (the workflow cannot; configure-pages needs a stored PAT this script won't ask for).
#
# The mdBook version is pinned: CI verifies the tarball's sha256 against the digest
# installed here, so a new/re-pointed release never changes your published book.
# Re-running is the update path — it re-pins everything and leaves src/ untouched;
# book.toml, theme/, custom.css, custom.js and the workflow are script-owned and
# regenerate, so hand edits to them do not survive a re-run (see guide).
#
# GIT_REPO_URL (an https github.com URL) wires the edit-page icon, site-url (so the
# 404 page resolves assets at any depth), the README link, and the git 'origin'
# remote. Left empty, the icon and site-url are omitted. No repo icon is written: it
# duplicates the commit link the sidebar footer already carries.
#
# Fixed theme mode ships a reading theme (self-hosted Charter, ~700px measure, warm
# ink on a near-black ground, inked-underlined links, hairlines under H1/H2) and a
# palette covering every colour mdBook paints. It is dark for every reader unless
# LIGHT_THEME is true, which writes the light counterpart as well and lets the
# reader's browser or OS light/dark preference choose between the two. Drop the four Charter woff2 into
# src/fonts/ and re-run to enable the face; until then a serif fallback renders and no
# @font-face is emitted. Fixed mode also writes theme/: head.hbs clears a stale saved
# theme (picker hidden; localStorage shared across one github.io origin), and
# fonts/fonts.css drops mdBook's Open Sans + Source Code Pro (~493KB) it doesn't use.
#
# Every book loads custom.js: 'b' toggles the sidebar (listed in mdBook's '?' popup),
# off-site links open in a new tab, print.html gets a back link, and a sidebar-footer
# line shows the build ("<version> · updated <date> · <sha>"). The version is
# git-describe (v1.2 on the tag, v1.2+5 five commits later); it is stamped by the
# workflow, so a local build shows no line. See guide.
#
# CODE_LINE_NUMBERS (default on) numbers language-fenced code blocks of 10+ lines with
# a gutter beside <code> (never inside it, so the copy button stays exact).
#
# SIDEBAR_MASTHEAD (none | text | image) fills the sidebar band opposite the menu bar.
# "text" = BOOK_TITLE in the menu-bar title's face, sticky, with a hairline on scroll;
# "image" = src/logo.svg masked into the band; "none" = the title stays in the bar.
#
# FAVICON_TEXT is the second source for theme/favicon.svg, which is written in every
# theme and masthead mode. src/logo.svg, present, is copied verbatim and always wins;
# failing that, FAVICON_TEXT is drawn as letters ("auto" = the first alphanumeric of
# BOOK_TITLE, "" = nothing, leaving mdBook's bundled icon). A drawn mark is not in
# Charter and cannot be — a favicon is fetched as an image, and an image loads no
# @font-face. See guide.
#
# src/unlisted/ is a reserved directory. A chapter listed from there is published and
# reachable, but its sidebar row is hidden and the prev/next links into it are removed
# (so the arrow keys skip it too), and book.toml drops the whole directory from the
# search index. No toggle and no per-page edit: the path is the whole convention. List
# such chapters LAST in SUMMARY.md, and note print.html still concatenates them. This
# is unlisted, not private. See guide.
#
# In fixed mode a heading may carry a subtitle — <p class="mdb-subtitle">…</p> on the
# line under it (renders below the rule, muted italic) — and a digression an
# <aside>…</aside> (muted, smaller, thin left rule). No markdown is parsed inside
# either; write emphasis/links as HTML. See guide.

set -euo pipefail

## ─── user configuration ──────────────────────────────────────────────────
# edit these

PROJECT_DIR="$HOME/Desktop"               # parent folder your books live under
BOOK_TITLE="mybook"                       # book title AND the folder name
BOOK_AUTHOR="John Doe"                    # rendered in book.toml
DEPLOY_BRANCH="main"                      # CI trigger + git default branch
HEADING_NUMBERS=false                     # true enables mdbook-numbering (h2-h6)
SIDEBAR_NUMBERS=true                      # sidebar chapter numbers (1., 1.1.);
                                          # false hides them (no-section-label)
THEME_MODE="fixed"                        # "fixed" (default): hide the picker,
                                          #   OS drives PREFERRED_LIGHT/DARK.
                                          # "default": stock mdBook themes +
                                          #   picker. NB the value named
                                          #   "default" is NOT the default.
LIGHT_THEME=false                         # fixed mode only. false (default): the book
                                          #   is dark for every reader, whatever their
                                          #   browser or OS is set to. true: the light
                                          #   palette is written too, and the reader's
                                          #   prefers-color-scheme picks between the
                                          #   two — still with no in-page control, so
                                          #   the browser setting is the only switch.
                                          #   PREFERRED_LIGHT is consulted only when
                                          #   this is true.
PREFERRED_LIGHT="light"                   # light-mode theme (fixed mode, LIGHT_THEME
                                          # true only)
PREFERRED_DARK="ayu"                      # dark-mode theme (fixed mode only)
GIT_REPO_URL=""                           # https://github.com/user/repo — icons,
                                          # site-url, README link, origin remote;
                                          # empty -> icons and site-url omitted
CODE_LINE_NUMBERS=true                    # line numbers on language-fenced code
                                          # blocks of 10 lines or more (a gutter
                                          # beside <code>; copy button and Ctrl+C
                                          # stay exact). Shorter blocks: no numbers
SIDEBAR_MASTHEAD="text"                   # what fills the sidebar band opposite the
                                          # menu bar. One of:
                                          #  "text"  (default) BOOK_TITLE, set in the
                                          #     menu-bar title's own face, size and
                                          #     baseline and left-aligned with the
                                          #     chapters below it; the menu-bar title
                                          #     fades out while the sidebar is showing.
                                          #     Needs no file and no configuration:
                                          #     rename the book and the mark follows.
                                          #  "none"  nothing; the book title stays in
                                          #     the menu bar, as mdBook ships it.
                                          #  "image" src/logo.svg, masked into the
                                          #     band and painted in the sidebar text
                                          #     colour — so ONE file serves light and
                                          #     dark. That makes it an ALPHA mask:
                                          #     supply a flat silhouette (a monogram)
                                          #     on a TRANSPARENT ground, or the
                                          #     painted background masks the whole
                                          #     band solid. You must add src/logo.svg
                                          #     yourself; the script warns if it is
                                          #     missing.
FAVICON_TEXT="auto"                       # what theme/favicon.svg draws when there is
                                          # no src/logo.svg. src/logo.svg ALWAYS wins:
                                          # present, it is copied verbatim, in every
                                          # theme mode and every masthead mode, and
                                          # this key is not consulted — so a text
                                          # masthead and a file favicon coexist.
                                          # Otherwise the value here is drawn as
                                          # letters on a transparent ground: no plate,
                                          # ink in the palette's --fg, swapping to the
                                          # dark ink under prefers-color-scheme: dark.
                                          # One of:
                                          #  "auto" (default) the first alphanumeric
                                          #     character of BOOK_TITLE — "m" for the
                                          #     shipped "mybook". Needs no file and no
                                          #     upkeep: rename the book and the mark
                                          #     follows.
                                          #  any other string, drawn as typed, case
                                          #     preserved, first 3 characters only
                                          #     (longer truncates, with a warning).
                                          #  ""     draw nothing, and leave mdBook's
                                          #     own bundled favicon in place.
                                          # NB a drawn mark is NOT in Charter and
                                          # cannot be: a favicon is fetched as an
                                          # image, and an image never loads an
                                          # @font-face. The stack below it renders.
# The version label in the sidebar footer is NOT set here: the deploy workflow reads
# it out of git and stamps it in. Cut a tag with
#   git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0
# The workflow fires on tag pushes as well as branch pushes, so the tag alone is
# enough to deploy. Commits after it read v0.2.0+1, v0.2.0+2, ... until the next tag
# — so tagging once a release, not once a commit, still keeps a version on every
# build. A repository with no tag at all shows just its date and commit; a local
# build, which nothing stamps, shows no line.

# Expand leading ~ in PROJECT_DIR (bash doesn't inside quoted assignments).
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
# Make relative paths absolute against $PWD.
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
# The book is created in a folder named for its title, under PROJECT_DIR.
BOOK_DIR="$PROJECT_DIR/$BOOK_TITLE"

## ─── internals ───────────────────────────────────────────────────────────

# Action SHAs. Pinning to a SHA (not a moving tag like @v5) protects against
# the upstream repo being compromised: a SHA can't be re-pointed. All four are
# first-party (github.com/actions). Bump occasionally for security fixes;
# resolve a tag to its commit SHA via:
#   git ls-remote https://github.com/actions/REPO refs/tags/TAG^{}
ACTIONS_CHECKOUT_SHA="9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0"         # v7.0.0
ACTIONS_CONFIGURE_PAGES_SHA="45bfe0192ca1faeb007ade9deae92b16b8254a0d"  # v6.0.0
ACTIONS_UPLOAD_PAGES_SHA="fc324d3547104276b827a68afc52ff2a11cc49c9"     # v5.0.0
ACTIONS_DEPLOY_PAGES_SHA="cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"     # v5.0.0

# Pinned like everything else the build consumes. Bump deliberately.
MDBOOK_NUMBERING_VERSION="0.5.0"

# The five theme names mdBook ships. PREFERRED_LIGHT/DARK must be one of these:
# the palette below is written as html.<name>{...}, so a name mdBook does not
# emit would silently apply no palette at all.
MDBOOK_THEMES="light rust coal navy ayu"

MDBOOK_VERSION=""
MDBOOK_SHA256=""
SITE_URL=""
PAGES_URL=""

TMP_DIR=""
cleanup() { [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR"; return 0; }
trap cleanup EXIT

say()  { echo "$*"; }
warn() { echo "WARN: $*" >&2; }
die()  { echo "ERROR: $*" >&2; exit 1; }

# apt's index goes stale on a long-lived install; refresh it before the first
# install so a missing Packages entry doesn't fail the bootstrap.
apt_install() {
    sudo apt-get update
    sudo apt-get install -y "$@"
}

# Escape a value for a double-quoted string literal. A TOML basic string, a JS string
# literal and a CSS string all need the same two escapes here, and v23 carried one
# function per consumer with byte-identical bodies: backslash first (so the ones we
# add are not re-escaped), then the double quote. Lets a title, an author or a URL
# contain an apostrophe or a quote without breaking book.toml, custom.js, or the
# masthead's content: "..." in custom.css. A literal newline is the only thing that
# still breaks any of the three, and validate_config rejects it.
esc_dq() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# Escape a value for XML character data. A different job from esc_dq, not a variant of
# it: esc_dq escapes backslash and double quote, which is what a TOML/JS/CSS string
# literal needs and what an SVG needs NOTHING of, and it leaves &, < and > alone, which
# is exactly the set an SVG does need. Putting a title's '&' into <text> unescaped
# makes the file not well-formed, and a browser handed a malformed SVG renders nothing
# at all rather than the part it could parse — so the favicon would just silently fail.
# Ampersand first, so the ones added after it are not re-escaped.
#
# The backslashes in the replacements are load-bearing and must not be tidied away.
# Bash treats an UNQUOTED & in a ${var//pat/repl} replacement as the matched text, the
# way sed does, so ${s//</&lt;} substitutes "<lt;" — the escape it was meant to write,
# with its ampersand eaten. \& is the literal one. (${s//&/&amp;} happens to survive
# unescaped, since there the matched text IS an ampersand; escaping it too keeps all
# three lines saying the same thing.)
esc_xml() {
    local s="$1"
    s="${s//&/\&amp;}"
    s="${s//</\&lt;}"
    s="${s//>/\&gt;}"
    printf '%s' "$s"
}

# Derive the Pages URL and site-url from GIT_REPO_URL, which validate_config has
# already constrained to https://github.com/user/repo. Both are empty when
# GIT_REPO_URL is: nothing here can be guessed from an unset remote.
#
# site-url matters more than it looks. GitHub Pages serves /repo/404.html for a
# miss at /repo/a/b/c while the browser's URL stays at the deep path, so the 404
# page's relative asset links resolve against /repo/a/b/ and every stylesheet and
# script 404s. Given site-url, mdBook emits <base href="..."> on that page and it
# renders. A user/org site (the repo literally named user.github.io) publishes at
# the origin root, so its site-url is "/" and its Pages URL has no repo segment.
# A custom domain cannot be detected here — set site-url and the README by hand.
derive_pages() {
    SITE_URL=""
    PAGES_URL=""
    [ -n "$GIT_REPO_URL" ] || return 0
    local rest user repo
    rest="${GIT_REPO_URL#https://github.com/}"
    rest="${rest%/}"
    rest="${rest%.git}"
    user="${rest%%/*}"
    repo="${rest##*/}"
    if [ "$repo" = "${user}.github.io" ]; then
        SITE_URL="/"
        PAGES_URL="https://${user}.github.io/"
    else
        SITE_URL="/${repo}/"
        PAGES_URL="https://${user}.github.io/${repo}/"
    fi
}

## ─── orchestration ───────────────────────────────────────────────────────

main() {
    [ $# -eq 0 ] || die "this script takes no arguments; got: $*"
    validate_config
    derive_pages
    mkdir -p "$BOOK_DIR/bin"
    cd "$BOOK_DIR"
    init_git_repo
    ensure_git_remote
    ensure_curl
    # Resolve the version once; the local binary, the workflow and the digest
    # check all pin to it.
    MDBOOK_VERSION=$(get_latest_mdbook_version)
    [ -n "$MDBOOK_VERSION" ] || die "could not resolve the current mdBook version"
    install_mdbook
    [ -n "$MDBOOK_SHA256" ] || die "could not determine the mdBook tarball digest"
    write_book_files
    write_theme
    write_custom_css
    write_custom_js
    write_gitignore
    write_readme
    if [ "$HEADING_NUMBERS" = true ]; then
        ensure_cargo
        ensure_mdbook_numbering
        ensure_numbering_config
    fi
    write_workflow
    git_initial_commit
    local port
    port=$(pick_port)
    say ""
    say "first deploy: push, then set Settings -> Pages -> Source -> \"GitHub Actions\" once."
    say "done. starting preview at http://127.0.0.1:${port} (Ctrl-C to stop)."
    say "re-launch later with: cd \"$BOOK_DIR\" && ./bin/mdbook serve --open -n 127.0.0.1 -p ${port}"
    say "run a second book alongside this one by giving it a different -p port."
    say ""
    ./bin/mdbook serve --open -n 127.0.0.1 -p "$port"
}

## ─── checks ──────────────────────────────────────────────────────────────

# book.toml values are written as escaped double-quoted basic strings, so quotes
# are safe. A literal newline is the only thing that still breaks them, and it is
# never valid in any of these fields, so reject it outright.
validate_config() {
    [ -n "$BOOK_TITLE" ] || die "BOOK_TITLE must not be empty; it is also the folder name"
    case "$BOOK_TITLE"      in *$'\n'*|*$'\r'*) die "BOOK_TITLE must not contain newlines" ;; esac
    case "$BOOK_TITLE"      in */*) die "BOOK_TITLE is also the folder name, so it must not contain '/'" ;; esac
    case "$BOOK_AUTHOR"     in *$'\n'*|*$'\r'*) die "BOOK_AUTHOR must not contain newlines" ;; esac
    case "$DEPLOY_BRANCH"   in *$'\n'*|*$'\r'*) die "DEPLOY_BRANCH must not contain newlines" ;; esac
    case "$HEADING_NUMBERS" in true|false) ;; *) die "HEADING_NUMBERS must be true or false, got: $HEADING_NUMBERS" ;; esac
    case "$SIDEBAR_NUMBERS" in true|false) ;; *) die "SIDEBAR_NUMBERS must be true or false, got: $SIDEBAR_NUMBERS" ;; esac
    case "$THEME_MODE"      in fixed|default) ;; *) die "THEME_MODE must be fixed or default, got: $THEME_MODE" ;; esac
    case "$LIGHT_THEME"     in true|false) ;; *) die "LIGHT_THEME must be true or false, got: $LIGHT_THEME" ;; esac
    case "$CODE_LINE_NUMBERS" in true|false) ;; *) die "CODE_LINE_NUMBERS must be true or false, got: $CODE_LINE_NUMBERS" ;; esac
    case "$SIDEBAR_MASTHEAD"  in none|text|image) ;; *) die "SIDEBAR_MASTHEAD must be none, text or image, got: $SIDEBAR_MASTHEAD" ;; esac
    # FAVICON_TEXT is free-form — it is drawn, not matched — so this is the same
    # newline check every other free-form string here gets, and nothing more. It is
    # not a validity check on the SVG: a control character would still make the file
    # invalid XML, and esc_xml does not encode one. Type letters.
    case "$FAVICON_TEXT"      in *$'\n'*|*$'\r'*) die "FAVICON_TEXT must not contain newlines" ;; esac

    # A theme name mdBook does not ship would leave html.<name> matching nothing,
    # so the palette would silently not apply. Catch the typo here instead.
    local t found
    for v in PREFERRED_LIGHT PREFERRED_DARK; do
        found=false
        for t in $MDBOOK_THEMES; do
            [ "${!v}" = "$t" ] && found=true
        done
        [ "$found" = true ] || die "$v must be one of: $MDBOOK_THEMES (got: ${!v})"
    done

    # Everything downstream — the edit icon, site-url, the Pages URL,
    # the origin remote, the commit links in the sidebar footer — assumes GitHub
    # over https, and the deploy path is GitHub Actions to GitHub Pages regardless.
    # An ssh or non-GitHub URL would produce a broken icon and a nonsense Pages URL,
    # so require the one form that works.
    case "$GIT_REPO_URL" in
        "") ;;
        *$'\n'*|*$'\r'*) die "GIT_REPO_URL must not contain newlines or carriage returns" ;;
        https://github.com/*/*) ;;
        *) die "GIT_REPO_URL must be an https github.com URL (https://github.com/user/repo), got: $GIT_REPO_URL" ;;
    esac
}

## ─── install ─────────────────────────────────────────────────────────────
# curl, mdBook, cargo, mdbook-numbering, git

ensure_curl() {
    command -v curl >/dev/null 2>&1 || apt_install curl
}

# Parse the redirect on /releases/latest to avoid the GitHub API rate limit.
get_latest_mdbook_version() {
    curl --fail -sSLo /dev/null -w "%{url_effective}" \
        "https://github.com/rust-lang/mdBook/releases/latest" \
        | sed -E 's|.*/tag/([^/?#[:space:]]+).*|\1|' \
        | tr -d '\r\n'
}

current_mdbook_version() {
    [ -x "bin/mdbook" ] || return 0
    bin/mdbook --version 2>/dev/null | awk '{print $2}'
}

# Downloads the release tarball, records its sha256, and installs the binary.
# The digest is the point: the workflow pins the mdBook *version*, but a version
# tag names a file, not its contents. CI re-downloads that file and checks it
# against this digest, so the deployed book is built from the same bytes that were
# installed here. mdBook publishes no digest of its own (the .sha256 asset does not
# exist), so it has to be computed from the download. The digest is cached beside
# the binary — bin/ is gitignored — so a re-run that finds the right version
# already installed still has a digest to pin the workflow with, without
# re-downloading.
install_mdbook() {
    local version current triple archive url bin
    version="$MDBOOK_VERSION"

    current=$(current_mdbook_version)
    if [ -n "$current" ] && [ "${current#v}" = "${version#v}" ] && [ -s "bin/.mdbook.sha256" ]; then
        MDBOOK_SHA256=$(cat bin/.mdbook.sha256)
        say "mdBook ${current} already installed"
        return
    fi

    triple="x86_64-unknown-linux-gnu"
    archive="mdbook-${version}-${triple}.tar.gz"
    url="https://github.com/rust-lang/mdBook/releases/download/${version}/${archive}"

    TMP_DIR=$(mktemp -d)
    say "downloading mdBook ${version}..."
    curl --fail -sSL "$url" -o "$TMP_DIR/$archive"
    [ -s "$TMP_DIR/$archive" ] || die "download produced empty file"

    MDBOOK_SHA256=$(sha256sum "$TMP_DIR/$archive" | awk '{print $1}')
    case "$MDBOOK_SHA256" in
        [0-9a-f][0-9a-f]*) ;;
        *) die "could not compute the mdBook tarball sha256" ;;
    esac
    printf '%s' "$MDBOOK_SHA256" > bin/.mdbook.sha256

    tar -xzf "$TMP_DIR/$archive" -C "$TMP_DIR"
    bin=$(find "$TMP_DIR" -maxdepth 2 -name mdbook -type f -print -quit)
    [ -n "$bin" ] || die "mdbook binary not found in archive"
    chmod +x "$bin"
    mv "$bin" "$BOOK_DIR/bin/mdbook"
    say "installed: $(./bin/mdbook --version) (sha256 ${MDBOOK_SHA256:0:12}...)"
}

ensure_cargo() {
    command -v cargo >/dev/null 2>&1 && return
    if [ -f "$HOME/.cargo/env" ]; then
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env"
        command -v cargo >/dev/null 2>&1 && return
    fi

    dpkg -s build-essential >/dev/null 2>&1 || apt_install build-essential

    [ -n "${TMP_DIR:-}" ] || TMP_DIR=$(mktemp -d)
    say "installing rustup..."
    curl --fail -sSf https://sh.rustup.rs -o "$TMP_DIR/rustup-init.sh"
    sh "$TMP_DIR/rustup-init.sh" -y --default-toolchain stable >/dev/null

    [ -f "$HOME/.cargo/env" ] || die "cargo env file missing after rustup install"
    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"
    export PATH="$HOME/.cargo/bin:$PATH"
    command -v cargo >/dev/null 2>&1 || die "cargo not on PATH after install"
}

# Version-pinned, like the actions and mdBook itself: an unpinned 'cargo install'
# was the last floating input in the build.
ensure_mdbook_numbering() {
    cargo install --list 2>/dev/null | grep -q "^mdbook-numbering v${MDBOOK_NUMBERING_VERSION}:" && return
    say "installing mdbook-numbering ${MDBOOK_NUMBERING_VERSION}..."
    cargo install --locked --version "$MDBOOK_NUMBERING_VERSION" mdbook-numbering
}

# Heading numbering enabled (consecutive style); code-block line numbering
# explicitly disabled. mdbook-numbering's own code numbering injects the same
# highlight.js line-numbers plugin inline into *every chapter*, which rebuilds
# <code> as a <table> and so breaks mdBook's copy button; custom.js numbers with
# a gutter instead (see write_custom_js). Appends to book.toml after
# render_book_toml has written the base contents.
ensure_numbering_config() {
    grep -q '^\[preprocessor\.numbering\]' book.toml && return
    cat >> book.toml <<'EOF'

[preprocessor.numbering]

[preprocessor.numbering.heading]
enable = true
numbering-style = "consecutive"

[preprocessor.numbering.code]
enable = false
EOF
    say "appended numbering config to book.toml"
}

init_git_repo() {
    [ -d ".git" ] && return
    if git init -b "$DEPLOY_BRANCH" >/dev/null 2>&1; then
        say "initialised git repo on branch: $DEPLOY_BRANCH"
    else
        warn "git init failed - run manually later"
    fi
}

# Derive the 'origin' remote from GIT_REPO_URL so the first push needs no manual
# 'git remote add'. GIT_REPO_URL is the https web URL (validate_config enforces
# that); this converts it to the ssh form you push with. Idempotent: updates
# origin if present, adds it otherwise. Skipped when GIT_REPO_URL is empty or git
# is absent; never pushes.
ensure_git_remote() {
    [ -d ".git" ] || return 0
    [ -n "$GIT_REPO_URL" ] || return 0
    local rest ssh
    rest="${GIT_REPO_URL#https://}"       # github.com/user/repo
    rest="${rest%/}"                      # strip any trailing slash
    rest="${rest%.git}"                   # strip any trailing .git
    ssh="git@${rest%%/*}:${rest#*/}.git"
    if git remote get-url origin >/dev/null 2>&1; then
        if git remote set-url origin "$ssh"; then say "updated origin -> $ssh"; else warn "could not update origin"; fi
    else
        if git remote add origin "$ssh"; then say "set origin -> $ssh"; else warn "could not add origin"; fi
    fi
}

# Create an initial commit so `git push` has a ref. Skipped if the repo already
# has commits, or (with a hint) if no git identity is configured. Runs after the
# files are written, so the scaffold is captured in the commit.
git_initial_commit() {
    [ -d ".git" ] || return 0
    git rev-parse HEAD >/dev/null 2>&1 && return 0
    git add -A
    if git commit -q -m "initial mdBook scaffold" 2>/dev/null; then
        say "created initial commit on ${DEPLOY_BRANCH}"
    else
        warn "no git identity set; configure user.name/user.email, then: git add -A && git commit"
    fi
}

# First free TCP port at or above 3000 on the IPv4 loopback, via bash's /dev/tcp
# (no external tools). Serving with -n 127.0.0.1 makes mdBook bind the same
# address this probes, so a second book started later lands on the next port.
pick_port() {
    local port=3000
    while (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do
        port=$((port + 1))
    done
    printf '%s' "$port"
}

## ─── file writers ────────────────────────────────────────────────────────
# Only src/ is preserved on re-run (the user's content). book.toml, theme/,
# custom.css, custom.js and the deploy workflow are script-owned and regenerate.

# book.toml regenerates every run so config changes (GIT_REPO_URL, DEPLOY_BRANCH,
# BOOK_TITLE, BOOK_AUTHOR) take effect without manual deletion. The trade-off:
# hand edits to book.toml (theme, additional-css, numbering style) are overwritten
# on re-run — set those via the toggles here, or update bin/mdbook manually instead
# of re-running. src/ is never touched.
write_book_files() {
    render_book_toml > book.toml
    if [ -f src/SUMMARY.md ]; then
        say "regenerated book.toml; src/ preserved"
        return
    fi
    mkdir -p src
    render_summary  > src/SUMMARY.md
    render_about    > src/about.md
    render_chapter  > src/chapter_1.md
    render_demo_svg > src/demo.svg
    say "wrote book.toml, src/SUMMARY.md, src/about.md, src/chapter_1.md, src/demo.svg"
}

write_gitignore() {
    touch .gitignore
    grep -qxF 'bin/'  .gitignore || echo 'bin/'  >> .gitignore
    grep -qxF 'book/' .gitignore || echo 'book/' >> .gitignore
}

# Resolve FAVICON_TEXT to the characters render_favicon_svg actually draws. Empty
# output means draw nothing, which is what FAVICON_TEXT="" asks for.
#
# "auto" takes the first ALPHANUMERIC character of BOOK_TITLE, not simply its first: a
# title may open with a quote, a bracket, a dash or a space, none of which reads as a
# mark at 16px. A title with no alphanumeric character anywhere in it resolves to
# nothing and warns, rather than writing a blank favicon over mdBook's own.
#
# Anything else is drawn as typed and capped at three characters — a favicon is only
# ever shown at tab size, and a fourth letter there is a smudge. Truncating warns:
# silently dropping the tail of a wordmark someone typed would be a puzzle to debug.
#
# Character counting follows the locale, as bash's does: by character in a UTF-8
# locale, by byte under LC_ALL=C. Under LC_ALL=C a non-ASCII title falls through to
# the first ASCII letter or digit (a high byte is not [[:alnum:]] there), which is a
# poorer mark but never a broken one.
favicon_mark() {
    local mark="" i c
    if [ "$FAVICON_TEXT" = "auto" ]; then
        for ((i = 0; i < ${#BOOK_TITLE}; i++)); do
            c="${BOOK_TITLE:i:1}"
            if [[ "$c" == [[:alnum:]] ]]; then
                mark="$c"
                break
            fi
        done
        [ -n "$mark" ] || warn "FAVICON_TEXT is \"auto\" but BOOK_TITLE has no alphanumeric character to take a mark from; no favicon is written and mdBook's own is kept"
    else
        mark="${FAVICON_TEXT:0:3}"
        if [ "${#FAVICON_TEXT}" -gt 3 ]; then
            warn "FAVICON_TEXT is ${#FAVICON_TEXT} characters and a favicon is read at 16px; only \"${mark}\" is drawn"
        fi
    fi
    printf '%s' "$mark"
}

# The favicon as letters, for the branch where there is no src/logo.svg to copy.
#
# Letters on a transparent ground — no plate. A favicon is composited onto whatever
# the browser paints behind a tab, and that colour is the browser's, not the site's;
# a plate in the wrong one is more conspicuous than no plate at all. The ink is the
# palette's --fg for each mode (#191713 light, #e8e6da dark), swapped by a
# prefers-color-scheme query INSIDE the file. That query works where an @font-face
# would not: a favicon is fetched as an image, so it gets no network of its own, but
# its own <style> is part of the document and applies. mdBook's bundled favicon.svg
# swaps its fill the same way, which is the proof it works in the favicon slot.
#
# The stack is the theme's --serif, Charter first — and Charter will resolve here ONLY
# for a reader who has it installed as a system font, because the woff2 in src/fonts/
# are on the network this file cannot use. Everyone else gets the next face down. That
# is a limit of the format, not a gap to close: see the same note on the SVG masthead
# in write_custom_css. Naming Charter first still costs nothing and wins where it can.
#
# 100x100 viewBox because a favicon is drawn into a square. font-size falls as the
# mark lengthens and the baseline rises with it, so each length fills the square
# without spilling out of it. Measured in Chromium at a 200px render, the ink of a
# capital or a digit sits 55 above / 50 below, and of a three-letter mark 78 / 73 —
# centred either way. A lowercase single letter is the exception and sits low (82 /
# 50), because its ink is an x-height, not a cap height; that is the shipped default
# ("m" from "mybook") and it is normal typography, not a misplacement.
render_favicon_svg() {
    local mark="$1" size baseline ink="#191713" swap=""
    case "${#mark}" in
        1) size=72; baseline=75 ;;
        2) size=50; baseline=68 ;;
        *) size=36; baseline=63 ;;
    esac
    # A dark-only book has one ink, so the query below could only ever resolve one
    # way: draw the dark ink flat and omit it. Everywhere else — LIGHT_THEME=true,
    # or default mode, where the palette is mdBook's and not ours — both inks are
    # live and the query picks between them.
    if [ "$THEME_MODE" = fixed ] && [ "$LIGHT_THEME" = false ]; then
        ink="#e8e6da"
    else
        swap='
    @media (prefers-color-scheme: dark){text{fill:#e8e6da}}'
    fi
    cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    text{font-family:"Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;font-weight:700;fill:${ink}}${swap}
  </style>
  <text x="50" y="${baseline}" text-anchor="middle" font-size="${size}">$(esc_xml "$mark")</text>
</svg>
EOF
}

# mdBook merges theme/ over its built-in front end (a file there replaces the
# built-in; anything absent keeps it). Files here are fixed mode only, except
# favicon.svg.
#
# theme/head.hbs clears a saved theme ahead of mdBook's theme script. Needed because
# fixed mode hides the picker and localStorage is scoped to the ORIGIN — every project
# site under one user.github.io shares it, so a theme chosen in another book would pin
# this one. Clearing it lets mdBook resolve from the OS preference (and pick the
# matching highlight.js stylesheet, which a later custom.js fix could not).
#
# theme/fonts/fonts.css: its presence makes mdBook emit fonts.css and ONLY the fonts
# in theme/fonts/ (none), dropping its own Open Sans + Source Code Pro (~493KB, which
# this theme doesn't use). Charter is NOT declared here — mdBook won't rewrite url()
# inside a fonts.css it didn't generate, so it would 404; it's in custom.css with the
# woff2 in src/fonts/ (copied verbatim, unhashed).
#
# theme/favicon.svg has TWO sources and is written in every theme mode — NOT gated on
# SIDEBAR_MASTHEAD, since a favicon and a sidebar mark are different jobs. src/logo.svg
# is copied verbatim whenever it exists; failing that, FAVICON_TEXT is drawn as letters
# (favicon_mark resolves what, render_favicon_svg draws it). The file always wins over
# the text. Either source replaces mdBook's own favicon.svg and, with it, mdBook's
# favicon.png: theme/mod.rs sets favicon_png to None when only the svg is overridden,
# so the built site carries the one file and index.hbs emits the one <link>.
#
# favicon.svg is deliberately NOT in the rm -f above, and that is not an oversight.
# The two files that ARE cleared are fixed-mode-only, and a stale copy of either goes
# on doing harm — head.hbs keeps wiping the saved theme, fonts.css keeps suppressing
# mdBook's stock fonts — so switching THEME_MODE to "default" has to remove them.
# A stale favicon does nothing but show an old mark, and clearing it would delete a
# favicon that a hand-built or hand-edited tree put there, which no re-run could give
# back. So: it is written when there is a source, and left alone when there is not.
# Removing src/logo.svg, or setting FAVICON_TEXT="", stops it being REGENERATED; it
# does not delete the last one. Delete theme/favicon.svg by hand for that.
write_theme() {
    # Clear the fixed-mode-only overrides first, so switching THEME_MODE to "default"
    # and re-running does not leave them behind: a stale head.hbs would keep wiping the
    # saved theme on every load (picker never remembers), and a stale fonts.css would
    # keep suppressing mdBook's stock fonts. Fixed mode recreates both below. favicon.svg
    # is a separate job and is left alone.
    rm -f theme/head.hbs theme/fonts/fonts.css
    local mark=""
    if [ -f src/logo.svg ]; then
        mkdir -p theme
        cp src/logo.svg theme/favicon.svg
        say "wrote theme/favicon.svg (from src/logo.svg)"
        # A say, not a warn: preferring the file is the documented behaviour, not a
        # mistake to be corrected. But ignoring a FAVICON_TEXT somebody typed without
        # a word would be a puzzle, so name the winner.
        if [ -n "$FAVICON_TEXT" ]; then
            say "  (src/logo.svg wins; FAVICON_TEXT \"${FAVICON_TEXT}\" is not drawn)"
        fi
    # The assignment sits in the elif condition so favicon_mark runs only on the branch
    # that uses it: its truncation and no-alphanumeric warnings must not fire for a
    # book whose favicon came from the file and never consulted FAVICON_TEXT at all.
    elif mark=$(favicon_mark); [ -n "$mark" ]; then
        mkdir -p theme
        render_favicon_svg "$mark" > theme/favicon.svg
        say "wrote theme/favicon.svg (drawn from FAVICON_TEXT: \"${mark}\")"
    fi
    [ "$THEME_MODE" = fixed ] || return 0
    mkdir -p theme/fonts
    cat > theme/head.hbs <<'EOF'
{{!-- Script-owned; regenerated on every run.

     Fixed theme mode hides the theme picker, so a theme saved in localStorage
     would pin this book with no control left to change it. localStorage is scoped
     to the origin, and every GitHub project site under one user shares one origin.
     Clearing the key here, ahead of mdBook's own theme script, lets that script
     resolve the theme from book.toml — and pick the matching highlight.js
     stylesheet with it, which a later custom.js fix could not. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    cat > theme/fonts/fonts.css <<'EOF'
/* Script-owned; regenerated on every run.

   Deliberately declares no faces. Its presence makes mdBook emit this file and
   only the font files in theme/fonts/ — none — instead of its built-in Open Sans
   and Source Code Pro, which this theme does not use. Charter is declared in
   custom.css and its woff2 live in src/fonts/. */
EOF
    say "wrote theme/head.hbs, theme/fonts/fonts.css"
}

# True only when all four Charter faces are present in src/fonts/. The @font-face
# block is emitted only then: declared unconditionally, a book without the fonts
# requests four woff2 that do not exist on every single page load, forever.
charter_present() {
    local f
    for f in charter_regular charter_italic charter_bold charter_bold_italic; do
        [ -f "src/fonts/${f}.woff2" ] || return 1
    done
    return 0
}

# custom.css is always written. In fixed theme mode it carries the reading theme
# (Charter, ~700px measure, a 60px menu bar, the palette, hairlines under H1/H2, and
# a code-block ground the stock highlight sheets do not expose as a variable); in
# every mode it sets the top gap that holds the two columns' first lines level, makes
# a chapter's '---' and a SUMMARY's '---' draw the same rule, styles the sidebar
# site-meta footer and the print.html back-link that custom.js injects, and the
# per-page wide marker; when CODE_LINE_NUMBERS is on it styles the line-number
# gutter; and when SIDEBAR_MASTHEAD is text or image it fills the band opposite the
# menu bar and fades the menu-bar title out behind it. The always-on rules use
# fallback values so they also work under stock (default-mode) mdBook themes where
# the theme vars aren't defined. mdBook rebases rem to 10px (html{font-size:62.5%});
# px is literal, rem pre-scaled. The #mdbook-theme-toggle id matches the pinned
# release; a future release could rename it and silently un-hide the picker (see
# guide).
write_custom_css() {
    # The palette's selector, used by the palette block and the print override alike.
    # With LIGHT_THEME=true it must name BOTH theme classes (see STRUCTURE below);
    # dark-only, book.toml pins both mdBook keys to PREFERRED_DARK, so that is the
    # only class ever on <html> and the only one worth naming.
    local pal_sel="html.${PREFERRED_LIGHT},html.${PREFERRED_DARK}"
    [ "$LIGHT_THEME" = true ] || pal_sel="html.${PREFERRED_DARK}"
    : > custom.css
    if [ "$THEME_MODE" = fixed ]; then
        mkdir -p src/fonts
        cat >> custom.css <<EOF
/* Fixed theme: hide the picker, so the theme is not the reader's to choose in the
   page. With LIGHT_THEME=true their browser's light/dark preference drives it;
   otherwise the book is dark throughout. A saved theme would pin the book with no
   control left to change it — theme/head.hbs clears it. */
#mdbook-theme-toggle { display: none; }
EOF
        if charter_present; then
            cat >> custom.css <<'EOF'

/* Self-hosted Charter (free, ~28KB/weight). custom.css is served from the book
   root and CSS urls resolve against the stylesheet, so "fonts/x.woff2" finds the
   copy mdBook makes of src/fonts/x.woff2 — copied verbatim, not content-hashed. */
@font-face{font-family:"Charter";src:url("fonts/charter_regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_italic.woff2") format("woff2");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_bold.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_bold_italic.woff2") format("woff2");font-weight:700;font-style:italic;font-display:swap}
EOF
        else
            warn "src/fonts/ has no Charter woff2; the fallback face renders and no @font-face is emitted. Download the four from practicaltypography.com/charter.html into src/fonts/ and re-run."
            cat >> custom.css <<'EOF'

/* No @font-face: the four Charter woff2 are not in src/fonts/, and declaring
   faces whose files are absent 404s four requests on every page load. The
   fallback stack below renders instead. Add them and re-run. */
EOF
        fi
        cat >> custom.css <<'EOF'

/* mdBook sets html{font-size:62.5%} -> 1rem = 10px. px is literal; rem pre-scaled.

   --menu-bar-height is mdBook's own (50px). Everything that depends on the bar is
   expressed in terms of it — by mdBook (the sticky hover placeholder's height, the
   negative top margin on .page that pulls the bar to the viewport top, the icons'
   and the title's line-height, :target's scroll-margin) and by this file (the
   masthead band, the sidebar's scrollbox padding) — so raising it here raises all
   of them together and the two columns stay level. 50px leaves a 24px serif title
   about 13px of air above and below it, and the page scrolls under the bar, so that
   13px is the whole clearance between the title and the body text passing beneath.
   60px is the same title with room to breathe. */
:root{
  --serif: "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;
  --content-max-width: 700px;
  --menu-bar-height: 60px;
  --mono-font: ui-monospace,"DejaVu Sans Mono","Liberation Mono",Menlo,Consolas,monospace;
}
html{font-family:var(--serif);}
.sidebar{font-size:1.6rem;}
.content{font-size:1.9rem;line-height:1.55;}
.content h1{font-size:3.4rem;line-height:1.18;margin:2.4rem 0 .4em;padding-bottom:.3em;border-bottom:1px solid var(--rule-strong);}
.content h2{font-size:2.5rem;line-height:1.18;margin:3rem 0 .85rem;padding-bottom:.3em;border-bottom:1px solid var(--rule-strong);}
.content h3{font-size:1.9rem;line-height:1.18;margin:2.25rem 0 .55rem;}

/* Subtitle: <p class="mdb-subtitle"> on the line under a heading. Sits BELOW the
   heading's rule; the heading itself is untouched, so its own H1/H2 rule stays
   identical to a subtitle-less heading's. The :has() rule only trims the heading's
   bottom MARGIN (not its rule) to a fixed .5rem, so H1 and H2 both leave the same
   ~5px gap under the rule. */
.content .mdb-subtitle{margin-block:0 0;font-size:1.9rem;font-style:italic;line-height:1.35;color:var(--muted);}
.content h1:has(+ .mdb-subtitle),.content h2:has(+ .mdb-subtitle){margin-block-end:.5rem;}

/* Blockquote, GitHub-style. Scoped to :not(.blockquote-tag) so mdBook's native
   admonitions (> [!NOTE] etc., which ARE .blockquote-tag) keep their coloured accent.
   padding:0 on the block edges plus zeroing the first child's top margin and the last
   child's bottom margin is what keeps the rule flush with the text — without the
   margin reset the inner <p> margins push the rule past the text, top and bottom. */
.content blockquote:not(.blockquote-tag){background:none;border-block:0;border-inline-start:3px solid var(--rule);padding:0 1em;color:var(--muted);}
.content blockquote:not(.blockquote-tag) > :first-child{margin-block-start:0;}
.content blockquote:not(.blockquote-tag) > :last-child{margin-block-end:0;}

/* Aside: <aside>…</aside>, a digression callout — muted, 0.82em, a thin left rule.
   mdBook does not parse markdown inside it; write emphasis or links as HTML. */
.content aside{font-size:.82em;color:var(--muted);border-inline-start:2px solid var(--rule);padding-inline-start:1em;margin:1.15rem 0;}

/* Footnotes, matched to the aside: they are the same kind of thing, a digression,
   and every other subordinate voice here (blockquote, aside, .mdb-subtitle) is
   already --muted. mdBook's general.css sets only font-size:0.9em, which against
   this book's 1.9rem content is 17.1px — a 1.9px step Charter's x-height does not
   read as deliberate. .content .footnote-definition is (0,2,0) over mdBook's
   (0,1,0), and custom.css is its last stylesheet either way. The separator is
   already there: mdBook emits a bare <hr> before the <ol>. */
.content .footnote-definition{font-size:.82em;color:var(--muted);}
/* --links equals --fg in both palettes, so a citation link or a ↩ backref inside a
   muted note would be the brightest thing in it and invert the hierarchy. Muting is
   safe because the affordance here is the underline (.content a above), not colour.
   a:link/a:visited is (0,3,1) over mdBook's .content a:link (0,2,1). */
.content .footnote-definition a:link,.content .footnote-definition a:visited{color:var(--muted);}

/* mdBook's own .content a is text-decoration:none, and --links carries the colour.
   Only the underline is added here; the colour comes from the palette. Search
   results use --links too, so without an underline they render as plain body text
   with no affordance at all — give them the same one. */
.content a,.content a:visited{text-decoration:underline;text-underline-offset:2px;}
#mdbook-searchresults a{text-decoration:underline;text-underline-offset:2px;}

/* The sidebar list is left alone. mdBook's own .chapter li.chapter-item is
   line-height:1.5em; margin-block-start:0.6em — already in em, so it scales with
   the 1.6rem set above, and it is what spaces the rule a SUMMARY '---' draws.
   Overriding it in px-equivalent terms only tightens that rule against the text. */

/* Palette. mdBook defines ~43 colour variables per theme; overriding only the page
   and sidebar leaves blockquotes, tables, the search UI, icons and separators in the
   stock blues, which show the moment a page has a table or quote — so this covers
   every one that paints. Two rule weights: --rule-strong for H1/H2 hairlines and
   separators, --rule for the rest. The five --blockquote-*-color admonition accents
   are deliberately NOT overridden — they're semantic, and standing out is the point.

   STRUCTURE. mdBook resolves the theme in JavaScript, not CSS: it bakes default-theme
   into the served markup as <html class="light"> and an inline script in <body> swaps
   the class after the stylesheets have already resolved. So on a dark-mode reader's
   machine every navigation paints a full light frame first. That frame is what a
   force-dark browser extension reads, and it then holds its inversion of THIS palette
   over the dark one the swap installs — the page ends up part inverted-cream, part
   extension grey.

   That is a LIGHT_THEME=true problem only. Dark-only, book.toml pins default-theme
   and preferred-dark-theme both to PREFERRED_DARK, so the served class is already
   the dark one, nothing swaps, and the selector below collapses to that single
   class with no media query under it at all.

   With both palettes live, the dark block carries BOTH class names and comes first,
   and the light block is gated behind the light media query and comes second:

     html.<light>,html.<dark> { dark }      matches the served class too — the pre-swap
                                            frame is already dark under a dark OS
     @media (prefers-color-scheme: light)
       html.<light> { light }               same specificity, later in the file, so it
                                            wins wherever the query matches

   Four states, all measured: OS dark before the swap -> dark; OS dark after -> dark;
   OS light before -> light; OS light after -> light. No light frame ever paints under
   a dark OS, and each palette is written once.

   Both selectors are (0,1,1), which is what beats mdBook's own .<theme> at (0,1,0). A
   bare html{...} would be (0,0,1) and lose to it, so the class must stay in both
   selectors even though the media query alone would read as sufficient. The print
   block at the bottom of this file has to clear the same (0,1,1) bar for the same
   reason.

   --sidebar-bg sits close to --bg deliberately: about 2 points of CIELAB lightness in
   both modes, enough for the column to read as its own surface and little enough that
   the page reads as one tone. It does NOT match the quote/code ground, which is a
   heavier tint doing a different job. Nor can it go to zero: mdBook draws no border on
   .sidebar, so this tint is the only boundary the column has, and .mobile-nav-chapters
   takes its whole fill from the same variable.

   --code-bg and --inline-bg are not mdBook variables: mdBook paints code backgrounds
   from the highlight.js stylesheet, not a theme variable, so the palette can't reach
   them. Both are repainted below. In light the code ground is the blockquote tint
   (#f4f2e8); in dark it sits a step above it (#242420 over the #1b1b18 quote) because
   at #1b1b18 the block barely parted from the #111 page.
   Only the ground moves; the syntax token colours are left as the highlight theme sets
   them. --inline-bg is a separate, slightly stronger tint so a short inline pill reads
   against both the page and the running text around it. */
EOF
        cat >> custom.css <<EOF
${pal_sel}{
  --bg:#111;--fg:#e8e6da;--links:#e8e6da;--inline-code-color:#ffb454;--inline-bg:#2b281f;--inline-border:#3a382f;--muted:#aaa8a0;
  --rule:#2c2c28;--rule-strong:#42423c;--color-scheme:dark;
  --sidebar-bg:#161613;--sidebar-fg:#cfcdc2;--sidebar-active:#ffb454;
  --sidebar-spacer:#42423c;--sidebar-non-existant:#6b6a61;--sidebar-header-border-color:#42423c;
  --icons:#7a786e;--icons-hover:#e8e6da;
  --copy-button-filter:invert(1) opacity(.55);--copy-button-filter-hover:invert(1) opacity(1);
  --quote-bg:#1b1b18;--quote-border:#2c2c28;--warning-border:#ffb454;--code-bg:#242420;
  --table-border-color:#2c2c28;--table-header-bg:#2c2c28;--table-alternate-bg:#191916;
  --searchbar-bg:#1b1b18;--searchbar-fg:#e8e6da;--searchbar-border-color:#42423c;--searchbar-shadow-color:#42423c;
  --searchresults-border-color:#2c2c28;--searchresults-header-fg:#9a988c;--searchresults-li-bg:#191916;
  --search-mark-bg:#5a4a24;--footnote-highlight:#5a4a24;--overlay-bg:rgba(10,10,8,.7);
}
EOF
    fi
    if [ "$THEME_MODE" = fixed ] && [ "$LIGHT_THEME" = true ]; then
        cat >> custom.css <<EOF
@media (prefers-color-scheme: light){
html.${PREFERRED_LIGHT}{
  --bg:#fdfcf7;--fg:#191713;--links:#191713;--inline-code-color:#b5540a;--inline-bg:#ece3cd;--inline-border:#e0d8c2;--muted:#57564e;
  --rule:#e5e3d7;--rule-strong:#c2bda4;--color-scheme:light;
  --sidebar-bg:#f8f6ee;--sidebar-fg:#3a3a34;--sidebar-active:#b5540a;
  --sidebar-spacer:#c2bda4;--sidebar-non-existant:#a8a496;--sidebar-header-border-color:#c2bda4;
  --icons:#7d7a6e;--icons-hover:#191713;
  --copy-button-filter:opacity(.55);--copy-button-filter-hover:opacity(1);
  --quote-bg:#f4f2e8;--quote-border:#e5e3d7;--warning-border:#b5540a;--code-bg:#f4f2e8;
  --table-border-color:#e5e3d7;--table-header-bg:#e0dccb;--table-alternate-bg:#faf8ee;
  --searchbar-bg:#fdfcf7;--searchbar-fg:#191713;--searchbar-border-color:#c2bda4;--searchbar-shadow-color:#c2bda4;
  --searchresults-border-color:#e5e3d7;--searchresults-header-fg:#57564e;--searchresults-li-bg:#f9f7ec;
  --search-mark-bg:#f2d9a8;--footnote-highlight:#f2d9a8;--overlay-bg:rgba(20,19,15,.6);
}
}
EOF
    fi
    if [ "$THEME_MODE" = fixed ]; then
        cat >> custom.css <<EOF

/* Repaint the code block's ground from the palette. custom.css is the last
   stylesheet mdBook links, after all three highlight sheets, and pre > code.hljs
   (0,1,2) outranks their bare .hljs (0,1,0) anyway. Scoped to pre > : inline code is
   repainted by its own rule below. When the line-number gutter is on it is painted the
   same colour, so the block reads as one surface rather than as two columns with a
   seam down the middle. */
pre > code.hljs{background-color:var(--code-bg);}

/* Inline code. mdBook paints NO ground on inline code: chrome.css gives it only
   padding + radius (:not(pre) > .hljs) and a text colour (:not(pre):not(a) > .hljs),
   so the pill's fill is left to whichever highlight sheet is live — #f6f7f6 (light) or
   #191f26 (ayu), both off this palette and near-invisible on our grounds — and with
   --inline-code-color set to --fg (as it was) the text carried no signal either.
   book.js adds .hljs to every non-header <code> at load, so inline code is code.hljs
   in the browser: repaint it here from the palette. Warm fill + the theme's own accent
   text (ffb454/b5540a) + a hairline drawn as an inset shadow, which — unlike a border —
   does not change the inline box's metrics. :not(pre) excludes block code (its parent
   is <pre>); :not(a) leaves linked code to the link styling. code.hljs makes this
   (0,1,3), over mdBook's own (0,1,2) and the bare .hljs (0,1,0); custom.css is last. */
:not(pre):not(a) > code.hljs{background-color:var(--inline-bg);color:var(--inline-code-color);box-shadow:inset 0 0 0 1px var(--inline-border);}

/* mdBook fills the mobile chapter buttons from --sidebar-bg. Those buttons sit on the
   page ground, not in the sidebar, so a tint tuned to draw a column edge leaves them
   nearly invisible at the widths where they appear (<=1080px, and <=1380px with the
   sidebar open). Give them the blockquote ground instead — same specificity as
   mdBook's own rule, and custom.css is last, so this wins. */
.mobile-nav-chapters{background-color:var(--quote-bg);}

/* print.css resets layout but not colour, and the UA drops backgrounds when
   printing — so a reader whose OS is dark prints near-white ink onto white paper.
   Force ink-on-paper for the print media regardless of the theme in force.

   The selector must name the theme class(es) — the same set the palette named, so it
   is written from the same variable. A media query does not raise specificity, so a
   bare html{...} here is (0,0,1) and loses outright to the palette's (0,1,1) — the
   override silently never applied, which is exactly the failure it exists to prevent.
   Matching the palette's selector ties the specificity; being last in the file wins it.

   Ink stays #111 here even though the screen palette softened its --fg. Butterick's
   case for grey over black is about an emissive screen; paper reflects, and the
   contrast it needs is the other way. */
@media print{
  ${pal_sel}{
       --bg:#fff;--fg:#111;--links:#111;--inline-code-color:#111;--inline-bg:#f5f5f5;--inline-border:#ddd;--muted:#444;
       --rule:#ccc;--rule-strong:#999;--quote-bg:#fff;--quote-border:#ccc;--code-bg:#f5f5f5;
       --table-border-color:#ccc;--table-header-bg:#eee;--table-alternate-bg:#fff;}
}
EOF
    fi

    # icon-button font:inherit — mdBook sizes its icons in em, but the UA gives
    # <button> a 13.33px font it never resets, so the search/theme icons render 17%
    # smaller than the toggle (<label>) and the print/repo links (<a>).
    #
    # --mdb-top-gap holds the two columns' first lines level. They don't line up on
    # their own: mdBook fixes the sidebar to the viewport top and pads its scrollbox a
    # flat 10px, while the page column starts at the bar's bottom edge. The page takes
    # this gap as a top margin; the sidebar takes it plus the bar height + 1px border
    # (or, with a masthead, a band of that height then that gap) — landing on the same
    # number.
    #
    # The :empty and part-title rules exist because mdBook emits INVALID markup for a
    # SUMMARY '---'/'# Part':  <li class="chapter-item"><li class="spacer"></li></li>.
    # The nested <li> closes the outer one, leaving an empty li.chapter-item (with its
    # 0.6em margin) before every separator/part heading. So ':first-child' can zero
    # that invisible li instead of the real first row (TOC starts ~8px low) — the
    # '+ li' rule zeroes the real one too, and zeroing every :empty li's margin drops
    # the phantom gap it otherwise adds before a part heading. li.part-title also isn't
    # a .chapter-item, so it misses mdBook's line-height:1.5em (set here), and it gets a
    # bottom rule and a 1.7em top margin of its own — so a '# Part' draws an underlined
    # section header with its own separating space, no SUMMARY '---' needed.
    #
    # hr/spacer: mdBook styles a chapter <hr> in no stylesheet (the UA's 3-D groove
    # renders), and a SUMMARY '---' as a 3px --sidebar-spacer slab — two different
    # looks. Both set here to a 1px --rule-strong block (fallback --table-border-color,
    # since --sidebar-spacer disappears against the page ground in default mode).
    #
    # The .chapter :has() rule hides the sidebar row of any chapter under the reserved
    # src/unlisted/ directory. It is keyed on the href because a page-level marker
    # cannot work here: the row to hide is on every OTHER page, where that page's
    # markup is not in the DOM. Two alternatives, not one substring test: at the book
    # root toc.js leaves the href as "unlisted/x.html", and from inside a subdirectory
    # it rewrites it to "../unlisted/x.html" — while a bare [href*="unlisted/"] would
    # also swallow a legitimate chapter in, say, notunlisted/. Unconditional and inert
    # in a book that has no such directory. It covers BOTH sidebars: the one toc.js
    # injects into the page, and the toc.html iframe served to readers with JS off,
    # which loads custom.css too. The prev/next links into those chapters are a
    # separate job and are removed in custom.js — CSS cannot do it, since book.js
    # reads .nav-chapters.next out of the DOM and follows its href whether or not it
    # is painted. print.html is NOT covered: it is a flat concatenation with no
    # per-chapter element to select. See guide.
    #
    # .mdb-wide and .mdb-bleed are screen-only: print.html concatenates all chapters
    # into one <main>, so one marker anywhere would widen the whole printed book.
    #
    # They are different instruments. .mdb-wide widens the page, prose included.
    # .mdb-bleed widens ONLY the element carrying it and re-caps every other top-level
    # child of <main> at --content-max-width, so a wide code block or table gets its
    # room while the reading measure stays where it was. Same mechanism underneath —
    # widen <main>, then constrain the siblings — and max-width throughout, never
    # negative margins, so with less than 1000px of room the block takes what there is
    # instead of overflowing the page. The cap reads --content-max-width rather than a
    # literal, so it tracks the 700px set above in fixed mode and mdBook's own 750px in
    # default mode. Both markers on one page is not a combination worth writing: the
    # sibling cap catches .mdb-wide too, so the narrower instruction wins.
    #
    # box-sizing on the sibling cap is load-bearing, not housekeeping. max-width sizes
    # the CONTENT box by default, so the children carrying inline padding — <ul> (40px
    # UA), a blockquote, an <aside> — would come out 718-740px wide against everyone
    # else's 700 and hang into both margins, list text landing 20px right of paragraph
    # text. Capping the border box instead gives every sibling one left edge and
    # reproduces exactly the geometry an unwidened 700px <main> already has.
    #
    # .mdb-bleed goes on a wrapper <div>, not on an empty marker as .mdb-wide does — a
    # fence cannot carry a class — and that wrapper must be a direct child of <main>,
    # with blank lines inside it or pulldown-cmark takes the fence for raw HTML and
    # renders it literally. render_chapter ships a working example. See guide.
    cat >> custom.css <<'EOF'
#mdbook-menu-bar .icon-button{font:inherit;line-height:var(--menu-bar-height);}

:root{--mdb-top-gap:2.4rem;}
.content main > :first-child{margin-block-start:var(--mdb-top-gap);}
.chapter{margin-block-start:0;}
.chapter > li:first-child{margin-block-start:0;}
.chapter > li.chapter-item:empty:first-child + li{margin-block-start:0;}
.chapter li.chapter-item:empty{margin-block:0;}
.chapter li.part-title{line-height:1.5em;margin-block:1.7em .55em;padding-block-end:.3em;border-block-end:1px solid var(--rule-strong,var(--table-border-color));}
.chapter li.chapter-item:has(a[href^="unlisted/"],a[href*="/unlisted/"]){display:none;}

.content hr{border:0;height:1px;background-color:var(--rule-strong,var(--table-border-color));margin:3.2rem 0;}
.chapter .spacer{height:1px;margin-block:1.6em;}

.sidebar .mdb-sitemeta{margin-top:1rem;padding:1rem 0 .5rem;border-top:1px solid var(--rule,rgba(128,128,128,.25));font-size:1.3rem;line-height:1.5;color:var(--sidebar-fg);opacity:.8;}
.sidebar .mdb-sitemeta a{color:inherit;text-decoration:underline dotted;text-underline-offset:3px;}

.mdb-print-back{margin:0 0 2rem;font-size:.85em;}
@media print{.mdb-print-back{display:none;}}

@media screen{
  .content main:has(.mdb-wide,.mdb-bleed){max-width:1000px;}
  .content main:has(.mdb-bleed) > :not(.mdb-bleed){box-sizing:border-box;max-width:var(--content-max-width);margin-inline:auto;}
}
EOF
    if [ "$SIDEBAR_MASTHEAD" = none ]; then
        # No masthead: the sidebar's first row is held level with the page's first line
        # by padding alone. The book title stays in the menu bar, where mdBook puts it.
        cat >> custom.css <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:calc(var(--menu-bar-height) + 1px + var(--mdb-top-gap));}
EOF
    else
        # The masthead band is the bar's height + 1px border, then --mdb-top-gap, so the
        # TOC's first row lands on the page's first line whether or not a masthead exists.
        #
        # The menu-bar title fades via OPACITY (not display/visibility) while the sidebar
        # shows: html.sidebar-visible is mdBook's own class, so the title returns when the
        # sidebar hides (<1080px or 'b') and the masthead is gone; opacity keeps the <h1>
        # in the accessibility tree (the CSS masthead has no text to replace it) and keeps
        # .menu-title's flex:1 so the right-hand icons don't slide.
        #
        # The ::before is sticky at the top of the scrollbox (the scroll container) so it
        # stays put while the TOC scrolls under it; box-sizing:border-box lands the 1px
        # hairline inside the band; the opaque sidebar-bg ground hides the scrolling links.
        # The hairline shows only on scroll, in the colour mdBook gives the menu bar's
        # 'bordered' state (--table-border-color) — custom.js toggles .mdb-scrolled since
        # no selector can read scroll offset.
        cat >> custom.css <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:0;}
.sidebar-scrollbox::before{position:sticky;top:0;box-sizing:border-box;background-color:var(--sidebar-bg);border-block-end:1px solid transparent;}
.sidebar-scrollbox.mdb-scrolled::before{border-block-end-color:var(--table-border-color);}
.menu-title{transition:opacity .3s;}
html.sidebar-visible .menu-title{opacity:0;}
EOF
        if [ "$SIDEBAR_MASTHEAD" = text ]; then
            # BOOK_TITLE as the band's text. line-height is menu-bar-height minus 4px:
            # 4px shorter than the band centres the wordmark's ink in it (a full-height
            # line-height sits ~2px low from the font's ascender/descender split; measured
            # on the fallback face — Charter may want a different offset). 2.7rem (a touch
            # larger than the bar's 2.4rem) for prominence; weight 200 and colour inherited
            # (--sidebar-fg); nowrap/ellipsis so a long title truncates. NB an SVG can't do
            # this: a mask/background SVG is fetched as an IMAGE with external resources
            # disabled, so an @font-face inside it never loads and <text> falls back to a
            # system face — which a wordmark must not. Hence CSS text, not an SVG.
            cat >> custom.css <<EOF
.sidebar-scrollbox::before{content:"$(esc_dq "$BOOK_TITLE")";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);font-size:2.7rem;font-weight:200;line-height:calc(var(--menu-bar-height) - 4px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
EOF
        else
            # src/logo.svg masked into the band, painted in --sidebar-fg so one file
            # serves light and dark. Being painted makes it an ALPHA mask: the SVG must be
            # transparent behind the shape or the whole band paints solid. ("logo.svg"
            # resolves against custom.css at the book root, from any page depth.)
            #
            # Mark and sticky plate are TWO layers here (text mode does both in one). The
            # plate (::before) must stay opaque to hide the scrolling links; a mask on it
            # would clip that opaque ground away. So ::before keeps only the band geometry
            # and the mask goes on .sidebar::after — absolute to the fixed (non-scrolling)
            # sidebar, pointer-events:none so it doesn't eat the resize handle, html.js-
            # gated so the noscript iframe (no scrollbox, no ::before) is left alone.
            [ -f src/logo.svg ] || warn "SIDEBAR_MASTHEAD is \"image\" but src/logo.svg is missing; the sidebar shows an empty band, and no favicon is written, until you add it"
            cat >> custom.css <<'EOF'
.sidebar-scrollbox::before{content:"";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);}
html.js .sidebar::after{content:"";position:absolute;top:0;left:10px;right:10px;height:calc(var(--menu-bar-height) + 1px);pointer-events:none;background-color:var(--sidebar-fg);-webkit-mask:url("logo.svg") no-repeat left center/auto 50%;mask:url("logo.svg") no-repeat left center/auto 50%;}
EOF
        fi
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        # The gutter is a sibling of <code>, never inside it — so <code>'s DOM is
        # exactly what mdBook rendered and its innerText is exactly the source. That
        # is what mdBook's copy button reads (ClipboardJS -> playground_text(pre,
        # false) -> code.innerText), and it is why v22's approach had to go: the
        # highlight.js line-numbers plugin rebuilt <code> as a <table>, and a table's
        # innerText inserts a tab per line and a blank line between rows, so a
        # 12-line block copied out as 23 tab-indented lines. A gutter is safe here
        # because mdBook's pre>code.hljs is white-space:pre with overflow-x:auto —
        # code lines scroll, they never wrap, so the numbers cannot drift out of step
        # with them. Except in print: print.css sets pre,code{white-space:pre-wrap},
        # so lines do wrap there and the gutter is hidden instead.
        # user-select:none keeps the numbers out of a manual Ctrl+C.
        #
        # The gutter is PAINTED, and that is the whole difference between how v22's
        # numbers looked and how v24's did — the number styling is identical in both.
        # mdBook puts a code block's background on code.hljs, not on <pre>, so v22's
        # numbers inherited it for free by sitting inside that element (which is also
        # exactly why they corrupted the copy) while v24's, standing outside it, showed
        # the page's ground instead and made every numbered block a two-tone strip with
        # a seam. --code-bg (set in the palette, and used to repaint code.hljs there)
        # is the same colour on both sides of that seam. It only exists in fixed theme
        # mode; in default mode the fallback leaves the gutter transparent, and the
        # stock two-tone remains, because the stock code ground lives in a highlight
        # stylesheet and is not a variable this file can read.
        cat >> custom.css <<'EOF'
pre:has(> .mdb-gutter){display:flex;align-items:stretch;}
pre > .mdb-gutter{flex:0 0 auto;-webkit-user-select:none;user-select:none;white-space:pre;text-align:right;font-family:var(--mono-font);font-size:var(--code-font-size);padding:1rem .8em 1rem 1rem;background-color:var(--code-bg,transparent);color:var(--muted,#999);border-right:1px solid var(--rule,rgba(128,128,128,.25));}
pre > .mdb-gutter + code.hljs{flex:1 1 auto;min-width:0;padding-left:1em;}
@media print{
  pre:has(> .mdb-gutter){display:block;}
  pre > .mdb-gutter{display:none;}
  pre > .mdb-gutter + code.hljs{padding-left:1rem;}
}
EOF
    fi
    say "wrote custom.css"
}

# Always written, wired via additional-js. Behaviours:
#  - press 'b' toggles the sidebar (mdBook ships no key for it), and the shortcut
#    is added to mdBook's own '?' popup so the list stays true;
#  - off-site links open in a new tab (mdBook has no native option);
#  - print.html gets a "back to the book" link, and closing the print dialog
#    returns you to the page you came from. mdBook auto-opens that dialog there and
#    cancelling otherwise strands you on the concatenated whole-book page. Two event
#    triggers, because browsers disagree about which they fire; the link is there
#    because neither is guaranteed, and a reader must never be stuck;
#  - a site-meta line at the foot of the sidebar: "<version> · updated <date> ·
#    <sha>", where the version is the tag on the built commit or the nearest tag
#    reachable from it plus a commit count (v1.2, v1.2+5). A segment is printed only
#    if the workflow stamped it, so a repository with no tag yet prints the date and
#    the commit, and an unstamped local build prints no line at all;
#  - when CODE_LINE_NUMBERS is on, a line-number gutter beside each code block of ten
#    or more lines whose fence named a language. Skipped for .playground blocks (their
#    <pre> also holds a .result panel, which a flex row would put beside the code
#    instead of below it) and for blocks with hidden lines (mdBook's eye button sets
#    display:none on .boring spans, which removes lines from the flow and would leave
#    the numbers pointing at the wrong ones).
# Only the repo URL is injected from here; version/date/SHA are left as
# __MDB_BUILD_*__ placeholders the deploy workflow substitutes. Built with DOM
# APIs (no innerHTML). The #mdbook-sidebar-toggle id matches the pinned release; a
# future release could rename it (see guide).
write_custom_js() {
    cat > custom.js <<EOF
// Script-owned. Edit GIT_REPO_URL at the top of the script and re-run. The other
// three are stamped by the deploy workflow at build time: MDB_VERSION from the tag
// on the built commit (empty when it carries none), MDB_UPDATED from the build
// date, MDB_SHA from the built commit itself.
var MDB_REPO = "$(esc_dq "$GIT_REPO_URL")";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
EOF
    cat >> custom.js <<'EOF'
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // 'b' toggles the sidebar. The guard mirrors mdBook's own
  // (mdbook_something_else_has_focus): composedPath for shadow-DOM targets, form
  // fields, and contenteditable.
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== "b") return;
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (!t) return;
    if (t.isContentEditable) return;
    if (/^(input|textarea|select)$/i.test(t.tagName || "")) return;
    var btn = document.getElementById("mdbook-sidebar-toggle");
    if (btn) { btn.click(); e.preventDefault(); }
  });

  // Keep mdBook's '?' shortcut popup honest about the key we just added.
  ready(function () {
    var help = document.querySelector("#mdbook-help-popup > div");
    if (!help) return;
    var p = document.createElement("p");
    var k = document.createElement("kbd");
    k.textContent = "b";
    p.appendChild(document.createTextNode("Press "));
    p.appendChild(k);
    p.appendChild(document.createTextNode(" to toggle the sidebar"));
    help.appendChild(p);
  });

  // Off-site links open in a new tab.
  ready(function () {
    var here = location.origin;
    var links = document.querySelectorAll(".content a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i], u;
      try { u = new URL(a.href, location.href); } catch (err) { continue; }
      if (u.origin !== here) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    }
  });

  // Drop the prev/next links that point INTO the reserved src/unlisted/ directory,
  // so the chapter arrows and the Left/Right keys skip those chapters the way the
  // sidebar rule already hides their rows. Remove, not hide: book.js reads
  // .nav-chapters.next straight out of the DOM and follows its href, so CSS alone
  // leaves the key walking in. Links OUT of an unlisted chapter are left alone —
  // its own back arrow still works. Same two href alternatives as the CSS rule (the
  // root form and the rewritten ../ form), and the class test is a substring because
  // mdBook emits the desktop pair and the mobile pair under different class names.
  ready(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
  });

  // The masthead is sticky at the top of the sidebar (CSS), and grows a hairline
  // once the TOC scrolls under it — the same thing book.js does to the menu bar
  // opposite it, whose 'bordered' class it adds the moment the bar leaves the top
  // of the page. A class and not a selector because nothing in CSS can see a scroll
  // offset. Its own ready() block, kept clear of the site-meta one below, which
  // returns early on an unstamped build and would take this with it.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // Site-meta at the foot of the sidebar (site-level, not per-page). A part is
  // shown only if the workflow stamped it, so an unstamped local build shows no
  // line at all rather than a placeholder word.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var stamped = function (v) { return v !== "" && v.indexOf("__MDB_") !== 0; };
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) parts.push(document.createTextNode("updated " + MDB_UPDATED));
    if (stamped(MDB_SHA)) {
      if (MDB_REPO) {
        var s = document.createElement("a");
        s.href = MDB_REPO + "/commit/" + encodeURIComponent(MDB_SHA);
        s.textContent = MDB_SHA;
        parts.push(s);
      } else {
        parts.push(document.createTextNode(MDB_SHA));
      }
    }
    if (!parts.length) return;
    var p = document.createElement("div");
    p.className = "mdb-sitemeta";
    for (var i = 0; i < parts.length; i++) {
      if (i) p.appendChild(document.createTextNode(" \u00b7 "));
      p.appendChild(parts[i]);
    }
    box.appendChild(p);
  });

  // print.html. mdBook auto-opens the print dialog there, and cancelling it
  // otherwise strands you on the concatenated whole-book page it renders for PDF
  // export.
  //
  // Two paths, on purpose. The events are the nice path: go back when the dialog
  // closes — on cancel and on a completed job alike, since no browser distinguishes
  // the two. Two triggers, because browsers disagree about which they fire:
  // afterprint, and the print media query ceasing to match (that one only after it
  // has actually matched, so a spurious change event at load cannot bounce you); a
  // once-flag stops the pair double-firing. Neither is guaranteed to fire in every
  // browser, so the link is the path that cannot fail: it is always there, it needs
  // no event, and it is hidden from the printed output. No referrer test —
  // document.referrer is empty on a reload, a pasted URL or a restored tab.
  (function () {
    if (!/(^|\/)print\.html$/.test(location.pathname)) return;

    ready(function () {
      var main = document.querySelector("#mdbook-content main");
      if (!main) return;
      var p = document.createElement("p");
      p.className = "mdb-print-back";
      var a = document.createElement("a");
      a.href = (typeof path_to_root === "string" ? path_to_root : "") + "index.html";
      a.textContent = "\u2190 Back";
      p.appendChild(a);
      main.insertBefore(p, main.firstChild);
    });

    var left = false, entered = false;
    function leave() {
      if (left) return;
      left = true;
      if (history.length > 1) history.back();
    }
    window.addEventListener("afterprint", leave);
    if (window.matchMedia) {
      var mq = window.matchMedia("print");
      var onChange = function (e) {
        if (e.matches) entered = true;
        else if (entered) leave();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  })();
})();
EOF
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        cat >> custom.js <<'EOF'

// Line numbers. book.js highlights synchronously before this file runs, so the
// blocks already carry code.hljs. The numbers go in a sibling div, never inside
// <code>: mdBook's copy button reads code.innerText, so anything that rewrites
// <code>'s DOM corrupts what a reader copies.
//
// ONE style rule: a block shorter than MIN_LINES is not numbered. Nobody counts to
// four, and a gutter on a three-line block is furniture.
//
// The three tests above it are not style rules, they are correctness guards, and
// removing any one of them breaks something. Number a block only when its fence
// named a language — mdBook emits class="language-x" for ```bash and no such class
// for a bare ```, even though highlight.js still auto-detects and colours the bare
// one. Skip .playground blocks (their <pre> also holds a .result panel, which a flex
// row would put beside the code instead of below it) and blocks with hidden lines
// (the eye button display:none's .boring spans, which drops lines out of the flow
// and leaves the numbers pointing at the wrong ones).
(function () {
  var MIN_LINES = 10;
  function gutters() {
    var blocks = document.querySelectorAll("pre > code.hljs");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var pre = b.parentNode;
      if (!/(^|\s)language-\S+/.test(b.className)) continue;
      if (pre.classList.contains("playground")) continue;
      if (b.querySelector(".boring")) continue;
      var lines = b.textContent.replace(/\n+$/, "").split("\n").length;
      if (lines < MIN_LINES) continue;
      var g = document.createElement("div");
      g.className = "mdb-gutter";
      g.setAttribute("aria-hidden", "true");
      var s = "1";
      for (var n = 2; n <= lines; n++) s += "\n" + n;
      g.textContent = s;
      pre.insertBefore(g, b);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", gutters);
  else gutters();
})();
EOF
    fi
    say "wrote custom.js (sidebar key, external links, print return, site-meta footer)"
}

# Repo-root README pointing at the live Pages site. Regenerated every run
# (script-owned) so the link tracks GIT_REPO_URL; kept deliberately minimal — the
# setup notes (fonts, tagging, toggles) belong in the guide, not here. When
# GIT_REPO_URL is empty there is no Pages URL to derive, so the README is just the
# title. A custom domain can't be detected here — edit by hand in that case.
write_readme() {
    if [ -n "$PAGES_URL" ]; then
        printf '# %s\n\nLive site: <%s>\n' "$BOOK_TITLE" "$PAGES_URL" > README.md
        say "wrote README.md (live site: ${PAGES_URL})"
    else
        printf '# %s\n' "$BOOK_TITLE" > README.md
        say "wrote README.md (no GIT_REPO_URL, so no live-site link)"
    fi
}

write_workflow() {
    mkdir -p .github/workflows
    render_workflow > .github/workflows/deploy.yml
    say "wrote .github/workflows/deploy.yml (branch: ${DEPLOY_BRANCH})"
}

## ─── templates ───────────────────────────────────────────────────────────
# Quoted heredoc delimiter ('EOF') = literal; unquoted (EOF) = expanded.

# Variables read: BOOK_TITLE, BOOK_AUTHOR, GIT_REPO_URL, SITE_URL, DEPLOY_BRANCH,
# SIDEBAR_NUMBERS, THEME_MODE, LIGHT_THEME, PREFERRED_LIGHT, PREFERRED_DARK.
# no-section-label is emitted only when SIDEBAR_NUMBERS=false (to hide mdBook's
# numeric sidebar labels); true inherits mdBook's default, which shows them, so
# nothing is written for that case.
# THEME_MODE="fixed" loads custom.css (which hides the picker) and pins the theme
# pair, so the reader has no in-page control (see write_custom_css). LIGHT_THEME=true
# pins default-theme = PREFERRED_LIGHT and preferred-dark-theme = PREFERRED_DARK, and
# the browser's light/dark preference chooses. LIGHT_THEME=false pins BOTH to
# PREFERRED_DARK — load-bearing, not cosmetic: mdBook picks the highlight.js
# stylesheet in JavaScript from the theme NAME (book.js set_theme), so a light name
# left in default-theme would serve light syntax tokens onto the dark code ground the
# palette paints, for every reader whose OS is light. Pinning both names is what keeps
# palette and syntax in step. THEME_MODE="default" emits neither line, leaving
# mdBook's stock themes and picker.
# edit-url-template adds a pencil icon that opens GitHub's web editor for the
# current page; auto-forks for readers without write access. mdBook expands {path}
# to the source file's path *including* the src dir (src/foo.md), so the template
# must not prepend one itself — that yields src/src/foo.md and a 404. It is omitted
# with site-url when GIT_REPO_URL is empty.
# No git-repository-url is written. The repo icon it adds sits beside the pencil and
# reaches the same repository the sidebar footer's commit link already reaches;
# index.hbs gates the two icons on independent conditionals, so omitting the key
# drops the repo icon and leaves the pencil untouched. Set it by hand in book.toml if
# you want the icon back — but the script regenerates book.toml, so a re-run removes
# it again. Values pass through esc_dq so an apostrophe in a title or author is safe.
render_book_toml() {
    cat <<EOF
[book]
title = "$(esc_dq "$BOOK_TITLE")"
authors = ["$(esc_dq "$BOOK_AUTHOR")"]
src = "src"

[output.html]
EOF
    echo 'additional-js = ["custom.js"]'
    # custom.css is always written (it styles the sidebar footer and the print-back
    # link that custom.js injects, and the line-number gutter), so always load it.
    echo 'additional-css = ["custom.css"]'
    # SIDEBAR_NUMBERS=true is mdBook's own default (numeric labels shown), so emit
    # nothing and inherit it; only the false case needs the explicit override.
    [ "$SIDEBAR_NUMBERS" = true ] || echo 'no-section-label = true'
    if [ "$THEME_MODE" = fixed ]; then
        if [ "$LIGHT_THEME" = true ]; then
            cat <<EOF
default-theme = "$(esc_dq "$PREFERRED_LIGHT")"
preferred-dark-theme = "$(esc_dq "$PREFERRED_DARK")"
EOF
        else
            cat <<EOF
default-theme = "$(esc_dq "$PREFERRED_DARK")"
preferred-dark-theme = "$(esc_dq "$PREFERRED_DARK")"
EOF
        fi
    fi
    if [ -n "$GIT_REPO_URL" ]; then
        cat <<EOF
site-url = "$(esc_dq "$SITE_URL")"
edit-url-template = "$(esc_dq "$GIT_REPO_URL")/edit/$(esc_dq "$DEPLOY_BRANCH")/{path}"
EOF
    fi
    # Drop the reserved src/unlisted/ directory from the search index. One directory
    # key covers every chapter under it, however many there are, and merges
    # recursively — so this never needs a per-page line.
    #
    # It is GATED, and the gate is not optional: mdBook FAILS the build on a
    # search.chapter key that matches no chapter path ("key `unlisted` does not match
    # any chapter paths"), so emitting this unconditionally would break every book
    # that has no unlisted chapter. The test greps SUMMARY.md rather than looking for
    # src/unlisted/*.md, because mdBook matches CHAPTER paths: a file sitting in the
    # directory but absent from SUMMARY.md is not a chapter, and a stanza emitted for
    # it would fail the build. Grepping the list mirrors mdBook's own condition
    # exactly. It also fails safe — on a first run SUMMARY.md does not exist yet, and
    # if you add your first unlisted chapter and don't re-run, the page is merely
    # searchable, not broken.
    #
    # A sub-table ends the parent table, so this must stay last in the file.
    if grep -qE '\]\(\.?/?unlisted/' src/SUMMARY.md 2>/dev/null; then
        cat <<'EOF'

[output.html.search.chapter]
"unlisted" = { enable = false }
EOF
    fi
}

# About is a prefix chapter (no leading dash) — renders unnumbered, above
# all numbered chapters in the sidebar. A suffix chapter (same syntax, listed
# after the numbered ones) renders unnumbered below them. A '---' line here draws
# a separator rule in the sidebar, and a '# Title' line a part heading.
render_summary() {
    cat <<'EOF'
# Summary

[About](./about.md)

- [Chapter 1](./chapter_1.md)
EOF
}

# printf, not a heredoc: an unquoted heredoc would expand a '$' or execute a
# backtick in BOOK_TITLE, so a title like 'Cost & Value $100' would silently lose
# its price.
render_about() {
    printf '# %s\n\nA short description of this book — what it covers, who it'"'"'s for, and\nhow it'"'"'s organized. Replace this placeholder with your own text.\n' "$BOOK_TITLE"
}

render_chapter() {
    cat <<'EOF'
# Chapter 1
<p class="mdb-subtitle">An optional subtitle — delete this line if you don't want one</p>

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.

## Heading 2
Cras elementum ultrices diam. Maecenas ligula massa, varius a, semper congue, euismod non, mi.

### Heading 3
Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat.

#### Heading 4
Duis semper. Duis arcu massa, scelerisque vitae, consequat in, pretium a, enim.

##### Heading 5
Pellentesque congue. Ut in risus volutpat libero pharetra tempor.

###### Heading 6
Cras vestibulum bibendum augue. Praesent egestas leo in pede.

---

## Paragraphs
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus luctus urna sed urna ultricies ac tempor dui sagittis.

In condimentum facilisis porta. Sed nec diam eu diam mattis viverra. Nulla fringilla.

---

## Lists

### Unordered List
- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
  - Nested item one
  - Nested item two
- Sed do eiusmod tempor

### Ordered List
1. First item
2. Second item
3. Third item

---

## Text Formatting
**Bold text**

*Italic text*

***Bold and italic***

~~Strikethrough~~

`Inline code`

---

## Blockquote
> Lorem ipsum dolor sit amet, consectetur adipiscing elit.
>
> Integer posuere erat a ante.

---

## Aside
A digression callout for a secondary point that is not the main line. Raw HTML,
because Markdown has no syntax for it; no Markdown is parsed inside the tag.

<aside>A standalone secondary thought or reference readers should know but that isn't central to the argument. Delete this block if you don't want one.</aside>

---

## Admonitions
mdBook renders these natively — no CSS of ours is involved. Five kinds:
NOTE, TIP, IMPORTANT, WARNING, CAUTION.

> [!NOTE]
> General information or additional context.

> [!WARNING]
> Critical information that highlights a potential risk.

---

## Table

| Column | Description |
| ------ | ----------- |
| One    | First row   |
| Two    | Second row  |

---

## Images
Images point at files in `src/`, which mdBook copies into the built book beside the
HTML. The path is relative to the chapter, so a chapter one folder down needs
`../demo.svg`.

![layered gray mountain silhouettes with a faint sun behind them](demo.svg)

The file above is `src/demo.svg`. Replace or delete it. Alt text is not decoration:
it is what a screen reader announces and what shows when the file is missing.

---

## Code Block
Under ten lines, so it carries no numbers:

```python
def lorem_ipsum():
    return "Dolor sit amet"
```

Ten or more, so it does:

```python
def consectetur(adipiscing, elit=None):
    """Vivamus luctus urna sed urna ultricies ac tempor dui."""
    sagittis = []
    for nulla in adipiscing:
        if nulla in (elit or ()):
            continue
        sagittis.append(nulla.strip().lower())
    if not sagittis:
        raise ValueError("sed nec diam eu diam mattis viverra")
    return sorted(set(sagittis))
```

---

## Wide Block
A block needing more room than the measure allows can break out of it while the prose
around it stays at its reading width. Wrap it in a `div` carrying `mdb-bleed` — a fence
cannot take a class itself — and keep the blank lines inside the wrapper: without them
the fence is read as raw HTML and renders literally.

<div class="mdb-bleed">

```python
def pellentesque(habitant, morbi=None, tristique=(), senectus="netus", fames=0):
    return {k: v for k, v in sorted(habitant.items()) if k not in (morbi or ())}
```

</div>

Delete the wrapper and the same block sits back inside the measure, scrolling sideways
instead. Nothing scopes this to code: a wide table or a diagram takes the same wrapper.

---

## Footnotes
A reference goes in the prose[^1] and its definition on its own line, anywhere in the
file. mdBook collects every definition at the foot of the chapter behind a rule, in
order of first reference, and links each one back to where you were.[^2]

Do not end a chapter with `---` if it has footnotes: mdBook draws its own rule above
the collected definitions, and you would get two.

[^1]: The definition for the first reference, written as `[^1]: text`.
[^2]: Definitions take the same markup as prose, [links](https://rust-lang.github.io/mdBook/) included.
EOF
}

# The one image the starter chapter shows. Grey at three opacities so it reads on
# either ground without a second file — this book may be built light, dark, or both.
render_demo_svg() {
    cat << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240">
  <circle cx="460" cy="62" r="22" fill="#888" fill-opacity="0.35"/>
  <polygon points="0,160 80,100 180,140 280,80 380,130 480,90 600,120 600,240 0,240"
           fill="#888" fill-opacity="0.3"/>
  <polygon points="0,190 100,130 220,170 340,110 460,160 600,140 600,240 0,240"
           fill="#888" fill-opacity="0.5"/>
  <polygon points="0,220 90,170 200,200 320,160 440,190 560,170 600,180 600,240 0,240"
           fill="#888" fill-opacity="0.8"/>
</svg>
EOF
}

# Variables read: MDBOOK_VERSION, MDBOOK_SHA256, MDBOOK_NUMBERING_VERSION,
# DEPLOY_BRANCH, HEADING_NUMBERS, ACTIONS_*_SHA.
#
# The mdBook version is pinned AND its bytes are: MDBOOK_VERSION names the release
# and MDBOOK_SHA256 is the digest of the tarball this script actually installed, so
# CI cannot be handed a different file under the same tag. First-party GitHub Pages
# flow: the build job compiles the book and uploads it as a Pages artifact; the
# deploy job publishes it via the Pages API. Requires Settings -> Pages -> Source ->
# "GitHub Actions" once — actions/configure-pages can only enable Pages itself with
# a personal access token (its GITHUB_TOKEN cannot), which is not worth storing for
# a one-time click. Token is least-privilege: contents: read (checkout only); pages:
# write and id-token: write are required by deploy-pages. Nothing pushes to a branch.
#
# The site version comes from git, not from this script: checkout takes fetch-depth: 0
# (the default of 1 fetches no tags at all) and the stamp step writes it into custom.js
# as the tag on the built commit, or as the nearest tag reachable from it with the
# commit count appended — v0.2.0 exactly, or v0.2.0+5 five commits later. That means a
# version on every deploy without a tag on every commit, and no build claiming to be a
# release it is only descended from. Firing on tag pushes as well as branch pushes
# means a tag alone deploys and stamps, so no atomic push is needed.
render_workflow() {
    local numbering_step=""
    if [ "$HEADING_NUMBERS" = true ]; then
        numbering_step="

      - name: Install mdbook-numbering ${MDBOOK_NUMBERING_VERSION}
        run: cargo install --locked --version ${MDBOOK_NUMBERING_VERSION} mdbook-numbering"
    fi

    cat <<EOF
name: Deploy mdBook to GitHub Pages

on:
  push:
    branches: [${DEPLOY_BRANCH}]
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    # Pinned like the action SHAs and the mdBook version: the runner image is the last
    # input that could shift under an otherwise-green build. Bump when 24.04 is retired.
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@${ACTIONS_CHECKOUT_SHA}
        with:
          # 0 = full history and tags. The default (1) fetches neither, and the
          # version stamped below is the tag on this commit.
          fetch-depth: 0

      - name: Install mdBook ${MDBOOK_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/rust-lang/mdBook/releases/download/${MDBOOK_VERSION}/mdbook-${MDBOOK_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "\$base" -o mdbook.tar.gz
          # The digest of the bytes the bootstrap script installed locally. A version
          # tag names a file, not its contents; this pins the contents.
          echo "${MDBOOK_SHA256}  mdbook.tar.gz" | sha256sum -c -
          tar -xz -f mdbook.tar.gz --directory=/usr/local/bin${numbering_step}

      - name: Stamp build metadata
        run: |
          set -euo pipefail
          # The version of this build. 'describe --tags' names the tag on this commit
          # if it carries one, and otherwise the nearest tag reachable from it plus the
          # distance and the abbreviated commit: v1.2-5-gabc1234. The sed rewrites that
          # tail to a '+5', which says the same thing without repeating the SHA that is
          # already the next field of the line — so the label reads v1.2 on the tagged
          # commit and v1.2+5 five commits later. Never --abbrev=0: that would print
          # 'v1.2' for a commit that is not v1.2. Empty until the first tag exists;
          # then it is never empty again. Reduced to a safe charset before being
          # spliced into a sed replacement and a JS string literal: a git tag name may
          # legally contain | and ".
          version=\$(git describe --tags 2>/dev/null | sed -E 's/-([0-9]+)-g[0-9a-f]+\$/+\\1/' || true)
          version=\${version//[^A-Za-z0-9._+-]/}
          sed -i \\
            -e "s|__MDB_BUILD_VERSION__|\${version}|" \\
            -e "s|__MDB_BUILD_DATE__|\$(date -u +%Y-%m-%d)|" \\
            -e "s|__MDB_BUILD_SHA__|\${GITHUB_SHA::7}|" \\
            custom.js

      - name: Build
        run: mdbook build

      - name: Setup Pages
        uses: actions/configure-pages@${ACTIONS_CONFIGURE_PAGES_SHA}

      - name: Upload artifact
        uses: actions/upload-pages-artifact@${ACTIONS_UPLOAD_PAGES_SHA}
        with:
          path: ./book

  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@${ACTIONS_DEPLOY_PAGES_SHA}
EOF
}

## ─── entry point ─────────────────────────────────────────────────────────
# Guarded so the file can be sourced (e.g. to unit-test a render_* function)
# without running main.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````