<div class="mdb-wide"></div>

# Bootstrap-mdbook script

The script scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview.
For more details, see [Publish a book or a knowledge base](./publish-book.md).


````bash
#!/bin/bash
# bootstrap-mdbook.sh, v62
#
# Bootstraps an mdBook book at PROJECT_DIR/BOOK_NAME with a GitHub Pages workflow
# that pins mdBook, lychee and the actions, then opens a live preview. Re-running
# updates it: the script-owned files regenerate; src/ and README.md are yours.
# Linux x86_64 only. How to use it: mdb-guide.md.
#
#   bash bootstrap-mdbook.sh                 create or update the book, check it, preview it
#   KEEP_PINS=true bash bootstrap-mdbook.sh  the same, with the releases the workflow pins
#   ./build                                  in the book: build it; stop on a broken link
#
# After the first push: Settings -> Pages -> Source -> "GitHub Actions", once.

set -euo pipefail

## ─── user configuration ──────────────────────────────────────────────────
# Each setting: mdb-guide.md, "The toggles". A re-run applies what changed here.

PROJECT_DIR="$HOME/Desktop"               # the folder the book's folder goes in; ~ allowed
BOOK_NAME="mybook"                        # the book's folder: letters, digits, . _ -
BOOK_TITLE="mybook"                       # the title readers see
BOOK_AUTHOR="John Doe"
BOOK_DESCRIPTION=""                       # a line about the book, for search engines;
                                          # "" = none
DEPLOY_BRANCH="main"                      # pushes here deploy; git's default branch
HEADING_NUMBERS=false                     # true: numbered headings (mdbook-numbering)
SIDEBAR_NUMBERS=true                      # sidebar chapter numbers (1., 1.1.)
THEME="picker"                            # "picker" (default): a button for Auto, Light
                                          # and Dark, starting on Auto; "auto": light or
                                          # dark as the reader's system is set; "dark":
                                          # the dark palette for every reader
GIT_REPO_URL=""                           # https://github.com/user/repo; "" = the book's
                                          # origin remote, if that is on github.com
CODE_LINE_NUMBERS=true                    # numbers language-fenced blocks of 10+ lines
SIDEBAR_MASTHEAD="text"                   # "text", "none", or "image" (src/logo.svg)
FAVICON_TEXT="auto"                       # "auto" (the title's first letter), up to 3
                                          # characters, or ""; src/logo.svg wins
LAYOUT="scroll"                           # "scroll" (default): a chapter is one page;
                                          # "h2": one H2 at a time, with its H3-H6;
                                          # "nested": every H2-H6 a section of its own;
                                          # "picker": a button for Scroll or Pages
                                          # (nested), starting on Scroll
OFFLINE="full"                            # "full" (default): saving the book in the
                                          # reader's browser, and a copy to download
                                          # for any computer, online or air-gapped;
                                          # "download": the copy only; "none": neither
# The footer's version label comes from git, stamped by the workflow: the tag on
# the built commit, or the nearest one plus a count (v1.2+5). Tag a release with
#   git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0

## ─── settings check ──────────────────────────────────────────────────────
# An older settings block stops the run before anything is read or written.
check_settings() {
    local add="" del="" line name missing=false old value note=""
    while IFS= read -r line; do
        case $line in
            [A-Z]*=*) name=${line%%=*}; missing=false; [ -n "${!name+x}" ] || missing=true ;;
        esac
        # THEME replaces v53's four theme settings; its line gets the value they asked for.
        if [ "$missing" = true ] && [ "${line:0:6}" = THEME= ] && [ -n "${THEME_MODE+x}${LIGHT_THEME+x}" ]; then
            case "${THEME_MODE-fixed}/${LIGHT_THEME-false}" in
                */false) value=dark ;;
                default/*) value=picker ;;
                *) value=auto ;;
            esac
            line=$(printf '%-42s%s' "THEME=\"$value\"" "${line:42}")
        fi
        # LAYOUT takes the place of SPLIT_HEADINGS, done in the browser.
        if [ "$missing" = true ] && [ "${line:0:7}" = LAYOUT= ] && [ -n "${SPLIT_HEADINGS+x}" ]; then
            case "$SPLIT_HEADINGS" in
                h2|nested) value=$SPLIT_HEADINGS
                    note="SPLIT_HEADINGS=\"$SPLIT_HEADINGS\" made a page of each section; LAYOUT=\"$value\" shows them one at a time on the chapter's own page, so the split-off pages' addresses (chapter/section.html) stop working: a bookmark or a link from another site to one gets the 404 page." ;;
                # With HEADING_NUMBERS, v55 wrote no redirect pages: nothing is lost.
                *) value=scroll
                    [ "${HEADING_NUMBERS:-false}" = true ] \
                        || note="./build no longer writes the redirect pages at the addresses a split gives each heading (chapter/section.html): if this book was ever split, a bookmark or a link from another site to one gets the 404 page." ;;
            esac
            [ -z "$note" ] || note+=" A link in the book written to one (chapter/section.md) now stops ./build: write it to the chapter and the heading's anchor (chapter.md#section)."
            line=$(printf '%-42s%s' "LAYOUT=\"$value\"" "${line:42}")
        fi
        [ "$missing" = false ] || add+="    $line"$'\n'
    done <<'EOF'
PROJECT_DIR="$HOME/Desktop"               # the folder the book's folder goes in; ~ allowed
BOOK_NAME="mybook"                        # the book's folder: letters, digits, . _ -
BOOK_TITLE="mybook"                       # the title readers see
BOOK_AUTHOR="John Doe"
BOOK_DESCRIPTION=""                       # a line about the book, for search engines;
                                          # "" = none
DEPLOY_BRANCH="main"                      # pushes here deploy; git's default branch
HEADING_NUMBERS=false                     # true: numbered headings (mdbook-numbering)
SIDEBAR_NUMBERS=true                      # sidebar chapter numbers (1., 1.1.)
THEME="picker"                            # "picker" (default): a button for Auto, Light
                                          # and Dark, starting on Auto; "auto": light or
                                          # dark as the reader's system is set; "dark":
                                          # the dark palette for every reader
GIT_REPO_URL=""                           # https://github.com/user/repo; "" = the book's
                                          # origin remote, if that is on github.com
CODE_LINE_NUMBERS=true                    # numbers language-fenced blocks of 10+ lines
SIDEBAR_MASTHEAD="text"                   # "text", "none", or "image" (src/logo.svg)
FAVICON_TEXT="auto"                       # "auto" (the title's first letter), up to 3
                                          # characters, or ""; src/logo.svg wins
LAYOUT="scroll"                           # "scroll" (default): a chapter is one page;
                                          # "h2": one H2 at a time, with its H3-H6;
                                          # "nested": every H2-H6 a section of its own;
                                          # "picker": a button for Scroll or Pages
                                          # (nested), starting on Scroll
OFFLINE="full"                            # "full" (default): saving the book in the
                                          # reader's browser, and a copy to download
                                          # for any computer, online or air-gapped;
                                          # "download": the copy only; "none": neither
EOF
    for old in THEME_MODE LIGHT_THEME PREFERRED_LIGHT PREFERRED_DARK SPLIT_HEADINGS; do
        [ -z "${!old+x}" ] || del+="    $old"$'\n'
    done
    [ -n "$add$del" ] || return 0
    {
        echo "ERROR: the settings at the top of this script are from an older version of it, so nothing has been changed."
        [ -z "$add" ] || printf 'Add these lines to them:\n%s' "$add"
        [ -z "$del" ] || printf 'Delete these, which this version doesn'"'"'t read:\n%s' "$del"
        [ -z "$note" ] || printf '%s\n' "$note"
        echo "Then run it again. Each setting: mdb-guide.md, \"The toggles\"."
    } >&2
    exit 1
}
check_settings

# Expand a leading ~ (bash doesn't, inside quotes) and make the path absolute.
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
BOOK_DIR="$PROJECT_DIR/$BOOK_NAME"

## ─── internals ───────────────────────────────────────────────────────────

# Releases are taken once out this many days: most hijacked ones are pulled within a week.
RELEASE_WAIT_DAYS=7

MDBOOK_VERSION=""
MDBOOK_SHA256=""
MDBOOK_DIGEST=""        # GitHub's digest; "-": it has none
LYCHEE_VERSION=""
LYCHEE_SHA256=""
LYCHEE_DIGEST=""
NUMBERING_VERSION=""
CHECKOUT_USES=""        # actions/checkout@<commit> # <tag>, for the workflow
UPLOAD_USES=""
DEPLOY_USES=""
SITE_URL=""
PAGES_URL=""

TMP_DIR=""
STATIC_PID=""           # the server for book/, beside the preview
# That server goes too: a background job ignores the Ctrl-C that stops the preview.
cleanup() {
    [ -z "${STATIC_PID:-}" ] || kill "$STATIC_PID" 2>/dev/null || true
    [ -n "${TMP_DIR:-}" ] && rm -rf "$TMP_DIR"
    return 0
}
# Downloads unpack in bin/, not /tmp: they run before they're installed, and /tmp is often noexec.
make_tmp() { [ -n "${TMP_DIR:-}" ] || TMP_DIR=$(mktemp -d "$BOOK_DIR/bin/.tmp.XXXXXX"); }
trap cleanup EXIT

say()  { echo "$*"; }
warn() { echo "WARN: $*" >&2; }
die()  { echo "ERROR: $*" >&2; exit 1; }

# Escape for a double-quoted TOML, JS or CSS string: backslash first, then ".
esc_dq() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# Escape for XML text, & first; an unescaped & in a replacement would put the match there.
esc_xml() {
    local s="$1"
    s="${s//&/\&amp;}"
    s="${s//</\&lt;}"
    s="${s//>/\&gt;}"
    printf '%s' "$s"
}

# GIT_REPO_URL empty: read it from a github.com origin, so a fresh copy keeps the book's links.
derive_repo_url() {
    [ -z "$GIT_REPO_URL" ] || return 0
    [ -e ".git" ] || return 0
    local url rest
    url=$(git remote get-url origin 2>/dev/null) || return 0
    case "$url" in
        git@github.com:*)       rest="${url#git@github.com:}" ;;
        ssh://git@github.com/*) rest="${url#ssh://git@github.com/}" ;;
        https://github.com/*)   rest="${url#https://github.com/}" ;;
        *) warn "GIT_REPO_URL is empty and origin ($url) isn't a github.com remote this script reads; set GIT_REPO_URL to get the edit links, site-url and commit links"
           return 0 ;;
    esac
    rest="${rest%/}"
    rest="${rest%.git}"
    repo_path_ok "$rest" || { warn "GIT_REPO_URL is empty and origin ($url) doesn't read as user/repo; set GIT_REPO_URL"; return 0; }
    GIT_REPO_URL="https://github.com/${rest}"
    say "GIT_REPO_URL is empty; using origin: ${GIT_REPO_URL}"
}

# site-url lets the 404 page find its assets at any depth; user.github.io publishes at the root.
derive_pages() {
    SITE_URL=""
    PAGES_URL=""
    [ -n "$GIT_REPO_URL" ] || return 0
    local rest user repo
    rest="${GIT_REPO_URL#https://github.com/}"
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
    # git as the book's folder has it, whatever GIT_DIR or GIT_CONFIG this terminal sets.
    unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CONFIG
    [ $# -eq 0 ] || die "this script takes no arguments; got: $*"
    validate_config
    check_build_file
    # The tools first: a run that stops for them has written nothing.
    ensure_tools
    check_sudo
    check_repo
    check_book_writable
    # Releases before the book is touched: a run that stops here has changed nothing.
    lookup_releases
    check_bin_writable
    mkdir -p "$BOOK_DIR/bin"
    cd "$BOOK_DIR"
    # The binaries before git: a run that stops at one leaves no repository.
    install_mdbook
    install_lychee
    init_git_repo
    ensure_git_remote
    derive_repo_url
    derive_pages
    write_book_files
    write_theme
    write_custom_css
    write_custom_js
    write_version_js
    write_gitignore
    write_readme
    write_build
    retire_split_headings
    write_offline
    if [ "$HEADING_NUMBERS" = true ]; then
        ensure_cargo
        ensure_mdbook_numbering
        ensure_numbering_config
    fi
    write_workflow
    git_initial_commit
    # The check CI runs, before the preview: a broken link stops the run here.
    ./build || { cargo_note >&2; exit 1; }
    # The preview builds into .preview/, so book/ keeps the offline files ./build added;
    # with OFFLINE on, book/ is served beside it, for the offline button.
    local port static="" both=""
    if [ "$OFFLINE" != none ]; then
        static=$(pick_port 8000)
        # -I: nothing in the book's folder can stand in for http.server.
        python3 -I -m http.server -b 127.0.0.1 -d book "$static" >/dev/null 2>&1 &
        STATIC_PID=$!
        both=" both"
    fi
    port=$(pick_port 3000)
    say ""
    say "before each push: ./build builds the book into book/ and stops on a broken link or anchor."
    say "first deploy: push, then set Settings -> Pages -> Source -> \"GitHub Actions\" once."
    case "$OFFLINE" in
        full) say "the preview has no offline button; book/ has it, as ./build left it, at http://127.0.0.1:${static} (the download alone: saving needs the published site). that page doesn't follow your edits: ./build refreshes it." ;;
        download) say "the preview has no offline button; book/ has it, as ./build left it, at http://127.0.0.1:${static}. that page doesn't follow your edits: ./build refreshes it." ;;
    esac
    cargo_note
    say "done. starting preview at http://127.0.0.1:${port} (Ctrl-C to stop$both); it rebuilds into .preview/ as you edit."
    say "re-launch it later with: cd \"$BOOK_DIR\" && ./bin/mdbook serve --open -n 127.0.0.1 -p ${port} -d .preview"
    say "run a second book alongside this one by giving it a different -p port."
    say ""
    ./bin/mdbook serve --open -n 127.0.0.1 -p "$port" -d .preview
}

## ─── checks ──────────────────────────────────────────────────────────────

# A build the script didn't write is left alone: the run stops before writing anything.
check_build_file() {
    [ -e "$BOOK_DIR/build" ] || return 0
    # One it can't read is another user's: check_book_writable lists it.
    [ -r "$BOOK_DIR/build" ] || return 0
    grep -q 'bootstrap-mdbook.sh' "$BOOK_DIR/build" && return 0
    die "$BOOK_DIR/build exists and wasn't written by this script; move it aside (mv build build.own), then re-run. nothing has been changed."
}

# A newline is the one thing the escaped strings can't carry, so it is refused.
validate_config() {
    # Spelled out, not ranges: under a UTF-8 locale a range lets 'ń' through.
    case "$BOOK_NAME" in
        ""|.*|-*|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-]*)
            die "BOOK_NAME is the book's folder: letters, digits, '.', '_' and '-' only, not starting with '.' or '-', got: '$BOOK_NAME'" ;;
    esac
    [ -n "$BOOK_TITLE" ] || die "BOOK_TITLE must not be empty"
    case "$BOOK_TITLE"      in *$'\n'*|*$'\r'*) die "BOOK_TITLE must not contain newlines" ;; esac
    case "$BOOK_AUTHOR"     in *$'\n'*|*$'\r'*) die "BOOK_AUTHOR must not contain newlines" ;; esac
    case "$BOOK_DESCRIPTION" in *$'\n'*|*$'\r'*) die "BOOK_DESCRIPTION must not contain newlines" ;; esac
    case "$DEPLOY_BRANCH"   in *$'\n'*|*$'\r'*) die "DEPLOY_BRANCH must not contain newlines" ;; esac
    case "$HEADING_NUMBERS" in true|false) ;; *) die "HEADING_NUMBERS must be true or false, got: $HEADING_NUMBERS" ;; esac
    case "$SIDEBAR_NUMBERS" in true|false) ;; *) die "SIDEBAR_NUMBERS must be true or false, got: $SIDEBAR_NUMBERS" ;; esac
    case "$THEME"           in dark|auto|picker) ;; *) die "THEME must be dark, auto or picker, got: $THEME" ;; esac
    case "$CODE_LINE_NUMBERS" in true|false) ;; *) die "CODE_LINE_NUMBERS must be true or false, got: $CODE_LINE_NUMBERS" ;; esac
    case "$SIDEBAR_MASTHEAD"  in none|text|image) ;; *) die "SIDEBAR_MASTHEAD must be none, text or image, got: $SIDEBAR_MASTHEAD" ;; esac
    case "$LAYOUT"            in scroll|h2|nested|picker) ;; *) die "LAYOUT must be scroll, h2, nested or picker, got: $LAYOUT" ;; esac
    case "$OFFLINE"           in none|download|full) ;; *) die "OFFLINE must be none, download or full, got: $OFFLINE" ;; esac
    case "$RELEASE_WAIT_DAYS" in ""|*[!0123456789]*) die "RELEASE_WAIT_DAYS must be a whole number of days, got: $RELEASE_WAIT_DAYS" ;; esac
    case "${KEEP_PINS:-false}" in true|false) ;; *) die "KEEP_PINS must be true or false, got: $KEEP_PINS" ;; esac
    [ -z "${MDBOOK_VERSION_OVERRIDE+x}" ] \
        || die "MDBOOK_VERSION_OVERRIDE is gone (KEEP_PINS=true keeps the mdBook the workflow pins): unset it and run this again. Nothing has been changed."
    # Free-form, like the strings above: only newlines are refused.
    case "$FAVICON_TEXT"      in *$'\n'*|*$'\r'*) die "FAVICON_TEXT must not contain newlines" ;; esac

    # Exactly https://github.com/user/repo: a trailing / or .git is dropped, anything else refused.
    case "$GIT_REPO_URL" in
        "") ;;
        *$'\n'*|*$'\r'*) die "GIT_REPO_URL must not contain newlines or carriage returns" ;;
        https://github.com/*)
            GIT_REPO_URL="${GIT_REPO_URL%/}"
            GIT_REPO_URL="${GIT_REPO_URL%.git}"
            repo_path_ok "${GIT_REPO_URL#https://github.com/}" \
                || die "GIT_REPO_URL must be exactly https://github.com/user/repo (nothing after the repo), got: $GIT_REPO_URL" ;;
        *) die "GIT_REPO_URL must be an https github.com URL (https://github.com/user/repo), got: $GIT_REPO_URL" ;;
    esac
}

# True when $1 is exactly user/repo: one slash, something on each side of it.
repo_path_ok() {
    case "$1" in
        */*/*|/*|*/) return 1 ;;
        */*) return 0 ;;
        *) return 1 ;;
    esac
}

## ─── install ─────────────────────────────────────────────────────────────
# curl, python3, git, mdBook, lychee, cargo, mdbook-numbering

# What's missing of curl, python3 and git (with HEADING_NUMBERS, a C compiler), in one stop.
ensure_tools() {
    local miss=() pkgs=() all i
    command -v curl >/dev/null 2>&1 || { miss+=(curl); pkgs+=(curl); }
    command -v python3 >/dev/null 2>&1 || { miss+=(python3); pkgs+=(python3); }
    command -v git >/dev/null 2>&1 || { miss+=(git); pkgs+=(git); }
    if [ "$HEADING_NUMBERS" = true ] && ! cc_ready; then
        miss+=("a C compiler (HEADING_NUMBERS=true builds mdbook-numbering)"); pkgs+=(build-essential)
    fi
    [ "${#miss[@]}" -gt 0 ] || return 0
    all=${miss[0]}
    for ((i = 1; i < ${#miss[@]}; i++)); do
        if [ "$i" -eq $((${#miss[@]} - 1)) ]; then all+=" and ${miss[i]}"; else all+=", ${miss[i]}"; fi
    done
    die "this needs $all: install $([ "${#miss[@]}" -eq 1 ] && printf it || printf them) (on Debian or Ubuntu: sudo apt-get install ${pkgs[*]}), then run this again. Nothing has been changed."
}

# build-essential where dpkg keeps packages (a cc alone may lack the C library's files), else a cc.
cc_ready() {
    if command -v dpkg-query >/dev/null 2>&1; then
        case "$(dpkg-query -W -f='${Status}' build-essential 2>/dev/null || true)" in
            *" installed") return 0 ;;
            *) return 1 ;;
        esac
    fi
    command -v cc >/dev/null 2>&1
}

## ─── releases ────────────────────────────────────────────────────────────
# No config file reaches these: curl runs with -q, git ls-remote without git's config.
github_api() {
    curl -q --fail -sSL --proto =https --proto-redir =https --connect-timeout 30 --max-time 120 -H "Accept: application/vnd.github+json" "https://api.github.com/$1"
}

crates_api() {
    curl -q --fail -sSL --proto =https --proto-redir =https --connect-timeout 30 --max-time 120 -A "bootstrap-mdbook.sh" "https://crates.io/api/v1/$1"
}

fetch() {
    curl -q --fail -sSL --proto =https --proto-redir =https --connect-timeout 30 --max-time 900 "$1" -o "$2"
}

# The commit a tag of github.com/$1 names (an annotated tag's, peeled); nothing for no such tag.
tag_commit() {
    # No repository, no config, no prompt: nothing local can redirect it or stall it.
    env -u GIT_SSL_NO_VERIFY -u GIT_CONFIG_COUNT -u GIT_CONFIG_PARAMETERS -u XDG_CONFIG_HOME -u GIT_ASKPASS -u SSH_ASKPASS \
        HOME=/nonexistent GIT_DIR=/nonexistent GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 \
        git -c http.sslVerify=true -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 ls-remote "https://github.com/$1" "refs/tags/$2" "refs/tags/$2^{}" |
        awk -v t="refs/tags/$2" '$2 == t "^{}" { peeled = $1 } $2 == t { plain = $1 }
            END { print (peeled != "" ? peeled : plain) }'
}

# The highest-numbered stable release out $4 days, with file $2, in series $3: "tag sha256 [passed]".
pick_release() {
    python3 -I -c '
import datetime as dt, json, re, sys
prefix, asset, series, days = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
when = lambda t: dt.datetime.fromisoformat(t.replace("Z", "+00:00"))
data = json.load(sys.stdin.buffer)
best = passed = None
for r in data if isinstance(data, list) else [data]:
    tag = r.get("tag_name") or ""
    m = re.fullmatch(re.escape(prefix) + r"([0-9]+)\.([0-9]+)\.([0-9]+)", tag)
    if not m or r.get("draft") or r.get("prerelease") or not r.get("published_at"):
        continue
    if series and "%s.%s" % m.group(1, 2) != series:
        continue
    if when(r["published_at"]) > cut:
        continue
    key = tuple(int(x) for x in m.groups())
    digest = "-"
    if asset:
        name = asset.replace("{tag}", tag)
        files = [a for a in r.get("assets") or [] if a.get("name") == name and a.get("state") == "uploaded"]
        if not files or max(when(files[0]["created_at"]), when(files[0]["updated_at"])) > cut:
            if passed is None or key > passed[0]:
                passed = (key, tag)
            continue
        d = files[0].get("digest")
        if d is not None and d != "":
            digest = d[7:] if isinstance(d, str) and re.fullmatch("sha256:[0-9a-f]{64}", d) else "?"
    if best is None or key > best[0]:
        best = (key, tag, digest)
if best:
    print(best[1], best[2], *([passed[1]] if passed and passed[0] > best[0] else []))
' "$1" "$2" "$3" "$4"
}

# GitHub's digest now for file $2 of release $1: hex, "-" for none, "?" for an unknown form.
file_digest() {
    python3 -I -c '
import json, re, sys
tag = sys.argv[1]; name = sys.argv[2].replace("{tag}", tag)
data = json.load(sys.stdin.buffer)
for r in data if isinstance(data, list) else [data]:
    if r.get("tag_name") == tag:
        for a in r.get("assets") or []:
            if a.get("name") == name and a.get("state") == "uploaded":
                d = a.get("digest")
                print("-" if d is None or d == "" else d[7:] if isinstance(d, str) and re.fullmatch("sha256:[0-9a-f]{64}", d) else "?")
                sys.exit(0)
' "$1" "$2"
}

# The workflow's pins as "name value [value]" lines; an action pinned alone has the tag "-".
pins() {
    local wf="$BOOK_DIR/.github/workflows/deploy.yml"
    [ -f "$wf" ] || return 0
    sed -n \
        -e 's|.*/rust-lang/mdBook/releases/download/\(v[0-9][0-9.]*\)/mdbook-v[0-9][0-9.]*-x86_64-unknown-linux-gnu\.tar\.gz".*|mdbook \1|p' \
        -e 's|^[[:blank:]]*echo[[:blank:]]\{1,\}"\([0-9a-f]\{64\}\)[[:blank:]]\{1,\}\*\{0,1\}mdbook\.tar\.gz".*|mdbook-sha \1|p' \
        -e 's|.*/lycheeverse/lychee/releases/download/\(lychee-v[0-9][0-9.]*\)/lychee-x86_64-unknown-linux-gnu\.tar\.gz".*|lychee \1|p' \
        -e 's|^[[:blank:]]*echo[[:blank:]]\{1,\}"\([0-9a-f]\{64\}\)[[:blank:]]\{1,\}\*\{0,1\}lychee\.tar\.gz".*|lychee-sha \1|p' \
        -e 's|.*cargo install --locked --version \([0-9][0-9.]*\) mdbook-numbering.*|numbering \1|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:blank:]]\{1,\}#[[:blank:]]*\(v[0-9]\{1,\}\.[0-9]\{1,\}\.[0-9]\{1,\}\)[[:space:]]*$|\1 \2 \3|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:blank:]]\{1,\}#.*$|\1 \2 -|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:space:]]*$|\1 \2 -|p' \
        "$wf"
}
pin() {
    pins | awk -v k="$1" '$1 == k { $1 = ""; sub(/^ /, ""); print; exit }'
}

# The pins are the book's only once its repository has a commit (a clone's are the reference repo's).
own_pins() {
    [ -e "$BOOK_DIR/.git" ] && git -C "$BOOK_DIR" rev-parse -q --verify HEAD >/dev/null 2>&1
}

# The book's .git must be a repository git works in as the book's: else stop, before anything is read.
check_repo() {
    [ -e "$BOOK_DIR/.git" ] || return 0
    local top said q gd
    # A .git with files this user can't read (a git command run with sudo leaves root's): git sees none.
    if ! git -C "$BOOK_DIR" --git-dir=.git rev-parse --git-common-dir >/dev/null 2>&1 && ! all_readable "$BOOK_DIR/.git"; then
        said=$(git -C "$BOOK_DIR" --git-dir=.git rev-parse --git-common-dir 2>&1 >/dev/null | grep -m 1 . | sed 's/^fatal: //') || true
        printf -v q '%q' "$(readlink -f "$BOOK_DIR")"
        case "$(readlink -f "$BOOK_DIR/.git")/" in "$(readlink -f "$BOOK_DIR")"/*) ;; *) printf -v q '%s %q' "$q" "$(readlink -f "$BOOK_DIR/.git")" ;; esac
        [ "$EUID" -ne 0 ] || die "git can't read the book's repository ($said), and this run is root's. Nothing has been changed. Run this as the user who owns $BOOK_DIR/.git."
        die "git can't read the book's repository ($said): something in $BOOK_DIR/.git isn't yours to read. Nothing has been changed. Make it yours, then run this again: sudo chown -R \"\$(id -un)\" $q && chmod -R u+rwX $q"
    fi
    if top=$(git -C "$BOOK_DIR" rev-parse --show-toplevel 2>/dev/null); then
        [ "$top" -ef "$BOOK_DIR" ] && return 0
        die "$BOOK_DIR/.git isn't a repository git can read, so git takes the book for part of $top. Nothing has been changed. Move $BOOK_DIR/.git aside, then run this again."
    fi
    said=$(git -C "$BOOK_DIR" rev-parse --show-toplevel 2>&1 >/dev/null | grep -m 1 . | sed 's/^fatal: //') || true
    # Asked by name, git reads a repository whoever owns it: unread, it's none, or another user's.
    if gd=$(git -C "$BOOK_DIR" --git-dir=.git rev-parse --git-common-dir 2>/dev/null); then
        case $gd in /*) ;; *) gd="$BOOK_DIR/$gd" ;; esac
        # Read, and all this user's: something else stops git (a bare .git, say).
        if [ -O "$BOOK_DIR" ] && [ -O "$BOOK_DIR/.git" ] && [ -O "$gd" ]; then
            die "git can't read the book's repository ($said). Nothing has been changed. Fix that, or move $BOOK_DIR/.git aside if it isn't one, then run this again."
        fi
    elif [ -O "$BOOK_DIR/.git" ]; then
        die "git can't read the book's repository ($said). Nothing has been changed. Fix that, or move $BOOK_DIR/.git aside if it isn't one, then run this again."
    else
        gd="$BOOK_DIR/.git"
    fi
    # The folders themselves, not symlinks; the repository's too when it's outside the book.
    printf -v q '%q' "$(readlink -f "$BOOK_DIR")"
    case "$(readlink -f "$gd")/" in "$(readlink -f "$BOOK_DIR")"/*) ;; *) printf -v q '%s %q' "$q" "$(readlink -f "$gd")" ;; esac
    [ "$EUID" -ne 0 ] || die "git won't work in the book's repository ($said): it's another user's, and this run is root's. Nothing has been changed. Give them one owner, then run this again: chown -R root: $q"
    die "git won't work in the book's repository ($said): it's another user's. Nothing has been changed. Make it yours, then run this again: sudo chown -R \"\$(id -un)\" $q"
}

# Every path this run writes, checked first: a stop partway would leave the book half rewritten.
check_book_writable() {
    local bad=() p gd=""
    if [ ! -e "$BOOK_DIR" ] && [ ! -L "$BOOK_DIR" ]; then
        p=$BOOK_DIR
        while [ ! -e "$p" ]; do p=$(dirname "$p"); done
        [ -d "$p" ] && [ -w "$p" ] && [ -x "$p" ] && return 0
        die "can't make $BOOK_DIR: you can't write in $p. Nothing has been changed. Set PROJECT_DIR to a folder of yours, then run this again."
    fi
    [ -d "$BOOK_DIR" ] || die "$BOOK_DIR is there, and isn't a folder. Nothing has been changed. Move it aside, or set BOOK_NAME to another name."
    if [ ! -w "$BOOK_DIR" ] || [ ! -x "$BOOK_DIR" ]; then bad+=("(the book's folder itself)"); fi
    # Written every run: each file, or where it isn't, the folder above it.
    for p in book.toml custom.css custom.js version.js build offline.py .github/workflows/deploy.yml theme theme/fonts; do
        can_write "$p"
    done
    # build is made executable, which only its owner (or root) can do.
    [ ! -e "$BOOK_DIR/build" ] || [ -O "$BOOK_DIR/build" ] || [ "$EUID" -eq 0 ] || bad+=("build (made executable, which only its owner can)")
    # Written on some runs only.
    if [ -f "$BOOK_DIR/src/logo.svg" ] || [ -n "$FAVICON_TEXT" ]; then can_write theme/favicon.svg; fi
    if [ ! -f "$BOOK_DIR/src/SUMMARY.md" ]; then
        for p in src/SUMMARY.md src/about.md src/chapter_1.md src/demo.svg; do can_write "$p"; done
    fi
    [ -e "$BOOK_DIR/README.md" ] || can_write README.md
    [ -d "$BOOK_DIR/src/fonts" ] || can_write src/fonts
    if ! { [ -f "$BOOK_DIR/.gitignore" ] && grep -qxF 'bin/' "$BOOK_DIR/.gitignore" && grep -qxF 'book/' "$BOOK_DIR/.gitignore" \
        && grep -qxF '.preview/' "$BOOK_DIR/.gitignore"; }; then
        can_write .gitignore
    fi
    # book/ and .preview/, which mdBook empties and refills: every folder in them.
    for p in book .preview; do
        [ -d "$BOOK_DIR/$p" ] || continue
        p=$(find -H "$BOOK_DIR/$p" -type d ! -writable -print -quit 2>/dev/null || true)
        [ -z "$p" ] || bad+=("${p#"$BOOK_DIR"/}/ (the first such folder there; mdBook empties and fills them all)")
    done
    # The repository: origin is set in its config, and the first commit written in it.
    if [ -e "$BOOK_DIR/.git" ]; then
        gd=$(cd "$BOOK_DIR" && git rev-parse --git-common-dir 2>/dev/null) || gd=""
        case $gd in "") ;; /*) ;; *) gd="$BOOK_DIR/$gd" ;; esac
        if [ -n "$gd" ]; then
            # Not when origin is that address already: the config is left as it is.
            [ -z "$GIT_REPO_URL" ] || [ -w "$gd" ] \
                || [ "$(git -C "$BOOK_DIR" config --get remote.origin.url 2>/dev/null || true)" = "$(origin_ssh)" ] \
                || bad+=("${gd#"$BOOK_DIR"/}/ (origin is set in its config)")
            if ! git -C "$BOOK_DIR" rev-parse -q --verify HEAD >/dev/null 2>&1; then
                p=$(find -H "$gd" -type d ! -writable -print -quit 2>/dev/null || true)
                [ -z "$p" ] || bad+=("${p#"$BOOK_DIR"/}/ (the first commit is written in it)")
            fi
        fi
    fi
    [ "${#bad[@]}" -eq 0 ] || unwritable "$gd"
}

# Whether this user can read every file and folder in $1 (symlinks aside).
all_readable() {
    [ -z "$(find -H "$1" ! -type l \( ! -readable -o -type d ! -executable \) -print -quit 2>&1)" ]
}

# The write checks' stop: what's in bad, and what to do.
unwritable() {
    local gd=$1 p q ro="" ia=""
    {
        echo "ERROR: this run writes these in $BOOK_DIR, and can't; nothing has been changed:"
        printf '%s\n' "${bad[@]}" | awk '!seen[$0]++ { print "    " $0 }'
        # A read-only mount, or an immutable or append-only file, defeats a chown: say which.
        for p in "${bad[@]}"; do
            p=${p%% (*}; p=${p%/}
            case $p in "("*) p=$BOOK_DIR ;; /*) ;; *) p="$BOOK_DIR/$p" ;; esac
            findmnt -no OPTIONS -T "$p" 2>/dev/null | tr , '\n' | grep -qx ro && { ro=$p; break; }
            [ -n "$ia" ] || ! lsattr -d -- "$p" 2>/dev/null | awk '$1 ~ /[ia]/ { f = 1 } END { exit !f }' || ia=$p
        done
        if [ -n "$ro" ]; then
            echo "$ro is on a filesystem mounted read-only (findmnt -T \"$ro\"): put the book where you can write, or mount it read-write."
        elif [ -n "$ia" ]; then
            if [ "$EUID" -eq 0 ]; then p=""; else p="sudo "; fi
            printf -v q '%q' "$ia"
            echo "$ia is immutable or append-only (lsattr -d), which stops root too; take that off, and the same for any other listed: ${p}chattr -i -a $q"
        elif [ "$EUID" -eq 0 ]; then
            echo "This run is root's, and root can't write them either: a read-only mount (findmnt -T \"$BOOK_DIR\"), an immutable file (lsattr), or a network folder or container that treats root as another user."
        else
            # The folders themselves, not symlinks: chown -R changes a symlink it's given.
            printf -v q '%q' "$(readlink -f "$BOOK_DIR")"
            if [ -n "$gd" ]; then
                case "$(readlink -f "$gd")/" in "$(readlink -f "$BOOK_DIR")"/*) ;; *) printf -v q '%s %q' "$q" "$(readlink -f "$gd")" ;; esac
            fi
            echo "Make them yours and writable, then run this again: sudo chown -R \"\$(id -un)\" $q && chmod -R u+rwX $q"
        fi
    } >&2
    exit 1
}

# bin/, once the releases are known: only when a release goes in, or with HEADING_NUMBERS.
check_bin_writable() {
    local bad=() m="" l=""
    [ -d "$BOOK_DIR" ] || return 0
    (cd "$BOOK_DIR" && mdbook_installed) || m=1
    (cd "$BOOK_DIR" && lychee_installed) || l=1
    if [ -z "$m$l" ] && [ "$HEADING_NUMBERS" != true ]; then return 0; fi
    can_write bin
    if [ -n "$m" ]; then can_write bin/.mdbook.sha256; can_write bin/.mdbook.version; fi
    if [ -n "$l" ]; then can_write bin/.lychee.sha256; can_write bin/.lychee.version; fi
    [ "${#bad[@]}" -eq 0 ] || unwritable ""
}

# A run as root on a book that isn't root's would leave root's files in it: stop.
check_sudo() {
    [ "$EUID" -eq 0 ] || return 0
    local p=$BOOK_DIR
    while [ ! -e "$p" ]; do p=$(dirname "$p"); done
    if [ "$(stat -L -c %u "$p")" != 0 ]; then
        [ -z "${SUDO_UID:-}" ] || [ "$SUDO_UID" = 0 ] \
            || die "this is a run with sudo, and $p isn't root's: it would leave root's files in the book. Nothing has been changed. Run this without sudo."
        die "this run is root's, and $p isn't: it would leave root's files in the book. Nothing has been changed. Run this as the user who owns $p."
    fi
    # With HEADING_NUMBERS, rustup and cargo write in CARGO_HOME, RUSTUP_HOME and HOME too.
    [ "$HEADING_NUMBERS" = true ] || return 0
    for p in "${CARGO_HOME:-$HOME/.cargo}" "${RUSTUP_HOME:-$HOME/.rustup}" "$HOME"; do
        while [ ! -e "$p" ]; do p=$(dirname "$p"); done
        [ "$(stat -L -c %u "$p")" = 0 ] \
            || die "this run is root's, and $p isn't: with HEADING_NUMBERS, rustup and cargo would leave root's files there. Nothing has been changed. Run with root's own HOME (sudo -H), and CARGO_HOME and RUSTUP_HOME unset."
    done
}

# For check_book_writable: $1, or the nearest folder above it, must take the write; else onto bad.
can_write() {
    local f="$BOOK_DIR/$1" up slash=""
    if [ -e "$f" ] || [ -L "$f" ]; then
        [ ! -d "$f" ] || slash=/
        # Append-only (chattr +a) passes -w but can't be rewritten.
        { [ -w "$f" ] && ! lsattr -d -- "$f" 2>/dev/null | awk '$1 ~ /a/ { a = 1 } END { exit !a }'; } || bad+=("$1$slash")
        return 0
    fi
    up=${f%/*}
    while [ ! -e "$up" ] && [ ! -L "$up" ]; do up=${up%/*}; done
    # A symlink to nothing (a drive that isn't mounted): no folder is made there.
    [ -e "$up" ] || { bad+=("${up#"$BOOK_DIR"/} (a symlink to $(readlink -- "$up"), which isn't there)"); return 0; }
    [ -w "$up" ] && [ -x "$up" ] && return 0
    if [ "$up" = "$BOOK_DIR" ]; then bad+=("(the book's folder itself)"); else bad+=("${up#"$BOOK_DIR"/}/"); fi
}

# A pin ("commit tag") as a uses: value, and a uses: value as a run names it.
pin_uses() {
    if [ "${2#* }" = - ]; then printf '%s@%s' "$1" "${2%% *}"; else printf '%s@%s # %s' "$1" "${2%% *}" "${2#* }"; fi
}
uses_name() {
    local c=${1##*@}
    case "$1" in *" # "*) printf '%s' "${1##*# }" ;; *) printf 'commit %s' "${c:0:12}" ;; esac
}

LIMIT_HINT="no network, a proxy refusing api.github.com, or GitHub's limit of 60 requests an hour from one address: try again within the hour"
CRATES_HINT="no network, a proxy refusing crates.io, or crates.io not answering"
DL_HINT="no network, a proxy refusing github.com or release-assets.githubusercontent.com, or, with a 404, the release pulled: a run without KEEP_PINS takes another"

# A release for $1 from github.com/$2; GitHub out of reach, the pin. Sets REL_TAG and REL_DIGEST.
lookup_tool() {
    local name=$1 repo=$2 prefix=$3 asset=$4 series=$5 json got ptag psha now label=$1 shown passed stays=""
    [ "$name" != mdbook ] || label=mdBook
    shown=${asset//\{tag\}/vX.Y.Z}
    REL_TAG="" REL_DIGEST=""
    ptag=$(pin "$name") psha=$(pin "$name-sha")
    own_pins || ptag="" psha=""
    if json=$(github_api "repos/$repo/releases?per_page=100"); then
        got=$(printf '%s' "$json" | pick_release "$prefix" "$asset" "$series" "$RELEASE_WAIT_DAYS") || die "could not read $repo's releases; nothing has been changed"
        if [ -n "$got" ] && [ -n "$series" ]; then
            local newest
            # Only to say so: a release it can't read in another series says nothing.
            newest=$(printf '%s' "$json" | pick_release "$prefix" "$asset" "" "$RELEASE_WAIT_DAYS" 2>/dev/null) || newest=""
            [ -z "$newest" ] || [ "${newest%% *}" = "${got%% *}" ] || stays="$label ${newest%% *} is out, but this script's theme and scripts are written for $label $series: using ${got%% *}"
        fi
    else
        # A version pinned without its digest can't be checked: as on a first run.
        { [ -n "$ptag" ] && [ -n "$psha" ]; } || die "could not look up $repo's releases ($LIMIT_HINT); nothing has been changed. Run this again later."
        warn "could not look up $repo's releases ($LIMIT_HINT): keeping $label ${ptag#lychee-}, which the workflow pins"
        REL_TAG=$ptag REL_DIGEST=$psha
        return 0
    fi
    # The pinned release first: a replaced file stops the run even when no release qualifies.
    if [ -n "$ptag" ] && [ -n "$psha" ]; then
        now=$(printf '%s' "$json" | file_digest "$ptag" "$asset") || die "could not read $repo's releases; nothing has been changed"
        if [ -n "$now" ] && [ "$now" != - ] && [ "$now" != "?" ] && [ "$now" != "$psha" ]; then
            die "GitHub's digest for $label ${ptag#lychee-} is $now, but the workflow pins $psha for it: the file has changed since. Nothing has been changed. Check the release's page on GitHub; to go on, delete the line with $psha from .github/workflows/deploy.yml and run this again."
        fi
    fi
    [ -n "$got" ] || die "no stable $repo release${series:+ in the $series series} with $shown has been out $RELEASE_WAIT_DAYS days yet; nothing has been changed"
    read -r REL_TAG REL_DIGEST passed <<< "$got"
    # A digest in an unknown form: for the pinned release, the pinned one; else stop.
    if [ "$REL_DIGEST" = "?" ]; then
        if [ "$REL_TAG" != "$ptag" ] || [ -z "$psha" ]; then
            # On a re-run, what KEEP_PINS keeps is a way on.
            local keep=""
            [ -z "$ptag" ] || [ -z "$psha" ] || [[ $ptag != "$prefix${series:+$series.}"* ]] \
                || keep=" Till then, KEEP_PINS=true keeps $label ${ptag#lychee-}, which the workflow pins."
            die "GitHub gives the digest of $label ${REL_TAG#lychee-}'s ${asset//\{tag\}/$REL_TAG} in a form this script doesn't know, so the download can't be checked. Nothing has been changed.$keep"
        fi
        REL_DIGEST=$psha
    fi
    [ -z "$stays" ] || say "$stays"
    # A newer release passed over for its file: said, or a renamed file would hold every run back.
    if [ -n "$passed" ] && { [ "$passed" != "$ptag" ] || [ -z "$psha" ]; }; then
        warn "$label ${passed#lychee-} is out, but has no ${asset//\{tag\}/$passed} uploaded $RELEASE_WAIT_DAYS days ago or more: using ${REL_TAG#lychee-}"
    fi
    [ -n "$ptag" ] && [ -n "$psha" ] || return 0
    # A file from before GitHub made digests has none: the pinned one, then.
    [ "$REL_TAG" != "$ptag" ] || [ "$REL_DIGEST" != - ] || REL_DIGEST=$psha
    # The pin passed over for an older release: a step back, said.
    if [ "$REL_TAG" != "$ptag" ] && { [ -z "$series" ] || [[ $ptag == "$prefix$series".* ]]; } \
        && [ "$(printf '%s\n' "$REL_TAG" "$ptag" | sort -V | tail -n 1)" = "$ptag" ]; then
        warn "the workflow pins $label ${ptag#lychee-}, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days: using ${REL_TAG#lychee-}. Its releases page may say why."
    fi
}

# The refusal for an action whose pinned tag ($2, "commit tag") names $3 now.
tag_moved() {
    die "$1's tag ${2#* } now names commit $3, but the workflow pins ${2%% *} for it: the tag has been moved. Nothing has been changed. Check the release's page on GitHub; to go on, delete its 'uses:' line from .github/workflows/deploy.yml and run this again."
}

# An action at its newest release out RELEASE_WAIT_DAYS days, pinned by commit. Sets USES.
lookup_action() {
    local repo=$1 json got tag sha old was
    old=$(pin "$repo")
    own_pins || old=""
    if json=$(github_api "repos/$repo/releases?per_page=100"); then
        got=$(printf '%s' "$json" | pick_release v "" "" "$RELEASE_WAIT_DAYS") || die "could not read $repo's releases; nothing has been changed"
        if [ -z "$got" ]; then
            # A moved pinned tag stops the run even when no release qualifies.
            if [ -n "$old" ] && [ "${old#* }" != - ] && was=$(tag_commit "$repo" "${old#* }" 2>/dev/null) \
                && [ -n "$was" ] && [ "${old%% *}" != "$was" ]; then
                tag_moved "$repo" "$old" "$was"
            fi
            die "no stable $repo release has been out $RELEASE_WAIT_DAYS days yet; nothing has been changed"
        fi
        tag=${got%% *}
        # git failing is GitHub out of reach, as when the API can't be asked.
        if ! sha=$(tag_commit "$repo" "$tag"); then
            [ -n "$old" ] || die "could not ask github.com which commit $repo's tag $tag names (git ls-remote failed, above). Nothing has been changed. Run this again later."
            USES=$(pin_uses "$repo" "$old")
            warn "could not ask github.com which commit $repo's tag $tag names (git ls-remote failed, above): keeping $repo $(uses_name "$USES"), which the workflow pins"
            return 0
        fi
        case "$sha" in
            *[!0123456789abcdef]*|"") die "could not find the commit $repo's tag $tag names (git ls-remote https://github.com/$repo); nothing has been changed" ;;
        esac
        [ "${#sha}" -eq 40 ] || die "could not find the commit $repo's tag $tag names (git ls-remote https://github.com/$repo); nothing has been changed"
        # A pinned tag that's gone proves nothing; a commit pinned alone has no tag.
        if [ -n "$old" ] && [ "${old#* }" != - ]; then
            was=$sha
            if [ "${old#* }" != "$tag" ] && ! was=$(tag_commit "$repo" "${old#* }"); then
                USES=$(pin_uses "$repo" "$old")
                warn "could not ask github.com which commit $repo's tag ${old#* } names (git ls-remote failed, above): keeping $repo $(uses_name "$USES"), which the workflow pins"
                return 0
            fi
            if [ -n "$was" ] && [ "${old%% *}" != "$was" ]; then
                tag_moved "$repo" "$old" "$was"
            fi
            if [ "${old#* }" != "$tag" ] && [ "$(printf '%s\n' "$tag" "${old#* }" | sort -V | tail -n 1)" = "${old#* }" ]; then
                warn "the workflow pins $repo ${old#* }, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days: using $tag. Its releases page may say why."
            fi
        fi
    elif [ -n "$old" ]; then
        USES=$(pin_uses "$repo" "$old")
        warn "could not look up $repo's releases ($LIMIT_HINT): keeping $repo $(uses_name "$USES"), which the workflow pins"
        return 0
    else
        die "could not look up $repo's releases ($LIMIT_HINT); nothing has been changed. Run this again later."
    fi
    USES="$repo@$sha # $tag"
}

# mdbook-numbering: the newest unyanked version out RELEASE_WAIT_DAYS days. Sets NUMBERING_VERSION.
lookup_numbering() {
    local json old
    if json=$(crates_api "crates/mdbook-numbering/versions"); then
        NUMBERING_VERSION=$(printf '%s' "$json" | python3 -I -c '
import datetime as dt, json, re, sys
cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=int(sys.argv[1]))
best = None
for v in json.load(sys.stdin.buffer).get("versions") or []:
    m = re.fullmatch(r"([0-9]+)\.([0-9]+)\.([0-9]+)", v.get("num") or "")
    if not m or v.get("yanked") or not v.get("created_at"):
        continue
    if dt.datetime.fromisoformat(v["created_at"].replace("Z", "+00:00")) > cut:
        continue
    key = tuple(int(x) for x in m.groups())
    if best is None or key > best[0]:
        best = (key, v["num"])
if best:
    print(best[1])
' "$RELEASE_WAIT_DAYS") || die "could not read crates.io's versions of mdbook-numbering; nothing has been changed"
        [ -n "$NUMBERING_VERSION" ] || die "no version of mdbook-numbering that hasn't been yanked has been out $RELEASE_WAIT_DAYS days yet; nothing has been changed"
        old=$(pin numbering)
        own_pins || old=""
        if [ -n "$old" ] && [ "$old" != "$NUMBERING_VERSION" ] \
            && [ "$(printf '%s\n' "$NUMBERING_VERSION" "$old" | sort -V | tail -n 1)" = "$old" ]; then
            warn "the workflow pins mdbook-numbering $old, which crates.io doesn't offer now, unyanked and out $RELEASE_WAIT_DAYS days: using $NUMBERING_VERSION"
        fi
    else
        old=$(pin numbering)
        own_pins || old=""
        [ -n "$old" ] || die "could not look up mdbook-numbering on crates.io ($CRATES_HINT); nothing has been changed. Run this again later."
        warn "could not look up mdbook-numbering on crates.io ($CRATES_HINT): keeping mdbook-numbering $old, which the workflow pins"
        NUMBERING_VERSION=$old
    fi
}

# Every release this run uses; with KEEP_PINS, those the workflow pins. mdBook stays on 0.5.
MDBOOK_SERIES="0.5"
lookup_releases() {
    local keep="" v where=GitHub
    # KEEP_PINS: checked in validate_config.
    [ "${KEEP_PINS:-false}" != true ] || keep=1
    KEPT=""
    # Said first, so a slow network doesn't look like a hang.
    [ "$HEADING_NUMBERS" != true ] || where="GitHub and crates.io"
    [ -n "$keep" ] || say "looking up the newest releases on $where"
    if [ -n "$keep" ] && [ -n "$(pin mdbook)" ] && [ -n "$(pin mdbook-sha)" ]; then
        MDBOOK_VERSION=$(pin mdbook) MDBOOK_DIGEST=$(pin mdbook-sha) KEPT=1
    else
        unpinned "$keep" mdBook
        lookup_tool mdbook rust-lang/mdBook v "mdbook-{tag}-x86_64-unknown-linux-gnu.tar.gz" "$MDBOOK_SERIES"
        MDBOOK_VERSION=$REL_TAG MDBOOK_DIGEST=$REL_DIGEST
    fi
    # Kept pins too: the theme is written for 0.5's pages.
    if [[ $MDBOOK_VERSION != "v$MDBOOK_SERIES".* ]]; then
        if [ -n "$keep" ]; then
            die "the workflow pins mdBook $MDBOOK_VERSION, and this script is written for $MDBOOK_SERIES. Nothing has been changed. Run without KEEP_PINS."
        fi
        die "with GitHub out of reach this run would keep mdBook $MDBOOK_VERSION, and this script is written for $MDBOOK_SERIES. Nothing has been changed. Run this again later."
    fi
    if [ -n "$keep" ] && [ -n "$(pin lychee)" ] && [ -n "$(pin lychee-sha)" ]; then
        v=$(pin lychee); LYCHEE_VERSION=${v#lychee-v} LYCHEE_DIGEST=$(pin lychee-sha) KEPT=1
    else
        unpinned "$keep" lychee
        lookup_tool lychee lycheeverse/lychee lychee-v "lychee-x86_64-unknown-linux-gnu.tar.gz" ""
        LYCHEE_VERSION=${REL_TAG#lychee-v} LYCHEE_DIGEST=$REL_DIGEST
    fi
    keep_or_lookup_action actions/checkout "$keep"; CHECKOUT_USES=$USES
    keep_or_lookup_action actions/upload-pages-artifact "$keep"; UPLOAD_USES=$USES
    keep_or_lookup_action actions/deploy-pages "$keep"; DEPLOY_USES=$USES
    if [ "$HEADING_NUMBERS" = true ]; then
        if [ -n "$keep" ] && [ -n "$(pin numbering)" ]; then
            NUMBERING_VERSION=$(pin numbering) KEPT=1
        else
            unpinned "$keep" mdbook-numbering
            lookup_numbering
        fi
    fi
    say "releases: mdBook $MDBOOK_VERSION, lychee $LYCHEE_VERSION${NUMBERING_VERSION:+, mdbook-numbering $NUMBERING_VERSION}; $(uses_name "$CHECKOUT_USES"), $(uses_name "$UPLOAD_USES"), $(uses_name "$DEPLOY_USES") of the actions${KEPT:+ (KEEP_PINS: those the workflow pins, kept)}"
}

# KEEP_PINS with nothing pinned for it: looked up, and said.
unpinned() {
    [ -z "$1" ] || say "KEEP_PINS: nothing to keep for $2 in the workflow; looking it up"
}

keep_or_lookup_action() {
    local v
    v=$(pin "$1")
    if [ -n "$2" ] && [ -n "$v" ]; then
        USES=$(pin_uses "$1" "$v") KEPT=1
    else
        unpinned "$2" "$1"
        lookup_action "$1"
    fi
}

# Downloads $1 to $2, checked against digest $3 ("-": none, so its own is pinned). Prints the digest.
fetch_checked() {
    local got
    fetch "$1" "$2" || die "could not download $1 ($DL_HINT); it wasn't installed"
    [ -s "$2" ] || die "the download of $1 is empty"
    got=$(sha256sum "$2" | awk '{print $1}')
    case "$got" in
        [0-9a-f][0-9a-f]*) ;;
        *) die "could not compute the sha256 of $2" ;;
    esac
    if [ "$3" = - ]; then
        warn "GitHub has no digest for $1: pinning its own, $got"
    elif [ "$got" != "$3" ]; then
        die "$1 isn't the file it should be: its sha256 is $got, not $3. It wasn't installed."
    fi
    printf '%s' "$got"
}

current_mdbook_version() {
    [ -x "bin/mdbook" ] || return 0
    # One that won't run (another platform's, a broken download) is none.
    bin/mdbook --version 2>/dev/null | awk 'NR == 1 { print $2 }' || true
}

# Stops when binary $1 ($2, bin/$3, pinned $4) can't run here: too old a glibc, or a noexec mount.
runs_here() {
    local out rc need have keep="" tool=${3:-} pinned=${4:-} probe="${1%/*}/.probe"
    out=$("$1" --version 2>&1) && return 0
    rc=$?
    # Said by what it printed, or, printing nothing, by how it ended.
    [ -n "$out" ] || out="its --version printed nothing and exited $rc"
    # Not even a script runs from bin/: the filesystem is mounted noexec.
    if printf '#!/bin/sh\n' 2>/dev/null > "$probe" && chmod +x "$probe" && ! "$probe" 2>/dev/null; then
        die "$2 can't run from the book's bin/: the filesystem $BOOK_DIR is on doesn't allow running programs (it's mounted noexec). It wasn't installed. Put the book in your home folder (PROJECT_DIR), then run this again."
    fi
    # KEEP_PINS is offered only when bin/ runs the release the workflow pins, and it's another.
    if [ "${KEEP_PINS:-false}" != true ] && [ -n "$pinned" ] && [ "$pinned" != "${2#* }" ] \
        && [ "$("bin/$tool" --version 2>/dev/null | awk 'NR == 1 { print $2 }')" = "$pinned" ]; then
        keep=" KEEP_PINS=true keeps ${2%% *} $pinned, which the workflow pins and bin/ has."
    fi
    need=$(printf '%s\n' "$out" | grep -o 'GLIBC_[0-9][0-9.]*' | sort -V | tail -n 1 || true)
    have=$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}' || true)
    [ -z "$need" ] || die "$2's Linux build needs glibc ${need#GLIBC_} or later, and this system has ${have:-an older one}: it wasn't installed, and bin/ keeps the ${2%% *} it had, if any. Run this on a system with glibc ${need#GLIBC_} or later.${keep}"
    die "$2 doesn't run here ($(printf '%s' "$out" | head -n 2 | tr '\n' ' ')): it wasn't installed, and bin/ keeps the ${2%% *} it had, if any.${keep}"
}

# bin/ has this run's release, by digest and version, and it runs: nothing to install.
mdbook_installed() {
    local current
    current=$(current_mdbook_version)
    [ -n "$current" ] && [ "${current#v}" = "${MDBOOK_VERSION#v}" ] && [ -s bin/.mdbook.sha256 ] \
        && [ "$(cat bin/.mdbook.version 2>/dev/null)" = "$MDBOOK_VERSION" ] \
        && [ "$MDBOOK_DIGEST" != - ] && [ "$(cat bin/.mdbook.sha256 2>/dev/null)" = "$MDBOOK_DIGEST" ]
}
lychee_installed() {
    [ -x bin/lychee ] && [ "$(bin/lychee --version 2>/dev/null | head -n 1)" = "lychee ${LYCHEE_VERSION}" ] \
        && [ -s bin/.lychee.sha256 ] && [ "$(cat bin/.lychee.version 2>/dev/null)" = "$LYCHEE_VERSION" ] \
        && [ "$LYCHEE_DIGEST" != - ] && [ "$(cat bin/.lychee.sha256 2>/dev/null)" = "$LYCHEE_DIGEST" ]
}
install_mdbook() {
    local version triple archive url bin
    version="$MDBOOK_VERSION"

    if mdbook_installed; then
        MDBOOK_SHA256=$(cat bin/.mdbook.sha256)
        say "mdBook $(current_mdbook_version) already installed"
        return
    fi

    triple="x86_64-unknown-linux-gnu"
    archive="mdbook-${version}-${triple}.tar.gz"
    url="https://github.com/rust-lang/mdBook/releases/download/${version}/${archive}"

    make_tmp
    say "downloading mdBook ${version}..."
    MDBOOK_SHA256=$(fetch_checked "$url" "$TMP_DIR/$archive" "$MDBOOK_DIGEST")

    # The pin KEEP_PINS would keep, offered when it isn't this release.
    local pinned keep=""
    pinned=$(pin mdbook)
    [ -n "$(pin mdbook-sha)" ] && [[ $pinned == "v$MDBOOK_SERIES".* ]] || pinned=""
    own_pins || pinned=""
    [ "${KEEP_PINS:-false}" = true ] || [ -z "$pinned" ] || [ "$pinned" = "$version" ] \
        || keep=" Till then, KEEP_PINS=true keeps mdBook $pinned, which the workflow pins."
    # --no-same-owner: as root, tar would keep the archive's uid, who could then swap what root runs.
    tar --no-same-owner -xzf "$TMP_DIR/$archive" -C "$TMP_DIR" mdbook \
        || die "no mdbook at the top of $archive: this release lays its archive out in a way this script doesn't know.$keep"
    bin="$TMP_DIR/mdbook"
    chmod +x "$bin"
    runs_here "$bin" "mdBook $version" mdbook "$pinned"
    # -f: over a read-only bin/mdbook, mv would ask first.
    mv -f "$bin" "$BOOK_DIR/bin/mdbook"
    printf '%s' "$MDBOOK_SHA256" > bin/.mdbook.sha256
    printf '%s' "$version" > bin/.mdbook.version
    say "installed: $(./bin/mdbook --version) (sha256 ${MDBOOK_SHA256:0:12}...)"
}

# lychee into bin/ beside mdBook: the bytes CI runs, checked and recorded as mdBook's are.
install_lychee() {
    local archive="lychee-x86_64-unknown-linux-gnu.tar.gz"
    if lychee_installed; then
        LYCHEE_SHA256=$(cat bin/.lychee.sha256)
        say "lychee ${LYCHEE_VERSION} already installed"
        return
    fi
    make_tmp
    say "downloading lychee ${LYCHEE_VERSION}..."
    LYCHEE_SHA256=$(fetch_checked "https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/${archive}" \
        "$TMP_DIR/$archive" "$LYCHEE_DIGEST")
    local pinned keep=""
    pinned=$(pin lychee)
    [ -n "$(pin lychee-sha)" ] || pinned=""
    own_pins || pinned=""
    [ "${KEEP_PINS:-false}" = true ] || [ -z "$pinned" ] || [ "${pinned#lychee-v}" = "$LYCHEE_VERSION" ] \
        || keep=" Till then, KEEP_PINS=true keeps lychee ${pinned#lychee-v}, which the workflow pins."
    tar --no-same-owner -xzf "$TMP_DIR/$archive" -C "$TMP_DIR" "lychee-x86_64-unknown-linux-gnu/lychee" \
        || die "could not take lychee out of $archive: this release lays its archive out in a way this script doesn't know.$keep"
    runs_here "$TMP_DIR/lychee-x86_64-unknown-linux-gnu/lychee" "lychee $LYCHEE_VERSION" lychee "${pinned#lychee-v}"
    mv -f "$TMP_DIR/lychee-x86_64-unknown-linux-gnu/lychee" bin/lychee
    printf '%s' "$LYCHEE_SHA256" > bin/.lychee.sha256
    printf '%s' "$LYCHEE_VERSION" > bin/.lychee.version
    say "installed: $(./bin/lychee --version)"
}

# HEADING_NUMBERS: how this terminal finds mdbook-numbering when its PATH lacks cargo's bin/.
CARGO_NOTE=""
cargo_note() {
    case "$CARGO_NOTE" in
        env)  say "this terminal's PATH lacks ${CARGO_HOME:-~/.cargo}/bin, where mdbook-numbering is: run . \"${CARGO_HOME:-\$HOME/.cargo}/env\" here before ./build or ./bin/mdbook serve." ;;
        path) say "this terminal's PATH lacks ${CARGO_HOME:-$HOME/.cargo}/bin, where cargo put mdbook-numbering: add it, or ./build stops without it." ;;
    esac
}
# rustup's folder is CARGO_HOME when that's set, as cargo's is.
ensure_cargo() {
    local home="${CARGO_HOME:-$HOME/.cargo}"
    command -v cargo >/dev/null 2>&1 && return
    CARGO_NOTE="env"
    if [ -f "$home/env" ]; then
        # shellcheck source=/dev/null
        source "$home/env"
        command -v cargo >/dev/null 2>&1 && return
    fi

    # The C compiler cargo links with is checked in ensure_tools.
    make_tmp
    say "installing rustup..."
    fetch https://sh.rustup.rs "$TMP_DIR/rustup-init.sh" || die "could not download rustup's installer from https://sh.rustup.rs (behind a proxy, set https_proxy)"
    # An empty .curlrc in CURL_HOME keeps ~/.curlrc from rustup's own curl.
    : > "$TMP_DIR/.curlrc"
    CURL_HOME="$TMP_DIR" TMPDIR="$TMP_DIR" sh "$TMP_DIR/rustup-init.sh" -y --default-toolchain stable >/dev/null

    [ -f "$home/env" ] || die "cargo env file missing after rustup install"
    # shellcheck source=/dev/null
    source "$home/env"
    export PATH="$home/bin:$PATH"
    command -v cargo >/dev/null 2>&1 || die "cargo not on PATH after install"
}

# The version lookup_numbering found, pinned in the workflow like mdBook.
ensure_mdbook_numbering() {
    local root="${CARGO_HOME:-$HOME/.cargo}/bin" hint="" pv
    # grep without -q: quitting at the match would fail cargo on a broken pipe (pipefail).
    if ! cargo install --list 2>/dev/null | grep "^mdbook-numbering v${NUMBERING_VERSION}:" >/dev/null; then
        say "installing mdbook-numbering ${NUMBERING_VERSION}..."
        # On a re-run, the release the workflow pins, when cargo has it.
        pv=$(pin numbering)
        own_pins || pv=""
        if [ "${KEEP_PINS:-false}" != true ] && [ -n "$pv" ] && [ "$pv" != "$NUMBERING_VERSION" ] \
            && cargo install --list 2>/dev/null | grep "^mdbook-numbering v${pv}:" >/dev/null; then
            hint=" KEEP_PINS=true keeps mdbook-numbering $pv, which the workflow pins and cargo has installed."
        fi
        # A distribution's Rust is often older than a crate needs.
        [ "$(command -v cargo)" = "$root/cargo" ] \
            || hint=" If it asks for a newer Rust: this cargo is $(command -v cargo) ($(cargo --version 2>/dev/null || true)), and rustup (https://rustup.rs) installs the current one.$hint"
        # cargo runs the build scripts it compiles from TMPDIR: in bin/, as the downloads are.
        make_tmp
        TMPDIR="$TMP_DIR" cargo install --locked --version "$NUMBERING_VERSION" mdbook-numbering \
            || die "cargo couldn't install mdbook-numbering ${NUMBERING_VERSION}; it says why, above.${hint} Run this again once that's fixed."
    fi
    # mdBook runs it by name, and a distribution's cargo installs where PATH doesn't look.
    if ! command -v mdbook-numbering >/dev/null 2>&1; then
        export PATH="$root:$PATH"
        [ -n "$CARGO_NOTE" ] || CARGO_NOTE="path"
    fi
}

# mdbook-numbering's code numbering breaks the copy button: off; custom.js draws a gutter instead.
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
    [ -e ".git" ] && return
    if git init -b "$DEPLOY_BRANCH" >/dev/null 2>&1; then
        say "initialised git repo on branch: $DEPLOY_BRANCH"
    else
        warn "git init failed - run manually later"
    fi
}

# origin from GIT_REPO_URL, in its ssh form (git@github.com:user/repo.git); never pushed.
origin_ssh() {
    local rest="${GIT_REPO_URL#https://}"
    printf 'git@%s:%s.git' "${rest%%/*}" "${rest#*/}"
}
ensure_git_remote() {
    [ -e ".git" ] || return 0
    [ -n "$GIT_REPO_URL" ] || return 0
    local ssh
    ssh=$(origin_ssh)
    if git remote get-url origin >/dev/null 2>&1; then
        # As configured: get-url applies url.*.insteadOf rewrites.
        [ "$(git config --get remote.origin.url)" != "$ssh" ] || return 0
        if git remote set-url origin "$ssh"; then say "updated origin -> $ssh"; else warn "could not update origin"; fi
    else
        if git remote add origin "$ssh"; then say "set origin -> $ssh"; else warn "could not add origin"; fi
    fi
}

# The first commit, only with an identity the author set, and in UTC; who it's from is said.
git_initial_commit() {
    [ -e ".git" ] || return 0
    git rev-parse HEAD >/dev/null 2>&1 && return 0
    git add -A
    local err
    if err=$(TZ=UTC git -c user.useConfigOnly=true commit -q -m "initial mdBook scaffold" 2>&1); then
        # As a push publishes it: the author, the committer if another, and each time's offset.
        local as by off when also=""
        as=$(git -c log.showSignature=false log -1 --format='%an <%ae>')
        by=$(git -c log.showSignature=false log -1 --format='%cn <%ce>')
        off=$(git -c log.showSignature=false log -1 --format='%ad %cd' --date=raw | awk '{ print $2, $4 }')
        case "$off" in
            "+0000 +0000") when="timed in UTC" ;;
            "${off% *} ${off% *}") when="with the offset ${off% *}" also=", and that offset" ;;
            *) when="with the offsets ${off% *} (author) and ${off#* } (committer)" also=", and those offsets" ;;
        esac
        if [ "$by" = "$as" ]; then
            say "created initial commit on ${DEPLOY_BRANCH} as $as, $when; a push publishes that name and address$also (mdb-guide.md, \"What a push publishes\")"
        else
            say "created initial commit on ${DEPLOY_BRANCH} as $as, committed by $by, $when; a push publishes both names and addresses$also (mdb-guide.md, \"What a push publishes\")"
        fi
    # The identity asked of git (its messages are in the user's language), the dates emptied.
    elif ! GIT_AUTHOR_DATE='' GIT_COMMITTER_DATE='' git -c user.useConfigOnly=true var GIT_AUTHOR_IDENT >/dev/null 2>&1 \
        || ! GIT_AUTHOR_DATE='' GIT_COMMITTER_DATE='' git -c user.useConfigOnly=true var GIT_COMMITTER_IDENT >/dev/null 2>&1; then
        warn "no first commit ($(printf '%s\n' "$err" | grep -m 1 . || true)). Set user.name and user.email (mdb-guide.md, \"What a push publishes\"), then: git add -A && TZ=UTC git commit -m 'initial mdBook scaffold'"
    else
        warn "no first commit; git says:"
        printf '%s\n' "$err" | sed 's/^/    /' >&2
        echo "Fix what it says, then: git add -A && TZ=UTC git commit -m 'initial mdBook scaffold'" >&2
    fi
}

# First free port from $1 on 127.0.0.1 (where both servers bind), via /dev/tcp.
pick_port() {
    local port=$1
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
    local l
    for l in bin/ book/ .preview/; do
        grep -qxF "$l" .gitignore 2>/dev/null && continue
        # On a line of its own: a last line without its newline would take it.
        [ ! -s .gitignore ] || [ -z "$(tail -c 1 .gitignore)" ] || echo >> .gitignore
        echo "$l" >> .gitignore
    done
}

# FAVICON_TEXT -> the characters drawn: "auto", the title's first letter or digit; else up to 3.
favicon_mark() {
    local mark="" i c
    if [ "$FAVICON_TEXT" = "auto" ]; then
        for ((i = 0; i < ${#BOOK_TITLE}; i++)); do
            c="${BOOK_TITLE:i:1}"
            if [[ "$c" == [[:alnum:]] ]]; then
                mark="${c^^}"
                break
            fi
        done
        [ -n "$mark" ] || warn "FAVICON_TEXT is \"auto\" but BOOK_TITLE has no letter or digit: no favicon is drawn, and mdBook's own stays"
    else
        mark="${FAVICON_TEXT:0:3}"
        if [ "${#FAVICON_TEXT}" -gt 3 ]; then
            warn "FAVICON_TEXT is ${#FAVICON_TEXT} characters and a favicon is read at 16px; only \"${mark}\" is drawn"
        fi
    fi
    printf '%s' "$mark"
}

# Letters in the palette's ink, dark or light by the OS: the tab bar follows the OS, not the book.
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

# theme/ files replace mdBook's own; favicon.svg is never deleted, so a hand-made one survives.
write_theme() {
    # Cleared first, so a change of THEME or OFFLINE leaves nothing stale.
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
    # Before mdBook's script reads it: books on one github.io origin share localStorage.
    local head
    mkdir -p theme
    if [ "$THEME" = picker ]; then
        head="THEME \"picker\": clears a saved theme the button doesn't offer"
        cat > theme/head.hbs <<'EOF'
{{!-- Script-owned. Clears a saved theme the button doesn't offer: books on one github.io share it. --}}
<script>try{const t=localStorage.getItem('mdbook-theme');if(t!==null&&t!=='light'&&t!=='ayu')localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    else
        head="THEME \"$THEME\": clears a saved theme"
        cat > theme/head.hbs <<'EOF'
{{!-- Script-owned. Clears a saved theme: no button, and books on one github.io share it. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    fi
    if [ "$OFFLINE" = full ]; then
        head="$head; links the web app manifest"
        cat >> theme/head.hbs <<'EOF'
{{!-- Script-owned (OFFLINE="full"): the web app manifest offline.py writes. --}}
<link rel="manifest" href="{{ path_to_root }}manifest.webmanifest">
EOF
    fi
    say "wrote theme/head.hbs (${head})"
    mkdir -p theme/fonts
    cat > theme/fonts/fonts.css <<'EOF'
/* Script-owned. No faces: its presence stops mdBook shipping Open Sans and Source Code Pro. */
EOF
    say "wrote theme/fonts/fonts.css"
}

# All four Charter faces present: only then is @font-face written (else 404s).
charter_present() {
    local f
    for f in charter_regular charter_italic charter_bold charter_bold_italic; do
        [ -f "src/fonts/${f}.woff2" ] || return 1
    done
    return 0
}

# custom.css, always written: the reading theme and palette, and the look of what custom.js adds.
write_custom_css() {
    # The palette's selectors: the class in each is load-bearing (mdb-guide.md, "Light and dark").
    local dark_sel="html.light,html.ayu" print_sel="html.light,html.ayu" light
    [ "$THEME" != dark ] || { dark_sel="html.ayu"; print_sel="html.ayu"; }
    [ "$THEME" != picker ] || print_sel="html.light,html.ayu,html.js.light"
    : > custom.css
    mkdir -p src/fonts
    if [ "$THEME" != picker ]; then
        cat >> custom.css <<'EOF'
/* No theme button: theme/head.hbs clears a saved theme. */
#mdbook-theme-toggle { display: none; }
EOF
    else
        cat >> custom.css <<'EOF'
/* The theme menu's rows are buttons, which don't take the page's typeface. */
.theme-popup .theme { font-family: inherit; }
EOF
    fi
    if charter_present; then
        cat >> custom.css <<'EOF'

/* Self-hosted Charter; src/fonts/ is copied as is, not hashed. */
/* The files' Windows line metrics, for every system: the set others read has the descent's sign wrong, setting text 0.24em low. */
@font-face{font-family:"Charter";src:url("fonts/charter_regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_italic.woff2") format("woff2");font-weight:400;font-style:italic;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_bold.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_bold_italic.woff2") format("woff2");font-weight:700;font-style:italic;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
EOF
    else
        warn "src/fonts/ has no Charter woff2, so the fallback face renders: put the four from practicaltypography.com/charter.html in src/fonts/ and re-run."
        cat >> custom.css <<'EOF'

/* No @font-face: the Charter woff2 aren't in src/fonts/. */
EOF
    fi
    cat >> custom.css <<'EOF'

/* 1rem = 10px (mdBook's 62.5%). Everything tied to the bar reads --menu-bar-height. */
:root{
  --serif: "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;
  --content-max-width: 700px;
  --menu-bar-height: 60px;
  --mono-font: ui-monospace,"DejaVu Sans Mono","Liberation Mono",Menlo,Consolas,monospace;
}
html{font-family:var(--serif);}
.sidebar{font-size:1.6rem;}
.content{font-size:1.9rem;line-height:1.55;}

/* Headings: margins in em of each one's own size; H4 to H6 at text size, told apart by style. */
.content h1{font-size:3.4rem;line-height:1.18;margin:2.4rem 0;padding-bottom:1.3rem;border-bottom:1px solid var(--rule-strong);}
.content h2{font-size:2.5rem;line-height:1.18;margin:1.5em 0 .4em;}
.content h3{font-size:2.15rem;line-height:1.18;margin:1.18em 0 .29em;}
.content h4{font-size:1em;line-height:1.18;font-style:italic;margin:1.4em 0 .3em;}
.content h5{font-size:1em;line-height:1.18;font-style:italic;font-weight:normal;margin:1.3em 0 .3em;}
.content h6{font-size:1em;line-height:1.18;font-style:italic;font-weight:normal;color:var(--muted);margin:1.1em 0 .3em;}
.content h6 .header:is(:link,:visited){color:inherit;}

/* What follows a heading starts right under it; a heading after a heading keeps its space. */
.content main :is(h2,h3,h4,h5,h6) + :not(h2,h3,h4,h5,h6),.content main :is(h2,h3,h4,h5,h6) + :not(h2,h3,h4,h5,h6) > :first-child{margin-block-start:0;}

/* A --- straight after a heading, or its subtitle, underlines it. */
.content main :is(h2,h3,h4,h5,h6):has(+ hr),.content main :is(h2,h3,h4,h5,h6) + .mdb-subtitle:has(+ hr){margin-block-end:.3em;}
.content main :is(h2,h3,h4,h5,h6) + hr,.content main :is(h2,h3,h4,h5,h6) + .mdb-subtitle + hr{margin-block:0 1.6rem;}

/* Subtitle: <p class="mdb-subtitle"> straight under a heading. */
.content .mdb-subtitle{margin-block:0 0;font-size:1.9rem;font-style:italic;line-height:1.35;color:var(--muted);}
.content h2:has(+ .mdb-subtitle){margin-block-end:.25em;}

/* Title block: the H1 and its subtitle; one rule closes it, the Last updated line under it. */
.content h1:has(+ .mdb-subtitle){margin-block-end:.25em;padding-bottom:0;border-bottom:0;}
.content h1 + .mdb-subtitle{margin-block-end:2.4rem;padding-bottom:1.3rem;border-bottom:1px solid var(--rule-strong);}
.content h1:has(+ .mdb-updated),.content h1 + .mdb-subtitle:has(+ .mdb-updated){margin-block-end:0;}
.content .mdb-updated{margin-block-end:2.4rem;}

/* Blockquote, not admonitions (.blockquote-tag); edge margins zeroed so the rule sits flush. */
.content blockquote:not(.blockquote-tag){background:none;border-block:0;border-inline-start:3px solid var(--rule);padding:0 1em;color:var(--muted);}
.content blockquote:not(.blockquote-tag) > :first-child{margin-block-start:0;}
.content blockquote:not(.blockquote-tag) > :last-child{margin-block-end:0;}

/* Aside: a muted digression with a thin left rule. */
.content aside{font-size:.82em;color:var(--muted);border-inline-start:2px solid var(--rule);padding-inline-start:1em;margin:1.15rem 0;}

/* Footnotes, muted like the aside; mdBook draws the <hr> above them. */
.content .footnote-definition{font-size:.82em;color:var(--muted);}
/* Links in notes muted too: the underline marks them, not the colour. */
.content .footnote-definition a:link,.content .footnote-definition a:visited{color:var(--muted);}

/* Underlined links; an <a> with no href is text, on hover and in print too. Followed: --visited. */
.content a:any-link{text-decoration:underline;text-underline-offset:2px;}
.content a:not(:any-link){color:inherit;text-decoration:none;}
.content a:not(:any-link) > code.hljs{background-color:var(--inline-bg);color:var(--inline-code-color);box-shadow:inset 0 0 0 1px var(--inline-border);text-decoration:none;}
#mdbook-searchresults a{text-decoration:underline;text-underline-offset:2px;}
.content main a:visited{color:var(--visited);}
.content .footnote-reference a:visited{color:var(--links);}

/* A numbered list in a numbered list counts 1.1, 1.2.1; a restarted list (<ol start>) keeps its own. */
.content main ol{counter-reset:outline;}
.content main ol > li{counter-increment:outline;}
.content main ol ol > li{list-style:none;position:relative;}
.content main ol ol > li::before{content:counters(outline,".");position:absolute;inset-inline-end:100%;padding-inline-end:.25em;}
.content main ol[start] ol > li,.content main ol ol[start] > li{list-style:revert;}
.content main ol[start] ol > li::before,.content main ol ol[start] > li::before{content:none;}

/* Palette: every colour mdBook paints, the dark block first (mdb-guide.md, "Light and dark"). */
EOF
    cat >> custom.css <<EOF
${dark_sel}{
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
  --theme-popup-bg:#161613;--theme-popup-border:#676660;--theme-hover:#1b1b18;
}
EOF
    if [ "$THEME" != dark ]; then
        # "only light", not "light": Chrome's dark theme for sites then leaves a reader's Light alone.
        light=$(cat <<'EOF'
  --bg:#fdfcf7;--fg:#191713;--links:#191713;--visited:#295a8e;--inline-code-color:#9d4909;--inline-bg:#ece3cd;--inline-border:#e0d8c2;--muted:#57564e;
  --rule:#e5e3d7;--rule-strong:#c2bda4;--color-scheme:only light;
  --sidebar-bg:#f8f6ee;--sidebar-fg:#3a3a34;--sidebar-active:#9d4909;
  --sidebar-spacer:#c2bda4;--sidebar-non-existant:#a8a496;--sidebar-header-border-color:#c2bda4;
  --icons:#7d7a6e;--icons-hover:#191713;
  --copy-button-filter:opacity(.55);--copy-button-filter-hover:opacity(1);
  --quote-bg:#f4f2e8;--quote-border:#e5e3d7;--warning-border:#9d4909;--code-bg:#f4f2e8;--code-comment:#555;
  --table-border-color:#e5e3d7;--table-header-bg:#e0dccb;--table-alternate-bg:#faf8ee;
  --searchbar-bg:#fdfcf7;--searchbar-fg:#191713;--searchbar-border-color:#c2bda4;--searchbar-shadow-color:#c2bda4;
  --searchresults-border-color:#e5e3d7;--searchresults-header-fg:#57564e;--searchresults-li-bg:#f9f7ec;
  --search-mark-bg:#f2d9a8;--footnote-highlight:#f2d9a8;--overlay-bg:rgba(20,19,15,.6);
  --theme-popup-bg:#f8f6ee;--theme-popup-border:#c2bda4;--theme-hover:#e8e6d9;--scrollbar:var(--sidebar-fg);
EOF
)
        printf '@media (prefers-color-scheme: light){\nhtml.light{\n%s\n}\n}\n' "$light" >> custom.css
        [ "$THEME" != picker ] || printf 'html.js.light{\n%s\n}\n' "$light" >> custom.css
        # html.js.light: the light highlight sheet is live under either selector above.
        cat >> custom.css <<'EOF'
/* The light sheet's green strings and additions, a shade darker for 4.5:1 on the code ground. */
@media screen{
html.js.light pre > code.hljs :is(.hljs-string,.hljs-symbol,.hljs-bullet){color:#007f00;}
html.js.light pre > code.hljs .hljs-addition{color:#207d36;}
}
EOF
    fi
    cat >> custom.css <<EOF

/* Code-block ground from the palette (mdBook paints it from the highlight sheet). */
pre > code.hljs{background-color:var(--code-bg);}

/* Comments from the palette (ayu's are 2.7:1 here); !important, so print keeps it too. */
pre > code.hljs .hljs-comment,pre > code.hljs .hljs-quote{color:var(--code-comment) !important;}
/* Ayu's tag punctuation (< = >) too: 2:1 as it is. On screen: print has code in ink. */
@media screen{html.ayu pre > code.hljs .hljs-tag{color:var(--code-comment);}}

/* Inline code: a warm fill, accent text, and a hairline as an inset shadow (no metric change). */
:not(pre):not(a) > code.hljs{background-color:var(--inline-bg);color:var(--inline-code-color);box-shadow:inset 0 0 0 1px var(--inline-border);}

/* Marks in the palette's ink; a hit in code, marked before highlight.js runs, inherits the mark. */
mark{color:var(--fg);}
pre > code.hljs mark span{background-color:transparent;}
@media screen{pre > code.hljs mark :is(span,.hljs-comment){color:inherit !important;}}

/* Mobile chapter buttons sit on the page, so they take the quote ground. */
.mobile-nav-chapters{background-color:var(--quote-bg);}

/* Print: ink on paper, whatever the theme; the palette's selectors, or it never applies. */
@media print{
  ${print_sel}{
       --bg:#fff;--fg:#111;--links:#111;--visited:#111;--inline-code-color:#111;--inline-bg:#f5f5f5;--inline-border:#ddd;--muted:#444;
       --rule:#ccc;--rule-strong:#999;--quote-bg:#fff;--quote-border:#ccc;--code-bg:#f5f5f5;--code-comment:#555;
       --table-border-color:#ccc;--table-header-bg:#eee;--table-alternate-bg:#fff;
       --blockquote-note-color:#0969da;--blockquote-tip-color:#008000;--blockquote-important-color:#8250df;--blockquote-warning-color:#9a6700;--blockquote-caution-color:#b52731;
       --warning-border:#9a6700;--search-mark-bg:#f2d9a8;}
  a > code.hljs{background-color:var(--inline-bg);}
}
EOF

    # The rest: icon buttons, code in print, touch swipes, the columns' top gap, SUMMARY rules,
    # unlisted rows, .mdb-wide and .mdb-bleed (mdb-guide.md, "Wide pages and wide blocks").
    cat >> custom.css <<'EOF'
#mdbook-menu-bar .icon-button{font:inherit;line-height:var(--menu-bar-height);}
@media (any-pointer:coarse){html{overscroll-behavior-x:none;}}
@media print{pre > code.hljs{background-color:#f5f5f5;}pre > code.hljs,pre > code.hljs :is(span,mark){color:#111 !important;}pre > code.hljs :is(.hljs-comment,.hljs-quote) span{color:inherit !important;}pre > code.hljs mark{background-color:#f2d9a8;}pre > code.hljs mark span{background-color:transparent;}}

:root{--mdb-top-gap:2.4rem;}
.content main > :first-child{margin-block-start:var(--mdb-top-gap);}
.chapter{margin-block-start:0;}
.chapter > li:first-child{margin-block-start:0;}
.chapter > li.chapter-item:empty:first-child + li{margin-block-start:0;}
.chapter li.chapter-item:empty{margin-block:0;}
.chapter li.part-title{line-height:1.5em;margin-block:1.7em .55em;padding-block-end:.3em;border-block-end:1px solid var(--rule-strong);}
.chapter li.chapter-item:has(a[href^="unlisted/"],a[href*="/unlisted/"]){display:none;}

.content hr{border:0;height:1px;background-color:var(--rule-strong);margin:3.2rem 0;}
.chapter .spacer{height:1px;margin-block:1.6em;}

.sidebar .mdb-sitemeta{margin-top:1rem;padding:1rem 0 .5rem;border-top:1px solid var(--rule);font-size:1.3rem;line-height:1.5;color:var(--sidebar-fg);opacity:.8;}
.sidebar .mdb-sitemeta a{color:inherit;text-decoration:underline dotted;text-underline-offset:3px;}

/* The per-page Last updated line, hanging under the title block's rule. */
.content .mdb-updated{margin-block-start:1rem;font-size:.9em;font-style:italic;color:var(--muted);}

.mdb-print-back{margin:0 0 2rem;font-size:.85em;}
@media print{.mdb-print-back{display:none;}}

@media screen{
  .content main:has(.mdb-wide){max-width:1000px;}
  .content{container-type:inline-size;}
  .content main > .mdb-bleed{box-sizing:border-box;clear:both;max-width:none;width:min(1000px,100cqw);margin-inline:calc((100% - min(1000px,100cqw)) / 2);}
  :where(.content main > .mdb-bleed:not(table):not([hidden])){display:block;}
}
EOF
    if [ "$SIDEBAR_MASTHEAD" = none ]; then
        # No masthead: padding alone holds the first rows level.
        cat >> custom.css <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:calc(var(--menu-bar-height) + 1px + var(--mdb-top-gap));}
EOF
    else
        # Masthead band: sticky and opaque, with a hairline once the list scrolls under it.
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
            # src/logo.svg as a mask on a layer of its own: on the sticky plate it would clip it.
            [ -f src/logo.svg ] || warn "SIDEBAR_MASTHEAD is \"image\" but src/logo.svg is missing; the sidebar shows an empty band until you add it"
            cat >> custom.css <<'EOF'
.sidebar-scrollbox::before{content:"";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);}
html.js .sidebar::after{content:"";position:absolute;top:0;left:10px;right:10px;height:calc(var(--menu-bar-height) + 1px);pointer-events:none;background-color:var(--sidebar-fg);-webkit-mask:url("logo.svg") no-repeat left center/auto 50%;mask:url("logo.svg") no-repeat left center/auto 50%;}
EOF
        fi
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        # The gutter sits beside <code>, never in it, so the copy button copies the source exactly.
        cat >> custom.css <<'EOF'
pre:has(> .mdb-gutter){display:flex;align-items:stretch;}
pre > .mdb-gutter{flex:0 0 auto;-webkit-user-select:none;user-select:none;white-space:pre;text-align:right;font-family:var(--mono-font);font-size:var(--code-font-size);padding:1rem .8em 1rem 1rem;background-color:var(--code-bg);color:var(--muted);border-right:1px solid var(--rule);}
pre > .mdb-gutter + code.hljs{flex:1 1 auto;min-width:0;padding-left:1em;}
@media print{
  pre:has(> .mdb-gutter){display:block;}
  pre > .mdb-gutter{display:none;}
  pre > .mdb-gutter + code.hljs{padding-left:1rem;}
}
EOF
    fi
    if [ "$LAYOUT" != scroll ]; then
        cat >> custom.css <<'EOF'
/* LAYOUT: the sections not shown are hidden on screen only; the sidebar's mark is ours. */
@media screen{html.mdb-pages #mdbook-content main .mdb-off{display:none !important;}}
html.mdb-pages:not(.mdb-whole) .chapter a.current-header:not(.mdb-here):not(:hover){color:var(--sidebar-fg);}
html.mdb-pages .chapter a.mdb-here{color:var(--sidebar-active);}
.mdb-pageno{display:none;}
html.mdb-pages .mdb-pageno{display:block;margin:2.5rem 0 0;text-align:center;font-size:.85em;color:var(--muted);}
@media print{.mdb-pageno,#mdb-layout-toggle,.mdb-layout-menu{display:none !important;}}
.mdb-layout-menu{position:absolute;top:var(--menu-bar-height);z-index:1000;box-sizing:border-box;width:28rem;max-width:calc(100vw - 16px);margin:0;padding:.4rem 0;border-radius:4px;background:var(--theme-popup-bg);border:1px solid var(--theme-popup-border);}
.mdb-layout-menu[hidden]{display:none;}
.mdb-layout-item{position:relative;display:block;width:100%;margin:0;padding:.8rem 1.4rem .9rem;padding-inline-start:3.6rem;border:0;background:none;color:var(--fg);font:inherit;line-height:1.4;text-align:start;cursor:pointer;}
.mdb-layout-item:hover,.mdb-layout-item:focus-visible{background:var(--theme-hover);}
/* The tick in the text's colour, as mdBook's own theme menu draws it. */
.mdb-layout-item[aria-pressed="true"]::before{content:"\2713";content:"\2713" / "";position:absolute;inset-inline-start:1.3rem;top:.8rem;color:var(--fg);}
.mdb-layout-name{display:block;font-size:1.5rem;font-weight:bold;}
.mdb-layout-note{display:block;margin-top:.2rem;font-size:1.3rem;color:var(--muted);}
/* mdBook's » marks the heading an address leads to: in Pages, every section's own. */
html.mdb-pages #mdbook-content main > :is(h1,h2,h3,h4,h5,h6):target::before{content:none;}
EOF
    fi
    if [ "$OFFLINE" != none ]; then
        cat >> custom.css <<'EOF'
/* OFFLINE: the last button on the right, after print, and its panel; a dot on the button: a newer version is out. */
/* Its icon's 8px a side, as print's and the pencil's: mdBook's buttons have 8px more. */
#mdbook-menu-bar #mdb-offline-toggle{position:relative;padding:0;}
#mdb-offline-toggle.mdb-offline-wait{visibility:hidden;}
#mdb-offline-toggle.mdb-offline-new::after{content:"";position:absolute;top:calc(50% - 1.2rem);right:-5px;width:.8rem;height:.8rem;border-radius:50%;background:var(--sidebar-active);}
#mdb-offline-toggle.mdb-offline-busy svg{animation:mdb-offline-spin 1.6s linear infinite;}
@keyframes mdb-offline-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){#mdb-offline-toggle.mdb-offline-busy svg{animation:none;}}
.mdb-offline-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
.mdb-offline-panel{position:absolute;top:var(--menu-bar-height);right:10px;z-index:1000;box-sizing:border-box;width:36rem;max-width:calc(100vw - 20px);max-height:calc(100vh - var(--menu-bar-height) - 20px);max-height:calc(100dvh - var(--menu-bar-height) - 20px);overflow-y:auto;overscroll-behavior:contain;padding:0 1.6rem 1.6rem;border:1px solid var(--theme-popup-border);border-radius:4px;background:var(--theme-popup-bg);color:var(--fg);font-size:1.5rem;line-height:1.4;text-align:start;}
[dir=rtl] .mdb-offline-panel{right:auto;left:10px;}
.mdb-offline-panel[hidden]{display:none;}
.mdb-offline-panel p{margin:1rem 0 0;}
.mdb-offline-panel .mdb-offline-title{margin-top:1.2rem;font-weight:bold;}
.mdb-offline-panel .mdb-offline-note,.mdb-offline-panel .mdb-offline-sum{font-size:1.3rem;color:var(--muted);}
.mdb-offline-panel .mdb-offline-error{font-style:italic;}
.mdb-offline-panel a{color:inherit;text-decoration:underline;}
.mdb-offline-panel .mdb-offline-sum code{font-size:1.2rem;word-break:break-all;}
.mdb-offline-panel progress{display:block;width:100%;margin-top:1rem;accent-color:var(--sidebar-active);}
.mdb-offline-panel .mdb-offline-actions{display:flex;flex-wrap:wrap;gap:.8rem;margin-top:1.2rem;}
.mdb-offline-panel .mdb-offline-act{padding:.5rem 1.2rem;font:inherit;color:var(--fg);background:var(--theme-hover);border:1px solid var(--theme-popup-border);border-radius:4px;cursor:pointer;}
.mdb-offline-panel .mdb-offline-act:disabled{opacity:.5;cursor:default;}
/* Save, Update and the download: a big button each, what it's for under it. */
.mdb-offline-panel .mdb-offline-big{display:block;box-sizing:border-box;width:100%;margin-top:1.4rem;padding:1rem 1.2rem;border:1px solid var(--theme-popup-border);border-radius:6px;background:var(--inline-bg);color:var(--fg);font:inherit;font-size:1.6rem;font-weight:bold;line-height:1.3;text-align:center;text-decoration:none;cursor:pointer;}
.mdb-offline-panel .mdb-offline-big:is(:hover,:focus-visible):not(:disabled){border-color:var(--sidebar-active);}
.mdb-offline-panel .mdb-offline-big:disabled{opacity:.5;cursor:default;}
.mdb-offline-panel .mdb-offline-what{margin-top:.6rem;}
.mdb-offline-panel .mdb-offline-what + .mdb-offline-note{margin-top:.2rem;}
/* The download under saving, a rule between them. */
.mdb-offline-panel .mdb-offline-sep{margin-top:1.6rem;border-top:1px solid var(--theme-popup-border);}
/* A saved copy behind the site: the line above the page's text, outside <main>. */
.mdb-stale{box-sizing:border-box;max-width:var(--content-max-width);margin:var(--mdb-top-gap) auto 0;padding:.8rem 1.2rem;border-inline-start:3px solid var(--sidebar-active);background:var(--quote-bg);font-size:1.6rem;line-height:1.45;}
@media print{#mdb-offline-toggle,.mdb-offline-panel,.mdb-stale{display:none;}}
EOF
    fi
    say "wrote custom.css"
}

# custom.js, always written: the sidebar's key and swipes, links, print, the footer and dates.
write_custom_js() {
    cat > custom.js <<EOF
// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy stamp is in version.js.
var MDB_REPO = "$(esc_dq "$GIT_REPO_URL")";
EOF
    [ "$OFFLINE" = none ] || echo "var MDB_OFFLINE = \"${OFFLINE}\";" >> custom.js
    cat >> custom.js <<'EOF'
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // mdBook's print.html, at the book's root (a print.md in a folder is a page like any other).
  var isPrint = function () {
    return /(^|\/)print\.html$/.test(location.pathname) &&
      (typeof path_to_root !== "string" || path_to_root === "");
  };

  // A stamped value: non-empty and no longer a placeholder.
  var stamped = function (v) {
    return typeof v === "string" && v !== "" && v.indexOf("__MDB_") !== 0;
  };

  // Relative time by local calendar day ("just now", "yesterday", then the date); exact on hover.
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

  // Swipes, through the sidebar's checkbox: mdBook 0.5.4's set a class and move nothing.
  (function () {
    var box = document.getElementById("mdbook-sidebar-toggle-anchor");
    var bar = document.getElementById("mdbook-sidebar");
    if (!box || !bar) return;
    var set = function (on) {
      if (box.checked === on) return;
      // As mdBook's own toggle does: back on screen first, so it slides in.
      if (on) { bar.style.display = ""; void bar.offsetHeight; }
      box.checked = on;
      box.dispatchEvent(new Event("change"));
    };
    var start = null;
    document.addEventListener("touchstart", function (e) {
      var t = e.target;
      start = e.touches.length === 1 && !(t.closest && t.closest("pre, table, .table-wrapper, input, select, textarea, .theme-popup, .checkbox-img:checked ~ .img-wrapper, #mdbook-help-container, .mdb-menu")) ?
        { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() } : null;
    }, { passive: true });
    document.addEventListener("touchmove", function (e) {
      if (start) {
        var x = e.touches[0].clientX, dx = x - start.x, dy = e.touches[0].clientY - start.y;
        if (Date.now() - start.time < 250 && Math.abs(dx) >= 150) {
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx >= 0 && start.x < Math.min(document.body.clientWidth * 0.25, 300)) set(true);
            else if (dx < 0 && x < 300) set(false);
          }
          start = null;
        }
      }
      // mdBook's handler took the gestures this one passes over: keep its state in step.
      if (document.documentElement.classList.contains("sidebar-visible") !== box.checked)
        box.dispatchEvent(new Event("change"));
    }, { passive: true });
  })();

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

  // The pencil in front of print, so print and the offline button, last, go together; a space apart, as mdBook's.
  ready(function () {
    var right = document.querySelector("#mdbook-menu-bar .right-buttons");
    var print = right && right.querySelector('a[href$="print.html"]'), edit = right && right.querySelector('a[rel="edit"]');
    if (!print || !edit) return;
    right.insertBefore(edit, print);
    right.insertBefore(document.createTextNode(" "), print);
  });

  // Remove (not hide) prev/next links into src/unlisted/: book.js follows a hidden one too.
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

  // The sidebar footer; each part only if stamped (version.js).
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var version = window.MDB_VERSION, updated = window.MDB_UPDATED, sha = window.MDB_SHA;
    var parts = [];
    if (stamped(version)) parts.push(document.createTextNode(version));
    if (stamped(updated)) {
      // Relative, exact on hover; an unparseable stamp shows as it is.
      var u = document.createElement("span");
      u.appendChild(document.createTextNode("updated "));
      var w = mdbWhen(updated);
      if (w) u.appendChild(w);
      else u.appendChild(document.createTextNode(updated));
      parts.push(u);
    }
    if (stamped(sha)) {
      if (MDB_REPO) {
        var s = document.createElement("a");
        s.href = MDB_REPO + "/commit/" + encodeURIComponent(sha);
        s.textContent = sha;
        parts.push(s);
      } else {
        parts.push(document.createTextNode(sha));
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

  // "Last updated <when>" under the H1: the source from the edit link, else from the URL.
  ready(function () {
    var MDB_PAGE_DATES = window.MDB_PAGE_DATES;
    if (typeof MDB_PAGE_DATES !== "object" || !MDB_PAGE_DATES) return;
    if (isPrint()) return;
    var main = document.querySelector("#mdbook-content main");
    if (!main) return;
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
        var cand = "src/" + rel.replace(/\.html$/, "") + ".md";
        if (MDB_PAGE_DATES[cand]) src = cand;
      }
    }
    var iso = src ? MDB_PAGE_DATES[src] : "";
    if (!iso) return;
    var w = mdbWhen(iso);
    if (!w) return;
    var head = main.querySelector("h1");
    if (!head) return;
    var after = head;
    var sib = head.nextElementSibling;
    if (sib && sib.classList && sib.classList.contains("mdb-subtitle")) after = sib;
    var p = document.createElement("p");
    p.className = "mdb-updated";
    p.appendChild(document.createTextNode("Last updated "));
    p.appendChild(w);
    after.parentNode.insertBefore(p, after.nextSibling);
  });

  // print.html: a back link, and back to the page you came from when the print dialog closes.
  (function () {
    if (!isPrint()) return;

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
    if [ "$THEME" = picker ]; then
        cat >> custom.js <<'EOF'

// THEME "picker": the theme menu trimmed to Auto, Light and Dark; rows removed, not hidden.
(function () {
  function trim() {
    var list = document.getElementById("mdbook-theme-list");
    if (!list) return;
    ["rust", "coal", "navy"].forEach(function (name) {
      var b = document.getElementById("mdbook-theme-" + name);
      if (b && b.parentNode && b.parentNode.parentNode === list) b.parentNode.remove();
    });
    var dark = document.getElementById("mdbook-theme-ayu");
    if (dark) dark.textContent = "Dark";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", trim);
  else trim();
})();
EOF
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        cat >> custom.js <<'EOF'

// Line numbers in a gutter beside <code>: language-fenced blocks of MIN_LINES or more.
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

// Code that overflows sideways takes tabindex="0", so the keyboard reaches it.
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
  // Re-checked on resize, debounced: a sidebar toggle fires no window resize.
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
  // While a code block has focus, Left and Right scroll it instead of turning the page.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();
EOF
    if [ "$LAYOUT" != scroll ]; then
        printf '\nvar MDB_LAYOUT = "%s";\n' "$LAYOUT" >> custom.js
        cat >> custom.js <<'EOF'
// LAYOUT (MDB_LAYOUT, above): a chapter one heading's section at a time; print has them all.
// Icons: from Font Awesome Free, the set mdBook draws its own from, with its
// notice: Font Awesome Free 6.2.0 by @fontawesome - https://fontawesome.com
// License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL
// OFL 1.1, Code: MIT License) Copyright 2022 Fonticons, Inc.
(function () {
  "use strict";
  // Not mdBook's print.html, at the book's root.
  if (/(^|\/)print\.html$/.test(location.pathname) && (typeof path_to_root !== "string" || path_to_root === "")) return;
  var main = document.querySelector("#mdbook-content main");
  var bar = document.getElementById("mdbook-menu-bar");
  if (!main || !bar) return;
  var content = document.getElementById("mdbook-content");
  // The book's own folder (on the 404 page, its <base>): books on one github.io share an origin.
  var root = new URL((typeof path_to_root === "string" ? path_to_root : "") + "./", document.baseURI).pathname;
  var KEY = "mdb-layout " + root;
  var PICK = MDB_LAYOUT === "picker";
  // The headings a section starts at.
  var STARTS = MDB_LAYOUT === "h2" ? /^H2$/ : /^H[2-6]$/;
  // An address on this page: a bare "#x" resolves against the 404 page's <base>.
  var addr = function (id) { return location.pathname + location.search + (id ? "#" + id : ""); };
  // Read once; without the picker, always Pages.
  var now = null;
  if (PICK) try { now = localStorage.getItem(KEY); } catch (e) {}
  now = !PICK || now === "pages" ? "pages" : "scroll";
  var mode = function () { return now; };
  // What needs no section of its own: the title block, and what applies to the whole chapter.
  var TITLE = "h1, .mdb-subtitle, .mdb-updated, .mdb-wide, hr, style, script, link";
  // An empty anchor (<a id="old-name"></a>, or a <span> or <div>), alone or in a paragraph.
  var EMPTY = "a[id]:empty, a[name]:empty, span[id]:empty, div[id]:empty";
  var anchor = function (n) {
    if (n.matches(EMPTY)) return true;
    return n.tagName === "P" && n.children.length > 0 && !n.textContent.trim() &&
      Array.prototype.every.call(n.children, function (c) { return c.matches(EMPTY); });
  };
  // The sections, worked out afresh each time, so lines other code adds land in the right one.
  var split = function () {
    // Text straight in <main>, or a search <mark> in it, into a <span>: it goes with its section.
    Array.prototype.slice.call(main.childNodes).forEach(function (n) {
      if (n.nodeType === 3 ? /[^ \t\n\r\f]/.test(n.nodeValue) : n.nodeName === "MARK") { var w = document.createElement("span"); main.insertBefore(w, n); w.appendChild(n); }
    });
    var pages = [[]], foot = null, rule = null;
    Array.prototype.forEach.call(main.children, function (n) {
      if (n.matches("ol.footnote-definition")) { foot = n; return; }
      if (n.matches("hr") && n.nextElementSibling && n.nextElementSibling.matches("ol.footnote-definition")) { rule = n; return; }
      if (n.matches(".mdb-pageno")) return;
      if (STARTS.test(n.tagName) && n.id) {
        var prev = pages[pages.length - 1], lead = [];
        while (prev.length && anchor(prev[prev.length - 1])) lead.unshift(prev.pop());
        pages.push(lead);
      }
      pages[pages.length - 1].push(n);
    });
    if (pages.length > 1 && !pages[0].some(function (n) { return !n.matches(TITLE) && !anchor(n); }))
      pages.splice(0, 2, pages[0].concat(pages[1]));
    return { pages: pages, foot: foot, rule: rule };
  };
  var cur = 0, here = null;
  var base = document.title;
  // A section's address: its heading's (the H1 for the first).
  var idOf = function (s, k) {
    for (var i = 0; i < s.pages[k].length; i++) {
      var n = s.pages[k][i];
      if (/^H[1-6]$/.test(n.tagName) && n.id) return n.id;
    }
    return "";
  };
  var counter = document.createElement("p");
  counter.className = "mdb-pageno";
  counter.setAttribute("aria-live", "polite");

  // The arrows turn sections, then chapters; ours stand in where mdBook drew none, removed when unneeded.
  var arrowSel = function (dir) { return ".nav-chapters." + dir + ", .mobile-nav-chapters." + dir; };
  var ns = "http://www.w3.org/2000/svg";
  var svgIcon = function (box, d) {
    var span = document.createElement("span"), svg = document.createElementNS(ns, "svg"), path = document.createElementNS(ns, "path");
    span.className = "fa-svg";
    svg.setAttribute("viewBox", box);
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", d);
    svg.appendChild(path);
    span.appendChild(svg);
    return span;
  };
  var ANGLE = {
    left: "M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z",
    right: "M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"
  };
  // Pointing out, as mdBook's own: in a right-to-left book the previous arrow is on the right.
  var rtl = document.documentElement.dir === "rtl";
  var made = [];
  var ensureArrows = function () {
    [[".nav-wide-wrapper", "nav-chapters"], [".nav-wrapper", "mobile-nav-chapters"]].forEach(function (w) {
      var box = document.querySelector(w[0]);
      if (!box) return;
      ["previous", "next"].forEach(function (dir) {
        if (box.querySelector("." + w[1] + "." + dir)) return;
        var a = document.createElement("a");
        a.className = w[1] + " " + dir + " mdb-made";
        a.setAttribute("rel", dir === "next" ? "next" : "prev");
        a.setAttribute("aria-keyshortcuts", (dir === "next") !== rtl ? "Right" : "Left");
        a.setAttribute("data-mdb-href", "");
        a.appendChild(svgIcon("0 0 320 512", ANGLE[(dir === "next") !== rtl ? "right" : "left"]));
        made.push({ a: a, box: box, dir: dir });
      });
    });
  };
  var arrows = function (s) {
    var n = s.pages.length, paged = mode() === "pages";
    made.forEach(function (m) {
      var want = paged && (m.dir === "next" ? cur < n - 1 : cur > 0);
      if (want && !m.a.parentNode)
        // previous before anything, next before the clearing <div> (or last)
        m.box.insertBefore(m.a, m.dir === "previous" ? m.box.querySelector(":scope > a, :scope > div") : m.box.querySelector(":scope > div"));
      else if (!want && m.a.parentNode) m.a.parentNode.removeChild(m.a);
    });
    ["next", "previous"].forEach(function (dir) {
      document.querySelectorAll(arrowSel(dir)).forEach(function (a) {
        if (!a.hasAttribute("data-mdb-href")) a.setAttribute("data-mdb-href", a.getAttribute("href") || "");
        var orig = a.getAttribute("data-mdb-href");
        var within = dir === "next" ? cur < n - 1 : cur > 0;
        // A first section without a heading: #mdb-first, an address go() drops.
        if (paged && within) a.setAttribute("href", "#" + (idOf(s, dir === "next" ? cur + 1 : cur - 1) || "mdb-first"));
        else if (paged && orig && dir === "previous") a.setAttribute("href", orig + "#mdb-last");
        else if (orig) a.setAttribute("href", orig);
        else a.removeAttribute("href");
        a.hidden = !a.getAttribute("href");
        a.title = paged && within ? (dir === "next" ? "Next section" : "Previous section") : (dir === "next" ? "Next chapter" : "Previous chapter");
        a.setAttribute("aria-label", a.title);
      });
    });
  };

  // The sidebar's mark: in Pages, the section's, put back after each scroll.
  var mark = function () {
    var ours = null;
    document.querySelectorAll("#mdbook-sidebar a.header-in-summary").forEach(function (a) {
      var on = !!here && a.getAttribute("href") === "#" + here;
      a.classList.toggle("mdb-here", on);
      if (on) ours = a;
    });
    // mdBook opens the folds above the heading it marks: in Pages, those above ours.
    if (mode() === "pages" && !document.documentElement.classList.contains("mdb-whole")) document.querySelectorAll("#mdbook-sidebar li.header-item").forEach(function (li) {
      if (li.querySelector(":scope > span > .header-toggle")) li.classList.toggle("expanded", !!ours && li.contains(ours));
    });
  };
  // mdBook marks its own two frames after a click on its heading links: ours goes back after.
  document.addEventListener("click", function (e) {
    if (mode() === "pages" && e.target.closest && e.target.closest("#mdbook-sidebar a.header-in-summary"))
      requestAnimationFrame(function () { requestAnimationFrame(function () { requestAnimationFrame(mark); }); });
  });

  // The notes section k cites, and those the notes cite in turn.
  var notesOf = function (s, k) {
    var cited = {}, grew = true;
    var add = function (n) {
      n.querySelectorAll("sup.footnote-reference a[href^='#']").forEach(function (a) {
        var id = a.getAttribute("href").slice(1);
        if (!cited[id]) cited[id] = grew = true;
      });
    };
    s.pages[k].forEach(add);
    while (grew) {
      grew = false;
      Array.prototype.forEach.call(s.foot.children, function (li) { if (cited[li.id] === true) { cited[li.id] = 1; add(li); } });
    }
    return cited;
  };

  var show = function (k) {
    var s = split();
    var was = cur;
    cur = Math.max(0, Math.min(k, s.pages.length - 1));
    var paged = mode() === "pages";
    // A zoomed image goes with its section, as Escape would.
    if (paged && cur !== was)
      document.querySelectorAll("input.checkbox-img:checked").forEach(function (c) { c.checked = false; });
    // A section opens at its start, not scrolled sideways: go() scrolls to a place a link names.
    if (paged && cur !== was) content.scrollLeft = 0;
    s.pages.forEach(function (p, i) {
      p.forEach(function (n, j) {
        // A --- that ended a section went with the boundary.
        n.classList.toggle("mdb-off", paged && (i !== cur || (n.tagName === "HR" && j === p.length - 1)));
      });
    });
    if (s.foot) {
      // Only the notes this section cites.
      var cited = notesOf(s, cur), any = false;
      Array.prototype.forEach.call(s.foot.children, function (li) {
        var on = !paged || !!cited[li.id];
        li.classList.toggle("mdb-off", !on);
        any = any || on;
      });
      s.foot.classList.toggle("mdb-off", !any);
      if (s.rule) s.rule.classList.toggle("mdb-off", !any);
    }
    if (paged && s.pages.length > 1) {
      // Changed only when it differs, or a screen reader reads the counter twice.
      var text = "Section " + (cur + 1) + " of " + s.pages.length;
      if (counter.textContent !== text) counter.textContent = text;
      if (main.lastElementChild !== counter) main.appendChild(counter);
      var h = document.getElementById(idOf(s, cur));
      var t = h ? h.textContent.replace(/\s+/g, " ").trim() : "";
      document.title = t && cur > 0 ? t + " - " + base : base;
    } else {
      if (counter.parentNode) counter.parentNode.removeChild(counter);
      document.title = base;
    }
    arrows(s);
    // The section's mark: the heading it starts at; a chapter of one section keeps mdBook's.
    here = null;
    if (paged && s.pages.length > 1) s.pages[cur].some(function (n) { if (STARTS.test(n.tagName) && n.id) here = n.id; return !!here; });
    document.documentElement.classList.toggle("mdb-whole", s.pages.length < 2);
    mark();
  };

  // The element #x names: its id, else the first <a name="x">.
  var byId = function (id) {
    if (!id) return null;
    var el = document.getElementById(id), named = el ? [] : document.getElementsByName(id);
    for (var i = 0; !el && i < named.length; i++) if (named[i].tagName === "A") el = named[i];
    return el;
  };
  // The section an address leads to; for a note, the first section citing it.
  var pageOf = function (id) {
    var s = split();
    if (id === "mdb-last") return s.pages.length - 1;
    if (id === "mdb-first") return 0;
    var el = byId(id);
    if (!el || !main.contains(el)) return null;
    if (s.foot && s.foot.contains(el)) {
      var note = el.closest("ol.footnote-definition > li") || el;
      var cites = function (i) { return !!notesOf(s, i)[note.id]; };
      if (cites(cur)) return cur;
      for (var i = 0; i < s.pages.length; i++) if (cites(i)) return i;
      return null;
    }
    for (var j = 0; j < s.pages.length; j++)
      if (s.pages[j].some(function (n) { return n === el || n.contains(el); })) return j;
    return null;
  };
  var go = function (scroll, load) {
    // As the browser finds it: the #address as written, else decoded.
    var id = location.hash.slice(1);
    if (!byId(id)) try { id = decodeURIComponent(id); } catch (e) {}
    var k = pageOf(id), el = byId(id);
    // A search result's address is the H1-H3 above the match: on to the section with the mark.
    if (load && k !== null && mode() === "pages" && /[?&]highlight=/.test(location.search)) {
      // A match is mark.js's <mark data-markjs>, not one the author wrote.
      var s = split(), to = null, mk = null, last = true, HIT = "mark[data-markjs]";
      for (var i = k; to === null && i < s.pages.length; i++) {
        var hd = i > k ? document.getElementById(idOf(s, i)) : null;
        if (hd && +hd.tagName.charAt(1) <= 3) { last = false; break; }
        s.pages[i].some(function (n) { mk = n.matches(HIT) ? n : n.querySelector(HIT); return !!mk; });
        if (mk) to = i;
      }
      // A match only in the notes: the first section citing a marked note.
      var hits = to === null && last && s.foot ? Array.prototype.filter.call(s.foot.children, function (li) { return li.querySelector(HIT); }) : [];
      if (hits.length && !hits.some(function (li) { return notesOf(s, k)[li.id]; })) { mk = hits[0].querySelector(HIT); to = pageOf(hits[0].id); }
      // The address follows, for the arrows and Back.
      if (to !== null && to !== k) { k = to; el = mk; history.replaceState(history.state, "", addr(idOf(s, to))); }
    }
    show(k === null ? (id ? cur : 0) : k);
    if (id === "mdb-last" || id === "mdb-first") {
      // The section's own address; none for one without a heading.
      history.replaceState(history.state, "", addr(idOf(split(), cur)));
    } else if (!scroll || mode() !== "pages") return;
    // A search match to the middle of the window (no scroll-margin keeps it clear of the bar).
    var at = el && el.offsetParent !== null && el !== document.getElementById(idOf(split(), cur)) ? el : null;
    var place = function () {
      if (!at) window.scrollTo(0, 0);
      else if (at.matches("mark[data-markjs]")) at.scrollIntoView({ block: "center" });
      else at.scrollIntoView();
    };
    place();
    // Loaded with an address, place() again once the page has loaded, unless the reader moved.
    var shown = cur, nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    if (load && (!nav || nav.type === "navigate")) {
      var moved = false, stir = function () { moved = true; }, ON = ["wheel", "touchstart", "mousedown", "keydown", "hashchange"];
      ON.forEach(function (t) { window.addEventListener(t, stir, true); });
      window.addEventListener("load", function () {
        setTimeout(function () {
          ON.forEach(function (t) { window.removeEventListener(t, stir, true); });
          var r = (at || document.getElementById(idOf(split(), cur)) || main).getBoundingClientRect(), b = bar.getBoundingClientRect().bottom;
          if (!moved && cur === shown && mode() === "pages" && (at ? r.bottom <= b || r.top >= innerHeight : r.top > -2 && scrollY > 0)) place();
        }, 0);
      });
    }
  };
  window.addEventListener("hashchange", function (e) {
    // mdBook's search takes the #address off a ?search= page: put it back.
    var h = e.newURL ? new URL(e.newURL).hash : "";
    if (mode() === "pages" && h && !location.hash && /[?&]search=/.test(location.search)) history.replaceState(history.state, "", addr(h.slice(1)));
    go(true, false);
  });
  // Back and Forward between entries that differ in more than the #address fire popstate alone.
  window.addEventListener("popstate", function () {
    if (mode() === "pages" && !/[?&]search=/.test(location.search)) go(true, false);
  });

  // mdBook's search icon leaves ?search=, which reopens the bar at the next turn: drop it.
  var swrap = document.getElementById("mdbook-search-wrapper"), sbtn = document.getElementById("mdbook-search-toggle");
  var unsearch = function () {
    if (mode() !== "pages" || !swrap || !swrap.classList.contains("hidden") || !/[?&]search=/.test(location.search)) return;
    var to = idOf(split(), cur);
    history.replaceState(history.state, "", location.pathname + (to ? "#" + to : ""));
  };
  if (sbtn) sbtn.addEventListener("click", unsearch);
  // Escape: mdBook's handler drops ?search= and the #address with it; put the address back.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || mode() !== "pages" || location.hash) return;
    var to = idOf(split(), cur);
    if (to) history.replaceState(history.state, "", addr(to));
  });

  // The picker: a button beside search, opening two choices below it.
  var setMode = function (v) {
    // The choice already in use: nothing to do.
    if (v === now) return;
    var keep = null;
    if (v === "pages") {
      // Into Pages at the section at the top of the window.
      var s = split(), at = 0;
      if (window.scrollY > 10) s.pages.forEach(function (p, i) {
        if (p[0] && p[0].getBoundingClientRect().top <= 120) at = i;
      });
      cur = at;
    } else {
      keep = document.getElementById(idOf(split(), cur));
    }
    now = v;
    try { localStorage.setItem(KEY, v); } catch (e) {}
    document.documentElement.classList.toggle("mdb-pages", v === "pages");
    show(cur);
    if (v === "pages") {
      // A chapter of one section is shown whole, as in Scroll: left as it is.
      var whole = split().pages.length < 2, to = idOf(split(), cur);
      if (to && !whole) history.replaceState(history.state, "", addr(to));
      unsearch();
      if (!whole) window.scrollTo(0, 0);
    } else if (keep && cur > 0) {
      keep.scrollIntoView();
    }
    // mdBook marks the heading in view at a scroll: give it one.
    if (v === "scroll") document.dispatchEvent(new Event("scroll"));
    fill();
  };
  var left = bar.querySelector(".left-buttons");
  var btn = document.createElement("button"), menu = document.createElement("div");
  var CHOICES = [["scroll", "Scroll", "The whole chapter on one page."],
                 ["pages", "Pages", "One section at a time: the arrows turn them."]];
  var fill = function () {
    var m = mode();
    menu.textContent = "";
    CHOICES.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mdb-layout-item";
      b.setAttribute("aria-pressed", m === o[0] ? "true" : "false");
      var t = document.createElement("span");
      t.className = "mdb-layout-name";
      t.textContent = o[1];
      var d = document.createElement("span");
      d.className = "mdb-layout-note";
      d.textContent = o[2];
      b.appendChild(t);
      b.appendChild(d);
      b.addEventListener("click", function (e) { e.stopPropagation(); setMode(o[0]); open(false); btn.focus(); });
      menu.appendChild(b);
    });
  };
  var open = function (on) {
    menu.hidden = !on;
    btn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) {
      var r = btn.getBoundingClientRect(), br = bar.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(r.left - br.left, br.width - menu.offsetWidth - 8)) + "px";
    }
  };
  if (PICK && left) {
    btn.type = "button";
    btn.id = "mdb-layout-toggle";
    btn.className = "icon-button";
    btn.title = "Layout: scroll or pages";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "mdb-layout-menu");
    // Font Awesome's book-open, as mdBook draws <i class="fas fa-book-open">.
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), path = document.createElementNS(ns, "path");
    svg.setAttribute("viewBox", "0 0 576 512");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", "M249.6 471.5c10.8 3.8 22.4-4.1 22.4-15.5V78.6c0-4.2-1.6-8.4-5-11C247.4 52 202.4 32 144 32C87.5 32 35.1 48.6 9 59.9c-5.6 2.4-9 8-9 14V454.1c0 11.9 12.8 20.2 24.1 16.5C55.6 460.1 105.5 448 144 448c33.9 0 79 14 105.6 23.5zm76.8 0C353 462 398.1 448 432 448c38.5 0 88.4 12.1 119.9 22.6c11.3 3.8 24.1-4.6 24.1-16.5V73.9c0-6.1-3.4-11.6-9-14C540.9 48.6 488.5 32 432 32c-58.4 0-103.4 20-123 35.6c-3.3 2.6-5 6.8-5 11V456c0 11.4 11.7 19.3 22.4 15.5z");
    svg.appendChild(path);
    var icon = document.createElement("span");
    icon.className = "fa-svg";
    icon.appendChild(svg);
    btn.appendChild(icon);
    menu.id = "mdb-layout-menu";
    // mdb-menu: the sidebar's swipes leave it alone.
    menu.className = "mdb-layout-menu mdb-menu";
    menu.setAttribute("role", "group");
    menu.setAttribute("aria-label", "Layout");
    menu.hidden = true;
    var search = left.querySelector("#mdbook-search-toggle");
    left.insertBefore(btn, search ? search.nextSibling : null);
    // Next to its button, so Tab goes from one to the other.
    left.insertBefore(menu, btn.nextSibling);
    fill();
    // The click goes on to the document, where the other menus close.
    btn.addEventListener("click", function (e) {
      open(menu.hidden);
      // Opened from the keyboard: into the choices, on the one in use.
      if (e.detail === 0 && !menu.hidden) (menu.querySelector('[aria-pressed="true"]') || menu.firstChild).focus();
    });
    // Left and right stay in the choices: mdBook turns the page on them.
    menu.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopPropagation();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var items = Array.prototype.slice.call(menu.children), i = items.indexOf(document.activeElement);
        items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus();
      }
    });
    menu.addEventListener("focusout", function (e) {
      var to = e.relatedTarget;
      if (to && !menu.contains(to) && to !== btn) open(false);
    });
    document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { open(false); btn.focus(); } });
    // Placed again when the window changes width (a phone turned) while open.
    window.addEventListener("resize", function () { if (!menu.hidden) open(true); });
  }

  // Back from the browser's cache: the reader may have switched layout on a later page.
  if (PICK) window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    // After WebKit puts the scroll position back, at the first frame after this event.
    requestAnimationFrame(function () { setTimeout(function () {
      var v = null;
      try { v = localStorage.getItem(KEY); } catch (err) {}
      setMode(v === "pages" ? "pages" : "scroll");
    }, 0); });
  });

  window.addEventListener("scroll", mark, { passive: true });
  document.documentElement.classList.toggle("mdb-pages", mode() === "pages");
  var ready = function (fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); };
  ready(function () {
    ensureArrows();
    // mdBook's '?' popup: what the arrow keys do in Pages.
    var help = document.querySelector("#mdbook-help-popup > div");
    if (help) {
      var p = document.createElement("p"), l = document.createElement("kbd"), r = document.createElement("kbd");
      l.textContent = "←"; r.textContent = "→";
      p.appendChild(document.createTextNode(PICK ? "In Pages, " : ""));
      p.appendChild(l); p.appendChild(document.createTextNode(" and ")); p.appendChild(r);
      p.appendChild(document.createTextNode(" turn the section first"));
      help.appendChild(p);
    }
    go(!!location.hash, true);
  });
})();
EOF
    fi
    if [ "$OFFLINE" != none ]; then
        cat >> custom.js <<'EOF'

// OFFLINE: the last button on the right, after print: save in the browser ("full"; sw.js serves it), or download.
// Icons: from Font Awesome Free, the set mdBook draws its own from, with its
// notice: Font Awesome Free 6.2.0 by @fontawesome - https://fontawesome.com
// License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL
// OFL 1.1, Code: MIT License) Copyright 2022 Fonticons, Inc.
(function () {
  "use strict";
  var MODE = typeof MDB_OFFLINE === "string" ? MDB_OFFLINE : "none";
  var COPY = typeof MDB_COPY === "object" && MDB_COPY ? MDB_COPY : null;
  // The book's address: document.baseURI, since the 404 page sets <base>.
  var ROOT = new URL(typeof path_to_root === "string" && path_to_root ? path_to_root : "./", document.baseURI).href;
  // Stored copies are named by the book's path: github.io sites share an origin.
  var PREFIX = "mdb-offline " + new URL(ROOT).pathname + " ";
  var META = PREFIX + "meta";
  var CURRENT = ROOT + "__mdb-offline/current";
  var LIST = ROOT + "__mdb-offline/files-";
  var ICONS = {
    save: ["0 0 640 512", "M144 480C64.5 480 0 415.5 0 336c0-62.8 40.2-116.2 96.2-135.9c-.1-2.7-.2-5.4-.2-8.1c0-88.4 71.6-160 160-160c59.3 0 111 32.2 138.7 80.2C409.9 102 428.3 96 448 96c53 0 96 43 96 96c0 12.2-2.3 23.8-6.4 34.6C596 238.4 640 290.1 640 352c0 70.7-57.3 128-128 128H144zm79-167l80 80c9.4 9.4 24.6 9.4 33.9 0l80-80c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-39 39V184c0-13.3-10.7-24-24-24s-24 10.7-24 24V318.1l-39-39c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9z"],
    busy: ["0 0 512 512", "M304 48c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zm0 416c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zM48 304c26.5 0 48-21.5 48-48s-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48zm464-48c0-26.5-21.5-48-48-48s-48 21.5-48 48s21.5 48 48 48s48-21.5 48-48zM142.9 437c18.7-18.7 18.7-49.1 0-67.9s-49.1-18.7-67.9 0s-18.7 49.1 0 67.9s49.1 18.7 67.9 0zm0-294.2c18.7-18.7 18.7-49.1 0-67.9S93.7 56.2 75 75s-18.7 49.1 0 67.9s49.1 18.7 67.9 0zM369.1 437c18.7 18.7 49.1 18.7 67.9 0s18.7-49.1 0-67.9s-49.1-18.7-67.9 0s-18.7 49.1 0 67.9z"],
    saved: ["0 0 512 512", "M256 512c141.4 0 256-114.6 256-256S397.4 0 256 0S0 114.6 0 256S114.6 512 256 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"],
    away: ["0 0 576 512", "M482.3 192c34.2 0 93.7 29 93.7 64c0 36-59.5 64-93.7 64l-116.6 0L265.2 495.9c-5.7 10-16.3 16.1-27.8 16.1l-56.2 0c-10.6 0-18.3-10.2-15.4-20.4l49-171.6L112 320 68.8 377.6c-3 4-7.8 6.4-12.8 6.4l-42 0c-7.8 0-14-6.3-14-14c0-1.3 .2-2.6 .5-3.9L32 256 .5 145.9c-.4-1.3-.5-2.6-.5-3.9c0-7.8 6.3-14 14-14l42 0c5 0 9.8 2.4 12.8 6.4L112 192l102.9 0-49-171.6C162.9 10.2 170.6 0 181.2 0l56.2 0c11.5 0 22.1 6.2 27.8 16.1L365.7 192l116.6 0z"]
  };
  var st = { latest: null, reach: null, up: false, checked: false, saved: null, files: null, busy: null, error: "",
             online: navigator.onLine !== false };
  var LOST = "Couldn't reach the site, so the saved copy stays.";
  var button = null, panel = null, live = null;
  // Screen readers hear what a save, an update or a removal comes to.
  var say = function (text) { if (live) live.textContent = text; };

  var el = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  var icon = function (name) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg"), p = document.createElementNS(ns, "path");
    s.setAttribute("viewBox", ICONS[name][0]);
    s.setAttribute("aria-hidden", "true");
    p.setAttribute("d", ICONS[name][1]);
    s.appendChild(p);
    var span = el("span", "fa-svg");
    span.appendChild(s);
    return span;
  };
  var mb = function (n) { return n >= 1e5 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB"; };
  var ver = function (v, built) { return "v" + v + (typeof built === "string" && built ? " · built " + built.slice(0, 10) : ""); };
  var count = function (n, one, many) { return n + " " + (n === 1 ? one : many); };
  // An error's message, less any full stop: ours follows it.
  var why = function (err) { return String(err && err.message ? err.message : err).replace(/[\s.]+$/, ""); };
  // A file of the book by its path in version.json, as the browser asks for it.
  var key = function (path) {
    return new URL("./" + path.replace(/%/g, "%25").replace(/#/g, "%23").replace(/\?/g, "%3F").replace(/\\/g, "%5C"), ROOT).href;
  };
  var json = function (v) { return new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } }); };
  var sha256 = function (buf) {
    return crypto.subtle.digest("SHA-256", buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    });
  };
  var lock = function (fn) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request(PREFIX + "lock", fn) : fn();
  };
  var total = function (files) {
    var n = 0;
    for (var k in files) n += files[k][0];
    return n;
  };

  // Saving needs a secure, published site: not localhost, not a file from disk, not a download.
  var standalone = function () {
    return navigator.standalone === true || !!(window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  };
  var canSave = function () {
    var h = location.hostname;
    return MODE === "full" && !COPY && window.isSecureContext === true && location.protocol !== "file:" &&
      "serviceWorker" in navigator && "caches" in window && !!(window.crypto && crypto.subtle) &&
      h !== "localhost" && !/\.localhost$/.test(h) && !/^127(\.\d+){3}$/.test(h) && h !== "[::1]";
  };

  // The copy saved here, or null; strict, for a caller about to delete: errors are thrown.
  var readSaved = async function (strict) {
    try {
      if (!(await caches.has(META))) return null;
      var meta = await caches.open(META);
      var r = await meta.match(CURRENT);
      var cur = r ? await r.json() : null;
      if (!cur || !cur.cache || !(await caches.has(cur.cache))) return null;
      var f = await meta.match(LIST + cur.fingerprint);
      st.files = f ? await f.json() : null;
      return cur;
    } catch (e) {
      if (strict) throw e;
      return null;
    }
  };

  // st.up: the site answered (version.json, or a 404 for a book that's gone); onLine can't tell.
  var refresh = async function () {
    if (COPY) return;
    var v = null, gone = false;
    try {
      var r = await fetch(ROOT + "version.json", { cache: "no-cache" });
      gone = r.status === 404 || r.status === 410;
      v = r.ok ? await r.json() : null;
    } catch (e) {}
    if (v && typeof v.version === "number") st.latest = v;
    st.reach = !!(v && typeof v.version === "number");
    st.up = st.reach || gone;
    st.checked = true;
    if (st.up && st.error === LOST) st.error = "";
    render();
  };

  // What saving or updating fetches and keeps; pages counted once (no print, 404, toc, redirects, copies).
  var plan = function (L) {
    var files = L.files, old = (st.saved && st.files) || {};
    var p = { get: [], keep: [], bytes: 0, changed: 0, added: 0, removed: 0 };
    var page = function (path, entry, seen) {
      if (!/\.html$/.test(path) || /^(print|404|toc)\.html$/.test(path) || entry[2] || seen[entry[1]]) return false;
      seen[entry[1]] = true;
      return true;
    };
    var seen = {}, gone = {};
    Object.keys(files).forEach(function (path) {
      var o = old[path];
      if (o && o[1] === files[path][1]) return p.keep.push(path);
      p.get.push(path);
      p.bytes += files[path][0];
      // A page where a redirect was (output.html.redirect, since changed) is new.
      if (page(path, files[path], seen)) {
        if (o && !o[2]) p.changed++;
        else p.added++;
      }
    });
    // Gone, a redirect now, or now the first chapter's copy: removed.
    Object.keys(old).forEach(function (path) {
      var f = files[path];
      if ((!f || f[2] === 1 || (f[2] === 2 && !old[path][2])) && page(path, old[path], gone)) p.removed++;
    });
    return p;
  };
  var update = function () {
    var L = st.latest;
    return st.saved && L && L.files && L.fingerprint && L.fingerprint !== st.saved.fingerprint ? plan(L) : null;
  };

  // Four at a time; after a failure the rest are skipped, and it's thrown once all have stopped.
  var pool = function (items, n, work) {
    var i = 0, failure = null;
    var run = function () {
      if (failure || i >= items.length) return Promise.resolve();
      var item = items[i++];
      return Promise.resolve().then(function () { return work(item); })
        .then(run, function (e) { if (!failure) failure = e; });
    };
    var all = [];
    for (var k = 0; k < Math.min(n, items.length); k++) all.push(run());
    return Promise.all(all).then(function () { if (failure) throw failure; });
  };

  // Copies other than cur, and their file lists: replaced, or left by an interrupted update.
  var sweep = async function (meta, cur) {
    var names = await caches.keys();
    for (var i = 0; i < names.length; i++)
      if (names[i].indexOf(PREFIX + "copy ") === 0 && (!cur || names[i] !== cur.cache)) await caches.delete(names[i]);
    var keys = await meta.keys();
    for (var j = 0; j < keys.length; j++)
      if (keys[j].url.indexOf(LIST) === 0 && (!cur || keys[j].url !== LIST + cur.fingerprint)) await meta.delete(keys[j]);
  };

  var activated = function (reg) {
    return new Promise(function (done) {
      var w = reg.installing || reg.waiting;
      if (!w) return done();
      w.addEventListener("statechange", function () {
        if (w.state === "activated" || w.state === "redundant") done();
      });
    });
  };

  // The worker in control before the downloads: WebKit can stall a fetch passing through one.
  var ready = async function (reg) {
    // A worker starting now claims this page; one already running doesn't, so there's no wait.
    var fresh = !!(reg.installing || reg.waiting);
    await activated(reg);
    // Replaced before it started: a deploy may just have turned saving off.
    if (!reg.active) throw new Error("the site's offline service didn't start; reload the page");
    if (navigator.serviceWorker.controller || !fresh) return;
    await new Promise(function (done) {
      var timer = setTimeout(done, 5000);
      navigator.serviceWorker.addEventListener("controllerchange", function () { clearTimeout(timer); done(); }, { once: true });
    });
  };

  // Save or update: changed files fetched, the rest copied, all checked, then one switch.
  var save = async function () {
    var L = null, had = null, name = null, switched = false, reg = null;
    if (st.busy || !st.latest || !st.latest.files) return;

    var make = async function (p) {
      reg = await navigator.serviceWorker.register(ROOT + "sw.js", { scope: ROOT, updateViaCache: "none" });
      await ready(reg);
      // A name of its own: never the copy in use, whatever another tab did.
      name = PREFIX + "copy " + L.fingerprint + " " + Date.now();
      var cache = await caches.open(name);
      var old = had ? await caches.open(had.cache) : null;
      var jobs = p.keep.map(function (k) { return [k, true]; }).concat(p.get.map(function (k) { return [k, false]; }));
      await pool(jobs, 4, async function (job) {
        var path = job[0], want = L.files[path], url = key(path), res = job[1] && old ? await old.match(url) : null;
        if (!res) {
          // A minute for the answer to start, however long the file then takes.
          var stop = window.AbortController ? new AbortController() : null;
          var timer = stop ? setTimeout(function () { stop.abort(); }, 60000) : null;
          try {
            res = await fetch(url, stop ? { cache: "no-store", signal: stop.signal } : { cache: "no-store" });
          } catch (e) {
            throw new Error("couldn't fetch " + path + (stop && stop.signal.aborted ? " (no answer in a minute)" : ""));
          } finally {
            clearTimeout(timer);
          }
          if (!res.ok) throw new Error("couldn't fetch " + path + " (" + res.status + ")");
        }
        var body = await res.arrayBuffer();
        if (body.byteLength !== want[0] || (await sha256(body)) !== want[1])
          throw new Error(path + " isn't the file the site lists; the book may have just changed");
        await cache.put(url, new Response(body, { headers: { "Content-Type": res.headers.get("Content-Type") || "application/octet-stream" } }));
        st.busy.done++;
        later();
      });
      var meta = await caches.open(META);
      await meta.put(LIST + L.fingerprint, json(L.files));
      var cur = { cache: name, version: L.version, built: L.built, fingerprint: L.fingerprint };
      await meta.put(CURRENT, json(cur));
      switched = true;
      st.saved = cur;
      st.files = L.files;
      // Saved, whatever this does: what it misses goes on a later page load.
      try { await sweep(meta, cur); } catch (e) {}
    };

    st.error = "";
    st.busy = { what: "Checking…", done: 0, total: 0 };
    render();
    // The site's file list as it is now: the panel's may be a deploy behind.
    await refresh();
    L = st.latest;
    if (!st.reach || !L.files || !L.fingerprint) {
      st.busy = null;
      st.error = (st.saved ? "Couldn't update" : "Couldn't save") + ": couldn't check the book on the site.";
      say(st.error);
      render();
      return;
    }
    try {
      await lock(async function () {
        // Another tab may have saved or updated since this one looked.
        had = st.saved = await readSaved();
        if (had && had.fingerprint === L.fingerprint) return;
        var p = plan(L);
        st.busy = { what: (had ? "Updating to " : "Saving ") + "v" + L.version + "…", done: 0, total: p.keep.length + p.get.length };
        say(st.busy.what);
        render();
        // Not awaited: Firefox asks the reader, and an unanswered prompt would hold the save.
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
        try {
          await make(p);
        } catch (err) {
          // Still under the lock, so no other tab saves in between.
          if (!switched) {
            if (name) { try { await caches.delete(name); } catch (e) {} }
            // No worker left behind where nothing is saved, whatever this tab thought.
            try {
              if (!(await readSaved(true)) && reg && reg.scope === ROOT) await reg.unregister();
            } catch (e) {}
          }
          throw err;
        }
      });
    } catch (err) {
      st.error = (had ? "Couldn't update: " : "Couldn't save: ") + why(err) +
        (!switched && had ? ". The saved copy is as it was." : ".");
    }
    st.busy = null;
    say(st.error || (st.saved ? "Saved on this device: v" + st.saved.version : ""));
    render();
    if (switched && had && !st.error) location.reload();
  };

  var remove = async function () {
    if (st.busy) return;
    st.busy = { what: "Removing the saved copy…", done: 0, total: 0 };
    render();
    // Only while the site answers: removed, the copy can't come back until it does.
    await refresh();
    if (!st.up) {
      st.busy = null;
      st.error = LOST;
      say(st.error);
      render();
      return;
    }
    try {
      await lock(async function () {
        var names = await caches.keys();
        for (var i = 0; i < names.length; i++)
          if (names[i].indexOf(PREFIX) === 0) await caches.delete(names[i]);
        var reg = await navigator.serviceWorker.getRegistration(ROOT);
        if (reg && reg.scope === ROOT) await reg.unregister();
      });
      st.saved = null;
      st.files = null;
      st.error = "";
    } catch (err) {
      st.error = "Couldn't remove it: " + why(err) + ".";
    }
    st.busy = null;
    say(st.error || "Removed the saved copy.");
    render();
    // Reloaded from the site, out of the removed worker's hands (WebKit can stall a save there).
    if (!st.error) location.reload();
  };

  // A button: small (Remove) unless cls makes it big (Save, Update).
  var action = function (label, fn, off, cls) {
    var b = el("button", cls || "mdb-offline-act", label);
    b.type = "button";
    b.setAttribute("data-k", label);
    b.disabled = !!off;
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    return b;
  };
  // A paragraph of text and links: parts are strings or [text, address].
  var para = function (cls, parts) {
    var p = el("p", cls);
    parts.forEach(function (part) {
      if (typeof part === "string") return p.appendChild(document.createTextNode(part));
      var a = el("a", null, part[0]);
      a.href = part[1];
      a.setAttribute("data-k", part[0]);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      p.appendChild(a);
    });
    return p;
  };

  // The download: a big button, what it's for, its version, size and checksum.
  var download = function (box, c, label, what) {
    if (!c || !c.file) return;
    var a = el("a", "mdb-offline-big", label), sum = el("p", "mdb-offline-sum", "SHA-256 ");
    a.href = key(c.file);
    a.setAttribute("data-k", label);
    a.setAttribute("download", "");
    box.appendChild(a);
    box.appendChild(el("p", "mdb-offline-what", what));
    box.appendChild(el("p", "mdb-offline-note", "v" + st.latest.version + " · " + mb(c.size)));
    sum.appendChild(el("code", null, c.sha256));
    sum.appendChild(document.createTextNode(" · "));
    var s = el("a", null, "checksum file");
    s.href = key(c.file + ".sha256");
    s.setAttribute("data-k", label + " checksum");
    s.setAttribute("download", "");
    sum.appendChild(s);
    box.appendChild(sum);
  };

  // Redrawn only when something changed (a redrawn control is announced again); focus stays.
  var fill = function () {
    var inside = panel.contains(document.activeElement);
    var focus = inside ? document.activeElement.getAttribute("data-k") : null;
    var box = document.createElement("div");
    draw(box);
    if (box.innerHTML === panel.innerHTML) return;
    panel.textContent = "";
    while (box.firstChild) panel.appendChild(box.firstChild);
    if (!inside) return;
    var same = Array.prototype.find.call(panel.querySelectorAll("[data-k]"), function (n) { return n.getAttribute("data-k") === focus; });
    (same || first()).focus();
  };
  // Focus on opening: Save or Update, else the panel (or a lone download); never Remove.
  var first = function () {
    var ok = ':not([data-k="Remove saved copy"]):not(:disabled)';
    return panel.querySelector("button.mdb-offline-big" + ok) ||
      (panel.querySelector(".mdb-offline-sep") ? null : panel.querySelector("[data-k]" + ok)) || panel;
  };
  // The panel's content, into box: saving first, the download under it.
  var draw = function (box) {
    var L = st.latest, S = st.saved, u = update(), panel = box;
    panel.appendChild(el("p", "mdb-offline-title", "Read offline"));
    if (COPY) {
      panel.appendChild(el("p", null, "Downloaded copy " + ver(COPY.version, COPY.built)));
      if (typeof COPY.home === "string" && /^https?:\/\//.test(COPY.home))
        panel.appendChild(para("mdb-offline-note", ["Newer versions: ", [COPY.home, COPY.home]]));
      return;
    }
    var saving = canSave() && !!(S || (L && L.files));
    if (saving && st.busy) {
      panel.appendChild(el("p", null, st.busy.what));
      if (st.busy.total) {
        var bar = el("progress", "mdb-offline-progress");
        bar.setAttribute("aria-label", st.busy.what);
        bar.max = st.busy.total;
        bar.value = st.busy.done;
        panel.appendChild(bar);
        panel.appendChild(el("p", "mdb-offline-note mdb-offline-count", st.busy.done + " of " + st.busy.total + " files"));
      }
    } else if (saving && !S) {
      panel.appendChild(action("Save for offline", save, !st.online, "mdb-offline-big"));
      panel.appendChild(el("p", "mdb-offline-what", "Keeps the book in this browser, to read without a connection."));
      panel.appendChild(el("p", "mdb-offline-note", ver(L.version, L.built) + " · " + mb(total(L.files))));
      // Not in a Home Screen app: it has storage of its own.
      if (!standalone())
        panel.appendChild(el("p", "mdb-offline-note", "On an iPhone or iPad, add the book to your Home Screen first (Share, then Add to Home Screen) and save it from there: a book saved in Safari is deleted after 7 days of browsing without opening it."));
    } else if (saving) {
      panel.appendChild(el("p", null, "Saved on this device: " + ver(S.version, S.built)));
      if (!st.online) panel.appendChild(el("p", "mdb-offline-note", "You're offline: the book comes from this copy."));
      else if (u) {
        var behind = L.version - S.version;
        panel.appendChild(el("p", null, "Latest: " + ver(L.version, L.built) +
          (behind > 0 ? " · " + count(behind, "version", "versions") + " behind" : "")));
        panel.appendChild(el("p", "mdb-offline-note", count(u.changed, "page changed", "pages changed") + ", " +
          u.added + " new, " + u.removed + " removed · " + mb(u.bytes) + " to download"));
      } else if (st.reach === false) panel.appendChild(el("p", "mdb-offline-note", "Couldn't check for a newer version."));
      else if (L && L.files) panel.appendChild(el("p", "mdb-offline-note", "Up to date."));
      if (u && st.online) panel.appendChild(action("Update to v" + L.version, save, false, "mdb-offline-big"));
      var acts = el("div", "mdb-offline-actions");
      if (st.online && st.up) acts.appendChild(action("Remove saved copy", remove));
      if (acts.firstChild) panel.appendChild(acts);
    }
    if (st.error) panel.appendChild(el("p", "mdb-offline-error", st.error));
    // Not while busy: it would move up under the pointer, into a double-click's second click.
    var c = L && L.copies;
    if (!c || !st.online || st.busy) return;
    var d = el("div", saving ? "mdb-offline-dl mdb-offline-sep" : "mdb-offline-dl");
    download(d, c.laptop, "Download a copy", "A copy to keep on any computer, online or air-gapped. Unpack it and open index.html in the folder it makes.");
    if (d.firstChild) panel.appendChild(d);
  };

  var render = function () {
    if (!button) return;
    var L = st.latest, S = st.saved;
    var show = !!COPY || !!S || !!(st.online && L && ((canSave() && L.files) || L.copies));
    // Until the first check answers, the button keeps its place unseen.
    var wait = !show && !st.checked;
    button.hidden = !show && !wait;
    button.classList.toggle("mdb-offline-wait", wait);
    var name = st.busy ? "busy" : S && !COPY ? (st.online ? "saved" : "away") : "save";
    var label = "Read offline" + (COPY ? "" : st.busy ? ": working" : S ? (!st.online ? ": offline, saved copy" : update() ? ": update available" : ": saved") : "");
    if (button.getAttribute("data-icon") !== name) {
      button.textContent = "";
      button.appendChild(icon(name));
      button.setAttribute("data-icon", name);
    }
    button.title = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("mdb-offline-busy", !!st.busy);
    button.classList.toggle("mdb-offline-new", !st.busy && !!S && st.online && !!update());
    if (!show && !panel.hidden) toggle(false);
    if (!panel.hidden) fill();
    stale();
  };

  // A saved copy behind the site: a line before <main> (not in it: LAYOUT splits <main>).
  var line = null;
  var stale = function () {
    var L = st.latest, S = st.saved, main = document.querySelector("#mdbook-content main");
    var on = !COPY && !st.busy && st.online && st.reach === true && !!S && !!L && L.version > S.version && !!update();
    if (!on || !main) {
      if (line && line.parentNode) line.parentNode.removeChild(line);
      return;
    }
    if (!line) line = el("p", "mdb-stale");
    var text = "You're reading your saved copy, v" + S.version + ". v" + L.version + " is out: update it from the ✓ above.";
    if (line.textContent !== text) line.textContent = text;
    if (line.nextSibling !== main) main.parentNode.insertBefore(line, main);
  };

  // Progress, at most once a frame, in place: a redraw would move focus and be announced.
  var queued = false;
  var later = function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var bar = panel.querySelector("progress"), count = panel.querySelector(".mdb-offline-count");
      if (!st.busy || !bar || !count) return render();
      bar.value = st.busy.done;
      count.textContent = st.busy.done + " of " + st.busy.total + " files";
    });
  };

  var toggle = function (open) {
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    render();
    if (COPY || st.busy) return;
    // Another tab may have saved, updated or removed the copy.
    if (canSave()) readSaved().then(function (s) { if (!st.busy) { st.saved = s; render(); } });
    if (st.online) refresh();
  };

  var start = async function () {
    var bar = document.getElementById("mdbook-menu-bar");
    var right = bar && bar.querySelector(".right-buttons");
    if (!right) return;
    // Unseen, but in its place, until render() knows whether it shows.
    button = el("button", "icon-button mdb-offline-wait");
    button.id = "mdb-offline-toggle";
    button.type = "button";
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "mdb-offline-panel");
    // Last, a space apart as mdBook's own are: the panel, at the bar's end, opens under it.
    right.append(" ", button);
    // mdb-menu: the sidebar's swipes leave it alone.
    panel = el("div", "mdb-offline-panel mdb-menu");
    panel.id = "mdb-offline-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Read offline");
    panel.tabIndex = -1;
    // Next to its button, so Tab goes from one to the other.
    right.insertBefore(panel, button.nextSibling);
    live = el("span", "mdb-offline-live");
    live.setAttribute("role", "status");
    bar.appendChild(live);
    // Left and right inside the panel stay there: mdBook turns the page on them.
    panel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.stopPropagation();
    });
    button.addEventListener("click", function (e) {
      toggle(panel.hidden);
      // Opened from the keyboard: into the panel, as mdBook's theme menu does.
      if (e.detail === 0 && !panel.hidden) first().focus();
    });
    // Focus moving on out of the panel closes it, as it does mdBook's theme menu.
    panel.addEventListener("focusout", function (e) {
      var to = e.relatedTarget;
      if (to && !panel.contains(to) && to !== button) toggle(false);
    });
    // A click anywhere else closes it (Safari focuses no clicked button, so focusout won't).
    document.addEventListener("click", function (e) {
      if (!panel.hidden && !panel.contains(e.target) && !button.contains(e.target)) toggle(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { toggle(false); button.focus(); }
    });
    window.addEventListener("online", function () { st.online = true; refresh(); });
    window.addEventListener("offline", function () { st.online = false; render(); });
    st.checked = !!COPY || !st.online;
    // Drawn at once, unseen, so it's as wide as it will be before anything is read.
    render();
    if (canSave()) st.saved = await readSaved();
    render();
    if (!COPY && st.online) refresh();
    // A copy a cut-short save left goes, unless another tab is saving; nothing saved: all of it.
    if (canSave() && navigator.locks && navigator.locks.request) {
      navigator.locks.request(PREFIX + "lock", { ifAvailable: true }, async function (held) {
        if (!held) return;
        var cur = await readSaved(true);
        if (cur) return sweep(await caches.open(META), cur);
        var names = await caches.keys();
        for (var i = 0; i < names.length; i++)
          if (names[i].indexOf(PREFIX) === 0) await caches.delete(names[i]);
        // And the worker a first save cut short registered.
        var reg = await navigator.serviceWorker.getRegistration(ROOT);
        if (reg && reg.scope === ROOT) await reg.unregister();
      }).catch(function () {});
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
EOF
    fi
    say "wrote custom.js (sidebar key and swipes, external links, print return, site-meta footer, page dates, scrollable-code tabindex$([ "$THEME" != picker ] || printf ', theme menu')$([ "$LAYOUT" = scroll ] || printf ', layout (%s)' "$LAYOUT")$([ "$OFFLINE" = none ] || printf ', offline button'))"
}

# README: the title and, with a repo, the live-site link; written once, then the author's.
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

# split-headings.py (SPLIT_HEADINGS, up to v55) is retired: a copy this script wrote goes.
retire_split_headings() {
    [ -f split-headings.py ] || return 0
    grep -q 'Script-owned: bootstrap-mdbook.sh rewrites it' split-headings.py || return 0
    rm -f split-headings.py
    say "removed split-headings.py: LAYOUT does its job in the browser now; commit the deletion"
}

# version.js: the deploy stamp, apart from custom.js so the pages' code doesn't change each commit.
write_version_js() {
    render_version_js > version.js
    say "wrote version.js (the deploy stamp's placeholders)"
}

# offline.py at the book's root: script-owned, run by ./build.
write_offline() {
    render_offline > offline.py
    say "wrote offline.py (OFFLINE: ${OFFLINE})"
}

write_workflow() {
    mkdir -p .github/workflows
    render_workflow > .github/workflows/deploy.yml
    say "wrote .github/workflows/deploy.yml (branch: ${DEPLOY_BRANCH})"
}

## ─── templates ───────────────────────────────────────────────────────────
# Quoted heredoc delimiter ('EOF') = literal; unquoted (EOF) = expanded.

# book.toml: ayu for THEME="dark", else light; mdb-guide.md, "Light and dark", says why.
render_book_toml() {
    cat <<EOF
[book]
title = "$(esc_dq "$BOOK_TITLE")"
authors = ["$(esc_dq "$BOOK_AUTHOR")"]
EOF
    [ -z "$BOOK_DESCRIPTION" ] || echo "description = \"$(esc_dq "$BOOK_DESCRIPTION")\""
    cat <<'EOF'
src = "src"

[output.html]
EOF
    # version.js first: custom.js reads the stamp it holds.
    echo 'additional-js = ["version.js", "custom.js"]'
    # Always loaded: it styles what custom.js adds, in every mode.
    echo 'additional-css = ["custom.css"]'
    # OFFLINE: no fingerprinted names, which would change every page at every commit.
    [ "$OFFLINE" = none ] || echo 'hash-files = false'
    # Numbers shown is mdBook's default; only hiding them needs a line.
    [ "$SIDEBAR_NUMBERS" = true ] || echo 'no-section-label = true'
    if [ "$THEME" = dark ]; then
        echo 'default-theme = "ayu"'
    else
        echo 'default-theme = "light"'
    fi
    echo 'preferred-dark-theme = "ayu"'
    if [ -n "$GIT_REPO_URL" ]; then
        cat <<EOF
site-url = "$(esc_dq "$SITE_URL")"
edit-url-template = "$(esc_dq "$GIT_REPO_URL")/edit/$(esc_dq "$DEPLOY_BRANCH")/{path}"
EOF
    fi
    # No Rust playgrounds: each makes its page ask play.rust-lang.org for its crates.
    cat <<'EOF'

[output.html.playground]
runnable = false
EOF
    # Unlisted chapters out of search, only when listed: a key matching no chapter fails the build.
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

# ./build: the build and link check, run by the author before a push and by the workflow.
render_build() {
    cat <<'EOF'
#!/usr/bin/env bash
# Builds the book into book/ and stops on a broken internal link or anchor, by file and line.
set -euo pipefail
cd "$(dirname "$0")"
for tool in mdbook lychee; do
    [ -x "bin/$tool" ] || { echo "bin/$tool is missing: run bootstrap-mdbook.sh to install it" >&2; exit 1; }
done
command -v python3 >/dev/null 2>&1 || { echo "python3 is missing: install it (on Debian or Ubuntu: sudo apt-get install python3), then run ./build again" >&2; exit 1; }
[ -f offline.py ] || { echo "offline.py is missing: run bootstrap-mdbook.sh, then commit offline.py" >&2; exit 1; }
# mdBook exits 0 on an {{#include}} it can't read, so its ERROR line stops the build.
rc=0
./bin/mdbook build 2>&1 \
    | awk '{ print; fflush() } /^(\033\[[0-9;]*m)*ERROR/ { bad = 1 } END { exit bad ? 3 : 0 }' || rc=$?
if [ "$rc" -ne 0 ]; then
    [ "$rc" -ne 3 ] || echo "stopped: mdBook reported an error, above. Fix it, then run ./build again." >&2
    exit 1
fi
# OFFLINE's files, before the link check, which follows the manifest link.
python3 -I offline.py book
# print.html repeats every chapter; 404.html's <base href> points at the live site.
rc=0
report=$(./bin/lychee --offline --include-fragments --mode plain --no-progress \
    --root-dir "$PWD/book" --exclude-path book/print.html --exclude-path book/404.html \
    'book/**/*.html' 2>&1) || rc=$?
if [ "$rc" -eq 0 ]; then
    echo "links: every internal link and anchor resolves"
    exit 0
fi

# lychee names each break by page and address; the rest maps it to the Markdown file and line.
us=$'\037'

# One line per break: page, target, anchor, reason. LC_ALL=C: %XX decodes to bytes.
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

# Nothing to map (lychee itself failed): its report as it is, less its summary line.
if [ -z "$breaks" ]; then
    printf '%s\n' "$report" | grep -v ' Total (in ' >&2 || true
    echo "stopped: lychee failed (exit $rc); its output is above." >&2
    exit 1
fi

# SRC: the file a built page comes from; COPY=1 for the root index.html copying the first chapter.
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
    [ -n "$SRC" ] || [ ! -f "src/$p" ] || SRC=src/$p
    [ -n "$SRC" ] || SRC=book/$p
    return 0
}

# $1 as a regex for the ways a link can write it: each byte but a letter or digit, or its %XX.
as_written() {
    S=$1 LC_ALL=C awk 'BEGIN {
        s = ENVIRON["S"]
        for (i = 1; i < 256; i++) ord[sprintf("%c", i)] = i
        for (i = 1; i <= length(s); i++) {
            c = substr(s, i, 1)
            if (c ~ /[A-Za-z0-9]/) { out = out c; continue }
            h = sprintf("%02X", ord[c]); a = substr(h, 1, 1); b = substr(h, 2, 1)
            out = out "(" (index("\\.*$^+?(){}|[]", c) ? "\\" : "") c "|%[" a tolower(a) "][" b tolower(b) "])"
        }
        printf "%s", out
    }'
}

# Where file $1 writes the link to $6, from folder $5: "line<TAB>link"; code is skipped, as by lychee.
written() {
    LC_ALL=C NAME_RE=$2 FRAG_RE=$3 SELF=$4 BASE=$5 WANT=$6 awk '
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
        # Address p, decoded, from folder BASE: its path in book/ ("/" first if it climbs out).
        function resolve(p, md,   n, i, k, part, seg, out) {
            p = unhex(p)
            if (substr(p, 1, 1) != "/" && ENVIRON["BASE"] != "") p = ENVIRON["BASE"] "/" p
            n = split(p, part, "/"); k = 0; out = 0
            for (i = 1; i <= n; i++) {
                if (part[i] == "" || part[i] == ".") continue
                if (part[i] == "..") { if (k) k--; else out = 1; continue }
                seg[++k] = part[i]
            }
            p = out ? "/" : ""
            for (i = 1; i <= k; i++) p = p (i > 1 ? "/" : "") seg[i]
            if (md) sub(/[.]md$/, ".html", p)
            return p
        }
        BEGIN {
            hex = "0123456789abcdef"
            q = sprintf("%c", 39)
            lead = "(\\]\\(<?|\\]:[ \t]*<?|(href|src)=[\"" q "])"
            # The folders before the name: in <> or quotes, all but the closer; bare, no space or bracket.
            n = ENVIRON["NAME_RE"]; o = ENVIRON["SELF"] != "" ? "?" : ""
            path = "(\\]\\(<|\\]:[ \t]*<)(([^<>\t]*/)?" n ")" o
            path = path "|(href|src)=\"(([^\"<>\t]*/)?" n ")" o
            path = path "|(href|src)=" q "(([^" q "<>\t]*/)?" n ")" o
            path = "(" path "|(\\]\\(|\\]:[ \t]*)(([^]()<> \t]*/)?" n ")" o ")"
            # no anchor, or an empty one (page.md#)
            path = path "#" (ENVIRON["FRAG_RE"] != "" ? ENVIRON["FRAG_RE"] : "?")
            end = "[)>\"" q " \t\r]"
            re = path "(" end "|$)"
        }
        /^[ \t]*([`][`][`]|~~~)/ { fence = !fence; next }
        fence { next }
        {
            line = $0
            gsub(/`[^`]*`/, "", line)
            while (match(line, re)) {
                s = substr(line, RSTART, RLENGTH); line = substr(line, RSTART + 1)
                match(s, "^" lead); md = substr(s, 1, RLENGTH) !~ /^src=/; s = substr(s, RLENGTH + 1)
                sub(end "$", "", s)
                t = s; sub(/#.*/, "", t)
                r = t == "" ? "" : resolve(t, md)
                if (ENVIRON["WANT"] == "" || (t == "" ? ENVIRON["SELF"] != "" : ENVIRON["WANT"] == "/" ? substr(r, 1, 1) == "/" : r == ENVIRON["WANT"])) {
                    print FNR "\t" s
                    break
                }
            }
        }' "$1"
}

# The heading anchor on page $1 sharing two thirds or more of anchor $2's words, if any.
closest() {
    { grep -ho '<h[1-6][^>]* id="[^"]*"' "book/$1" 2>/dev/null || true; } | sed 's/.* id="//; s/"$//' | sort -u |
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

# Per break: the source file, the line the link is on, and why; sorted, each once.
printf '%s\n' "$breaks" | while IFS=$us read -r page target frag reason; do
    source_of "$page"; src=$SRC copy=$COPY
    self=
    [ -z "$frag" ] || [ "$target" != "$page" ] || self=1
    name=${target##*/}
    [ -z "$self" ] || name=${src##*/}
    case $name in
        *.html|*.md) name_re="$(as_written "${name%.*}")[.](md|html)" ;;
        *) name_re="$(as_written "$name")/?" ;;
    esac
    frag_re=$(as_written "$frag")
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
                *.md)
                    if [ -f "book/${target%.md}.html" ]; then why="its page is ${target%.md}.html: mdBook writes .html for .md in Markdown and in an <a href>, not in an HTML src"
                    elif [ -f "src/$target" ]; then why="src/$target isn't listed in src/SUMMARY.md, so the book has no page for it"
                    else why="there's no src/$target"; fi ;;
                *) why="there's no src/$target" ;;
            esac ;;
        *) why=$reason ;;
    esac
    # The folder a link in $src is read from, and the page it must lead to.
    base=${src#src/}
    [ -z "$copy" ] && [ "$base" != "$src" ] || base=$page
    case $base in */*) base=${base%/*} ;; *) base= ;; esac
    want=$target
    if [ -n "$self" ]; then
        want=$page
        [ -n "$copy" ] || [ "${src#src/}" = "$src" ] || want=${src#src/}
        want=${want%.md}; want=${want%.html}.html
    fi
    case $want in /*) want=/ ;; esac
    found=
    if [ -f "$src" ]; then found=$(written "$src" "$name_re" "$frag_re" "$self" "$base" "$want"); fi
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

# version.js: the four values the deploy workflow stamps (custom.js shows them).
render_version_js() {
    cat <<'EOF'
// Script-owned. The deploy workflow stamps these; MDB_PAGE_DATES stays a string until then.
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
var MDB_PAGE_DATES = "__MDB_PAGE_DATES__";
EOF
}

# offline.py: its five settings from the script's, then the program, verbatim.
render_offline() {
    cat <<EOF
#!/usr/bin/env python3
# Script-owned: bootstrap-mdbook.sh writes it, and a re-run rewrites it.
MODE = "$(esc_dq "$OFFLINE")"
NAME = "$(esc_dq "$BOOK_NAME")"
TITLE = "$(esc_dq "$BOOK_TITLE")"
DESCRIPTION = "$(esc_dq "$BOOK_DESCRIPTION")"
HOME = "$(esc_dq "$PAGES_URL")"
EOF
    cat <<'OFFLINEPY'

# OFFLINE's build step (./build runs it): sw.js always; unless "none", the download and version.json.

import base64
import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from urllib.parse import unquote

# A commit that changes any of these is a version (split-headings.py stays: old numbers hold).
SOURCES = ["book.toml", "src", "theme", "custom.css", "custom.js", "version.js",
           "split-headings.py", "offline.py", "build", ".github/workflows/deploy.yml"]
# The download and its checksum, inside the built book.
FOLDER = "offline"
# The deploy stamp: version.js, or its fingerprinted name when mdBook hashes files.
STAMP = re.compile(r"version(-[0-9a-f]{8})?\.js")
FONT_TYPES = {".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf"}
# Mask images: the image masthead (src/logo.svg).
MASK_TYPES = {".svg": "image/svg+xml", ".png": "image/png"}


def die(msg):
    sys.stderr.write("offline.py: %s\n" % msg)
    sys.exit(1)


def git(*args):
    """git's output, or None when git or the repository isn't there."""
    try:
        r = subprocess.run(["git"] + list(args), stdout=subprocess.PIPE,
                           stderr=subprocess.DEVNULL, universal_newlines=True)
    except OSError:
        return None
    return r.stdout if r.returncode == 0 else None


def utc(seconds):
    return datetime.datetime.fromtimestamp(seconds, datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def history():
    """The versions, newest first, as [number, date, commit]."""
    rows = [line.split() for line in (git("log", "--format=%H %ct", "--", *SOURCES) or "").splitlines()]
    rows = [r for r in rows if len(r) == 2]
    return [[len(rows) - i, utc(int(t)), h[:7]] for i, (h, t) in enumerate(rows)]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def write(path, data):
    """A new file in place of path (in a copy, path is a hard link to the book's)."""
    if os.path.lexists(path):
        os.unlink(path)
    with open(path, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode("utf-8", "surrogateescape"))


def read_text(path):
    """A file as text, its bytes and line ends kept through write()."""
    with open(path, encoding="utf-8", errors="surrogateescape", newline="") as f:
        return f.read()


def files_of(book, skip):
    """Every file under book, as sorted relative paths, less hidden ones and skip."""
    out = []
    for top, dirs, names in os.walk(book):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in names:
            rel = os.path.relpath(os.path.join(top, name), book).replace(os.sep, "/")
            if not name.startswith(".") and rel not in skip:
                out.append(rel)
    return sorted(out)


def language(book):
    """The book's language, as mdBook's <html lang> has it."""
    with open(os.path.join(book, "index.html"), encoding="utf-8") as f:
        m = re.search(r'<html\b[^>]*\blang="([^"]*)"', f.read(4096))
    return m.group(1) if m else "en"


def stage(book, files, to):
    """A copy of the book's files under to, as hard links where it can."""
    for rel in files:
        dst = os.path.join(to, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        try:
            os.link(os.path.join(book, rel), dst)
        except OSError:
            shutil.copy2(os.path.join(book, rel), dst)


def mark_copy(where, files, info, commit):
    """The copy's stamp is its version's commit, no tag, so a version's builds match; plus MDB_COPY."""
    names = [rel for rel in files if STAMP.fullmatch(rel)]
    if len(names) != 1:
        die("the built book has no version.js; book.toml's additional-js must list it")
    path = os.path.join(where, names[0])
    with open(path, encoding="utf-8") as f:
        text = f.read()
    for var, value in (("MDB_VERSION", ""), ("MDB_UPDATED", info["built"]), ("MDB_SHA", commit)):
        text = re.sub(r'^var %s = "[^"\n]*";$' % var, lambda m: "var %s = %s;" % (var, json.dumps(value)), text, flags=re.M)
    write(path, text.rstrip("\n") + "\nvar MDB_COPY = %s;\n" % json.dumps(info, sort_keys=True))


def folder_links(where, files):
    """A link to a folder (sub/) as one to its index.html, which a book opened from disk needs."""
    have = set(files)
    link = re.compile(r"""(<a(?:\s[^>]*?)?\shref=)(["'])([^"'#?]*)([#?][^"']*)?\2""", re.I)
    for rel in files:
        if not rel.endswith(".html"):
            continue
        path = os.path.join(where, rel)
        text = read_text(path)
        here = os.path.dirname(rel)

        def fix(m):
            target = m.group(3)
            if not target or re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|/", target):
                return m.group(0)
            folder = os.path.normpath(os.path.join(here, unquote(target))).replace(os.sep, "/")
            index = "index.html" if folder == "." else folder + "/index.html"
            if folder == ".." or folder.startswith("../") or folder in have or index not in have:
                return m.group(0)
            return "%s%s%s%sindex.html%s%s" % (m.group(1), m.group(2), target, "" if target.endswith("/") else "/",
                                              m.group(4) or "", m.group(2))
        new = link.sub(fix, text)
        if new != text:
            write(path, new)


def embed_assets(where, files):
    """Fonts and mask images as data: URIs: from disk, browsers won't load them from files."""
    face = re.compile(r"@font-face\s*\{[^}]*\}", re.I)
    mask = re.compile(r"(?:-webkit-)?mask(?:-image)?\s*:[^;}]*", re.I)
    url = re.compile(r"""url\(\s*(['"]?)([^'")]*)\1\s*\)""", re.I)
    for rel in files:
        if not rel.endswith(".css"):
            continue
        path = os.path.abspath(os.path.join(where, rel))
        css = read_text(path)
        base = os.path.dirname(path)

        def inline(types):
            def one(m):
                target = unquote(m.group(2).strip().split("#")[0].split("?")[0])
                kind = types.get(os.path.splitext(target)[1].lower())
                if not kind or re.match(r"[A-Za-z][A-Za-z0-9+.-]*:|/", target):
                    return m.group(0)
                file = os.path.normpath(os.path.join(base, target))
                if not file.startswith(os.path.join(os.path.abspath(where), "")) or not os.path.isfile(file):
                    return m.group(0)
                with open(file, "rb") as f:
                    return 'url("data:%s;base64,%s")' % (kind, base64.b64encode(f.read()).decode("ascii"))
            return one
        new = face.sub(lambda m: url.sub(inline(FONT_TYPES), m.group(0)), css)
        new = mask.sub(lambda m: url.sub(inline(MASK_TYPES), m.group(0)), new)
        if new != css:
            write(path, new)


def readme(stem, version, built):
    home = ("%s\nOpen it when you're online and use the offline button in the menu bar."
            % HOME) if HOME else "From the site you downloaded this from."
    return """%s
Downloaded copy v%d, built %s

To read it, open index.html in this folder with any web browser. It needs no
connection.

To check the download: next to it, the site shows its SHA-256 checksum and
offers a checksum file. Save that file in the folder with the download, then:
  Linux:    sha256sum -c %s.zip.sha256
  macOS:    shasum -a 256 -c %s.zip.sha256
            (if Safari unpacked the download, it moved the original to
            the Trash: put it back first)
  Windows:  certutil -hashfile %s.zip SHA256
            (it prints the checksum: compare it with the one in
            %s.zip.sha256)
"OK" means the download is intact.

Newer versions:
%s
""" % (TITLE, version, built[:10], stem, stem, stem, stem, home)


def refresh_target(path):
    """Where a redirect page sends the reader, or None for any other file."""
    if not path.endswith(".html") or os.path.getsize(path) > 65536:
        return None
    with open(path, encoding="utf-8", errors="replace") as f:
        m = re.search(r"""<meta\s+http-equiv=["']?refresh["']?\s+content=["'][^"']*?url=([^"']*)""", f.read(), re.I)
    return m.group(1) if m else None


def first_chapter(book, files):
    """The chapter index.html copies, if any (the same but for ../ before its links)."""
    if "index.html" not in files:
        return None
    with open(os.path.join(book, "index.html"), "rb") as f:
        index = f.read()
    title = re.search(rb"<title>.*?</title>", index, re.S)
    flat = index.replace(b"../", b"")
    for rel in files:
        if not rel.endswith(".html") or rel in ("index.html", "print.html", "404.html", "toc.html"):
            continue
        with open(os.path.join(book, rel), "rb") as f:
            head = f.read(8192)
            if title and title.group(0) not in head:
                continue
            data = head + f.read()
        if data.replace(b"../", b"") == flat:
            return rel
    return None


def write_zip(where, files, dest, top):
    """The same files give the same bytes: sorted, one fixed date, fixed modes."""
    tmp = dest + ".part"
    with zipfile.ZipFile(tmp, "w") as z:
        for rel in sorted(files):
            info = zipfile.ZipInfo(top + "/" + rel, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o644 << 16
            with open(os.path.join(where, rel), "rb") as f:
                z.writestr(info, f.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    os.replace(tmp, dest)


def copies(book, files, version, built, commit):
    """The download in offline/, with a .sha256 file."""
    stem = "%s-v%d" % (NAME, version)
    work = tempfile.mkdtemp(prefix=".offline-", dir=book)
    try:
        laptop = os.path.join(work, "laptop")
        stage(book, files, laptop)
        mark_copy(laptop, files, {"kind": "laptop", "version": version, "built": built, "home": HOME}, commit)
        folder_links(laptop, files)
        embed_assets(laptop, files)
        write(os.path.join(laptop, "README.txt"), readme(stem, version, built))
        write_zip(laptop, sorted(set(files + ["README.txt"])), os.path.join(book, FOLDER, stem + ".zip"), stem)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    name = stem + ".zip"
    path = os.path.join(book, FOLDER, name)
    digest = sha256(path)
    write(path + ".sha256", "%s  %s\n" % (digest, name))
    return {"laptop": {"file": FOLDER + "/" + name, "size": os.path.getsize(path), "sha256": digest}}


def size(n):
    return "%.1f MB" % (n / 1e6) if n >= 1e5 else "%d KB" % max(1, round(n / 1e3))


def main(argv):
    if len(argv) != 2:
        die("usage: python3 -I offline.py BOOK_DIR")
    book = argv[1].rstrip("/") or "/"
    if MODE not in ("none", "download", "full"):
        die('MODE must be "none", "download" or "full", got: %r' % MODE)
    if not os.path.isdir(book):
        die("%s is missing: build the book first" % book)
    write(os.path.join(book, "sw.js"), SW_FULL if MODE == "full" else SW_CLEANUP)
    if MODE == "none":
        return 0
    if not os.path.isfile(os.path.join(book, "index.html")):
        die("%s/index.html is missing: the download needs a book with at least one chapter" % book)
    # A version's date and commit are its own commit's, whatever came after it.
    versions = history()
    if versions:
        version, built, commit = versions[0]
    else:
        print("offline: no commit yet, so this build is v0")
        version, built, commit = 0, utc(int(datetime.datetime.now().timestamp())), ""
    if os.path.exists(os.path.join(book, FOLDER)) and not os.path.isdir(os.path.join(book, FOLDER)):
        die("%s/%s is a file, and the download needs that name for its folder: rename src/%s" % (book, FOLDER, FOLDER))
    os.makedirs(os.path.join(book, FOLDER), exist_ok=True)
    if MODE == "full":
        manifest = {"name": TITLE, "lang": language(book), "start_url": "./", "scope": "./",
                    "display": "standalone"}
        # The favicon, an SVG drawn at any size, is the app's icon.
        if os.path.isfile(os.path.join(book, "favicon.svg")):
            manifest["icons"] = [{"src": "favicon.svg", "sizes": "any", "type": "image/svg+xml"}]
        if DESCRIPTION:
            manifest["description"] = DESCRIPTION
        write(os.path.join(book, "manifest.webmanifest"),
              json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    stem = "%s-v%d" % (NAME, version)
    skip = {"sw.js", "version.json"} | {"%s/%s%s" % (FOLDER, stem, ext) for ext in (".zip", ".zip.sha256")}
    files = files_of(book, skip)
    info = {"book": NAME, "version": version, "built": built, "commit": commit,
            "history": versions, "copies": copies(book, files, version, built, commit)}
    if MODE == "full":
        # [size, SHA-256], then 1 for a redirect page, 2 for index.html copying the first chapter.
        listed = {}
        for rel in files:
            path = os.path.join(book, rel)
            listed[rel] = [os.path.getsize(path), sha256(path)] + ([1] if refresh_target(path) is not None else [])
        if first_chapter(book, files) and len(listed["index.html"]) == 2:
            listed["index.html"].append(2)
        # The stamp changes with every commit; the book doesn't.
        info["fingerprint"] = hashlib.sha256("".join(
            "%s %s\n" % (rel, listed[rel][1]) for rel in files if not STAMP.fullmatch(rel)
        ).encode("utf-8")).hexdigest()
        info["files"] = listed
    write(os.path.join(book, "version.json"),
          json.dumps(info, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n")
    c = info["copies"]
    print("offline: v%d; air-gapped laptop's copy %s%s"
          % (version, size(c["laptop"]["size"]),
             "; %d files to save, %s" % (len(files), size(sum(v[0] for v in info["files"].values())))
             if MODE == "full" else ""))
    return 0


# Outside "full": deletes a copy a reader saved before, then itself, and reloads open pages.
SW_CLEANUP = r"""// Written by offline.py (OFFLINE "none" or "download"): deletes the copy a
// reader saved while the book was "full", unregisters, and reloads open pages.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil((async function () {
    var prefix = "mdb-offline " + new URL("./", self.location).pathname + " ";
    var names = await caches.keys();
    for (var i = 0; i < names.length; i++)
      if (names[i].indexOf(prefix) === 0) await caches.delete(names[i]);
    await self.registration.unregister();
    var open = await self.clients.matchAll({ type: "window" });
    for (var j = 0; j < open.length; j++) open[j].navigate(open[j].url).catch(function () {});
  })());
});
"""

# OFFLINE "full": serves every page of the book from the saved copy, online or offline.
SW_FULL = r"""// Written by offline.py (OFFLINE "full"). Registered when a reader saves the
// book; serves the saved copy (custom.js saves and updates it).
"use strict";
var ROOT = new URL("./", self.location).href;
// Copies are named by the book's path: github.io sites share one origin.
var PREFIX = "mdb-offline " + new URL(ROOT).pathname + " ";
var META = PREFIX + "meta";
var CURRENT = ROOT + "__mdb-offline/current";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

// The saved copy, or null; read on every request: an update switches it with one write.
async function current() {
  if (!(await caches.has(META))) return null;
  var r = await (await caches.open(META)).match(CURRENT);
  if (!r) return null;
  var cur = null;
  try { cur = await r.json(); } catch (e) { return null; }
  return cur && cur.cache && (await caches.has(cur.cache)) ? cur : null;
}

// The copy's file for an address: the file, a folder's index.html, or a page without .html.
async function lookup(cache, address) {
  var u = new URL(address);
  u.search = "";
  u.hash = "";
  if (u.href.indexOf(ROOT) !== 0) return null;
  var rel = u.href.slice(ROOT.length);
  var names = rel === "" || rel.slice(-1) === "/" ? [rel + "index.html"]
    : /\.[^\/]*$/.test(rel) ? [rel] : [rel, rel + ".html", rel + "/index.html"];
  for (var i = 0; i < names.length; i++) {
    var hit = await cache.match(ROOT + names[i]);
    if (hit) return i === 2 ? Response.redirect(u.href + "/", 301) : hit;
  }
  return null;
}

async function answer(e) {
  var req = e.request;
  var cur = await current();
  if (!cur) return fetch(req);
  var cache = await caches.open(cur.cache);
  if (req.mode === "navigate") {
    var page = await lookup(cache, req.url);
    if (page) return page;
    // Not a page of the copy: the network, else the copy's 404 page.
    try {
      return await fetch(req);
    } catch (err) {
      var missing = await cache.match(ROOT + "404.html");
      if (!missing) throw err;
      return new Response(await missing.blob(), { status: 404, statusText: "Not Found", headers: missing.headers });
    }
  }
  // A page that came from the copy gets everything else from it too.
  var client = e.clientId ? await self.clients.get(e.clientId) : null;
  if (client && (await lookup(cache, client.url))) {
    var hit = await lookup(cache, req.url);
    if (hit) return part(req, hit);
  }
  return fetch(req);
}

// The byte range a player asks for (iOS plays media by ranges); anything else, the whole file.
async function part(req, res) {
  var m = /^bytes=(\d*)-(\d*)$/.exec((req.headers.get("Range") || "").trim());
  if (res.status !== 200 || !m || (m[1] === "" && m[2] === "") || (m[1] !== "" && m[2] !== "" && +m[2] < +m[1])) return res;
  var body = await res.blob(), n = body.size;
  var a = m[1] === "" ? Math.max(0, n - +m[2]) : +m[1];
  var b = m[1] === "" || m[2] === "" ? n - 1 : Math.min(+m[2], n - 1);
  var h = new Headers(res.headers);
  if (a > b) {
    h.set("Content-Range", "bytes */" + n);
    return new Response(null, { status: 416, statusText: "Range Not Satisfiable", headers: h });
  }
  h.set("Content-Range", "bytes " + a + "-" + b + "/" + n);
  h.set("Content-Length", String(b - a + 1));
  return new Response(body.slice(a, b + 1), { status: 206, statusText: "Partial Content", headers: h });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET" || req.url.indexOf(ROOT) !== 0) return;
  // Saving and updating fetch with no-store, from the network.
  if (req.cache === "no-store") return;
  var rel = req.url.slice(ROOT.length).split(/[?#]/)[0];
  if (rel === "sw.js" || rel === "version.json") return;
  // If the saved copy can't be read at all, the site.
  e.respondWith(answer(e).catch(function () { return fetch(req); }));
});
"""

if __name__ == "__main__":
    sys.exit(main(sys.argv))
OFFLINEPY
}

# The deploy workflow, pinned as lookup_releases found it; only the deploy job can publish.
render_workflow() {
    local numbering_step=""
    if [ "$HEADING_NUMBERS" = true ]; then
        numbering_step="

      - name: Install mdbook-numbering ${NUMBERING_VERSION}
        run: cargo install --locked --version ${NUMBERING_VERSION} mdbook-numbering"
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

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: ${CHECKOUT_USES}
        with:
          # Full history and tags: the stamp reads the tag.
          fetch-depth: 0
          # The build runs the repo's code; it has no use for a git token.
          persist-credentials: false

      - name: Install mdBook ${MDBOOK_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/rust-lang/mdBook/releases/download/${MDBOOK_VERSION}/mdbook-${MDBOOK_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "\$base" -o mdbook.tar.gz
          # The digest the bootstrap checked: a tag names a file, not its bytes.
          echo "${MDBOOK_SHA256}  mdbook.tar.gz" | sha256sum -c -
          mkdir -p bin
          tar -xz -f mdbook.tar.gz --directory=bin mdbook${numbering_step}

      - name: Install lychee ${LYCHEE_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "\$base" -o lychee.tar.gz
          # Pinned by version and sha256, as mdBook is.
          echo "${LYCHEE_SHA256}  lychee.tar.gz" | sha256sum -c -
          tar -xz -f lychee.tar.gz --strip-components=1 \\
            --directory=bin lychee-x86_64-unknown-linux-gnu/lychee

      - name: Stamp build metadata
        run: |
          set -euo pipefail
          # Version: the tag on this commit, or the nearest one plus a count (v1.2+5).
          version=\$(git describe --tags 2>/dev/null | sed -E 's/-([0-9]+)-g[0-9a-f]+\$/+\\1/' || true)
          version=\${version//[^A-Za-z0-9._+-]/}
          # Each chapter source's last commit time, in UTC; paths outside a safe charset skipped.
          dates="{" sep=""
          while IFS= read -r -d '' f; do
            case "\$f" in *.md) ;; *) continue ;; esac
            case "\$f" in *[!A-Za-z0-9._/' '-]*)
              echo "page dates: skipping '\$f' (character outside the safe set)"; continue ;;
            esac
            d=\$(TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%ad -- "\$f")
            [ -n "\$d" ] || continue
            dates="\$dates\$sep\\"\$f\\":\\"\$d\\""
            sep=","
          done < <(git ls-files -z -- src)
          dates="\$dates}"
          # The commit's time, not the clock's: two builds of a commit are the same.
          built=\$(TZ=UTC git log -1 --date=format-local:%Y-%m-%dT%H:%M:%SZ --format=%cd)
          sed -i \\
            -e "s|__MDB_BUILD_VERSION__|\${version}|" \\
            -e "s|__MDB_BUILD_DATE__|\${built}|" \\
            -e "s|__MDB_BUILD_SHA__|\${GITHUB_SHA::7}|" \\
            -e "s|\\"__MDB_PAGE_DATES__\\"|\${dates}|" \\
            version.js

      - name: Build and check links
        # The ./build the author runs before a push: a broken link stops the deploy.
        run: bash ./build

      - name: Upload artifact
        uses: ${UPLOAD_USES}
        with:
          path: ./book

  deploy:
    needs: build
    # Only this job publishes, so only this job gets the two permissions.
    permissions:
      pages: write
      id-token: write
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: ${DEPLOY_USES}
EOF
}

## ─── entry point ─────────────────────────────────────────────────────────
# Guarded so the file can be sourced to test a render_* function.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````