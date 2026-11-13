<div class="mdb-wide"></div>

# Bootstrap-mdbook script

The script scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview.
For more details, see [Publish a book or a knowledge base](./publish-book.md).


````bash
#!/bin/bash
# bootstrap-mdbook.sh, v69
#
# Makes an mdBook book at PROJECT_DIR/BOOK_NAME, or updates one, the way mdBook's
# own docs say to by hand, then opens a preview: part 1 is the steps, in order;
# part 2 is every file they write. A re-run rewrites the files it owns and leaves
# src/ and README.md alone. Linux x86_64. How to use it: mdb-guide.md.
#
#   bash bootstrap-mdbook.sh                 make or update the book, check it, preview it
#   bash bootstrap-mdbook.sh update          the same, taking the newest releases first
#   bash bootstrap-mdbook.sh remove          delete what the script downloaded for this book
#   SERVE=false bash bootstrap-mdbook.sh     make or update it without the preview at the end
#   ./build                                  in the book: build it; stop on a broken link

set -euo pipefail

## ─── settings ────────────────────────────────────────────────────────────
# Each setting: mdb-guide.md, "The toggles". A re-run applies what changed here.

PROJECT_DIR="$HOME/Desktop"               # the folder the book's folder goes in; ~ allowed
BOOK_NAME="mybook"                        # the book's folder: letters, digits, . _ -
BOOK_TITLE="mybook"                       # the title readers see
BOOK_AUTHOR="John Doe"
BOOK_DESCRIPTION=""                       # a line about the book, for search engines;
                                          # "" = none
DEPLOY_BRANCH="main"                      # pushes here deploy; git's default branch
HEADING_NUMBERS=false                     # true: numbered headings (mdbook-numbering;
                                          # needs Rust's cargo)
SIDEBAR_NUMBERS=true                      # sidebar chapter numbers (1., 1.1.)
THEME="picker"                            # "picker" (default): a button for Auto, Light
                                          # and Dark, starting on Auto; "auto": light or
                                          # dark as the reader's system is set; "dark":
                                          # the dark palette for every reader
GIT_REPO_URL=""                           # https://github.com/user/repo; "" = none
CODE_LINE_NUMBERS=true                    # numbers language-fenced blocks of 10+ lines
SIDEBAR_MASTHEAD="text"                   # "text", "none", or "image" (src/logo.svg)
FAVICON_TEXT="auto"                       # "auto" (the title's first letter), up to 3
                                          # characters, or ""; src/logo.svg wins
OFFLINE="full"                            # "full" (default): saving the book in the
                                          # reader's browser, and a copy to download
                                          # for any computer, online or air-gapped;
                                          # "download": the copy only; "none": neither
# The footer's version label comes from git, stamped by the workflow: the tag on
# the built commit, or the nearest one plus a count (v1.2+5). Tag a release with
#   git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0

RELEASE_WAIT_DAYS=7                       # a release is taken once out this long: most
                                          # hijacked ones are pulled within a week
SERVE=${SERVE:-true}

## ─── part 1: the steps ───────────────────────────────────────────────────
# Each step is a function, in the order main runs them; mdb-guide.md, "By hand", has
# the same steps without the script. Sourced, the script runs nothing.

main() {
    UPDATE=false
    case ${1:-} in
        "") ;;
        update) UPDATE=true ;;
        remove) check_needs; remove_tools; return 0 ;;
        *) die "unknown command: $1. The script takes update, remove, or nothing (the usage is at its top)" ;;
    esac
    [ $# -le 1 ] || die "one command at a time: update, remove, or nothing"
    check_needs        # 1
    make_repo          # 2
    choose_releases    # 3
    install_tools      # 4
    start_book         # 5
    write_files        # 6 to 10
    first_commit       # 11, said: yours to make
    check_and_preview  # 12
}

# 1. curl, git and python3 run; this isn't root; the settings make sense. Each tool
#    is run, not only found: on Whonix /usr/bin/git is a Tor wrapper, there whether
#    git is installed or not. All that's missing is named at once.
check_needs() {
    local t miss=""
    for t in curl git python3; do "$t" --version >/dev/null 2>&1 || miss+=" $t"; done
    [ -z "$miss" ] || die "missing:$miss. On Debian or Ubuntu: sudo apt-get install$miss, then run this again"
    [ "$EUID" -ne 0 ] || die "run this as yourself, not with sudo or as root: nothing here needs root, and the book would be left root's"
    check_settings
    site_urls
    PROJECT_DIR=${PROJECT_DIR/#\~/$HOME}
    [[ $PROJECT_DIR == /* ]] || PROJECT_DIR=$PWD/$PROJECT_DIR
    BOOK_DIR=$PROJECT_DIR/$BOOK_NAME
    [ ! -e "$BOOK_DIR/build" ] || grep -q bootstrap-mdbook.sh "$BOOK_DIR/build" \
        || die "$BOOK_DIR/build isn't this script's: move it aside (mv build build.own), then run this again"
}

# 2. The book's folder, a git repository on DEPLOY_BRANCH, origin from GIT_REPO_URL, .gitignore:
#    bin/ and book/, and editors' swap, lock and backup files, which carry your login,
#    this computer's name and the folder's path.
make_repo() {
    local ssh l
    NEW_REPO=false
    mkdir -p "$BOOK_DIR/bin"
    cd "$BOOK_DIR"
    [ -e .git ] || { git init -q -b "$DEPLOY_BRANCH"; NEW_REPO=true; }
    if [ -n "$GIT_REPO_URL" ]; then
        ssh=git@github.com:${GIT_REPO_URL#https://github.com/}.git
        if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin "$ssh"; say "added remote origin: $ssh"
        elif [ "$(git config --get remote.origin.url)" != "$ssh" ]; then git remote set-url origin "$ssh"; say "changed remote origin to $ssh"; fi
    fi
    touch .gitignore
    for l in bin/ book/ '*~' '.*.sw[a-p]' '.#*' '\#*#'; do
        grep -qxF "$l" .gitignore && continue
        [ -z "$(tail -c 1 .gitignore)" ] || echo >> .gitignore
        echo "$l" >> .gitignore
    done
}

# 3. The releases the workflow pins. What it doesn't pin yet (a new book), and with update
#    everything, is looked up: the newest mdBook 0.5.x, lychee and actions out RELEASE_WAIT_DAYS,
#    mdBook's and lychee's with the sha256 GitHub recorded for the file step 4 downloads.
choose_releases() {
    local a t u tag commit old
    NUMBERING_VERSION="" MDBOOK_DIGEST="" LYCHEE_DIGEST=""
    MDBOOK_VERSION=$(kept mdbook) || { t=$(newest rust-lang/mdBook 'v0\.5\.[0-9]+' 'mdbook-{tag}-x86_64-unknown-linux-gnu.tar.gz'); read -r MDBOOK_VERSION _ MDBOOK_DIGEST <<< "$t"; }
    LYCHEE_VERSION=$(kept lychee) || { t=$(newest lycheeverse/lychee 'lychee-v[0-9]+\.[0-9]+\.[0-9]+' 'lychee-x86_64-unknown-linux-gnu.tar.gz'); read -r LYCHEE_VERSION _ LYCHEE_DIGEST <<< "$t"; LYCHEE_VERSION=${LYCHEE_VERSION#lychee-v}; }
    for a in checkout upload-pages-artifact deploy-pages; do
        if old=$(kept "actions/$a"); then
            u="actions/$a@$old"
        else
            t=$(newest "actions/$a" 'v[0-9]+\.[0-9]+\.[0-9]+') tag=${t%% *} commit=${t#* }
            old=$(pin "actions/$a")
            [ "${old#* # }" != "$tag" ] || [ "${old%% *}" = "$commit" ] \
                || die "actions/$a's tag $tag now names commit $commit, but the workflow pins ${old%% *} for it: the tag has moved. Check the release on GitHub; to go on, delete its uses: line from .github/workflows/deploy.yml"
            u="actions/$a@$commit # $tag"
        fi
        case $a in
            checkout) CHECKOUT_USES=$u ;;
            upload-pages-artifact) UPLOAD_USES=$u ;;
            *) DEPLOY_USES=$u ;;
        esac
    done
    [ "$HEADING_NUMBERS" = false ] || NUMBERING_VERSION=$(kept numbering) || NUMBERING_VERSION=$(newest_crate mdbook-numbering)
}

# What the workflow pins for $1, kept; with update, or with nothing pinned, nothing, and 1.
kept() {
    local p=""
    [ "$UPDATE" = true ] || p=$(pin "$1")
    [ -n "$p" ] && printf '%s' "$p"
}

# 4. mdBook and lychee into bin/, each tarball kept there and hashed for the workflow;
#    mdbook-numbering by cargo, unless it has that version.
install_tools() {
    MDBOOK_SHA256=$(install_tool mdbook "$MDBOOK_VERSION" "https://github.com/rust-lang/mdBook/releases/download/$MDBOOK_VERSION/mdbook-$MDBOOK_VERSION-x86_64-unknown-linux-gnu.tar.gz" mdbook "$MDBOOK_DIGEST")
    LYCHEE_SHA256=$(install_tool lychee "$LYCHEE_VERSION" "https://github.com/lycheeverse/lychee/releases/download/lychee-v$LYCHEE_VERSION/lychee-x86_64-unknown-linux-gnu.tar.gz" lychee-x86_64-unknown-linux-gnu/lychee "$LYCHEE_DIGEST")
    [ "$HEADING_NUMBERS" = true ] || return 0
    cargo install --list | grep "^mdbook-numbering v$NUMBERING_VERSION:" >/dev/null \
        || cargo install --locked --version "$NUMBERING_VERSION" mdbook-numbering
    command -v mdbook-numbering >/dev/null || export PATH="${CARGO_HOME:-$HOME/.cargo}/bin:$PATH"
}

# 5. A new book: mdbook init, then the starter pages. README.md when there's none.
start_book() {
    local out
    if [ ! -f src/SUMMARY.md ]; then
        out=$(./bin/mdbook init --force --ignore none --title "$BOOK_TITLE" 2>&1) || die "mdbook init stopped: $out"
        render_summary > src/SUMMARY.md
        render_about > src/about.md
        render_chapter > src/chapter_1.md
        render_demo_svg > src/demo.svg
    fi
    [ -e README.md ] || render_readme > README.md
}

# 6 to 10: the files mdBook reads, ./build, and the workflow.
write_files() {
    local mark
    # 6. book.toml.
    render_book_toml > book.toml
    # 7. The theme files mdBook takes in place of its own.
    mkdir -p theme/fonts src/fonts
    render_head > theme/head.hbs
    render_fonts_css > theme/fonts/fonts.css
    if [ -f src/logo.svg ]; then cp src/logo.svg theme/favicon.svg
    elif mark=$(favicon_mark) && [ -n "$mark" ]; then render_favicon_svg "$mark" > theme/favicon.svg; fi
    # 8. The additional-css and additional-js files book.toml names.
    render_custom_css > custom.css
    render_custom_js > custom.js
    render_version_js > version.js
    # 9. ./build, and the offline.py it runs after mdbook build.
    render_build > build
    chmod +x build
    render_offline > offline.py
    # 10. The deploy workflow.
    mkdir -p .github/workflows
    render_workflow > .github/workflows/deploy.yml
    say "wrote book.toml, theme/, custom.css, custom.js, version.js, build, offline.py and .github/workflows/deploy.yml, which pins mdBook $MDBOOK_VERSION, lychee $LYCHEE_VERSION, checkout ${CHECKOUT_USES##* }, upload-pages-artifact ${UPLOAD_USES##* } and deploy-pages ${DEPLOY_USES##* }${NUMBERING_VERSION:+, and mdbook-numbering $NUMBERING_VERSION}"
}

# 11. The first commit is yours, by hand: what it holds, and whose name and time it
#     carries, is yours to check. A new repository gets the command, said once.
first_commit() {
    [ "$NEW_REPO" = true ] || return 0
    say "nothing is committed: check what's in the folder (git status), then commit it yourself (mdb-guide.md, \"The first commit\")"
}

# 12. The check CI runs, then the preview (SERVE=false: not the preview).
check_and_preview() {
    ./build
    say "first deploy: push, then Settings -> Pages -> Source -> \"GitHub Actions\", once."
    if [ "$SERVE" = false ]; then
        say "preview: cd \"$BOOK_DIR\" && ./bin/mdbook serve --open"
        return 0
    fi
    say "preview: http://localhost:3000 (Ctrl-C to stop); later: cd \"$BOOK_DIR\" && ./bin/mdbook serve --open"
    exec ./bin/mdbook serve --open
}

# remove: what the script downloaded: this book's bin/, and mdbook-numbering, which cargo built.
remove_tools() {
    [ -d "$BOOK_DIR" ] || die "there's no book at $BOOK_DIR: set PROJECT_DIR and BOOK_NAME to the book's"
    if [ -d "$BOOK_DIR/bin" ]; then
        rm -rf "${BOOK_DIR:?}/bin"
        say "removed $BOOK_DIR/bin: mdbook, lychee and the files they came from"
    else
        say "$BOOK_DIR has no bin/ to remove"
    fi
    if command -v cargo >/dev/null && cargo install --list | grep -q '^mdbook-numbering v'; then
        cargo uninstall mdbook-numbering
        say "removed mdbook-numbering: a book with HEADING_NUMBERS=true builds it again at its next run"
    fi
    say "the book and its workflow are as they were: the next run downloads the releases the workflow pins"
}

## ─── helpers ─────────────────────────────────────────────────────────────

say()  { echo "$*"; }
warn() { echo "WARN: $*" >&2; }
die()  { echo "ERROR: $*" >&2; exit 1; }

# SITE_URL (book.toml's site-url) and PAGES_URL (the live site) from GIT_REPO_URL.
site_urls() {
    local r=${GIT_REPO_URL#https://github.com/}
    SITE_URL="" PAGES_URL=""
    [ -n "$GIT_REPO_URL" ] || return 0
    # user.github.io publishes at the root, any other repo under its name.
    if [ "${r#*/}" = "${r%/*}.github.io" ]; then SITE_URL=/ PAGES_URL="https://${r%/*}.github.io/"
    else SITE_URL="/${r#*/}/" PAGES_URL="https://${r%/*}.github.io/${r#*/}/"; fi
}

# Release file $3 (tool $1, version $2), kept in bin/ as $1-$2.tar.gz and downloaded only when
# it isn't there; unpacks $4 from it to bin/$1 and prints the tarball's sha256. Looked up, it
# must be the file GitHub recorded, sha256 $5; a version the workflow pins must be the file it
# pins. Another stops the run, and isn't kept.
install_tool() {
    local keep=bin/$1-$2.tar.gz file=bin/$1-$2.tar.gz tmp sha
    if [ ! -f "$keep" ]; then
        file=$(mktemp "bin/.$1.XXXXXX")
        fetch "$3" -o "$file" || { rm -f "$file"; die "could not download $3: each release needs github.com once"; }
    fi
    sha=$(sha256sum "$file") sha=${sha%% *}
    if [ -n "${5:-}" ] && [ "$sha" != "$5" ]; then
        [ "$file" != "$keep" ] || die "$keep has sha256 $sha, but GitHub recorded $5 for $1 $2: it has changed since it was downloaded. Delete it and run this again, online"
        rm -f "$file"
        die "$3 has sha256 $sha, not $5, the one GitHub recorded for it: it wasn't kept. Run this again; if it says the same, something between you and GitHub is changing the file"
    fi
    if [ "$(pin "$1")" = "$2" ] && [ -n "$(pin "$1-sha")" ] && [ "$(pin "$1-sha")" != "$sha" ]; then
        [ "$file" != "$keep" ] || die "$keep has sha256 $sha, but the workflow pins $(pin "$1-sha") for $1 $2: it has changed since it was downloaded. Delete it and run this again, online"
        rm -f "$file"
        die "$3 has sha256 $sha, but the workflow pins $(pin "$1-sha") for it: the file has changed since it was pinned. Check the release on GitHub; to go on, delete the line with the pinned sha256 from .github/workflows/deploy.yml"
    fi
    [ "$file" = "$keep" ] || mv -f "$file" "$keep"
    tmp=$(mktemp -d "bin/.$1.XXXXXX")
    tar -xzf "$keep" -C "$tmp" "$4" || { rm -rf "$tmp"; die "no $4 in $keep"; }
    mv -f "$tmp/$4" "bin/$1"
    rm -rf "$tmp"
    # The tarballs of other releases go.
    find bin -maxdepth 1 -name "$1-*.tar.gz" ! -name "${keep#bin/}" -delete
    printf '%s' "$sha"
}

# $1 is one of the rest.
one_of() {
    local v=$1 x
    shift
    for x; do [ "${!v}" != "$x" ] || return 0; done
    die "$v must be one of: $*; got: ${!v}"
}

check_settings() {
    local v
    # Spelled out, not a range: under a UTF-8 locale a range lets 'ń' through.
    case $BOOK_NAME in ""|.*|-*|*[!abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-]*)
        die "BOOK_NAME is the book's folder: letters, digits, '.', '_' and '-' only, not starting with '.' or '-'; got: '$BOOK_NAME'" ;; esac
    [ -n "$BOOK_TITLE" ] || die "BOOK_TITLE must not be empty"
    for v in BOOK_TITLE BOOK_AUTHOR BOOK_DESCRIPTION DEPLOY_BRANCH FAVICON_TEXT GIT_REPO_URL; do
        [[ ${!v} != *[$'\n\r']* ]] || die "$v must be one line"
    done
    for v in HEADING_NUMBERS SIDEBAR_NUMBERS CODE_LINE_NUMBERS SERVE; do one_of "$v" true false; done
    one_of THEME picker auto dark; one_of SIDEBAR_MASTHEAD text none image; one_of OFFLINE full download none
    GIT_REPO_URL=${GIT_REPO_URL%/} GIT_REPO_URL=${GIT_REPO_URL%.git}
    [[ -z $GIT_REPO_URL || $GIT_REPO_URL =~ ^https://github\.com/[^/[:space:]]+/[^/[:space:]]+$ ]] \
        || die "GIT_REPO_URL must be https://github.com/user/repo, or \"\"; got: $GIT_REPO_URL"
    [ "$HEADING_NUMBERS" = false ] || command -v cargo >/dev/null \
        || die "HEADING_NUMBERS=true needs Rust's cargo: install Rust (https://rustup.rs), open a new terminal, then run this again"
    [ -z "${KEEP_PINS+x}" ] || die "KEEP_PINS is gone: every run keeps the releases the workflow pins, and bash bootstrap-mdbook.sh update takes newer ones (mdb-guide.md, \"Releases and updates\")"
    [ -z "${LAYOUT+x}" ] || die "LAYOUT is gone: delete its lines from the settings (mdb-guide.md, \"A section at a time, by hand\")"
}

# An https download: no ~/.curlrc, no redirect off https. The rest of curl's arguments follow.
fetch() { curl -q -fsSL --proto =https --proto-redir =https --connect-timeout 30 "$@"; }

# Release REPO's highest tag matching PATTERN, out RELEASE_WAIT_DAYS and not a pre-release:
# "tag commit". With FILE ({tag} for the tag), only a release whose file of that name has been
# up that long too: "tag commit sha256", the sha256 GitHub recorded for the file.
newest() {
    local refs json got
    echo "looking up $1's newest release on github.com..." >&2
    refs=$(git ls-remote --tags "https://github.com/$1") || die "could not ask github.com for $1's tags"
    json=$(fetch "https://api.github.com/repos/$1/releases?per_page=100") \
        || die "could not ask api.github.com for $1's releases (it answers 60 requests an hour from one address: try again later)"
    got=$(python3 -I -c '
import datetime as dt, json, re, sys
pattern, days, refs, name = re.compile(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
def old(s):
    return isinstance(s, str) and dt.datetime.fromisoformat(s.replace("Z", "+00:00")) <= cut
commit = {}
for line in refs.splitlines():
    sha, _, ref = line.partition("\t")
    tag = ref[len("refs/tags/"):]
    if tag.endswith("^{}"):
        commit[tag[:-3]] = sha
    else:
        commit.setdefault(tag, sha)
out = []
for r in json.load(sys.stdin):
    tag = r.get("tag_name") or ""
    if not (pattern.fullmatch(tag) and tag in commit and old(r.get("published_at"))
            and not r.get("draft") and not r.get("prerelease")):
        continue
    sha = ""
    if name:
        f = [a for a in r.get("assets") or [] if a.get("name") == name.replace("{tag}", tag) and a.get("state") == "uploaded"]
        if not f or not old(f[0].get("updated_at")):
            continue
        d = f[0].get("digest") or ""
        sha = " " + (d[7:] if re.fullmatch(r"sha256:[0-9a-f]{64}", d) else "?")
    out.append((tuple(int(n) for n in re.findall(r"[0-9]+", tag)), tag, sha))
if out:
    best = max(out)
    print(best[1] + " " + commit[best[1]] + best[2])
' "$2" "$RELEASE_WAIT_DAYS" "$refs" "${3:-}" <<< "$json")
    [ -n "$got" ] || die "no release of $1 has been out $RELEASE_WAIT_DAYS days yet${3:+, with its Linux file}"
    [ "${got##* }" != "?" ] || die "GitHub gives the sha256 of $1's Linux file in a form this script doesn't know, or none, so the download can't be checked"
    printf '%s' "$got"
}

# Crate $1's highest version out RELEASE_WAIT_DAYS and not yanked, from crates.io.
newest_crate() {
    local got
    echo "looking up $1's newest version on crates.io..." >&2
    got=$(fetch -A bootstrap-mdbook.sh "https://crates.io/api/v1/crates/$1/versions" | python3 -I -c '
import datetime as dt, json, re, sys
cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=int(sys.argv[1]))
out = [(tuple(int(n) for n in v["num"].split(".")), v["num"]) for v in json.load(sys.stdin)["versions"]
       if re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", v["num"]) and not v["yanked"]
       and dt.datetime.fromisoformat(v["created_at"].replace("Z", "+00:00")) <= cut]
if out:
    print(max(out)[1])
' "$RELEASE_WAIT_DAYS") || die "could not ask crates.io for $1's versions"
    [ -n "$got" ] || die "no version of $1 has been out $RELEASE_WAIT_DAYS days yet"
    printf '%s' "$got"
}

# What the workflow pins for $1: a version, a sha256 ($1-sha), or an action's "commit # tag".
# It reads render_workflow's lines back: a change to their wording there must be made here too.
pin() {
    local e
    case $1 in
        mdbook)     e='s/^      - name: Install mdBook \(v[0-9.]*\)$/\1/p' ;;
        lychee)     e='s/^      - name: Install lychee \([0-9.]*\)$/\1/p' ;;
        *-sha)      e="s/^ *echo \"\\([0-9a-f]\\{64\\}\\)  ${1%-sha}\\.tar\\.gz\".*/\\1/p" ;;
        numbering)  e='s/.*cargo install --locked --version \([0-9.]*\) mdbook-numbering$/\1/p' ;;
        actions/*)  e="s|^ *uses: $1@\\([0-9a-f]\\{40\\} # .*\\)$|\\1|p" ;;
    esac
    [ ! -f .github/workflows/deploy.yml ] || sed -n "$e" .github/workflows/deploy.yml | head -n 1
}

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

# FAVICON_TEXT as drawn: "auto", the title's first letter or digit as a capital; else up to 3.
favicon_mark() {
    if [ "$FAVICON_TEXT" != auto ]; then printf '%s' "${FAVICON_TEXT:0:3}"
    elif [[ $BOOK_TITLE =~ [[:alnum:]] ]]; then printf '%s' "${BASH_REMATCH[0]^^}"; fi
}

## ─── part 2: the files ───────────────────────────────────────────────────
# Each render_* prints one file. Quoted heredocs ('EOF') are literal; unquoted ones expand.

# README.md: the title and, with a repo, the live-site link; written once, then the author's.
render_readme() {
    if [ -n "$PAGES_URL" ]; then printf '# %s\n\nLive site: <%s>\n' "$BOOK_TITLE" "$PAGES_URL"; else printf '# %s\n' "$BOOK_TITLE"; fi
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
    # mdbook-numbering's code numbering breaks the copy button: off; custom.js draws a gutter instead.
    [ "$HEADING_NUMBERS" = false ] || cat <<'EOF'

[preprocessor.numbering]

[preprocessor.numbering.heading]
enable = true
numbering-style = "consecutive"

[preprocessor.numbering.code]
enable = false
EOF
}

# theme/head.hbs, before mdBook's script reads a saved theme: books on one github.io share it.
render_head() {
    if [ "$THEME" = picker ]; then
        cat <<'EOF'
{{!-- Script-owned. Clears a saved theme the button doesn't offer: books on one github.io share it. --}}
<script>try{const t=localStorage.getItem('mdbook-theme');if(t!==null&&t!=='light'&&t!=='ayu')localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    else
        cat <<'EOF'
{{!-- Script-owned. Clears a saved theme: no button, and books on one github.io share it. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
EOF
    fi
    # Night modes built on Dark Reader (Brave's and Firefox's on iOS) repaint both palettes unless locked out.
    cat <<'EOF'
{{!-- Script-owned. Night modes built on Dark Reader leave the book's own palettes alone. --}}
<meta name="darkreader-lock">
EOF
    [ "$OFFLINE" != full ] || cat <<'EOF'
{{!-- Script-owned (OFFLINE="full"): the web app manifest offline.py writes. --}}
<link rel="manifest" href="{{ path_to_root }}manifest.webmanifest">
EOF
}

# theme/fonts/fonts.css: there at all, it keeps mdBook's own fonts out.
render_fonts_css() {
    echo '/* Script-owned. No faces: its presence stops mdBook shipping Open Sans and Source Code Pro. */'
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


# All four Charter faces present: only then is @font-face written (else 404s).
charter_present() {
    local f
    for f in charter_regular charter_italic charter_bold charter_bold_italic; do
        [ -f "src/fonts/${f}.woff2" ] || return 1
    done
    return 0
}

render_custom_css() {
    # The palette's selectors: the class in each is load-bearing (mdb-guide.md, "Light and dark").
    local dark_sel="html.light,html.ayu" print_sel="html.light,html.ayu" light
    [ "$THEME" != dark ] || { dark_sel="html.ayu"; print_sel="html.ayu"; }
    [ "$THEME" != picker ] || print_sel="html.light,html.ayu,html.js.light"
    if [ "$THEME" != picker ]; then
        cat <<'EOF'
/* No theme button: theme/head.hbs clears a saved theme. */
#mdbook-theme-toggle { display: none; }
EOF
    else
        cat <<'EOF'
/* The theme menu's rows are buttons, which don't take the page's typeface. */
.theme-popup .theme { font-family: inherit; }
EOF
    fi
    if charter_present; then
        cat <<'EOF'

/* Self-hosted Charter; src/fonts/ is copied as is, not hashed. */
/* The files' Windows line metrics, for every system: the set others read has the descent's sign wrong, setting text 0.24em low. */
@font-face{font-family:"Charter";src:url("fonts/charter_regular.woff2") format("woff2");font-weight:400;font-style:normal;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_italic.woff2") format("woff2");font-weight:400;font-style:italic;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_bold.woff2") format("woff2");font-weight:700;font-style:normal;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
@font-face{font-family:"Charter";src:url("fonts/charter_bold_italic.woff2") format("woff2");font-weight:700;font-style:italic;font-display:swap;ascent-override:98%;descent-override:23.6%;line-gap-override:0%}
EOF
    else
        warn "src/fonts/ has no Charter woff2, so the fallback face renders: put the four from practicaltypography.com/charter.html in src/fonts/ and re-run."
        cat <<'EOF'

/* No @font-face: the Charter woff2 aren't in src/fonts/. */
EOF
    fi
    cat <<'EOF'

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
.content .mdb-updated{margin-block:1rem 2.4rem;font-size:.9em;font-style:italic;color:var(--muted);}

/* Blockquote, not admonitions (.blockquote-tag); edge margins zeroed so the rule sits flush. */
.content blockquote:not(.blockquote-tag){background:none;border-block:0;border-inline-start:3px solid var(--rule);padding:0 1em;color:var(--muted);}
.content blockquote:not(.blockquote-tag) > :first-child{margin-block-start:0;}
.content blockquote:not(.blockquote-tag) > :last-child{margin-block-end:0;}

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
    cat <<EOF
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
        printf '@media (prefers-color-scheme: light){\nhtml.light{\n%s\n}\n}\n' "$light"
        [ "$THEME" != picker ] || printf 'html.js.light{\n%s\n}\n' "$light"
        # html.js.light: the light highlight sheet is live under either selector above.
        cat <<'EOF'
/* The light sheet's green strings and additions, a shade darker for 4.5:1 on the code ground. */
@media screen{
html.js.light pre > code.hljs :is(.hljs-string,.hljs-symbol,.hljs-bullet){color:#007f00;}
html.js.light pre > code.hljs .hljs-addition{color:#207d36;}
}
EOF
    fi
    cat <<EOF

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
    cat <<'EOF'
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
        cat <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:calc(var(--menu-bar-height) + 1px + var(--mdb-top-gap));}
EOF
    else
        # Masthead band: sticky and opaque, with a hairline once the list scrolls under it.
        cat <<'EOF'
.sidebar .sidebar-scrollbox{padding-top:0;}
.sidebar-scrollbox::before{position:sticky;top:0;box-sizing:border-box;background-color:var(--sidebar-bg);border-block-end:1px solid transparent;}
.sidebar-scrollbox.mdb-scrolled::before{border-block-end-color:var(--table-border-color);}
.menu-title{transition:opacity .3s;}
html.sidebar-visible .menu-title{opacity:0;}
EOF
        if [ "$SIDEBAR_MASTHEAD" = text ]; then
            # BOOK_TITLE as text, not an SVG: an image can't load the webfont.
            cat <<EOF
.sidebar-scrollbox::before{content:"$(esc_dq "$BOOK_TITLE")";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);font-size:2.7rem;font-weight:200;line-height:calc(var(--menu-bar-height) - 4px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
EOF
        else
            # src/logo.svg as a mask on a layer of its own: on the sticky plate it would clip it.
            [ -f src/logo.svg ] || warn "SIDEBAR_MASTHEAD is \"image\" but src/logo.svg is missing; the sidebar shows an empty band until you add it"
            cat <<'EOF'
.sidebar-scrollbox::before{content:"";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);}
html.js .sidebar::after{content:"";position:absolute;top:0;left:10px;right:10px;height:calc(var(--menu-bar-height) + 1px);pointer-events:none;background-color:var(--sidebar-fg);-webkit-mask:url("logo.svg") no-repeat left center/auto 50%;mask:url("logo.svg") no-repeat left center/auto 50%;}
EOF
        fi
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        # The gutter sits beside <code>, never in it, so the copy button copies the source exactly.
        cat <<'EOF'
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
    if [ "$OFFLINE" != none ]; then
        cat <<'EOF'
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
}

render_custom_js() {
    cat <<EOF
// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy stamp is in version.js.
var MDB_REPO = "$(esc_dq "$GIT_REPO_URL")";
EOF
    [ "$OFFLINE" = none ] || echo "var MDB_OFFLINE = \"${OFFLINE}\";"
    cat <<'EOF'
// fn now, or once the page is parsed; every block below uses it.
var mdbReady = function (fn) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
  else fn();
};
(function () {

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
  mdbReady(function () {
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

  // Every link to another site, the pencil included, in a new tab; an email link opens the mail program.
  var away = function (a) {
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (/^https?:$/.test(u.protocol) && u.origin !== location.origin) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  };
  mdbReady(function () {
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) away(links[i]);
  });

  // The pencil in front of print, so print and the offline button, last, go together; a space apart, as mdBook's.
  mdbReady(function () {
    var right = document.querySelector("#mdbook-menu-bar .right-buttons");
    var print = right && right.querySelector('a[href$="print.html"]'), edit = right && right.querySelector('a[rel="edit"]');
    if (!print || !edit) return;
    right.insertBefore(edit, print);
    right.insertBefore(document.createTextNode(" "), print);
  });

  // Remove (not hide) prev/next links into src/unlisted/: book.js follows a hidden one too.
  mdbReady(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
  });

  // The masthead's hairline once the list scrolls under it.
  mdbReady(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // The sidebar footer; each part only if stamped (version.js).
  mdbReady(function () {
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
        away(s);
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
  mdbReady(function () {
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

    mdbReady(function () {
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
        cat <<'EOF'

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
  mdbReady(trim);
})();
EOF
    fi
    if [ "$CODE_LINE_NUMBERS" = true ]; then
        cat <<'EOF'

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
  mdbReady(gutters);
})();
EOF
    fi
    cat <<'EOF'

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
  mdbReady(run);
  // While a code block has focus, Left and Right scroll it instead of turning the page.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.matches && t.matches("pre > code.hljs")) e.stopPropagation();
  }, true);
})();
EOF
    if [ "$OFFLINE" != none ]; then
        cat <<'EOF'

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

  // What saving or updating fetches and keeps; pages counted once (no print, 404, toc, copies).
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
      if (page(path, files[path], seen)) {
        if (o && !o[2]) p.changed++;
        else p.added++;
      }
    });
    // Gone, or now the first chapter's copy: removed.
    Object.keys(old).forEach(function (path) {
      var f = files[path];
      if ((!f || (f[2] === 2 && !old[path][2])) && page(path, old[path], gone)) p.removed++;
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

  var wipe = async function () {
    var names = await caches.keys();
    for (var i = 0; i < names.length; i++)
      if (names[i].indexOf(PREFIX) === 0) await caches.delete(names[i]);
    var reg = await navigator.serviceWorker.getRegistration(ROOT);
    if (reg && reg.scope === ROOT) await reg.unregister();
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
      await lock(wipe);
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
      if (typeof COPY.home === "string" && /^https?:\/\//.test(COPY.home)) {
        var note = el("p", "mdb-offline-note", "Newer versions: "), home = el("a", null, COPY.home);
        home.href = COPY.home;
        home.setAttribute("data-k", COPY.home);
        home.target = "_blank";
        home.rel = "noopener noreferrer";
        note.appendChild(home);
        panel.appendChild(note);
      }
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
        await wipe();
      }).catch(function () {});
    }
  };
  mdbReady(start);
})();
EOF
    fi
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

# ./build: the build and link check, run by the author before a push and by the workflow.
render_build() {
    cat <<'EOF'
#!/usr/bin/env bash
# Builds the book into book/ and stops on a broken internal link or anchor, as lychee reports it.
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
report=$(./bin/lychee --offline --include-fragments --mode plain --no-progress \
    --root-dir "$PWD/book" --exclude-path book/print.html --exclude-path book/404.html \
    'book/**/*.html' 2>&1) || {
    printf '%s\n\nstopped: lychee found broken links or anchors, listed above under the built page each is on. fix them, then run ./build again.\n' "$report" >&2
    exit 1
}
echo "links: every internal link and anchor resolves"
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

# A commit that changes any of these is a version.
SOURCES = ["book.toml", "src", "theme", "custom.css", "custom.js", "version.js",
           "offline.py", "build", ".github/workflows/deploy.yml"]
# The download and its checksum, inside the built book.
FOLDER = "offline"
# The deploy stamp: version.js, or its fingerprinted name when mdBook hashes files.
STAMP = re.compile(r"version(-[0-9a-f]{8})?\.js")
FONT_TYPES = {".woff2": "font/woff2"}
# Mask images: the image masthead (src/logo.svg).
MASK_TYPES = {".svg": "image/svg+xml"}


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
    """A copy of the book's files under to."""
    for rel in files:
        dst = os.path.join(to, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
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
    info = {"version": version, "built": built, "copies": copies(book, files, version, built, commit)}
    if MODE == "full":
        # [size, SHA-256], then 2 for index.html copying the first chapter.
        listed = {}
        for rel in files:
            path = os.path.join(book, rel)
            listed[rel] = [os.path.getsize(path), sha256(path)]
        if first_chapter(book, files):
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

# The deploy workflow, pinned as step 3 found them; only the deploy job can publish.
# pin() reads its Install and uses: lines back: change their wording there too.
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
          curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 "\$base" -o mdbook.tar.gz
          # The digest the bootstrap checked: a tag names a file, not its bytes.
          echo "${MDBOOK_SHA256}  mdbook.tar.gz" | sha256sum -c -
          mkdir -p bin
          tar -xz -f mdbook.tar.gz --directory=bin mdbook${numbering_step}

      - name: Install lychee ${LYCHEE_VERSION}
        run: |
          set -euo pipefail
          base="https://github.com/lycheeverse/lychee/releases/download/lychee-v${LYCHEE_VERSION}/lychee-x86_64-unknown-linux-gnu.tar.gz"
          curl -q --fail -sSL --proto =https --proto-redir =https --tlsv1.2 "\$base" -o lychee.tar.gz
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

# Run, unless sourced: sourced, it defines the settings and functions only. return
# works only in a sourced file, so this also runs from stdin (bash < file).
(return 0 2>/dev/null) || main "$@"

````