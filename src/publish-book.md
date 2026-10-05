# Publish a book or knowledge base
<p class="mdb-subtitle">A minimal mdBook on GitHub Pages like this one</p>

The [bootstrap-mdbook script](./bootstrap-mdbook.md) scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. The published site has the usual mdBook furniture — left-sidebar table of contents, built-in search, print/PDF view — with no analytics or tracking. In its default (`fixed`) theme mode it also ships a reading theme: self-hosted Charter, a ~700px measure, a warm dark palette, hairlines under H1/H2, inked-and-underlined links, and a sidebar masthead that behaves like the menu bar. The theme is dark for every reader out of the box; set `LIGHT_THEME=true` to add the light counterpart and let each reader's browser preference choose.

It is a one-shot bootstrapper. It seeds the project once; after that you own the files and edit `src/` directly. Re-running is the *update* path (new mdBook release, changed toggles), and it regenerates the script-owned files — see "Re-running vs. hand edits."

Linux x86_64 only. For macOS or ARM, see "Other platforms" at the end.

## Three ways to set this up

There are three ways to build a site like this one. They differ only in how the files arrive; the result — the theme, the deploy workflow, the furniture — is identical.

1. **Clone the reference repo.** The fastest start: you get a working tree, and change the title, author, and repo rather than writing scaffolding.

   ```bash
   git clone REPLACE_WITH_REPO_URL mybook
   cd mybook
   ```

   Replace `REPLACE_WITH_REPO_URL` with the repository URL. One catch: a clone carries *that* repo's URL baked into `book.toml` (`site-url`, `git-repository-url`, `edit-url-template`), `README.md`, and `custom.js` (`MDB_REPO`), and its `origin` points at the reference repo. Repoint `origin` at *your own* empty repo, and update those repo values to yours — the simplest way is to run the script with your `GIT_REPO_URL` set (it regenerates exactly those files, in `PROJECT_DIR/BOOK_NAME`, so that path must be the clone; run the clone command above in `~/Desktop` and the defaults already match), or edit the four spots by hand. Fonts, tagging, and Pages are then the same as the paths below.

2. **Run the script.** The rest of this guide, from "Run it" on. Edit the toggles, run it once with no arguments, and it installs mdBook, writes every file, and opens a preview. Re-running is the update path.

3. **Build it by hand.** No script — install mdBook yourself and paste each file in. This is the whole process laid out file by file, so you can audit every line before it exists on disk, or adapt it. See "Build it by hand" near the end.

## Run it

1. Open `bootstrap-mdbook.sh` and edit the toggles at the top (below).
2. Run it with no arguments:

   ```bash
   bash bootstrap-mdbook.sh
   ```

Before the preview opens, the script runs `./build`, which builds the book and checks every link and anchor in it. If any is broken, the run stops there and lists them, with no preview (see "The link check"); fix them and run the script again. Otherwise the preview opens on a free local port the script picks and prints (`http://127.0.0.1:<port>`); Ctrl-C stops it. Re-launch it later, checking first, with:

```bash
cd <project> && ./build && ./bin/mdbook serve --open -n 127.0.0.1 -p <port>
```

To preview a book with known breaks anyway, run the `./bin/mdbook serve` part on its own. A second book alongside the first just needs a different `-p` port.

Before each push, run `./build` in the book's folder: the deploy runs the same check and stops on the same breaks.

Audit it first. Network-wise it fetches only from `github.com` (the mdBook and lychee release tarballs) and installs `curl` via `apt` if missing. Only when `HEADING_NUMBERS=true` does it additionally install `build-essential` and the Rust toolchain (via `rustup`) to compile the `mdbook-numbering` preprocessor; that path adds a few minutes to the first run.

## What it writes

Into the project folder (`PROJECT_DIR/BOOK_NAME`):

- `book.toml` — mdBook config, seeded from the toggles. **Script-owned.**
- `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md` — starter content, written only if `src/SUMMARY.md` doesn't already exist. **Yours** thereafter.
- `custom.css`, `custom.js` — the theme and behaviours. **Script-owned.**
- `theme/head.hbs` — written in `fixed` mode, and in `default` mode while `LIGHT_THEME` is false, with a different job in each (see "Light and dark in `default` mode"). **Script-owned.**
- `theme/fonts/fonts.css` — written in `fixed` mode. **Script-owned.**
- `theme/favicon.svg` — written from `src/logo.svg` if that exists, otherwise drawn from `FAVICON_TEXT` (any mode). **Script-owned while either source is set**; it is never deleted, only overwritten. See "The favicon."
- `README.md` — title, plus a live-site link if `GIT_REPO_URL` is set. **Script-owned.**
- `build` — the build and link check: `./build` builds the book and stops on any broken link or anchor, listing each by the file and line it's written on. The script runs it before the preview, and the deploy workflow runs the same file. **Script-owned.** If the book already has a `build` the script didn't write, the run stops before changing anything, so yours is never overwritten: move it aside (`mv build build.own`) and run again.
- `.github/workflows/deploy.yml` — the Pages deploy workflow; it also stamps the build/version/per-page dates and runs `./build` before deploying. **Script-owned.**
- `bin/mdbook` + `bin/.mdbook.sha256`, `bin/lychee` — the pinned binaries, and mdBook's digest. `bin/` is gitignored.
- `.gitignore` — ignores `bin/` and `book/`.

"Script-owned" means a re-run regenerates it and discards hand edits.

One path under `src/` is reserved rather than written: chapters you put in `src/unlisted/` **and list in `SUMMARY.md`** are published but kept off the sidebar, the arrow chain and the search index. See "Unlisted chapters."

## The toggles

Edit these at the top of the script.

- `PROJECT_DIR` — parent folder the book is created in (e.g. `$HOME/Desktop`). A leading `~` and relative paths are resolved for you.
- `BOOK_NAME` — the project folder's name, under `PROJECT_DIR` (default `mybook`). Readers never see it. ASCII letters, digits, `.`, `_` and `-` only, not starting with `.` or `-`: the characters GitHub allows in a repository name, so the folder and the repo can share a name, and nothing in it expands when you paste the `cd` line the script prints at the end. The repo's own name and the Pages URL still come from `GIT_REPO_URL`.
- `BOOK_TITLE` — the title readers see, written to `book.toml` and used for the masthead, the drawn favicon, `README.md` and the starter About page. Apostrophes, quotes and `/` are safe; it must not contain a newline. Change it and re-run, and the same book is retitled in place; `src/about.md`, being yours, keeps the title it was written with.
- `BOOK_AUTHOR` — author, written to `book.toml`.
- `DEPLOY_BRANCH` — git default branch, and the branch whose pushes trigger CI (default `main`).
- `HEADING_NUMBERS` — `true` adds automatic in-page heading numbers (H2–H6) via the `mdbook-numbering` preprocessor (pinned to `0.5.0`). This path also installs Rust and compiles the preprocessor. Default `false`.
- `SIDEBAR_NUMBERS` — `true` (default) shows mdBook's built-in sidebar chapter numbers (`1.`, `1.1.`); `false` hides them (`no-section-label`). Independent of `HEADING_NUMBERS`: that numbers headings *in the page*, this numbers chapters *in the sidebar*.
- `THEME_MODE` — `"fixed"` (default) writes the reading theme and hides the theme picker, so the reader has no in-page control over the theme. `"default"` leaves mdBook's stock theming and its picker in place, and writes none of the reading-theme CSS palette; with `LIGHT_THEME=false`, the default, the picker offers only the dark themes. (The value literally named `default` is deliberately not the default.)
- `LIGHT_THEME` — `false` (default) gives no reader a light theme, in either theme mode. In `fixed` mode the book is dark whatever the browser or OS is set to: only the dark palette is written, and `book.toml` pins both theme keys to `PREFERRED_DARK`. In `default` mode the same two keys are pinned and the picker offers only the dark themes. `true` in `fixed` mode writes the light palette as well, and the reader's `prefers-color-scheme` chooses between the two — their browser or OS setting is the only switch, since the picker stays hidden; `true` in `default` mode leaves mdBook's stock picker as it ships. See "Light and dark" and "Light and dark in `default` mode."
- `PREFERRED_LIGHT` / `PREFERRED_DARK` — the light and dark themes. Defaults `light` and `ayu`. Both must be one of mdBook's five built-ins — `light`, `rust`, `coal`, `navy`, `ayu` — and `PREFERRED_DARK` must be one of the three dark ones, `coal`, `navy` or `ayu`; the script rejects anything else. `PREFERRED_DARK` is used in `fixed` mode, and in `default` mode while `LIGHT_THEME=false`. `PREFERRED_LIGHT` is used only in `fixed` mode with `LIGHT_THEME=true`.
- `GIT_REPO_URL` — your repo URL, e.g. `https://github.com/user/repo` (https github.com only; the script rejects other forms). Wires the edit (pencil) icon in the top bar, sets `site-url` (so the 404 page resolves its assets at any depth), fills the README's live-site link, and sets the git `origin` remote (converted to SSH) so your first push needs no manual `git remote add`. Left empty: the icon and `site-url` are omitted, and the README is just the title. No repo icon is written — see "The top-bar icons."
- `CODE_LINE_NUMBERS` — `true` (default) numbers language-fenced code blocks of ten lines or more. See "Code line numbers."
- `SIDEBAR_MASTHEAD` — `text` (default), `none`, or `image`. What fills the sidebar band opposite the menu bar. See "The sidebar masthead."
- `FAVICON_TEXT` — what `theme/favicon.svg` draws when there is no `src/logo.svg` to copy. `"auto"` (default) takes the first alphanumeric character of `BOOK_TITLE` (`m` for `mybook`); any other string is drawn as typed, first three characters, case preserved; `""` draws nothing and leaves mdBook's own bundled icon alone. `src/logo.svg` always wins. See "The favicon."

**Upgrading from v46 or earlier:** re-run, then commit the new `build`. The deploy runs the copy in the repo, so until it's committed a failed deploy still shows lychee's old report.

**Upgrading from v44 or earlier:** re-run, then commit the new `build` file along with the workflow. The workflow now runs `./build`, so a push without it fails the build step.

**Upgrading from v41 or earlier:** the folder used to be named for `BOOK_TITLE`; it is now `BOOK_NAME`. If your book's folder isn't `mybook`, set `BOOK_NAME` to the folder's name before the first v42 run. If that name has a space or another character `BOOK_NAME` refuses, stop the preview and rename the folder first (`mv "My Notes" my-notes`); git and the book are unaffected by the move. Skip this and the run doesn't find your book: it starts a fresh one in `PROJECT_DIR/mybook`, or, if a book already lives there, regenerates that book's script-owned files from the wrong settings, and its `origin` too when `GIT_REPO_URL` is set (its `src/` survives). The run's output tells you which happened: an update prints `regenerated book.toml; src/ preserved`, a fresh start `wrote book.toml, src/SUMMARY.md, …`.

## Re-running vs. hand edits

A re-run re-resolves the current mdBook release, refreshes `bin/mdbook`, installs `bin/lychee` if it is missing or another version, re-pins the workflow, and regenerates every **script-owned** file above from the toggles, then runs `./build` before the preview and stops there on a broken link. Your `src/` is preserved (the starter content is only written when `src/SUMMARY.md` is absent). A re-run also clears `theme/head.hbs` and `theme/fonts/fonts.css` and writes back only what the current settings call for, so switching `THEME_MODE` or `LIGHT_THEME` never leaves a stale override behind — in particular, never a `fixed`-mode `head.hbs` in a `default`-mode book, where it would stop the picker remembering any choice. (Building by hand: on a switch to `default`, delete `theme/fonts/fonts.css`, and replace `theme/head.hbs` with the one in "Light and dark in `default` mode", or delete it too if you also set `LIGHT_THEME=true`.)

So: edit `src/` freely and re-run whenever you like. But **hand edits to `book.toml`, `custom.css`, `custom.js`, `build`, the workflow, or `README.md` do not survive a re-run.** Inside `theme/` the script touches exactly three files — `theme/head.hbs`, `theme/fonts/fonts.css` and `theme/favicon.svg` — and hand edits to those three go the same way; anything *else* you put in `theme/` (a `favicon.png`, an `index.hbs`, a `css/chrome.css` override) is left alone, run after run. To change a script-owned file, either change the toggle that drives it and re-run, or edit it and then don't re-run. To bump mdBook while keeping such hand edits, see "Update mdBook" (the manual path).

## The reading theme (fixed mode)

`THEME_MODE=fixed` writes `custom.css` carrying the whole reading theme, and `theme/head.hbs` + `theme/fonts/fonts.css`. What you get:

- **Charter**, self-hosted, if you supply the fonts (next section). Otherwise a Palatino/Noto/Liberation/Georgia serif fallback renders and no `@font-face` is emitted (so nothing 404s).
- **A ~700px measure** (`--content-max-width: 700px`) for a comfortable line length. Widen one page with `.mdb-wide`, or one block while the prose keeps its measure with `.mdb-bleed` (see "Wide pages and wide blocks").
- **A 60px menu bar** (mdBook ships 50px), giving a 24px serif title room to breathe above the body text that scrolls under it.
- **A full palette.** mdBook defines ~43 colour variables per theme; the script overrides every one that paints — not just the page and sidebar, but blockquotes, tables, the search UI, icons, the separator, and the code-block ground. Without this, the first table or blockquote on a page shows the stock theme's blues. With `LIGHT_THEME=true` the dark palette is the base and the light one is gated behind `prefers-color-scheme: light` — see "Why the dark palette comes first" below.
- **A sidebar that sits close to the page.** `--sidebar-bg` is about two points of CIELAB lightness off `--bg` in both modes: enough for the column to read as its own surface, little enough that the page reads as one tone rather than two panels. It does not match the blockquote/code ground, which is a heavier tint doing a different job. It cannot go to zero either — mdBook draws no border on `.sidebar`, so this tint is the only boundary the column has.
- **Hairlines under H1 and H2**, and the same weight/colour on a chapter's `---` rule and a `SUMMARY.md` `---` separator (mdBook draws those two differently by default).
- **Inked, underlined links** (mdBook's default is undecorated), including search results.
- **A repainted code-block ground.** mdBook paints code backgrounds from the highlight.js stylesheet, not a theme variable, so the palette can't reach it; the script repaints it (`--code-bg`) onto the same raised tint blockquotes use, leaving the syntax token colours untouched.
- **Inline code with a ground of its own.** mdBook paints none — it gives inline `<code>` padding and a radius and leaves the fill to whichever highlight sheet is live, which is off this palette either way. The script gives it a warm fill (`--inline-bg`), the theme's accent for the text, and a hairline drawn as an inset shadow so the pill's metrics don't shift.

`theme/head.hbs` clears any theme saved in `localStorage` before mdBook's theme script runs — necessary because the picker is hidden in `fixed` mode and every GitHub project site under one `user.github.io` shares one `localStorage` origin, so a theme chosen in some *other* book would otherwise pin this one.

`theme/fonts/fonts.css` deliberately declares no faces. Its mere presence makes mdBook emit *only* the fonts in `theme/fonts/` (none) instead of its built-in ten Open Sans and one Source Code Pro — which this theme doesn't use. Measured against 0.5.4 that drops ~493KB, taking a default book from ~887KB to ~394KB.

Note on testing dark mode: mdBook's "Auto" uses `PREFERRED_LIGHT`/`_DARK` for the reader's OS preference, but some Linux desktops don't report that preference to the browser. Test the switch with your browser's DevTools color-scheme emulation, not the OS toggle.

### Light and dark

Out of the box the book is dark for everyone. `LIGHT_THEME=true` turns on the second palette, and from then on the reader's own light/dark setting — the browser's, or the OS preference the browser reports — decides which one they see. There is no control in the page: the theme picker is hidden in `fixed` mode either way, because a picker plus a saved choice in `localStorage` is a third source of truth on top of those two.

The toggle changes two files together, and they have to move together:

- `custom.css` writes only the dark palette, under a selector naming just `PREFERRED_DARK`, with no `prefers-color-scheme: light` block under it.
- `book.toml` sets **both** `default-theme` and `preferred-dark-theme` to `PREFERRED_DARK`.

That second one is easy to read as tidying-up and isn't. mdBook picks the highlight.js stylesheet in JavaScript, from the theme *name* — `book.js` maps `ayu` to the ayu sheet, `coal`/`navy` to Tomorrow Night, and anything else to the light sheet. The CSS palette and the syntax colours are therefore selected by two different mechanisms, and only the theme name keeps them in step. Leave `default-theme = "light"` while writing a dark-only palette and every reader whose OS is set to light gets light syntax tokens on a near-black code block. Pinning both keys to the same name is what prevents that.

Testing it: use your browser's DevTools colour-scheme emulation rather than the OS toggle. Some Linux desktops don't report the preference to the browser at all, so the OS switch can look like it does nothing when the book is fine.

### Light and dark in `default` mode

`default` mode keeps mdBook's own themes and its picker. `LIGHT_THEME` reaches it too and means the same thing there: `false`, the default, gives no reader a light theme. Three pieces do it, and each one is needed.

**`book.toml` pins both theme keys** to `PREFERRED_DARK`, exactly as `fixed` mode does. mdBook bakes `default-theme` into the served `<html class>` and hands the two keys to its theme script as the light and dark defaults, so pinning both is what makes the picker's **Auto** resolve dark whatever the reader's OS is set to.

**`custom.js` removes the Light and Rust rows** from the picker. Removes, not hides. mdBook moves keyboard focus through the list by sibling — `li.nextElementSibling.querySelector('button').focus()` — and `focus()` on a `display:none` button silently does nothing. With the two rows merely hidden, ArrowDown from Auto goes nowhere, and a keyboard reader can never reach Coal, Navy or Ayu at all. Tested in Chromium with the picker markup and key handler taken verbatim from mdBook 0.5.4: hidden, ArrowDown from Auto stays on Auto; removed, it walks Auto → Coal → Navy → Ayu. It is the same reason `custom.js` removes, rather than hides, the prev/next links into `src/unlisted/`.

**`theme/head.hbs` clears a saved theme only if it names a light one.** A Light or Rust choice saved before the change — or by another book on the same `USER.github.io` origin — would otherwise still apply, because the inline script that sets the theme before the page paints trusts whatever it finds in `localStorage`. `head.hbs` runs from `<head>`, ahead of that script. A saved Coal, Navy or Ayu is left alone, so the picker still remembers a choice. That is the difference from `fixed` mode's `head.hbs`, which clears every saved theme because there is no picker to make one.

What remains is Auto, Coal, Navy and Ayu, and a choice among them sticks. `PREFERRED_DARK` has to be one of those three dark themes: the script refuses `light` or `rust` there, because pinning a book to a theme the picker then takes away is a contradiction. `LIGHT_THEME=true` in `default` mode writes none of this and leaves mdBook's stock picker exactly as it ships.

**Upgrading a `default`-mode book:** `LIGHT_THEME` defaults to `false`, so re-running v40 or later turns this on. Set `LIGHT_THEME=true` first if you want to keep the stock picker.

Building by hand, the three pieces are the two `book.toml` keys (both `PREFERRED_DARK`, as in step 3 of "Build it by hand"), this `theme/head.hbs`:

```handlebars
{{!-- Script-owned: a re-run rewrites it. Clears a saved light theme; the
     picker offers only the dark ones. --}}
<script>try{var t=localStorage.getItem('mdbook-theme');if(t==='light'||t==='rust')localStorage.removeItem('mdbook-theme');}catch(e){}</script>
```

and this block at the end of `custom.js`:

```javascript
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
```

No `theme/fonts/fonts.css` in `default` mode: it keeps mdBook's stock fonts.

### The top-bar icons

With `GIT_REPO_URL` set, the top bar carries a print icon and a pencil that opens the current page in GitHub's web editor (it auto-forks for readers without write access). It does **not** carry a repository icon, though mdBook offers one: the icon would sit beside the pencil and lead to the same repository the sidebar footer's commit link already reaches, and two icons to one destination is one too many.

The script leaves `git-repository-url` out of `book.toml` to drop it. mdBook gates the repo icon and the pencil on independent conditions in its template, so omitting that one key removes the repo icon and leaves the pencil untouched — no CSS hiding, nothing overridden. Add the key back by hand if you want the icon, but remember `book.toml` is script-owned: the next re-run regenerates it without.

### Why the dark palette comes first

This applies when `LIGHT_THEME=true`. Dark-only there is no swap at all — both `book.toml` keys name the dark theme, so the served class is already the right one — and the palette below collapses to a single class with no media query under it.

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

One consequence worth knowing: the light palette now applies **only** when the OS asks for light. If you were treating `html.light` as a theme you could force independently of the OS, that no longer holds — though the picker is hidden in `fixed` mode, so nothing in a shipped book could set it anyway.

### The print override needs the class too

`print.css` resets layout but not colour, and the browser drops backgrounds when printing — so without an override a reader whose OS is dark prints near-white ink onto white paper. The block at the end of `custom.css` forces ink-on-paper.

It has to name the theme classes to do it. A media query does not raise specificity, so `@media print{ html{…} }` is `(0,0,1)` and loses outright to the palette's `(0,1,1)`: it parses, it validates, and it silently never applies. Naming both classes ties it at `(0,1,1)`, and being last in the file wins it. If you hand-build this file, keep the selector as `html.light,html.ayu` — not `html`.

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

The fonts are only used in `fixed` mode.

## The sidebar masthead

`SIDEBAR_MASTHEAD` controls the band at the top of the sidebar, opposite the menu bar.

- **`text`** (default) — sets `BOOK_TITLE` there in the menu-bar title's own face, size, and baseline, left-aligned with the chapter list below it, and fades the menu-bar title out while the sidebar is showing so the name is never in two places at once. Needs no file: rename the book and the mark follows. (The title returns to the menu bar automatically when mdBook hides the sidebar — below 1080px, or on the `b` toggle — so the name is never nowhere.)
- **`none`** — nothing in the sidebar; the book title stays in the menu bar as mdBook ships it.
- **`image`** — masks `src/logo.svg` into the band, painted in the sidebar text colour so one file serves light and dark. Because it's painted, the mask is an *alpha* mask: supply a flat silhouette (a monogram) on a **transparent** ground, or the painted background masks the whole band solid. You must add `src/logo.svg`; the script warns if it's missing. The same file is also the favicon, which reads its fill rather than its alpha — see "The favicon."

In `text` and `image` mode the masthead is **sticky** at the top of the sidebar the way the menu bar is sticky at the top of the page, and grows the **same hairline** once the table of contents scrolls under it (bound to the same colour mdBook uses for the menu bar's own scrolled border, so the two lines match).

## The favicon

`theme/favicon.svg` has two sources, and it is written in *every* theme mode and *every* masthead mode — a `text` masthead and a favicon are different jobs, and they coexist. `src/logo.svg`, whenever it exists, is copied to it verbatim and always wins. Only when there is no `src/logo.svg` does `FAVICON_TEXT` come into it, and then the value is **drawn** as letters: ink on a transparent ground, no plate, `#191713` swapping to `#e8e6da` under `prefers-color-scheme: dark` — the two `--fg` values from the light and dark palettes. `"auto"`, the shipped default, takes the first alphanumeric character of `BOOK_TITLE`, so the stock `mybook` draws an `m` and renaming the book renames the mark. Any other string is drawn as typed, case preserved, cut to the first three characters with a warning if you gave it more. `""` draws nothing at all, and mdBook's own bundled favicon stays.

Both inks are written in every mode, a dark-only book included. The mark is drawn in the browser's tab bar, not on the page, and the tab bar follows the reader's browser or OS rather than the book, so a dark-only book still sits in a light tab bar for a reader whose system is light. Before v41 a dark-only book drew the pale ink alone, and in a light tab bar it all but vanished.

**A drawn favicon is not in Charter, and it cannot be.** A favicon is fetched as an *image*, and a browser gives an image no network of its own: `@font-face`, external stylesheets and external images are all blocked, and scripts do not run. So the four woff2 in `src/fonts/` are unreachable from inside that file, and naming Charter first in its stack only helps a reader who happens to have Charter installed as a *system* font. Everyone else gets the next face down — Palatino, Noto Serif, Liberation Serif, Georgia, a generic serif. This is the same limit that forces the `text` masthead to be CSS text rather than an SVG, and it has no workaround short of converting the letters to outlines, which would undo the one thing `"auto"` is for. What *does* work inside that sandbox is the `prefers-color-scheme` media query, because the `<style>` is part of the file rather than something fetched: mdBook's own bundled `favicon.svg` swaps its fill exactly this way.

If you supply `src/logo.svg` instead, **give it a `prefers-color-scheme` fill-swap of its own.** The same file is doing two unrelated jobs and they read it differently: the `image` masthead uses it as a CSS *mask*, so only its alpha matters and the sidebar paints the shape in `--sidebar-fg`; the favicon shows the file itself, so only its *fill* matters and nothing recolours it. A flat black silhouette therefore mastheads perfectly in both light and dark and then disappears into a dark browser tab. Put the swap in the file — a `<style>` block carrying `@media (prefers-color-scheme: dark){ … }` over your `fill` — and both jobs are served by the one asset, because the mask ignores the colour it can't see and the favicon uses it.

Either source **replaces mdBook's bundled `favicon.svg` and drops its `favicon.png` with it.** mdBook copies neither default once one of the pair is overridden, so the built site carries the SVG alone and the page emits a single `<link rel="icon">` where it otherwise emits two. That is fine in Chrome, Edge and Firefox, which all render SVG favicons; a client that does not is left with no icon rather than falling back, because there is no longer a PNG to fall back to. If that matters to you, put your own `theme/favicon.png` beside the SVG and mdBook will ship both — it drops a default only when you override exactly one of them.

Finally, `theme/favicon.svg` is script-owned but **never deleted** — only overwritten. Removing `src/logo.svg`, or setting `FAVICON_TEXT=""`, stops the file being *regenerated*; it does not remove the one already there, and the site goes on serving the last mark written. That is deliberate: a stale favicon does no harm beyond being out of date, and clearing it on every run would destroy a favicon a hand-built or hand-edited tree had put there, which no re-run could give back. To actually clear it, clear both sources and then delete `theme/favicon.svg` by hand.

## Subtitles

To hang a subtitle under a heading, put a marked paragraph on the line below it:

```markdown
# Chapter One
<p class="mdb-subtitle">A subtitle that explains what this chapter is about</p>

Body text starts here.
```

mdBook passes block-level HTML through verbatim, so the `<p>` renders as-is. The starter `chapter_1.md` includes one as an example (delete the line if you don't want it). It's styled in `fixed` mode only.

When the subtitle sits directly under an H1 or H2, the heading and its subtitle **share one hairline** instead of drawing two — the rule moves onto the subtitle and the heading's own rule is removed. A bare heading keeps its rule; an H3 (no rule of its own) and any other position get only the muted italic, no rule.

One caveat: **markdown syntax inside the `<p>` is not parsed.** `**bold**` stays literal. If a subtitle needs emphasis or a link, write it as HTML (`<em>`, `<a>`). (If you need markdown-in-subtitle often, a `<span class="mdb-subtitle">` on its own line *does* get its markdown parsed, but the span is inline and can't take the block rule directly — the `<p>` form is the default for that reason.)

## Code line numbers

With `CODE_LINE_NUMBERS=true` (default), a line-number gutter appears beside each code block that (a) had a language on its fence (```` ```bash ````, not a bare ```` ``` ````) and (b) is ten lines or longer. Shorter blocks, and auto-detected blocks with no language on the fence, are left unnumbered.

The gutter is a sibling `<div>` next to `<code>`, never inside it — so `<code>`'s DOM is exactly what mdBook rendered, and mdBook's copy button (which reads `code.innerText`) and a manual Ctrl+C both yield the exact source, numbers excluded. This replaced an earlier approach using the highlight.js line-numbers plugin, which rebuilt `<code>` as a table and corrupted copied text (a tab per line, a blank line per row).

Blocks with hidden lines (mdBook's lines prefixed by a hash plus a space, tucked behind the eye toggle) and `.playground` blocks are skipped by design.

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

The wrapped element goes to 1000px; every other top-level element on the page holds the measure, in exactly the position it would sit in on a page carrying no marker at all. That is the whole difference — `mdb-wide` moves the prose, `mdb-bleed` doesn't. Nothing about it is code-specific: a wide table, an image or a diagram takes the same wrapper.

Three things to get right:

- **Keep the blank lines inside the wrapper.** Without them the fence is read as raw HTML and renders as literal text, backticks and all. It is the one way to get this wrong, and it fails loudly, so you will see it on the page.
- **Keep the wrapper at the top level** of the chapter, not nested inside a list item or a blockquote. The rule reaches direct children of `<main>` only.
- **Don't put both markers on one page.** They aren't additive: `mdb-bleed`'s cap catches whatever `mdb-wide` widened, so the narrower instruction wins and `mdb-wide` ends up doing nothing.

Both are screen-only. The print view concatenates every chapter into a single `<main>`, so one marker anywhere would otherwise widen the whole printed book.

Neither is a cure for a genuinely long line. With the default fixed-mode type and a typical monospace face, a code block fits roughly 62 characters at the measure with the line-number gutter on and about 68 without; bled to 1000px that becomes roughly 92 and 98. Past that the block scrolls sideways — mdBook's own behaviour, and a cheap one, since a scrolling block neither breaks the layout nor pushes the page around. If you're pasting a script whose lines run past about 90 characters, rewrapping the source is the only thing that genuinely helps.

## Writing content

Chapters live in `src/*.md` and must be listed in `src/SUMMARY.md` — mdBook does **not** auto-discover files. In `SUMMARY.md`:

- A link with **no leading dash**, listed *before* the numbered list, is a **prefix chapter** — renders unnumbered, above the numbered chapters. The starter `about.md` is one.
- A link listed **after** the numbered list (same no-dash syntax) is a **suffix chapter** — unnumbered, below them. (The script doesn't create one; add your own, e.g. a changelog, if you want it.)
- A `---` line draws a **separator rule** in the sidebar.
- A `# Title` line draws a **part heading** in the sidebar.

Title and author are in `book.toml` `[book]`.

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

That last one is emitted only when `SUMMARY.md` already links into `unlisted/` — and it has to be, because mdBook **fails the build** on a `search.chapter` key that matches no chapter (``key `unlisted` does not match any chapter paths``). So the order is: add the chapter, list it, then re-run. Forget to re-run and the page is merely searchable, not broken. Building by hand, add the stanza yourself:

```toml
[output.html.search.chapter]
"unlisted" = { enable = false }
```

A sub-table ends the parent table, so it must be the last thing in `book.toml`.

Two limits, both worth knowing before you rely on this:

- **List unlisted chapters last.** They are suffix chapters, so they don't renumber anything, but the arrow chain is linear: put one in the middle of the book and the chapter before it loses its next arrow while the chapter after it loses its prev arrow, leaving a hole you have to click around.
- **`print.html` still contains them.** The print view is a flat concatenation of every chapter with no per-chapter element to select, so there is nothing to hide. Closing it would take a second marker convention in every unlisted page plus a rule that silently swallows the rest of the printed book whenever an unlisted chapter isn't last — not a trade worth making for a view you reach by explicitly asking for the whole thing.

And the plain fact underneath: none of this makes a page private. `src/` is in the repo, the repo is public (Pages needs it to be, on a free plan), and GitHub Pages serves the URL to anyone holding it. This is *unlisted* — off the contents, out of search, out of the arrow chain — not *hidden*.

The name is literal and reserved: `src/unlisted/` and nothing else. A directory merely *containing* the word is fine — `src/notunlisted/` is an ordinary chapter directory and stays fully visible.

## Keyboard and links

`custom.js` (loaded in every mode) adds:

- **`b`** toggles the sidebar (mdBook ships no key for it); the shortcut is listed in mdBook's own `?` help popup.
- **Off-site links open in a new tab** (`target="_blank"` with `rel="noopener noreferrer"`); same-origin links are untouched.
- **A "back to the book" link on `print.html`**, and closing the print dialog returns you to the page you came from — mdBook auto-opens that dialog on the print page and cancelling otherwise strands you on the concatenated whole-book page.
- **Code blocks that overflow sideways become keyboard-scrollable** (`tabindex="0"`, so Tab reaches them; while one has focus, ← and → scroll it instead of turning the page, as they otherwise do in mdBook), and only those — a block that fits takes no tab stop. Re-checked whenever a block changes size, a window resize or a sidebar toggle, once the layout has settled.
- **In `default` mode with `LIGHT_THEME=false`, the Light and Rust rows leave the theme picker** — removed rather than hidden, so the arrow keys still reach every row that remains. See "Light and dark in `default` mode."

## The version line

The foot of the sidebar can show a build stamp reading `<version> · updated <when> · <sha>`, with the SHA linking to the commit on GitHub. The `<when>` is relative — "3 hours ago", "yesterday", then the plain date once it is older than three days — with the exact build timestamp shown on hover; see "The last-updated line" for the formatter it shares with the per-page line. **This is stamped by the deploy workflow, not the script** — so:

- On a **local** `mdbook serve` / `build`, nothing stamps it and the line does not appear at all. That's expected; it's not a bug. (The fields are literal `__MDB_BUILD_*__` placeholders locally, and the JS shows a field only once it's been substituted.)
- On the **deployed** site, the updated time and short SHA always appear. The **version** is the git tag: `git describe --tags` names the tag on the built commit, or the nearest reachable tag plus a commit count — `v1.2` on the tagged commit, `v1.2+5` five commits later. So tagging once per release (not once per commit) still stamps a version on every build, and no build claims a tag it isn't.

To cut a release tag:

```bash
git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0
```

The workflow fires on tag pushes as well as branch pushes (`tags: ['v*']`), so the tag alone deploys and stamps. A repo with no tag yet shows just the date and commit; add the first tag and the version appears from then on.

## The last-updated line

Each chapter carries a small **`Last updated <when>`** line under its H1 (below the subtitle when there is one). The time is the chapter *source's* last commit, not the build's: the workflow runs `git log -1 --format=%aI` over every file in `src/` and stamps the result into `custom.js` as a `{"src/chapter.md":"<time>"}` object, and the page matches its own source against that object (via the edit link, falling back to the URL) and formats it.

Like the footer, it is **relative** — rendered by one shared formatter: under an hour reads "just now", then "N hours ago" for the rest of the same calendar day, then "yesterday", "two days ago", "three days ago", and from four days out the plain local date (`YYYY-MM-DD`). It is computed once at load — no ticking clock — and the element's `title` carries the exact ISO timestamp, so hovering shows the precision the words drop. A time in the future (clock skew) clamps to "just now".

It is a **deployed-site** feature, for the same reason the footer is: the dates come from git history the workflow has and a local build doesn't, so `mdbook serve` shows no line. `print.html` never carries one (it concatenates every chapter, so it has no single source), and a chapter the workflow couldn't resolve a date for simply shows nothing rather than a guess. Style it through `.content .mdb-updated` in `custom.css`.

## The link check

`./build`, in the book's folder, builds the book and then runs [lychee](https://github.com/lycheeverse/lychee) over it, and **stops on any broken internal link or `#anchor`**, listing each by the Markdown file and line it's written on. The script runs it before it opens the preview and stops there on a break; run it yourself before each push. The deploy workflow runs the same `./build`, so a break that slips through still stops the deploy rather than shipping, and the live site keeps its last good build.

```bash
./build
```

On a clean book it prints mdBook's three `INFO` lines, then `links: every internal link and anchor resolves`, and exits 0. On a broken one it prints the same `INFO` lines, then the breaks, and exits 1:

```text
src/chapter_1.md:165: #paragraph
    no such anchor on this page; did you mean #paragraphs?
src/chapter_1.md:165: ./gone.md
    there's no src/gone.md

stopped: 2 broken links or anchors, listed above. fix them, then run ./build again.
```

Each break takes two lines. The first says where the link is written: the file under `src/`, the line, and the link as you wrote it, so `src/chapter_1.md:165: ./gone.md` is line 165 of `chapter_1.md`. The second says what's wrong: no such page (or a chapter that isn't in `SUMMARY.md`), or no such anchor on the page it points to. For an anchor, `did you mean` names a heading on that page whose anchor shares most of its words, when one does. A link that comes from another file through mdBook's include directive is listed under the chapter that includes it, with no line number. If lychee itself fails, `./build` shows lychee's own output instead. If `./build` says `bin/mdbook is missing` or `bin/lychee is missing`, run the script: it installs both.

The check is offline: it tests the book's own pages and anchors and does **not** fetch outside addresses, so a dead link to another site doesn't stop it. `print.html` (every chapter again) and `404.html` (its `<base href>` points at the live site) are skipped as inputs; links *to* them are still checked. The usual causes of a break are a renamed or deleted chapter still linked from another, a `#anchor` whose heading text changed (mdBook makes the id from the heading's words), or a relative path that works on disk but not once mdBook has laid out the site.

lychee is pinned like mdBook: `LYCHEE_VERSION` and `LYCHEE_SHA256` near the top of the script name the release and its tarball's digest. The script installs it into `bin/` and the workflow installs the same bytes, each checked against that digest first. To move to a newer release, change both; the release publishes a `.sha256` beside the tarball. `./build` reads lychee's report, so then break a link on purpose and check that `./build` still lists it by file and line.

## Push to GitHub

One time:

1. Create an **empty** repo on GitHub — no README, `.gitignore`, or license. An auto-initialized repo makes your first push a non-fast-forward, and it'll be rejected.
2. Push. If you set `GIT_REPO_URL` before running, `origin` (SSH) is already set, so just:

   ```bash
   git push -u origin main
   ```

   (use your `DEPLOY_BRANCH` if you changed it). If you left `GIT_REPO_URL` empty, add the remote first: `git remote add origin git@github.com:user/repo.git`.
3. **Enable Pages once, by hand:** Settings → Pages → Source → **GitHub Actions**. The workflow does *not* enable Pages for you (it can't — `actions/configure-pages` can only enable Pages with a stored personal access token, which this script won't ask you to keep). This is the one manual step; after it, every push deploys automatically.

The workflow runs with a least-privilege token (`contents: read`, plus `pages: write` and `id-token: write` for the deploy), so no other repo permission changes are needed. Pages itself requires a **public** repo, or a paid plan for a **private** one; an org-owned repo also needs Pages allowed by org policy.

After setup, every change: edit → `./build` → `git add -A` → `git commit` → `git push`, and the workflow rebuilds and publishes. To rebuild without a content change: Actions → the workflow → **Run workflow**. Your site is at `https://USER.github.io/REPO/` — the link in your README.

**Custom domain:** set it in Settings → Pages → Custom domain (the first-party deploy honours it), or commit a `CNAME` file into `src/` (mdBook copies non-markdown files from `src/` to the site root verbatim).

## Update mdBook

The version is pinned, not floating — the deployed site always rebuilds with the exact release recorded in the workflow, and CI verifies the tarball's SHA-256 against the digest of the bytes installed locally (a version tag names a file, not its contents; the digest pins the contents). A new upstream release never changes your published book on its own.

- **Bump to the latest release:** re-run `bash bootstrap-mdbook.sh`. It re-resolves the current release, refreshes `bin/mdbook`, and re-pins the workflow. Because a re-run regenerates all script-owned files from the toggles, use this only if you haven't hand-edited them.
- **Bump while keeping hand edits:** download the target release tarball, drop its `mdbook` binary into `bin/mdbook`, and edit the version **and the digest** in the "Install mdBook …" step of `.github/workflows/deploy.yml` to match (`sha256sum` the tarball you downloaded).
- **Pin or downgrade** (if a new release breaks your build): edit the version tag in the workflow to the one you want, update `bin/mdbook` and the workflow digest to match.

The GitHub Actions themselves are pinned by commit SHA (not a moving tag) so a compromised action repo can't re-point them; bump those occasionally for security fixes by resolving a tag to its SHA with `git ls-remote https://github.com/actions/REPO refs/tags/TAG^{}`.

## Build it by hand

Everything the script does can be done by hand. Use this to audit each file before it exists on disk, to build where you'd rather not run the script, or as the reference for what each generated file *is*. Linux x86_64; the commands assume `bash`.

The files below are exactly what the script writes with its shipped defaults — `THEME_MODE=fixed`, `SIDEBAR_MASTHEAD=text`, `FAVICON_TEXT="auto"`, `CODE_LINE_NUMBERS=true`, `SIDEBAR_NUMBERS=true`, `HEADING_NUMBERS=false`, and no `GIT_REPO_URL` yet. Substitute your own title, author, and repo where flagged. For a different toggle (a logo masthead, heading numbers, default theme mode, sidebar numbers off), see that feature's section above and apply the same change here — the toggles compose the same way by hand as they do in the script.

### 1. Install mdBook and lychee (pinned)

Pin a release — both the version *and* its bytes. This guide pins `v0.5.4`; substitute the current release if you like, but pin whatever you pick. Make the project and drop the binary into `bin/` (gitignored below, so it is never committed):

```bash
mkdir -p ~/Desktop/mybook/bin && cd ~/Desktop/mybook
VER=v0.5.4
curl --fail -L -o mdbook.tar.gz \
  "https://github.com/rust-lang/mdBook/releases/download/$VER/mdbook-$VER-x86_64-unknown-linux-gnu.tar.gz"
sha256sum mdbook.tar.gz
tar -xzf mdbook.tar.gz -C bin mdbook
rm mdbook.tar.gz
./bin/mdbook --version
```

`sha256sum` prints a 64-character digest. **Copy it** — it goes verbatim into the deploy workflow (last file below), where CI re-downloads this exact tarball and refuses to build if the bytes differ. A version tag names a file, not its contents; the digest pins the contents. For `v0.5.4` the digest is `3f28de05dafca9d0f2eab99c662116b0e37b89b1d96a08f8f430b9eeae958cd7`; yours must equal whatever `sha256sum` printed for the tarball you actually downloaded. (mdBook ships no digest of its own, so it has to be computed from the download — the script does the same.)

Then lychee, the link checker `./build` runs (step 13). From the [lychee releases page](https://github.com/lycheeverse/lychee/releases), take the release the workflow pins (its "Install lychee" step names it; step 14), and download two files into the project folder: the one ending `x86_64-unknown-linux-gnu.tar.gz`, and the same name plus `.sha256`. Then:

```bash
sha256sum -c lychee-x86_64-unknown-linux-gnu.tar.gz.sha256
tar -xzf lychee-x86_64-unknown-linux-gnu.tar.gz -C bin --strip-components=1 lychee-x86_64-unknown-linux-gnu/lychee
rm lychee-x86_64-unknown-linux-gnu.tar.gz lychee-x86_64-unknown-linux-gnu.tar.gz.sha256
./bin/lychee --version
```

`sha256sum -c` prints `lychee-x86_64-unknown-linux-gnu.tar.gz: OK`; anything else is a bad download, so delete both files and fetch them again. `tar` and `rm` print nothing, and `--version` prints `lychee` and the version you took. The digest in the `.sha256` file is the one the workflow's lychee step checks.

### 2. The tree

From the project root:

```bash
mkdir -p src theme/fonts .github/workflows
```

The files to write, in order below: `book.toml`; `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md`; `theme/head.hbs`, `theme/fonts/fonts.css`, `theme/favicon.svg`; `custom.css`, `custom.js`; `.gitignore`; `README.md`; `build`; and `.github/workflows/deploy.yml`.

### 3. `book.toml`

mdBook's config. `additional-js`/`additional-css` wire in the two theme files; `default-theme`/`preferred-dark-theme` name the themes mdBook falls back to; both name the dark theme here, which is the dark-only setting in either theme mode. **Change** `title` and `authors` to yours — and note `title` also appears in three other files below (`src/about.md`, `README.md`, and the masthead line in `custom.css`).

```toml
[book]
title = "mybook"
authors = ["John Doe"]
src = "src"

[output.html]
additional-js = ["custom.js"]
additional-css = ["custom.css"]
default-theme = "ayu"
preferred-dark-theme = "ayu"
```

Both keys name the **dark** theme, and that is the dark-only setting, not a typo. mdBook selects the highlight.js stylesheet from the theme name in JavaScript, so a light name here would put light syntax colours on the dark code ground for every reader whose OS is light — see "Light and dark." For a book with both palettes, set `default-theme = "light"` instead and add the light block to `custom.css` (noted in step 9).

With a repo (recommended for a real deploy), append two more lines under `preferred-dark-theme` — the edit (pencil) icon in the menu bar, and `site-url` so the 404 page resolves its assets at any URL depth. `site-url` is `/REPO/` for a project site (`USER.github.io/REPO/`), or `/` for a user/org site (a repo literally named `USER.github.io`); `edit-url-template` must **not** prepend `src/` — mdBook already expands `{path}` to include it:

```toml
site-url = "/REPO/"
edit-url-template = "https://github.com/USER/REPO/edit/main/{path}"
```

There is deliberately no `git-repository-url` here — see "The top-bar icons." Add it if you want the repo icon; nothing else depends on it.

One more table goes here **only if** you have chapters under `src/unlisted/` — see "Unlisted chapters." A key matching no chapter fails the build, so don't add it speculatively; a sub-table ends the parent table, so when you do add it, it goes last in the file.

### 4. `src/SUMMARY.md`

The table of contents. mdBook does **not** auto-discover files — every chapter must be listed here. A no-dash link before the numbered list is a prefix (unnumbered, above); after it, a suffix. A `---` draws a sidebar separator; a `# Title` a part heading.

```markdown
# Summary

[About](./about.md)

- [Chapter 1](./chapter_1.md)
```

### 5. `src/about.md` and `src/chapter_1.md`

Your content — replace it freely; it only has to be listed in `SUMMARY.md`. `about.md` is the prefix chapter (**change** the title to match `book.toml`):

```markdown
# mybook

A short description of this book — what it covers, who it's for, and
how it's organized. Replace this placeholder with your own text.
```

For `chapter_1.md`, a minimal starter that builds and exercises the theme's three authored elements — a subtitle under the H1, an `<aside>` digression, and a language-fenced code block of ten-plus lines (which draws the line-number gutter):

````markdown
# Chapter 1
<p class="mdb-subtitle">An optional subtitle — delete this line if you don't want one</p>

Your first chapter. Anything mdBook's Markdown supports works here.

## A section

Body text.

<aside>An aside: a digression set apart from the main line. mdBook parses no Markdown
inside the tag, so write any emphasis or links as HTML.</aside>

A code block of ten or more language-fenced lines gets a line-number gutter:

```python
def demo(items):
    """Return the unique, stripped, sorted string forms."""
    out = []
    for x in items:
        if x is None:
            continue
        out.append(str(x).strip())
    if not out:
        raise ValueError("empty")
    return sorted(set(out))
```
````

The script instead seeds a longer demo chapter that exercises *every* styled element (all six heading levels, lists, blockquote, aside, admonitions, a table, and code blocks with and without the gutter). It is placeholder content you'd delete anyway; if you want it verbatim, copy it from the script's `render_chapter` function or the reference repo.

### 6. `theme/head.hbs`

This is the `fixed`-mode file; a `default`-mode book with `LIGHT_THEME=false` uses the one in "Light and dark in `default` mode" instead. mdBook merges `theme/` over its built-in front end. This clears any saved theme *before* mdBook's theme script runs — necessary because fixed mode hides the picker, and `localStorage` is shared across one `USER.github.io` origin, so a theme chosen in another book on that origin would otherwise pin this one.

```handlebars
{{!-- Script-owned: a re-run rewrites it. Clears a saved theme before mdBook's
     script reads it: the picker is hidden, and every site on one github.io
     origin shares localStorage. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
```

### 7. `theme/fonts/fonts.css`

Fixed mode only. It declares no faces on purpose: its mere presence makes mdBook emit only the fonts in `theme/fonts/` (none) instead of its built-in Open Sans and Source Code Pro (~493KB this theme doesn't use). Charter is declared in `custom.css`, not here — mdBook won't rewrite `url()` inside a `fonts.css` it didn't generate.

```css
/* Script-owned. Declares no faces: its presence stops mdBook shipping Open Sans
   and Source Code Pro. Charter is declared in custom.css. */
```

### 8. `theme/favicon.svg`

Written in every mode, unlike the two files above. The script has two sources for it: it copies `src/logo.svg` verbatim if that exists, and otherwise draws `FAVICON_TEXT`. By hand you just write the one you want. If you have a logo, copy it in and skip the rest of this section:

```bash
cp src/logo.svg theme/favicon.svg
```

Otherwise, the drawn form. **Change** the letter to yours — the script would take the first alphanumeric character of `BOOK_TITLE`, so `mybook` gives `m`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <style>
    text{font-family:"Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;font-weight:700;fill:#191713}
    @media (prefers-color-scheme: dark){text{fill:#e8e6da}}
  </style>
  <text x="50" y="75" text-anchor="middle" font-size="72">m</text>
</svg>
```

Two inks, even though the book is dark: the mark sits in the browser's tab bar, which follows the reader's browser or OS, not the book. See "The favicon."

For a two- or three-character mark, drop the size and raise the baseline together so the letters still fill the square: `font-size="50"` with `y="68"` for two, `font-size="36"` with `y="63"` for three. Those are the only three shapes the script produces. Escape any `&`, `<` or `>` in the letters (`&amp;`, `&lt;`, `&gt;`) — an SVG that isn't well-formed XML renders as nothing at all, not as a partial mark.

Read "The favicon" above before you rely on this: the letters will not be in Charter unless the reader has Charter installed as a system font, and supplying this file means mdBook stops shipping its `favicon.png` too.

### 9. `custom.css`

The reading theme. In brief, it: hides the theme picker; sets the serif stack, the ~700px measure, and a 60px menu bar; styles headings with hairlines under H1/H2, the subtitle, blockquotes, asides, and underlined links; defines the full light/dark **palette** (mdBook paints ~43 variables per theme — overriding only page and sidebar leaves tables, quotes, search, and icons in the stock blues); repaints the code-block ground (`--code-bg`), the inline-code pill (`--inline-bg`) and the comment token (`--code-comment`, so comments clear WCAG AA on the dark ground), all of which live in a highlight sheet the palette can't otherwise reach; forces ink-on-paper for print; holds the two columns' first lines level; draws the sidebar separator/part rules; styles the sidebar footer, the per-page last-updated line and the print-back link that `custom.js` injects; the text masthead; and the line-number gutter.

The palette is written for the theme name(s) in `book.toml`. Dark-only — the file below — that is one name, `ayu`, appearing twice: in the palette selector and again in the `@media print` selector. Rename the theme and you must rename both, or the palette applies to nothing.

For a book with both palettes, three things change together: `default-theme = "light"` in `book.toml`, both class names in each of those two selectors (`html.light,html.ayu`), and the light block added after the dark one. Read "Light and dark," "Why the dark palette comes first," and "The print override needs the class too" before touching any of it — the class names are load-bearing in a way the media queries make easy to misread. The light block is:

```css
@media (prefers-color-scheme: light){
html.light{
  --bg:#fdfcf7;--fg:#191713;--links:#191713;--inline-code-color:#b5540a;--inline-bg:#ece3cd;--inline-border:#e0d8c2;--muted:#57564e;
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
```

**Change** the masthead line `content:"mybook"` to your title (this is the one spot the title is hard-coded in CSS).

```css
/* Fixed theme: no picker. theme/head.hbs clears a saved theme. */
#mdbook-theme-toggle { display: none; }

/* No @font-face: the Charter woff2 aren't in src/fonts/. */

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
.content h1{font-size:3.4rem;line-height:1.18;margin:2.4rem 0 .4em;padding-bottom:.3em;border-bottom:1px solid var(--rule-strong);}
.content h2{font-size:2.5rem;line-height:1.18;margin:3rem 0 .85rem;padding-bottom:.3em;border-bottom:1px solid var(--rule-strong);}
.content h3{font-size:1.9rem;line-height:1.18;margin:2.25rem 0 .55rem;}

/* Subtitle: <p class="mdb-subtitle"> under a heading, below its rule. */
.content .mdb-subtitle{margin-block:0 0;font-size:1.9rem;font-style:italic;line-height:1.35;color:var(--muted);}
.content h1:has(+ .mdb-subtitle),.content h2:has(+ .mdb-subtitle){margin-block-end:.5rem;}

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

/* Underlined links (colour from --links), search results included. */
.content a,.content a:visited{text-decoration:underline;text-underline-offset:2px;}
#mdbook-searchresults a{text-decoration:underline;text-underline-offset:2px;}

/* Palette: every colour variable mdBook paints, not just page and sidebar;
   admonition accents left alone. With LIGHT_THEME=true the dark block names both
   classes and comes first, the light one follows behind its media query, so no
   light frame paints under a dark OS (guide: "Why the dark palette comes
   first"). The class in each selector is load-bearing: html alone loses to
   mdBook's .<theme>. --code-bg, --inline-bg and --code-comment are ours. */
html.ayu{
  --bg:#111;--fg:#e8e6da;--links:#e8e6da;--inline-code-color:#ffb454;--inline-bg:#2b281f;--inline-border:#3a382f;--muted:#aaa8a0;
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
  html.ayu{
       --bg:#fff;--fg:#111;--links:#111;--inline-code-color:#111;--inline-bg:#f5f5f5;--inline-border:#ddd;--muted:#444;
       --rule:#ccc;--rule-strong:#999;--quote-bg:#fff;--quote-border:#ccc;--code-bg:#f5f5f5;--code-comment:#555;
       --table-border-color:#ccc;--table-header-bg:#eee;--table-alternate-bg:#fff;}
}
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

/* The per-page "Last updated <when>" line custom.js inserts under the chapter H1. */
.content .mdb-updated{margin-block:.6rem 0;font-size:.75em;color:var(--muted,#999);}

.mdb-print-back{margin:0 0 2rem;font-size:.85em;}
@media print{.mdb-print-back{display:none;}}

@media screen{
  .content main:has(.mdb-wide,.mdb-bleed){max-width:1000px;}
  .content main:has(.mdb-bleed) > :not(.mdb-bleed){box-sizing:border-box;max-width:var(--content-max-width);margin-inline:auto;}
}
.sidebar .sidebar-scrollbox{padding-top:0;}
.sidebar-scrollbox::before{position:sticky;top:0;box-sizing:border-box;background-color:var(--sidebar-bg);border-block-end:1px solid transparent;}
.sidebar-scrollbox.mdb-scrolled::before{border-block-end-color:var(--table-border-color);}
.menu-title{transition:opacity .3s;}
html.sidebar-visible .menu-title{opacity:0;}
.sidebar-scrollbox::before{content:"mybook";display:block;height:calc(var(--menu-bar-height) + 1px);margin-block-end:var(--mdb-top-gap);font-size:2.7rem;font-weight:200;line-height:calc(var(--menu-bar-height) - 4px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
pre:has(> .mdb-gutter){display:flex;align-items:stretch;}
pre > .mdb-gutter{flex:0 0 auto;-webkit-user-select:none;user-select:none;white-space:pre;text-align:right;font-family:var(--mono-font);font-size:var(--code-font-size);padding:1rem .8em 1rem 1rem;background-color:var(--code-bg,transparent);color:var(--muted,#999);border-right:1px solid var(--rule,rgba(128,128,128,.25));}
pre > .mdb-gutter + code.hljs{flex:1 1 auto;min-width:0;padding-left:1em;}
@media print{
  pre:has(> .mdb-gutter){display:block;}
  pre > .mdb-gutter{display:none;}
  pre > .mdb-gutter + code.hljs{padding-left:1rem;}
}
```

### 10. `custom.js`

Loaded in every mode. It: makes `b` toggle the sidebar (and adds that key to mdBook's `?` help popup); opens off-site links in a new tab; adds the sticky-masthead hairline on scroll; builds the sidebar footer line (`<version> · updated <when> · <sha>`); inserts the per-page `Last updated <when>` line under each chapter's H1 (see "The last-updated line"); renders both those times relatively through one shared formatter (`mdbWhen` — "3 hours ago", "yesterday", then the plain date, with the exact timestamp on hover); adds a back link to `print.html` and returns you there after the print dialog closes; draws the code line-number gutter (a sibling of `<code>`, never inside it, so mdBook's copy button and Ctrl+C still yield the exact source); and gives a `tabindex="0"` to the code blocks that overflow sideways, and only those, re-checked whenever a block changes size, keeping ← and → for the focused block so they scroll it instead of turning the page. In `default` mode with `LIGHT_THEME=false` the script also appends the picker block from "Light and dark in `default` mode"; the file below is the `fixed`-mode one and does not carry it.

The top five `var`s are the only edit point. **Change** `MDB_REPO` to your repo URL if you have one (it's `""` with no repo, and links the footer SHA to the commit when set). The other four stay as placeholders the deploy workflow substitutes at build time — `MDB_VERSION`, `MDB_UPDATED`, `MDB_SHA`, and `MDB_PAGE_DATES` (a *quoted* `"__MDB_PAGE_DATES__"`, replaced with a `{"src/x.md":"<time>"}` object; quoted so the file still parses on a local build, where nothing stamps it and neither the footer line nor any per-page line appears).

````javascript
// Script-owned. MDB_REPO comes from GIT_REPO_URL; the deploy workflow stamps the
// other four. MDB_PAGE_DATES stays a quoted string until stamped, so an unstamped
// file still parses.
var MDB_REPO = "";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
var MDB_PAGE_DATES = "__MDB_PAGE_DATES__";
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
````

With a repo, the first `var` becomes:

```javascript
var MDB_REPO = "https://github.com/USER/REPO";
```

### 11. `.gitignore`

Keep the binary and the build output out of git:

```gitignore
bin/
book/
```

### 12. `README.md`

Repo-root readme. Without a repo it's just the title (**change** it to yours):

```markdown
# mybook
```

With a repo, add the live-site link (a project site is `USER.github.io/REPO/`):

```markdown
# mybook

Live site: <https://USER.github.io/REPO/>
```

### 13. `build`

The build and link check. `./build` builds the book, runs lychee over it, and stops on any broken link or anchor (see "The link check"). The deploy workflow runs this same file, so commit it with the rest. Make it executable once written: `chmod +x build`.

```bash
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
```

### 14. `.github/workflows/deploy.yml`

The first-party GitHub Pages deploy. The build job installs the **pinned** mdBook and lychee into `bin/`, verifies each tarball against its digest (step 1), stamps the version, build time, SHA and per-page dates into `custom.js`, runs `./build` (step 13: a broken link or anchor fails the job before anything deploys), and uploads the site; the deploy job publishes it. The actions are pinned by commit SHA (not a moving tag) so a compromised action repo can't re-point them, and both jobs run on a pinned `ubuntu-24.04` (not the moving `ubuntu-latest`) so a new runner image can't shift the build under you. **Change**, to match your setup: the mdBook version in the URL and the step name, the `sha256sum` digest (must equal *your* tarball's), and `main` (both the `branches:` trigger and, if you changed it, the default branch). `fetch-depth: 0` is required — the default fetches no tags, and the version stamp reads the tag on the built commit.

```yaml
name: Deploy mdBook to GitHub Pages

on:
  push:
    branches: [main]
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
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
        with:
          # Full history and tags: the stamp reads the tag.
          fetch-depth: 0

      - name: Install mdBook v0.5.4
        run: |
          set -euo pipefail
          base="https://github.com/rust-lang/mdBook/releases/download/v0.5.4/mdbook-v0.5.4-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "$base" -o mdbook.tar.gz
          # The digest the bootstrap recorded: a tag names a file, not its bytes.
          echo "3f28de05dafca9d0f2eab99c662116b0e37b89b1d96a08f8f430b9eeae958cd7  mdbook.tar.gz" | sha256sum -c -
          mkdir -p bin
          tar -xz -f mdbook.tar.gz --directory=bin

      - name: Install lychee 0.24.2
        run: |
          set -euo pipefail
          base="https://github.com/lycheeverse/lychee/releases/download/lychee-v0.24.2/lychee-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "$base" -o lychee.tar.gz
          # Pinned by version and sha256, recorded in the bootstrap script.
          echo "1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a  lychee.tar.gz" | sha256sum -c -
          tar -xz -f lychee.tar.gz --strip-components=1 \
            --directory=bin lychee-x86_64-unknown-linux-gnu/lychee

      - name: Stamp build metadata
        run: |
          set -euo pipefail
          # Version: the tag on this commit, or the nearest one plus a count
          # (v1.2+5); never --abbrev=0, which would claim the tag. Safe charset only.
          version=$(git describe --tags 2>/dev/null | sed -E 's/-([0-9]+)-g[0-9a-f]+$/+\1/' || true)
          version=${version//[^A-Za-z0-9._+-]/}
          # Each chapter source's last commit time, as {"src/x.md":"<time>"}; paths
          # outside a safe charset are skipped, so the sed splice stays safe.
          dates="{" sep=""
          while IFS= read -r -d '' f; do
            case "$f" in *.md) ;; *) continue ;; esac
            case "$f" in *[!A-Za-z0-9._/' '-]*)
              echo "page dates: skipping '$f' (character outside the safe set)"; continue ;;
            esac
            d=$(git log -1 --format=%aI -- "$f")
            [ -n "$d" ] || continue
            dates="$dates$sep\"$f\":\"$d\""
            sep=","
          done < <(git ls-files -z -- src)
          dates="$dates}"
          sed -i \
            -e "s|__MDB_BUILD_VERSION__|${version}|" \
            -e "s|__MDB_BUILD_DATE__|$(date -u +%Y-%m-%dT%H:%M:%SZ)|" \
            -e "s|__MDB_BUILD_SHA__|${GITHUB_SHA::7}|" \
            -e "s|\"__MDB_PAGE_DATES__\"|${dates}|" \
            custom.js

      - name: Build and check links
        # The ./build the author runs before a push: a broken link stops the deploy.
        run: bash ./build

      - name: Setup Pages
        uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d

      - name: Upload artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9
        with:
          path: ./book

  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128
```

### 15. Build and preview

```bash
git init -b main
./build
./bin/mdbook serve --open -n 127.0.0.1 -p 3000
```

`./build` ends with `links: every internal link and anchor resolves`. The preview opens at `http://127.0.0.1:3000` (Ctrl-C stops it). That's a working book. To publish it, follow "Push to GitHub" above — create an empty repo, push, and enable Pages once by hand (Settings → Pages → Source → GitHub Actions).

## Other platforms

Linux x86_64 only, as shipped. Two places name the platform, and they are coupled through the digest check:

- The local install uses a triple in `install_mdbook` (`triple="x86_64-unknown-linux-gnu"`) to build the tarball URL, installs that binary as `bin/mdbook`, **and records that tarball's SHA-256** as the digest pinned into the workflow.
- The workflow's install step downloads the `x86_64-unknown-linux-gnu` tarball (the runner is pinned to `ubuntu-24.04`) and checks it against that pinned digest with `sha256sum -c`.

On x86_64 Linux these are the same tarball, so the one recorded digest is correct for both. **Off x86_64 Linux they diverge:** if you change the local triple to, say, macOS, your preview binary is right but the digest recorded from the macOS tarball won't match the Linux tarball CI downloads, and the CI digest check fails. So on another platform you own the workflow's install step by hand: keep its triple at `x86_64-unknown-linux-gnu` (the runner's), and set its digest to the **Linux** tarball's `sha256sum` (compute it yourself), independent of whatever local triple you use for preview. lychee is the same: `install_lychee` fetches the `x86_64-unknown-linux-gnu` tarball and checks it against `LYCHEE_SHA256`, the Linux digest, so off x86_64 Linux install a local `bin/lychee` from that platform's tarball by hand and leave the workflow's at Linux.

The real 0.5.4 asset triples, for the local `bin/mdbook`: Intel macOS `x86_64-apple-darwin`, Apple Silicon `aarch64-apple-darwin`, ARM Linux `aarch64-unknown-linux-musl` (musl, not gnu). Windows ships a `.zip` (`x86_64-pc-windows-msvc`), so it needs more than a triple swap — the install code assumes a `.tar.gz`. Always confirm the current spelling on the mdBook releases page before pinning.