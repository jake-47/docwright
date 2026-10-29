<div class="mdb-wide"></div>

# Bootstrap-zola script

The script below scaffolds a Zola blog, installs and version-pins the Zola binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. For details, see [Publish a blog](./publish-blog.md).

````bash
#!/usr/bin/env bash
# zola-blog-setup, v110
#
# Bootstraps a Zola 0.23 blog for GitHub Pages at PROJECT_DIR/BLOG_NAME, and
# keeps it in step with the configuration block below. Re-running is the update
# path: the script-owned files are regenerated, content/ is never touched (in
# book mode, book/ is never touched, and content/ is made from it). Each
# run takes the newest Zola 0.23 release that has been out a week (with
# KEEP_PINS, the one the workflow pins), puts it in ZOLA_DIR if it isn't there,
# its download checked against GitHub's digest, and pins it in the workflow.
#
#   bash zola-blog-setup.sh                  # create or update the blog
#   KEEP_PINS=true bash zola-blog-setup.sh   # the same, keeping the releases the
#                                            # workflow pins
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

# true: pages from an outline, book/SUMMARY.md, as mdBook builds a book, and
# no posts (guide: "Book mode"). Needs GENERATE_FEEDS and ENABLE_TAGS false.
readonly BOOK_MODE=false

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

# The command that started this run, for messages that say what to type next:
# the same path works again from the folder the run started in.
printf -v SELF_CMD 'bash %q' "${BASH_SOURCE[0]}"
readonly SELF_CMD

## ─── releases ─────────────────────────────────────────────────────────
# No release is named here. Each run asks GitHub for the newest Zola release in
# ZOLA_SERIES and, with GIT_REPO_URL, the newest release of each of the
# workflow's three actions, and takes one only once it has been out this many
# days (most hijacked releases are found and pulled within a week). It checks a
# download against the SHA-256 GitHub computed when it was uploaded, installs
# that Zola for every blog on this computer, and pins the release, its Linux
# file's digest and each action's commit in the workflow, where CI checks them
# again. For an action the wait counts from its release, and the commit is the
# one its tag names on the day: a run that pins that tag refuses a moved one, a
# first run takes it as it finds it.
readonly RELEASE_WAIT_DAYS=7
# The templates are Tera v2 (components, keyword tests, strict undefined, no %+
# date), written for Zola 0.23; before 0.23.3 Zola doesn't publish a redirecting
# section's files, which content/attachments/ is: the build passes and every
# picture is missing. A newer series is said, not taken: a build that passes
# doesn't prove the templates still render right (0.23.5 changed what the date
# filter prints). Move both only after porting the templates.
readonly ZOLA_SERIES="0.23"
readonly ZOLA_FLOOR="0.23.3"
# For one run, in front of the command: true keeps every release the workflow
# pins as it pins it, and looks up only what it doesn't pin. Read here, not in
# the configuration block, so a block pasted from an older version still runs.
readonly KEEP_PINS="${KEEP_PINS:-false}"

## ─── shared state (set per invocation) ────────────────────────────────
OS=""
ARCH=""
TMP_ZOLA=""
NEW_ZOLA=""          # install_zola's folder in ZOLA_DIR, while it's there
GITHUB_REPO=""
IS_UPDATE=""
ZOLA_VERSION=""      # the release this run installs and pins: vX.Y.Z
ZOLA_SHA256=""       # GitHub's digest for its Linux file, which the workflow pins
LOCAL_DIGEST=""      # GitHub's for this computer's file; "" when not asked
ZOLA_DIR=""          # where every blog's zola goes: ~/.local/bin (~/bin in Git Bash)
ZOLA_BIN=""
LOCAL_ASSET=""       # this computer's file and the workflow's, {tag} for the tag
LINUX_ASSET="zola-{tag}-x86_64-unknown-linux-gnu.tar.gz"
CHECKOUT_USES=""     # actions/checkout@<commit> # <tag>, for the workflow
UPLOAD_USES=""
DEPLOY_USES=""
KEPT=""
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
README_KEPT=""

cleanup_tmp() {
    [ -n "$TMP_ZOLA" ] && rm -rf "$TMP_ZOLA"
    [ -n "$NEW_ZOLA" ] && rm -rf "$NEW_ZOLA"
    return 0
}

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
# One subcommand. Anything else is an error, never a folder named after a typo.
main() {
    # git as the blog's folder has it, whatever a terminal points it at
    # (GIT_DIR=~/.dotfiles, say): the first commit and origin are the blog's.
    # GIT_CONFIG too: git config reads only the file it names.
    unset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CONFIG
    case "${1:-}" in
        "")              cmd_setup ;;
        help|-h|--help)  cmd_help ;;
        update-zola)     die_usage "update-zola is gone: every run installs the newest Zola it takes, so $SELF_CMD on its own updates it. nothing has been changed." ;;
        *)               die_usage "unknown command: $*. the script takes help, or nothing; everything else is a setting in the block at the top ($SELF_CMD help)" ;;
    esac
}

# =============================================================================
# help
# =============================================================================
cmd_help() {
    say "zola-blog-setup — bootstraps a minimal Zola blog."
    cat <<'EOF'

  bash zola-blog-setup.sh              create or update PROJECT_DIR/BLOG_NAME
                                       from the configuration block, and
                                       install the Zola it takes (with
                                       GIT_REPO_URL, the one the workflow pins)
  bash zola-blog-setup.sh help         this list (also -h and --help)

For one run, in front of the command:
  START_PREVIEW=false          skip the live preview
  REGENERATE_TEMPLATES=true    overwrite script-owned files edited by hand
  KEEP_PINS=true               keep the releases the workflow pins

Everything else is a setting in the configuration block. Guide:
zola-blog-guide.md.
EOF
}

# =============================================================================
# Platform detection
# =============================================================================
# The platform, and from it this computer's file of a Zola release and where
# every blog's zola goes. zola publishes no Windows build for arm64: there, the
# x86_64 one, which Windows 11 runs on arm64 (runs_here checks that it runs).
detect_platform() {
    OS=$(detect_os)
    ARCH=$(detect_arch)
    [ "$OS" = "unknown" ] && die "unsupported OS (uname -s: $(uname -s 2>/dev/null))"
    [ "$ARCH" = "unknown" ] && die "unsupported architecture (uname -m: $(uname -m 2>/dev/null))"
    case "${OS}_${ARCH}" in
        linux_x86_64)  LOCAL_ASSET="zola-{tag}-x86_64-unknown-linux-gnu.tar.gz" ;;
        linux_aarch64) LOCAL_ASSET="zola-{tag}-aarch64-unknown-linux-gnu.tar.gz" ;;
        macos_x86_64)  LOCAL_ASSET="zola-{tag}-x86_64-apple-darwin.tar.gz" ;;
        macos_aarch64) LOCAL_ASSET="zola-{tag}-aarch64-apple-darwin.tar.gz" ;;
        windows_*)     LOCAL_ASSET="zola-{tag}-x86_64-pc-windows-msvc.zip" ;;
    esac
    if [ "$OS" = windows ]; then
        ZOLA_DIR="$HOME/bin" ZOLA_BIN="$HOME/bin/zola.exe"
    else
        ZOLA_DIR="$HOME/.local/bin" ZOLA_BIN="$HOME/.local/bin/zola"
    fi
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
    check_sudo
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
    [ ! -e "$BLOG_DIR" ] || die "'$BLOG_DIR' exists but holds no config.toml; move it aside or point BLOG_NAME somewhere else. nothing has been changed."
    lookup_releases
    resolve_host_config
    resolve_dates
    install_zola
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
    build_site
    start_preview_server
}

# Re-run: regenerate the script-owned files from the configuration block;
# content/ is left alone.
run_update_mode() {
    say "found an existing blog in $BLOG_DIR"
    IS_UPDATE=1
    # The tools, then the drift check, before anything is looked up, installed or
    # downloaded, so their "nothing has been changed" is true; the update is
    # announced once they pass, so no stop follows the announcement.
    check_required_tools
    enter_existing_target
    check_book_folder
    check_blog_writable
    check_owned_file_drift
    check_menu_pages
    if [ "$BOOK_MODE" = true ]; then
        say "updating the script-owned files; book/ is left untouched, and content/ is made from it."
    else
        say "updating the script-owned files; content/ is left untouched."
    fi
    say ""
    lookup_releases
    resolve_host_config
    install_zola
    write_owned_files
    warn_placeholders
    update_git_remote
    say ""
    say "updated."
    build_site
    start_preview_server
}

enter_existing_target() {
    cd "$BLOG_DIR" || die "could not enter blog folder '$BLOG_DIR'"
}

# BOOK_MODE switched on for a site with no book/: a blog (its config.toml says
# book = false), which can't become a book, or a book whose book/ has gone.
# Said as what it is, before the menu check would blame MENU_PAGES. Only on a
# re-run: a first run writes book/ itself.
check_book_folder() {
    [ "$BOOK_MODE" = true ] && [ ! -d book ] || return 0
    if grep -q '^book = true' config.toml 2>/dev/null; then
        die "BOOK_MODE is true, but $BLOG_DIR/book/, the folder that holds the pages, is gone. put it back, from your repository if it's committed, then run this again. nothing has been changed."
    fi
    die "BOOK_MODE is true, but $BLOG_DIR was made as a blog: it has no book/, and a blog can't become a book (guide: \"A blog can't become a book\"). for a book, set BLOG_NAME to a new folder; to update this blog, set BOOK_MODE=false. nothing has been changed."
}

# A run as root (sudo, su, doas) on a blog, or a ZOLA_DIR, that isn't root's
# (sudo -E and su -m keep HOME, or PROJECT_DIR names the user's folder) leaves
# files of root's there that the owner's next run can't write: public/, which
# every build makes again, the whole blog on a first run, ZOLA_DIR when the run
# made it. Nothing here needs root. Each folder, or the nearest one above it
# that's there; -O, since stat takes other options on a Mac.
check_sudo() {
    [ "$EUID" -eq 0 ] || return 0
    local d p
    for d in "$BLOG_DIR" "$ZOLA_DIR"; do
        p=$d
        while [ ! -e "$p" ]; do p=$(dirname "$p"); done
        [ -O "$p" ] || die "this run is root's, and $p isn't: it would leave files of root's there that a run as its owner couldn't write. nothing here needs root: run this as the user who owns $p, without sudo. nothing has been changed."
    done
}

# A path from the blog's folder (or from /), physically: through every symlink
# on the way, as chown -R and chmod -R, given the blog's folder, follow none
# inside it. A symlink is read, not entered, so one to a folder this user can't
# enter is named too; ./ in front, or an exported CDPATH could take cd elsewhere.
physical() {
    local p=$1 l n=0
    case "$p" in /*) ;; *) p=./$p ;; esac
    while p=${p%/} && [ -L "$p" ] && [ "$n" -lt 40 ]; do
        l=$(readlink -- "$p") || return 1
        case "$l" in /*) p=$l ;; *) p=${p%/*}/$l ;; esac
        n=$((n + 1))
    done
    if [ -d "$p" ] && l=$(cd -P -- "$p" 2>/dev/null && pwd -P); then
        printf '%s\n' "$l"
    else
        l=$(cd -P -- "${p%/*}/" 2>/dev/null && pwd -P) || return 1
        printf '%s/%s\n' "${l%/}" "${p##*/}"
    fi
}

# Whether this user can read all of $1: a file, or a folder (or a symlink to
# one) and everything in it. find fails at a folder it can't read; a symlink in
# it is left out, as one that leads nowhere no chown can fix.
all_readable() {
    local p=$1
    [ ! -d "$p" ] || p=$p/
    find "$p" ! -type l -exec sh -c 'for f do if [ -d "$f" ]; then [ -r "$f" ] && [ -x "$f" ]; else [ -r "$f" ]; fi || exit 1; done' sh {} + >/dev/null 2>&1
}

# A script-owned file, the manifest or a folder they're in that this run can't
# read or write (a blog made with sudo, or by another user) would stop it
# partway, with only awk's or the shell's error: said first, before anything is
# looked up, installed or written.
check_blog_writable() {
    local path fn bad=() at=() up gd="" said refused="" listed="" gitout="" out=() top o q
    [ -w . ] || { bad+=("$BLOG_DIR itself"); at+=(.); }
    # public/: the build deletes it and makes it again; a symlink there it
    # replaces, which takes only the blog's folder. static/processed_images/:
    # resize_image writes there whenever a photo changes.
    for path in templates static static/processed_images .github/workflows public; do
        [ "$path" != public ] || [ ! -L public ] || continue
        [ ! -d "$path" ] || [ -w "$path" ] || { bad+=("$path/"); at+=("$path"); }
    done
    # .github/workflows/ made in a .github/ that's there already
    [ -z "$GIT_REPO_URL" ] || [ -d .github/workflows ] || [ ! -d .github ] || [ -w .github ] || { bad+=(".github/"); at+=(.github); }
    while read -r path fn; do
        [ -e "$path" ] || continue
        # Yours once edited, and then only read.
        if [ "$path" = README.md ] && [ -r README.md ] && { [ ! -f "$OWNED_MANIFEST" ] || [ -r "$OWNED_MANIFEST" ]; } \
            && readme_is_yours; then continue; fi
        if ! { [ -r "$path" ] && [ -w "$path" ]; }; then bad+=("$path"); at+=("$path")
        # write_owned_files makes these executable, which only their owner (or
        # root) can do.
        else case $path in serve|build|new|attach|genbook) [ -x "$path" ] || [ -O "$path" ] || [ "$EUID" -eq 0 ] || { bad+=("$path"); at+=("$path"); } ;; esac
        fi
    done < <(owned_files; printf '%s -\n' "$OWNED_MANIFEST")
    # update_git_remote writes the config in the blog's git folder (.git, or the
    # one a .git file names: a worktree's or a submodule's), and git won't work in
    # a repository another user owns ("dubious ownership"): its reason, said.
    if [ -n "$GIT_REPO_URL" ] && [ -e .git ] && command -v git >/dev/null 2>&1; then
        if ! git --git-dir=.git rev-parse --git-common-dir >/dev/null 2>&1 && ! all_readable .git; then
            # Something in it this user can't read, which git, named the .git
            # outright, takes for no repository, and its search passes by for
            # one around the blog: another user's .git closed to others (as
            # sudo leaves one under a umask of 077 or 027), the user's own
            # with files of root's a sudo git command left in it, or one closed
            # with chmod. The chown and chmod below give it back.
            said=$(git --git-dir=.git rev-parse --git-common-dir 2>&1 >/dev/null | grep -m 1 . | sed 's/^fatal: //' || true)
            bad+=(".git/ (git: $said)") gd=.git listed=1
        # A .git git can't take for a repository (one emptied by hand) leaves the
        # repository the blog sits in, whose origin update_git_remote would set.
        # Asked with ownership set aside (safe.directory, for rev-parse alone, whose
        # answer is all that's used, so nothing in that repository runs), so the
        # one around the blog is found when it's another user's too: from git 2.38,
        # which reads safe.directory from -c; before, the stop below names the .git.
        # --show-cdup is empty at the top of a work tree, so no paths are compared
        # (Git Bash's are C:/…); the folder is named from the physical one, as git
        # counts from it, not through a symlink to the blog's.
        elif up=$(git -c safe.directory='*' rev-parse --show-cdup 2>/dev/null) && [ -n "$up" ]; then
            die "$BLOG_DIR/.git isn't a repository git can read, so git takes the blog for part of the one at $(cd -P -- "$up" && pwd -P). nothing has been changed. move $BLOG_DIR/.git aside (an empty one can go), then run this again."
        elif gd=$(git rev-parse --git-common-dir 2>/dev/null); then
            [ -w "$gd" ] || bad+=("${gd%/}/") listed=1
        # Named outright (--git-dir), a repository isn't checked for its owner by
        # any git, and -c safe.directory is read only from git 2.38: this names
        # the repository git refuses.
        elif gd=$(git --git-dir=.git rev-parse --git-common-dir 2>/dev/null); then
            said=$(git rev-parse --git-common-dir 2>&1 >/dev/null | grep -m 1 . | sed 's/^fatal: //' || true)
            bad+=("${gd%/}/ (git: $said)") refused=1 listed=1
        else
            # All of it readable, and still no repository: a .git emptied by
            # hand, or naming one that's moved or gone.
            said=$(git --git-dir=.git rev-parse --git-common-dir 2>&1 >/dev/null | grep -m 1 . | sed 's/^fatal: //' || true)
            die "$BLOG_DIR/.git isn't a repository git can read (git: $said). nothing has been changed. move $BLOG_DIR/.git aside (an empty one can go), or fix what git says, then run this again."
        fi
        # The repository's own folder, outside the blog's: a worktree's, a
        # submodule's, or the one a .git symlink names.
        if [ -n "$listed" ]; then
            at+=("$gd")
            o=$(physical "$gd") && case "$o/" in "$(pwd -P)"/*) ;; *) gitout=$o ;; esac
        fi
    fi
    [ "${#bad[@]}" -eq 0 ] && return 0
    warn "this run rewrites these in $BLOG_DIR, and can't read or write them:"
    for path in "${bad[@]}"; do warn "  - $path"; done
    warn "a run with sudo, or as another user, may have made them. nothing has been changed."
    if [ "$OS" = windows ] && [ -n "$refused" ]; then
        # git checks the owner, not the permissions.
        warn "make them writable for you, and the repository yours: git refuses one it takes for another user's, whatever its permissions (on a USB drive formatted FAT32 or exFAT, which records no owner, or a network folder, git config --global --add safe.directory with the folder git names lets git use it). then run this again."
    elif [ "$OS" = windows ]; then
        warn "make them writable for you, then run this again."
    elif [ "$EUID" -eq 0 ]; then
        # git's refusal of another user's repository, which chown to root would
        # only move.
        if [ -n "$refused" ]; then
            warn "this run is root's: run this as the user who owns ${gitout:-$BLOG_DIR/.git}."
        else
            warn "this run is root's, and root can't write them either: a read-only filesystem, a file marked immutable, or a network folder or container that treats root as another user does that. fix that, then run this again."
        fi
    else
        # The folder itself, not a symlink to it, and each listed path that
        # leads outside it (a symlinked folder, a repository elsewhere):
        # chown -R changes a symlink, not what it points to, and follows none
        # inside the folder.
        top=$(pwd -P)
        printf -v q '%q' "$top"
        for path in "${at[@]}"; do
            o=$(physical "$path") || continue
            case "$o/" in "$top"/*) continue ;; esac
            for fn in ${out[@]+"${out[@]}"}; do case "$o/" in "$fn"/*) continue 2 ;; esac; done
            out+=("$o")
            printf -v q '%s %q' "$q" "$o"
        done
        warn "make them yours and writable (sudo chown -R \"\$(id -un)\" $q && chmod -R u+rwX $q does that), then run this again."
    fi
    exit 1
}

# The script-owned set as "path render_function" pairs: the one list the writer,
# the manifest and the drift check all read. The last four are conditional on
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
    [ "$BOOK_MODE" = true ] && printf '%s\n' "genbook render_genbook"
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
    local path fn recorded actual drifted=() no_manifest="" again
    [ -f "$OWNED_MANIFEST" ] || no_manifest=1
    while read -r path fn; do
        [ -f "$path" ] || continue
        [ "$path" = README.md ] && continue   # yours once edited: readme_is_yours
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
    again="REGENERATE_TEMPLATES=true $SELF_CMD"
    [ "$KEEP_PINS" != true ] || again="KEEP_PINS=true $again"
    warn "they are script-owned: change the matching render_* function or a configuration"
    warn "variable rather than the file. to overwrite them anyway, run once with"
    warn "    $again"
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
        if [ "$path" = README.md ] && [ -n "$README_KEPT" ]; then continue; fi
        # A file that can't be hashed is left out; dropping the whole manifest would
        # make every file look edited on the next run.
        digest=$(sha256_of "$path") || { warn "could not hash $path; leaving it out of $OWNED_MANIFEST"; continue; }
        printf '%s  %s\n' "$digest" "$path" >> "$OWNED_MANIFEST"
    done < <(owned_files)
    return 0
}

# README.md turns into yours once you edit it: nothing builds from it, so keeping
# an edited one can't break the site or hold back a fix, and it's the page GitHub
# shows for the repository, where people edit it. Yours: there, and not the bytes
# the manifest says this script last wrote, or not in the manifest at all, or
# with no manifest to tell (kept, and said), under REGENERATE_TEMPLATES too,
# which is for the script's files. Deleting it gets the script's back.
readme_is_yours() {
    [ -f README.md ] || return 1
    [ -f "$OWNED_MANIFEST" ] || return 0
    local actual
    actual=$(sha256_of README.md) || return 1
    [ "$actual" != "$(manifest_sha README.md)" ]
}

write_owned_files() {
    mkdir -p templates static
    local path fn
    while read -r path fn; do
        if [ "$path" = README.md ] && readme_is_yours; then
            README_KEPT=1
            if [ ! -f "$OWNED_MANIFEST" ]; then
                say "README.md was left as it is: with no $OWNED_MANIFEST, this run can't tell an edit from the script's own (delete it to get the script's back)"
            elif [ -n "$(manifest_sha README.md)" ]; then
                say "README.md was edited, so it's yours now: runs leave it alone (delete it to get the script's back)"
            fi
            continue
        fi
        # A path with no slash is its own ${path%/*}; only make a directory when
        # the entry actually names one.
        [ "$path" = "${path%/*}" ] || mkdir -p "${path%/*}"
        "$fn" > "$path"
    done < <(owned_files)
    local f
    for f in serve build new attach genbook; do [ ! -f "$f" ] || [ -x "$f" ] || chmod +x "$f"; done
    # Owned in both directions: clearing the variable that produced a file removes
    # the file, but only if the manifest says these are the bytes this script wrote.
    if [ "$BOOK_MODE" != true ] && [ -f genbook ] && remove_if_ours genbook; then
        say "removed genbook (BOOK_MODE is false)"
    fi
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
    local readme=" README.md," genbook=""
    [ -z "$README_KEPT" ] || readme=""
    [ "$BOOK_MODE" != true ] || genbook=" genbook,"
    say "wrote the script-owned files (config.toml, templates/, serve, build, new, attach,${genbook}${readme} .gitignore)"
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
    validate_bool KEEP_PINS           "$KEEP_PINS"
    validate_bool BOOK_MODE           "$BOOK_MODE"
    # A book's pages have no dates or tags, so the feed and the tags page would
    # be empty, and the menu would still offer them.
    if [ "$BOOK_MODE" = true ]; then
        [ "$GENERATE_FEEDS" != true ] || die "BOOK_MODE is true, and so is GENERATE_FEEDS: a book's pages have no dates, so the feed would be empty. set GENERATE_FEEDS=false (SHOW_RSS_LINK then does nothing). nothing has been changed."
        [ "$ENABLE_TAGS" != true ] || die "BOOK_MODE is true, and so is ENABLE_TAGS: a book's pages have no tags, so the tags page would be empty. set ENABLE_TAGS=false. nothing has been changed."
    fi
    # Atom requires an author on the feed unless every entry has one, and no
    # post sets one (atom.xml): with SITE_AUTHOR empty the feed isn't valid, and
    # a feed reader or email service may refuse it.
    if [ "$GENERATE_FEEDS" = true ] && [ -z "$SITE_AUTHOR" ]; then
        die "GENERATE_FEEDS is true, and SITE_AUTHOR is empty: the feed format requires an author, so the feed wouldn't be valid. set SITE_AUTHOR to your name, or GENERATE_FEEDS=false. nothing has been changed."
    fi
    [ -z "${ZOLA_VERSION_OVERRIDE+x}" ] \
        || die "ZOLA_VERSION_OVERRIDE is gone: each run takes the newest zola $ZOLA_SERIES release out $RELEASE_WAIT_DAYS days, and KEEP_PINS=true keeps the one the workflow pins. unset it and run this again; nothing has been changed."

    # Tera prints a format with no % code as it is, the same text for every date.
    case "$DATE_FORMAT" in
        *%*) ;;
        *) die "DATE_FORMAT needs at least one % code, such as \"%Y-%m-%d\" or \"%-d %B %Y\"; got: '$DATE_FORMAT'" ;;
    esac
    validate_menu_pages
    validate_footer_links
}

# One name per word: content/NAME.md, or a folder's content/NAME/_index.md
# (menu_page_path). base.html looks each one up. In book mode each is a file
# in book/, which has no folders, and genbook writes content/NAME.md from it.
validate_menu_pages() {
    local name names=()
    read -r -a names <<< "$MENU_PAGES"
    [ "${#names[@]}" -gt 0 ] || return 0
    for name in "${names[@]}"; do
        case "$name" in
            /*|*/|.*|*/.*|-*|*..*|*[!A-Za-z0-9._/-]*|*.md|index|*/index|_index|*/_index)
                die "MENU_PAGES takes the names of pages in content/, without .md, separated by spaces, such as \"about now\"; got: '$name'" ;;
        esac
        if [ "$BOOK_MODE" = true ]; then
            case "$name" in
                */*|*[!a-z0-9-]*|-*|*-|*--*|unlisted|attachments)
                    die "in book mode a MENU_PAGES name is a file in book/, book/$name.md, named like a page: lowercase letters and digits with single dashes between them, and not unlisted or attachments; got: '$name'" ;;
            esac
        fi
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
# get_page. Runs before anything is written on a re-run. In book mode the page
# is book/NAME.md, which genbook turns into content/NAME.md, hidden = true and
# all, at every build: content/ may not be there yet (a fresh clone ignores it).
check_menu_pages() {
    local name file names=()
    read -r -a names <<< "$MENU_PAGES"
    [ "${#names[@]}" -gt 0 ] || return 0
    for name in "${names[@]}"; do
        if [ "$BOOK_MODE" = true ]; then
            [ -f "book/$name.md" ] || die "MENU_PAGES names $name, but there's no book/$name.md. make that page first (guide: \"Book mode\"), or take $name out of MENU_PAGES. nothing has been changed."
            continue
        fi
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
    local about=content/about.md
    [ "$BOOK_MODE" != true ] || about=book/about.md
    if [ -f "$about" ] \
       && grep -q -e 'you@yourdomain.com' -e 'Your name. One or two sentences' "$about"; then
        left+=("$about")
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
# Releases: looked up, checked, installed
# =============================================================================
# The ways out to the network, each its own function. GitHub's API allows 60
# requests an hour from one address, and a run makes four (one without
# GIT_REPO_URL); no token is sent or needed, since everything asked is public.
# None of them reads a config file: curl runs with -q (which must come first),
# so ~/.curlrc can't turn TLS checks off, and git ls-remote with no system,
# global or repository config, so no setting can turn its checks off, send it
# elsewhere (url.<base>.insteadOf) or trust another CA. The environment still
# applies: https_proxy, and CURL_CA_BUNDLE and GIT_SSL_CAINFO for a proxy's
# certificate.
github_api() {
    curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 --connect-timeout 30 --max-time 120 \
        -H "Accept: application/vnd.github+json" "https://api.github.com/$1"
}

fetch() {
    curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 --connect-timeout 30 --max-time 900 "$1" -o "$2"
}

# The commit a tag of github.com/$1 names (an annotated tag's, peeled); nothing
# for no such tag, and git's failure, with its own message, when github.com
# can't be asked.
tag_commit() {
    # GIT_DIR names no repository, so no folder's .git applies; HOME and
    # XDG_CONFIG_HOME for a git older than 2.32, which has no GIT_CONFIG_GLOBAL;
    # no askpass program, which a refused request would wait on.
    env -u GIT_SSL_NO_VERIFY -u GIT_CONFIG_COUNT -u GIT_CONFIG_PARAMETERS -u XDG_CONFIG_HOME -u GIT_ASKPASS -u SSH_ASKPASS \
        HOME=/nonexistent GIT_DIR=/nonexistent GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null GIT_TERMINAL_PROMPT=0 \
        git -c http.sslVerify=true -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 ls-remote "https://github.com/$1" "refs/tags/$2" "refs/tags/$2^{}" |
        awk -v t="refs/tags/$2" '$2 == t "^{}" { peeled = $1 } $2 == t { plain = $1 }
            END { print (peeled != "" ? peeled : plain) }'
}

# GitHub's JSON for a list of releases, on stdin, as lines of tab-separated
# fields: "R tag draft prerelease published_at" for each release, then "A tag
# name state created_at updated_at digest" for each of its files, and a last
# line "E" when the input was one well-formed JSON array; exit 1 otherwise. awk,
# not python3, which macOS and Git for Windows don't have; LC_ALL=C, so it reads
# bytes whatever the locale. RS is the double quote, so records alternate between
# text outside strings and a string's contents, and a string goes on past a
# quote with an odd run of backslashes before it. Escapes are left as they are
# (no value used has any: each is checked against a strict pattern before use),
# a control character in a value is printed as "?", and a kept field given as an
# object or an array as its opening bracket. The input must not end in a quote,
# which awk would drop unseen: callers add a newline.
releases_flat() {
    LC_ALL=C awk '
    function fail() { bad = 1; exit 1 }
    function clean(v) { gsub(/[\001-\037\177]/, "?", v); return v }
    function want_value() {
        if (depth == 0) { if (st[0] != "v") fail(); return }
        if (type[depth] == "o") { if (st[depth] != "v") fail() }
        else if (st[depth] != "f" && st[depth] != "v") fail()
    }
    function got_value(v) {
        if (depth == 0) { st[0] = "done"; return }
        if (type[depth] == "o") {
            if (depth == 2 && inrel && (key[2] in wr)) rel[key[2]] = v
            else if (depth == 4 && inasset && (key[4] in wa)) ast[key[4]] = v
        }
        st[depth] = ","
    }
    function opened(c) {
        want_value()
        # Not null: a form this script does not know, which fails every check
        # made of the field.
        if (depth == 2 && inrel && (key[2] in wr)) rel[key[2]] = c
        if (depth == 4 && inasset && (key[4] in wa)) ast[key[4]] = c
        if (depth == 0) st[0] = "in"; else st[depth] = ","
        depth++
        type[depth] = c == "{" ? "o" : "a"
        st[depth] = c == "{" ? "k" : "f"
        if (depth == 1) { if (c != "[") fail(); root = 1 }
        if (depth == 2 && c == "{") { inrel = 1; split("", rel); na = 0 }
        if (depth == 3 && c == "[" && inrel && key[2] == "assets") inassets = 1
        if (depth == 4 && c == "{" && inassets) { inasset = 1; split("", ast) }
    }
    function closed(c,   t, i) {
        t = c == "}" ? "o" : "a"
        if (depth < 1 || type[depth] != t) fail()
        if (st[depth] != (t == "o" ? "k" : "f") && st[depth] != ",") fail()
        if (depth == 4 && inasset) {
            na++; an[na] = ast["name"]; as[na] = ast["state"]; ac[na] = ast["created_at"]
            au[na] = ast["updated_at"]; ad[na] = ast["digest"]; inasset = 0
        }
        if (depth == 3 && inassets) inassets = 0
        if (depth == 2 && inrel) {
            printf "R\t%s\t%s\t%s\t%s\n", clean(rel["tag_name"]), clean(rel["draft"]), clean(rel["prerelease"]), clean(rel["published_at"])
            for (i = 1; i <= na; i++)
                printf "A\t%s\t%s\t%s\t%s\t%s\t%s\n", clean(rel["tag_name"]), clean(an[i]), clean(as[i]), clean(ac[i]), clean(au[i]), clean(ad[i])
            inrel = 0
        }
        depth--
        if (depth == 0) st[0] = "done"
    }
    function literal(   v) {
        v = lit; lit = ""
        if (v != "true" && v != "false" && v != "null" && v !~ /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$/) fail()
        want_value()
        got_value(v == "null" ? "" : v)
    }
    function outside(s,   i, n, c) {
        n = length(s)
        for (i = 1; i <= n; i++) {
            c = substr(s, i, 1)
            if (c ~ /[A-Za-z0-9.+-]/) { lit = lit c; continue }
            if (lit != "") literal()
            if (c == " " || c == "\t" || c == "\n" || c == "\r") continue
            if (c == "{" || c == "[") opened(c)
            else if (c == "}" || c == "]") closed(c)
            else if (c == ":") { if (depth < 1 || type[depth] != "o" || st[depth] != ":") fail(); st[depth] = "v" }
            else if (c == ",") { if (depth < 1 || st[depth] != ",") fail(); st[depth] = type[depth] == "o" ? "K" : "v" }
            else fail()
        }
        if (lit != "") literal()
    }
    # An odd run of backslashes at the end of s: the quote after it is escaped.
    function escaped(s,   n, k) {
        n = length(s); k = 0
        while (n > 0 && substr(s, n, 1) == "\\") { k++; n-- }
        return k % 2
    }
    BEGIN {
        RS = "\""
        split("tag_name draft prerelease published_at", w, " "); for (i in w) wr[w[i]] = 1
        split("name state created_at updated_at digest", w, " "); for (i in w) wa[w[i]] = 1
        st[0] = "v"
    }
    NR == 1 { outside($0); next }
    !instr {
        # A string starts: a key where an object expects one, else a value, kept
        # only when it is one of the fields above.
        if (depth > 0 && type[depth] == "o" && (st[depth] == "k" || st[depth] == "K")) iskey = 1
        else { iskey = 0; want_value() }
        keep = iskey || (depth == 2 && inrel && (key[2] in wr)) || (depth == 4 && inasset && (key[4] in wa))
        buf = keep ? $0 : ""; tail = $0; instr = 1; next
    }
    escaped(tail) { if (keep) buf = buf "\"" $0; tail = $0; next }
    {
        instr = 0
        if (iskey) { key[depth] = buf; st[depth] = ":" } else got_value(buf)
        outside($0)
    }
    END {
        if (bad || instr || depth != 0 || !root || st[0] != "done") exit 1
        print "E"
    }'
}

# From releases_flat's lines on stdin, the highest-numbered stable release tagged
# $1 + x.y.z, published RELEASE_WAIT_DAYS ago or more, with each file in $2
# ({tag} for the tag), each uploaded that long ago too: "tag digest ...", a
# digest per file, "-" for a file GitHub has none for and "?" for one in a form
# this script doesn't know, and after them, when a higher-numbered release out
# that long lacks one of the files or has one uploaded since, its tag and that
# file's name. With $3 (0.23), only that x.y; with $4 (0.23.3), only
# from there. Highest number, not latest date: a fix to an older series can come
# out after the newest release. Nothing when none qualifies; exit 1 when the
# answer wasn't read whole.
pick_release() {
    LC_ALL=C awk -F '\t' -v prefix="$1" -v files="$2" -v series="$3" -v floor="$4" -v cut="$CUTOFF" '
    function num(t,   r) {
        if (index(t, prefix) != 1) return ""
        r = substr(t, length(prefix) + 1)
        if (r !~ /^[0-9]+\.[0-9]+\.[0-9]+$/) return ""
        gsub(/\./, " ", r)
        return r
    }
    function newer(a, b,   x, y, i) {
        split(a, x, " "); split(b, y, " ")
        for (i = 1; i <= 3; i++) if (x[i] + 0 != y[i] + 0) return x[i] + 0 > y[i] + 0
        return 0
    }
    function when(d) { return d ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z$/ }
    function fill(s, t,   i) { while ((i = index(s, "{tag}")) > 0) s = substr(s, 1, i - 1) t substr(s, i + 5); return s }
    function hex(d) { return d == "" ? "-" : length(d) == 71 && substr(d, 1, 7) == "sha256:" && substr(d, 8) ~ /^[0-9a-f]+$/ ? substr(d, 8) : "?" }
    $1 == "R" { tags[++n] = $2; draft[$2] = $3; pre[$2] = $4; pub[$2] = $5; next }
    $1 == "A" { k = $2 SUBSEP $3; state[k] = $4; made[k] = $5; upd[k] = $6; dig[k] = $7; next }
    $1 == "E" { whole = 1 }
    END {
        if (!whole) exit 1
        nf = split(files, want, " ")
        for (i = 1; i <= n; i++) {
            t = tags[i]; v = num(t)
            if (v == "" || draft[t] != "false" || pre[t] != "false" || !when(pub[t]) || pub[t] > cut) continue
            split(v, p, " ")
            if (series != "" && p[1] "." p[2] != series) continue
            if (floor != "" && newer(num(prefix floor), v)) continue
            ok = 1; out = t
            for (j = 1; j <= nf; j++) {
                k = t SUBSEP fill(want[j], t)
                if (!(k in state) || state[k] != "uploaded" || !when(made[k]) || !when(upd[k]) || made[k] > cut || upd[k] > cut) { ok = 0; break }
                out = out " " hex(dig[k])
            }
            if (!ok) { if (passed == "" || newer(v, num(passed))) { passed = t; miss = fill(want[j], t) }; continue }
            if (best == "" || newer(v, num(best))) { best = t; bestout = out }
        }
        if (best == "") exit 0
        if (passed != "" && newer(num(passed), num(best))) bestout = bestout " " passed " " miss
        print bestout
    }'
}

# GitHub's digest now for the file $2 ({tag} for the tag) of the release tagged
# $1, from releases_flat's lines on stdin: its 64 hex digits, "-" when GitHub has
# none, "?" for one in a form this script doesn't know, nothing when the release
# or the file isn't there. With $3, a time as CUTOFF has it: "new" for a file
# GitHub doesn't show as uploaded and last changed by then, which pick_release
# would pass over.
file_digest() {
    LC_ALL=C awk -F '\t' -v tag="$1" -v name="$2" -v cut="${3:-}" '
    function when(d) { return d ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z$/ }
    function fill(s, t,   i) { while ((i = index(s, "{tag}")) > 0) s = substr(s, 1, i - 1) t substr(s, i + 5); return s }
    function hex(d) { return d == "" ? "-" : length(d) == 71 && substr(d, 1, 7) == "sha256:" && substr(d, 8) ~ /^[0-9a-f]+$/ ? substr(d, 8) : "?" }
    $1 == "A" && $2 == tag && $3 == fill(name, tag) && $4 == "uploaded" {
        d = cut != "" && (!when($5) || !when($6) || $5 > cut || $6 > cut) ? "new" : hex($7) }
    $1 == "E" { whole = 1 }
    END { if (!whole) exit 1; if (d != "") print d }'
}

# GitHub's releases of github.com/$1, as releases_flat's lines; exit 2 when
# GitHub can't be asked, 1 when its answer can't be read.
releases_of() {
    local json
    json=$(github_api "repos/$1/releases?per_page=100") || return 2
    printf '%s\n' "$json" | releases_flat || return 1
}

# The workflow's pins from the last run, as "name value [value]" lines: zola (its
# release tag, from the download's address), zola-sha, and each action as
# "actions/x commit tag", the tag "-" for a commit pinned alone or with a
# comment that isn't a release's tag (# v7), whatever the spacing, and a uses:
# written as a step's first key (- uses:) too. A workflow
# edited past recognition pins nothing, and so does one GIT_REPO_URL no longer
# asks for (the run removes it). By its full path: the lookup runs before the cd
# into the blog folder.
pins() {
    local wf="$BLOG_DIR/.github/workflows/deploy.yml"
    [ -n "$GIT_REPO_URL" ] && [ -f "$wf" ] || return 0
    sed -n \
        -e 's|.*/getzola/zola/releases/download/\(v[0-9][0-9.]*\)/zola-v[0-9][0-9.]*-x86_64-unknown-linux-gnu\.tar\.gz".*|zola \1|p' \
        -e 's|^[[:blank:]]*echo[[:blank:]]\{1,\}"\([0-9a-f]\{64\}\)[[:blank:]]\{1,\}\*\{0,1\}zola\.tar\.gz".*|zola-sha \1|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:blank:]]\{1,\}#[[:blank:]]*\(v[0-9]\{1,\}\.[0-9]\{1,\}\.[0-9]\{1,\}\)[[:space:]]*$|\1 \2 \3|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:blank:]]\{1,\}#.*$|\1 \2 -|p' \
        -e 's|^[[:blank:]]*-\{0,1\}[[:blank:]]*uses:[[:blank:]]*\(actions/[a-z-]*\)@\([0-9a-f]\{40\}\)[[:space:]]*$|\1 \2 -|p' \
        "$wf"
}
pin() {
    pins | awk -v k="$1" '$1 == k { $1 = ""; sub(/^ /, ""); print; exit }'
}

# An action's pin ($2, "commit tag" from pins) as the workflow's uses: value for
# github.com/$1; and a uses: value as a run names it: the tag, or the commit for
# one pinned alone.
pin_uses() {
    if [ "${2#* }" = - ]; then printf '%s@%s' "$1" "${2%% *}"; else printf '%s@%s # %s' "$1" "${2%% *}" "${2#* }"; fi
}
uses_name() {
    local c=${1##*@}
    case "$1" in *" # "*) printf '%s' "${1##*# }" ;; *) printf 'commit %s' "${c:0:12}" ;; esac
}

# The hint for a lookup GitHub didn't answer: in full the first time, then "as
# above" (when one fails, the others usually do too).
NET_SAID=""
PIN_OFFERED=""
net_hint() { if [ -n "$NET_SAID" ]; then printf 'as above'; else printf '%s' "$LIMIT_HINT"; fi; }
readonly LIMIT_HINT="no network (behind a proxy, set https_proxy: ~/.curlrc isn't read), a proxy refusing api.github.com (its 403 reads like GitHub's), or GitHub's limit of 60 requests an hour from one address, which a shared one (an office, a VPN) can use up: try again within the hour"
readonly DL_HINT="no network (behind a proxy, set https_proxy: ~/.curlrc isn't read), a proxy refusing github.com or release-assets.githubusercontent.com, where github.com sends release downloads, or, with a 404, the release pulled or its file removed: a run that can ask GitHub, without KEEP_PINS, takes another"

# True when release $1 is numbered higher than $2, both vX.Y.Z (or X.Y.Z): in
# awk, since sort -V isn't in the sort older macOS ships.
newer_than() {
    awk -v a="${1#v}" -v b="${2#v}" 'BEGIN {
        n = split(a, x, "."); m = split(b, y, ".")
        for (i = 1; i <= (n > m ? n : m); i++) if (x[i] + 0 != y[i] + 0) exit !(x[i] + 0 > y[i] + 0)
        exit 1 }'
}

# True for x.y.z in ZOLA_SERIES, from ZOLA_FLOOR on.
in_series() {
    local p=${1#"$ZOLA_SERIES".}
    [ "$p" != "$1" ] || return 1
    case "$p" in ""|*[!0123456789]*) return 1 ;; esac
    [ "$p" -ge "${ZOLA_FLOOR#"$ZOLA_SERIES".}" ]
}

installed_zola_version() {
    [ -x "$ZOLA_BIN" ] || return 0
    "$ZOLA_BIN" --version 2>/dev/null | awk 'NR == 1 { print $2 }' || true
}

# The Zola release this run installs and pins: the newest that qualifies
# (pick_release), with this computer's file and, with GIT_REPO_URL, the Linux
# file the workflow downloads. If GitHub can't be asked, the workflow's pin, or,
# without one, on a blog with no workflow, the zola installed. Whichever it
# takes, the release the workflow pins must still have the Linux file it pinned:
# a file replaced this week fails the wait, and the run would otherwise drop back
# a release without a word. Sets ZOLA_VERSION, ZOLA_SHA256 and LOCAL_DIGEST.
lookup_zola() {
    local flat rc=0 got ptag psha now files shown newest passed="" pmiss="" stays="" inst
    ptag=$(pin zola) psha=$(pin zola-sha)
    files=$LOCAL_ASSET
    [ -z "$GIT_REPO_URL" ] || [ "$LOCAL_ASSET" = "$LINUX_ASSET" ] || files="$LOCAL_ASSET $LINUX_ASSET"
    shown=${files//\{tag\}/vX.Y.Z}; shown=${shown/ / and }
    flat=$(releases_of getzola/zola) || rc=$?
    if [ "$rc" -eq 2 ]; then
        # A version pinned without its digest (the line deleted after a refusal)
        # leaves nothing to check a download against: as on a first run, then.
        if [ -n "$ptag" ] && [ -n "$psha" ]; then
            warn "could not look up getzola/zola's releases ($(net_hint)): keeping zola $ptag, which the workflow pins"
            NET_SAID=1
            ZOLA_VERSION=$ptag ZOLA_SHA256=$psha
            [ "$LOCAL_ASSET" != "$LINUX_ASSET" ] || LOCAL_DIGEST=$psha
            return 0
        fi
        inst=$(installed_zola_version)
        if [ -z "$GIT_REPO_URL" ] && [ -n "$inst" ] && in_series "$inst"; then
            warn "could not look up getzola/zola's releases ($(net_hint)): keeping zola $inst, installed in $ZOLA_DIR"
            NET_SAID=1
            ZOLA_VERSION=v$inst
            return 0
        fi
        die "could not look up getzola/zola's releases ($LIMIT_HINT). nothing has been changed; run this again later."
    fi
    [ "$rc" -eq 0 ] || die "could not read GitHub's answer about getzola/zola's releases. nothing has been changed; run this again later."
    # The release the workflow pins first: a run refused says nothing else, and a
    # file replaced is refused even when no release qualifies.
    if [ -n "$ptag" ] && [ -n "$psha" ]; then
        now=$(printf '%s\n' "$flat" | file_digest "$ptag" "$LINUX_ASSET") \
            || die "could not read GitHub's answer about getzola/zola's releases. nothing has been changed; run this again later."
        if [ -n "$now" ] && [ "$now" != - ] && [ "$now" != "?" ] && [ "$now" != "$psha" ]; then
            die "GitHub's digest for zola $ptag's Linux file is $now, but the workflow pins $psha for it: the file has changed since it was pinned. nothing has been changed. check the release's page on GitHub before trusting it. to go on, delete the line with $psha from .github/workflows/deploy.yml, then run this again with REGENERATE_TEMPLATES=true in front (the hand-edit check would stop at the workflow): zola is then looked up as on a first run."
        fi
    fi
    # Whether GitHub still offers the release the workflow pins as one a run
    # could take (stable, out the wait, its files up that long): only then do
    # unknown_form and runs_here offer KEEP_PINS.
    if [ -n "$ptag" ] && [ -n "$psha" ] && [ -n "$(printf '%s\n' "$flat" | awk -F '\t' -v t="$ptag" '$1 == "E" || $2 == t' | pick_release v "$files" "$ZOLA_SERIES" "$ZOLA_FLOOR")" ]; then
        PIN_OFFERED=1
    fi
    got=$(printf '%s\n' "$flat" | pick_release v "$files" "$ZOLA_SERIES" "$ZOLA_FLOOR") \
        || die "could not read GitHub's answer about getzola/zola's releases. nothing has been changed; run this again later."
    [ -n "$got" ] || die "no stable zola $ZOLA_SERIES release from $ZOLA_FLOOR on with $shown has been out $RELEASE_WAIT_DAYS days yet. nothing has been changed."
    # Only to say so: a newer series is never taken.
    newest=$(printf '%s\n' "$flat" | pick_release v "$files" "" "") || newest=""
    [ -z "$newest" ] || [ "${newest%% *}" = "${got%% *}" ] \
        || stays="zola ${newest%% *} is out, but this script's templates are written for zola $ZOLA_SERIES: using ${got%% *}"
    if [ "$files" = "$LOCAL_ASSET" ]; then
        read -r ZOLA_VERSION LOCAL_DIGEST passed pmiss <<< "$got"
        [ -z "$GIT_REPO_URL" ] || ZOLA_SHA256=$LOCAL_DIGEST
    else
        read -r ZOLA_VERSION LOCAL_DIGEST ZOLA_SHA256 passed pmiss <<< "$got"
    fi
    [ -z "$stays" ] || say "$stays"
    # A newer release without the files, or with one uploaded again since: said,
    # or a renamed file would hold every run at the last release with the old
    # name. The pinned release passed over is said below.
    if [ -n "$passed" ] && { [ "$passed" != "$ptag" ] || [ -z "$psha" ]; }; then
        warn "zola $passed is out, but has no $pmiss uploaded $RELEASE_WAIT_DAYS days ago or more: using $ZOLA_VERSION. a file uploaded again is taken once it's $RELEASE_WAIT_DAYS days old; if the release names its files differently now, this script needs the new name."
    fi
    # A file from before GitHub made digests has none, and one in a form this
    # script doesn't know can't be checked: for the release the workflow pins,
    # its Linux file's pinned digest; otherwise nothing checks the download.
    if [ "$ZOLA_VERSION" = "$ptag" ] && [ -n "$psha" ] && { [ "$ZOLA_SHA256" = - ] || [ "$ZOLA_SHA256" = "?" ]; }; then
        ZOLA_SHA256=$psha
        [ "$LOCAL_ASSET" != "$LINUX_ASSET" ] || LOCAL_DIGEST=$psha
    fi
    # This computer's file matters only for a download; the Linux file, for the
    # workflow's pin.
    inst=$(installed_zola_version)
    # A blog without a workflow keeps the zola installed, if it's in the series,
    # as when GitHub can't be asked: nothing could check the download.
    if [ "$LOCAL_DIGEST" = "?" ] && [ -z "$GIT_REPO_URL" ] && [ -n "$inst" ] && [ "$inst" != "${ZOLA_VERSION#v}" ] && in_series "$inst"; then
        warn "GitHub gives the digest of zola $ZOLA_VERSION's ${LOCAL_ASSET//\{tag\}/$ZOLA_VERSION} in a form this script doesn't know, so the download couldn't be checked: keeping zola $inst, installed in $ZOLA_DIR"
        ZOLA_VERSION=v$inst LOCAL_DIGEST=""
        return 0
    fi
    [ "$inst" = "${ZOLA_VERSION#v}" ] || unknown_form "$LOCAL_DIGEST" "$LOCAL_ASSET"
    [ -z "$GIT_REPO_URL" ] || unknown_form "$ZOLA_SHA256" "$LINUX_ASSET"
    [ -n "$ptag" ] && [ -n "$psha" ] || return 0
    # The pin passed over (pulled, marked a pre-release, its file removed or
    # uploaded again within the wait): a step back, said.
    if [ "$ZOLA_VERSION" != "$ptag" ] && in_series "${ptag#v}" \
        && newer_than "$ptag" "$ZOLA_VERSION"; then
        warn "the workflow pins zola $ptag, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days (too new, pulled, marked a pre-release, its file removed, or its file uploaded again in the last $RELEASE_WAIT_DAYS days): using $ZOLA_VERSION. if it was pulled or its file removed, zola's releases page or security advisories on GitHub may say why."
    fi
}

# For a stop on ZOLA_VERSION's download, on a re-run: KEEP_PINS as a way on
# when it keeps another release, one GitHub still offers, and gets through with
# it: on Linux x86_64, whose file the workflow pins the digest of; elsewhere,
# with that release installed already.
keep_hint() {
    local pinned
    pinned=$(pin zola)
    if [ "$KEEP_PINS" != true ] && [ -n "$PIN_OFFERED" ] && [ "$pinned" != "$ZOLA_VERSION" ] \
        && { [ "$LOCAL_ASSET" = "$LINUX_ASSET" ] || [ "$(installed_zola_version)" = "${pinned#v}" ]; }; then
        printf ' KEEP_PINS=true keeps zola %s, which the workflow pins.' "${pinned#v}"
    fi
}

# The stop for a digest of file $2 ({tag} for the tag) of ZOLA_VERSION that
# GitHub gives in a form this script doesn't know ("?"): nothing to check the
# download against.
unknown_form() {
    [ "$1" = "?" ] || return 0
    die "GitHub gives the digest of zola $ZOLA_VERSION's ${2//\{tag\}/$ZOLA_VERSION} in a form this script doesn't know, so the download can't be checked. nothing has been changed; a newer version of this script may know the form.$(keep_hint)"
}

# GitHub's digest for this computer's file of ZOLA_VERSION, when the run didn't
# ask about that release (KEEP_PINS, or GitHub out of reach) and must download
# it: a download nothing checks isn't installed, and a file up less than the
# wait isn't taken, as a plain run wouldn't take it. Not asked again when GitHub
# has just not answered.
lookup_local_digest() {
    local flat rc=0 name=${LOCAL_ASSET//\{tag\}/$ZOLA_VERSION}
    if [ -n "$NET_SAID" ]; then rc=2; else flat=$(releases_of getzola/zola) || rc=$?; fi
    [ "$rc" -ne 2 ] || die "zola ${ZOLA_VERSION#v} isn't installed in $ZOLA_DIR, and $name, the file for this computer, can't be checked: GitHub's digest for it couldn't be looked up ($(net_hint)). nothing has been changed; run this again later."
    [ "$rc" -eq 0 ] || die "could not read GitHub's answer about getzola/zola's releases. nothing has been changed; run this again later."
    LOCAL_DIGEST=$(printf '%s\n' "$flat" | file_digest "$ZOLA_VERSION" "$LOCAL_ASSET" "$CUTOFF") \
        || die "could not read GitHub's answer about getzola/zola's releases. nothing has been changed; run this again later."
    [ -n "$LOCAL_DIGEST" ] || die "zola's release $ZOLA_VERSION has no $name on GitHub now (pulled, or its file removed). nothing has been changed. without KEEP_PINS, a run that can ask GitHub takes another."
    [ "$LOCAL_DIGEST" != new ] || die "GitHub doesn't show zola $ZOLA_VERSION's $name, the file for this computer, as uploaded $RELEASE_WAIT_DAYS days ago or more, so it isn't taken yet. nothing has been changed. check the release's page on GitHub; run this again once the file has been up $RELEASE_WAIT_DAYS days, or without KEEP_PINS, which takes the newest release whose files have been up that long."
    unknown_form "$LOCAL_DIGEST" "$LOCAL_ASSET"
}

# The Linux file, downloaded for its digest: GitHub has none for it (a file
# uploaded before June 2025), and the workflow pins none for this release. On a
# computer whose own file it is, the install takes this download.
PREFETCHED=""
hash_linux_file() {
    local url="https://github.com/getzola/zola/releases/download/$ZOLA_VERSION/${LINUX_ASSET//\{tag\}/$ZOLA_VERSION}"
    [ -n "$TMP_ZOLA" ] || TMP_ZOLA=$(mktemp -d)
    fetch "$url" "$TMP_ZOLA/linux.tar.gz" || die "could not download $url ($DL_HINT). nothing has been changed."
    ZOLA_SHA256=$(sha256_of "$TMP_ZOLA/linux.tar.gz") || die "could not compute the sha256 of $url"
    warn "GitHub has no digest for $url, and the workflow pins none for it: pinning its own, $ZOLA_SHA256"
    if [ "$LOCAL_ASSET" = "$LINUX_ASSET" ]; then LOCAL_DIGEST=$ZOLA_SHA256 PREFETCHED="$TMP_ZOLA/linux.tar.gz"; fi
}

# The refusal for an action whose pinned tag ($2, "commit tag") names $3 now.
tag_moved() {
    die "$1's tag ${2#* } now names commit $3, but the workflow pins ${2%% *} for it: the tag has been moved since. nothing has been changed. check the release's page on GitHub before trusting it. to go on, delete its 'uses:' line from .github/workflows/deploy.yml, then run this again with REGENERATE_TEMPLATES=true in front (the hand-edit check would stop at the workflow): the action is then looked up as on a first run."
}

# An action of github.com/$1 at the newest release out RELEASE_WAIT_DAYS days, as
# "actions/x@<commit> # <tag>": the commit, since a tag can be moved. The tag the
# workflow pins, whichever release this run takes, must still name the commit
# pinned for it. If GitHub can't be asked, the workflow's pin, a commit pinned
# alone too. Sets USES.
lookup_action() {
    local repo=$1 flat rc=0 got tag sha old was
    old=$(pin "$repo")
    flat=$(releases_of "$repo") || rc=$?
    if [ "$rc" -eq 2 ]; then
        [ -n "$old" ] || die "could not look up $repo's releases ($(net_hint)). nothing has been changed; run this again later."
        USES=$(pin_uses "$repo" "$old")
        warn "could not look up $repo's releases ($(net_hint)): keeping $repo $(uses_name "$USES"), which the workflow pins"
        NET_SAID=1
        return 0
    fi
    [ "$rc" -eq 0 ] || die "could not read GitHub's answer about $repo's releases. nothing has been changed; run this again later."
    got=$(printf '%s\n' "$flat" | pick_release v "" "" "") \
        || die "could not read GitHub's answer about $repo's releases. nothing has been changed; run this again later."
    if [ -z "$got" ]; then
        # The tag the workflow pins first: a moved one is refused even when no
        # release qualifies. git failing here changes nothing (the run stops
        # either way), so its message isn't shown.
        if [ -n "$old" ] && [ "${old#* }" != - ] && was=$(tag_commit "$repo" "${old#* }" 2>/dev/null) \
            && [ -n "$was" ] && [ "${old%% *}" != "$was" ]; then
            tag_moved "$repo" "$old" "$was"
        fi
        die "no stable $repo release has been out $RELEASE_WAIT_DAYS days yet. nothing has been changed."
    fi
    tag=${got%% *}
    # git failing (no route to github.com) is GitHub out of reach, as when the API
    # can't be asked.
    if ! sha=$(tag_commit "$repo" "$tag"); then
        [ -n "$old" ] || die "could not ask github.com which commit $repo's tag $tag names (git ls-remote https://github.com/$repo failed, as git says above; it reads no git config: behind a proxy that inspects TLS, name its certificate in GIT_SSL_CAINFO). nothing has been changed; run this again later."
        USES=$(pin_uses "$repo" "$old")
        warn "could not ask github.com which commit $repo's tag $tag names (git ls-remote https://github.com/$repo failed, as git says above; it reads no git config: behind a proxy that inspects TLS, name its certificate in GIT_SSL_CAINFO): keeping $repo $(uses_name "$USES"), which the workflow pins"
        return 0
    fi
    case "$sha" in
        *[!0123456789abcdef]*|"") die "could not find the commit $repo's tag $tag names (git ls-remote https://github.com/$repo). nothing has been changed." ;;
    esac
    [ "${#sha}" -eq 40 ] || die "could not find the commit $repo's tag $tag names (git ls-remote https://github.com/$repo). nothing has been changed."
    # A pinned tag that's gone (its release pulled) proves nothing, and a commit
    # pinned alone has no tag to check.
    if [ -n "$old" ] && [ "${old#* }" != - ]; then
        was=$sha
        if [ "${old#* }" != "$tag" ] && ! was=$(tag_commit "$repo" "${old#* }"); then
            USES=$(pin_uses "$repo" "$old")
            warn "could not ask github.com which commit $repo's tag ${old#* } names (git ls-remote https://github.com/$repo failed, as git says above; it reads no git config: behind a proxy that inspects TLS, name its certificate in GIT_SSL_CAINFO): keeping $repo $(uses_name "$USES"), which the workflow pins"
            return 0
        fi
        if [ -n "$was" ] && [ "${old%% *}" != "$was" ]; then
            tag_moved "$repo" "$old" "$was"
        fi
        if newer_than "${old#* }" "$tag"; then
            warn "the workflow pins $repo ${old#* }, which GitHub doesn't offer now as a stable release out $RELEASE_WAIT_DAYS days (too new, pulled, or marked a pre-release): using $tag. if it was pulled, the project's releases page or security advisories on GitHub may say why."
        fi
    fi
    USES="$repo@$sha # $tag"
}

# KEEP_PINS, a release the workflow doesn't pin whole: a workflow this run writes
# for the first time, or a line deleted (a digest after a refusal) or edited past
# recognition. Looked up as usual, and said.
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

# Every release this run uses, each the newest that qualifies; with
# KEEP_PINS=true, each the workflow pins as it pins it, and only the rest looked
# up. Before anything is installed or written: a run that stops here has changed
# nothing.
CUTOFF=""
lookup_releases() {
    local keep="" now
    [ "$KEEP_PINS" != true ] || keep=1
    # The wait as a time to compare GitHub's with (both UTC, so as text): GNU
    # date takes -d @seconds, BSD's (macOS) -r seconds.
    now=$(( $(date -u +%s) - RELEASE_WAIT_DAYS * 86400 ))
    if date --version >/dev/null 2>&1; then
        CUTOFF=$(date -u -d "@$now" +%Y-%m-%dT%H:%M:%SZ)
    else
        CUTOFF=$(date -u -r "$now" +%Y-%m-%dT%H:%M:%SZ)
    fi
    # Said first, so a slow network doesn't look like a hang.
    [ -n "$keep" ] || say "looking up the newest releases on GitHub"
    if [ -n "$keep" ] && [ -n "$(pin zola)" ] && [ -n "$(pin zola-sha)" ]; then
        ZOLA_VERSION=$(pin zola) ZOLA_SHA256=$(pin zola-sha) KEPT=1
        [ "$LOCAL_ASSET" != "$LINUX_ASSET" ] || LOCAL_DIGEST=$ZOLA_SHA256
    else
        unpinned "$keep" zola
        lookup_zola
    fi
    # Also for a release kept, by KEEP_PINS or because GitHub couldn't be asked.
    if ! in_series "${ZOLA_VERSION#v}"; then
        [ -z "$keep" ] || die "this script's templates are written for zola $ZOLA_SERIES, from $ZOLA_FLOOR on, and the workflow pins $ZOLA_VERSION, which KEEP_PINS=true keeps. nothing has been changed. run this without KEEP_PINS to take the newest $ZOLA_SERIES release."
        die "this script's templates are written for zola $ZOLA_SERIES, from $ZOLA_FLOOR on, and with GitHub out of reach this run would keep $ZOLA_VERSION, which the workflow pins. nothing has been changed. run this again when GitHub can be asked."
    fi
    if [ -z "$LOCAL_DIGEST" ] && [ "$(installed_zola_version)" != "${ZOLA_VERSION#v}" ]; then
        lookup_local_digest
    fi
    [ -z "$GIT_REPO_URL" ] || [ "$ZOLA_SHA256" != - ] || hash_linux_file
    if [ -n "$GIT_REPO_URL" ]; then
        keep_or_lookup_action actions/checkout "$keep"; CHECKOUT_USES=$USES
        keep_or_lookup_action actions/upload-pages-artifact "$keep"; UPLOAD_USES=$USES
        keep_or_lookup_action actions/deploy-pages "$keep"; DEPLOY_USES=$USES
        say "releases: zola $ZOLA_VERSION; $(uses_name "$CHECKOUT_USES"), $(uses_name "$UPLOAD_USES"), $(uses_name "$DEPLOY_USES") of the actions${KEPT:+ (KEEP_PINS: those the workflow pins, kept)}"
    else
        say "release: zola $ZOLA_VERSION"
    fi
}

# Downloads $1 to $2 and checks it against $3, GitHub's digest or the pinned one;
# "-" (GitHub has none for an old upload, and nothing is pinned for it) takes the
# file as it came, and says so. Prints the file's digest.
fetch_checked() {
    local got
    fetch "$1" "$2" || die "could not download $1 ($DL_HINT). nothing has been changed."
    [ -s "$2" ] || die "the download of $1 is empty. nothing has been changed."
    got=$(sha256_of "$2") || die "could not compute the sha256 of $2"
    case "$got" in
        [0-9a-f]*) ;;
        *) die "could not compute the sha256 of $2" ;;
    esac
    if [ "$3" = - ]; then
        warn "GitHub has no digest for $1, so it can't be checked: its sha256 is $got"
    elif [ "$got" != "$3" ]; then
        die "$1 isn't the file it should be: its sha256 is $got, not $3. it wasn't installed, and nothing has been changed."
    fi
    printf '%s' "$got"
}

# A gnu Linux build runs only on a glibc with every symbol version it links
# (zola 0.23.6's needs 2.35): checked before it goes into ZOLA_DIR, so a system
# too old for it keeps the zola it had.
runs_here() {
    local out need have keep="" pinned rc
    out=$("$1" --version 2>&1) && return 0
    rc=$?
    [ -n "$out" ] || out="its --version printed nothing and exited $rc"
    # KEEP_PINS is a way on only when it keeps the release the workflow pins
    # (its digest pinned too, and a release the templates take), another than
    # this one, and ZOLA_DIR has it, running.
    pinned=$(pin zola)
    if [ "$KEEP_PINS" != true ] && [ -n "$PIN_OFFERED" ] && [ "$pinned" != "$ZOLA_VERSION" ] \
        && [ "$(installed_zola_version)" = "${pinned#v}" ]; then
        keep=" KEEP_PINS=true keeps zola ${pinned#v}, which the workflow pins and $ZOLA_DIR has."
    fi
    if [ "$OS" = linux ]; then
        need=$(printf '%s\n' "$out" | grep -o 'GLIBC_[0-9][0-9.]*' | sort -V | tail -n 1 || true)
        have=$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}' || true)
        [ -z "$need" ] || die "zola ${ZOLA_VERSION#v}'s Linux build needs glibc ${need#GLIBC_} or later, and this system has ${have:-an older one}: it wasn't installed, and $ZOLA_DIR keeps the zola it had, if any. nothing has been changed. run this on a system with glibc ${need#GLIBC_} or later.${keep}"
    fi
    die "zola ${ZOLA_VERSION#v} doesn't run here ($(printf '%s' "$out" | head -n 2 | tr '\n' ' ')): it wasn't installed, and $ZOLA_DIR keeps the zola it had, if any. nothing has been changed.${keep}"
}

# Every blog on this computer runs one zola, ZOLA_BIN: the release this run pins,
# kept when it's that release already, else downloaded, checked against GitHub's
# digest, run, and moved into place, through a temporary name in ZOLA_DIR so a
# preview starting meanwhile never finds half a file. Then this run's PATH starts
# with ZOLA_DIR, and a terminal's that wouldn't run it is said.
install_zola() {
    local current first archive url digest bin on_path=""
    current=$(installed_zola_version)
    # Both before the export below, or the answers are always yes and ZOLA_BIN.
    case ":$PATH:" in *":$ZOLA_DIR:"*) on_path=1 ;; esac
    first=$(command -v zola 2>/dev/null || true)
    if [ "$current" = "${ZOLA_VERSION#v}" ]; then
        say "zola $current is installed in $ZOLA_DIR"
    else
        if [ -n "$current" ] && newer_than "$current" "${ZOLA_VERSION#v}"; then
            say "replacing zola $current in $ZOLA_DIR with ${ZOLA_VERSION#v}, an older release: every blog on this computer runs this one"
        elif [ -n "$current" ]; then
            say "updating zola in $ZOLA_DIR from $current to ${ZOLA_VERSION#v}: every blog on this computer runs this one"
        else
            say "installing zola ${ZOLA_VERSION#v} into $ZOLA_DIR..."
        fi
        archive=${LOCAL_ASSET//\{tag\}/$ZOLA_VERSION}
        url="https://github.com/getzola/zola/releases/download/$ZOLA_VERSION/$archive"
        [ -n "$TMP_ZOLA" ] || TMP_ZOLA=$(mktemp -d)
        if [ -n "$PREFETCHED" ]; then
            mv "$PREFETCHED" "$TMP_ZOLA/$archive"; digest=$LOCAL_DIGEST
        else
            digest=$(fetch_checked "$url" "$TMP_ZOLA/$archive" "$LOCAL_DIGEST")
        fi
        # Unpacked and run in a folder of its own in ZOLA_DIR, not in /tmp, which
        # can be mounted noexec; then renamed into place, in one step.
        mkdir -p "$ZOLA_DIR" || die "could not make $ZOLA_DIR. nothing has been changed."
        NEW_ZOLA=$(mktemp -d "$ZOLA_DIR/.zola-new.XXXXXX") || die "could not make a folder in $ZOLA_DIR. nothing has been changed."
        bin="$NEW_ZOLA/zola"
        if [ "$OS" = windows ]; then
            bin="$bin.exe"
            unzip -q "$TMP_ZOLA/$archive" zola.exe -d "$NEW_ZOLA" || bin=""
        else
            # As root, tar would keep the archive's owner (the uid GitHub
            # built it as); the option before the member's name, or bsdtar
            # takes it for one.
            tar --no-same-owner -xzf "$TMP_ZOLA/$archive" -C "$NEW_ZOLA" zola || bin=""
        fi
        if [ -z "$bin" ] || [ ! -f "$bin" ]; then
            die "could not take zola out of $archive: this release may lay its archive out differently, which this script doesn't know yet. nothing has been changed; a newer version of this script may know it.$(keep_hint)"
        fi
        chmod +x "$bin"
        runs_here "$bin"
        mv -f "$bin" "$ZOLA_BIN" \
            || die "could not put zola in $ZOLA_DIR (on Windows, a zola running from there, such as another blog's preview, keeps its file: stop it, then run this again). nothing has been changed."
        rmdir "$NEW_ZOLA" 2>/dev/null || true
        NEW_ZOLA=""
        say "installed: $("$ZOLA_BIN" --version) (sha256 ${digest:0:12}...)"
    fi
    export PATH="$ZOLA_DIR:$PATH"
    # New terminals take PATH from the login: on Linux ~/.profile, so the next
    # login; a Mac terminal is a login shell, so a new one is enough.
    if [ -z "$on_path" ]; then
        say ""
        say "note: $ZOLA_DIR is not on your PATH, so a new terminal will not run this zola${first:+ (it finds $first)}."
        case "$OS" in
            linux)
                say "log out and back in; on Debian, Devuan and Ubuntu that is usually all it"
                say "takes. if a new terminal still cannot find it, add this line to"
                say "$HOME/.profile, then log out and back in again:"
                say "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                ;;
            macos)
                say "add this line to $HOME/.zprofile, then open a new terminal:"
                say "    export PATH=\"\$HOME/.local/bin:\$PATH\""
                ;;
            windows)
                say "add this line to $HOME/.bashrc, then open a new Git Bash window:"
                say "    export PATH=\"\$HOME/bin:\$PATH\""
                ;;
        esac
    elif [ -n "$first" ] && [ "${first%.exe}" != "${ZOLA_BIN%.exe}" ]; then
        warn "a terminal here runs $first, which comes before $ZOLA_DIR in your PATH: ./serve and ./build would run it, not zola ${ZOLA_VERSION#v}, the one in $ZOLA_DIR${GIT_REPO_URL:+, which the workflow pins} (guide: \"Two Zolas\")."
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

# One stop naming everything missing: curl, tar (unzip in Git Bash), sha256sum
# or shasum for the digest checks, and, with GIT_REPO_URL, git, which also asks
# github.com which commit an action's tag names. Without GIT_REPO_URL git is
# only said: the blog builds without it.
check_required_tools() {
    local missing=() pkgs=() tool
    command -v curl >/dev/null 2>&1 || { missing+=("curl"); pkgs+=(curl); }
    case "$OS" in
        linux|macos) command -v tar   >/dev/null 2>&1 || { missing+=("tar"); pkgs+=(tar); } ;;
        windows)     command -v unzip >/dev/null 2>&1 || missing+=("unzip") ;;
    esac
    if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
        missing+=("sha256sum or shasum"); pkgs+=(coreutils)
    fi
    if [ -n "$GIT_REPO_URL" ] && ! command -v git >/dev/null 2>&1; then
        missing+=("git, for GIT_REPO_URL"); pkgs+=(git)
    fi
    if [ "${#missing[@]}" -gt 0 ]; then
        warn "missing required tools:"
        for tool in "${missing[@]}"; do
            warn "  - $tool"
        done
        if [ "$OS" = linux ] && [ "${#pkgs[@]}" -gt 0 ]; then
            warn "on Debian, Devuan or Ubuntu: sudo apt install ${pkgs[*]}"
        fi
        warn "install them, then run this again. nothing has been changed."
        exit 1
    fi
    command -v git >/dev/null 2>&1 \
        || warn "warning: git not found - repo init will be skipped."
    return 0
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
# run_create_mode has checked that nothing is there.
create_blog_directory() {
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
    # Only with a name and email you set (user.useConfigOnly): git would otherwise
    # make them up from your account's full name and this computer's name, and
    # say so only in a warning. In UTC, so the commit doesn't carry your time
    # zone; who it's from is said, since a push publishes both.
    local err when as by off also
    git add -A >/dev/null 2>&1 || true
    if err=$(TZ=UTC git -c user.useConfigOnly=true commit -q -m "initial commit: zola blog scaffolding" 2>&1); then
        # As a push publishes it: the committer too when it isn't the author
        # (author.* and committer.* settings, and GIT_AUTHOR_* and
        # GIT_COMMITTER_*, can make them two), and the offset of each time,
        # UTC's unless GIT_AUTHOR_DATE or GIT_COMMITTER_DATE gives another.
        # Signatures off: log.showSignature would put gpg's lines among these.
        as=$(git -c log.showSignature=false log -1 --format='%an <%ae>')
        by=$(git -c log.showSignature=false log -1 --format='%cn <%ce>')
        off=$(git -c log.showSignature=false log -1 --format='%ad %cd' --date=raw | awk '{ print $2, $4 }')
        also=""
        case "$off" in
            "+0000 +0000") when="timed in UTC" ;;
            "${off% *} ${off% *}") when="with the offset ${off% *}" also=", and that offset" ;;
            *) when="with the offsets ${off% *} (author) and ${off#* } (committer)" also=", and those offsets" ;;
        esac
        if [ "$by" = "$as" ]; then
            say "made initial commit as $as, $when; a push publishes that name and address$also (guide: \"What a push publishes\")"
        else
            say "made initial commit as $as, committed by $by, $when; a push publishes both names and addresses$also (guide: \"What a push publishes\")"
        fi
    # The identity asked of git, not read from its message, which is in your
    # language.
    # The dates emptied: git var also stops at a GIT_AUTHOR_DATE or
    # GIT_COMMITTER_DATE it can't read, which isn't about the identity.
    elif ! GIT_AUTHOR_DATE='' GIT_COMMITTER_DATE='' git -c user.useConfigOnly=true var GIT_AUTHOR_IDENT >/dev/null 2>&1 \
        || ! GIT_AUTHOR_DATE='' GIT_COMMITTER_DATE='' git -c user.useConfigOnly=true var GIT_COMMITTER_IDENT >/dev/null 2>&1; then
        say "(no initial commit: $(printf '%s\n' "$err" | grep -m 1 . || true))"
        say "(set your name and email, as in the guide's \"Your first blog\", step 1, then make it yourself,"
        say " from inside the blog folder: git add -A && TZ=UTC git commit -m \"First commit\")"
    else
        say "(no initial commit; git says:"
        printf '%s\n' "$err" | sed 's/^/    /'
        say " fix what it says, then make it yourself, from inside the blog folder:"
        say " git add -A && TZ=UTC git commit -m \"First commit\")"
    fi
    update_git_remote
}

# The check the deploy runs, preview or not: ./build lists each broken link and
# stops, and so does the run. Through bash, as the preview is.
build_site() {
    say ""
    bash "$BLOG_DIR/build" || exit 1
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
# content/ and the placeholder assets: written once, never rewritten. In book
# mode the writing is book/, and content/ is genbook's output.
write_content_if_absent() {
    local name names=()
    read -r -a names <<< "$MENU_PAGES"
    mkdir -p content/attachments
    write_absent content/attachments/_index.md    render_attachments_index
    write_absent content/attachments/demo.svg     render_demo_svg
    if [ "$BOOK_MODE" = true ]; then
        mkdir -p book
        write_absent book/SUMMARY.md              render_book_summary
        write_absent book/about.md                render_book_about
        write_absent book/hello-world.md          render_book_hello_world
        write_absent book/second-page.md          render_book_second_page
        write_absent book/colophon.md             render_book_colophon
        if [ "${#names[@]}" -gt 0 ]; then
            for name in "${names[@]}"; do
                [ -e "book/$name.md" ] || render_book_menu_page "$name" > "book/$name.md"
            done
        fi
        say "wrote book/ (yours from here; a re-run will not touch it; ./build makes content/ from it)"
        return 0
    fi
    write_absent content/_index.md                render_home_index
    write_absent content/about.md                 render_about
    write_absent content/hello-world.md           render_hello_world
    write_absent content/second-post.md           render_second_post
    # A starter page for each other MENU_PAGES name, so a new blog builds.
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
    [ "$BOOK_MODE" = true ] || return 0
    cat << 'EOF'

# Book mode: content/ is made from book/ by ./genbook, which ./build runs, on
# GitHub too; only content/attachments/ is kept. .genbook.*: where genbook
# writes before the move into content/, gone when it finishes
/content/*
!/content/attachments/
/.genbook.*
EOF
}

# In book mode, genbook first: zola serve reloads on a change in content/, so
# an edit in book/ needs ./genbook run again, in another terminal.
render_serve() {
    cat << 'EOF'
#!/usr/bin/env bash
# preview the blog locally at http://127.0.0.1:1111 with live reload; drafts
# are shown, marked "(draft)", and are never published
cd "$(dirname "$0")" || exit 1
EOF
    [ "$BOOK_MODE" != true ] || cat << 'EOF'
# content/ from book/ first; after an edit in book/, run ./genbook again
bash ./genbook || exit 1
EOF
    cat << 'EOF'
exec zola serve --open --drafts
EOF
}

# ./new: a post file with its front matter filled in, as a draft at the end of
# the list. Weights are read from the top of content/ only: posts and folders,
# which share one numbering, not children.
# The title is made from the name, so it needs no escaping; the author edits it.
# In book mode there are no posts: it says where a page goes, and exits 2.
render_new() {
    if [ "$BOOK_MODE" = true ]; then
        cat << 'EOF'
#!/usr/bin/env bash
# this site is in book mode, so there are no posts to make: see below
echo "this site is in book mode: a page is a file in book/, starting with its title as a # heading, and a line in book/SUMMARY.md that names it, such as - [Tea in the hills](tea-in-the-hills.md). then ./genbook, or ./build, makes content/ from it. guide: \"Book mode\"." >&2
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
# An exported CDPATH would take the cd below elsewhere, and print a line into src.
unset CDPATH
src="${1:-}" name="${2:-}"
if [ ! -f "$src" ] || [ -z "$name" ]; then
    echo "usage: ./attach path/to/file new-name   (the file keeps its own extension)" >&2
    exit 2
fi
case "$(basename -- "$src")" in
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
src="$(cd -- "$(dirname -- "$src")" && pwd)/$(basename -- "$src")"
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

# content/ from book/: the outline and the pages it names (guide: "Book mode").
bash ./genbook
EOF
    cat << 'EOF'

# Zola checks @/ links, but stops at the first missing file and passes links
# written any other way. This lists, by file and line, each link it can tell is
# broken: an @/ link, or a video's src, naming a file that isn't in content/, or
# one in content/attachments/ while Zola isn't publishing that folder (no
# _index.md, or render = false); an @/ link in HTML, which Zola leaves as it is;
# a link to a .md file without @/; a file named relative to a page that isn't
# index.md or _index.md, which the page looks for under its own address; and, on
# a site under a path such as /notes/, a link starting with /. Drafts are
# skipped, as zola build skips them. #anchors are left to Zola, which lists
# every missing one.
us=$(printf '\037')
base_path=$(sed -n 's|^base_url = "[a-z]*://[^/"]*\([^"]*\)"$|\1|p' config.toml)
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
        if (r in exists) report(away "write " at(substr(r, 9)))
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

# ./genbook, in book mode: content/ from book/. It reads the outline, checks
# everything, writes every file into a temporary folder beside content/, and
# only then moves them in: a stop changes nothing, and a running preview never
# sees half a site. Each file it writes carries a marker line, by which it
# tells its own files from anything hand-made, which stops it. bash and awk,
# mawk's awk included: GitHub's build runs this too. Vars: MENU_PAGES.
render_genbook() {
    cat << EOF
#!/usr/bin/env bash
# make content/ from book/: the outline, book/SUMMARY.md, and the pages it
# names. ./build and ./serve run this first; after an edit in book/ while the
# preview runs, run it yourself. Guide: "Book mode".
set -euo pipefail
cd "\$(dirname "\$0")"

# MENU_PAGES, as the setup script last wrote it: book/<name>.md, one each.
menu="${MENU_PAGES}"
EOF
    cat << 'EOF'

# The line after +++ in every file this script writes: its mark.
marker='# genbook:'
stop() { printf '%s\n' "$*" >&2; exit 1; }
ours() { case "$(sed -n 2p "$1" 2>/dev/null)" in "$marker"*) return 0 ;; esac; return 1; }

[ -f book/SUMMARY.md ] || stop "there's no book/SUMMARY.md, the outline the site is built from: a part is a line # Title, a page a line - [Title](file.md), each file in book/ (guide: \"Book mode\"). nothing has been changed."

# Everything is written here first, in the blog's folder, so the moves into
# content/ are renames; a stop leaves content/ as it was.
tmp=$(mktemp -d .genbook.XXXXXX) || stop "could not make a temporary folder in $PWD"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/content/unlisted"

# The outline, read as mdBook reads SUMMARY.md: "# Title" is a part, a heading;
# "- [Title](file.md)" a page; "- [Title]()" a name with no page, a plain item,
# or, with items indented under it, a heading one level down; "[Title](file.md)"
# without the dash an unlisted page. Written out as the home page's text
# ($tmp/outline), and as one "L stem" or "U stem" line per page ($tmp/pages),
# in outline order. An item waits (pend) until the next line says whether
# anything is indented under it. A page after a name with items under it would
# read, on the page, as one of those items, so it stops.
if ! msg=$(LC_ALL=C awk -v outline="$tmp/outline" -v pages="$tmp/pages" -v menu="$menu" '
    function stop(msg, at) { printf "book/SUMMARY.md, line %d: %s. nothing has been changed.\n", (at ? at : NR), msg; bad = 1; exit 1 }
    function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
    # The pending item, placed as a plain item or a page in the list of its
    # container; a container that already has a heading in it stops.
    function place_pending() {
        if (!pend) return
        if (hseen[n]) stop("\"" pend_title "\" comes after \"" hname[n] "\", which has items under it; on the home page it would look like one of them. put the pages before the names with items under them")
        if (prev != "leaf") out = out "\n"
        if (pend_draft) out = out "1. " pend_title "\n"
        else out = out "1. [" pend_title "](@/" pend_stem ".md)\n"
        prev = "leaf"; pend = 0; partitems++
    }
    # The pending item as a heading: a name with no page, with items under it.
    function heading_pending(   level, h) {
        if (!pend_draft) stop("\"" pend_title "\" has items indented under it, and a page can'"'"'t: put a name with no page, - [Name](), above them, or unindent them")
        level = (inpart ? 3 : 2) + n
        if (level > 6) stop("\"" pend_title "\" is nested too deep: headings go six levels down at most")
        h = ""; while (length(h) < level) h = h "#"
        out = out "\n" h " " pend_title "\n"
        prev = "head"; hseen[n] = 1; hname[n] = pend_title; pend = 0; partitems++
        n++; ind[n] = child_indent; hseen[n] = 0
    }
    # A part with no item under it would be a heading over nothing: mdBook'"'"'s
    # title line, # Summary, mostly, which this outline doesn'"'"'t have.
    function end_part() {
        if (inpart && partitems == 0) stop("the part \"" partname "\" has nothing under it. every # line is a part, a heading on the home page (an unlisted page, written without a dash, isn'"'"'t shown under it); there is no title line, so mdBook'"'"'s # Summary goes: SITE_TITLE names the site", partline)
    }
    # A link, checked and recorded: a file in book/, listed once.
    function take_link(link, title, kind,   stem) {
        if (link !~ /^[a-z0-9]+(-[a-z0-9]+)*\.md$/) stop("\"" title "\" links to \"" link "\", which should be the name of a file in book/, such as tea-hills.md: lowercase letters and digits, with single dashes between them, then .md, with no folder in front and no # after")
        stem = substr(link, 1, length(link) - 3)
        if (stem == "unlisted" || stem == "attachments") stop("a page can'"'"'t be named " stem ".md: content/" stem "/ is a folder of the site")
        if (stem in menus) stop(link " is a page in the menu (MENU_PAGES), so it isn'"'"'t listed in the outline too")
        if (stem in seen) stop(link " is listed twice: also on line " seen[stem])
        seen[stem] = NR
        print kind "\t" stem > pages
        return stem
    }
    BEGIN {
        nm = split(menu, m, " "); for (i = 1; i <= nm; i++) menus[m[i]] = 1
        n = 0; ind[0] = 0; hseen[0] = 0; pend = 0; prev = ""; inpart = 0; partitems = 0; out = ""
        printf "" > pages
    }
    # A byte-order mark some Windows editors put first, and Windows line ends.
    NR == 1 { sub(/^\357\273\277/, "") }
    { sub(/\r$/, "") }
    /^[ \t]*$/ { next }
    /^#/ {
        place_pending()
        end_part()
        title = $0; sub(/^#+[ \t]*/, "", title); sub(/[ \t]+#+[ \t]*$/, "", title); title = trim(title)
        if (title == "") stop("a part with no title")
        out = out "\n## " title "\n"
        prev = "head"; inpart = 1; n = 0; hseen[0] = 0
        partitems = 0; partname = title; partline = NR
        next
    }
    /^[ \t]*[-*+][ \t]+\[/ {
        lead = $0; sub(/[-*+].*$/, "", lead)
        indent = 0; for (j = 1; j <= length(lead); j++) indent += substr(lead, j, 1) == "\t" ? 4 : 1
        rest = $0; sub(/^[ \t]*[-*+][ \t]+\[/, "", rest)
        if (!match(rest, /\]\([^()]*\)[ \t]*$/)) stop("not an outline line: a page is - [Title](file.md), and a name with no page is - [Title]()")
        title = trim(substr(rest, 1, RSTART - 1)); link = substr(rest, RSTART + 2); sub(/\)[ \t]*$/, "", link); link = trim(link)
        if (title == "") stop("an item with no title")
        if (pend && indent > ind[n]) { child_indent = indent; heading_pending() }
        else {
            place_pending()
            while (n > 0 && indent < ind[n]) n--
            if (indent != ind[n]) stop("\"" title "\" is indented with nothing above it to go under; items under a name line up with each other, and the rest start at the left")
        }
        pend = 1; pend_title = title; pend_draft = link == ""
        if (!pend_draft) pend_stem = take_link(link, title, "L")
        next
    }
    /^[ \t]*\[[^]]*\]\([^()]*\)[ \t]*$/ {
        rest = $0; sub(/^[ \t]*\[/, "", rest)
        match(rest, /\]\([^()]*\)[ \t]*$/)
        title = trim(substr(rest, 1, RSTART - 1)); link = substr(rest, RSTART + 2); sub(/\)[ \t]*$/, "", link); link = trim(link)
        if (title == "") stop("an unlisted page with no title")
        if (link == "") stop("\"" title "\" is an unlisted page, written without a dash, and needs a file: [" title "](file.md)")
        take_link(link, title, "U")
        next
    }
    { stop("not an outline line: a part is # Title, a page is - [Title](file.md), a name with no page is - [Title](), and an unlisted page is [Title](file.md) without the dash") }
    END {
        if (bad) exit 1
        place_pending()
        end_part()
        if (bad) exit 1
        printf "%s", out > outline
    }' book/SUMMARY.md); then
    stop "$msg"
fi

listed=() unlisted=()
while IFS=$'\t' read -r kind stem; do
    case "$kind" in L) listed+=("$stem") ;; U) unlisted+=("$stem") ;; esac
done < "$tmp/pages"
# The menu's pages, each a file in book/; and the map every link is resolved
# with: stem, then the file content/ gets.
menus=()
read -r -a menus <<< "$menu"
: > "$tmp/map"
for stem in ${listed[@]+"${listed[@]}"} ${menus[@]+"${menus[@]}"}; do printf '%s\t%s.md\n' "$stem" "$stem" >> "$tmp/map"; done
for stem in ${unlisted[@]+"${unlisted[@]}"}; do printf '%s\tunlisted/%s.md\n' "$stem" "$stem" >> "$tmp/map"; done
cut -f1 "$tmp/map" > "$tmp/stems"

missing=()
for stem in ${listed[@]+"${listed[@]}"} ${unlisted[@]+"${unlisted[@]}"}; do [ -f "book/$stem.md" ] || missing+=("book/$stem.md, named in book/SUMMARY.md"); done
for stem in ${menus[@]+"${menus[@]}"}; do [ -f "book/$stem.md" ] || missing+=("book/$stem.md, named in MENU_PAGES"); done
if [ "${#missing[@]}" -gt 0 ]; then
    printf '%s\n' "these pages have no file:" >&2
    printf '  - %s\n' "${missing[@]}" >&2
    stop "make each file, starting with its title as a line # Title, or take it out of book/SUMMARY.md or MENU_PAGES. nothing has been changed."
fi

# A file in book/ that nothing names would be left out of the site without a
# word: said, instead.
stray=()
for f in book/*.md; do
    [ -f "$f" ] || continue
    stem=${f#book/}; stem=${stem%.md}
    [ "$stem" != SUMMARY ] || continue
    grep -qxF "$stem" "$tmp/stems" || stray+=("$f")
done
if [ "${#stray[@]}" -gt 0 ]; then
    printf '%s\n' "these files in book/ are neither in book/SUMMARY.md nor in MENU_PAGES, so the site would leave them out:" >&2
    printf '  - %s\n' "${stray[@]}" >&2
    stop "add each to book/SUMMARY.md, as a page (- [Title](file.md)) or an unlisted page ([Title](file.md)), or move it out of book/. nothing has been changed."
fi

# content/ is this script's output, and only its own files are replaced: one
# without the marker, any file that isn't a page, or an empty folder (a file
# moved into one would be lost in it) stops the run. Pictures go in
# content/attachments/, which is left alone.
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
    stop "a page goes in book/, with a line in book/SUMMARY.md; a picture, GIF or video goes in content/attachments/. move each, then run this again. nothing has been changed."
fi

# One page: the title from its first line, which must be # Title, and the rest
# as the body, with links to the book's pages rewritten to the files content/
# gets: [the spec](spec.md), (./spec.md) or (@/spec.md) alike, by the map. A
# link to a .md file that isn't a page of the book stops. Fenced code and
# code spans are left as they are, as the link check in ./build leaves them.
# Prints two lines, how many lines the body starts after (the title and any
# blank lines before it) and the title; a stop prints its message instead.
page_body() {
    LC_ALL=C awk -v src="$1" -v out="$2" -v mapfile="$tmp/map" '
    function stop(msg) { printf "%s, line %d: %s. nothing has been changed.\n", src, NR, msg; bad = 1; exit 1 }
    function fixplain(p,   frag, lead, stem) {
        frag = ""; if (match(p, /[#?]/)) { frag = substr(p, RSTART); p = substr(p, 1, RSTART - 1) }
        if (p == "" || p ~ /^[A-Za-z][A-Za-z0-9+.-]*:/ || p ~ /^\/\//) return p frag
        lead = p; sub(/^(\.\/|@\/)/, "", lead)
        if (lead ~ /^[a-z0-9-]+\.md$/) {
            stem = substr(lead, 1, length(lead) - 3)
            if (stem in map) return "@/" map[stem] frag
            stop("a link to " p ", and no page " stem ".md is in book/SUMMARY.md or MENU_PAGES")
        }
        if (p ~ /\.md$/) stop("a link to " p ": the pages of this book are files in book/, linked by name, such as (tea.md)")
        return p frag
    }
    # The inside of (...) or the rest of a [label]: line: the destination, then
    # a title or nothing; or <destination>.
    function fixdest(d,   inner, after) {
        if (substr(d, 1, 1) == "<" && match(d, />/)) { inner = substr(d, 2, RSTART - 2); after = substr(d, RSTART); return "<" fixplain(inner) after }
        if (match(d, /[ \t]/)) { after = substr(d, RSTART); d = substr(d, 1, RSTART - 1) } else after = ""
        if (d == "") return after
        return fixplain(d) after
    }
    # RSTART and RLENGTH belong to awk, and every match() moves them: taken
    # into st and ln before a call that matches again.
    function fixlinks(s,   res, d, st, ln) {
        res = ""
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
    BEGIN { while ((getline l < mapfile) > 0) { split(l, a, "\t"); map[a[1]] = a[2] }; close(mapfile); printf "" > out }
    # A byte-order mark some Windows editors put first, and Windows line ends.
    NR == 1 { sub(/^\357\273\277/, "") }
    { sub(/\r$/, "") }
    !got_title {
        skipped++
        if ($0 ~ /^[ \t]*$/) next
        if ($0 ~ /^[ \t]*\+\+\+/) stop("it starts with +++, and the pages of a book carry no front matter: start it with its title, a line # Title")
        if ($0 !~ /^#[ \t]+/) stop("its first line isn'"'"'t the title: a page starts with a line # Title (one #, then the title)")
        title = $0; sub(/^#[ \t]+/, "", title); sub(/[ \t]+#+[ \t]*$/, "", title); sub(/[ \t]+$/, "", title)
        if (title == "") stop("its title line, # Title, has no title after the #")
        got_title = 1
        next
    }
    /^[ \t]*([`][`][`]|~~~)/ { fence = !fence; print > out; next }
    fence { print > out; next }
    { print fixline($0) > out }
    END {
        if (bad) exit 1
        if (!got_title) { printf "%s: has no title line: a page starts with a line # Title. nothing has been changed.\n", src; exit 1 }
        print skipped + 0
        print title
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

# TOML, for the title: backslash first, then the double quote.
toml() { local s=$1; s=${s//\\/\\\\}; s=${s//\"/\\\"}; printf '%s' "$s"; }

# The pages, each with its front matter: title and weight for a listed page,
# title and path for an unlisted one, so its address is /name/ like the rest,
# and title and hidden for a page in the menu. The body follows the closing
# +++ straight away: its first line is usually the blank one after the title.
# The list of what this run makes, for the moves and the cleanup after them.
: > "$tmp/written"
weight=0
for stem in ${listed[@]+"${listed[@]}"}; do
    out=$(page_body "book/$stem.md" "$tmp/body") || stop "$out"
    skipped=${out%%$'\n'*} title=${out#*$'\n'}
    weight=$((weight + 10))
    {
        printf '+++\n'
        mark "$stem.md" "$((skipped + 1))" 8
        printf 'title = "%s"\nweight = %d\n[extra]\ntoc = true\n+++\n' "$(toml "$title")" "$weight"
        cat "$tmp/body"
    } > "$tmp/content/$stem.md"
    printf '%s\n' "$stem.md" >> "$tmp/written"
done
for stem in ${unlisted[@]+"${unlisted[@]}"}; do
    out=$(page_body "book/$stem.md" "$tmp/body") || stop "$out"
    skipped=${out%%$'\n'*} title=${out#*$'\n'}
    {
        printf '+++\n'
        mark "$stem.md" "$((skipped + 1))" 8
        printf 'title = "%s"\npath = "%s"\n[extra]\ntoc = true\n+++\n' "$(toml "$title")" "$stem"
        cat "$tmp/body"
    } > "$tmp/content/unlisted/$stem.md"
    printf '%s\n' "unlisted/$stem.md" >> "$tmp/written"
done
for stem in ${menus[@]+"${menus[@]}"}; do
    out=$(page_body "book/$stem.md" "$tmp/body") || stop "$out"
    skipped=${out%%$'\n'*} title=${out#*$'\n'}
    {
        printf '+++\n'
        mark "$stem.md" "$((skipped + 1))" 6
        printf 'title = "%s"\nhidden = true\n+++\n' "$(toml "$title")"
        cat "$tmp/body"
    } > "$tmp/content/$stem.md"
    printf '%s\n' "$stem.md" >> "$tmp/written"
done
# The home page: the outline. sort_by = "weight" orders the pages for Previous
# and Next; the list itself is the text below.
{
    printf '+++\n'
    mark SUMMARY.md
    printf 'title = "Home"\nsort_by = "weight"\n+++\n'
    cat "$tmp/outline"
} > "$tmp/content/_index.md"
printf '%s\n' "_index.md" >> "$tmp/written"
# The unlisted pages' folder: a section Zola builds the pages of, and puts in
# the search index, with no list (nothing is sorted) and no page of its own:
# /unlisted/ redirects home, as /attachments/ does. Not render = false: Zola
# then still indexes the section itself, as a page at /unlisted/ that isn't
# there.
if [ "${#unlisted[@]}" -gt 0 ]; then
    {
        printf '+++\n'
        mark SUMMARY.md
        printf 'title = "Unlisted"\nsort_by = "none"\nredirect_to = "/"\n+++\n'
    } > "$tmp/content/unlisted/_index.md"
    printf '%s\n' "unlisted/_index.md" >> "$tmp/written"
fi

# Into place: each file renamed over the old one, then the files of an earlier
# run that this one didn't write, removed. Only files with the marker go.
mkdir -p content
while IFS= read -r rel; do
    [ "$rel" = "${rel%/*}" ] || mkdir -p "content/${rel%/*}"
    mv -f "$tmp/content/$rel" "content/$rel"
done < "$tmp/written"
while IFS= read -r f; do
    rel=${f#content/}
    grep -qxF "$rel" "$tmp/written" && continue
    ours "$f" && rm -f "$f"
done < <(find content -path content/attachments -prune -o -name '*.md' -print 2>/dev/null)
rmdir content/unlisted 2>/dev/null || true
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
`config.toml`, `templates/`, `serve`, `build`, `new`, `attach`, `genbook` and
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
`config.toml`, `templates/`, `serve`, `build`, `new`, `attach` and
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

# true in book mode: the home page is the outline, Previous and Next lead back
# to it as "Contents", and there are no breadcrumbs.
book = ${BOOK_MODE}

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
# The tour of Markdown after the opening is render_markdown_tour, shared with
# the book-mode hello-world. Vars: TWO_DAYS_AGO, TODAY.
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

EOF
    render_markdown_tour @/second-post.md
}

# From "Heading 2" to the footnote: the part of hello-world that shows each kind
# of Markdown. Vars: $1, the page the collapsible's link leads to, as written in
# a link: @/second-post.md in a blog, colophon.md in a book.
render_markdown_tour() {
    local link="$1"
    cat << EOF
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

So \`code\`, [links](${link}), and lists all work:

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

# A new book's book/: the outline, the About page, the hello-world page, a
# second page for Previous and Next to lead to, and one unlisted page, which
# About links to. None carries front matter; each page's first line is its
# title. Guide: "Book mode".
render_book_summary() {
    cat << 'EOF'
# Getting started

- [Hello world](hello-world.md)
- [Second page](second-page.md)

[Colophon](colophon.md)
EOF
}

render_book_second_page() {
    cat << 'EOF'
# Second page

A short second page. It exists to give the Previous and Next links at the foot of each page somewhere to lead: from here, Previous goes to the hello-world page, and Contents goes back to the outline on the home page.

Delete it together with hello-world.md, and take its line out of `book/SUMMARY.md`: a line there naming a file that isn't in `book/` stops the build.
EOF
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

- [Colophon](colophon.md): how this site is made. It is an unlisted page: the outline doesn't show it, and this link is the way to it.
EOF
}

render_book_colophon() {
    cat << 'EOF'
# Colophon

This page is unlisted. In `book/SUMMARY.md` it is written without a dash in front, `[Colophon](colophon.md)`, so it is built and searchable, but the outline on the home page doesn't show it, and no Previous or Next link leads here. Readers reach it through links, like the one on the About page.

The site is made with Zola, by the zola-blog-setup script in book mode: the pages are plain Markdown files in `book/`, and the outline is `book/SUMMARY.md`.
EOF
}

# The book's hello-world: the same tour of Markdown as a blog's, after an
# opening about the book itself. Its picture is content/attachments/demo.svg.
render_book_hello_world() {
    cat << 'EOF'
# Hello world

Lorem ipsum dolor sit amet[^1], consectetur adipiscing elit. Sed non risus. Suspendisse lectus tortor, dignissim sit amet, adipiscing nec, ultricies sed, dolor.

This site links to its own pages by file name, as mdBook does, here is [the colophon](colophon.md), and to the wider web with ordinary Markdown links, like [the Zola documentation](https://www.getzola.org). Both kinds are explained in the guide.

The home page shows the outline, `book/SUMMARY.md`, and the Previous and Next links at the foot of each page follow it. This page's title is its first line, `# Hello world`, and there is no front matter: the pages here carry none.

EOF
    render_markdown_tour colophon.md
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
    {#- Previous and Next, for readers and extensions: the pages either side of
        this one in its section's list (page.html has the links). -#}
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
       blue either way. :any-link, so an <a id> that leads nowhere isn't
       underlined; inside :where(), so the rule weighs nothing and every rule
       below for one kind of link still wins over it. */
    :where(a:any-link) { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
    a:visited { color: var(--link); }
    /* Lists of links keep the text colour, followed or not: every item in them
       is a link anyway. .outline is a book's home page, the outline genbook
       writes. */
    .post-list li > a, .outline a, .tag-list a, .search-results a { color: var(--fg); }

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

    /* The browser numbers the <ol>; the padding holds the markers, 10 to 99 flush.
       A book's outline lists its pages the same way. */
    .post-list, .outline ol { padding-inline-start: 1.7em; }
    .post-list li, .outline li { margin-bottom: 0.5rem; }
    .post-list li::marker, .outline li::marker { color: var(--muted); }
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
    /* All posts: in the middle, or on a phone on a row of its own. */
    .post-nav-home { text-align: center; }
    @media (max-width: 36rem) {
        .post-nav { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
        .post-nav-home { grid-row: 2; grid-column: 1 / -1; }
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
            folder: Zola leaves that folder out of its ancestors. None in a book: its
            only folder, unlisted/, is a redirect home, not a page. -#}
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

# The numbered lists (post_list), the contents box, videos, and bare addresses
# as links. Zola gives templates no weights, so front_value reads them from the
# files.
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
# In book mode, the outline genbook writes into content/_index.md, and no list.
render_index_html() {
    cat << 'EOF'
{% extends "base.html" %}

{% block title %}{{ config.title }}{% endblock %}

{#- The description, as a strapline under the name. -#}
{% block masthead_extra %}{% if config.description %}<p class="tagline">{{ config.description }}</p>{% endif %}{% endblock %}

{% block content %}
{#- Hidden, not deleted: the page keeps one h1 for the outline and screen readers. -#}
<h1 class="visually-hidden">{{ config.title }}</h1>

{%- if config.extra.book %}
{#- The outline: parts and names as headings, pages as numbered lists. -#}
<div class="outline">{{<linkify html={section.content} />}}</div>
{%- else %}
{#- Whatever is written below the front matter of content/_index.md. -#}
{{<linkify html={section.content} />}}

{{<post_list pages={section.pages} extra={config.extra} folders={section.subsections} section={section.relative_path} />}}
{%- endif %}
{% endblock %}
EOF
}

# A post, or any other page: title, date line, text, tags, then Previous and Next.
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

{#- Previous and Next: the pages either side of this one in its section's list,
    Zola's lower and higher, which leave out folders and hidden pages. None on a
    page no list shows, such as About; the masthead already leads home. In a
    book, the way back to the outline is Contents. -#}
{%- if page.lower or page.higher %}
<nav class="post-nav" aria-label="Previous and next">
<div class="post-nav-prev">{% if page.lower %}<a href="{{ page.lower.permalink }}"><span class="label">&larr;&nbsp;Previous</span>{{ page.lower.title }}</a>{% endif %}</div>
<div class="post-nav-home"><a href="{{ get_url(path='/', trailing_slash=true) }}">{% if config.extra.book %}Contents{% else %}All posts{% endif %}</a></div>
<div class="post-nav-next">{% if page.higher %}<a href="{{ page.higher.permalink }}"><span class="label">Next</span>{{ page.higher.title }}&nbsp;&rarr;</a>{% endif %}</div>
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

# Vars: ZOLA_VERSION, ZOLA_SHA256, CHECKOUT_USES, UPLOAD_USES, DEPLOY_USES, from
# lookup_releases. \${{...}} and \$ keep Actions and runner syntax literal.
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
          # GitHub's digest for these bytes, which setup checked and pinned. No
          # fallback, no skip.
          echo "${ZOLA_SHA256}  zola.tar.gz" | sha256sum -c -
          # The binary alone: the archive's licence files and man pages would
          # land in the checkout.
          tar xzf zola.tar.gz zola
          # The ./build the author runs: the link check, then the build.
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
# Entry point (guarded so the file can be sourced to unit-test a render_*)
# =============================================================================
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

````