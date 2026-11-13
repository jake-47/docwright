<div class="mdb-wide"></div>

# Bootstrap-zola script

The script below scaffolds a Zola blog, installs and version-pins the Zola binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. For details, see [Publish a blog](./publish-blog.md).

````bash
#!/usr/bin/env bash
# zola-blog-setup, v123
#
# Makes a Zola 0.23 blog for GitHub Pages at PROJECT_DIR/BLOG_NAME, and keeps it
# in step with the settings below: running it again is the update. The script's
# own files are written again on every run; content/ is yours (in book mode,
# book/ is, and content/ is made from it). The Zola in ~/.local/bin is used as it
# is; with none there, the newest Zola 0.23 release that has been out a week is
# downloaded once, checked against the fingerprint GitHub recorded for the file,
# and pinned in the workflow. Only update asks GitHub for newer releases. Linux
# x86_64.
#
#   bash zola-blog-setup.sh          create or update the blog, with the releases
#                                    already installed and pinned
#   bash zola-blog-setup.sh update   the same, moving to the newest releases
#   bash zola-blog-setup.sh remove   delete the zola this script installed
#
# How to use it: zola-blog-guide.md. The comments here are for reviewers.

set -euo pipefail

## ─── helpers ──────────────────────────────────────────────────────────
say()  { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die()  { printf '%s\n' "$*" >&2; exit 1; }

# For a double-quoted TOML string: backslash first.
toml_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# For XML text, & first. From bash 5.2 an unquoted & in a replacement expands to
# the match, so each is backslashed: ${s//</&lt;} would give "<lt;".
esc_xml() {
    local s="$1"
    s="${s//&/\&amp;}"
    s="${s//</\&lt;}"
    s="${s//>/\&gt;}"
    printf '%s' "$s"
}

# git that runs, not only a git that's found: on Whonix /usr/bin/git is a Tor
# wrapper, there whether git is installed or not.
have_git() { git --version >/dev/null 2>&1; }

# From a saved file only: piped from curl, a download cut off midway would run
# half a script.
if [ ! -f "${BASH_SOURCE[0]:-}" ] || [ ! -r "${BASH_SOURCE[0]:-}" ]; then
    die "run zola-blog-setup from its saved file, not piped from curl."
fi

# The settings, checked as text before bash runs them: a stray " or ` makes text
# vanish, or the run fail at a later line, without naming the setting.
check_setting_quotes() {
    local line name value n=0 inside=false
    local setting='^[[:space:]]*(readonly[[:space:]]+)?([A-Z_][A-Z0-9_]*)="(.*)$'
    local quoted='^(\\.|[^\\"`])*"([[:space:]]+#.*)?[[:space:]]*$'
    while IFS= read -r line; do
        n=$((n + 1))
        if [[ $line == "## ─── user configuration"* ]]; then inside=true; continue; fi
        [ "$inside" = true ] || continue
        [[ $line == "## ───"* ]] && return 0
        [[ $line =~ $setting ]] || continue
        name=${BASH_REMATCH[2]} value=${BASH_REMATCH[3]}
        [[ $value =~ $quoted ]] || die "line $n: $name isn't quoted as the script needs: the value goes between two \", with a backslash before any \" or \` inside it, as in \"say \\\"hi\\\"\". nothing has been changed."
    done < "${BASH_SOURCE[0]}"
}
check_setting_quotes

## ─── user configuration ───────────────────────────────────────────────
# The script's input, with update and remove: a re-run applies whatever has
# changed here. Each setting: zola-blog-guide.md, "Settings, one by one".

PROJECT_DIR="$HOME/Desktop"       # the folder the blog's folder goes in; ~ allowed
readonly BLOG_NAME="myblog"       # the blog's own folder; readers see SITE_TITLE

readonly GIT_REPO_URL=""          # https://github.com/user/repo; "" = local only
readonly CUSTOM_DOMAIN=""         # https://yourdomain.com; changes base_url only

# Usually set for one run, in front of the command.
readonly START_PREVIEW="${START_PREVIEW:-true}"
readonly REGENERATE_TEMPLATES="${REGENERATE_TEMPLATES:-false}"

readonly SITE_TITLE="Myblog"
readonly SITE_DESCRIPTION="one-line description"   # "" for none
readonly SITE_AUTHOR="your name"                   # the feed needs one
readonly SITE_LANGUAGE="en"

readonly MASTHEAD="text"          # "text", "none", or "image" (static/logo.svg)
readonly MENU_PAGES="about"       # pages in content/, by name, in menu order
readonly FAVICON_TEXT="auto"      # "auto", up to 3 characters, or "" for your own
readonly LIGHT_THEME=false        # true: light for readers whose OS asks for it

readonly LIGHT_CODE_THEME="github-light"   # Giallo theme names
readonly DARK_CODE_THEME="github-dark"

# true: pages from an outline, book/SUMMARY.md, as mdBook builds a book, and
# no posts (guide: "Book mode"). Needs GENERATE_FEEDS and ENABLE_TAGS false.
readonly BOOK_MODE=false
readonly OUTLINE_NUMBERS=false    # book mode: number the outline's headings and items as one tree

readonly GENERATE_FEEDS=true      # atom.xml, and one per tag
readonly SHOW_RSS_LINK=true       # the menu link only; the feed stays
readonly ENABLE_TAGS=true
readonly ENABLE_SEARCH=true       # the only script on the pages

readonly SHOW_TOC=true
readonly SHOW_BREADCRUMBS=true    # Home and a page's folders, over its title
readonly SHOW_READING_TIME=true   # "N min read" on the date line
readonly DATE_FORMAT="%Y-%m-%d"   # "%-d %B %Y" gives 21 September 2026
readonly SHOW_HISTORY_LINK=false  # needs GIT_REPO_URL
readonly SHOW_SUGGEST_EDIT=false  # needs GIT_REPO_URL

# The footer: links as Label=address pairs, space-separated, one-word labels
# (delete a pair to drop that link), then a line of small print under them.
# "" for none.
readonly FOOTER_LINKS="X=https://x.com/yourhandle Nostr=https://nostr.com/npub1yourkeyhere GitHub=https://github.com/yourhandle/yourrepo"
readonly FOOTER_TEXT=""           # such as "© 2026 Your Name"

## ─── derived from the block above (do not edit) ───────────────────────
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
PROJECT_DIR="${PROJECT_DIR%/}"
readonly PROJECT_DIR
readonly BLOG_DIR="$PROJECT_DIR/$BLOG_NAME"

_favicon_mark=""
if [ "$FAVICON_TEXT" = "auto" ]; then
    _favicon_mark="${SITE_TITLE//[^A-Za-z0-9]/}"
    _favicon_mark=$(printf '%s' "${_favicon_mark:0:1}" | tr '[:lower:]' '[:upper:]')
elif [ -n "$FAVICON_TEXT" ]; then
    _favicon_mark="${FAVICON_TEXT:0:3}"
    [ "${#FAVICON_TEXT}" -le 3 ] \
        || warn "FAVICON_TEXT is ${#FAVICON_TEXT} characters and a favicon is read at 16px; only \"${_favicon_mark}\" is drawn"
fi
readonly FAVICON_MARK="$_favicon_mark"
unset _favicon_mark

printf -v SELF_CMD 'bash %q' "${BASH_SOURCE[0]}"
readonly SELF_CMD

## ─── releases ─────────────────────────────────────────────────────────
# No release is named here: a lookup takes the newest out this many days (most
# hijacked releases are found and pulled within a week).
readonly RELEASE_WAIT_DAYS=7
# The templates are Tera v2, written for Zola 0.23; before 0.23.3 Zola publishes
# nothing in content/attachments/. A newer series is said, not taken: move both
# only after porting the templates.
readonly ZOLA_SERIES="0.23"
readonly ZOLA_FLOOR="0.23.3"
readonly ZOLA_DIR="$HOME/.local/bin"
readonly ZOLA_BIN="$ZOLA_DIR/zola"
readonly ZOLA_FILE="zola-{tag}-x86_64-unknown-linux-gnu.tar.gz"
# What the last lookup found, shared by every blog on this computer, so a run
# needs no network: "zola vX.Y.Z sha256", the zola in ZOLA_BIN and its file's
# fingerprint, and "actions/NAME commit # tag" for each action.
readonly RECORD_DIR="$HOME/.local/share/zola-blog-setup"
readonly RECORD="$RECORD_DIR/releases"

## ─── state ────────────────────────────────────────────────────────────
UPDATE=""           # 1 for update: look up the newest releases
ZOLA_VERSION=""      # the release this run installs and pins: vX.Y.Z
ZOLA_SHA256=""       # its Linux file's sha256: GitHub's, the record's or the workflow's
CHECKOUT_USES=""     # actions/checkout@<commit> # <tag>, for the workflow
UPLOAD_USES=""
DEPLOY_USES=""
TMP_ZOLA=""
BLOG_CREATED=""
IS_UPDATE=""
README_KEPT=""
BASE_URL=""
SOURCE_URL=""
HISTORY_URL=""
HISTORY_HINT=""
FORGE_URL=""
REMOTE_URL=""
TODAY=""
YESTERDAY=""
TWO_DAYS_AGO=""

# A first run that stops removes the folder it made, and nothing else.
cleanup() {
    [ -z "$TMP_ZOLA" ] || rm -rf "$TMP_ZOLA"
    [ -z "$BLOG_CREATED" ] || [ ! -d "$BLOG_CREATED" ] || rm -rf "$BLOG_CREATED"
    return 0
}
trap cleanup EXIT

# =============================================================================
# The run
# =============================================================================
main() {
    case "$#:${1:-}" in
        0:) ;;
        1:update) UPDATE=1 ;;
        1:remove) ;;
        1:help|1:-h|1:--help) usage; return 0 ;;
        *) die "unknown command: $*. the script takes update, remove or nothing (bash ${BASH_SOURCE[0]##*/} help lists them). nothing has been changed." ;;
    esac
    # Nothing here needs root, and a run as root leaves files its owner can't write.
    [ "$EUID" -ne 0 ] || die "this run is root's: run this as yourself, without sudo; nothing it does needs root. nothing has been changed."
    if [ "${1:-}" = remove ]; then
        remove_zola
        return 0
    fi
    # Gone in v116: a run keeps what's installed and pinned by itself.
    [ -z "${KEEP_PINS:-}" ] || say "KEEP_PINS isn't needed any more: every run keeps the releases installed and pinned, and only update looks for newer ones."
    validate_config
    [ "$(uname -s) $(uname -m)" = "Linux x86_64" ] \
        || die "this script runs on Linux x86_64, and this is $(uname -s) $(uname -m) (on Windows, run it in WSL). nothing has been changed."
    check_required_tools
    if [ -f "$BLOG_DIR/zola.toml" ] || [ -f "$BLOG_DIR/config.toml" ]; then
        update_blog
    else
        create_blog
    fi
}

# First run: every lookup before the first file, so a stop leaves nothing behind.
create_blog() {
    [ ! -e "$BLOG_DIR" ] || die "'$BLOG_DIR' exists but holds no zola.toml; move it aside or point BLOG_NAME somewhere else. nothing has been changed."
    resolve_releases
    resolve_host_config
    resolve_dates
    install_zola
    say ""
    say "creating $BLOG_DIR ..."
    mkdir -p "$BLOG_DIR" || die "could not create $BLOG_DIR (is PROJECT_DIR writable?)"
    cd "$BLOG_DIR"
    BLOG_CREATED="$BLOG_DIR"
    write_owned_files
    write_content_if_absent
    write_absent static/avatar.svg render_avatar_svg
    check_menu_pages
    warn_placeholders
    BLOG_CREATED=""
    say "blog created in $BLOG_DIR"
    say ""
    init_git_repo
    build_site
    start_preview_server
}

# Re-run: the checks first, so their "nothing has been changed" is true.
update_blog() {
    say "found an existing blog in $BLOG_DIR"
    IS_UPDATE=1
    cd "$BLOG_DIR" || die "could not enter blog folder '$BLOG_DIR'"
    check_book_folder
    check_owned_file_drift
    check_menu_pages
    if [ "$BOOK_MODE" = true ]; then
        say "updating the script-owned files; book/ is left untouched, and content/ is made from it."
    else
        say "updating the script-owned files; content/ is left untouched."
    fi
    say ""
    resolve_releases
    resolve_host_config
    install_zola
    write_owned_files
    warn_placeholders
    update_git_remote
    [ ! -e .git ] || ! have_git || install_hook
    note_tracked_content
    say ""
    say "updated."
    build_site
    start_preview_server
}

# =============================================================================
# Checks
# =============================================================================
# Only what would otherwise build a wrong site quietly: a true or false typed wrong
# stops the build by itself, and so does a menu page that isn't there.
validate_config() {
    local repo item url links=()
    case "$MASTHEAD" in
        none|text|image) ;;
        *) die "MASTHEAD must be none, text or image, got: $MASTHEAD" ;;
    esac
    case "$BLOG_NAME" in
        ""|*/*|*\\*|.*|-*|*..*|*" "*|*$'\t'*|*\"*)
            die "BLOG_NAME must be a plain folder name (no slashes, leading dash or dot, spaces, '..', or double quotes), got: '$BLOG_NAME'" ;;
    esac
    if [ -n "$GIT_REPO_URL" ]; then
        repo=${GIT_REPO_URL#https://github.com/}
        repo=${repo%/} repo=${repo%.git}
        case "$GIT_REPO_URL" in https://github.com/*) ;; *) repo="" ;; esac
        case "$repo" in */*/*|*[!A-Za-z0-9._/-]*) repo="" ;; esac
        case "$repo" in
            ?*/?*) ;;
            *) die "GIT_REPO_URL must be the address of the repository's main page, https://github.com/user/repo, with nothing after the repository's name; got: $GIT_REPO_URL" ;;
        esac
    fi
    # The templates tell the preview from the published site by its http://.
    case "$CUSTOM_DOMAIN" in
        ""|https://?*) ;;
        *) die "CUSTOM_DOMAIN must be an https:// URL (got: $CUSTOM_DOMAIN)" ;;
    esac
    if [ "$BOOK_MODE" = true ]; then
        [ "$GENERATE_FEEDS" != true ] || die "BOOK_MODE is true, and so is GENERATE_FEEDS: a book's pages have no dates, so the feed would be empty. set GENERATE_FEEDS=false (SHOW_RSS_LINK then does nothing). nothing has been changed."
        [ "$ENABLE_TAGS" != true ] || die "BOOK_MODE is true, and so is ENABLE_TAGS: a book's pages have no tags, so the tags page would be empty. set ENABLE_TAGS=false. nothing has been changed."
    fi
    [ "$GENERATE_FEEDS" != true ] || [ -n "$SITE_AUTHOR" ] \
        || die "GENERATE_FEEDS is true, and SITE_AUTHOR is empty: every post in the feed would name its author as \"Unknown\". set SITE_AUTHOR to your name, or GENERATE_FEEDS=false. nothing has been changed."
    # Zola prints a format with no % code as it is: the same text for every date.
    case "$DATE_FORMAT" in
        *%*) ;;
        *) die "DATE_FORMAT needs at least one % code, such as \"%Y-%m-%d\" or \"%-d %B %Y\"; got: '$DATE_FORMAT'" ;;
    esac
    # An address without its scheme would be a link inside the blog.
    read -r -a links <<< "$FOOTER_LINKS"
    for item in ${links[@]+"${links[@]}"}; do
        url=${item#*=}
        case "$item" in =*|"$url") url="" ;; esac
        case "$url" in
            https://?*|http://?*|mailto:?*) ;;
            *) die "FOOTER_LINKS takes Label=address pairs separated by spaces, each address starting https://, http:// or mailto:, such as \"X=https://x.com/you\"; got: '$item'" ;;
        esac
    done
}

# git only with GIT_REPO_URL: without it, a missing git is said, and skipped.
# Each tool must run, not only be found (have_git says why).
check_required_tools() {
    local t tools=(curl python3) missing=""
    [ -z "$GIT_REPO_URL" ] || tools+=(git)
    for t in "${tools[@]}"; do
        "$t" --version >/dev/null 2>&1 || missing+=" $t"
    done
    [ -z "$missing" ] || die "missing:$missing. on Debian, Devuan or Ubuntu: sudo apt install$missing. nothing has been changed."
}

# BOOK_MODE on a site with no book/: a blog, or a book whose book/ has gone.
check_book_folder() {
    [ "$BOOK_MODE" = true ] && [ ! -d book ] || return 0
    if grep -qs '^book = true' zola.toml config.toml; then
        die "BOOK_MODE is true, but $BLOG_DIR/book/, the folder that holds the pages, is gone. put it back, from your repository if it's committed, then run this again. nothing has been changed."
    fi
    die "BOOK_MODE is true, but $BLOG_DIR was made as a blog: it has no book/, and a blog can't become a book (guide: \"A blog can't become a book\"). for a book, set BLOG_NAME to a new folder; to update this blog, set BOOK_MODE=false. nothing has been changed."
}

# A menu page without hidden = true is a post too, listed on the home page or left
# out of the site. In book mode genbook writes hidden.
check_menu_pages() {
    local name file names=()
    [ "$BOOK_MODE" != true ] || return 0
    read -r -a names <<< "$MENU_PAGES"
    for name in ${names[@]+"${names[@]}"}; do
        file="content/$name.md"
        [ -f "$file" ] && [ ! -f "content/$name/_index.md" ] || continue
        grep -q '^hidden *[=:] *true' "$file" \
            || die "MENU_PAGES names $name, but $file doesn't say hidden = true, so it counts as a post: listed on the home page if it has a weight, left out of the site if not. add hidden = true under its title. nothing has been changed."
    done
}

# Where a MENU_PAGES name lives, from content/: NAME.md, or a folder's NAME/_index.md.
menu_page_path() {
    if [ ! -f "content/$1.md" ] && [ -f "content/$1/_index.md" ]; then
        printf '%s' "$1/_index.md"
    else
        printf '%s' "$1.md"
    fi
}

# Example values the script came with, while GIT_REPO_URL publishes the blog.
warn_placeholders() {
    local left="" about=content/about.md
    [ -n "$GIT_REPO_URL" ] || return 0
    [ "$BOOK_MODE" != true ] || about=book/about.md
    [ "$SITE_TITLE" != "Myblog" ] || left+="SITE_TITLE, "
    [ "$SITE_DESCRIPTION" != "one-line description" ] || left+="SITE_DESCRIPTION, "
    [ "$SITE_AUTHOR" != "your name" ] || left+="SITE_AUTHOR, "
    case "$FOOTER_LINKS" in *yourhandle*|*npub1yourkeyhere*|*yourrepo*) left+="FOOTER_LINKS, " ;; esac
    if grep -qs -e 'you@yourdomain.com' -e 'Your name. One or two sentences' "$about"; then left+="$about, "; fi
    [ -z "$left" ] || warn "still the examples the script came with, and GIT_REPO_URL will publish them: ${left%, }. the guide's \"Before you publish\" says what to change."
}

# =============================================================================
# Releases: looked up, checked, installed
# =============================================================================
# Nothing here reads a config file that could switch a check off or send a request
# elsewhere: curl runs with -q, which must come first, so ~/.curlrc isn't read, and
# git ls-remote with no system, global or repository config (no url.insteadOf, no
# http.sslVerify). The environment still applies: https_proxy, and CURL_CA_BUNDLE
# and GIT_SSL_CAINFO for a proxy's certificate.

# GitHub's list of the releases of github.com/$1: 60 requests an hour from one
# address, and a run makes four (one without GIT_REPO_URL); no token needed.
releases_json() {
    curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 --connect-timeout 30 --max-time 120 \
        -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$1/releases?per_page=100"
}

# From releases_json on stdin: the highest-numbered stable release published
# RELEASE_WAIT_DAYS ago or more, in series $1 (x.y, "" for any), from $2 on, and,
# with $3 (a file name, {tag} for the tag), whose file of that name was uploaded,
# and last changed, that long ago too; with $4, that release only. Prints "tag sha256" (sha256 "-" without $3,
# "?" for a fingerprint GitHub gives in a form this script doesn't know); nothing
# when none qualifies; exit 1 when the answer can't be read.
pick_release() {
    python3 -I -c '
import datetime, json, re, sys
days, series, floor, name, only = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
cut = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days)
def old(s):
    return isinstance(s, str) and datetime.datetime.fromisoformat(s.replace("Z", "+00:00")) <= cut
def num(tag):
    m = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", tag if isinstance(tag, str) else "")
    return tuple(int(x) for x in m.groups()) if m else None
try:
    releases = json.load(sys.stdin)
    assert isinstance(releases, list)
    best = None
    for r in releases:
        n = num(r.get("tag_name"))
        if not n or r.get("draft") is not False or r.get("prerelease") is not False or not old(r.get("published_at")):
            continue
        if series and "%d.%d" % n[:2] != series or floor and n < num("v" + floor) or only and r["tag_name"] != only:
            continue
        sha = "-"
        if name:
            f = [a for a in r.get("assets") or [] if a.get("name") == name.replace("{tag}", r["tag_name"]) and a.get("state") == "uploaded"]
            if not f or not old(f[0].get("created_at")) or not old(f[0].get("updated_at")):
                continue
            d = f[0].get("digest") or ""
            sha = d[7:] if re.fullmatch(r"sha256:[0-9a-f]{64}", d) else "?"
        if best is None or n > best[0]:
            best = (n, r["tag_name"], sha)
except (ValueError, AssertionError, AttributeError, KeyError, TypeError):
    sys.exit(1)
if best:
    print(best[1], best[2])
' "$RELEASE_WAIT_DAYS" "$1" "$2" "$3" "${4:-}"
}

# What the workflow pins; by the full path, since the lookup runs before the cd.
pin() {
    local wf="$BLOG_DIR/.github/workflows/deploy.yml"
    [ -n "$GIT_REPO_URL" ] && [ -f "$wf" ] || return 0
    sed -n "$1" "$wf"
}
pin_zola() { pin 's|.*/getzola/zola/releases/download/\(v[0-9][0-9.]*\)/zola-v[0-9][0-9.]*-x86_64-unknown-linux-gnu\.tar\.gz".*|\1|p'; }
pin_sha() { pin 's|^[[:blank:]]*echo[[:blank:]]\{1,\}"\([0-9a-f]\{64\}\)[[:blank:]]\{1,\}zola\.tar\.gz".*|\1|p'; }
pin_action() { pin "s|^[[:blank:]]*uses:[[:blank:]]*actions/$1@\([0-9a-f]\{40\}\)[[:blank:]]\{1,\}#[[:blank:]]*\(v[0-9]\{1,\}\.[0-9]\{1,\}\.[0-9]\{1,\}\)[[:space:]]*\$|\1 # \2|p"; }

# The commit a tag of github.com/$1 names (an annotated tag's, peeled). HOME too,
# for a git older than 2.32, which has no GIT_CONFIG_GLOBAL.
tag_commit() {
    env -u GIT_SSL_NO_VERIFY -u GIT_CONFIG_COUNT -u GIT_CONFIG_PARAMETERS -u XDG_CONFIG_HOME -u GIT_ASKPASS -u SSH_ASKPASS \
        HOME=/nonexistent GIT_DIR=/nonexistent GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 \
        git -c http.sslVerify=true -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 ls-remote "https://github.com/$1" "refs/tags/$2" "refs/tags/$2^{}" |
        awk -v t="refs/tags/$2" '$2 == t "^{}" { peeled = $1 } $2 == t { plain = $1 }
            END { print (peeled != "" ? peeled : plain) }'
}

# True for x.y.z in ZOLA_SERIES, from ZOLA_FLOOR on.
in_series() {
    local p=${1#"$ZOLA_SERIES".}
    [ "$p" != "$1" ] || return 1
    case "$p" in ""|*[!0123456789]*) return 1 ;; esac
    [ "$p" -ge "${ZOLA_FLOOR#"$ZOLA_SERIES".}" ]
}

# True when release $1 is numbered higher than $2.
newer() {
    [ "$1" != "$2" ] && [ "$(printf '%s\n' "$1" "$2" | sort -V | tail -n 1)" = "$1" ]
}

installed_zola_version() {
    [ -x "$ZOLA_BIN" ] || return 0
    "$ZOLA_BIN" --version 2>/dev/null | awk 'NR == 1 { print $2 }' || true
}

net_hint() {
    printf '%s' "no network (behind a proxy, set https_proxy: ~/.curlrc isn't read), a proxy refusing api.github.com, or GitHub's limit of 60 requests an hour from one address, which a shared one (an office, a VPN) can use up"
}

# The record: one line per key, "key value...". Written by a rename, so a run
# stopped midway leaves the old one.
record_get() {
    [ -f "$RECORD" ] || return 0
    awk -v k="$1" '$1 == k { sub(/^[^ ]+ /, ""); print; exit }' "$RECORD"
}
record_set() {
    local tmp
    mkdir -p "$RECORD_DIR" || die "could not make $RECORD_DIR. nothing has been changed."
    tmp=$(mktemp "$RECORD_DIR/.releases.XXXXXX") || die "could not write in $RECORD_DIR. nothing has been changed."
    { [ ! -f "$RECORD" ] || awk -v k="$1" '$1 != k' "$RECORD"; printf '%s %s\n' "$1" "$2"; } > "$tmp"
    mv -f "$tmp" "$RECORD"
}

# The releases this run uses, before anything is installed or written. Without
# update, no lookup unless something is missing: the zola in ZOLA_BIN, and each
# action as the workflow pins it, or as the record has it for a new workflow.
resolve_releases() {
    local cur a uses shown="" looked="" note="; update looks for newer ones" note1="; update looks for a newer one"
    [ -z "$UPDATE" ] || note="" note1=""
    cur=$(installed_zola_version)
    if [ -z "$UPDATE" ] && [ -n "$cur" ] && in_series "$cur"; then
        ZOLA_VERSION="v$cur"
        # The fingerprint is for the workflow only: the zola here was checked
        # when it was installed.
        ZOLA_SHA256=$(record_get zola | awk -v v="$ZOLA_VERSION" '$1 == v { print $2 }')
        [ -n "$ZOLA_SHA256" ] || [ "$(pin_zola)" != "$ZOLA_VERSION" ] || ZOLA_SHA256=$(pin_sha)
        if [ -z "$ZOLA_SHA256" ] && [ -n "$GIT_REPO_URL" ]; then
            say "looking up zola $ZOLA_VERSION's fingerprint on GitHub, for the workflow"
            lookup_zola "$ZOLA_VERSION"
            looked=1
        fi
        [ -z "$ZOLA_SHA256" ] || record_set zola "$ZOLA_VERSION $ZOLA_SHA256"
        if [ -n "$(pin_zola)" ] && [ "$(pin_zola)" != "$ZOLA_VERSION" ]; then
            say "the workflow pinned zola $(pin_zola), and now pins $ZOLA_VERSION, the one installed here, so GitHub builds with the zola you preview with"
        fi
    else
        if [ -z "$UPDATE" ] && [ -n "$cur" ]; then
            say "the zola in $ZOLA_DIR is $cur, and this script's templates need a $ZOLA_SERIES release from $ZOLA_FLOOR on: taking the newest"
        fi
        # Said first, so a slow network doesn't look like a hang.
        say "looking up the newest releases on GitHub"
        lookup_zola ""
        looked=1
    fi
    if [ -z "$GIT_REPO_URL" ]; then
        say "release: zola $ZOLA_VERSION$note1"
        return 0
    fi
    for a in checkout upload-pages-artifact deploy-pages; do
        uses=""
        if [ -z "$UPDATE" ]; then
            uses=$(pin_action "$a")
            [ -n "$uses" ] || uses=$(record_get "actions/$a")
        fi
        if [ -n "$uses" ]; then
            uses="actions/$a@$uses"
        else
            [ -n "$looked" ] || say "looking up the newest releases of the GitHub actions the workflow uses"
            uses=$(lookup_action "$a") || exit 1
            record_set "actions/$a" "${uses#*@}"
            looked=1
        fi
        case "$a" in
            checkout) CHECKOUT_USES=$uses ;;
            upload-pages-artifact) UPLOAD_USES=$uses ;;
            deploy-pages) DEPLOY_USES=$uses ;;
        esac
        shown+="${uses##*# }, "
    done
    say "releases: zola $ZOLA_VERSION; ${shown%, } of the actions$note"
}

# Zola's newest release out RELEASE_WAIT_DAYS, or with $1, that release: into
# ZOLA_VERSION and ZOLA_SHA256, with every check against what the workflow pins.
lookup_zola() {
    local json got newest old
    json=$(releases_json getzola/zola) \
        || die "could not ask GitHub for zola's releases ($(net_hint)). nothing has been changed; run this again later."
    got=$(printf '%s\n' "$json" | pick_release "$ZOLA_SERIES" "$ZOLA_FLOOR" "$ZOLA_FILE" "$1") \
        || die "could not read GitHub's answer about zola's releases. nothing has been changed; run this again later."
    if [ -z "$got" ] && [ -n "$1" ]; then
        die "GitHub doesn't offer zola $1, the one in $ZOLA_DIR, as a stable release with its Linux file out $RELEASE_WAIT_DAYS days, so the workflow can't pin it. nothing has been changed. $SELF_CMD update takes the newest that is."
    fi
    [ -n "$got" ] || die "no stable zola $ZOLA_SERIES release from $ZOLA_FLOOR on, with its Linux file, has been out $RELEASE_WAIT_DAYS days yet. nothing has been changed."
    read -r ZOLA_VERSION ZOLA_SHA256 <<< "$got"
    [ "$ZOLA_SHA256" != "?" ] \
        || die "GitHub gives the fingerprint of zola $ZOLA_VERSION's Linux file in a form this script doesn't know, so the download can't be checked. nothing has been changed; a newer version of this script may know the form."
    # The file the workflow pins for this release can't have changed since.
    if [ "$(pin_zola)" = "$ZOLA_VERSION" ] && [ -n "$(pin_sha)" ] && [ "$(pin_sha)" != "$ZOLA_SHA256" ]; then
        die "GitHub's fingerprint for zola $ZOLA_VERSION's Linux file is $ZOLA_SHA256, but the workflow pins $(pin_sha) for it: the file has changed since it was pinned. nothing has been changed. check the release's page on GitHub before trusting it (guide: \"What a lookup refuses\")."
    fi
    [ -z "$1" ] || return 0
    # The release the workflow pins, passed over now: a step back, said.
    old=$(pin_zola)
    if [ -n "$old" ] && in_series "${old#v}" && newer "$old" "$ZOLA_VERSION"; then
        warn "the workflow pins zola $old, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days (pulled, marked a pre-release, or its file uploaded again since): using $ZOLA_VERSION. zola's releases page may say why."
    fi
    # A newer series is said, not taken.
    newest=$(printf '%s\n' "$json" | pick_release "" "" "$ZOLA_FILE" "") || newest=""
    [ -z "$newest" ] || [ "${newest%% *}" = "$ZOLA_VERSION" ] \
        || say "zola ${newest%% *} is out, but this script's templates are written for zola $ZOLA_SERIES: using $ZOLA_VERSION"
}

# Action $1's newest release out RELEASE_WAIT_DAYS, pinned by commit: prints
# "actions/$1@commit # tag".
lookup_action() {
    local a=$1 json tag commit old now
    old=$(pin_action "$a")
    json=$(releases_json "actions/$a") \
        || die "could not ask GitHub for actions/$a's releases ($(net_hint)). nothing has been changed; run this again later."
    tag=$(printf '%s\n' "$json" | pick_release "" "" "" "") \
        || die "could not read GitHub's answer about actions/$a's releases. nothing has been changed; run this again later."
    tag=${tag%% *}
    [ -n "$tag" ] || die "no stable actions/$a release has been out $RELEASE_WAIT_DAYS days yet. nothing has been changed."
    # By commit: a tag can be moved later, and a commit can't change.
    commit=$(tag_commit "actions/$a" "$tag") \
        || die "could not ask github.com which commit actions/$a's tag $tag names (git ls-remote failed, as git says above; it reads no git config: behind a proxy that inspects TLS, name its certificate in GIT_SSL_CAINFO). nothing has been changed; run this again later."
    [[ $commit =~ ^[0-9a-f]{40}$ ]] || die "could not find the commit actions/$a's tag $tag names. nothing has been changed."
    # The tag the workflow pins must still name the commit pinned for it. A
    # pinned tag that's gone (its release pulled) proves nothing.
    if [ -n "$old" ]; then
        now=$commit
        [ "${old#* # }" = "$tag" ] || now=$(tag_commit "actions/$a" "${old#* # }" 2>/dev/null) || now=""
        [ -z "$now" ] || [ "$now" = "${old%% *}" ] \
            || die "actions/$a's tag ${old#* # } now names commit $now, but the workflow pins ${old%% *} for it: the tag has been moved since. nothing has been changed. check the release's page on GitHub before trusting it (guide: \"What a lookup refuses\")."
        if newer "${old#* # }" "$tag"; then
            warn "the workflow pins actions/$a ${old#* # }, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days (pulled, or marked a pre-release): using $tag."
        fi
    fi
    printf 'actions/%s@%s # %s\n' "$a" "$commit" "$tag"
}

# Every blog on this computer runs one zola, ZOLA_BIN. Unpacked in ZOLA_DIR, not
# /tmp, which can be mounted noexec; the move is one rename, so a preview starting
# meanwhile never finds half a file.
install_zola() {
    local current url got on_path=""
    current=$(installed_zola_version)
    case ":$PATH:" in *":$ZOLA_DIR:"*) on_path=1 ;; esac
    if [ "$current" = "${ZOLA_VERSION#v}" ]; then
        say "zola $current is installed in $ZOLA_DIR"
    else
        if [ -n "$current" ]; then
            say "replacing zola $current in $ZOLA_DIR with ${ZOLA_VERSION#v}: every blog on this computer runs this one"
        else
            say "installing zola ${ZOLA_VERSION#v} into $ZOLA_DIR..."
        fi
        url="https://github.com/getzola/zola/releases/download/$ZOLA_VERSION/${ZOLA_FILE//\{tag\}/$ZOLA_VERSION}"
        mkdir -p "$ZOLA_DIR" || die "could not make $ZOLA_DIR. nothing has been changed."
        TMP_ZOLA=$(mktemp -d "$ZOLA_DIR/.zola-new.XXXXXX") || die "could not make a folder in $ZOLA_DIR. nothing has been changed."
        curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 --connect-timeout 30 --max-time 900 \
            -o "$TMP_ZOLA/zola.tar.gz" "$url" \
            || die "could not download $url (no network, a proxy refusing github.com or release-assets.githubusercontent.com, or, with a 404, the release pulled or its file removed). nothing has been changed."
        got=$(sha256sum "$TMP_ZOLA/zola.tar.gz" | cut -d ' ' -f 1)
        [ "$got" = "$ZOLA_SHA256" ] \
            || die "$url isn't the file it should be: its sha256 is $got, not $ZOLA_SHA256. it wasn't installed, and nothing has been changed."
        tar --no-same-owner -xzf "$TMP_ZOLA/zola.tar.gz" -C "$TMP_ZOLA" zola \
            || die "could not take zola out of $url: this release may lay its archive out differently. nothing has been changed; a newer version of this script may know it."
        # Too old a glibc, say: the system's own message names the one it needs.
        "$TMP_ZOLA/zola" --version >/dev/null 2>&1 \
            || die "zola ${ZOLA_VERSION#v} doesn't run here ($("$TMP_ZOLA/zola" --version 2>&1 | head -n 1)): it wasn't installed, and $ZOLA_DIR keeps the zola it had. nothing has been changed."
        mv -f "$TMP_ZOLA/zola" "$ZOLA_BIN"
        rm -rf "$TMP_ZOLA"
        TMP_ZOLA=""
        say "installed: $("$ZOLA_BIN" --version) (sha256 ${got:0:12}...)"
    fi
    [ -z "$ZOLA_SHA256" ] || record_set zola "$ZOLA_VERSION $ZOLA_SHA256"
    export PATH="$ZOLA_DIR:$PATH"
    [ -n "$on_path" ] \
        || say "note: $ZOLA_DIR is not on your PATH, so a new terminal will not run this zola: log out and back in (guide: \"Zola not found after installing\")."
}

# Book mode: ./genbook makes content/ on every build, and .gitignore has left it
# out since v116. Files git tracked there before stay tracked until removed.
note_tracked_content() {
    [ "$BOOK_MODE" = true ] && [ -d .git ] || return 0
    [ -n "$(git ls-files -- content 2>/dev/null | head -n 1)" ] || return 0
    say "note: git still tracks files in content/, which ./genbook makes on every build. once, from inside the blog folder: git rm -r -q --cached content, then commit (guide: \"Book mode\")."
}

# What this script installed, and nothing else: git, curl and python3 came from
# the system, and other programs use them. Blogs and their workflows are left
# as they are; each workflow downloads the zola it pins.
remove_zola() {
    local cur
    cur=$(installed_zola_version)
    if [ -e "$ZOLA_BIN" ]; then
        rm -f "$ZOLA_BIN" || die "could not delete $ZOLA_BIN."
        say "removed zola${cur:+ $cur} from $ZOLA_DIR"
    else
        say "there's no zola in $ZOLA_DIR"
    fi
    if [ -d "$RECORD_DIR" ]; then
        rm -rf "$RECORD_DIR" || die "could not delete $RECORD_DIR."
        say "removed $RECORD_DIR, the record of the releases it pinned"
    fi
    say "your blogs are as they were, and GitHub still builds each one with the zola its workflow pins."
    say "the next run of this script downloads zola again. git, curl and python3 stay: this script didn't install them."
}

usage() {
    cat << EOF
usage: $SELF_CMD [update | remove]
  (nothing)  create the blog, or update it from the settings, with the zola
             already installed and the releases already pinned
  update     the same, moving to the newest zola $ZOLA_SERIES release and the newest
             GitHub actions, each out $RELEASE_WAIT_DAYS days
  remove     delete the zola in $ZOLA_DIR and the record of the releases
guide: zola-blog-guide.md
EOF
}

# =============================================================================
# Host, dates and git
# =============================================================================
# CUSTOM_DOMAIN replaces base_url and nothing else.
resolve_host_config() {
    local repo user name
    if [ -z "$GIT_REPO_URL" ]; then
        # Zola needs a base_url; the preview replaces it, and no repository links show.
        BASE_URL="${CUSTOM_DOMAIN:-https://yourusername.github.io}"
        BASE_URL="${BASE_URL%/}"
        return 0
    fi
    repo=${GIT_REPO_URL#https://github.com/}
    repo=${repo%/} repo=${repo%.git}
    user=${repo%%/*} name=${repo##*/}
    # GitHub wants a user site's repository name in lower case: John's
    # john.github.io is a user site, not a project at /john.github.io/.
    if [ "$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]')" = "$(printf '%s' "$user" | tr '[:upper:]' '[:lower:]').github.io" ]; then
        BASE_URL="https://$user.github.io"
    else
        BASE_URL="https://$user.github.io/$name"
    fi
    [ -z "$CUSTOM_DOMAIN" ] || BASE_URL="${CUSTOM_DOMAIN%/}"
    SOURCE_URL="https://github.com/$repo/blob/main/content"
    HISTORY_URL="https://github.com/$repo/commits/main/content"
    HISTORY_HINT="Click a commit, then 'Display the rich diff' for rendered prose"
    FORGE_URL="https://github.com/$repo"
    REMOTE_URL="git@github.com:$repo.git"
}

resolve_dates() {
    TODAY=$(date +%Y-%m-%d)
    YESTERDAY=$(date -d '1 day ago' +%Y-%m-%d)
    TWO_DAYS_AGO=$(date -d '2 days ago' +%Y-%m-%d)
}

# The repository and its hook, and nothing committed: what a commit holds, and
# whose name and time it carries, is the author's to check (guide: "Your first
# blog", step 6).
init_git_repo() {
    if ! have_git; then
        say "git not installed - skipping repo init (blog still works)"
        return 0
    fi
    # On a failed init, stop: add and commit would reach a repository the folder
    # sits inside.
    if ! git init -q -b main 2>/dev/null; then
        say "git init failed - run manually later"
        return 0
    fi
    say "initialised git repo on branch: main"
    install_hook
    say "nothing is committed: check what's in the folder, then commit it yourself (guide: \"Your first blog\", step 6)"
    update_git_remote
}

update_git_remote() {
    [ -n "$REMOTE_URL" ] || return 0
    if ! have_git; then
        say "git not installed; remote not updated"
        return 0
    fi
    # The blog folder's own repository: git would also find one the folder sits in.
    if [ ! -e .git ]; then
        say "not a git repo; remote not updated"
        return 0
    fi
    if ! git remote get-url origin >/dev/null 2>&1; then
        git remote add origin "$REMOTE_URL"
        say "added remote 'origin': $REMOTE_URL"
    # The URL as configured: get-url applies url.*.insteadOf and would never match.
    elif [ "$(git config --get remote.origin.url || true)" != "$REMOTE_URL" ]; then
        git remote set-url origin "$REMOTE_URL"
        say "updated remote 'origin' to $REMOTE_URL"
    fi
}

# The check the deploy runs: a broken link stops the run too.
build_site() {
    say ""
    bash "$BLOG_DIR/build" || exit 1
}

# exec replaces this process, so the EXIT trap never fires: clean up first. Skipped
# with START_PREVIEW=false or no terminal, so another script can drive this one.
start_preview_server() {
    cleanup
    say ""
    if [ "$START_PREVIEW" != true ] || [ ! -t 1 ]; then
        say "skipping the live preview. start it any time, from anywhere:"
        say "    $BLOG_DIR/serve"
        return 0
    fi
    say "starting the live preview (your browser will open). Ctrl+C to stop."
    say "to start it again later, from anywhere: $BLOG_DIR/serve"
    say ""
    exec bash "$BLOG_DIR/serve"
}

# =============================================================================
# The script's files, and the hand-edit check
# =============================================================================
# The script-owned files, as "path render_function": the one list the writer, the
# manifest and the hand-edit check read. The last four are conditional: a file
# this run doesn't write (your own favicon) must not be claimed, or the manifest
# would record your bytes and a later run delete them.
owned_files() {
    cat <<'OWNED'
.gitignore render_gitignore
serve render_serve
build render_build
new render_new
README.md render_readme
zola.toml render_site_config
templates/base.html render_base_html
templates/components.html render_components
templates/index.html render_index_html
templates/page.html render_page_html
templates/section.html render_section_html
templates/taxonomy_list.html render_taxonomy_list
templates/taxonomy_single.html render_taxonomy_single
templates/404.html render_404_html
OWNED
    [ -z "$FAVICON_MARK" ] || printf '%s\n' "static/favicon.svg render_favicon_svg"
    [ "$ENABLE_SEARCH" != true ] || printf '%s\n' "static/search.js render_search_js"
    [ -z "$GIT_REPO_URL" ] || printf '%s\n' ".github/workflows/deploy.yml render_github_workflow"
    [ "$BOOK_MODE" != true ] || printf '%s\n' "genbook render_genbook"
}

# What the last run wrote, "sha256  path"; committed, so a checkout keeps the pair.
readonly OWNED_MANIFEST=".zola-blog-setup.manifest"

manifest_sha() { awk -v p="$1" '$2 == p { print $1 }' "$OWNED_MANIFEST"; }
sha256_of() { sha256sum "$1" | cut -d ' ' -f 1; }

# Against what the last run wrote, not what this run would, so a changed setting or
# a newer script never looks like an edit. No manifest: every file counts as edited.
check_owned_file_drift() {
    local path fn again edited=()
    [ "$REGENERATE_TEMPLATES" != true ] || return 0
    while read -r path fn; do
        [ -f "$path" ] && [ "$path" != README.md ] || continue   # README.md: readme_is_yours
        if [ ! -f "$OWNED_MANIFEST" ] || [ "$(sha256_of "$path")" != "$(manifest_sha "$path")" ]; then
            edited+=("$path")
        fi
    done < <(owned_files)
    [ "${#edited[@]}" -gt 0 ] || return 0
    warn "these files have been changed since this script last wrote them, and a re-run"
    warn "would overwrite them:"
    printf '  - %s\n' "${edited[@]}" >&2
    [ -f "$OWNED_MANIFEST" ] || warn "(there's no $OWNED_MANIFEST, the script's record of what it wrote, so every file is listed)"
    again="REGENERATE_TEMPLATES=true $SELF_CMD"
    warn "change the script's settings or its render_ functions instead (guide: \"The hand-edit check\")."
    warn "to overwrite them anyway, run once with"
    warn "    $again"
    warn "nothing has been changed."
    exit 1
}

# Written last, once every file is in place.
write_owned_manifest() {
    local path fn
    while read -r path fn; do
        [ -f "$path" ] || continue
        [ "$path" != README.md ] || [ -z "$README_KEPT" ] || continue
        printf '%s  %s\n' "$(sha256_of "$path")" "$path"
    done < <(owned_files) > "$OWNED_MANIFEST"
}

# README.md becomes yours once edited: nothing is built from it, and people edit it
# on GitHub. Deleting it gets the script's back.
readme_is_yours() {
    [ -f README.md ] || return 1
    [ -f "$OWNED_MANIFEST" ] || return 0
    [ "$(sha256_of README.md)" != "$(manifest_sha README.md)" ]
}

# Remove a file this run doesn't write, only if it's the bytes the last run wrote:
# 0 removed; 1 edited since, kept; 2 no record either way, kept.
remove_if_ours() {
    local recorded
    [ -f "$OWNED_MANIFEST" ] || return 2
    recorded=$(manifest_sha "$1")
    [ -n "$recorded" ] || return 2
    [ "$(sha256_of "$1")" = "$recorded" ] || return 1
    rm -f "$1"
}

write_owned_files() {
    local path fn rc readme=" README.md," genbook=""
    mkdir -p templates static
    while read -r path fn; do
        if [ "$path" = README.md ] && readme_is_yours; then
            README_KEPT=1
            say "README.md is yours: it was edited, so runs leave it alone (delete it to get the script's back)"
            continue
        fi
        [ "$path" = "${path%/*}" ] || mkdir -p "${path%/*}"
        "$fn" > "$path"
    done < <(owned_files)
    chmod +x serve build new
    [ ! -f genbook ] || chmod +x genbook
    # A file whose setting is now off goes, if it's as the script last wrote it.
    if [ "$BOOK_MODE" != true ] && [ -f genbook ] && remove_if_ours genbook; then
        say "removed genbook (BOOK_MODE is false)"
    fi
    # Gone in v120: the commit hook cleans pictures instead.
    if [ -f attach ] && remove_if_ours attach; then
        say "removed ./attach: pictures and videos are cleaned as they're committed now"
    fi
    if [ "$ENABLE_SEARCH" != true ] && [ -f static/search.js ] && remove_if_ours static/search.js; then
        say "removed static/search.js (ENABLE_SEARCH is false)"
    fi
    if [ -z "$FAVICON_MARK" ]; then
        if [ -f static/favicon.svg ]; then
            if remove_if_ours static/favicon.svg; then say "removed static/favicon.svg (FAVICON_TEXT draws none)"; fi
        elif [ -z "$IS_UPDATE" ]; then
            warn "FAVICON_TEXT draws no favicon (SITE_TITLE has no A-Z or 0-9 for \"auto\" to draw, or it's empty): set it to up to 3 characters, or add static/favicon.svg yourself."
        fi
    fi
    if [ -z "$GIT_REPO_URL" ] && [ -f .github/workflows/deploy.yml ]; then
        if remove_if_ours .github/workflows/deploy.yml; then
            rmdir .github/workflows .github 2>/dev/null || true
            say "removed .github/workflows/deploy.yml (GIT_REPO_URL is empty); commit the deletion to stop the deploy"
        else
            warn "GIT_REPO_URL is empty, but .github/workflows/deploy.yml was edited by hand, or not written by this script, so it's still here. it goes on deploying on every push, and base_url is a placeholder now: delete it yourself once you've kept what you need."
        fi
    fi
    # Left by v110 and older: config.toml, which zola.toml replaces (Zola reads
    # zola.toml first), and templates/atom.xml, which would override Zola's own feed.
    for path in config.toml templates/atom.xml; do
        [ -f "$path" ] || continue
        rc=0
        remove_if_ours "$path" || rc=$?
        if [ "$rc" -eq 0 ]; then
            case "$path" in
                config.toml) say "removed config.toml: the settings are in zola.toml now" ;;
                *) say "removed templates/atom.xml: the feed uses Zola's own template now" ;;
            esac
        elif [ "$path" = config.toml ]; then
            warn "config.toml was edited by hand, or not written by this script, so it's still here, and Zola ignores it: it reads zola.toml. delete config.toml once you've kept what you need."
        else
            warn "templates/atom.xml was edited by hand, or not written by this script, so it's still here, and the feed uses it instead of Zola's own template. delete it to use Zola's."
        fi
    done
    # Without its _index.md, Zola publishes nothing in content/attachments/.
    if [ -d content/attachments ] && [ ! -f content/attachments/_index.md ]; then
        warn "content/attachments/ has no _index.md, so Zola won't publish what's in it and every @/attachments/ link stops the build. the guide's \"Pictures, GIFs and video\" gives the file."
    fi
    if [ "$MASTHEAD" = image ] && [ ! -f static/logo.svg ]; then
        warn "MASTHEAD is \"image\" but static/logo.svg is not there; the masthead shows an empty box until you add it (guide: \"Using a logo\")."
    fi
    write_owned_manifest
    [ -z "$README_KEPT" ] || readme=""
    [ "$BOOK_MODE" != true ] || genbook=" genbook,"
    say "wrote the script-owned files (zola.toml, templates/, serve, build, new,${genbook}${readme} .gitignore)"
}

# content/ (or book/) and the starter pictures: written once, never rewritten.
write_content_if_absent() {
    local name names=()
    read -r -a names <<< "$MENU_PAGES"
    if [ "$BOOK_MODE" = true ]; then
        mkdir -p book/attachments
        write_absent book/attachments/demo.svg render_demo_svg
        write_absent book/SUMMARY.md render_book_summary
        write_absent book/about.md render_book_about
        write_absent book/hello-world.md render_book_hello_world
        write_absent book/second-page.md render_book_second_page
        write_absent book/colophon.md render_book_colophon
        for name in ${names[@]+"${names[@]}"}; do
            [ -e "book/$name.md" ] || render_book_menu_page "$name" > "book/$name.md"
        done
        say "wrote book/ (yours from here; a re-run will not touch it; ./build makes content/ from it)"
        return 0
    fi
    mkdir -p content/attachments
    write_absent content/attachments/_index.md render_attachments_index
    write_absent content/attachments/demo.svg render_demo_svg
    write_absent content/_index.md render_home_index
    write_absent content/about.md render_about
    write_absent content/hello-world.md render_hello_world
    write_absent content/second-post.md render_second_post
    # A starter page for each other MENU_PAGES name, so a new blog builds.
    for name in ${names[@]+"${names[@]}"}; do
        [ ! -e "content/$name.md" ] && [ ! -e "content/$name/_index.md" ] || continue
        [ "$name" = "${name%/*}" ] || mkdir -p "content/${name%/*}"
        render_menu_page "$name" > "content/$name.md"
    done
    say "wrote content/ (yours from here; a re-run will not touch it)"
}

write_absent() {
    [ -e "$1" ] || "$2" > "$1"
}

# =============================================================================
# Templates: one render_ function per file written
# =============================================================================
# Quoted 'EOF' is literal; unquoted EOF expands ${VAR} (those carry a "Vars:" note).

# Editors' swap, lock and backup files carry your login, this computer's name and
# the folder's path: vim's .name.swp, Emacs's .#name and #name#, and name~.
render_gitignore() {
    cat << 'EOF'
/public
/static/processed_images
*~
.*.sw[a-p]
.#*
\#*#
# exiftool's backup of a photo it has cleaned: the original, with the location
# and camera data still in it
*_original
EOF
    [ "$BOOK_MODE" = true ] || return 0
    cat << 'EOF'
# Book mode: ./genbook makes content/ from book/, here and on GitHub
/content/
/.genbook.*
EOF
}

# In book mode, genbook first and on each change in book/: zola serve watches content/.
render_serve() {
    cat << 'EOF'
#!/usr/bin/env bash
# the preview, at http://127.0.0.1:1111: drafts are shown, marked "(draft)"
cd "$(dirname "$0")" || exit 1
EOF
    if [ "$BOOK_MODE" = true ]; then
        cat << 'EOF'
# content/ from book/ first, then again on each change in book/, checked every
# second; zola serve reloads the page on the change in content/.
bash ./genbook || exit 1
stamp() { find book -printf '%p %T@ %s\n' 2>/dev/null | LC_ALL=C sort | cksum; }
(
    last=$(stamp)
    while sleep 1; do
        now=$(stamp)
        [ "$now" = "$last" ] && continue
        last=$now
        bash ./genbook || true
    done
) &
trap 'kill $! 2>/dev/null' EXIT
zola serve --open --drafts
EOF
        return 0
    fi
    cat << 'EOF'
exec zola serve --open --drafts
EOF
}

# ./new: a post with its front matter filled in, as a draft at the end of the
# list; weights are read from the top of content/ only. The title is made from
# the name, so it needs no escaping. In book mode it says where a page goes.
render_new() {
    if [ "$BOOK_MODE" = true ]; then
        cat << 'EOF'
#!/usr/bin/env bash
echo "this site is in book mode: a page is a file in book/, starting with its title as a # heading; a link to it in book/SUMMARY.md, such as - [Tea in the hills](./tea-in-the-hills.md), puts it in the outline. guide: \"Book mode\"." >&2
exit 2
EOF
        return 0
    fi
    cat << 'EOF'
#!/usr/bin/env bash
# make a new post, as a draft at the end of the list: ./new tea-in-the-hills
set -euo pipefail
cd "$(dirname "$0")"
name="${1:-}"
case "$name" in
    ""|-*|*[!a-z0-9-]*) name="" ;;
esac
if [ -z "$name" ] || [ "$#" -ne 1 ]; then
    echo "usage: ./new name-of-the-post   (lowercase letters, digits and dashes: it becomes the address, and the title until you change it)" >&2
    exit 2
fi
for taken in "content/$name.md" "content/$name"; do
    if [ -e "$taken" ]; then
        echo "$taken already exists; choose another name" >&2
        exit 1
    fi
done
max=$(cat content/*.md content/*/index.md content/*/_index.md 2>/dev/null \
    | sed -n 's/^weight *[=:] *\([0-9][0-9]*\).*/\1/p' | sort -n | tail -n 1 || true)
weight=$(( ${max:-0} + 10 ))
title="${name//-/ }"
title="$(printf '%s' "${title:0:1}" | tr '[:lower:]' '[:upper:]')${title:1}"
cat > "content/$name.md" << POST
+++
title = "$title"
weight = $weight
date = $(date +%Y-%m-%d)
draft = true
+++

POST
echo "made content/$name.md, a draft at weight $weight: ./serve shows it, and deleting its draft line publishes it."
EOF
}

# .git/hooks/pre-commit: pictures and videos lose their location and camera data
# as they're committed, the step that publishes them, however they came into
# the folder. -tagsfromfile @ -orientation keeps the tag a photo needs to stand
# upright. SVG and WebM can't be written by exiftool, and aren't touched.
render_precommit() {
    cat << 'EOF'
#!/usr/bin/env bash
# zola-blog-setup: strips location and camera data from the pictures and videos
# being committed. Written by the setup script while this line is here.
set -euo pipefail
files=()
while IFS= read -r -d '' f; do
    case "${f,,}" in *.jpg|*.jpeg|*.png|*.gif|*.webp|*.tif|*.tiff|*.heic|*.mp4|*.m4v|*.mov) files+=("$f") ;; esac
done < <(git diff --cached --name-only --diff-filter=AM -z -- content/attachments book/attachments)
[ "${#files[@]}" -gt 0 ] || exit 0
if ! command -v exiftool >/dev/null 2>&1; then
    echo "commit stopped: exiftool removes the location and camera data from pictures and videos before they're published. install it (on Debian, Devuan or Ubuntu: sudo apt install libimage-exiftool-perl), then commit again." >&2
    exit 1
fi
exiftool -q -q -m -overwrite_original -all= -tagsfromfile @ -orientation -- "${files[@]}" \
    || { echo "commit stopped: exiftool couldn't clean one of: ${files[*]}" >&2; exit 1; }
git add -- "${files[@]}"
echo "removed the location and camera data from ${#files[@]} picture(s) and video(s) being committed"
EOF
}

# The hook, unless one of the user's own is there.
install_hook() {
    local hook
    hook=$(git rev-parse --git-path hooks/pre-commit 2>/dev/null) || return 0
    if [ -e "$hook" ] && ! grep -q '^# zola-blog-setup: strips' "$hook"; then
        warn "$hook is your own, so it's left as it is: pictures you commit keep their location and camera data unless you remove it (guide: \"Pictures, GIFs and video\")."
        return 0
    fi
    mkdir -p "${hook%/*}"
    render_precommit > "$hook"
    chmod +x "$hook"
}

# In book mode, genbook first, here as on GitHub: content/ isn't committed.
render_build() {
    cat << 'EOF'
#!/usr/bin/env bash
# build the static site into ./public for deployment, after checking the links
# in content/; the deploy workflow runs this same file
set -euo pipefail
cd "$(dirname "$0")"
EOF
    [ "$BOOK_MODE" != true ] || cat << 'EOF'

bash ./genbook
EOF
    cat << 'EOF'

# Zola checks @/ links and every #anchor, but not links written another way.
# This lists each broken link it can find, by file and line: a missing @/ file
# or video, an @/ link in HTML, a .md link without @/, a file named from a page
# that isn't index.md or _index.md, and, on a site under a path such as /notes/,
# a link starting with /. Drafts are skipped, as zola build skips them.
us=$(printf '\037')
base_path=$(sed -n 's|^base_url = "[a-z]*://[^/"]*\([^"]*\)"$|\1|p' zola.toml)
broken=$(find content ! -type d | LC_ALL=C sort | LC_ALL=C BASE_PATH="${base_path%/}" awk '
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
    function norm(p,   n, i, k, part, out) {          # a/./b/../c -> a/c
        n = split(p, part, "/"); k = 0
        for (i = 1; i <= n; i++) {
            if (part[i] == "" || part[i] == ".") continue
            if (part[i] == "..") { if (k > 0) k--; continue }
            seg[++k] = part[i]
        }
        out = ""
        for (i = 1; i <= k; i++) out = out (i > 1 ? "/" : "") seg[i]
        return out
    }
    function at(p) { gsub(/ /, "%20", p); return "@/" p }   # a space breaks a Markdown link
    # A file genbook made is reported as the file in book/ it was made from,
    # at the line there, which its marker line gives.
    function report(why) { printf "%s\037%d\037%s\037%s\n", (src != "" ? src : file), lineno - delta, shown, why }
    function check(dest, html, as_written,   p, r, name, away) {
        shown = as_written != "" ? as_written : dest
        if (substr(dest, 1, 2) == "@/") {
            if (html) { report("Zola leaves @/ as it is in HTML; write this as a Markdown link or picture"); return }
            p = unhex(substr(dest, 3)); sub(/[#?].*$/, "", p)
            if (("content/" p) in exists) {
                if (unpub != "" && p ~ /^attachments\// && p !~ /\.md$/) report(unpub)
                return
            }
            if (("content/" p ".md") in exists) report(no "content/" p "; write " at(p ".md"))
            else if (p ~ /\/$/ && (("content/" p "_index.md") in exists)) report(no "content/" p "; write " at(p "_index.md"))
            else report(no "content/" p)
            return
        }
        if (dest ~ /^#/ || dest ~ /^[A-Za-z][A-Za-z0-9+.-]*:/ || dest ~ /^\/\//) return
        p = unhex(dest); sub(/[#?].*$/, "", p)
        if (p == "") return
        if (p ~ /\.md$/) {
            r = norm((p ~ /^\// ? "content" : dir) "/" p)
            if (r in exists) report("without @/ this leads to \"page not found\"; write " at(substr(r, 9)))
            else report(no r)
            return
        }
        if (p ~ /^\//) {
            if (ENVIRON["BASE_PATH"] != "") report("the blog lives under " ENVIRON["BASE_PATH"] "/, and this leaves it; write @/ and the path from content/, or a relative link")
            return
        }
        if (p !~ /\.[A-Za-z0-9]+$/ || p ~ /^\.\.\//) return
        r = norm(dir "/" p)
        if (bundle) { if (!(r in exists)) report(no r); return }
        name = p; sub(/^.*\//, "", name)
        away = "a page looks for this under its own address; "
        if (src != "") {                           # a book page: book/attachments/, linked ./attachments/
            if (("content/attachments/" name) in exists) report(away "write ./attachments/" name)
            else report(away "put it in book/attachments/ and write ./attachments/" name)
        }
        else if (r in exists) report(away "write " at(substr(r, 9)))
        else if (("content/attachments/" name) in exists) report(away "write " at("attachments/" name))
        else report(away "put it in content/attachments/ and write " at("attachments/" name))
    }
    { exists[$0] = 1; if ($0 ~ /\.md$/) md[++n] = $0 }
    END {
        hex = "0123456789abcdef"; q = sprintf("%c", 39); no = "there" q "s no "
        attr = "(href|src)=[\"" q "][^\"" q "]*[\"" q "]"
        # Why Zola is not publishing content/attachments/, if it is not: then no
        # @/ link to a file in it resolves, though the file is there.
        unpub = ""; af = "content/attachments/_index.md"
        if (!(af in exists)) unpub = no af ", so Zola publishes nothing in content/attachments/; the guide" q "s \"Pictures, GIFs and video\" gives the file"
        else {
            ast = 0
            while ((getline al < af) > 0) {
                sub(/\r$/, "", al); ak = al; gsub(/[ \t]/, "", ak)
                if (ast == 0) { if (ak == "") continue; if (ak != "+++" && ak != "---") break; afm = ak; ast = 1; continue }
                if (ak == afm) break
                if (al ~ /^[ \t]*render[ \t]*[=:][ \t]*false([ \t#]|$)/) { unpub = af " says render = false, so Zola publishes nothing in content/attachments/; delete that line"; break }
            }
            close(af)
        }
        for (i = 1; i <= n; i++) {
            file = md[i]; dir = file; sub(/\/[^\/]*$/, "", dir)
            bundle = file ~ /(^|\/)_?index\.md$/
            lineno = 0; state = 0; fence = 0; src = ""; delta = 0
            while ((getline line < file) > 0) {
                lineno++; sub(/\r$/, "", line)
                if (state == 0) {                      # before the front matter
                    if (line ~ /^[ \t]*$/) continue
                    if (line ~ /^[ \t]*(\+\+\+|---)[ \t]*$/) { fm = line; gsub(/[ \t]/, "", fm); state = 1; continue }
                    state = 2
                } else if (state == 1) {               # in it: a draft is skipped
                    t = line; gsub(/[ \t]/, "", t)
                    if (t == fm) { state = 2; continue }
                    if (line ~ /^[ \t]*draft[ \t]*[=:][ \t]*true([ \t#]|$)/) break
                    if (lineno == 2 && index(line, "# genbook: made from book/") == 1) {   # genbook: its marker
                        src = substr(line, 22); sub(/[,;].*$/, "", src)
                        if (match(line, /whose line [0-9]+ is line [0-9]+ here/)) {
                            split(substr(line, RSTART, RLENGTH), w, " "); delta = w[6] - w[3]
                        }
                    }
                    continue
                }
                if (line ~ /^[ \t]*([`][`][`]|~~~)/) { fence = !fence; continue }
                if (fence) continue
                gsub(/`[^`]*`/, "", line)              # code spans
                while (match(line, /\{\{<[ \t]*video[ \t][^}]*\}\}/)) {
                    comp = substr(line, RSTART, RLENGTH)
                    line = substr(line, 1, RSTART - 1) " " substr(line, RSTART + RLENGTH)
                    if (match(comp, /src="[^"]*"/)) { s = substr(comp, RSTART + 5, RLENGTH - 6); check("@/" s, 0, s) }
                }
                s = line                               # [text](dest) and ![alt](dest)
                while (match(s, /\]\([^)]*\)/)) {
                    d = substr(s, RSTART + 2, RLENGTH - 3); s = substr(s, RSTART + RLENGTH)
                    sub(/^[ \t]+/, "", d)
                    if (substr(d, 1, 1) == "<") { d = substr(d, 2); sub(/>.*$/, "", d) } else sub(/[ \t].*$/, "", d)
                    check(d, 0, "")
                }
                if (match(line, /^ ? ? ?\[[^]^][^]]*\]:[ \t]*/)) {   # [label]: dest
                    d = substr(line, RSTART + RLENGTH)
                    if (substr(d, 1, 1) == "<") { d = substr(d, 2); sub(/>.*$/, "", d) } else sub(/[ \t].*$/, "", d)
                    check(d, 0, "")
                }
                s = line                               # href="..." and src="..."
                while (match(s, attr)) {
                    d = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
                    sub(/^(href|src)=./, "", d); check(substr(d, 1, length(d) - 1), 1, "")
                }
            }
            close(file)
        }
    }' | LC_ALL=C sort -t "$us" -k1,1 -k2,2n)
if [ -n "$broken" ]; then
    printf '%s\n' "$broken" | LC_ALL=C awk -F "$us" '
        !seen[$0]++ { printf "%s:%s: %s\n    %s\n", $1, $2, $3, $4; n++ }
        END { printf "\nstopped: %d broken link%s, listed above. fix %s, then run ./build again.\n", n, (n == 1 ? "" : "s"), (n == 1 ? "it" : "them") }' >&2
    exit 1
fi

# Zola drops a page missing its section's sort field, warns, exits 0, and still
# lists its URL in sitemap.xml: turn that warning into a failure.
out=$(zola build 2>&1) || { printf '%s\n' "$out" >&2; exit 1; }
printf '%s\n' "$out"
# Matched in the shell: piped to grep -q, a long log could die of the broken
# pipe when grep quits at the match, and pipefail would make that a miss.
case $out in
    *'page(s) ignored'*)
        {
            printf '\n%s\n' "the page(s) named above produced no HTML, but sitemap.xml still lists"
            printf '%s\n'    "their URLs, so the published site would point crawlers at a 404."
            printf '%s\n'    "give the page a weight, or add hidden = true to its front matter if it"
            printf '%s\n'    "should exist without being listed. nothing was published."
        } >&2
        exit 1 ;;
esac
EOF
}

# ./genbook, in book mode: content/ from book/. Everything is checked and written
# into a temporary folder, then moved in: a stop changes nothing, and a running
# preview never sees half a site. Each file it writes carries a marker line, by
# which it tells its own files from anything else. bash and awk, mawk's
# included: GitHub's build runs it too. Vars: MENU_PAGES.
render_genbook() {
    cat << EOF
#!/usr/bin/env bash
# make content/ from book/: the outline, book/SUMMARY.md, and every page in
# book/. ./build and ./serve run this first, and ./serve again on each change
# in book/. Guide: "Book mode".
set -euo pipefail
cd "\$(dirname "\$0")"

# MENU_PAGES and OUTLINE_NUMBERS, as the setup script last wrote them.
menu="${MENU_PAGES}"
numbers="${OUTLINE_NUMBERS}"
EOF
    cat << 'EOF'

# The line after +++ in every file this script writes: its mark.
marker='# genbook:'
stop() { printf '%s\n' "$*" >&2; exit 1; }
ours() { case "$(sed -n 2p "$1" 2>/dev/null)" in "$marker"*) return 0 ;; esac; return 1; }

[ -f book/SUMMARY.md ] || stop "there's no book/SUMMARY.md, the outline the home page shows (guide: \"Book mode\"). nothing has been changed."

# Everything is written here first, in the blog's folder, so the moves into
# content/ are renames; a stop leaves content/ as it was.
# One genbook at a time: ./serve's, and ./build's or the setup script's, would
# otherwise delete each other's files.
exec 9> .genbook.lock
flock 9
tmp=$(mktemp -d .genbook.XXXXXX) || stop "could not make a temporary folder in $PWD"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/content/unlisted" "$tmp/kids"

# Pictures, GIFs and videos: book/attachments/, copied to content/attachments/,
# where Zola publishes them. content/attachments/.genbook lists what an earlier
# run copied. Anything else there is yours, as a book from before v116 kept its
# pictures there: moved into book/attachments/, never deleted; one whose name
# book/attachments/ already holds, with other bytes, stops the run.
att_list=content/attachments/.genbook
clash=()
while IFS= read -r f; do
    rel=${f#content/}
    case "$rel" in attachments/_index.md|attachments/.genbook) continue ;; esac
    grep -qxF "$rel" "$att_list" 2>/dev/null && continue
    if [ ! -e "book/$rel" ]; then
        mkdir -p "book/${rel%/*}"
        mv -n -- "$f" "book/$rel" || stop "could not move $f to book/$rel. nothing else has been changed."
        printf 'moved %s to book/%s: pictures and videos live in book/attachments/ now\n' "$f" "$rel"
    elif ! cmp -s "book/$rel" "$f"; then
        clash+=("$f")
    fi
done < <(find content/attachments -type f 2>/dev/null | LC_ALL=C sort)
if [ "${#clash[@]}" -gt 0 ]; then
    printf '%s\n' "these files in content/attachments/ have the name of a different file in book/attachments/, where pictures and videos live now:" >&2
    printf '  - %s\n' "${clash[@]}" >&2
    stop "keep one of each: delete it, or rename it and the links to it, then run this again. nothing has been changed."
fi
: > "$tmp/atts"
[ ! -d book/attachments ] || (cd book && find attachments -type f ! -name '.*' -print) | LC_ALL=C sort > "$tmp/atts"

# The links that rewrite a page's links and the outline's: a link to name.md,
# ./name.md or @/name.md, with an optional #fragment; fenced code and code
# spans are left as they are. Shared by the outline and the pages.
links_awk='
    function fixplain(p,   frag, lead, stem) {
        frag = ""; if (match(p, /[#?]/)) { frag = substr(p, RSTART); p = substr(p, 1, RSTART - 1) }
        if (p == "" || p ~ /^[A-Za-z][A-Za-z0-9+.-]*:/ || p ~ /^\/\//) return p frag
        lead = p; sub(/^(\.\/|@\/)/, "", lead)
        if (lead ~ /^attachments\//) {
            if (lead in att) return "@/" lead frag
            broken("a link to " p ", and there is no book/" lead)
            return p frag
        }
        if (lead ~ /^[A-Za-z0-9_-]+\.md$/) {
            stem = substr(lead, 1, length(lead) - 3)
            if (mapfile == "") { if (!(stem in order)) { order[stem] = ++norder; print stem "\t" NR > pages } return "@/" stem ".md" frag }
            if (stem in map) return "@/" map[stem] frag
            broken("a link to " p ", and there is no book/" stem ".md")
            return p frag
        }
        if (p ~ /\.md$/) { broken("a link to " p ": the pages of this book are files in book/, linked as (./name.md)"); return p frag }
        # Not an address, a page, a file with an extension (./build checks those)
        # or a path from the site root (./build again): it would lead nowhere.
        if (p !~ /^\// && p !~ /\.[A-Za-z0-9]+\/?$/) broken("a link to " p ": it leads to no page. a page of this book is linked as (./name.md)")
        return p frag
    }
    function fixdest(d,   inner, after) {
        if (substr(d, 1, 1) == "<" && match(d, />/)) { inner = substr(d, 2, RSTART - 2); after = substr(d, RSTART); return "<" fixplain(inner) after }
        if (match(d, /[ \t]/)) { after = substr(d, RSTART); d = substr(d, 1, RSTART - 1) } else after = ""
        if (d == "") return after
        return fixplain(d) after
    }
    # RSTART and RLENGTH belong to awk, and every match() moves them: taken
    # into st and ln before a call that matches again. [Name]() becomes Name.
    function fixlinks(s,   res, d, st, ln) {
        res = ""
        while (match(s, /\[[^]]*\]\(\)/)) { st = RSTART; ln = RLENGTH; res = res substr(s, 1, st - 1) substr(s, st + 1, ln - 4); s = substr(s, st + ln) }
        s = res s; res = ""
        while (match(s, /\]\([^)]*\)/)) {
            st = RSTART; ln = RLENGTH
            d = substr(s, st + 2, ln - 3)
            res = res substr(s, 1, st + 1) fixdest(d) ")"
            s = substr(s, st + ln)
        }
        return res s
    }
    function fixline(s,   res, st, ln) {
        if (match(s, /^ ? ? ?\[[^]^][^]]*\]:[ \t]*/)) { ln = RLENGTH; return substr(s, 1, ln) fixdest(substr(s, ln + 1)) }
        res = ""
        while (match(s, /`[^`]*`/)) { st = RSTART; ln = RLENGTH; res = res fixlinks(substr(s, 1, st - 1)) substr(s, st, ln); s = substr(s, st + ln) }
        return res fixlinks(s)
    }
    function broken(msg) { printf "%s, line %d: %s\n", src, NR, msg > "/dev/stderr"; nbroken++ }
    BEGIN { while ((getline l < attfile) > 0) att[l] = 1; close(attfile) }
'

# The outline is ordinary Markdown: headings, text, lists, lines, as you like.
# A first line # Title is its title and isn't shown, as in mdBook; any other #
# heading shows as ##, since the page's one h1 is the site's name. The pages it
# links, in the order of their first link, are the Previous and Next order.
# With numbers=true, headings and list items are numbered as one tree: a
# heading one level deeper than the last is under it, and a list under a
# heading numbered 3.1 is numbered 3.1.1, 3.1.2.
# A list item that links a page, with items indented under it: those items, as
# the outline shows them, go to $tmp/kids/<page>, for the foot of that page.
# With <!-- fold --> at the end of its line, they go only there: the home page
# leaves them out, while they keep their numbers and place in Previous and Next.
bad=0
LC_ALL=C awk -v outline="$tmp/outline" -v pages="$tmp/pages" -v kids="$tmp/kids" -v names="$tmp/names" -v attfile="$tmp/atts" -v numbers="$numbers" -v src=book/SUMMARY.md "$links_awk"'
    function num(depth,   i, s) {
        c[depth]++; for (i = depth + 1; i <= 12; i++) c[i] = 0
        s = c[1]; for (i = 2; i <= depth; i++) s = s "." (c[i] + 0)
        return depth == 1 ? s "." : s
    }
    # Columns of leading space, a tab as four; and s with up to n of them taken off.
    function ind(s,   i, c, col) {
        col = 0
        for (i = 1; i <= length(s); i++) { c = substr(s, i, 1); if (c == " ") col++; else if (c == "\t") col += 4; else break }
        return col
    }
    function dedent(s, n,   i, c, col) {
        col = 0
        for (i = 1; i <= length(s) && col < n; i++) { c = substr(s, i, 1); if (c == " ") col++; else if (c == "\t") col += 4; else break }
        return substr(s, i)
    }
    # The page a list item links first, or "": - [Title](./name.md). Its link
    # text, less * and `, goes to iname, for Previous and Next.
    function itempage(s,   d) {
        if (!sub(/^[ \t]*([-*+]|[0-9]+[.)])[ \t]+/, "", s)) return ""
        if (!match(s, /^\[[^]]*\]\([^)]*\)/)) return ""
        d = substr(s, 1, RLENGTH); iname = d
        sub(/^\[/, "", iname); sub(/\]\(.*$/, "", iname); gsub(/[*`]/, "", iname)
        sub(/^\[[^]]*\]\([ \t<]*/, "", d); sub(/[ \t>#?)].*$/, "", d); sub(/^(\.\/|@\/)/, "", d)
        return d ~ /^[A-Za-z0-9_-]+\.md$/ ? substr(d, 1, length(d) - 3) : ""
    }
    # Each open item, innermost last: its indent (ki), page (kp), the indent of
    # its first line under it (ks), lines so far (kt) and blank lines held back
    # until another follows (kb). A page linked twice takes the first.
    function grab(s,   k) {
        for (k = 1; k <= nk; k++) {
            if (s ~ /^[ \t]*$/) { if (kt[k] != "") kb[k] = kb[k] "\n"; continue }
            if (ks[k] < 0) ks[k] = ind(s)
            kt[k] = kt[k] kb[k] dedent(s, ks[k]) "\n"; kb[k] = ""
        }
    }
    function shut(i) {
        while (nk > 0 && ki[nk] >= i) {
            if (kt[nk] != "" && !(kp[nk] in done)) { done[kp[nk]] = 1; printf "%s", kt[nk] > (kids "/" kp[nk]); close(kids "/" kp[nk]) }
            nk--
        }
    }
    # A page item: its outline name and, with numbers, its number, the first
    # time the outline links it, to $tmp/names: page, name, number.
    function emit(s,   n) {
        if (fold < 0) { print s > outline; last = s }
        grab(s)
        if (pend != "" && !(pend in named)) {
            named[pend] = 1; n = ""
            if (numbers == "true" && match(s, /^[ \t]*[-*+] [0-9][0-9.\\]*/)) { n = substr(s, RSTART, RLENGTH); sub(/^[ \t]*[-*+] /, "", n); gsub(/\\/, "", n); sub(/\.$/, "", n) }
            gsub(/\t/, " ", pname); sub(/^[ \t]+/, "", pname); sub(/[ \t]+$/, "", pname)
            printf "%s\t%s\t%s\n", pend, pname, n > names
        }
        if (pend != "") { nk++; ki[nk] = pind; kp[nk] = pend; ks[nk] = -1; kt[nk] = ""; kb[nk] = ""; pend = "" }
        if (pfold) { if (fold < 0) fold = pind; pfold = 0 }
    }
    BEGIN { mapfile = ""; printf "" > pages; printf "" > outline; printf "" > names; hn = 0; ln_ = 0; nk = 0; fold = -1 }
    NR == 1 { sub(/^\357\273\277/, "") }
    { sub(/\r$/, "") }
    /^[ \t]*([`][`][`]|~~~)/ { if (!fence) { shut(ind($0)); if (fold >= 0 && ind($0) <= fold) fold = -1 }; fence = !fence; emit($0); seen = 1; next }
    fence { emit($0); next }
    !seen && /^[ \t]*$/ { next }
    !seen && /^#[ \t]/ { seen = 1; next }
    /^[ \t]*$/ && last == "" { next }
    { seen = 1 }
    # A line no deeper than an open item ends it, and a fold; a page item opens one.
    !/^[ \t]*$/ {
        shut(ind($0)); if (fold >= 0 && ind($0) <= fold) fold = -1
        pend = itempage($0); pind = ind($0)
        pname = iname
        if (pend != "" && sub(/[ \t]*<!--[ \t]*fold[ \t]*-->[ \t]*$/, "")) pfold = 1
    }
    /^#{1,6}[ \t]/ {
        match($0, /^#+/); level = RLENGTH; text = substr($0, level + 1); sub(/^[ \t]+/, "", text)
        if (level == 1) level = 2
        h = ""; while (length(h) < level) h = h "#"
        if (numbers == "true") {
            while (hn > 0 && hl[hn] >= level) hn--
            hl[++hn] = level; hdepth = hn; ln_ = 0
            text = num(hdepth) " " text
        }
        if (last != "") emit("")
        emit(h " " fixline(text)); emit(""); next
    }
    /^[ \t]*(---+|\*\*\*+|___+)[ \t]*$/ {
        if (last != "") emit("")
        emit($0); next
    }
    numbers == "true" && /^[ \t]*([-*+]|[0-9]+[.)])[ \t]+/ {
        match($0, /^[ \t]*/); lead = substr($0, 1, RLENGTH)
        indent = 0; for (j = 1; j <= length(lead); j++) indent += substr(lead, j, 1) == "\t" ? 4 : 1
        rest = substr($0, RLENGTH + 1); sub(/^([-*+]|[0-9]+[.)])[ \t]+/, "", rest)
        while (ln_ > 0 && li[ln_] > indent) ln_--
        if (ln_ == 0 || li[ln_] < indent) li[++ln_] = indent
        n = num(hdepth + ln_); sub(/\.$/, "\\.", n)
        emit(lead "- " n " " fixline(rest)); next
    }
    numbers == "true" && /^[^ \t]/ { ln_ = 0 }
    { emit(fixline($0)) }
    END { shut(0); exit nbroken ? 1 : 0 }' book/SUMMARY.md || bad=1

# The pages: every book/*.md but SUMMARY.md. Those the outline links, in its
# order, are listed (weights 10, 20, ...); MENU_PAGES are the menu's; the rest
# are unlisted: built at /name/ and searchable, with no Previous or Next.
menus=()
read -r -a menus <<< "$menu"
listed=() unlisted=()
missing=()
while IFS=$'\t' read -r stem line; do
    if [ ! -f "book/$stem.md" ]; then missing+=("book/SUMMARY.md, line $line: a link to $stem.md, and there is no book/$stem.md"); continue; fi
    case " $menu " in *" $stem "*) continue ;; esac
    listed+=("$stem")
done < "$tmp/pages"
for stem in ${menus[@]+"${menus[@]}"}; do [ -f "book/$stem.md" ] || missing+=("MENU_PAGES names $stem, and there is no book/$stem.md"); done
if [ "${#missing[@]}" -gt 0 ]; then
    printf '%s\n' "${missing[@]}" >&2
    bad=1
fi
# A file's name is its page's address: one with a space or other sign in it
# would publish a page no link of the book can reach.
badname=()
for f in book/*.md; do
    [ -f "$f" ] || continue
    stem=${f#book/}; stem=${stem%.md}
    [ "$stem" != SUMMARY ] || continue
    if ! [[ $stem =~ ^[A-Za-z0-9_-]+$ ]]; then
        badname+=("  - $f: rename it $(printf '%s' "$stem" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9_-][^a-z0-9_-]*/-/g; s/^-//; s/-$//').md")
        continue
    fi
    case " ${listed[*]+${listed[*]}} $menu " in *" $stem "*) continue ;; esac
    unlisted+=("$stem")
done
if [ "${#badname[@]}" -gt 0 ]; then
    printf '%s\n' "these files in book/ have names that can't be a page's address, which takes letters, digits, - and _:" "${badname[@]}" >&2
    stop "rename them, and the links to them. nothing has been changed."
fi
for stem in ${listed[@]+"${listed[@]}"} ${unlisted[@]+"${unlisted[@]}"}; do
    case "$stem" in unlisted|attachments) stop "book/$stem.md can't be a page: content/$stem/ is a folder of the site. rename it. nothing has been changed." ;; esac
done
: > "$tmp/map"
for stem in ${listed[@]+"${listed[@]}"} ${menus[@]+"${menus[@]}"}; do printf '%s\t%s.md\n' "$stem" "$stem" >> "$tmp/map"; done
for stem in ${unlisted[@]+"${unlisted[@]}"}; do printf '%s\tunlisted/%s.md\n' "$stem" "$stem" >> "$tmp/map"; done

# Only genbook's own files, with the marker, are replaced: anything else in
# content/ but content/attachments/ stops the run, so nothing of yours is deleted.
foreign=()
while IFS= read -r f; do
    case "$f" in
        content/unlisted) ;;
        *.md) if [ -d "$f" ] || ! ours "$f"; then foreign+=("$f"); fi ;;
        *) foreign+=("$f") ;;
    esac
done < <(find content -path content/attachments -prune -o ! -type d -print -o -type d -empty -print 2>/dev/null | LC_ALL=C sort)
if [ "${#foreign[@]}" -gt 0 ]; then
    printf '%s\n' "content/ is made from book/ by ./genbook, and these files in it weren't:" >&2
    printf '  - %s\n' "${foreign[@]}" >&2
    stop "a page goes in book/; a picture, GIF or video goes in book/attachments/. move each, then run this again. nothing has been changed."
fi

# One page: the title from its first line, # Title, or else from its file name;
# then the body, with its links rewritten by the map. Prints how many lines the
# body starts after, the title, and, with $3, the photo: a picture from
# book/attachments/ alone on the first line of the text, which is taken out
# (a blank line in its place, so the line numbers hold) for the About page's
# round photo.
page_body() {
    LC_ALL=C awk -v src="$1" -v out="$2" -v photo="${3:-}" -v mapfile="$tmp/map" -v attfile="$tmp/atts" "$links_awk"'
    BEGIN { while ((getline l < mapfile) > 0) { split(l, a, "\t"); map[a[1]] = a[2] }; close(mapfile); printf "" > out }
    NR == 1 { sub(/^\357\273\277/, "") }
    { sub(/\r$/, "") }
    !started && /^[ \t]*$/ { skipped++; next }
    !started {
        started = 1
        if ($0 ~ /^#[ \t]+/) {
            title = $0; sub(/^#[ \t]+/, "", title); sub(/[ \t]+#+[ \t]*$/, "", title); sub(/[ \t]+$/, "", title)
            if (title != "") { skipped++; next }
        }
    }
    photo != "" && !pdone && !/^[ \t]*$/ {
        pdone = 1
        if ($0 ~ /^!\[[^]]*\]\([ \t]*(\.\/|@\/)?attachments\/[^ \t)]+[ \t]*\)[ \t]*$/) {
            d = $0; sub(/^!\[[^]]*\]\([ \t]*/, "", d); sub(/[ \t]*\)[ \t]*$/, "", d); sub(/^(\.\/|@\/)/, "", d)
            if (d in att) { pic = d; print "" > out; next }
        }
    }
    /^[ \t]*([`][`][`]|~~~)/ { fence = !fence; print > out; next }
    fence { print > out; next }
    { print fixline($0) > out }
    END {
        if (nbroken) exit 1
        print skipped + 0
        print title
        print pic
    }' "$1"
}

# The marker line, the second line of every file this script writes: the file
# it was made from, and, for a page, which line of that file is which line of
# this one ($2 and $3), so the link check in ./build can name the line in book/.
mark() {
    if [ -n "${2:-}" ]; then
        printf '%s made from book/%s, whose line %d is line %d here; edit that file, not this one\n' "$marker" "$1" "$2" "$3"
    else
        printf '%s made from book/%s; edit that file, not this one\n' "$marker" "$1"
    fi
}

toml() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s"; }

# Each page with its front matter: title and weight (listed), title and path
# (unlisted: its address is /name/, like the rest), or title and hidden (menu),
# with the About page's photo; then its text, and the items the outline has
# under it. Every page is read before a stop, so one run lists every broken
# link, the outline's included.
: > "$tmp/written"
weight=0
page() {   # page STEM KIND FILE
    local out skipped title pic="" key=avatar_photo nav="" num="" fm=()
    [ "$1:$2" != about:menu ] || pic=1
    if ! out=$(page_body "book/$1.md" "$tmp/body" "$pic"); then bad=1; return 0; fi
    # $(...) drops the last newline, and an empty photo with it: read then fails.
    { read -r skipped; IFS= read -r title || title=""; IFS= read -r pic || pic=""; } <<< "$out"
    # Zola can't resize an SVG drawing: shown as it is, by its address.
    case "$pic" in *.svg) key=avatar ;; esac
    # The outline's name for the page, for Previous and Next: often shorter;
    # and its number. The title: the page's first line, else that name, else
    # the file name, dashes as spaces: hand-saw.md is "Hand saw".
    IFS=$'\t' read -r _ nav num < <(awk -F '\t' -v s="$1" '$1 == s { print; exit }' "$tmp/names") || true
    if [ -z "$title" ]; then
        title=${nav:-$(printf '%s' "$1" | sed 's/[-_][-_]*/ /g')}
        title=${title^}
    fi
    {
        printf '+++\n'
        case "$2" in
            listed) weight=$((weight + 10))
                    fm=("title = \"$(toml "$title")\"" "weight = $weight" "[extra]" "toc = true")
                    [ -z "$nav" ] || [ "$nav" = "$title" ] || fm+=("nav = \"$(toml "$nav")\"")
                    [ -z "$num" ] || fm+=("number = \"$num\"")
                    # The page's text starts after +++, the marker, these, and +++.
                    mark "$1.md" "$((skipped + 1))" "$((${#fm[@]} + 4))"
                    printf '%s\n' "${fm[@]}" '+++' ;;
            unlisted) mark "$1.md" "$((skipped + 1))" 8
                    printf 'title = "%s"\npath = "%s"\n[extra]\ntoc = true\n+++\n' "$(toml "$title")" "$1" ;;
            menu) if [ -n "$pic" ]; then
                        mark "$1.md" "$((skipped + 1))" 8
                        printf 'title = "%s"\nhidden = true\n[extra]\n%s = "%s"\n+++\n' "$(toml "$title")" "$key" "$(toml "$pic")"
                    else
                        mark "$1.md" "$((skipped + 1))" 6
                        printf 'title = "%s"\nhidden = true\n+++\n' "$(toml "$title")"
                    fi ;;
        esac
        cat "$tmp/body"
        # The children, styled as the home page's outline is.
        [ ! -s "$tmp/kids/$1" ] || { printf '\n<div class="outline%s">\n\n' "$([ "$numbers" != true ] || printf ' numbered')"; cat "$tmp/kids/$1"; printf '\n</div>\n'; }
    } > "$tmp/content/$3"
    printf '%s\n' "$3" >> "$tmp/written"
}
for stem in ${listed[@]+"${listed[@]}"}; do page "$stem" listed "$stem.md"; done
for stem in ${unlisted[@]+"${unlisted[@]}"}; do page "$stem" unlisted "unlisted/$stem.md"; done
# A menu page without its file is listed above already.
for stem in ${menus[@]+"${menus[@]}"}; do [ ! -f "book/$stem.md" ] || page "$stem" menu "$stem.md"; done
[ "$bad" = 0 ] || stop "fix what's listed above, then run this again. nothing has been changed."

# The home page: the outline. sort_by = "weight" orders the pages for Previous
# and Next; the list itself is the text below.
{
    printf '+++\n'
    mark SUMMARY.md
    printf 'title = "Home"\nsort_by = "weight"\n+++\n'
    cat "$tmp/outline"
} > "$tmp/content/_index.md"
printf '%s\n' "_index.md" >> "$tmp/written"
# The unlisted pages' folder redirects home, as /attachments/ does. Not render =
# false: Zola would still index it, as a page at /unlisted/ that isn't there.
if [ "${#unlisted[@]}" -gt 0 ]; then
    {
        printf '+++\n'
        mark SUMMARY.md
        printf 'title = "Unlisted"\nredirect_to = "/"\n+++\n'
    } > "$tmp/content/unlisted/_index.md"
    printf '%s\n' "unlisted/_index.md" >> "$tmp/written"
fi

EOF
    # The attachments folder's _index.md: the one a blog's starts with.
    printf "cat > \"\$tmp/attidx\" << 'IDX'\n%s\nIDX\n" "$(render_attachments_index)"
    cat << 'EOF'

# Into place: each file renamed over the old one, then the files of an earlier
# run that this one didn't write, removed. Only files with the marker go.
mkdir -p content
while IFS= read -r rel; do
    [ "$rel" = "${rel%/*}" ] || mkdir -p "content/${rel%/*}"
    # Only a file that changed: the preview then rebuilds once, for it.
    cmp -s "$tmp/content/$rel" "content/$rel" || mv -f "$tmp/content/$rel" "content/$rel"
done < "$tmp/written"
while IFS= read -r f; do
    rel=${f#content/}
    grep -qxF "$rel" "$tmp/written" && continue
    ours "$f" && rm -f "$f"
done < <(find content -path content/attachments -prune -o -name '*.md' -print 2>/dev/null)
rmdir content/unlisted 2>/dev/null || true

# content/attachments/: its _index.md, then each file in book/attachments/,
# copied when its size or time differs (cp -p keeps the time), so an unchanged
# video isn't copied on every save; then the copies an earlier run made whose
# file has gone from book/attachments/, removed. Rewritten only when changed,
# so the preview reloads only for a change.
mkdir -p content/attachments
cmp -s "$tmp/attidx" content/attachments/_index.md || mv -f "$tmp/attidx" content/attachments/_index.md
while IFS= read -r rel; do
    from="book/$rel" to="content/$rel"
    [ -f "$to" ] && [ "$(stat -c '%s %Y' -- "$from")" = "$(stat -c '%s %Y' -- "$to")" ] && continue
    mkdir -p "${to%/*}"
    { cp -p -- "$from" "$tmp/att" && mv -f -- "$tmp/att" "$to"; } \
        || stop "could not copy $from to $to. the pages are in place; run this again."
done < "$tmp/atts"
if [ -f "$att_list" ]; then
    while IFS= read -r rel; do
        grep -qxF "$rel" "$tmp/atts" || rm -f -- "content/$rel"
    done < "$att_list"
fi
cmp -s "$tmp/atts" "$att_list" || cp "$tmp/atts" "$att_list"
printf 'made content/ from book/: %d page%s, %d unlisted, %d in the menu\n' \
    "${#listed[@]}" "$([ "${#listed[@]}" -eq 1 ] || printf s)" "${#unlisted[@]}" "${#menus[@]}"
EOF
}

# Vars: BLOG_NAME, BASE_URL, FORGE_URL, GIT_REPO_URL.
render_readme() {
    if [ -n "$GIT_REPO_URL" ]; then
        cat << EOF
# ${BLOG_NAME}

Live at <${BASE_URL}>.

Personal blog built with [Zola](https://www.getzola.org/). Pushing to \`main\`
publishes it through GitHub Actions (<${FORGE_URL}>).
EOF
    else
        cat << EOF
# ${BLOG_NAME}

Personal blog built with [Zola](https://www.getzola.org/). Not published yet:
set GIT_REPO_URL in the setup script and run it again.
EOF
    fi
    cat << 'EOF'

## Made with zola-blog-setup

These files are script-owned, rewritten on every run of the setup script:
EOF
    if [ "$BOOK_MODE" = true ]; then
        cat << 'EOF'
`zola.toml`, `templates/`, `serve`, `build`, `new`, `genbook` and
`.gitignore`; also `static/favicon.svg` while FAVICON_TEXT draws it,
`static/search.js` while search is on, and `.github/workflows/deploy.yml` while
GIT_REPO_URL is set.
Change them through the script's settings or its `render_` functions, not here.
`book/` and the rest of `static/` are yours: the script never touches them
after the first run. So is this README, once you edit it. `content/` is made
from `book/` by `./genbook` at every build, and isn't committed.

How to write pages and change the site: the guide that comes with the setup
script, zola-blog-guide.md, under "Book mode".
EOF
    else
        cat << 'EOF'
`zola.toml`, `templates/`, `serve`, `build`, `new` and
`.gitignore`; also `static/favicon.svg` while FAVICON_TEXT draws it,
`static/search.js` while search is on, and `.github/workflows/deploy.yml` while
GIT_REPO_URL is set.
Change them through the script's settings or its `render_` functions, not here.
`content/` and the rest of `static/` are yours: the script never touches them
after the first run. So is this README, once you edit it.

How to write posts and change the blog: the guide that comes with the setup
script, zola-blog-guide.md.
EOF
    fi
}

# Vars: most of the settings, FAVICON_MARK, and BASE_URL, SOURCE_URL,
# HISTORY_URL and HISTORY_HINT from resolve_host_config.
render_site_config() {
    local burl title_e desc auth langv lightt darkt surl hurl hhint datef foot_text masthead_v
    burl=$(toml_escape "$BASE_URL")
    masthead_v=$(toml_escape "$MASTHEAD")
    title_e=$(toml_escape "$SITE_TITLE")
    desc=$(toml_escape "$SITE_DESCRIPTION")
    auth=$(toml_escape "$SITE_AUTHOR")
    langv=$(toml_escape "$SITE_LANGUAGE")
    lightt=$(toml_escape "$LIGHT_CODE_THEME")
    darkt=$(toml_escape "$DARK_CODE_THEME")
    surl=$(toml_escape "$SOURCE_URL")
    hurl=$(toml_escape "$HISTORY_URL")
    hhint=$(toml_escape "$HISTORY_HINT")
    datef=$(toml_escape "$DATE_FORMAT")
    foot_text=$(toml_escape "$FOOTER_TEXT")
    local menu="" footer="" favicon_drawn=false item names=() links=()
    [ -n "$FAVICON_MARK" ] && favicon_drawn=true
    read -r -a names <<< "$MENU_PAGES"
    if [ "${#names[@]}" -gt 0 ]; then
        for item in "${names[@]}"; do menu+="\"$(toml_escape "$(menu_page_path "$item")")\", "; done
        menu="${menu%, }"
    fi
    read -r -a links <<< "$FOOTER_LINKS"
    if [ "${#links[@]}" -gt 0 ]; then
        for item in "${links[@]}"; do
            footer+="    { name = \"$(toml_escape "${item%%=*}")\", url = \"$(toml_escape "${item#*=}")\" },"$'\n'
        done
    fi
    cat << EOF
# Written by zola-blog-setup from its settings: change the script, not this file.
base_url = "${burl}"
title = "${title_e}"
description = "${desc}"
author = "${auth}"
default_language = "${langv}"

generate_feeds = ${GENERATE_FEEDS}
minify_html = true
build_search_index = ${ENABLE_SEARCH}

taxonomies = [
    { name = "tags", feed = ${GENERATE_FEEDS}, render = ${ENABLE_TAGS} },
]

[search]
# Plain JSON for static/search.js; the default format adds a third-party library.
index_format = "fuse_json"

[markdown]
external_links_target_blank = true
external_links_no_follow = true
external_links_no_referrer = true
bottom_footnotes = true

[markdown.highlighting]
light_theme = "${lightt}"
dark_theme = "${darkt}"

[extra]
masthead = "${masthead_v}"

book = ${BOOK_MODE}
outline_numbers = ${OUTLINE_NUMBERS}

# false for your own favicon, which may be missing: a missing file's hash fails.
favicon_drawn = ${favicon_drawn}

light_theme = ${LIGHT_THEME}

show_toc = ${SHOW_TOC}
show_breadcrumbs = ${SHOW_BREADCRUMBS}
show_reading_time = ${SHOW_READING_TIME}
date_format = "${datef}"
enable_tags = ${ENABLE_TAGS}
show_history_link = ${SHOW_HISTORY_LINK}
show_suggest_edit = ${SHOW_SUGGEST_EDIT}

source_url = "${surl}"
history_url = "${hurl}"
history_hint = "${hhint}"

menu_pages = [${menu}]
show_rss_link = ${SHOW_RSS_LINK}

footer_links = [
${footer}]
footer_text = "${foot_text}"
EOF
}

# sort_by = "weight": the author sets the order. Not paginated: the list is an
# <ol>, and a second page would restart at 1.
render_home_index() {
    cat << 'EOF'
+++
title = "Home"
sort_by = "weight"
# Anything written below the closing +++ shows on the home page, above the list.
+++
EOF
}

# content/attachments/: one folder for every page's pictures, GIFs and videos.
# Rendered, because Zola publishes a section's files, and resolves @/ links to
# them, only when it renders the section; redirect_to sends /attachments/ home.
render_attachments_index() {
    cat << 'EOF'
+++
title = "Attachments"
# Pictures, GIFs and videos for any page, linked as @/attachments/<name>.
# Guide: "Pictures, GIFs and video". Don't add render = false: Zola would then
# publish nothing here, and every @/attachments/ link would stop the build.
in_search_index = false
redirect_to = "/"
+++
EOF
}

# A new blog's starter page for a MENU_PAGES name other than about. Vars: $1,
# the page's path under content/ without .md; the title is its last part,
# capitalised.
render_menu_page() {
    local title="${1##*/}"
    title="${title//-/ }"
    title="$(printf '%s' "${title:0:1}" | tr '[:lower:]' '[:upper:]')${title:1}"
    cat << EOF
+++
title = "$(toml_escape "$title")"
hidden = true
+++

This page is content/$1.md.
EOF
}

# About is a page kept out of every list by hidden = true; page.html gives a
# page without a date a section's title and the photo.
render_about() {
    cat << 'EOF'
+++
title = "About"
# Reached from the menu, and left out of the post list, the feed, search and
# sitemap.xml. Guide: "Adding a page to the menu".
hidden = true
[extra]
# avatar_photo: a photo in content/attachments/, named from content/
# ("attachments/me.jpg"); strip its hidden data first. avatar: a file in
# static/. Guide: "Your photo".
avatar_photo = ""
avatar = "avatar.svg"
+++

## Who

Your name. One or two sentences about what this site is for.

## What I write about

A sentence or two on the kinds of things you post here.

## Contact

Email: you@yourdomain.com
EOF
}

# Vars: TWO_DAYS_AGO, TODAY. Published two days ago and updated today, to show
# both dates; the update doesn't move it, because the list follows weight.
render_hello_world() {
    cat << EOF
+++
title = "Hello world"
weight = 10
date = ${TWO_DAYS_AGO}
updated = ${TODAY}
[taxonomies]
tags = ["writing", "meta"]
+++

Welcome to your new blog. This first post shows each kind of Markdown it can display: open \`content/hello-world.md\` in your editor beside this page to see how each part is written.

It was published two days ago and updated today, so its header shows both dates. Its place on the home page comes from its \`weight\`, 10, and the second post's is 20, so editing a post never moves it.

---

EOF
    render_markdown_tour @/second-post.md "A link to another post starts with \`@/\` and names the post's file in \`content/\`, like this one to [the second post](@/second-post.md). If that file isn't there, the build stops, so a typo never reaches your readers."
}

# The tour of Markdown after hello-world's opening, in a blog and in a book, in the
# order of Dillinger's sample. Vars: $1, page 2 as a link there writes it; $2, the
# sentence that shows such a link.
render_markdown_tour() {
    local tour pics
    tour=$(cat << 'EOF'
## Text formatting

A paragraph is lines of text with a blank line before and after it. Inside one, write **bold**, *italic* or ~~struck through~~, and ***bold italic*** for both at once. Put `inline code` around anything typed exactly, such as a file name or a command.

## Lists

Bullets, with items indented under items:

- Drafts in progress
- Posts ready to go
  - This week's
  - Next week's
    - One waiting for its picture
- Ideas for later

Numbers, typed the ordinary way, `1.`, `2.`, `3.`, with each level indented four spaces under the item above. The stylesheet numbers the inner ones 2.1 and 2.2:

1. Write it
2. Read it in the preview
    1. Once on a phone
    2. Once out loud
3. Publish it

## Links and pictures

@LINKS@ A link to another site is written as usual, as with [the Zola documentation](https://www.getzola.org), or from a list at the bottom of the page, as with [the CommonMark help][commonmark]. An address pasted on its own becomes a link too: https://www.getzola.org.

@PICTURES@

[commonmark]: https://commonmark.org/help/

## Blockquotes

> A quotation, set off from the text around it.
>
> A line with only a `>` between two paragraphs keeps them in one quotation.

## Notes and fold-away sections

An aside holds the remark that would interrupt the paragraph it belongs to.

<aside>

Leave a blank line after the opening tag and another before the closing one. Without them, the Markdown inside shows as literal *asterisks*.

</aside>

A fold-away section hides a detail until the reader asks for it.

<details>
<summary>The same blank-line rule applies here</summary>

So `code`, [links](@PAGE2@) and lists all work inside:

- like this one

</details>

## Code

A block fenced with three backticks and the name of its language is coloured:

```python
def word_count(text):
    """Count the words in a page."""
    return len(text.split())
```

`hl_lines` picks out lines to highlight:

```bash,hl_lines=2 4
for page in content/*.md; do
    words=$(wc -w < "$page")
    name=$(basename "$page" .md)
    echo "$name: $words words"
done
```

Without a language name, the block is plain:

```
no colours here
```

## Tables

The colons in the line under the header set each column's alignment:

| Page             | Words | State     |
|:-----------------|------:|:---------:|
| Tea in the hills | 1,200 | Published |
| A week of rain   |   450 | Published |
| Notes on paper   |    90 | Draft     |

## Footnotes

A footnote's number goes where the note belongs[^1], and the note itself on a line of its own, anywhere in the page. Notes are gathered at the bottom, each with a link back.

[^1]: This is the note. The arrow after it leads back to where it was mentioned.
EOF
)
    if [ "$BOOK_MODE" = true ]; then
        pics=$(cat << 'EOF'
Pictures go in `book/attachments/`, and a page names them from the `book` folder, with `./` in front:

![layered gray mountain silhouettes with a faint sun behind them](./attachments/demo.svg)

The picture is `book/attachments/demo.svg`. Delete it along with this page.
EOF
)
    else
        pics=$(cat << 'EOF'
Pictures go in `content/attachments/`, and a page names them from the `content` folder, with `@/` in front:

![layered gray mountain silhouettes with a faint sun behind them](@/attachments/demo.svg)

The picture is `content/attachments/demo.svg`. Delete it along with this page.
EOF
)
    fi
    tour=${tour//@LINKS@/"$2"}
    tour=${tour//@PICTURES@/"$pics"}
    printf '%s\n' "${tour//@PAGE2@/"$1"}"
}

# Vars: YESTERDAY. Somewhere for Previous and Next to lead, and the target of the
# link in hello-world.
render_second_post() {
    cat << EOF
+++
title = "Second post"
weight = 20
date = ${YESTERDAY}
[taxonomies]
tags = ["writing"]
+++

EOF
    render_lorem "The hello-world post links here, so delete the two together: deleted on its own, this one leaves that link broken, and the build stops."
}

# Page 2's text: a sentence, then filler under every level of heading, long enough
# to scroll and to get a Contents box. Vars: $1, the sentence on deleting it.
render_lorem() {
    printf '%s\n' "A second page, so the Previous and Next links have somewhere to lead, with filler text to show how a long page reads. $1"
    cat << 'EOF'

## Lorem ipsum dolor sit amet

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.

### Neque porro quisquam

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam.

#### Quis autem vel eum

Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.

##### At vero eos

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.

###### Similique sunt in culpa

Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio.

## Nam libero tempore

Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae.

Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.

### Excepteur sint occaecat

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.
EOF
}

# A new book's book/: the outline, the About page, the hello-world page, a
# second page for Previous and Next to lead to, and one unlisted page, which
# About links to. None carries front matter; each page's first line is its
# title. Guide: "Book mode".
render_book_summary() {
    cat << 'EOF'
# Summary

## Getting started

- [Hello world](./hello-world.md)
- [Second page](./second-page.md)
EOF
}

# The book's page 2, in the outline after hello-world.
render_book_second_page() {
    printf '# Second page\n\n'
    render_lorem "The hello-world page links here, so take the link out with this page: a link to a file that isn't in \`book/\` stops the build."
}

render_book_about() {
    cat << 'EOF'
# About

## Who

Your name. One or two sentences about what this site is for.

## What is here

A sentence or two on what the pages are, and who they are for.

## Contact

Email: you@yourdomain.com

## Also on this site

- [Colophon](./colophon.md): how this site is made. It is an unlisted page: the outline doesn't link it, and this link is the way to it.
EOF
}

render_book_colophon() {
    cat << 'EOF'
# Colophon

This page is unlisted: it is a file in `book/` that `book/SUMMARY.md` doesn't link, so it is built and searchable, but the outline on the home page doesn't show it, and no Previous or Next link leads here. Readers reach it through links, like the one on the About page.

The site is made with Zola, by the zola-blog-setup script in book mode: the pages are plain Markdown files in `book/`, and the outline is `book/SUMMARY.md`.
EOF
}

# The book's hello-world: the same tour of Markdown as a blog's, after an opening
# about the book itself. Its picture is book/attachments/demo.svg.
render_book_hello_world() {
    cat << 'EOF'
# Hello world

Welcome to your new site. This first page shows each kind of Markdown it can display: open `book/hello-world.md` in your editor beside this page to see how each part is written.

Its title is its first line, `# Hello world`, and it has no front matter: a book's pages carry none. The home page shows the outline, `book/SUMMARY.md`, and the Previous and Next links at the foot of each page follow the order it links the pages in.

---

EOF
    render_markdown_tour ./second-page.md "A link to another page names its file in \`book/\`, as in mdBook, like this one to [the second page](./second-page.md). Most editors open the file on Ctrl+click. If that file isn't in \`book/\`, the build stops, so a typo never reaches your readers."
}

# A new book's starter page for a MENU_PAGES name other than about. Vars: $1,
# the name; the title is the name, capitalised.
render_book_menu_page() {
    local title="$1"
    title="${title//-/ }"
    title="$(printf '%s' "${title:0:1}" | tr '[:lower:]' '[:upper:]')${title:1}"
    cat << EOF
# ${title}

This page is book/$1.md.
EOF
}

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

# Vars: FAVICON_MARK. Letters on a transparent ground: dark ink, light under
# prefers-color-scheme: dark (the tab bar follows the OS). Not Charter: an SVG
# loaded as an image can't load a webfont. Size follows the mark's length.
render_favicon_svg() {
    local size baseline
    case "${#FAVICON_MARK}" in
        1) size=78; baseline=76 ;;
        2) size=56; baseline=70 ;;
        *) size=40; baseline=64 ;;
    esac
    cat << EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    .ink { fill: #111; }
    @media (prefers-color-scheme: dark) { .ink { fill: #e8e6da; } }
  </style>
  <text class="ink" x="50" y="${baseline}" font-family="Palatino, Georgia, serif"
        font-size="${size}" text-anchor="middle" font-weight="bold">$(esc_xml "$FAVICON_MARK")</text>
</svg>
EOF
}

# Vars: LIGHT_THEME. Follows the site's theme, not the OS, because it sits on
# the page; the favicon keeps its media query because it sits in the tab bar.
render_avatar_svg() {
    local style
    if [ "$LIGHT_THEME" = true ]; then
        style='    .bg { fill: #f4f2e8; }
    .fg { fill: #b8b6a8; }
    @media (prefers-color-scheme: dark) { .bg { fill: #1b1b18; } .fg { fill: #45443e; } }'
    else
        style='    .bg { fill: #1b1b18; }
    .fg { fill: #45443e; }'
    fi
    cat << EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="placeholder photo">
  <style>
${style}
  </style>
  <rect class="bg" width="120" height="120"/>
  <circle class="fg" cx="60" cy="46" r="22"/>
  <path class="fg" d="M20 112c0-22 18-34 40-34s40 12 40 34z"/>
</svg>
EOF
}

# The page frame and the whole stylesheet: YOUR DESIGN, then STRUCTURE.
render_base_html() {
    cat << 'EOF'
<!DOCTYPE html>
<html lang="{{ lang }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="{% if config.extra.light_theme %}light dark{% else %}dark{% endif %}">
    {#- The preview (base_url is http://; a published one is always https) also
        allows serve's reload scripts. No frame-ancestors: ignored in <meta>.
        form-action has no default-src fallback, so it's spelled out. -#}
    {%- set preview = config.base_url is starting_with(pat="http://") %}
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src {% if preview %}'self' 'unsafe-inline'{% elif config.build_search_index %}'self'{% else %}'none'{% endif %}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
    <meta name="referrer" content="no-referrer">
    {%- set meta_description = config.description %}
    {%- if page is defined and page.description %}{% set meta_description = page.description %}
    {%- elif section is defined and section.description %}{% set meta_description = section.description %}{% endif %}
    {%- if meta_description %}
    <meta name="description" content="{{ meta_description }}">
    {%- endif %}
    <title>{% block title %}{{ config.title }}{% endblock %}</title>
    {#- current_url is missing on the 404 page. -#}
    <meta property="og:site_name" content="{{ config.title }}">
    <meta property="og:title" content="{% if page is defined %}{{ page.title }}{% elif section is defined and section.path != "/" %}{{ section.title }}{% else %}{{ config.title }}{% endif %}">
    {%- if meta_description %}
    <meta property="og:description" content="{{ meta_description }}">
    {%- endif %}
    <meta property="og:type" content="{% if page is defined %}article{% else %}website{% endif %}">
    <meta name="twitter:card" content="summary">
    {%- if current_url is defined %}
    <meta property="og:url" content="{{ current_url }}">
    <link rel="canonical" href="{{ current_url }}">
    {%- endif %}
    {#- cachebust only for the drawn favicon: your own may be missing, and a
        missing file's hash fails. -#}
    <link rel="icon" href="{{ get_url(path='favicon.svg', cachebust=config.extra.favicon_drawn) }}" type="image/svg+xml">
    {% if config.generate_feeds %}
    <link rel="alternate" type="application/atom+xml" title="RSS" href="{{ get_url(path='atom.xml') }}">
    {% endif %}
    {%- if config.build_search_index %}
    <script src="{{ get_url(path='search.js', cachebust=true) }}" defer></script>
    {%- endif %}
    {%- if page is defined %}
    {%- if page.higher %}
    <link rel="next" href="{{ page.higher.permalink | safe }}">
    {%- endif %}
    {%- if page.lower %}
    <link rel="prev" href="{{ page.lower.permalink | safe }}">
    {%- endif %}
    {%- endif %}
    <style>
    /* ===================================================================
       YOUR DESIGN: the tokens and element styles to change (guide: "Colours,
       sizes and typefaces"). STRUCTURE, below, reads them.
       =================================================================== */

    /* Charter, self-hosted in static/fonts/; get_url keeps it working under /REPO. */
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_regular.woff2') }}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_italic.woff2') }}") format("woff2");font-weight:400;font-style:italic;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_bold.woff2') }}") format("woff2");font-weight:700;font-style:normal;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_bold_italic.woff2') }}") format("woff2");font-weight:700;font-style:italic;font-display:swap}

    :root {
        color-scheme: {% if config.extra.light_theme %}light dark{% else %}dark{% endif %};
        --serif: "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;
        --mono: ui-monospace,"DejaVu Sans Mono","Liberation Mono",Menlo,Consolas,monospace;
        --bg: #111;
        --fg: #e8e6da;
        --muted: #aaa8a0;
        --link: #94b9dc;               /* followed links in your text; lists, menu and footer keep their own */
        --accent: #ffb454;             /* inline code, the draft label, the focus ring */
        --surface: #242420;            /* table headers; code blocks keep their theme's ground */
        --inline-bg: #2b281f;          /* inline code: needs to read against the page and the line */
        --inline-border: #3a382f;
        --border: #2c2c28;             /* hairline: boxes, tables, small separators */
        --border-strong: #42423c;      /* the weight that carries a heading rule */
        --control-border: #6e6c64;     /* the search box: 3:1 against the page */
        --measure: 42rem;              /* line length: about 79 characters of Charter, 66 of code */
        --wide: 62rem;                 /* ceiling for .wide pages and .bleed elements */
        --body-size: 1.2rem;
        --body-leading: 1.45;          /* Butterick's 120-145% */
        --wordmark-size: 1.35em;       /* masthead name and image-mode logo: 1.62rem, above --h2-size, below --h1-size */
        --h1-size: 1.8rem;             /* even steps of about 1.2: 1.32, 1.5, 1.8 */
        --h2-size: 1.5rem;
        --h3-size: 1.32rem;            /* a step above the text, so it reads as a heading, not a bold line */
        --hairline: 1px solid var(--border-strong); /* rules under titles and hr; 'none' drops them all */
    }
{%- if config.extra.light_theme %}
    @media (prefers-color-scheme: light) {
        :root {
            --bg: #fffff8;
            --fg: #111;
            --muted: #57564e;
            --link: #295a8e;
            --accent: #9d4909;
            --surface: #f4f2e8;
            --inline-bg: #ece3cd;
            --inline-border: #e0d8c2;
            --border: #e5e3d7;
            --border-strong: #c2bda4;
            --control-border: #8a8676;
        }
    }
{%- else %}
    /* Giallo puts color-scheme: light dark inline on every <pre>, which beats the
       inherited "dark"; only an !important author rule beats an inline one. */
    pre { color-scheme: dark !important; }
{%- endif %}

    @media (max-width: 36rem) { :root { --h1-size: 1.65rem; } }

    html { background: var(--bg); }   /* paint on html only — no two-tone seam in dark mode */
    /* minmax(0, 1fr): a long code line scrolls inside its block instead of widening
       the page. */
    body {
        font-family: var(--serif);
        font-size: var(--body-size);
        line-height: var(--body-leading);
        color: var(--fg);
        max-width: var(--measure);
        margin: 2rem auto;
        padding: 0 1rem;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr auto;
        min-height: calc(100dvh - 4rem);
        overflow-wrap: break-word;     /* a long address or word breaks, not the page */
    }
    body:has(.wide), body:has(.bleed) { max-width: var(--wide); }
    body:has(.bleed) > header,
    body:has(.bleed) > footer,
    body:has(.bleed) main > :not(.bleed) {
        box-sizing: border-box; max-width: var(--measure); margin-inline: auto;
    }
    main > .bleed { margin-inline: 0; }   /* UA stylesheets give <figure> 40px side margins */
    /* Grid items with auto margins shrink to their content: the masthead would bunch up. */
    body:has(.bleed) > header, body:has(.bleed) > footer { width: 100%; }

    /* :any-link, so an <a id> that leads nowhere isn't underlined; inside :where(),
       so the rule weighs nothing and every rule below for one kind of link wins. */
    :where(a:any-link) { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
    a:visited { color: var(--link); }
    .post-list li > a, .outline a, .tag-list a, .search-results a { color: var(--fg); }

    main h1, main h2, main h3, main h4, main h5, main h6 { font-weight: bold; line-height: 1.18; }
    main h1 { font-size: var(--h1-size); margin: 0.7em 0 0.4em; }
    main h2 { font-size: var(--h2-size); margin: 1.5em 0 0.4em; }
    main h3 { font-size: var(--h3-size); margin: 1.18em 0 0.29em; }
    main h4 { font-size: 1em; font-style: italic; margin: 1.4em 0 0.3em; }
    main h5 { font-size: 1em; font-style: italic; font-weight: normal; margin: 1.3em 0 0.3em; }
    main h6 { font-size: 1em; font-style: italic; font-weight: normal; color: var(--muted); margin: 1.1em 0 0.3em; }
    /* What follows a heading starts right under it: touching margins keep only the
       larger, so its own top margin would win over the heading's bottom one. */
    main :is(h2, h3, h4, h5, h6) + :not(h2, h3, h4, h5, h6),
    main :is(h2, h3, h4, h5, h6) + :not(h2, h3, h4, h5, h6) > :first-child,
    main :is(h2, h3, h4, h5, h6) + details:not(.toc) { margin-top: 0; }

    :not(pre) > code { font-family: var(--mono); font-size: 0.88em; color: var(--accent); background: var(--inline-bg); border: 1px solid var(--inline-border); padding: 0.05em 0.3em; border-radius: 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    /* No user-select: all (it blocks selecting part of a block) and no background:
       Giallo paints the ground inline, which beats any selector here. */
    pre { font-family: var(--mono); border: 1px solid var(--border); border-radius: 4px; padding: 1rem; overflow-x: auto; margin: 1rem 0; font-size: 0.95rem; line-height: 1.45; }
    pre code { font-family: var(--mono); font-weight: normal; background: none; padding: 0; }
    code { font-weight: inherit; }

    blockquote { margin-block: 1.15rem; margin-inline: 0; padding-inline-start: 1rem; border-inline-start: 3px solid var(--border); color: var(--muted); }
    main small { font-size: 0.82em; color: var(--muted); }
    main aside { font-size: 0.82em; color: var(--muted); border-inline-start: 2px solid var(--border); padding-inline-start: 1em; margin-block: 1.15rem; }

    hr { border: none; border-block-start: var(--hairline); margin-block: 2.5rem; }
    main :is(h2, h3, h4, h5, h6):has(+ hr) { margin-bottom: 0.3em; }
    main :is(h2, h3, h4, h5, h6) + hr { margin-bottom: 1rem; }
    /* =================================================================== END DESIGN
       STRUCTURE — layout and components; reads the tokens above.
       =================================================================== */

    .site-head { padding-bottom: 1rem; margin-bottom: 2rem; }
    /* Centred, not on a shared baseline, which at different sizes offsets the caps
       by ~8px. */
    .masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem 1.4rem; }
    .tagline { flex-basis: 100%; order: 1; color: var(--muted); font-style: italic; font-size: 0.9em; line-height: 1.35; margin: 0; }
    @media (max-width: 36rem) { .masthead:has(.brand) .tagline { order: 0; } }
    /* The wordmark is text: an SVG loaded as an image can't use the webfont. */
    .brand, .brand:visited { display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none; color: var(--fg); font-size: var(--wordmark-size); }
    .brand-name { font-weight: bold; font-size: 1em; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
{%- if config.extra.masthead == "image" %}
    /* static/logo.svg as an alpha mask in the text colour: one file for both
       themes, and a background in the file masks the whole box solid. */
    .brand .logo { display: inline-block; width: 1em; height: 1em; align-self: center;
        background-color: currentColor;
        -webkit-mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat;
                mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat; }
{%- endif %}
    /* Scoped to the masthead, so it doesn't reach .post-nav. */
    .masthead nav { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1em; margin: 0; }
    .masthead nav a, .masthead nav a:visited { color: var(--muted); text-decoration: none; }
    /* Brighter, not bold: bold would widen it and shift the links before it. */
    .masthead nav a.current { color: var(--fg); text-decoration: underline; }
    .search-open { font: inherit; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; text-underline-offset: 2px; }
    .masthead nav a:hover, .search-open:hover { text-decoration: underline; }

    /* The -0.55rem keeps a page's title level with the title on a page without
       breadcrumbs. */
    .crumbs ol { display: flex; flex-wrap: wrap; list-style: none; margin: -0.55rem 0 0; padding: 0; color: var(--muted); font-size: 0.9em; }
    .crumbs li + li::before { content: "›"; content: "›" / ""; margin: 0 0.5em; }
    .crumbs a, .crumbs a:visited { color: var(--muted); text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }
    main .crumbs + h1 { margin-top: 0.2em; }

    .subtitle { color: var(--muted); font-style: italic; line-height: 1.35; margin: 0.2rem 0 2rem 0; }
    h1 + .subtitle { margin-top: 0; }
    .subtitle:has(+ .post-meta) { margin-bottom: 0.6rem; }   /* a post's subtitle, then its date line */

    .draft { color: var(--accent); font-style: italic; font-weight: normal; font-size: 0.8em; }

    .avatar { display: block; width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); margin: 0 0 1.5rem; }

    main h1.post-title { margin-bottom: 0.25em; }
    .post-meta { display: flex; flex-wrap: wrap; column-gap: 1.6em; align-items: baseline; color: var(--muted); font-style: italic; font-size: 0.9em; padding-bottom: 0.8rem; margin-bottom: 1.5rem; border-bottom: var(--hairline); overflow: clip; overflow-clip-margin: 4px; }
    .post-meta > * { white-space: nowrap; }   /* wraps between items, never inside one */
    /* Each · sits in the gap before its item; one that would start a wrapped line
       lands past the left edge and is clipped. The clip margin keeps focus rings. */
    .post-meta > * + * { margin-inline-start: -1.6em; }
    .post-meta .sep { display: inline-block; width: 1.6em; text-align: center; }
    .post-meta a, .post-meta a:visited, .subtitle a, .subtitle a:visited { color: var(--muted); text-decoration: none; }
    .post-meta a:hover, .subtitle a:hover { text-decoration: underline; }
    .subtitle .sep { margin: 0 0.7em; }

    sup.footnote-reference { font-size: 0.75em; }
    sup.footnote-reference a, sup.footnote-reference a:visited { color: var(--link); text-decoration: none; }
    /* Zola's bottom footnotes: <section class="footnotes"><ol>. A selector that
       stops matching fails silently: the build passes either way. */
    main .footnotes { margin-top: 3rem; padding-top: 0.5rem; border-top: 1px solid var(--border); font-size: 0.8em; color: var(--muted); }
    main .footnotes ol { padding-inline-start: 2.5em; margin: 0; }
    main .footnotes p { margin: 0.3rem 0; }
    main .footnotes li:first-child > p:first-child { margin-block-start: 0; }
    main hr:has(+ .footnotes) { display: none; }
    /* Zola's back-links go to #fr-<note>-<use>. */
    main .footnotes a[href*="#fr-"] { color: var(--muted); }

    .giallo-l { display: inline-block; min-height: 1lh; width: 100%; }
    .giallo-ln { display: inline-block; user-select: none; margin-right: 0.4em; padding: 0.4em; min-width: 3ch; text-align: right; opacity: 0.8; }

    main table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
    main th, main td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
    main th { background: var(--surface); font-weight: bold; }
    @media (max-width: 44rem) { main table { display: block; overflow-x: auto; } }

    main img, main video { max-width: 100%; height: auto; max-height: 85vh; }

    /* search.js sets --search-top to just under the nav. */
    .search { box-sizing: border-box; width: min(var(--measure), calc(100% - 2rem)); max-width: none; max-height: none; margin: var(--search-top, 2rem) auto auto; padding: 0; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--bg); color: var(--fg); }
    .search::backdrop { background: rgba(0, 0, 0, 0.6); }
    /* min-height: 0 lets the results shrink, and so scroll, under a fixed input. */
    .search-box { box-sizing: border-box; display: flex; flex-direction: column; gap: 0.9rem; max-height: calc(100dvh - var(--search-top, 2rem) - 1rem); padding: 1rem; }
    .search input { font: inherit; box-sizing: border-box; width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--control-border); border-radius: 3px; background: var(--bg); color: var(--fg); }
    .search-results { list-style: none; margin: 0; padding: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    .search-results li + li { margin-top: 0.9rem; }
    .search-results li:has(> a[aria-current]) { border-inline-start: 3px solid var(--muted); padding-inline-start: 0.6rem; margin-inline-start: calc(-0.6rem - 3px); }
    .search-excerpt { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.85em; line-height: 1.45; }
    .search-excerpt mark { background: none; color: var(--fg); font-weight: bold; }
    .search-note { color: var(--muted); font-style: italic; }
    .search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* A counter can't read <ol start>, so a list Markdown restarted keeps the
       browser's own numbers rather than wrong ones. */
    main ol { counter-reset: outline; }
    main ol > li { counter-increment: outline; }
    main ol ol > li { list-style: none; position: relative; }
    main ol ol > li::before { content: counters(outline, "."); position: absolute; inset-inline-end: 100%; padding-inline-end: 0.25em; }
    main ol[start] ol > li, main ol ol[start] > li { list-style: revert; }
    main ol[start] ol > li::before, main ol ol[start] > li::before { content: none; }

    .post-list, .outline ol { padding-inline-start: 1.7em; }
    {%- if config.extra.book %}
    .outline > :first-child { margin-top: 0; }
    .outline.numbered ul { list-style: none; padding-inline-start: 0; }
    .outline.numbered ul ul { padding-inline-start: 1.7em; }
    {%- endif %}
    .post-list li, .outline li { margin-bottom: 0.5rem; }
    .post-list li::marker, .outline li::marker { color: var(--muted); }
    .unordered .post-list { list-style: none; padding-inline-start: 0; }
    .post-list .desc { display: block; color: var(--muted); font-style: italic; font-size: 0.9em; line-height: 1.35; }
    .post-list .tags { display: block; color: var(--muted); font-size: 0.8em; font-style: italic; }
    .post-list .tags a, .post-list .tags a:visited { color: var(--muted); text-decoration: none; }
    .post-list .tags a:hover { text-decoration: underline; }

    .post-tags { margin-top: 2.75rem; color: var(--muted); font-size: 0.9em; }
    .post-tags a, .post-tags a:visited { color: var(--muted); text-decoration: none; }
    .post-tags a:hover { text-decoration: underline; }

    .tag-list { list-style: none; padding-inline-start: 0; }
    .tag-list li { margin-bottom: 0.4rem; }
    .tag-list .count { color: var(--muted); font-size: 0.85em; }

    .section-title { padding-bottom: 0.9rem; margin-bottom: 1.4rem; border-bottom: var(--hairline); }
    .section-title:has(+ .subtitle) { padding-bottom: 0; margin-bottom: 0.25em; border-bottom: none; }
    .section-title + .subtitle { padding-bottom: 0.9rem; margin-bottom: 1.4rem; border-bottom: var(--hairline); }

    details > summary { cursor: pointer; color: var(--muted); font-style: italic; list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before { content: "\25B8"; display: inline-block; width: 1em; }
    details[open] > summary::before { content: "\25BE"; }
    main > details:not(.toc) { margin-block: 1.5rem; }
    main > details:not(.toc) > :not(summary) { margin-inline-start: 1em; }

    .toc { margin: 1.5rem 0; padding: 0 0 1.3rem; border-bottom: var(--hairline); font-size: 0.85em; }
    .toc nav { margin-top: 0.6rem; }
    .toc ul { list-style: none; margin: 0; padding: 0; }
    .toc nav > ul > li { margin: 0.25rem 0; }
    .toc ul ul { padding-left: 1.4em; }
    .toc li { line-height: 1.45; }
    .toc a, .toc a:visited { color: var(--muted); text-decoration: none; }
    .toc a:hover { color: var(--fg); text-decoration: underline; }

    :target { scroll-margin-top: 2rem; }
    main h2:target, main h3:target, main h4:target,
    main h5:target, main h6:target { border-inline-start: 3px solid var(--muted); padding-inline-start: 0.6rem; margin-inline-start: calc(-0.6rem - 3px); }

    .post-nav { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border); display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.9rem; align-items: baseline; }
    .post-tags + .post-nav { margin-top: 1.5rem; }
    .post-nav a, .post-nav a:visited { color: var(--muted); text-decoration: none; }
    .post-nav a:hover { text-decoration: underline; }
    .post-nav .label { display: block; color: var(--muted); font-style: italic; font-size: 0.9em; }
    .post-nav-prev { text-align: left; }
    .post-nav-next { text-align: right; }
    .post-nav-home { text-align: center; }
    @media (max-width: 36rem) {
        .post-nav { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .post-nav-home { grid-row: 2; grid-column: 1 / -1; }
    }

    body > footer { margin-top: 4rem; padding-top: 1rem; text-align: center; color: var(--muted); }
    body > footer a, body > footer a:visited { color: var(--muted); margin: 0 0.4em; text-decoration: none; }
    body > footer a:hover { text-decoration: underline; }
    /* 85% keeps the small print at 4.5:1 or better against the page in both themes. */
    body > footer p { margin: 0.5rem 0 0; font-size: 0.8em; opacity: 0.85; }

    @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

    @media print {
        :root, :root * { --bg: #fff; --fg: #000; --muted: #333; --link: #000;
            --accent: #000; --surface: #fff; --inline-bg: #fff;
            --inline-border: #ccc; --border: #bbb; --border-strong: #888; }
        html, body { background: #fff; color: #000; }
        a, a:visited { color: #000; }
        pre { white-space: pre-wrap; }
        /* !important: the highlighter's colours are inline on <pre> and every span. */
        pre, pre span { background: #fff !important; color: #000 !important; }
        .masthead nav, .post-nav, .search, body > footer, .toc { display: none; }
        main h2, main h3, main h4, main h5, main h6 { break-after: avoid; }
        details > summary::before { content: none; }
        main > details:not(.toc) > :not(summary) { display: block; }
    }
    </style>
</head>
<body>
    <header class="site-head">
        <div class="masthead">
        {%- if config.extra.masthead != "none" %}
        <a class="brand" href="{{ get_url(path='/', trailing_slash=true) }}"{% if config.build_search_index %} title="Home (h)"{% endif %}>
            {%- if config.extra.masthead == "image" %}<span class="logo" aria-hidden="true"></span>{% endif %}
            <span class="brand-name">{{ config.title }}</span>
        </a>
        {%- endif %}
        {% block masthead_extra %}{% endblock %}
        <nav aria-label="Site">
            {%- if config.extra.masthead == "none" %}
            <a href="{{ get_url(path='/', trailing_slash=true) }}"{% if current_path == "/" %} class="current" aria-current="page"{% endif %}{% if config.build_search_index %} title="Home (h)"{% endif %}>Home</a>
            {%- endif %}
            {%- if config.build_search_index %}
            <button type="button" class="search-open" aria-haspopup="dialog" title="Search (/)" hidden>Search</button>
            {%- endif %}
            {%- for path in config.extra.menu_pages %}
            {%- if path is ending_with(pat="_index.md") %}{% set menu_item = get_section(path=path) %}{% else %}{% set menu_item = get_page(path=path) %}{% endif %}
            <a href="{{ menu_item.permalink }}"{% if current_path == menu_item.path %} class="current" aria-current="page"{% endif %}>{{ menu_item.title }}</a>
            {%- endfor %}
            {%- if config.extra.enable_tags %}
            <a href="{{ get_url(path='tags', trailing_slash=true) }}"{% if current_path == "/tags/" %} class="current" aria-current="page"{% endif %}>Tags</a>
            {%- endif %}
            {%- if config.generate_feeds and config.extra.show_rss_link %}
            <a href="{{ get_url(path='atom.xml') }}">RSS</a>
            {%- endif %}
        </nav>
        </div>
    </header>

    <main>
        {#- Zola leaves a transparent folder out of a page's ancestors. None in a book:
            its only folder, unlisted/, is a redirect home. -#}
        {%- set trail = page?.ancestors or section?.ancestors or [] %}
        {%- if config.extra.show_breadcrumbs and not config.extra.book and trail | length > 1 %}
        <nav class="crumbs" aria-label="Breadcrumb"><ol>
            <li><a href="{{ get_url(path='/', trailing_slash=true) }}">Home</a></li>
            {%- for path in trail[1:] %}{% set crumb = get_section(path=path) %}
            <li><a href="{{ crumb.permalink }}">{{ crumb.title }}</a></li>
            {%- endfor %}
        </ol></nav>
        {%- endif %}
        {% block content %}{% endblock %}
    </main>

    {% if config.extra.footer_text or config.extra.footer_links %}
    <footer>
        {#- Off the site, so a new tab, as Zola gives links in posts; mailto: as it is. -#}
        {% for link in config.extra.footer_links -%}
        <a href="{{ link.url }}"{% if link.url is starting_with(pat="mailto:") %}{% else %} target="_blank" rel="noopener noreferrer"{% endif %}>{{ link.name }}</a>{% if not loop.last %} · {% endif %}
        {%- endfor %}
        {% if config.extra.footer_text %}<p>{{ config.extra.footer_text }}</p>{% endif %}
    </footer>
    {% endif %}
    {%- if config.build_search_index %}
    {#- data-home: the home section's permalink, as the index holds it
        (get_url(path='/') drops the slash). Tera v2 can't read a field off a
        function call, hence the set. -#}
    {%- set search_home = get_section(path='_index.md') %}
    <dialog class="search" aria-label="Search">
        <div class="search-box" data-index="{{ get_url(path='search_index.' ~ lang ~ '.json') }}" data-home="{{ search_home.permalink }}">
            <input type="search" aria-label="Search this site" placeholder="Search" autocomplete="off">
            <p class="visually-hidden" role="status"></p>
            <ul class="search-results" hidden></ul>
        </div>
    </dialog>
    {%- endif %}
</body>
</html>
EOF
}

# The numbered lists, the contents box, videos, and bare addresses as links.
# Zola gives templates no weights, so front_value reads them from the files.
render_components() {
    cat << 'EOF'
{#- Tera v2 components, registered globally: they can't see config, hence the
    extra argument. -#}

{#- folders: left out are attachments/, folders in the menu, and transparent
    folders, whose pages are listed already. Sorted by weight, a folder goes
    before the first page not lighter than it. -#}
{% component post_list(pages, extra, folders=[], section="") %}
{%- set skip = ["attachments/_index.md", ...extra.menu_pages] %}
{%- set listed = [f for f in [get_section(path=p) for p in folders] if not f.transparent and f.relative_path not in skip] %}
{%- set sort_by %}{% if section and listed %}{{<front_value path={section} key="sort_by" />}}{% endif %}{% endset %}
{%- if sort_by == "weight" %}
{%- set_global entries = [] %}
{%- set_global taken = 0 %}
{%- for f in listed %}
{%- set w %}{{<front_value path={f.relative_path} key="weight" default="-1" />}}{% endset %}
{%- set n %}{{<lighter pages={pages} weight={w | int} />}}{% endset %}
{%- set n = n | int %}
{%- if n > taken %}{% set_global entries = [...entries, ...pages[taken:n]] %}{% set_global taken = n %}{% endif %}
{%- set_global entries = [...entries, f] %}
{%- endfor %}
{%- set entries = [...entries, ...pages[taken:]] %}
{%- else %}
{%- set entries = [...listed, ...pages] %}
{%- endif %}
{#- Nothing to list, no list: an empty <ol> still takes up space. -#}
{%- if entries %}
<ol class="post-list">
{% for e in entries %}
<li>
    <a href="{{ e.permalink }}">{{ e.title }}</a>{% if e.draft %} <span class="draft">(draft)</span>{% endif %}
    {% if e.description %}<span class="desc">{{ e.description }}</span>{% endif %}
    {% if extra.enable_tags and e.taxonomies?.tags %}<span class="tags">{% for tag in e.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</span>{% endif %}
</li>
{% endfor %}
</ol>
{%- endif %}
{% endcomponent post_list %}

{% component toc(items) %}
<details class="toc">
<summary>Contents</summary>
<nav aria-label="contents">
<ul>
{% for h in items %}
<li><a href="{{ h.permalink | safe }}">{{ h.title }}</a>
{%- if h.children %}<ul>{% for c in h.children %}<li><a href="{{ c.permalink | safe }}">{{ c.title }}</a></li>{% endfor %}</ul>{%- endif %}
</li>
{% endfor %}
</ul>
</nav>
</details>
{% endcomponent toc %}

{#- get_url with @/ stops the build if the file is missing. loop="yes": silent
    and looping, like a GIF, still with controls: WCAG 2.2.2 wants a way to pause. -#}
{% component video(src, loop="no") %}
{%- set url = get_url(path="@/" ~ src) -%}
{% if loop == "yes" %}<video src="{{ url }}" autoplay loop muted playsinline controls></video>{% else %}<video src="{{ url }}" controls preload="metadata"></video>{% endif %}
{% endcomponent video %}

{#- Bare addresses as links: tags, links and code are matched whole and passed
    through. A full stop, comma or bracket after an address stays outside it.
    Then every link to another site opens in a new tab, one written in HTML too
    (Zola does it for Markdown's only): its target taken off, then put back. -#}
{% component linkify(html) %}{{ html | regex_replace(pattern=`(?s)(<a\\b[^>]*>.*?</a>|<pre\\b.*?</pre>|<code\\b.*?</code>|<script\\b.*?</script>|<style\\b.*?</style>|<[^>]*>)|(https?://(?:[^\\s<>"()&]|&amp;|\\([^\\s<>"()]*\\))*(?:[^\\s<>"().,;:!?'*_~&]|&amp;|\\([^\\s<>"()]*\\)))`, rep=`${1}<!--L-->${2}<!--/L-->`) | replace(from="<!--L--><!--/L-->", to="") | regex_replace(pattern=`<!--L-->(.*?)<!--/L-->`, rep=`<a rel="noopener nofollow noreferrer external" href="$1" target="_blank">$1</a>`) | regex_replace(pattern=`(<a\\b[^>]*?)\\s+target="[^"]*"`, rep=`${1}`) | regex_replace(pattern=`<a\\b([^>]*\\shref="https?://[^"]*"[^>]*)>`, rep=`<a${1} target="_blank">`) | safe }}{% endcomponent linkify %}

{#- A front matter value Zola doesn't give templates (weight, sort_by). The
    two patterns are Zola's own (front_matter/split.rs), so it ends where Zola's does. -#}
{% component front_value(path, key, default="") -%}
{%- set raw = load_data(path="@/" ~ path, format="plain") %}
{%- set toml = `^[[:space:]]*\\+\\+\\+[[:space:]]*(\\r?\\n(?s).*?(?-s))\\+\\+\\+[[:space:]]*(?:$|(?:\\r?\\n((?s).*(?-s))$))` %}
{%- set yaml = `^[[:space:]]*---[[:space:]]*(\\r?\\n(?s).*?(?-s))---[[:space:]]*(?:$|(?:\\r?\\n((?s).*(?-s))$))` %}
{%- if raw is matching(pat=toml) %}{% set fm = load_data(literal=raw | regex_replace(pattern=toml, rep="$1"), format="toml") %}
{%- elif raw is matching(pat=yaml) %}{% set fm = load_data(literal=raw | regex_replace(pattern=yaml, rep="$1"), format="yaml") %}
{%- else %}{% set fm = {} %}{% endif %}
{{- fm | get(key=key, default=default) }}
{%- endcomponent front_value %}

{#- How many of these, in weight order, are lighter than weight: halves the
    list each step. -#}
{% component lighter(pages, weight) -%}
{%- set_global lo = 0 %}
{%- set_global hi = pages | length %}
{%- for step in range(end=64) %}
{%- if lo >= hi %}{% break %}{% endif %}
{%- set mid = (lo + hi) // 2 %}
{%- set pm = pages[mid] %}
{%- set wm %}{{<front_value path={pm.relative_path} key="weight" default="-1" />}}{% endset %}
{%- if (wm | int) < weight %}{% set_global lo = mid + 1 %}{% else %}{% set_global hi = mid %}{% endif %}
{%- endfor %}
{{- lo }}
{%- endcomponent lighter %}
EOF
}

# Home: the numbered list, posts and folders in the order their weights give.
# In book mode, the outline genbook writes into content/_index.md, and no list.
render_index_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block masthead_extra %}{% if config.description %}<p class="tagline">{{ config.description }}</p>{% endif %}{% endblock %}

{% block content %}
{#- Hidden, not deleted: the page keeps one h1 for the outline and screen readers. -#}
<h1 class="visually-hidden">{{ config.title }}</h1>

{%- if config.extra.book %}
<div class="outline{% if config.extra.outline_numbers %} numbered{% endif %}">{{<linkify html={section.content} />}}</div>
{%- else %}
{{<linkify html={section.content} />}}

{{<post_list pages={section.pages} extra={config.extra} folders={section.subsections} section={section.relative_path} />}}
{%- endif %}
{% endblock %}
EOF
}

# A post, or any other page: title, date line, text, tags, then Previous and Next.
# View history and Suggest an edit lead to GitHub, so a new tab, as Zola gives
# links in posts.
render_page_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ page.title }} | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="{% if page.date %}post-title{% else %}section-title{% endif %}">{% if page.extra?.number %}{{ page.extra.number }} {% endif %}{{ page.title }}{% if page.draft %} <span class="draft">(draft)</span>{% endif %}</h1>
{% if page.description %}<p class="subtitle">{{ page.description }}</p>{% endif %}
{% if page.date %}
{% set pub_date = page.date | date(format="%Y-%m-%d") %}
{% set rev_date = "" %}
{% if page.updated %}{% set rev_date = page.updated | date(format="%Y-%m-%d") %}{% endif %}
{#- One span per item after the date, so the line wraps between items. -#}
<div class="post-meta">
<time datetime="{{ pub_date }}">{{ page.date | date(format=config.extra.date_format) }}</time>
{% if rev_date and rev_date != pub_date %}<span><span class="sep">·</span>Updated <time datetime="{{ rev_date }}">{{ page.updated | date(format=config.extra.date_format) }}</time></span>{% endif %}
{% if config.extra.show_reading_time %}<span><span class="sep">·</span>{{ page.reading_time }} min read</span>{% endif %}
{% if config.extra.show_history_link and config.extra.history_url and page.relative_path %}<span><span class="sep">·</span><a class="history" href="{{ config.extra.history_url }}/{{ page.relative_path }}" target="_blank" rel="noopener noreferrer"{% if config.extra.history_hint %} title="{{ config.extra.history_hint }}"{% endif %}>View history</a></span>{% endif %}
{% if config.extra.show_suggest_edit and config.extra.source_url and page.relative_path %}<span><span class="sep">·</span><a class="source" href="{{ config.extra.source_url }}/{{ page.relative_path }}" target="_blank" rel="noopener noreferrer">Suggest an edit</a></span>{% endif %}
</div>
{% endif %}

{% if page.extra?.avatar_photo %}
{% set av = resize_image(path=page.extra.avatar_photo, width=240, height=240, op="fill") %}
<img class="avatar" src="{{ av.url }}" width="120" height="120" alt="">
{% elif page.extra?.avatar %}<img class="avatar" src="{{ get_url(path=page.extra.avatar) }}" width="120" height="120" alt="">{% endif %}

{% if config.extra.show_toc and page.toc and (page.date or page.extra?.toc) and (page.toc | length > 1 or page.toc[0].children) %}
{{<toc items={page.toc} />}}
{% endif %}

{{<linkify html={page.content} />}}

{% if config.extra.enable_tags and page.taxonomies.tags %}
<div class="post-tags">Tags: {% for tag in page.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</div>
{% endif %}

{#- Zola's lower and higher leave out folders and hidden pages. -#}
{%- if page.lower or page.higher %}
<nav class="post-nav" aria-label="Previous and next">
<div class="post-nav-prev">{% if page.lower %}<a href="{{ page.lower.permalink }}"{% if config.build_search_index %} title="Previous (←)"{% endif %}><span class="label">&larr;&nbsp;Previous</span>{% if page.lower.extra?.nav %}{{ page.lower.extra.nav }}{% else %}{{ page.lower.title }}{% endif %}</a>{% endif %}</div>
<div class="post-nav-home"><a href="{{ get_url(path='/', trailing_slash=true) }}"{% if config.build_search_index %} title="Home (h)"{% endif %}>{% if config.extra.book %}Home{% else %}All posts{% endif %}</a></div>
<div class="post-nav-next">{% if page.higher %}<a href="{{ page.higher.permalink }}"{% if config.build_search_index %} title="Next (→)"{% endif %}><span class="label">Next&nbsp;&rarr;</span>{% if page.higher.extra?.nav %}{{ page.higher.extra.nav }}{% else %}{{ page.higher.title }}{% endif %}</a>{% endif %}</div>
</nav>
{%- endif %}
{% endblock %}
EOF
}

# A section's page: any folder with an _index.md, such as the parent of child
# pages. Its title, subtitle (description), the contents box if it sets
# toc = true under [extra], its text, then its folders and child pages, in the
# same numbered list the home page uses.
render_section_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ section.title }} | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">{{ section.title }}</h1>
{% if section.description %}<p class="subtitle">{{ section.description }}</p>{% endif %}
{% if config.extra.show_toc and section.extra?.toc and section.toc and (section.toc | length > 1 or section.toc[0].children) %}
{{<toc items={section.toc} />}}
{% endif %}
{% if section.content %}{{<linkify html={section.content} />}}{% endif %}
{% if section.pages or section.subsections %}{{<post_list pages={section.pages} extra={config.extra} folders={section.subsections} section={section.relative_path} />}}{% endif %}
{% endblock %}
EOF
}

# /tags/ — every tag with a count.
render_taxonomy_list() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}Tags | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">Tags</h1>
<ul class="tag-list">
{% for term in terms %}
<li><a href="{{ term.permalink }}">{{ term.name }}</a> <span class="count">{{ term.page_count }}</span></li>
{% endfor %}
</ul>
{% endblock %}
EOF
}

# /tags/<tag>/ — posts carrying one tag.
render_taxonomy_single() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}Posts tagged: {{ term.name }} | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">Posts tagged: {{ term.name }}</h1>
<p class="subtitle">{{ term.page_count }} post{% if term.page_count != 1 %}s{% endif %}<span class="sep">·</span><a href="{{ get_url(path='tags', trailing_slash=true) }}">&larr; All tags</a></p>
<div class="unordered">{{<post_list pages={term.pages} extra={config.extra} />}}</div>
{% endblock %}
EOF
}

# static/search.js, while ENABLE_SEARCH is true. The page is built with
# createElement and textContent, never innerHTML.
render_search_js() {
    cat << 'EOF'
// The search box, and the keys for Search, Previous, Next and Home. Written
// by zola-blog-setup; script-owned.
(function () {
    "use strict";
    var dialog = document.querySelector("dialog.search");
    var button = document.querySelector(".search-open");
    // No <dialog> support, no box: the button stays hidden.
    if (!dialog || !button || typeof dialog.showModal !== "function") return;
    var box = dialog.querySelector(".search-box");
    var input = box.querySelector("input");
    var results = box.querySelector(".search-results");
    // Read out by screen readers, which aren't told the list changed.
    var status = box.querySelector("[role=status]");
    var pages = null;
    var loading = null;
    // A match starts a word: nothing, or a non-letter, non-digit, comes before it.
    var WORD_START = "(^|[^\\p{L}\\p{N}])";
    // The index stores text with HTML entities (&amp;, &lt;); DOMParser decodes
    // them without running or fetching anything.
    var parser = new DOMParser();

    function load() {
        if (!loading) {
            loading = fetch(box.dataset.index)
                .then(function (r) {
                    if (!r.ok) throw new Error(r.status);
                    return r.json();
                })
                .then(function (data) {
                    pages = data
                        .filter(function (p) { return p.url !== box.dataset.home; })
                        .map(function (p) {
                            return {
                                url: p.url,
                                title: p.title || p.url,
                                text: parser.parseFromString(p.body || "", "text/html").body.textContent.replace(/\s+/g, " ").trim()
                            };
                        });
                });
        }
        return loading;
    }

    function escape(word) {
        return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function say(text) {
        if (status) status.textContent = text;
    }

    function note(text) {
        say(text);
        var li = document.createElement("li");
        li.className = "search-note";
        li.textContent = text;
        results.appendChild(li);
    }

    // About 180 characters around the first match, cut at spaces, words marked.
    function excerpt(text, words) {
        // Mark the whole word: "micro" marks "microwave".
        var any = new RegExp(WORD_START + "((?:" + words.map(escape).join("|") + ")[\\p{L}\\p{N}]*)", "giu");
        var first = any.exec(text);
        var at = first ? first.index + first[1].length : 0;
        var start = Math.max(0, at - 60);
        var end = Math.min(text.length, start + 180);
        if (start > 0) {
            var space = text.indexOf(" ", start);
            start = space !== -1 && space < at ? space + 1 : at;
        }
        if (end < text.length) {
            var cut = text.lastIndexOf(" ", end);
            if (cut > at) end = cut;
        }
        var part = (start > 0 ? "… " : "") + text.slice(start, end) + (end < text.length ? " …" : "");
        var out = document.createDocumentFragment();
        var from = 0;
        var m;
        any.lastIndex = 0;
        while ((m = any.exec(part)) !== null) {
            var s = m.index + m[1].length;
            out.appendChild(document.createTextNode(part.slice(from, s)));
            var mark = document.createElement("mark");
            mark.textContent = m[2];
            out.appendChild(mark);
            from = s + m[2].length;
        }
        out.appendChild(document.createTextNode(part.slice(from)));
        return out;
    }

    // The result ↑ and ↓ have reached, which Enter opens: the first, until moved.
    var at = 0;
    function pick(n) {
        var links = results.querySelectorAll("a");
        if (links.length === 0) return;
        if (links[at]) links[at].removeAttribute("aria-current");
        at = (n + links.length) % links.length;
        links[at].setAttribute("aria-current", "true");
        links[at].scrollIntoView({ block: "nearest" });
    }

    function show() {
        var words = input.value.split(/\s+/).filter(Boolean);
        results.textContent = "";
        at = 0;
        results.hidden = words.length === 0;
        if (words.length === 0) return say("");
        var tests = words.map(function (w) { return new RegExp(WORD_START + escape(w), "iu"); });
        var inTitle = [], inText = [];
        pages.forEach(function (p) {
            if (!tests.every(function (t) { return t.test(p.title) || t.test(p.text); })) return;
            (tests.every(function (t) { return t.test(p.title); }) ? inTitle : inText).push(p);
        });
        var hits = inTitle.concat(inText);
        if (hits.length === 0) return note("nothing matches");
        say(hits.length === 1 ? "1 result" : hits.length + " results");
        hits.forEach(function (p) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = p.url;
            a.textContent = p.title;
            li.appendChild(a);
            if (p.text) {
                var ex = document.createElement("p");
                ex.className = "search-excerpt";
                ex.appendChild(excerpt(p.text, words));
                li.appendChild(ex);
            }
            results.appendChild(li);
        });
        pick(0);
    }

    button.addEventListener("click", function () {
        // Just under the navigation, below its last line when it wraps (the button
        // comes first): see --search-top in templates/base.html.
        var top = Math.max(0, Math.round(button.parentNode.getBoundingClientRect().bottom)) + 16;
        dialog.style.setProperty("--search-top", top + "px");
        dialog.showModal();
        input.focus();
        input.select();
    });
    // One Esc closes (a search input spends its first Esc clearing itself); not
    // while an input method is composing.
    input.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !e.isComposing) {
            e.preventDefault();
            dialog.close();
        }
        // ↑ and ↓ move through the results, and Enter opens the one reached.
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.isComposing) {
            e.preventDefault();
            pick(at + (e.key === "ArrowDown" ? 1 : -1));
        }
        if (e.key === "Enter" && !e.isComposing) {
            var hit = results.querySelectorAll("a")[at];
            if (hit) {
                e.preventDefault();
                hit.click();
            }
        }
    });
    // A click on the backdrop closes. The press must start there too, or dragging
    // a selection out of the input would close the box.
    var pressedOutside = false;
    dialog.addEventListener("pointerdown", function (e) { pressedOutside = e.target === dialog; });
    dialog.addEventListener("click", function (e) {
        if (pressedOutside && e.target === dialog) dialog.close();
    });
    input.addEventListener("input", function () {
        load().then(show, function () {
            // Forget the failed fetch, so the next keystroke retries.
            loading = null;
            results.textContent = "";
            results.hidden = false;
            note("search is unavailable: the index did not load");
        });
    });
    // "/" opens the box, as on mdBook and GitHub, and h goes Home. ← and →
    // follow the page's Previous and Next: ← from the first goes Home, and → on
    // Home opens the first in its list. A page without them, such as About, has
    // nothing to follow. Not while typing or with a modifier, and the arrows not
    // in a box that scrolls sideways, which they scroll.
    document.addEventListener("keydown", function (e) {
        var t = e.target, link = null;
        if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || dialog.open) return;
        if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
        if (e.key === "/") link = button;
        else if (/^h$/i.test(e.key) && !e.shiftKey) { e.preventDefault(); location.href = box.dataset.home; return; }
        else if (e.shiftKey || t.scrollWidth > t.clientWidth) return;
        else if (e.key === "ArrowLeft") link = document.querySelector(".post-nav-prev a, .post-nav-home a");
        else if (e.key === "ArrowRight") link = document.querySelector(".post-nav-next a")
            || (location.href.split("#")[0] === box.dataset.home ? document.querySelector("main .post-list a, main .outline a") : null);
        if (!link) return;
        e.preventDefault();
        link.click();
    });
    button.hidden = false;
})();
EOF
}

render_404_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}404 | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">Page not found</h1>
<p>This page isn't here. It may have moved, or the URL may be wrong.</p>
<p>
    <a href="{{ get_url(path='/', trailing_slash=true) }}">Home</a>
</p>
{% endblock %}
EOF
}

# Vars: ZOLA_VERSION, ZOLA_SHA256, CHECKOUT_USES, UPLOAD_USES, DEPLOY_USES.
# \${{...}} and \$ keep Actions and runner syntax literal.
render_github_workflow() {
    cat << EOF
name: Deploy to GitHub Pages

on:
  push:
    branches: [main, master]
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
          # The build runs code from the repo; it has no use for a git token.
          persist-credentials: false
      - name: Build with Zola ${ZOLA_VERSION} (pinned)
        run: |
          set -euo pipefail
          url="https://github.com/getzola/zola/releases/download/${ZOLA_VERSION}/zola-${ZOLA_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl -fsSL --proto '=https' --tlsv1.2 -o zola.tar.gz "\$url"
          # The fingerprint setup checked and pinned: no fallback, no skip.
          echo "${ZOLA_SHA256}  zola.tar.gz" | sha256sum -c -
          # The binary alone: the archive's licence files and man pages would
          # land in the checkout.
          tar xzf zola.tar.gz zola
          PATH="\$PWD:\$PATH" bash ./build
      - name: Upload artifact
        uses: ${UPLOAD_USES}
        with:
          path: public
  deploy:
    needs: build
    # Only this job can publish, so only this job gets the two permissions.
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

# =============================================================================
# Entry point (guarded, so the file can be sourced to look at one render_ function)
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````