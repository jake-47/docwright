
<div class="mdb-wide"></div>

# Bootstrap-zola script

The script below scaffolds a Zola blog, installs and version-pins the Zola binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. For details, see [Publish a blog](./publish-blog.md).

````bash
#!/usr/bin/env bash
# zola-blog-setup, v15
#
# Creates a small, fast, no-JavaScript blog for GitHub Pages. Installs Zola if
# needed, writes a ready-to-edit blog under PROJECT_DIR/BLOG_NAME, wires a
# first-party Pages deploy workflow pinned to a Zola version and its exact
# bytes, and opens a live preview. Full walkthrough: zola-blog-guide.md.
#
#   bash zola-blog-setup.sh              # everything comes from the block below
#   bash zola-blog-setup.sh update-zola  # update the Zola builder
#   bash zola-blog-setup.sh help
#
# It takes no arguments. Every input is a variable in the configuration block,
# which makes that block the one place the blog is described — and makes
# re-running the update path rather than a second, different mode.
#
# Zola 0.23 or newer, below 0.24: the templates are Tera v2 and this script
# refuses a release outside that band rather than write a blog that cannot build.
#
# RE-RUNNING REGENERATES. config.toml, templates/, serve, build, README.md,
# .gitignore, static/favicon.svg and the workflow are SCRIPT-OWNED: they are
# rewritten on every run, so hand edits to them do not survive. Change the
# corresponding render_* function or configuration variable and re-run instead.
# content/ and the rest of static/ are yours and are never touched after the
# first run. A re-run that would overwrite a script-owned file whose contents
# have drifted stops and names the files, until REGENERATE_TEMPLATES is true.

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

# Escape a value for XML text content. Two things are load-bearing here:
#   - & is replaced first, or it re-escapes the ampersands the later rules add;
#   - every & in a REPLACEMENT is backslash-escaped, because bash 5.2 made an
#     unquoted & there expand to the matched text. Without the backslash,
#     ${s//</&lt;} substitutes the match back in and yields "<lt;", not "&lt;".
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

## ─── user configuration ───────────────────────────────────────────────
# The whole interface. The script takes no arguments; everything it needs is
# here, and a re-run applies whatever has changed. The guide explains each.

# Where the blog goes. The folder is PROJECT_DIR/BLOG_NAME, created if absent
# and re-entered if present — re-entering an existing blog is the update path.
# A leading ~ is expanded; a relative PROJECT_DIR resolves against the directory
# you run from.
PROJECT_DIR="$HOME/Desktop"       # parent folder your blogs live under
readonly BLOG_NAME="myblog"       # folder name; the display name is SITE_TITLE

# Your repository, as the https URL in your browser's address bar — not
# user/repo, and not an ssh remote. This one value wires base_url, the per-post
# source and history links, the footer host link, and the git 'origin' remote.
# Left empty: a local blog with no deploy file and no dead links.
readonly GIT_REPO_URL="https://github.com/john/blog"          # https://github.com/user/repo

# A custom domain, once you have one pointed at Pages. Overrides the base_url
# derived from GIT_REPO_URL. config.toml is script-owned and rewritten on every
# run, so this is the place to set it — editing config.toml would not survive.
#
# This sets base_url and nothing else. No static/CNAME is written, and none is
# needed: with the Actions deploy this script writes, the domain lives in the
# repository's Settings -> Pages -> Custom domain, and GitHub serves it from
# there. Setting it here without setting it there gives you a site whose absolute
# URLs name a domain Pages is not answering on.
readonly CUSTOM_DOMAIN=""         # https://yourdomain.com

# Open the live preview when the run finishes. Overridable from the environment
# for a single run — START_PREVIEW=false bash zola-blog-setup.sh — because a
# re-run to change one variable otherwise ends in a server you have to Ctrl+C.
readonly START_PREVIEW="${START_PREVIEW:-true}"

# A re-run rewrites every script-owned file. If one of them has drifted from
# what this script would write, the run stops and names it rather than
# discarding the change unseen. Set this true to overwrite anyway — expect to
# need it the first time you run a newer version of this script.
#
# It is a one-run operation, so prefer the environment and leave the file alone:
#     REGENERATE_TEMPLATES=true bash zola-blog-setup.sh
readonly REGENERATE_TEMPLATES="${REGENERATE_TEMPLATES:-false}"

# Display name in the masthead and <title> — a placeholder; swap it for yours.
# Rename the site and the masthead wordmark and the favicon both follow, so
# there is nothing else to keep in step.
readonly SITE_TITLE="Fieldnotes"
# A strapline under the wordmark on the home page, set tight above the masthead
# rule so it reads as part of the nameplate. Also the feed's <subtitle> and the
# page's <meta name="description">, which is what a search result and a link
# preview show. Set it to "" and the line is not rendered at all.
readonly SITE_DESCRIPTION="one-line description"
readonly SITE_AUTHOR="your name"
readonly SITE_LANGUAGE="en"

# What fills the masthead beside the nav. The same three-way key the sibling
# mdBook script uses, with the same meanings. One of:
#   "text"  (default) SITE_TITLE alone, set in Charter at the body's own weight
#           — no plate, no boxed letter, nothing beside it to fall out of step.
#           Needs no file and no upkeep.
#   "none"  nothing; the masthead is the nav alone and each page's own <h1>
#           carries the name. Note that this leaves no link back to the home
#           page in the masthead, so put one in HEADER_NAV if you pick it.
#   "image" static/logo.svg, masked into the band and painted in the masthead
#           text colour — so ONE file serves light and dark. That makes it an
#           ALPHA MASK: supply a flat silhouette (a monogram) on a TRANSPARENT
#           ground, or the painted background masks the whole box solid. You
#           add static/logo.svg yourself; setup warns if it is missing.
readonly MASTHEAD="text"

# What static/favicon.svg draws. Separate from MASTHEAD, because a favicon and
# a masthead are different jobs: a text masthead and a drawn favicon coexist.
# Drawn as letters on a TRANSPARENT ground — no plate, ink in the palette's
# --fg, swapping to the dark ink under prefers-color-scheme: dark. One of:
#   "auto" (default) the first alphanumeric character of SITE_TITLE. Needs no
#          file and no upkeep: rename the site and the mark follows.
#   any other string, drawn as typed, case preserved, first 3 characters only
#          (longer truncates, with a warning).
#   ""     draw nothing, and write no favicon at all.
# NB a drawn mark is NOT in Charter and cannot be: a favicon is fetched as an
# image, and an image never loads an @font-face. The stack below it renders.
readonly FAVICON_TEXT="auto"

# Dark for every reader, or dark unless the reader's browser or OS asks for
# light. false (default): the light palette is not written at all and the site
# is dark whatever the reader is set to. true: both palettes ship and
# prefers-color-scheme picks between them. There is no in-page picker either
# way — a picker needs JavaScript or a cookie, and this site has neither.
readonly LIGHT_THEME=false

# Code-block highlighting themes (Giallo theme names; see the guide). Giallo
# writes both as a light-dark() pair inline on every block; with LIGHT_THEME
# false only DARK_CODE_THEME is ever seen, but both are still written because
# the pair is the only shape the config takes.
readonly LIGHT_CODE_THEME="github-light"
readonly DARK_CODE_THEME="github-dark"

readonly GENERATE_FEEDS=true      # atom.xml feed on/off
readonly PAGINATE_BY=10           # posts per page on the home feed

# Per-post furniture.
readonly SHOW_TOC=true            # table of contents on posts (a collapsed <details>)
readonly SHOW_HISTORY_LINK=false  # "view history" link to the post's file on your forge
readonly SHOW_SUGGEST_EDIT=false  # "suggest an edit" link to your forge's editor

# Email subscription — OFF by default. A static site can't send mail, so this
# renders a plain no-JS form that POSTs to a newsletter provider you control
# (Buttondown, Mailchimp, EmailOctopus, ...). See README.md "Email subscription".
# SUBSCRIBE_ACTION is the provider's form-POST URL and must be https:// — it
# carries reader email addresses, and setup refuses a plaintext one. See item
# "Email subscription" in README.md. SUBSCRIBE_FIELD is the email input name the
# provider expects (usually "email"; Mailchimp uses "EMAIL").
readonly ENABLE_SUBSCRIBE=false
readonly SUBSCRIBE_ACTION=""
readonly SUBSCRIBE_FIELD="email"
readonly SUBSCRIBE_BLURB="Get new posts by email."

readonly ABOUT_INTRO="your name. one or two sentences about what this site is for."
readonly ABOUT_EMAIL="you@yourdomain.com"

readonly FOOTER_X_URL="https://x.com/yourhandle"
readonly FOOTER_NOSTR_URL="https://nostr.com/npub1yourkeyhere"

## ─── derived from the block above (do not edit) ───────────────────────
# Expand a leading ~ (bash does not, inside a quoted assignment) and make the
# path absolute, so every later message names a folder the reader can paste.
PROJECT_DIR="${PROJECT_DIR/#\~/$HOME}"
[ "${PROJECT_DIR:0:1}" = "/" ] || PROJECT_DIR="$PWD/$PROJECT_DIR"
PROJECT_DIR="${PROJECT_DIR%/}"
readonly PROJECT_DIR
readonly BLOG_DIR="$PROJECT_DIR/$BLOG_NAME"

# Resolve FAVICON_TEXT into the mark the favicon draws. "auto" takes the first
# alphanumeric of SITE_TITLE, which cannot drift from the title the way a
# hardcoded letter silently does the first time someone renames the site. Any
# other value is escaped for XML rather than reduced, so a "&" or a "<" in a
# hand-set mark is drawn rather than breaking the SVG.
_favicon_mark=""
if [ "$FAVICON_TEXT" = "auto" ]; then
    _favicon_mark="${SITE_TITLE//[^A-Za-z0-9]/}"
    _favicon_mark="${_favicon_mark:0:1}"
    _favicon_mark=$(printf '%s' "$_favicon_mark" | tr '[:lower:]' '[:upper:]')
    [ -n "$_favicon_mark" ] || warn "FAVICON_TEXT is \"auto\" but SITE_TITLE has no alphanumeric character to take a mark from; no favicon is written"
elif [ -n "$FAVICON_TEXT" ]; then
    _favicon_mark="${FAVICON_TEXT:0:3}"
    if [ "${#FAVICON_TEXT}" -gt 3 ]; then
        warn "FAVICON_TEXT is ${#FAVICON_TEXT} characters and a favicon is read at 16px; only \"${_favicon_mark}\" is drawn"
    fi
fi
readonly FAVICON_MARK="$_favicon_mark"
unset _favicon_mark

## ─── pinned tool versions ─────────────────────────────────────────────
# Zola is pinned into the CI workflow at install time. This is a BAND, not a
# floor: setup keeps an existing local Zola only if it falls inside the band, and
# pins whatever it keeps into CI, so the band governs the deploy as well as the
# machine.
#
# The floor is 0.23 and the reason is the template language. Zola 0.23.0 shipped
# Tera v2, which deletes macros outright, changes tests to keyword arguments,
# errors on undefined field access, and drops the %+ date specifier. Every one of
# those appears in what this script writes, so the templates below are Tera v2
# and cannot run on 0.22 or earlier. 0.22 is also the release that replaced
# syntect with Giallo and introduced the .giallo-l / .giallo-ln classes the
# stylesheet carries, so the highlighting config here needs 0.22 as well — the
# template floor is simply the higher of the two.
#
# The CEILING is the half that v10 was missing. With only a floor, setup
# installed and pinned whatever "latest" happened to be, which after 2026-08-05
# meant handing a Tera v1 site to a Tera v2 binary: a dead local preview and a
# red CI, from a run that reported success. A ceiling makes that a loud refusal
# instead. Raising it means porting the templates first, not editing this line.
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
FORGE_NAME=""
FORGE_URL=""
REMOTE_URL=""
TODAY=""
YESTERDAY=""
TWO_DAYS_AGO=""

cleanup_tmp() { [ -n "$TMP_ZOLA" ] && rm -rf "$TMP_ZOLA"; return 0; }

# A create that dies part-way used to leave a half-written folder behind, and a
# re-run then saw a config.toml and silently switched to host-update mode. This
# removes ONLY a directory this run created: BLOG_CREATED is set to an absolute
# path immediately after the mkdir, and cleared the moment the blog is complete,
# so the rm can never reach a folder that was already there.
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
# Two subcommands and nothing else. With no positional argument there is
# nothing a mistyped verb could be confused with, so anything unrecognised is
# an error rather than a folder named after the typo.
main() {
    case "${1:-}" in
        "")              cmd_setup ;;
        help|-h|--help)  cmd_help ;;
        update-zola)     cmd_update_zola ;;
        *)               die_usage "this script takes no arguments; got: $* (everything is configured in the block at the top; try: zola-blog-setup help)" ;;
    esac
}

# =============================================================================
# help / version
# =============================================================================
cmd_help() {
    say "zola-blog-setup — bootstraps a minimal Zola blog."
    cat <<'EOF'

  bash zola-blog-setup.sh
        Create or update PROJECT_DIR/BLOG_NAME from the configuration block at
        the top of this file. Takes no arguments: edit the block, run it.
        With GIT_REPO_URL set, also writes a GitHub Pages deploy workflow and
        an 'origin' remote, and derives base_url and the per-post links.

  bash zola-blog-setup.sh update-zola
        Install the latest Zola release and print its sha256.

  bash zola-blog-setup.sh help        (--help, -h)

Re-running is the update path, not a second mode. These are script-owned and
are rewritten every run:

  config.toml   templates/   serve   build   README.md   .gitignore
  static/favicon.svg   .github/workflows/deploy.yml

Ownership runs both ways: clear FAVICON_TEXT or GIT_REPO_URL and the file that
variable produced is removed, not left behind.

Hand edits to them do not survive. Change the matching render_* function or
configuration variable instead. content/ and the rest of static/ are yours and
are written once, on the first run, then never touched.

If a script-owned file has drifted from what this script would write, the run
stops and names it. Set REGENERATE_TEMPLATES=true to overwrite anyway.

After setup, inside the blog folder:
  ./serve     preview at http://127.0.0.1:1111 with live reload
  ./build     build the static site into ./public

Zola version: this script supports a BAND, not just a floor. The templates it
writes are Tera v2 (Zola 0.23+) and will not run on 0.22 or earlier; a release
newer than the ceiling is refused rather than installed, because an untested
template language is how you get a blog that reports success and does not build.

Environment (each applies to one run; nothing to edit and set back):
  START_PREVIEW=false  skip the live preview at the end of the run.
  REGENERATE_TEMPLATES=true
                       overwrite script-owned files that have drifted.
  ZOLA_VERSION_OVERRIDE=<vX.Y.Z>
                       install and pin this release instead of resolving the
                       latest one. The escape hatch for the day the latest
                       release moves past the ceiling.
  ZOLA_SHA256_OVERRIDE=<sha256>
                       supply the linux digest pinned into the CI workflow
                       instead of downloading that build to hash it. Setup
                       stops rather than emit a workflow with nothing to check
                       its builder against. Not usually needed: a re-run reuses
                       the digest already pinned in deploy.yml.
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
# setup — bootstrap a blog (and idempotently re-point its host)
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
    clear_blog_cleanup
    say "blog created in $BLOG_DIR"
    say ""
    init_git_repo
    start_preview_server
}

# Re-run: the update path. Regenerates every script-owned file from the current
# configuration block and leaves content/ alone. Nothing is installed and no
# folder is created, so this is cheap enough to run after any config change.
run_update_mode() {
    say "found an existing blog in $BLOG_DIR"
    say "updating the script-owned files; content/ is left untouched."
    say ""
    IS_UPDATE=1
    check_required_tools
    ensure_zola_installed
    resolve_host_config
    resolve_dates
    resolve_workflow_pin
    enter_existing_target
    check_owned_file_drift
    write_owned_files
    write_placeholder_assets_if_absent
    update_git_remote
    say ""
    say "updated."
    start_preview_server
}

enter_existing_target() {
    cd "$BLOG_DIR" || die "could not enter blog folder '$BLOG_DIR'"
}

# The script-owned set, as "path render_function" pairs; "-" means the file is
# written elsewhere but is owned all the same. One list, read by the writer, the
# manifest and the drift check, so the three cannot disagree about what is owned.
#
# The last two entries are CONDITIONAL, and that is load-bearing rather than
# tidy. FAVICON_TEXT="" is the documented way to supply your own favicon; if the
# list claimed that path unconditionally, the manifest would record YOUR file's
# digest, the next run would read it back as "the script wrote these bytes", and
# delete it. Ownership follows the configuration instead, so a file this script
# is not writing is not claimed, not drift-checked, and not removed.
owned_files() {
    cat <<'OWNED'
.gitignore render_gitignore
serve render_serve
build render_build
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
    [ -n "$FAVICON_MARK" ] && printf '%s\n' "static/favicon.svg -"
    [ -n "$GIT_REPO_URL" ] && printf '%s\n' ".github/workflows/deploy.yml -"
    return 0
}

# What the last run wrote, one "sha256  path" line per owned file. Tracked, not
# ignored, so it travels with the repo and a checkout restores a consistent pair.
readonly OWNED_MANIFEST=".zola-blog-setup.manifest"

# Refuse to discard a hand edit unseen — and only a hand edit.
#
# The comparison is against the MANIFEST, not against what this run would write.
# Those are different questions and only the first one is the one being asked:
# every owned file differs from what a newer script would write, and so does
# config.toml the moment any configuration variable changes, so comparing
# would-write against on-disk flags exactly the updates this mode exists to
# apply. A file that still matches what the last run left is not a hand edit,
# whatever this run intends to put there.
#
# No manifest means the blog predates it — every owned file is treated as
# drifted, which is the right conservative answer for that one upgrade.
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
        recorded=$(awk -v p="$path" '$2 == p { print $1 }' "$OWNED_MANIFEST")
        if [ -z "$recorded" ]; then drifted+=("$path"); continue; fi
        actual=$(sha256_of "$path") || continue
        [ "$actual" = "$recorded" ] || drifted+=("$path")
    done < <(owned_files)
    [ "${#drifted[@]}" -eq 0 ] && return 0
    if [ -n "$no_manifest" ]; then
        warn "this blog was made by an older version of this script, which kept no record of"
        warn "what it wrote, so a hand edit cannot be told from an ordinary update. every"
        warn "script-owned file is listed:"
    else
        warn "these files have been changed since this script last wrote them, and a re-run"
        warn "would overwrite them:"
    fi
    local f
    for f in "${drifted[@]}"; do warn "  - $f"; done
    warn ""
    warn "they are script-owned: change the matching render_* function or a configuration"
    warn "variable rather than the file. to overwrite them anyway, set REGENERATE_TEMPLATES=true"
    warn "at the top of the script and run again. nothing has been changed."
    exit 1
}

# Record what this run left on disk, so the next run can tell an edit from an
# update. Written last, after every owned file is in place.
write_owned_manifest() {
    local path fn digest
    : > "$OWNED_MANIFEST"
    while read -r path fn; do
        [ -f "$path" ] || continue
        digest=$(sha256_of "$path") || { rm -f "$OWNED_MANIFEST"; return 0; }
        printf '%s  %s\n' "$digest" "$path" >> "$OWNED_MANIFEST"
    done < <(owned_files)
    return 0
}

write_owned_files() {
    mkdir -p templates static
    local path fn
    while read -r path fn; do
        [ "$fn" = "-" ] && continue
        "$fn" > "$path"
    done < <(owned_files)
    chmod +x serve build
    # Script-owned means owned in both directions: clearing the variable that
    # produced a file has to remove the file, or an old favicon stays linked and
    # a dead deploy.yml keeps publishing to a repo you removed, against the
    # placeholder base_url config.toml has just reverted to.
    #
    # But only what THIS SCRIPT WROTE. FAVICON_TEXT="" is the documented way to
    # supply your own static/favicon.svg, and v11 deleted it — the manifest
    # already records which bytes are ours, so ask it.
    if [ -n "$FAVICON_MARK" ]; then
        render_favicon_svg > static/favicon.svg
    elif [ -f static/favicon.svg ]; then
        if remove_if_ours static/favicon.svg; then
            say "removed static/favicon.svg (FAVICON_TEXT is empty)"
        fi
    elif [ "$IS_UPDATE" != 1 ]; then
        warn "FAVICON_TEXT is empty; no favicon written. add static/favicon.svg yourself, or the browser falls back to /favicon.ico"
    fi
    if [ "$MASTHEAD" = image ] && [ ! -f static/logo.svg ]; then
        warn "MASTHEAD is \"image\" but static/logo.svg is not there; the masthead shows an empty box until you add it. Supply a flat silhouette on a transparent ground — it is painted as a mask, so any background in the file masks the whole box solid."
    fi
    # A blog scaffolded by v10 or earlier carries templates/macros.html. Zola 0.23
    # cannot parse it at all — "Unknown tag: macro" aborts the build before it
    # reaches any other template — and templates/components.html supersedes it, so
    # it goes. This is the one owned file removed without the drift check, because
    # a hand-edited version of it is equally unbuildable.
    if [ -f templates/macros.html ]; then
        rm -f templates/macros.html
        say "removed templates/macros.html (Tera v1 macros; superseded by templates/components.html)"
    fi
    write_deploy_workflow
    write_owned_manifest
    say "wrote the script-owned files (config.toml, templates/, serve, build, README.md, .gitignore)"
}

validate_config() {
    case "$MASTHEAD" in
        none|text|image) ;;
        *) die "MASTHEAD must be none, text or image, got: $MASTHEAD" ;;
    esac

    [ -n "$PROJECT_DIR" ] || die "PROJECT_DIR must not be empty"

    # BLOG_NAME becomes a directory under PROJECT_DIR, so it is a single
    # segment: no slashes, no leading dash or dot, no '..', no whitespace.
    case "$BLOG_NAME" in
        ""|*/*|*\\*|.*|-*|*..*|*" "*|*$'\t'*|*\"*)
            die "BLOG_NAME must be a plain folder name (no slashes, leading dash or dot, spaces, '..', or double quotes), got: '$BLOG_NAME'" ;;
    esac

    # Everything downstream — base_url, the per-post source and history links,
    # the footer host link, the origin remote — assumes GitHub over https, and
    # the deploy path is GitHub Actions to GitHub Pages regardless. An ssh or
    # non-GitHub URL would produce a broken link and a nonsense Pages URL, so
    # require the one form that works: what your browser shows on the repo page.
    case "$GIT_REPO_URL" in
        "") ;;
        *$'\n'*|*$'\r'*) die "GIT_REPO_URL must not contain newlines or carriage returns" ;;
        https://github.com/*/*) ;;
        *) die "GIT_REPO_URL must be an https github.com URL (https://github.com/user/repo), got: $GIT_REPO_URL" ;;
    esac

    case "$CUSTOM_DOMAIN" in
        ""|https://*) ;;
        *) die "CUSTOM_DOMAIN must be an https:// URL (got: $CUSTOM_DOMAIN)" ;;
    esac

    validate_bool GENERATE_FEEDS      "$GENERATE_FEEDS"
    validate_bool LIGHT_THEME         "$LIGHT_THEME"
    validate_bool SHOW_TOC            "$SHOW_TOC"
    validate_bool SHOW_HISTORY_LINK   "$SHOW_HISTORY_LINK"
    validate_bool SHOW_SUGGEST_EDIT   "$SHOW_SUGGEST_EDIT"
    validate_bool ENABLE_SUBSCRIBE    "$ENABLE_SUBSCRIBE"
    validate_bool START_PREVIEW       "$START_PREVIEW"
    validate_bool REGENERATE_TEMPLATES "$REGENERATE_TEMPLATES"

    case "$PAGINATE_BY" in
        ""|*[!0-9]*) die "PAGINATE_BY must be a whole number of posts per page, got: '$PAGINATE_BY'" ;;
        0)           die "PAGINATE_BY must be at least 1, got: 0" ;;
    esac

    validate_subscribe_action
}

# These seven go into config.toml unquoted, as TOML booleans. v10 checked five of
# the twelve configuration variables and let the rest through, so SHOW_TOC=yes
# produced a run that reported success, a git commit, and a TOML parse error at
# the next build — a failure surfacing three steps from its cause. The block is
# the whole interface; validating half of it is not validating it.
validate_bool() {
    case "$2" in
        true|false) return 0 ;;
        *) die "$1 must be true or false (unquoted), got: '$2'" ;;
    esac
}

# The subscribe form is the only place reader data leaves this site. A plaintext
# endpoint would post email addresses in the clear, so setup refuses one outright
# rather than warning into a scrollback nobody rereads.
validate_subscribe_action() {
    [ "$ENABLE_SUBSCRIBE" = true ] || return 0
    case "$SUBSCRIBE_ACTION" in
        https://*) return 0 ;;
        "") die "ENABLE_SUBSCRIBE is true but SUBSCRIBE_ACTION is empty; set it to your provider's form-POST URL." ;;
        *)  die "SUBSCRIBE_ACTION must be an https:// URL (got '$SUBSCRIBE_ACTION'); it carries reader email addresses." ;;
    esac
}

update_git_remote() {
    [ -n "$REMOTE_URL" ] || return 0
    if ! command -v git >/dev/null 2>&1; then
        say "git not installed; remote not updated"
        return
    fi
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        say "not a git repo; remote not updated"
        return
    fi
    if git remote get-url origin >/dev/null 2>&1; then
        local existing
        existing=$(git remote get-url origin)
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

# Resolve the release this script will install and pin, into ZOLA_VERSION.
#
# ZOLA_VERSION_OVERRIDE short-circuits the lookup: it is the escape hatch for the
# day the latest release moves past ZOLA_MAX_VERSION and you want a specific
# tested tag without editing this file.
#
# Otherwise the latest tag comes from the releases/latest redirect (no API token,
# no rate limit) and is then checked against the band. Out of band is a refusal,
# not a warning: installing an unsupported Zola is precisely how v10 produced a
# blog that reported success and did not build.
resolve_zola_release() {
    [ -n "$ZOLA_VERSION" ] && return 0
    if [ -n "${ZOLA_VERSION_OVERRIDE:-}" ]; then
        ZOLA_VERSION="${ZOLA_VERSION_OVERRIDE#v}"; ZOLA_VERSION="v${ZOLA_VERSION}"
        version_in_band "${ZOLA_VERSION#v}" || warn "warning: ZOLA_VERSION_OVERRIDE names ${ZOLA_VERSION}, outside this script's supported band (>= ${ZOLA_MIN_VERSION}, < ${ZOLA_MAX_VERSION}). the templates are written for Tera v2 and may not build."
        return 0
    fi
    local tag=""
    if command -v curl >/dev/null 2>&1; then
        tag=$(curl -fsSLI -o /dev/null -w '%{url_effective}\n' \
            https://github.com/getzola/zola/releases/latest 2>/dev/null \
            | sed -n 's#.*/tag/##p' || true)
    elif command -v wget >/dev/null 2>&1; then
        tag=$(wget -qSO /dev/null \
            https://github.com/getzola/zola/releases/latest 2>&1 \
            | sed -n 's#.*[Ll]ocation:.*/tag/##p' | tail -n1 || true)
    else
        die "need curl or wget to resolve the latest zola release"
    fi
    tag="${tag%%[[:space:]]*}"
    if [ -z "$tag" ]; then
        tag=$(http_download https://api.github.com/repos/getzola/zola/releases/latest /dev/stdout 2>/dev/null \
            | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1 || true)
        tag="${tag%%[[:space:]]*}"
    fi
    [ -n "$tag" ] || die "could not resolve the latest zola release from GitHub (network?); install zola manually (apt install zola / brew install zola) and re-run."
    if ! version_in_band "${tag#v}"; then
        die "zola ${tag#v} is the latest release, but this script supports >= ${ZOLA_MIN_VERSION} and < ${ZOLA_MAX_VERSION}.
the templates it writes are written for one template-language generation, and a newer
zola may not run them. nothing has been changed. either update this script, or pin a
tested release for this run:
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

# Keep an installed Zola that is inside the band; otherwise install a supported
# one. A local zola ABOVE the ceiling is replaced like one below the floor, and
# said out loud, because $HOME/.local/bin/zola is shared with any other site on
# this machine and a downgrade is not a silent thing to do.
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
        warn "zola $current is newer than this script supports (< $ZOLA_MAX_VERSION)."
        warn "installing ${ZOLA_VERSION#v} over it at \$HOME/.local/bin/zola — any other zola site on"
        warn "this machine will build with ${ZOLA_VERSION#v} until you reinstall."
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
        windows_*)       triple="x86_64-pc-windows-msvc"; ext=zip ;;
        *)               die "unsupported platform ${os}/${arch}" ;;
    esac

    local url="https://github.com/getzola/zola/releases/download/${version}/zola-${version}-${triple}.${ext}"

    # No `trap cleanup_tmp EXIT` here. It would REPLACE the cleanup_all trap set
    # at the top of the file, and cleanup_all already calls cleanup_tmp. v10 had
    # it, which silently disabled the partial-blog cleanup on exactly the runs
    # that install zola — the first run on a clean machine.
    TMP_ZOLA=$(mktemp -d)
    local archive="$TMP_ZOLA/zola.$ext"

    say "downloading zola $version..."
    http_download "$url" "$archive"

    [ -s "$archive" ] || die "download produced an empty file"

    # Zola publishes no .sha256 sidecar for any release, so there is no second,
    # independent value these bytes can be checked against. The digest below is
    # of what TLS just delivered; it is printed rather than compared, so it can
    # be held against the release page or a second machine. Trust rests on
    # https to github.com — the same trust that got you this script. An earlier
    # version refused to install without a sidecar, which meant it refused
    # always: a gate that can never open is not a control, it is a stoppage.
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

    case "$os" in
        linux|macos)
            case ":$PATH:" in
                *":$HOME/.local/bin:"*) : ;;
                *)
                    say ""
                    say "note: $HOME/.local/bin is not on your PATH yet. add this line to"
                    say "$HOME/.profile (sh/bash) or $HOME/.zprofile (zsh):"
                    say "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                    say "then open a new terminal, or run that same line now to fix this shell."
                    ;;
            esac
            ;;
    esac

    command -v zola >/dev/null 2>&1 || die "zola not on PATH"
    say "installed: $(zola --version)"
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
    say "existing projects' CI workflows are pinned and do not update on their own:"
    say "bump both the zola version and its sha256 in .github/workflows/deploy.yml,"
    say "then commit and push. The digest is on the release page:"
    say "  https://github.com/getzola/zola/releases/tag/${ZOLA_VERSION}"
    say "New blogs pin this version automatically."
}

# =============================================================================
# Host / project config resolution
# =============================================================================
# Derive everything host-shaped from GIT_REPO_URL, which validate_config has
# already constrained to https://github.com/user/repo. A trailing slash or a
# .git suffix is tolerated because both are things a browser or a clone command
# hands you. CUSTOM_DOMAIN, when set, replaces the derived base_url and nothing
# else: the source and history links still point at the repo.
resolve_host_config() {
    if [ -n "$GIT_REPO_URL" ]; then
        local rest="${GIT_REPO_URL#https://github.com/}"
        rest="${rest%/}"
        rest="${rest%.git}"
        local user="${rest%%/*}"
        local repo="${rest##*/}"
        if [ -z "$user" ] || [ -z "$repo" ] || [ "$user" = "$repo" ]; then
            die "GIT_REPO_URL does not name a user and a repo: $GIT_REPO_URL"
        fi
        GITHUB_REPO="${user}/${repo}"
        if [ "$repo" = "${user}.github.io" ]; then
            BASE_URL="https://${user}.github.io"
        else
            BASE_URL="https://${user}.github.io/${repo}"
        fi
        [ -n "$CUSTOM_DOMAIN" ] && BASE_URL="${CUSTOM_DOMAIN%/}"
        SOURCE_URL="https://github.com/${GITHUB_REPO}/blob/main/content"
        HISTORY_URL="https://github.com/${GITHUB_REPO}/commits/main/content"
        HISTORY_HINT="Click a commit, then 'Display the rich diff' for rendered prose"
        FORGE_NAME="github"
        FORGE_URL="https://github.com/${GITHUB_REPO}"
        REMOTE_URL="git@github.com:${GITHUB_REPO}.git"
    else
        # Local-only. base_url keeps a placeholder (Zola requires one; `zola
        # serve` overrides it). Per-post source/history links ship empty so no
        # dead links render. Setting GIT_REPO_URL and re-running fills them in.
        BASE_URL="${CUSTOM_DOMAIN:-https://yourusername.github.io}"
        BASE_URL="${BASE_URL%/}"
        SOURCE_URL=""
        HISTORY_URL=""
        HISTORY_HINT=""
        FORGE_NAME="github"
        FORGE_URL="https://github.com/yourusername/yourblog"
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
    mkdir -p "$BLOG_DIR"/{content/about,templates,static/fonts} \
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
        say "git init failed - run manually later"
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
        say "     git config --global user.email \"you@example.com\" )"
    fi
    update_git_remote
}

# `exec` replaces this process, so the EXIT trap never fires: cleanup runs here
# instead. Skipped when START_PREVIEW is false, and skipped automatically with
# no terminal on stdout, so the script can be driven from another script without
# hanging on a server nobody is watching.
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
    exec zola serve --open
}

# =============================================================================
# Writers (thin orchestrators dispatching to the render_* functions below)
# =============================================================================
# Yours, not the script's: written once and never rewritten, because the whole
# point of them is that you replace their contents with your own.
write_content_if_absent() {
    mkdir -p content/about content/pages
    write_absent content/_index.md         render_home_index
    write_absent content/pages/_index.md   render_unlisted_index
    write_absent content/about/_index.md   render_about
    write_absent content/hello-world.md    render_hello_world
    write_absent content/second-post.md    render_second_post
    say "wrote content/ (yours from here; a re-run will not touch it)"
}

write_placeholder_assets_if_absent() {
    mkdir -p static/fonts
    write_absent static/demo.svg          render_demo_svg
    write_absent static/avatar.svg        render_avatar_svg
    write_absent static/fonts/README.txt  render_fonts_readme
}

write_absent() {
    local path="$1" fn="$2"
    [ -e "$path" ] && return 0
    "$fn" > "$path"
}

# Does a release tag actually name a downloadable linux asset? A HEAD is enough
# and costs one round trip before a 15MB download commits to the answer.
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

# Settle the version the WORKFLOW pins. This is deliberately not just
# "whatever zola --version says", for two reasons that both end in a red build:
#   - a distro build reports a string no release is named after (0.22.1+dfsg),
#     and the pinned URL then 404s at setup and again in CI;
#   - host-update mode never runs the floor check, so a machine carrying an old
#     zola could silently downgrade an existing blog's CI below ZOLA_MIN_VERSION.
# The local version is used only when it clears the floor AND names a real
# release asset; otherwise the pin comes from the latest release.
resolve_zola_version_for_workflow() {
    [ -n "$CI_ZOLA_VERSION" ] && return 0
    local local_ver=""
    if command -v zola >/dev/null 2>&1; then
        local_ver=$(zola --version 2>/dev/null | awk '{print $2}')
    fi
    if [ -n "$local_ver" ] && version_in_band "$local_ver" \
       && release_asset_exists "v${local_ver}"; then
        CI_ZOLA_VERSION="v${local_ver}"
        say "pinning zola ${local_ver} into the workflow (same build as this machine)"
        return 0
    fi
    resolve_zola_release
    CI_ZOLA_VERSION="$ZOLA_VERSION"
    if [ -n "$local_ver" ]; then
        # Three different things reach here and v10 reported all three as a
        # version problem: outside the band, not a release tag, and the network
        # being down. Name all three rather than assert the first.
        say "local zola ${local_ver} was not usable as the CI pin — outside the supported band"
        say "(>= ${ZOLA_MIN_VERSION}, < ${ZOLA_MAX_VERSION}), not a published release tag, or the release could not be"
        say "reached just now. pinning ${CI_ZOLA_VERSION#v} into the workflow instead."
    else
        say "pinning zola ${CI_ZOLA_VERSION#v} into the workflow"
    fi
}

# CI checks the builder against a digest recorded here once, not one fetched
# alongside it on every build — a value fetched at build time from the same
# place as the file it vouches for proves nothing. Recorded at setup, visible
# in the diff, fixed thereafter: a later substitution of the release asset
# turns the build red instead of passing silently. What this does not do is
# vouch for the bytes at the moment they are first recorded; nothing available
# here can, since every candidate source is github over https.
resolve_zola_sha_for_workflow() {
    [ -n "$ZOLA_SHA256" ] && return 0
    if [ -n "${ZOLA_SHA256_OVERRIDE:-}" ]; then
        ZOLA_SHA256="$ZOLA_SHA256_OVERRIDE"
    elif ZOLA_SHA256=$(recorded_workflow_sha "$CI_ZOLA_VERSION"); then
        say "reusing the digest already pinned in .github/workflows/deploy.yml for ${CI_ZOLA_VERSION#v}"
    else
        local url tmpdir
        # Always the Linux x86_64 build: that is what the runner uses, which is
        # not necessarily the build installed on this machine. Downloaded here
        # only to be hashed, then discarded.
        url="https://github.com/getzola/zola/releases/download/${CI_ZOLA_VERSION}/zola-${CI_ZOLA_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
        tmpdir=$(mktemp -d)
        say "hashing the linux zola ${CI_ZOLA_VERSION#v} build to pin it into the workflow..."
        if http_download "$url" "$tmpdir/zola.tar.gz" && [ -s "$tmpdir/zola.tar.gz" ]; then
            ZOLA_SHA256=$(sha256_of "$tmpdir/zola.tar.gz") || ZOLA_SHA256=""
        fi
        rm -rf "$tmpdir"
    fi
    case "$ZOLA_SHA256" in
        *[!0-9a-fA-F]*|"") die "could not hash the linux zola ${CI_ZOLA_VERSION} build, which the workflow pins; nothing was created. re-run with ZOLA_SHA256_OVERRIDE=<sha256> if you already hold that digest." ;;
    esac
    [ ${#ZOLA_SHA256} -eq 64 ] || die "the digest given for ${CI_ZOLA_VERSION} is not a sha256 (got ${#ZOLA_SHA256} characters); nothing was created."
    say "pinned the zola builder digest into the workflow"
}

# The digest this blog already pins, if the workflow on disk pins the same
# version. v10 re-downloaded 14 MB on EVERY run to recompute a value that was
# already sitting in deploy.yml, which made a re-run slow on a metered link and
# impossible without one — for a change as small as editing SITE_TITLE. Reading
# it back is not a weaker check: the digest was recorded once, at setup, which is
# the whole point of pinning; recomputing it from the same place it vouches for
# proves nothing it did not already prove. A version change still forces a fresh
# download, because then the recorded digest is for different bytes.
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
    resolve_zola_version_for_workflow
    [ -n "$GIT_REPO_URL" ] && resolve_zola_sha_for_workflow
    return 0
}

write_deploy_workflow() {
    if [ -n "$GIT_REPO_URL" ]; then
        mkdir -p .github/workflows
        render_github_workflow > .github/workflows/deploy.yml
        say "wrote .github/workflows/deploy.yml"
    elif [ -f .github/workflows/deploy.yml ]; then
        # GIT_REPO_URL was cleared. Leaving the workflow keeps it deploying on
        # every push, and config.toml has just reverted to the placeholder
        # base_url, so what it publishes carries absolute URLs naming a domain
        # you do not own. Remove it — unless you have edited it, in which case
        # deleting your work silently is the worse of the two failures.
        if remove_if_ours .github/workflows/deploy.yml; then
            rmdir .github/workflows .github 2>/dev/null || true
            say "removed .github/workflows/deploy.yml (GIT_REPO_URL is empty); commit the deletion to stop the deploy"
        else
            warn "GIT_REPO_URL is empty but .github/workflows/deploy.yml has been edited since this script wrote it, so it was left in place."
            warn "it will keep deploying on every push, and base_url has reverted to a placeholder. delete it yourself when you have saved what you changed."
        fi
    fi
}

# Remove a script-owned file the configuration no longer calls for — but only if
# the bytes on disk are the ones this script last wrote. The manifest already
# records that, so no second record is needed. Returns non-zero when the file is
# kept, so the caller can say why.
remove_if_ours() {
    local path="$1" recorded actual
    [ -f "$OWNED_MANIFEST" ] || return 1
    recorded=$(awk -v p="$path" '$2 == p { print $1 }' "$OWNED_MANIFEST")
    [ -n "$recorded" ] || return 1
    actual=$(sha256_of "$path") || return 1
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
EOF
}

render_serve() {
    cat << 'EOF'
#!/usr/bin/env bash
# preview the blog locally at http://127.0.0.1:1111 with live reload
cd "$(dirname "$0")"
exec zola serve --open
EOF
}

render_build() {
    cat << 'EOF'
#!/usr/bin/env bash
# build the static site into ./public for deployment
set -euo pipefail
cd "$(dirname "$0")"

# Zola drops a page that has no date in a date-sorted section, warns on stderr,
# and exits 0 — but it still writes that page's URL into sitemap.xml. The site
# would then advertise a 404 to every crawler that reads the sitemap, and the
# only signal is a warning in output nobody rereads. So the output is captured
# and the warning is turned into a failure. The build is sub-second; buffering
# it costs nothing.
out=$(zola build 2>&1) || { printf '%s\n' "$out" >&2; exit 1; }
printf '%s\n' "$out"
if printf '%s\n' "$out" | grep -q 'page(s) ignored'; then
    {
        printf '\n%s\n' "the page(s) named above produced no HTML, but sitemap.xml still lists"
        printf '%s\n'    "their URLs, so the published site would point crawlers at a 404."
        printf '%s\n'    "give the page a date, or move it to content/pages/ — a section built"
        printf '%s\n'    "for pages that should exist without being listed. nothing was published."
    } >&2
    exit 1
fi
EOF
}

# Vars: BLOG_NAME, BASE_URL, FORGE_NAME, FORGE_URL. Leads with the live link.
render_readme() {
    if [ -n "$GIT_REPO_URL" ]; then
        cat << EOF
# ${BLOG_NAME}

Live at <${BASE_URL}>.

Personal blog built with [Zola](https://www.getzola.org/).

Push to \`main\` branch deploys to ${FORGE_NAME} (<${FORGE_URL}>) automatically.
EOF
    else
        cat << EOF
# ${BLOG_NAME}

Personal blog built with [Zola](https://www.getzola.org/).

No deploy configured. Re-run setup with \`--github USER/REPO\` to add one.
EOF
    fi
    cat << 'EOF'

## How this blog is maintained

Some of these files are **script-owned**: `config.toml`, everything in
`templates/`, `serve`, `build`, this README, `.gitignore`,
`static/favicon.svg`, and `.github/workflows/deploy.yml`. Re-running
zola-blog-setup rewrites all of them from its configuration block, so an edit
you make here does not survive. Change the variable at the top of the script,
or the matching `render_*` function, and re-run.

`content/` and the rest of `static/` are yours. They are written once, on the
first run, and never touched again.

A re-run that would overwrite a script-owned file you have changed stops and
names the file first, rather than discarding the change unseen.

## Making it yours

The masthead — `masthead` in config.toml [extra] takes one of three values:

    "text"    the site title alone, set in Charter (the default)
    "none"    nav only; add a { name = "home", url = "/" } to header_nav if
              you pick this, because nothing else links back to the front page
    "image"   static/logo.svg, which you supply

"image" paints the file as a MASK in the masthead text colour, so one file
serves light and dark. Supply a flat silhouette on a TRANSPARENT ground — a
monogram, not a picture. A file with its own background masks the whole box
solid.

The favicon is a separate job with its own source (FAVICON_TEXT in the setup
script, drawn into static/favicon.svg), so a text masthead and a drawn favicon
coexist. It is script-owned and redrawn on every run: to change it, change
FAVICON_TEXT, not the file.

Your photo — the about page shows a placeholder. Put a photo next to
content/about/_index.md and set `avatar_photo = "about/me.jpg"` in its [extra].
Note the path: `resize_image` resolves relative to content/, not to the page, so
a bare "me.jpg" is not found and fails the build. Zola
resizes it at build time, and resizing discards all EXIF metadata. This matters:
a photo copied straight off a phone carries GPS coordinates, device model and
capture time, and anything under static/ is published byte for byte with all of
it intact. The same goes for photos in posts — put them beside the post and pass
them through `resize_image`, or strip them first (`exiftool -all= photo.jpg`;
Devuan and Debian package it as libimage-exiftool-perl).

Fonts — see static/fonts/README.txt to self-host Charter (a fallback serif
renders until you do).

Unlisted pages — content/pages/ is for a page that should exist and be linkable
without appearing on the home page or in the feed. Drop a .md file in there with
a title and no date; it builds at /pages/<slug>/ and gets no date line, no
contents box and no newer/older links.

Do NOT put a dateless .md at the top of content/. The home section is sorted by
date, and Zola drops a dateless page from a sorted section — no HTML file, just
a warning — while still writing its URL into sitemap.xml, so the site would
advertise a URL that 404s. ./build stops on that rather than let it ship.

And unlisted is not private. sitemap.xml names every page that exists, so an
unlinked page is public, just harder to stumble on. Use draft = true in the
front matter to keep something out of the build entirely.

Wide posts — put <div class="wide" hidden></div> anywhere in a post's Markdown
to widen that page's measure, running text included.

One wide element — put class="bleed" on a single figure, table or div and it
uses the extra width while the text stays on the measure. A <figure> needs no
extra handling; the stylesheet already cancels the 40px side margins browsers
give it. Both .wide and .bleed in one post: .bleed wins.

Notes and collapsibles — <aside> sets a passage smaller and muted with a rule
down the side; <details> makes a section the reader opens, the same treatment as
the contents box on a post. Both need blank lines around their content, or the
Markdown inside comes out as literal asterisks and brackets:

    <aside>

    A note with *emphasis* and a [link](@/hello-world.md).

    </aside>

    <details>
    <summary>show the derivation</summary>

    Markdown works normally in here.

    </details>

That is a CommonMark rule, not a Zola one: a raw HTML block ends at the first
blank line, and only what comes after it is parsed as Markdown.

The whole visual design is one fenced block at the top of templates/base.html
(YOUR DESIGN ... END DESIGN): edit the tokens there, or hand the block to an LLM
and ask for a different look. Because templates/ is script-owned, paste the
result back into render_base_html in the setup script and re-run — editing
templates/base.html directly works until the next run and then does not.

## Email subscription

A static site can't send mail, so subscription is a plain form that POSTs to a
newsletter provider you control. Off by default. To turn it on:

1. Make an account with a provider that offers a plain HTML (no-JS) form — e.g.
   Buttondown, Mailchimp, or EmailOctopus — and create a list.
2. Copy that provider's form-POST URL and the email field name (usually "email";
   Mailchimp uses "EMAIL").
3. Set the matching variables at the top of the setup script and re-run:

       ENABLE_SUBSCRIBE=true
       SUBSCRIBE_ACTION="PASTE_THE_POST_URL"
       SUBSCRIBE_FIELD="email"

   config.toml is script-owned and rewritten on every run, so editing it there
   would not survive.

The URL must be https. Setup refuses a plaintext one, because the form carries
reader email addresses. Turning subscription on also widens the page's
form-action policy to exactly that URL; with subscription off, no form on the
site can submit anywhere.

The form appears at the foot of the home page. On submit the reader is taken to
the provider's confirmation page in a new tab; the provider handles opt-in and
delivery.

## What this site does and does not do about privacy

Nothing here loads from anywhere but your own domain. There is no JavaScript, no
analytics, no font CDN, no embeds, and the Content-Security-Policy in
templates/base.html enforces that rather than merely intending it — a
third-party image is blocked before the request is made, so no other party ever
sees a reader's address. Outbound links and the page itself send no referrer.

Two things follow that are easy to get wrong:

- Embedding a YouTube video, a CDN image, or a hosted comment widget means
  widening that policy, and widening it hands your readers to whoever you
  embedded. That is a real trade, not a formality.
- Nothing on the site is unlisted. The sitemap and the feed enumerate every
  page, so an unlinked post is public, just harder to stumble on.

And one thing outside this repo's reach: GitHub Pages logs visitor IP addresses.
Everything above is about third parties, not about your host.
EOF
}

# Vars: BASE_URL, BLOG_NAME, SITE_*, *_CODE_THEME, SOURCE_URL, HISTORY_URL,
# HISTORY_HINT, FOOTER_*, FORGE_NAME, FORGE_URL. Post ordering lives in
# content/_index.md (sort_by), not here.
render_site_config() {
    local burl title_e desc auth langv lightt darkt surl hurl hhint fx fnostr fname furl
    local sub_action sub_field sub_blurb masthead_v
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
    fx=$(toml_escape "$FOOTER_X_URL")
    fnostr=$(toml_escape "$FOOTER_NOSTR_URL")
    fname=$(toml_escape "$FORGE_NAME")
    furl=$(toml_escape "$FORGE_URL")
    sub_action=$(toml_escape "$SUBSCRIBE_ACTION")
    sub_field=$(toml_escape "$SUBSCRIBE_FIELD")
    sub_blurb=$(toml_escape "$SUBSCRIBE_BLURB")
    cat << EOF
base_url = "${burl}"
title = "${title_e}"
description = "${desc}"
author = "${auth}"
default_language = "${langv}"

generate_feeds = ${GENERATE_FEEDS}
feed_filenames = ["atom.xml"]
minify_html = true

taxonomies = [
    { name = "tags", feed = true },
]

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
# Masthead — what fills the band beside the nav: "text" (the wordmark alone, in
# Charter), "none" (nav only), or "image" (static/logo.svg, masked and painted
# in the masthead text colour, so one file serves light and dark). The favicon
# is a separate job with its own source; see static/favicon.svg.
masthead = "${masthead_v}"

# Dark for everyone (false) or dark-unless-the-reader-asks-for-light (true).
# Read by templates/base.html, which writes the light palette only when true.
light_theme = ${LIGHT_THEME}

# Per-post furniture (the setup script explains each).
show_toc = ${SHOW_TOC}
show_history_link = ${SHOW_HISTORY_LINK}
show_suggest_edit = ${SHOW_SUGGEST_EDIT}

# Reader links to each post's file on your host. Set by --github; empty for a
# local blog, and only shown when the toggles above are true.
source_url = "${surl}"
history_url = "${hurl}"
history_hint = "${hhint}"

# Email subscription — see README.md "Email subscription".
enable_subscribe = ${ENABLE_SUBSCRIBE}
subscribe_action = "${sub_action}"
subscribe_field = "${sub_field}"
subscribe_blurb = "${sub_blurb}"

# The masthead wordmark is itself a link to "/", so a "home" item here would be
# the same link twice on every page. Add one back if you set masthead = "none".
header_nav = [
    { name = "about", url = "/about/" },
    { name = "tags", url = "/tags/" },
    { name = "rss", url = "/atom.xml" },
]

footer_links = [
    { name = "x", url = "${fx}" },
    { name = "nostr", url = "${fnostr}" },
    { name = "${fname}", url = "${furl}" },
]
EOF
}

# Vars: PAGINATE_BY. Home sorts newest-first by updated-or-published date and
# paginates.
render_home_index() {
    cat << EOF
+++
title = "home"
sort_by = "update_date"
paginate_by = ${PAGINATE_BY}
+++
EOF
}

# content/pages/ — the shape for a page that should exist and be linkable but
# not appear on the home page or in the feed. It is a section, and the two keys
# are both load-bearing:
#
#   render = false      no /pages/ index is built; only the pages inside it are.
#   sort_by = "none"    a page in a DATE-SORTED section with no date is dropped
#                       by Zola with a warning and no HTML file — while its URL
#                       still goes into sitemap.xml. That is why a dateless file
#                       at the content root does not work and this does.
#
# Written once, then yours. ./build refuses to finish if any page was dropped.
render_unlisted_index() {
    cat << 'EOF'
+++
title = "pages"
# See the setup script's render_unlisted_index for why these two keys are here.
# Drop a .md file in this folder with a title and no date: it builds at
# /pages/<slug>/, is linkable from anywhere, and is listed on no index page.
# It is not private — sitemap.xml still names it. Unlisted is not hidden.
sort_by = "none"
render = false
+++
EOF
}

# About is a section (dateless), rendered by section.html. Vars: ABOUT_INTRO,
# ABOUT_EMAIL.
render_about() {
    cat << EOF
+++
title = "about"
[extra]
# Your photo. Two keys, because they behave differently:
#   avatar_photo — a raster photo (jpg/png/webp) colocated in this folder, named
#     RELATIVE TO content/: avatar_photo = "about/me.jpg" for a me.jpg sitting
#     beside this _index.md. resize_image() has no per-page lookup, so a bare
#     "me.jpg" is not found and fails the build. Zola resizes it at build
#     time, and resizing discards all EXIF, XMP and IPTC metadata — which is the
#     point. A photo copied straight from a phone into static/ publishes its GPS
#     coordinates, device and capture time, at full resolution, looking exactly
#     like this placeholder. Prefer this key.
#   avatar — an SVG or an already-clean image in static/. Zola copies static/
#     verbatim, so whatever metadata is in the file is what gets published.
# avatar_photo wins when both are set.
avatar_photo = ""
avatar = "avatar.svg"
+++

## who

${ABOUT_INTRO}

## what i write about

a sentence or two on the kinds of things you post here.

## contact

email: ${ABOUT_EMAIL}
EOF
}

# Markdown style reference; demonstrates the updated-date bump (published two
# days ago, updated today, so it sorts to the top). Vars: TWO_DAYS_AGO, TODAY.
render_hello_world() {
    cat << EOF
+++
title = "hello world"
date = ${TWO_DAYS_AGO}
updated = ${TODAY}
[taxonomies]
tags = ["writing", "meta"]
+++

Lorem ipsum dolor sit amet[^1], consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.

This blog links to its own pages with Zola's internal-link syntax, here is [the second post](@/second-post.md), and to the wider web with ordinary Markdown links, like [the Zola documentation](https://www.getzola.org). Both kinds are explained in the guide.

This post carries an \`updated\` field, so the header shows both a publish date and a "last updated" date. The home page sorts by updated-or-published date and shows that same date, so editing a post and bumping its \`updated\` field pulls it back to the top; leave \`updated\` off for a minor fix and the post keeps its place. The newer/older links at the foot of a post walk that same order.

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

Ordered with nesting:

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

Images reference files in \`static/\`, which Zola serves at the site root:

![layered gray mountain silhouettes with a faint sun behind them](/demo.svg)

The file above is \`static/demo.svg\`. Replace or delete it.

[^1]: This is the footnote definition. Zola adds a back-reference link so readers can return to where they were.
EOF
}

# Vars: YESTERDAY. Companion post; target of the internal link above.
render_second_post() {
    cat << EOF
+++
title = "second post"
date = ${YESTERDAY}
[taxonomies]
tags = ["writing"]
+++

A short companion post. It exists to give the newer/older navigation at the foot of every post somewhere to point, and to be the target of the internal link in the hello-world post.

Unlike hello-world, this post has no \`updated\` field, so its header shows only a publish date.

Delete this file when you start writing your own posts.
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

# Vars: FAVICON_MARK. A bare letterform on a transparent ground — no plate, ink
# in the palette's --fg, swapping to the dark ink under prefers-color-scheme.
# The plate this used to draw printed as a stray grey letter (the UA drops
# backgrounds), and read as a second, differently-set mark beside the wordmark.
#
# The face is a fallback stack and cannot be Charter: a favicon is fetched as an
# image, and an image never loads an @font-face, whatever its font-family says.
# A 16px glyph is the one place on this site where that is tolerable.
#
# Size and baseline follow the mark's length so each fills the square rather
# than floating in it: one character sits large and centred, three sit smaller.
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


# Vars: LIGHT_THEME. The avatar sits ON the page, so it follows the site rather
# than the reader's OS: on a dark-only site a light-OS reader would otherwise get
# a #f4f2e8 square on a #111 about page. The favicon deliberately keeps its media
# query — that one lives in the browser's tab bar, which is chrome and does
# follow the OS.
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
Self-hosted Charter (free, ~28KB/weight) is this blog's serif.

Download the four WOFF2 from https://practicaltypography.com/charter.html
and drop them in THIS folder (static/fonts/) with these exact names:

    charter_regular.woff2
    charter_italic.woff2
    charter_bold.woff2
    charter_bold_italic.woff2

Until they are present the site falls back through Palatino, Noto Serif,
Liberation Serif and Georgia, and how that reads depends on which of those the
reader actually has. Measured in a 42rem column at the shipped body size:
Charter gives about 79 characters per line, Palatino 76, DejaVu Serif 68, and a
Times-metric fallback such as Liberation Serif about 85 — the last being wider
than any classical measure recommends. On a stock Linux desktop that last case
is the likely one, so install the fonts rather than treat the fallback as
finished.
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
    {#- The policy is omitted under `zola serve` and only there. script-src
        'none' blocks the livereload.js that serve injects, so with the meta tag
        present on every page the local preview never reloaded and every save
        needed a manual refresh — the one feature the preview exists for.
        `zola serve` rewrites base_url to the loopback address it is listening
        on, which is what this tests; a built site never matches, so what
        deploys is unchanged.

        frame-ancestors is omitted on purpose: browsers ignore it in a <meta>
        element, and GitHub Pages cannot set response headers, so there is no
        arrangement in which it does anything here except log a console warning
        on every page load. form-action is spelled out because it is one of the
        few directives that does NOT fall back to default-src; without it the
        policy places no constraint at all on where a form may submit. -#}
    {% if not config.base_url is starting_with(pat="http://127.0.0.1") and not config.base_url is starting_with(pat="http://localhost") %}
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action {% if config.extra.enable_subscribe and config.extra.subscribe_action %}{{ config.extra.subscribe_action }}{% else %}'none'{% endif %}">
    {% endif %}
    <meta name="referrer" content="no-referrer">
    {%- if config.description %}
    <meta name="description" content="{{ config.description }}">
    {%- endif %}
    <title>{% block title %}{{ config.title }}{% endblock %}</title>
    <link rel="icon" href="{{ get_url(path='favicon.svg') }}" type="image/svg+xml">
    {% if config.generate_feeds %}
    <link rel="alternate" type="application/atom+xml" title="RSS" href="{{ get_url(path='atom.xml') }}">
    {% endif %}
    {% block head_extra %}{% endblock %}
    <style>
    /* ===================================================================
       YOUR DESIGN — copy everything down to END DESIGN and hand it to an LLM
       ("restyle this to X"). It sets the fonts, colours, sizes, and the look of
       headings, links, code, and quotes. The layout under STRUCTURE reads these
       tokens, so it follows along — leave it unless you're changing plumbing.
       =================================================================== */

    /* Fonts: self-hosted, base_url-safe. Drop the four woff2 in static/fonts/
       (see static/fonts/README.txt); a Palatino/Noto/Liberation serif renders
       until they are present. */
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_regular.woff2') }}") format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_italic.woff2') }}") format("woff2");font-weight:400;font-style:italic;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_bold.woff2') }}") format("woff2");font-weight:700;font-style:normal;font-display:swap}
    @font-face{font-family:"Charter";src:url("{{ get_url(path='fonts/charter_bold_italic.woff2') }}") format("woff2");font-weight:700;font-style:italic;font-display:swap}

    /* Dark is the palette, not the alternative. With light_theme false the light
       half below is not written at all and color-scheme is a bare "dark", so the
       site looks the same to every reader whatever their OS is set to. */
    :root {
        color-scheme: {% if config.extra.light_theme %}light dark{% else %}dark{% endif %};
        --serif: "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;
        --mono: ui-monospace,"DejaVu Sans Mono","Liberation Mono",Menlo,Consolas,monospace;
        --bg: #111;
        --fg: #e8e6da;
        --muted: #aaa8a0;
        --link: #e8e6da;
        --accent: #ffb454;             /* inline code; the one colour on the page */
        --code-bg: #242420;            /* table headers and the subscribe button; NOT
                                          code blocks — the highlighter paints those
                                          inline and an inline style always wins.
                                          A step above the page: #1b1b18 does not
                                          part from it */
        --inline-bg: #2b281f;          /* inline code sits in running text and needs
                                          to read against the page and the line */
        --inline-border: #3a382f;
        --border: #2c2c28;             /* hairline: boxes, tables, small separators */
        --border-strong: #42423c;      /* the weight that carries a heading rule */
        --mark-bg: rgba(255, 255, 255, 0.09);
        --measure: 42rem;              /* line length */
        --wide: 62rem;                 /* ceiling for .wide pages and .bleed elements */
        --body-size: 1.2rem;
        --body-leading: 1.55;
        --wordmark-size: 1.5em;        /* the masthead name, and the logo box beside
                                          it in image mode — both track this. 1.5em
                                          is 80% of --h1-size: present without
                                          competing with a post title */
        --h1-size: 2.25rem;
        --h2-size: 1.55rem;
        --h3-size: 1.2rem;
        --hairline: 1px solid var(--border-strong); /* under H1/H2, hr, section titles;
                                          set 'none' to drop every one of them */
    }
{%- if config.extra.light_theme %}
    @media (prefers-color-scheme: light) {
        :root {
            --bg: #fffff8;
            --fg: #111;
            --muted: #57564e;
            --link: #111;
            --accent: #b5540a;
            --code-bg: #f4f2e8;
            --inline-bg: #ece3cd;
            --inline-border: #e0d8c2;
            --border: #e5e3d7;
            --border-strong: #c2bda4;
            --mark-bg: rgba(0, 0, 0, 0.06);
        }
    }
{%- else %}
    /* Giallo writes color-scheme: light dark INLINE on every <pre>, and
       light-dark() resolves against the element's own value, so an inline
       declaration beats the "dark" inherited from :root — a reader on a light
       OS would get the light code theme on a dark page. An important author
       declaration does beat a normal inline one, which is why this needs it. */
    pre { color-scheme: dark !important; }
{%- endif %}

    html { background: var(--bg); }   /* paint on html only — no two-tone seam in dark mode */
    /* Three rows — masthead, content, footer — with the middle one taking the
       slack, so the footer sits on the bottom of the window on a page too short
       to fill it instead of floating halfway up. 100dvh, not 100vh: on a phone
       vh includes the browser chrome and pushes the footer out of sight. The
       4rem is this element's own top and bottom margin. */
    body {
        font-family: var(--serif);
        font-size: var(--body-size);
        line-height: var(--body-leading);
        color: var(--fg);
        max-width: var(--measure);
        margin: 2rem auto;
        padding: 0 1rem;
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: calc(100dvh - 4rem);
    }
    /* Two ways out of the column, both opt-in from Markdown.
       .wide  — page-level: <div class="wide" hidden></div> anywhere in a post
                widens the whole page, running text included.
       .bleed — element-level: class="bleed" on one figure, table, or div lets
                that element use the extra width while the text stays on the
                measure. Masthead and footer stay on the measure too.
       Both in one post: .bleed wins, and the text column stays narrow. */
    body:has(.wide), body:has(.bleed) { max-width: var(--wide); }
    body:has(.bleed) > header,
    body:has(.bleed) > footer,
    body:has(.bleed) main > :not(.bleed) {
        box-sizing: border-box; max-width: var(--measure); margin-inline: auto;
    }
    main > .bleed { margin-inline: 0; }   /* UA stylesheets give <figure> 40px side margins */

    a, a:visited { color: var(--link); text-decoration: underline; text-underline-offset: 2px; }

    main h1, main h2, main h3, main h4, main h5, main h6 { font-weight: bold; line-height: 1.18; }
    /* Margins in em of the heading's own size, so the rhythm holds whatever the
       reader's base font size is and means the same thing here as in the mdBook
       theme, which rebases rem to 10px and cannot share rem figures with this. */
    main h1 { font-size: var(--h1-size); margin: 0.7em 0 0.4em; padding-bottom: 0.3em; border-bottom: var(--hairline); }
    main h2 { font-size: var(--h2-size); margin: 1.2em 0 0.34em; padding-bottom: 0.3em; border-bottom: var(--hairline); }
    main h3 { font-size: var(--h3-size); margin: 1.18em 0 0.29em; }
    main h4 { font-size: 1rem; margin: 1.4em 0 0.3em; }
    main h5 { font-size: 0.95rem; margin: 1.3em 0 0.3em; }
    main h6 { font-size: 0.9rem; margin: 1.1em 0 0.3em; color: var(--muted); }

    :not(pre) > code { font-family: var(--mono); font-size: 0.88em; color: var(--accent); background: var(--inline-bg); border: 1px solid var(--inline-border); padding: 0.05em 0.3em; border-radius: 2px; }
    /* No user-select: all. It selects the element atomically — any selection that
       touches the block expands to the whole block — so a reader cannot lift one
       identifier, one command line, or a fragment running from the prose into the
       code. It bought one-click whole-snippet copying on a site with no copy
       button; partial selection is the more common act on a prose blog.
       No background or colour here either: Giallo writes both inline on the <pre> and
       on every token span, as light-dark() pairs, and an inline style beats any
       selector. A background declared here would be a dead token pretending to
       be a knob. The code-block ground is the highlighting theme's, set by
       LIGHT_CODE_THEME / DARK_CODE_THEME; the frame below is ours. */
    pre { font-family: var(--mono); border: 1px solid var(--border); border-radius: 4px; padding: 1rem; overflow-x: auto; margin: 1rem 0; font-size: 0.95rem; line-height: 1.45; }
    pre code { font-family: var(--mono); font-weight: normal; background: none; padding: 0; }
    code { font-weight: inherit; }

    /* No italic: a multi-paragraph quote set in Charter italic at this size is
       heavy, and italic is already carrying subtitles, dates, and labels. */
    blockquote { margin-block: 1.15rem; padding-inline-start: 1rem; border-inline-start: 3px solid var(--border); color: var(--muted); }
    main small { font-size: 0.82em; color: var(--muted); }
    main aside { font-size: 0.82em; color: var(--muted); border-inline-start: 2px solid var(--border); padding-inline-start: 1em; margin-block: 1.15rem; }

    hr { border: none; border-block-start: var(--hairline); margin-block: 2.5rem; }
    /* =================================================================== END DESIGN
       STRUCTURE — layout & components. Reads the tokens above; recolour or
       re-font up top and this follows. Edit with care.
       =================================================================== */

    /* No rule. The two pieces of site chrome bracketing the content are separated
       the same way: the footer is held apart by whitespace and by being centred
       and muted, and so is this. A rule here also put a second hairline on every
       post page, 450px above the one that closes the title-and-dates block, and
       two rules doing different jobs that close together read as one job done
       twice. The tagline is bound to the wordmark by proximity instead. */
    .site-head { padding-bottom: 1rem; margin-bottom: 2rem; }
    /* space-between: brand on the measure's left edge, nav on its right, one
       line. When the two wrap onto separate lines each is alone on its line and
       falls back to flush left, which is what a narrow screen wants anyway.
       With masthead = "none" there is no brand, and the nav is alone and left.
       align-items: center, not baseline. The two sit ~500px apart at different
       sizes, and on a shared baseline the larger one's caps start higher — a
       1.5em wordmark beside a 1em nav offsets them by 7.7px, which reads as a
       mistake rather than as typography. Centring more than halves it. */
    .masthead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem 1.4rem; }
    /* A strapline under the nameplate, not a paragraph of content: it belongs to
       the head block and sits tight above its rule. Home page only — repeated
       over every post it would compete with the post's own title. */
    .tagline { color: var(--muted); font-style: italic; font-size: 0.9em; line-height: 1.35; margin: 0.45rem 0 0; }
    /* The wordmark is text, not an image. An SVG loaded through <img> renders
       with external resource loading disabled, so it can never use the webfont
       however its font-family is written — it would always be some other face
       sitting beside a wordmark that is correctly in Charter. As text the
       question does not arise.
       align-items:baseline, not center: with an image as first flex item the
       container exported the image's bottom edge as its baseline and pushed the
       nav 7.5px below the wordmark. */
    /* The size lives here, not on .brand-name, so the wordmark and the logo box
       beside it in image mode are both 1em of the same value and cannot drift. */
    .brand { display: inline-flex; align-items: center; gap: 0.45rem; text-decoration: none; color: var(--fg); font-size: var(--wordmark-size); }
    .brand-name { font-weight: bold; font-size: 1em; }
    /* Screen-reader-only: keeps an element in the accessibility tree and out of
       the picture. Used for the home page's h1, which the masthead duplicates. */
    .visually-hidden { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
{%- if config.extra.masthead == "image" %}
    /* static/logo.svg is an ALPHA MASK painted in the masthead text colour, so
       one flat silhouette on a transparent ground serves light and dark alike.
       A file with its own background masks the whole box solid instead. The
       mask URL is fetched under img-src, which the policy already allows for
       same-origin files. */
    .brand .logo { display: inline-block; width: 1em; height: 1em; align-self: center;
        background-color: currentColor;
        -webkit-mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat;
                mask: url("{{ get_url(path='logo.svg') }}") center / contain no-repeat; }
{%- endif %}
    .masthead nav { margin: 0; }
    nav a, nav a:visited { color: var(--muted); margin-right: 1em; text-decoration: none; }
    /* Scoped to the masthead: elsewhere the trailing margin is invisible, and
       zeroing it globally would reach the toc and the prev/next footer. */
    .masthead nav a:last-child { margin-right: 0; }
    nav a.current { font-weight: bold; text-decoration: underline; }

    time, .last-updated, .post-list .date { color: var(--muted); font-style: italic; font-size: 0.9em; }
    /* A deck under the title, not a caption: full body size. */
    .subtitle { color: var(--muted); font-style: italic; line-height: 1.35; margin: 0.2rem 0 2rem 0; }
    h1 + time, h1 + .subtitle { display: block; margin-top: 0; }

    .avatar { display: block; width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border); margin: 0 0 1.5rem; }

    /* One rule, and it closes the head block — title AND dates — rather than
       cutting between them. The h1 rule plus this one plus the toc's put three
       hairlines in the first 400px of every post. */
    main h1.post-title { border-bottom: none; padding-bottom: 0; margin-bottom: 0.25em; }
    .post-meta { padding-bottom: 0.8rem; margin-bottom: 1.5rem; border-bottom: var(--hairline); }
    .post-meta a, .post-meta a:visited { color: var(--muted); text-decoration: underline dotted; text-underline-offset: 3px; }
    .post-meta .sep { margin: 0 0.7em; }

    sup.footnote-reference { font-size: 0.75em; }
    sup.footnote-reference a, sup.footnote-reference a:visited { text-decoration: none; }
    /* Zola wraps bottom footnotes in <section class="footnotes"><ol class="footnotes-list">.
       It was a <footer> in 0.20 and these rules used to say "main > footer"; 0.21.0
       ("fix footnotes semantic organization for accessibility") changed it, and the
       rules quietly matched nothing from then on — a build succeeds either way, so
       nothing in the check chain noticed. Matching on the section class and a plain
       descendant ol keeps this to one Zola-owned name and survives a wrapper being
       added to page.html. */
    main .footnotes { margin-top: 3rem; padding-top: 0.5rem; border-top: 1px solid var(--border); font-size: 0.8em; color: var(--muted); }
    main .footnotes ol { padding-inline-start: 2.5em; margin: 0; }
    main .footnotes p { margin: 0.3rem 0; }
    /* The 0.3rem earns its keep between notes; on the first one it just stacks on
       the padding above. Zero it there so the block starts where the padding ends. */
    main .footnotes li:first-child > p:first-child { margin-block-start: 0; }
    /* A post that ends with --- puts an <hr> immediately before this section, so the
       reader gets two rules a margin apart separating nothing. Drop the hr rather
       than this block's border: the hr is --border-strong with its own 2.5rem
       margins, so keeping it instead would change the block's spacing depending on
       how the post happened to end. */
    main hr:has(+ .footnotes) { display: none; }
    /* --link equals --fg in both palettes, so a citation link or a backref inside a
       muted note would be the brightest thing in it. Links here are signalled by the
       underline, which survives the mute. */
    main .footnotes a, main .footnotes a:visited { color: var(--muted); }

    .giallo-l { display: inline-block; min-height: 1lh; width: 100%; }
    .giallo-ln { display: inline-block; user-select: none; margin-right: 0.4em; padding: 0.4em; min-width: 3ch; text-align: right; opacity: 0.8; }
    pre mark { background: var(--mark-bg); color: inherit; padding: 0.05em 0.2em; border-radius: 2px; }

    main table { border-collapse: collapse; margin: 1rem 0; width: 100%; }
    main th, main td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
    main th { background: var(--code-bg); font-weight: bold; }

    .subscribe { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: baseline; }
    .subscribe label { flex: 1 1 100%; color: var(--muted); font-style: italic; font-size: 0.9em; }
    .subscribe input { font: inherit; flex: 1 1 220px; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 3px; background: var(--bg); color: var(--fg); }
    .subscribe button { font: inherit; padding: 0.35rem 0.9rem; border: 1px solid var(--border); border-radius: 3px; background: var(--code-bg); color: var(--fg); cursor: pointer; }
    .subscribe button:hover { border-color: var(--muted); }

    .post-list { list-style: none; padding-inline-start: 0; }
    .post-list li { margin-bottom: 0.5rem; }
    .post-list .tags { color: var(--muted); font-size: 0.8em; font-style: italic; }
    .post-list .tags a, .post-list .tags a:visited { color: var(--muted); text-decoration: none; }

    /* The "tags:" label is plain muted text; the tags themselves are links, and
       without a resting mark nothing separates the two. Dotted underline is this
       sheet's subdued-link idiom (see .post-meta a). It has to be visible at rest,
       not only on hover: on a touch screen there is no hover, so a hover-only
       affordance is no affordance for most readers. Hover then solidifies it. */
    .post-tags { margin-top: 2.75rem; color: var(--muted); font-size: 0.9em; }
    .post-tags a, .post-tags a:visited { color: var(--muted); text-decoration: underline dotted; text-underline-offset: 3px; }
    .post-tags a:hover { text-decoration: underline; }

    .tag-list { list-style: none; padding-inline-start: 0; }
    .tag-list li { margin-bottom: 0.4rem; }
    .tag-list a, .tag-list a:visited { text-decoration: none; }
    .tag-list .count { color: var(--muted); font-size: 0.85em; }

    .pager { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; color: var(--muted); font-size: 0.9em; }
    .pager a, .pager a:visited { color: var(--muted); text-decoration: none; }
    .pager a:hover { text-decoration: underline; }
    .pager .disabled { opacity: 0.4; }
    .pager .pager-pos { font-style: italic; }

    .section-title { padding-bottom: 0.9rem; margin-bottom: 1.4rem; border-bottom: var(--hairline); }

    /* One disclosure treatment, shared by the TOC and by any <details> an author
       writes into a post. The triangle is the only affordance either has;
       cursor:pointer alone is invisible until the pointer is already on it. */
    details > summary { cursor: pointer; color: var(--muted); font-style: italic; list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
    details > summary::before { content: "\25B8\A0"; }
    details[open] > summary::before { content: "\25BE\A0"; }
    main > details:not(.toc) { margin-block: 1.5rem; }

    .toc { margin: 1.5rem 0 2.2rem; padding: 0; font-size: 0.85em; }
    .toc nav { margin-top: 0.6rem; }
    .toc ul { list-style: none; margin: 0; padding: 0; }
    .toc nav > ul > li { margin: 0.25rem 0; }
    .toc ul ul { padding-left: 1.4em; }
    .toc li { line-height: 1.45; }
    .toc a, .toc a:visited { color: var(--muted); text-decoration: none; }
    .toc a:hover { color: var(--fg); text-decoration: underline; }

    :target { scroll-margin-top: 5rem; }
    main h2:target, main h3:target, main h4:target,
    main h5:target, main h6:target { border-inline-start: 3px solid var(--muted); padding-inline-start: 0.6rem; margin-inline-start: -0.9rem; }

    .post-nav { margin-top: 2.5rem; padding-top: 0.8rem; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; gap: 0.9rem; }
    /* Shrinking this gap alone left the tags nearer the notes above them than the
       rule below, so they still read as belonging upward. The fix is the ratio, not
       the number: more air above the tags, less below, and they group with the block
       they sit on. Scoped to the adjacency because a post with no tags puts .post-nav
       straight after the body, where 1.5rem would be too tight. */
    .post-tags + .post-nav { margin-top: 1.5rem; }
    .post-nav a, .post-nav a:visited { color: var(--muted); text-decoration: none; }
    .post-nav a:hover { text-decoration: underline; }
    .post-nav .label { color: var(--muted); font-style: italic; font-size: 0.9em; margin-right: 0.5em; }
    .post-nav-newer, .post-nav-older { flex: 1 1 250px; }
    .post-nav-newer { text-align: left; }
    .post-nav-older { text-align: right; }

    body > footer { margin-top: 4rem; padding-top: 1rem; text-align: center; color: var(--muted); }
    body > footer a, body > footer a:visited { color: var(--muted); margin: 0 0.4em; text-decoration: none; }

    /* No fixed back-to-top control. Below about 857px of viewport a chip pinned
       to the bottom-right corner sits ON the text column — measured at 768, 414
       and 390px — and it cannot be hidden until the reader scrolls, because that
       needs script and this site has none. Above that width it floats alone in
       the margin, the only unanchored object on the page. Home, the browser's own
       top-of-page gesture, and .post-nav at the foot of the post all already do
       the job. scroll-behavior stays: it serves the contents list and the
       footnote links. */
    @media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }

    /* prefers-color-scheme still reports dark when printing, so without this a
       reader in dark mode prints #e8e6da text onto white paper: the UA drops the
       background and keeps the colour. */
    @media print {
        :root, :root * { --bg: #fff; --fg: #000; --muted: #333; --link: #000;
            --accent: #000; --code-bg: #fff; --inline-bg: #fff;
            --inline-border: #ccc; --border: #bbb; --border-strong: #888; }
        html, body { background: #fff; color: #000; }
        a, a:visited { color: #000; }
        pre { white-space: pre-wrap; }
        /* !important because the highlighter's colours are inline on the <pre>
           and on every span, and the token overrides above cannot reach them.
           Without this a reader whose browser keeps prefers-color-scheme: dark
           while printing gets pale grey code on white paper. */
        pre, pre span { background: #fff !important; color: #000 !important; }
        .masthead nav, .pager, .post-nav, .subscribe, body > footer { display: none; }
        details[open] > summary::before, details > summary::before { content: ""; }
        main > details:not(.toc) > :not(summary) { display: block; }
    }
    </style>
</head>
<body>
    <header class="site-head">
        <div class="masthead">
        {%- if config.extra.masthead != "none" %}
        <a class="brand" href="{{ get_url(path='/') }}">
            {%- if config.extra.masthead == "image" %}<span class="logo" aria-hidden="true"></span>{% endif %}
            <span class="brand-name">{{ config.title }}</span>
        </a>
        {%- endif %}
        <nav>
            {% for item in config.extra.header_nav %}
            {% if current_path and current_path == item.url %}
            <a href="{{ get_url(path=item.url) }}" class="current">{{ item.name }}</a>
            {% else %}
            <a href="{{ get_url(path=item.url) }}">{{ item.name }}</a>
            {% endif %}
            {% endfor %}
        </nav>
        </div>
        {% block masthead_extra %}{% endblock %}
    </header>

    <main>
        {% block content %}{% endblock %}
    </main>

    {% if config.extra.footer_links %}
    <footer>
        {% for link in config.extra.footer_links -%}
        <a href="{{ link.url }}">{{ link.name }}</a>{% if not loop.last %} · {% endif %}
        {%- endfor %}
    </footer>
    {% endif %}
</body>
</html>
EOF
}

# Flat post list: date + title + tags. Takes a pages array so the home
# (paginator.pages) and a tag page (term.pages) share it.
#
# The date shown is updated-or-published, which is the field content/_index.md
# sorts on (sort_by = "update_date"). Printing page.date here instead gave a
# list ordered by one field and labelled with another, so a revised post sat at
# the top of the page showing an older date than the post beneath it.
render_components() {
    cat << 'EOF'
{#- Tera v2 component, not a macro: macros were removed in Zola 0.23. Components
    are registered globally from any template file, so nothing imports this. -#}
{% component post_list(pages) %}
<ul class="post-list">
{% for page in pages %}
{% if page.date %}
<li>
    <span class="date">{{ (page.updated or page.date) | date(format="%Y-%m-%d") }}</span>
    <a href="{{ page.permalink }}">{{ page.title }}</a>
    {% if page.taxonomies.tags %}<span class="tags">{% for tag in page.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</span>{% endif %}
</li>
{% endif %}
{% endfor %}
</ul>
{% endcomponent post_list %}

{#- The subscribe form, defined once and called from the home page, every post,
    and every section. It used to live inline in index.html, which meant a reader
    arriving at a post from a link — most readers — never saw it.

    `extra` is a parameter rather than a global because Tera v2 components are
    hygienic: `config` is not visible inside one, and referring to it is a build
    error rather than an empty string. -#}
{% component subscribe(extra) %}
{% if extra.enable_subscribe and extra.subscribe_action %}
<form class="subscribe" method="post" action="{{ extra.subscribe_action }}" target="_blank" rel="noopener">
<label for="sub-email">{{ extra.subscribe_blurb }}</label>
<input id="sub-email" type="email" name="{{ extra.subscribe_field }}" required placeholder="you@example.com" autocomplete="email">
<button type="submit">subscribe</button>
</form>
{% endif %}
{% endcomponent subscribe %}
EOF
}

# Home: paginated post list plus a newer/older pager.
render_index_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ config.title }}{% endblock %}

{#- The description sits in the head block, tight above its rule, so it reads as
    a strapline under the nameplate rather than as an orphan line of content
    floating between the masthead and the first post. -#}
{% block masthead_extra %}{% if config.description %}<p class="tagline">{{ config.description }}</p>{% endif %}{% endblock %}

{% block content %}
{#- The masthead already carries the wordmark, so a visible <h1> here is the
    same words twice within 40px. Hidden rather than deleted: the page keeps
    exactly one h1 for the document outline and for a screen reader. -#}
<h1 class="visually-hidden">{{ config.title }}</h1>

{{<post_list pages={paginator.pages} />}}

{% if paginator.number_pagers > 1 %}
<nav class="pager">
{% if paginator.previous %}<a href="{{ paginator.previous }}">&larr; newer</a>{% else %}<span class="disabled">&larr; newer</span>{% endif %}
<span class="pager-pos">page {{ paginator.current_index }} / {{ paginator.number_pagers }}</span>
{% if paginator.next %}<a href="{{ paginator.next }}">older &rarr;</a>{% else %}<span class="disabled">older &rarr;</span>{% endif %}
</nav>
{% endif %}

{{<subscribe extra={config.extra} />}}
{% endblock %}
EOF
}

# Post: meta, optional table of contents, body, tags, then newer/older via
# Zola's built-in adjacent pages.
#
# Labelled "newer"/"older", matching the pager on the home page, and wired to the
# neighbour each label names. Zola fills page.lower and page.higher from the same
# sorted array it fills section.pages from (sort_pages, one call per section), and
# date and update_date both sort DESCENDING. So in a newest-first list page.lower
# is the entry above — the NEWER post — and page.higher is the entry below, the
# OLDER one. An earlier comment here claimed the two follow the publish date while
# the home page follows updated-or-published; they cannot diverge, there is only
# one array, and under sort_by = "update_date" both follow update date.
#
# The home fallback rides the newer slot, so it shows on the newest post — the one
# most readers land on — rather than on the oldest.
render_page_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ page.title }} | {{ config.title }}{% endblock %}

{#- The no-JavaScript equivalent of a keyboard next/previous binding. No
    mainstream browser still binds keys to these, but readers, extensions and
    crawlers use them, and they cost two lines and no script. -#}
{% block head_extra %}
{% if page.higher %}<link rel="next" href="{{ page.higher.permalink | safe }}">{% endif %}
{% if page.lower %}<link rel="prev" href="{{ page.lower.permalink | safe }}">{% endif %}
{% endblock %}

{% block content %}
<h1 class="post-title">{{ page.title }}</h1>
{% if page.date %}
{% set pub_date = page.date | date(format="%Y-%m-%d") %}
{% set rev_date = "" %}
{% if page.updated %}{% set rev_date = page.updated | date(format="%Y-%m-%d") %}{% endif %}
<div class="post-meta">
<time datetime="{{ pub_date }}">{{ pub_date }}</time>{% if rev_date and rev_date != pub_date %}<span class="sep">·</span><time datetime="{{ rev_date }}" class="last-updated">last updated, {{ rev_date }}</time>{% endif %}
{% if config.extra.show_history_link and config.extra.history_url and page.relative_path %}<span class="sep">·</span><a class="history" href="{{ config.extra.history_url }}/{{ page.relative_path }}"{% if config.extra.history_hint %} title="{{ config.extra.history_hint }}"{% endif %}>view history</a>{% endif %}
{% if config.extra.show_suggest_edit and config.extra.source_url and page.relative_path %}<span class="sep">·</span><a class="source" href="{{ config.extra.source_url }}/{{ page.relative_path }}">suggest an edit</a>{% endif %}
</div>
{% endif %}

{% if config.extra.show_toc and page.date and page.toc %}
<details class="toc">
<summary>contents</summary>
<nav aria-label="contents">
<ul>
{% for h in page.toc %}
<li><a href="{{ h.permalink | safe }}">{{ h.title }}</a>
{%- if h.children %}<ul>{% for c in h.children %}<li><a href="{{ c.permalink | safe }}">{{ c.title }}</a></li>{% endfor %}</ul>{%- endif %}
</li>
{% endfor %}
</ul>
</nav>
</details>
{% endif %}

{{ page.content | safe }}

{% if page.taxonomies.tags %}
<div class="post-tags">tags: {% for tag in page.taxonomies.tags %}<a href="{{ get_taxonomy_url(kind='tags', term=tag) }}">{{ tag }}</a>{% if not loop.last %} · {% endif %}{% endfor %}</div>
{% endif %}

{% if page.date %}
<nav class="post-nav">
{% if page.lower %}<div class="post-nav-newer"><a href="{{ page.lower.permalink }}"><span class="label">&larr; newer:</span>{{ page.lower.title }}</a></div>
{% else %}<div class="post-nav-newer"><a href="{{ get_url(path='/') }}"><span class="label">&larr; back to:</span>home</a></div>{% endif %}
{% if page.higher %}<div class="post-nav-older"><a href="{{ page.higher.permalink }}"><span class="label">older:</span>{{ page.higher.title }} &rarr;</a></div>{% endif %}
</nav>
{% endif %}

{{<subscribe extra={config.extra} />}}
{% endblock %}
EOF
}

# Section page (about). Renders title + body; the post list is only reached if a
# section has dated pages.
render_section_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ section.title }} | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">{{ section.title }}</h1>
{% if section.extra?.avatar_photo %}
{% set av = resize_image(path=section.extra.avatar_photo, width=240, height=240, op="fill") %}
<img class="avatar" src="{{ av.url }}" width="120" height="120" alt="">
{% elif section.extra?.avatar %}<img class="avatar" src="{{ get_url(path=section.extra.avatar) }}" width="120" height="120" alt="">{% endif %}
{% if section.content %}{{ section.content | safe }}{% endif %}
{% if section.pages %}{{<post_list pages={section.pages} />}}{% endif %}
{{<subscribe extra={config.extra} />}}
{% endblock %}
EOF
}

# /tags/ — every tag with a count.
render_taxonomy_list() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}tags | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">tags</h1>
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

{% block title %}posts tagged: {{ term.name }} | {{ config.title }}{% endblock %}

{% block content %}
<h1 class="section-title">posts tagged: {{ term.name }}</h1>
<p class="subtitle">{{ term.page_count }} post{% if term.page_count != 1 %}s{% endif %} &nbsp;·&nbsp; <a href="{{ get_url(path='/tags/') }}">&larr; all tags</a></p>
{{<post_list pages={term.pages} />}}
{% endblock %}
EOF
}

render_404_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}404 | {{ config.title }}{% endblock %}

{% block content %}
<h1>404</h1>
<p>this page isn't here. it may have moved, or the URL may be wrong.</p>
<p>
    <a href="{{ get_url(path='/') }}">home</a>
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
    {#- %FT%T%:z, not %+. Tera v2 moved the date filter onto jiff, which does not
        implement the %+ specifier; RFC 3339 has to be spelled out. Atom requires
        RFC 3339, so this is load-bearing rather than cosmetic. -#}
    <generator uri="https://www.getzola.org/">Zola</generator>
    <updated>{{ last_updated | date(format="%FT%T%:z") }}</updated>
    <id>{{ feed_url | safe }}</id>
    {#- RFC 4287 4.1.1: a feed MUST carry an author unless every entry does.
        page.authors comes only from a front-matter `authors` key, which no post
        here sets, so without this the feed had none at all. -#}
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
        {%- if page.summary %}
        <summary type="html">{{ page.summary }}</summary>
        {%- else %}
        <content type="html">{{ page.content }}</content>
        {%- endif %}
    </entry>
    {%- endif %}
    {%- endfor %}
</feed>
EOF
}

# Vars: CI_ZOLA_VERSION (baked). GitHub Actions ${{...}} is escaped \${{...}}; \$
# escapes leave runner-shell vars for the runner. Official actions pinned by
# commit SHA (trailing # vN is the tag those SHAs point to).
render_github_workflow() {
    cat << EOF
name: Deploy to GitHub Pages

on:
  push:
    branches: [main, master]
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
    # Pinned like the action SHAs and the Zola version: the runner image is the
    # last input that could shift under an otherwise-green build. Bump when
    # 24.04 is retired.
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: Build with Zola ${CI_ZOLA_VERSION} (pinned)
        run: |
          set -euo pipefail
          url="https://github.com/getzola/zola/releases/download/${CI_ZOLA_VERSION}/zola-${CI_ZOLA_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
          curl -fsSL --proto '=https' --tlsv1.2 -o zola.tar.gz "\$url"
          # The digest recorded by setup for these exact bytes. A version tag
          # names a file, not its contents. No fallback and no skip: a build that
          # cannot verify its builder should fail, not publish.
          echo "${ZOLA_SHA256}  zola.tar.gz" | sha256sum -c -
          tar xzf zola.tar.gz
          # Same guard as ./build: a page dropped for having no date in a
          # date-sorted section still gets its URL written into sitemap.xml,
          # and zola exits 0. Publishing that means pointing crawlers at a 404.
          out=\$(./zola build 2>&1); printf '%s\n' "\$out"
          if printf '%s\n' "\$out" | grep -q 'page(s) ignored'; then
            echo "::error::pages were dropped but sitemap.xml still lists their URLs; give them a date or move them to content/pages/"
            exit 1
          fi
      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
        with:
          path: public
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
EOF
}

# =============================================================================
# Entry point (guarded so the file can be sourced to unit-test a render_*)
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````