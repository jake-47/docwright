# Publish a blog
<p class="mdb-subtitle">Publish a minimal blog on GitHub Pages</p>

The [zola-blog-setup.sh](./boostrap-zola.md) script scaffolds a Zola blog, installs and version-pins the Zola
binary, writes a first-party GitHub Pages deploy workflow, and opens a live
preview. The published site has no JavaScript, no analytics, no font CDN, and no
third-party requests of any kind — a Content-Security-Policy in the base
template enforces that rather than merely intending it. It ships a reading
theme: self-hosted Charter, a 42rem measure, a dark palette (with an optional
light counterpart), hairlines under H1/H2, inked-and-underlined links, and a text masthead in the same face as the body.

**The script takes no arguments.** Every input is a variable in the
configuration block at the top of the file, which makes that block the one place
the blog is described — and makes re-running the update path rather than a
second, different mode. Edit the block, run it again, and the change lands.

The corollary is that most of the files are script-owned and are rewritten on
every run. Read "Re-running" before you edit anything under `templates/` or in
`config.toml`.

Linux, macOS, and Git-Bash-on-Windows. The CI workflow is Linux x86_64 only.

**Zola 0.23.x.** The templates are Tera v2, which arrived in Zola 0.23 and is
not backward compatible; they will not build on 0.22 or earlier. Setup treats
that as a band rather than a floor and refuses a release outside it instead of
installing one. See "The Zola version band".

## Two ways to set this up

Both produce the same v12 blog. They differ only in how the files arrive.

1. **Run the script.** The rest of this guide, from "Run it" on. Edit the
   configuration block, run it once, and it installs Zola, writes every file,
   and opens a preview.

2. **Build it by hand.** No script — install Zola yourself and write each file
   in. See "Build it by hand" near the end. This is the way to audit what lands
   on disk before it does, and the way to adapt the layout to something other
   than a blog.

There is no reference-repo path. A clone would carry that repo's `base_url`,
`source_url`, `history_url`, and git remote, and unpicking those is more work
than running the script.

## Run it

1. Open `zola-blog-setup.sh` and edit the configuration block at the top
   (below). At minimum, set `PROJECT_DIR`, `BLOG_NAME`, `SITE_TITLE`, and — if
   you want the site published — `GIT_REPO_URL`.
2. Run it:

   ```bash
   bash zola-blog-setup.sh
   ```

That is the whole invocation. The blog is created at `PROJECT_DIR/BLOG_NAME`.
The preview opens at `http://127.0.0.1:1111`; Ctrl-C stops it. Re-launch later
from anywhere:

```bash
~/Desktop/myblog/serve
```

Anything after the script name that is not `help` or `update-zola` is an error.
With no positional argument there is nothing a mistyped subcommand could be
confused with, so `update-zol` fails instead of creating a folder named after
the typo.

`GIT_REPO_URL` is the https URL in your browser's address bar on the repo page —
`https://github.com/user/repo`. Not `user/repo`, and not an ssh remote. A
trailing slash or a `.git` suffix is tolerated; anything else is rejected before
a file is written. That one value wires `base_url`, the per-post source and
history links, the footer host link, and the git `origin` remote.

`START_PREVIEW=false` skips the preview at the end. Set it in the block, or pass
it for one run — `START_PREVIEW=false bash zola-blog-setup.sh` — which is what you
want when you are re-running to change one variable and do not want to end up
holding a server. It is skipped anyway when stdout is not a terminal, so the
script can be driven from another script without hanging on a server nobody is
watching.

Audit it first: `less zola-blog-setup.sh`. Roughly half of it is the text of
the files it writes; the logic is the other half.
Network-wise it fetches only from `github.com`: the Zola release tarball and,
when `GIT_REPO_URL` is set, the Linux tarball that gets hashed so its digest can
be pinned into the workflow. It installs nothing via a package manager and
needs no root: Zola lands in `$HOME/.local/bin`.

### Before you run it

Required:

- `curl` or `wget`.
- `tar`, or `unzip` on Windows.
- A GitHub account, if you want the site published.

Optional, but you want them:

- `git`. Without it the repo init is skipped and you wire the repository up
  yourself later.
- `sha256sum` or `shasum`. Without one the run stops rather than install a
  binary whose digest it cannot record, and it says so before it starts.

Not required: Zola. Setup installs one if the machine has none inside the
supported band. Nothing needs root and nothing goes through a package manager.

And read the script before you run it. That advice is not a formality — it is a
shell script off the internet that installs a binary and writes a git remote. If
you do not read shell, hand it to someone who does, or paste it into a model you
trust and ask what it does. Do one of those once, before the first run.

Two commands to know:

```bash
bash zola-blog-setup.sh help          # the full command list
bash zola-blog-setup.sh update-zola   # install the latest Zola release
```

### What "verified" does and does not mean here

Zola publishes no `.sha256` sidecar alongside its release assets, so there is no
second, independent value the downloaded bytes can be checked against at install
time. Setup therefore **prints** the digest of what it downloaded rather than
comparing it to anything. You can hold that against the release page or against
a second machine; what it rests on is https to `github.com`, which is the same
trust that got you this script.

The workflow pin is different, and is a real check: setup downloads the Linux
build once, hashes it, and writes that constant into `deploy.yml`. CI then
verifies every future build against it. A version tag names a file, not its
contents, so if the release asset is ever substituted the build goes red instead
of publishing.

## What it writes

Into `./BLOG_NAME`:

- `config.toml` — Zola config, seeded from the configuration block.
- `content/_index.md` — the home section: `sort_by`, `paginate_by`.
- `content/about/_index.md` — the about page, including the avatar keys.
- `content/pages/_index.md` — an unrendered, unsorted section: the shape for
  pages that should exist without being listed. See "Unlisted pages".
- `content/hello-world.md`, `content/second-post.md` — two demo posts. The first
  is a Markdown style reference and a tour of the authoring features; the second
  exists so the newer/older navigation has somewhere to point.
- `.zola-blog-setup.manifest` — a `sha256  path` line per script-owned file,
  recording what the last run left on disk. Tracked, not ignored, so it travels
  with the repo. See "Re-running". Only files the script actually wrote are
  listed: with `FAVICON_TEXT=""` or an empty `GIT_REPO_URL`, the corresponding
  path is not claimed at all.
- `templates/` — nine files: `base.html` (which carries the entire stylesheet),
  `components.html`, `index.html`, `page.html`, `section.html`, `taxonomy_list.html`,
  `taxonomy_single.html`, `404.html`, `atom.xml`. There is deliberately no
  `sitemap.xml`: Zola's built-in emits exactly the `lastmod` behaviour an
  override would have to reimplement, and an override that pipes the permalink
  through `escape_xml` turns every `/` in every `<loc>` into `&#x2F;`.
- `static/favicon.svg` (only when `FAVICON_TEXT` is non-empty), `static/avatar.svg`,
  `static/demo.svg`, `static/fonts/README.txt`.
- `serve`, `build` — executable shortcuts that resolve their own folder, so they
  work from anywhere.
- `README.md` — the per-blog documentation: making it yours, the authoring
  patterns, email subscription, privacy. This is where day-to-day reference
  lives; the guide you are reading covers setup, the hand path, and the parts
  that are the same for every blog.
- `.gitignore` — ignores `/public` and `/static/processed_images`.
- `.github/workflows/deploy.yml` — written only when `GIT_REPO_URL` is set.

Then it runs `git init -b main`, makes an initial commit if `user.name` and
`user.email` are configured, sets `origin` to `git@github.com:USER/REPO.git`
when `GIT_REPO_URL` is set, and starts the preview.

If a create fails part-way through, the folder it made is removed on the way
out. Only a folder this run created is ever removed, and the guard is cleared
the moment the blog is complete, so the cleanup can never reach something that
was already there.

## The configuration block

Edit these at the top of the script. They seed a *new* blog; changing them later
and re-running does not revisit an existing one (see "Re-running").

- `PROJECT_DIR` — the parent folder your blogs live under. A leading `~` is
  expanded; a relative path resolves against the directory you run from.
  Default `$HOME/Desktop`.
- `BLOG_NAME` — the folder name, created under `PROJECT_DIR`. A plain single
  segment: no slashes, no leading dash or dot, no spaces. Default `myblog`.
- `GIT_REPO_URL` — `https://github.com/user/repo`, or empty for a local blog
  with no deploy file and no dead links.
- `CUSTOM_DOMAIN` — an `https://` domain you have pointed at Pages. Overrides
  the `base_url` derived from `GIT_REPO_URL` and nothing else; the source and
  history links still point at the repo. Empty by default.
- `START_PREVIEW` — open the live preview when the run finishes. Default `true`.
  Also settable from the environment for one run.
- `REGENERATE_TEMPLATES` — overwrite script-owned files even when they have been
  changed since the script last wrote them. Default `false`. It is a one-run
  operation, so prefer the environment and leave the file alone:
  `REGENERATE_TEMPLATES=true bash zola-blog-setup.sh`. See "Re-running".
- `SITE_TITLE` — the masthead wordmark and `<title>`. Rename the site and the
  wordmark and the favicon both follow. Separate from `BLOG_NAME` on purpose:
  the folder name has to be a plain filesystem segment, the display name does
  not, and collapsing them would mean a title you cannot punctuate.
- `SITE_DESCRIPTION` — the strapline under the wordmark on the home page, the
  feed's `<subtitle>`, and the page's `<meta name="description">`. Set it to
  `""` and the visible line is not rendered at all.
- `LIGHT_THEME` — `false` (default) writes only the dark palette, so the site is
  dark for every reader whatever their OS is set to. `true` writes both and lets
  `prefers-color-scheme` choose. See "Dark by default".
- `SITE_AUTHOR`, `SITE_LANGUAGE` — written to `config.toml`. `SITE_AUTHOR` is
  what the Atom feed's `<author>` carries; a feed without one is invalid per
  RFC 4287, so leave it set to something.
- `MASTHEAD` — `none`, `text`, or `image`. See "The masthead" below. Default
  `text`.
- `FAVICON_TEXT` — what `static/favicon.svg` draws: `auto` (the first
  alphanumeric of `SITE_TITLE`), any string of up to three characters, or `""`
  to draw none and hand the file over to you. Default `auto`. See "The favicon".
- `LIGHT_CODE_THEME` / `DARK_CODE_THEME` — syntax-highlighting themes. These are
  Zola's built-in (Giallo) theme names, not arbitrary strings; defaults
  `github-light` and `github-dark`.
- `GENERATE_FEEDS` — `true` (default) writes `atom.xml` for the whole site and
  for each tag.
- `PAGINATE_BY` — posts per page on the home feed. Default 10.
- `SHOW_TOC` — `true` (default) puts a collapsed contents box at the top of any
  post that has headings.
- `SHOW_HISTORY_LINK` — a "view history" link on each post, pointing at that
  file's commit log on your forge. Requires `GIT_REPO_URL`; default `false`.
- `SHOW_SUGGEST_EDIT` — a "suggest an edit" link to the file on your forge.
  Requires `GIT_REPO_URL`; default `false`.
- `ENABLE_SUBSCRIBE`, `SUBSCRIBE_ACTION`, `SUBSCRIBE_FIELD`, `SUBSCRIBE_BLURB` —
  see "Email subscription". Off by default. `SUBSCRIBE_ACTION` must be `https://`
  and setup refuses anything else.
- `ABOUT_INTRO`, `ABOUT_EMAIL` — seed the about page.
- `FOOTER_X_URL`, `FOOTER_NOSTR_URL` — footer links. Edit or remove them in
  `config.toml`'s `footer_links` afterwards.
- `ZOLA_MIN_VERSION` / `ZOLA_MAX_VERSION` — `0.23` and `0.24`, the latter
  exclusive. See "The Zola version band".

Four environment variables, all escape hatches, each scoped to one run:

- `START_PREVIEW=false` — skip the preview.
- `REGENERATE_TEMPLATES=true` — overwrite drifted script-owned files.
- `ZOLA_VERSION_OVERRIDE=<vX.Y.Z>` — install and pin this release rather than
  resolving the latest. The way through when the latest release has moved past
  the ceiling and you know which tag you want.
- `ZOLA_SHA256_OVERRIDE=<digest>` — supply the Linux digest that gets pinned into
  the workflow, instead of downloading that build to hash it. Rarely needed now:
  a re-run reads the digest back out of the existing `deploy.yml`.

## The Zola version band

`ZOLA_MIN_VERSION` used to be a floor on its own. It is now one end of a band,
and the ceiling is the half that matters.

Zola 0.23.0 (5 August 2026) shipped Tera v2 and its own changelog calls it
"probably the most breaking version of Zola that will happen". Macros are gone
and replaced by components. Tests take keyword arguments. Accessing an undefined
field is an error rather than an empty string. The `date` filter moved onto jiff
and lost the `%+` specifier. `get_taxonomy_url`'s `name` argument is deprecated
in favour of `term`. Every one of those appears in the templates this script
writes, so they are Tera v2 and cannot run on 0.22 or earlier.

The floor is therefore 0.23. It is also above the 0.22 that Giallo needs — 0.22
is the release that replaced syntect, moved highlighting into
`[markdown.highlighting]` with `light_theme`/`dark_theme`, and introduced the
`.giallo-l` / `.giallo-ln` classes, all three of which are in what this script
writes — so the template requirement is simply the higher of the two.
(`resize_image`'s EXIF-orientation fix landed in 0.19 and is covered comfortably.)

The ceiling exists because a floor alone fails in the one direction that matters.
With only a floor, setup installed and pinned whatever "latest" happened to be;
after August 2026 that meant handing a Tera v1 site to a Tera v2 binary. The
result was a dead local preview and a red CI **from a run that reported success**.
A ceiling turns that into a refusal:

```
zola 0.24.0 is the latest release, but this script supports >= 0.23 and < 0.24.
```

Nothing is created when that fires. Raising the ceiling means porting the
templates first, not editing the line. `ZOLA_VERSION_OVERRIDE` is there for the
case where you already know which tag you want.

A local Zola *above* the ceiling is replaced the same way one below the floor is,
and setup says so, because `$HOME/.local/bin/zola` is shared with any other Zola
site on the machine.

### What version gets pinned into CI

Not, in general, whatever `zola --version` reports. The pin has to name a real
GitHub release tag *and* sit inside the band, and the local binary guarantees
neither:

- A distro-packaged Zola reports something like `0.23.1+dfsg`, which no release
  is named after. Pinning that produced a URL that 404s — at setup, and again on
  every CI run.
- Update mode never re-checks the band on its own, so a machine carrying an old
  Zola could silently downgrade an existing blog's CI out of it.

So setup uses the local version only when it is inside the band and a HEAD
request confirms the matching release asset exists. Otherwise it pins a release
that is, and says so.

Note what that HEAD request cannot distinguish. It fails for a tag that names no
asset, for a version outside the band, **and** for a network that is simply down,
and the message names all three rather than asserting the first — v10 reported a
network outage as a version problem, which sent you looking in the wrong place.

### Re-running does not re-download

The digest pinned into `deploy.yml` is recorded once, at setup. A re-run reads it
back out of the file when the version has not changed, rather than fetching the
14 MB tarball again to recompute a constant. That is not a weaker check: a value
fetched at build time from the same place as the file it vouches for proves
nothing, which is the whole reason the pin is a recorded constant. It does mean a
re-run to change `SITE_TITLE` needs no network at all — v10 could not do that,
and failed outright offline. Change the pinned version and the download comes
back, because then the recorded digest is for different bytes.

## The masthead

`masthead` in `config.toml`'s `[extra]` takes one of three values, seeded from
`MASTHEAD` in the script. The same three-way key the sibling `bootstrap-mdbook`
script uses, with the same meanings:

- **`text`** (default) — `SITE_TITLE` alone, set in Charter at the body's own
  weight. No plate, no boxed letter, nothing beside it to fall out of step.
- **`none`** — nothing; the masthead is the nav alone. Note that this leaves no
  link back to the home page in the masthead, so add
  `{ name = "home", url = "/" }` to `header_nav` if you pick it.
- **`image`** — `static/logo.svg`, which you supply. Setup warns if it is
  missing.

`image` paints the file as an **alpha mask** in the masthead text colour, so one
file serves light and dark. Supply a flat silhouette on a **transparent** ground
— a monogram, not a picture. A file carrying its own background masks the whole
box solid.

### Size, alignment, and the rule

The wordmark is `--wordmark-size`, a token in the YOUR DESIGN block alongside
`--h1-size` and the rest, defaulting to `1.5em` — 28.8px at the shipped body
size. The size sits on `.brand` rather than on `.brand-name`, so in `image` mode
the logo box is `1em` of the same value and the two cannot drift apart.

1.5em is not a taste call. It puts the wordmark between `--h2-size` (24.8px) and
`--h1-size` (36px): larger than any heading inside a post, smaller than the
post's own title. The earlier 1.15em was 22.1px — *smaller than an `h2`*, which
meant every `## Heading` in an article outranked the name of the site. Above
about 1.7em it starts competing with the post title instead.

The masthead is `align-items: center`, not `baseline`. The wordmark and the nav
sit roughly 500px apart at different sizes, and on a shared baseline the larger
one's caps start higher — 7.7px at 1.5em, which reads as a mistake rather than
as typography. Centring more than halves it.

There is no rule under the masthead. The two pieces of site chrome bracketing
the content are separated the same way: the footer is held apart by whitespace
and by being centred and muted, and so is the head. A rule here also meant a
second hairline on every post page, 450px above the one that closes the
title-and-dates block, and two rules doing different jobs that close together
read as one job done twice.

That leaves the alignment of the wordmark against the nav resting entirely on
`align-items: center`. If it ever reads wrong, the fix is the alignment — the
wordmark and the nav at the same size — not a rule to paper over it.

### The strapline

`SITE_DESCRIPTION` renders as a small muted italic line under the wordmark, on
the home page only, inside the head block and tight above its rule. That
placement is the whole point: the same sentence set two lines lower, floating
between the masthead and the first post, reads as an orphan. Under the rule it
reads as part of the nameplate.

It is home-only because a strapline repeated over every post would compete with
each post's own title. Mechanically, `base.html` carries a `masthead_extra`
block inside `<header>` and `index.html` is the only template that fills it.

The wordmark is text and not an SVG for a reason worth stating, because the
obvious approach fails silently. An SVG loaded through `<img>` renders with
external resource loading disabled — the browser never even requests the
webfont. So a wordmark drawn as an SVG can never use Charter, whatever its
`font-family` says; it falls back to whatever serif the *reader's* machine has,
which differs per visitor. As text, the question does not arise. The `image`
mode sidesteps this by being a mask rather than a picture: it carries shape, not
type.

`header_nav` ships without a `home` item, because the wordmark is itself a link
to `/` and a `home` item would be the same link twice on every page.

There is no visible `<h1>` on the home page for the same reason. The element is
still there — the page keeps exactly one `h1` for the document outline and for a
screen reader — but it carries `.visually-hidden`, since the masthead already
says the same words 40px above it.

### The favicon

A separate job with its own source, so a text masthead and a drawn favicon
coexist. `FAVICON_TEXT` resolves to a mark, and `static/favicon.svg` draws it as
a **bare letterform on a transparent ground** — no plate, ink in the palette's
`--fg`, swapping to the dark ink under `prefers-color-scheme: dark`. Size and
baseline follow the mark's length, so one character sits large and centred and
three sit smaller.

Its face is a fallback stack and cannot be Charter, for the same reason as
above: a favicon is fetched as an image, and an image never loads an
`@font-face`. A 16px glyph is the one place on this site where that is
tolerable.

The favicon is script-owned and redrawn on every run *while `FAVICON_TEXT` is
set*, so change the variable rather than the file. To use a mark of your own,
set `FAVICON_TEXT=""` and put your `static/favicon.svg` in place. With the key
empty the script does not write the file, does not claim it in the manifest, does
not drift-check it, and does not remove it: ownership follows the configuration.

The order matters slightly. If a script-drawn favicon is already on disk when you
clear the key, the next run removes it — that one *is* the script's, and leaving
it would mean a mark you had switched off still sitting on the site. So clear the
key and let one run remove the old file, then drop yours in; or drop yours in
first and take one `REGENERATE_TEMPLATES=true` run past the drift guard. Either
way, once the manifest no longer claims the path, your file is left alone
indefinitely.

## Re-running

Re-running is the update path, not a second mode. There is nothing to pass and
no flag to remember: edit the configuration block, run the script again, and the
change lands.

What that costs is that most of the tree is **script-owned** and is rewritten on
every run:

```
config.toml   templates/   serve   build   README.md   .gitignore
static/favicon.svg   .github/workflows/deploy.yml
```

Hand edits to those do not survive. Change the matching configuration variable
or `render_*` function in the script and re-run instead.

`content/` and the rest of `static/` are **yours**. They are written once, on the
first run, and never touched again. Delete the demo posts, replace `avatar.svg`
and `demo.svg`, drop the Charter files into `static/fonts/` — none of it is at
risk.

Ownership runs both ways. Clearing the variable that produced a file removes the
file, rather than leaving it behind:

- `FAVICON_TEXT=""` removes a script-drawn `static/favicon.svg`.
- An empty `GIT_REPO_URL` removes `.github/workflows/deploy.yml`. This is the one
  that bites: left in place it keeps deploying on every push, and `config.toml`
  has just reverted `base_url` to a placeholder, so what it publishes carries
  absolute URLs naming a domain you do not own. Commit the deletion.

In both cases the file goes only if its bytes match what the script last wrote.
Edit either one by hand and it is kept, with a warning saying why.

This is a deliberate change from earlier versions, which regenerated nothing and
made "I edited the script and re-ran and nothing happened" the most common
confusion with the tool. It is also what the sibling `bootstrap-mdbook` script
does, so the two now behave the same rather than merely starting the same.

### Upgrading a blog made by an older script

Run the new script against the folder; that is the whole procedure. Two things
happen automatically:

- `templates/macros.html` is removed. It holds Tera v1 macros, which Zola 0.23
  cannot parse at all — `Unknown tag: macro` aborts the build before it reaches
  any other template — and `templates/components.html` replaces it. This is the
  one owned file removed without consulting the drift guard, because a
  hand-edited copy of it is equally unbuildable.
- Every other owned file is rewritten from the current script.

A blog whose manifest is intact upgrades without `REGENERATE_TEMPLATES`: the
guard compares on-disk against the manifest, not against what the new script
would write, so an untouched file is not drift. A blog old enough to predate the
manifest needs one `REGENERATE_TEMPLATES=true` run.

### The drift guard

A re-run that would overwrite a script-owned file you have changed stops first
and names the file:

```
these files have been changed since this script last wrote them, and a re-run
would overwrite them:
  - templates/base.html

they are script-owned: change the matching render_* function or a configuration
variable rather than the file. to overwrite them anyway, set REGENERATE_TEMPLATES=true
at the top of the script and run again. nothing has been changed.
```

Note what is being compared. `.zola-blog-setup.manifest` records a sha256 for
every owned file as the last run left it, and the check is against **that**, not
against what this run would write. The two are different questions and only the
first is the right one: every owned file differs from what a newer script would
write, and so does `config.toml` the moment you change any configuration
variable — so comparing would-write against on-disk would flag exactly the
updates this mode exists to apply. A file that still matches what the last run
left is not a hand edit, whatever this run intends to put there.

Two cases where you will see the guard legitimately:

- **A blog old enough to have no manifest.** A hand edit cannot be told from an
  ordinary update, so every owned file is listed. The message says so. Run once
  with `REGENERATE_TEMPLATES=true bash zola-blog-setup.sh` — no file to edit and
  no line to set back.
- **You edited a template to try something.** Move the change into the
  `render_*` function that writes that file, and the guard goes quiet.

The manifest is tracked rather than gitignored, so it travels with the repo and a
checkout restores a consistent pair. If neither `sha256sum` nor `shasum` is
present the guard cannot run; it says so and does not block.

### Regenerating a single file

Usually unnecessary now — a re-run regenerates everything script-owned. But the
script can still be sourced without executing, which is useful for reading one
file's output without touching the blog:

```bash
bash -c 'source zola-blog-setup.sh; render_base_html' | less
```

`render_base_html`, `render_page_html`, `render_components`, `render_site_config`,
`render_readme`, and the rest are all callable this way. Some read shell
variables — `render_site_config` needs `BASE_URL` and friends set, and will
write empty values otherwise — so check the `# Vars:` note above the function
before you use it. `render_base_html` reads nothing and is safe bare.

If you do write one out by hand, the manifest will no longer match and the next
run will stop and tell you. That is the guard working.

## Writing posts

A post is one Markdown file in `content/`, with TOML front matter between `+++`
fences:

```markdown
+++
title = "a post"
date = 2026-01-14
updated = 2026-02-02
[taxonomies]
tags = ["writing", "meta"]
+++

The first paragraph.
```

- `date` is what makes a file a post. A page without one gets no post furniture:
  no date line, no contents box, no newer/older navigation.
- `updated` is optional. When present and different from `date`, the header
  shows both, and the home feed re-sorts by it — `content/_index.md` sets
  `sort_by = "update_date"`, so bumping `updated` pulls a post back to the top.
  Leave it off for a typo fix and the post keeps its place.
- `tags` are optional and drive `/tags/`, per-tag pages, and per-tag feeds.

The home page shows the **updated-or-published** date, which is the field it
sorts on. Printing `date` there instead gave a list ordered by one field and
labelled with another: a revised post sat at the top of the page showing an older
date than the post beneath it.

### The links at the foot of a post

Each post ends with `← newer:` on the left and `older: →` on the right, the same
words the home page's pager uses. They come from Zola's own `page.lower` and
`page.higher`, which are the entries either side of this post in the section's
sorted list. Date sorting runs newest-first, so `page.lower` is the newer post
and `page.higher` is the older one.

Both follow whatever `sort_by` is set to in `content/_index.md` — the same
ordering the home page uses, because Zola fills the list and the neighbour links
from one sorted array. With the default `sort_by = "update_date"`, editing a post
and bumping its `updated` field moves it in both places together.

The newest post has no newer neighbour, so its left slot carries a link back to
the home page instead.

Earlier versions labelled these "next" and "previous" and claimed the two
followed the publish date while the home page followed updated-or-published. That
was wrong: the two orderings cannot diverge. The labels were also wired to the
opposite neighbours. Both are fixed as of v13.

There is no keyboard binding for these, and there cannot be one here.
mdBook's arrow-key navigation is JavaScript; this site ships `script-src 'none'`
and zero script files, and adding one would contradict the site's central claim.
What each post does carry is the no-JavaScript equivalent — `<link rel="next">`
and `<link rel="prev">` in the head. No mainstream browser still binds keys to
these, but readers, extensions, and crawlers use them, and they cost two lines
and no script.

Footnotes collect at the foot of the post with back-references
(`bottom_footnotes = true`). Write them as `text[^1]` and `[^1]: the note`.

Two more front-matter fields worth knowing: `slug` overrides the URL segment,
which otherwise comes from the filename; `draft = true` removes the post from the
build entirely.

### Unlisted pages

For a page that should exist and be linkable without appearing on the home page
or in the feed, put it in `content/pages/`:

```
content/pages/colophon.md     ->  /pages/colophon/
```

A title, no date, and that is all. It renders with no date line, no contents box
and no newer/older links — the same shape as the about page — and appears on no
index. Verified: built, absent from the home list, absent from `atom.xml`.

`content/pages/_index.md` ships with two keys and both are load-bearing:

```toml
sort_by = "none"
render = false
```

`render = false` means no `/pages/` index page is built, only the pages inside
it. `sort_by = "none"` is the part that actually makes this work, and the reason
the obvious approach does not.

**Do not put a dateless `.md` at the top of `content/`.** The home section is
`sort_by = "update_date"`, and Zola drops a dateless page from a date-sorted
section:

```
WARN  1 page(s) ignored (missing date or weight in a sorted section):
WARN  - .../content/colophon.md
```

No HTML file is written — and Zola still puts that page's URL into
`sitemap.xml`. `zola build` exits 0. So the published site advertises a URL that
404s to every crawler that reads the sitemap, and the only signal is a warning
on stderr.

This cannot be fixed in the sitemap template: `sitemap_entry` exposes nothing
that distinguishes a dropped page from a rendered one, and the one field that
looked promising (`updated`) is equally absent on a legitimate unlisted page. So
`./build` and the CI step both capture the build output and fail on that
warning instead. A dropped page turns the build red rather than shipping a
broken sitemap.

**Unlisted is not private.** `sitemap.xml` names every page that exists, so an
unlinked page is public, just harder to stumble on. `draft = true` is the only
way to keep something out of the build.

### Links and deep links

Internal links use Zola's `@/` syntax, a path from the `content/` directory:
`[the second post](@/second-post.md)`. Broken internal links are build errors by
default, so a typo fails loudly instead of shipping a dead link. That is the
whole reason to prefer `@/` over writing `/second-post/` by hand.

Every heading gets an id, slugified from its text, so `## Ingredients and tools`
becomes `#ingredients-and-tools`. Link to one from the same page with
`[the ingredients](#ingredients-and-tools)`, and to one in another post by
combining the two: `[the method](@/recipes/sourdough.md#method)`.

Pin an id yourself with a `{#…}` suffix on the heading line:

```markdown
## Ingredients and tools {#ingredients}
```

Worth doing on any heading you expect to reword. Zola's docs make this the
recommended way to keep deep links stable, precisely because the automatic id
follows the text.

There are no visible anchor links beside headings. `insert_anchor_links` in
`[markdown]` turns them on — `"left"`, `"right"`, or `"heading"` — but Zola's
default anchor template is a 🔗 emoji, which will look wrong here. Override it
with a `templates/anchor-link.html` if you want them.

External links get `target="_blank" rel="nofollow noopener noreferrer"`
automatically; you do not add anything.

To put a page in the top navigation, add it to `header_nav` in `config.toml`:

```toml
header_nav = [
    { name = "about", url = "/about/" },
    { name = "notes", url = "/notes/" },
]
```

The target has to exist. For a static page at `/links/`, create
`content/links/_index.md` with a `title` and a body and no `date` — the same
shape as the about page.

### Code blocks

A fenced block needs a language tag to be highlighted; a bare fence gives you
plain monospace by design. Beyond that, Zola takes per-block annotations after
the language:

````markdown
```python,linenos,hl_lines=2 4-5
def greet(name):
    print(f"hello, {name}")   # highlighted
    return None

def farewell(name):           # this range
    print(f"bye, {name}")     # is highlighted too
```
````

- `linenos` numbers the lines, `linenostart=20` sets the first number.
- `hl_lines` takes 1-indexed inclusive ranges separated by spaces. It renders
  through the `pre mark` rule, tinted with `--mark-bg`; keep that low-contrast
  or highlighted code stops being readable.
- `hide_lines` drops lines from the output entirely, for setup you do not want
  on the page.
- `name=mod.rs` labels the block.

Theme names come from Giallo's built-in list, not from anywhere else. Rendering
is inline by default: colours land on the `<pre>` and on every token span as
`color: light-dark(#076678, #83A598)`, which follows the reader's scheme with no
JavaScript and no second stylesheet. That is why nothing links a
`giallo-light.css`; there isn't one unless you set
`markdown.highlighting.style = "class"`.

**That inline style is why the code block's ground is not a theme token.** An
inline `style` attribute beats any selector in the stylesheet, so a
`background` declared on `pre` would never reach a highlighted block — it would
be a dead token pretending to be a knob. The code-block ground belongs to the
highlighting theme; change it by changing `LIGHT_CODE_THEME` /
`DARK_CODE_THEME`, not by editing the palette. `--code-bg` is still real, but it
does table headers and the subscribe button.

The one place the stylesheet takes the code block back is print, where it has to
use `!important` to do it — otherwise a reader whose browser keeps
`prefers-color-scheme: dark` while printing gets pale grey code on white paper.

Code blocks select normally — drag a word, a line, or a run that crosses from the
prose into the code. Earlier versions carried `user-select: all` on `pre`, which
made a single click select the whole block ready to copy. That value is atomic:
any selection touching the element expands to the entire element, so partial
selection was not merely awkward, it was impossible. On a prose blog, lifting one
command out of a five-line block is the more common act. If you want the
whole-block behaviour back, add `user-select: all` to the `pre` rule in
`templates/base.html` — and know what you are trading.

### Notes, collapsibles, and wide things

Four authoring extras, all plain HTML in the Markdown:

```markdown
<aside>

A smaller, muted passage with a rule down the side.

</aside>

<details>
<summary>show the derivation</summary>

Hidden until the reader opens it.

</details>
```

**The blank lines are load-bearing.** CommonMark ends a raw HTML block at the
first blank line, and only what comes after it is parsed as Markdown. Written
tight —

```markdown
<aside>
A note with *emphasis*.
</aside>
```

— the whole thing is one HTML block and you get literal asterisks on the page.
This is a Markdown rule, not a Zola one, and it applies to any raw HTML block
you write.

For width:

- `<div class="wide" hidden></div>` anywhere in a post widens that whole page,
  running text included.
- `class="bleed"` on a single figure, table, or div lets that one element use the
  extra width while the text column stays put. A `<figure class="bleed">` needs
  no extra handling; the stylesheet cancels the 40px side margins browsers give
  figures, which would otherwise eat 80px of the bleed.

Both in one post: `.bleed` wins and the text column stays narrow. The ceiling for
both is `--wide` (62rem); the text column is `--measure` (42rem).

## Photos and metadata

`static/` is copied to the built site byte for byte. Nothing strips anything.

A photo taken on a phone carries EXIF: GPS coordinates, device model, capture
time. Dropped into `static/` and rendered into a 120px circle, it looks exactly
like the placeholder and publishes all of it, at full resolution. For a personal
blog the about-page photo is disproportionately likely to have been taken at
home.

So the about page has two keys:

```toml
[extra]
avatar_photo = "about/me.jpg"   # a file beside content/about/_index.md,
                                # named relative to content/
avatar = "avatar.svg"           # a file in static/
```

`avatar_photo` goes through Zola's `resize_image`, which discards all EXIF, XMP,
and IPTC metadata as part of re-encoding, and writes the result to
`static/processed_images/` under a hash of its arguments. That directory is
gitignored; the build regenerates it. `avatar_photo` wins when both are set.

**Note the path.** `resize_image` resolves relative to the content directory and
has no per-page lookup, so a bare `avatar_photo = "me.jpg"` for a file sitting
beside `content/about/_index.md` is **not found and fails the build**:

```
ERROR Reason: `resize_image`: Cannot find file: me.jpg
```

Write `about/me.jpg`. Pointing it at a `static/` path is the other usual
mistake.

The same applies to photos in posts: colocate them and pass them through
`resize_image`, or strip them first —

```bash
exiftool -all= photo.jpg      # Debian/Devuan: libimage-exiftool-perl
```

`resize_image` handles raster formats only. SVG passes through untouched, which
is why the placeholder uses the `avatar` key.

## The reading theme

The entire stylesheet is a single `<style>` block in `templates/base.html`,
split into two halves by a comment fence:

- **YOUR DESIGN** — fonts, the colour tokens, sizes, and the look of headings,
  links, code, and quotes. Copyable as a unit: hand the block to an LLM with
  "restyle this to X" and paste the result back.
- **STRUCTURE** — layout and components. Reads the tokens above, so a recolour
  up top follows through. Edit with care.

The tokens worth knowing:

- `--measure` (42rem) and `--wide` (62rem) — the text column and the ceiling for
  `.wide`/`.bleed`. 42rem is 672px of content: about 79 characters per line in
  Charter at the shipped body size, or 2.75 lowercase alphabets. Bringhurst puts
  the satisfactory range at 45–75 with 66 ideal, so that is at the wide end, and
  narrowing it is the change to consider rather than widening. What holds it
  where it is, is code: `pre` scrolls horizontally rather than bleeding, and
  42rem shows about 66 monospace columns where 36rem would show 56. On a blog
  that carries shell and config, that is the binding constraint.
- `--border` and `--border-strong` — two hairline weights. The strong one carries
  H1/H2 rules, `<hr>`, section titles, and the rule that closes a post's head;
  the weak one does tables, quotes, and boxes. Drawing a heading rule at the box
  weight is what makes a page look slightly out of focus.
- `--hairline` — the shorthand those heading rules use. Set it to `none` and
  every one of them disappears at once.
- `--accent` — one colour on the page, used for inline code. `#b5540a` light,
  `#ffb454` dark.
- `--inline-bg` / `--inline-border` — inline code sits inside running text and
  needs to read against both the page and the line, so it gets its own ground
  rather than reusing the table ground.
- `--wordmark-size` — the masthead name, and the logo box beside it in `image`
  mode. See "Size, alignment, and the rule".

### One rule at the head of a post

A post used to open with three hairlines inside its first 400px: one under the
`h1`, one under the date line, one under the contents box. The `h1` on a post
carries `.post-title`, which cancels its rule; the rule under the date line is
promoted to `--hairline` and closes the head block — title *and* dates — as one
unit; the contents box is set off by whitespace instead of a fourth edge.

Section titles, tag pages, and headings inside the body keep their rules. This
is only about the stack at the top of a post.

Heading margins are in `em` of the heading's own size rather than `rem`. That
keeps the rhythm stable whatever base font size the reader has set, and it means
the same numbers mean the same thing here as in the sibling mdBook theme, which
rebases `rem` to 10px and therefore cannot share `rem` figures with anything.

### Dark by default

Dark is the palette, not the alternative. `:root` carries the dark tokens
outright and `LIGHT_THEME` decides whether a light half is written at all:

- `false` (default) — no light palette, and `color-scheme: dark`. The site looks
  the same to every reader whatever their OS is set to.
- `true` — the light tokens ship behind `@media (prefers-color-scheme: light)`
  and `color-scheme: light dark`, so the browser chooses.

There is no picker either way: a picker needs JavaScript or a cookie, and the
site has neither. The background is painted on `html` only, never `body` —
painting both produces a two-tone column/gutter seam under a browser's
force-dark heuristic.

Two things had to follow the site rather than the reader's OS, and both are
easy to miss:

**Code blocks.** Giallo writes `color-scheme: light dark` *inline* on every
`<pre>`, and `light-dark()` resolves against the element's own value — so an
inline declaration beats the `dark` inherited from `:root`, and a reader on a
light OS would get the light GitHub theme on a `#111` page. With `LIGHT_THEME`
false the stylesheet takes it back with `pre { color-scheme: dark !important; }`.
An important author declaration does beat a normal inline one; nothing weaker
would.

**`static/avatar.svg`.** It carries its own `prefers-color-scheme` rule, so on a
dark-only site a light-OS reader would get a `#f4f2e8` square on the about page.
With `LIGHT_THEME` false it is drawn with the dark values and no media query.

`static/favicon.svg` deliberately keeps its media query. That one lives in the
browser's tab bar, which is chrome and does follow the OS.

If dark mode looks wrong on your own machine and right everywhere else, suspect
the desktop rather than the CSS. XFCE does not always expose a colour-scheme
preference over the freedesktop portal, so the browser guesses from the GTK
theme. Test with DevTools' colour-scheme emulation, not the native preview.

### The footer sits on the floor

`body` is a three-row grid — head, content, footer — with the middle row taking
the slack and `min-height: calc(100dvh - 4rem)`, so on a page too short to fill
the window the footer lands on the bottom instead of floating halfway up. On a
long page it changes nothing. `100dvh` rather than `100vh`: on a phone `vh`
counts the browser chrome and would push the footer out of sight. The `4rem` is
`body`'s own top and bottom margin.

Printing forces black on white regardless of the reader's scheme.
`prefers-color-scheme` still reports dark when printing in some browsers, and the
UA drops backgrounds but keeps colours, so without that override a reader in dark
mode prints near-white text onto white paper.

## Charter fonts

The theme names Charter first and falls back through Palatino, Book Antiqua,
Noto Serif, Liberation Serif, and Georgia.

How the fallback reads depends entirely on which of those the reader has, and the
spread is wider than "acceptable" suggests. Measured in the shipped 42rem column
at the shipped body size, counting letters and spaces: Charter gives about 79
characters per line, Palatino 76, DejaVu Serif 68, and a Times-metric face such
as Liberation Serif about 85. On a stock Linux desktop the last is the likely
one, and 85 is past any classical measure. Install the fonts; do not treat the
fallback as finished.

To self-host it properly, put four files in `static/fonts/`:

```
charter_regular.woff2
charter_italic.woff2
charter_bold.woff2
charter_bold_italic.woff2
```

`static/fonts/README.txt` names the source. The `@font-face` rules use
`get_url()`, so they resolve correctly under a project-path `base_url`
(`https://user.github.io/repo/`) as well as at a domain root. There is no font
CDN and adding one would be the single largest privacy regression available to
you: a font request tells the CDN the reader's IP and the page they are on.

Note that `static/fonts/README.txt` is inside `static/`, so it is published at
`/fonts/README.txt` along with everything else there. Harmless, but delete it
once the fonts are in place if you would rather it were not on the site.

## Git identity and keys

Two things to settle before the first push, both easier to get right now than to
fix afterwards.

**Your commit identity.** Every commit records a name and an email, and on a
public repo both are in the history permanently, visible to anyone who clicks a
commit. Choose accordingly:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

`--global` sets it for every repository on the machine. To use a different
identity for this blog only, run the same two commands from inside the blog
folder without `--global`; that writes to the repo's own config and wins there.

This matters more than it looks on this particular site. If you turn on
`SHOW_HISTORY_LINK`, every post carries a link to its commit log, so you are
inviting readers into exactly the place that email is displayed.

**SSH.** The remote that setup writes is an SSH one (`git@github.com:USER/REPO.git`),
because GitHub no longer accepts passwords for git. If you have pushed to GitHub
from this machine before, you already have a key and can skip this. Otherwise:

```bash
ssh-keygen -t ed25519 -C "you@example.com"
```

Accept the default path (`~/.ssh/id_ed25519`) by pressing Enter. A passphrase is
optional. Then print the public half — the private one never leaves the machine —

```bash
cat ~/.ssh/id_ed25519.pub
```

— copy the whole line, and paste it at **github.com/settings/keys** under New SSH
key. Confirm it took:

```bash
ssh -T git@github.com
```

## Push to GitHub

With `GIT_REPO_URL` set, the workflow and remote are already in place. Then:

1. Create the repo on GitHub, empty — no README, no `.gitignore`, no licence.
   Any of those gives the remote its own initial commit that collides with the
   one setup made locally.
2. Push:

   ```bash
   cd myblog
   git push -u origin main
   ```

3. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. Not
   "Deploy from a branch". This is the most common first-run failure.

The workflow triggers on pushes to `main` or `master` and on manual dispatch.
Permissions are least-privilege: `contents: read` for the checkout, with
`pages: write` and `id-token: write` because `deploy-pages` requires them.
Nothing pushes to a branch.

You will find advice elsewhere telling you to set Settings → Actions → General →
Workflow permissions to "Read and write". Do not. The workflow declares what it
needs, and the deploy goes through the first-party Pages action with OIDC. That
repository-wide setting would grant write access to every workflow in the repo,
including any you add later, for no gain here.

Everything the workflow depends on is pinned: the action SHAs, the runner image
(`ubuntu-24.04`), the Zola version, and the sha256 of the Zola tarball. That last
one is a constant recorded in the repo at setup time, not a digest fetched
alongside the binary at build time — a version tag names a file, not its
contents. If the release asset is ever substituted, the build goes red instead of
publishing. There is no skip path in CI: a build that cannot verify its builder
should fail.

Adding a licence: do it after the first push, so it lands as a normal commit.

## Custom domain

Optional, and the only part of this that costs money — roughly 10 to 20 dollars a
year for a common TLD. HTTPS on it is still free: certificates provision
automatically through Let's Encrypt once DNS resolves, usually quickly but
occasionally up to a day.

1. Settings → Pages → Custom domain, enter the domain, save.

   No `CNAME` file appears in the repo, and none is needed. GitHub's docs are
   explicit: publishing from a custom Actions workflow — which is what this
   script writes — creates no `CNAME` file, and any existing one is ignored. The
   domain lives in the Pages configuration. (Publishing from a *branch* is the
   case where GitHub commits a `CNAME`; that is not this setup, so there is
   nothing to pull before your next push.)
2. At your registrar, add a CNAME record pointing your domain at
   `USER.github.io`. If the registrar will not put a CNAME on a bare domain, use
   A and AAAA records to GitHub's published Pages addresses instead.
3. Set `CUSTOM_DOMAIN="https://yourdomain.com"` in the script's configuration
   block, re-run, and push.

Step 3 is not optional. `base_url` is what every `get_url()` call resolves
against, so leaving it pointing at the old address gives you a site that loads
and then fetches its stylesheet, favicon, and feed from `github.io`.

Set it in the script, not in `config.toml`: `config.toml` is script-owned and
rewritten on every run, so an edit there survives until the next run and then
does not. `CUSTOM_DOMAIN` replaces the derived `base_url` and nothing else — the
per-post source and history links still point at the repo, which is where the
files actually are.

## Email subscription

A static site cannot send mail, so subscription is a plain no-JS form that POSTs
to a newsletter provider you control. Off by default.

1. Make an account with a provider that offers a plain HTML form — Buttondown,
   Mailchimp, EmailOctopus — and create a list.
2. Copy its form-POST URL and its email field name (usually `email`; Mailchimp
   uses `EMAIL`).
3. Set them in the script's configuration block and re-run:

   ```bash
   readonly ENABLE_SUBSCRIBE=true
   readonly SUBSCRIBE_ACTION="https://..."
   readonly SUBSCRIBE_FIELD="email"
   ```

   Not in `config.toml` — that file is script-owned and rewritten every run.

The URL must be `https://`. Setup refuses a plaintext one outright rather than
warning, because the form carries other people's email addresses and there is no
version of that trade worth making.

The form appears on the home page, at the foot of every post, and at the foot of
every section such as `/about/` — not on tag pages or the 404. It used to be home
only, which meant a reader arriving at a post from a link, which is most readers,
never saw it. It is defined once as a `subscribe` component in
`templates/components.html` and called from the three templates.

Tera v2 components are hygienic: `config` is not visible inside one, so the
component takes `config.extra` as a parameter. Referring to `config` directly
would be a build error, not an empty string.

Turning subscription on also widens the page's `form-action` policy to exactly
that URL. With it off, no form on the site can submit anywhere at all. The form
carries `rel="noopener"`; modern browsers already imply that for
`target="_blank"` on a `<form>`, so it is belt and braces rather than a fix.

If you would rather not collect addresses at all, `/atom.xml` is already there,
already linked from `<head>` and from the nav, and costs a reader nothing.

## What the CSP allows

`templates/base.html` carries a Content-Security-Policy in a `<meta>` element:

```
default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action ...
```

`connect-src`, `font-src`, `frame-src`, and `media-src` all fall back to
`default-src 'self'`, so nothing loads from anywhere but your own origin. A
third-party image is blocked *before* the request is made, so no other party ever
learns a reader's IP address.

`style-src` needs `'unsafe-inline'`, and moving the stylesheet into an external
file would not remove that need. The highlighter writes `style="…"` attributes
onto every `<pre>` and every token span inside it, and inline style *attributes*
are governed by `style-src-attr`, which falls back to `style-src`. So
`'unsafe-inline'` is the price of syntax highlighting here, not of the inline
`<style>` block — worth knowing before you refactor the stylesheet expecting to
tighten the policy.

Two directives are deliberately handled the way they are:

- `form-action` is spelled out because it is one of the few directives that does
  **not** fall back to `default-src`. Omit it and the policy places no
  constraint on form submission at all.
- `frame-ancestors` is deliberately absent. Browsers ignore it in a `<meta>`
  element, and GitHub Pages cannot set response headers, so there is no
  arrangement in which it does anything here except log a console warning on
  every page load. Clickjacking protection on this host is not available; saying
  so is better than a directive that implies it.

### The policy is omitted under `zola serve`, and only there

`script-src 'none'` blocks *every* script, including the `livereload.js` that
`zola serve` injects into each page it hands out. With the meta tag present
unconditionally, the console said:

> Refused to load the script `http://127.0.0.1:1111/livereload.js` because it
> violates the following Content Security Policy directive: "script-src 'none'"

— and the local preview never reloaded. Every save needed a manual refresh, which
is the one thing the preview exists to avoid.

`zola serve` rewrites `base_url` to the loopback address it is listening on, so
the template tests for that and omits the policy there. A built site never
matches, so what deploys is unchanged. If you want to see the policy locally,
`./build` and serve `public/` yourself.

Embedding a YouTube video, a CDN image, or a hosted comment widget means widening
this, and widening it hands your readers to whoever you embedded. That is a real
trade, not a formality.

One thing this does not cover: nothing on the site is private. `content/pages/`
keeps a page off the home listing and out of the feed, but the sitemap still
enumerates it, so an unlinked page is public — just harder to stumble on. And GitHub Pages logs visitor IPs regardless of anything in the repo
— the policy above is about third parties, not about your host.

## Update Zola

```bash
bash zola-blog-setup.sh update-zola
```

Installs the newest release inside the supported band into `$HOME/.local/bin/zola`
and prints its digest. A release past the ceiling is refused rather than
installed — see "The Zola version band".

Existing blogs do not follow. Their workflows are pinned on purpose. To move one:
bump both the version and the sha256 in `.github/workflows/deploy.yml`, then
commit and push. The digest is the sha256 of the Linux x86_64 tarball for that
tag; `update-zola` prints the release page URL so you can fetch and hash it, or
re-run setup's host-update mode against the folder to have it re-pinned for you.

## Build it by hand

Install Zola yourself and write each file. The tree first:

```
myblog/
├── config.toml
├── content/
│   ├── _index.md
│   ├── about/_index.md
│   ├── pages/_index.md
│   └── hello-world.md
├── templates/
│   ├── base.html
│   ├── components.html
│   ├── index.html
│   ├── page.html
│   ├── section.html
│   ├── taxonomy_list.html
│   ├── taxonomy_single.html
│   ├── 404.html
│   └── atom.xml
├── static/
│   ├── favicon.svg
│   └── fonts/
├── .gitignore
├── .zola-blog-setup.manifest
├── serve
├── build
└── .github/workflows/deploy.yml
```

No `templates/sitemap.xml`. Zola's built-in already emits `<lastmod>` from
`updated`, falling back to `date`, which is everything an override would be for.

The manifest only matters if you later run the script against the folder. Built
by hand and kept by hand, you can skip it — the script will simply treat every
owned file as drifted the first time it sees the blog, which is correct.

### 1. Install Zola (pinned)

Pick a release, fetch it, record its digest, and install without root:

Open <https://github.com/getzola/zola/releases> and pick a **0.23.x** release —
anything from 0.23 up to but not including 0.24, for the reasons in "The Zola
version band". Take the asset whose name ends
`-x86_64-unknown-linux-gnu.tar.gz`; that shape is stable across releases even
though the version in it is not. Put the tag you chose in `ver`:

```bash
ver=<the tag you picked, e.g. v0.23.x>
url="https://github.com/getzola/zola/releases/download/$ver/zola-$ver-x86_64-unknown-linux-gnu.tar.gz"
curl -fsSL --proto '=https' --tlsv1.2 -o zola.tar.gz "$url"
sha256sum zola.tar.gz
tar xzf zola.tar.gz
mkdir -p ~/.local/bin && mv zola ~/.local/bin/
zola --version    # confirm it is inside the band
```

Keep that digest. It is what goes into the workflow in step 8. There is no
published `.sha256` to check it against — see "What 'verified' does and does not
mean here" — so this is a value you record, not a comparison you pass.

### 2. `config.toml`

```toml
base_url = "https://USER.github.io/REPO"
title = "Fieldnotes"
description = "one-line description"
author = "your name"
default_language = "en"

generate_feeds = true
feed_filenames = ["atom.xml"]
minify_html = true

taxonomies = [
    { name = "tags", feed = true },
]

[markdown]
external_links_target_blank = true
external_links_no_follow = true
external_links_no_referrer = true
bottom_footnotes = true

[markdown.highlighting]
light_theme = "github-light"
dark_theme = "github-dark"

[extra]
masthead = "text"
light_theme = false

show_toc = true
show_history_link = false
show_suggest_edit = false

source_url = ""
history_url = ""
history_hint = ""

enable_subscribe = false
subscribe_action = ""
subscribe_field = "email"
subscribe_blurb = "Get new posts by email."

header_nav = [
    { name = "about", url = "/about/" },
    { name = "tags", url = "/tags/" },
    { name = "rss", url = "/atom.xml" },
]

footer_links = [
    { name = "github", url = "https://github.com/USER/REPO" },
]
```

`base_url` with a repo path (`https://USER.github.io/REPO`) is the normal case
for a project Pages site. Every asset reference in the templates goes through
`get_url()` so it resolves under that prefix; hardcoding `/fonts/...` breaks the
moment the site is not at a domain root.

`author` is load-bearing: it is what the feed's `<author>` carries, and a feed
without one is invalid per RFC 4287. `light_theme` is read by `base.html`, which
writes the light palette, the `color-scheme` value, and the `pre` override from
it.

### 3. `content/`

`content/_index.md` — the home section, and where post ordering lives:

```markdown
+++
title = "home"
sort_by = "update_date"
paginate_by = 10
+++
```

`content/about/_index.md`:

```markdown
+++
title = "about"
[extra]
avatar_photo = ""
avatar = "avatar.svg"
+++

## who

your name. one or two sentences about what this site is for.

## contact

email: you@yourdomain.com
```

Then any number of posts as `content/*.md` with the front matter shown under
"Writing posts".

Note the asymmetry: `sort_by` and `paginate_by` belong to the *section*, not to
`config.toml`. Putting them in `config.toml` is silently ignored.

`sort_by` also takes `date`, `title`, `title_bytes`, `weight`, `slug`,
`permalink`, and `none`. The default here is `update_date` so that revising a
post can lift it back to the top; `date` is the conventional blog ordering if you
would rather an edit never move anything, and it has the side benefit of making
the home page and the post footer agree.

### 4. `templates/base.html`

This is the large one — the full page shell plus the entire stylesheet, about
19KB. It is the file where writing it by hand is least useful and most
error-prone, since it is one contiguous block with no decisions in it.

Take it from the script rather than retyping it:

```bash
bash -c 'source zola-blog-setup.sh; render_base_html' > templates/base.html
```

`render_base_html` reads no shell variables, so this is safe to run in isolation.
Then read it top to bottom — that is the audit the hand path is for — and edit
the YOUR DESIGN block to taste.

If you would rather not touch the script at all, the shape is: `<head>` with
charset, viewport, `color-scheme`, the CSP (wrapped in the `starting_with` test
that omits it under `zola serve`), `referrer: no-referrer`, title, favicon link,
feed link, a `head_extra` block for per-template `<link>`s, and the `<style>`
block; then `<body>` with `header.masthead` (the brand, gated on
`config.extra.masthead`, and `config.extra.header_nav`),
`<main>{% block content %}{% endblock %}</main>`, and
`footer` iterating `config.extra.footer_links`.

### 5. The other templates

`components.html` defines two Tera v2 components. `post_list(pages)` is used by
the home page, the section pages and the tag pages; it prints
`(page.updated or page.date)`, matching the sort. `subscribe(extra)` is the
newsletter form, called from `index.html`, `page.html` and `section.html`.
Components are registered globally, so nothing imports this file — and they are
hygienic, so `subscribe` takes `config.extra` as a parameter rather than reading
`config` itself. `index.html` extends `base.html`, renders a `.visually-hidden`
h1, the description, the paginated post list, the pager, and the subscribe form.
`index.html` is also the only template that fills `masthead_extra`, the block
inside `<header>` that carries the strapline. `page.html` renders a post: title
(with `.post-title`), date line, optional history/edit links, the contents box,
the content, tags, and newer/older navigation from `page.lower` /
`page.higher`, plus `<link rel="next">` and `<link rel="prev">` through the
`head_extra` block, and the subscribe form at the foot. `section.html` and the
two taxonomy templates are thin wrappers around the same component. `404.html` is four
lines. `atom.xml` overrides Zola's built-in to keep the markup minimal, and
carries a feed-level `<author>` because `page.authors` is populated only from a
front-matter `authors` key that no post here sets.

Same extraction trick for each:

```bash
source zola-blog-setup.sh
for t in index page section 404; do render_${t}_html > "templates/$t.html"; done
for t in components taxonomy_list taxonomy_single; do render_$t > "templates/$t.html"; done
render_atom_xml > templates/atom.xml
```

Note the naming is not uniform: `components`, `taxonomy_list`, and
`taxonomy_single` have no `_html` suffix, the other five do. Sourcing the script
rather than `bash -c`-ing each call keeps this to one read of the file.

### 6. `static/`

`favicon.svg` is a bare letterform on a transparent ground, using a fallback
serif stack, with a `prefers-color-scheme` rule inside it so the ink inverts in
dark mode. `avatar.svg` does *not* get that rule when `LIGHT_THEME` is false —
it sits on the page and has to follow the site, not the reader's OS. `logo.svg` only if you set `masthead = "image"` — a flat silhouette on
a transparent ground, since it is painted as a mask. `fonts/` holds the four
Charter woff2 files if you have them. Nothing else is required.

### 7. `.gitignore`, `serve`, `build`

```
/public
/static/processed_images

.DS_Store
._*
.AppleDouble/
Thumbs.db
Desktop.ini
*~
```

`serve` and `build`, both `chmod +x`:

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec zola serve --open
```

```bash
#!/usr/bin/env bash
cd "$(dirname "$0")"
exec zola build
```

The `cd "$(dirname "$0")"` is the point: `~/myblog/serve` then works from
anywhere.

Both are needed, and `./build` is not redundant with `./serve`. `zola serve`
writes only *assets* into `public/` and keeps HTML and XML in memory — there is a
`--store-html` flag precisely because that is not the default — and it rewrites
`base_url` to the loopback address, so every canonical URL, feed link, and
sitemap entry you see in the preview is a localhost one. `./build` is the only
local way to exercise the production `base_url` before you push. It also deletes
`public/` first, which cleans up the partial tree a `serve` run leaves behind.

### 8. `.github/workflows/deploy.yml`

```yaml
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
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - name: Build with Zola $ver (pinned)
        run: |
          set -euo pipefail
          url="https://github.com/getzola/zola/releases/download/$ver/zola-$ver-x86_64-unknown-linux-gnu.tar.gz"
          curl -fsSL --proto '=https' --tlsv1.2 -o zola.tar.gz "$url"
          echo "PASTE_THE_SHA256_FROM_STEP_1  zola.tar.gz" | sha256sum -c -
          tar xzf zola.tar.gz
          ./zola build
      - name: Upload artifact
        uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa # v3
        with:
          path: public
  deploy:
    needs: build
    runs-on: ubuntu-24.04
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4
```

No `fetch-depth` and no `submodules`: nothing in the build reads git history or
a submodule, and a full-history checkout on a long-lived blog gets slower every
year. Pin the runner image alongside everything else — it is the last input that
can shift under an otherwise-green build.

Substitute `$ver` with the tag you installed in step 1 — the workflow is the one
place a literal pinned version belongs, because pinning is the point. It must be
a real release tag: if you are copying it from `zola --version` on a machine with
a distro-packaged Zola, check first, since a string like `0.23.1+dfsg` names no
release and the build will 404. The script's own `./build` guard against dropped
pages is worth copying into the run step too; see "Unlisted pages".

### 9. Build and preview

```bash
./serve     # http://127.0.0.1:1111, live reload
./build     # writes ./public, and refuses to finish if a page was dropped
```

Then follow "Push to GitHub" from step 1.

## Troubleshooting

**The theme edit did nothing.** You edited `templates/base.html` and it came
back on the next run, or you edited `render_base_html` and the run stopped. Both
are the same thing: `templates/` is script-owned. Edit the `render_*` function,
and if the file on disk has drifted, run once with
`REGENERATE_TEMPLATES=true bash zola-blog-setup.sh`. See "Re-running".

**The run stops listing files it would overwrite.** The drift guard. Either the
blog predates the manifest (one `REGENERATE_TEMPLATES=true` run), or you
hand-edited a script-owned file. See "The drift guard".

**`this script takes no arguments`.** Everything is configured in the block at
the top of the file. The only accepted tokens are `help` and `update-zola`.

**The blog appeared somewhere unexpected.** `PROJECT_DIR` defaults to
`$HOME/Desktop`, not the directory you ran from. Set it to `.` if you want the
old behaviour.

**`'...' exists but holds no config.toml`.** The target folder is there but is
not a blog this script made, so it will not write into it blind. Move it aside
or point `BLOG_NAME` somewhere else.

**Pages deploys but 404s, or the CSS is missing.** `base_url` does not match
where the site actually is. A project site lives at
`https://USER.github.io/REPO`, with the repo name in the path.

**The Actions run never starts.** Settings → Pages → Source is still "Deploy
from a branch". It has to be "GitHub Actions".

**The first push is rejected.** The repo was created with a README or licence,
so it has its own initial commit. Create it empty.

**`CUSTOM_DOMAIN` had no effect.** Check the run actually completed — a drift
guard stop exits before anything is written. Also check you set it in the script
and not in `config.toml`, which is regenerated.

**Setup stops with "could not hash the linux zola … build".** It could not fetch
the tarball to hash it. On a re-run this should not happen at all — the digest is
read back out of the existing `deploy.yml` — so seeing it on a re-run means the
pinned version changed. On a first run it is the network, or a tag that names no
asset. `ZOLA_SHA256_OVERRIDE=<sha256>` is the way past if you already hold it.

**"zola X is the latest release, but this script supports …".** The ceiling. A
Zola newer than this script's templates were written for would produce a blog
that does not build, so it refuses rather than installs, and nothing is created.
Either update the script, or pass `ZOLA_VERSION_OVERRIDE=<vX.Y.Z>` for a tag you
know works. See "The Zola version band".

**Unknown tag `macro` / `import`, or a template error about `%+` or
`default(value=…)`.** Tera v1 templates against Zola 0.23. Either the blog
predates the port and you have not re-run the script against it, or you are
hand-maintaining templates from an older version. Re-run setup; it removes
`templates/macros.html` and writes `templates/components.html`.

**CI builds with a different Zola than my machine.** Expected, and said out loud
during setup, when the local version is outside the band, does not name a release
tag, or could not be checked because the network was down. The pin governs the
deploy.

**A photo in a post shows up rotated.** That is EXIF orientation. Zola's
`resize_image` handles it correctly from 0.19 onward, well below the band, so
this should not occur on a supported version.

**`resize_image` says the file is not found.** Its paths are content-relative and
there is no per-page lookup, so a bare filename beside the page does not resolve.
Write `about/me.jpg`, not `me.jpg`.

**The masthead shows an empty box.** `masthead = "image"` with no
`static/logo.svg`. Setup warns about this at the end of a run.

**The logo fills the whole box as a solid block.** It is painted as a mask, so
any background inside `logo.svg` becomes ink. Use a flat silhouette on a
transparent ground.

**Markdown inside `<aside>` or `<details>` came out literal.** Missing blank
lines. See "Notes, collapsibles, and wide things".

**Dark mode looks wrong locally but right elsewhere.** XFCE's portal, not your
CSS. Test with DevTools colour-scheme emulation.

**Live reload does not fire.** If you have a blog scaffolded before v7, its
`base.html` carries the CSP unconditionally and `script-src 'none'` blocks
`livereload.js`. Re-run the script with `REGENERATE_TEMPLATES=true` once.

**`./build` fails with "the page(s) named above produced no HTML".** A page in
`content/` has no `date`, so Zola dropped it while still listing its URL in the
sitemap. Give it a date, or move it to `content/pages/`. See "Unlisted pages".

**The code block is light on a dark page.** A blog scaffolded before v9, or a
hand-built one missing `pre { color-scheme: dark !important; }`. Giallo's inline
`color-scheme: light dark` beats the inherited value. See "Dark by default".

**The avatar is a pale square on the about page.** Same cause, different file:
`static/avatar.svg` still carries its `prefers-color-scheme` rule. Re-run with
`REGENERATE_TEMPLATES=true`, or edit the file — note `avatar.svg` is not
script-owned, so a re-run will not fix it for you.

**The code block ignores my `--code-bg`.** It always will. The highlighter writes
its colours inline, and inline beats a selector. Change `LIGHT_CODE_THEME` /
`DARK_CODE_THEME` instead.

**An internal link fails the build.** That is `@/` doing its job. Fix the path;
do not switch to a bare URL to silence it.

**`zola: command not found` right after installing.** `~/.local/bin` is not on
your `PATH`. Add `export PATH="$HOME/.local/bin:$PATH"` to your shell profile and
open a new terminal.

**Two Zolas.** If you had already installed Zola through a package manager, the
copy in `~/.local/bin` is a second one, and `PATH` order decides which runs. That
is how you end up with a site that builds locally and fails in CI, or the
reverse. Pick one: keep the packaged version and update it that way, or remove it
and rely on the script's.

**A push asks for a password.** The remote is HTTPS rather than SSH. Fix it with
`git remote set-url origin git@github.com:USER/REPO.git`. GitHub stopped
accepting passwords for git; SSH is the path.

**`ssh -T` fails with "Permission denied (publickey)".** Either the key is not
registered with the host, or ssh is offering a different one. Check
`~/.ssh/id_ed25519` exists, confirm the public half is pasted into the host's SSH
keys page, and run `ssh -vT git@github.com` to see which key it actually tried.

**`./serve: Permission denied`.** The executable bit was stripped, usually by a
copy or an archive round-trip. `chmod +x serve build` from inside the blog
folder.

**"Theme does not exist".** The name under `[markdown.highlighting]` is not one
Giallo ships. A Zola older than 0.22 used to produce this too, but on a
current blog you will hit the template errors above first — the parse fails
before the config is reached.

**The subscribe form is not on my posts.** A blog scaffolded before the form
moved into a component. Re-run the script against the folder.

**Setup refuses a value in the configuration block.** All twelve are checked now,
not five: the booleans must be an unquoted `true` or `false`, and `PAGINATE_BY`
must be a whole number of at least 1. Earlier versions passed the unchecked ones
straight into `config.toml`, so `SHOW_TOC=yes` produced a successful run, a git
commit, and a TOML parse error at the next build.

## Command reference

From the folder holding the script:

| Command | What it does |
|---|---|
| `bash zola-blog-setup.sh` | Create or update `PROJECT_DIR/BLOG_NAME` from the configuration block. |
| `bash zola-blog-setup.sh update-zola` | Install the newest supported Zola release. |
| `bash zola-blog-setup.sh help` | The full command list. |

There are no flags. The configuration block is the interface:

| Variable | What it does |
|---|---|
| `PROJECT_DIR` / `BLOG_NAME` | Where the blog goes. |
| `GIT_REPO_URL` | `https://github.com/user/repo`; empty for a local blog. |
| `CUSTOM_DOMAIN` | Overrides the derived `base_url`. |
| `START_PREVIEW` | Open the preview when the run finishes. |
| `LIGHT_THEME` | `false` is dark for everyone; `true` follows the reader's OS. |
| `SITE_DESCRIPTION` | The strapline, feed subtitle and meta description; `""` hides the line. |
| `FAVICON_TEXT` | What the favicon draws; `""` writes none and leaves the file to you. |
| `PAGINATE_BY`, `SHOW_TOC`, `GENERATE_FEEDS`, `SHOW_HISTORY_LINK`, `SHOW_SUGGEST_EDIT` | Per-blog furniture. Booleans must be unquoted `true`/`false`. |
| `ENABLE_SUBSCRIBE`, `SUBSCRIBE_ACTION`, `SUBSCRIBE_FIELD`, `SUBSCRIBE_BLURB` | The newsletter form. `SUBSCRIBE_ACTION` must be `https://`. |
| `REGENERATE_TEMPLATES` | Overwrite script-owned files that have drifted. |
| `ZOLA_MIN_VERSION` / `ZOLA_MAX_VERSION` | The supported Zola band, `0.23` to `0.24` exclusive. |

Inside a blog folder:

| Command | What it does |
|---|---|
| `./serve` | Preview at `http://127.0.0.1:1111` with live reload. |
| `./build` | Build the finished site into `public/`. |

Environment:

Each applies to one run, so there is nothing to edit and set back:

| Variable | What it does |
|---|---|
| `START_PREVIEW=false` | Skip the live preview at the end of the run. |
| `REGENERATE_TEMPLATES=true` | Overwrite script-owned files that have drifted. |
| `ZOLA_VERSION_OVERRIDE=<vX.Y.Z>` | Install and pin this release instead of resolving the latest. |
| `ZOLA_SHA256_OVERRIDE=<sha256>` | Supply the digest pinned into CI instead of downloading that build to hash it. Rarely needed: a re-run reads it back out of `deploy.yml`. |

## Cost

Nothing, unless you want a domain. The `USER.github.io` address, the hosting, the
bandwidth, and HTTPS are all free at the scale a personal blog operates at. A
custom domain is roughly 10 to 20 dollars a year at a registrar, and HTTPS on it
is still free.

## Other platforms

macOS and Git-Bash-on-Windows are supported for setup: the platform is detected
and the matching Zola build installed (`$HOME/.local/bin` on macOS, `$HOME/bin`
on Windows). On Windows you need `unzip` rather than `tar`.

The CI workflow is Linux x86_64 only, which is what the runner is; it is not a
constraint on your machine.

For a host other than GitHub Pages, the build output is just `./public` — any
static host will serve it. What you lose is the pinned, verified workflow, which
you would need to rebuild for whatever CI that host uses.