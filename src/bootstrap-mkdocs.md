<div class="mdb-wide"></div>

# Bootstrap-mkdocs script

The script creates a MkDocs documentation project that builds one set of Markdown sources once per audience: **internal**, **partner**, **beta** and **public**. Every page says which audiences get it, as in `audiences: [public]`, and you can mark parts of a page with `<!-- audience: internal -->...<!-- /audience -->`; each build keeps or removes them. For more details, see [Publish a documentation site](./publish-docs.md).

````bash
#!/usr/bin/env bash
# bootstrap-docs, v32: create a multi-audience MkDocs documentation project,
# check it, and open a live preview in your browser.
#
# Edit the CONFIG block below, save, then run:
#   bash bootstrap-docs.sh
#
# It creates PROJECT_DIR/PROJECT_NAME and puts everything inside it, builds
# and checks every audience, then serves the internal build on 127.0.0.1 and
# opens it in your browser. Ctrl-C stops the preview; bin/serve starts it
# again later.
#
# Run it again at any time. It adds what's missing and brings the files it
# owns up to date: the plugin, bin/, the theme, the banner template and the
# CI workflow. It never touches docs/ pages, mkdocs.yml or requirements.txt,
# and it stops rather than overwrite a file it owns that you have edited. It
# refuses to use a non-empty folder it didn't create.
#
# The first run needs network access: it installs MkDocs, Material, fontTools
# and the packages they need from PyPI into the project's .venv, and downloads
# the Charter font from practicaltypography.com, which it uses only if it
# matches the checksum below (CHARTER_ZIP_SHA256). Later runs of this version
# work offline.
#
# The mkdocs-audience plugin is part of the project it creates
# (plugins/mkdocs-audience/), so nothing has to be published first.
# Guide: bootstrap-docs-guide_v32.md, which comes with this script.

# Under sh (dash) or zsh, the bash syntax below fails with cryptic errors.
# This test is plain POSIX, so any shell can run it.
if [ -z "${BASH_VERSION:-}" ]; then
    echo "run this script with bash: bash bootstrap-docs.sh" >&2
    exit 2
fi

set -euo pipefail

# Everything below is one block, which bash reads whole before running any of
# it: a copy of this file that was cut off fails with a syntax error and does
# nothing, instead of running part of the script.
{

SCRIPT_VERSION=32

# ===========================================================================
# CONFIG: edit this block, save, then run the script
# ===========================================================================

# Where the project goes: a folder named PROJECT_NAME inside PROJECT_DIR.
# PROJECT_DIR must exist; ~ is allowed. PROJECT_NAME is also the site title.
PROJECT_DIR="$HOME/Desktop"
PROJECT_NAME="audience-docs"
SITE_URL="https://example.com/"
COPYRIGHT="Copyright &copy; 2026"

# Git repository URL. When set, every build, public included, links to it from
# the header, so leave it empty while the repository is private. EDIT_URI is
# used only if you also turn on Material's "Edit this page" buttons
# (content.action.edit under theme.features in mkdocs.yml).
REPO_URL=""
EDIT_URI="edit/main/docs/"

# Audiences. internal and public are always included.
WANT_PARTNER=true
WANT_BETA=true

# Features. All on by default; set any to false to leave it out.
WANT_DESIGN=true          # theme: Charter, teal and orange, green logo, review marks
WANT_DEMO=true            # demo pages: API overview, partner guide, beta page, runbook
WANT_EXAMPLES=true        # marker reference page (internal-only)
WANT_OVERRIDES=true       # build banner on internal, partner and beta builds
WANT_CI=true              # GitHub Actions workflow that builds and checks every audience
WANT_LEAK_CHECK=true      # bin/check-leaks.py: build every audience, fail on any leak
WANT_STRICT=true          # strict: true in mkdocs.yml (warnings fail the build)
WANT_PIN=true             # pin MkDocs and Material minor versions in requirements.txt

# When it's done: serve the internal build and open it in your browser.
# Needs a terminal; Ctrl-C stops it. false: just print how to start it.
# For one run, in front of the command: WANT_SERVE=false bash bootstrap-docs.sh
WANT_SERVE="${WANT_SERVE:-true}"

# ===========================================================================
# END CONFIG
# ===========================================================================

# For one run, in front of the command, to replace files this script owns
# even though you have edited them (a copy of each goes to
# .bootstrap-docs-backup/ first):
#   REGENERATE_OWNED=true bash bootstrap-docs.sh
REGENERATE_OWNED="${REGENERATE_OWNED:-false}"

# For one run, in front of the command, to take the Charter font from a copy
# of its release you saved yourself, instead of downloading it. The checksum
# still applies:
#   CHARTER_ZIP="$HOME/Downloads/Charter 210112.zip" bash bootstrap-docs.sh
CHARTER_ZIP="${CHARTER_ZIP:-}"

# A path with your home folder written as ~, for messages.
shown() {
    case "$1" in
        "$HOME") printf '%s' "~" ;;
        "$HOME"/*) printf '%s' "~${1#"$HOME"}" ;;
        *) printf '%s' "$1" ;;
    esac
}

# Derived from the CONFIG block. Expand a leading ~ (bash doesn't, inside
# quotes) and make the path absolute.
case "$PROJECT_DIR" in
    \~) PROJECT_DIR="$HOME" ;;
    \~/*) PROJECT_DIR="$HOME/${PROJECT_DIR#\~/}" ;;
esac
case "$PROJECT_DIR" in
    /*) ;;
    *) PROJECT_DIR="$PWD/$PROJECT_DIR" ;;
esac
# The same for CHARTER_ZIP, which the run reads from inside the project.
case "$CHARTER_ZIP" in
    \~/*) CHARTER_ZIP="$HOME/${CHARTER_ZIP#\~/}" ;;
    ""|/*) ;;
    *) CHARTER_ZIP="$PWD/$CHARTER_ZIP" ;;
esac
PROJECT_PATH="${PROJECT_DIR%/}/$PROJECT_NAME"
SHOWN_PATH=$(shown "$PROJECT_PATH")

STAMP_FILE=".bootstrap-docs"
MANIFEST=".bootstrap-docs.manifest"
INSTALLER=""
BACKUP_DIR=""
EXISTING=""
OWNED_WRITTEN=0
OWNED_UPDATED=0
OWNED_SAME=0
declare -A OWNED_DONE=()    # owned files this run has written or found up to date

log()  { printf '[bootstrap] %s\n' "$*"; }
note() { printf '[bootstrap] note: %s\n' "$*"; }
die()  { printf '[bootstrap] error: %s\n' "$*" >&2; exit 1; }

# Run from a saved file, not piped from curl: the CONFIG block is meant to be
# read and edited first, and a re-run needs the same file.
if [ ! -f "${BASH_SOURCE[0]:-}" ]; then
    die "run bootstrap-docs from its saved file (bash bootstrap-docs.sh), not piped from curl"
fi
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"

main() {
    # Ctrl-C ends the run even when the command it interrupts, such as pip,
    # catches it and exits normally.
    trap 'exit 130' INT
    validate_config
    log "project: $SHOWN_PATH"
    log "audiences: $(audience_list ', ')"
    if [ $# -gt 0 ]; then
        note "ignoring arguments ($*); settings live in the CONFIG block at the top of this script"
    fi
    check_prerequisites
    prepare_project_dir
    check_owned_drift
    if [ -n "$EXISTING" ]; then
        log "$SHOWN_PATH was created by bootstrap-docs; adding what's missing and updating the files this script owns"
    fi
    # From here on, however the run ends (an error, Ctrl-C), the manifest
    # records what it wrote, so the next run doesn't mistake that for an edit.
    # A second Ctrl-C can't cut that short.
    trap 'trap "" INT TERM; record_owned' EXIT
    make_venv
    scaffold_plugin
    install_deps
    write_requirements
    scaffold_gitignore
    scaffold_mkdocs_yml
    scaffold_pages
    if $WANT_DESIGN; then scaffold_design; fi
    if $WANT_OVERRIDES; then scaffold_overrides; fi
    if $WANT_LEAK_CHECK; then scaffold_leak_check; fi
    if $WANT_CI; then scaffold_ci; fi
    scaffold_serve
    write_manifest
    finish
}

validate_config() {
    case "$PROJECT_NAME" in
        ""|.*|-*|*[!A-Za-z0-9._-]*)
            die "PROJECT_NAME must be a folder name made of letters, digits, dots, hyphens
  and underscores, not starting with a dot or a hyphen (got '$PROJECT_NAME')" ;;
    esac
    local v
    for v in WANT_PARTNER WANT_BETA WANT_DESIGN WANT_DEMO WANT_EXAMPLES WANT_OVERRIDES \
             WANT_CI WANT_LEAK_CHECK WANT_STRICT WANT_PIN WANT_SERVE REGENERATE_OWNED; do
        case "${!v}" in
            true|false) ;;
            *) die "$v must be true or false (got '${!v}')" ;;
        esac
    done
    if [ ! -d "$PROJECT_DIR" ]; then
        die "PROJECT_DIR ($PROJECT_DIR) is not a folder that exists. Create it, or set
  PROJECT_DIR in the CONFIG block to one that does."
    fi
}

# audience_list SEP: every audience in build order
audience_list() {
    local sep="$1" out="internal"
    if $WANT_PARTNER; then out="${out}${sep}partner"; fi
    if $WANT_BETA; then out="${out}${sep}beta"; fi
    printf '%s' "${out}${sep}public"
}

# external_list: audiences a shared page is tagged for
external_list() {
    local out="public"
    if $WANT_PARTNER; then out="${out}, partner"; fi
    if $WANT_BETA; then out="${out}, beta"; fi
    printf '%s' "$out"
}

# write_once PATH < content: write a file only if it doesn't exist yet
write_once() {
    local path="$1"
    if [ -e "$path" ]; then
        cat >/dev/null
        log "exists, left alone: $path"
        return 0
    fi
    mkdir -p "$(dirname "$path")"
    cat > "$path"
    log "wrote $path"
}

# ---------------------------------------------------------------------------
# Files this script owns. They are written on every run, and the manifest
# records what each run wrote, so the next run can tell an edit from an update.
# ---------------------------------------------------------------------------

# The owned set, given the CONFIG block. A file a run doesn't write isn't
# claimed, so turning a feature off leaves its files to you.
owned_paths() {
    local f
    for f in pyproject.toml README.md LICENSE .gitignore mkdocs_audience/__init__.py \
             mkdocs_audience/plugin.py tests/test_plugin.py; do
        printf '%s\n' "plugins/mkdocs-audience/$f"
    done
    printf '%s\n' bin/serve
    if $WANT_LEAK_CHECK; then printf '%s\n' bin/check-leaks.py; fi
    if $WANT_DESIGN; then
        printf '%s\n' docs/assets/styles/extra.css docs/assets/favicon.svg \
            docs/assets/fonts/charter_regular.woff2 docs/assets/fonts/charter_italic.woff2 \
            docs/assets/fonts/charter_bold.woff2 docs/assets/fonts/charter_bold_italic.woff2 \
            docs/assets/fonts/LICENSE-Charter.txt
        if owns_nav_titles; then
            printf '%s\n' docs/assets/styles/nav-titles.css
        fi
    fi
    if $WANT_OVERRIDES; then printf '%s\n' overrides/main.html; fi
    if $WANT_CI; then printf '%s\n' .github/workflows/build.yml; fi
}

# nav-titles.css was written by v27 and earlier, whose mkdocs.yml still lists
# it. The script owns it in a project one of those versions made, as the
# folder's stamp records; a file of that name in a newer project stays yours.
owns_nav_titles() {
    [ -e docs/assets/styles/nav-titles.css ] || return 1
    local made
    made=$(sed -n 's/^Created by bootstrap-docs v\([0-9][0-9]*\).*/\1/p' "$STAMP_FILE" 2>/dev/null)
    [ -n "$made" ] && [ "$made" -lt 28 ]
}

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d' ' -f1
    else
        python3 -c 'import hashlib, sys; print(hashlib.sha256(open(sys.argv[1], "rb").read()).hexdigest())' "$1"
    fi
}

# Stop before overwriting a hand edit. Each owned file is compared with what
# the last run wrote (the manifest), not with what this run would write, so a
# changed setting or a newer script never looks like an edit. A project with
# no manifest was made by v27 or earlier, which kept no record: every owned
# file there counts as edited. Runs before anything is installed or written,
# so "nothing has been changed" is true.
check_owned_drift() {
    if $REGENERATE_OWNED; then
        return 0
    fi
    local path recorded no_manifest="" drifted=()
    if [ ! -f "$MANIFEST" ]; then
        no_manifest=1
    fi
    while IFS= read -r path; do
        # A missing file isn't an edit, nor is a Charter file as v28 wrote
        # it: the run corrects it without losing anything.
        if [ ! -f "$path" ] || charter_uncorrected "$path"; then
            continue
        fi
        if [ -n "$no_manifest" ]; then
            drifted+=("$path")
            continue
        fi
        recorded=$(recorded_sha256 "$path")
        if [ -z "$recorded" ] || [ "$(sha256_of "$path")" != "$recorded" ]; then
            drifted+=("$path")
        fi
    done < <(owned_paths)
    if [ ${#drifted[@]} -eq 0 ]; then
        return 0
    fi
    {
        echo
        if [ -n "$no_manifest" ]; then
            log "this project has no $MANIFEST: an earlier version of this script made"
            log "it and kept no record of what it wrote, so an edit can't be told from an"
            log "update. These files are the ones this script owns:"
        else
            log "these files don't match what this script last wrote there, so they may"
            log "hold your edits, and this run would overwrite them:"
        fi
        printf '    %s\n' "${drifted[@]}"
        log "to replace them with this version's files, keeping a copy of each in"
        log ".bootstrap-docs-backup/, run once:"
        printf '    REGENERATE_OWNED=true bash %s\n' "$SCRIPT_NAME"
        log "to keep an edit instead, move your changes into a file of your own first"
        log "(see the guide). Nothing has been changed."
    } >&2
    exit 1
}

# Keep a copy of an owned file a forced run is about to replace.
backup_owned() {
    local path="$1"
    if [ -z "$BACKUP_DIR" ]; then
        BACKUP_DIR=".bootstrap-docs-backup/$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        # Git ignores the folder from inside, whatever your .gitignore says.
        if [ ! -f .bootstrap-docs-backup/.gitignore ]; then
            printf '*\n' > .bootstrap-docs-backup/.gitignore
        fi
    fi
    mkdir -p "$BACKUP_DIR/$(dirname "$path")"
    cp -p "$path" "$BACKUP_DIR/$path"
}

# put_owned PATH COMMAND...: write COMMAND's output to PATH, unless PATH holds it already.
# A file counts as this run's from the moment its old content is safe: the
# drift check found it unedited, or a forced run has backed it up. So a run
# cut off while writing it records it, and the next run rewrites it.
put_owned() {
    local path="$1"
    shift
    if [ -f "$path" ] && cmp -s "$path" <("$@"); then
        OWNED_DONE["$path"]=1
        OWNED_SAME=$((OWNED_SAME + 1))
    elif [ -e "$path" ]; then
        if $REGENERATE_OWNED; then
            backup_owned "$path"
        fi
        OWNED_DONE["$path"]=1
        "$@" > "$path"
        OWNED_UPDATED=$((OWNED_UPDATED + 1))
        log "updated $path"
    else
        mkdir -p "$(dirname "$path")"
        OWNED_DONE["$path"]=1
        "$@" > "$path"
        OWNED_WRITTEN=$((OWNED_WRITTEN + 1))
        log "wrote $path"
    fi
}

# write_owned PATH < text
write_owned() {
    local content
    content=$(cat; printf x)
    put_owned "$1" printf '%s' "${content%x}"
}

# The recorded sha256 of PATH in the manifest; empty if it has none.
recorded_sha256() {
    if [ -f "$MANIFEST" ]; then
        awk -v p="$1" '$2 == p { print $1; exit }' "$MANIFEST"
    fi
}

# Write the manifest. An owned file this run has written, or found up to date,
# is recorded as it is now. One it hasn't reached yet keeps its old record, so
# a run that stops early leaves a record the next run can trust. A file no
# longer owned (its feature turned off) keeps its record too, so turning the
# feature back on can still tell an edit from an update.
record_owned() {
    local path recorded lines=() owned=()
    local -A is_owned=()
    mapfile -t owned < <(owned_paths)
    for path in "${owned[@]}"; do
        is_owned["$path"]=1
        if [ -n "${OWNED_DONE[$path]:-}" ] && [ -f "$path" ]; then
            lines+=("$(sha256_of "$path")  $path")
        else
            recorded=$(recorded_sha256 "$path")
            if [ -n "$recorded" ]; then
                lines+=("$recorded  $path")
            fi
        fi
    done
    if [ -f "$MANIFEST" ]; then
        while read -r recorded path; do
            case "$recorded" in "#"*|"") continue ;; esac
            if [ -f "$path" ] && [ -z "${is_owned[$path]:-}" ]; then
                lines+=("$recorded  $path")
                is_owned["$path"]=1
            fi
        done < "$MANIFEST"
    fi
    {
        echo "# Written by bootstrap-docs: the sha256 and path of each file it owns. Keep it in Git."
        if [ ${#lines[@]} -gt 0 ]; then
            printf '%s\n' "${lines[@]}"
        fi
    } > "$MANIFEST.new"
    mv -f "$MANIFEST.new" "$MANIFEST"
}

# Record what this run left on disk, once every owned file is in place.
write_manifest() {
    record_owned
    log "files this script owns: $OWNED_WRITTEN written, $OWNED_UPDATED updated, $OWNED_SAME already up to date"
    if [ -n "$BACKUP_DIR" ]; then
        log "copies of the files it replaced: $BACKUP_DIR/"
    fi
}

check_prerequisites() {
    local missing=()
    command -v python3 >/dev/null 2>&1 || missing+=(python3)
    if ! command -v uv >/dev/null 2>&1; then
        # Without uv, Python's built-in venv needs ensurepip, which Debian and
        # Devuan ship in the python3-venv package.
        python3 -m ensurepip --version >/dev/null 2>&1 || missing+=(python3-venv)
    fi
    if [ ${#missing[@]} -gt 0 ]; then
        offer_system_install "${missing[@]}"
    fi
    python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
        || die "Python 3.10 or newer is required (found $(python3 --version 2>&1))"
    local pyver
    pyver=$(python3 -c 'import platform; print(platform.python_version())')
    if command -v uv >/dev/null 2>&1; then
        log "prerequisites: ok (python $pyver; uv found, so no python3-venv needed)"
    else
        log "prerequisites: ok (python $pyver; using python3 -m venv)"
    fi
}

# Offer to install missing system packages with sudo apt-get. Asks first;
# the default answer is no. Never runs without a terminal to ask on.
offer_system_install() {
    local pkgs=("$@") apt_pkgs=() p
    for p in "${pkgs[@]}"; do
        case "$p" in
            python3) apt_pkgs+=(python3-full) ;;
            *) apt_pkgs+=("$p") ;;
        esac
    done
    local cmd=(sudo apt-get install -y "${apt_pkgs[@]}")
    if ! command -v apt-get >/dev/null 2>&1; then
        die "missing system packages: ${pkgs[*]}
  This system has no apt-get. Install the equivalents with your package
  manager, then re-run this script."
    fi
    if ! command -v sudo >/dev/null 2>&1; then
        die "missing system packages: ${pkgs[*]}
  sudo is not installed. As root, run:  apt-get install -y ${apt_pkgs[*]}
  Then re-run this script."
    fi
    printf '\n[bootstrap] missing system packages: %s\n' "${pkgs[*]}"
    printf '[bootstrap] to install them, this script would run:\n    %s\n' "${cmd[*]}"
    printf '[bootstrap] sudo will ask for your password.\n\n'
    if [ ! -t 0 ]; then
        die "no terminal to ask on. Run it yourself:  ${cmd[*]}
  Then re-run this script."
    fi
    local reply
    read -r -p "[bootstrap] run it now? (y/N): " reply
    case "$reply" in
        y|Y|yes|YES) ;;
        *) die "declined. Run it yourself:  ${cmd[*]}
  Then re-run this script." ;;
    esac
    log "running: ${cmd[*]}"
    "${cmd[@]}" || die "the install failed (see the output above). Common causes: no network,
  another package manager holding the apt lock, or a wrong password.
  Fix that, then re-run this script."
    local still=()
    command -v python3 >/dev/null 2>&1 || still+=(python3)
    if ! command -v uv >/dev/null 2>&1; then
        python3 -m ensurepip --version >/dev/null 2>&1 || still+=(python3-venv)
    fi
    if [ ${#still[@]} -gt 0 ]; then
        die "the install finished but these are still missing: ${still[*]}
  Try:  sudo apt-get install --reinstall ${apt_pkgs[*]}"
    fi
    log "system packages installed"
}

prepare_project_dir() {
    if [ -e "$PROJECT_PATH" ] && [ ! -d "$PROJECT_PATH" ]; then
        die "'$SHOWN_PATH' exists and is not a folder. Change PROJECT_NAME or PROJECT_DIR in the CONFIG block."
    fi
    if [ -d "$PROJECT_PATH" ] && [ ! -f "$PROJECT_PATH/$STAMP_FILE" ] \
       && [ -n "$(ls -A "$PROJECT_PATH" 2>/dev/null)" ]; then
        die "$SHOWN_PATH already exists and was not created by this script.
  Nothing was changed. Choose another PROJECT_NAME in the CONFIG block, or
  move that folder out of the way yourself."
    fi
    if [ -f "$PWD/$PROJECT_NAME/$STAMP_FILE" ] && [ "$PWD/$PROJECT_NAME" != "$PROJECT_PATH" ]; then
        # v27 and earlier made the project in the folder they ran from.
        note "./$PROJECT_NAME here is a project made by bootstrap-docs, but this run works
  on the one at $SHOWN_PATH. To work on ./$PROJECT_NAME instead, set
  PROJECT_DIR=\"$(shown "$PWD")\" in the CONFIG block and run this script again."
    fi
    if [ -f "$PROJECT_PATH/$STAMP_FILE" ]; then
        EXISTING=1
    fi
    mkdir -p "$PROJECT_PATH"
    cd "$PROJECT_PATH"
    if [ ! -f "$STAMP_FILE" ]; then
        printf 'Created by bootstrap-docs v%s. Re-runs use this file to recognise the folder.\n' \
            "$SCRIPT_VERSION" > "$STAMP_FILE"
    fi
}

# Create or reuse .venv. Never deletes anything.
make_venv() {
    if [ -e .venv ]; then
        if [ -x .venv/bin/python ] && .venv/bin/python -c 'import sys' >/dev/null 2>&1; then
            log ".venv exists and works; reusing it"
        else
            die ".venv exists but has no working Python (.venv/bin/python).
  This script won't delete it. If you don't need that folder, remove it
  yourself and re-run:
    rm -rf \"$PWD/.venv\""
        fi
    elif command -v uv >/dev/null 2>&1; then
        uv venv --quiet --python python3 .venv
        log ".venv created with uv"
    else
        python3 -m venv .venv
        log ".venv created with python3 -m venv"
    fi
}

# uv when available; otherwise the venv's own pip.
pick_installer() {
    if command -v uv >/dev/null 2>&1; then
        INSTALLER=uv
    elif .venv/bin/python -m pip --version >/dev/null 2>&1; then
        INSTALLER=pip
    elif .venv/bin/python -m ensurepip --upgrade --default-pip >/dev/null 2>&1 \
         && .venv/bin/python -m pip --version >/dev/null 2>&1; then
        # A run stopped while python3 -m venv was making .venv leaves it without pip.
        log ".venv had no pip; added it with ensurepip"
        INSTALLER=pip
    else
        die ".venv has no pip, and uv is not installed, so nothing can be installed into it.
  Install uv, or remove .venv yourself and re-run so it is recreated with pip:
    rm -rf \"$PWD/.venv\""
    fi
}

venv_install() {
    if [ "$INSTALLER" = uv ]; then
        uv pip install --quiet --python .venv/bin/python "$@"
    else
        .venv/bin/python -m pip install --quiet "$@"
    fi
}

pkg_version() {
    .venv/bin/python -c 'import importlib.metadata as m, sys; print(m.version(sys.argv[1]))' "$1" 2>/dev/null \
        || printf '?'
}

# Install the plugin, MkDocs and Material, unless they're already in .venv.
# Skipping the install is what lets a re-run work offline. A plugin whose
# version changed is installed again, so pip reports the version in use.
install_deps() {
    local plugin mk mat want
    plugin=$(pkg_version mkdocs-audience)
    mk=$(pkg_version mkdocs)
    mat=$(pkg_version mkdocs-material)
    want=$(sed -n 's/^version = "\(.*\)"$/\1/p' plugins/mkdocs-audience/pyproject.toml)
    if [ "$plugin" != "?" ] && [ "$mk" != "?" ] && [ "$mat" != "?" ]; then
        if [ "$plugin" = "$want" ]; then
            log "already installed in .venv: mkdocs-audience $plugin, mkdocs $mk, mkdocs-material $mat"
            return 0
        fi
        pick_installer
        if venv_install -e ./plugins/mkdocs-audience; then
            log "updated in .venv with $INSTALLER: mkdocs-audience $plugin -> $(pkg_version mkdocs-audience)"
        else
            note "could not reinstall the plugin (offline?). It is installed in editable mode, so
  version $want's code is in use already; only the version pip reports stays $plugin."
        fi
        return 0
    fi
    pick_installer
    if [ "$INSTALLER" = pip ]; then
        .venv/bin/python -m pip install --quiet --upgrade pip
    fi
    # A project that has a requirements.txt, such as a fresh clone, installs
    # from it, so its pins hold.
    local spec=(-e ./plugins/mkdocs-audience mkdocs-material)
    if [ -f requirements.txt ]; then
        spec=(-r requirements.txt)
    fi
    if ! venv_install "${spec[@]}"; then
        echo >&2
        die "installing packages failed (see the output above). The plugin installs from
  ./plugins/mkdocs-audience; MkDocs and Material come from PyPI, so check your network,
  then run this script again."
    fi
    log "installed with $INSTALLER: mkdocs-audience $(pkg_version mkdocs-audience) (from ./plugins), mkdocs $(pkg_version mkdocs), mkdocs-material $(pkg_version mkdocs-material)"
}

write_requirements() {
    if [ -e requirements.txt ]; then
        log "exists, left alone: requirements.txt"
        return 0
    fi
    local mk mat
    mk=$(pkg_version mkdocs)
    mat=$(pkg_version mkdocs-material)
    {
        echo "# Install with:  pip install -r requirements.txt   (or: uv pip install -r requirements.txt)"
        echo "# The audience plugin is part of this project: ./plugins/mkdocs-audience"
        if $WANT_PIN; then
            echo "# MkDocs and Material are pinned to the minor versions bootstrap-docs installed;"
            echo "# patch releases still apply. Project pages:"
            echo "#   https://pypi.org/project/mkdocs/"
            echo "#   https://pypi.org/project/mkdocs-material/"
            echo "mkdocs~=${mk%.*}.0"
            echo "mkdocs-material~=${mat%.*}.0"
        else
            echo "mkdocs<2"
            echo "mkdocs-material"
        fi
        echo "-e ./plugins/mkdocs-audience"
    } > requirements.txt
    log "wrote requirements.txt"
}

scaffold_gitignore() {
    write_once .gitignore <<'BD_GITIGNORE_EOF'
.venv/
dist/
site/
__pycache__/
*.egg-info/
.pytest_cache/
BD_GITIGNORE_EOF
}

scaffold_mkdocs_yml() {
    if [ -e mkdocs.yml ]; then
        log "exists, left alone: mkdocs.yml"
        # Projects made by v27 and earlier have no default audience, so a
        # build without MKDOCS_AUDIENCE builds the first one listed: internal.
        if ! grep -Eq '^[[:space:]]+audience:[[:space:]]*["'\'']?[A-Za-z0-9_-]' mkdocs.yml; then
            note "mkdocs.yml names no default audience, so a build without MKDOCS_AUDIENCE
  (a plain mkdocs build, or mkdocs gh-deploy) builds the first audience in
  audiences:, which is internal. Add this line under audiences: in the
  audience plugin's settings, indented the same way:
      audience: public"
        fi
        return 0
    fi
    local repo_block custom_dir look_block css_block nav_block strict
    if [ -n "$REPO_URL" ]; then
        repo_block="repo_url: $REPO_URL
edit_uri: $EDIT_URI"
    else
        repo_block="# repo_url links the repository from the header of every build, public included.
# \"Edit this page\" buttons also need content.action.edit under theme.features.
# repo_url: https://github.com/your-org/your-repo
# edit_uri: $EDIT_URI"
    fi
    custom_dir=""
    if $WANT_OVERRIDES; then custom_dir="
  custom_dir: overrides"; fi
    look_block=""
    if $WANT_DESIGN; then
        look_block="
  logo: assets/favicon.svg
  favicon: assets/favicon.svg"
        css_block="extra_css:
  - assets/styles/extra.css"
    else
        css_block="# extra_css:
#   - assets/styles/your-styles.css"
    fi
    nav_block="nav:
  - Home: index.md"
    if $WANT_DEMO; then
        nav_block="${nav_block}
  - API:
    - Overview: api/overview.md"
        if $WANT_PARTNER; then nav_block="${nav_block}
  - Integrations:
    - Partners: integrations/partners.md"; fi
        if $WANT_BETA; then nav_block="${nav_block}
  - Features:
    - Beta: features/beta.md"; fi
        nav_block="${nav_block}
  - Operations:
    - Runbook: operations/runbook.md"
    fi
    if $WANT_EXAMPLES; then nav_block="${nav_block}
  - Reference:
    - Audience examples: examples/audience-examples.md"; fi
    strict="strict: false"
    if $WANT_STRICT; then strict="strict: true"; fi

    cat > mkdocs.yml <<EOF
site_name: "$PROJECT_NAME"
site_url: $SITE_URL
copyright: "$COPYRIGHT"

$repo_block

$strict

theme:
  name: material${custom_dir}
  font: false               # never load Google Fonts${look_block}
  features:
    - navigation.footer
    - navigation.expand
    - navigation.instant
    - navigation.tracking
    - content.code.copy
    - search.highlight
    - search.suggest
  palette:
    - media: "(prefers-color-scheme)"
      toggle:
        icon: material/brightness-auto
        name: Switch to light mode
      primary: teal
      accent: deep orange
    - media: "(prefers-color-scheme: light)"
      scheme: default
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
      primary: teal
      accent: deep orange
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      toggle:
        icon: material/brightness-4
        name: Switch to system preference
      primary: teal
      accent: deep orange

plugins:
  - search
  - audience:
      audiences: [$(audience_list ', ')]
      audience: public          # the build you get without MKDOCS_AUDIENCE
      untagged: error           # a page that names no audiences stops the build

markdown_extensions:
  - attr_list
  - md_in_html
  - admonition
  - tables
  - def_list
  - pymdownx.smartsymbols
  - pymdownx.superfences
  - pymdownx.tabbed:
      alternate_style: true
  - pymdownx.highlight:
      anchor_linenums: true
  - toc:
      permalink: true
      permalink_title: Anchor link to this section
      toc_depth: 4

# Never copy editor backups, or pages saved with an upper-case extension, into
# a build: MkDocs doesn't treat them as pages, so it would publish them as they
# are. Add your own lines; see the guide.
exclude_docs: |
  *~
  \#*#
  *.bak
  *.orig
  *.MD

$css_block

$nav_block
EOF
    log "wrote mkdocs.yml"
}

scaffold_index() {
    if [ -e docs/index.md ]; then
        log "exists, left alone: docs/index.md"
        return 0
    fi
    mkdir -p docs
    {
        printf -- '---\naudiences: [%s]\n---\n\n' "$(external_list)"
        printf '# %s\n\n' "$PROJECT_NAME"
        echo "Welcome."
        echo "This site is built from one set of Markdown sources, once per audience."
        if $WANT_DEMO; then
            echo "Start with the [API overview](api/overview.md)."
        fi
        echo
        echo "<!-- audience: internal -->"
        echo "## Internal note"
        echo
        echo "Only the internal build shows this block."
        if $WANT_DESIGN; then
            echo "It is also the only build that marks content: the rule beside each marked block, and the note above it, say which other builds include it."
        fi
        if $WANT_EXAMPLES; then
            echo "Authoring reference: [Audience examples](examples/audience-examples.md)."
        fi
        if $WANT_DEMO; then
            echo "On-call procedures: [Operations runbook](operations/runbook.md)."
        fi
        echo "<!-- /audience -->"
        if $WANT_DEMO && $WANT_PARTNER; then
            echo
            echo "<!-- audience: partner -->"
            echo "**Partners:** start with the [Partner integration guide](integrations/partners.md)."
            echo "It covers keys, webhooks and rate limits."
            echo "<!-- /audience -->"
        fi
        if $WANT_DEMO && $WANT_BETA; then
            echo
            echo "<!-- audience: beta -->"
            echo "**Beta testers:** see [Beta features](features/beta.md)."
            echo "Expect changes before general release."
            echo "<!-- /audience -->"
        fi
    } > docs/index.md
    log "wrote docs/index.md"
}

scaffold_pages() {
    scaffold_index
    if $WANT_DEMO; then
        if [ -e docs/api/overview.md ]; then
            log "exists, left alone: docs/api/overview.md"
        else
            mkdir -p docs/api
            {
                printf -- '---\naudiences: [%s]\n---\n\n' "$(external_list)"
                cat <<'BD_API_EOF'
# API Overview

Public endpoints go here.

`GET /v1/users/{id}` returns user metadata.

<!-- audience: internal -->
## Internal: debug endpoints

Not exposed publicly.

`GET /_debug/health` returns dependency status.
<!-- /audience -->
BD_API_EOF
            } > docs/api/overview.md
            log "wrote docs/api/overview.md"
        fi
        if $WANT_PARTNER; then
        write_once docs/integrations/partners.md <<'BD_PARTNER_EOF'
---
title: Partner Integration Guide
audiences: [partner]
---

# Partner Integration Guide

Tagged `audiences: [partner]`: built only for partner (and internal).
Replace with real partner content.
BD_PARTNER_EOF
        fi
        if $WANT_BETA; then
        write_once docs/features/beta.md <<'BD_BETA_EOF'
---
title: Beta Features
audiences: [beta]
---

# Beta Features

Tagged `audiences: [beta]`: built only for beta (and internal).
Replace with real beta content.
BD_BETA_EOF
        fi
        if [ -e docs/operations/runbook.md ]; then
            log "exists, left alone: docs/operations/runbook.md"
        else
            write_once docs/operations/runbook.md <<'BD_RUNBOOK_EOF'
---
title: Operations Runbook
audiences: [internal]
---

# Operations Runbook

Tagged `audiences: [internal]`: built only for internal.
Replace with real internal content.

![On-call rota](rota.svg)

Only this page links to the rota image, `operations/rota.svg`, so only the internal build includes it.
Every other build leaves it out.
BD_RUNBOOK_EOF
            write_once docs/operations/rota.svg <<'BD_ROTA_EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="72" viewBox="0 0 320 72">
  <rect x="0.5" y="0.5" width="319" height="71" rx="4" fill="#ffffff" stroke="#737881"/>
  <text x="16" y="30" font-family="Charter, Georgia, serif" font-size="16" fill="#1d1e20">On-call rota</text>
  <text x="16" y="52" font-family="Charter, Georgia, serif" font-size="13" fill="#4a4e55">This week: primary A, secondary B</text>
</svg>
BD_ROTA_EOF
        fi
    fi
    if $WANT_EXAMPLES; then
        write_once docs/examples/audience-examples.md < <(examples_page)
    fi
}

# The marker reference page. What it says about this project's builds follows
# the CONFIG block; the syntax examples use the default audience names.
examples_page() {
    cat <<'BD_EXAMPLES_HEAD_EOF'
---
audiences: [internal]
---

# Audience examples

The authoring reference for this project's audience markers.
This page is tagged `audiences: [internal]`, so only the internal build includes it.

## How builds work

Each build targets one audience.
To preview one in your browser, with live reload:

```bash
bin/serve public
```

BD_EXAMPLES_HEAD_EOF
    if $WANT_LEAK_CHECK; then
        cat <<'BD_EXAMPLES_ALL_EOF'
To see every build side by side, as each audience will get it:

```bash
bin/serve all
```

BD_EXAMPLES_ALL_EOF
    fi
    cat <<'BD_EXAMPLES_BUILD_EOF'
To build one into a folder, choose the audience with the `MKDOCS_AUDIENCE` variable:

```bash
MKDOCS_AUDIENCE=public .venv/bin/mkdocs build --site-dir dist/public
```

Without the variable, this project builds the public site.

BD_EXAMPLES_BUILD_EOF
    echo "- \`internal\` sees everything, unless a marker excludes it with \`!internal\`."
    if $WANT_DESIGN; then
        echo "  In the internal build, every marked block has a rule beside it and a note above it naming the other audiences that get it, or \"Internal only\"."
    fi
    if $WANT_PARTNER && $WANT_BETA; then
        echo "- \`partner\` and \`beta\` see only pages and blocks tagged for them."
    elif $WANT_PARTNER; then
        echo "- \`partner\` sees only pages and blocks tagged for it."
    elif $WANT_BETA; then
        echo "- \`beta\` sees only pages and blocks tagged for it."
    fi
    echo "- \`public\` sees only pages and blocks tagged \`public\`, and blocks whose marker only excludes others, such as \`!beta\`."
    echo
    echo "The other builds carry no marks: their pages hold the content and nothing about who else sees it."
    echo
    cat <<'BD_EXAMPLES_BLOCK_EOF'
## Block markers

```markdown
<!-- audience: internal -->
## Internal-only section

Shown only in the internal build. Markdown inside renders normally.
<!-- /audience -->
```

BD_EXAMPLES_BLOCK_EOF
    if $WANT_DESIGN; then
        echo "In the internal build, a marker on a line of its own marks the block up to its closing marker."
        echo "A marker inside a line of text marks just that text: a tint that names its audiences when you point at it."
        echo
    fi
    cat <<'BD_EXAMPLES_RULES_EOF'
Markers match in any case, and don't nest.
A marker never closed, a closing marker with nothing to close, a marker opened inside another, and a comment that looks like a marker but isn't one, such as `<!-- audiences: internal -->`, each stop the build, since each would let marked text reach every build.

BD_EXAMPLES_RULES_EOF
    cat <<'BD_EXAMPLES_SYNTAX_EOF'
## Inline markers

```markdown
Your API key is <!-- audience: internal -->`sk_live_...` from the vault<!-- /audience --><!-- audience: public -->in your dashboard<!-- /audience -->.
```

## Several audiences

```markdown
<!-- audience: internal, partner -->
Shown to internal and partner.
<!-- /audience -->
```

## Negation

```markdown
<!-- audience: !beta -->
Shown to internal and public. Not to partner, not to beta.
<!-- /audience -->
```

A marker with only negations shows to public, and to internal unless it names `!internal`.
Every other audience must be named to see something.

## Combined

```markdown
<!-- audience: partner, !beta -->
Shown to internal and partner. Beta is excluded; public isn't named.
<!-- /audience -->
```

## Whole pages

```markdown
---
audiences: [partner]
---
```

Use a YAML list; a comma-separated string also works.
Every page names its audiences: a page that names none stops the build, which lists every such page, so a page whose tag was forgotten can't reach public.
BD_EXAMPLES_SYNTAX_EOF
    if $WANT_PARTNER && $WANT_BETA; then
        echo "To share a page with partners and beta testers too, tag it \`audiences: [$(external_list)]\`."
    elif $WANT_PARTNER; then
        echo "To share a page with partners too, tag it \`audiences: [$(external_list)]\`."
    elif $WANT_BETA; then
        echo "To share a page with beta testers too, tag it \`audiences: [$(external_list)]\`."
    fi
    cat <<'BD_EXAMPLES_TAIL_EOF'
A mistake that would leave a tagged page untagged, such as invalid YAML or a misspelt key, stops the build too, and names the page.

## Files that aren't pages

An image, a PDF or any other file that isn't a page goes into a build only if a page in that build links to it.
The internal build gets every file.
Files under `assets/`, and `CNAME`, `robots.txt` and `favicon.ico` at the top of `docs/`, go into every build.

## Linking to restricted pages

A link from a shared page to a page some audiences can't see breaks in their builds, and strict mode then fails the build.
Put such links inside a marker for the audiences that can see the target:

```markdown
<!-- audience: partner -->
Partners: see the [Partner integration guide](../integrations/partners.md).
It covers keys and webhooks.
<!-- /audience -->
```

A link to a heading inside a marker breaks too, in the builds that leave the heading out.
Put such a link inside a marker for the same audiences.

## Markers inside code

Markers are left exactly as written inside a fenced code block that starts at the left margin, and inside inline code in single backticks, which is how this page shows them.
In other code, such as a fence inside a list item or an admonition, or inline code in double backticks, a marker is acted on like any other.
BD_EXAMPLES_TAIL_EOF
    if $WANT_LEAK_CHECK; then
        cat <<'BD_EXAMPLES_CHECK_EOF'

## Checking for leaks

```bash
bin/check-leaks.py
```

It builds every audience and fails if a raw marker survived, an excluded page was built, any page or the search index points at an excluded page, a build holds a file none of its pages uses, or a link in a build leads to a page, file or anchor that isn't in it.
BD_EXAMPLES_CHECK_EOF
    fi
}

scaffold_plugin() {
    write_owned plugins/mkdocs-audience/pyproject.toml <<'BD_PYPROJECT_EOF'
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "mkdocs-audience"
version = "0.4.1"
description = "MkDocs plugin for filtering content by audience at build time"
readme = "README.md"
requires-python = ">=3.10"
license = { text = "MIT" }
authors = [{ name = "jake-47" }]
keywords = ["mkdocs", "mkdocs-plugin", "documentation", "audience", "conditional-content"]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: MIT License",
    "Operating System :: OS Independent",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Topic :: Documentation",
    "Topic :: Text Processing :: Markup :: Markdown",
]
dependencies = [
    "mkdocs>=1.5,<2",
    "PyYAML>=6.0",
]

[project.optional-dependencies]
dev = ["pytest>=7.0"]

[project.urls]
Homepage = "https://github.com/jake-47/mkdocs-audience"
Repository = "https://github.com/jake-47/mkdocs-audience"
Issues = "https://github.com/jake-47/mkdocs-audience/issues"

[project.entry-points."mkdocs.plugins"]
audience = "mkdocs_audience.plugin:AudiencePlugin"

[tool.hatch.build.targets.wheel]
packages = ["mkdocs_audience"]
BD_PYPROJECT_EOF
    write_owned plugins/mkdocs-audience/README.md <<'BD_README_EOF'
# mkdocs-audience

MkDocs plugin for audience-tagged docs. Mark sections of a page with `<!-- audience: internal -->...<!-- /audience -->`, and tag every page with `audiences: [public]`, `[partner]` and so on in frontmatter, and each build keeps or strips content for the audience you build for. Pages excluded from a build are also removed from your `nav:`, so their titles and links don't reach that build, and files that aren't pages reach a build only if something in it uses them. In the internal build, every marked block and span is wrapped in HTML that says which other audiences get it, so a theme can show reviewers who sees what; every other build gets the content alone.

About 790 lines of Python. Depends only on MkDocs 1.x and PyYAML.

Not a security boundary. The source still contains every audience's content; access control is your repository's job. Verify each build's output before publishing it.

## Platform support

- **MkDocs 1.x**: supported. The plugin requires `mkdocs>=1.5,<2`.
- **ProperDocs** (a drop-in fork of MkDocs 1.x): works unchanged. Build with `properdocs build`.
- **MkDocs 2.0**: not supported. It has no plugin system.
- **Zensical**: not supported. Zensical silently ignores plugins it doesn't list, so a Zensical build publishes every audience's content with no error. Don't build an audience-tagged project with Zensical.

## Install

The package isn't on PyPI. Install it from a local copy or from its Git repository:

```bash
pip install ./plugins/mkdocs-audience                                  # local copy
pip install git+https://github.com/jake-47/mkdocs-audience             # from Git
```

`bootstrap-docs` vendors this package into every project it creates, under `plugins/mkdocs-audience/`, and installs it from there.

In `mkdocs.yml`:

```yaml
plugins:
  - search
  - audience:
      audiences: [internal, partner, beta, public]

markdown_extensions:
  - md_in_html        # needed for markdown inside block markers
```

Pick the audience per build with an environment variable:

```bash
MKDOCS_AUDIENCE=internal mkdocs serve
MKDOCS_AUDIENCE=public mkdocs build --site-dir dist/public
```

The active audience is resolved in this order: `MKDOCS_AUDIENCE`, then the plugin's `audience:` setting, then the first name in `audiences:`. Setting `audience: public` makes a build without the variable, such as a plain `mkdocs gh-deploy`, the public one.

## Marker syntax

Block marker:

```markdown
<!-- audience: internal -->
## On-call runbook

Escalation: PagerDuty schedule `prod-oncall`.
<!-- /audience -->
```

Inline marker:

```markdown
Your API key is <!-- audience: internal -->`sk_live_...` from the vault<!-- /audience --><!-- audience: public -->in your dashboard<!-- /audience -->.
```

Whole-page targeting (use a YAML list; a comma-separated string also works):

```markdown
---
audiences: [partner]
---
```

The plugin finds page metadata where MkDocs does: a YAML block closed by `---` or `...`, or MultiMarkdown-style `audiences: partner` lines at the top of the page. It matches the `audiences` key in any case. A mistake that would make a tagged page count as untagged stops the build instead of publishing the page: frontmatter that names audiences but isn't valid YAML; an `audiences:` value that is empty, isn't a list or string, or names `!audience`; a key that is almost `audiences`, such as `audience` or `audeinces`; and, on a page MkDocs reads no audiences from, a line in its first 60 lines, outside code, that looks like a tag, such as one in a block below the first line, in a block never closed, or missing its colon.

A spec can list several names and negate with `!`: `<!-- audience: partner, !beta -->`.

Markers match in any case and with any spacing around the word and the colon. Markers inside fenced code that starts at the left margin, and inside inline code in single backticks, are left as written. Anything else that would let marked text reach the wrong build stops the build and names the page: an opening marker never closed, a closing marker with no opening one, a marker opened inside another (markers don't nest), and a comment that looks like a marker but isn't one, such as `<!-- audiences: internal -->`.

## Matching rule

Inline markers (audience `A`, included names `I`, excluded names `E`):

1. Empty spec: hidden in every build (fail closed).
2. `A` in `E`: hidden (exclusions always win).
3. `A` is `internal`: shown (internal sees everything not explicitly excluded).
4. `I` non-empty: shown only if `A` is in `I`.
5. `I` empty (negation only, like `!beta`): shown only to `public`.

Whole pages (audience `A`, frontmatter list `P`):

1. `A` is `internal`: the page is built.
2. `P` names audiences: built only if `A` is in `P`.
3. No `audiences:` frontmatter: the `untagged` setting decides. With `error`, the default, the build stops and lists every such page, so a page whose tag you forgot can't reach the public build. With `internal`, the page is built only for internal. With `public`, it's built for internal and public, as in versions before 0.4.0.

Restrictive by design: a page reaches partner, beta or public only when it says so. To share a page, tag it, for example `audiences: [public, partner, beta]`. Links from a shared page to a restricted page belong inside a marker for that audience; otherwise the link breaks in builds where the target is excluded, and strict mode fails the build.

## Files that aren't pages

Images, PDFs and other files under `docs_dir` are filtered by use. In every build but internal, such a file goes in only if a page in that build links to it (an `href`, `src`, `srcset`, `poster` or `data` attribute in the page as rendered, after markers are applied), or it's one of the files every build gets:

- anything under `assets/`
- `CNAME`, `robots.txt` and `favicon.ico` at the top of `docs_dir`
- a hidden file or folder that `exclude_docs` lets in, such as `.well-known/`
- the files `mkdocs.yml` names in `extra_css` and `extra_javascript`, and as the theme's `logo` and `favicon`
- any file a stylesheet that the build keeps refers to with `url()` or `@import`

So an image that only an internal page uses never reaches the public build. The internal build gets every file. Each build logs, at INFO level, the files it left out. Put files your templates or scripts use, and nothing a page links to, under `assets/`.

A `nav:` entry doesn't count as a link, because every build shares the nav. When one points at a file a build leaves out, that build logs a warning, which fails it under `strict: true`, since the entry would be a broken link there.

## Styling

Only the internal build wraps what it keeps:

```html
<div class="audience-partner audience-block" data-audience="partner,beta"
     data-reach="partner beta" data-label="Partner and beta" markdown="1">...</div>
<span class="audience-internal audience-inline" data-audience="internal"
      data-reach="" data-label="Internal only" title="Internal only">...</span>
```

- A marker that starts its line wraps a block (`div`) when it stands alone on that line, when its content runs over several lines, or when it marks a whole line such as a heading, a list item, a quote or a table row; anywhere else it wraps a span. A block's tags take the marker's indentation and sit between blank lines, so a block inside an admonition or a list item renders there.
- The first class names the first non-negated audience in the marker.
- `data-reach` lists the other declared audiences that also get the content, space-separated, so CSS can match one with `[data-reach~="public"]`.
- `data-label` says the same in words.

Every other build gets the content with no wrapper, so its HTML names no audience. The plugin ships no CSS.

## Configuration

```yaml
plugins:
  - audience:
      audiences: [internal, public]   # names you use in markers and frontmatter
      audience: ""                    # optional fixed audience; MKDOCS_AUDIENCE overrides it
      filename_convention: false      # true: _NAME-page.md acts like audiences: [NAME]
      untagged: error                 # error, internal or public; see "Matching rule"
```

The plugin sets `config.extra.audience` (the active name) and `config.extra.audience_<name>` (true for the active one) for use in theme overrides.

## Errors and warnings

- An undeclared or misspelt `MKDOCS_AUDIENCE` stops the build with a one-line message listing the declared names.
- A frontmatter mistake that would make a tagged page count as untagged stops the build and names the page; see above.
- With `untagged: error`, the default, pages that name no audiences stop the build, which lists them all.
- A marker that can't be paired, a nested marker, or a comment that looks like a marker but isn't one stops the build and names the page.
- With `filename_convention: true`, a file name that looks like the convention but doesn't follow it, such as `_internal_notes.md`, stops the build.
- A marker or a page's `audiences:` naming an undeclared audience logs a warning, which fails the build under `strict: true`.
- A `nav:` entry pointing at a file that a build leaves out logs a warning, which fails the build under `strict: true`.

## Tests

```bash
pip install -e ".[dev]"
pytest tests/ -v
# expected: 156 passed
```

## Licence

MIT.
BD_README_EOF
    write_owned plugins/mkdocs-audience/LICENSE <<'BD_LICENSE_EOF'
MIT License

Copyright (c) 2026 jake-47

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
BD_LICENSE_EOF
    write_owned plugins/mkdocs-audience/.gitignore <<'BD_GITIGNORE_EOF'
__pycache__/
*.py[cod]
*.egg-info/
.pytest_cache/
.venv/
dist/
build/
.DS_Store
BD_GITIGNORE_EOF
    write_owned plugins/mkdocs-audience/mkdocs_audience/__init__.py <<'BD_INIT_EOF'
"""mkdocs-audience: filter MkDocs content by audience at build time."""
from mkdocs_audience.plugin import AudiencePlugin

__all__ = ["AudiencePlugin"]
__version__ = "0.4.1"
BD_INIT_EOF
    write_owned plugins/mkdocs-audience/mkdocs_audience/plugin.py <<'BD_PLUGIN_EOF'
"""MkDocs plugin: filter content by audience at build time.

Mark sections of a page with `<!-- audience: NAME -->...<!-- /audience -->` and
the build strips or keeps them based on the active audience. Whole-page targeting
via frontmatter (`audiences: [name]`) is also supported. Pages excluded from a
build are also removed from the `nav:` in mkdocs.yml, so their titles and links
never reach that build.

Active audience resolution order:
  1. Environment variable MKDOCS_AUDIENCE (per-invocation override)
  2. Plugin config key `audience`
  3. First entry in plugin config `audiences` list

Matching rule for inline markers (audience A, spec parsed into includes I, excludes E):
  1. Empty spec                              -> hidden (fail closed)
  2. A in E                                  -> hidden (excludes always win)
  3. A == 'internal'                         -> shown (privileged superset)
  4. I non-empty                             -> shown if A in I, else hidden
  5. I empty (negation-only spec)            -> shown only to public

Whole-page filtering (audience A, page frontmatter audiences P):
  1. A == 'internal'                         -> page renders (privileged)
  2. P is a list                             -> page renders only if A in P
  3. P is None (no audiences declared)       -> the `untagged` setting decides:
       error (the default)  the build stops and lists every such page
       internal             the page renders only for internal
       public               the page renders for internal and public

The page's metadata is found where MkDocs finds it: a YAML block between `---`
and `---` (or `...`), or MultiMarkdown-style `key: value` lines at the top. Any
mistake that would otherwise make a tagged page count as untagged, and so reach
the public build, stops the build instead: frontmatter that names audiences but
isn't valid YAML, an `audiences:` value that is empty, not a list or string, or
negated, a key that is almost `audiences`, and a line near the top of an
untagged page that looks like a tag MkDocs doesn't read.

Markers match in any case. One that can't be paired, one opened inside
another, and a comment that looks like a marker but isn't one stop the build
too: each would let marked text reach every build.

Files that aren't pages (images, PDFs, downloads) are filtered by use. In
every build but internal, a file from docs_dir goes in only if a page in
that build links to it, or it is one of these, which every build gets:
anything under assets/; CNAME, robots.txt and favicon.ico at the top of
docs_dir; a hidden file that exclude_docs lets in; the stylesheets, scripts,
logo and favicon mkdocs.yml names; and any file a stylesheet that the build
keeps refers to. So an image only a restricted page uses never reaches a
build that can't see the page. The internal build gets every file. The nav
is the same in every build, so it doesn't count as a link: a nav entry that
points at a file a build leaves out logs a warning, since in that build it
would be a broken link.

Only the internal build marks what it keeps:
  <div class="audience-{primary} audience-block" data-audience="..."
       data-reach="partner beta" data-label="Partner and beta" markdown="1">...</div>
  <span class="audience-{primary} audience-inline" data-audience="..."
        data-reach="..." data-label="..." title="...">...</span>
where {primary} is the first non-negated audience in the spec, data-reach lists
the other declared audiences that also get the content, and data-label says the
same in words ("Internal only" when there are none). Every other build gets the
content alone, so its HTML names no audience.

This plugin needs MkDocs 1.x (or a 1.x-compatible fork such as ProperDocs).
MkDocs 2.0 has no plugin system, and Zensical silently ignores plugins it does
not list, so under either one nothing is filtered. Verify every build's output.
"""

from __future__ import annotations

import os
import posixpath
import re
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml
from mkdocs.config import config_options
from mkdocs.exceptions import PluginError
from mkdocs.plugins import BasePlugin, get_plugin_logger
from mkdocs.structure.files import Files, InclusionLevel

log = get_plugin_logger(__name__)

# Markers: <!-- audience: SPEC --> ... <!-- /audience -->, in any case, with
# any spacing around the word and the colon.
_MARK_OPEN_RE = re.compile(r"<!--\s*audience\s*:\s*(?P<spec>[^>]*?)\s*-->", re.IGNORECASE)
_MARK_CLOSE_RE = re.compile(r"<!--\s*/\s*audience\s*-->", re.IGNORECASE)
_AUDIENCE_RE = re.compile(
    _MARK_OPEN_RE.pattern + r"(?P<body>.*?)" + _MARK_CLOSE_RE.pattern,
    re.DOTALL | re.IGNORECASE,
)
# Any comment that starts with a word, to find ones that look like markers but aren't.
_COMMENT_WORD_RE = re.compile(r"<!--+\s*/?\s*(?P<word>[A-Za-z]+)")
# A line that looks like it tags the page: "audiences: ...", "- audience: ...",
# "audiences = ...", "audiences [...]", "Audeinces: ...".
_AUDIENCE_LINE_RE = re.compile(r"""^\s*(?:[-*]\s*)?["']?(?P<key>[A-Za-z][\w-]*)["']?\s*(?:[:=]|\[)""")
# Content that has to start a block of its own: a heading, a list item, a quote,
# a table row or a fence.
_BLOCK_START_RE = re.compile(r"^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||```|~~~)")

_FENCE_RE = re.compile(
    r"(?ms)"
    r"(?P<fenced>^[ ]{0,3}(?P<fence>```+|~~~+)[^\n]*\n.*?^[ ]{0,3}(?P=fence)[ \t]*$)"
    r"|"
    r"(?P<inline>`[^`\n]*`)",
)

_FILENAME_AUDIENCE_RE = re.compile(r"^_(?P<audience>[a-z]+)-")
_FILENAME_NEAR_RE = re.compile(r"^_[A-Za-z]+[-_]")

# The same patterns MkDocs 1.x uses to find page metadata (mkdocs/utils/meta.py),
# copied so the plugin never reads a page's metadata differently from MkDocs.
_YAML_RE = re.compile(r"^-{3}[ \t]*\n(.*?\n)(?:\.{3}|-{3})[ \t]*\n", re.DOTALL)
_META_RE = re.compile(r"^[ ]{0,3}(?P<key>[A-Za-z0-9_-]+):\s*(?P<value>.*)")
_META_MORE_RE = re.compile(r"^([ ]{4}|\t)(\s*)(?P<value>.*)")

PRIVILEGED = "internal"
ENV_VAR = "MKDOCS_AUDIENCE"
UNTAGGED_CHOICES = ("error", "internal", "public")

# Files every build gets, whether or not a page links to them.
_ALWAYS_KEPT_TOP = {"CNAME", "robots.txt", "favicon.ico"}
# url(...) and @import in a stylesheet.
_CSS_REF_RE = re.compile(
    r"""url\(\s*(['"]?)(?P<url>[^'")]+)\1\s*\)|@import\s+(['"])(?P<imp>[^'"]+)\3"""
)


class _TolerantLoader(yaml.SafeLoader):
    """SafeLoader that reads tags it doesn't know (!ENV, !team, ...) as null."""


_TolerantLoader.add_multi_constructor("", lambda loader, suffix, node: None)


class AudiencePlugin(BasePlugin):
    config_scheme = (
        (
            "audiences",
            config_options.ListOfItems(
                config_options.Type(str),
                default=["internal", "public"],
            ),
        ),
        ("audience", config_options.Type(str, default="")),
        ("filename_convention", config_options.Type(bool, default=False)),
        ("untagged", config_options.Choice(UNTAGGED_CHOICES, default="error")),
    )

    def on_config(self, config):
        declared = list(self.config["audiences"])
        if not declared:
            raise PluginError(
                "mkdocs-audience: the plugin's 'audiences:' list in mkdocs.yml is empty. "
                "Declare at least one audience, for example: audiences: [internal, public]"
            )
        chosen = (
            os.environ.get(ENV_VAR)
            or self.config.get("audience")
            or declared[0]
        )
        if chosen not in declared:
            raise PluginError(
                f"mkdocs-audience: audience {chosen!r} is not declared. "
                f"Declared audiences: {', '.join(declared)}. "
                f"Set {ENV_VAR} to one of them, or add {chosen!r} to the "
                f"plugin's 'audiences:' list in mkdocs.yml."
            )
        self._audience = chosen

        extra = config.setdefault("extra", {})
        extra["audience"] = chosen
        for aud in declared:
            extra[f"audience_{aud}"] = (aud == chosen)
        return config

    def on_files(self, files, config):
        declared = set(self.config["audiences"])
        policy = self.config.get("untagged", "error")
        kept, excluded, untagged = [], set(), []
        for f in files:
            # A page exclude_docs leaves out is never built, so it isn't checked.
            if not f.is_documentation_page() or f.inclusion == InclusionLevel.EXCLUDED:
                kept.append(f)
                continue
            names = _page_audiences(f, config["docs_dir"], self.config["filename_convention"])
            for name in names or []:
                if name not in declared:
                    log.warning(
                        "undeclared audience %r in the frontmatter or file name of %s (declared: %s)",
                        name, f.src_path, sorted(declared),
                    )
            if names is None and policy == "error":
                untagged.append(_norm(f.src_uri))
            elif _visible(self._audience, names, policy):
                kept.append(f)
            else:
                excluded.add(_norm(f.src_uri))
        if untagged:
            raise PluginError(_untagged_message(sorted(untagged)))
        # MkDocs builds the navigation from config["nav"] after this hook, so
        # pruning here keeps excluded pages' titles and links out of the build
        # and avoids "not found in the documentation files" warnings.
        if excluded and config.get("nav"):
            config["nav"] = _prune_nav(config["nav"], excluded)
        return Files(kept)

    def on_page_markdown(self, markdown, page, config, files):
        self._warn_undeclared(markdown, page)
        return self._apply_audience(markdown, page.file.src_path)

    def on_env(self, env, config, files):
        """Leave out of this build each file from docs_dir that isn't a page and
        that nothing in the build uses (see the module docstring). Runs after
        every page is rendered and before MkDocs copies the files."""
        if self._audience == PRIVILEGED:
            return env
        docs_dir = os.path.normpath(str(config["docs_dir"]))
        site_url = str(config.get("site_url") or "")
        static = {
            f.dest_uri: f for f in files
            if not f.is_documentation_page()
            and f.src_dir and os.path.normpath(str(f.src_dir)) == docs_dir
            and f.inclusion.is_included()
        }
        used = set()
        for f in files.documentation_pages(inclusion=lambda level: True):
            page = f.page
            if page is None or page.content is None:
                continue
            base = _url_dir(page.url)
            for ref in _html_refs(page.content):
                target = _resolve_ref(base, ref, site_url)
                if target:
                    used.add(target)
        keep = _config_paths(config)
        # Follow stylesheets the build keeps to the files they use.
        queue = [uri for uri in static if uri.lower().endswith(".css")
                 and (_always_kept(uri) or uri in keep or uri in used)]
        seen = set()
        while queue:
            uri = queue.pop()
            if uri in seen:
                continue
            seen.add(uri)
            try:
                text = Path(static[uri].abs_src_path).read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for ref in _css_refs(text):
                target = _resolve_ref(posixpath.dirname(uri), ref, site_url)
                if target and target not in keep:
                    keep.add(target)
                    if target.lower().endswith(".css") and target in static:
                        queue.append(target)
        dropped = []
        for uri, f in static.items():
            if _always_kept(uri) or uri in keep or uri in used:
                continue
            f.inclusion = InclusionLevel.EXCLUDED
            dropped.append(uri)
        if dropped:
            log.info(
                "left %d file%s out of the %r build, as no page in it links to %s: %s",
                len(dropped), "" if len(dropped) == 1 else "s", self._audience,
                "it" if len(dropped) == 1 else "them", ", ".join(sorted(dropped)),
            )
        # Every build shares the nav, so a nav entry isn't a link that keeps a
        # file; one that points at a file this build leaves out is broken here.
        for target in sorted(set(dropped).intersection(_nav_targets(config.get("nav")))):
            log.warning(
                "the nav links to %s, but no page in the %r build links to it, so the build "
                "leaves it out and the nav entry would be a broken link. Link to it from a page "
                "in this build, move it under assets/, which every build gets, or take it out "
                "of the nav.",
                target, self._audience,
            )
        return env

    def _apply_audience(self, text, src_path="this page"):
        """Replace audience markers; markers inside code are left as written.

        A marker that can't be paired, or a comment that looks like a marker but
        isn't one, stops the build: either would let marked content reach every
        build. Only the internal build marks what it keeps. There, each block or
        span is wrapped with data-reach (the other audiences that also get it)
        and data-label (the same in words), which a theme can draw as a rule and
        a note. Every other build gets the content alone, so its HTML names no
        audience at all.
        """
        in_code = _fence_checker(text)
        others = [a for a in self.config["audiences"] if a != PRIVILEGED]
        pairs = _pair_markers(text, in_code, src_path)
        out, pos = [], 0
        for opening, closing in pairs:
            out.append(text[pos:opening.start()])
            out.append(self._replace(text, opening, closing, others))
            pos = closing.end()
        out.append(text[pos:])
        return "".join(out)

    def _replace(self, text, opening, closing, others):
        spec = _split_spec(opening.group("spec"))
        body = text[opening.end():closing.start()]
        if not _matches(self._audience, spec):
            return ""
        if self._audience != PRIVILEGED:
            return body
        reach = [a for a in others if _matches(a, spec)]
        label = _reach_label(reach)
        primary = _primary_audience(spec) or self._audience
        attrs = (
            f'data-audience="{escape(",".join(spec))}" '
            f'data-reach="{escape(" ".join(reach))}" '
            f'data-label="{escape(label)}"'
        )
        # A marker that starts its line wraps a block when it stands alone on
        # that line, when its content runs over several lines, or when it marks
        # a whole line that is a heading, a list item, a quote or a table row;
        # anywhere else it marks a span. The block's tags take the marker's
        # indentation and sit between blank lines, so Markdown renders a block
        # inside an admonition or a list item as a block, and keeps it there.
        line_start = text.rfind("\n", 0, opening.start()) + 1
        indent = text[line_start:opening.start()]
        line_end = text.find("\n", closing.end())
        rest = text[closing.end():] if line_end < 0 else text[closing.end():line_end]
        alone = re.match(r"[ \t]*\n", body) is not None
        whole_block_line = not rest.strip() and _BLOCK_START_RE.match(body.lstrip()) is not None
        if not indent.strip() and (alone or "\n" in body.strip() or whole_block_line):
            inner = body.rstrip(" \t")
            if not alone:
                inner = "\n" + indent + inner
            if not inner.endswith("\n"):
                inner += "\n"
            return (
                f'\n{indent}<div class="audience-{escape(primary)} audience-block" {attrs} '
                f'markdown="1">\n{inner}\n{indent}</div>\n'
            )
        return (
            f'<span class="audience-{escape(primary)} audience-inline" {attrs} '
            f'title="{escape(label)}">{body}</span>'
        )

    def _warn_undeclared(self, markdown, page):
        # Markers inside code are examples, not markers: skip them, exactly as
        # _apply_audience does, or a page that documents the syntax fails
        # strict builds whenever an audience it mentions isn't declared.
        declared = set(self.config["audiences"])
        in_code = _fence_checker(markdown)
        for m in _MARK_OPEN_RE.finditer(markdown):
            if in_code(m.start()):
                continue
            for token in _split_spec(m.group("spec")):
                name = token.lstrip("!").strip()
                if name and name not in declared:
                    log.warning(
                        "undeclared audience %r in %s (declared: %s)",
                        name, page.file.src_path, sorted(declared),
                    )


def _snippet(text, pos):
    end = text.find("-->", pos)
    end = len(text) if end < 0 else end + 3
    return " ".join(text[pos:min(end, pos + 80)].split())


def _pair_markers(text, in_code, src_path):
    """Pair each opening marker outside code with the next closing one.

    Raises PluginError for a marker that opens inside another, a closing marker
    with no opening one, an opening marker never closed, and a comment that
    looks like a marker but isn't one.
    """
    opens = [m for m in _MARK_OPEN_RE.finditer(text) if not in_code(m.start())]
    closes = [m for m in _MARK_CLOSE_RE.finditer(text) if not in_code(m.start())]
    markers = {m.start() for m in opens + closes}
    for m in _COMMENT_WORD_RE.finditer(text):
        if m.start() in markers or in_code(m.start()):
            continue
        word = m.group("word").lower()
        if word.startswith("audience") or _edit_distance(word, "audience") <= 2:
            raise PluginError(
                f"mkdocs-audience: in {src_path}, {_snippet(text, m.start())!r} looks like an "
                f"audience marker but isn't one, so the text it was meant to mark would reach "
                f"every build. Write markers as <!-- audience: NAME --> and <!-- /audience -->."
            )
    events = sorted([(m.start(), 0, m) for m in opens] + [(m.start(), 1, m) for m in closes],
                    key=lambda e: e[0])
    pairs, pending = [], None
    for _, is_close, m in events:
        if not is_close:
            if pending is not None:
                raise PluginError(
                    f"mkdocs-audience: in {src_path}, the marker {_snippet(text, m.start())!r} "
                    f"opens inside another one ({_snippet(text, pending.start())!r}). Markers "
                    f"can't be nested: close the first one before opening the next."
                )
            pending = m
        else:
            if pending is None:
                raise PluginError(
                    f"mkdocs-audience: in {src_path}, a closing marker <!-- /audience --> has "
                    f"no opening marker before it."
                )
            pairs.append((pending, m))
            pending = None
    if pending is not None:
        raise PluginError(
            f"mkdocs-audience: in {src_path}, the marker {_snippet(text, pending.start())!r} "
            f"is never closed with <!-- /audience -->. Until it is, what follows it would "
            f"reach every build."
        )
    return pairs


def _fence_checker(text):
    """Return a function telling whether a position lies in fenced or inline code."""
    regions = [(m.start(), m.end()) for m in _FENCE_RE.finditer(text)]
    return lambda pos: any(start <= pos < end for start, end in regions)


def _norm(path):
    """Normalize a docs-relative path for comparison (POSIX, no leading ./ or /)."""
    path = str(path).replace(os.sep, "/").strip()
    while path.startswith("./"):
        path = path[2:]
    return path.lstrip("/")


def _untagged_message(paths):
    n = len(paths)
    shown = ", ".join(paths[:10]) + (f", and {n - 10} more" if n > 10 else "")
    return (
        f"mkdocs-audience: {n} page{'s' if n != 1 else ''} name{'' if n != 1 else 's'} no "
        f"audiences, and every page has to say who gets it: {shown}. Add audiences: to "
        f"each one's frontmatter, as in audiences: [public] for the open site or "
        f"audiences: [internal] to keep it internal. To build untagged pages for public "
        f"instead, set untagged: public in the audience plugin's settings in mkdocs.yml."
    )


class _Refs(HTMLParser):
    """Every URL an element in the HTML points at: href, src, srcset, poster, data."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if not value:
                continue
            if name in ("href", "src", "poster", "data"):
                self.refs.append(value)
            elif name == "srcset":
                self.refs.extend(part.strip().split()[0] for part in value.split(",") if part.strip())


def _html_refs(html):
    parser = _Refs()
    try:
        parser.feed(html)
        parser.close()
    except Exception:  # noqa: BLE001 - a page MkDocs rendered is parseable; be safe
        pass
    return parser.refs


def _css_refs(text):
    return [m.group("url") or m.group("imp") for m in _CSS_REF_RE.finditer(text)]


def _url_dir(url):
    """The folder a page's relative links start from: 'api/overview/' -> 'api/overview'."""
    url = unquote(str(url or ""))
    return url[:-1] if url.endswith("/") else posixpath.dirname(url)


def _resolve_ref(base, ref, site_url=""):
    """The docs-relative path a link or a url() points at, or None if it leaves the site."""
    ref = str(ref).strip()
    if site_url:
        for prefix in (site_url, site_url.rstrip("/")):
            if prefix and ref.startswith(prefix):
                ref = "/" + ref[len(prefix):].lstrip("/")
                break
    if not ref or ref.startswith(("#", "//", "mailto:", "tel:", "javascript:", "data:")):
        return None
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    if "://" in ref:
        return None
    ref = unquote(ref)
    if ref.startswith("/"):
        path = urlsplit(site_url).path if site_url else "/"
        path = "/" + path.strip("/") + "/" if path.strip("/") else "/"
        ref = ref[len(path):] if ref.startswith(path) else ref.lstrip("/")
        resolved = posixpath.normpath(ref or ".")
    else:
        resolved = posixpath.normpath(posixpath.join(base, ref))
    if resolved in (".", "") or resolved.startswith("../") or resolved == "..":
        return None
    return resolved


def _always_kept(path):
    """A file every build gets: assets/, the hosting files at the top, hidden files."""
    parts = path.split("/")
    return parts[0] == "assets" or path in _ALWAYS_KEPT_TOP or any(p.startswith(".") for p in parts)


def _config_paths(config):
    """The files mkdocs.yml names: extra_css, extra_javascript, the logo and favicon."""
    found = set()
    items = list(config.get("extra_css") or []) + list(config.get("extra_javascript") or [])
    theme = config.get("theme")
    for key in ("logo", "favicon"):
        try:
            value = theme[key] if theme is not None else None
        except (KeyError, TypeError):
            value = None
        if value:
            items.append(value)
    for item in items:
        target = _resolve_ref("", str(getattr(item, "path", item)))
        if target:
            found.add(target)
    return found


def _nav_targets(items):
    """The docs-relative path of every nav entry that points into the site."""
    found = []
    for item in items or []:
        value = item
        if isinstance(item, dict) and len(item) == 1:
            (value,) = item.values()
        if isinstance(value, list):
            found.extend(_nav_targets(value))
        elif isinstance(value, str):
            target = _resolve_ref("", value)
            if target:
                found.append(target)
    return found


def _prune_nav(items, excluded):
    """Return nav `items` without entries pointing at excluded pages.

    Handles the three nav item shapes MkDocs accepts: "page.md",
    {"Title": "page.md"} and {"Section": [children]}. Sections left with no
    children are dropped. External links and anything unrecognized are kept.
    """
    out = []
    for item in items:
        if isinstance(item, str):
            if _norm(item) not in excluded:
                out.append(item)
        elif isinstance(item, dict) and len(item) == 1:
            ((title, value),) = item.items()
            if isinstance(value, list):
                children = _prune_nav(value, excluded)
                if children:
                    out.append({title: children})
            elif isinstance(value, str) and _norm(value) in excluded:
                continue
            else:
                out.append(item)
        else:
            out.append(item)
    return out


def _visible(audience, names, untagged="public"):
    """Whole-page rule: internal sees every page; an untagged page goes to public
    only when the untagged setting says public."""
    if audience == PRIVILEGED:
        return True
    if names is None:
        return untagged == "public" and audience == "public"
    return audience in names


def _page_passes(audience, file, docs_dir, use_filename_convention, untagged="public"):
    return _visible(audience, _page_audiences(file, docs_dir, use_filename_convention), untagged)


def _page_audiences(file, docs_dir, use_filename_convention):
    """The audiences a page is tagged for, or None for an untagged page.

    Raises PluginError for a page whose tagging can't be trusted, which would
    otherwise be treated as untagged and so built for public.
    """
    audiences = []
    name = Path(file.src_path).name
    if use_filename_convention:
        m = _FILENAME_AUDIENCE_RE.match(name)
        if m:
            audiences.append(m.group("audience"))
        elif _FILENAME_NEAR_RE.match(name):
            raise PluginError(
                f"mkdocs-audience: the file name of {file.src_path} looks like the _NAME-page.md "
                f"convention but doesn't follow it, so the page would be built for public. "
                f"Write it as _NAME-rest.md, with NAME in lower case and a hyphen after it."
            )
    try:
        text = (Path(docs_dir) / file.src_path).read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError):
        # MkDocs fails on this page itself; nothing to tag.
        return audiences or None
    meta = _read_meta(text, file.src_path)
    keys = [k for k in meta if str(k).lower() == "audiences"]
    if not keys:
        near = [str(k) for k in meta if _audiences_like(str(k))]
        if near:
            raise PluginError(
                f"mkdocs-audience: the frontmatter key {near[0]!r} in {file.src_path} isn't "
                f"'audiences', so the page counts as untagged and would be built for public. "
                f"Spell the key 'audiences'."
            )
        stray = _stray_audience_line(text)
        if stray:
            raise PluginError(
                f"mkdocs-audience: {file.src_path} has the line {stray!r} near its top, but "
                f"MkDocs reads no audiences from the page, so it would be built for public. "
                f"Tag the page in a frontmatter block that starts on its first line with --- "
                f"and ends with ---; if the line isn't a tag, put it in a code block."
            )
    for key in keys:
        raw = meta[key]
        if isinstance(raw, str):
            names = [s.strip() for s in raw.split(",") if s.strip()]
        elif isinstance(raw, list):
            if any(s is None for s in raw):
                raise PluginError(
                    f"mkdocs-audience: 'audiences:' in {file.src_path} has an empty entry. "
                    f"Frontmatter takes audience names only; YAML reads '!name' as a tag, "
                    f"so negation works in markers but not here."
                )
            names = [str(s).strip() for s in raw if str(s).strip()]
        elif raw is None:
            raise PluginError(
                f"mkdocs-audience: 'audiences:' in {file.src_path} has no value. "
                f"Name the audiences, as in audiences: [partner]. If you wrote '!name', "
                f"YAML read it as a tag: negation works in markers but not here."
            )
        else:
            raise PluginError(
                f"mkdocs-audience: 'audiences:' in {file.src_path} must be a list such as "
                f"[partner] or a comma-separated string, not {raw!r}."
            )
        if not names:
            raise PluginError(
                f"mkdocs-audience: 'audiences:' in {file.src_path} names no audience. "
                f"To keep the page internal-only, write: audiences: [internal]"
            )
        negated = [n for n in names if n.startswith("!")]
        if negated:
            raise PluginError(
                f"mkdocs-audience: 'audiences:' in {file.src_path} names {negated[0]!r}. "
                f"Negation works in markers but not in frontmatter: list the audiences "
                f"that get the page."
            )
        audiences.extend(names)
    return audiences or None


def _edit_distance(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _audiences_like(key):
    """A key that is almost 'audiences', such as 'audience' or 'audeinces'."""
    key = key.lower()
    return key != "audiences" and _edit_distance(key, "audiences") <= 2


def _audience_line(line):
    """A line that looks like it tags a page: 'audiences: ...', '- audience: ...', and so on."""
    m = _AUDIENCE_LINE_RE.match(line)
    return bool(m) and (m.group("key").lower() == "audiences" or _audiences_like(m.group("key")))


def _stray_audience_line(text, lines=60):
    """The first line near the top of an untagged page, outside code, that looks
    like it tags the page; None if there is none. Such a line is a tag MkDocs
    doesn't read: in a block below the first line, never closed, opened with
    '----', missing its colon, or nested under another key."""
    in_code = _fence_checker(text)
    offset = 0
    for n, line in enumerate(text.split("\n")):
        if n >= lines:
            break
        if not in_code(offset) and _audience_line(line):
            return line.strip()
        offset += len(line) + 1
    return None


def _read_meta(text, src_path):
    """The page's metadata as MkDocs reads it; {} when there is none.

    A YAML block that isn't valid YAML and names audiences raises PluginError:
    MkDocs would show it as text and the page would count as untagged. One that
    doesn't name audiences is left to MkDocs, which shows it as text, as it does
    for a page that opens with a horizontal rule.
    """
    m = _YAML_RE.match(text)
    if m:
        try:
            data = yaml.load(m.group(1), Loader=_TolerantLoader)
        except yaml.YAMLError as exc:
            if not any(_audience_line(line) for line in m.group(1).split("\n")):
                return {}
            mark = getattr(exc, "problem_mark", None)
            where = f" (line {mark.line + 2})" if mark is not None else ""
            hint = ""
            if re.search(r"(?mi)^\s*audiences\s*:.*!", m.group(1)):
                hint = " Negation ('!name') works in markers, not in frontmatter."
            raise PluginError(
                f"mkdocs-audience: the frontmatter of {src_path} is not valid YAML{where}: "
                f"{getattr(exc, 'problem', None) or exc}. Fix it; until then the page "
                f"would be treated as untagged and built for public.{hint}"
            ) from None
        return data if isinstance(data, dict) else {}
    return _read_multimarkdown_meta(text)


def _read_multimarkdown_meta(text):
    """MultiMarkdown-style 'key: value' lines at the top of a page, as MkDocs reads them."""
    data = {}
    key = None
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if line.strip() == "":
            break
        m1 = _META_RE.match(line)
        if m1:
            key = m1.group("key").lower().strip()
            value = m1.group("value").strip()
            data[key] = f"{data[key]} {value}" if key in data else value
            continue
        m2 = _META_MORE_RE.match(line)
        if m2 and key:
            data[key] += " " + m2.group("value").strip()
            continue
        break
    return data


def _reach_label(reach):
    """'Partner and beta' for ['partner', 'beta']; 'Internal only' for []."""
    if not reach:
        return "Internal only"
    text = reach[0] if len(reach) == 1 else ", ".join(reach[:-1]) + " and " + reach[-1]
    return text[:1].upper() + text[1:]


def _split_spec(spec):
    return [s.strip() for s in spec.split(",") if s.strip()]


def _primary_audience(spec):
    for token in spec:
        if not token.startswith("!"):
            return token
    return None


def _matches(audience, spec):
    if not spec:
        return False
    includes = [s for s in spec if not s.startswith("!")]
    excludes = [s[1:] for s in spec if s.startswith("!")]
    if audience in excludes:
        return False
    if audience == PRIVILEGED:
        return True
    if includes:
        return audience in includes
    return audience == "public"
BD_PLUGIN_EOF
    write_owned plugins/mkdocs-audience/tests/test_plugin.py <<'BD_TESTS_EOF'
"""Tests for mkdocs-audience plugin internals."""

from __future__ import annotations

import pytest

from mkdocs_audience.plugin import (
    _AUDIENCE_RE,
    _FENCE_RE,
    _matches,
    _split_spec,
    _primary_audience,
    _page_passes,
    AudiencePlugin,
    PRIVILEGED,
)


class TestSplitSpec:
    def test_simple(self):
        assert _split_spec("internal") == ["internal"]

    def test_comma(self):
        assert _split_spec("internal,partner") == ["internal", "partner"]

    def test_whitespace(self):
        assert _split_spec("internal , partner") == ["internal", "partner"]

    def test_empty(self):
        assert _split_spec("") == []

    def test_negation_preserved(self):
        assert _split_spec("!partner") == ["!partner"]


class TestPrimaryAudience:
    def test_first_include_wins(self):
        assert _primary_audience(["internal", "partner"]) == "internal"

    def test_skip_negations(self):
        assert _primary_audience(["!beta", "partner"]) == "partner"

    def test_negation_only_returns_none(self):
        assert _primary_audience(["!beta"]) is None


class TestMatches:
    def test_empty_spec_fails_closed(self):
        assert not _matches("internal", [])
        assert not _matches("public", [])

    def test_internal_is_privileged(self):
        assert _matches("internal", ["partner"])
        assert _matches("internal", ["beta"])
        assert _matches("internal", ["partner", "beta"])

    def test_internal_can_be_excluded(self):
        assert not _matches("internal", ["!internal"])
        assert not _matches("internal", ["partner", "!internal"])

    def test_simple_include(self):
        assert _matches("partner", ["partner"])
        assert not _matches("public", ["partner"])

    def test_multi_include(self):
        assert _matches("partner", ["partner", "beta"])
        assert _matches("beta", ["partner", "beta"])
        assert not _matches("public", ["partner", "beta"])

    def test_negation_only_public_default(self):
        assert _matches("public", ["!beta"])
        assert _matches("internal", ["!beta"])
        assert not _matches("partner", ["!beta"])
        assert not _matches("beta", ["!beta"])

    def test_combined_includes_and_excludes(self):
        assert _matches("partner", ["partner", "!beta"])
        assert not _matches("beta", ["partner", "!beta"])
        assert not _matches("public", ["partner", "!beta"])
        assert _matches("internal", ["partner", "!beta"])


class TestPagePasses:
    class FakeFile:
        def __init__(self, src_path):
            self.src_path = src_path

    def test_internal_sees_all(self, tmp_path):
        (tmp_path / "untagged.md").write_text("# Untagged\n")
        f = self.FakeFile("untagged.md")
        assert _page_passes("internal", f, str(tmp_path), False)

    def test_internal_sees_partner_tagged(self, tmp_path):
        (tmp_path / "p.md").write_text("---\naudiences: [partner]\n---\n# X\n")
        f = self.FakeFile("p.md")
        assert _page_passes("internal", f, str(tmp_path), False)

    def test_public_sees_untagged(self, tmp_path):
        (tmp_path / "untagged.md").write_text("# X\n")
        f = self.FakeFile("untagged.md")
        assert _page_passes("public", f, str(tmp_path), False)

    def test_public_does_not_see_partner_tagged(self, tmp_path):
        (tmp_path / "p.md").write_text("---\naudiences: [partner]\n---\n# X\n")
        f = self.FakeFile("p.md")
        assert not _page_passes("public", f, str(tmp_path), False)

    def test_partner_does_not_see_untagged(self, tmp_path):
        (tmp_path / "untagged.md").write_text("# X\n")
        f = self.FakeFile("untagged.md")
        assert not _page_passes("partner", f, str(tmp_path), False)

    def test_partner_sees_partner_tagged(self, tmp_path):
        (tmp_path / "p.md").write_text("---\naudiences: [partner]\n---\n# X\n")
        f = self.FakeFile("p.md")
        assert _page_passes("partner", f, str(tmp_path), False)

    def test_partner_does_not_see_internal_tagged(self, tmp_path):
        (tmp_path / "i.md").write_text("---\naudiences: [internal]\n---\n# X\n")
        f = self.FakeFile("i.md")
        assert not _page_passes("partner", f, str(tmp_path), False)


class TestRegex:
    def test_block_match(self):
        text = "<!-- audience: internal -->\nbody\n<!-- /audience -->"
        m = _AUDIENCE_RE.search(text)
        assert m is not None
        assert m.group("spec") == "internal"

    def test_inline_match(self):
        text = "x <!-- audience: a -->y<!-- /audience --> z"
        m = _AUDIENCE_RE.search(text)
        assert m is not None
        assert m.group("body") == "y"

    def test_negation_in_spec(self):
        text = "<!-- audience: !public -->body<!-- /audience -->"
        m = _AUDIENCE_RE.search(text)
        assert m.group("spec") == "!public"

    def test_combined_spec(self):
        text = "<!-- audience: internal, partner, !beta -->b<!-- /audience -->"
        m = _AUDIENCE_RE.search(text)
        assert m.group("spec") == "internal, partner, !beta"


class TestFenceProtection:
    def _make_plugin(self, audience, audiences=None):
        p = AudiencePlugin()
        p._audience = audience
        p.config = {"audiences": audiences or ["internal", "public"]}
        return p

    def test_fenced_block_preserves_marker(self):
        p = self._make_plugin("public")
        md = "```\n<!-- audience: internal -->body<!-- /audience -->\n```"
        out = p._apply_audience(md)
        assert "body" in out
        assert "<!-- audience: internal -->" in out

    def test_outside_fence_processed(self):
        p = self._make_plugin("public")
        md = "<!-- audience: internal -->hidden<!-- /audience -->\n```\nfence\n```"
        out = p._apply_audience(md)
        assert "hidden" not in out
        assert "fence" in out

    def test_inline_code_preserves_marker(self):
        p = self._make_plugin("public")
        md = "outer `<!-- audience: internal -->inline<!-- /audience -->` outer"
        out = p._apply_audience(md)
        assert "inline" in out

    def test_tilde_fence(self):
        p = self._make_plugin("public")
        md = "~~~\n<!-- audience: internal -->fence body<!-- /audience -->\n~~~"
        out = p._apply_audience(md)
        assert "fence body" in out


class TestHTMLWrapping:
    def _make_plugin(self, audience, audiences=None):
        p = AudiencePlugin()
        p._audience = audience
        p.config = {"audiences": audiences or ["internal", "public"]}
        return p

    def test_block_wrapped_in_div(self):
        p = self._make_plugin("internal")
        md = "<!-- audience: internal -->\ncontent\nmore\n<!-- /audience -->"
        out = p._apply_audience(md)
        assert '<div class="audience-internal audience-block"' in out
        assert 'data-audience="internal"' in out
        assert 'markdown="1"' in out
        assert "content" in out and "more" in out

    def test_inline_wrapped_in_span(self):
        p = self._make_plugin("internal")
        md = "x <!-- audience: internal -->fragment<!-- /audience --> y"
        out = p._apply_audience(md)
        assert '<span class="audience-internal audience-inline"' in out
        assert "fragment" in out

    def test_unmatched_removed_entirely(self):
        p = self._make_plugin("public")
        md = "before <!-- audience: internal -->secret<!-- /audience --> after"
        out = p._apply_audience(md)
        assert "secret" not in out
        assert "audience-internal" not in out

    def test_primary_class_uses_first_non_negation(self):
        p = self._make_plugin("internal")
        md = "<!-- audience: !beta, partner -->\ncontent\n<!-- /audience -->"
        out = p._apply_audience(md)
        assert 'audience-partner' in out

    # 0.3.0: only the internal build marks content.

    def test_internal_marks_reach_and_label(self):
        p = self._make_plugin("internal", ["internal", "partner", "beta", "public"])
        md = "<!-- audience: partner, beta -->\ncontent\nmore\n<!-- /audience -->"
        out = p._apply_audience(md)
        assert 'data-reach="partner beta"' in out
        assert 'data-label="Partner and beta"' in out

    def test_internal_only_label(self):
        p = self._make_plugin("internal", ["internal", "partner", "public"])
        out = p._apply_audience("x <!-- audience: internal -->y<!-- /audience --> z")
        assert 'data-reach=""' in out
        assert 'title="Internal only"' in out

    def test_negation_only_reaches_public(self):
        p = self._make_plugin("internal", ["internal", "partner", "beta", "public"])
        out = p._apply_audience("<!-- audience: !beta -->\na\nb\n<!-- /audience -->")
        assert 'data-reach="public"' in out
        assert 'data-label="Public"' in out

    @pytest.mark.parametrize("audience", ["partner", "beta", "public"])
    def test_other_builds_get_content_alone(self, audience):
        p = self._make_plugin(audience, ["internal", "partner", "beta", "public"])
        md = (
            "<!-- audience: partner, beta, public -->\nshared\ntext\n<!-- /audience -->\n"
            "x <!-- audience: partner, beta, public -->inline<!-- /audience --> y"
        )
        out = p._apply_audience(md)
        assert "shared" in out and "inline" in out
        for leak in ("audience-", "data-audience", "data-reach", "data-label", "<div", "<span"):
            assert leak not in out

    def test_attribute_values_escaped(self):
        p = self._make_plugin("internal", ["internal", 'pa"rt'])
        out = p._apply_audience('<!-- audience: pa"rt -->\na\nb\n<!-- /audience -->')
        assert 'pa"rt' not in out
        assert "pa&quot;rt" in out

    def test_marker_alone_on_its_line_wraps_a_block_of_one_line(self):
        p = self._make_plugin("internal")
        out = p._apply_audience("<!-- audience: internal -->\n## Heading\n<!-- /audience -->")
        assert out.startswith('\n<div class="audience-internal audience-block"')
        assert out.endswith('markdown="1">\n\n## Heading\n\n</div>\n')

    def test_marker_followed_by_text_on_its_line_marks_a_span(self):
        p = self._make_plugin("internal")
        out = p._apply_audience("<!-- audience: internal -->Secret.<!-- /audience -->")
        assert out.startswith('<span class="audience-internal audience-inline"')

    def test_content_over_several_lines_after_the_marker_wraps_a_block(self):
        p = self._make_plugin("internal")
        out = p._apply_audience("<!-- audience: internal -->Line one\nLine two<!-- /audience -->")
        assert out.endswith('markdown="1">\n\nLine one\nLine two\n\n</div>\n')

    def test_marker_inside_a_line_of_text_marks_a_span(self):
        p = self._make_plugin("internal")
        out = p._apply_audience("Intro <!-- audience: internal -->\nmore\n<!-- /audience -->")
        assert '<span class="audience-internal audience-inline"' in out
        assert "<div" not in out

    def test_block_takes_the_marker_indentation(self):
        p = self._make_plugin("internal")
        md = (
            "!!! note\n"
            "    Before.\n\n"
            "    <!-- audience: internal -->\n"
            "    First.\n"
            "    Second.\n"
            "    <!-- /audience -->\n"
            "    After.\n"
        )
        out = p._apply_audience(md)
        assert '\n    \n    <div class="audience-internal audience-block"' in out
        assert 'markdown="1">\n\n    First.\n    Second.\n\n    </div>\n\n    After.\n' in out


class TestMarkerChecks:
    def _apply(self, md, audience="public"):
        p = AudiencePlugin()
        p._audience = audience
        p.config = {"audiences": ["internal", "partner", "public"]}
        return p._apply_audience(md, "p.md")

    @pytest.mark.parametrize("md", [
        "<!-- audiences: internal -->secret<!-- /audiences -->",
        "<!--- audience: internal --->secret<!--- /audience --->",
        "<!-- audience internal -->secret<!-- /audience -->",
        "<!-- Audiance: internal -->secret<!-- /Audiance -->",
    ])
    def test_comment_that_looks_like_a_marker_stops_the_build(self, md):
        with pytest.raises(PluginError, match="looks like an audience marker"):
            self._apply(md)

    def test_case_and_spacing_are_accepted(self):
        out = self._apply("a <!-- Audience : internal -->secret<!-- / AUDIENCE --> b")
        assert out == "a  b"

    def test_unclosed_marker_stops_the_build(self):
        with pytest.raises(PluginError, match="never closed"):
            self._apply("<!-- audience: internal -->\nsecret\n")

    def test_closing_marker_without_opening_stops_the_build(self):
        with pytest.raises(PluginError, match="no opening marker"):
            self._apply("text\n<!-- /audience -->\n")

    def test_nested_markers_stop_the_build(self):
        md = "<!-- audience: internal -->\na\n<!-- audience: partner -->\nb\n<!-- /audience -->\nc\n<!-- /audience -->\n"
        with pytest.raises(PluginError, match="nested"):
            self._apply(md)

    def test_closing_marker_inside_code_doesnt_end_the_block(self):
        md = (
            "<!-- audience: internal -->\n"
            "Example:\n\n"
            "```markdown\n<!-- /audience -->\n```\n\n"
            "secret follow-up\n"
            "<!-- /audience -->\n\n"
            "```bash\necho hi\n```\n"
        )
        out = self._apply(md)
        assert "secret follow-up" not in out
        assert "echo hi" in out

    def test_marker_in_code_is_not_checked(self):
        md = "```\n<!-- audiences: internal -->x\n```\n\n`<!-- audience: internal -->`\n"
        assert self._apply(md) == md

    def test_whole_line_heading_marker_wraps_a_block(self):
        out = self._apply("<!-- audience: partner -->## Heading<!-- /audience -->\n", "internal")
        assert '<div class="audience-partner audience-block"' in out
        assert "\n## Heading\n" in out

    def test_whole_line_sentence_marker_marks_a_span(self):
        out = self._apply("First.\n<!-- audience: partner -->Second.<!-- /audience -->\nThird.\n", "internal")
        assert '<span class="audience-partner audience-inline"' in out


class TestRendering:
    """The internal build's wrappers must nest correctly once Markdown renders them."""

    def _render(self, md):
        import markdown

        p = AudiencePlugin()
        p._audience = "internal"
        p.config = {"audiences": ["internal", "partner", "public"]}
        return markdown.markdown(p._apply_audience(md), extensions=["md_in_html", "admonition"])

    def test_heading_alone_in_a_block(self):
        html = self._render("<!-- audience: internal -->\n## Heading\n<!-- /audience -->\n\nAfter.\n")
        assert '<h2>Heading</h2>' in html
        assert html.index("audience-block") < html.index("<h2>") < html.index("</div>")
        assert "<span" not in html

    def test_block_inside_an_admonition_stays_inside_it(self):
        html = self._render(
            "!!! note\n"
            "    Before.\n\n"
            "    <!-- audience: partner -->\n"
            "    First.\n"
            "    Second.\n"
            "    <!-- /audience -->\n\n"
            "    Still in the note.\n\n"
            "Outside.\n"
        )
        note_end = html.index("</div>", html.index("Still in the note."))
        assert html.index('class="admonition note"') < html.index("audience-block") < note_end
        assert "<pre>" not in html and "<code>" not in html
        assert "<p><div" not in html
        assert '<p>First.\nSecond.</p>' in html
        assert html.index("Outside.") > note_end

    def test_block_inside_a_list_item_stays_inside_it(self):
        html = self._render(
            "- item one\n\n"
            "    <!-- audience: partner -->\n"
            "    Nested **bold**.\n"
            "    <!-- /audience -->\n\n"
            "- item two\n"
        )
        first_item_end = html.index("</li>")
        assert html.index("audience-block") < first_item_end
        assert "<p>Nested <strong>bold</strong>.</p>" in html
        assert "<p><div" not in html


class TestFullPipeline:
    def _make_plugin(self, audience, audiences=None):
        p = AudiencePlugin()
        p._audience = audience
        p.config = {"audiences": audiences or ["internal", "public"]}
        return p

    def test_marker_in_fence_survives(self):
        p = self._make_plugin("internal")
        md = (
            "before\n"
            "```\n"
            "<!-- audience: internal -->survives<!-- /audience -->\n"
            "```\n"
            "<!-- audience: internal -->\nblock\n<!-- /audience -->\n"
        )

        class _DummyPage:
            class file:
                src_path = "test.md"

        out = p.on_page_markdown(md, _DummyPage(), {}, [])
        assert "<!-- audience: internal -->survives<!-- /audience -->" in out
        assert "audience-internal" in out
        assert "block" in out

    def test_fence_inside_marker_processes_correctly(self):
        p = self._make_plugin("public")
        md = (
            "before\n\n"
            "<!-- audience: internal -->\n"
            "## Internal section\n\n"
            "```bash\n"
            "echo 'inside fence inside marker'\n"
            "```\n"
            "<!-- /audience -->\n\n"
            "after\n"
        )

        class _DummyPage:
            class file:
                src_path = "test.md"

        out = p.on_page_markdown(md, _DummyPage(), {}, [])
        assert "Internal section" not in out
        assert "echo 'inside fence inside marker'" not in out
        assert "<!-- audience:" not in out
        assert "before" in out
        assert "after" in out

    def test_fence_inside_marker_preserved_for_matching_audience(self):
        p = self._make_plugin("internal")
        md = (
            "before\n\n"
            "<!-- audience: internal -->\n"
            "## Internal section\n\n"
            "```bash\n"
            "echo hi\n"
            "```\n"
            "<!-- /audience -->\n\n"
            "after\n"
        )

        class _DummyPage:
            class file:
                src_path = "test.md"

        out = p.on_page_markdown(md, _DummyPage(), {}, [])
        assert "Internal section" in out
        assert "echo hi" in out
        assert 'audience-internal' in out
        assert 'audience-block' in out


# ---------------------------------------------------------------------------
# 0.2.0: audience resolution, clean errors, nav pruning
# ---------------------------------------------------------------------------

from mkdocs.exceptions import PluginError
from mkdocs.structure.files import File, Files

from mkdocs_audience.plugin import _prune_nav, ENV_VAR


def _configured(audiences=("internal", "partner", "beta", "public"), audience="",
                filename_convention=False, untagged="error"):
    p = AudiencePlugin()
    p.config = {
        "audiences": list(audiences),
        "audience": audience,
        "filename_convention": filename_convention,
        "untagged": untagged,
    }
    return p


class TestAudienceResolution:
    def test_env_overrides_config_pin(self, monkeypatch):
        # Regression: a config pin used to beat the env var, so every
        # per-audience build silently became the pinned (internal) build.
        monkeypatch.setenv(ENV_VAR, "public")
        p = _configured(audience="internal")
        cfg = p.on_config({})
        assert p._audience == "public"
        assert cfg["extra"]["audience"] == "public"

    def test_config_pin_used_without_env(self, monkeypatch):
        monkeypatch.delenv(ENV_VAR, raising=False)
        p = _configured(audience="partner")
        p.on_config({})
        assert p._audience == "partner"

    def test_default_is_first_declared(self, monkeypatch):
        monkeypatch.delenv(ENV_VAR, raising=False)
        p = _configured()
        p.on_config({})
        assert p._audience == "internal"

    def test_extra_flags_set(self, monkeypatch):
        monkeypatch.setenv(ENV_VAR, "beta")
        cfg = _configured().on_config({})
        assert cfg["extra"]["audience_beta"] is True
        assert cfg["extra"]["audience_internal"] is False

    def test_unknown_audience_raises_plugin_error(self, monkeypatch):
        monkeypatch.setenv(ENV_VAR, "pubic")
        with pytest.raises(PluginError, match="pubic"):
            _configured().on_config({})

    def test_empty_audience_list_raises_plugin_error(self, monkeypatch):
        monkeypatch.delenv(ENV_VAR, raising=False)
        with pytest.raises(PluginError, match="empty"):
            _configured(audiences=()).on_config({})


class TestPruneNav:
    EXCLUDED = {"integrations/partners.md", "operations/runbook.md"}

    def test_bare_string_entries(self):
        nav = ["index.md", "integrations/partners.md"]
        assert _prune_nav(nav, self.EXCLUDED) == ["index.md"]

    def test_titled_entries(self):
        nav = [{"Home": "index.md"}, {"Partners": "integrations/partners.md"}]
        assert _prune_nav(nav, self.EXCLUDED) == [{"Home": "index.md"}]

    def test_section_left_empty_is_dropped(self):
        nav = [{"Home": "index.md"},
               {"Operations": [{"Runbook": "operations/runbook.md"}]}]
        assert _prune_nav(nav, self.EXCLUDED) == [{"Home": "index.md"}]

    def test_section_keeps_remaining_children(self):
        nav = [{"Guides": [{"A": "a.md"}, {"Partners": "integrations/partners.md"}]}]
        assert _prune_nav(nav, self.EXCLUDED) == [{"Guides": [{"A": "a.md"}]}]

    def test_nested_sections(self):
        nav = [{"Outer": [{"Inner": [{"Runbook": "operations/runbook.md"}]}, "x.md"]}]
        assert _prune_nav(nav, self.EXCLUDED) == [{"Outer": ["x.md"]}]

    def test_external_links_kept(self):
        nav = [{"GitHub": "https://github.com/example/repo"}]
        assert _prune_nav(nav, self.EXCLUDED) == nav

    def test_leading_dot_slash_normalized(self):
        nav = [{"Partners": "./integrations/partners.md"}]
        assert _prune_nav(nav, self.EXCLUDED) == []


class TestOnFilesPrunesNav:
    def _site(self, tmp_path):
        docs = tmp_path / "docs"
        (docs / "integrations").mkdir(parents=True)
        (docs / "operations").mkdir()
        (docs / "index.md").write_text("---\naudiences: [public, partner]\n---\n# Home\n")
        (docs / "integrations" / "partners.md").write_text("---\naudiences: [partner]\n---\n# P\n")
        (docs / "operations" / "runbook.md").write_text("---\naudiences: [internal]\n---\n# R\n")
        paths = ["index.md", "integrations/partners.md", "operations/runbook.md"]
        files = Files([File(p, str(docs), str(tmp_path / "site"), True) for p in paths])
        nav = [{"Home": "index.md"},
               {"Integrations": [{"Partners": "integrations/partners.md"}]},
               {"Operations": [{"Runbook": "operations/runbook.md"}]}]
        return docs, files, nav

    def _run(self, tmp_path, audience, monkeypatch):
        docs, files, nav = self._site(tmp_path)
        monkeypatch.setenv(ENV_VAR, audience)
        p = _configured()
        config = {"docs_dir": str(docs), "nav": nav}
        p.on_config(config)
        kept = p.on_files(files, config)
        return sorted(f.src_uri for f in kept), config["nav"]

    def test_public_build(self, tmp_path, monkeypatch):
        kept, nav = self._run(tmp_path, "public", monkeypatch)
        assert kept == ["index.md"]
        assert nav == [{"Home": "index.md"}]

    def test_partner_build(self, tmp_path, monkeypatch):
        kept, nav = self._run(tmp_path, "partner", monkeypatch)
        assert kept == ["index.md", "integrations/partners.md"]
        assert nav == [{"Home": "index.md"},
                       {"Integrations": [{"Partners": "integrations/partners.md"}]}]

    def test_internal_build_keeps_everything(self, tmp_path, monkeypatch):
        kept, nav = self._run(tmp_path, "internal", monkeypatch)
        assert len(kept) == 3
        assert len(nav) == 3

    def test_no_nav_configured_is_fine(self, tmp_path, monkeypatch):
        docs, files, _ = self._site(tmp_path)
        monkeypatch.setenv(ENV_VAR, "public")
        p = _configured()
        config = {"docs_dir": str(docs), "nav": None}
        p.on_config(config)
        kept = p.on_files(files, config)
        assert [f.src_uri for f in kept] == ["index.md"]
        assert config["nav"] is None


class TestUndeclaredWarnings:
    """Markers inside code are examples; they must not trigger warnings."""

    class _Page:
        class file:
            src_path = "reference.md"

    def _warnings(self, markdown, caplog, audiences=("internal", "public")):
        import logging
        p = _configured(audiences=audiences)
        p._audience = "internal"
        with caplog.at_level(logging.WARNING):
            p.on_page_markdown(markdown, self._Page(), {}, [])
        return [r.getMessage() for r in caplog.records if "undeclared" in r.getMessage()]

    def test_marker_in_fence_does_not_warn(self, caplog):
        md = "```markdown\n<!-- audience: partner -->\nx\n<!-- /audience -->\n```\n"
        assert self._warnings(md, caplog) == []

    def test_marker_in_inline_code_does_not_warn(self, caplog):
        md = "Use `<!-- audience: beta -->x<!-- /audience -->` like this.\n"
        assert self._warnings(md, caplog) == []

    def test_real_marker_still_warns(self, caplog):
        md = "<!-- audience: partner -->\nx\ny\n<!-- /audience -->\n"
        assert any("partner" in w for w in self._warnings(md, caplog))


# ---------------------------------------------------------------------------
# 0.3.0: page metadata is read as MkDocs reads it, and a tagged page can no
# longer fall through to public because of a mistake in its tagging.
# ---------------------------------------------------------------------------

from mkdocs_audience.plugin import _reach_label


class TestReachLabel:
    def test_none(self):
        assert _reach_label([]) == "Internal only"

    def test_one(self):
        assert _reach_label(["public"]) == "Public"

    def test_two(self):
        assert _reach_label(["partner", "beta"]) == "Partner and beta"

    def test_three(self):
        assert _reach_label(["partner", "beta", "public"]) == "Partner, beta and public"


class TestPageMetadata:
    class FakeFile:
        def __init__(self, src_path):
            self.src_path = src_path

    def _passes(self, tmp_path, text, audience):
        (tmp_path / "p.md").write_text(text, encoding="utf-8")
        return _page_passes(audience, self.FakeFile("p.md"), str(tmp_path), False)

    def test_invalid_yaml_stops_the_build(self, tmp_path):
        with pytest.raises(PluginError, match="p.md.*not valid YAML"):
            self._passes(tmp_path, "---\naudiences: [partner\n---\n# X\n", "public")

    def test_dots_close_the_block(self, tmp_path):
        text = "---\naudiences: [partner]\n...\n# X\n"
        assert not self._passes(tmp_path, text, "public")
        assert self._passes(tmp_path, text, "partner")

    def test_multimarkdown_metadata(self, tmp_path):
        text = "Audiences: partner, beta\nTitle: X\n\n# X\n"
        assert not self._passes(tmp_path, text, "public")
        assert self._passes(tmp_path, text, "beta")

    def test_key_case_ignored(self, tmp_path):
        assert not self._passes(tmp_path, "---\nAudiences: [partner]\n---\n# X\n", "public")

    def test_unknown_tags_tolerated(self, tmp_path):
        text = "---\nowner: !team docs\naudiences: [partner]\n---\n# X\n"
        assert not self._passes(tmp_path, text, "public")
        assert self._passes(tmp_path, text, "partner")

    def test_byte_order_mark(self, tmp_path):
        text = "\ufeff---\naudiences: [partner]\n---\n# X\n"
        assert not self._passes(tmp_path, text, "public")

    @pytest.mark.parametrize("value", ["[]", "''", "", "5", "{a: b}"])
    def test_empty_or_wrong_value_stops_the_build(self, tmp_path, value):
        with pytest.raises(PluginError, match="audiences"):
            self._passes(tmp_path, f"---\naudiences: {value}\n---\n# X\n", "public")

    @pytest.mark.parametrize("value", ["[!beta]", "!beta", "\n  - !beta"])
    def test_negation_in_frontmatter_stops_the_build(self, tmp_path, value):
        with pytest.raises(PluginError, match="(?i)negation"):
            self._passes(tmp_path, f"---\naudiences: {value}\n---\n# X\n", "public")

    @pytest.mark.parametrize("key", ["audience", "audeinces", "Audiances", "audiencs"])
    def test_misspelt_key_stops_the_build(self, tmp_path, key):
        with pytest.raises(PluginError, match=f"'{key}'.*built for public"):
            self._passes(tmp_path, f"---\n{key}: [partner]\n---\n# X\n", "public")

    def test_misspelt_multimarkdown_key_stops_the_build(self, tmp_path):
        with pytest.raises(PluginError, match="'audeinces'"):
            self._passes(tmp_path, "Audeinces: partner\n\n# X\n", "public")

    def test_unrelated_keys_are_fine(self, tmp_path):
        assert self._passes(tmp_path, "---\naudio: x\nauthor: y\naudit: z\n---\n# X\n", "public")

    @pytest.mark.parametrize("text", [
        "\n---\naudiences: [partner]\n---\n# X\n",
        "<!-- partner only -->\n---\naudiences: [partner]\n---\n# X\n",
        "---\naudiences: [partner]\n# X\n\nNo closing line.\n",
        "\n\n---\naudeinces: [partner]\n---\n# X\n",
    ])
    def test_frontmatter_mkdocs_cannot_read_stops_the_build(self, tmp_path, text):
        with pytest.raises(PluginError, match="reads no audiences"):
            self._passes(tmp_path, text, "public")

    @pytest.mark.parametrize("text", [
        "---\naudiences [partner]\n---\n# X\n",
        'audiences = ["partner"]\n\n# X\n',
        "---\n- audiences: [internal]\n---\n# X\n",
        "----\naudiences: [partner]\n----\n# X\n",
        "---\ntitle: X\n---\naudiences: [internal]\n\n# X\n",
        "---\nmeta:\n  audiences: [partner]\n---\n# X\n",
        "\naudiences: partner\n\n# X\n",
        "audiences : partner\n\n# X\n",
        "# X\n\n---\naudiences: [partner]\n---\n",
        "---\ntitle: X\n---\n\n---\naudiences: [partner]\n---\n# X\n",
        "---\naudiences: [partner]\n---",
    ])
    def test_tags_mkdocs_reads_no_audiences_from_stop_the_build(self, tmp_path, text):
        with pytest.raises(PluginError, match="reads no audiences|isn't 'audiences'"):
            self._passes(tmp_path, text, "public")

    def test_invalid_yaml_without_audiences_is_left_to_mkdocs(self, tmp_path):
        text = "---\nNote: this page: opens with a rule.\n---\n\n# X\n"
        assert self._passes(tmp_path, text, "public")

    def test_negation_in_a_string_stops_the_build(self, tmp_path):
        with pytest.raises(PluginError, match="(?i)negation"):
            self._passes(tmp_path, "---\naudiences: partner, !beta\n---\n# X\n", "public")

    @pytest.mark.parametrize("name", ["_internal_notes.md", "_Internal-notes.md"])
    def test_filename_convention_near_miss_stops_the_build(self, tmp_path, name):
        (tmp_path / name).write_text("# X\n", encoding="utf-8")
        with pytest.raises(PluginError, match="convention"):
            _page_passes("public", self.FakeFile(name), str(tmp_path), True)

    def test_filename_convention_match(self, tmp_path):
        (tmp_path / "_internal-notes.md").write_text("# X\n", encoding="utf-8")
        assert not _page_passes("public", self.FakeFile("_internal-notes.md"), str(tmp_path), True)
        assert _page_passes("internal", self.FakeFile("_internal-notes.md"), str(tmp_path), True)

    @pytest.mark.parametrize("text", [
        "---\n\n# X\n\nA page that opens with a rule.\n",
        "# X\n\n```\n---\naudiences: [partner]\n---\n```\n",
        "\n---\ntitle: Not about audiences\n---\n# X\n",
    ])
    def test_rules_and_examples_are_not_frontmatter(self, tmp_path, text):
        assert self._passes(tmp_path, text, "public")

    def test_not_frontmatter_when_block_is_not_a_mapping(self, tmp_path):
        # A page opening with rules around plain text: MkDocs reads no metadata.
        assert self._passes(tmp_path, "---\nJust text\n---\n# X\n", "public")


class TestFrontmatterUndeclaredWarning:
    def test_undeclared_name_in_frontmatter_warns(self, tmp_path, monkeypatch, caplog):
        import logging
        docs = tmp_path / "docs"
        docs.mkdir()
        (docs / "p.md").write_text("---\naudiences: [partnr]\n---\n# P\n")
        files = Files([File("p.md", str(docs), str(tmp_path / "site"), True)])
        monkeypatch.setenv(ENV_VAR, "public")
        p = _configured()
        config = {"docs_dir": str(docs), "nav": None}
        p.on_config(config)
        with caplog.at_level(logging.WARNING):
            kept = p.on_files(files, config)
        assert [f.src_uri for f in kept] == []
        assert any("partnr" in r.getMessage() for r in caplog.records)


# ---------------------------------------------------------------------------
# 0.4.0: untagged pages, and files that aren't pages
# ---------------------------------------------------------------------------

from mkdocs.structure.files import InclusionLevel

from mkdocs_audience.plugin import _css_refs, _resolve_ref, _untagged_message


class TestUntagged:
    def _site(self, tmp_path):
        docs = tmp_path / "docs"
        docs.mkdir(exist_ok=True)
        (docs / "index.md").write_text("---\naudiences: [public]\n---\n# Home\n")
        (docs / "notes.md").write_text("# Notes\n")
        (docs / "setup.md").write_text("# Setup\n")
        paths = ["index.md", "notes.md", "setup.md"]
        files = Files([File(p, str(docs), str(tmp_path / "site"), True) for p in paths])
        return docs, files

    def _run(self, tmp_path, monkeypatch, audience, untagged):
        docs, files = self._site(tmp_path)
        monkeypatch.setenv(ENV_VAR, audience)
        p = _configured(untagged=untagged)
        config = {"docs_dir": str(docs), "nav": None}
        p.on_config(config)
        return sorted(f.src_uri for f in p.on_files(files, config))

    @pytest.mark.parametrize("audience", ["internal", "partner", "public"])
    def test_error_is_the_default_and_lists_every_untagged_page(self, tmp_path, monkeypatch, audience):
        docs, files = self._site(tmp_path)
        monkeypatch.setenv(ENV_VAR, audience)
        p = AudiencePlugin()
        p.load_config({"audiences": ["internal", "partner", "beta", "public"]})
        assert p.config["untagged"] == "error"
        config = {"docs_dir": str(docs), "nav": None}
        p.on_config(config)
        with pytest.raises(PluginError, match=r"2 pages name no audiences.*notes\.md, setup\.md.*untagged: public"):
            p.on_files(files, config)

    def test_internal_keeps_untagged_pages_to_itself(self, tmp_path, monkeypatch):
        assert self._run(tmp_path, monkeypatch, "internal", "internal") == ["index.md", "notes.md", "setup.md"]
        assert self._run(tmp_path, monkeypatch, "public", "internal") == ["index.md"]
        assert self._run(tmp_path, monkeypatch, "partner", "internal") == []

    def test_public_sends_untagged_pages_to_public(self, tmp_path, monkeypatch):
        assert self._run(tmp_path, monkeypatch, "public", "public") == ["index.md", "notes.md", "setup.md"]
        assert self._run(tmp_path, monkeypatch, "partner", "public") == []

    def test_page_exclude_docs_leaves_out_is_not_checked(self, tmp_path, monkeypatch):
        docs, files = self._site(tmp_path)
        for f in files:
            if f.src_uri != "index.md":
                f.inclusion = InclusionLevel.EXCLUDED
        monkeypatch.setenv(ENV_VAR, "public")
        p = _configured()
        config = {"docs_dir": str(docs), "nav": None}
        p.on_config(config)
        assert "index.md" in [f.src_uri for f in p.on_files(files, config)]

    def test_message_for_one_page_and_for_many(self):
        assert "1 page names no audiences" in _untagged_message(["a.md"])
        many = _untagged_message([f"p{i}.md" for i in range(12)])
        assert "12 pages name no audiences" in many and "and 2 more" in many


class TestResolveRef:
    @pytest.mark.parametrize("base,ref,expected", [
        ("api/overview", "../../img/a.png", "img/a.png"),
        ("", "img/a.png", "img/a.png"),
        ("guide", "spec%20v2.pdf#page=2", "guide/spec v2.pdf"),
        ("guide", "/img/a.png", "img/a.png"),
        ("guide", "https://example.com/img/a.png", None),
        ("guide", "//cdn.example.com/x.js", None),
        ("guide", "mailto:a@example.com", None),
        ("guide", "#section", None),
        ("", "../outside.png", None),
    ])
    def test_cases(self, base, ref, expected):
        assert _resolve_ref(base, ref) == expected

    def test_site_url_is_part_of_the_site(self):
        assert _resolve_ref("a", "https://example.com/docs/img/x.png", "https://example.com/docs/") == "img/x.png"
        assert _resolve_ref("a", "/docs/img/x.png", "https://example.com/docs/") == "img/x.png"

    def test_css_refs(self):
        css = 'body{background:url("../img/bg.png")} @import "more.css"; a{b:url(x.woff2)}'
        assert _css_refs(css) == ["../img/bg.png", "more.css", "x.woff2"]


class TestNonPageFiles:
    """A full MkDocs build: a file goes into a build only if something in it uses it."""

    def _project(self, tmp_path):
        docs = tmp_path / "docs"
        for d in ("img", "files", "assets", "styles"):
            (docs / d).mkdir(parents=True)
        (docs / "index.md").write_text(
            "---\naudiences: [public, partner]\n---\n# Home\n\n![a](img/a.png)\n\n"
            '<a href="files/guide.pdf">guide</a>\n\n'
            "<!-- audience: internal -->\n![inside a marker](img/marked.png)\n<!-- /audience -->\n"
        )
        (docs / "internal.md").write_text(
            "---\naudiences: [internal]\n---\n# Internal\n\n![s](img/secret.png)\n\n[spec](files/spec.pdf)\n"
        )
        for name in ("img/a.png", "img/secret.png", "img/marked.png", "img/bg.png", "img/deep.png",
                     "files/guide.pdf", "files/spec.pdf", "files/orphan.txt", "CNAME", "assets/logo.svg"):
            (docs / name).write_bytes(b"x")
        (docs / "assets" / "site.css").write_text("body{background:url(../img/bg.png)}")
        (docs / "styles" / "extra.css").write_text('@import "more.css";')
        (docs / "styles" / "more.css").write_text("p{background:url('../img/deep.png')}")
        (tmp_path / "mkdocs.yml").write_text(
            "site_name: T\nsite_url: https://example.com/\ntheme: mkdocs\nstrict: true\n"
            "extra_css: [assets/site.css, styles/extra.css]\n"
            "plugins:\n  - audience:\n      audiences: [internal, partner, public]\n"
        )
        return tmp_path

    def _build(self, root, audience, monkeypatch):
        from mkdocs.commands.build import build
        from mkdocs.config import load_config
        monkeypatch.setenv(ENV_VAR, audience)
        monkeypatch.chdir(root)
        cfg = load_config(config_file=str(root / "mkdocs.yml"), site_dir=str(root / "site" / audience))
        build(cfg)
        out = root / "site" / audience
        return {p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file()}

    def test_public_gets_only_what_it_uses(self, tmp_path, monkeypatch):
        built = self._build(self._project(tmp_path), "public", monkeypatch)
        for kept in ("img/a.png", "files/guide.pdf", "CNAME", "assets/logo.svg", "assets/site.css",
                     "img/bg.png", "styles/extra.css", "styles/more.css", "img/deep.png"):
            assert kept in built, kept
        for left_out in ("img/secret.png", "files/spec.pdf", "img/marked.png", "files/orphan.txt"):
            assert left_out not in built, left_out

    def test_internal_gets_every_file(self, tmp_path, monkeypatch):
        built = self._build(self._project(tmp_path), "internal", monkeypatch)
        for name in ("img/secret.png", "files/spec.pdf", "img/marked.png", "files/orphan.txt"):
            assert name in built, name

    def test_left_out_files_are_logged(self, tmp_path, monkeypatch, caplog):
        import logging
        with caplog.at_level(logging.INFO):
            self._build(self._project(tmp_path), "partner", monkeypatch)
        assert any("left 4 files out of the 'partner' build" in r.getMessage() for r in caplog.records)

    # 0.4.1: a nav entry doesn't keep a file, and one for a file left out warns.

    def test_nav_entry_for_a_file_the_build_leaves_out_fails_strict(self, tmp_path, monkeypatch, caplog):
        import logging
        from mkdocs.exceptions import Abort
        root = self._project(tmp_path)
        with open(root / "mkdocs.yml", "a", encoding="utf-8") as f:
            f.write("nav:\n  - Home: index.md\n  - Internal: internal.md\n  - Spec: files/spec.pdf\n")
        assert "files/spec.pdf" in self._build(root, "internal", monkeypatch)
        with caplog.at_level(logging.WARNING), pytest.raises(Abort, match="strict mode"):
            self._build(root, "public", monkeypatch)
        assert any("the nav links to files/spec.pdf, but no page in the 'public' build" in r.getMessage()
                   for r in caplog.records)

    def test_nav_entry_for_a_file_the_build_keeps_is_fine(self, tmp_path, monkeypatch):
        root = self._project(tmp_path)
        with open(root / "mkdocs.yml", "a", encoding="utf-8") as f:
            f.write("nav:\n  - Home: index.md\n  - Guide: files/guide.pdf\n  - Logo: assets/logo.svg\n")
        assert {"files/guide.pdf", "assets/logo.svg"} <= self._build(root, "public", monkeypatch)
BD_TESTS_EOF
}

# ---------------------------------------------------------------------------
# Charter. The script doesn't carry the font. The first run downloads it from
# Matthew Butterick's Charter page at practicaltypography.com, the release
# that Arch Linux's AUR package (ttf-bitstream-charter) and Homebrew's cask
# (font-charter) both install, and uses it only if its sha256 is
# CHARTER_ZIP_SHA256, the value both of them record for that file: you can
# check it against either. With CHARTER_ZIP set (see the top of the script),
# the run reads a copy you saved instead. Copies of Charter's files, the ones
# v28 wrote among them, store the descender as a positive number. The run
# makes it negative with fontTools, which it installs into .venv for that
# alone, then writes the four woff2 files;
# docs/assets/fonts/LICENSE-Charter.txt says what changes. Later runs find
# the corrected files and download nothing.
# ---------------------------------------------------------------------------
CHARTER_URL="https://practicaltypography.com/fonts/Charter%20210112.zip"
CHARTER_ZIP_SHA256=b40297f1a615f94594bdad0995848eb2223fb53ccb4ea197cabf24439bd811c9
CHARTER_NAMES=(charter_regular charter_italic charter_bold charter_bold_italic)
# The sha256 of each file as v28 wrote it, uncorrected. A run corrects such a
# file where it is, without downloading anything.
declare -A CHARTER_V28_SHA256=(
    [charter_regular]=8e7630ba96aeed2974bfd9ab9bde2d3159e4cba98dfdb5757584e3542f1ac962
    [charter_italic]=35b98e2d6da9ab1d3580aee832f6d8ddfc3687cfd8e12e4e699aa202a70446e2
    [charter_bold]=ca7c6aadefb1318729ac10048a85faeb6eccfbe4d4ecb2e582747663a3915792
    [charter_bold_italic]=192919b5cdf9180894546fa74b206885b4e6af737189ec43601d382017f89b60
)

# True for one of Charter's files as v28 wrote it, uncorrected.
charter_uncorrected() {
    local name
    name=$(basename "$1" .woff2)
    [ -n "${CHARTER_V28_SHA256[$name]:-}" ] && [ -f "$1" ] \
        && [ "$(sha256_of "$1")" = "${CHARTER_V28_SHA256[$name]}" ]
}

# Write the corrected Charter files that are missing, or uncorrected as v28
# wrote them, then the notice that goes with them. A file this script
# corrected before is kept, so a re-run needs no network. Without network, or
# with a download that doesn't match, it writes none of them; until a later
# run does, a missing file leaves the site on the system's serif.
scaffold_fonts() {
    local name path todo=() existed=() download="" reason
    for name in "${CHARTER_NAMES[@]}"; do
        path="docs/assets/fonts/$name.woff2"
        if [ -e "$path" ] && ! charter_uncorrected "$path"; then
            if ! $REGENERATE_OWNED || [ "$(sha256_of "$path")" = "$(recorded_sha256 "$path")" ]; then
                # Corrected by an earlier run; the drift check vouched for it.
                OWNED_DONE["$path"]=1
                OWNED_SAME=$((OWNED_SAME + 1))
                continue
            fi
            # Edited, and this is a forced run: keep a copy. The file counts
            # as this run's once its replacement is written.
            backup_owned "$path"
        else
            # Missing, or as v28 wrote it: nothing to lose, so it counts as
            # this run's now, and a run cut off part-way records what it wrote.
            OWNED_DONE["$path"]=1
        fi
        if [ -e "$path" ]; then existed+=("$path"); fi
        if ! charter_uncorrected "$path"; then download=1; fi
        todo+=("$name=${CHARTER_V28_SHA256[$name]}")
    done
    if [ ${#todo[@]} -eq 0 ]; then
        write_charter_license
        return 0
    fi
    # What a failure note says: what didn't happen, and what the site uses
    # until a later run does it.
    local what="add Charter" meanwhile="Charter's files stay as they are until a later run corrects them."
    if [ -z "$download" ]; then
        what="correct Charter's files"
    fi
    for name in "${todo[@]}"; do
        if [ ! -e "docs/assets/fonts/${name%%=*}.woff2" ]; then
            meanwhile="The site uses your system's serif font until a later run adds Charter."
        fi
    done
    if ! .venv/bin/python -c 'import fontTools, brotli' >/dev/null 2>&1; then
        pick_installer
        if ! venv_install fonttools brotli; then
            note "couldn't install fontTools, which corrects Charter's files (offline?).
  $meanwhile"
            return 0
        fi
        log "installed fontTools and brotli in .venv, to correct Charter's files"
    fi
    local source="$CHARTER_URL"
    if [ -z "$download" ]; then
        log "correcting Charter's files, which v28 wrote uncorrected"
    elif [ -n "$CHARTER_ZIP" ]; then
        source="$CHARTER_ZIP"
        log "adding Charter: reading $(shown "$CHARTER_ZIP"), checking and correcting it"
    else
        log "adding Charter: downloading it from practicaltypography.com, checking and correcting it"
    fi
    if ! reason=$(.venv/bin/python - "$source" "$CHARTER_ZIP_SHA256" docs/assets/fonts "${todo[@]}" \
                  2>&1 >/dev/null <<'BD_CHARTER_PY_EOF'
"""Write corrected copies of the Charter files named in the arguments.

Arguments: SOURCE ZIP_SHA256 FOLDER NAME=SHA256...
A file in FOLDER that matches its SHA256, as v28 wrote it, is corrected where
it is. The others come from the zip at SOURCE, a URL or a saved copy, used
only if it matches ZIP_SHA256: its woff2 files, or its TTF files if it lacks
a woff2 copy of a style, each recognised by the family and style it names,
not by its file name. Every file is corrected and checked before any is
written. Exit status 3, with one line on stderr, when none is written.
"""
import hashlib
import io
import os
import sys
import urllib.request
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont

source, zip_sha256, folder = sys.argv[1], sys.argv[2], Path(sys.argv[3])
wanted = dict(arg.split("=", 1) for arg in sys.argv[4:])
STYLES = {"Regular": "charter_regular", "Italic": "charter_italic",
          "Bold": "charter_bold", "Bold Italic": "charter_bold_italic"}
LARGEST = 10_000_000  # bytes read at most; the release is about 240 KB
# Charter's line metrics as extra.css and LICENSE-Charter.txt give them: units
# per em; hhea ascender, descender and line gap; OS/2 typographic descender;
# Windows ascent and descent.
METRICS = (1000, 980, -236, 0, -240, 980, 236)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def fail(message):
    print(message, file=sys.stderr)
    sys.exit(3)


def styles_in(archive, suffix):
    """The zip's Charter fonts with this suffix, by the name this site gives them."""
    found = {}
    for item in sorted(archive.infolist(), key=lambda item: item.filename):
        if not item.filename.lower().endswith(suffix):
            continue
        try:
            names = TTFont(io.BytesIO(archive.read(item)))["name"]
        except Exception:
            continue  # not a font, such as the ._ files a Mac adds to a zip
        family, style = names.getDebugName(1), names.getDebugName(2)
        if family == "Charter" and style in STYLES:
            found.setdefault(STYLES[style], archive.read(item))
    return found


def seen(font):
    """What a reader sees: glyph outlines, character map, names."""
    glyf = font["glyf"]
    outlines = {g: glyf[g].getCoordinates(glyf)[0].array.tolist() if glyf[g].numberOfContours else []
                for g in font.getGlyphOrder()}
    cmaps = sorted((t.platformID, t.platEncID, tuple(sorted(t.cmap.items()))) for t in font["cmap"].tables)
    names = sorted((n.platformID, n.nameID, n.toUnicode()) for n in font["name"].names)
    return outlines, cmaps, names


sources = {}
for name, digest in wanted.items():
    path = folder / f"{name}.woff2"
    if path.is_file() and sha256(path.read_bytes()) == digest:
        sources[name] = path.read_bytes()
missing = [name for name in wanted if name not in sources]
if missing:
    if source.startswith(("https://", "http://")):
        request = urllib.request.Request(source, headers={"User-Agent": "bootstrap-docs"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                data = response.read(LARGEST + 1)
        except Exception as exc:
            fail(f"couldn't download {source} ({exc})")
    else:
        try:
            with open(source, "rb") as saved:
                data = saved.read(LARGEST + 1)
        except OSError as exc:
            fail(f"couldn't read {source} ({exc.strerror})")
    if sha256(data) != zip_sha256:
        fail(f"{source} isn't the file this script expects: its sha256 differs")
    # The checksum vouches for the zip, so its contents are safe to read.
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        found = styles_in(archive, ".woff2")
        if not all(name in found for name in missing):
            found = styles_in(archive, ".ttf")
    if not all(name in found for name in missing):
        fail(f"{source} has no woff2 or TTF copy of every Charter style")
    for name in missing:
        sources[name] = found[name]

corrected = {}
for name, raw in sources.items():
    font = TTFont(io.BytesIO(raw), recalcBBoxes=False, recalcTimestamp=False)
    font["hhea"].descent = -abs(font["hhea"].descent)
    font["OS/2"].sTypoDescender = -abs(font["OS/2"].sTypoDescender)
    head, hhea, os2 = font["head"], font["hhea"], font["OS/2"]
    if (head.unitsPerEm, hhea.ascent, hhea.descent, hhea.lineGap, os2.sTypoDescender,
            os2.usWinAscent, os2.usWinDescent) != METRICS:
        fail(f"{name}.woff2 doesn't have the line metrics extra.css expects for Charter")
    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer)
    if seen(TTFont(io.BytesIO(raw))) != seen(TTFont(io.BytesIO(buffer.getvalue()))):
        fail(f"correcting {name}.woff2 changed more than its descender values")
    corrected[name] = buffer.getvalue()

folder.mkdir(parents=True, exist_ok=True)
for name, data in corrected.items():
    part = folder / f".{name}.woff2.part"  # hidden, so MkDocs never copies it
    part.write_bytes(data)
    os.replace(part, folder / f"{name}.woff2")
BD_CHARTER_PY_EOF
    ); then
        note "couldn't $what: ${reason##*$'\n'}
  $meanwhile"
        return 0
    fi
    for name in "${todo[@]}"; do
        path="docs/assets/fonts/${name%%=*}.woff2"
        OWNED_DONE["$path"]=1
        if [[ " ${existed[*]} " == *" $path "* ]]; then
            OWNED_UPDATED=$((OWNED_UPDATED + 1))
            log "updated $path"
        else
            OWNED_WRITTEN=$((OWNED_WRITTEN + 1))
            log "wrote $path"
        fi
    done
    write_charter_license
}

# The notice that goes with Charter's files. scaffold_fonts writes it once the
# four files are corrected, as it says they are.
write_charter_license() {
    write_owned docs/assets/fonts/LICENSE-Charter.txt <<'BD_FONT_LICENSE_EOF'
Charter, the typeface in charter_regular.woff2, charter_italic.woff2,
charter_bold.woff2 and charter_bold_italic.woff2, is distributed under this
notice, which is also embedded in each of those files:

(c) Copyright 1989-1992, Bitstream Inc., Cambridge, MA. You are hereby granted permission under all Bitstream propriety rights to use, copy, modify, sublicense, sell, and redistribute the 4 Bitstream Charter (r) Type 1 outline fonts and the 4 Courier Type 1 outline fonts for any purpose and without restriction; provided, that this notice is left intact on all copies of such fonts and that Bitstream's trademark is acknowledged as shown below on all unmodified copies of the 4 Charter Type 1 fonts: 'BITSTREAM CHARTER is a registered trademark of Bitstream Inc.'

BITSTREAM CHARTER is a registered trademark of Bitstream Inc.

bootstrap-docs writes these four files, from Charter's release at
practicaltypography.com/charter.html or from the copies its v28 wrote, with
each one's hhea descender and OS/2 typographic descender negative (-236 and
-240). Copies of Charter's files, the ones v28 wrote among them, store those
two values as positive numbers (236 and 240), which a browser can read as
lying above the baseline (Chromium does), working out too small a line
height; bootstrap-docs makes them negative. The line height then matches the
files' Windows metrics (980 above the baseline, 236 below, per 1000). Nothing
else is changed: the outlines, character map, names and the notice above are
as they were.
BD_FONT_LICENSE_EOF
}

scaffold_design() {
    write_owned docs/assets/styles/extra.css <<'BD_EXTRA_CSS_EOF'
/* audience-docs theme for Material for MkDocs.

   Four rules run through this file:
   1. Material's teal and deep orange are the site's colours: the header,
      links, the current page in the navigation, hover and focus. The
      palette in mkdocs.yml names them, and Material paints with them.
   2. The audience colours appear only where an audience is meant: the build
      band and the review marks in the internal build.
   3. Reading first. One serif, Charter, for everything but code, set at a
      measure of about 75 characters with generous leading.
   4. Hairlines, not boxes. No shadows, no filled pills, no tinted panels
      except where they carry meaning.

   Material reads its colours from CSS variables. This file sets the ones
   for text and grounds, in both schemes, and leaves the teal and orange to
   Material. The selectors are attribute selectors on body, the element
   Material puts them on, and this file loads after Material's, so they win
   at equal specificity.

   bootstrap-docs owns this file and rewrites it when you re-run the script.
   For your own rules, add a stylesheet of your own next to it and list it
   under extra_css in mkdocs.yml, after this one. */

/* ---------------------------------------------------------------- fonts
   Charter (Bitstream, free to use, modify and redistribute: the notice is in
   each file and in ../fonts/LICENSE-Charter.txt). Four files, about 61 KB in
   all, served from this site: no third-party font request. bootstrap-docs
   downloads them from Matthew Butterick's Charter page on its first run and
   corrects their descender values; that file says how. The three overrides
   on each face pin the same values, so an uncorrected copy still sets its
   lines right in Chromium and Firefox; on corrected files they change
   nothing. Until the files arrive, the stack below falls back to the
   system's serif. */
@font-face { font-family: "Charter"; src: url("../fonts/charter_regular.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; ascent-override: 98%; descent-override: 23.6%; line-gap-override: 0%; }
@font-face { font-family: "Charter"; src: url("../fonts/charter_italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: swap; ascent-override: 98%; descent-override: 23.6%; line-gap-override: 0%; }
@font-face { font-family: "Charter"; src: url("../fonts/charter_bold.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; ascent-override: 98%; descent-override: 23.6%; line-gap-override: 0%; }
@font-face { font-family: "Charter"; src: url("../fonts/charter_bold_italic.woff2") format("woff2"); font-weight: 700; font-style: italic; font-display: swap; ascent-override: 98%; descent-override: 23.6%; line-gap-override: 0%; }

body {
  --md-text-font-family: "Charter", "Bitstream Charter", Palatino, "Palatino Linotype",
    "Book Antiqua", "Noto Serif", "Liberation Serif", Georgia, serif;
  --md-code-font-family: ui-monospace, "SFMono-Regular", "DejaVu Sans Mono",
    "Liberation Mono", Menlo, Consolas, monospace;
}

/* ---------------------------------------------------------------- tokens */
[data-md-color-scheme="default"] {
  --paper: #ffffff;
  --ink: #1d1e20;      /* text */
  --ink-2: #4a4e55;    /* secondary text: navigation, captions */
  --ink-3: #737881;    /* tertiary: labels, placeholders */
  --rule: #e3e5e8;     /* hairlines */
  --wash: #f5f6f7;     /* code ground */
  --aud-internal: #7b3fa8;
  --aud-partner: #1f62ad;
  --aud-beta: #965a08;
  --aud-public: #22724a;
  --aud-other: var(--ink-2);   /* an audience you add yourself */
}

[data-md-color-scheme="slate"] {
  --paper: #17181b;
  --ink: #e6e7e9;
  --ink-2: #b6b9bf;
  --ink-3: #888d95;
  --rule: #2d2f34;
  --wash: #202226;
  --aud-internal: #c59cea;
  --aud-partner: #8cb8f2;
  --aud-beta: #e5b160;
  --aud-public: #80c89c;
  --aud-other: var(--ink-2);
}

/* The banner sits on a solid band, so it uses the same deep colours in both
   schemes; white text on each is above 7:1. --band-other is for an audience
   you add yourself. */
[data-md-color-scheme] {
  --band-internal: #6b2f99;
  --band-partner: #1b579b;
  --band-beta: #7f4a03;
  --band-public: #1c603e;
  --band-other: #3b3e44;
}

[data-md-color-scheme] {
  --md-default-fg-color: var(--ink);
  --md-default-fg-color--light: var(--ink-2);
  --md-default-fg-color--lighter: var(--ink-3);
  --md-default-fg-color--lightest: var(--rule);
  --md-default-bg-color: var(--paper);
  --md-default-bg-color--light: var(--paper);
  --md-typeset-color: var(--ink);
  --md-typeset-table-color: var(--rule);
  --md-typeset-table-color--light: var(--wash);
  --md-typeset-mark-color: var(--wash);
  --md-typeset-mark-color: color-mix(in srgb, var(--ink) 14%, transparent);
  --md-code-fg-color: var(--ink);
  --md-code-bg-color: var(--wash);
  --md-code-bg-color--light: var(--wash);     /* behind the copy button */
  --md-code-bg-color--lighter: var(--wash);
  --md-code-hl-color: var(--ink-3);
  --md-code-hl-color--light: var(--wash);
  --md-code-hl-color--light: color-mix(in srgb, var(--ink) 8%, transparent);
  /* Code is set in ink: comments recede, strings step back, and the rest
     is plain. */
  --md-code-hl-number-color: var(--ink);
  --md-code-hl-special-color: var(--ink);
  --md-code-hl-function-color: var(--ink);
  --md-code-hl-constant-color: var(--ink);
  --md-code-hl-keyword-color: var(--ink);
  --md-code-hl-string-color: var(--ink-2);
  --md-code-hl-name-color: var(--ink);
  --md-code-hl-operator-color: var(--ink-2);
  --md-code-hl-punctuation-color: var(--ink-2);
  --md-code-hl-comment-color: var(--ink-3);
  --md-code-hl-generic-color: var(--ink-2);
  --md-code-hl-variable-color: var(--ink);
  --md-typeset-kbd-color: var(--wash);
  --md-typeset-kbd-accent-color: var(--paper);
  --md-typeset-kbd-border-color: var(--rule);
  --md-admonition-fg-color: var(--ink);
  --md-admonition-bg-color: var(--paper);
  --md-footer-fg-color: var(--ink);
  --md-footer-fg-color--light: var(--ink-2);
  --md-footer-fg-color--lighter: var(--ink-3);
  --md-footer-bg-color: var(--paper);
  --md-footer-bg-color--dark: var(--paper);
  --md-shadow-z1: none;
  --md-shadow-z2: 0 0 0 1px var(--rule);
  --md-shadow-z3: 0 0 0 1px var(--rule);
}

/* Links on paper take Material's darker teal: its header teal, #009485, is
   3.8:1 on white, under the 4.5:1 that body text needs; #007a6c is 5.3:1.
   The dark scheme keeps Material's own light teal. */
[data-md-color-scheme="default"][data-md-color-primary] {
  --md-typeset-a-color: var(--md-primary-fg-color--dark);
}

/* bootstrap-docs v28 wrote "primary: custom" and "accent: custom" into
   mkdocs.yml, which leaves Material's colours to this file. A project it
   made gets Material's teal and deep orange here, with Material's values. */
[data-md-color-primary="custom"] {
  --md-primary-fg-color: #009485;
  --md-primary-fg-color--light: #26a699;
  --md-primary-fg-color--dark: #007a6c;
  --md-primary-bg-color: #ffffff;
  --md-primary-bg-color--light: #ffffffb3;
}

[data-md-color-scheme="slate"][data-md-color-primary="custom"] {
  --md-typeset-a-color: #00ccb8;
}

[data-md-color-accent="custom"] {
  --md-accent-fg-color: #ff6e42;
  --md-accent-fg-color--transparent: #ff6e421a;
  --md-accent-bg-color: #ffffff;
  --md-accent-bg-color--light: #ffffffb3;
}

/* ---------------------------------------------------------------- header
   Material's teal bar, flat: no shadow when the page scrolls under it. */
.md-header,
.md-header--shadow {
  box-shadow: none;
}

.md-header__topic:first-child {
  font-weight: 700;
}

/* The logo is the favicon, green bars, with nothing behind them. The
   favicon's green is 1.4:1 on the teal bar and all but disappears, so the
   header and the menu show it at half brightness, a darker green that is
   3.2:1. A logo of your own, in a file with another name, shows as it is. */
.md-logo img[src$="assets/favicon.svg"] {
  filter: brightness(0.5);
}

/* ---------------------------------------------------------------- build banner
   A slim band across the top in the build's colour, so nobody mistakes
   which build they are reading. overrides/main.html writes the band's text,
   and sets its colour for the build being made. The inner box is also
   .md-typeset, so the size is set on both classes at once. */
.md-banner {
  color: #ffffff;
  background-color: var(--band-internal);
}

.md-banner .md-banner__inner {
  margin: 0.25rem auto;
  font-size: 0.62rem;
  line-height: 1.4;
}

.md-banner .build-note {
  margin: 0;
}

.md-banner .build-note strong {
  font-weight: 700;
}

/* ---------------------------------------------------------------- layout */
.md-main__inner {
  margin-top: 1.6rem;
}

/* Start both side columns on the line the page title's capitals start on. */
.md-sidebar {
  padding-top: 0.8rem;
}

.md-content__inner {
  max-width: 31rem;
}

/* ---------------------------------------------------------------- navigation */
.md-nav {
  font-size: 0.72rem;
  line-height: 1.4;
}

.md-nav__link {
  margin-top: 0.5em;
  color: var(--ink-2);
}

/* A section's own entry is darker than the pages under it. The current
   page is Material's teal, in bold; hover is Material's orange. */
.md-nav__item--nested > .md-nav__link {
  color: var(--ink);
}

.md-nav__item .md-nav__link--active,
.md-nav__item .md-nav__link--active code {
  font-weight: 700;
}

.md-nav__icon {
  color: var(--ink-3);
}

/* The left column needs no heading of its own on wide screens, where the
   header already names the site; the table of contents gets a quiet one so
   the two lists aren't confused. Material's own label for it reads "Table of
   contents". */
@media screen and (min-width: 76.25em) {
  .md-sidebar--primary .md-nav--primary > .md-nav__title {
    display: none;
  }
}

.md-sidebar--secondary .md-nav__title {
  font-size: 0;
  color: var(--ink-3);
  padding-top: 0.35rem;
  padding-bottom: 0;
}

.md-sidebar--secondary .md-nav__title::after {
  content: "On this page";
  font-size: 0.68rem;
  font-weight: 400;
  font-style: italic;
}

/* ---------------------------------------------------------------- reading */
.md-typeset {
  font-size: 0.9rem;
  line-height: 1.65;
  font-variant-numeric: oldstyle-nums;
}

.md-typeset h1 {
  font-size: 2.05em;
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin: 0 0 0.7em;
}

.md-typeset h2 {
  font-size: 1.38em;
  font-weight: 700;
  line-height: 1.25;
  margin: 1.9em 0 0.55em;
}

.md-typeset h3 {
  font-size: 1.12em;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.6em 0 0.45em;
}

.md-typeset h4 {
  font-size: 1em;
  font-weight: 700;
  font-style: italic;
  margin: 1.4em 0 0.4em;
}

.md-typeset h5,
.md-typeset h6 {
  font-size: 0.9em;
  font-weight: 700;
  color: var(--ink-2);
  text-transform: none;
}

.md-typeset :is(ol, ul) li {
  margin-bottom: 0.3em;
}

.md-typeset hr {
  border-bottom-color: var(--rule);
  margin: 2.2em 0;
}

[dir] .md-typeset blockquote {
  border-left: 2px solid var(--rule);
  color: var(--ink-2);
  font-style: italic;
  padding-left: 1em;
}

/* ---------------------------------------------------------------- code */
.md-typeset code,
.md-typeset kbd {
  font-size: 0.82em;
  font-variant-numeric: normal;
}

.md-typeset :not(pre) > code {
  background-color: var(--wash);
  box-shadow: inset 0 0 0 1px var(--rule);
  border-radius: 0.15rem;
  padding: 0.05em 0.35em;
}

.md-typeset pre > code {
  border-radius: 0.15rem;
  box-shadow: inset 0 0 0 1px var(--rule);
}

.highlight .c,
.highlight .c1,
.highlight .ch,
.highlight .cm,
.highlight .cs {
  font-style: italic;
}

/* ---------------------------------------------------------------- tables */
.md-typeset table:not([class]) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
  font-size: 0.9em;
}

.md-typeset table:not([class]) th,
.md-typeset table:not([class]) td {
  padding: 0.55em 1.2em 0.55em 0;
}

.md-typeset table:not([class]) th {
  font-weight: 700;
  border-bottom: 1px solid var(--ink-3);
  background: none;
}

.md-typeset table:not([class]) td {
  border-top: 1px solid var(--rule);
}

.md-typeset table:not([class]) tbody tr:hover {
  background-color: var(--wash);
  box-shadow: none;
}

/* ---------------------------------------------------------------- admonitions
   A hairline frame and Material's own icon in its own colour: the type of
   note is worth a colour, the box around it is not. */
.md-typeset .admonition[class],
.md-typeset details[class] {
  border-width: 1px;
  border-color: var(--rule);
  border-radius: 0.15rem;
  box-shadow: none;
  font-size: 0.9em;
}

.md-typeset .admonition-title,
.md-typeset summary {
  background-color: var(--wash) !important;
  font-weight: 700;
}

/* ---------------------------------------------------------------- footer */
.md-footer {
  border-top: 1px solid var(--rule);
}

.md-footer__title {
  line-height: 1.3;
}

.md-footer__direction {
  color: var(--ink-3);
  font-style: italic;
  line-height: 1.3;
}

.md-footer-meta {
  border-top: 1px solid var(--rule);
}

/* Material lays this row out with the copyright on the left and social
   links on the right. With none, the right is empty and the copyright looks
   off-centre, so the row is centred. */
.md-footer-meta__inner {
  justify-content: center;
}

.md-copyright {
  margin: auto;
  text-align: center;
}

.md-copyright,
.md-copyright__highlight {
  color: var(--ink-3);
}

.md-copyright a {
  color: var(--ink-2);
}

/* ---------------------------------------------------------------- review marks
   Only the internal build has these: the plugin wraps what it keeps there,
   and nowhere else. A block gets a rule down its left side in the colour of
   the widest audience that also receives it, public over beta over partner,
   and a note above it naming every one. Content no other build receives is
   marked in internal's colour and noted "Internal only"; content only an
   audience you added yourself receives is marked in grey. Inline marks get
   a tint instead, and name their audiences when you point at them. */
.md-typeset .audience-block,
.md-typeset .audience-inline {
  --mark: var(--aud-other);
}

.md-typeset [data-reach=""] { --mark: var(--aud-internal); }
.md-typeset [data-reach~="partner"] { --mark: var(--aud-partner); }
.md-typeset [data-reach~="beta"] { --mark: var(--aud-beta); }
.md-typeset [data-reach~="public"] { --mark: var(--aud-public); }

.md-typeset .audience-block {
  margin: 1.4em 0;
  padding: 0.1em 0 0.1em 1rem;
  border-left: 2px solid var(--mark);
}

.md-typeset .audience-block::before {
  content: attr(data-label);
  display: block;
  margin-bottom: 0.15em;
  font-size: 0.82em;
  font-style: italic;
  color: var(--mark);
}

.md-typeset .audience-block > :first-child { margin-top: 0; }
.md-typeset .audience-block > :last-child { margin-bottom: 0; }

.md-typeset .audience-inline {
  background-color: var(--wash);
  background-color: color-mix(in srgb, var(--mark) 13%, transparent);
  border-bottom: 1px solid var(--mark);
  border-bottom: 1px solid color-mix(in srgb, var(--mark) 60%, transparent);
  padding: 0 0.12em;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

/* ---------------------------------------------------------------- print
   Material leaves the banner off printed pages. Here it stays, in black, so
   a page printed from the internal, partner or beta build still says which
   build it came from. The doubled class outranks the band colour that
   overrides/main.html sets. */
@media print {
  .md-banner.md-banner {
    display: block;
    color: #000;
    background: none;
    border-bottom: 1px solid #000;
  }
  .md-typeset .audience-block::before { color: #000; }
}
BD_EXTRA_CSS_EOF
    write_owned docs/assets/favicon.svg <<'BD_FAVICON_EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00796b">
  <rect x="3" y="3" width="18" height="3" rx="1"/>
  <rect x="5" y="8" width="14" height="3" rx="1"/>
  <rect x="7" y="13" width="10" height="3" rx="1"/>
  <rect x="9" y="18" width="6" height="3" rx="1"/>
</svg>
BD_FAVICON_EOF
    scaffold_fonts
    if owns_nav_titles; then
        write_owned docs/assets/styles/nav-titles.css <<'BD_NAV_TITLES_EOF'
/* Kept empty on purpose. bootstrap-docs v27 and earlier put the sidebar
   titles here; since v28, extra.css does it. An older mkdocs.yml still lists
   this file under extra_css, so it stays: delete it together with that line
   if you like. */
BD_NAV_TITLES_EOF
    fi
}

scaffold_overrides() {
    write_owned overrides/main.html <<'BD_MAIN_HTML_EOF'
{% extends "base.html" %}

{#- Build banner. Every build except public says which audience it was built
    for, on a band in that audience's colour, using Material's documented
    `announce` block. The band's colour is set in `extrahead`: from the
    variables extra.css defines, or, without that file, from the colours
    written here. An audience you add yourself gets a grey band. Nothing
    renders for the public build. -#}
{% block extrahead -%}
  {{ super() }}
  {%- set audience = config.extra.audience -%}
  {%- if audience and audience != "public" %}
  {%- set band = {"internal": "#6b2f99", "partner": "#1b579b", "beta": "#7f4a03"}.get(audience, "#3b3e44") %}
  <style>.md-banner{background-color:var(--band-{{ audience }},var(--band-other,{{ band }}));color:#fff}</style>
  {%- endif %}
{%- endblock %}

{% block announce -%}
  {%- set audience = config.extra.audience -%}
  {%- if audience and audience != "public" -%}
    <p class="build-note" data-build="{{ audience }}"><strong>{{ audience | capitalize }} build.</strong> Not for public release.</p>
  {%- endif -%}
{%- endblock %}
BD_MAIN_HTML_EOF
}

scaffold_leak_check() {
    write_owned bin/check-leaks.py <<'BD_CHECKER_EOF'
#!/usr/bin/env python3
"""Build every declared audience; verify nothing leaked and no link is broken.

First it reads every page's metadata, as MkDocs finds it, and stops if any
page's tagging can't be trusted: frontmatter that isn't valid YAML, an
`audiences:` value that is empty or not a list or string, a key that is almost
`audiences`, or a line near the top that looks like a tag MkDocs doesn't read.
With `untagged: error`, the plugin's default, a page that names no audiences
stops it too.

Then, for each audience declared in mkdocs.yml, it:
  1. builds the site with --strict (no --quiet: warnings must fail the build)
  2. checks that no raw or misspelt audience marker survived into any file
  3. checks that no page source (a .MD file, an editor backup) was copied in
  4. checks that every page excluded for that audience is absent from the output
  5. checks that no output page links to an excluded page
  6. checks that the search index lists no excluded page
  7. outside the internal build, checks that every file copied from docs/ that
     isn't a page is used by the build: linked from one of its pages or
     stylesheets, or one of the files every build gets (assets/, CNAME,
     robots.txt, favicon.ico, hidden files)
  8. checks that every link within the site resolves in the build, however
     it's written: each URL a page points at (href, src, srcset, poster or
     data) has to lead to a file in the output, a link to a folder to its
     index.html, and a #fragment to an element with that id (or an <a> with
     that name) on the target page; # and #top mean the top of the page. Full
     URLs, even ones that start with site_url, and mailto:, tel:, javascript:
     and data: URLs aren't checked.

Checks 2 to 8 read only the built output, docs/ and the page frontmatter, so
they also catch a builder that ignored the plugin (Zensical does this
silently). To verify output from another builder, build each audience into
DIST/<audience>/ yourself and run this script with --no-build.

The page rule is re-implemented here on purpose, independently of the plugin,
so a bug in the plugin cannot also hide itself from this check. mkdocs.yml is
read with MkDocs's own loader, so the audience list is the one MkDocs uses.

Usage:
  bin/check-leaks.py                      # build all audiences into dist/, verify
  bin/check-leaks.py --builder properdocs # build with ProperDocs instead of MkDocs
  bin/check-leaks.py --no-build           # verify existing dist/<audience>/ only

Expected output when everything is clean (one line per audience, then a summary):
  [check-leaks] internal: built; 6 pages checked; clean
  [check-leaks] partner: built; 6 pages checked (3 excluded); clean
  [check-leaks] beta: built; 6 pages checked (3 excluded); clean
  [check-leaks] public: built; 6 pages checked (4 excluded); clean
  [check-leaks] all audiences clean
(Those counts are for the default demo project; yours grow with your pages.)
Exit status: 0 clean; 1 a build failed, something leaked or a link is broken;
2 configuration error.
"""

from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
VENV = ROOT / ".venv"

# Re-run inside the project's virtualenv if we were started from outside it,
# so PyYAML, MkDocs and the builder are the project's own versions.
_venv_python = VENV / "bin" / "python"
if (
    _venv_python.exists()
    and Path(sys.prefix).resolve() != VENV.resolve()
    and os.environ.get("CHECK_LEAKS_REEXEC") != "1"
):
    os.environ["CHECK_LEAKS_REEXEC"] = "1"
    os.execv(str(_venv_python), [str(_venv_python), str(Path(__file__).resolve()), *sys.argv[1:]])

try:
    import yaml
except ImportError:
    print("[check-leaks] error: PyYAML is not available. Run this inside the project's "
          "virtualenv, or install the project first: pip install -r requirements.txt",
          file=sys.stderr)
    sys.exit(2)

PRIVILEGED = "internal"
DOC_SUFFIXES = (".md", ".markdown", ".mdown", ".mkdn", ".mkd")
# Any comment that starts with a word; one whose word is almost "audience" is a
# marker the plugin should have removed, or a misspelt one it never saw.
COMMENT_WORD_RE = re.compile(r"<!--+\s*/?\s*(?P<word>[A-Za-z]+)")
# A page source that ended up in the output as a file: an upper-case extension
# MkDocs doesn't treat as a page, or an editor's backup of a page.
SOURCE_COPY_RE = re.compile(
    r"(?i)(\.(md|markdown|mdown|mkdn|mkd)(\.(bak|orig|old|tmp|swp))?$|~$|^#.*#$)"
)
BINARY_SUFFIXES = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf",
    ".eot", ".pdf", ".zip", ".gz", ".tgz", ".bz2", ".xz", ".mp4", ".webm", ".mp3", ".ogg",
    ".wav", ".avif", ".bmp", ".tif", ".tiff",
}
# How MkDocs 1.x finds page metadata (mkdocs/utils/meta.py): a YAML block, or
# else MultiMarkdown-style "key: value" lines at the top of the page.
YAML_RE = re.compile(r"^-{3}[ \t]*\n(.*?\n)(?:\.{3}|-{3})[ \t]*\n", re.DOTALL)
META_RE = re.compile(r"^[ ]{0,3}(?P<key>[A-Za-z0-9_-]+):\s*(?P<value>.*)")
META_MORE_RE = re.compile(r"^([ ]{4}|\t)(\s*)(?P<value>.*)")
AUDIENCE_LINE_RE = re.compile(r"""^\s*(?:[-*]\s*)?["']?(?P<key>[A-Za-z][\w-]*)["']?\s*(?:[:=]|\[)""")
FENCE_RE = re.compile(
    r"(?ms)"
    r"(?P<fenced>^[ ]{0,3}(?P<fence>```+|~~~+)[^\n]*\n.*?^[ ]{0,3}(?P=fence)[ \t]*$)"
    r"|"
    r"(?P<inline>`[^`\n]*`)",
)
FILENAME_AUDIENCE_RE = re.compile(r"^_(?P<audience>[a-z]+)-")
FILENAME_NEAR_RE = re.compile(r"^_[A-Za-z]+[-_]")


class _TolerantLoader(yaml.SafeLoader):
    """SafeLoader that ignores tags it doesn't know (!!python/name, !ENV, ...)."""


_TolerantLoader.add_multi_constructor("", lambda loader, suffix, node: None)


def log(msg: str) -> None:
    print(f"[check-leaks] {msg}", flush=True)


def load_settings(config_file: Path) -> dict:
    """The audience settings, as MkDocs resolves them (!ENV, INHERIT and the rest)."""
    os.environ.setdefault("NO_MKDOCS_2_WARNING", "true")
    try:
        from mkdocs.config import load_config
    except ImportError:
        log("error: MkDocs is not installed here. Install the project first: "
            "pip install -r requirements.txt")
        sys.exit(2)
    try:
        cfg = load_config(config_file=str(config_file))
    except (Exception, SystemExit) as exc:  # MkDocs raises Abort on a configuration error
        log(f"error: cannot read {config_file}: {exc}")
        sys.exit(2)
    plugin = cfg["plugins"].get("audience")
    if plugin is None:
        log(f"error: no 'audience' plugin in {config_file}; nothing to check")
        sys.exit(2)
    audiences = [str(a) for a in plugin.config["audiences"]]
    if not audiences:
        log(f"error: the audience plugin's 'audiences:' list in {config_file} is empty")
        sys.exit(2)
    return {
        "audiences": audiences,
        "filename_convention": bool(plugin.config["filename_convention"]),
        # A plugin older than 0.4.0 has no such setting and built untagged pages for public.
        "untagged": str(plugin.config.get("untagged", "public")),
        "docs_dir": Path(cfg["docs_dir"]).resolve(),
        "use_directory_urls": bool(cfg["use_directory_urls"]),
        "site_url": str(cfg["site_url"] or ""),
        "config": cfg,
    }


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def audiences_like(key: str) -> bool:
    """A key that is almost 'audiences', such as 'audience' or 'audeinces'."""
    key = key.lower()
    return key != "audiences" and edit_distance(key, "audiences") <= 2


def audience_line(line: str) -> bool:
    """A line that looks like it tags a page: 'audiences: ...', '- audience: ...', and so on."""
    m = AUDIENCE_LINE_RE.match(line)
    return bool(m) and (m.group("key").lower() == "audiences" or audiences_like(m.group("key")))


def marker_like(word: str) -> bool:
    word = word.lower()
    return word.startswith("audience") or edit_distance(word, "audience") <= 2


def code_checker(text: str):
    regions = [(m.start(), m.end()) for m in FENCE_RE.finditer(text)]
    return lambda pos: any(start <= pos < end for start, end in regions)


def stray_audience_line(text: str, lines: int = 60) -> str | None:
    """The first line near the top of an untagged page, outside code, that looks
    like a tag; MkDocs reads no audiences from such a page."""
    in_code = code_checker(text)
    offset = 0
    for n, line in enumerate(text.split("\n")):
        if n >= lines:
            break
        if not in_code(offset) and audience_line(line):
            return line.strip()
        offset += len(line) + 1
    return None


def read_meta(text: str) -> tuple[dict, str | None]:
    """The page's metadata as MkDocs reads it, and a problem if it can't be read."""
    m = YAML_RE.match(text)
    if m:
        try:
            data = yaml.load(m.group(1), Loader=_TolerantLoader)
        except yaml.YAMLError as exc:
            if not any(audience_line(line) for line in m.group(1).split("\n")):
                return {}, None  # MkDocs shows it as text; it names no audiences
            return {}, f"frontmatter is not valid YAML: {getattr(exc, 'problem', None) or exc}"
        return (data if isinstance(data, dict) else {}), None
    data: dict = {}
    key = None
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if not line.strip():
            break
        m1 = META_RE.match(line)
        if m1:
            key = m1.group("key").lower().strip()
            value = m1.group("value").strip()
            data[key] = f"{data[key]} {value}" if key in data else value
            continue
        m2 = META_MORE_RE.match(line)
        if m2 and key:
            data[key] += " " + m2.group("value").strip()
            continue
        break
    return data, None


def page_audiences(path: Path, filename_convention: bool) -> tuple[list[str] | None, str | None]:
    """(audiences the page is tagged for or None if untagged, problem or None)."""
    names: list[str] = []
    if filename_convention:
        m = FILENAME_AUDIENCE_RE.match(path.name)
        if m:
            names.append(m.group("audience"))
        elif FILENAME_NEAR_RE.match(path.name):
            return None, "the file name looks like the _NAME-page.md convention but doesn't follow it"
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError) as exc:
        return None, f"cannot read the page: {exc}"
    meta, problem = read_meta(text)
    if problem:
        return None, problem
    keys = [k for k in meta if str(k).lower() == "audiences"]
    if not keys:
        near = [str(k) for k in meta if audiences_like(str(k))]
        if near:
            return None, f"the frontmatter key {near[0]!r} isn't 'audiences', so the page counts as untagged"
        stray = stray_audience_line(text)
        if stray:
            return None, (f"the line {stray!r} near its top looks like a tag, but MkDocs reads "
                          "no audiences from the page")
    for key in keys:
        raw = meta[key]
        if isinstance(raw, str):
            found = [s.strip() for s in raw.split(",") if s.strip()]
        elif isinstance(raw, list) and all(s is not None for s in raw):
            found = [str(s).strip() for s in raw if str(s).strip()]
        elif raw is None or isinstance(raw, list):
            return None, ("'audiences:' has an empty value or entry; if it says '!name', YAML "
                          "read that as a tag: negation works in markers but not in frontmatter")
        else:
            return None, f"'audiences:' must be a list of names or a comma-separated string, not {raw!r}"
        if not found:
            return None, "'audiences:' names no audience"
        if any(n.startswith("!") for n in found):
            return None, "'audiences:' names a negated audience; negation works in markers but not in frontmatter"
        names.extend(found)
    return (names or None), None


def page_visible(audience: str, declared: list[str] | None, untagged: str = "public") -> bool:
    if audience == PRIVILEGED:
        return True
    if declared is None:
        return untagged == "public" and audience == "public"
    return audience in declared


def doc_pages(settings: dict) -> list[PurePosixPath]:
    """Every page MkDocs would build, found the way MkDocs finds them, so pages
    exclude_docs leaves out aren't checked."""
    from mkdocs.structure.files import InclusionLevel, get_files
    return sorted(
        PurePosixPath(f.src_uri) for f in get_files(settings["config"])
        if f.is_documentation_page() and f.inclusion != InclusionLevel.EXCLUDED
    )


def output_forms(page: PurePosixPath, use_directory_urls: bool) -> tuple[str, set[str]]:
    """Return (expected output file, every URL form that points at the page)."""
    stem = page.with_suffix("")
    if stem.name in ("index", "README"):
        directory = stem.parent.as_posix()
        out_file = posixpath.join(directory, "index.html") if directory != "." else "index.html"
        forms = {page.as_posix(), out_file}
        if directory != ".":
            forms.add(directory)
        return out_file, forms
    if use_directory_urls:
        out_file = f"{stem.as_posix()}/index.html"
        return out_file, {page.as_posix(), stem.as_posix(), out_file}
    out_file = f"{stem.as_posix()}.html"
    return out_file, {page.as_posix(), out_file}


class _Hrefs(HTMLParser):
    """Every href in a page, however it's quoted or cased, every other URL an
    element points at (src, srcset, poster, data), and every id a link's
    #fragment can point at (id, and name on <a>)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hrefs: list[str] = []
        self.refs: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if not value:
                continue
            if name == "id" or (tag == "a" and name == "name"):
                self.ids.add(value)
            if name == "href":
                self.hrefs.append(value)
                self.refs.append(value)
            elif name in ("src", "poster", "data"):
                self.refs.append(value)
            elif name == "srcset":
                self.refs.extend(p.strip().split()[0] for p in value.split(",") if p.strip())


# url(...) and @import in a stylesheet.
CSS_REF_RE = re.compile(r"""url\(\s*(['"]?)(?P<url>[^'")]+)\1\s*\)|@import\s+(['"])(?P<imp>[^'"]+)\3""")
# Files every build gets, whether or not a page links to them.
ALWAYS_KEPT_TOP = {"CNAME", "robots.txt", "favicon.ico"}


def always_kept(rel: str) -> bool:
    parts = rel.split("/")
    return parts[0] == "assets" or rel in ALWAYS_KEPT_TOP or any(p.startswith(".") for p in parts)


def resolve_href(base_dir: str, href: str, site_url: str) -> str | None:
    href = href.strip().split("#", 1)[0].split("?", 1)[0]
    if site_url:
        for prefix in {site_url, site_url.rstrip("/")}:
            if prefix and href.startswith(prefix):
                href = "/" + href[len(prefix):].lstrip("/")
                break
    if not href or "://" in href or href.startswith(("mailto:", "tel:", "javascript:", "data:", "//")):
        return None
    href = unquote(href)
    if href.startswith("/"):
        path = urlsplit(site_url).path.strip("/") if site_url else ""
        href = href.lstrip("/")
        if path and (href == path or href.startswith(path + "/")):
            href = href[len(path):].lstrip("/")
        resolved = posixpath.normpath(href or ".")
    else:
        resolved = posixpath.normpath(posixpath.join(base_dir, href))
    return None if resolved in (".", "") else resolved


def link_target(base_dir: str, ref: str, site_url: str) -> tuple[str, str] | None:
    """Where a link within the site leads: (path in the build, fragment). The
    path is "" for the page itself, and starts with "../" when the link leaves
    the folder the site is served from. None for a full URL, or a mailto:,
    tel:, javascript: or data: link, which aren't checked."""
    parts = urlsplit(ref.strip())
    if parts.scheme or parts.netloc:
        return None
    path, frag = unquote(parts.path), unquote(parts.fragment)
    if path.startswith("/"):
        root = urlsplit(site_url).path.strip("/") if site_url else ""
        path = path.lstrip("/")
        if root:
            if not (path == root or path.startswith(root + "/")):
                return "../" + path, frag
            path = path[len(root):].lstrip("/")
        return posixpath.normpath(path or "."), frag
    if not path:
        return "", frag
    return posixpath.normpath(posixpath.join(base_dir, path)), frag


def broken_links(out: Path, links: dict[str, list[str]], ids: dict[str, set[str]],
                 sources: dict[str, str], skip: dict[str, str], site_url: str) -> list[str]:
    """Every link within the site, on every page of one build, that leads
    nowhere in that build: to no file or folder, or to an anchor no element on
    the target page has. A link to an excluded page (in skip) is reported as a
    leak instead."""
    found: list[str] = []
    for page, refs in links.items():
        where = sources.get(page, page)
        base = posixpath.dirname(page)
        for ref in refs:
            target = link_target(base, ref, site_url)
            if target is None:
                continue
            path, frag = target
            if path in skip:
                continue
            if path == ".." or path.startswith("../"):
                served = urlsplit(site_url).path if site_url else ""
                found.append(f"broken link: {where} -> {ref} (outside the site, which is "
                             f"served from {served or '/'})")
                continue
            if path == "":
                path = page
            elif path == "." or (out / path).is_dir():
                path = posixpath.join("" if path == "." else path, "index.html")
            if not (out / path).is_file():
                found.append(f"broken link: {where} -> {ref} (not in this build)")
            elif frag and path in ids and frag not in ids[path] and frag.lower() != "top":
                on = "this page" if path == page else sources.get(path, path)
                found.append(f"broken anchor: {where} -> {ref} (no anchor '{frag}' on {on} "
                             f"in this build)")
    return sorted(set(found))


def verify(out: Path, audience: str, pages, settings) -> tuple[list[str], list[str], int]:
    problems: list[str] = []
    excluded: dict[str, set[str]] = {}
    used: set[str] = set()
    links: dict[str, list[str]] = {}
    ids: dict[str, set[str]] = {}
    # The page each built HTML file comes from, to name it in messages.
    sources = {output_forms(page, settings["use_directory_urls"])[0]: page.as_posix() for page in pages}
    for page in pages:
        declared, _ = page_audiences(settings["docs_dir"] / page, settings["filename_convention"])
        if page_visible(audience, declared, settings["untagged"]):
            continue
        out_file, forms = output_forms(page, settings["use_directory_urls"])
        excluded[page.as_posix()] = forms
        if (out / out_file).exists():
            problems.append(f"excluded page was built: {page} -> {out_file}")

    all_forms = {form: page for page, forms in excluded.items() for form in forms}
    for path in sorted(p for p in out.rglob("*") if p.is_file()):
        rel = path.relative_to(out)
        if SOURCE_COPY_RE.search(path.name):
            problems.append(f"page source copied into the build: {rel}")
        if path.suffix.lower() in BINARY_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if any(marker_like(m.group("word")) for m in COMMENT_WORD_RE.finditer(line)):
                problems.append(f"raw audience marker survived: {rel}:{lineno}")
        base = rel.parent.as_posix()
        base = "" if base == "." else base
        if path.suffix.lower() == ".css":
            for m in CSS_REF_RE.finditer(text):
                target = resolve_href(base, m.group("url") or m.group("imp"), settings["site_url"])
                if target:
                    used.add(target)
            continue
        if path.suffix.lower() not in (".html", ".htm"):
            continue
        parser = _Hrefs()
        try:
            parser.feed(text)
        except Exception:
            problems.append(f"page unreadable as HTML: {rel}")
            continue
        links[rel.as_posix()] = parser.refs
        ids[rel.as_posix()] = parser.ids
        for href in parser.hrefs:
            target = resolve_href(base, href, settings["site_url"])
            if target in all_forms:
                problems.append(f"link to excluded page {all_forms[target]}: {rel} -> {href}")
        for ref in parser.refs:
            target = resolve_href(base, ref, settings["site_url"])
            if target:
                used.add(target)

    # Outside internal, a file copied from docs/ that isn't a page has to be
    # used by the build; one only an excluded page used must not be there.
    if audience != PRIVILEGED:
        for path in sorted(p for p in out.rglob("*") if p.is_file()):
            rel = path.relative_to(out).as_posix()
            if not (settings["docs_dir"] / rel).is_file() or rel.lower().endswith(DOC_SUFFIXES):
                continue  # made by the build, or a page source (reported above)
            if always_kept(rel) or rel in used:
                continue
            problems.append(f"file no page in this build links to: {rel}")

    index = out / "search" / "search_index.json"
    if index.exists():
        try:
            docs = json.loads(index.read_text(encoding="utf-8")).get("docs", [])
        except (OSError, ValueError):
            docs = []
            problems.append("search index unreadable: search/search_index.json")
        listed = set()
        for doc in docs:
            loc = posixpath.normpath(str(doc.get("location", "")).split("#")[0] or ".")
            if loc in all_forms and loc not in listed:
                listed.add(loc)
                problems.append(f"search index lists excluded page {all_forms[loc]}")

    broken = broken_links(out, links, ids, sources, all_forms, settings["site_url"])
    return sorted(set(problems)), broken, len(excluded)


def build(audience: str, out: Path, config_file: Path, builder: str) -> bool:
    exe = Path(sys.prefix) / "bin" / builder
    exe = str(exe) if exe.exists() else shutil.which(builder)
    if not exe:
        if builder == "mkdocs":
            log("error: 'mkdocs' not found. Install the project first: pip install -r requirements.txt")
        else:
            log(f"error: '{builder}' not found. Install it into the project's environment first: "
                f"uv pip install {builder}  (without uv: .venv/bin/pip install {builder})")
        sys.exit(2)
    env = dict(os.environ, MKDOCS_AUDIENCE=audience, NO_MKDOCS_2_WARNING="true")
    cmd = [exe, "build", "--strict", "--clean", "--config-file", str(config_file), "--site-dir", str(out)]
    result = subprocess.run(cmd, cwd=config_file.parent, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode != 0:
        log(f"{audience}: BUILD FAILED (exit {result.returncode}); last lines of output:")
        for line in result.stdout.strip().splitlines()[-15:]:
            print(f"    {line}")
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Build every audience; verify nothing leaked and no link is broken.")
    parser.add_argument("--config", default=None, help="path to mkdocs.yml (default: project root)")
    parser.add_argument("--dist", default=None, help="output root (default: <project>/dist)")
    parser.add_argument("--builder", default="mkdocs", help="build command: mkdocs (default) or properdocs")
    parser.add_argument("--no-build", action="store_true", help="verify existing <dist>/<audience>/ only")
    args = parser.parse_args()

    config_file = Path(args.config).resolve() if args.config else ROOT / "mkdocs.yml"
    dist = Path(args.dist).resolve() if args.dist else ROOT / "dist"
    settings = load_settings(config_file)
    pages = doc_pages(settings)
    if not pages:
        log(f"error: no Markdown pages found under {settings['docs_dir']}")
        return 2

    unreadable = []
    for page in pages:
        names, problem = page_audiences(settings["docs_dir"] / page, settings["filename_convention"])
        if problem:
            unreadable.append(f"{page}: {problem}")
        elif names is None and settings["untagged"] == "error":
            unreadable.append(f"{page}: names no audiences; add audiences: to its frontmatter, "
                              "or set untagged: public in mkdocs.yml")
    if unreadable:
        log("FAILED before building: these pages' tagging can't be trusted, so a build could")
        log("publish them to the wrong audience. Fix them first:")
        for line in unreadable:
            print(f"    {line}")
        return 1

    failed: list[str] = []
    for audience in settings["audiences"]:
        out = dist / audience
        if args.no_build:
            if not out.is_dir():
                log(f"{audience}: FAIL; {out} does not exist (build it first, or drop --no-build)")
                failed.append(audience)
                continue
            how = "existing output"
        else:
            if not build(audience, out, config_file, args.builder):
                failed.append(audience)
                continue
            how = "built"
        problems, broken, n_excluded = verify(out, audience, pages, settings)
        excluded_note = f" ({n_excluded} excluded)" if n_excluded else ""
        checked = f"{len(pages)} page{'' if len(pages) == 1 else 's'} checked"
        found = []
        if problems:
            found.append(f"LEAK ({len(problems)} problem{'' if len(problems) == 1 else 's'})")
        if broken:
            found.append(f"BROKEN LINKS ({len(broken)})")
        if found:
            log(f"{audience}: {how}; {checked}{excluded_note}; {'; '.join(found)}")
            listed = problems + broken
            for problem in listed[:20]:
                print(f"    {problem}")
            if len(listed) > 20:
                print(f"    ... and {len(listed) - 20} more")
            failed.append(audience)
        else:
            log(f"{audience}: {how}; {checked}{excluded_note}; clean")

    if failed:
        log(f"FAILED: {', '.join(failed)}. Do not publish these builds.")
        return 1
    log("all audiences clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
BD_CHECKER_EOF
    chmod +x bin/check-leaks.py
}

scaffold_serve() {
    write_owned bin/serve <<'BD_SERVE_EOF'
#!/usr/bin/env bash
# Preview this project in your browser.
#
#   bin/serve              the internal build, live: it rebuilds as you save
#   bin/serve public       any audience declared in mkdocs.yml, live
#   bin/serve all          every build at one address, as each audience will
#                          get it: checked first, and not live
#
# Serves on 127.0.0.1 only, so other machines can't reach it. Uses port 8000,
# or the next free port up to 8020. Ctrl-C stops it.
#
# A live preview doesn't stop on warnings: a link to a page or file that
# doesn't exist prints a WARNING line here, and the page still updates. Other
# broken links print less: a missing anchor, an absolute or folder-style link
# to nothing, or a link written in HTML prints an INFO line or nothing.
# bin/check-leaks.py and CI fail on every broken link, so run it before you
# publish.

set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
    echo "usage: bin/serve [audience | all]    (default: internal)"
}

case "${1:-}" in
    -h|--help) usage; exit 0 ;;
esac
if [ $# -gt 1 ]; then
    usage >&2
    exit 2
fi
audience="${1:-internal}"

if [ ! -x .venv/bin/mkdocs ]; then
    cat >&2 <<'EOF'
[serve] error: .venv/bin/mkdocs not found, so the project isn't installed here.
  Install it from this folder, then run bin/serve again:
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
  With uv instead: uv venv, then uv pip install -r requirements.txt
EOF
    exit 1
fi

# The first free port from 8000 to 8020; empty if none is free. It binds the
# way MkDocs's server does (SO_REUSEADDR), so a port still settling after a
# preview that just stopped counts as free, and a running server doesn't.
free_port() {
    .venv/bin/python - <<'PY'
import socket
for port in range(8000, 8021):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        break
PY
}

pick_port() {
    port=$(free_port)
    if [ -z "$port" ]; then
        echo "[serve] error: ports 8000 to 8020 are all in use. Stop another preview (Ctrl-C in its terminal) and try again." >&2
        exit 1
    fi
    if [ "$port" != 8000 ]; then
        echo "[serve] port 8000 is in use (another preview still running?); using $port"
    fi
}

if [ "$audience" = all ]; then
    if [ ! -f bin/check-leaks.py ]; then
        echo "[serve] error: 'bin/serve all' needs bin/check-leaks.py, which this project doesn't have (WANT_LEAK_CHECK=false)." >&2
        exit 1
    fi
    echo "[serve] building and checking every audience first: bin/check-leaks.py"
    if ! .venv/bin/python bin/check-leaks.py; then
        echo "[serve] error: the leak check failed (see above), so nothing was served. To look at one build meanwhile: bin/serve internal" >&2
        exit 1
    fi
    pick_port
    exec .venv/bin/python - "$port" <<'PY'
# Serve the builds bin/check-leaks.py just made in dist/, with a page at /
# that lists them. Only the audiences mkdocs.yml declares are served: a
# folder an audience you have since removed left in dist/ wasn't checked.
import html
import http.server
import io
import posixpath
import sys
import threading
import urllib.parse
import webbrowser
from pathlib import Path

import yaml

port = int(sys.argv[1])
root = Path("dist")


# A SafeLoader that ignores tags it doesn't know (!ENV, !!python/name, ...).
class Loader(yaml.SafeLoader):
    pass


Loader.add_multi_constructor("", lambda loader, suffix, node: None)
cfg = yaml.load(Path("mkdocs.yml").read_text(encoding="utf-8"), Loader=Loader) or {}
title = str(cfg.get("site_name") or "Documentation")
plugins = cfg.get("plugins") or []
if isinstance(plugins, dict):
    plugins = [{name: opts} for name, opts in plugins.items()]
declared = ["internal", "public"]
for entry in plugins:
    if isinstance(entry, dict) and "audience" in entry:
        declared = list((entry["audience"] or {}).get("audiences") or declared)
builds = [str(n) for n in declared if (root / str(n) / "index.html").is_file()]

what = {
    "internal": "Every page and block, each marked block noted",
    "partner": "Pages and blocks tagged partner",
    "beta": "Pages and blocks tagged beta",
    "public": "Pages and blocks tagged public",
}
rows = "\n".join(
    f'<li class="b-{html.escape(n)}"><a href="{html.escape(n)}/">{html.escape(n.capitalize())}</a>'
    f'<span>{html.escape(what.get(n, "Pages and blocks tagged " + n))}</span></li>'
    for n in builds
)
fonts = ""
for n in builds:
    if (root / n / "assets/fonts/charter_regular.woff2").is_file():
        fonts = "".join(
            f'@font-face{{font-family:"Charter";src:url("{html.escape(n)}/assets/fonts/charter_{f}.woff2") format("woff2");'
            f"font-weight:{w};font-style:{s};ascent-override:98%;descent-override:23.6%;line-gap-override:0%}}"
            for f, w, s in (("regular", 400, "normal"), ("italic", 400, "italic"), ("bold", 700, "normal"))
        )
        break
page = f'''<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}: every build</title>
<style>
{fonts}
:root{{--paper:#fff;--ink:#1d1e20;--ink-3:#737881;--rule:#e3e5e8;--link:#007a6c;--hover:#ff6e42;--internal:#7b3fa8;--partner:#1f62ad;--beta:#965a08;--public:#22724a;--other:#4a4e55;color-scheme:light dark}}
@media (prefers-color-scheme:dark){{:root{{--paper:#17181b;--ink:#e6e7e9;--ink-3:#888d95;--rule:#2d2f34;--link:#00ccb8;--internal:#c59cea;--partner:#8cb8f2;--beta:#e5b160;--public:#80c89c;--other:#b6b9bf}}}}
body{{margin:0;background:var(--paper);color:var(--ink);font:18px/1.6 "Charter","Bitstream Charter",Palatino,"Palatino Linotype","Noto Serif","Liberation Serif",Georgia,serif}}
main{{max-width:34rem;margin:12vh auto;padding:0 1.25rem}}
h1{{font-weight:400;font-size:2.1rem;line-height:1.15;letter-spacing:-.01em;margin:0 0 .35rem}}
p{{margin:0 0 2.2rem;color:var(--ink-3);font-style:italic}}
ul{{list-style:none;margin:0;padding:0;border-top:1px solid var(--rule)}}
li{{display:flex;gap:1.2rem;align-items:baseline;padding:.8rem 0 .8rem 1rem;border-bottom:1px solid var(--rule);border-left:2px solid var(--other)}}
li.b-internal{{border-left-color:var(--internal)}}li.b-partner{{border-left-color:var(--partner)}}li.b-beta{{border-left-color:var(--beta)}}li.b-public{{border-left-color:var(--public)}}
a{{color:var(--link);font-weight:700;min-width:5.5rem;text-decoration:none}}
a:hover,a:focus{{color:var(--hover)}}
span{{color:var(--ink-3)}}
@media (max-width:30rem){{li{{flex-direction:column;gap:0}}}}
</style>
<main>
<h1>{html.escape(title)}</h1>
<p>Every build, as its audience will get it.</p>
<ul>
{rows}
</ul>
</main>
'''
body = page.encode("utf-8")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def log_message(self, *args):
        pass

    def send_head(self):
        path = posixpath.normpath(urllib.parse.unquote(urllib.parse.urlsplit(self.path).path))
        if path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return io.BytesIO(body)
        if path.lstrip("/").split("/", 1)[0] not in builds:
            self.send_error(404, "Not one of this project's checked builds")
            return None
        return super().send_head()


url = f"http://127.0.0.1:{port}/"
try:
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
except OSError as exc:
    sys.exit(f"[serve] error: can't serve on 127.0.0.1:{port} ({exc.strerror}). Run bin/serve all again.")
with server:
    print(f"[serve] {', '.join(builds)} on {url}; your browser opens to a page listing them. Ctrl-C stops it.", flush=True)
    threading.Timer(0.3, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[serve] stopped.")
PY
fi

pick_port
echo "[serve] $audience preview on 127.0.0.1:$port; your browser opens once it's built. Ctrl-C stops it."

# NO_MKDOCS_2_WARNING hides Material's notice about MkDocs 2.0 (see the guide).
export MKDOCS_AUDIENCE="$audience" NO_MKDOCS_2_WARNING=true
exec .venv/bin/mkdocs serve --open --no-strict --dev-addr "127.0.0.1:$port"
BD_SERVE_EOF
    chmod +x bin/serve
}

scaffold_ci() {
    local check_step
    if $WANT_LEAK_CHECK; then
        check_step="      - name: Build every audience and verify nothing leaked
        run: python bin/check-leaks.py"
    else
        check_step="      - name: Build every audience (strict)
        env:
          NO_MKDOCS_2_WARNING: \"true\"
        run: |
          for a in $(audience_list ' '); do
            MKDOCS_AUDIENCE=\$a mkdocs build --strict --site-dir dist/\$a
          done"
    fi
    write_owned .github/workflows/build.yml <<EOF
name: build docs

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
${check_step}
      - name: Upload the public build
        uses: actions/upload-artifact@v7
        with:
          name: public
          path: dist/public
EOF
}

# Check every audience, then start the preview, or say how to start it.
finish() {
    if $WANT_LEAK_CHECK; then
        log "building and checking every audience: bin/check-leaks.py"
        if ! bin/check-leaks.py; then
            die "the leak check failed (see above), so the preview was not started.
  Fix what it lists and run this script again. To look at the site meanwhile:
    $(cd_line) && bin/serve"
        fi
    fi
    if ! $WANT_SERVE; then
        print_done "Done. To preview:"
        return 0
    fi
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        note "no terminal (input or output is redirected), so the preview was not started"
        print_done "Done. To preview:"
        return 0
    fi
    print_done "Done. Starting the internal preview. To start it again later:"
    exec bin/serve internal
}

# The cd command for the project, written so that it can be pasted into a shell.
cd_line() {
    case "$SHOWN_PATH" in
        *[!A-Za-z0-9._/~+-]*) printf 'cd %q' "$PROJECT_PATH" ;;
        *) printf 'cd %s' "$SHOWN_PATH" ;;
    esac
}

print_done() {
    local others=""
    if $WANT_PARTNER && $WANT_BETA; then
        others=" (or partner, or beta)"
    elif $WANT_PARTNER; then
        others=" (or partner)"
    elif $WANT_BETA; then
        others=" (or beta)"
    fi
    echo
    echo "$1"
    echo
    echo "  $(cd_line)"
    echo "  bin/serve              the internal build, which shows everything"
    echo "  bin/serve public       the public build${others}"
    if $WANT_LEAK_CHECK; then
        echo "  bin/serve all          every build at one address, as each audience gets it"
    fi
    echo
    if $WANT_LEAK_CHECK; then
        echo "Before you publish, run bin/check-leaks.py. It rebuilds dist/<audience>/ and"
        echo "must end with \"all audiences clean\"."
    else
        echo "To build the public site into dist/public/:"
        echo "  MKDOCS_AUDIENCE=public .venv/bin/mkdocs build --site-dir dist/public"
    fi
    echo
}

main "$@"
exit
}

````