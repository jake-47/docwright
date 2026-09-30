
<div class="mdb-wide"></div>

# Bootstrap-zola script

The script below scaffolds a Zola blog, installs and version-pins the Zola binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. For details, see [Publish a blog](./publish-blog.md).

````bash
#!/usr/bin/env bash
# zola-blog-setup, v101
#
# Bootstraps a Zola 0.23 blog for GitHub Pages at PROJECT_DIR/BLOG_NAME, and
# keeps it in step with the configuration block below. Re-running is the update
# path: the script-owned files are regenerated, content/ is never touched.
#
#   bash zola-blog-setup.sh              # create or update the blog
#   bash zola-blog-setup.sh update-zola  # update the local Zola
#   bash zola-blog-setup.sh help
#
# How to use it: zola-blog-guide.md. The comments here are for reviewers.

# Under sh (dash) or zsh, set -o pipefail below fails with a cryptic error.
# POSIX, so any shell can run it.
if [ -z "${BASH_VERSION:-}" ]; then
    echo "run this script with bash: bash zola-blog-setup.sh" >&2
    exit 2
fi

set -euo pipefail

## ─── helpers ──────────────────────────────────────────────────────────
say()        { printf '%s\n' "$*"; }
warn()       { printf '%s\n' "$*" >&2; }
die()        { printf '%s\n' "$*" >&2; exit 1; }
die_usage()  { printf '%s\n' "$*" >&2; exit 2; }

# Escape a value for a double-quoted TOML basic string (backslash first).
toml_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    printf '%s' "$s"
}

# Escape for XML text. & goes first, so the ampersands later rules add survive;
# each & in a replacement is backslashed, because from bash 5.2 an unquoted &
# there expands to the match: ${s//</&lt;} would give "<lt;".
esc_xml() {
    local s="$1"
    s="${s//&/\&amp;}"
    s="${s//</\&lt;}"
    s="${s//>/\&gt;}"
    printf '%s' "$s"
}

# Guard: run from a saved file, not piped from curl.
if [ ! -f "${BASH_SOURCE[0]}" ] || [ ! -r "${BASH_SOURCE[0]}" ]; then
    die "run zola-blog-setup from its saved file, not piped from curl."
fi

# Guard: the settings below are checked as text before bash runs them. In a
# value, a " or ` without a backslash before it misleads bash: a " ends the
# quotes early, so it vanishes, the value stops at the next space, or the run
# fails at some line below; a ` runs the text up to the next one as a command.
# None of that names the setting; this does.
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
# The script's only input: it takes no arguments, and a re-run applies whatever
# has changed here. Each setting: zola-blog-guide.md, "Settings, one by one".

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
# Expand a leading ~ (bash doesn't, inside quotes) and make the path absolute.
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
PROJECT_DIR="${PROJECT_DIR%/}"
readonly PROJECT_DIR
readonly BLOG_DIR="$PROJECT_DIR/$BLOG_NAME"

# FAVICON_TEXT -> the mark drawn. "auto" takes SITE_TITLE's first A-Z or 0-9, so
# a renamed site can't keep a stale letter; a set value is cut to 3 characters.
_favicon_mark=""
if [ "$FAVICON_TEXT" = "auto" ]; then
    _favicon_mark="${SITE_TITLE//[^A-Za-z0-9]/}"
    _favicon_mark="${_favicon_mark:0:1}"
    _favicon_mark=$(printf '%s' "$_favicon_mark" | tr '[:lower:]' '[:upper:]')
elif [ -n "$FAVICON_TEXT" ]; then
    _favicon_mark="${FAVICON_TEXT:0:3}"
    if [ "${#FAVICON_TEXT}" -gt 3 ]; then
        warn "FAVICON_TEXT is ${#FAVICON_TEXT} characters and a favicon is read at 16px; only \"${_favicon_mark}\" is drawn"
    fi
fi
readonly FAVICON_MARK="$_favicon_mark"
unset _favicon_mark

## ─── pinned tool versions ─────────────────────────────────────────────
# A band, not a floor, applied to the local Zola and to the workflow pin alike.
# Floor 0.23: the templates are Tera v2 (components, keyword tests, strict
# undefined, no %+ date). Ceiling 0.24: refuse an untested template language
# rather than report success and fail at build. Raise it only after porting the
# templates.
readonly ZOLA_MIN_VERSION="0.23"
readonly ZOLA_MAX_VERSION="0.24"   # exclusive: 0.23.x is supported, 0.24 is not

## ─── shared state (set per invocation) ────────────────────────────────
OS=""
ARCH=""
TMP_ZOLA=""
GITHUB_REPO=""
IS_UPDATE=""
ZOLA_VERSION=""
CI_ZOLA_VERSION=""
ZOLA_SHA256=""
BLOG_CREATED=""
BASE_URL=""
SOURCE_URL=""
HISTORY_URL=""
HISTORY_HINT=""
FORGE_URL=""
REMOTE_URL=""
TODAY=""
YESTERDAY=""
TWO_DAYS_AGO=""

cleanup_tmp() { [ -n "$TMP_ZOLA" ] && rm -rf "$TMP_ZOLA"; return 0; }

# Removes only a folder this run created: BLOG_CREATED is set right after the
# mkdir and cleared once the blog is complete.
cleanup_partial_blog() {
    [ -n "$BLOG_CREATED" ] && [ -d "$BLOG_CREATED" ] && rm -rf "$BLOG_CREATED"
    return 0
}
clear_blog_cleanup() { BLOG_CREATED=""; return 0; }
cleanup_all() { cleanup_tmp; cleanup_partial_blog; }
trap cleanup_all EXIT

# =============================================================================
# Dispatch
# =============================================================================
# Two subcommands. Anything else is an error, never a folder named after a typo.
main() {
    case "${1:-}" in
        "")              cmd_setup ;;
        help|-h|--help)  cmd_help ;;
        update-zola)     cmd_update_zola ;;
        *)               die_usage "unknown command: $*. the script takes help or update-zola, or nothing; everything else is a setting in the block at the top (bash zola-blog-setup.sh help)" ;;
    esac
}

# =============================================================================
# help
# =============================================================================
cmd_help() {
    say "zola-blog-setup — bootstraps a minimal Zola blog."
    cat <<'EOF'

  bash zola-blog-setup.sh              create or update PROJECT_DIR/BLOG_NAME
                                       from the configuration block
  bash zola-blog-setup.sh update-zola  install the latest supported Zola
  bash zola-blog-setup.sh help         this list (also -h and --help)

For one run, in front of the command:
  START_PREVIEW=false          skip the live preview
  REGENERATE_TEMPLATES=true    overwrite script-owned files edited by hand
  ZOLA_VERSION_OVERRIDE=<tag>  use this Zola release instead of the latest

Everything else is a setting in the configuration block. Guide:
zola-blog-guide.md.
EOF
}

# =============================================================================
# Platform detection
# =============================================================================
detect_platform() {
    OS=$(detect_os)
    ARCH=$(detect_arch)
    [ "$OS" = "unknown" ] && die "unsupported OS (uname -s: $(uname -s 2>/dev/null))"
    [ "$ARCH" = "unknown" ] && die "unsupported architecture (uname -m: $(uname -m 2>/dev/null))"
    return 0
}

detect_os() {
    case "$(uname -s 2>/dev/null || echo unknown)" in
        Linux*)               echo "linux" ;;
        Darwin*)              echo "macos" ;;
        MINGW*|CYGWIN*|MSYS*) echo "windows" ;;
        *)                    echo "unknown" ;;
    esac
}

detect_arch() {
    case "$(uname -m 2>/dev/null || echo unknown)" in
        x86_64|amd64)  echo "x86_64" ;;
        aarch64|arm64) echo "aarch64" ;;
        *)             echo "unknown" ;;
    esac
}

# =============================================================================
# setup — create the blog, or update it in place
# =============================================================================
cmd_setup() {
    validate_config
    detect_platform
    if [ -f "$BLOG_DIR/config.toml" ]; then
        run_update_mode
    else
        run_create_mode
    fi
}

# First run: everything, in an order that settles every remote input before a
# single file is created, so a failure leaves nothing behind.
run_create_mode() {
    check_required_tools
    ensure_zola_installed
    resolve_host_config
    resolve_dates
    resolve_workflow_pin
    create_blog_directory
    write_owned_files
    write_content_if_absent
    write_placeholder_assets_if_absent
    check_menu_pages
    warn_placeholders
    clear_blog_cleanup
    say "blog created in $BLOG_DIR"
    say ""
    init_git_repo
    start_preview_server
}

# Re-run: regenerate the script-owned files from the configuration block;
# content/ is left alone.
run_update_mode() {
    say "found an existing blog in $BLOG_DIR"
    say "updating the script-owned files; content/ is left untouched."
    say ""
    IS_UPDATE=1
    # The drift check comes first, before anything is installed or downloaded, so
    # its "nothing has been changed" is true.
    enter_existing_target
    check_owned_file_drift
    check_menu_pages
    check_required_tools
    ensure_zola_installed
    resolve_host_config
    resolve_workflow_pin
    write_owned_files
    warn_placeholders
    update_git_remote
    say ""
    say "updated."
    start_preview_server
}

enter_existing_target() {
    cd "$BLOG_DIR" || die "could not enter blog folder '$BLOG_DIR'"
}

# The script-owned set as "path render_function" pairs: the one list the writer,
# the manifest and the drift check all read. The last three are conditional on
# purpose: a file this run doesn't write (your own favicon, with FAVICON_TEXT="")
# must not be claimed, or the manifest records your bytes and a later run deletes
# them.
owned_files() {
    cat <<'OWNED'
.gitignore render_gitignore
serve render_serve
build render_build
new render_new
attach render_attach
README.md render_readme
config.toml render_site_config
templates/base.html render_base_html
templates/components.html render_components
templates/index.html render_index_html
templates/page.html render_page_html
templates/section.html render_section_html
templates/taxonomy_list.html render_taxonomy_list
templates/taxonomy_single.html render_taxonomy_single
templates/404.html render_404_html
templates/atom.xml render_atom_xml
OWNED
    [ -n "$FAVICON_MARK" ] && printf '%s\n' "static/favicon.svg render_favicon_svg"
    [ "$ENABLE_SEARCH" = true ] && printf '%s\n' "static/search.js render_search_js"
    [ -n "$GIT_REPO_URL" ] && printf '%s\n' ".github/workflows/deploy.yml render_github_workflow"
    return 0
}

# What the last run wrote, one "sha256  path" line per owned file. Tracked, not
# ignored, so it travels with the repo and a checkout restores a consistent pair.
readonly OWNED_MANIFEST=".zola-blog-setup.manifest"

# The digest the manifest records for one path, or nothing.
manifest_sha() {
    awk -v p="$1" '$2 == p { print $1 }' "$OWNED_MANIFEST"
}

# Stop before overwriting a hand edit. Compares each file with the manifest (what
# the last run wrote), not with what this run would write, so a changed setting
# or a newer script never looks like an edit. No manifest: every owned file
# counts as edited, the safe answer for a blog that predates it.
check_owned_file_drift() {
    [ "$REGENERATE_TEMPLATES" = true ] && return 0
    local path fn recorded actual drifted=() no_manifest=""
    if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
        warn "no sha256sum or shasum: cannot tell a hand edit from an update, so the drift check is skipped."
        return 0
    fi
    [ -f "$OWNED_MANIFEST" ] || no_manifest=1
    while read -r path fn; do
        [ -f "$path" ] || continue
        if [ -n "$no_manifest" ]; then drifted+=("$path"); continue; fi
        recorded=$(manifest_sha "$path")
        if [ -z "$recorded" ]; then drifted+=("$path"); continue; fi
        actual=$(sha256_of "$path") || continue
        [ "$actual" = "$recorded" ] || drifted+=("$path")
    done < <(owned_files)
    [ "${#drifted[@]}" -eq 0 ] && return 0
    if [ -n "$no_manifest" ]; then
        warn "there is no $OWNED_MANIFEST in this blog, so a hand edit cannot be told from an"
        warn "ordinary update. either it was written by a version of this script that kept no"
        warn "record, or the last run could not write one. every script-owned file is listed:"
    else
        warn "these files have been changed since this script last wrote them, and a re-run"
        warn "would overwrite them:"
    fi
    local f
    for f in "${drifted[@]}"; do warn "  - $f"; done
    warn ""
    warn "they are script-owned: change the matching render_* function or a configuration"
    warn "variable rather than the file. to overwrite them anyway, run once with"
    warn "    REGENERATE_TEMPLATES=true bash zola-blog-setup.sh"
    warn "nothing has been changed."
    exit 1
}

# Record what this run left on disk, so the next run can tell an edit from an
# update. Written last, after every owned file is in place.
write_owned_manifest() {
    local path fn digest
    : > "$OWNED_MANIFEST"
    while read -r path fn; do
        [ -f "$path" ] || continue
        # A file that can't be hashed is left out; dropping the whole manifest would
        # make every file look edited on the next run.
        digest=$(sha256_of "$path") || { warn "could not hash $path; leaving it out of $OWNED_MANIFEST"; continue; }
        printf '%s  %s\n' "$digest" "$path" >> "$OWNED_MANIFEST"
    done < <(owned_files)
    return 0
}

write_owned_files() {
    mkdir -p templates static
    local path fn
    while read -r path fn; do
        # A path with no slash is its own ${path%/*}; only make a directory when
        # the entry actually names one.
        [ "$path" = "${path%/*}" ] || mkdir -p "${path%/*}"
        "$fn" > "$path"
    done < <(owned_files)
    chmod +x serve build new attach
    # Owned in both directions: clearing the variable that produced a file removes
    # the file, but only if the manifest says these are the bytes this script wrote.
    if [ -z "$FAVICON_MARK" ]; then
        local why="FAVICON_TEXT is empty" fix="add static/favicon.svg yourself"
        if [ "$FAVICON_TEXT" = "auto" ]; then
            why="SITE_TITLE has no letter A-Z or digit 0-9 for FAVICON_TEXT=\"auto\" to draw"
            fix="set FAVICON_TEXT to up to 3 characters, or add static/favicon.svg yourself"
        fi
        if [ -f static/favicon.svg ]; then
            if remove_if_ours static/favicon.svg; then
                say "removed static/favicon.svg ($why)"
            fi
        elif [ "$IS_UPDATE" != 1 ]; then
            warn "$why, so no favicon was written: $fix."
        fi
    fi
    if [ "$ENABLE_SEARCH" != true ] && [ -f static/search.js ] && remove_if_ours static/search.js; then
        say "removed static/search.js (ENABLE_SEARCH is false)"
    fi
    # Without its _index.md, Zola publishes nothing in content/attachments/ and
    # every @/attachments/ link stops the build.
    if [ -d content/attachments ] && [ ! -f content/attachments/_index.md ]; then
        warn "content/attachments/ has no _index.md, so Zola won't publish what's in it and every @/attachments/ link stops the build. the guide's \"Pictures, GIFs and video\" gives the file."
    fi
    if [ "$MASTHEAD" = image ] && [ ! -f static/logo.svg ]; then
        warn "MASTHEAD is \"image\" but static/logo.svg is not there; the masthead shows an empty box until you add it. Supply a flat silhouette on a transparent ground — it is painted as a mask, so any background in the file masks the whole box solid."
    fi
    write_deploy_workflow
    write_owned_manifest
    say "wrote the script-owned files (config.toml, templates/, serve, build, new, attach, README.md, .gitignore)"
}

validate_config() {
    case "$MASTHEAD" in
        none|text|image) ;;
        *) die "MASTHEAD must be none, text or image, got: $MASTHEAD" ;;
    esac

    # BLOG_NAME becomes a directory under PROJECT_DIR, so it is a single
    # segment: no slashes, no leading dash or dot, no '..', no whitespace.
    case "$BLOG_NAME" in
        ""|*/*|*\\*|.*|-*|*..*|*" "*|*$'\t'*|*\"*)
            die "BLOG_NAME must be a plain folder name (no slashes, leading dash or dot, spaces, '..', or double quotes), got: '$BLOG_NAME'" ;;
    esac

    # base_url, the post links and the origin remote all assume the https github.com
    # form, and the deploy is GitHub Pages regardless.
    case "$GIT_REPO_URL" in
        "") ;;
        *$'\n'*|*$'\r'*) die "GIT_REPO_URL must not contain newlines or carriage returns" ;;
        https://github.com/*/*) ;;
        *) die "GIT_REPO_URL must be an https github.com URL (https://github.com/user/repo), got: $GIT_REPO_URL" ;;
    esac
    # The repository's main page and nothing after it: a deeper path (/tree/main,
    # ?tab=...) would name a repository that isn't yours.
    if [ -n "$GIT_REPO_URL" ]; then
        local repo_path="${GIT_REPO_URL#https://github.com/}"
        local not_repo_page="GIT_REPO_URL must be the address of the repository's main page, https://github.com/user/repo, with nothing after the repository's name; got: $GIT_REPO_URL"
        repo_path="${repo_path%/}"
        repo_path="${repo_path%.git}"
        case "$repo_path" in
            */*/*|*[!A-Za-z0-9._/-]*) die "$not_repo_page" ;;
            ?*/?*) ;;
            *) die "$not_repo_page" ;;
        esac
    fi

    case "$CUSTOM_DOMAIN" in
        ""|https://*) ;;
        *) die "CUSTOM_DOMAIN must be an https:// URL (got: $CUSTOM_DOMAIN)" ;;
    esac

    validate_bool GENERATE_FEEDS      "$GENERATE_FEEDS"
    validate_bool SHOW_RSS_LINK       "$SHOW_RSS_LINK"
    validate_bool LIGHT_THEME         "$LIGHT_THEME"
    validate_bool SHOW_TOC            "$SHOW_TOC"
    validate_bool SHOW_BREADCRUMBS    "$SHOW_BREADCRUMBS"
    validate_bool SHOW_READING_TIME   "$SHOW_READING_TIME"
    validate_bool SHOW_HISTORY_LINK   "$SHOW_HISTORY_LINK"
    validate_bool SHOW_SUGGEST_EDIT   "$SHOW_SUGGEST_EDIT"
    validate_bool ENABLE_TAGS         "$ENABLE_TAGS"
    validate_bool ENABLE_SEARCH       "$ENABLE_SEARCH"
    validate_bool START_PREVIEW       "$START_PREVIEW"
    validate_bool REGENERATE_TEMPLATES "$REGENERATE_TEMPLATES"

    # Tera prints a format with no % code as it is, the same text for every date.
    case "$DATE_FORMAT" in
        *%*) ;;
        *) die "DATE_FORMAT needs at least one % code, such as \"%Y-%m-%d\" or \"%-d %B %Y\"; got: '$DATE_FORMAT'" ;;
    esac
    validate_menu_pages
    validate_footer_links
}

# One name per word: content/NAME.md, or a folder's content/NAME/_index.md
# (menu_page_path). base.html looks each one up.
validate_menu_pages() {
    local name names=()
    read -r -a names <<< "$MENU_PAGES"
    [ "${#names[@]}" -gt 0 ] || return 0
    for name in "${names[@]}"; do
        case "$name" in
            /*|*/|.*|*/.*|-*|*..*|*[!A-Za-z0-9._/-]*|*.md|index|*/index|_index|*/_index)
                die "MENU_PAGES takes the names of pages in content/, without .md, separated by spaces, such as \"about now\"; got: '$name'" ;;
        esac
    done
}

# Label=address per word. The address must be absolute: a bare "x.com/me" would
# become a link inside the blog.
validate_footer_links() {
    local item label url links=()
    read -r -a links <<< "$FOOTER_LINKS"
    [ "${#links[@]}" -gt 0 ] || return 0
    for item in "${links[@]}"; do
        case "$item" in
            ?*=?*) ;;
            *) die "FOOTER_LINKS takes Label=address pairs separated by spaces, such as \"X=https://x.com/you\"; got: '$item'" ;;
        esac
        label="${item%%=*}"
        url="${item#*=}"
        case "$label" in
            *[\"\\]*) die "a FOOTER_LINKS label can't contain a quote or a backslash; got: '$label'" ;;
        esac
        case "$url" in
            *[\"\\\<\>]*) die "a FOOTER_LINKS address can't contain a quote, backslash or angle bracket; got: '$url'" ;;
            https://?*|http://?*|mailto:?*) ;;
            *) die "a FOOTER_LINKS address must start with https://, http:// or mailto:; got: '$url' for $label" ;;
        esac
    done
}

# The booleans go into config.toml unquoted; unchecked, SHOW_TOC=yes would pass
# here and fail at the next build.
validate_bool() {
    case "$2" in
        true|false) return 0 ;;
        *) die "$1 must be true or false (unquoted), got: '$2'" ;;
    esac
}

# Where a MENU_PAGES name lives, from content/: NAME.md, a page that hidden = true
# keeps out of every list, or NAME/_index.md, a folder: a menu page with pages
# under it. A new blog has neither yet: the page, which write_content_if_absent
# then writes.
menu_page_path() {
    if [ -f "content/$1.md" ]; then
        printf '%s' "$1.md"
    elif [ -f "content/$1/_index.md" ]; then
        printf '%s' "$1/_index.md"
    else
        printf '%s' "$1.md"
    fi
}

# Every MENU_PAGES name needs a page to link to, or the build stops at base.html's
# get_page. Runs before anything is written on a re-run.
check_menu_pages() {
    local name file names=()
    read -r -a names <<< "$MENU_PAGES"
    [ "${#names[@]}" -gt 0 ] || return 0
    for name in "${names[@]}"; do
        if [ -f "content/$name.md" ] && [ -f "content/$name/_index.md" ]; then
            die "MENU_PAGES names $name, but there's both content/$name.md and content/$name/_index.md, and Zola won't build two pages at one address. keep one. nothing has been changed."
        fi
        file="content/$(menu_page_path "$name")"
        if [ ! -f "$file" ]; then
            die "MENU_PAGES names $name, but there's no content/$name.md. make that page first (guide: \"Adding a page to the menu\"), or take $name out of MENU_PAGES. nothing has been changed."
        fi
        if grep -q '^render *[=:] *false' "$file"; then
            die "MENU_PAGES names $name, but $file says render = false, so there is no page to link to. nothing has been changed."
        fi
        # Without hidden, a page is a post: listed if it has a weight, left out if not.
        if [ "${file%/_index.md}" = "$file" ] && ! grep -q '^hidden *[=:] *true' "$file"; then
            die "MENU_PAGES names $name, but $file doesn't say hidden = true, so it counts as a post: listed on the home page if it has a weight, left out of the site if not. add hidden = true under its title. nothing has been changed."
        fi
    done
}

# Example values the script came with, while GIT_REPO_URL publishes the blog.
warn_placeholders() {
    [ -n "$GIT_REPO_URL" ] || return 0
    local left=()
    [ "$SITE_TITLE" != "Myblog" ] || left+=("SITE_TITLE")
    [ "$SITE_DESCRIPTION" != "one-line description" ] || left+=("SITE_DESCRIPTION")
    [ "$SITE_AUTHOR" != "your name" ] || left+=("SITE_AUTHOR")
    case "$FOOTER_LINKS" in *yourhandle*|*npub1yourkeyhere*|*yourrepo*) left+=("FOOTER_LINKS") ;; esac
    if [ -f content/about.md ] \
       && grep -q -e 'you@yourdomain.com' -e 'Your name. One or two sentences' content/about.md; then
        left+=("content/about.md")
    fi
    [ "${#left[@]}" -gt 0 ] || return 0
    local list
    list=$(printf '%s, ' "${left[@]}")
    warn "still the examples the script came with, and GIT_REPO_URL will publish them: ${list%, }. the guide's \"Before you publish\" says what to change."
}

update_git_remote() {
    [ -n "$REMOTE_URL" ] || return 0
    if ! command -v git >/dev/null 2>&1; then
        say "git not installed; remote not updated"
        return
    fi
    # The blog folder's own repository: rev-parse also finds a repository the folder
    # sits inside, and would repoint that one's origin.
    if [ ! -e .git ]; then
        say "not a git repo; remote not updated"
        return
    fi
    if git remote get-url origin >/dev/null 2>&1; then
        # The configured URL: get-url applies url.*.insteadOf and would never match.
        local existing
        existing=$(git config --get remote.origin.url || true)
        if [ "$existing" != "$REMOTE_URL" ]; then
            git remote set-url origin "$REMOTE_URL"
            say "updated remote 'origin' to $REMOTE_URL"
        fi
    else
        git remote add origin "$REMOTE_URL"
        say "added remote 'origin': $REMOTE_URL"
    fi
}

# =============================================================================
# HTTP download and Zola install
# =============================================================================
http_download() {
    local url="$1" dest="$2"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --proto '=https' --tlsv1.2 \
            --connect-timeout 30 --max-time 300 "$url" -o "$dest"
    elif command -v wget >/dev/null 2>&1; then
        wget -nv --https-only --timeout=30 --tries=2 "$url" -O "$dest"
    else
        warn "need curl or wget"
        return 1
    fi
}

# sha256 of a file as bare hex. Non-zero (and silent) if neither tool exists.
sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        return 1
    fi
}

# Hard-required: one of curl/wget, plus tar on Linux/macOS and unzip on Windows.
check_required_tools() {
    local missing=()

    if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
        missing+=("curl or wget (one is required)")
    fi
    case "$OS" in
        linux|macos) command -v tar   >/dev/null 2>&1 || missing+=("tar") ;;
        windows)     command -v unzip >/dev/null 2>&1 || missing+=("unzip") ;;
    esac

    if [ "${#missing[@]}" -gt 0 ]; then
        warn "missing required tools:"
        local tool
        for tool in "${missing[@]}"; do
            warn "  - $tool"
        done
        exit 1
    fi

    command -v git >/dev/null 2>&1 \
        || warn "warning: git not found - repo init will be skipped."
    if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
        warn "warning: no sha256sum or shasum - the run will stop rather than install a"
        warn "         binary whose digest it cannot record. install coreutils and re-run."
    fi
}

# The release to install and pin, into ZOLA_VERSION: ZOLA_VERSION_OVERRIDE if
# set, else the latest tag via the releases/latest redirect (no API token, no
# rate limit), refused if it's outside the band.
resolve_zola_release() {
    [ -n "$ZOLA_VERSION" ] && return 0
    if [ -n "${ZOLA_VERSION_OVERRIDE:-}" ]; then
        ZOLA_VERSION="${ZOLA_VERSION_OVERRIDE#v}"; ZOLA_VERSION="v${ZOLA_VERSION}"
        version_in_band "${ZOLA_VERSION#v}" || warn "warning: ZOLA_VERSION_OVERRIDE names ${ZOLA_VERSION}, outside this script's supported band (>= ${ZOLA_MIN_VERSION}, < ${ZOLA_MAX_VERSION}). the templates are written for Tera v2 and may not build."
        return 0
    fi
    local tag=""
    # curl only; a wget-only machine falls through to the API path below.
    if command -v curl >/dev/null 2>&1; then
        tag=$(curl -fsSLI -o /dev/null -w '%{url_effective}\n' \
            https://github.com/getzola/zola/releases/latest 2>/dev/null \
            | sed -n 's#.*/tag/##p' || true)
    fi
    tag="${tag%%[[:space:]]*}"
    if [ -z "$tag" ]; then
        tag=$(http_download https://api.github.com/repos/getzola/zola/releases/latest /dev/stdout 2>/dev/null \
            | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1 || true)
        tag="${tag%%[[:space:]]*}"
    fi
    [ -n "$tag" ] || die "could not resolve the latest zola release from GitHub (network?). run this again, or install a ${ZOLA_MIN_VERSION}.x release yourself from https://github.com/getzola/zola/releases and run this again."
    if ! version_in_band "${tag#v}"; then
        die "zola ${tag#v} is the latest release, but this script supports >= ${ZOLA_MIN_VERSION} and < ${ZOLA_MAX_VERSION}.
the templates it writes are written for one template-language generation, and a newer
zola may not run them. nothing has been changed. either update this script, or pin a
tested release for this run, with the newest v${ZOLA_MIN_VERSION} release's last number in place of x:
    ZOLA_VERSION_OVERRIDE=v${ZOLA_MIN_VERSION}.x bash zola-blog-setup.sh
releases: https://github.com/getzola/zola/releases"
    fi
    ZOLA_VERSION="$tag"
}

# Return 0 if dotted-numeric version $1 >= $2.
version_ge() {
    [ "$1" = "$2" ] && return 0
    local lower
    lower=$(printf '%s\n%s\n' "$1" "$2" | sort -V | sed -n '1p')
    [ "$lower" = "$2" ]
}

# Return 0 if $1 is inside [ZOLA_MIN_VERSION, ZOLA_MAX_VERSION). One predicate,
# used by the local-binary check and by the workflow pin, so the two cannot
# disagree about what this script supports.
version_in_band() {
    version_ge "$1" "$ZOLA_MIN_VERSION" && ! version_ge "$1" "$ZOLA_MAX_VERSION"
}

# Keep a local Zola inside the band, else install one. Replacing a newer one is
# said out loud: ~/.local/bin/zola is shared with every other site here.
ensure_zola_installed() {
    local current=""
    if command -v zola >/dev/null 2>&1; then
        current=$(zola --version 2>/dev/null | awk '{print $2}')
    fi
    if [ -n "$current" ] && version_in_band "$current"; then
        ZOLA_VERSION="v${current}"
        say "zola $current present (inside the supported band >= $ZOLA_MIN_VERSION, < $ZOLA_MAX_VERSION); using it."
        return
    fi
    resolve_zola_release
    if [ -n "$current" ] && version_ge "$current" "$ZOLA_MAX_VERSION"; then
        # Replaced only if it lives where install_zola puts one; else it stays beside it.
        local where dest="$HOME/.local/bin/zola"
        [ "$OS" = windows ] && dest="$HOME/bin/zola.exe"
        where=$(command -v zola)
        warn "zola $current, at $where, is newer than this script supports (< $ZOLA_MAX_VERSION)."
        if [ "${where%/*}" = "${dest%/*}" ]; then
            warn "replacing it with ${ZOLA_VERSION#v}: any other zola site on this machine will build"
            warn "with ${ZOLA_VERSION#v} until you reinstall."
        else
            warn "installing ${ZOLA_VERSION#v} as $dest, beside it. a terminal runs whichever comes"
            warn "first in its PATH (guide: \"Two Zolas\")."
        fi
    elif [ -n "$current" ]; then
        say "zola $current is below the $ZOLA_MIN_VERSION floor; installing ${ZOLA_VERSION#v}..."
    else
        say "zola not found; installing ${ZOLA_VERSION#v}..."
    fi
    install_zola "$OS" "$ARCH" "$ZOLA_VERSION"
}

install_zola() {
    local os="$1" arch="$2" version="$3"
    local triple ext=tar.gz

    case "${os}_${arch}" in
        linux_x86_64)    triple="x86_64-unknown-linux-gnu" ;;
        linux_aarch64)   triple="aarch64-unknown-linux-gnu" ;;
        macos_x86_64)    triple="x86_64-apple-darwin" ;;
        macos_aarch64)   triple="aarch64-apple-darwin" ;;
        windows_x86_64)  triple="x86_64-pc-windows-msvc"; ext=zip ;;
        windows_aarch64) die "zola publishes no arm64 Windows build; install zola yourself and re-run" ;;
        *)               die "unsupported platform ${os}/${arch}" ;;
    esac

    local url="https://github.com/getzola/zola/releases/download/${version}/zola-${version}-${triple}.${ext}"

    # No trap here: it would replace cleanup_all and disable the partial-blog
    # cleanup on first runs. cleanup_all already calls cleanup_tmp.
    TMP_ZOLA=$(mktemp -d)
    local archive="$TMP_ZOLA/zola.$ext"

    say "downloading zola $version..."
    http_download "$url" "$archive" \
        || die "could not download zola $version from $url. check the network, and that $version is a release listed at https://github.com/getzola/zola/releases."

    [ -s "$archive" ] || die "download produced an empty file"

    # Zola publishes no checksums, so this digest is printed, not compared; trust
    # rests on https to github.com.
    local digest
    digest=$(sha256_of "$archive") || die "need sha256sum or shasum to record the download's digest"
    say "sha256 of the downloaded archive: $digest"

    if [ "$ext" = "zip" ]; then
        command -v unzip >/dev/null 2>&1 || die "need unzip"
        unzip -q "$archive" -d "$TMP_ZOLA"
    else
        tar xzf "$archive" -C "$TMP_ZOLA"
    fi

    local bin
    bin=$(find "$TMP_ZOLA" -maxdepth 2 \( -name zola -o -name zola.exe \) -print -quit)
    [ -z "$bin" ] && die "zola binary not found"
    chmod +x "$bin"

    # Checked before the export below, or the answer is always yes.
    local on_path=""
    case ":$PATH:" in *":$HOME/.local/bin:"*) on_path=1 ;; esac

    case "$os" in
        linux|macos)
            mkdir -p "$HOME/.local/bin"
            say "installing to $HOME/.local/bin..."
            mv "$bin" "$HOME/.local/bin/zola"
            export PATH="$HOME/.local/bin:$PATH" ;;
        windows)
            mkdir -p "$HOME/bin"
            mv "$bin" "$HOME/bin/zola.exe"
            export PATH="$HOME/bin:$PATH"
            say "installed to $HOME/bin/zola.exe (ensure this is on your PATH)" ;;
    esac

    command -v zola >/dev/null 2>&1 || die "zola not on PATH"
    say "installed: $(zola --version)"

    # New terminals take PATH from the login: on Linux ~/.profile, so the next login;
    # a Mac terminal is a login shell, so a new one is enough.
    if [ -z "$on_path" ]; then
        case "$os" in
            linux)
                say ""
                say "note: $HOME/.local/bin is not on your PATH, so a new terminal will not"
                say "find zola. log out and back in; on Debian, Devuan and Ubuntu that is usually"
                say "all it takes. if a new terminal still cannot find it, add this line to"
                say "$HOME/.profile, then log out and back in again:"
                say "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                ;;
            macos)
                say ""
                say "note: $HOME/.local/bin is not on your PATH, so a new terminal will not"
                say "find zola. add this line to $HOME/.zprofile, then open a new terminal:"
                say "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                ;;
        esac
    fi
}

# =============================================================================
# update-zola — install the latest Zola release (deliberate; verified)
# =============================================================================
cmd_update_zola() {
    detect_platform
    check_required_tools
    local current=""
    if command -v zola >/dev/null 2>&1; then
        current=$(zola --version 2>/dev/null | awk '{print $2}')
    fi
    resolve_zola_release
    if [ -n "$current" ] && [ "v${current}" = "$ZOLA_VERSION" ]; then
        say "zola $current is already the latest (${ZOLA_VERSION#v})."
        return
    fi
    say "updating zola: ${current:-none} -> ${ZOLA_VERSION#v}"
    install_zola "$OS" "$ARCH" "$ZOLA_VERSION"
    say ""
    say "zola is now at ${ZOLA_VERSION#v}."
    say "existing blogs keep the version their workflow pins. re-run zola-blog-setup"
    say "against a blog to re-pin it to this version, then commit and push."
}

# =============================================================================
# Host / project config resolution
# =============================================================================
# Everything host-shaped comes from GIT_REPO_URL (validated above; a trailing /
# or .git is tolerated). CUSTOM_DOMAIN replaces base_url and nothing else.
resolve_host_config() {
    if [ -n "$GIT_REPO_URL" ]; then
        local rest="${GIT_REPO_URL#https://github.com/}"
        rest="${rest%/}"
        rest="${rest%.git}"
        local user="${rest%%/*}"
        local repo="${rest##*/}"
        if [ -z "$user" ] || [ -z "$repo" ]; then
            die "GIT_REPO_URL does not name a user and a repo: $GIT_REPO_URL"
        fi
        GITHUB_REPO="${user}/${repo}"
        # GitHub wants a user site's repository name in lower case, so compare that way:
        # John's john.github.io is a user site, not a project at /john.github.io/.
        local user_lc repo_lc
        user_lc=$(printf '%s' "$user" | tr '[:upper:]' '[:lower:]')
        repo_lc=$(printf '%s' "$repo" | tr '[:upper:]' '[:lower:]')
        if [ "$repo_lc" = "${user_lc}.github.io" ]; then
            BASE_URL="https://${user}.github.io"
        else
            BASE_URL="https://${user}.github.io/${repo}"
        fi
        [ -n "$CUSTOM_DOMAIN" ] && BASE_URL="${CUSTOM_DOMAIN%/}"
        SOURCE_URL="https://github.com/${GITHUB_REPO}/blob/main/content"
        HISTORY_URL="https://github.com/${GITHUB_REPO}/commits/main/content"
        HISTORY_HINT="Click a commit, then 'Display the rich diff' for rendered prose"
        FORGE_URL="https://github.com/${GITHUB_REPO}"
        REMOTE_URL="git@github.com:${GITHUB_REPO}.git"
    else
        # Local-only: a placeholder base_url (Zola requires one; serve overrides it) and
        # empty repo links, so nothing renders dead.
        BASE_URL="${CUSTOM_DOMAIN:-https://yourusername.github.io}"
        BASE_URL="${BASE_URL%/}"
        SOURCE_URL=""
        HISTORY_URL=""
        HISTORY_HINT=""
        FORGE_URL=""
        REMOTE_URL=""
    fi
}

resolve_dates() {
    TODAY=$(date +%Y-%m-%d)
    YESTERDAY=$(date -d "1 day ago" +%Y-%m-%d 2>/dev/null \
        || date -v-1d +%Y-%m-%d 2>/dev/null || echo "$TODAY")
    TWO_DAYS_AGO=$(date -d "2 days ago" +%Y-%m-%d 2>/dev/null \
        || date -v-2d +%Y-%m-%d 2>/dev/null || echo "$TODAY")
}

# =============================================================================
# Filesystem and git
# =============================================================================
create_blog_directory() {
    [ -e "$BLOG_DIR" ] && die "'$BLOG_DIR' exists but holds no config.toml; move it aside or point BLOG_NAME somewhere else."
    say ""
    say "creating $BLOG_DIR ..."
    # Just the folder; each writer makes the subfolders it fills.
    mkdir -p "$BLOG_DIR" \
        || die "could not create $BLOG_DIR (is PROJECT_DIR writable?)"
    cd "$BLOG_DIR"
    BLOG_CREATED="$BLOG_DIR"   # armed for cleanup_partial_blog until the blog is complete
}

init_git_repo() {
    if ! command -v git >/dev/null 2>&1; then
        say "git not installed - skipping repo init (blog still works)"
        return
    fi
    if git init -b main >/dev/null 2>&1; then
        say "initialised git repo on branch: main"
    else
        # Stop: add and commit would reach a repository the blog folder sits inside.
        say "git init failed - run manually later"
        return
    fi
    local name email
    name=$(git config --get user.name  2>/dev/null || true)
    email=$(git config --get user.email 2>/dev/null || true)
    if [ -n "$name" ] && [ -n "$email" ]; then
        if git add -A >/dev/null 2>&1 && \
           git commit -q -m "initial commit: zola blog scaffolding" >/dev/null 2>&1; then
            say "made initial commit"
        else
            say "(initial commit skipped)"
        fi
    else
        say "(git user.name/user.email not configured - initial commit skipped)"
        say "(set them later with:"
        say "     git config --global user.name \"Your Name\""
        say "     git config --global user.email \"Your Email\" )"
    fi
    update_git_remote
}

# exec replaces this process, so the EXIT trap never fires: clean up first. It runs
# the blog's own serve, so this preview and ./serve are one command (drafts shown);
# through bash, so a folder that can't run programs still gets it.
# Skipped with START_PREVIEW=false or no terminal, so a script can drive this one.
start_preview_server() {
    if [ "$START_PREVIEW" != true ] || [ ! -t 1 ]; then
        cleanup_tmp
        say ""
        say "skipping the live preview. start it any time, from anywhere:"
        say "    $BLOG_DIR/serve"
        return 0
    fi
    say ""
    say "starting the live preview (your browser will open). Ctrl+C to stop."
    say "to start it again later, from anywhere: $BLOG_DIR/serve"
    say ""
    cleanup_tmp
    exec bash "$BLOG_DIR/serve"
}

# =============================================================================
# Writers (thin orchestrators dispatching to the render_* functions below)
# =============================================================================
# content/ and the placeholder assets: written once, never rewritten.
write_content_if_absent() {
    mkdir -p content/attachments
    write_absent content/_index.md                render_home_index
    write_absent content/attachments/_index.md    render_attachments_index
    write_absent content/about.md                 render_about
    write_absent content/hello-world.md           render_hello_world
    write_absent content/attachments/demo.svg     render_demo_svg
    write_absent content/second-post.md           render_second_post
    # A starter page for each other MENU_PAGES name, so a new blog builds.
    local name names=()
    read -r -a names <<< "$MENU_PAGES"
    if [ "${#names[@]}" -gt 0 ]; then
        for name in "${names[@]}"; do
            if [ -e "content/$name.md" ] || [ -e "content/$name/_index.md" ]; then continue; fi
            [ "$name" = "${name%/*}" ] || mkdir -p "content/${name%/*}"
            render_menu_page "$name" > "content/$name.md"
        done
    fi
    say "wrote content/ (yours from here; a re-run will not touch it)"
}

write_placeholder_assets_if_absent() {
    mkdir -p static/fonts
    write_absent static/avatar.svg        render_avatar_svg
    write_absent static/fonts/README.txt  render_fonts_readme
}

write_absent() {
    local path="$1" fn="$2"
    [ -e "$path" ] && return 0
    "$fn" > "$path"
}

# Does the tag name a downloadable linux asset? One HEAD before a 15 MB download.
release_asset_exists() {
    local tag="$1"
    local url="https://github.com/getzola/zola/releases/download/${tag}/zola-${tag}-x86_64-unknown-linux-gnu.tar.gz"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSLI -o /dev/null --connect-timeout 30 --max-time 60 "$url" >/dev/null 2>&1
    elif command -v wget >/dev/null 2>&1; then
        wget -q --spider --timeout=30 --tries=1 "$url" >/dev/null 2>&1
    else
        return 1
    fi
}

# The version the workflow pins: the local one only if it's inside the band and a
# real release asset (a distro build such as 0.22.1+dfsg names no release), else
# the latest release. One exact release, not the newest on every build: Zola is
# pre-1.0 and even patch releases change what a template does (0.23.5 brought back
# the date filter's locale), so a pinned build keeps doing what the preview did,
# and only a fixed file can have its checksum recorded.
resolve_zola_version_for_workflow() {
    [ -n "$CI_ZOLA_VERSION" ] && return 0
    local local_ver=""
    if command -v zola >/dev/null 2>&1; then
        local_ver=$(zola --version 2>/dev/null | awk '{print $2}')
    fi
    # A version this blog's workflow already pins was a real release when it was
    # recorded, so keeping it needs no network.
    if [ -n "$local_ver" ] && version_in_band "$local_ver" \
       && { recorded_workflow_sha "v${local_ver}" >/dev/null || release_asset_exists "v${local_ver}"; }; then
        CI_ZOLA_VERSION="v${local_ver}"
        say "pinning zola ${local_ver} into the workflow (same build as this machine)"
        return 0
    fi
    # ensure_zola_installed left the local version in ZOLA_VERSION; cleared, or
    # resolve_zola_release returns it and the version just rejected gets pinned.
    ZOLA_VERSION=""
    resolve_zola_release
    CI_ZOLA_VERSION="$ZOLA_VERSION"
    if [ -n "$local_ver" ]; then
        # ensure_zola_installed has replaced an out-of-band zola, so two causes remain.
        say "local zola ${local_ver} isn't a published release, or GitHub couldn't be reached"
        say "to check; pinning ${CI_ZOLA_VERSION#v} into the workflow instead."
    else
        say "pinning zola ${CI_ZOLA_VERSION#v} into the workflow"
    fi
}

# The digest is recorded once, at setup, and CI checks against it; one fetched
# beside the file at build time would prove nothing. Nothing here can vouch for
# the bytes when first recorded: every source is github over https.
resolve_zola_sha_for_workflow() {
    [ -n "$ZOLA_SHA256" ] && return 0
    if ZOLA_SHA256=$(recorded_workflow_sha "$CI_ZOLA_VERSION"); then
        say "reusing the digest already pinned in .github/workflows/deploy.yml for ${CI_ZOLA_VERSION#v}"
    else
        local url tmpdir
        # Always the Linux x86_64 build the runner uses; downloaded only to be hashed.
        url="https://github.com/getzola/zola/releases/download/${CI_ZOLA_VERSION}/zola-${CI_ZOLA_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
        tmpdir=$(mktemp -d)
        say "hashing the linux zola ${CI_ZOLA_VERSION#v} build to pin it into the workflow..."
        if http_download "$url" "$tmpdir/zola.tar.gz" && [ -s "$tmpdir/zola.tar.gz" ]; then
            ZOLA_SHA256=$(sha256_of "$tmpdir/zola.tar.gz") || ZOLA_SHA256=""
        fi
        rm -rf "$tmpdir"
    fi
    [ -n "$ZOLA_SHA256" ] || die "could not hash the linux zola ${CI_ZOLA_VERSION} build, which the workflow pins; nothing was created. check the network and run this again."
    say "pinned the zola builder digest into the workflow"
}

# Reuse the digest deploy.yml already pins for this version: no download, works
# offline, proves the same. A version change forces a fresh hash.
recorded_workflow_sha() {
    # Absolute: resolve_workflow_pin runs before the cd into the blog folder.
    local want="$1" wf="$BLOG_DIR/.github/workflows/deploy.yml" pinned_ver pinned_sha
    [ -f "$wf" ] || return 1
    pinned_ver=$(sed -n 's|.*releases/download/\(v[0-9][0-9.]*\)/zola-.*|\1|p' "$wf" | head -n1)
    [ -n "$pinned_ver" ] && [ "$pinned_ver" = "$want" ] || return 1
    pinned_sha=$(sed -n 's|^[[:space:]]*echo "\([0-9a-f]\{64\}\)[[:space:]].*|\1|p' "$wf" | head -n1)
    [ -n "$pinned_sha" ] || return 1
    printf '%s' "$pinned_sha"
}

# Settle everything the workflow pins before a single file is created, so a
# failure here leaves no half-written blog behind.
resolve_workflow_pin() {
    [ -n "$GIT_REPO_URL" ] || return 0   # no workflow, nothing to pin
    resolve_zola_version_for_workflow
    resolve_zola_sha_for_workflow
}

# The workflow is written by the owned_files loop. This is the removal side.
write_deploy_workflow() {
    if [ -n "$GIT_REPO_URL" ]; then
        :
    elif [ -f .github/workflows/deploy.yml ]; then
        # GIT_REPO_URL was cleared: a leftover workflow would keep deploying against the
        # placeholder base_url. Removed only if unedited; kept, with a warning, if not.
        local rc=0
        remove_if_ours .github/workflows/deploy.yml || rc=$?
        if [ "$rc" -eq 0 ]; then
            rmdir .github/workflows .github 2>/dev/null || true
            say "removed .github/workflows/deploy.yml (GIT_REPO_URL is empty); commit the deletion to stop the deploy"
        else
            if [ "$rc" -eq 1 ]; then
                warn "GIT_REPO_URL is empty but .github/workflows/deploy.yml has been edited since this script wrote it, so it was left in place."
            else
                warn "GIT_REPO_URL is empty, but there is no record of this script having written .github/workflows/deploy.yml, so it was left in place."
            fi
            warn "it will keep deploying on every push, and base_url has reverted to a placeholder. delete it yourself when you have saved what you changed."
        fi
    fi
}

# Remove an owned file the configuration no longer calls for, only if its bytes
# are the ones this script last wrote (the manifest says which).
#   0  removed
#   1  edited since this script wrote it: kept
#   2  no record either way: kept, and not called edited
remove_if_ours() {
    local path="$1" recorded actual
    [ -f "$OWNED_MANIFEST" ] || return 2
    recorded=$(manifest_sha "$path")
    [ -n "$recorded" ] || return 2
    actual=$(sha256_of "$path") || return 2
    [ "$recorded" = "$actual" ] || return 1
    rm -f "$path"
}

# =============================================================================
# Templates — one render_* function per file written
# =============================================================================
# Quoted 'EOF' = literal; unquoted EOF expands ${VAR} (those carry a "Vars:" note).

render_gitignore() {
    cat << 'EOF'
# Zola build artifacts
/public
# resize_image output: regenerated from the source images on every build
/static/processed_images

# macOS filesystem metadata
.DS_Store
._*
.AppleDouble/

# Windows filesystem metadata
Thumbs.db
Desktop.ini

# Linux editor backup files
*~

# exiftool's backup of a photo it has cleaned: the untouched original, with the
# location and camera data still in it
*_original
EOF
}

render_serve() {
    cat << 'EOF'
#!/usr/bin/env bash
# preview the blog locally at http://127.0.0.1:1111 with live reload; drafts
# are shown, marked "(draft)", and are never published
cd "$(dirname "$0")"
exec zola serve --open --drafts
EOF
}

# ./new: a post file with its front matter filled in, as a draft at the end of
# the list. Weights are read from the top of content/ only: posts and folders,
# which share one numbering, not children.
# The title is made from the name, so it needs no escaping; the author edits it.
render_new() {
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
# The next free weight: 10 past the heaviest post or folder at the top of content/.
max=$(cat content/*.md content/*/index.md content/*/_index.md 2>/dev/null \
    | sed -n 's/^weight *[=:] *\([0-9][0-9]*\).*/\1/p' | sort -n | tail -n 1 || true)
weight=$(( ${max:-0} + 10 ))
# The title: the name with spaces for dashes and a capital first letter.
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

# ./attach: copies a picture or video into content/attachments/ with its hidden
# data stripped. exiftool -o writes a new file and leaves the original alone;
# -tagsfromfile @ -orientation keeps the one tag a photo needs to stand upright.
render_attach() {
    cat << 'EOF'
#!/usr/bin/env bash
# copy a picture, GIF or video into content/attachments/ without its location
# and camera data: ./attach ~/Pictures/IMG_0001.jpg tea-hills
set -euo pipefail
src="${1:-}" name="${2:-}"
if [ ! -f "$src" ] || [ -z "$name" ]; then
    echo "usage: ./attach path/to/file new-name   (the file keeps its own extension)" >&2
    exit 2
fi
case "$(basename "$src")" in
    ?*.?*) ;;
    *) echo "$src has no extension, such as .jpg or .mp4, to tell what kind of file it is" >&2; exit 2 ;;
esac
ext="$(printf '%s' "${src##*.}" | tr '[:upper:]' '[:lower:]')"
case "$ext" in
    heic|heif) echo "most browsers can't show HEIC pictures; export it as a JPEG first" >&2; exit 2 ;;
    svg) echo "exiftool can't clean SVG drawings: save it as a plain SVG (in Inkscape, File, Save As, Plain SVG), then copy it into content/attachments/ yourself" >&2; exit 2 ;;
esac
name="${name%."$ext"}"
case "$name" in
    ""|-*|*[!a-z0-9-]*)
        echo "the new name takes lowercase letters, digits and dashes, such as tea-hills" >&2
        exit 2 ;;
esac
if ! command -v exiftool >/dev/null 2>&1; then
    echo "needs exiftool: on Debian, Devuan or Ubuntu, sudo apt install libimage-exiftool-perl; on a Mac, brew install exiftool; otherwise see exiftool.org" >&2
    exit 1
fi
src="$(cd "$(dirname "$src")" && pwd)/$(basename "$src")"
cd "$(dirname "$0")"
dest="content/attachments/$name.$ext"
if [ -e "$dest" ]; then
    echo "$dest already exists; choose another name" >&2
    exit 1
fi
if ! exiftool -q -q -all= -tagsfromfile @ -orientation -o "$dest" "$src"; then
    echo "exiftool couldn't clean this file, so nothing was copied. it can't write every kind of file: WebM video is one it can't." >&2
    exit 1
fi
echo "copied to $dest, without its location and camera data. in a post, write:"
case "$ext" in
    mp4|m4v|mov|webm) echo "{{<video src=\"attachments/$name.$ext\" />}}" ;;
    *) echo "![what it shows](@/attachments/$name.$ext)" ;;
esac
EOF
}

render_build() {
    cat << 'EOF'
#!/usr/bin/env bash
# build the static site into ./public for deployment
set -euo pipefail
cd "$(dirname "$0")"

# Zola drops a page missing its section's sort field, warns, exits 0, and still
# lists its URL in sitemap.xml: turn that warning into a failure.
out=$(zola build 2>&1) || { printf '%s\n' "$out" >&2; exit 1; }
printf '%s\n' "$out"
if printf '%s\n' "$out" | grep -q 'page(s) ignored'; then
    {
        printf '\n%s\n' "the page(s) named above produced no HTML, but sitemap.xml still lists"
        printf '%s\n'    "their URLs, so the published site would point crawlers at a 404."
        printf '%s\n'    "give the page a weight, or add hidden = true to its front matter if it"
        printf '%s\n'    "should exist without being listed. nothing was published."
    } >&2
    exit 1
fi
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
`config.toml`, `templates/`, `serve`, `build`, `new`, `attach`, this README and
`.gitignore`; also `static/favicon.svg` while FAVICON_TEXT draws it,
`static/search.js` while search is on, and `.github/workflows/deploy.yml` while
GIT_REPO_URL is set.
Change them through the script's settings or its `render_` functions, not here.
`content/` and the rest of `static/` are yours: the script never touches them
after the first run.

How to write posts and change the blog: the guide that comes with the setup
script, zola-blog-guide.md.
EOF
}

# Vars: most of the configuration block, FAVICON_MARK, and BASE_URL, SOURCE_URL,
# HISTORY_URL and HISTORY_HINT from resolve_host_config. Post ordering lives in
# content/_index.md (sort_by), not here.
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
feed_filenames = ["atom.xml"]
minify_html = true
# The search box's index; its format is under [search].
build_search_index = ${ENABLE_SEARCH}

# render = false keeps tags parseable but builds no tag pages or feeds; feed
# follows generate_feeds (they are separate switches in Zola).
taxonomies = [
    { name = "tags", feed = ${GENERATE_FEEDS}, render = ${ENABLE_TAGS} },
]

[search]
# Plain JSON for static/search.js; the default format adds a third-party library.
index_format = "fuse_json"

[markdown]
# Outbound links get target="_blank" rel="nofollow noopener noreferrer".
external_links_target_blank = true
external_links_no_follow = true
external_links_no_referrer = true
# Footnotes collected at the foot of the post with back-references (Zola 0.20+).
bottom_footnotes = true

[markdown.highlighting]
light_theme = "${lightt}"
dark_theme = "${darkt}"

[extra]
# Read by the templates; each value comes from a setting in the setup script.
masthead = "${masthead_v}"

# true while the script draws static/favicon.svg, so its URL can carry a hash;
# false for your own file, which may be missing (a missing file's hash fails).
favicon_drawn = ${favicon_drawn}

light_theme = ${LIGHT_THEME}

show_toc = ${SHOW_TOC}
show_breadcrumbs = ${SHOW_BREADCRUMBS}
show_reading_time = ${SHOW_READING_TIME}
date_format = "${datef}"
enable_tags = ${ENABLE_TAGS}
show_history_link = ${SHOW_HISTORY_LINK}
show_suggest_edit = ${SHOW_SUGGEST_EDIT}

# Links to each post's file and history on GitHub; empty for a local blog.
source_url = "${surl}"
history_url = "${hurl}"
history_hint = "${hhint}"

# The menu: Search, then these pages, by their paths from content/, labelled with
# their titles, then Tags and RSS; Search, Tags and RSS as the settings allow
# (base.html), and Home first when masthead is "none". A path ending _index.md is
# a folder's page.
menu_pages = [${menu}]
show_rss_link = ${SHOW_RSS_LINK}

# The footer: FOOTER_LINKS, then FOOTER_TEXT under them.
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
sort_by = "none"
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

# Markdown style reference, written as content/hello-world.md; its picture is
# content/attachments/demo.svg. Published two days ago and updated today, to show
# both dates; the update does not move it, because the list follows weight.
# Vars: TWO_DAYS_AGO, TODAY.
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

Lorem ipsum dolor sit amet[^1], consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.

This blog links to its own pages with Zola's internal-link syntax, here is [the second post](@/second-post.md), and to the wider web with ordinary Markdown links, like [the Zola documentation](https://www.getzola.org). Both kinds are explained in the guide.

The home page lists posts in the order of their \`weight\` — this one is 10, the second post is 20 — and numbers them where they land. Editing a post never moves it. The previous/next links at the foot of a post walk that same order. The dates are still here and still shown: this post carries an \`updated\` field, so its header gives both a publish date and a "last updated" date, and the feed reads both.

## Heading 2

Proin porttitor, orci nec nonummy molestie, enim est eleifend mi, non fermentum diam nisl sit amet erat.

### Heading 3

Pellentesque congue. Ut in risus volutpat libero pharetra tempor. Cras vestibulum bibendum augue.

#### Heading 4

In condimentum facilisis porta. Sed nec diam eu diam mattis viverra.

##### Heading 5

Quis sollicitudin sapien justo in libero. Vestibulum mollis mauris enim.

###### Heading 6

Donec viverra auctor lobortis. Pellentesque eu est a nulla placerat dignissim.

---

## Lists

Unordered with nesting:

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
  - Nested item one
  - Nested item two
    - Deeper nested item
- Sed do eiusmod tempor

Ordered with nesting. Number each level the ordinary way, \`1.\`, \`2.\`, \`3.\`, indented four spaces under the item above, and the stylesheet numbers the nested ones 2.1, 2.2:

1. First item
2. Second item
    1. Nested first
    2. Nested second
3. Third item

---

## Text formatting

**Bold text**, *italic text*, ***bold italic***, ~~strikethrough~~, \`inline code\`, and a [link with a title](https://example.com "link title attribute"). An autolink: <https://example.com>.

---

## Blockquote

> Lorem ipsum dolor sit amet, consectetur adipiscing elit.
>
> Integer posuere erat a ante venenatis dapibus posuere velit aliquet.

---

## Notes and collapsibles

An aside is for the remark that would break the paragraph it belongs to.

<aside>

Blank lines around the content are load-bearing — without them the Markdown in
here comes out as literal *asterisks*. That is a CommonMark rule: a raw HTML
block ends at the first blank line.

</aside>

A collapsible hides a digression until it is wanted.

<details>
<summary>the same blank-line rule applies here</summary>

So \`code\`, [links](@/second-post.md), and lists all work:

- like this one

</details>

---

## Table

| Column A   | Column B | Column C |
|------------|----------|----------|
| Lorem      | Ipsum    | Dolor    |
| Sit        | Amet     | Consect  |
| Adipiscing | Elit     | Sed      |

---

## Code blocks

A fenced block tagged with a language gets syntax highlighting:

\`\`\`python
def lorem_ipsum():
    """Return a sample string."""
    items = ["Dolor", "sit", "amet"]
    return " ".join(items)
\`\`\`

A shell example, same pattern:

\`\`\`bash
echo "shell example"
for f in *.md; do
    echo "found: \$f"
done
\`\`\`

Without a language tag, the block is plain monospace with no colour:

\`\`\`
raw text block
no highlighting
\`\`\`

You can highlight specific lines with \`hl_lines\`:

\`\`\`python,hl_lines=2 4-5
def plain_line():
    return "this line is highlighted"

def another():
    return "so are these two lines"
\`\`\`

---

## Images

Pictures live in one folder, \`content/attachments/\`, and a post names them from the \`content\` folder, with \`@/\` in front. That works at any site address, and the build stops if the name is wrong:

![layered gray mountain silhouettes with a faint sun behind them](@/attachments/demo.svg)

The picture is \`content/attachments/demo.svg\`. Delete it along with this post.

[^1]: This is the footnote definition. Zola adds a back-reference link so readers can return to where they were.
EOF
}

# Vars: YESTERDAY. Companion post; target of the internal link above.
render_second_post() {
    cat << EOF
+++
title = "Second post"
weight = 20
date = ${YESTERDAY}
[taxonomies]
tags = ["writing"]
+++

A short companion post. It exists to give the previous/next navigation at the foot of every post somewhere to point, and to be the target of the internal link in the hello-world post.

Unlike hello-world, this post has no \`updated\` field, so its header shows only a publish date.

Delete it together with hello-world.md. Deleted on its own, it breaks the link in hello-world, and the build stops.
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

render_fonts_readme() {
    cat << 'EOF'
Charter, the blog's typeface. Download it from
https://practicaltypography.com/charter.html and put the four .woff2 files in
this folder (static/fonts/), named:

    charter_regular.woff2
    charter_italic.woff2
    charter_bold.woff2
    charter_bold_italic.woff2

Until then, readers see a similar serif from their own computer.
Guide: "Fonts".
EOF
}

render_base_html() {
    cat << 'EOF'
<!DOCTYPE html>
<html lang="{{ lang }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="{% if config.extra.light_theme %}light dark{% else %}dark{% endif %}">
    {#- The preview (zola serve rewrites base_url to http://; a published one is
        always https, both sources validated) gets the same policy with scripts
        allowed, for serve's inline and file reload scripts, so it blocks what the
        published site blocks. No frame-ancestors: ignored in <meta>, and Pages can't
        send headers. form-action has no default-src fallback, so it's spelled out. -#}
    {%- set preview = config.base_url is starting_with(pat="http://") %}
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src {% if preview %}'self' 'unsafe-inline'{% elif config.build_search_index %}'self'{% else %}'none'{% endif %}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'">
    <meta name="referrer" content="no-referrer">
    {#- A page's own description (its subtitle) is its meta description too. -#}
    {%- set meta_description = config.description %}
    {%- if page is defined and page.description %}{% set meta_description = page.description %}
    {%- elif section is defined and section.description %}{% set meta_description = section.description %}{% endif %}
    {%- if meta_description %}
    <meta name="description" content="{{ meta_description }}">
    {%- endif %}
    <title>{% block title %}{{ config.title }}{% endblock %}</title>
    {#- Link previews: chat apps and social sites read og:, and X also needs
        twitter:card. current_url is missing on the 404 page. -#}
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
    {#- cachebust: a changed favicon gets a new URL, so a browser drops the one it
        cached (every preview shares 127.0.0.1:1111). Only for the drawn favicon. -#}
    <link rel="icon" href="{{ get_url(path='favicon.svg', cachebust=config.extra.favicon_drawn) }}" type="image/svg+xml">
    {% if config.generate_feeds %}
    <link rel="alternate" type="application/atom+xml" title="RSS" href="{{ get_url(path='atom.xml') }}">
    {% endif %}
    {%- if config.build_search_index %}
    <script src="{{ get_url(path='search.js', cachebust=true) }}" defer></script>
    {%- endif %}
    {#- Previous and Next (post_nav, components.html), worked out once: the
        <link>s here, for readers and extensions; the bar at the foot of
        page.html and section.html. -#}
    {%- set_global reading %}{% if page is defined %}{{<post_nav node={page} extra={config.extra} />}}{% elif section is defined %}{{<post_nav node={section} extra={config.extra} />}}{% endif %}{% endset %}
    {{- reading | split(pat="<!--bar-->") | first | safe }}
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

    /* Dark is the default palette: with light_theme false the light block isn't
       written and color-scheme is plain "dark". */
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
        --body-leading: 1.55;
        --wordmark-size: 1.5em;        /* masthead name and image-mode logo: 1.8rem, above --h2-size, below --h1-size */
        --h1-size: 2.25rem;
        --h2-size: 1.7rem;
        --h3-size: 1.35rem;            /* a step above the text, so it reads as a heading, not a bold line */
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

    /* Phones: a smaller title, still bigger than the name (1.5em, 1.8rem). */
    @media (max-width: 36rem) { :root { --h1-size: 1.9rem; } }

    html { background: var(--bg); }   /* paint on html only — no two-tone seam in dark mode */
    /* Three rows, so the footer sits at the bottom of a short page (dvh: vh counts
       a phone's browser bars). minmax(0, 1fr): a long code line scrolls inside its
       block instead of widening the page. */
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
    /* .wide widens the whole page; .bleed widens one element and keeps everything
       else on the measure. Both in one post: .bleed wins. */
    body:has(.wide), body:has(.bleed) { max-width: var(--wide); }
    body:has(.bleed) > header,
    body:has(.bleed) > footer,
    body:has(.bleed) main > :not(.bleed) {
        box-sizing: border-box; max-width: var(--measure); margin-inline: auto;
    }
    main > .bleed { margin-inline: 0; }   /* UA stylesheets give <figure> 40px side margins */
    /* Grid items with auto margins shrink to their content: the masthead would bunch up. */
    body:has(.bleed) > header, body:has(.bleed) > footer { width: 100%; }

    /* A link takes the colour of the text around it, underlined, and turns blue
       once followed (:visited can change colours only). Footnote numbers are
       blue either way. */
    a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
    a:visited { color: var(--link); }
    /* Lists of links keep the text colour, followed or not: every item in them
       is a link anyway. */
    .post-list li > a, .tag-list a, .search-results a { color: var(--fg); }

    main h1, main h2, main h3, main h4, main h5, main h6 { font-weight: bold; line-height: 1.18; }
    /* Margins in em of each heading's own size, so the rhythm survives any base size. */
    /* No rules under headings, except a --- written straight after one (see hr). */
    main h1 { font-size: var(--h1-size); margin: 0.7em 0 0.4em; }
    main h2 { font-size: var(--h2-size); margin: 1.5em 0 0.4em; }
    main h3 { font-size: var(--h3-size); margin: 1.18em 0 0.29em; }
    /* 4 to 6 at text size, told apart by style, never smaller than the text. */
    main h4 { font-size: 1em; font-style: italic; margin: 1.4em 0 0.3em; }
    main h5 { font-size: 1em; font-style: italic; font-weight: normal; margin: 1.3em 0 0.3em; }
    main h6 { font-size: 1em; font-style: italic; font-weight: normal; color: var(--muted); margin: 1.1em 0 0.3em; }
    /* What follows a heading starts right under it. Otherwise its own top margin
       wins over the heading's smaller bottom one (touching margins keep only the
       larger), and a heading sits as far from its text as from the text above.
       The same goes for a first paragraph inside a quote or note, whose margin
       would reach out through the top of its box. A heading after a heading keeps
       its own space above. */
    main :is(h2, h3, h4, h5, h6) + :not(h2, h3, h4, h5, h6),
    main :is(h2, h3, h4, h5, h6) + :not(h2, h3, h4, h5, h6) > :first-child,
    main :is(h2, h3, h4, h5, h6) + details:not(.toc) { margin-top: 0; }

    :not(pre) > code { font-family: var(--mono); font-size: 0.88em; color: var(--accent); background: var(--inline-bg); border: 1px solid var(--inline-border); padding: 0.05em 0.3em; border-radius: 2px; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
    /* No user-select: all (it blocks selecting part of a block) and no background:
       Giallo paints the ground inline, which beats any selector here. */
    pre { font-family: var(--mono); border: 1px solid var(--border); border-radius: 4px; padding: 1rem; overflow-x: auto; margin: 1rem 0; font-size: 0.95rem; line-height: 1.45; }
    pre code { font-family: var(--mono); font-weight: normal; background: none; padding: 0; }
    code { font-weight: inherit; }

    /* Not italic: italic already marks dates, subtitles and labels. */
    blockquote { margin-block: 1.15rem; margin-inline: 0; padding-inline-start: 1rem; border-inline-start: 3px solid var(--border); color: var(--muted); }
    main small { font-size: 0.82em; color: var(--muted); }
    main aside { font-size: 0.82em; color: var(--muted); border-inline-start: 2px solid var(--border); padding-inline-start: 1em; margin-block: 1.15rem; }

    hr { border: none; border-block-start: var(--hairline); margin-block: 2.5rem; }
    /* A --- straight after a heading underlines it, rather than dividing the page. */
    main :is(h2, h3, h4, h5, h6):has(+ hr) { margin-bottom: 0.3em; }
    main :is(h2, h3, h4, h5, h6) + hr { margin-bottom: 1rem; }
    /* =================================================================== END DESIGN
       STRUCTURE — layout and components; reads the tokens above.
       =================================================================== */

    /* No rule under the masthead, as none above the footer: space separates both. */
    .site-head { padding-bottom: 1rem; margin-bottom: 2rem; }
    /* Brand left, nav right; each falls flush left when they wrap. Centred, not on
       a shared baseline, which at different sizes offsets the caps by ~8px. */
    .masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem 1.4rem; }
    /* The description: home page only, a row of its own under the name and menu.
       On a phone, where the menu wraps under the name, it stays next to the name. */
    .tagline { flex-basis: 100%; order: 1; color: var(--muted); font-style: italic; font-size: 0.9em; line-height: 1.35; margin: 0; }
    @media (max-width: 36rem) { .masthead:has(.brand) .tagline { order: 0; } }
    /* The wordmark is text: an SVG loaded as an image can't use the webfont. */
    /* Size set here, so the name and the image-mode logo share one value. */
    .brand, .brand:visited { display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none; color: var(--fg); font-size: var(--wordmark-size); }
    .brand-name { font-weight: bold; font-size: 1em; }
    /* Screen-reader-only; the home page's h1 uses it. */
    .visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
{%- if config.extra.masthead == "image" %}
    /* static/logo.svg as an alpha mask in the text colour: one file for both
       themes, and a background in the file masks the whole box solid. */
    .brand .logo { display: inline-block; width: 1em; height: 1em; align-self: center;
        background-color: currentColor;
        -webkit-mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat;
                mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat; }
{%- endif %}
    /* A flex row with column-gap, so nothing trails the last item. Scoped to the
       masthead so it doesn't reach .post-nav. */
    .masthead nav { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 1em; margin: 0; }
    .masthead nav a, .masthead nav a:visited { color: var(--muted); text-decoration: none; }
    /* Brighter, not bold: bold would widen it and shift the links before it. */
    .masthead nav a.current { color: var(--fg); text-decoration: underline; }
    /* The Search button, dressed as one more link. */
    .search-open { font: inherit; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; text-underline-offset: 2px; }
    .masthead nav a:hover, .search-open:hover { text-decoration: underline; }

    /* Breadcrumbs, over the title of a page in a folder: quiet, like the menu. The
       -0.55rem keeps that title level with the title on a page without them. */
    .crumbs ol { display: flex; flex-wrap: wrap; list-style: none; margin: -0.55rem 0 0; padding: 0; color: var(--muted); font-size: 0.9em; }
    .crumbs li + li::before { content: "›"; content: "›" / ""; margin: 0 0.5em; }
    .crumbs a, .crumbs a:visited { color: var(--muted); text-decoration: none; }
    .crumbs a:hover { text-decoration: underline; }
    main .crumbs + h1 { margin-top: 0.2em; }

    /* A deck under the title, not a caption: full body size. */
    .subtitle { color: var(--muted); font-style: italic; line-height: 1.35; margin: 0.2rem 0 2rem 0; }
    h1 + .subtitle { margin-top: 0; }
    .subtitle:has(+ .post-meta) { margin-bottom: 0.6rem; }   /* a post's subtitle, then its date line */

    /* Drafts appear only in the preview. */
    .draft { color: var(--accent); font-style: italic; font-weight: normal; font-size: 0.8em; }

    .avatar { display: block; width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); margin: 0 0 1.5rem; }

    /* One rule, closing the title-and-dates block. */
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
    /* Blue before it's followed too: a footnote number has no underline to mark it. */
    sup.footnote-reference a, sup.footnote-reference a:visited { color: var(--link); text-decoration: none; }
    /* Zola's bottom footnotes: <section class="footnotes"><ol>. A selector that
       stops matching fails silently: the build passes either way. */
    main .footnotes { margin-top: 3rem; padding-top: 0.5rem; border-top: 1px solid var(--border); font-size: 0.8em; color: var(--muted); }
    main .footnotes ol { padding-inline-start: 2.5em; margin: 0; }
    main .footnotes p { margin: 0.3rem 0; }
    /* No top margin on the first note: it would stack on the padding. */
    main .footnotes li:first-child > p:first-child { margin-block-start: 0; }
    /* A post ending in --- would put an <hr> just above the notes' own rule. */
    main hr:has(+ .footnotes) { display: none; }
    /* The arrow back to the text stays quiet, followed or not; a link in a note
       is like any other. Zola's back-links go to #fr-<note>-<use>. */
    main .footnotes a[href*="#fr-"] { color: var(--muted); }

    .giallo-l { display: inline-block; min-height: 1lh; width: 100%; }
    .giallo-ln { display: inline-block; user-select: none; margin-right: 0.4em; padding: 0.4em; min-width: 3ch; text-align: right; opacity: 0.8; }

    main table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
    main th, main td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
    main th { background: var(--surface); font-weight: bold; }
    /* Narrow screens: a wide table scrolls inside its own box, not the page. */
    @media (max-width: 44rem) { main table { display: block; overflow-x: auto; } }

    /* Pictures and videos never wider than the column, nor taller than the window. */
    main img, main video { max-width: 100%; height: auto; max-height: 85vh; }

    /* The search box: a modal <dialog> (the browser dims the page and keeps focus
       in the box). search.js sets --search-top to just under the nav. */
    .search { box-sizing: border-box; width: min(var(--measure), calc(100% - 2rem)); max-width: none; max-height: none; margin: var(--search-top, 2rem) auto auto; padding: 0; border: 1px solid var(--border-strong); border-radius: 4px; background: var(--bg); color: var(--fg); }
    .search::backdrop { background: rgba(0, 0, 0, 0.6); }
    /* min-height: 0 lets the results shrink, and so scroll, under a fixed input. */
    .search-box { box-sizing: border-box; display: flex; flex-direction: column; gap: 0.9rem; max-height: calc(100dvh - var(--search-top, 2rem) - 1rem); padding: 1rem; }
    .search input { font: inherit; box-sizing: border-box; width: 100%; padding: 0.35rem 0.5rem; border: 1px solid var(--control-border); border-radius: 3px; background: var(--bg); color: var(--fg); }
    .search-results { list-style: none; margin: 0; padding: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    .search-results li + li { margin-top: 0.9rem; }
    .search-excerpt { margin: 0.15rem 0 0; color: var(--muted); font-size: 0.85em; line-height: 1.45; }
    /* Matched words: body colour and bold, not the default yellow. */
    .search-excerpt mark { background: none; color: var(--fg); font-weight: bold; }
    .search-note { color: var(--muted); font-style: italic; }
    /* A visible focus ring: the 1px border at rest is nearly invisible. */
    .search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* A numbered list inside a numbered list counts 1.1, 1.2.1 (Markdown has no
       "1.1"). A counter can't read <ol start>, so a list Markdown restarted keeps
       the browser's own numbers rather than wrong ones. */
    main ol { counter-reset: outline; }
    main ol > li { counter-increment: outline; }
    main ol ol > li { list-style: none; position: relative; }
    main ol ol > li::before { content: counters(outline, "."); position: absolute; inset-inline-end: 100%; padding-inline-end: 0.25em; }
    main ol[start] ol > li, main ol ol[start] > li { list-style: revert; }
    main ol[start] ol > li::before, main ol ol[start] > li::before { content: none; }

    /* The browser numbers the <ol>; the padding holds the markers, 10 to 99 flush. */
    .post-list { padding-inline-start: 1.7em; }
    .post-list li { margin-bottom: 0.5rem; }
    .post-list li::marker { color: var(--muted); }
    /* Tag pages: no numbers, because a tag's list isn't a sequence. */
    .unordered .post-list { list-style: none; padding-inline-start: 0; }
    .post-list .desc { display: block; color: var(--muted); font-style: italic; font-size: 0.9em; line-height: 1.35; }
    .post-list .tags { display: block; color: var(--muted); font-size: 0.8em; font-style: italic; }
    .post-list .tags a, .post-list .tags a:visited { color: var(--muted); text-decoration: none; }
    .post-list .tags a:hover { text-decoration: underline; }

    /* Quiet links, like the menu's and the date line's: underlined on hover. */
    .post-tags { margin-top: 2.75rem; color: var(--muted); font-size: 0.9em; }
    .post-tags a, .post-tags a:visited { color: var(--muted); text-decoration: none; }
    .post-tags a:hover { text-decoration: underline; }

    .tag-list { list-style: none; padding-inline-start: 0; }
    .tag-list li { margin-bottom: 0.4rem; }
    .tag-list .count { color: var(--muted); font-size: 0.85em; }

    .section-title { padding-bottom: 0.9rem; margin-bottom: 1.4rem; border-bottom: var(--hairline); }
    /* With a subtitle, the rule moves under it, closing the title block. */
    .section-title:has(+ .subtitle) { padding-bottom: 0; margin-bottom: 0.25em; border-bottom: none; }
    .section-title + .subtitle { padding-bottom: 0.9rem; margin-bottom: 1.4rem; border-bottom: var(--hairline); }

    /* One disclosure style for the contents box and any <details> in a post. */
    details > summary { cursor: pointer; color: var(--muted); font-style: italic; list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before { content: "\25B8"; display: inline-block; width: 1em; }
    details[open] > summary::before { content: "\25BE"; }
    main > details:not(.toc) { margin-block: 1.5rem; }
    /* Open, its text hangs under the summary's words, so it ends visibly. */
    main > details:not(.toc) > :not(summary) { margin-inline-start: 1em; }

    /* The date line's rule under the box, folded or open, so its list ends before the text. */
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
    /* Tighter only after tags, so they group with the text above them. */
    .post-tags + .post-nav { margin-top: 1.5rem; }
    .post-nav a, .post-nav a:visited { color: var(--muted); text-decoration: none; }
    .post-nav a:hover { text-decoration: underline; }
    .post-nav .label { color: var(--muted); font-style: italic; font-size: 0.9em; margin-right: 0.5em; }
    .post-nav-prev { text-align: left; }
    .post-nav-next { text-align: right; }
    /* All posts: in the middle, or on a phone on a row of its own. Empty on the
       first entry, whose Previous is the home page already. */
    .post-nav-home { text-align: center; }
    @media (max-width: 36rem) {
        .post-nav { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .post-nav-home { grid-row: 2; grid-column: 1 / -1; }
        .post-nav-home:empty { display: none; }
        .post-nav .label { display: block; margin-right: 0; }
    }

    /* A margin on both sides of each link keeps the row centred. */
    body > footer { margin-top: 4rem; padding-top: 1rem; text-align: center; color: var(--muted); }
    body > footer a, body > footer a:visited { color: var(--muted); margin: 0 0.4em; text-decoration: none; }
    body > footer a:hover { text-decoration: underline; }
    /* The small print: under the links, smaller and fainter. 85% keeps it at
       4.5:1 or better against the page in both themes. */
    body > footer p { margin: 0.5rem 0 0; font-size: 0.8em; opacity: 0.85; }

    /* Smooth scrolling for the contents and footnote links. No back-to-top button:
       it would cover the text on narrow screens, and hiding it needs a script. */
    @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

    /* Black on white in print: dark-mode text on paper would be pale. */
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
        <a class="brand" href="{{ get_url(path='/', trailing_slash=true) }}">
            {%- if config.extra.masthead == "image" %}<span class="logo" aria-hidden="true"></span>{% endif %}
            <span class="brand-name">{{ config.title }}</span>
        </a>
        {%- endif %}
        {% block masthead_extra %}{% endblock %}
        {#- Each menu_pages entry, labelled with its title: a page (about.md) or a
            folder's page (projects/_index.md). A missing one stops the build; the
            setup script checks for that first. -#}
        <nav aria-label="Site">
            {%- if config.extra.masthead == "none" %}
            <a href="{{ get_url(path='/', trailing_slash=true) }}"{% if current_path == "/" %} class="current" aria-current="page"{% endif %}>Home</a>
            {%- endif %}
            {%- if config.build_search_index %}
            <button type="button" class="search-open" aria-haspopup="dialog" hidden>Search</button>
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
        {#- Breadcrumbs: Home, then the folders above this page, top one first, so even
            one folder reads as a trail; the title follows, so it isn't repeated. A page
            with no folder above it has none, and so does a page in a transparent
            folder: Zola leaves that folder out of its ancestors. -#}
        {%- set trail = page?.ancestors or section?.ancestors or [] %}
        {%- if config.extra.show_breadcrumbs and trail | length > 1 %}
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
        {% for link in config.extra.footer_links -%}
        <a href="{{ link.url }}">{{ link.name }}</a>{% if not loop.last %} · {% endif %}
        {%- endfor %}
        {% if config.extra.footer_text %}<p>{{ config.extra.footer_text }}</p>{% endif %}
    </footer>
    {% endif %}
    {%- if config.build_search_index %}
    {#- Hidden until search.js runs: the dialog is closed and the button hidden.
        data-home is the home section's permalink, the exact string the index holds;
        get_url(path='/') drops the trailing slash. Tera v2 can't read a field off a
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

# The numbered lists (post_list), the contents box, videos, bare addresses as
# links, and Previous and Next along the lists (post_nav, beside). Zola gives
# templates no weights, so front_value reads them from the files.
render_components() {
    cat << 'EOF'
{#- Tera v2 components, not macros (Zola 0.23 removed those), registered
    globally, so nothing imports this file. They can't see config, hence the
    extra argument. -#}

{#- The numbered list on the home page, a folder's page and a tag page.
    folders: the subsections, in weight order; left out are attachments/,
    folders in the menu, and transparent folders, whose pages are listed
    already (Zola drops hidden folders, and drafts outside the preview).
    section: the list's own _index.md. Sorted by weight, a folder goes before
    the first page not lighter than it; otherwise the folders come first. -#}
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
<ol class="post-list">
{% for e in entries %}
<li>
    <a href="{{ e.permalink }}">{{ e.title }}</a>{% if e.draft %} <span class="draft">(draft)</span>{% endif %}
    {% if e.description %}<span class="desc">{{ e.description }}</span>{% endif %}
    {% if extra.enable_tags and e.taxonomies?.tags %}<span class="tags">{% for tag in e.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</span>{% endif %}
</li>
{% endfor %}
</ol>
{% endcomponent post_list %}

{#- The contents box: a post's headings, or those of a page without a date that
    sets toc = true under [extra]. Shows one level of sub-headings. Starts folded,
    so a phone's first screen shows the text. -#}
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

{#- A video, by its path from content/ (attachments/<name>). get_url with @/
    stops the build if the file is missing. loop="yes" plays it silently on a
    loop, like a GIF, still with controls: WCAG 2.2.2 wants a way to pause. -#}
{% component video(src, loop="no") %}
{%- set url = get_url(path="@/" ~ src) -%}
{% if loop == "yes" %}<video src="{{ url }}" autoplay loop muted playsinline controls></video>{% else %}<video src="{{ url }}" controls preload="metadata"></video>{% endif %}
{% endcomponent video %}

{#- An address pasted as it is becomes a link, like one written <https://...>:
    Markdown links only the second. The first step matches tags, links and code
    whole, so they pass through untouched, and marks each bare address; the second
    drops the empty marks the tags leave; the third turns the rest into links with
    the attributes Zola gives other outside links. A full stop, comma or bracket
    after an address stays outside it. atom.xml uses it too. -#}
{% component linkify(html) %}{{ html | regex_replace(pattern=`(?s)(<a\\b[^>]*>.*?</a>|<pre\\b.*?</pre>|<code\\b.*?</code>|<script\\b.*?</script>|<style\\b.*?</style>|<[^>]*>)|(https?://(?:[^\\s<>"()&]|&amp;|\\([^\\s<>"()]*\\))*(?:[^\\s<>"().,;:!?'*_~&]|&amp;|\\([^\\s<>"()]*\\)))`, rep=`${1}<!--L-->${2}<!--/L-->`) | replace(from="<!--L--><!--/L-->", to="") | regex_replace(pattern=`<!--L-->(.*?)<!--/L-->`, rep=`<a rel="noopener nofollow noreferrer external" href="$1" target="_blank">$1</a>`) | safe }}{% endcomponent linkify %}

{#- Previous and Next: down the home page's list, and into each folder's own
    list straight after the folder, at any depth, as post_list shows them. The
    home page, a folder in the menu, and a folder inside a transparent one
    (which no list above it shows) each start an order; a page no list shows
    gets no links. Worked out once per page, into <head>: the <link>s, then
    <!--bar-->, then the bar for the foot. -#}
{% component post_nav(node, extra) %}
{%- set skip = ["attachments/_index.md", ...extra.menu_pages] %}
{%- set here = node.relative_path %}
{%- set up = node.ancestors | last %}
{%- set is_folder = here is ending_with(pat="_index.md") %}
{%- set_global start = is_folder and (not up or here in skip) %}
{%- if is_folder and not start %}{% set parent = get_section(path=up) %}{% if parent.transparent %}{% set_global start = not node.transparent %}{% endif %}{% endif %}
{%- set around %}{% if start %}//{% elif up %}{{<beside section={up} item={here} extra={extra} />}}{% endif %}{% endset %}
{%- set placed = around != "" %}
{%- set_global prev = around | split(pat="//") | first %}
{%- set_global next = around | split(pat="//") | last %}
{#- Previous: for the first entry in a list, its folder; when it's a folder,
    that folder's last entry, and on down. -#}
{%- if placed and not start and not prev %}{% set_global prev = up %}
{%- else %}{% for step in range(end=100) %}{% if prev is not ending_with(pat="_index.md") %}{% break %}{% endif %}{% set last %}{{<beside section={prev} item="" extra={extra} />}}{% endset %}{% set last = last | split(pat="//") | first %}{% if not last %}{% break %}{% endif %}{% set_global prev = last %}{% endfor %}{% endif %}
{#- Next: a folder's own first entry; at the end of a list, what follows its
    folder in the list above, and on up to the order's start. -#}
{%- if placed and is_folder %}{% set first %}{{<beside section={here} item="" extra={extra} />}}{% endset %}{% set first = first | split(pat="//") | last %}{% if first %}{% set_global next = first %}{% endif %}{% endif %}
{%- if placed and not start and not next %}
{%- set_global c = up %}
{%- for step in range(end=100) %}
{%- set cs = get_section(path=c) %}
{%- if c == "_index.md" or c in skip or not cs.ancestors %}{% break %}{% endif %}
{%- set g = cs.ancestors | last %}
{%- set gs = get_section(path=g) %}
{%- if gs.transparent %}{% break %}{% endif %}
{%- set after %}{{<beside section={g} item={c} extra={extra} />}}{% endset %}
{%- if not after %}{% break %}{% endif %}
{%- set after = after | split(pat="//") | last %}
{%- if after %}{% set_global next = after %}{% break %}{% endif %}
{%- set_global c = g %}
{%- endfor %}
{%- endif %}
{%- if prev %}{% if prev is ending_with(pat="_index.md") %}{% set_global prev = get_section(path=prev) %}{% else %}{% set_global prev = get_page(path=prev) %}{% endif %}{% endif %}
{%- if next %}{% if next is ending_with(pat="_index.md") %}{% set_global next = get_section(path=next) %}{% else %}{% set_global next = get_page(path=next) %}{% endif %}{% endif %}
{#- A list page that starts an order shows no bar: its list is right there.
    The first entry's Previous is the home page, so All posts would repeat it. -#}
{%- if next %}<link rel="next" href="{{ next.permalink | safe }}">{% endif %}
{%- if prev %}<link rel="prev" href="{{ prev.permalink | safe }}">{% endif %}
<!--bar-->
{%- if placed and not start %}
<nav class="post-nav" aria-label="Previous and next">
<div class="post-nav-prev">{% if prev %}<a href="{{ prev.permalink }}"><span class="label">&larr;&nbsp;Previous</span>{{ prev.title }}</a>{% endif %}</div>
<div class="post-nav-home">{% if prev.relative_path != "_index.md" %}<a href="{{ get_url(path='/', trailing_slash=true) }}">All posts</a>{% endif %}</div>
<div class="post-nav-next">{% if next %}<a href="{{ next.permalink }}"><span class="label">Next</span>{{ next.title }}&nbsp;&rarr;</a>{% endif %}</div>
</nav>
{%- endif %}
{% endcomponent post_nav %}

{#- The entries just before and after item in section's list, the list
    post_list shows, as "before//after" paths ("//" can't occur in a path), one
    of them empty at an end of the list; item "" gives the list's
    "last//first". Nothing at all when the list doesn't show item. -#}
{% component beside(section, item, extra) -%}
{%- set s = get_section(path=section) %}
{%- set skip = ["attachments/_index.md", ...extra.menu_pages] %}
{%- set fs = [f for f in [get_section(path=p) for p in s.subsections] if not f.transparent and f.relative_path not in skip] %}
{%- set ps = s.pages %}
{%- set weighted %}{% if fs and ps %}{{<front_value path={section} key="sort_by" />}}{% endif %}{% endset %}
{%- set weighted = weighted == "weight" %}
{%- set_global f0 = fs | last %}{% set_global f1 = fs | first %}{% set_global p0 = ps | last %}{% set_global p1 = ps | first %}
{%- set_global found = item == "" %}
{%- set_global seen = none %}
{%- if item is ending_with(pat="_index.md") %}
{#- A folder: the folders either side of it, and the pages either side of its weight. -#}
{%- for f in fs %}{% if f.relative_path == item %}{% set_global found = true %}{% set_global f1 = fs | nth(n=loop.index) %}{% break %}{% endif %}{% set_global seen = f %}{% endfor %}
{%- set_global f0 = seen %}
{%- set w %}{% if found and weighted %}{{<front_value path={item} key="weight" default="-1" />}}{% endif %}{% endset %}
{%- set n %}{% if found and weighted %}{{<lighter pages={ps} weight={w | int} />}}{% else %}0{% endif %}{% endset %}
{%- set n = n | int %}
{%- set_global p0 = none %}{% if n > 0 %}{% set_global p0 = ps | nth(n=n - 1) %}{% endif %}
{%- set_global p1 = ps | nth(n=n) %}
{%- elif item %}
{#- A page: its neighbours, from Zola, or found in a list without sort_by; and
    the folders either side of its weight. -#}
{%- set pg = get_page(path=item) %}
{%- set_global p0 = pg.lower %}{% set_global p1 = pg.higher %}
{%- if p0 or p1 %}{% set_global found = true %}
{%- else %}{% for p in ps %}{% if p.relative_path == item %}{% set_global found = true %}{% set_global p0 = seen %}{% set_global p1 = ps | nth(n=loop.index) %}{% break %}{% endif %}{% set_global seen = p %}{% endfor %}{% endif %}
{%- set w %}{% if found and weighted %}{{<front_value path={item} key="weight" default="-1" />}}{% endif %}{% endset %}
{%- set m %}{% if found and weighted %}{{<lighter pages={fs} weight={(w | int) + 1} />}}{% else %}{{ fs | length }}{% endif %}{% endset %}
{%- set m = m | int %}
{%- set_global f0 = none %}{% if m > 0 %}{% set_global f0 = fs | nth(n=m - 1) %}{% endif %}
{%- set_global f1 = fs | nth(n=m) %}
{%- endif %}
{%- if found %}
{#- Before it, the later of the two; after it, the earlier. A folder comes
    first on an equal weight, and in a list not sorted by weight. -#}
{%- if f0 and p0 %}{% set a %}{{<front_value path={f0.relative_path} key="weight" default="-1" />}}{% endset %}{% set b %}{{<front_value path={p0.relative_path} key="weight" default="-1" />}}{% endset %}{% if not weighted or (a | int) <= (b | int) %}{% set_global f0 = none %}{% else %}{% set_global p0 = none %}{% endif %}{% endif %}
{%- if f1 and p1 %}{% set a %}{{<front_value path={f1.relative_path} key="weight" default="-1" />}}{% endset %}{% set b %}{{<front_value path={p1.relative_path} key="weight" default="-1" />}}{% endset %}{% if not weighted or (a | int) <= (b | int) %}{% set_global p1 = none %}{% else %}{% set_global f1 = none %}{% endif %}{% endif %}
{%- set before = f0 or p0 %}{% set after = f1 or p1 %}
{%- if before %}{{ before.relative_path | safe }}{% endif %}//{% if after %}{{ after.relative_path | safe }}{% endif %}
{%- endif %}
{%- endcomponent beside %}

{#- One front matter value of a file in content/, as text, or default: a
    weight or a sort_by, which Zola reads but doesn't give templates. The two
    patterns are Zola's own (front_matter/split.rs), so the front matter ends
    where Zola's does, and a +++ inside a title doesn't end it early. -#}
{% component front_value(path, key, default="") -%}
{%- set raw = load_data(path="@/" ~ path, format="plain") %}
{%- set toml = `^[[:space:]]*\\+\\+\\+[[:space:]]*(\\r?\\n(?s).*?(?-s))\\+\\+\\+[[:space:]]*(?:$|(?:\\r?\\n((?s).*(?-s))$))` %}
{%- set yaml = `^[[:space:]]*---[[:space:]]*(\\r?\\n(?s).*?(?-s))---[[:space:]]*(?:$|(?:\\r?\\n((?s).*(?-s))$))` %}
{%- if raw is matching(pat=toml) %}{% set fm = load_data(literal=raw | regex_replace(pattern=toml, rep="$1"), format="toml") %}
{%- elif raw is matching(pat=yaml) %}{% set fm = load_data(literal=raw | regex_replace(pattern=yaml, rep="$1"), format="yaml") %}
{%- else %}{% set fm = {} %}{% endif %}
{{- fm | get(key=key, default=default) }}
{%- endcomponent front_value %}

{#- How many of these pages or folders, in weight order, are lighter than
    weight: where something of that weight goes among them. Halves the list
    each step, so a list of 2,000 takes 11 reads. -#}
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
# It starts the reading order, so it has a <link rel="next"> and no bar.
render_index_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ config.title }}{% endblock %}

{#- The description, as a strapline under the name. -#}
{% block masthead_extra %}{% if config.description %}<p class="tagline">{{ config.description }}</p>{% endif %}{% endblock %}

{% block content %}
{#- Hidden, not deleted: the page keeps one h1 for the outline and screen readers. -#}
<h1 class="visually-hidden">{{ config.title }}</h1>

{#- Whatever is written below the front matter of content/_index.md. -#}
{{<linkify html={section.content} />}}

{{<post_list pages={section.pages} extra={config.extra} folders={section.subsections} section={section.relative_path} />}}
{% endblock %}
EOF
}

# A post, or any other page: title, date line, text, tags, then the Previous and
# Next bar, worked out in base.html.
render_page_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ page.title }} | {{ config.title }}{% endblock %}

{% block content %}
{#- A page without a date, such as About, is titled like a section: the rule
    goes under its title, or under its subtitle. -#}
<h1 class="{% if page.date %}post-title{% else %}section-title{% endif %}">{{ page.title }}{% if page.draft %} <span class="draft">(draft)</span>{% endif %}</h1>
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
{% if config.extra.show_history_link and config.extra.history_url and page.relative_path %}<span><span class="sep">·</span><a class="history" href="{{ config.extra.history_url }}/{{ page.relative_path }}"{% if config.extra.history_hint %} title="{{ config.extra.history_hint }}"{% endif %}>View history</a></span>{% endif %}
{% if config.extra.show_suggest_edit and config.extra.source_url and page.relative_path %}<span><span class="sep">·</span><a class="source" href="{{ config.extra.source_url }}/{{ page.relative_path }}">Suggest an edit</a></span>{% endif %}
</div>
{% endif %}

{#- The About photo: avatar_photo, shrunk from content/, or avatar, from static/. -#}
{% if page.extra?.avatar_photo %}
{% set av = resize_image(path=page.extra.avatar_photo, width=240, height=240, op="fill") %}
<img class="avatar" src="{{ av.url }}" width="120" height="120" alt="">
{% elif page.extra?.avatar %}<img class="avatar" src="{{ get_url(path=page.extra.avatar) }}" width="120" height="120" alt="">{% endif %}

{#- From two headings, or one with sub-headings: a one-line box is noise. A page
    without a date gets one only when it asks, with toc = true under [extra]. -#}
{% if config.extra.show_toc and page.toc and (page.date or page.extra?.toc) and (page.toc | length > 1 or page.toc[0].children) %}
{{<toc items={page.toc} />}}
{% endif %}

{{<linkify html={page.content} />}}

{% if config.extra.enable_tags and page.taxonomies.tags %}
<div class="post-tags">Tags: {% for tag in page.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</div>
{% endif %}

{#- The bar: not on a page no list shows, such as About; the masthead already
    leads home. -#}
{{ reading | split(pat="<!--bar-->") | last | safe }}
{% endblock %}
EOF
}

# A section's page: any folder with an _index.md, such as the parent of child
# pages. Its title, subtitle (description), the contents box if it sets
# toc = true under [extra], its text, then its folders and child pages, in the
# same numbered list the home page uses, then the Previous and Next bar.
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
{{ reading | split(pat="<!--bar-->") | last | safe }}
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

# static/search.js, while ENABLE_SEARCH is true, loaded on every page. Fetches
# the index on the first keystroke; word-start matches, titles first. The DOM
# is built with createElement and textContent, never innerHTML.
render_search_js() {
    cat << 'EOF'
// The search box. Written by zola-blog-setup; script-owned.
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

    function show() {
        var words = input.value.split(/\s+/).filter(Boolean);
        results.textContent = "";
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
        // Enter opens the first result.
        if (e.key === "Enter" && !e.isComposing) {
            var first = results.querySelector("a");
            if (first) {
                e.preventDefault();
                first.click();
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

render_atom_xml() {
    cat << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"{% if lang %} xml:lang="{{ lang }}"{% endif %}>
    <title>{{ config.title }}
    {%- if term?.name %} - {{ term.name }}
    {%- elif section?.title %} - {{ section.title }}
    {%- endif -%}
    </title>
    {%- if config.description %}
    <subtitle>{{ config.description }}</subtitle>
    {%- endif %}
    <link href="{{ feed_url | safe }}" rel="self" type="application/atom+xml"/>
    <link href="{{ config.base_url | safe }}"/>
    {#- %FT%T%:z, not %+: Tera v2's date filter (jiff) has no %+, and Atom needs
        RFC 3339. -#}
    <generator uri="https://www.getzola.org/">Zola</generator>
    {#- A feed with no dated post has no last_updated; unguarded, the date filter
        stops the build. -#}
    {% if last_updated is defined %}<updated>{{ last_updated | date(format="%FT%T%:z") }}</updated>{% endif %}
    <id>{{ feed_url | safe }}</id>
    {#- RFC 4287: a feed needs an author unless every entry has one, and no post
        here sets one. -#}
    {%- if config.author %}
    <author>
        <name>{{ config.author }}</name>
    </author>
    {%- endif %}
    {%- for page in pages %}
    {%- if page.date %}
    <entry xml:lang="{{ page.lang }}">
        <title>{{ page.title }}</title>
        <published>{{ page.date | date(format="%FT%T%:z") }}</published>
        <updated>{{ (page.updated or page.date) | date(format="%FT%T%:z") }}</updated>
        {%- for author in page.authors %}
        <author>
            <name>{{ author }}</name>
        </author>
        {%- endfor %}
        <link rel="alternate" href="{{ page.permalink | safe }}" type="text/html"/>
        <id>{{ page.permalink | safe }}</id>
        {#- Bare addresses become links, as on the pages. A component's output is
            marked safe, so it's escaped here by hand. -#}
        {%- set body %}{{<linkify html={page.summary or page.content} />}}{% endset %}
        {%- if page.summary %}
        <summary type="html">{{ body | escape_html | safe }}</summary>
        {%- else %}
        <content type="html">{{ body | escape_html | safe }}</content>
        {%- endif %}
    </entry>
    {%- endif %}
    {%- endfor %}
</feed>
EOF
}

# Vars: CI_ZOLA_VERSION, ZOLA_SHA256. \${{...}} and \$ keep Actions and runner
# syntax literal. Actions are pinned by SHA (tag in the trailing comment), Node 24.
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
    # Pinned like the actions and Zola: the last input that could shift.
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          # The build runs code from the repo; it has no use for a git token.
          persist-credentials: false
      - name: Build with Zola ${CI_ZOLA_VERSION} (pinned)
        run: |
          set -euo pipefail
          url="https://github.com/getzola/zola/releases/download/${CI_ZOLA_VERSION}/zola-${CI_ZOLA_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl -fsSL --proto '=https' --tlsv1.2 -o zola.tar.gz "\$url"
          # The digest setup recorded for these exact bytes. No fallback, no skip.
          echo "${ZOLA_SHA256}  zola.tar.gz" | sha256sum -c -
          tar xzf zola.tar.gz
          # Print Zola's output whether the build passes or fails.
          out=\$(./zola build 2>&1) || { printf '%s\n' "\$out"; exit 1; }
          printf '%s\n' "\$out"
          # As in ./build: a dropped page still goes into sitemap.xml, and zola exits 0.
          if printf '%s\n' "\$out" | grep -q 'page(s) ignored'; then
            echo "::error::pages were dropped but sitemap.xml still lists their URLs; give them a weight, or hidden = true if they shouldn't be listed"
            exit 1
          fi
      - name: Upload artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: public
  deploy:
    needs: build
    # Only this job can publish, so only this job gets the two permissions.
    permissions:
      pages: write
      id-token: write
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
EOF
}

# =============================================================================
# Entry point (guarded so the file can be sourced to unit-test a render_*)
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````