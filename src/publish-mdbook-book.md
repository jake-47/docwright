# Publish a book or knowledge base: Mdbook guide
<p class="mdb-subtitle">A minimal mdBook on GitHub Pages like this one</p>

The [bootstrap-mdbook script](./bootstrap-mdbook.md) scaffolds an mdBook book, on its first run installs the newest mdBook release that has been out a week and pins it, keeping that release until you run `update`, writes a first-party GitHub Pages deploy workflow, and opens a live preview. The published site has the usual mdBook furniture — left-sidebar table of contents, built-in search, print/PDF view — with no analytics, no tracking, and no request from its pages to any other site (mdBook's Rust playground, which would make one, is off; see "Code line numbers"), and a reading theme: self-hosted Charter, a ~700px measure, a warm dark palette, one hairline closing each chapter's title, inked-and-underlined links, and a sidebar masthead that behaves like the menu bar. Out of the box, a button in the menu bar lets each reader switch between it and its light counterpart, starting on whichever their system asks for; `THEME` can instead follow the system's setting with no button, or give every reader the dark palette. A button beside print lets readers keep the book on their own devices: saved in the browser, or downloaded as a copy for a computer or for a phone, online or air-gapped (`OFFLINE`).

It is a one-shot bootstrapper. It seeds the project once; after that you own the files and edit `src/` directly. Re-running applies changed toggles, and `update` takes new releases, and it regenerates the script-owned files — see "Re-running vs. hand edits."

Linux x86_64 only. For macOS or ARM, see "Other platforms" at the end. On Whonix, read "Whonix" first.

## Three ways to set this up

There are three ways to build a site like this one. They differ only in how the files arrive; the result — the theme, the deploy workflow, the furniture — is identical.

1. **Clone the reference repo.** The fastest start: you get a working tree, and change the title, author, and repo rather than writing scaffolding.

   ```bash
   git clone REPLACE_WITH_REPO_URL mybook
   cd mybook
   rm -rf .git
   ```

   Replace `REPLACE_WITH_REPO_URL` with the repository URL. Don't skip `rm -rf .git`, which prints nothing: it deletes the clone's history. Kept, the reference repo's commits would go into your repo with your first push, each with its author's name, email and time zone, and with `OFFLINE` on (the default) the book's versions would count them. With the history gone, the script makes a fresh repository, and you make the first commit of your own (see "The first commit").

   A clone also carries *that* repo's URL baked into `book.toml` (`site-url`, `edit-url-template`), `README.md`, `custom.js` (`MDB_REPO`) and `offline.py` (`HOME`). Point them at *your own* empty repo: delete the clone's `README.md` and run the script with your `GIT_REPO_URL` set. It adds `origin` there, regenerates `book.toml`, `custom.js` and `offline.py`, and writes a new `README.md` because there is none. It does that in `PROJECT_DIR/BOOK_NAME`, so that path must be the clone; run the clone command above in `~/Desktop` and the defaults already match. Fonts, tagging, and Pages are then the same as the path below.

2. **Run the script.** The rest of this guide, from "Run it" on. Edit the toggles, run it once with no arguments, and it installs mdBook, writes every file, and opens a preview. Re-running applies changed toggles; `update` takes new releases.
3. **By hand.** mdBook's own docs, step by step, with nothing run for you: "By hand" has the steps, each with its page of mdBook's docs, its command and what it prints. The files' text is part 2 of the script, which you read and copy, or print one file at a time.

## Run it

1. Open `bootstrap-mdbook.sh` and edit the toggles at the top (below).
2. Run it with no arguments:

   ```bash
   bash bootstrap-mdbook.sh
   ```

It prints a `WARN:` line if the Charter fonts aren't in `src/fonts/` yet (see "Charter fonts"; the book builds without them), then one `wrote …` line naming the files it wrote and the releases the workflow pins. On a new book, the next line is `nothing is committed: check what's in the folder (git status), then commit it yourself`: the script makes no commits, and the first one is yours (see "The first commit"). Then comes `./build`'s output: mdBook's three `INFO` lines, an `offline: …` line unless `OFFLINE` is `"none"`, and `links: every internal link and anchor resolves`. Then the preview starts: `preview: http://localhost:3000 (Ctrl-C to stop)`, mdBook's `INFO Serving on: http://localhost:3000`, and your browser opens on the book. It keeps running, and rebuilds the book as you edit, until Ctrl-C. `SERVE=false bash bootstrap-mdbook.sh` does the same without the preview, ending at `./build`'s last line and a `preview:` line with the command that starts it.

After the first run the script works offline, and it doesn't look for new releases. It keeps the releases the workflow pins, using each one's tarball in `bin/`, and downloads a pinned release only when its tarball isn't there, as in a fresh clone. To take newer releases, run `bash bootstrap-mdbook.sh update` (see "Releases and updates").

If `./build` finds a broken link or anchor, the run stops there, with no preview, and lists them (see "The link check"); fix them and run the script again. To start the preview again later, in the book's folder:

```bash
./bin/mdbook serve --open
```

It prints `INFO Serving on: http://localhost:3000` and opens the book. If it stops instead with `Address already in use`, another preview has port 3000: stop that one, or add `-p 3001` and open `http://localhost:3001`. The preview builds into `book/`, as `./build` does, but checks no links and leaves out what `./build` adds after mdBook (the offline button's files; see "Read offline"). Before each push, run `./build`: the deploy runs the same check and stops on the same breaks.

Audit it first. Part 1 of the script is its steps, in order, each following mdBook's own docs; part 2 is every file they write. Network-wise, on a book's first run and with `update`, it asks `github.com` for the tags of mdBook, lychee and the workflow's three actions (`git ls-remote`), asks `api.github.com` when each one's releases came out and, for mdBook and lychee, the SHA-256 GitHub recorded for the Linux tarball, and downloads those tarballs from `github.com` when `bin/` doesn't have them, which redirects the download to its file host, `release-assets.githubusercontent.com`; each download is checked against that SHA-256 before it's kept (see "Releases and updates"). It installs nothing with `apt` or `sudo`, and stops if run as root: mdBook and lychee go into the book's `bin/`. It needs `curl`, `python3` and `git`, each one able to run (`git --version`), not only present; if any is missing it stops, names each, and prints the line that installs them (`sudo apt-get install …` on Debian or Ubuntu). `python3` reads GitHub's answers and runs `offline.py`. With `HEADING_NUMBERS=true` it also needs Rust's `cargo`, installed first (<https://rustup.rs>): it asks `crates.io` for `mdbook-numbering`'s versions the first time, and builds it with `cargo install`, which fetches its sources from crates.io, runs their build code, the crate's own and its dependencies', on your computer, as any `cargo install` does, and adds a few minutes to the first run. `./build` finds `mdbook-numbering` in `~/.cargo/bin`, which rustup puts on your PATH in terminals opened after it ran: in the one it ran in, run `. "$HOME/.cargo/env"` first, which prints nothing, or `./build` stops with ``The command `mdbook-numbering` wasn't found``.

## What it writes

Into the project folder (`PROJECT_DIR/BOOK_NAME`):

- `book.toml` — mdBook config, seeded from the toggles. **Script-owned.**
- `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md`, `src/demo.svg` — starter content (the SVG is the demo chapter's picture), written after `mdbook init` only if `src/SUMMARY.md` doesn't already exist. **Yours** thereafter.
- `custom.css`, `custom.js` — the theme and behaviours. **Script-owned.**
- `version.js` — the deploy stamp the sidebar footer and the `Last updated` lines read: four placeholders the deploy workflow fills in. **Script-owned.**
- `theme/head.hbs` — clears a theme saved in the reader's browser, or with `THEME="picker"` one the button doesn't offer (see "Light and dark"), and keeps night modes built on Dark Reader off the book's palettes (see "Why the dark palette comes first"); with `OFFLINE="full"` it also links the web app manifest (see "Read offline"). **Script-owned.**
- `theme/fonts/fonts.css` — keeps mdBook's own fonts out (see "The reading theme"). **Script-owned.**
- `theme/favicon.svg` — written from `src/logo.svg` if that exists, otherwise drawn from `FAVICON_TEXT`. **Script-owned while either source is set**; it is never deleted, only overwritten. See "The favicon."
- `README.md` — title, plus a live-site link if the book knows its repo (`GIT_REPO_URL`), written only if there's no `README.md` yet. **Yours** thereafter.
- `build` — the build and link check: `./build` builds the book and stops on any broken link or anchor, listing each under the built page it's on, as lychee reports it. The script runs it before the preview, and the deploy workflow runs the same file. **Script-owned.** If the book already has a `build` the script didn't write, the run stops before changing anything, so yours is never overwritten: move it aside (`mv build build.own`) and run again.
- `offline.py` — `OFFLINE`'s build step (see "Read offline"). `./build` runs it after mdBook, whatever the setting: it always writes the site's `sw.js`, and unless `OFFLINE` is `"none"` it makes the two downloads. Python 3.7 or later, standard library only. **Script-owned.**
- `.github/workflows/deploy.yml` — the Pages deploy workflow; it pins mdBook, lychee and its three actions, stamps the version, the commit's time and the per-page dates into `version.js`, and runs `./build` before deploying. **Script-owned.**
- `bin/mdbook`, `bin/lychee`, and the tarball each came from (`mdbook-VERSION.tar.gz`, `lychee-VERSION.tar.gz`) — the releases the workflow pins. A tarball is downloaded only when it isn't there, checked against the workflow's SHA-256 each run, and deleted when `update` takes another release. `bin/` is gitignored, and `remove` deletes it (see "Releases and updates").
- `.gitignore` — ignores `bin/` and `book/`, and editors' swap, lock and backup files (`*~`, `.*.sw[a-p]`, `.#*`, `\#*#`), which carry your login name, the computer's name and the folder's path; each line is added to a `.gitignore` that's there already when it lacks it.

"Script-owned" means a re-run regenerates it and discards hand edits.

Each is one of mdBook's own mechanisms, used as its docs describe: `book.toml` is its configuration; `theme/head.hbs`, `theme/fonts/fonts.css` and `theme/favicon.svg` are files mdBook takes from `theme/` in place of its built-in ones; `custom.css`, `custom.js` and `version.js` are what `additional-css` and `additional-js` in `book.toml` name. `build`, `offline.py` and the workflow run around `mdbook build`. "By hand" links each to its page of mdBook's docs.

One path under `src/` is reserved rather than written: chapters you put in `src/unlisted/` **and list in `SUMMARY.md`** are published but kept off the sidebar, the arrow chain and the search index. See "Unlisted chapters."

## The toggles

Edit these at the top of the script.

- `PROJECT_DIR` — parent folder the book is created in (e.g. `$HOME/Desktop`). A leading `~` and relative paths are resolved for you.
- `BOOK_NAME` — the project folder's name, under `PROJECT_DIR` (default `mybook`). Readers see it only in the offline downloads' names (see "Read offline"). ASCII letters, digits, `.`, `_` and `-` only, not starting with `.` or `-`: the characters GitHub allows in a repository name, so the folder and the repo can share a name, and nothing in it expands when you paste the `cd` line the script prints at the end. The repo's own name and the Pages URL still come from `GIT_REPO_URL`.
- `BOOK_TITLE` — the title readers see, written to `book.toml` and used for the masthead, the drawn favicon, `README.md` and the starter About page. Apostrophes, quotes and `/` are safe; it must not contain a newline. Change it and re-run, and the same book is retitled in place; `src/about.md` and `README.md`, being yours, keep the title they were written with.
- `BOOK_AUTHOR` — author, written to `book.toml`, and into the copy for a phone as its creator and publisher, which Kiwix shows. No page shows it (see "What a push publishes").
- `BOOK_DESCRIPTION` — one line about the book; `""` (default) for none. Written to `book.toml` as mdBook's `description`, which every page carries in its `<meta name="description">` for search engines, with `OFFLINE="full"` the web app's description, and unless `OFFLINE` is `"none"` the phone copy's description in Kiwix, its first 80 characters (see "Read offline"). It must not contain a newline.
- `DEPLOY_BRANCH` — git default branch, and the branch whose pushes trigger CI (default `main`).
- `HEADING_NUMBERS` — `true` adds automatic in-page heading numbers (H2–H6) via the `mdbook-numbering` preprocessor (its newest version that has been out a week when it's first turned on, pinned in the workflow and kept until `update`; see "Releases and updates"). Rust's `cargo` must be installed first (<https://rustup.rs>); the run compiles the preprocessor with it. Default `false`.
- `SIDEBAR_NUMBERS` — `true` (default) shows mdBook's built-in sidebar chapter numbers (`1.`, `1.1.`); `false` hides them (`no-section-label`). Independent of `HEADING_NUMBERS`: that numbers headings *in the page*, this numbers chapters *in the sidebar*.
- `THEME` — which of the theme's two palettes readers get. `"picker"` (default): a button in the menu bar with **Auto** (the reader's browser or OS setting), **Light** and **Dark**, starting on Auto, the choice kept in the reader's browser. `"auto"`: light or dark as the reader's browser or OS is set, with no control in the page. `"dark"`: the dark one, for every reader, whatever their browser or OS is set to. Charter and the rest of the theme in all three. See "Light and dark."
- `GIT_REPO_URL` — your repo URL, e.g. `https://github.com/user/repo` (https github.com only, and nothing after the repo; a trailing `/` or `.git`, as GitHub's Clone button gives, is dropped). Wires the edit (pencil) icon in the top bar, links the sidebar footer's commit hash, sets `site-url` (so the 404 page resolves its assets at any depth), fills the README's live-site link when the README is first written, and sets the git `origin` remote (converted to SSH) so your first push needs no manual `git remote add`; the run says when it adds or changes `origin`. Left empty, the pencil and `site-url` are omitted, the hash is plain text, and the README is just the title; set it later and the README stays as it is, so add the link yourself, or delete `README.md` and re-run. No repo icon is written — see "The top-bar icons."
- `CODE_LINE_NUMBERS` — `true` (default) numbers language-fenced code blocks of ten lines or more. See "Code line numbers."
- `SIDEBAR_MASTHEAD` — `text` (default), `none`, or `image`. What fills the sidebar band opposite the menu bar. See "The sidebar masthead."
- `FAVICON_TEXT` — what `theme/favicon.svg` draws when there is no `src/logo.svg` to copy. `"auto"` (default) takes the first alphanumeric character of `BOOK_TITLE`, a letter as a capital (`M` for `mybook`); any other string is drawn as typed, first three characters, case preserved; `""` draws nothing and leaves mdBook's own bundled icon alone. `src/logo.svg` always wins. See "The favicon."
- `OFFLINE` — `"full"` (default) adds a button beside print offering both: saving the book in the reader's browser, updated when they ask, and copies to download, one to keep on any computer and one for a phone, read in the Kiwix app, online or air-gapped. `"download"` offers the downloads only; `"none"` adds nothing a reader sees. See "Read offline."

**Upgrading from v70:** follow the note for v68 too if you're coming from it. Re-run, then commit what it changed: `custom.css`, `custom.js` and `offline.py`. `git status --short` should list those three and nothing else. Unless `OFFLINE` is `"none"`, `./build` now also writes `offline/BOOK_NAME-vN.zim` and its `.sha256` file, the copy for a phone (see "Read offline"), and its `offline:` line names the phone's copy and its size. The panel's download is now **Download for a computer**, with **Download for a phone** under it. The commit is a new version, so readers with a saved copy are offered one update.

**Upgrading from v68:** follow the note for v67 too if you're coming from it. Re-run, then commit `custom.js`. The script makes no commits at all now, on a new book either: see "The first commit". Every link to another site opens in a new tab, the menu bar's pencil and the sidebar footer's commit link included, where before only links in a chapter's text did; an email link, which before opened a blank tab as well, now opens the mail program alone. The commit is a new version, so readers with a saved copy are offered one update.

**Upgrading from v67:** follow the note for v66 too if you're coming from it. Re-run, then commit `.gitignore`: the run adds `*~`, `.*.sw[a-p]`, `.#*` and `\#*#` to it, editors' swap, lock and backup files. `git status --short` should list `.gitignore` and nothing else. Nothing a reader sees changes, and `.gitignore` isn't among the files a version counts, so readers with a saved copy aren't offered an update. Three things the run does differently: a first download of mdBook or lychee, on a new book or with `update`, is checked against the SHA-256 GitHub recorded for the file before anything is kept (see "Releases and updates"); `curl`, `git` and `python3` are checked by running them, so on Whonix, where `/usr/bin/git` is a wrapper that's there whether git is or not, a missing git stops the run at once, with every missing tool named; and a change to `origin` is said.

**Upgrading from v66:** follow the note for v65 too if you're coming from it. Re-run; there's nothing to commit, since no file the script writes has changed. A run no longer looks for new releases: it keeps what the workflow pins, and `bash bootstrap-mdbook.sh update` takes newer ones. `KEEP_PINS` is gone, since keeping the pins is now what every run does: with `KEEP_PINS=true` in front, a run stops (`ERROR: KEEP_PINS is gone: …`). `bash bootstrap-mdbook.sh remove` deletes what the script downloaded (see "Releases and updates").

**Upgrading from v65:** re-run, then commit what it changed: `custom.js`, `custom.css`, `offline.py` and `.github/workflows/deploy.yml`. `git status --short` should list those four and nothing else. Nothing a reader sees changes, but the commit is a new version, so readers with a saved copy are offered one update. The workflow's downloads now refuse anything but HTTPS, as the script's own do. `version.json` no longer carries the version history. The saved copy no longer inlines `.woff`, `.ttf`, `.otf` or `.png` files (the script writes none) and no longer counts redirect pages (the script makes none). `split-headings.py`, which versions up to v55 wrote, no longer counts toward the version number: in a book that had it, the number can drop, and readers' saved copies aren't offered updates until it passes their number again. `git log --oneline -- split-headings.py` prints nothing if your book never had it. The script runs from stdin again (`bash < bootstrap-mdbook.sh`), which v65 broke.

**Upgrading from v64:** follow the note for v65 too. Re-run; there's nothing to commit, since no file the script writes has changed. The run now keeps each release's tarball in `bin/` and downloads only a release it doesn't have yet, so the first run of v65 downloads mdBook and lychee once more, and later runs don't. With `github.com` out of reach, a run keeps what the workflow pins and goes on offline, where v64 stopped. `SERVE=false` ends a run before the preview. The script can be sourced to print one file at a time (see "By hand").

**Upgrading from v63:** follow the note for v64 too. Delete the `LAYOUT` lines from the settings block you carry over; with them, a run stops: `ERROR: LAYOUT is gone: delete its lines from the settings`. A book that used `"h2"`, `"nested"` or `"picker"` gets it back by hand: see "A section at a time, by hand". `GIT_REPO_URL` is no longer read from `origin`: if yours was empty and the book's `origin` is on github.com, set it to that repo (`https://github.com/USER/REPO`), or the pencil, `site-url`, the footer's commit link and the download's address for newer versions drop out. With `HEADING_NUMBERS=true`, install Rust first (<https://rustup.rs>): the script no longer does. Then re-run, and commit what it changed: `build`. `./build` now shows a break as lychee reports it, under the built page, not by the Markdown file and line (see "The link check"). The preview now runs on mdBook's own address, `http://localhost:3000`, building into `book/`, with no second server for `book/` (see "Read offline"): the `.preview/` folder, its line in `.gitignore`, and `bin/`'s `.mdbook.sha256`, `.mdbook.version`, `.lychee.sha256` and `.lychee.version` are no longer used, and can go. The pages are the same to the byte, so a copy a reader saved stays up to date.

## Re-running vs. hand edits

A re-run keeps the releases the workflow pins (`update` takes newer ones; see "Releases and updates"), downloads a release into `bin/` only when its tarball isn't there yet, checks each tarball against the SHA-256 the workflow pins, re-pins the workflow, and rewrites every **script-owned** file above from the toggles, then runs `./build` before the preview and stops there on a broken link. Your `src/` is preserved (the starter content is only written when `src/SUMMARY.md` is absent), and so is `README.md` (written only when there's none). The script never commits, on a first run or a re-run: what goes into a commit is yours to check (see "The first commit"). `theme/head.hbs` and `theme/fonts/fonts.css` are written from the current settings each run, so a change of `THEME` or `OFFLINE` never leaves a stale one behind: a `head.hbs` clearing every saved theme in a `"picker"` book would stop the button remembering any choice. A run as root, with `sudo` or otherwise, stops before it does anything, since nothing here needs root: run it as the book's owner.

So: edit `src/` and `README.md` freely and re-run whenever you like. But **hand edits to `book.toml`, `custom.css`, `custom.js`, `version.js`, `build`, `offline.py` or the workflow do not survive a re-run.** Inside `theme/` the script touches exactly three files — `theme/head.hbs`, `theme/fonts/fonts.css` and `theme/favicon.svg` — and hand edits to those three go the same way; anything *else* you put in `theme/` (a `favicon.png`, an `index.hbs`, a `css/chrome.css` override) is left alone, run after run. To change a script-owned file, either change the toggle that drives it and re-run, or edit it and then don't re-run.

## By hand

The script's twelve steps are the ones mdBook's docs give, in order; it only types them for you, all but step 11, the first commit, which is yours either way. Without it, take them one at a time. Each says which page of mdBook's docs it follows, the command, and what the command prints. Commands use `~/Desktop/mybook`; use your own folder, and `USER/REPO` for your GitHub repo.

1. **Tools.** `sudo apt-get install curl git python3` (on Debian or Ubuntu) installs what the steps use; apt lists what it installs, or says each is `already the newest version`.
2. **The folder and its repository.**

   ```bash
   mkdir -p ~/Desktop/mybook/bin && cd ~/Desktop/mybook
   git init -b main
   printf 'bin/\nbook/\n*~\n.*.sw[a-p]\n.#*\n\\#*#\n' > .gitignore
   git remote add origin git@github.com:USER/REPO.git
   ```

   `git init` prints `Initialized empty Git repository in /home/you/Desktop/mybook/.git/`; the rest print nothing.
3. **Choose the releases** ([Installation](https://rust-lang.github.io/mdBook/guide/installation.html), "Pre-compiled binaries"). On each project's releases page on GitHub, take the highest-numbered release that isn't marked **Pre-release** and came out at least a week ago: mdBook's (<https://github.com/rust-lang/mdBook/releases>) in its 0.5 series, which this theme is written for; lychee's (<https://github.com/lycheeverse/lychee/releases>), tagged `lychee-v`, not `lychee-lib-v`; and those of `actions/checkout`, `actions/upload-pages-artifact` and `actions/deploy-pages`. For each action, the commit its tag names:

   ```bash
   git ls-remote https://github.com/actions/checkout refs/tags/TAG 'refs/tags/TAG^{}'
   ```

   It prints one or two lines, each a 40-character commit and the tag: take the commit on the `^{}` line, or on the only line when there's no `^{}` one.
4. **Download mdBook and lychee into `bin/`** ([Continuous integration](https://rust-lang.github.io/mdBook/continuous-integration.html), "Pre-compiled binaries"). From each release's page, under **Assets**, download the file whose name ends `x86_64-unknown-linux-gnu.tar.gz` into `bin/`. Then:

   ```bash
   sha256sum bin/*.tar.gz
   tar -xzf bin/mdbook-*.tar.gz -C bin mdbook
   tar -xzf bin/lychee-*.tar.gz -C bin --strip-components=1 lychee-x86_64-unknown-linux-gnu/lychee
   ./bin/mdbook --version && ./bin/lychee --version
   ```

   `sha256sum` prints each tarball's SHA-256 and name: compare each with the `sha256:` GitHub shows beside the file, and keep both for step 10. `tar` prints nothing. The last line prints `mdbook v0.5.…` and `lychee 0.…`.
5. **Start the book** ([Creating a book](https://rust-lang.github.io/mdBook/guide/creating.html), [init](https://rust-lang.github.io/mdBook/cli/init.html)). `./bin/mdbook init --ignore none --title "My book"` prints `INFO Creating a new book with stub content` and `All done, no errors...`, and writes `book.toml`, `src/SUMMARY.md` and `src/chapter_1.md`. Write your own pages in `src/` (see "Writing content"), or take the script's starter pages from its `render_summary`, `render_about`, `render_chapter` and `render_demo_svg`.
6. **`book.toml`** ([Configuration](https://rust-lang.github.io/mdBook/format/configuration/renderers.html), "HTML renderer options").
7. **`theme/head.hbs`, `theme/fonts/fonts.css`, `theme/favicon.svg`** ([Theme](https://rust-lang.github.io/mdBook/format/theme/index.html)): mdBook takes each in place of its own.
8. **`custom.css`, `custom.js`, `version.js`** (the `additional-css` and `additional-js` options, on the same Configuration page).
9. **`build`, `offline.py`** ([build](https://rust-lang.github.io/mdBook/cli/build.html)): `./build` runs `mdbook build`, then `offline.py`, then lychee. Make it executable: `chmod +x build`, which prints nothing.
10. **`.github/workflows/deploy.yml`** ([Continuous integration](https://rust-lang.github.io/mdBook/continuous-integration.html), "Deploying"): it pins the releases from steps 3 and 4.
11. **The first commit:** `git add -A && TZ=UTC git commit -m 'initial mdBook scaffold'` prints `[main (root-commit) …] initial mdBook scaffold` and how many files it took (see "What a push publishes" first).
12. **Check, then preview** ([serve](https://rust-lang.github.io/mdBook/cli/serve.html)): `./build`, which prints what "The link check" shows, then `./bin/mdbook serve --open`, which prints `INFO Serving on: http://localhost:3000` and opens the book.

**The files of steps 6 to 10.** Each is one function in part 2 of the script, named for it: `render_book_toml`, `render_head`, `render_fonts_css`, `render_favicon_svg`, `render_custom_css`, `render_custom_js`, `render_version_js`, `render_build`, `render_offline`, `render_workflow`, and `render_readme` for `README.md`. A function is the file's text, with an `if` around each block that a setting adds and `${…}` where a setting goes: read it with your settings and copy what they select. Or print it. Set the toggles at the top of a copy of the script, then, in the book's folder:

```bash
bash -c 'source ~/bootstrap-mdbook.sh && check_settings && site_urls && render_custom_css' > custom.css
```

It prints nothing, and writes the file; an `ERROR:` line instead means a setting the script wouldn't take. Sourced, the script runs none of its steps: it only defines the settings and the functions, and `check_settings` and `site_urls` read the settings as a run does. Swap `render_custom_css` and the file for each of the others. For `theme/favicon.svg`, copy `src/logo.svg` if you have one, or print `render_favicon_svg "$(favicon_mark)"`. For the workflow, put the releases from steps 3 and 4 first, after `site_urls &&`: `MDBOOK_VERSION=vX.Y.Z MDBOOK_SHA256=… LYCHEE_VERSION=X.Y.Z LYCHEE_SHA256=… CHECKOUT_USES="actions/checkout@COMMIT # TAG" UPLOAD_USES="actions/upload-pages-artifact@COMMIT # TAG" DEPLOY_USES="actions/deploy-pages@COMMIT # TAG" NUMBERING_VERSION=""`, then `render_workflow`, with the output going to `.github/workflows/deploy.yml` (after `mkdir -p .github/workflows`, which prints nothing).

## The reading theme

`custom.css` carries the whole reading theme, with `theme/head.hbs` and `theme/fonts/fonts.css`, whatever `THEME` is. What you get:

- **Charter**, self-hosted, if you supply the fonts (next section). Otherwise a Palatino/Noto/Liberation/Georgia serif fallback renders and no `@font-face` is emitted (so nothing 404s).
- **A ~700px measure** (`--content-max-width: 700px`) for a comfortable line length. Widen one page with `.mdb-wide`, or one block while the prose keeps its measure with `.mdb-bleed` (see "Wide pages and wide blocks").
- **A 60px menu bar** (mdBook ships 50px), giving a 24px serif title room to breathe above the body text that scrolls under it.
- **A full palette.** mdBook 0.5.4 defines 40 variables per theme, and the script overrides every one that paints — not just the page and sidebar, but blockquotes, tables, the search UI, icons, the separator, the code-block ground, the theme menu, the offline panel and the copy buttons (`--theme-popup-bg`, `--theme-popup-border`, `--theme-hover`), and the light palette's scrollbar (`--scrollbar`), which follows `--sidebar-fg` as mdBook's dark one does — bar the five admonition accents on screen, which keep mdBook's ayu and light values. Without this, the first table or blockquote on a page shows the stock theme's blues. With `THEME` at `"auto"` or `"picker"` the dark palette is the base and the light one is gated behind `prefers-color-scheme: light` — see "Why the dark palette comes first" below.
- **A sidebar that sits close to the page.** `--sidebar-bg` is about two points of CIELAB lightness off `--bg` in both palettes: enough for the column to read as its own surface, little enough that the page reads as one tone rather than two panels. It does not match the blockquote/code ground, which is a heavier tint doing a different job. It cannot go to zero either — mdBook draws no border on `.sidebar`, so this tint is the only boundary the column has.
- **One hairline closing each chapter's title block** — the H1 and its subtitle, when it has one — with the `Last updated` line the deployed site adds hanging under the rule. Headings below the title draw none unless you write `---` straight after one. A chapter's `---` and a `SUMMARY.md` `---` separator take the same weight and colour (mdBook draws those two differently by default). See "Headings and rules."
- **Headings that sit close to their own text.** Each heading's margins scale with its own size, and whatever follows a heading starts right under it. H3 is a step above the text; H4 to H6 are text size, told apart by style: bold italic, italic, muted italic.
- **Inked, underlined links** (mdBook's default is undecorated), including search results; an `<a>` with no address, such as `<a id="here">`, isn't a link: it takes the text's colour and no underline, on hover and in print too. A link in the text turns blue once followed; footnote numbers, the links in notes and heading anchors keep their colour, and in print every link is ink.
- **Nested numbered lists count `1.1`, `1.2`.** Number each level the ordinary way (`1.`, `2.`, `3.`), indented under the item above, and the stylesheet draws `2.1`, `2.2`. A list that starts at another number keeps the browser's own numbers, because a stylesheet counter can't read where a list starts.
- **A repainted code-block ground.** mdBook paints code backgrounds from the highlight.js stylesheet, not a theme variable, so the palette can't reach it; the script repaints it (`--code-bg`) onto the same raised tint blockquotes use, and leaves the syntax token colours as the highlight sheet has them, bar two too faint on that ground: comments take `--code-comment` (ayu's grey is about 2.7:1 on it), and, in the dark palette, so does the punctuation of HTML, XML and JSX tags, `<`, `=`, `>` (ayu's `#00568d`, about 2:1); a tag's name and attributes keep their colours.
- **Inline code with a ground of its own.** mdBook paints none — it gives inline `<code>` padding and a radius and leaves the fill to whichever highlight sheet is live, which is off this palette either way. The script gives it a warm fill (`--inline-bg`), the theme's accent for the text, and a hairline drawn as an inset shadow so the pill's metrics don't shift.

`theme/head.hbs` clears any theme saved in `localStorage` before mdBook's theme script runs, or with `THEME="picker"` any the button doesn't offer — necessary because every GitHub project site under one `user.github.io` shares one `localStorage` origin, so a theme chosen in some *other* book would otherwise pin this one. It also carries `<meta name="darkreader-lock">`, for browser night modes (see "Why the dark palette comes first").

`theme/fonts/fonts.css` deliberately declares no faces. Its mere presence makes mdBook emit *only* the fonts in `theme/fonts/` (none) instead of its built-in ten Open Sans and one Source Code Pro — which this theme doesn't use. Measured against 0.5.4 that drops ~493KB, about half of a default book.

### Light and dark

`THEME` decides how the two palettes reach readers:

- `"dark"`: the dark palette, for every reader, whatever their browser or OS is set to. Only the dark palette is written.
- `"auto"`: both, and the reader's own light/dark setting — the browser's, or the OS preference the browser reports — decides which one they see. An open page follows a change of it. There's no control in the page.
- `"picker"` (default): as `"auto"`, plus mdBook's theme button in the menu bar, between the sidebar and search buttons. Its menu has **Auto** (the reader's setting, as with `"auto"`), **Light** and **Dark**. It starts on Auto, and a choice is kept in the reader's browser for their next visit.

The two palettes are painted over two of mdBook's themes, `light` and `ayu`. mdBook picks the code's highlight.js stylesheet in JavaScript, from the theme *name* — `book.js` maps `ayu` to the ayu sheet, `coal`/`navy` to Tomorrow Night, and anything else to the light sheet — so the palette and the syntax colours are selected by two different mechanisms, and only the theme name keeps them in step: the dark palette is drawn for the ayu sheet. With `"dark"`, `book.toml` sets **both** `default-theme` and `preferred-dark-theme` to `ayu`. That's easy to read as tidying-up and isn't: leave `default-theme = "light"` while writing a dark-only palette and every reader whose OS is set to light gets light syntax tokens on a near-black code block. With `"auto"` and `"picker"`, `default-theme` is `light` and `preferred-dark-theme` is `ayu`, and mdBook's script takes the reader's setting.

**The button** (`"picker"`) is mdBook's own, trimmed: `custom.js` removes the Rust, Coal and Navy rows and names Ayu's row Dark. Removes, not hides. mdBook moves keyboard focus through the list by sibling — `li.nextElementSibling.querySelector('button').focus()` — and `focus()` on a `display:none` button silently does nothing, so a hidden row would stop the arrow keys there. It is the same reason `custom.js` removes, rather than hides, the prev/next links into `src/unlisted/`. `theme/head.hbs` clears a saved theme other than `light` or `ayu` (Auto saves none), such as one another book on the same `USER.github.io` address saved, before mdBook's script reads it. Books on one address share the reader's choice: Light chosen in one book with the button is Light in another, and a book without the button clears it, since there a saved theme would pin the book to it.

Testing it: use your browser's DevTools colour-scheme emulation rather than the OS toggle. Some Linux desktops don't report the preference to the browser at all, so the OS switch can look like it does nothing when the book is fine. On a phone, a Light that still shows dark means the browser is forced to darken every page with Chromium's Auto Dark Mode flag, which no page can opt out of (see "Why the dark palette comes first").

### The top-bar icons

On the left the top bar carries the sidebar's and search's buttons, and with `THEME="picker"` the theme button between them. With a repo known to the book (`GIT_REPO_URL`), it carries a print icon and a pencil on the right that opens the current page in GitHub's web editor (it auto-forks for readers without write access). The pencil exists only when `book.toml` carries `edit-url-template`, which the script writes from that URL, so a book built without one has no pencil, on any page; `print.html` and the 404 page never have one, since neither comes from a single source file. On the right, `custom.js` puts the pencil in front of print (mdBook puts it after), and with `OFFLINE` on, as it is by default, the offline button comes last: print and the downloads sit together, and the panel opens under its button (see "Read offline"). It does **not** carry a repository icon, though mdBook offers one: the icon would sit beside the pencil and lead to the same repository the sidebar footer's commit link already reaches, and two icons to one destination is one too many.

The script leaves `git-repository-url` out of `book.toml` to drop it. mdBook gates the repo icon and the pencil on independent conditions in its template, so omitting that one key removes the repo icon and leaves the pencil untouched — no CSS hiding, nothing overridden. Add the key back by hand if you want the icon, but remember `book.toml` is script-owned: the next re-run regenerates it without.

### Why the dark palette comes first

This applies when `THEME` is `"auto"` or `"picker"`. With `"dark"` there is no swap at all — both `book.toml` keys name the dark theme, so the served class is already the right one — and the palette below collapses to a single class with no media query under it.

mdBook does not resolve the theme in CSS. It bakes `default-theme` into the served markup — with both palettes live, every page ships as `<html class="light">` — and an inline script at the top of `<body>` swaps that class after the stylesheets have already resolved. On a dark-mode reader's machine that means **every navigation paints a complete light frame before the swap lands.**

Usually you never see it. A force-dark browser extension does. It reads the served frame, computes its inversion from the light palette, then holds that inversion over the dark palette the swap installs — so the page ends up part inverted-cream, part extension grey, in three or four colours at once. It looks like the theme is broken. The theme is fine; mdBook handed the extension the wrong frame to read.

So `custom.css` puts the dark palette on **both** class names and gates the light palette behind a media query:

```css
html.light,html.ayu{ …dark… }
@media (prefers-color-scheme: light){
html.light{ …light… }
}
```

Both selectors are `(0,1,1)`, which is what beats mdBook's own `.light`/`.ayu` at `(0,1,0)`; a bare `html{…}` would be `(0,0,1)` and lose to it, so the class has to stay in the selector even though the media query alone reads as sufficient. The light block comes second, so at equal specificity it wins wherever its query matches. Four states, all measured in Chromium against 0.5.4:

| reader's OS | before the swap | after the swap |
| --- | --- | --- |
| dark | dark | dark |
| light | light | light |

No light frame ever paints under a dark OS, and each palette is still written exactly once.

With `"auto"`, the light palette applies **only** when the OS asks for light. With `"picker"` a reader can choose Light under a dark OS, so the light palette is written a second time, for `html.js.light`: mdBook's script adds the `js` class as it sets the theme, so that selector holds once the reader's choice is in, whatever the OS asks, and the served frame before it stays dark.

A browser that darkens sites for a reader in dark mode, as Chrome's dark theme for sites does, would darken that choice too: measured in Chromium at a phone's size, a picked Light painted `#1e1e1a`, not the palette's `#fdfcf7`. So the light palette declares `color-scheme: only light` rather than `light`, the opt-out Chrome documents for that darkening, and Light stays light; Auto under a dark OS, and Dark, are the dark palette already, and are left alone. Night modes built on the Dark Reader library, Brave's and Firefox's on iPhone and iPad and the Dark Reader extension among them, take no notice of `color-scheme` and repaint every page, the dark palette included: run as Brave's Night Mode runs it (Dark Reader 4.9.125, on an iPhone-sized page), Light painted `#2b2815`, a dark olive, and Dark `#181919`. They stand down for a page carrying `<meta name="darkreader-lock">`, which `theme/head.hbs` writes for every book, even when the lock arrives after they've started; with it, Light paints `#fdfcf7` and Dark `#111`, and Auto follows the reader's system, whatever the night mode is set to. A reader who wants the book dark picks Dark. Only Chromium's Auto Dark Mode flag (`chrome://flags`), which forces every page dark while the browser itself is light, still darkens Light: it ignores both opt-outs, so no page can stop it.

### The print override needs the class too

`print.css` resets layout and colours only links (`#4183c4`), and the browser drops backgrounds when printing — so without an override a reader on the dark palette (every reader, with `THEME="dark"`) prints pale text onto white paper. The first `@media print` block in `custom.css`, which comes after the palette, forces ink-on-paper.

It has to name the theme classes to do it. A media query does not raise specificity, so `@media print{ html{…} }` is `(0,0,1)` and loses outright to the palette's `(0,1,1)`: it parses, it validates, and it silently never applies. Naming the palette's own classes, `html.ayu` or (with `"auto"` and `"picker"`) `html.light,html.ayu`, ties it at `(0,1,1)`, and coming after the palette wins it. With `"picker"` it names `html.js.light` too, the Light choice's `(0,2,1)` selector, which would otherwise outweigh it. Keep the print selector the same as the palette's, not `html`.

Code prints in ink too. Its token colours come from the highlight sheet, the dark one whenever the reader's palette is dark, which are pale on paper, and with background graphics on its ground would print dark: a rule after the palette prints code blocks in `#111` on `#f5f5f5`, comments, and the tags in them (`TODO:`, `@param`), in `#555`, and a search hit in code on `#f2d9a8`. The admonitions print in the light palette's accents, each 4.5:1 or more on paper.

Print ink stays `#111` even though the screen palette softened its `--fg` to `#191713`. Butterick's case for grey over black is about an emissive screen; paper reflects, and wants the contrast the other way.

## Charter fonts

The theme is designed around Charter (Matthew Carter's screen-and-print serif, released free by Bitstream). The script does **not** ship the font files — you add them, then re-run.

1. Download the four woff2 weights. Matthew Butterick redistributes them at <https://practicaltypography.com/charter.html> (scroll to the download; the licence permits redistribution). You need regular, italic, bold, and bold-italic.
2. Place them in `src/fonts/` with these exact names:

   ```text
   src/fonts/charter_regular.woff2
   src/fonts/charter_italic.woff2
   src/fonts/charter_bold.woff2
   src/fonts/charter_bold_italic.woff2
   ```

3. Re-run the script (or, if you've hand-edited script-owned files and don't want to re-run, just rebuild — the `@font-face` block is emitted by the script, so a re-run is the supported way to turn the fonts on).

All four must be present. If any is missing, the script warns, emits no `@font-face`, and the fallback serif renders — this is deliberate, because declaring faces whose files are absent 404s four requests on every page load. `custom.css` is served from the book root and CSS URLs resolve against the stylesheet, so `fonts/charter_regular.woff2` finds the copy mdBook makes of `src/fonts/charter_regular.woff2` (mdBook copies `src/` verbatim and does not content-hash it).

**Their line metrics are set in `custom.css`.** A font file carries more than one set of line metrics: Windows reads one, other systems another. In these four the Windows set is right, 0.98em above the baseline and 0.236em below it; the other gives the descent with the wrong sign, 0.236em *above* the baseline. Read that way, each line of Charter sits 0.24em low in its box: a button's label below its middle, the top bar's title and icons low, and a line with inline code taller than the lines around it, since the code's font, laid out right, reaches below Charter's. Each `@font-face` sets the Windows set (`ascent-override: 98%; descent-override: 23.6%; line-gap-override: 0%`), which Chromium-based browsers and Firefox take on every system. Safari doesn't take them yet: WebKit added them in August 2026, and until a Safari release carries them, it lays Charter out from the files as they are.


## The sidebar masthead

`SIDEBAR_MASTHEAD` controls the band at the top of the sidebar, opposite the menu bar.

- **`text`** (default) — sets `BOOK_TITLE` there in the menu-bar title's own face, size, and baseline, left-aligned with the chapter list below it, and fades the menu-bar title out while the sidebar is showing so the name is never in two places at once. Needs no file: rename the book and the mark follows. (The title returns to the menu bar automatically when mdBook hides the sidebar — below 1080px, or on the `b` toggle — so the name is never nowhere.)
- **`none`** — nothing in the sidebar; the book title stays in the menu bar as mdBook ships it.
- **`image`** — masks `src/logo.svg` into the band, painted in the sidebar text colour so one file serves light and dark. Because it's painted, the mask is an *alpha* mask: supply a flat silhouette (a monogram) on a **transparent** ground, or the painted background masks the whole band solid. You must add `src/logo.svg`; the script warns if it's missing. The same file is also the favicon, which reads its fill rather than its alpha — see "The favicon."

In `text` and `image` mode the masthead is **sticky** at the top of the sidebar the way the menu bar is sticky at the top of the page, and grows the **same hairline** once the table of contents scrolls under it (bound to the same colour mdBook uses for the menu bar's own scrolled border, so the two lines match).

## The favicon

`theme/favicon.svg` has two sources, and it is written whatever `THEME` and `SIDEBAR_MASTHEAD` are — a `text` masthead and a favicon are different jobs, and they coexist. `src/logo.svg`, whenever it exists, is copied to it verbatim and always wins. Only when there is no `src/logo.svg` does `FAVICON_TEXT` come into it, and then the value is **drawn** as letters: ink on a transparent ground, no plate, `#191713` swapping to `#e8e6da` under `prefers-color-scheme: dark` — the two `--fg` values from the light and dark palettes. `"auto"`, the shipped default, takes the first alphanumeric character of `BOOK_TITLE`, a letter as a capital, so the stock `mybook` draws an `M` and renaming the book renames the mark. Any other string is drawn as typed, case preserved, cut to the first three characters. `""` draws nothing at all, and mdBook's own bundled favicon stays.

Both inks are written whatever `THEME` is, a dark-only book included. The mark is drawn in the browser's tab bar, not on the page, and the tab bar follows the reader's browser or OS rather than the book, so a dark-only book still sits in a light tab bar for a reader whose system is light. Before v41 a dark-only book drew the pale ink alone, and in a light tab bar it all but vanished.

**A drawn favicon is not in Charter, and it cannot be.** A favicon is fetched as an *image*, and a browser gives an image no network of its own: `@font-face`, external stylesheets and external images are all blocked, and scripts do not run. So the four woff2 in `src/fonts/` are unreachable from inside that file, and naming Charter first in its stack only helps a reader who happens to have Charter installed as a *system* font. Everyone else gets the next face down — Palatino, Noto Serif, Liberation Serif, Georgia, a generic serif. This is the same limit that forces the `text` masthead to be CSS text rather than an SVG, and it has no workaround short of converting the letters to outlines, which would undo the one thing `"auto"` is for. What *does* work inside that sandbox is the `prefers-color-scheme` media query, because the `<style>` is part of the file rather than something fetched: mdBook's own bundled `favicon.svg` swaps its fill exactly this way.

If you supply `src/logo.svg` instead, **give it a `prefers-color-scheme` fill-swap of its own.** The same file is doing two unrelated jobs and they read it differently: the `image` masthead uses it as a CSS *mask*, so only its alpha matters and the sidebar paints the shape in `--sidebar-fg`; the favicon shows the file itself, so only its *fill* matters and nothing recolours it. A flat black silhouette therefore mastheads perfectly in both light and dark and then disappears into a dark browser tab. Put the swap in the file — a `<style>` block carrying `@media (prefers-color-scheme: dark){ … }` over your `fill` — and both jobs are served by the one asset, because the mask ignores the colour it can't see and the favicon uses it.

Either source **replaces mdBook's bundled `favicon.svg` and drops its `favicon.png` with it.** mdBook copies neither default once one of the pair is overridden, so the built site carries the SVG alone and the page emits a single `<link rel="icon">` where it otherwise emits two. That is fine in Chrome, Edge and Firefox, which all render SVG favicons; a client that does not is left with no icon rather than falling back, because there is no longer a PNG to fall back to. If that matters to you, put your own `theme/favicon.png` beside the SVG and mdBook will ship both — it drops a default only when you override exactly one of them.

Finally, `theme/favicon.svg` is script-owned but **never deleted** — only overwritten. Removing `src/logo.svg`, or setting `FAVICON_TEXT=""`, stops the file being *regenerated*; it does not remove the one already there, and the site goes on serving the last mark written. That is deliberate: a stale favicon does no harm beyond being out of date, and clearing it on every run would destroy a favicon you had put there by hand, which no re-run could give back. To actually clear it, clear both sources and then delete `theme/favicon.svg` by hand.

## Headings and rules

A chapter's title is one block: the H1, and the subtitle under it if there is one. One hairline closes the block, under whichever of the two comes last. The `Last updated` line the deployed site adds hangs under that rule, before the text, like a dateline.

Below the title, headings draw no rules. A `---` divides the page, with space above and below it; written on the line straight after a heading, it underlines that heading instead:

```markdown
## Setting up
---

Body text starts here.
```

Under a heading that has a subtitle, put the `---` after the subtitle, with a blank line between them, and it underlines the two together. The blank line matters: the subtitle's `<p>` starts an HTML block that runs to the next blank line, so a `---` straight under it is printed as three dashes.

Don't write one under the chapter's H1: the title block has its rule already, and a `---` there draws a second.

## Subtitles

To hang a subtitle under a heading, put a marked paragraph on the line below it:

```markdown
# Chapter One
<p class="mdb-subtitle">A subtitle that explains what this chapter is about</p>

Body text starts here.
```

mdBook passes block-level HTML through verbatim, so the `<p>` renders as-is. The starter `chapter_1.md` includes one as an example (delete the line if you don't want one).

Under the chapter's H1 the subtitle is part of the title block, and the block's rule sits below it; on the deployed site the `Last updated` line follows under the rule (see "Headings and rules"). Under any other heading it is the muted italic alone; a `---` after it, with a blank line between them, draws a rule under the pair.

One caveat: **markdown syntax inside the `<p>` is not parsed.** `**bold**` stays literal. If a subtitle needs emphasis or a link, write it as HTML (`<em>`, `<a>`). (If you need markdown-in-subtitle often, a `<span class="mdb-subtitle">` on its own line *does* get its markdown parsed, but the span is inline and can't take the block rule directly — the `<p>` form is the default for that reason.)

## Code line numbers

With `CODE_LINE_NUMBERS=true` (default), a line-number gutter appears beside each code block that (a) had a language on its fence (```` ```bash ````, not a bare ```` ``` ````) and (b) is ten lines or longer. Shorter blocks, and auto-detected blocks with no language on the fence, are left unnumbered.

The gutter is a sibling `<div>` next to `<code>`, never inside it — so `<code>`'s DOM is exactly what mdBook rendered, and mdBook's copy button (which reads `code.innerText`) and a manual Ctrl+C both yield the exact source, numbers excluded. This replaced an earlier approach using the highlight.js line-numbers plugin, which rebuilt `<code>` as a table and corrupted copied text (a tab per line, a blank line per row).

Blocks with hidden lines (mdBook's lines prefixed by a hash plus a space, tucked behind the eye toggle) and `.playground` blocks are skipped by design.

A ```` ```rust ```` block is plain code, not one of mdBook's playgrounds: `book.toml` sets `[output.html.playground] runnable = false`. A playground has every reader's browser ask `play.rust-lang.org` for its list of crates as soon as a page with one opens, before anyone clicks Run. To make one block runnable all the same, write ```` ```rust,mdbook-runnable ````: its page, and `print.html`, then ask. Your own Markdown can still reach other sites, with a picture or a video embedded from one.

If you also set `HEADING_NUMBERS=true`, note the script configures `mdbook-numbering` with its *own* code numbering turned **off** — precisely because that feature injects the copy-breaking plugin. The relevant lines it writes into `book.toml`:

```toml
[preprocessor.numbering.code]
enable = false
```

The gutter above is the numbering you get.

## Wide pages and wide blocks

The default measure is ~700px. Two markers reach past it, and they are not interchangeable.

**A whole page.** Drop this anywhere on it:

```markdown
<div class="mdb-wide"></div>
```

Any element with class `mdb-wide` on a page widens that page's content column to 1000px — prose along with everything else. Useful when most of the page *is* a wide table or a large diagram and the reading measure is beside the point.

**One block, prose left alone.** Wrap the block instead:

````markdown
<div class="mdb-bleed">

```python
def pellentesque(habitant, morbi=None, tristique=(), senectus="netus", fames=0):
    return {k: v for k, v in sorted(habitant.items()) if k not in (morbi or ())}
```

</div>
````

The wrapped element breaks out to 1000px, centred on the text column, below any float that comes before it; everything else on the page sits exactly as it would on a page carrying no marker at all. On a screen narrower than that, it takes the content area's width. That is the whole difference — `mdb-wide` moves the prose, `mdb-bleed` doesn't. Nothing about it is code-specific: a wide table, an image or a diagram takes the same wrapper.

Two things to get right:

- **Keep the blank lines inside the wrapper.** Without them the fence is read as raw HTML and renders as literal text, backticks and all. It is the one way to get this wrong, and it fails loudly, so you will see it on the page.
- **Keep the wrapper at the top level** of the chapter, not nested inside a list item or a blockquote. The rule reaches direct children of `<main>` only.

On a page with both markers, `mdb-wide` widens everything to 1000px, and an `mdb-bleed` block has nothing to add.

Both are screen-only. The print view concatenates every chapter into a single `<main>`, so an `mdb-wide` marker anywhere would otherwise widen the whole printed book.

Neither is a cure for a genuinely long line. With the theme's type and a typical monospace face, a code block fits roughly 62 characters at the measure with the line-number gutter on and about 68 without; bled to 1000px that becomes roughly 92 and 98. Past that the block scrolls sideways — mdBook's own behaviour, and a cheap one, since a scrolling block neither breaks the layout nor pushes the page around. If you're pasting a script whose lines run past about 90 characters, rewrapping the source is the only thing that genuinely helps.

## Writing content

Chapters live in `src/*.md` and must be listed in `src/SUMMARY.md` — mdBook does **not** auto-discover files. In `SUMMARY.md`:

- A link with **no leading dash**, listed *before* the numbered list, is a **prefix chapter** — renders unnumbered, above the numbered chapters. The starter `about.md` is one.
- A link listed **after** the numbered list (same no-dash syntax) is a **suffix chapter** — unnumbered, below them. (The script doesn't create one; add your own, e.g. a changelog, if you want it.)
- A `---` line draws a **separator rule** in the sidebar.
- A `# Title` line draws a **part heading** in the sidebar.

Title, author and description (`BOOK_DESCRIPTION`) are in `book.toml` `[book]`.

**Pictures and media in raw HTML, in a chapter in a folder** (`src/guide/setup.md`, say), show on that chapter's page but not in `print.html`, the page the print button opens, where every chapter is laid out together. mdBook 0.5 builds `print.html` at the book's root and corrects a chapter's relative addresses there only on `<a>` and `<img>`, in `href` and `src`; anything else keeps the address that worked from the chapter's folder: a `<picture>`'s or an `<img>`'s `srcset`, a `<video>` or `<audio>` (its `src`, `poster` and `<source>`s), an `<iframe>`, or a `url()` in a `style` attribute. For a picture that should print, use a Markdown image or a plain `<img src>`. Chapters at the top of `src/` have no such problem, and printing a single page (<kbd>Ctrl</kbd>+<kbd>p</kbd> on it) prints its media whatever its folder.

### Renaming a chapter

When you rename a chapter's file:

1. Rename the file in `src/` and update `SUMMARY.md`.
2. Find-and-replace the old filename across `src/` — every link to the old name is now broken.
3. Re-run the script, then commit.

That's the whole fix. Step 2 is the one that matters: without it, every internal link to the old name is a broken link, and `./build` will stop on it.

**If the page was already published** and external links point to the old URL — bookmarks, search engines, other sites — add a redirect so those links still work. Put a line in `redirects.toml` (at the book's root, next to `book.toml`):

```toml
"/old-name.html" = "new-name.html"
```

Left side is the old address; right side is the new filename. The file takes only these lines, with no `[header]`. mdBook generates a redirect page at the old URL that sends the reader to the new one. A page that was never published, or one with no outside links worth preserving, needs no redirect.

`redirects.toml` is yours — the script never writes or deletes it. Each run copies its lines into `book.toml` under `[output.html.redirect]`. Without the file, `book.toml` has no redirect table. A key that matches a chapter still in `SUMMARY.md` fails the build.

### Unlisted chapters

mdBook has no unlisted state of its own. It builds exactly what `SUMMARY.md` lists: a chapter that isn't in the file isn't rendered at all — the `.md` isn't even copied into `book/`, since mdBook copies every *other* file in `src/` verbatim but never markdown — and a chapter that *is* in the file gets a sidebar row, a place in the prev/next chain, and a section of `print.html`. So if you only want a page to exist in the repo and not on the site, leave it out of `SUMMARY.md`; mdBook ignores it silently, no warning and no output file.

To publish a page but keep it off the table of contents, do **two** things. Both are required:

1. Put the file under **`src/unlisted/`**. That directory is reserved. Nothing goes in the page itself — no toggle, no front matter, no marker.
2. **List it in `src/SUMMARY.md`** as a suffix chapter: a no-dash link placed after the numbered ones.

```markdown
# Summary

[About](./about.md)

- [Chapter 1](./chapter_1.md)
- [Chapter 2](./chapter_2.md)

[Working notes](./unlisted/notes.md)
```

Step 2 is the one this feature invites you to skip, so it's worth being blunt about. `SUMMARY.md` is mdBook's only list of what to build. A markdown file that isn't on it is not rendered, not copied and not reachable — and **linking to it from another chapter does not publish it**. mdBook rewrites the `.md` in your link to `.html` and hands you a 404 on a page it never generated, with no warning at build time and no error in the log. The tell is the output directory: mdBook creates `book/unlisted/` while copying files but leaves it empty. If the page you expected isn't in there, it isn't in `SUMMARY.md`.

With both steps done, three things happen, all from generated files, so none of it is a hand edit you have to re-apply after a re-run:

- **`custom.css`** hides the sidebar row. It's keyed on the link target, because the row to hide sits on every *other* page, where a marker inside the unlisted page would be invisible. The rule covers both sidebars — the one `toc.js` injects and the `toc.html` iframe that readers with JavaScript off fall back to.
- **`custom.js`** *removes* the prev/next links pointing into the directory, so <kbd>→</kbd> skips those chapters too. Hiding them wouldn't be enough: mdBook's `book.js` reads `.nav-chapters.next` straight out of the DOM and follows its `href` whether or not it's painted. Links *out* of an unlisted chapter are untouched, so its own back arrow still works.
- **`book.toml`** drops the whole directory from the search index with `[output.html.search.chapter]`. One directory key covers every chapter under it.

That last one is emitted only when `SUMMARY.md` already links into `unlisted/` — and it has to be, because mdBook **fails the build** on a `search.chapter` key that matches no chapter (``key `unlisted` does not match any chapter paths``). So the order is: add the chapter, list it, then re-run. Forget to re-run and the page is merely searchable, not broken. The stanza is:

```toml
[output.html.search.chapter]
"unlisted" = { enable = false }
```

A sub-table ends the parent table, so it must come after every `[output.html]` key; the script puts it after them and `[output.html.playground]`.

Two limits, both worth knowing before you rely on this:

- **List unlisted chapters last.** They are suffix chapters, so they don't renumber anything, but the arrow chain is linear: put one in the middle of the book and the chapter before it loses its next arrow while the chapter after it loses its prev arrow, leaving a hole you have to click around.
- **`print.html` still contains them.** The print view is a flat concatenation of every chapter with no per-chapter element to select, so there is nothing to hide. Closing it would take a second marker convention in every unlisted page plus a rule that silently swallows the rest of the printed book whenever an unlisted chapter isn't last — not a trade worth making for a view you reach by explicitly asking for the whole thing.

And the plain fact underneath: none of this makes a page private. `src/` is in the repo, the repo is public (Pages needs it to be, on a free plan), and GitHub Pages serves the URL to anyone holding it. This is *unlisted* — off the contents, out of search, out of the arrow chain — not *hidden*.

The name is literal and reserved: `src/unlisted/` and nothing else. A directory merely *containing* the word is fine — `src/notunlisted/` is an ordinary chapter directory and stays fully visible.

### Hiding part of a page

An HTML comment hides part of a page: `<!-- … -->` goes into the page as written, the browser doesn't show it, and mdBook's search index leaves it out. Two things to know:

- **On a line of its own, it ends what it's in.** Between two table rows it ends the table, and every row after it becomes a paragraph of pipes; between two lines of a paragraph, or two list items, it splits them in two. To park a row, put it after the last row, in a comment that says where it belongs; to hide words in a paragraph, put the comment after some text on its line.
- **It isn't private.** It's in the page's source (View Source), in `print.html`, and in the Markdown on GitHub.

To keep a whole page off the site, leave it out of `SUMMARY.md` (see "Unlisted chapters").

## A section at a time, by hand

The script shows each chapter on one page. Two blocks of code, one for `custom.css` and one for `custom.js`, show it one section at a time instead. Up to v63 the script wrote them, with its `LAYOUT` setting; they're here now, to add by hand. They run in the reader's browser: the book is built the same either way, one page per chapter, so its addresses, search, the link check and `print.html` don't change, and printing a page prints the whole chapter whatever the screen shows.

The JavaScript's first line, `var MDB_LAYOUT = "picker";`, decides how:

- `"picker"`: a button beside search, an open book, with which each reader chooses **Scroll**, the chapter on one page, or **Pages**, one section at a time, every H2 to H6 starting one. Every reader starts on Scroll. The choice is kept in the reader's browser, for this book only: books on one `USER.github.io` don't share it. A choice made in one tab reaches the reader's other open tabs at their next page.
- `"h2"`: one section at a time for every reader, each H2 starting one; its H3 to H6 stay in it.
- `"nested"`: one section at a time for every reader, every H2 to H6 starting one.

A section starts at a heading straight in the chapter. One inside a list, a quote or an HTML element such as `<details>` stays in the section around it, and so does one written in HTML without an `id` (`<h2>…</h2>`), which mdBook gives no anchor; written with one (`<h2 id="setup">…</h2>`), it starts a section, but the sidebar doesn't list it. An H1 after the chapter's first starts no section. What comes before the first heading is the first section; when that's only the title (the H1, a subtitle, the `Last updated` line), with nothing else but rules, empty anchors, an `mdb-wide` marker, or a `<style>`, `<script>` or `<link>`, it joins the section after it. An empty anchor kept just above a heading (`<a id="old-name"></a>`, or the older `<a name="old-name"></a>`) goes with the heading.

One section at a time, with `"h2"`, `"nested"`, or Pages:

- The arrows at the sides of the page, or at its foot on a narrow window, and the <kbd>←</kbd> and <kbd>→</kbd> keys turn to the next or the previous section; past a chapter's last section, to the next chapter's first, and back from a chapter's first, to the last section of the one before. Where mdBook draws no arrow (before the first chapter, after the last, or where the next chapter is unlisted), one is drawn while there's a section to turn to. mdBook's `?` popup says what the keys do.
- On a touch screen, the arrows turn the sections; a swipe doesn't. The sidebar's swipes work as before.
- The sidebar marks the section shown, with `"h2"` by its H2, and a first section with no H2 (H3s before the chapter's first H2) by none; in a chapter of one section, shown whole, the heading in view, as in Scroll. Its links, a search result, a link to an `#anchor` and Back each go to the section holding the place, and a search result's match is highlighted there.
- A section shows only the footnotes it cites, and those they cite in turn, and "Section 3 of 19" under it. The window's title names the section, from the second on.
- The `Last updated` line shows with the chapter's first section.
- The browser's own find (<kbd>Ctrl</kbd>+<kbd>F</kbd>) searches only the section shown, and a link to a passage of text (`#:~:text=` and the passage, as search engines make) opens the chapter's first section; one that also names the section the passage is in (`#beta:~:text=…`, as a browser's "Copy link to highlight" makes in Pages) opens that section at the passage.
- With `HEADING_NUMBERS=true`, each section's heading shows its number.

On a phone, the `"picker"` button takes room from the book's title in the menu bar, which mdBook cuts short when it doesn't fit: with `THEME="picker"`, a repo and `OFFLINE` on, a phone 390px wide leaves the title about 110px with the button and 146px without.


**Adding it.** `custom.css` and `custom.js` are script-owned: each run of the script writes them without these blocks, so add them again after each run.

1. In `custom.css`, find the line that starts `/* OFFLINE: the last button on the right`. Paste the CSS block on the lines just above it. With `OFFLINE="none"` there's no such line: paste the block at the end of the file.
2. In `custom.js`, find the line that starts `// OFFLINE: the last button on the right`. A blank line sits above it. Paste the JavaScript block between that blank line and the `// OFFLINE` line, with one more blank line after the block, so a blank line comes before the block and one after it. With `OFFLINE="none"`, paste it at the end of the file, after a blank line. For `"h2"` or `"nested"`, change `"picker"` in its first line.
3. Run `./build`. It prints what it always does, ending `links: every internal link and anchor resolves`. Start the preview with `./bin/mdbook serve --open` and open a chapter with H2s: with `"picker"`, the open book is beside the magnifying glass; with `"h2"` or `"nested"`, the chapter shows its first section, with `Section 1 of N` under it.
4. Commit both files. After a later run of the script, `git diff custom.css custom.js` shows the blocks as removed lines: when it shows nothing else, `git checkout -- custom.css custom.js` puts them back and prints nothing; otherwise paste them again.

The CSS block:

```css
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
```

The JavaScript block:

```js
var MDB_LAYOUT = "picker";
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
```

## Read offline

`OFFLINE` lets readers keep the book on their own devices, through one button in the menu bar, beside print.

- `"full"` (default): the button's panel offers both, one under the other, each a big button with a line under it saying what it's for: **Save for offline** keeps the book in the reader's browser, on a computer or a phone, and updates it when they ask; **Download for a computer** is a copy to keep on any computer, online or air-gapped, and **Download for a phone** one to read in the free Kiwix app, on a phone, online or air-gapped, each with its version, size and SHA-256 checksum.
- `"download"`: the two downloads alone.
- `"none"`: no button.

`./build` makes what the button offers, here and in the deploy, after mdBook has built the book. So the button shows on the published site, and on a local server for `book/` after `./build`, where it offers only the downloads: saving needs the published site, over HTTPS. The preview doesn't have it: `mdbook serve` builds `book/` again without what `./build` adds.

To check the button on your machine:

1. Stop the preview with Ctrl-C if it's running: it would build `book/` again, without the button, at your next saved edit.
2. In the book's folder, run `./build`, then:

   ```bash
   python3 -I -m http.server -b 127.0.0.1 -d book 8000
   ```

   It prints `Serving HTTP on 127.0.0.1 port 8000 (http://127.0.0.1:8000/) ...` and keeps running, with a line for each file a browser asks for. `-I` makes Python use its own server even when the folder you're in has one named `http`. If it ends instead with `OSError: [Errno 98] Address already in use`, something else has port 8000: put `8001` in its place, here and in the address below.
3. Open `http://127.0.0.1:8000`. The cloud beside print opens the panel, with the two downloads alone. Ctrl-C in that terminal stops the server, with `Keyboard interrupt received, exiting.`

**Saving.** Before a save, the panel shows **Save for offline**, and under it the version on the site, its build date and its size. Once the book is saved, its pages come from the saved copy, online or offline, with everything they load from the book's own site, so a reader never gets parts of two versions. Pictures, videos or scripts a page loads from another site aren't saved, here or in the downloads. When the site has a newer version, a dot appears on the button, and the panel shows the saved version and the latest, how many versions behind the saved one is, how many pages changed, were added and were removed, and how much there is to download, with **Update to v13** and **Remove saved copy**, and each page the saved copy serves says so above its text: `You're reading your saved copy, v12. v13 is out: update it from the ✓ above.` Remove is offered only while the site answers: a reader who is offline, or on a network that can't reach the site, keeps the copy they're reading. A site that no longer has the book still answers, so its copy can be removed too. An update fetches only the files that changed, checks every file against the site's checksums, and only then switches to the new copy, in one step; an update that fails or is interrupted leaves the saved copy as it was. Nothing downloads or changes until the reader presses a button: each page only reads the site's version file, to see whether a newer version is out. The icon shows where things stand: a cloud before a save, a tick once saved, a plane while offline.

**Versions.** A version is a commit that changed what the book is built from: `src/`, `theme/`, `book.toml`, the workflow (it pins the releases the build uses, so an `update` that takes another one changes it) and the script-owned files beside them, not `README.md`. v12 is the twelfth. Its date is that commit's time. A commit that changes nothing on the site leaves a saved copy up to date. This count is the offline button's own: the version in the sidebar footer is the git tag (see "The version line"), a different number. A file a chapter includes from outside `src/` (`\{{#include ../examples/a.rs}}`) isn't counted: a change to it alone changes the site within a version, so keep such files under `src/` (mdBook also publishes any that aren't Markdown).

**Browsers.** A save asks the browser to keep the copy even when the device runs short of space: Firefox asks the reader, Chrome and Safari decide on their own. Safari, on an iPhone, an iPad or a Mac, deletes what a site saved after seven days of Safari use in which the reader didn't use the site. A book added to the Home Screen of an iPhone or iPad is a web app with storage of its own, which counts only its own days of use; the panel tells readers to add the book there first and save it from there.

**The download for a computer.** One file in `offline/`, named for `BOOK_NAME` and the version, with a `.sha256` file beside it: `mybook-v12.zip`, the whole book in a folder, to keep on any computer, online or air-gapped, with a `README.txt` saying to open `index.html`, how to check the download's checksum on Linux, macOS and Windows, and where newer versions are. It opens from disk in a browser, search included. The fonts are inside its stylesheets, and with `SIDEBAR_MASTHEAD="image"` so is the logo: Firefox won't load a font from a folder above a page opened from disk, and Chromium and WebKit won't load a mask image into one at all. A link to a folder of the book (`[Setup](setup/)`) points at the folder's `index.html`, the page the site serves for it: as written, it would show the folder's files from disk. Its stamp is its version's, that commit's time and SHA with no tag, so rebuilt from the same version on the same system it comes out the same to the byte. Inside it, the button shows which version it is, its build date, and the site's address for newer versions (from `GIT_REPO_URL`).

**The download for a phone.** `mybook-v12.zim` beside it, with its own `.sha256` file: the whole book in one file, in openZIM's format, which the free Kiwix app reads on Android and on an iPhone. A reader installs Kiwix while online, sends the file to the phone (by cable, Bluetooth or AirDrop), and opens it from Kiwix, after which the phone needs no connection. It holds the site's pages, with the sidebar, the theme button and the book's own search, which runs in the page as it does on the site. Kiwix's own search box finds pages only by the start of their titles: the copy carries none of Kiwix's full-text index, which needs a library Python doesn't have. `404.html` isn't in it, and `index.html` sends the reader on to the first chapter, where Kiwix opens the book; `print.html`, `toc.html`, unlisted chapters and redirect pages are left out of the titles Kiwix suggests. Kiwix's library shows the book's title (its first 30 characters), `BOOK_DESCRIPTION` or else the title, `BOOK_AUTHOR` as creator and publisher, the version's date, the language mdBook's `<html lang>` gives, and a plain dark square as its icon. `offline.py` writes the file itself, with Python's standard library, so nothing is installed for it. It reads the book one file at a time, so the build never holds the whole book in memory: 120 MB at most for a book of 150 MB of pictures, measured for v71. Like the computer's copy, it carries its version's stamp, so rebuilt from the same version on the same system it comes out the same to the byte, and inside it the button shows its version, its build date, and the site's address for newer versions. It was checked with Kiwix's own tools (`zimcheck`, and `kiwix-serve` in Chromium), not in the apps on a phone: open one on your own phone before you point readers to it.

Apart from the file names, which `README.txt`'s checksum commands use too, what readers see never names the formats: the panel calls one a copy to keep on any computer, online or air-gapped, and says to unpack it and open `index.html` in the folder it makes, and calls the other a copy for a phone, read in the free Kiwix app.

**Turning it off.** In every mode the site carries `sw.js`. Outside `"full"` it's a worker that deletes a saved copy and then itself, so a reader who saved the book gets the site's pages again on their next visit online, with nothing left behind.

**What it adds.** To the project: `offline.py`, run by `./build` in every mode, and in `"full"` a manifest line in `theme/head.hbs`. To the site, besides `sw.js`: `version.json` (the version, its date and the downloads' checksums, and in `"full"` every file's size and SHA-256), and `offline/` (the two downloads, each with its `.sha256` file). A file of yours in `src/` by any of these names is written over, as is a `README.txt` at the top of `src/` in the laptop copy. In `"full"`, also `manifest.webmanifest`, so a book added to a home screen opens as an app of its own (on an iPhone or iPad, with its own storage: see "Browsers"). The app's icon is the favicon, `favicon.svg`, which a browser draws at any size; a book whose favicon is a PNG alone has none in the manifest, and Chromium-based browsers then don't offer to install it: they want an icon of 144 pixels or more. With `favicon.svg`, they take the book as an installable app from the first visit, before anything is saved, and offer to install it (on a computer, an install button in the address bar). And `book.toml` gets `hash-files = false`: mdBook's fingerprinted file names (`version-1a2b3c4d.js`) put the deploy stamp and a hash of the search index into every page, so the downloads would change with every commit, and an update would fetch every page. Without them, a browser that cached a script or stylesheet just before a deploy can use it with the new pages until it next checks.

**Size.** GitHub Pages caps a published site at 1 GB, and each download adds the book once more, compressed where it compresses. Measured for v70, a 100-chapter text book grew from 12.1 MB to 15.0 MB with the computer's copy, and a book of 100 photos from 32.9 MB to 63.6 MB: about twice, for pictures, which don't compress. The phone's copy adds about as much again: for a 100-chapter text book, measured for v71, 1.3 MB beside the computer's 2.2 MB, and for pictures about the book's size once more, so a book of photos comes to about three times its size. GitHub also sets a soft limit of 100 GB a month on what a Pages site serves, and each download serves the book again, as does each save in a browser (an update fetches only what changed): at about 30 MB a copy, as for that photo book, 1,000 downloads or saves come to about 30 GB.

**Tools and time.** `offline.py` needs only Python's standard library. On the 100-chapter book, `./build` took about 2.6 seconds with the computer's copy, against 1.7 without it (measured for v70); the phone's copy adds about 5 seconds more (measured for v71, on another machine), most of it compressing the copy's pages.

## Keyboard and links

`custom.js` adds:

- **`b`** toggles the sidebar (mdBook ships no key for it); the shortcut is listed in mdBook's own `?` help popup.
- **Swipes open and close the sidebar** on a touch screen: a quick swipe right that starts in the left quarter of the screen (300px at most) opens it, and a quick swipe left over the left 300px, where the sidebar is, closes it. Each has to go more across than up or down, so a flick to scroll that drifts sideways does neither. Not with two fingers, not from a code block, a table or a form field such as the search box, whether or not it's wide enough to scroll sideways, and not from anything open over the page: the offline panel, the theme menu (`THEME="picker"`), the layout menu (see "A section at a time, by hand"), a picture mdBook has zoomed (or the dimmed screen around it), or mdBook's `?` help popup. mdBook 0.5.4 has these swipes, but its code sets the `sidebar-visible` class and not the checkbox the sidebar's CSS reads, so the sidebar doesn't move; `custom.js` does the same through that checkbox. On a device with a touch screen `custom.css` also turns off Chromium's swipes back and forward through history on the book's pages (`overscroll-behavior-x`). Chromium takes a long sideways swipe, quick or slow, as one of those, a sidebar swipe included: without the rule, a long swipe right would go back, and a long swipe left would go forward when there's a page to go forward to. On a laptop with a touch screen that may stop its touchpad's swipes back and forward there as well. The Back and Forward buttons, <kbd>Alt</kbd>+<kbd>←</kbd> and <kbd>Alt</kbd>+<kbd>→</kbd>, and the phone's own edge gesture still work. See "On a phone."
- **Links to other sites open in a new tab** (`target="_blank"` with `rel="noopener noreferrer"`): in the text, in the sidebar, and in the menu bar, the pencil included. Links within the book are untouched, and an email link opens the mail program.
- **A "back to the book" link on `print.html`**, and closing the print dialog returns you to the page you came from — mdBook auto-opens that dialog on the print page and cancelling otherwise strands you on the concatenated whole-book page.
- **Code blocks that overflow sideways become keyboard-scrollable** (`tabindex="0"`, so Tab reaches them; while one has focus, ← and → scroll it instead of turning the page, as they otherwise do in mdBook), and only those — a block that fits takes no tab stop. Re-checked whenever a block changes size, a window resize or a sidebar toggle, once the layout has settled.
- **One section at a time**, if you add it: see "A section at a time, by hand."
- **The offline button** beside print, and its panel, unless `OFFLINE` is `"none"`. See "Read offline."
- **With `THEME="picker"`, the theme menu holds Auto, Light and Dark**: the Rust, Coal and Navy rows are removed rather than hidden, so the arrow keys reach every row that remains. See "Light and dark."

## On a phone

How the book behaves on a phone, from mdBook 0.5.4's `book.js` and CSS, with the swipes `custom.js` adds:

- **Sidebar.** It starts closed on a window narrower than 1080px. The three bars open and close it, and so do swipes: a quick swipe right that starts in the left quarter of the screen opens it, and a quick swipe left across the sidebar closes it. A slow drag does neither, and neither does a flick that's more up or down than across, a swipe with two fingers, or one that starts on a code block, a table, the search box, an open menu or a zoomed picture. (mdBook 0.5.4's own swipes don't move the sidebar; `custom.js` makes them work. See "Keyboard and links.")
- **Chapter arrows.** On a window 1080px wide or less, they sit at the bottom of the page instead of at its sides; with the sidebar open, up to 1380px.
- **Back to the top.** Tapping the middle of the menu bar, where the book's name is, scrolls to the top; the icons on either side don't.
- **Menu bar.** It slides away as you scroll down and comes back when you scroll up. With the sidebar open, it stays.
- **Search.** Opening search the first time downloads the book's whole search index, which grows with the book (mdBook warns once it passes 10 MB). On a phone, over a slow connection, that's a wait before the first results.

The offline button works the same on a phone; its panel fits the screen.

### A page for readers

A chapter you can paste in to tell readers how to get around: save it as, say, `src/using-the-site.md` and list it in `SUMMARY.md`. mdBook draws each `<i class="fa…">` as its icon, the same ones the menu bar uses. As printed, it fits a book with a repo (`GIT_REPO_URL`), `THEME` left at `"picker"` and `OFFLINE` at `"full"`; adapt it to yours:

- Without a repo, drop the Pencil row, since there's no pencil, and end the Cloud row's last sentence at "which version you have": a downloaded copy shows the site's address only when the book knows its repo.
- With `OFFLINE="none"`, drop the Cloud row and the "Read offline" row.
- With `OFFLINE="download"`, make the Cloud row `**Download for a computer** gives you a copy of the book to keep on any computer, online or air-gapped, and **Download for a phone** one to read in the free Kiwix app. In a downloaded copy, it shows which version you have and the address to get a newer one.` and make the "Read offline" row's last cell `Tap the cloud, then **Download for a phone**, and open the file in the Kiwix app`.
- With `THEME` at `"auto"` or `"dark"`, drop the Paintbrush row: there's no theme button.
- If you added a section at a time with `"h2"` or `"nested"` (see "A section at a time, by hand"), in the Navigation section make "move you to the previous and next chapter" read "move you to the previous and next section, and past a chapter's last section to the next chapter", and in the table under "On a phone or tablet" make "Previous or next chapter" read "Previous or next section".
- If you added it with `"picker"`, add this row to the icon table after the Magnifying glass: `| <i class="fas fa-book-open"></i> Open book | Switches the layout: **Scroll** shows the whole chapter on one page, **Pages** one section at a time, turned by the arrow buttons and the <kbd>←</kbd> <kbd>→</kbd> keys. Your choice is remembered in this browser. |`; and in the Navigation section, after "move you to the previous and next chapter", add " (in Pages, the previous and next section first)".

```markdown
# Using the site
<p class="mdb-subtitle">The keys, icons and shortcuts for getting around</p>

## Navigation

The **sidebar** lists every chapter of the book. The **menu button** (three horizontal bars) at the top left opens and closes it, and so does the <kbd>b</kbd> key. On a touch screen, a quick swipe right that starts near the left side, a little in from the edge (phones often keep the very edge for going back), opens it, and a quick swipe left across the sidebar closes it. Click any chapter to open it. On a narrow window, a phone especially, the sidebar starts closed; the menu button brings it up.

The **menu bar** along the top holds the icons described below. Clicking the middle of the menu bar, where the book's name sits while the sidebar is closed, takes you back to the top of the page. With the sidebar closed, the menu bar slides out of the way as you scroll down; scroll up a little and it comes back.

The <kbd>←</kbd> and <kbd>→</kbd> keys move you to the previous and next chapter; the large arrow buttons do the same, at the sides of the page on a wide screen and at the bottom of the page on a narrow window or a phone. <kbd>↑</kbd> and <kbd>↓</kbd> scroll the page, and <kbd>PgUp</kbd>, <kbd>PgDn</kbd>, <kbd>Space</kbd> and <kbd>Shift</kbd>+<kbd>Space</kbd> scroll a whole screen at a time. Press <kbd>?</kbd> any time for the full list of keys.

Not the book's doing, but in case you didn't know: <kbd>Alt</kbd>+<kbd>←</kbd> and <kbd>Alt</kbd>+<kbd>→</kbd> (<kbd>⌘</kbd>+<kbd>[</kbd> and <kbd>⌘</kbd>+<kbd>]</kbd> on a Mac) move you back and forward through your browser history. If a link took you somewhere, <kbd>Alt</kbd>+<kbd>←</kbd> brings you back.

## On a phone or tablet

There's no keyboard, so here's what stands in for each key.

| To do this | On a computer | On a phone or tablet |
|------------|---------------|----------------------|
| Open or close the sidebar | <kbd>b</kbd> | Tap the three bars, or swipe right from near the left side (not the very edge) to open, and left across the sidebar to close |
| Previous or next chapter | <kbd>←</kbd> <kbd>→</kbd> | Tap the arrow buttons at the bottom of the page |
| Search | <kbd>s</kbd> or <kbd>/</kbd> | Tap the magnifying glass |
| Back to the top | Click the middle of the menu bar | Tap the book's name |
| Back to where you were | <kbd>Alt</kbd>+<kbd>←</kbd> | Your phone's back button or back gesture |
| Read offline | Click the cloud, then **Save for offline** | Tap the cloud, then **Save for offline**; on an iPhone or iPad, add the book to your Home Screen first (in Safari: Share, then Add to Home Screen) and save it from there. For a phone that stays offline, **Download for a phone** gives you a file to open in the free Kiwix app |

## Menu bar icons

| Icon | What it does |
|------|--------------|
| <i class="fas fa-bars"></i> Three bars | Opens and closes the sidebar. Same as <kbd>b</kbd>. |
| <i class="fas fa-paintbrush"></i> Paintbrush | Switches the colours: **Auto** follows your device's light or dark setting, **Light** and **Dark** keep one. Your choice is remembered in this browser. |
| <i class="fas fa-magnifying-glass"></i> Magnifying glass | Opens the search bar. Same as <kbd>s</kbd> or <kbd>/</kbd>. |
| <i class="fas fa-pencil"></i> Pencil | Opens the source of this page on GitHub, so you can suggest a fix if you spot a mistake. |
| <i class="fas fa-print"></i> Printer | Lays the whole book out as one long page, for printing or saving as a PDF. To print only the page you're reading, press <kbd>Ctrl</kbd>+<kbd>p</kbd> (<kbd>⌘</kbd>+<kbd>p</kbd> on a Mac) instead. |
| <i class="fas fa-cloud-arrow-down"></i> Cloud | **Save for offline** keeps the book in this browser, to read without a connection. Once it's saved, the cloud becomes a tick, with a dot on it when a new version is out, and a plane while you're offline. **Download for a computer** gives you a copy to keep on any computer, online or air-gapped, and **Download for a phone** one to read in the free Kiwix app. In a downloaded copy, it shows which version you have and the address to get a newer one. |

One icon lives outside the menu bar: hover over any code block and a <i class="fa fa-clipboard"></i> **copy** button appears at its top right. It copies the code exactly as written, ready to paste into the terminal.
```

## The version line

The foot of the sidebar can show a build stamp reading `<version> · updated <when> · <sha>`, with the SHA linking to the commit on GitHub when the book knows its repo (`GIT_REPO_URL`), and plain text otherwise. The `<when>` is relative — "3 hours ago", "yesterday", then the plain date once it is older than three days — with the exact time shown on hover; see "The last-updated line" for the formatter it shares with the per-page line. The time is the built commit's, not the build's, so rebuilding a commit stamps the same time and SHA; only the version can differ, when a tag has been added since. **This is stamped by the deploy workflow, into `version.js`, not by the script** — so:

- On a **local** `mdbook serve` / `build`, nothing stamps it and the line does not appear at all. That's expected; it's not a bug. (The fields are literal `__MDB_BUILD_*__` placeholders in `version.js` locally, and the JS shows a field only once it's been substituted.)
- On the **deployed** site, the updated time and short SHA always appear. The **version** is the git tag: `git describe --tags` names the tag on the built commit, or the nearest reachable tag plus a commit count — `v1.2` on the tagged commit, `v1.2+5` five commits later. So tagging once per release (not once per commit) still stamps a version on every build, and no build claims a tag it isn't.

To cut a release tag:

```bash
git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0
```

The workflow fires on tag pushes as well as branch pushes (`tags: ['v*']`), so the tag alone deploys and stamps, once step 4 of "Push to GitHub" lets tags deploy. Without that rule the tag's run builds, then stops at its deploy job with `Tag "v0.2.0" is not allowed to deploy to github-pages due to environment protection rules`, and the live site keeps its last build; add the rule, then re-run the failed job from the Actions tab. A repo with no tag yet shows just the date and commit; add the first tag and the version appears from then on.

## The last-updated line

Each chapter carries a **`Last updated <when>`** line under its title, set like a date line: italic, a little smaller than the text, and muted. It hangs under the title block's rule, before the text. The time is the chapter *source's* last commit, not the build's: the workflow runs `git log -1` over every file in `src/`, in UTC (`TZ=UTC … --date=format-local:%Y-%m-%dT%H:%M:%SZ`), so the pages don't carry your time zone's offset, and stamps the result into `version.js` as a `{"src/chapter.md":"<time>"}` object, and the page matches its own source against that object (via the edit link, falling back to the URL) and formats it. The home page is a copy of the first chapter and finds its source only through the edit link, so it carries the line only when the book knows its repo.

Like the footer, it is **relative** — rendered by one shared formatter: under an hour reads "just now", then "N hours ago" for the rest of the same calendar day, then "yesterday", "two days ago", "three days ago", and from four days out the plain local date (`YYYY-MM-DD`). It is computed once at load — no ticking clock — and the element's `title` carries the exact ISO timestamp, so hovering shows the precision the words drop. A time in the future (clock skew) clamps to "just now".

It is a **deployed-site** feature, for the same reason the footer is: the dates come from git history the workflow has and a local build doesn't, so `mdbook serve` shows no line. `print.html` never carries one (it concatenates every chapter, so it has no single source), and a chapter the workflow couldn't resolve a date for simply shows nothing rather than a guess. Style it through `.content .mdb-updated` in `custom.css`.

## The link check

`./build`, in the book's folder, builds the book and then runs [lychee](https://github.com/lycheeverse/lychee) over it, and **stops on any broken internal link or `#anchor`**. The script runs it before it opens the preview and stops there on a break; run it yourself before each push. The deploy workflow runs the same `./build`, so a break that slips through still stops the deploy rather than shipping, and the live site keeps its last good build.

```bash
./build
```

On a clean book it prints mdBook's three `INFO` lines, then `links: every internal link and anchor resolves`, and exits 0; unless `OFFLINE` is `"none"`, an `offline: …` line comes before it (see "Read offline"). When mdBook reports an error it stops after mdBook, with `stopped: mdBook reported an error, above.`: mdBook goes on past some errors and exits as if it hadn't, so an `{{#include}}` whose file isn't there (`ERROR Error updating "\{{#include missing.md}}"`) would otherwise go out as the directive's own text. mdBook reads such a directive anywhere in a chapter, in a code span or a code block too: to quote one, put a backslash before its opening braces, and mdBook drops the backslash and leaves the rest as written. On a broken one it prints lychee's own report, then a line of its own, and exits 1:

```text
Issues found in 1 input. Find details below.

[book/chapter_1.html]:
[ERROR] file:///home/you/Desktop/mybook/book/chapter_1.html#nope (at 313:41) | Cannot find fragment
[ERROR] file:///home/you/Desktop/mybook/book/gone.html (at 313:10) | File not found. Check if file exists and path is correct

🔍 77 Total (in 3ms) 🔗 42 Unique ✅ 74 OK 🚫 2 Errors 👻 1 Excluded

stopped: lychee found broken links or anchors, listed above under the built page each is on. fix them, then run ./build again.
```

Each break is listed under the built page it's on (`book/chapter_1.html` is built from `src/chapter_1.md`), with the address it leads to and why: `File not found` for a page that isn't there (a renamed or deleted chapter, or one not listed in `SUMMARY.md`), `Cannot find fragment` for an `#anchor` no heading on that page has. `(at 313:41)` is the line and column in the built page, not in your Markdown: search the chapter for the address (`gone.md` for `gone.html`, since mdBook writes `.html` for `.md`) or the anchor (`#nope`). If `./build` says `bin/mdbook is missing` or `bin/lychee is missing`, run the script: it installs both. If it says `offline.py is missing`, run the script and commit the file it writes.

The check is offline: it tests the book's own pages and anchors and does **not** fetch outside addresses, so a dead link to another site doesn't stop it. `print.html` (every chapter again) and `404.html` (its `<base href>` points at the live site) are skipped as inputs; links *to* them are still checked. The usual causes of a break are a renamed or deleted chapter still linked from another, a `#anchor` whose heading text changed (mdBook makes the id from the heading's words), or a relative path that works on disk but not once mdBook has laid out the site.

lychee is looked up and pinned like mdBook (see "Releases and updates"); the report is lychee's, so a newer lychee can word it differently.

## What a push publishes

The repo is public (Pages needs it to be, on a free plan), and so is everything in it: every file, and every commit with its details. Five things there can say who you are:

- **Commits and tags.** Each carries a name and an email, git's `user.name` and `user.email`, and its time with your time zone's offset (`+0530`); a commit's `.patch` page on GitHub shows all three. Set both before your first commit (`git config --global user.name …`, `git config --global user.email …`; on Whonix, for the book alone: see "Whonix"), with `git config --global user.useConfigOnly true` beside them, so that git, finding no name or email, stops with `Author identity unknown` instead of making one up from your account's full name and your machine's name. The script makes no commits; see "The first commit". GitHub gives you a private address for this, `ID+USERNAME@users.noreply.github.com`: Settings → Emails → **Keep my email addresses private** shows it. To make your own commits and tags in UTC too, add `alias git='TZ=UTC git'` to `~/.bashrc`. UTC hides the offset, not the hours: commit times across weeks still show when you work. Before the first push, `git log --format='%an <%ae> %ad, committed by %cn <%ce> %cd'` lists what each commit says; to redo the first commit under another name, set `user.name` and `user.email`, and unset any `author.name`, `author.email`, `committer.name` or `committer.email` setting and any `GIT_AUTHOR_*` or `GIT_COMMITTER_*` variable, which git takes before them, and for the `_DATE` ones before the clock (`git config --show-origin --get-regexp '^(author|committer)\.'` lists those settings and the file each is in, and prints nothing when there are none); then run `TZ=UTC git commit --amend --reset-author --no-edit`, which changes its author and its committer both.
- **Your GitHub account.** Its name is in the site's address (`USER.github.io`) and in every link to the repo: the pencil, the footer's commit link, `README.md`, the laptop copy's `README.txt`, and the phone copy's details in Kiwix. A custom domain doesn't hide it while those links point at the repo. Only a separate account, with its own email and SSH key, keeps a book apart from your own.
- **`BOOK_AUTHOR`.** It goes into `book.toml`, in the repo, and into the copy for a phone, where Kiwix's library shows it as the book's creator and publisher. No page shows it: mdBook 0.5.4's pages don't use it.
- **Files you add to `src/`.** They're published byte for byte, on the site and in the downloads. A photo can carry where it was taken, the camera's serial number, and its time with your offset: `exiftool -all= -overwrite_original FILE` (package `libimage-exiftool-perl`) takes all of that out. An SVG from a drawing program can carry your name and paths from your machine: `scour --remove-metadata --enable-comment-stripping -i in.svg -o out.svg` (package `scour`) takes those out and keeps the `prefers-color-scheme` style "The favicon" asks for.
- **Editors' swap, lock and backup files.** vim's `.name.swp`, Emacs's `.#name` and `#name#`, and `name~` hold your login name, the computer's name and the folder's path. `.gitignore` keeps those out of commits. Another editor may leave files of its own, so read what `git status` lists before you commit.

The pages' `Last updated` times are in UTC, whatever offset your commits have, and so are the footer's and the downloads'.

## The first commit

The script makes no commits: a commit puts its files, and your name, address and time, into a history that a push publishes, so each one is yours to check and make. After the first run, in the book's folder:

```bash
git status
```

It prints `No commits yet` and a list headed `Untracked files:`: what the run wrote, `.github/`, `.gitignore`, `README.md`, `book.toml`, `build`, `custom.css`, `custom.js`, `offline.py`, `src/`, `theme/` and `version.js`. `bin/` and `book/` aren't listed: `.gitignore` keeps them out. Look through it for anything you didn't expect, such as a file of your own in the folder, or one from a cloned reference repo you didn't mean to keep. Then:

```bash
git config user.email
git add -A
TZ=UTC git commit -m 'initial mdBook scaffold'
```

The first prints the address the commit will carry; check it's yours to publish (see "What a push publishes"). `git add -A` prints nothing. The commit prints `[main (root-commit) …] initial mdBook scaffold`, then how many files it took and a line for each. `TZ=UTC` makes its time UTC, so it doesn't show your time zone. `Author identity unknown` means git has no name and email yet: set them, as "What a push publishes" says, and commit again.

## Push to GitHub

One time:

1. Create an **empty** repo on GitHub — no README, `.gitignore`, or license. An auto-initialized repo makes your first push a non-fast-forward, and it'll be rejected.
2. Push. If you set `GIT_REPO_URL` before running, `origin` (SSH) is already set, so just:

   ```bash
   git push -u origin main
   ```

   (use your `DEPLOY_BRANCH` if you changed it). If you left `GIT_REPO_URL` empty, set it, re-run the script and commit: that adds `origin`, and the pencil, `site-url` and the footer's commit link (see `GIT_REPO_URL` under "The toggles").
3. **Enable Pages once, by hand:** Settings → Pages → Source → **GitHub Actions**. The workflow does *not* enable Pages for you (it can't: enabling Pages takes a token with more access than a workflow's own, which this script won't ask you to store).
4. **Let release tags deploy, once:** Settings → Environments → **github-pages**. GitHub limits that environment to your default branch, so it lists one rule, `main` (or your `DEPLOY_BRANCH`). Click **Add deployment branch or tag rule**, set Ref type to **Tag**, enter `v*`, and click **Add rule**. If it says **No restriction** instead, there's nothing to add. The workflow can't do this for you either: changing an environment's rules takes administration access to the repo, which a workflow's token can't be given.

After these two settings, every push to `main` (or your `DEPLOY_BRANCH`) and every `v*` tag deploys automatically.

The workflow runs with least-privilege tokens: the build job's can only read the repo (`contents: read`), and only the deploy job's can publish (`pages: write` and `id-token: write`), so no other repo permission changes are needed. Pages itself requires a **public** repo, or a paid plan for a **private** one; an org-owned repo also needs Pages allowed by org policy.

After setup, every change: edit → `./build` → `git add -A` → `git commit` → `git push`, and the workflow rebuilds and publishes. To rebuild without a content change: Actions → the workflow → **Run workflow**. Your site is at `https://USER.github.io/REPO/` — the link in your README.

**Custom domain:** set it in Settings → Pages → Custom domain (the first-party deploy honours it), or commit a `CNAME` file into `src/` (mdBook copies non-markdown files from `src/` to the site root verbatim).

## Releases and updates

The script names no release. On a book's first run, and when you run `update`, it asks `github.com` for the tags of mdBook, lychee and the workflow's three actions (`actions/checkout`, `actions/upload-pages-artifact` and `actions/deploy-pages`), asks `api.github.com` once for each when its releases came out, and takes the highest-numbered stable release (not a draft or a pre-release) that has been out a week (`RELEASE_WAIT_DAYS`, under the settings): most hijacked releases are found and pulled within a week. For mdBook and lychee it takes only a release whose Linux tarball has been up that week too, without being uploaded again, and for which GitHub gives the file's SHA-256, which GitHub has recorded for every file uploaded to a release since June 2025. Each lookup prints a line, such as `looking up rust-lang/mdBook's newest release on github.com...`. mdBook stays on its 0.5 series, which the theme and `custom.js` are written for. With `HEADING_NUMBERS=true`, `mdbook-numbering` comes from crates.io the same way, the first time it's turned on: its newest version out a week and not yanked.

The run downloads each tarball and keeps it only when its SHA-256 is the one GitHub recorded. The workflow then pins what the run took: mdBook and lychee by version and that SHA-256, which CI checks its own download against; each action by the commit its tag names, with the tag after it (`uses: actions/checkout@<commit> # v7.0.1`); `mdbook-numbering` by version. So the binaries your preview and GitHub's builds run are the files GitHub recorded for those releases. What the SHA-256 can't show is that GitHub received the file the project meant to publish; that rests on GitHub, on the HTTPS connections to it, and on the week's wait. Every other run keeps those pins, and contacts no site unless a pinned tarball is missing from `bin/`: then it downloads that release, checked against its pinned SHA-256. No newer release reaches your book until you run `update` and push.

- **Update:** `bash bootstrap-mdbook.sh update` looks everything up again, installs the newest releases into `bin/`, deletes the tarballs of the ones they replace, and re-pins the workflow, then builds and previews as any run does. Commit the workflow it changed.
- **Remove:** `bash bootstrap-mdbook.sh remove` deletes this book's `bin/` (mdbook, lychee and their tarballs) and, if cargo has it, `mdbook-numbering` (`cargo uninstall mdbook-numbering`). It prints a line for each, then `the book and its workflow are as they were: the next run downloads the releases the workflow pins`. `src/`, the workflow and its pins stay, so GitHub's builds go on as before. `mdbook-numbering` is one install that every book on your computer shares: another book with `HEADING_NUMBERS=true` builds it again at its next run. Until a run puts `bin/` back, `./build` stops with `bin/mdbook is missing`.

A run stops before it rewrites any file when a download isn't the file it should be, or something pinned has changed under the same version:

- **A download isn't the file GitHub recorded** (a new book, or with `update`): `… has sha256 …, not …, the one GitHub recorded for it: it wasn't kept`. Run it again; if it says the same, don't work around it: something between you and GitHub is changing the file. With the tarball already in `bin/`: `bin/mdbook-….tar.gz has sha256 …, but GitHub recorded … for mdbook …`: delete it and run the script again, online.
- **GitHub gives no SHA-256 for the file**, or one in a form the script doesn't know: `GitHub gives the sha256 of …'s Linux file in a form this script doesn't know, or none, so the download can't be checked`. Nothing is downloaded. A run without `update` keeps the releases the workflow already pins; a newer version of the script may know the form.
- **A downloaded release file isn't the pinned one:** `… has sha256 …, but the workflow pins … for it: the file has changed since it was pinned`. The download isn't kept. Check the release on GitHub; to go on, delete the line with the pinned SHA-256 from `.github/workflows/deploy.yml` and run the script again.
- **A tarball in `bin/` isn't the pinned one:** `bin/mdbook-….tar.gz has sha256 …: it has changed since it was downloaded`. Delete it and run the script again, online: it downloads the release again and checks it.
- **An action's tag names another commit now** (with `update`): `actions/checkout's tag … now names commit …: the tag has moved`. Check the release on GitHub; to go on, delete that action's `uses:` line from the workflow and run again.

A first run, `update`, and a run that's missing a tarball need the network; without it they stop (`could not ask github.com for …'s tags`, or `could not download …: each release needs github.com once`).

The way back from a release that breaks something: `git log --oneline -- .github/workflows/deploy.yml` lists the commits that changed the workflow, newest first; `git checkout HASH -- .github/workflows/deploy.yml`, with the last good one's hash, puts that workflow back and prints nothing; then run the script, without `update`. It keeps those pins and downloads their tarballs.

`api.github.com` answers 60 requests an hour from one address, and a lookup makes five: behind an address many people share, a Tor exit included, try again within the hour.

## Whonix

On a Whonix Workstation the script runs as it does anywhere else, with these differences:

- **Run it as `user`, in the normal session.** Not in SYSMAINT, and not with `sudo`: the script refuses root, and a book made as `sysmaint` would sit in `sysmaint`'s home. On Whonix, programs are installed in the SYSMAINT session, so curl, git and python3 go in there; the Whonix setup guide has the steps. Run the script once as `user` first: its `ERROR: missing: …` line names everything to install, so one trip to SYSMAINT is enough. The `sudo apt-get install` in that line is for SYSMAINT. With `HEADING_NUMBERS=true`, Rust's installer (<https://rustup.rs>) runs as `user`, needing no root.
- **`/usr/bin/git` is there whether git is installed or not.** It's Whonix's wrapper, which sends git through Tor. The script checks git by running it, `git --version`. To check yourself, `ls /usr/bin/git.anondist-orig` prints that path when git is installed, and `No such file or directory` when it isn't.
- **Copy the script out of the shared folder, and keep the book out of it.** `cp /mnt/shared/bootstrap-mdbook.sh ~/` prints nothing; run that copy, as `bash ~/bootstrap-mdbook.sh`. Leave `PROJECT_DIR` in your home folder: the host can write to `/mnt/shared`, and a folder there isn't yours alone.
- **Set your name and email for the book alone, after the first run.** Skip `git config --global`: a global name goes on every repository on the Workstation. After the first run, in the book's folder, run `git config user.name "Your Name"`, `git config user.email "Your Email"` and `git config user.useConfigOnly true`, without `--global`; none prints anything. Then make the first commit, as in "The first commit". `git config user.name` printing nothing and exiting with an error only means it isn't set. Only commits need a name and email: the script's lookups, cloning and pulling don't.
- **Lookups go through Tor**, so they're slow, and `api.github.com` can answer `403` or `429`, which the script reports as `could not ask api.github.com for …'s releases`, when others on the same Tor exit have used up its limit of 60 requests an hour. Wait ten minutes or so, which gives new connections another exit, and run it again.
- **The preview in Tor Browser.** Tor Browser sends `localhost` and `127.0.0.1` through Tor too, so the preview at `http://localhost:3000`, and the offline test at `http://127.0.0.1:8000`, show `Unable to connect`. To look at them, close every other tab, open `about:config`, set `network.proxy.allow_hijacking_localhost` to `false`, and reload. Set it back to `true` before you open any other site: while it's `false`, any page open in Tor Browser can send requests to programs on the Workstation, and from the answers tell which are running. Or don't preview there at all: run the script with `SERVE=false` in front, and look at the site once it's published.

## Other platforms

Linux x86_64 only, as shipped. Step 4 of the script downloads the `x86_64-unknown-linux-gnu` tarballs and pins their SHA-256 in the workflow, whose install steps download the same tarballs on GitHub's x86_64 Linux runner (`ubuntu-latest`) and check them against it. So both stay the Linux tarballs. On another platform, put `bin/mdbook` and `bin/lychee` in place for the preview by hand, and leave the workflow as the script writes it: from each project's releases page on GitHub (for lychee, a release tagged `lychee-v`), download the file whose name ends with your platform's triple and `.tar.gz`, then `tar -xzf mdbook-*.tar.gz -C bin mdbook`, or for lychee `tar -xzf lychee-*.tar.gz -C bin --strip-components=1 lychee-TRIPLE/lychee` with the triple in the folder's name; each prints nothing. A run of the script puts the Linux binaries back.

The real 0.5.4 asset triples, for a `bin/mdbook` installed by hand: Intel macOS `x86_64-apple-darwin`, Apple Silicon `aarch64-apple-darwin`, ARM Linux `aarch64-unknown-linux-musl` (musl, not gnu); Windows ships a `.zip` (`x86_64-pc-windows-msvc`). Always confirm the current spelling on the mdBook releases page.