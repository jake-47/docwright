# Publish a book or knowledge base
<p class="mdb-subtitle">A minimal mdBook on GitHub Pages like this one</p>

The [bootstrap-mdbook script](./boostrap-mdbook.md) scaffolds an mdBook book, installs and version-pins the mdBook binary, writes a first-party GitHub Pages deploy workflow, and opens a live preview. The published site has the usual mdBook furniture — left-sidebar table of contents, built-in search, print/PDF view — with no analytics or tracking. In its default (`fixed`) theme mode it also ships a reading theme: self-hosted Charter, a ~700px measure, a warm dark palette, hairlines under H1/H2, inked-and-underlined links, and a sidebar masthead that behaves like the menu bar. The theme is dark for every reader out of the box; set `LIGHT_THEME=true` to add the light counterpart and let each reader's browser preference choose.

It is a one-shot bootstrapper. It seeds the project once; after that you own the files and edit `src/` directly. Re-running is the *update* path (new mdBook release, changed toggles), and it regenerates the script-owned files — see "Re-running vs. hand edits."

Linux x86_64 only. For macOS or ARM, see "Other platforms" at the end.

## Three ways to set this up

There are three ways to build a site like this one. They differ only in how the files arrive; the result — the theme, the deploy workflow, the furniture — is identical.

1. **Clone the reference repo.** The fastest start: you get a working tree; change the title, author, and repo rather than writing scaffolding.

   ```bash
   git clone REPLACE_WITH_REPO_URL mybook
   cd mybook
   ```

   Replace `REPLACE_WITH_REPO_URL` with the repository URL. One catch: a clone carries *that* repo's URL baked into `book.toml` (`site-url`, `git-repository-url`, `edit-url-template`), `README.md`, and `custom.js` (`MDB_REPO`), and its `origin` points at the reference repo. Repoint `origin` at *your own* empty repo, and update those repo values to yours — the simplest way is to run the script with your `GIT_REPO_URL` set (it regenerates exactly those files), or edit the four spots by hand. Fonts, tagging, and Pages are then the same as the paths below.

2. **Run the script.** The rest of this guide, from "Run it" on. Edit the toggles, run it once with no arguments, and it installs mdBook, writes every file, and opens a preview. Re-running is the update path.

3. **Build it by hand.** No script — install mdBook yourself and paste each file in. This is the whole process laid out file by file, so you can audit every line before it exists on disk, or adapt it. See "Build it by hand" near the end.

## Run it

1. Open `bootstrap-mdbook.sh` and edit the toggles at the top (below).
2. Run it with no arguments:

   ```bash
   bash bootstrap-mdbook.sh
   ```

The preview opens on a free local port the script picks and prints (`http://127.0.0.1:<port>`); Ctrl-C stops it. Re-launch later with:

```bash
cd <project> && ./bin/mdbook serve --open -n 127.0.0.1 -p <port>
```

A second book alongside the first just needs a different `-p` port.

Audit it first. Network-wise it fetches only from `github.com` (the mdBook release tarball) and installs `curl` via `apt` if missing. Only when `HEADING_NUMBERS=true` does it additionally install `build-essential` and the Rust toolchain (via `rustup`) to compile the `mdbook-numbering` preprocessor; that path adds a few minutes to the first run.

## What it writes

Into the project folder (`PROJECT_DIR/BOOK_TITLE`):

- `book.toml` — mdBook config, seeded from the toggles. **Script-owned.**
- `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md` — starter content, written only if `src/SUMMARY.md` doesn't already exist. **Yours** thereafter.
- `custom.css`, `custom.js` — the theme and behaviours. **Script-owned.**
- `theme/head.hbs`, `theme/fonts/fonts.css` — written in `fixed` mode. **Script-owned.**
- `theme/favicon.svg` — written from `src/logo.svg` if that exists, otherwise drawn from `FAVICON_TEXT` (any mode). **Script-owned while either source is set**; it is never deleted, only overwritten. See "The favicon."
- `README.md` — title, plus a live-site link if `GIT_REPO_URL` is set. **Script-owned.**
- `.github/workflows/deploy.yml` — the Pages deploy workflow. **Script-owned.**
- `bin/mdbook` + `bin/.mdbook.sha256` — the pinned binary and its digest. `bin/` is gitignored.
- `.gitignore` — ignores `bin/` and `book/`.

"Script-owned" means a re-run regenerates it and discards hand edits.

One path under `src/` is reserved rather than written: chapters you put in `src/unlisted/` **and list in `SUMMARY.md`** are published but kept off the sidebar, the arrow chain and the search index. See "Unlisted chapters."

## The toggles

Edit these at the top of the script.

- `PROJECT_DIR` — parent folder the book is created in (e.g. `$HOME/Desktop`). A leading `~` and relative paths are resolved for you.
- `BOOK_TITLE` — the book title *and* the project folder name, written to `book.toml`. Apostrophes and quotes are safe; it must not contain `/` or a newline.
- `BOOK_AUTHOR` — author, written to `book.toml`.
- `DEPLOY_BRANCH` — git default branch, and the branch whose pushes trigger CI (default `main`).
- `HEADING_NUMBERS` — `true` adds automatic in-page heading numbers (H2–H6) via the `mdbook-numbering` preprocessor (pinned to `0.5.0`). This path also installs Rust and compiles the preprocessor. Default `false`.
- `SIDEBAR_NUMBERS` — `true` (default) shows mdBook's built-in sidebar chapter numbers (`1.`, `1.1.`); `false` hides them (`no-section-label`). Independent of `HEADING_NUMBERS`: that numbers headings *in the page*, this numbers chapters *in the sidebar*.
- `THEME_MODE` — `"fixed"` (default) writes the reading theme and hides the theme picker, so the reader has no in-page control over the theme. `"default"` leaves mdBook's stock theming and its picker in place, and writes none of the reading-theme CSS palette. (The value literally named `default` is deliberately not the default.)
- `LIGHT_THEME` — `fixed` mode only. `false` (default) ships the book dark for every reader, whatever their browser or OS is set to: only the dark palette is written, and `book.toml` pins both theme keys to `PREFERRED_DARK`. `true` writes the light palette as well, and the reader's `prefers-color-scheme` chooses between the two — their browser or OS setting is the only switch, since the picker stays hidden either way. See "Light and dark."
- `PREFERRED_LIGHT` / `PREFERRED_DARK` — the light and dark themes in `fixed` mode. Defaults `light` and `ayu`. Must be one of mdBook's five built-ins: `light`, `rust`, `coal`, `navy`, `ayu` (the script rejects a typo here). Ignored in `default` mode; `PREFERRED_LIGHT` is also ignored when `LIGHT_THEME=false`.
- `GIT_REPO_URL` — your repo URL, e.g. `https://github.com/user/repo` (https github.com only; the script rejects other forms). Wires the edit (pencil) icon in the top bar, sets `site-url` (so the 404 page resolves its assets at any depth), fills the README's live-site link, and sets the git `origin` remote (converted to SSH) so your first push needs no manual `git remote add`. Left empty: the icon and `site-url` are omitted, and the README is just the title. No repo icon is written — see "The top-bar icons."ial
- `CODE_LINE_NUMBERS` — `true` (default) numbers language-fenced code blocks of ten lines or more. See "Code line numbers."
- `SIDEBAR_MASTHEAD` — `text` (default), `none`, or `image`. What fills the sidebar band opposite the menu bar. See "The sidebar masthead."
- `FAVICON_TEXT` — what `theme/favicon.svg` draws when there is no `src/logo.svg` to copy. `"auto"` (default) takes the first alphanumeric character of `BOOK_TITLE` (`m` for `mybook`); any other string is drawn as typed, first three characters, case preserved; `""` draws nothing and leaves mdBook's own bundled icon alone. `src/logo.svg` always wins. See "The favicon."

## Re-running vs. hand edits

A re-run re-resolves the current mdBook release, refreshes `bin/mdbook`, re-pins the workflow, and regenerates every **script-owned** file above from the toggles. Your `src/` is preserved (the starter content is only written when `src/SUMMARY.md` is absent). A re-run also *removes* the fixed-mode-only theme files (`theme/head.hbs`, `theme/fonts/fonts.css`) when `THEME_MODE` is `default`, so switching from `fixed` to `default` and re-running leaves no stale override that would keep the theme picker from remembering a choice. (Building by hand: delete those two files yourself when you switch to `default`.)

So: edit `src/` freely and re-run whenever you like. But **hand edits to `book.toml`, `custom.css`, `custom.js`, the workflow, or `README.md` do not survive a re-run.** Inside `theme/` the script touches exactly three files — `theme/head.hbs`, `theme/fonts/fonts.css` and `theme/favicon.svg` — and hand edits to those three go the same way; anything *else* you put in `theme/` (a `favicon.png`, an `index.hbs`, a `css/chrome.css` override) is left alone, run after run. To change a script-owned file, either change the toggle that drives it and re-run, or edit it and then don't re-run. To bump mdBook while keeping such hand edits, see "Update mdBook" (the manual path).

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

## The version line

The foot of the sidebar can show a build stamp reading `<version> · updated <date> · <sha>`, with the SHA linking to the commit on GitHub. **This is stamped by the deploy workflow, not the script** — so:

- On a **local** `mdbook serve` / `build`, nothing stamps it and the line does not appear at all. That's expected; it's not a bug. (The three fields are literal `__MDB_BUILD_*__` placeholders locally, and the JS shows a field only once it's been substituted.)
- On the **deployed** site, the date and short SHA always appear. The **version** is the git tag: `git describe --tags` names the tag on the built commit, or the nearest reachable tag plus a commit count — `v1.2` on the tagged commit, `v1.2+5` five commits later. So tagging once per release (not once per commit) still stamps a version on every build, and no build claims a tag it isn't.

To cut a release tag:

```bash
git tag -a v0.2.0 -m 'v0.2.0' && git push origin v0.2.0
```

The workflow fires on tag pushes as well as branch pushes (`tags: ['v*']`), so the tag alone deploys and stamps. A repo with no tag yet shows just the date and commit; add the first tag and the version appears from then on.

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

After setup, every change: edit → `git add -A` → `git commit` → `git push`, and the workflow rebuilds and publishes. To rebuild without a content change: Actions → the workflow → **Run workflow**. Your site is at `https://USER.github.io/REPO/` — the link in your README.

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

### 1. Install mdBook (pinned)

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

### 2. The tree

From the project root:

```bash
mkdir -p src theme/fonts .github/workflows
```

The files to write, in order below: `book.toml`; `src/SUMMARY.md`, `src/about.md`, `src/chapter_1.md`; `theme/head.hbs`, `theme/fonts/fonts.css`, `theme/favicon.svg`; `custom.css`, `custom.js`; `.gitignore`; `README.md`; and `.github/workflows/deploy.yml`.

### 3. `book.toml`

mdBook's config. `additional-js`/`additional-css` wire in the two theme files; `default-theme`/`preferred-dark-theme` set the light/dark pair the OS preference picks between (fixed mode only). **Change** `title` and `authors` to yours — and note `title` also appears in three other files below (`src/about.md`, `README.md`, and the masthead line in `custom.css`).

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

Fixed mode only. mdBook merges `theme/` over its built-in front end. This clears any saved theme *before* mdBook's theme script runs — necessary because fixed mode hides the picker, and `localStorage` is shared across one `USER.github.io` origin, so a theme chosen in another book on that origin would otherwise pin this one.

```handlebars
{{!-- Script-owned; regenerated on every run.

     Fixed theme mode hides the theme picker, so a theme saved in localStorage
     would pin this book with no control left to change it. localStorage is scoped
     to the origin, and every GitHub project site under one user shares one origin.
     Clearing the key here, ahead of mdBook's own theme script, lets that script
     resolve the theme from the OS preference and pick the matching highlight
     stylesheet with it. --}}
<script>try{localStorage.removeItem('mdbook-theme');}catch(e){}</script>
```

### 7. `theme/fonts/fonts.css`

Fixed mode only. It declares no faces on purpose: its mere presence makes mdBook emit only the fonts in `theme/fonts/` (none) instead of its built-in Open Sans and Source Code Pro (~493KB this theme doesn't use). Charter is declared in `custom.css`, not here — mdBook won't rewrite `url()` inside a `fonts.css` it didn't generate.

```css
/* Script-owned; regenerated on every run.

   Deliberately declares no faces. Its presence makes mdBook emit this file and
   only the font files in theme/fonts/ — none — instead of its built-in Open Sans
   and Source Code Pro, which this theme does not use. Charter is declared in
   custom.css and its woff2 live in src/fonts/. */
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
    text{font-family:"Charter","Bitstream Charter",Palatino,"Palatino Linotype","Book Antiqua","Noto Serif","Liberation Serif",Georgia,serif;font-weight:700;fill:#e8e6da}
  </style>
  <text x="50" y="75" text-anchor="middle" font-size="72">m</text>
</svg>
```

One ink, because the book is one theme. With `LIGHT_THEME=true` there are two, and the mark swaps with them — set `fill:#191713` and add the query the script would write:

```svg
    @media (prefers-color-scheme: dark){text{fill:#e8e6da}}
```

For a two- or three-character mark, drop the size and raise the baseline together so the letters still fill the square: `font-size="50"` with `y="68"` for two, `font-size="36"` with `y="63"` for three. Those are the only three shapes the script produces. Escape any `&`, `<` or `>` in the letters (`&amp;`, `&lt;`, `&gt;`) — an SVG that isn't well-formed XML renders as nothing at all, not as a partial mark.

Read "The favicon" above before you rely on this: the letters will not be in Charter unless the reader has Charter installed as a system font, and supplying this file means mdBook stops shipping its `favicon.png` too.

### 9. `custom.css`

The reading theme. In brief, it: hides the theme picker; sets the serif stack, the ~700px measure, and a 60px menu bar; styles headings with hairlines under H1/H2, the subtitle, blockquotes, asides, and underlined links; defines the full light/dark **palette** (mdBook paints ~43 variables per theme — overriding only page and sidebar leaves tables, quotes, search, and icons in the stock blues); repaints the code-block ground (`--code-bg`) and the inline-code pill (`--inline-bg`), both of which live in a highlight sheet the palette can't otherwise reach; forces ink-on-paper for print; holds the two columns' first lines level; draws the sidebar separator/part rules; styles the sidebar footer and the print-back link that `custom.js` injects; the text masthead; and the line-number gutter.

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
  --quote-bg:#f4f2e8;--quote-border:#e5e3d7;--warning-border:#b5540a;--code-bg:#f4f2e8;
  --table-border-color:#e5e3d7;--table-header-bg:#e0dccb;--table-alternate-bg:#faf8ee;
  --searchbar-bg:#fdfcf7;--searchbar-fg:#191713;--searchbar-border-color:#c2bda4;--searchbar-shadow-color:#c2bda4;
  --searchresults-border-color:#e5e3d7;--searchresults-header-fg:#57564e;--searchresults-li-bg:#f9f7ec;
  --search-mark-bg:#f2d9a8;--footnote-highlight:#f2d9a8;--overlay-bg:rgba(20,19,15,.6);
}
}
```

**Change** the masthead line `content:"mybook"` to your title (this is the one spot the title is hard-coded in CSS).

```css
/* Fixed theme: hide the picker, so the theme is not the reader's to choose in the
   page. With LIGHT_THEME=true their browser's light/dark preference drives it;
   otherwise the book is dark throughout. A saved theme would pin the book with no
   control left to change it — theme/head.hbs clears it. */
#mdbook-theme-toggle { display: none; }

/* No @font-face: the four Charter woff2 are not in src/fonts/, and declaring
   faces whose files are absent 404s four requests on every page load. The
   fallback stack below renders instead. Add them and re-run. */

/* mdBook sets html{font-size:62.5%} -> 1rem = 10px. px is literal; rem pre-scaled.

   --menu-bar-height is mdBook's own (50px). Everything that depends on the bar is
   expressed in terms of it — by mdBook (the sticky hover placeholder's height, the
   negative top margin on .page that pulls the bar to the viewport top, the icons'
   and the title's line-height, :target's scroll-margin) and by this file (the
   masthead band, the sidebar's scrollbox padding) — so raising it here raises all
   of them together and the two columns stay level. 50px leaves a 24px serif title
   about 13px of air above and below it, and the page scrolls under the bar, so that
   13px is the whole clearance between the title and the body text passing beneath.
   60px is the same title with room to breathe. */
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

/* Subtitle: <p class="mdb-subtitle"> on the line under a heading. Sits BELOW the
   heading's rule; the heading itself is untouched, so its own H1/H2 rule stays
   identical to a subtitle-less heading's. The :has() rule only trims the heading's
   bottom MARGIN (not its rule) to a fixed .5rem, so H1 and H2 both leave the same
   ~5px gap under the rule. */
.content .mdb-subtitle{margin-block:0 0;font-size:1.9rem;font-style:italic;line-height:1.35;color:var(--muted);}
.content h1:has(+ .mdb-subtitle),.content h2:has(+ .mdb-subtitle){margin-block-end:.5rem;}

/* Blockquote, GitHub-style. Scoped to :not(.blockquote-tag) so mdBook's native
   admonitions (> [!NOTE] etc., which ARE .blockquote-tag) keep their coloured accent.
   padding:0 on the block edges plus zeroing the first child's top margin and the last
   child's bottom margin is what keeps the rule flush with the text — without the
   margin reset the inner <p> margins push the rule past the text, top and bottom. */
.content blockquote:not(.blockquote-tag){background:none;border-block:0;border-inline-start:3px solid var(--rule);padding:0 1em;color:var(--muted);}
.content blockquote:not(.blockquote-tag) > :first-child{margin-block-start:0;}
.content blockquote:not(.blockquote-tag) > :last-child{margin-block-end:0;}

/* Aside: <aside>…</aside>, a digression callout — muted, 0.82em, a thin left rule.
   mdBook does not parse markdown inside it; write emphasis or links as HTML. */
.content aside{font-size:.82em;color:var(--muted);border-inline-start:2px solid var(--rule);padding-inline-start:1em;margin:1.15rem 0;}

/* mdBook's own .content a is text-decoration:none, and --links carries the colour.
   Only the underline is added here; the colour comes from the palette. Search
   results use --links too, so without an underline they render as plain body text
   with no affordance at all — give them the same one. */
.content a,.content a:visited{text-decoration:underline;text-underline-offset:2px;}
#mdbook-searchresults a{text-decoration:underline;text-underline-offset:2px;}

/* The sidebar list is left alone. mdBook's own .chapter li.chapter-item is
   line-height:1.5em; margin-block-start:0.6em — already in em, so it scales with
   the 1.6rem set above, and it is what spaces the rule a SUMMARY '---' draws.
   Overriding it in px-equivalent terms only tightens that rule against the text. */

/* Palette. mdBook defines ~43 colour variables per theme; overriding only the page
   and sidebar leaves blockquotes, tables, the search UI, icons and separators in the
   stock blues, which show the moment a page has a table or quote — so this covers
   every one that paints. Two rule weights: --rule-strong for H1/H2 hairlines and
   separators, --rule for the rest. The five --blockquote-*-color admonition accents
   are deliberately NOT overridden — they're semantic, and standing out is the point.

   STRUCTURE. mdBook resolves the theme in JavaScript, not CSS: it bakes default-theme
   into the served markup as <html class="light"> and an inline script in <body> swaps
   the class after the stylesheets have already resolved. So on a dark-mode reader's
   machine every navigation paints a full light frame first. That frame is what a
   force-dark browser extension reads, and it then holds its inversion of THIS palette
   over the dark one the swap installs — the page ends up part inverted-cream, part
   extension grey.

   That is a LIGHT_THEME=true problem only. Dark-only, book.toml pins default-theme
   and preferred-dark-theme both to PREFERRED_DARK, so the served class is already
   the dark one, nothing swaps, and the selector below collapses to that single
   class with no media query under it at all.

   With both palettes live, the dark block carries BOTH class names and comes first,
   and the light block is gated behind the light media query and comes second:

     html.<light>,html.<dark> { dark }      matches the served class too — the pre-swap
                                            frame is already dark under a dark OS
     @media (prefers-color-scheme: light)
       html.<light> { light }               same specificity, later in the file, so it
                                            wins wherever the query matches

   Four states, all measured: OS dark before the swap -> dark; OS dark after -> dark;
   OS light before -> light; OS light after -> light. No light frame ever paints under
   a dark OS, and each palette is written once.

   Both selectors are (0,1,1), which is what beats mdBook's own .<theme> at (0,1,0). A
   bare html{...} would be (0,0,1) and lose to it, so the class must stay in both
   selectors even though the media query alone would read as sufficient. The print
   block at the bottom of this file has to clear the same (0,1,1) bar for the same
   reason.

   --sidebar-bg sits close to --bg deliberately: about 2 points of CIELAB lightness in
   both modes, enough for the column to read as its own surface and little enough that
   the page reads as one tone. It does NOT match the quote/code ground, which is a
   heavier tint doing a different job. Nor can it go to zero: mdBook draws no border on
   .sidebar, so this tint is the only boundary the column has, and .mobile-nav-chapters
   takes its whole fill from the same variable.

   --code-bg and --inline-bg are not mdBook variables: mdBook paints code backgrounds
   from the highlight.js stylesheet, not a theme variable, so the palette can't reach
   them. Both are repainted below. In light the code ground is the blockquote tint
   (#f4f2e8); in dark it sits a step above it (#242420 over the #1b1b18 quote) because
   at #1b1b18 the block barely parted from the #111 page.
   Only the ground moves; the syntax token colours are left as the highlight theme sets
   them. --inline-bg is a separate, slightly stronger tint so a short inline pill reads
   against both the page and the running text around it. */
html.ayu{
  --bg:#111;--fg:#e8e6da;--links:#e8e6da;--inline-code-color:#ffb454;--inline-bg:#2b281f;--inline-border:#3a382f;--muted:#aaa8a0;
  --rule:#2c2c28;--rule-strong:#42423c;--color-scheme:dark;
  --sidebar-bg:#161613;--sidebar-fg:#cfcdc2;--sidebar-active:#ffb454;
  --sidebar-spacer:#42423c;--sidebar-non-existant:#6b6a61;--sidebar-header-border-color:#42423c;
  --icons:#7a786e;--icons-hover:#e8e6da;
  --copy-button-filter:invert(1) opacity(.55);--copy-button-filter-hover:invert(1) opacity(1);
  --quote-bg:#1b1b18;--quote-border:#2c2c28;--warning-border:#ffb454;--code-bg:#242420;
  --table-border-color:#2c2c28;--table-header-bg:#2c2c28;--table-alternate-bg:#191916;
  --searchbar-bg:#1b1b18;--searchbar-fg:#e8e6da;--searchbar-border-color:#42423c;--searchbar-shadow-color:#42423c;
  --searchresults-border-color:#2c2c28;--searchresults-header-fg:#9a988c;--searchresults-li-bg:#191916;
  --search-mark-bg:#5a4a24;--footnote-highlight:#5a4a24;--overlay-bg:rgba(10,10,8,.7);
}

/* Repaint the code block's ground from the palette. custom.css is the last
   stylesheet mdBook links, after all three highlight sheets, and pre > code.hljs
   (0,1,2) outranks their bare .hljs (0,1,0) anyway. Scoped to pre > : inline code is
   repainted by its own rule below. When the line-number gutter is on it is painted the
   same colour, so the block reads as one surface rather than as two columns with a
   seam down the middle. */
pre > code.hljs{background-color:var(--code-bg);}

/* Inline code. mdBook paints NO ground on inline code: chrome.css gives it only
   padding + radius (:not(pre) > .hljs) and a text colour (:not(pre):not(a) > .hljs),
   so the pill's fill is left to whichever highlight sheet is live — #f6f7f6 (light) or
   #191f26 (ayu), both off this palette and near-invisible on our grounds — and with
   --inline-code-color set to --fg (as it was) the text carried no signal either.
   book.js adds .hljs to every non-header <code> at load, so inline code is code.hljs
   in the browser: repaint it here from the palette. Warm fill + the theme's own accent
   text (ffb454/b5540a) + a hairline drawn as an inset shadow, which — unlike a border —
   does not change the inline box's metrics. :not(pre) excludes block code (its parent
   is <pre>); :not(a) leaves linked code to the link styling. code.hljs makes this
   (0,1,3), over mdBook's own (0,1,2) and the bare .hljs (0,1,0); custom.css is last. */
:not(pre):not(a) > code.hljs{background-color:var(--inline-bg);color:var(--inline-code-color);box-shadow:inset 0 0 0 1px var(--inline-border);}

/* mdBook fills the mobile chapter buttons from --sidebar-bg. Those buttons sit on the
   page ground, not in the sidebar, so a tint tuned to draw a column edge leaves them
   nearly invisible at the widths where they appear (<=1080px, and <=1380px with the
   sidebar open). Give them the blockquote ground instead — same specificity as
   mdBook's own rule, and custom.css is last, so this wins. */
.mobile-nav-chapters{background-color:var(--quote-bg);}

/* print.css resets layout but not colour, and the UA drops backgrounds when
   printing — so a reader whose OS is dark prints near-white ink onto white paper.
   Force ink-on-paper for the print media regardless of the theme in force.

   The selector must name the theme class(es) — the same set the palette named, so it
   is written from the same variable. A media query does not raise specificity, so a
   bare html{...} here is (0,0,1) and loses outright to the palette's (0,1,1) — the
   override silently never applied, which is exactly the failure it exists to prevent.
   Matching the palette's selector ties the specificity; being last in the file wins it.

   Ink stays #111 here even though the screen palette softened its --fg. Butterick's
   case for grey over black is about an emissive screen; paper reflects, and the
   contrast it needs is the other way. */
@media print{
  html.ayu{
       --bg:#fff;--fg:#111;--links:#111;--inline-code-color:#111;--inline-bg:#f5f5f5;--inline-border:#ddd;--muted:#444;
       --rule:#ccc;--rule-strong:#999;--quote-bg:#fff;--quote-border:#ccc;--code-bg:#f5f5f5;
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

Loaded in every mode. It: makes `b` toggle the sidebar (and adds that key to mdBook's `?` help popup); opens off-site links in a new tab; adds the sticky-masthead hairline on scroll; builds the sidebar footer line (`<version> · updated <date> · <sha>`); adds a back link to `print.html` and returns you there after the print dialog closes; and draws the code line-number gutter (a sibling of `<code>`, never inside it, so mdBook's copy button and Ctrl+C still yield the exact source).

The top four `var`s are the only edit point. **Change** `MDB_REPO` to your repo URL if you have one (it's `""` with no repo, and links the footer SHA to the commit when set). The other three stay as `__MDB_BUILD_*__` placeholders — the deploy workflow substitutes them at build time, and a local build, which nothing stamps, shows no footer line at all.

````javascript
// Script-owned. Edit GIT_REPO_URL at the top of the script and re-run. The other
// three are stamped by the deploy workflow at build time: MDB_VERSION from the tag
// on the built commit (empty when it carries none), MDB_UPDATED from the build
// date, MDB_SHA from the built commit itself.
var MDB_REPO = "";
var MDB_VERSION = "__MDB_BUILD_VERSION__";
var MDB_UPDATED = "__MDB_BUILD_DATE__";
var MDB_SHA = "__MDB_BUILD_SHA__";
(function () {
  var ready = function (fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  };

  // 'b' toggles the sidebar. The guard mirrors mdBook's own
  // (mdbook_something_else_has_focus): composedPath for shadow-DOM targets, form
  // fields, and contenteditable.
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

  // Drop the prev/next links that point INTO the reserved src/unlisted/ directory,
  // so the chapter arrows and the Left/Right keys skip those chapters the way the
  // sidebar rule already hides their rows. Remove, not hide: book.js reads
  // .nav-chapters.next straight out of the DOM and follows its href, so CSS alone
  // leaves the key walking in. Links OUT of an unlisted chapter are left alone —
  // its own back arrow still works. Same two href alternatives as the CSS rule (the
  // root form and the rewritten ../ form), and the class test is a substring because
  // mdBook emits the desktop pair and the mobile pair under different class names.
  ready(function () {
    var sel = 'a[class*="nav-chapters"][href^="unlisted/"],' +
              'a[class*="nav-chapters"][href*="/unlisted/"]';
    var links = document.querySelectorAll(sel);
    for (var i = 0; i < links.length; i++) links[i].remove();
  });

  // The masthead is sticky at the top of the sidebar (CSS), and grows a hairline
  // once the TOC scrolls under it — the same thing book.js does to the menu bar
  // opposite it, whose 'bordered' class it adds the moment the bar leaves the top
  // of the page. A class and not a selector because nothing in CSS can see a scroll
  // offset. Its own ready() block, kept clear of the site-meta one below, which
  // returns early on an unstamped build and would take this with it.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var border = function () { box.classList.toggle("mdb-scrolled", box.scrollTop > 0); };
    border();
    box.addEventListener("scroll", border, { passive: true });
  });

  // Site-meta at the foot of the sidebar (site-level, not per-page). A part is
  // shown only if the workflow stamped it, so an unstamped local build shows no
  // line at all rather than a placeholder word.
  ready(function () {
    var box = document.querySelector(".sidebar .sidebar-scrollbox");
    if (!box) return;
    var stamped = function (v) { return v !== "" && v.indexOf("__MDB_") !== 0; };
    var parts = [];
    if (stamped(MDB_VERSION)) parts.push(document.createTextNode(MDB_VERSION));
    if (stamped(MDB_UPDATED)) parts.push(document.createTextNode("updated " + MDB_UPDATED));
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
      if (i) p.appendChild(document.createTextNode(" \u00b7 "));
      p.appendChild(parts[i]);
    }
    box.appendChild(p);
  });

  // print.html. mdBook auto-opens the print dialog there, and cancelling it
  // otherwise strands you on the concatenated whole-book page it renders for PDF
  // export.
  //
  // Two paths, on purpose. The events are the nice path: go back when the dialog
  // closes — on cancel and on a completed job alike, since no browser distinguishes
  // the two. Two triggers, because browsers disagree about which they fire:
  // afterprint, and the print media query ceasing to match (that one only after it
  // has actually matched, so a spurious change event at load cannot bounce you); a
  // once-flag stops the pair double-firing. Neither is guaranteed to fire in every
  // browser, so the link is the path that cannot fail: it is always there, it needs
  // no event, and it is hidden from the printed output. No referrer test —
  // document.referrer is empty on a reload, a pasted URL or a restored tab.
  (function () {
    if (!/(^|\/)print\.html$/.test(location.pathname)) return;

    ready(function () {
      var main = document.querySelector("#mdbook-content main");
      if (!main) return;
      var p = document.createElement("p");
      p.className = "mdb-print-back";
      var a = document.createElement("a");
      a.href = (typeof path_to_root === "string" ? path_to_root : "") + "index.html";
      a.textContent = "\u2190 Back";
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

// Line numbers. book.js highlights synchronously before this file runs, so the
// blocks already carry code.hljs. The numbers go in a sibling div, never inside
// <code>: mdBook's copy button reads code.innerText, so anything that rewrites
// <code>'s DOM corrupts what a reader copies.
//
// ONE style rule: a block shorter than MIN_LINES is not numbered. Nobody counts to
// four, and a gutter on a three-line block is furniture.
//
// The three tests above it are not style rules, they are correctness guards, and
// removing any one of them breaks something. Number a block only when its fence
// named a language — mdBook emits class="language-x" for ```bash and no such class
// for a bare ```, even though highlight.js still auto-detects and colours the bare
// one. Skip .playground blocks (their <pre> also holds a .result panel, which a flex
// row would put beside the code instead of below it) and blocks with hidden lines
// (the eye button display:none's .boring spans, which drops lines out of the flow
// and leaves the numbers pointing at the wrong ones).
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

### 13. `.github/workflows/deploy.yml`

The first-party GitHub Pages deploy. The build job installs the **pinned** mdBook, verifies the tarball against the digest from step 1, stamps the version/date/SHA into `custom.js`, builds, and uploads the site; the deploy job publishes it. The actions are pinned by commit SHA (not a moving tag) so a compromised action repo can't re-point them, and both jobs run on a pinned `ubuntu-24.04` (not the moving `ubuntu-latest`) so a new runner image can't shift the build under you. **Change**, to match your setup: the mdBook version in the URL and the step name, the `sha256sum` digest (must equal *your* tarball's), and `main` (both the `branches:` trigger and, if you changed it, the default branch). `fetch-depth: 0` is required — the default fetches no tags, and the version stamp reads the tag on the built commit.

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
    # Pinned like the action SHAs and the mdBook version: the runner image is the last
    # input that could shift under an otherwise-green build. Bump when 24.04 is retired.
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0
        with:
          # 0 = full history and tags. The default (1) fetches neither, and the
          # version stamped below is the tag on this commit.
          fetch-depth: 0

      - name: Install mdBook v0.5.4
        run: |
          set -euo pipefail
          base="https://github.com/rust-lang/mdBook/releases/download/v0.5.4/mdbook-v0.5.4-x86_64-unknown-linux-gnu.tar.gz"
          curl --fail -sSL "$base" -o mdbook.tar.gz
          # The digest of the bytes the bootstrap script installed locally. A version
          # tag names a file, not its contents; this pins the contents.
          echo "3f28de05dafca9d0f2eab99c662116b0e37b89b1d96a08f8f430b9eeae958cd7  mdbook.tar.gz" | sha256sum -c -
          tar -xz -f mdbook.tar.gz --directory=/usr/local/bin

      - name: Stamp build metadata
        run: |
          set -euo pipefail
          # The version of this build. 'describe --tags' names the tag on this commit
          # if it carries one, and otherwise the nearest tag reachable from it plus the
          # distance and the abbreviated commit: v1.2-5-gabc1234. The sed rewrites that
          # tail to a '+5', which says the same thing without repeating the SHA that is
          # already the next field of the line — so the label reads v1.2 on the tagged
          # commit and v1.2+5 five commits later. Never --abbrev=0: that would print
          # 'v1.2' for a commit that is not v1.2. Empty until the first tag exists;
          # then it is never empty again. Reduced to a safe charset before being
          # spliced into a sed replacement and a JS string literal: a git tag name may
          # legally contain | and ".
          version=$(git describe --tags 2>/dev/null | sed -E 's/-([0-9]+)-g[0-9a-f]+$/+\1/' || true)
          version=${version//[^A-Za-z0-9._+-]/}
          sed -i \
            -e "s|__MDB_BUILD_VERSION__|${version}|" \
            -e "s|__MDB_BUILD_DATE__|$(date -u +%Y-%m-%d)|" \
            -e "s|__MDB_BUILD_SHA__|${GITHUB_SHA::7}|" \
            custom.js

      - name: Build
        run: mdbook build

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

### 14. Build and preview

```bash
git init -b main
./bin/mdbook serve --open -n 127.0.0.1 -p 3000
```

The preview opens at `http://127.0.0.1:3000` (Ctrl-C stops it). That's a working v36 book. To publish it, follow "Push to GitHub" above — create an empty repo, push, and enable Pages once by hand (Settings → Pages → Source → GitHub Actions).

## Other platforms

Linux x86_64 only, as shipped. Two places name the platform, and they are coupled through the digest check:

- The local install uses a triple in `install_mdbook` (`triple="x86_64-unknown-linux-gnu"`) to build the tarball URL, installs that binary as `bin/mdbook`, **and records that tarball's SHA-256** as the digest pinned into the workflow.
- The workflow's install step downloads the `x86_64-unknown-linux-gnu` tarball (the runner is pinned to `ubuntu-24.04`) and checks it against that pinned digest with `sha256sum -c`.

On x86_64 Linux these are the same tarball, so the one recorded digest is correct for both. **Off x86_64 Linux they diverge:** if you change the local triple to, say, macOS, your preview binary is right but the digest recorded from the macOS tarball won't match the Linux tarball CI downloads, and the CI digest check fails. So on another platform you own the workflow's install step by hand: keep its triple at `x86_64-unknown-linux-gnu` (the runner's), and set its digest to the **Linux** tarball's `sha256sum` (compute it yourself), independent of whatever local triple you use for preview.

The real 0.5.4 asset triples, for the local `bin/mdbook`: Intel macOS `x86_64-apple-darwin`, Apple Silicon `aarch64-apple-darwin`, ARM Linux `aarch64-unknown-linux-musl` (musl, not gnu). Windows ships a `.zip` (`x86_64-pc-windows-msvc`), so it needs more than a triple swap — the install code assumes a `.tar.gz`. Always confirm the current spelling on the mdBook releases page before pinning.