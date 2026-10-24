<p class="mdb-subtitle">A minimal mdBook on GitHub Pages like this one</p>

# Publish a book or knowledge base

The [bootstrap-mdbook script](./bootstrap-mdbook.md) scaffolds an mdBook book, installs the newest mdBook release that has been out a week and pins it, writes a first-party GitHub Pages deploy workflow, and opens a live preview. The published site has the usual mdBook furniture — left-sidebar table of contents, built-in search, print/PDF view — with no analytics, no tracking, and no request from its pages to any other site (mdBook's Rust playground, which would make one, is off; see "Code line numbers"), and a reading theme: self-hosted Charter, a ~700px measure, a warm dark palette, one hairline closing each chapter's title, inked-and-underlined links, and a sidebar masthead that behaves like the menu bar. The theme is dark for every reader out of the box; `THEME` adds its light counterpart, chosen by each reader's system setting, or by the reader with a button. A button beside print lets readers keep the book on their own devices: saved in the browser, or downloaded as a copy for any computer, online or air-gapped (`OFFLINE`).

It is a one-shot bootstrapper. It seeds the project once; after that you own the files and edit `src/` directly. Re-running is the *update* path (new releases, changed toggles), and it regenerates the script-owned files — see "Re-running vs. hand edits."

Linux x86_64 only, with a glibc new enough for mdBook's and lychee's Linux builds. For macOS or ARM, see "Other platforms" at the end.

## Two ways to set this up

There are two ways to build a site like this one. They differ only in how the files arrive; the result — the theme, the deploy workflow, the furniture — is identical.

1. **Clone the reference repo.** The fastest start: you get a working tree, and change the title, author, and repo rather than writing scaffolding.

   ```bash
   git clone REPLACE_WITH_REPO_URL mybook
   cd mybook
   rm -rf .git
   ```

   Replace `REPLACE_WITH_REPO_URL` with the repository URL. Don't skip `rm -rf .git`, which prints nothing: it deletes the clone's history. Kept, the reference repo's commits would go into your repo with your first push, each with its author's name, email and time zone, and with `OFFLINE` on (the default) the book's versions would count them. With the history gone, the script makes a fresh repository and a first commit of your own.

   A clone also carries *that* repo's URL baked into `book.toml` (`site-url`, `edit-url-template`), `README.md`, `custom.js` (`MDB_REPO`) and `offline.py` (`HOME`). Point them at *your own* empty repo: delete the clone's `README.md` and run the script with your `GIT_REPO_URL` set. It adds `origin` there, regenerates `book.toml`, `custom.js` and `offline.py`, and writes a new `README.md` because there is none. It does that in `PROJECT_DIR/BOOK_NAME`, so that path must be the clone; run the clone command above in `~/Desktop` and the defaults already match. (Or add `origin` yourself, with `git init -b main && git remote add origin git@github.com:USER/REPO.git`, and run the script with `GIT_REPO_URL` empty: it reads the repo from `origin`.) Fonts, tagging, and Pages are then the same as the path below.

2. **Run the script.** The rest of this guide, from "Run it" on. Edit the toggles, run it once with no arguments, and it installs mdBook, writes every file, and opens a preview. Re-running is the update path.

## Run it

1. Open `bootstrap-mdbook.sh` and edit the toggles at the top (below).
2. Run it with no arguments:

   ```bash
   bash bootstrap-mdbook.sh
   ```

Before the preview opens, the script runs `./build`, which builds the book into `book/` and checks every link and anchor in it. If any is broken, the run stops there and lists them, with no preview (see "The link check"); fix them and run the script again. Otherwise the preview opens on a free local port the script picks and prints (`http://127.0.0.1:<port>`). It builds into `.preview/`, rebuilding as you edit, so `book/` keeps what `./build` made; it checks no links, and has no offline button, which needs what `./build` adds. With `OFFLINE` on, the run serves `book/` too, button and all, on the first free port from 8000, and prints its address: that page is the book as `./build` left it, and doesn't follow your edits (see "Read offline"). Ctrl-C stops both. Re-launch the preview alone later with:

```bash
cd <project> && ./bin/mdbook serve --open -n 127.0.0.1 -p <port> -d .preview
```

A second book alongside the first just needs a different `-p` port.

Before each push, run `./build` in the book's folder: the deploy runs the same check and stops on the same breaks.

Audit it first. Network-wise it asks `api.github.com` for the releases of mdBook, lychee and the workflow's three actions, asks `github.com` which commit each action's release names (`git ls-remote`), and downloads the mdBook and lychee release tarballs from `github.com`, which redirects the download to its file host, `release-assets.githubusercontent.com` (see "Releases and updates"). It installs nothing with `apt` or `sudo`: mdBook and lychee go into the book's `bin/`. It needs `curl`, `python3` and `git`; if one is missing it stops before it writes anything and prints the line that installs it (`sudo apt-get install …` on Debian or Ubuntu). `python3` reads GitHub's answers, runs `offline.py`, and, with `OFFLINE` on, serves `book/` on 127.0.0.1 while the preview runs. Only when `HEADING_NUMBERS=true` does it also ask `crates.io` for `mdbook-numbering`'s versions, need a C compiler (`build-essential` on Debian or Ubuntu; it stops the same way without one), and install the Rust toolchain into `~/.cargo` and `~/.rustup` (via `rustup`, from `sh.rustup.rs` and `static.rust-lang.org`) to compile that preprocessor, whose sources cargo fetches from crates.io (`index.crates.io`, `static.crates.io`); rustup also adds a line to your shell's startup files, such as `~/.profile`, that puts `~/.cargo/bin` on your PATH, where `./build` finds `mdbook-numbering`, in terminals opened after that: in the one the run was in, run `. "$HOME/.cargo/env"` first, or `./build` stops with ``The command `mdbook-numbering` wasn't found``. The run says so at its end, or under `./build`'s report when that stops it. A `cargo` already on your PATH is used instead of rustup's: one from your distribution is often older than `mdbook-numbering` needs, and the run then stops with cargo's reason and a pointer to rustup; one that does build it puts it in `~/.cargo/bin`, which a distribution's PATH often lacks, and the run says that the same way. That path adds a few minutes to the first run.

The settings at the top must be this version's: a block pasted from an older version stops the run before it reads or writes anything, with each setting to add, its lines printed for you to paste, and each to delete (see "Upgrading from v55 or earlier", and for `THEME`, "Upgrading from v53 or earlier").

## What it writes

Into the project folder (`PROJECT_DIR/BOOK_NAME`):

- `book.toml` — mdBook config, seeded from the toggles. **Script-owned.**
- `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md`, `src/demo.svg` — starter content (the SVG is the demo chapter's picture), written only if `src/SUMMARY.md` doesn't already exist. **Yours** thereafter.
- `custom.css`, `custom.js` — the theme and behaviours. **Script-owned.**
- `version.js` — the deploy stamp the sidebar footer and the `Last updated` lines read: four placeholders the deploy workflow fills in. **Script-owned.**
- `theme/head.hbs` — clears a theme saved in the reader's browser, or with `THEME="picker"` one the button doesn't offer (see "Light and dark"); with `OFFLINE="full"` it also links the web app manifest (see "Read offline"). **Script-owned.**
- `theme/fonts/fonts.css` — keeps mdBook's own fonts out (see "The reading theme"). **Script-owned.**
- `theme/favicon.svg` — written from `src/logo.svg` if that exists, otherwise drawn from `FAVICON_TEXT`. **Script-owned while either source is set**; it is never deleted, only overwritten. See "The favicon."
- `README.md` — title, plus a live-site link if the book knows its repo (`GIT_REPO_URL`, or `origin`), written only if there's no `README.md` yet. **Yours** thereafter.
- `build` — the build and link check: `./build` builds the book and stops on any broken link or anchor, listing each by the file and line it's written on. The script runs it before the preview, and the deploy workflow runs the same file. **Script-owned.** If the book already has a `build` the script didn't write, the run stops before changing anything, so yours is never overwritten: move it aside (`mv build build.own`) and run again.
- `offline.py` — `OFFLINE`'s build step (see "Read offline"). `./build` runs it after mdBook, whatever the setting: it always writes the site's `sw.js`, and unless `OFFLINE` is `"none"` it makes the download. Python 3.7 or later, standard library only. **Script-owned.**
- `.github/workflows/deploy.yml` — the Pages deploy workflow; it pins mdBook, lychee and its three actions, stamps the version, the commit's time and the per-page dates into `version.js`, and runs `./build` before deploying. **Script-owned.**
- `bin/mdbook` + `bin/.mdbook.sha256` + `bin/.mdbook.version`, `bin/lychee` + `bin/.lychee.sha256` + `bin/.lychee.version` — the pinned binaries, each with its tarball's digest and the version it's for. `bin/` is gitignored.
- `.gitignore` — ignores `bin/`, `book/` and `.preview/` (the preview's build).

"Script-owned" means a re-run regenerates it and discards hand edits.

One path under `src/` is reserved rather than written: chapters you put in `src/unlisted/` **and list in `SUMMARY.md`** are published but kept off the sidebar, the arrow chain and the search index. See "Unlisted chapters."

## The toggles

Edit these at the top of the script.

- `PROJECT_DIR` — parent folder the book is created in (e.g. `$HOME/Desktop`). A leading `~` and relative paths are resolved for you.
- `BOOK_NAME` — the project folder's name, under `PROJECT_DIR` (default `mybook`). Readers see it only in the offline download's name (see "Read offline"). ASCII letters, digits, `.`, `_` and `-` only, not starting with `.` or `-`: the characters GitHub allows in a repository name, so the folder and the repo can share a name, and nothing in it expands when you paste the `cd` line the script prints at the end. The repo's own name and the Pages URL still come from `GIT_REPO_URL`.
- `BOOK_TITLE` — the title readers see, written to `book.toml` and used for the masthead, the drawn favicon, `README.md` and the starter About page. Apostrophes, quotes and `/` are safe; it must not contain a newline. Change it and re-run, and the same book is retitled in place; `src/about.md` and `README.md`, being yours, keep the title they were written with.
- `BOOK_AUTHOR` — author, written to `book.toml`. No page shows it (see "What a push publishes").
- `BOOK_DESCRIPTION` — one line about the book; `""` (default) for none. Written to `book.toml` as mdBook's `description`, which every page carries in its `<meta name="description">` for search engines, and with `OFFLINE="full"` the web app's description (see "Read offline"). It must not contain a newline.
- `DEPLOY_BRANCH` — git default branch, and the branch whose pushes trigger CI (default `main`).
- `HEADING_NUMBERS` — `true` adds automatic in-page heading numbers (H2–H6) via the `mdbook-numbering` preprocessor (its newest version that has been out a week, pinned in the workflow; see "Releases and updates"). This path also installs Rust and compiles the preprocessor. Default `false`.
- `SIDEBAR_NUMBERS` — `true` (default) shows mdBook's built-in sidebar chapter numbers (`1.`, `1.1.`); `false` hides them (`no-section-label`). Independent of `HEADING_NUMBERS`: that numbers headings *in the page*, this numbers chapters *in the sidebar*.
- `THEME` — which of the theme's two palettes readers get. `"dark"` (default): the dark one, for every reader, whatever their browser or OS is set to. `"auto"`: light or dark as the reader's browser or OS is set, with no control in the page. `"picker"`: the same, plus a button in the menu bar with **Auto** (the reader's setting), **Light** and **Dark**, starting on Auto, the choice kept in the reader's browser. Charter and the rest of the theme in all three. See "Light and dark."
- `GIT_REPO_URL` — your repo URL, e.g. `https://github.com/user/repo` (https github.com only, and nothing after the repo; a trailing `/` or `.git`, as GitHub's Clone button gives, is dropped). Wires the edit (pencil) icon in the top bar, links the sidebar footer's commit hash, sets `site-url` (so the 404 page resolves its assets at any depth), fills the README's live-site link when the README is first written, and sets the git `origin` remote (converted to SSH) so your first push needs no manual `git remote add`: added or changed, and said, only when it isn't that address already. Left empty, the script reads it from the book's `origin` remote when that is on github.com, and says so (`GIT_REPO_URL is empty; using origin: …`), so a fresh copy of the script run on an existing book keeps those links; `origin` itself is then left as it is. With no such remote the pencil and `site-url` are omitted, the hash is plain text, and the README is just the title; set it later and the README stays as it is, so add the link yourself, or delete `README.md` and re-run. No repo icon is written — see "The top-bar icons."
- `CODE_LINE_NUMBERS` — `true` (default) numbers language-fenced code blocks of ten lines or more. See "Code line numbers."
- `SIDEBAR_MASTHEAD` — `text` (default), `none`, or `image`. What fills the sidebar band opposite the menu bar. See "The sidebar masthead."
- `FAVICON_TEXT` — what `theme/favicon.svg` draws when there is no `src/logo.svg` to copy. `"auto"` (default) takes the first alphanumeric character of `BOOK_TITLE`, a letter as a capital (`M` for `mybook`); any other string is drawn as typed, first three characters, case preserved; `""` draws nothing and leaves mdBook's own bundled icon alone. `src/logo.svg` always wins. See "The favicon."
- `LAYOUT` — `"scroll"` (default) shows each chapter on one page. `"h2"` shows it one section at a time, each H2 starting one, its H3–H6 in it; `"nested"`, one section at a time, every H2–H6 starting one. `"picker"` adds a button with which each reader chooses **Scroll** or **Pages** (as `"nested"`), starting on Scroll. It's done in the reader's browser: the book is built the same in every layout. See "Layout: a section at a time."
- `OFFLINE` — `"full"` (default) adds a button beside print offering both: saving the book in the reader's browser, updated when they ask, and a copy to download, to keep on any computer, online or air-gapped. `"download"` offers the download only; `"none"` adds nothing a reader sees. See "Read offline."

**Upgrading from v60 or earlier:** re-run; there's nothing to commit, since no file the script writes has changed. With `OFFLINE` on, the run now serves `book/` beside the preview, on the first free port from 8000, and prints its address in place of a command to run in another terminal: the offline button can be checked there, and Ctrl-C stops both (see "Read offline"). The command for serving `book/` by hand gains `-I`.

**Upgrading from v59 or earlier:** re-run, then commit what it changed: `custom.css` and `custom.js`. Charter's files give every system but Windows a descent with the wrong sign, which set each line of Charter 0.24em low in its box: a button's label below its middle, the book's title and the icons in the top bar low, and a line with inline code taller than the rest. Each `@font-face` now sets the files' Windows metrics, which Chromium-based browsers and Firefox take on every system (see "Charter fonts"); in those, off Windows, Charter text moves up in its line (a chapter's title sits further above its rule), and a page with inline code gets shorter. On the right of the top bar, the pencil now comes before print, and the offline button last, spaced as they are: print and the download sit together, and the panel opens under its button. Under **Download a copy**, the panel says again to unpack it and open `index.html` in the folder it makes, which v58 and v59 left out. If you pasted "A page for readers" into `src/`, move its Pencil row above the Printer row.

**Upgrading from v58 or earlier:** re-run, then commit what it changed: `custom.css`, `custom.js`, `version.js`, `build`, `offline.py`, `theme/head.hbs`, `theme/fonts/fonts.css` and the workflow. Their comments, and the script's, are cut to a line where the code needs one, and the script's longer messages to what's wrong and what to do, with the rest in this guide. Nothing works differently, and the pages are the same; a copy a reader saved is offered an update all the same, since the scripts it holds changed.

**Upgrading from v57 or earlier:** re-run, then commit what it changed: `custom.css` and `custom.js`. In the offline panel, **Save for offline**, **Update to v…** and **Download a copy** are big buttons, each with a line under it saying what it's for, and the section headings are gone; the progress bar takes the theme's accent. The download is offered as a copy to keep on any computer, online or air-gapped. On an iPhone or iPad, the panel tells readers to add the book to the Home Screen first. While a saved copy is behind the site, each page it serves says so above its text (see "Read offline"). The run's last lines say to start the local server in another terminal. If you pasted "A page for readers" into `src/`, take its Cloud row, and the Read offline row in its table for phones, from the page as printed now. This guide quotes two of mdBook's directives, which v33 left live: a book that publishes the guide stopped at `./build`, with `stopped: mdBook reported an error, above.`; v34 escapes them (see "The link check").

**Upgrading from v56 or earlier:** re-run, then commit what it changed: `custom.js` and `build`. In WebKit, the engine of Safari and GNOME Web (tried in GNOME Web's), a link to a passage in a section (`#beta:~:text=…`) now opens at the passage; v56 put the section's top back once the page had loaded. A run now stops before it writes anything when there's a file or folder it would write and can't, and a run as root on a book that isn't root's stops (see "Re-running vs. hand edits"). A `.gitignore` whose last line had no newline got `bin/` on the end of that line, so a first commit took in `bin/`'s binaries and downloads; a run now puts `bin/` on a line of its own, and `git rm -r --cached bin` takes them out of the next commit, leaving the files where they are.

**Upgrading from v55 or earlier:** the settings at the top changed: `LAYOUT` takes the place of `SPLIT_HEADINGS`, so put your values into this version's block. An old block stops the run before it reads or writes anything, with the `LAYOUT` lines to add, their value the one that gives what yours asked for (`"h2"` for `"h2"`, `"nested"` for `"nested"`, `"scroll"` for `"none"`), and `SPLIT_HEADINGS` to delete. Then re-run, and commit what it changed: `book.toml`, `build`, `custom.js`, `offline.py`, with `"h2"` or `"nested"` `custom.css` too, and the deletion of `split-headings.py`, which the run removes, and says so; `git add -A` takes the deletion in. A `split-headings.py` of your own, without the script's `Script-owned` line, is left alone. A split book now shows its sections one at a time on the chapter's own page, not on pages of their own (see "Layout: a section at a time"): the split-off pages' addresses (`guide/configure.html`) and the redirect pages `./build` wrote for them are gone, so a bookmark or a link from another site to one gets the 404 page, as the stop says; a link to a heading's anchor (`guide.html#configure`) works as before. A `"none"` book without `HEADING_NUMBERS=true` loses the redirect pages `./build` wrote at those addresses too (`guide/configure.html` to `guide.html#configure`): if it was ever split, they now get the 404 page; with it, v55 wrote none. A link in the book written straight to a split-off page (`guide/configure.md`), which v55 pointed at its heading in every mode but with `HEADING_NUMBERS=true`, now stops `./build` (`there's no src/guide/configure.md`): write it `guide.md#configure`. `HEADING_NUMBERS=true` now goes with any layout.

**Upgrading from v54 or earlier:** re-run, then commit what it changed: `custom.css` and `build`, and `theme/favicon.svg` when `FAVICON_TEXT` is `"auto"` and the title's first letter or digit is a lower-case letter, now drawn as a capital. The light palette's accent, its strings and its diff additions are a shade darker (`#9d4909`, `#007f00`, `#207d36`), and the theme menu, the offline panel and the copy buttons take the palette's colours. Code prints in ink. On a page with an `.mdb-bleed` block, everything but that block now sits as it does on a page without one; before, that page's column was 1000px wide with each other block held to the measure in its middle, so a raw `<img>` or other inline HTML, or a float, sat at the wide column's edge, and a block with side margins of its own, such as a `<figure>`, lost them. A page carrying both markers now takes `mdb-wide`'s 1000px; before, `mdb-bleed` held its prose to the measure. A re-run with `GIT_REPO_URL` set leaves `origin` alone, and says nothing, when it is already that repo's SSH address (`git@github.com:user/repo.git`); another spelling of it is rewritten to that, and said.

**Upgrading from v53 or earlier:** the settings at the top changed, so put your values into this version's block rather than your old block into this version: an old block stops the run before it reads or writes anything, and lists each setting to add, its lines printed for you to paste, and each to delete. `THEME` takes the place of `THEME_MODE`, `LIGHT_THEME`, `PREFERRED_LIGHT` and `PREFERRED_DARK`, and the line the stop prints has the value that gives what yours asked for: `"dark"` for `LIGHT_THEME=false`, `"auto"` for `"fixed"` with `LIGHT_THEME=true`, `"picker"` for `"default"` with `LIGHT_THEME=true`. mdBook's own themes are gone: a `"default"`-mode book now gets this theme, Charter included, and with `"picker"` its button offers Auto, Light and Dark, in this theme's palettes. A `PREFERRED_DARK` of `coal` or `navy` becomes `ayu`, whose code colours differ. A reader's saved Coal, Navy or Rust is cleared.

The phone copy (`.zim`, read in Kiwix) is gone, and with it `zim-tools` and `librsvg2-bin`: the download is the laptop's alone, and on a phone readers save the book in the browser (see "Read offline"). The web app's icon is now the favicon itself. The script installs nothing with `apt` or `sudo`: if `curl`, `python3` or `git` is missing (or, with `HEADING_NUMBERS`, a C compiler), it stops and prints the line that installs it. `zim-tools` and `librsvg2-bin` can go if nothing else of yours uses them.

The script no longer names a release of anything. Each run takes the newest that has been out a week, checked against GitHub's digest (see "Releases and updates"), so this re-run may move mdBook, lychee, the workflow's actions and, with `HEADING_NUMBERS`, `mdbook-numbering` to other releases: usually newer ones, but an older one where the release you have came out less than a week ago. Every book stays on mdBook's 0.5 series. The run needs `api.github.com` (with `HEADING_NUMBERS`, `crates.io` too) for what the workflow doesn't pin yet; after that, a run that can't ask keeps what the workflow pins and says so.

Then `git add -A`, and commit what the run changed: the workflow (new pins, each action's release named after its commit, both jobs on `ubuntu-latest`, the two publishing permissions on the deploy job alone, checkout keeping no token, no `actions/configure-pages` or apt step, and the pages' dates in UTC), `.gitignore` (`.preview/`), `build` (it now stops when mdBook reports an error: see "The link check"), `book.toml`, `custom.css`, `custom.js`, `offline.py` and `theme/head.hbs`. A `"default"`-mode book also gains `theme/fonts/fonts.css` and, if it had `LIGHT_THEME=true` and `OFFLINE` wasn't `"full"`, `theme/head.hbs`: new files, which `git commit -a` would leave out. Deployed without `head.hbs`, a `"picker"` book keeps a reader's saved Coal, Navy or Rust, and shows mdBook's own theme. The first commit, in a new book, is now made only with a git identity you've set, and in UTC (see "What a push publishes"). A ```` ```rust ```` block is no longer one of mdBook's playgrounds (see "Code line numbers"): it loses its Run button, its page stops asking `play.rust-lang.org` for anything, and one of ten lines or more gets line numbers unless it hides lines (`# `); ```` ```rust,mdbook-runnable ```` keeps a block runnable. If you pasted "A page for readers" into `src/`, take its Cloud row and the comment at the end of its icon table from the page as printed now.

Upgrading from v52 or earlier: mdb-guide v31, under "The toggles", has the note for v52 and, after it, where the older ones are. Follow those that apply, oldest first, up to v52's, then the eight above.

## Re-running vs. hand edits

A re-run looks the releases up again and takes a newer one once it has been out a week (see "Releases and updates"), refreshes `bin/mdbook` and `bin/lychee` when their release changed, re-pins the workflow, and regenerates every **script-owned** file above from the toggles, then runs `./build` before the preview and stops there on a broken link. Your `src/` is preserved (the starter content is only written when `src/SUMMARY.md` is absent), and so is `README.md` (written only when there's none). A re-run also clears `theme/head.hbs` and `theme/fonts/fonts.css` and writes back what the current settings call for, so a change of `THEME` or `OFFLINE` never leaves a stale one behind: a `head.hbs` clearing every saved theme in a `"picker"` book would stop the button remembering any choice. A `.git` git won't work in stops a run before it writes anything: another user's repository (git calls it dubious ownership; a run with `sudo` leaves the book root's), for which the message gives the `chown` that makes it yours again, naming a worktree's or a submodule's repository too when that's outside the book; a `.git` with something in it you can't read (a `git` command run with `sudo` can leave files of root's there), for which it gives the `chown` and `chmod` that make it yours and readable; or a `.git` that isn't a repository (one emptied by hand), which the message says to move aside. A file or folder the run writes that it can't (a run with `sudo` leaves them root's, and a copy can arrive read-only) stops it the same way, before it writes anything, listing each (`ERROR: this run writes these in …, and can't; nothing has been changed:`) with the `chown` and `chmod` that make them yours, or, for one on a filesystem mounted read-only, or marked immutable or append-only, saying so (and for the mark, the `chattr` that takes it off); so does a first run whose book folder can't be made where `PROJECT_DIR` says. `bin/` is checked only when the run installs a release there or `HEADING_NUMBERS` is on (rustup and cargo build there), so a `bin/` that has this run's releases already (a symlink to a shared folder of them, say) can be one you can't write; and a `.git` you can't write stops a run only when it would set `origin` there, which it doesn't when `origin` is that address already, or make the first commit. A run as root (with `sudo`, `su`, `doas` or `pkexec`, a root login, or a container's root) on a book that isn't root's stops before any of that, since nothing here needs root: run it as the book's owner (in a container, `docker run --user` with the owner's uid and gid does that). With `HEADING_NUMBERS`, a run as root stops too when `HOME`, or the folder cargo or rustup uses (`CARGO_HOME` and `RUSTUP_HOME`, or `~/.cargo` and `~/.rustup`), isn't root's, as rustup and cargo can write there.

So: edit `src/` and `README.md` freely and re-run whenever you like. But **hand edits to `book.toml`, `custom.css`, `custom.js`, `version.js`, `build`, `offline.py` or the workflow do not survive a re-run.** Inside `theme/` the script touches exactly three files — `theme/head.hbs`, `theme/fonts/fonts.css` and `theme/favicon.svg` — and hand edits to those three go the same way; anything *else* you put in `theme/` (a `favicon.png`, an `index.hbs`, a `css/chrome.css` override) is left alone, run after run. To change a script-owned file, either change the toggle that drives it and re-run, or edit it and then don't re-run. To take a newer release while keeping such hand edits, see "Releases and updates" (the manual path).

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

`theme/head.hbs` clears any theme saved in `localStorage` before mdBook's theme script runs, or with `THEME="picker"` any the button doesn't offer — necessary because every GitHub project site under one `user.github.io` shares one `localStorage` origin, so a theme chosen in some *other* book would otherwise pin this one.

`theme/fonts/fonts.css` deliberately declares no faces. Its mere presence makes mdBook emit *only* the fonts in `theme/fonts/` (none) instead of its built-in ten Open Sans and one Source Code Pro — which this theme doesn't use. Measured against 0.5.4 that drops ~493KB, about half of a default book.

### Light and dark

`THEME` decides how the two palettes reach readers:

- `"dark"` (default): the dark palette, for every reader, whatever their browser or OS is set to. Only the dark palette is written.
- `"auto"`: both, and the reader's own light/dark setting — the browser's, or the OS preference the browser reports — decides which one they see. An open page follows a change of it. There's no control in the page.
- `"picker"`: as `"auto"`, plus mdBook's theme button in the menu bar, between the sidebar and search buttons. Its menu has **Auto** (the reader's setting, as with `"auto"`), **Light** and **Dark**. It starts on Auto, and a choice is kept in the reader's browser for their next visit.

The two palettes are painted over two of mdBook's themes, `light` and `ayu`. mdBook picks the code's highlight.js stylesheet in JavaScript, from the theme *name* — `book.js` maps `ayu` to the ayu sheet, `coal`/`navy` to Tomorrow Night, and anything else to the light sheet — so the palette and the syntax colours are selected by two different mechanisms, and only the theme name keeps them in step: the dark palette is drawn for the ayu sheet. With `"dark"`, `book.toml` sets **both** `default-theme` and `preferred-dark-theme` to `ayu`. That's easy to read as tidying-up and isn't: leave `default-theme = "light"` while writing a dark-only palette and every reader whose OS is set to light gets light syntax tokens on a near-black code block. With `"auto"` and `"picker"`, `default-theme` is `light` and `preferred-dark-theme` is `ayu`, and mdBook's script takes the reader's setting.

**The button** (`"picker"`) is mdBook's own, trimmed: `custom.js` removes the Rust, Coal and Navy rows and names Ayu's row Dark. Removes, not hides. mdBook moves keyboard focus through the list by sibling — `li.nextElementSibling.querySelector('button').focus()` — and `focus()` on a `display:none` button silently does nothing, so a hidden row would stop the arrow keys there. It is the same reason `custom.js` removes, rather than hides, the prev/next links into `src/unlisted/`. `theme/head.hbs` clears a saved theme other than `light` or `ayu` (Auto saves none), such as one another book on the same `USER.github.io` address saved, before mdBook's script reads it. Books on one address share the reader's choice: Light chosen in one book with the button is Light in another, and a book without the button clears it, since there a saved theme would pin the book to it.

Testing it: use your browser's DevTools colour-scheme emulation rather than the OS toggle. Some Linux desktops don't report the preference to the browser at all, so the OS switch can look like it does nothing when the book is fine.

### The top-bar icons

On the left the top bar carries the sidebar's and search's buttons, and with `THEME="picker"` the theme button between them. With a repo known to the book (`GIT_REPO_URL`, or an `origin` on github.com), it carries a print icon and a pencil on the right that opens the current page in GitHub's web editor (it auto-forks for readers without write access). The pencil exists only when `book.toml` carries `edit-url-template`, which the script writes from that URL, so a book built without one has no pencil, on any page; `print.html` and the 404 page never have one, since neither comes from a single source file. On the right, `custom.js` puts the pencil in front of print (mdBook puts it after), and with `OFFLINE` on, as it is by default, the offline button comes last: print and the download sit together, and the panel opens under its button (see "Read offline"). It does **not** carry a repository icon, though mdBook offers one: the icon would sit beside the pencil and lead to the same repository the sidebar footer's commit link already reaches, and two icons to one destination is one too many.

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

`theme/favicon.svg` has two sources, and it is written whatever `THEME` and `SIDEBAR_MASTHEAD` are — a `text` masthead and a favicon are different jobs, and they coexist. `src/logo.svg`, whenever it exists, is copied to it verbatim and always wins. Only when there is no `src/logo.svg` does `FAVICON_TEXT` come into it, and then the value is **drawn** as letters: ink on a transparent ground, no plate, `#191713` swapping to `#e8e6da` under `prefers-color-scheme: dark` — the two `--fg` values from the light and dark palettes. `"auto"`, the shipped default, takes the first alphanumeric character of `BOOK_TITLE`, a letter as a capital, so the stock `mybook` draws an `M` and renaming the book renames the mark. Any other string is drawn as typed, case preserved, cut to the first three characters with a warning if you gave it more. `""` draws nothing at all, and mdBook's own bundled favicon stays.

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

## Layout: a section at a time

`LAYOUT` decides how a chapter is shown: on one page, or one section at a time.

- `"scroll"` (default): the chapter on one page.
- `"h2"`: one section at a time, each H2 starting one; its H3 to H6 stay in it.
- `"nested"`: one section at a time, every H2 to H6 starting one.
- `"picker"`: a button beside search, an open book, with which each reader chooses **Scroll**, the chapter on one page, or **Pages**, as `"nested"`. Every reader starts on Scroll. The choice is kept in the reader's browser, for this book only: books on one `USER.github.io` don't share it. A choice made in one tab reaches the reader's other open tabs at their next page.

It's done in the reader's browser. The book is built the same in every layout, one page per chapter, so its addresses, search, the link check and `print.html` are the same in all four, a switch of `LAYOUT` breaks no link or bookmark, and printing a page prints the whole chapter whatever the screen shows.

A section starts at a heading straight in the chapter. One inside a list, a quote or an HTML element such as `<details>` stays in the section around it, and so does one written in HTML without an `id` (`<h2>…</h2>`), which mdBook gives no anchor; written with one (`<h2 id="setup">…</h2>`), it starts a section, but the sidebar doesn't list it. An H1 after the chapter's first starts no section. What comes before the first heading is the first section; when that's only the title (the H1, a subtitle, the `Last updated` line), with nothing else but rules, empty anchors, an `mdb-wide` marker, or a `<style>`, `<script>` or `<link>`, it joins the section after it. An empty anchor kept just above a heading (`<a id="old-name"></a>`, or the older `<a name="old-name"></a>`) goes with the heading.

One section at a time, with `"h2"`, `"nested"`, or Pages:

- The arrows at the sides of the page, or at its foot on a narrow window, and the <kbd>←</kbd> and <kbd>→</kbd> keys turn to the next or the previous section; past a chapter's last section, to the next chapter's first, and back from a chapter's first, to the last section of the one before. Where mdBook draws no arrow (before the first chapter, after the last, or where the next chapter is unlisted), one is drawn while there's a section to turn to. mdBook's `?` popup says what the keys do.
- On a touch screen, the arrows turn the sections; a swipe doesn't. The sidebar's swipes work as before.
- The sidebar marks the section shown, with `"h2"` by its H2, and a first section with no H2 (H3s before the chapter's first H2) by none; in a chapter of one section, shown whole, the heading in view, as in Scroll. Its links, a search result, a link to an `#anchor` and Back each go to the section holding the place, and a search result's match is highlighted there.
- A section shows only the footnotes it cites, and those they cite in turn, and "Section 3 of 19" under it. The window's title names the section, from the second on.
- The `Last updated` line shows with the chapter's first section.
- The browser's own find (<kbd>Ctrl</kbd>+<kbd>F</kbd>) searches only the section shown, and a link to a passage of text (`#:~:text=` and the passage, as search engines make) opens the chapter's first section; one that also names the section the passage is in (`#beta:~:text=…`, as a browser's "Copy link to highlight" makes in Pages) opens that section at the passage.
- With `HEADING_NUMBERS=true`, each section's heading shows its number.

On a phone, `"picker"`'s button takes room from the book's title in the menu bar, which mdBook cuts short when it doesn't fit: with `THEME="picker"`, a repo and `OFFLINE` on, a phone 390px wide leaves the title about 110px with the button and 146px without.

## Read offline

`OFFLINE` lets readers keep the book on their own devices, through one button in the menu bar, beside print.

- `"full"` (default): the button's panel offers both, one under the other, each a big button with a line under it saying what it's for: **Save for offline** keeps the book in the reader's browser, on a computer or a phone, and updates it when they ask; **Download a copy** is a copy to keep on any computer, online or air-gapped, with its version, size and SHA-256 checksum.
- `"download"`: **Download a copy** alone.
- `"none"`: no button.

`./build` makes what the button offers, here and in the deploy. So the button shows on the published site, and on a local server after `./build`, where it offers only the download: saving needs the published site, over HTTPS. The preview doesn't have the button: it builds into `.preview/`, without what `./build` adds.

So the script's run serves `book/` beside the preview, on 127.0.0.1 at the first free port from 8000, and its last lines give the address: `book/ has it, as ./build left it, at http://127.0.0.1:8000`. Open it, and the cloud beside print opens the panel, with **Download a copy** alone. The page is the book as the run's `./build` made it, not as you edit it: `./build` refreshes it, then reload the page. Ctrl-C stops it with the preview. With `OFFLINE="none"` the run serves the preview alone.

To check the button without a run of the script (with the preview re-launched, say), serve `book/` yourself:

1. Open a second terminal if the preview holds the one you're in. (Or stop the preview there with Ctrl-C, and use that one.)
2. In the book's folder, run `./build`, then:

   ```bash
   python3 -I -m http.server -b 127.0.0.1 -d book 8000
   ```

   It prints `Serving HTTP on 127.0.0.1 port 8000 (http://127.0.0.1:8000/) ...` and keeps running, with a line for each file a browser asks for. `-I` makes Python use its own server even when the folder you're in has one named `http`. If it ends instead with `OSError: [Errno 98] Address already in use`, something else has port 8000, such as a run's own server for `book/`: put `8001` in its place, here and in the address below.
3. Open `http://127.0.0.1:8000`. The cloud beside print opens the panel, with **Download a copy** alone. Ctrl-C in that terminal stops the server, with `Keyboard interrupt received, exiting.`

**Saving.** Before a save, the panel shows **Save for offline**, and under it the version on the site, its build date and its size. Once the book is saved, its pages come from the saved copy, online or offline, with everything they load from the book's own site, so a reader never gets parts of two versions. Pictures, videos or scripts a page loads from another site aren't saved, here or in the download. When the site has a newer version, a dot appears on the button, and the panel shows the saved version and the latest, how many versions behind the saved one is, how many pages changed, were added and were removed, and how much there is to download, with **Update to v13** and **Remove saved copy**, and each page the saved copy serves says so above its text: `You're reading your saved copy, v12. v13 is out: update it from the ✓ above.` Remove is offered only while the site answers: a reader who is offline, or on a network that can't reach the site, keeps the copy they're reading. A site that no longer has the book still answers, so its copy can be removed too. An update fetches only the files that changed, checks every file against the site's checksums, and only then switches to the new copy, in one step; an update that fails or is interrupted leaves the saved copy as it was. Nothing downloads or changes until the reader presses a button: each page only reads the site's version file, to see whether a newer version is out. The icon shows where things stand: a cloud before a save, a tick once saved, a plane while offline.

**Versions.** A version is a commit that changed what the book is built from: `src/`, `theme/`, `book.toml`, the workflow (it pins the releases the build uses, so a re-run that takes another one changes it) and the script-owned files beside them, not `README.md`. v12 is the twelfth. Its date is that commit's time. A commit that changes nothing on the site leaves a saved copy up to date. This count is the offline button's own: the version in the sidebar footer is the git tag (see "The version line"), a different number. A file a chapter includes from outside `src/` (`\{{#include ../examples/a.rs}}`) isn't counted: a change to it alone changes the site within a version, so keep such files under `src/` (mdBook also publishes any that aren't Markdown).

**Browsers.** A save asks the browser to keep the copy even when the device runs short of space: Firefox asks the reader, Chrome and Safari decide on their own. Safari, on an iPhone, an iPad or a Mac, deletes what a site saved after seven days of Safari use in which the reader didn't use the site. A book added to the Home Screen of an iPhone or iPad is a web app with storage of its own, which counts only its own days of use; the panel tells readers to add the book there first and save it from there.

**The download.** One file in `offline/`, named for `BOOK_NAME` and the version, with a `.sha256` file beside it: `mybook-v12.zip`, the whole book in a folder, to keep on any computer, online or air-gapped, with a `README.txt` saying to open `index.html`, how to check the download's checksum on Linux, macOS and Windows, and where newer versions are. It opens from disk in a browser, search included. The fonts are inside its stylesheets, and with `SIDEBAR_MASTHEAD="image"` so is the logo: Firefox won't load a font from a folder above a page opened from disk, and Chromium and WebKit won't load a mask image into one at all. A link to a folder of the book (`[Setup](setup/)`) points at the folder's `index.html`, the page the site serves for it: as written, it would show the folder's files from disk. Its stamp is its version's, that commit's time and SHA with no tag, so rebuilt from the same version on the same system it comes out the same to the byte. Inside it, the button shows which version it is, its build date, and the site's address for newer versions (from `GIT_REPO_URL`).

Apart from the file names, which `README.txt`'s checksum commands use too, what readers see never names the format: the panel calls it a copy to keep on any computer, online or air-gapped, and says to unpack it and open `index.html` in the folder it makes. It's for a computer: on a phone, readers save the book in the browser.

**Turning it off.** In every mode the site carries `sw.js`. Outside `"full"` it's a worker that deletes a saved copy and then itself, so a reader who saved the book gets the site's pages again on their next visit online, with nothing left behind.

**What it adds.** To the project: `offline.py`, run by `./build` in every mode, and in `"full"` a manifest line in `theme/head.hbs`. To the site, besides `sw.js`: `version.json` (the version, its date, the version history and the download's checksum, and in `"full"` every file's size and SHA-256), and `offline/` (the download and its `.sha256` file). A file of yours in `src/` by any of these names is written over, as is a `README.txt` at the top of `src/` in the laptop copy. In `"full"`, also `manifest.webmanifest`, so a book added to a home screen opens as an app of its own (on an iPhone or iPad, with its own storage: see "Browsers"). The app's icon is the favicon, `favicon.svg`, which a browser draws at any size; a book whose favicon is a PNG alone has none in the manifest, and Chromium-based browsers then don't offer to install it: they want an icon of 144 pixels or more. With `favicon.svg`, they take the book as an installable app from the first visit, before anything is saved, and offer to install it (on a computer, an install button in the address bar). And `book.toml` gets `hash-files = false`: mdBook's fingerprinted file names (`version-1a2b3c4d.js`) put the deploy stamp and a hash of the search index into every page, so a download would change with every commit, and an update would fetch every page. Without them, a browser that cached a script or stylesheet just before a deploy can use it with the new pages until it next checks.

**Size.** GitHub Pages caps a published site at 1 GB, and the download adds the book once more, compressed where it compresses. Measured here, a 100-chapter text book grew from 12.1 MB to 15.0 MB, and a book of 100 photos from 32.9 MB to 63.6 MB: about twice, for pictures, which don't compress. GitHub also sets a soft limit of 100 GB a month on what a Pages site serves, and each download serves the book again, as does each save in a browser (an update fetches only what changed): at about 30 MB a copy, as for that photo book, 1,000 downloads or saves come to about 30 GB.

**Tools and time.** `offline.py` needs only Python's standard library. On the 100-chapter book, `./build` took about 2.6 seconds, against 1.7 without the download.

## Keyboard and links

`custom.js` adds:

- **`b`** toggles the sidebar (mdBook ships no key for it); the shortcut is listed in mdBook's own `?` help popup.
- **Swipes open and close the sidebar** on a touch screen: a quick swipe right that starts in the left quarter of the screen (300px at most) opens it, and a quick swipe left over the left 300px, where the sidebar is, closes it. Each has to go more across than up or down, so a flick to scroll that drifts sideways does neither. Not with two fingers, not from a code block, a table or a form field such as the search box, whether or not it's wide enough to scroll sideways, and not from anything open over the page: the offline panel, the theme menu (`THEME="picker"`), the layout menu (`LAYOUT="picker"`), a picture mdBook has zoomed (or the dimmed screen around it), or mdBook's `?` help popup. mdBook 0.5.4 has these swipes, but its code sets the `sidebar-visible` class and not the checkbox the sidebar's CSS reads, so the sidebar doesn't move; `custom.js` does the same through that checkbox. On a device with a touch screen `custom.css` also turns off Chromium's swipes back and forward through history on the book's pages (`overscroll-behavior-x`). Chromium takes a long sideways swipe, quick or slow, as one of those, a sidebar swipe included: without the rule, a long swipe right would go back, and a long swipe left would go forward when there's a page to go forward to. On a laptop with a touch screen that may stop its touchpad's swipes back and forward there as well. The Back and Forward buttons, <kbd>Alt</kbd>+<kbd>←</kbd> and <kbd>Alt</kbd>+<kbd>→</kbd>, and the phone's own edge gesture still work. See "On a phone."
- **Off-site links open in a new tab** (`target="_blank"` with `rel="noopener noreferrer"`); same-origin links are untouched.
- **A "back to the book" link on `print.html`**, and closing the print dialog returns you to the page you came from — mdBook auto-opens that dialog on the print page and cancelling otherwise strands you on the concatenated whole-book page.
- **Code blocks that overflow sideways become keyboard-scrollable** (`tabindex="0"`, so Tab reaches them; while one has focus, ← and → scroll it instead of turning the page, as they otherwise do in mdBook), and only those — a block that fits takes no tab stop. Re-checked whenever a block changes size, a window resize or a sidebar toggle, once the layout has settled.
- **One section at a time**, with `LAYOUT` at `"h2"`, `"nested"` or `"picker"` (in Pages): <kbd>←</kbd> and <kbd>→</kbd> turn the section first, and with `"picker"` a layout button sits beside search. See "Layout: a section at a time."
- **The offline button** beside print, and its panel, unless `OFFLINE` is `"none"`. See "Read offline."
- **With `THEME="picker"`, the theme menu holds Auto, Light and Dark**: the Rust, Coal and Navy rows are removed rather than hidden, so the arrow keys reach every row that remains. See "Light and dark."

## On a phone

How the book behaves on a phone, from mdBook 0.5.4's `book.js` and CSS, with the swipes `custom.js` adds:

- **Sidebar.** It starts closed on a window narrower than 1080px. The three bars open and close it, and so do swipes: a quick swipe right that starts in the left quarter of the screen opens it, and a quick swipe left across the sidebar closes it. A slow drag does neither, and neither does a flick that's more up or down than across, a swipe with two fingers, or one that starts on a code block, a table, the search box, an open menu or a zoomed picture. (mdBook 0.5.4's own swipes don't move the sidebar; `custom.js` makes them work. See "Keyboard and links.")
- **Chapter arrows.** On a window 1080px wide or less, they sit at the bottom of the page instead of at its sides; with the sidebar open, up to 1380px. One section at a time (`LAYOUT`), they turn the sections first; a swipe doesn't.
- **Back to the top.** Tapping the middle of the menu bar, where the book's name is, scrolls to the top; the icons on either side don't.
- **Menu bar.** It slides away as you scroll down and comes back when you scroll up. With the sidebar open, it stays.
- **Search.** Opening search the first time downloads the book's whole search index, which grows with the book (mdBook warns once it passes 10 MB). On a phone, over a slow connection, that's a wait before the first results.

The offline button works the same on a phone; its panel fits the screen.

### A page for readers

A chapter you can paste in to tell readers how to get around: save it as, say, `src/using-the-site.md` and list it in `SUMMARY.md`. mdBook draws each `<i class="fa…">` as its icon, the same ones the menu bar uses. As printed, it fits a book with a repo (`GIT_REPO_URL`) and `OFFLINE` left at `"full"`; adapt it to yours:

- Without a repo, drop the Pencil row, since there's no pencil, and end the Cloud row's last sentence at "which version you have": a downloaded copy shows the site's address only when the book knows its repo.
- With `OFFLINE="none"`, drop the Cloud row and the "Read offline" row.
- With `OFFLINE="download"`, make the Cloud row `**Download a copy** gives you a copy of the book to keep on any computer, online or air-gapped. In a downloaded copy, it shows which version you have and the address to get a newer one.` and drop the "Read offline" row: that table is about phones and tablets, and the download is for a computer.
- With `THEME="picker"`, move the Paintbrush row out of the comment at the end of the icon table, to sit second.
- With `LAYOUT` at `"h2"` or `"nested"`, in the Navigation section make "move you to the previous and next chapter" read "move you to the previous and next section, and past a chapter's last section to the next chapter", and in the table under "On a phone or tablet" make "Previous or next chapter" read "Previous or next section".
- With `LAYOUT="picker"`, add this row to the icon table after the Magnifying glass: `| <i class="fas fa-book-open"></i> Open book | Switches the layout: **Scroll** shows the whole chapter on one page, **Pages** one section at a time, turned by the arrow buttons and the <kbd>←</kbd> <kbd>→</kbd> keys. Your choice is remembered in this browser. |`; and in the Navigation section, after "move you to the previous and next chapter", add " (in Pages, the previous and next section first)".

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
| Read offline | Click the cloud, then **Save for offline** | Tap the cloud, then **Save for offline**; on an iPhone or iPad, add the book to your Home Screen first (in Safari: Share, then Add to Home Screen) and save it from there |

## Menu bar icons

| Icon | What it does |
|------|--------------|
| <i class="fas fa-bars"></i> Three bars | Opens and closes the sidebar. Same as <kbd>b</kbd>. |
| <i class="fas fa-magnifying-glass"></i> Magnifying glass | Opens the search bar. Same as <kbd>s</kbd> or <kbd>/</kbd>. |
| <i class="fas fa-pencil"></i> Pencil | Opens the source of this page on GitHub, so you can suggest a fix if you spot a mistake. |
| <i class="fas fa-print"></i> Printer | Lays the whole book out as one long page, for printing or saving as a PDF. To print only the page you're reading, press <kbd>Ctrl</kbd>+<kbd>p</kbd> (<kbd>⌘</kbd>+<kbd>p</kbd> on a Mac) instead. |
| <i class="fas fa-cloud-arrow-down"></i> Cloud | **Save for offline** keeps the book in this browser, to read without a connection. Once it's saved, the cloud becomes a tick, with a dot on it when a new version is out, and a plane while you're offline. **Download a copy** gives you a copy to keep on any computer, online or air-gapped. In a downloaded copy, it shows which version you have and the address to get a newer one. |
<!-- Theme button row, parked: the book shows the button only with
     THEME="picker" in bootstrap-mdbook.sh. With it, move this row up to
     sit second (after Three bars).
| <i class="fas fa-paintbrush"></i> Paintbrush | Switches the colours: **Auto** follows your device's light or dark setting, **Light** and **Dark** keep one. Your choice is remembered in this browser. |
-->

One icon lives outside the menu bar: hover over any code block and a <i class="fa fa-clipboard"></i> **copy** button appears at its top right. It copies the code exactly as written, ready to paste into the terminal.
```

The comment at the end of the icon table parks the theme button's row, which only a book with `THEME="picker"` shows: a comment between two rows would end the table there (see "Hiding part of a page"). The comment says to set `THEME` rather than unhide the button by hand, because without `"picker"` it wouldn't work: `theme/head.hbs` clears a saved theme on every page load, so the row's "remembered" would be false.

## The version line

The foot of the sidebar can show a build stamp reading `<version> · updated <when> · <sha>`, with the SHA linking to the commit on GitHub when the book knows its repo (`GIT_REPO_URL`, or an `origin` on github.com), and plain text otherwise. The `<when>` is relative — "3 hours ago", "yesterday", then the plain date once it is older than three days — with the exact time shown on hover; see "The last-updated line" for the formatter it shares with the per-page line. The time is the built commit's, not the build's, so rebuilding a commit stamps the same time and SHA; only the version can differ, when a tag has been added since. **This is stamped by the deploy workflow, into `version.js`, not by the script** — so:

- On a **local** `mdbook serve` / `build`, nothing stamps it and the line does not appear at all. That's expected; it's not a bug. (The fields are literal `__MDB_BUILD_*__` placeholders in `version.js` locally, and the JS shows a field only once it's been substituted.)
- On the **deployed** site, the updated time and short SHA always appear. The **version** is the git tag: `git describe --tags` names the tag on the built commit, or the nearest reachable tag plus a commit count — `v1.2` on the tagged commit, `v1.2+5` five commits later. So tagging once per release (not once per commit) still stamps a version on every build, and no build claims a tag it isn't.

To cut a release tag:

```bash
git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0
```

The workflow fires on tag pushes as well as branch pushes (`tags: ['v*']`), so the tag alone deploys and stamps, once step 4 of "Push to GitHub" lets tags deploy. Without that rule the tag's run builds, then stops at its deploy job with `Tag "v0.2.0" is not allowed to deploy to github-pages due to environment protection rules`, and the live site keeps its last build; add the rule, then re-run the failed job from the Actions tab. A repo with no tag yet shows just the date and commit; add the first tag and the version appears from then on.

## The last-updated line

Each chapter carries a **`Last updated <when>`** line under its title, set like a date line: italic, a little smaller than the text, and muted. It hangs under the title block's rule, before the text. The time is the chapter *source's* last commit, not the build's: the workflow runs `git log -1` over every file in `src/`, in UTC (`TZ=UTC … --date=format-local:%Y-%m-%dT%H:%M:%SZ`), so the pages don't carry your time zone's offset, and stamps the result into `version.js` as a `{"src/chapter.md":"<time>"}` object, and the page matches its own source against that object (via the edit link, falling back to the URL) and formats it. The home page is a copy of the first chapter and finds its source only through the edit link, so it carries the line only when the book knows its repo. One section at a time (`LAYOUT`), it shows with the chapter's first section.

Like the footer, it is **relative** — rendered by one shared formatter: under an hour reads "just now", then "N hours ago" for the rest of the same calendar day, then "yesterday", "two days ago", "three days ago", and from four days out the plain local date (`YYYY-MM-DD`). It is computed once at load — no ticking clock — and the element's `title` carries the exact ISO timestamp, so hovering shows the precision the words drop. A time in the future (clock skew) clamps to "just now".

It is a **deployed-site** feature, for the same reason the footer is: the dates come from git history the workflow has and a local build doesn't, so `mdbook serve` shows no line. `print.html` never carries one (it concatenates every chapter, so it has no single source), and a chapter the workflow couldn't resolve a date for simply shows nothing rather than a guess. Style it through `.content .mdb-updated` in `custom.css`.

## The link check

`./build`, in the book's folder, builds the book and then runs [lychee](https://github.com/lycheeverse/lychee) over it, and **stops on any broken internal link or `#anchor`**, listing each by the Markdown file and line it's written on. The script runs it before it opens the preview and stops there on a break; run it yourself before each push. The deploy workflow runs the same `./build`, so a break that slips through still stops the deploy rather than shipping, and the live site keeps its last good build.

```bash
./build
```

On a clean book it prints mdBook's three `INFO` lines, then `links: every internal link and anchor resolves`, and exits 0; unless `OFFLINE` is `"none"`, an `offline: …` line comes before it (see "Read offline"). When mdBook reports an error it stops after mdBook, with `stopped: mdBook reported an error, above.`: mdBook goes on past some errors and exits as if it hadn't, so an `{{#include}}` whose file isn't there (`ERROR Error updating "\{{#include missing.md}}"`) would otherwise go out as the directive's own text. mdBook reads such a directive anywhere in a chapter, in a code span or a code block too: to quote one, put a backslash before its opening braces, and mdBook drops the backslash and leaves the rest as written. On a broken one it prints the same `INFO` lines, then the breaks, and exits 1:

```text
src/chapter_1.md:165: #paragraph
    no such anchor on this page; did you mean #paragraphs?
src/chapter_1.md:165: ./gone.md
    there's no src/gone.md

stopped: 2 broken links or anchors, listed above. fix them, then run ./build again.
```

Each break takes two lines. The first says where the link is written: the file under `src/`, the line, and the link as you wrote it, so `src/chapter_1.md:165: ./gone.md` is line 165 of `chapter_1.md`. The second says what's wrong: no such page (or a chapter that isn't in `SUMMARY.md`), no such anchor on the page it points to, a link that climbs out of the book, or a chapter's `.md` named in a `src` written in HTML (mdBook writes `.html` for `.md` in a Markdown link or picture and in an `<a href>`, but not in the `src` of an `<img>` or an `<iframe>` written in HTML). For an anchor, `did you mean` names a heading on that page whose anchor shares most of its words, when one does. A link that comes from another file through mdBook's include directive is listed under the chapter that includes it, with no line number. A link is found on its line however it writes its address, each character other than a letter or a digit as itself or percent-encoded (`my notes.md` or `my%20notes.md`, `café.md` or `caf%C3%A9.md`), in a folder's name or an anchor as in a page's, and only where it leads to the page or anchor that's missing, not to another page of that name in another folder. One written with a backslash escape or an HTML entity (`notes\(old\).md`, `AT&amp;T.html`), or with a bracket or a parenthesis in a folder's name in a Markdown link not written `<…>`, is listed under its file with no line number. If lychee itself fails, `./build` shows lychee's own output instead. If `./build` says `bin/mdbook is missing` or `bin/lychee is missing`, run the script: it installs both. If it says `offline.py is missing`, run the script and commit the file it writes.

The check is offline: it tests the book's own pages and anchors and does **not** fetch outside addresses, so a dead link to another site doesn't stop it. `print.html` (every chapter again) and `404.html` (its `<base href>` points at the live site) are skipped as inputs; links *to* them are still checked. The usual causes of a break are a renamed or deleted chapter still linked from another, a `#anchor` whose heading text changed (mdBook makes the id from the heading's words), or a relative path that works on disk but not once mdBook has laid out the site.

lychee is looked up and pinned like mdBook (see "Releases and updates"): the script installs its newest release that has been out a week into `bin/`, and the workflow installs the same bytes, each checked against the pinned digest first. `./build` reads lychee's report, so after a run that moves lychee to a newer release (the run's `releases:` line names it), break a link on purpose and check that `./build` still lists it by file and line. If `./build` shows lychee's own output instead, that release changed how lychee works. To go back to the one you had, put back the workflow from your last good commit and run with `KEEP_PINS=true` (see "Releases and updates"): the run that moved lychee has already rewritten the workflow, so `KEEP_PINS` alone would keep the new one.

## What a push publishes

The repo is public (Pages needs it to be, on a free plan), and so is everything in it: every file, and every commit with its details. Four things there can say who you are:

- **Commits and tags.** Each carries a name and an email, git's `user.name` and `user.email`, and its time with your time zone's offset (`+0530`); a commit's `.patch` page on GitHub shows all three. Set both before the first run (`git config --global user.name …`, `git config --global user.email …`): the script makes the first commit only with an identity you've set, so git can't fill in one it made up from your account's full name and your machine's name, and makes it in UTC (`+0000`), unless `GIT_AUTHOR_DATE` or `GIT_COMMITTER_DATE` gives its time with another offset, which the run then names (`with the offsets +0530 (author) and +0000 (committer)`). It prints the name and address it used, and the committer's too when that's someone else, as git's `author.*` and `committer.*` settings or its `GIT_AUTHOR_*` and `GIT_COMMITTER_*` variables can make it; without both set, it makes none, and says how to make it once they are. GitHub gives you a private address for this, `ID+USERNAME@users.noreply.github.com`: Settings → Emails → **Keep my email addresses private** shows it. To make your own commits and tags in UTC too, add `alias git='TZ=UTC git'` to `~/.bashrc`. UTC hides the offset, not the hours: commit times across weeks still show when you work. Before the first push, `git log --format='%an <%ae> %ad, committed by %cn <%ce> %cd'` lists what each commit says; to redo the first commit under another name, set `user.name` and `user.email`, and unset any `author.name`, `author.email`, `committer.name` or `committer.email` setting and any `GIT_AUTHOR_*` or `GIT_COMMITTER_*` variable, which git takes before them, and for the `_DATE` ones before the clock (`git config --show-origin --get-regexp '^(author|committer)\.'` lists those settings and the file each is in, and prints nothing when there are none); then run `TZ=UTC git commit --amend --reset-author --no-edit`, which changes its author and its committer both.
- **Your GitHub account.** Its name is in the site's address (`USER.github.io`) and in every link to the repo: the pencil, the footer's commit link, `README.md`, the laptop copy's `README.txt`. A custom domain doesn't hide it while those links point at the repo. Only a separate account, with its own email and SSH key, keeps a book apart from your own.
- **`BOOK_AUTHOR`.** It goes into `book.toml`, in the repo. No page shows it: mdBook 0.5.4's pages don't use it.
- **Files you add to `src/`.** They're published byte for byte, on the site and in the download. A photo can carry where it was taken, the camera's serial number, and its time with your offset: `exiftool -all= -overwrite_original FILE` (package `libimage-exiftool-perl`) takes all of that out. An SVG from a drawing program can carry your name and paths from your machine: `scour --remove-metadata --enable-comment-stripping -i in.svg -o out.svg` (package `scour`) takes those out and keeps the `prefers-color-scheme` style "The favicon" asks for.

The pages' `Last updated` times are in UTC, whatever offset your commits have, and so are the footer's and the download's.

## Push to GitHub

One time:

1. Create an **empty** repo on GitHub — no README, `.gitignore`, or license. An auto-initialized repo makes your first push a non-fast-forward, and it'll be rejected.
2. Push. If you set `GIT_REPO_URL` before running, `origin` (SSH) is already set, so just:

   ```bash
   git push -u origin main
   ```

   (use your `DEPLOY_BRANCH` if you changed it). If you left `GIT_REPO_URL` empty, add the remote first — `git remote add origin git@github.com:user/repo.git` — then re-run the script and commit, so the book picks the repo up from `origin` (the pencil, `site-url` and the footer's commit link; see `GIT_REPO_URL` under "The toggles").
3. **Enable Pages once, by hand:** Settings → Pages → Source → **GitHub Actions**. The workflow does *not* enable Pages for you (it can't: enabling Pages takes a token with more access than a workflow's own, which this script won't ask you to store).
4. **Let release tags deploy, once:** Settings → Environments → **github-pages**. GitHub limits that environment to your default branch, so it lists one rule, `main` (or your `DEPLOY_BRANCH`). Click **Add deployment branch or tag rule**, set Ref type to **Tag**, enter `v*`, and click **Add rule**. If it says **No restriction** instead, there's nothing to add. The workflow can't do this for you either: changing an environment's rules takes administration access to the repo, which a workflow's token can't be given.

After these two settings, every push to `main` (or your `DEPLOY_BRANCH`) and every `v*` tag deploys automatically.

The workflow runs with least-privilege tokens: the build job's can only read the repo (`contents: read`), and only the deploy job's can publish (`pages: write` and `id-token: write`), so no other repo permission changes are needed. Pages itself requires a **public** repo, or a paid plan for a **private** one; an org-owned repo also needs Pages allowed by org policy.

After setup, every change: edit → `./build` → `git add -A` → `git commit` → `git push`, and the workflow rebuilds and publishes. To rebuild without a content change: Actions → the workflow → **Run workflow**. Your site is at `https://USER.github.io/REPO/` — the link in your README.

**Custom domain:** set it in Settings → Pages → Custom domain (the first-party deploy honours it), or commit a `CNAME` file into `src/` (mdBook copies non-markdown files from `src/` to the site root verbatim).

## Releases and updates

The script names no release. Each run asks GitHub for the newest stable release of mdBook, of lychee (the link checker `./build` runs) and of the workflow's three actions (`actions/checkout`, `actions/upload-pages-artifact` and `actions/deploy-pages`), and with `HEADING_NUMBERS=true` asks crates.io for `mdbook-numbering`'s newest version. It takes a release only once it has been out a week (`RELEASE_WAIT_DAYS`, near the top of the script), and for mdBook and lychee only once the file it downloads has been up that long: most hijacked releases are found and pulled within a week, so the wait keeps one off your machine and out of your deploys, with one gap: what an action runs is the commit its tag names on the day of the run, and a tag can be moved to another commit long after its release came out, with no new release. A run refuses a moved tag only where the workflow already pins it (below); a tag it doesn't pin yet, as on a first run, is taken as the run finds it. Stable means a plain version number that GitHub doesn't mark as a pre-release or a draft; newest means the highest number, not the latest date, so a fix to an older series doesn't win over a newer series.

mdBook is held to its 0.5 series: the theme and `custom.js` are written for 0.5's pages. Once a newer series is out, the run says so and goes on with the newest 0.5 (`mdBook v0.6.0 is out, but this script's theme and scripts are written for mdBook 0.5: using v0.5.4`); a later version of the script moves to the new series.

Then it pins what it took. mdBook's and lychee's downloads are checked against the SHA-256 digest GitHub computed when each file was uploaded, and that digest goes into the workflow with the version, where CI checks its own download against it, and into `bin/` beside the binary. A file uploaded before GitHub began computing digests, in June 2025, has none (mdBook v0.4.40's, for one): the run then checks the download against the workflow's digest when the workflow already pins that release, and otherwise pins the download's own and says so (`WARN: GitHub has no digest for …`). A digest in a form the script doesn't know (GitHub's are `sha256:` and 64 hexadecimal digits) stops the run before anything is downloaded, unless it's for the release the workflow pins, whose download is checked against the pin: `GitHub gives the digest of … in a form this script doesn't know, so the download can't be checked`; on a re-run, the message adds that `KEEP_PINS=true` keeps what the workflow pins till then. Each binary is run before it goes into `bin/`: they're the `gnu` Linux builds, which need a glibc with every symbol version they link (mdBook 0.5.4's needs 2.34, lychee 0.24.2's 2.39), and on an older system the run stops there, naming the glibc it needs, with that tool's binary in `bin/` as it was (see "Other platforms"). An action is pinned by the commit its release's tag names, with the release after it as a comment (`uses: actions/checkout@<commit> # v7.0.1`): a tag can be moved to another commit, and a commit can't change. `mdbook-numbering` is pinned by version: crates.io never changes a published version's files, and cargo checks them. Before it asks, the run says `looking up the newest releases on GitHub` (`on GitHub and crates.io` with `HEADING_NUMBERS=true`), so a slow network doesn't look like a hang; after, it prints what it took:

```text
releases: mdBook v0.5.4, lychee 0.24.2; v7.0.1, v5.0.0, v5.0.1 of the actions
```

No newer mdBook, lychee, `mdbook-numbering` or action reaches your published book until you re-run the script and push. The runner still moves with GitHub (`ubuntu-latest`). A re-run stops before it downloads or writes anything when something it pinned has changed since:

- **A release's file has changed.** GitHub's digest for the mdBook or lychee release the workflow pins isn't the pinned one, so the file was replaced after it was pinned: `GitHub's digest for mdBook v0.5.4 is …, but the workflow pins … for it`. Check the release's page on GitHub before trusting it. To go on, delete the line with the pinned digest, which the message names (`echo "…  mdbook.tar.gz"`, or `lychee.tar.gz`), from `.github/workflows/deploy.yml` and run the script again: the tool is then looked up as on a first run, and like any file the new one is taken once it has been up a week. Until the workflow that run writes is pushed, each deploy stops at the workflow's checksum check.
- **An action's tag has moved.** The tag the workflow pins for an action names another commit now: `actions/checkout's tag v7.0.1 now names commit …, but the workflow pins … for it`. Check the release's page; to go on, delete that action's `uses:` line from the workflow and run again: the action is then looked up as on a first run.

A release the workflow pins that GitHub no longer offers as a stable release out a week (pulled, marked a pre-release, its file removed, or its file uploaded again with the same bytes) isn't refused: the run takes the newest one that is. When that's older than the pinned one, the run says so (`WARN: the workflow pins mdBook v0.5.4, which GitHub doesn't offer now as a stable release out 7 days …`): if the pinned release was pulled or its file removed, the project's releases page or its security advisories on GitHub may say why. When a newer release has been out a week, the run moves to it without a WARN, as any re-run would. The same goes for an `mdbook-numbering` version yanked from crates.io. Until you re-run the script and push, each deploy fails if the mdBook or lychee release the workflow pins was pulled or its file removed, since CI can't download it, or if its `mdbook-numbering` version was yanked, since cargo won't install a yanked one. A run with `KEEP_PINS`, or with GitHub out of reach, doesn't ask about the pinned release, so one that has to download it (a fresh clone, or a workflow put back from an older commit) stops there if the release was pulled or its file removed (curl says `The requested URL returned error: 404`); a run that can ask GitHub, without `KEEP_PINS`, takes the newest that qualifies.

A newer release whose file isn't there, or was uploaded again less than a week ago, is passed over too, and the run says so (`WARN: mdBook vX.Y.Z is out, but has no mdbook-vX.Y.Z-x86_64-unknown-linux-gnu.tar.gz uploaded 7 days ago or more: using …`). A file uploaded again is taken once it has been up a week; for a release that names its files differently, the script needs the new name. A release whose archive is laid out differently stops the run after its download, before the workflow is rewritten (`no mdbook at the top of …`, `could not take lychee out of …`): when the book's own workflow pins another release of that tool, the message adds that `KEEP_PINS=true` keeps that one till a newer script knows the layout; on a first run, a clone's included, there's no way past it till then.

A download that doesn't match GitHub's digest stops the run too, before that tool is installed. The run installs mdBook, then lychee, then builds `mdbook-numbering`, and writes the workflow last, so when a later step fails, `bin/` can already hold a new mdBook (and lychee) while the workflow still pins the old ones, until a run gets through.

None of the script's own requests reads a config file, and none waits for ever: curl gives up after its time limits, `git ls-remote` when a transfer stalls for a minute, or within five minutes when a connection can't be set up. curl runs with `-q`, so `~/.curlrc` doesn't apply, and `git ls-remote` runs without git's system, global and repository config, so no setting there can turn its TLS checks off, send it to another address (`url.<base>.insteadOf`) or make it trust another certificate. Both still take the environment's proxy and certificate settings (not `GIT_SSL_NO_VERIFY`, which the script clears): behind a proxy, set `https_proxy`; behind one that inspects TLS, add its certificate to the system's certificate store, or name it in `CURL_CA_BUNDLE` for curl and `GIT_SSL_CAINFO` for git. A proxy or certificate named only in `~/.curlrc` or git's config doesn't reach them. A proxy that lets only listed hosts through needs `api.github.com`, `github.com` and `release-assets.githubusercontent.com` (with `HEADING_NUMBERS`, also the crates.io and Rust hosts "Run it" lists); curl reports a refusal there as `The requested URL returned error: 403`, the line GitHub's limit gives too.

GitHub answers 60 requests an hour from one address, and a run makes five, so behind an address many people share (an office, a VPN) the limit can run out: try again within the hour. No token is sent or needed, since everything the script asks is public. A re-run that can't ask GitHub keeps what the workflow pins and says so (`WARN: could not look up rust-lang/mdBook's releases (…): keeping mdBook v0.5.4, which the workflow pins`); a release the workflow doesn't pin, or pins without its digest (the line deleted after a refusal), stops the run, as on a first run, with nothing changed. Until the book has a commit, a run counts as a first run whatever the workflow pins: a clone's first run, whose workflow is the reference repo's, and a re-run after a first run that made no commit (no identity set). Without `KEEP_PINS` it keeps nothing the workflow pins, refuses nothing against it, and offers no `KEEP_PINS` way on. With `HEADING_NUMBERS`, crates.io out of reach works the same way for `mdbook-numbering`, so the first run with it on stops too.

- **Update:** re-run `bash bootstrap-mdbook.sh`. It looks the releases up again and re-pins the workflow, so a new release reaches your book once it has been out a week, at your next re-run and push. A re-run regenerates all script-owned files from the toggles, so use this only if you haven't hand-edited them.
- **Change a toggle without updating:** `KEEP_PINS=true bash bootstrap-mdbook.sh` installs and pins exactly what the workflow already pins, each download checked against the pinned digest, without asking GitHub about any of it; an action pinned by its commit alone, as v53 pinned them, is kept as it is, and one with a comment that isn't its release's tag (`# v7`) keeps its commit, written back without the comment (the `releases:` line names it `commit 3d3c42e5aac5`). It trusts the workflow as it is, checking no action's commit: use it on a workflow from your own commits, since a commit pinned there, even one from a fork, runs as the action. What the workflow doesn't pin yet is looked up as usual, and the run says so: `mdbook-numbering` when you turn `HEADING_NUMBERS` on (`KEEP_PINS: nothing to keep for mdbook-numbering in the workflow; looking it up`). A workflow pinning an mdBook outside the 0.5 series stops the run with nothing changed: run without `KEEP_PINS`. It's also the way back from a new release that breaks something, such as a lychee that `./build` can't run or actions that fail the deploy: put back the workflow from your last good commit, then run with `KEEP_PINS=true`. `git log --oneline -- .github/workflows/deploy.yml` lists the commits that changed the workflow, newest first, each as a short hash and its message; `git checkout HASH -- .github/workflows/deploy.yml`, with the hash of the last good one, puts that version back and prints nothing. The run's `releases:` line then ends `(KEEP_PINS: those the workflow pins, kept)`. A run without it takes the newest releases again, so keep adding it until a newer release, or this script's next version, fixes the break.
- **Keeping hand edits:** take a release by hand. From the release's page on GitHub (for lychee, a release tagged `lychee-v`, not `lychee-lib-v`), download the file ending `x86_64-unknown-linux-gnu.tar.gz`, check that its `sha256sum` is the digest GitHub shows beside it, take the binary out into `bin/` (`tar -xzf mdbook-*.tar.gz -C bin mdbook`; for lychee, `tar -xzf lychee-*.tar.gz -C bin --strip-components=1 lychee-x86_64-unknown-linux-gnu/lychee`), and set the version and the digest in the workflow's install step to match. An action's commit is the hash `git ls-remote https://github.com/actions/REPO refs/tags/TAG 'refs/tags/TAG^{}'` prints on its `^{}` line, or on its only line when there's no `^{}` one. Write the release's tag after the commit (`uses: actions/REPO@COMMIT # TAG`): a later run checks that the tag still names that commit.

## Other platforms

Linux x86_64 only, as shipped. Three places name the platform, and the digest check couples them: `install_mdbook`'s `triple="x86_64-unknown-linux-gnu"`, which names the file it downloads and installs as `bin/mdbook`; the file name `lookup_releases` asks GitHub about, whose digest the download is checked against and the workflow pins; and the workflow's install step, which downloads the Linux tarball (the runner, `ubuntu-latest`, is x86_64 Linux) and checks it against that digest with `sha256sum -c`. lychee is the same, in `install_lychee`, `lookup_releases` and the workflow.

They're the `gnu` builds, which use the system's glibc and need one with every symbol version they link: mdBook 0.5.4's needs 2.34, and lychee 0.24.2's 2.39, so Debian 12, with 2.36, can't run that lychee, and Ubuntu 24.04, with 2.39, can. Later releases can need newer. The run checks that each one runs before it goes into `bin/`, and on an older system it stops there (on a first run, before the book's git repository is made), naming the glibc it needs, with `bin/` keeping the binary it had: `lychee 0.24.2's Linux build needs glibc 2.39 or later, and this system has 2.36: it wasn't installed, and bin/ keeps the lychee it had, if any. Run this on a system with glibc 2.39 or later.` The way on is a newer system; the runner moves with GitHub. On a re-run where `bin/` still has the release the workflow pins, as the binary itself says, the message adds the other, if `KEEP_PINS` would keep that release (its digest pinned too, and for mdBook a 0.5 release): `KEEP_PINS=true keeps lychee …, which the workflow pins and bin/ has.` The downloads are unpacked and run in `bin/`, not in `/tmp`, and so are rustup's installer and, with `HEADING_NUMBERS`, cargo's build of `mdbook-numbering`, so a system that mounts `/tmp` without the right to run programs (`noexec`) installs them too. A book on a filesystem mounted that way stops the run at the first download, which says so: `mdBook v0.5.4 can't run from the book's bin/: the filesystem … is on doesn't allow running programs (it's mounted noexec)`. Put the book elsewhere, such as in your home folder.

So a triple can't be swapped on its own. Change `triple=` alone and the download fails its check (`… isn't the file it should be`), since it isn't the file whose digest the run looked up; change the file name in `lookup_releases` too and the run goes through, but pins the other platform's digest, which CI's check of the Linux tarball then fails. On another platform, install `bin/mdbook` and `bin/lychee` for the preview from that platform's tarballs by hand (see "Keeping hand edits" under "Releases and updates"), and keep the workflow's install steps at the Linux tarballs and their digests.

The real 0.5.4 asset triples, for a `bin/mdbook` installed by hand: Intel macOS `x86_64-apple-darwin`, Apple Silicon `aarch64-apple-darwin`, ARM Linux `aarch64-unknown-linux-musl` (musl, not gnu); Windows ships a `.zip` (`x86_64-pc-windows-msvc`). Always confirm the current spelling on the mdBook releases page.