<div class="mdb-wide"></div>

# Bootstrap-mdbook script

The script scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview.
For more details, see [Publish a book or a knowledge base](./publish-book.md).


````bash
#!/bin/bash
# bootstrap-mdbook.sh, v49
#
# Bootstraps an mdBook book at PROJECT_DIR/BOOK_NAME, pins mdBook (version and
# tarball sha256) into a first-party GitHub Pages workflow, and opens a live
# preview. Re-running is the update path: the script-owned files regenerate;
# src/ and README.md are written once and never touched. Linux x86_64 only.
#
#   bash bootstrap-mdbook.sh    create or update the book, check it, preview it
#   ./build                     in the book: build it, and stop on a broken link
#
# After the first push, set Settings -> Pages -> Source -> "GitHub Actions" once.
# How to use it: mdb-guide.md. The comments here are for reviewers.

set -euo pipefail

## ─── user configuration ──────────────────────────────────────────────────
# Each setting: mdb-guide.md, "The toggles". A re-run applies what changed here.

PROJECT_DIR="$HOME/Desktop"               # the folder the book's folder goes in; ~ allowed
BOOK_NAME="mybook"                        # the book's folder: letters, digits, . _ -
BOOK_TITLE="mybook"                       # the title readers see
BOOK_AUTHOR="John Doe"
DEPLOY_BRANCH="main"                      # pushes here deploy; git's default branch
HEADING_NUMBERS=false                     # true: numbered headings (mdbook-numbering)
SIDEBAR_NUMBERS=true                      # sidebar chapter numbers (1., 1.1.)
THEME_MODE="fixed"                        # "fixed" (default): the reading theme, no picker;
                                          # "default": mdBook's own themes and picker
LIGHT_THEME=false                         # false: dark for every reader; true: light allowed
PREFERRED_LIGHT="light"                   # fixed mode with LIGHT_THEME=true only
PREFERRED_DARK="ayu"                      # coal, navy or ayu
GIT_REPO_URL=""                           # https://github.com/user/repo; "" = local only
CODE_LINE_NUMBERS=true                    # numbers language-fenced blocks of 10+ lines
SIDEBAR_MASTHEAD="text"                   # "text", "none", or "image" (src/logo.svg)
FAVICON_TEXT="auto"                       # "auto" (the title's first letter), up to 3
                                          # characters, or ""; src/logo.svg wins
# The footer's version label comes from git, stamped by the workflow: the tag on
# the built commit, or the nearest one plus a count (v1.2+5). Tag a release with
#   git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0

# Expand a leading ~ (bash doesn't, inside quotes) and make the path absolute.
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
BOOK_DIR="$PROJECT_DIR/$BOOK_NAME"

## ─── internals ───────────────────────────────────────────────────────────

# First-party actions, pinned by commit SHA (a tag can be re-pointed). To bump:
#   git ls-remote https://github.com/actions/REPO refs/tags/TAG^{}
ACTIONS_CHECKOUT_SHA="9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0"         # v7.0.0
ACTIONS_CONFIGURE_PAGES_SHA="45bfe0192ca1faeb007ade9deae92b16b8254a0d"  # v6.0.0
ACTIONS_UPLOAD_PAGES_SHA="fc324d3547104276b827a68afc52ff2a11cc49c9"     # v5.0.0
ACTIONS_DEPLOY_PAGES_SHA="cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"     # v5.0.0

# Pinned like everything else the build consumes. Bump deliberately.
MDBOOK_NUMBERING_VERSION="0.5.0"

# The link checker ./build runs, here and in CI, installed in bin/ beside mdBook:
# pinned by version and tarball sha256 (the release publishes a .sha256 to check
# against). Bump both together, and check ./build still reads lychee's report.
LYCHEE_VERSION="0.24.2"
LYCHEE_SHA256="1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a"

# The five themes mdBook ships; PREFERRED_LIGHT/DARK must name one.
MDBOOK_THEMES="light rust coal navy ayu"

# The dark three; PREFERRED_DARK must be one, since the book is pinned to it.
MDBOOK_DARK_THEMES="coal navy ayu"

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

# Refresh apt's index first: a stale one can fail the install.
apt_install() {
    sudo apt-get update
    sudo apt-get install -y "$@"
}

# Escape for a double-quoted TOML, JS or CSS string: backslash first, then ".
esc_dq() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# Escape for XML text (the drawn favicon): & first, so later ones survive. Each &
# in a replacement is backslashed on purpose: unquoted, bash expands it to the
# match, so ${s//</&lt;} would give "<lt;".
esc_xml() {
    local s="$1"
    s="${s//&/\&amp;}"
    s="${s//</\&lt;}"
    s="${s//>/\&gt;}"
    printf '%s' "$s"
}

# Pages URL and site-url from GIT_REPO_URL; both empty without one. site-url lets
# the 404 page find its assets at any depth. A user site (user.github.io)
# publishes at the root. A custom domain is set by hand.
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
    check_build_file
    mkdir -p "$BOOK_DIR/bin"
    cd "$BOOK_DIR"
    init_git_repo
    ensure_git_remote
    ensure_curl
    # One version for the local binary, the workflow and the digest check.
    MDBOOK_VERSION=$(get_latest_mdbook_version)
    [ -n "$MDBOOK_VERSION" ] || die "could not resolve the current mdBook version"
    install_mdbook
    [ -n "$MDBOOK_SHA256" ] || die "could not determine the mdBook tarball digest"
    install_lychee
    write_book_files
    write_theme
    write_custom_css
    write_custom_js
    write_gitignore
    write_readme
    write_build
    if [ "$HEADING_NUMBERS" = true ]; then
        ensure_cargo
        ensure_mdbook_numbering
        ensure_numbering_config
    fi
    write_workflow
    git_initial_commit
    # The check CI runs, before the preview: a broken link or anchor stops here.
    ./build || exit 1
    local port
    port=$(pick_port)
    say ""
    say "before each push: ./build builds the book and stops on a broken link or anchor."
    say "first deploy: push, then set Settings -> Pages -> Source -> \"GitHub Actions\" once."
    say "done. starting preview at http://127.0.0.1:${port} (Ctrl-C to stop)."
    say "re-launch later with: cd \"$BOOK_DIR\" && ./build && ./bin/mdbook serve --open -n 127.0.0.1 -p ${port}"
    say "run a second book alongside this one by giving it a different -p port."
    say ""
    ./bin/mdbook serve --open -n 127.0.0.1 -p "$port"
}

## ─── checks ──────────────────────────────────────────────────────────────

# ./build is this script's (it names bootstrap-mdbook.sh); a book's own script by
# that name is left alone, and the run stops before anything is written.
check_build_file() {
    [ -e "$BOOK_DIR/build" ] || return 0
    grep -q 'bootstrap-mdbook.sh' "$BOOK_DIR/build" && return 0
    die "$BOOK_DIR/build exists and wasn't written by this script; move it aside (mv build build.own), then re-run. nothing has been changed."
}

# A newline is the one thing the escaped strings can't carry, so it is refused.
validate_config() {
    # BOOK_NAME is a folder (and usually the repo) name: GitHub's characters only,
    # spelled out, not ranges: under a UTF-8 locale a range lets 'ń' or '३' through.
    case "$BOOK_NAME" in
        ""|.*|-*|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-]*)
            die "BOOK_NAME is the book's folder: letters, digits, '.', '_' and '-' only, not starting with '.' or '-', got: '$BOOK_NAME'" ;;
    esac
    [ -n "$BOOK_TITLE" ] || die "BOOK_TITLE must not be empty"
    case "$BOOK_TITLE"      in *$'\n'*|*$'\r'*) die "BOOK_TITLE must not contain newlines" ;; esac
    case "$BOOK_AUTHOR"     in *$'\n'*|*$'\r'*) die "BOOK_AUTHOR must not contain newlines" ;; esac
    case "$DEPLOY_BRANCH"   in *$'\n'*|*$'\r'*) die "DEPLOY_BRANCH must not contain newlines" ;; esac
    case "$HEADING_NUMBERS" in true|false) ;; *) die "HEADING_NUMBERS must be true or false, got: $HEADING_NUMBERS" ;; esac
    case "$SIDEBAR_NUMBERS" in true|false) ;; *) die "SIDEBAR_NUMBERS must be true or false, got: $SIDEBAR_NUMBERS" ;; esac
    case "$THEME_MODE"      in fixed|default) ;; *) die "THEME_MODE must be fixed or default, got: $THEME_MODE" ;; esac
    case "$LIGHT_THEME"     in true|false) ;; *) die "LIGHT_THEME must be true or false, got: $LIGHT_THEME" ;; esac
    case "$CODE_LINE_NUMBERS" in true|false) ;; *) die "CODE_LINE_NUMBERS must be true or false, got: $CODE_LINE_NUMBERS" ;; esac
    case "$SIDEBAR_MASTHEAD"  in none|text|image) ;; *) die "SIDEBAR_MASTHEAD must be none, text or image, got: $SIDEBAR_MASTHEAD" ;; esac
    # Free-form, like the strings above: only newlines are refused.
    case "$FAVICON_TEXT"      in *$'\n'*|*$'\r'*) die "FAVICON_TEXT must not contain newlines" ;; esac

    # A theme mdBook doesn't ship would leave the palette matching nothing.
    local t found
    for v in PREFERRED_LIGHT PREFERRED_DARK; do
        found=false
        for t in $MDBOOK_THEMES; do
            [ "${!v}" = "$t" ] && found=true
        done
        [ "$found" = true ] || die "$v must be one of: $MDBOOK_THEMES (got: ${!v})"
    done
    case " $MDBOOK_DARK_THEMES " in
        *" $PREFERRED_DARK "*) ;;
        *) die "PREFERRED_DARK must be a dark theme, one of: $MDBOOK_DARK_THEMES (got: $PREFERRED_DARK)" ;;
    esac

    # Everything downstream assumes https github.com.
    case "$GIT_REPO_URL" in
        "") ;;
        *$'\n'*|*$'\r'*) die "GIT_REPO_URL must not contain newlines or carriage returns" ;;
        https://github.com/*/*) ;;
        *) die "GIT_REPO_URL must be an https github.com URL (https://github.com/user/repo), got: $GIT_REPO_URL" ;;
    esac
}

## ─── install ─────────────────────────────────────────────────────────────
# curl, mdBook, lychee, cargo, mdbook-numbering, git

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

# Installs the release and records its tarball's sha256, which CI checks its own
# download against (mdBook publishes no digest). The digest is cached in bin/, so
# a re-run with the right version installed pins without re-downloading.
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

# lychee into bin/, beside mdBook: ./build's link checker, the same release and
# bytes CI runs, checked against LYCHEE_SHA256 before anything is installed.
install_lychee() {
    local archive="lychee-x86_64-unknown-linux-gnu.tar.gz"
    if [ -x bin/lychee ] && [ "$(bin/lychee --version 2>/dev/null)" = "lychee ${LYCHEE_VERSION}" ]; then
        say "lychee ${LYCHEE_VERSION} already installed"
        return
    fi
    [ -n "${TMP_DIR:-}" ] || TMP_DIR=$(mktemp -d)
    say "downloading lychee ${LYCHEE_VERSION}..."
    curl --fail -sSL "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/${archive}" \
        -o "$TMP_DIR/$archive"
    echo "${LYCHEE_SHA256}  $TMP_DIR/$archive" | sha256sum -c --quiet - \
        || die "the lychee download does not match LYCHEE_SHA256; nothing was installed"
    tar -xzf "$TMP_DIR/$archive" -C bin --strip-components=1 "lychee-x86_64-unknown-linux-gnu/lychee"
    say "installed: $(./bin/lychee --version)"
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

# Version-pinned, like mdBook.
ensure_mdbook_numbering() {
    cargo install --list 2>/dev/null | grep -q "^mdbook-numbering v${MDBOOK_NUMBERING_VERSION}:" && return
    say "installing mdbook-numbering ${MDBOOK_NUMBERING_VERSION}..."
    cargo install --locked --version "$MDBOOK_NUMBERING_VERSION" mdbook-numbering
}

# Heading numbers on, code numbering off: mdbook-numbering's own rebuilds <code>
# as a table and breaks the copy button; custom.js draws a gutter instead.
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

# origin from GIT_REPO_URL, in its ssh form; added or updated, never pushed.
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

# An initial commit so the first push has a ref; skipped without a git identity.
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

# First free port from 3000 on 127.0.0.1 (where serve binds), via /dev/tcp.
pick_port() {
    local port=3000
    while (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do
        port=$((port + 1))
    done
    printf '%s' "$port"
}

## ─── file writers ────────────────────────────────────────────────────────
# src/ and README.md are the author's; everything else here is script-owned.

# book.toml regenerates every run; src/ is written once, when SUMMARY.md is missing.
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

# FAVICON_TEXT -> the characters drawn ("" = none). "auto" takes BOOK_TITLE's first
# alphanumeric (warns if there is none); anything else is cut to 3, with a warning.
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

# Letters on a transparent ground in the palette's ink, dark or light by
# prefers-color-scheme inside the file: the tab bar follows the OS, not the book.
# Charter only where installed (an image loads no @font-face). Size and baseline
# by length, measured to fill the square.
render_favicon_svg() {
    local mark="$1" size baseline
    case "${#mark}" in
        1) size=72; baseline=75 ;;
        2) size=50; baseline=68 ;;
        *) size=36; baseline=63 ;;
    esac
    cat <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    text{font-family:"Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;font-weight:700;fill:#191713}
    @media (prefers-color-scheme: dark){text{fill:#e8e6da}}
  </style>
  <text x="50" y="${baseline}" text-anchor="middle" font-size="${size}">$(esc_xml "$mark")</text>
</svg>
EOF
}

# theme/ files replace mdBook's built-ins. head.hbs clears a saved theme (fixed
# mode) or a saved light one (default mode, LIGHT_THEME=false); fonts.css drops
# mdBook's unused fonts (fixed mode); favicon.svg is src/logo.svg, else drawn from
# FAVICON_TEXT. favicon.svg is never deleted, so a hand-made one survives a run.
write_theme() {
    # Cleared first, so a change of THEME_MODE or LIGHT_THEME leaves nothing stale.
    rm -f theme/head.hbs theme/fonts/fonts.css
    local mark=""
    if [ -f src/logo.svg ]; then
        mkdir -p theme
        cp src/logo.svg theme/favicon.svg
        say "wrote theme/favicon.svg (from src/logo.svg)"
        # Say which source won, so an ignored FAVICON_TEXT is no puzzle.
        if [ -n "$FAVICON_TEXT" ]; then
            say "  (src/logo.svg wins; FAVICON_TEXT \"${FAVICON_TEXT}\" is not drawn)"
        fi
    # favicon_mark runs only on this branch, so its warnings fire only when used.
    elif mark=$(favicon_mark); [ -n "$mark" ]; then
        mkdir -p theme
        render_favicon_svg "$mark" > theme/favicon.svg
        say "wrote theme/favicon.svg (drawn from FAVICON_TEXT: \"${mark}\")"
    fi
    # Default mode: the picker stays, so only a saved light theme is cleared.
    if [ "$THEME_MODE" = default ]; then
        [ "$LIGHT_THEME" = false ] || return 0
        mkdir -p theme
        cat > theme/head.hbs <<'EOF'
{{!-- Script-owned: a re-run rewrites it. Clears a saved light theme; the
     picker offers only the dark ones. --}}
<script>try{var t=localStorage.getItem('mdbook-theme');if(t==='light'||t==='rust')localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
        say "wrote theme/head.hbs (default mode: clears a saved light theme)"
        return 0
    fi
    [ "$THEME_MODE" = fixed ] || return 0
    mkdir -p theme/fonts
    cat > theme/head.hbs <<'EOF'
{{!-- Script-owned: a re-run rewrites it. Clears a saved theme before mdBook's
     script reads it: the picker is hidden, and every site on one github.io
     origin shares localStorage. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    cat > theme/fonts/fonts.css <<'EOF'
/* Script-owned. Declares no faces: its presence stops mdBook shipping Open Sans
   and Source Code Pro. Charter is declared in custom.css. */
EOF
    say "wrote theme/head.hbs, theme/fonts/fonts.css"
}

# All four Charter faces present: only then is @font-face written (else 404s).
charter_present() {
    local f
    for f in charter_regular charter_italic charter_bold charter_bold_italic; do
        [ -f "src/fonts/${f}.woff2" ] || return 1
    done
    return 0
}

# custom.css, always written. Fixed mode: the reading theme and palette. Every
# mode: column alignment, rules, what custom.js adds, the gutter, the masthead.
# rem is 10px here (mdBook's 62.5%).
write_custom_css() {
    # The palette's selector, shared with the print override: both classes with
    # LIGHT_THEME=true, else the dark one, the only class ever on <html>.
    local pal_sel="html.${PREFERRED_LIGHT},html.${PREFERRED_DARK}"
    [ "$LIGHT_THEME" = true ] || pal_sel="html.${PREFERRED_DARK}"
    : > custom.css
    if [ "$THEME_MODE" = fixed ]; then
        mkdir -p src/fonts
        cat >> custom.css <<EOF
/* Fixed theme: no picker. theme/head.hbs clears a saved theme. */
#mdbook-theme-toggle { display: none; }
EOF
        if charter_present; then
            cat >> custom.css <<'EOF'

/* Self-hosted Charter; src/fonts/ is copied as is, not hashed. */
@font-face{font-family:"Charter";src:url("fonts/charter_regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_italic.woff2") format("woff2");font-weight:400;font-style:italic;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_bold.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:"Charter";src:url("fonts/charter_bold_italic.woff2") format("woff2");font-weight:700;font-style:italic;font-display:swap}
EOF
        else
            warn "src/fonts/ has no Charter woff2; the fallback face renders and no @font-face is emitted. Download the four from practicaltypography.com/charter.html into src/fonts/ and re-run."
            cat >> custom.css <<'EOF'

/* No @font-face: the Charter woff2 aren't in src/fonts/. */
EOF
        fi
        cat >> custom.css <<'EOF'

/* 1rem = 10px (mdBook's 62.5%). --menu-bar-height is mdBook's; everything tied
   to the bar reads it, so 60px moves it all together. */
:root{
  --serif: "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;
  --content-max-width: 700px;
  --menu-bar-height: 60px;
  --mono-font: ui-monospace,"DejaVu Sans Mono","Liberation Mono",Menlo,Consolas,monospace;
}
html{font-family:var(--serif);}
.sidebar{font-size:1.6rem;}
.content{font-size:1.9rem;line-height:1.55;}

/* Headings: margins in em of each one's own size; H4 to H6 at text size, told
   apart by style, never smaller than the text. No rules under them but the
   title block's, and a --- written straight after one. */
.content h1{font-size:3.4rem;line-height:1.18;margin:2.4rem 0;padding-bottom:1.3rem;border-bottom:1px solid var(--rule-strong);}
.content h2{font-size:2.5rem;line-height:1.18;margin:1.5em 0 .4em;}
.content h3{font-size:2.15rem;line-height:1.18;margin:1.18em 0 .29em;}
.content h4{font-size:1em;line-height:1.18;font-style:italic;margin:1.4em 0 .3em;}
.content h5{font-size:1em;line-height:1.18;font-style:italic;font-weight:normal;margin:1.3em 0 .3em;}
.content h6{font-size:1em;line-height:1.18;font-style:italic;font-weight:normal;color:var(--muted);margin:1.1em 0 .3em;}
.content h6 .header:is(:link,:visited){color:inherit;}

/* What follows a heading starts right under it, as does the first line inside
   a quote or aside there: its own top margin would beat the heading's smaller
   bottom one. A heading after a heading keeps its space above. */
.content main :is(h2,h3,h4,h5,h6) + :not(h2,h3,h4,h5,h6),.content main :is(h2,h3,h4,h5,h6) + :not(h2,h3,h4,h5,h6) > :first-child{margin-block-start:0;}

/* A --- straight after a heading, or after its subtitle, underlines it rather
   than dividing the page. */
.content main :is(h2,h3,h4,h5,h6):has(+ hr),.content main :is(h2,h3,h4,h5,h6) + .mdb-subtitle:has(+ hr){margin-block-end:.3em;}
.content main :is(h2,h3,h4,h5,h6) + hr,.content main :is(h2,h3,h4,h5,h6) + .mdb-subtitle + hr{margin-block:0 1.6rem;}

/* Subtitle: <p class="mdb-subtitle"> straight under a heading. */
.content .mdb-subtitle{margin-block:0 0;font-size:1.9rem;font-style:italic;line-height:1.35;color:var(--muted);}
.content h2:has(+ .mdb-subtitle){margin-block-end:.25em;}

/* Title block: the H1, then its subtitle and the "Last updated" line custom.js
   adds, when there; one rule closes it, under whichever comes last. */
.content h1:has(+ .mdb-subtitle,+ .mdb-updated){margin-block-end:.25em;padding-bottom:0;border-bottom:0;}
.content h1 + .mdb-subtitle{margin-block-end:2.4rem;padding-bottom:1.3rem;border-bottom:1px solid var(--rule-strong);}
.content h1 + .mdb-subtitle:has(+ .mdb-updated){margin-block-end:0;padding-bottom:0;border-bottom:0;}
.content .mdb-updated{margin-block-end:2.4rem;padding-bottom:1.3rem;border-bottom:1px solid var(--rule-strong);}

/* Blockquote; not admonitions (.blockquote-tag). Edge margins zeroed so the
   rule stays flush with the text. */
.content blockquote:not(.blockquote-tag){background:none;border-block:0;border-inline-start:3px solid var(--rule);padding:0 1em;color:var(--muted);}
.content blockquote:not(.blockquote-tag) > :first-child{margin-block-start:0;}
.content blockquote:not(.blockquote-tag) > :last-child{margin-block-end:0;}

/* Aside: a muted digression with a thin left rule. */
.content aside{font-size:.82em;color:var(--muted);border-inline-start:2px solid var(--rule);padding-inline-start:1em;margin:1.15rem 0;}

/* Footnotes, muted like the aside; mdBook draws the <hr> above them. */
.content .footnote-definition{font-size:.82em;color:var(--muted);}
/* Links in notes muted too: the underline marks them, not the colour. */
.content .footnote-definition a:link,.content .footnote-definition a:visited{color:var(--muted);}

/* Underlined links (colour from --links), search results included. Followed,
   a link in the text takes --visited (:visited can change colours only); a
   footnote number keeps its colour, and a link in a note stays muted (above). */
.content a,.content a:visited{text-decoration:underline;text-underline-offset:2px;}
#mdbook-searchresults a{text-decoration:underline;text-underline-offset:2px;}
.content main a:visited{color:var(--visited);}
.content .footnote-reference a:visited{color:var(--links);}

/* A numbered list inside a numbered list counts 1.1, 1.2.1 (Markdown has no
   "1.1"). A counter can't read <ol start>, so a list Markdown restarted keeps
   the browser's own numbers rather than wrong ones. */
.content main ol{counter-reset:outline;}
.content main ol > li{counter-increment:outline;}
.content main ol ol > li{list-style:none;position:relative;}
.content main ol ol > li::before{content:counters(outline,".");position:absolute;inset-inline-end:100%;padding-inline-end:.25em;}
.content main ol[start] ol > li,.content main ol ol[start] > li{list-style:revert;}
.content main ol[start] ol > li::before,.content main ol ol[start] > li::before{content:none;}

/* Palette: every colour variable mdBook paints, not just page and sidebar;
   admonition accents left alone. With LIGHT_THEME=true the dark block names both
   classes and comes first, the light one follows behind its media query, so no
   light frame paints under a dark OS (guide: "Why the dark palette comes
   first"). The class in each selector is load-bearing: html alone loses to
   mdBook's .<theme>. Ours, not mdBook's: --muted, --rule, --rule-strong,
   --inline-bg, --inline-border, --code-bg, --code-comment, --visited. */
EOF
        cat >> custom.css <<EOF
${pal_sel}{
  --bg:#111;--fg:#e8e6da;--links:#e8e6da;--visited:#94b9dc;--inline-code-color:#ffb454;--inline-bg:#2b281f;--inline-border:#3a382f;--muted:#aaa8a0;
  --rule:#2c2c28;--rule-strong:#42423c;--color-scheme:dark;
  --sidebar-bg:#161613;--sidebar-fg:#cfcdc2;--sidebar-active:#ffb454;
  --sidebar-spacer:#42423c;--sidebar-non-existant:#6b6a61;--sidebar-header-border-color:#42423c;
  --icons:#7a786e;--icons-hover:#e8e6da;
  --copy-button-filter:invert(1) opacity(.55);--copy-button-filter-hover:invert(1) opacity(1);
  --quote-bg:#1b1b18;--quote-border:#2c2c28;--warning-border:#ffb454;--code-bg:#242420;--code-comment:#8b949e;
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
  --bg:#fdfcf7;--fg:#191713;--links:#191713;--visited:#295a8e;--inline-code-color:#b5540a;--inline-bg:#ece3cd;--inline-border:#e0d8c2;--muted:#57564e;
  --rule:#e5e3d7;--rule-strong:#c2bda4;--color-scheme:light;
  --sidebar-bg:#f8f6ee;--sidebar-fg:#3a3a34;--sidebar-active:#b5540a;
  --sidebar-spacer:#c2bda4;--sidebar-non-existant:#a8a496;--sidebar-header-border-color:#c2bda4;
  --icons:#7d7a6e;--icons-hover:#191713;
  --copy-button-filter:opacity(.55);--copy-button-filter-hover:opacity(1);
  --quote-bg:#f4f2e8;--quote-border:#e5e3d7;--warning-border:#b5540a;--code-bg:#f4f2e8;--code-comment:#555;
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

/* Code-block ground from the palette (mdBook paints it from the highlight sheet). */
pre > code.hljs{background-color:var(--code-bg);}

/* Comment tokens from the palette: ayu's #5c6773 is about 2.7:1 on this ground.
   Fixed mode only: undefined, var() would wipe the stock colour. */
pre > code.hljs .hljs-comment,pre > code.hljs .hljs-quote{color:var(--code-comment);}

/* Inline code: mdBook paints no ground on it. Warm fill, accent text, and a
   hairline as an inset shadow, which keeps the inline box's metrics. */
:not(pre):not(a) > code.hljs{background-color:var(--inline-bg);color:var(--inline-code-color);box-shadow:inset 0 0 0 1px var(--inline-border);}

/* Mobile chapter buttons sit on the page, so they take the quote ground. */
.mobile-nav-chapters{background-color:var(--quote-bg);}

/* Print: ink on paper whatever the theme. Same selector as the palette, or
   html alone loses on specificity and the override never applies. */
@media print{
  ${pal_sel}{
       --bg:#fff;--fg:#111;--links:#111;--visited:#111;--inline-code-color:#111;--inline-bg:#f5f5f5;--inline-border:#ddd;--muted:#444;
       --rule:#ccc;--rule-strong:#999;--quote-bg:#fff;--quote-border:#ccc;--code-bg:#f5f5f5;--code-comment:#555;
       --table-border-color:#ccc;--table-header-bg:#eee;--table-alternate-bg:#fff;}
}
EOF
    fi

    # Always-on rules, with fallbacks for default mode's stock themes:
    #  - icon buttons inherit the font (the UA's 13.33px shrinks them);
    #  - --mdb-top-gap holds the two columns' first lines level;
    #  - the :empty/part-title rules undo mdBook's invalid nested <li> for a
    #    SUMMARY '---' or '# Part', which leaves an empty row;
    #  - a chapter <hr> and a SUMMARY '---' draw the same 1px rule;
    #  - chapters under src/unlisted/ lose their sidebar row (both href forms);
    #  - .mdb-wide widens a page, .mdb-bleed one block; screen only. box-sizing on
    #    the cap is load-bearing: content-box would widen padded siblings.
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

/* The per-page "Last updated <when>" line custom.js inserts under the chapter
   H1, set like a date line. Fixed mode puts the title block's rule under it;
   default mode mixes a muted colour from its theme's own. */
.content .mdb-updated{margin-block-start:1rem;font-size:.9em;font-style:italic;color:var(--muted,color-mix(in srgb,var(--fg) 80%,var(--bg)));}

.mdb-print-back{margin:0 0 2rem;font-size:.85em;}
@media print{.mdb-print-back{display:none;}}

@media screen{
  .content main:has(.mdb-wide,.mdb-bleed){max-width:1000px;}
  .content main:has(.mdb-bleed) > :not(.mdb-bleed){box-sizing:border-box;max-width:var(--content-max-width);margin-inline:auto;}
}
EOF
    if [ "$SIDEBAR_MASTHEAD" = none ]; then
        # No masthead: padding alone holds the first rows level.
        cat >> custom.css <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:calc(var(--menu-bar-height) + 1px + var(--mdb-top-gap));}
EOF
    else
        # Masthead band: bar height + 1px, sticky and opaque over the scrolling list,
        # with a hairline once it scrolls (custom.js sets .mdb-scrolled). The menu-bar
        # title fades by opacity, so it stays in the accessibility tree.
        cat >> custom.css <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:0;}
.sidebar-scrollbox::before{position:sticky;top:0;box-sizing:border-box;background-color:var(--sidebar-bg);border-block-end:1px solid transparent;}
.sidebar-scrollbox.mdb-scrolled::before{border-block-end-color:var(--table-border-color);}
.menu-title{transition:opacity .3s;}
html.sidebar-visible .menu-title{opacity:0;}
EOF
        if [ "$SIDEBAR_MASTHEAD" = text ]; then
            # BOOK_TITLE as text, not an SVG: an image can't load the webfont.
            cat >> custom.css <<EOF
.sidebar-scrollbox::before{content:"$(esc_dq "$BOOK_TITLE")";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);font-size:2.7rem;font-weight:200;line-height:calc(var(--menu-bar-height) - 4px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
EOF
        else
            # src/logo.svg as an alpha mask in --sidebar-fg, on its own layer: a mask
            # on the opaque sticky plate would clip the plate away.
            [ -f src/logo.svg ] || warn "SIDEBAR_MASTHEAD is \"image\" but src/logo.svg is missing; the sidebar shows an empty band, and no favicon is written, until you add it"
            cat >> custom.css <<'EOF'
.sidebar-scrollbox::before{content:"";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);}
html.js .sidebar::after{content:"";position:absolute;top:0;left:10px;right:10px;height:calc(var(--menu-bar-height) + 1px);pointer-events:none;background-color:var(--sidebar-fg);-webkit-mask:url("logo.svg") no-repeat left center/auto 50%;mask:url("logo.svg") no-repeat left center/auto 50%;}
EOF
        fi
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        # The gutter sits beside <code>, never inside it, so the copy button copies
        # the source exactly. Painted with --code-bg so the block is one surface;
        # hidden in print, where lines wrap.
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

# custom.js, always written: 'b' toggles the sidebar; off-site links open in a
# new tab; print.html gets a way back; the sidebar footer and per-page dates; the
# line-number gutter; keyboard-scrollable code. The workflow stamps the
# placeholders; unstamped, the footer and dates don't appear. DOM APIs only.
write_custom_js() {
    cat > custom.js <<EOF
// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy workflow stamps the
// other four. MDB_PAGE_DATES stays a quoted string until stamped, so an unstamped
// file still parses.
var MDB_REPO = "$(esc_dq "$GIT_REPO_URL")";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
var MDB_PAGE_DATES = "__MDB_PAGE_DATES__";
EOF
    cat >> custom.js <<'EOF'
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // A stamped value: non-empty and no longer a placeholder.
  var stamped = function (v) {
    return typeof v === "string" && v !== "" && v.indexOf("__MDB_") !== 0;
  };

  // Relative time by local calendar day: "N hours ago" ("just now" under an
  // hour), "yesterday", "two days ago", "three days ago", then the date. Computed
  // once; the exact time is the title. 'now' is a parameter for tests only.
  var mdbWhen = function (iso, now) {
    var d = new Date(iso);
    if (isNaN(d)) return null;
    now = now || new Date();
    var ms = now - d;
    if (ms < 0) ms = 0;
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); };
    var days = Math.round((day(now) - day(d)) / 86400000);
    var text;
    if (days <= 0) {
      var h = Math.floor(ms / 3600000);
      text = h < 1 ? "just now" : h === 1 ? "1 hour ago" : h + " hours ago";
    } else if (days === 1) text = "yesterday";
    else if (days === 2) text = "two days ago";
    else if (days === 3) text = "three days ago";
    else {
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      text = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    }
    var t = document.createElement("time");
    t.dateTime = iso;
    t.title = iso;
    t.textContent = text;
    return t;
  };

  // 'b' toggles the sidebar, behind the same focus guard mdBook uses.
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

  // Remove (not hide) prev/next links into src/unlisted/: book.js follows the
  // href from the DOM, so a hidden link would still take the arrow keys there.
  ready(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
  });

  // The masthead's hairline once the list scrolls under it.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // The sidebar footer; each part only if stamped.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) {
      // Relative, exact on hover; an unparseable stamp shows as it is.
      var u = document.createElement("span");
      u.appendChild(document.createTextNode("updated "));
      var w = mdbWhen(MDB_UPDATED);
      if (w) u.appendChild(w);
      else u.appendChild(document.createTextNode(MDB_UPDATED));
      parts.push(u);
    }
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
      if (i) p.appendChild(document.createTextNode(" · "));
      p.appendChild(parts[i]);
    }
    box.appendChild(p);
  });

  // "Last updated <when>" under the H1, from the stamped dates. The source path
  // comes from the edit link (the longest key its href ends with), else from the
  // page URL; print.html has no single source and is skipped.
  ready(function () {
    if (typeof MDB_PAGE_DATES !== "object" || !MDB_PAGE_DATES) return;
    if (/(^|\/)print\.html$/.test(location.pathname)) return;
    var src = "";
    var btn = document.getElementById("git-edit-button");
    var a = btn && btn.closest ? btn.closest("a") : null;
    var href = a ? a.getAttribute("href") || "" : "";
    if (href) {
      try { href = decodeURIComponent(href); } catch (err) {}
      for (var k in MDB_PAGE_DATES) {
        if (href.slice(-(k.length + 1)) === "/" + k && k.length > src.length) src = k;
      }
    }
    if (!src) {
      var depth = 0;
      if (typeof path_to_root === "string")
        depth = (path_to_root.match(/\.\.\//g) || []).length;
      var segs = location.pathname.split("/").filter(Boolean);
      var rel = segs.slice(segs.length - 1 - depth).join("/");
      try { rel = decodeURIComponent(rel); } catch (err) {}
      if (/\.html$/.test(rel) && rel !== "index.html") {
        var cand = "src/" + rel.replace(/\.html$/, ".md");
        if (MDB_PAGE_DATES[cand]) src = cand;
      }
    }
    var iso = src ? MDB_PAGE_DATES[src] : "";
    if (!iso) return;
    var w = mdbWhen(iso);
    if (!w) return;
    var main = document.querySelector("#mdbook-content main");
    if (!main) return;
    var h1 = main.querySelector("h1");
    if (!h1) return;
    var after = h1;
    var sib = h1.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("mdb-subtitle")) after = sib;
    var p = document.createElement("p");
    p.className = "mdb-updated";
    p.appendChild(document.createTextNode("Last updated "));
    p.appendChild(w);
    after.parentNode.insertBefore(p, after.nextSibling);
  });

  // print.html: a back link, and a return to the page you came from when the
  // print dialog closes (afterprint or the print media query; once only).
  (function () {
    if (!/(^|\/)print\.html$/.test(location.pathname)) return;

    ready(function () {
      var main = document.querySelector("#mdbook-content main");
      if (!main) return;
      var p = document.createElement("p");
      p.className = "mdb-print-back";
      var a = document.createElement("a");
      a.href = (typeof path_to_root === "string" ? path_to_root : "") + "index.html";
      a.textContent = "← Back";
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
    if [ "$THEME_MODE" = default ] && [ "$LIGHT_THEME" = false ]; then
        cat >> custom.js <<'EOF'

// Default mode, LIGHT_THEME=false: remove Light and Rust from the picker. Removed,
// not hidden: book.js moves focus by sibling, and a hidden row would trap it.
(function () {
  function drop() {
    var list = document.getElementById("mdbook-theme-list");
    if (!list) return;
    ["light", "rust"].forEach(function (name) {
      var b = document.getElementById("mdbook-theme-" + name);
      if (b && b.parentNode && b.parentNode.parentNode === list) b.parentNode.remove();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drop);
  else drop();
})();
EOF
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        cat >> custom.js <<'EOF'

// Line numbers in a gutter beside <code> (the copy button reads code.innerText).
// Only language-fenced blocks of MIN_LINES or more; not playgrounds or blocks with
// hidden lines, where the numbers would sit wrong.
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
    cat >> custom.js <<'EOF'

// Scrollable code is keyboard-reachable: tabindex="0" on blocks that overflow
// sideways, and only those (axe: scrollable-region-focusable). After the gutter
// section, which narrows <code>.
(function () {
  // More than 1px: whole-pixel widths turn a sub-pixel overhang into 1px.
  var apply = function () {
    var blocks = document.querySelectorAll("pre > code.hljs");
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.scrollWidth > b.clientWidth + 1) b.setAttribute("tabindex", "0");
      else if (b.getAttribute("tabindex") === "0") b.removeAttribute("tabindex");
    }
  };
  // Re-check when a block resizes, debounced: mdBook animates the page for 0.3s,
  // and a sidebar toggle fires no window resize.
  var timer = null;
  var later = function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(apply, 150);
  };
  var run = function () {
    apply();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(later);
      var blocks = document.querySelectorAll("pre > code.hljs");
      for (var i = 0; i < blocks.length; i++) ro.observe(blocks[i]);
    } else {
      window.addEventListener("resize", later);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  // book.js turns Left/Right into page turns and cancels them unless a form field
  // has focus. Stopped in the capture phase while a code block has focus, the
  // browser scrolls the block instead.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();
EOF
    say "wrote custom.js (sidebar key, external links, print return, site-meta footer, page dates, scrollable-code tabindex)"
}

# README: the title and, with GIT_REPO_URL, the live-site link. Written once:
# after the first run it's the author's, like src/.
write_readme() {
    if [ -e README.md ]; then
        say "README.md preserved"
        return
    fi
    if [ -n "$PAGES_URL" ]; then
        printf '# %s\n\nLive site: <%s>\n' "$BOOK_TITLE" "$PAGES_URL" > README.md
        say "wrote README.md (live site: ${PAGES_URL})"
    else
        printf '# %s\n' "$BOOK_TITLE" > README.md
        say "wrote README.md (no GIT_REPO_URL, so no live-site link)"
    fi
}

# ./build at the book's root: script-owned, executable.
write_build() {
    render_build > build
    chmod +x build
    say "wrote build (./build: build the book, and stop on a broken link)"
}

write_workflow() {
    mkdir -p .github/workflows
    render_workflow > .github/workflows/deploy.yml
    say "wrote .github/workflows/deploy.yml (branch: ${DEPLOY_BRANCH})"
}

## ─── templates ───────────────────────────────────────────────────────────
# Quoted heredoc delimiter ('EOF') = literal; unquoted (EOF) = expanded.

# book.toml. LIGHT_THEME=false pins both theme keys to PREFERRED_DARK: mdBook picks
# the highlight sheet by name, so a light name would put light tokens on the dark
# ground. edit-url-template: {path} already includes src/. No git-repository-url:
# its icon duplicates the footer's commit link.
render_book_toml() {
    cat <<EOF
[book]
title = "$(esc_dq "$BOOK_TITLE")"
authors = ["$(esc_dq "$BOOK_AUTHOR")"]
src = "src"

[output.html]
EOF
    echo 'additional-js = ["custom.js"]'
    # Always loaded: it styles what custom.js adds, in every mode.
    echo 'additional-css = ["custom.css"]'
    # Numbers shown is mdBook's default; only hiding them needs a line.
    [ "$SIDEBAR_NUMBERS" = true ] || echo 'no-section-label = true'
    if [ "$LIGHT_THEME" = false ]; then
        cat <<EOF
default-theme = "$(esc_dq "$PREFERRED_DARK")"
preferred-dark-theme = "$(esc_dq "$PREFERRED_DARK")"
EOF
    elif [ "$THEME_MODE" = fixed ]; then
        cat <<EOF
default-theme = "$(esc_dq "$PREFERRED_LIGHT")"
preferred-dark-theme = "$(esc_dq "$PREFERRED_DARK")"
EOF
    fi
    if [ -n "$GIT_REPO_URL" ]; then
        cat <<EOF
site-url = "$(esc_dq "$SITE_URL")"
edit-url-template = "$(esc_dq "$GIT_REPO_URL")/edit/$(esc_dq "$DEPLOY_BRANCH")/{path}"
EOF
    fi
    # Drop src/unlisted/ from search, only when SUMMARY.md lists a chapter there:
    # mdBook fails the build on a key that matches no chapter. A sub-table, so it
    # must stay last.
    if grep -qE '\]\(\.?/?unlisted/' src/SUMMARY.md 2>/dev/null; then
        cat <<'EOF'

[output.html.search.chapter]
"unlisted" = { enable = false }
EOF
    fi
}

# About is a prefix chapter: unnumbered, above the rest.
render_summary() {
    cat <<'EOF'
# Summary

[About](./about.md)

- [Chapter 1](./chapter_1.md)
EOF
}

# printf, not a heredoc: an unquoted heredoc would expand a $ in BOOK_TITLE.
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
    """Vivamus luctus urna sed urna ultricies ac tempor."""
    sagittis = []
    for nulla in adipiscing:
        if nulla in (elit or ()):
            continue
        sagittis.append(nulla.strip().lower())
    if not sagittis:
        raise ValueError("sed nec diam mattis viverra")
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

# The starter chapter's picture: grey at three opacities, for either ground.
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

# ./build: the build and link check, run by the author before a push and by the
# deploy workflow, so both stop on the same broken links. lychee checks the built
# pages; ./build reports each break by the Markdown file and line it's written on.
render_build() {
    cat <<'EOF'
#!/usr/bin/env bash
# Builds the book into book/, checks every internal link and anchor in it, and
# stops on a broken one, listing each by the file and line it's written on. The
# deploy workflow runs this same file.
set -euo pipefail
cd "$(dirname "$0")"
for tool in mdbook lychee; do
    [ -x "bin/$tool" ] || { echo "bin/$tool is missing: run bootstrap-mdbook.sh to install it" >&2; exit 1; }
done
./bin/mdbook build
# print.html repeats every chapter; 404.html's <base href> points at the live site.
rc=0
report=$(./bin/lychee --offline --include-fragments --mode plain --no-progress \
    --root-dir "$PWD/book" --exclude-path book/print.html --exclude-path book/404.html \
    'book/**/*.html' 2>&1) || rc=$?
if [ "$rc" -eq 0 ]; then
    echo "links: every internal link and anchor resolves"
    exit 0
fi

# lychee names each break by the built page and the address it resolved to.
# The rest turns that into the Markdown file and line, the link as written, and
# what's wrong. Fields are split by \037, since any of them can be empty.
us=$'\037'

# One line per break: page and target (both under book/), anchor, lychee's
# reason. LC_ALL=C makes %XX decode to bytes, which reassemble as UTF-8.
breaks=$(printf '%s\n' "$report" | LC_ALL=C ROOT_P="$(pwd -P)/book/" ROOT_L="$PWD/book/" awk '
    function unhex(s,   out, i, c) {
        out = ""
        for (i = 1; i <= length(s); i++) {
            c = substr(s, i, 1)
            if (c == "%" && substr(s, i + 1, 2) ~ /^[0-9A-Fa-f][0-9A-Fa-f]$/) {
                c = tolower(substr(s, i + 1, 2)); i += 2
                c = sprintf("%c", (index(hex, substr(c, 1, 1)) - 1) * 16 + index(hex, substr(c, 2, 1)) - 1)
            }
            out = out c
        }
        return out
    }
    function in_book(p) {
        if (index(p, ENVIRON["ROOT_P"]) == 1) return substr(p, length(ENVIRON["ROOT_P"]) + 1)
        if (index(p, ENVIRON["ROOT_L"]) == 1) return substr(p, length(ENVIRON["ROOT_L"]) + 1)
        return p
    }
    BEGIN { hex = "0123456789abcdef" }
    /^\[.*\]:$/ { page = substr($0, 2, length($0) - 3); sub(/^book\//, "", page); next }
    /^\[ERROR\] / {
        url = $2; frag = ""
        if ((i = index(url, "#")) > 0) { frag = unhex(substr(url, i + 1)); url = substr(url, 1, i - 1) }
        sub(/^file:\/\//, "", url)
        i = index($0, " | ")
        print page "\037" in_book(unhex(url)) "\037" frag "\037" (i ? substr($0, i + 3) : "")
    }' | sort -u)

# Nothing to map (lychee itself failed): show its report as it is, less its
# summary line, which is in emoji.
if [ -z "$breaks" ]; then
    printf '%s\n' "$report" | grep -v ' Total (in ' >&2 || true
    echo "stopped: lychee failed (exit $rc); its output is above." >&2
    exit 1
fi

# SRC: the file a built page comes from: NAME.md for NAME.html, a folder's
# README.md or index.md for its index.html, SUMMARY.md for toc.html. Without
# src/README.md or src/index.md, the root index.html is a copy of the first
# chapter (COPY=1). A page with no source stays book/NAME.
source_of() {
    local p=$1 f
    SRC='' COPY=''
    case $p in
        toc.html) SRC=src/SUMMARY.md ;;
        index.html|*/index.html)
            for f in "src/${p%index.html}README.md" "src/${p%index.html}readme.md" "src/${p%.html}.md"; do
                [ -f "$f" ] && { SRC=$f; break; }
            done
            if [ -z "$SRC" ] && [ "$p" = index.html ]; then
                f=$(awk 'match($0, /\]\([^)]*\.md\)/) { f = substr($0, RSTART + 2, RLENGTH - 3); sub(/^\.\//, "", f); print f; exit }' src/SUMMARY.md 2>/dev/null || true)
                [ -z "$f" ] || [ ! -f "src/$f" ] || { SRC=src/$f; COPY=1; }
            fi ;;
        *.html) [ ! -f "src/${p%.html}.md" ] || SRC=src/${p%.html}.md ;;
    esac
    [ -n "$SRC" ] || { [ -f "src/$p" ] && SRC=src/$p || SRC=book/$p; }
    return 0
}

re_esc() { printf '%s' "$1" | sed 's/[]\\.*$^+?(){}|[]/\\&/g'; }

# Where file $1 writes the link: "line<TAB>link as written" per line. $2 matches
# the target's file name, $3 its anchor; with $4, the link may be the anchor
# alone. Inline, reference and HTML links count; code spans and fenced blocks
# don't, as lychee skips them too.
written() {
    LC_ALL=C NAME_RE=$2 FRAG_RE=$3 SELF=$4 awk '
        BEGIN {
            q = sprintf("%c", 39)
            lead = "(\\]\\(<?|\\]:[ \t]*<?|(href|src)=[\"" q "])"
            path = "([^]()<>\"" q " \t]*/)?" ENVIRON["NAME_RE"]
            if (ENVIRON["SELF"] != "") path = "(" path ")?"
            if (ENVIRON["FRAG_RE"] != "") path = path "#" ENVIRON["FRAG_RE"]
            end = "[)>\"" q " \t\r]"
            re = lead path "(" end "|$)"
        }
        /^[ \t]*([`][`][`]|~~~)/ { fence = !fence; next }
        fence { next }
        {
            line = $0
            gsub(/`[^`]*`/, "", line)
            if (match(line, re)) {
                s = substr(line, RSTART, RLENGTH)
                match(s, "^" lead); s = substr(s, RLENGTH + 1)
                sub(end "$", "", s)
                print FNR "\t" s
            }
        }' "$1"
}

# The heading anchor on built page $1 sharing the most words with anchor $2,
# if it shares two thirds of them. Words under three letters and numbers don't
# count; a word matches one it starts, or that starts it (rename, renames).
closest() {
    { grep -o '<h[1-6][^>]* id="[^"]*"' "book/$1" || true; } | sed 's/.* id="//; s/"$//' |
    LC_ALL=C WANT=$2 awk '
        function words(s, out,   n, i, k, part) {
            n = split(s, part, "-"); k = 0
            for (i = 1; i <= n; i++)
                if (length(part[i]) > 2 && part[i] !~ /^[0-9]+$/ && part[i] !~ /^(and|the|for|with|from|into|that|this|what|how|why|when|are|was|not|its|you|your)$/)
                    out[++k] = part[i]
            return k
        }
        BEGIN { need = words(ENVIRON["WANT"], want) }
        need {
            k = words($0, have); hit = 0; split("", used)
            for (i = 1; i <= need; i++)
                for (j = 1; j <= k; j++)
                    if (!(j in used) && (index(have[j], want[i]) == 1 || index(want[i], have[j]) == 1)) { hit++; used[j] = 1; break }
            if (hit * 3 >= need * 2 && (hit > best || (hit == best && k - hit < fewest))) { best = hit; fewest = k - hit; pick = $0 }
        }
        END { if (pick != "") print pick }'
}

# Per break: the source file, each line the link is on, and why it's broken;
# then sorted by file and line, each printed once.
printf '%s\n' "$breaks" | while IFS=$us read -r page target frag reason; do
    source_of "$page"; src=$SRC copy=$COPY
    self=
    [ -z "$frag" ] || [ "$target" != "$page" ] || self=1
    name=${target##*/}
    [ -z "$self" ] || name=${src##*/}
    case $name in
        *.html|*.md) name_re="$(re_esc "${name%.*}")[.](md|html)" ;;
        *) name_re="$(re_esc "$name")/?" ;;
    esac
    case $reason in
        "Cannot find fragment"*)
            if [ -n "$self" ]; then why="no such anchor on this page"
            else source_of "$target"; why="no such anchor in $SRC"; fi
            hint=$(closest "$target" "$frag")
            [ -z "$hint" ] || why="$why; did you mean #$hint?" ;;
        "File not found"*)
            md=src/${target%.html}.md
            case $target in
                /*) why="it points outside the book" ;;
                README.html|*/README.html|readme.html|*/readme.html)
                    why="mdBook builds README.md as index.html; write index.md in place of README.md" ;;
                *.html) if [ -f "$md" ]; then why="$md isn't listed in src/SUMMARY.md, so the book has no page for it"
                        else why="there's no $md"; fi ;;
                *) why="there's no src/$target" ;;
            esac ;;
        *) why=$reason ;;
    esac
    found=
    if [ -f "$src" ]; then found=$(written "$src" "$name_re" "$(re_esc "$frag")" "$self"); fi
    if [ -n "$found" ]; then
        while IFS=$'\t' read -r line link; do
            printf '%s\n' "$src$us$line$us$link$us$why$us$copy"
        done <<< "$found"
    else
        if grep -q '[{][{][[:space:]]*#[a-z_]*include' "$src" 2>/dev/null; then
            why="$why (the link isn't in this file's own text; look in the files it includes)"
        else
            why="$why (couldn't find the link in this file's text)"
        fi
        printf '%s\n' "$src$us$us$target${frag:+#$frag}$us$why$us$copy"
    fi
done | LC_ALL=C sort -t "$us" -k1,1 -k2,2n -k3,3 -k4,4 -k5,5 | LC_ALL=C awk -F "$us" '
    BEGIN { print "" }
    !seen[$1 FS $2 FS $3 FS $4]++ {
        printf "%s%s: %s\n    %s%s\n", $1, ($2 != "" ? ":" $2 : ""), $3, $4,
            ($5 != "" ? " (on index.html, the copy of this chapter at the site root)" : "")
        n++
    }
    END {
        printf "\nstopped: %d broken link%s or anchor%s, listed above. fix %s, then run ./build again.\n",
            n, (n == 1 ? "" : "s"), (n == 1 ? "" : "s"), (n == 1 ? "it" : "them")
    }' >&2
exit 1
EOF
}

# The deploy workflow: mdBook and lychee pinned by version and sha256, actions by
# SHA, the runner by image. Build job: install both into bin/, stamp custom.js,
# run ./build, upload; deploy job: publish. Least-privilege token. Pages is
# enabled by hand, once.
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
    # Pinned like the actions and mdBook.
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@${ACTIONS_CHECKOUT_SHA}
        with:
          # Full history and tags: the stamp reads the tag.
          fetch-depth: 0

      - name: Install mdBook ${MDBOOK_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/rust-lang/mdBook/releases/download/${MDBOOK_VERSION}/mdbook-${MDBOOK_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "\$base" -o mdbook.tar.gz
          # The digest the bootstrap recorded: a tag names a file, not its bytes.
          echo "${MDBOOK_SHA256}  mdbook.tar.gz" | sha256sum -c -
          mkdir -p bin
          tar -xz -f mdbook.tar.gz --directory=bin${numbering_step}

      - name: Install lychee ${LYCHEE_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "\$base" -o lychee.tar.gz
          # Pinned by version and sha256, recorded in the bootstrap script.
          echo "${LYCHEE_SHA256}  lychee.tar.gz" | sha256sum -c -
          tar -xz -f lychee.tar.gz --strip-components=1 \\
            --directory=bin lychee-x86_64-unknown-linux-gnu/lychee

      - name: Stamp build metadata
        run: |
          set -euo pipefail
          # Version: the tag on this commit, or the nearest one plus a count
          # (v1.2+5); never --abbrev=0, which would claim the tag. Safe charset only.
          version=\$(git describe --tags 2>/dev/null | sed -E 's/-([0-9]+)-g[0-9a-f]+\$/+\\1/' || true)
          version=\${version//[^A-Za-z0-9._+-]/}
          # Each chapter source's last commit time, as {"src/x.md":"<time>"}; paths
          # outside a safe charset are skipped, so the sed splice stays safe.
          dates="{" sep=""
          while IFS= read -r -d '' f; do
            case "\$f" in *.md) ;; *) continue ;; esac
            case "\$f" in *[!A-Za-z0-9._/' '-]*)
              echo "page dates: skipping '\$f' (character outside the safe set)"; continue ;;
            esac
            d=\$(git log -1 --format=%aI -- "\$f")
            [ -n "\$d" ] || continue
            dates="\$dates\$sep\\"\$f\\":\\"\$d\\""
            sep=","
          done < <(git ls-files -z -- src)
          dates="\$dates}"
          sed -i \\
            -e "s|__MDB_BUILD_VERSION__|\${version}|" \\
            -e "s|__MDB_BUILD_DATE__|\$(date -u +%Y-%m-%dT%H:%M:%SZ)|" \\
            -e "s|__MDB_BUILD_SHA__|\${GITHUB_SHA::7}|" \\
            -e "s|\\"__MDB_PAGE_DATES__\\"|\${dates}|" \\
            custom.js

      - name: Build and check links
        # The ./build the author runs before a push: a broken link stops the deploy.
        run: bash ./build

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
# Guarded so the file can be sourced to test a render_* function.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````