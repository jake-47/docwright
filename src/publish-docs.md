# Publish a documentation site

This is the guide to the [bootstrap-mkdocs](./bootstrap-mkdocs.md) script. The script carries the plugin, the theme, the demo pages, the leak checker, the preview command and the CI workflow inside it, and writes them out when you run it. Its first run downloads the theme's typeface, Charter; see [The design](#the-design).

## What it does

The script creates a MkDocs documentation project that builds one set of Markdown sources once per audience: **internal**, **partner**, **beta** and **public**.
Every page says which audiences get it, as in `audiences: [public]`, and you can mark parts of a page with `<!-- audience: internal -->...<!-- /audience -->`; each build keeps or removes them.
Images, PDFs and other files go only into the builds whose pages link to them.

One run does everything: it creates the project, installs it, builds and checks every audience, then starts a live preview and opens it in your browser, the way `mdbook serve --open` and `zola serve --open` do once a project exists.
Ctrl-C stops the preview.

The filtering is done by a small MkDocs plugin, `mkdocs-audience`, which the script copies into the project at `plugins/mkdocs-audience/`.
Nothing has to be published first.
MkDocs, the Material theme and hatchling, the tool that packages the plugin for installing, come from PyPI.
So does fontTools, which corrects a value in Charter's files that some browsers misread.

This is not access control.
The repository holds every audience's content, so it must stay private.
Each build in `dist/<audience>/` is a separate static site; deciding who can reach the partner and beta sites is your web host's job.

## Before you start

You need:

- **Python 3.10 or newer.**
  Check with `python3 --version`.
  Expected output: `Python 3.` followed by a minor version of 10 or higher, such as `Python 3.11.2`.
- **Network access on the first run:** to PyPI, for MkDocs, Material, hatchling and fontTools, and to practicaltypography.com, for the Charter font.
  Later runs don't need it.
  If practicaltypography.com can't be reached, the run still finishes, and the site uses your system's serif font until a later run adds Charter; see [Troubleshooting](#troubleshooting).
- **Either uv or Python's venv module.**
  - If `uv --version` prints a version, the script uses uv and needs nothing else.
  - Otherwise it uses `python3 -m venv`.
    On Debian and Devuan that needs the `python3-venv` package.
    If it's missing, the script offers to install it; see [Troubleshooting](#troubleshooting).
- **A folder for the project to go in.**
  By default that's your desktop folder, `~/Desktop`, and it must already exist.
  Check with `ls -d ~/Desktop`.
  Expected output: the folder's full path, such as `/home/you/Desktop`.
  On a desktop set up in another language the folder may have another name; see [Where the project goes](#where-the-project-goes).

## Quick start

1. Save the script as `bootstrap-docs.sh`, in any folder, for example `~/Downloads`.
   If the file you have is named `bootstrap-docs_v31.sh`, rename it there:

   ```bash
   mv bootstrap-docs_v31.sh bootstrap-docs.sh
   ```

   `mv` prints nothing.
2. Open `bootstrap-docs.sh` in a text editor and edit the CONFIG block at the top: `PROJECT_NAME` if you want a name other than `audience-docs`, and `PROJECT_DIR` if the project shouldn't go on your desktop.
   Save it.
   With another name, yours replaces `audience-docs` in the output and commands below.
3. Run it from a terminal, in the folder that holds it:

   ```bash
   bash bootstrap-docs.sh
   ```

   The output starts like this:

   ```
   [bootstrap] project: ~/Desktop/audience-docs
   [bootstrap] audiences: internal, partner, beta, public
   [bootstrap] prerequisites: ok (python 3.13.15; uv found, so no python3-venv needed)
   [bootstrap] .venv created with uv
   [bootstrap] wrote plugins/mkdocs-audience/pyproject.toml
   ```

   Your Python version may differ.
   Without uv, the third and fourth lines read `prerequisites: ok (python 3.x.y; using python3 -m venv)` and `.venv created with python3 -m venv`, and the install line below starts `[bootstrap] installed with pip:`.
   It continues with one `wrote ...` line per plugin file, then one line naming the installed versions (yours may be newer):

   ```
   [bootstrap] installed with uv: mkdocs-audience 0.4.0 (from ./plugins), mkdocs 1.6.1, mkdocs-material 9.7.7
   ```

   Then come one `wrote ...` line for each remaining file.
   Among them, these lines add the font:

   ```
   [bootstrap] installed fontTools and brotli in .venv, to correct Charter's files
   [bootstrap] adding Charter: downloading it from practicaltypography.com, checking and correcting it
   [bootstrap] wrote docs/assets/fonts/charter_regular.woff2
   [bootstrap] wrote docs/assets/fonts/charter_italic.woff2
   [bootstrap] wrote docs/assets/fonts/charter_bold.woff2
   [bootstrap] wrote docs/assets/fonts/charter_bold_italic.woff2
   [bootstrap] wrote docs/assets/fonts/LICENSE-Charter.txt
   ```

   If the download fails, two lines take the place of the last five, and the run carries on:

   ```
   [bootstrap] note: couldn't add Charter: couldn't download https://practicaltypography.com/fonts/Charter%20210112.zip (...)
     The site uses your system's serif font until a later run adds Charter.
   ```

   The text in brackets says why; see [Troubleshooting](#troubleshooting).
   The list ends with `[bootstrap] wrote bin/serve`, followed by a count of the files the script owns and the check of every audience:

   ```
   [bootstrap] files this script owns: 18 written, 0 updated, 0 already up to date
   [bootstrap] building and checking every audience: bin/check-leaks.py
   [check-leaks] internal: built; 6 pages checked; clean
   [check-leaks] partner: built; 6 pages checked (3 excluded); clean
   [check-leaks] beta: built; 6 pages checked (3 excluded); clean
   [check-leaks] public: built; 6 pages checked (4 excluded); clean
   [check-leaks] all audiences clean
   ```

   Without the font, the count reads `13 written`.
   Then it starts the preview:

   ```
   Done. Starting the internal preview. To start it again later:

     cd ~/Desktop/audience-docs
     bin/serve              the internal build, which shows everything
     bin/serve public       the public build (or partner, or beta)
     bin/serve all          every build at one address, as each audience gets it

   Before you publish, run bin/check-leaks.py. It rebuilds dist/<audience>/ and
   must end with "all audiences clean".

   [serve] internal preview on 127.0.0.1:8000; your browser opens once it's built. Ctrl-C stops it.
   INFO    -  Building documentation...
   INFO    -  Cleaning site directory
   INFO    -  Documentation built in 0.37 seconds
   INFO    -  [15:48:40] Watching paths for changes: 'docs', 'mkdocs.yml'
   INFO    -  [15:48:40] Serving on http://127.0.0.1:8000/ and opening it in a browser
   ```

   Once your browser has loaded the page, a line `INFO    -  [hh:mm:ss] Browser connected: http://127.0.0.1:8000/` follows.
   If the run couldn't add Charter, lines such as `WARNING -  [hh:mm:ss] "GET /assets/fonts/charter_regular.woff2 HTTP/1.1" code 404` come first, one for each font file the page asks for.
   They're harmless, and stop once a later run adds the font.
   With uv and its packages already cached, the whole run takes a few seconds; with pip, 15 to 30 seconds.
   On a first run over a slow connection, the install step can take a minute.
4. Your browser opens at http://127.0.0.1:8000/.
   You'll see:
   - a slim purple band across the top that reads "**Internal build.** Not for public release."
   - Material's teal header with your project name, beside a small logo of dark green bars
   - the demo homepage, set in a serif typeface, with three marked blocks: an internal note with a purple rule and the note "Internal only", a partner note with a blue rule and the note "Partner", and a beta note with an ochre rule and the note "Beta"
5. Edit a page under `docs/` and save it.
   The terminal prints `Detected file changes`, and the browser reloads with your change.
6. Press Ctrl-C in the terminal to stop the preview.
   The last line is `INFO    -  Shutting down...`, and your shell prompt returns.
   To start the preview again later:

   ```bash
   cd ~/Desktop/audience-docs
   bin/serve
   ```

   Expected output: the `[serve]` line and the `INFO` lines shown above, and your browser opens again.

## The CONFIG block

All settings live at the top of the script.
There are no command-line options; anything you put after `bash bootstrap-docs.sh` is ignored, and the script says so.

| Setting | Default | What it does |
|---|---|---|
| `PROJECT_DIR` | `$HOME/Desktop` | The folder the project folder goes in. It must exist. See [Where the project goes](#where-the-project-goes). |
| `PROJECT_NAME` | `audience-docs` | Name of the project folder, and the site title. Letters, digits, dots, hyphens and underscores only, not starting with a dot or a hyphen. For a title with spaces, change `site_name:` in `mkdocs.yml` and the heading at the top of `docs/index.md` afterwards. |
| `SITE_URL` | `https://example.com/` | The address the public site will live at. Used for canonical links and the sitemap; change it before you publish. |
| `COPYRIGHT` | `Copyright &copy; 2026` | Footer text. |
| `REPO_URL` | empty | Your Git repository's URL. When set, every build, public included, links to it from the header, so leave this empty while the repository is private. |
| `EDIT_URI` | `edit/main/docs/` | Path for "Edit this page" buttons. Used only when `REPO_URL` is set, and the buttons appear only if you also add `content.action.edit` under `theme.features` in `mkdocs.yml`. |
| `WANT_PARTNER` | `true` | Include the partner audience. |
| `WANT_BETA` | `true` | Include the beta audience. |
| `WANT_DESIGN` | `true` | The theme: the Charter typeface, Material's teal and orange, the green logo, the slim build band and the review marks in the internal build. See [The design](#the-design). |
| `WANT_DEMO` | `true` | Demo pages: API overview, partner guide, beta page, internal runbook. |
| `WANT_EXAMPLES` | `true` | The marker reference page, built only for internal. |
| `WANT_OVERRIDES` | `true` | The build banner on internal, partner and beta builds. |
| `WANT_CI` | `true` | A GitHub Actions workflow that builds and checks every audience on each push to `main` and on each pull request. |
| `WANT_LEAK_CHECK` | `true` | `bin/check-leaks.py`, which runs at the end of every run of the script, and `bin/serve all`, which needs it. Keep this on. |
| `WANT_STRICT` | `true` | `strict: true` in `mkdocs.yml`, so warnings fail the build. Keep this on. |
| `WANT_PIN` | `true` | Pin MkDocs and Material to the minor versions installed, in `requirements.txt`. |
| `WANT_SERVE` | `true` | When the run finishes, start the preview of the internal build and open it in your browser. `false` prints the commands instead. |

**internal** and **public** are always included.
internal is the review build that sees everything; public is the open site.

Each `WANT_` setting must be exactly `true` or `false`; anything else stops the script with an error naming the setting.

The preview starts only when the script runs in a terminal.
If its input or output is redirected, for example in CI or when you pipe it through `tee`, it prints `[bootstrap] note: no terminal (input or output is redirected), so the preview was not started` and the commands instead.

To add an audience of your own, such as `enterprise`, add it to the `audiences:` list in the generated `mkdocs.yml`.
Then tag the pages it should get, and the pages they link to.
With the demo pages, that's the homepage and the API overview it links to: add `enterprise` to `audiences:` in `docs/index.md` and in `docs/api/overview.md`.
Until a page is tagged for it, its build is empty, and `bin/serve all` leaves it out.
Its band and its marks in the internal build are grey.

### Settings for one run

Three settings can go in front of the command, for that run only:

- `WANT_SERVE=false bash bootstrap-docs.sh` finishes without starting the preview.
- `REGENERATE_OWNED=true bash bootstrap-docs.sh` replaces files the script owns even if you've edited them, keeping a copy of each first; see [Edits to the script's files](#edits-to-the-scripts-files).
- `CHARTER_ZIP="$HOME/Downloads/Charter 210112.zip" bash bootstrap-docs.sh` takes the Charter font from a copy of its release you saved yourself, instead of downloading it; the copy has to pass the same checksum.
  Use the path of the file you saved; a relative path counts from the folder you run the script in.

Every other setting is read from the CONFIG block only.

### Where the project goes

The project is created at `PROJECT_DIR/PROJECT_NAME`: with the defaults, `~/Desktop/audience-docs`.
The first line of the output names it, as in `[bootstrap] project: ~/Desktop/audience-docs`.

`PROJECT_DIR` takes any of these:

- a path starting with `$HOME`, as in the default `"$HOME/Desktop"`
- a path starting with `~/`, as in `"~/projects"`; the script expands it, though bash doesn't inside quotes
- an absolute path, as in `"/srv/docs"`
- a relative path, which counts from the folder you run the script in

The folder must exist; the script doesn't create it.
If it doesn't exist, the script stops before doing anything, with your own path in place of `/home/you/Desktop`:

```
[bootstrap] error: PROJECT_DIR (/home/you/Desktop) is not a folder that exists. Create it, or set
  PROJECT_DIR in the CONFIG block to one that does.
```

## Re-running the script

Run the script again at any time, with the same `PROJECT_DIR` and `PROJECT_NAME`.
It recognises the project from the small `.bootstrap-docs` file in it, and:

- reuses the virtual environment, skips installing when the packages are already there, and keeps the font files it added, so it works offline
- writes any of its files that are missing
- brings the files it owns up to date with this version of the script
- checks every audience again, then starts the preview

### Your files and the script's files

The project holds two kinds of files.

**Your files** the script writes once and never touches again: the pages under `docs/`, `mkdocs.yml`, `requirements.txt` and `.gitignore`.
Edit them freely.

**The script's files** it owns, and brings up to date on every run:

- the plugin, in `plugins/mkdocs-audience/`
- `bin/serve` and `bin/check-leaks.py`
- the theme: `docs/assets/styles/extra.css`, `docs/assets/favicon.svg` and the files in `docs/assets/fonts/`
- the banner template, `overrides/main.html`
- the CI workflow, `.github/workflows/build.yml`

A file whose feature you turn off in the CONFIG block stops being the script's: it stays where it is, and the script leaves it alone.
Turn the feature back on and the script owns the file again.

### Edits to the script's files

Each run records a checksum of every file the script owns in `.bootstrap-docs.manifest`.
Keep that file in Git.
The next run compares each owned file with its record before changing anything.
If you've edited one, the run stops, changes nothing, and names the file:

```
[bootstrap] these files don't match what this script last wrote there, so they may
[bootstrap] hold your edits, and this run would overwrite them:
    docs/assets/styles/extra.css
[bootstrap] to replace them with this version's files, keeping a copy of each in
[bootstrap] .bootstrap-docs-backup/, run once:
    REGENERATE_OWNED=true bash bootstrap-docs.sh
[bootstrap] to keep an edit instead, move your changes into a file of your own first
[bootstrap] (see the guide). Nothing has been changed.
```

There are two ways on:

1. To keep your change, move it into a file of your own, then run the command the message shows to put the script's file back.
   For styles, that's a stylesheet of your own; see [Changing the design](#changing-the-design).
2. To drop your change, just run the command the message shows.

`REGENERATE_OWNED=true` copies each file it replaces into `.bootstrap-docs-backup/<date>-<time>/` first, at the same path inside that folder.
The run then ends its list of files with a line naming the folder, such as `[bootstrap] copies of the files it replaced: .bootstrap-docs-backup/20261002-153331/`.
Git ignores the backup folder, through a `.gitignore` file inside it.
The script never deletes backups; remove the folder yourself once you no longer need it.

A run that stops partway, because the network failed or you pressed Ctrl-C, still records the files it wrote, so the next run doesn't mistake them for your edits.

### What else to know

- **The script writes back any of its files you deleted,** demo pages included.
  Once you've removed content you don't want, turn its setting off in the CONFIG block, for example `WANT_DEMO=false` and `WANT_EXAMPLES=false`, before you run the script again.
  Also delete those pages' entries under `nav:` in `mkdocs.yml` and the links to them in `docs/index.md`; otherwise the check fails with `A reference to '...' is included in the 'nav' configuration, which is not found in the documentation files.`
  Files with no setting, such as `docs/index.md`, `requirements.txt`, `bin/serve` and the plugin's files, always come back.
- **The check rebuilds each `dist/<audience>/` from scratch,** deleting everything in it except the hidden files and folders at its top level, whose names start with `.`.
  Put files you publish alongside the site, such as `CNAME`, in `docs/`.
  `CNAME`, `robots.txt` and `favicon.ico` go into every build, and any other file only into the builds whose pages link to it (see [Files other than pages](#files-other-than-pages)).
  Hidden ones, such as `.htaccess` or `.well-known/`, are skipped unless you add them to `exclude_docs` in `mkdocs.yml`, each with a leading `!`; then they go into every build.
  `exclude_docs` takes lines of text, not a YAML list:

  ```yaml
  exclude_docs: |
    !.well-known/
    !.htaccess
  ```
- **The script won't take over a folder.**
  If `PROJECT_DIR/PROJECT_NAME` exists, isn't empty and wasn't made by the script, the script stops without changing anything.
  An existing empty folder is used for the new project.

## What gets created

```
audience-docs/
├── .bootstrap-docs               marks the folder as made by the script
├── .bootstrap-docs.manifest      checksums of the files the script owns; keep it in Git
├── .gitignore                    keeps .venv/, dist/ and site/ out of Git
├── .venv/                        the project's Python environment
├── .github/workflows/build.yml   CI: builds and checks every audience
├── bin/check-leaks.py            builds every audience, fails on any leak
├── bin/serve                     previews one audience, or all of them
├── dist/                         the builds bin/check-leaks.py made, one per audience
├── mkdocs.yml                    site configuration
├── requirements.txt              what CI, and anyone else, installs
├── overrides/main.html           the build banner
├── plugins/mkdocs-audience/      the plugin itself, with its tests
└── docs/
    ├── index.md                  homepage, shared with every audience
    ├── api/overview.md           shared page with an internal-only block
    ├── integrations/partners.md  partner-only page
    ├── features/beta.md          beta-only page
    ├── operations/runbook.md     internal-only page
    ├── operations/rota.svg       image only the runbook uses, so only internal gets it
    ├── examples/audience-examples.md   marker reference, internal-only
    └── assets/
        ├── favicon.svg           the logo, also the browser-tab icon
        ├── fonts/                Charter, in four files the first run downloads, and its licence
        └── styles/extra.css      the theme
```

`.bootstrap-docs-backup/` appears only after a run with `REGENERATE_OWNED=true` has replaced something.

## How audiences work

### Marking content

A block, for content on several lines:

```markdown
<!-- audience: internal -->
## On-call runbook

Escalation: PagerDuty schedule `prod-oncall`.
<!-- /audience -->
```

Inline, inside a sentence:

```markdown
Your API key is <!-- audience: internal -->`sk_live_...` from the vault<!-- /audience --><!-- audience: public -->in your dashboard<!-- /audience -->.
```

A marker can name several audiences and exclude one with `!`:

```markdown
<!-- audience: partner, !beta -->
```

Markers match in any case, and with any spacing around the word and the colon.
They don't nest: close one before you open the next.
Each of these mistakes would let marked text reach every build, so each one stops the build and names the page:

- an opening marker that's never closed
- a closing marker with nothing to close
- a marker opened inside another
- a comment that looks like a marker but isn't one, such as `<!-- audiences: internal -->`, `<!--- audience: internal --->` or `<!-- audience internal -->`

The message names the page and quotes the marker, for example:

```
ERROR   -  mkdocs-audience: in api/overview.md, '<!-- audiences: internal -->' looks like an audience marker but isn't one, so the text it was meant to mark would reach every build. Write markers as <!-- audience: NAME --> and <!-- /audience -->.
```

### Page frontmatter

A page's frontmatter tags the whole page, as a YAML list:

```markdown
---
audiences: [partner]
---
```

Every page has to say who gets it.
A page that names no audiences stops the build, and the message lists every such page at once:

```
ERROR   -  mkdocs-audience: 1 page names no audiences, and every page has to say who gets it: notes.md. Add audiences: to each one's frontmatter, as in audiences: [public] for the open site or audiences: [internal] to keep it internal. To build untagged pages for public instead, set untagged: public in the audience plugin's settings in mkdocs.yml.
```

So a page whose tag you forgot can't reach the public build.
The `untagged:` line in the plugin's settings in `mkdocs.yml` sets this:

```yaml
  - audience:
      audiences: [internal, partner, beta, public]
      audience: public          # the build you get without MKDOCS_AUDIENCE
      untagged: error           # a page that names no audiences stops the build
```

- `error`, the default, stops the build.
- `internal` builds an untagged page for internal only.
- `public` builds it for internal and public, as v28 and earlier did.

The plugin finds frontmatter where MkDocs does, and reads the value generously:

- The block may end with `...` instead of `---`.
- MkDocs's other style works too: `audiences: partner` on the first line of the page, with no `---` lines, ended by a blank line.
- A comma-separated string, such as `audiences: partner, beta`, works as well as a list.
- The plugin matches the key in any case, so `Audiences:` works.

These mistakes would make a tagged page count as untagged, so each one stops the build and names the page, instead of publishing the page to public:

- frontmatter that names audiences but isn't valid YAML, such as `audiences: [partner` with the `]` missing
- an empty value, such as `audiences: []`
- a value that's neither a list nor a string
- a negated name, such as `audiences: partner, !beta`
- a key that is almost `audiences`, such as `audience` or `audeinces`
- on a page MkDocs reads no audiences from, a line in its first 60 lines, outside code, that looks like a tag: one in a block below the first line or never closed, one opened with `----`, one missing its colon, as in `audiences [partner]`, or one nested under another key

Frontmatter that doesn't mention audiences is left to MkDocs, so a page can still open with a horizontal rule.

The build stops with a message like this:

```
ERROR   -  mkdocs-audience: the frontmatter of integrations/partners.md is not valid YAML (line 4): expected ',' or ']', but got '<stream end>'. Fix it; until then the page would be treated as untagged and built for public.
```

`bin/check-leaks.py` catches the same mistakes before it builds anything:

```
[check-leaks] FAILED before building: these pages' tagging can't be trusted, so a build could
[check-leaks] publish them to the wrong audience. Fix them first:
    integrations/partners.md: frontmatter is not valid YAML: expected ',' or ']', but got '<stream end>'
```

A name that isn't in the `audiences:` list in `mkdocs.yml` prints a warning, which fails strict builds, the check and CI: `WARNING -  mkdocs_audience: undeclared audience 'partnr' in the frontmatter or file name of integrations/partners.md`, followed by the declared names.

Negation with `!` works in markers only.
In frontmatter, `!partner` stops the build with a message that says so, in a list or in a string.

### Who sees what

- **internal** sees everything, unless a marker excludes it with `!internal`.
- **partner** and **beta** see only what is tagged for them.
- **public** sees only pages tagged `public`, and on them, blocks tagged `public` and blocks whose marker only excludes others, such as `!beta`.
- On any page, text outside markers goes to every build that gets the page.

The marker rules, in order:

1. An empty marker (`<!-- audience: -->`) hides its content everywhere.
2. If the build's audience is excluded with `!`, the content is hidden.
3. The internal build shows everything else.
4. If the marker names audiences, only those see it.
5. A marker that only excludes, like `!beta`, shows to public.

To share a page with every outside audience, tag it `audiences: [public, partner, beta]`.
The demo homepage and API page do exactly that, which is why the partner and beta sites have a homepage.

### Linking to restricted pages

A link from a shared page to a page some audiences can't see would break in their builds, and strict mode fails the build on it.
Put such links inside a marker for the audiences that can see the target.
The demo homepage shows the pattern:

```markdown
<!-- audience: partner -->
**Partners:** start with the [Partner integration guide](integrations/partners.md).
It covers keys, webhooks and rate limits.
<!-- /audience -->
```

Pages a build excludes are also dropped from that build's navigation, so their titles never appear in it.

### Markers inside code

Markers are left exactly as written inside a fenced code block that starts at the left margin, and inside inline code in single backticks.
That's how the reference page shows them.
A closing marker shown in such code doesn't close the block around it either.
In code anywhere else, such as a fence inside a list item, an admonition or a blockquote, or inline code in double backticks, a marker is acted on like any other; see [Known limitations](#known-limitations).

### Files other than pages

An image, a PDF or any other file under `docs/` that isn't a page goes into a build only if a page in that build links to it.
The link can be Markdown, such as `![rota](rota.svg)`, or raw HTML, such as `<a href="spec.pdf">`, and it counts only if it survives the markers: a link inside an internal block brings its file into the internal build alone.
The internal build gets every file.

The demo shows this: only the runbook links to `docs/operations/rota.svg`, and the runbook is internal, so only `dist/internal/` holds the image.
Each other build logs the files it left out, as in `INFO    -  mkdocs_audience: left 1 file out of the 'public' build, as no page in it links to it: operations/rota.svg`.

These files go into every build whether or not a page links to them:

- anything under `docs/assets/`, where the theme's stylesheet, fonts and logo live
- `CNAME`, `robots.txt` and `favicon.ico` at the top of `docs/`
- a hidden file or folder you let in through `exclude_docs`, such as `.well-known/`
- the stylesheets and scripts `mkdocs.yml` lists under `extra_css` and `extra_javascript`, and the theme's `logo` and `favicon`
- any file a stylesheet that the build keeps refers to with `url()` or `@import`

Put files that templates or scripts use, rather than pages, under `docs/assets/`, or they're left out of every build but internal.

An entry under `nav:` in `mkdocs.yml` doesn't count as a link, because every build shares the nav.
If one points at a file a build leaves out, such as a PDF no page in that build links to, the build logs a warning, since the entry would be a broken link there:

```
WARNING -  mkdocs_audience: the nav links to files/spec.pdf, but no page in the 'public' build links to it, so the build leaves it out and the nav entry would be a broken link. Link to it from a page in this build, move it under assets/, which every build gets, or take it out of the nav.
```

The warning fails strict builds, so `bin/check-leaks.py` and CI fail on it; the live preview only prints it.

`bin/check-leaks.py` checks the same rule on the built output: a file copied from `docs/` into a partner, beta or public build that none of its pages or stylesheets uses fails the check with `file no page in this build links to`.

A project made by v28 or later has these lines in `mkdocs.yml`, so editor backups, and pages saved with an upper-case extension, which MkDocs doesn't treat as pages, never reach a build:

```yaml
exclude_docs: |
  *~
  \#*#
  *.bak
  *.orig
  *.MD
```

If such a file reaches a build anyway, the check fails with `page source copied into the build`.

## Seeing what each group gets

There are three ways to check what each audience will get.

### Every build side by side

From the project folder:

```bash
bin/serve all
```

It runs `bin/check-leaks.py` first, which builds every audience into `dist/` and checks each one.
Then it serves all of those builds at one address, and opens your browser on a page that lists them:

```
[serve] building and checking every audience first: bin/check-leaks.py
[check-leaks] internal: built; 6 pages checked; clean
[check-leaks] partner: built; 6 pages checked (3 excluded); clean
[check-leaks] beta: built; 6 pages checked (3 excluded); clean
[check-leaks] public: built; 6 pages checked (4 excluded); clean
[check-leaks] all audiences clean
[serve] internal, partner, beta, public on http://127.0.0.1:8000/; your browser opens to a page listing them. Ctrl-C stops it.
```

The page has one row per build, each with a rule in its audience's colour and a line on what that build holds.
Click a build to read the site exactly as that audience will get it: these are the files you would publish from `dist/<audience>/`.
To compare one page across audiences, change the build's name in the address, as in `http://127.0.0.1:8000/partner/api/overview/` and `http://127.0.0.1:8000/public/api/overview/`.
A page that a build excludes isn't there: the server answers with a page that reads `Error code: 404`.
Nor is a file the build left out: `http://127.0.0.1:8000/internal/operations/rota.svg` shows the demo's rota image, and `http://127.0.0.1:8000/public/operations/rota.svg` answers 404.

This view isn't live.
After you edit a page, press Ctrl-C and run `bin/serve all` again.
Ctrl-C prints `[serve] stopped.`

It serves only the audiences declared in `mkdocs.yml`, so a folder left in `dist/` by an audience you've since removed isn't shown.
If the check fails, nothing is served, and the lines above the error say what failed.

### One build, live

```bash
bin/serve partner
```

This is the live preview of one build, which reloads as you edit.
The band at the top names the build, in its audience's colour: purple for internal, blue for partner, ochre for beta.
The public build has no band, just as on the published site.
Two previews can run side by side in two terminals; the second takes the next free port.

### Who gets each block

The internal build is the only one that marks content.
Every block a marker keeps there has a rule down its left side and a note above it, naming the other audiences that get it.
Content no other build gets is noted "Internal only".
The rule takes the colour of the widest audience that gets the block, public over beta over partner:

| Marker | Rule | Note |
|---|---|---|
| `<!-- audience: internal -->` | purple | Internal only |
| `<!-- audience: partner -->` | blue | Partner |
| `<!-- audience: partner, beta -->` | ochre | Partner and beta |
| `<!-- audience: beta, public -->` | green | Beta and public |
| `<!-- audience: public -->` | green | Public |
| `<!-- audience: !beta -->` | green | Public |
| `<!-- audience: enterprise -->`, for an audience you added | grey | Enterprise |

A marker on a line of its own marks the block up to its closing marker, even a single heading.
So does a marker around a whole line that's a heading, a list item, a quote or a table row.
A marker inside a line of text marks just that text, with a tint and an underline in the same colour, and its note appears when you point at it.

The partner, beta and public builds carry none of this.
Their pages hold the content and nothing about who else gets it.
The marks need the theme (`WANT_DESIGN=true`).
Without it, a block's note stays in the HTML's `data-label` attribute and isn't shown, and an inline mark's note still appears when you point at it.

## Previewing, building and checking

Run these from the project folder.
None of them needs the environment activated.

| Command | What it does |
|---|---|
| `bin/serve` | Live preview of the internal build. Opens your browser and reloads it when you save. Ctrl-C stops it. |
| `bin/serve public` | The same for any other audience: `partner`, `beta` or `public`. |
| `bin/serve all` | Checks every audience, then serves every build at one address. See [Every build side by side](#every-build-side-by-side). |
| `bin/check-leaks.py` | Builds every audience in strict mode and verifies each one. Run this before publishing anything. |
| `bin/check-leaks.py --builder properdocs` | The same, using ProperDocs instead of MkDocs; see [Platform status](#platform-status). |
| `bin/check-leaks.py --no-build` | Only verifies what's already in `dist/<audience>/`. Use it after building with any other tool. |
| `MKDOCS_AUDIENCE=public .venv/bin/mkdocs build --site-dir dist/public` | Builds one audience by hand. The output starts with Material's red notice about MkDocs 2.0, which is harmless (see [The red warning notice](#the-red-warning-notice)), and ends with `INFO    -  Documentation built in ... seconds`. Without `MKDOCS_AUDIENCE`, it builds public, from the `audience: public` line in `mkdocs.yml`. |

### The preview

- **It's private to your computer.**
  `bin/serve` listens on 127.0.0.1 only, so other machines can't reach it.
  Don't change that to `0.0.0.0`: anyone on your network could then read the internal build.
- **It finds a free port.**
  It uses port 8000, or the next free one up to 8020, and says so: `[serve] port 8000 is in use (another preview still running?); using 8001`.
- **Warnings don't stop it.**
  A broken link prints a `WARNING` line in the terminal, and the page still updates.
  Without this, MkDocs in strict mode refuses to start the preview while any warning exists, and freezes an open page until the warning is fixed.
  `bin/check-leaks.py` and CI still build in strict mode and fail on every warning.
- **It watches `docs/` and `mkdocs.yml`.**
  After editing `overrides/` or the plugin, stop the preview and start it again.
- **It hides the red warning notice** described in [The red warning notice](#the-red-warning-notice).

### The check

It reads `mkdocs.yml` and finds the pages the way MkDocs does, so it checks the audiences and pages MkDocs builds, whatever form the settings take.
Before building, it fails if any page's tagging can't be trusted, or, with `untagged: error`, if a page names no audiences; see [Page frontmatter](#page-frontmatter).
Then, for each audience, it fails if:

- the build fails in strict mode, for example on a broken link
- any file in the build holds a marker, or a comment that looks like one, which means a builder that ignored the plugin
- a page source reached the build as a plain file; see [Files other than pages](#files-other-than-pages)
- a page excluded for that audience was built
- any page links to an excluded page, however the link is written, including a full address that starts with `SITE_URL`
- the search index lists an excluded page
- outside internal, the build holds a file from `docs/` that none of its pages or stylesheets uses; see [Files other than pages](#files-other-than-pages)

It works from the page frontmatter, `docs/` and the built files alone, without trusting the plugin.
So it also catches a build tool that silently skipped the plugin.

## The design

The theme follows four rules:

1. **Material's teal and orange.**
   The header is Material's teal, links are its darker teal, and hover and focus are its deep orange.
   The darker teal is for legibility: the header's teal is 3.8 to 1 against white, under the 4.5 to 1 that body text needs, and the darker one is 5.3 to 1.
   The dark scheme keeps Material's own lighter teal for links.
2. **Audience colours only where an audience is meant:** the band at the top and the marks in the internal build.
   Material's own signals keep their colours too: the small icon on each kind of note box, and the red and green lines of a `diff` code block.
3. **Reading first.**
   One serif typeface, Charter, sets everything but code, at about 75 characters a line with generous space between lines.
   Code uses your system's monospace font, such as DejaVu Sans Mono.
4. **Hairlines, not boxes.**
   There are no shadows, frames are single hairlines, and pale grey grounds are kept for small things that need setting apart, such as code and the titles of note boxes.

The band is slim: one line of small text.
The logo, also the browser-tab icon, is a stack of green bars.
On the teal header and menu it's shown at half brightness, a darker green: the icon's own green is 1.4 to 1 against the teal and all but disappears, and the darker green is 3.2 to 1.
The copyright line is centred at the foot of every page.

The theme follows your system's light or dark setting.
The button in the header switches between following the system, light and dark.

Charter lives in the project, in `docs/assets/fonts/`: four files, about 61 KB in all, served from your own site, so a page never asks another site for fonts.
The script doesn't carry them.
Its first run downloads Charter from Matthew Butterick's Charter page at practicaltypography.com, the release Homebrew and Arch Linux's AUR install.
It uses the download only if the file's checksum matches the one both of those record for it, so a changed or damaged file is never used.
Later runs keep the files, and Git keeps them with the rest of `docs/`, so a clone has them too.
Until they arrive, pages use the next serif in the stylesheet's list that your system has, such as Noto Serif or Liberation Serif.

Bitstream's notice lets anyone use, copy, modify and redistribute Charter, provided the notice stays with the fonts.
The script modifies them in one way: it corrects their descender values, which copies of Charter store as positive numbers, so browsers work out the right line height.
`docs/assets/fonts/LICENSE-Charter.txt` holds the notice, the trademark acknowledgement it asks for, and what changed.
The stylesheet pins the same values, so an uncorrected copy of Charter still sets its lines right in Chromium and Firefox; on the corrected files they change nothing.

A page printed from the internal, partner or beta build keeps the band's wording, in black above a black rule, so the paper still says which build it came from.

### Changing the design

Don't edit `docs/assets/styles/extra.css`: the script owns it, and the next run stops at your edit (see [Edits to the script's files](#edits-to-the-scripts-files)).
Put your own rules in a stylesheet of your own instead, listed after `extra.css` so that its rules win:

1. Create `docs/assets/styles/custom.css` with your rules, for example a wider text column:

   ```css
   .md-content__inner {
     max-width: 36rem;
   }
   ```

2. Add it under `extra_css` in `mkdocs.yml`, after `extra.css`:

   ```yaml
   extra_css:
     - assets/styles/extra.css
     - assets/styles/custom.css
   ```

A running preview picks up both changes.

The colours are CSS variables near the top of `extra.css`: for example `--aud-partner` is partner's colour in the light scheme, and `--band-partner` is its band.
To change one, set it again in your own file, on the same selector as in `extra.css`:

```css
[data-md-color-scheme="default"] {
  --aud-partner: #0b5cad;
}
```

The header and link colours come from the palette in `mkdocs.yml`.
To use another of Material's colours, change `primary: teal` and `accent: deep orange` in all three palette entries, for example to `primary: indigo` and `accent: amber`.

The logo is `docs/assets/favicon.svg`, which the script owns.
To use a logo of your own, add the file, for example `docs/assets/logo.svg`, and point `logo:` under `theme:` in `mkdocs.yml` at it: `logo: assets/logo.svg`.
It shows as it is: the stylesheet darkens only the file named `favicon.svg`.

With another primary colour, the darker green can be hard to see; against indigo it's 1.8 to 1.
To show the logo in white instead, add this to your own stylesheet:

```css
.md-logo img[src$="assets/favicon.svg"] {
  filter: brightness(0) invert(1);
}
```

## On another computer

`.venv/` stays out of Git, so a fresh clone of your repository has to install the project once:

```bash
git clone <your private repository URL> audience-docs
cd audience-docs
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
bin/serve
```

`python3 -m venv .venv` prints nothing; on Debian and Devuan it needs the `python3-venv` package (see [Before you start](#before-you-start)).
The `pip` command lists what it downloads, then prints a line starting `Successfully installed`; an older pip may add a notice about a newer pip, which you can ignore.
With uv instead, run `uv venv`, then `uv pip install -r requirements.txt`.
`uv venv` prints three lines, ending with `Activate with: source .venv/bin/activate`; you don't need to activate it.
`uv pip install` prints a few progress lines, such as `Resolved 30 packages in 9ms` and `Built mkdocs-audience @ ...`, then `Installed 30 packages in ...` and one line per package.
`bin/serve` then prints the same lines as in the [Quick start](#quick-start) and opens your browser.
The Charter files are in Git with the rest of `docs/`, so nothing is downloaded.

You can also run the script on the clone.
Set `PROJECT_DIR` to the folder that holds the clone, `PROJECT_NAME` to the clone's folder name and the `WANT_` settings to match the project, then run `bash bootstrap-docs.sh`.
It recognises the folder from the committed `.bootstrap-docs` file, checks the script's files against the committed manifest, installs from `requirements.txt` so its pins hold, checks every audience and starts the preview.

## CI

`.github/workflows/build.yml` runs on every push to `main` and on pull requests:

1. It installs `requirements.txt`.
2. It runs `bin/check-leaks.py`.
   While `WANT_LEAK_CHECK` is `false`, it only builds each audience in strict mode instead, with no leak check; the script rewrites the workflow on every run to match the setting.
3. It uploads `dist/public` as a downloadable bundle named `public`, which GitHub calls an artifact.

It runs with read-only repository permissions, and uses the versions of the GitHub actions that run on Node 24.

## Publishing

Copy the contents of `dist/<audience>/` to the host for that audience.
The rules that matter:

- Publish only after `bin/check-leaks.py` prints `all audiences clean`.
- Publish only from `dist/<audience>/`.
  A plain `mkdocs build` or `mkdocs gh-deploy` builds the public site in a project made by v28 or later, because of the `audience: public` line in `mkdocs.yml`, but nothing checks what it builds.
  In a project made by v27 or earlier, which lacks that line, both build the internal site; see [Upgrading a project made by v27](#upgrading-a-project-made-by-v27).
- Never put `dist/internal/` anywhere outsiders can reach it.
- Keep the repository private.
  It contains every audience's content.

## Upgrading a project made by v30

Run the script as usual, with the same `PROJECT_DIR` and `PROJECT_NAME`.
It updates the plugin's five files, the stylesheet and `bin/serve`, and checks every audience.
Among its lines:

```
[bootstrap] updated in .venv with uv: mkdocs-audience 0.4.0 -> 0.4.1
[bootstrap] updated docs/assets/styles/extra.css
[bootstrap] updated bin/serve
[bootstrap] files this script owns: 0 written, 7 updated, 11 already up to date
```

Without uv, the first line reads `with pip`.
The logo loses its white tile; nothing in `mkdocs.yml` needs to change.

If v30 couldn't add Charter, this run tries again.
If the download succeeds, these lines come between the stylesheet's line and `bin/serve`'s, and the count reads `5 written, 7 updated, 6 already up to date`:

```
[bootstrap] adding Charter: downloading it from practicaltypography.com, checking and correcting it
[bootstrap] wrote docs/assets/fonts/charter_regular.woff2
[bootstrap] wrote docs/assets/fonts/charter_italic.woff2
[bootstrap] wrote docs/assets/fonts/charter_bold.woff2
[bootstrap] wrote docs/assets/fonts/charter_bold_italic.woff2
[bootstrap] wrote docs/assets/fonts/LICENSE-Charter.txt
```

If it fails again, the note shown in the [Quick start](#quick-start) appears instead, and the count reads `0 written, 7 updated, 6 already up to date`.

If you edited one of the script's files, it stops first; see [Edits to the script's files](#edits-to-the-scripts-files).

## Upgrading a project made by v29

Run the script as usual, with the same `PROJECT_DIR` and `PROJECT_NAME`.
It keeps the font files, which v29 already corrected, and downloads nothing.
It updates the plugin's five files, the stylesheet, the font licence and `bin/serve`.
Among its lines:

```
[bootstrap] updated in .venv with uv: mkdocs-audience 0.4.0 -> 0.4.1
[bootstrap] updated docs/assets/styles/extra.css
[bootstrap] updated docs/assets/fonts/LICENSE-Charter.txt
[bootstrap] updated bin/serve
[bootstrap] files this script owns: 0 written, 8 updated, 10 already up to date
```

If you edited one of the script's files, it stops first; see [Edits to the script's files](#edits-to-the-scripts-files).

## Upgrading a project made by v28

Run the script as usual, with the same `PROJECT_DIR` and `PROJECT_NAME`:

1. Run `bash bootstrap-docs.sh`.
   It updates the script's files, including the plugin, the stylesheet and the logo, and checks every audience:

   ```
   [bootstrap] updated in .venv with uv: mkdocs-audience 0.3.0 -> 0.4.1
   ```

   It corrects the font files v28 wrote where they are, without downloading anything, but with fontTools, which it installs from PyPI:

   ```
   [bootstrap] installed fontTools and brotli in .venv, to correct Charter's files
   [bootstrap] correcting Charter's files, which v28 wrote uncorrected
   [bootstrap] updated docs/assets/fonts/charter_regular.woff2
   [bootstrap] updated docs/assets/fonts/charter_italic.woff2
   [bootstrap] updated docs/assets/fonts/charter_bold.woff2
   [bootstrap] updated docs/assets/fonts/charter_bold_italic.woff2
   [bootstrap] updated docs/assets/fonts/LICENSE-Charter.txt
   ```

   followed, further down, by:

   ```
   [bootstrap] files this script owns: 0 written, 14 updated, 4 already up to date
   ```

   Without network access, the fonts stay as v28 wrote them, with a note, and the stylesheet keeps their lines right in Chromium and Firefox until a later run corrects them.

   If you edited one of the script's files, it stops first; see [Edits to the script's files](#edits-to-the-scripts-files).
2. If any of your pages names no audiences, the check stops before building and lists them:

   ```
   [check-leaks] FAILED before building: these pages' tagging can't be trusted, so a build could
   [check-leaks] publish them to the wrong audience. Fix them first:
       notes.md: names no audiences; add audiences: to its frontmatter, or set untagged: public in mkdocs.yml
   ```

   Tag each page listed, then run the script again.
   To keep v28's rule instead, under which an untagged page went to internal and public, add `untagged: public` to the plugin's settings in `mkdocs.yml`; see [Page frontmatter](#page-frontmatter).
   The demo pages are all tagged already.
3. Nothing else needs changing.
   Your `mkdocs.yml` still says `primary: custom` and `accent: custom`, and `extra.css` gives those Material's teal and deep orange, so the site looks the same as a new one.
   To match a new project anyway, change them to `primary: teal` and `accent: deep orange` in all three palette entries.

An existing project doesn't get the demo's rota image: the script writes it only along with a new runbook page.

## Upgrading a project made by v27

v27 put the project in the folder you ran it from, kept no record of its files, and had a different theme.
To bring a v27 project up to v31:

1. Set `PROJECT_DIR` in the CONFIG block to the folder that holds the project, which is the folder you ran v27 from.
   For example, if the project is `~/projects/audience-docs`, set `PROJECT_DIR="~/projects"`.
   If you run v31 from that same folder with `PROJECT_DIR` unchanged, it makes a new project on your desktop instead, and prints a note saying so.
2. Run `bash bootstrap-docs.sh`.
   It stops without changing anything, because v27 kept no record of which of its files you might have edited:

   ```
   [bootstrap] this project has no .bootstrap-docs.manifest: an earlier version of this script made
   [bootstrap] it and kept no record of what it wrote, so an edit can't be told from an
   [bootstrap] update. These files are the ones this script owns:
       plugins/mkdocs-audience/pyproject.toml
   ```

   The list goes on to name every file the script owns in your project.
3. If you edited any of the listed files, move your changes into files of your own first; see [Edits to the script's files](#edits-to-the-scripts-files).
   Then run:

   ```bash
   REGENERATE_OWNED=true bash bootstrap-docs.sh
   ```

   It copies each file it replaces into `.bootstrap-docs-backup/`, writes the new theme, downloads its fonts, reinstalls the plugin, and records the script's files.
   The plugin line reads `[bootstrap] updated in .venv with uv: mkdocs-audience 0.2.0 -> 0.4.1`, or `with pip` without uv.
   If any page names no audiences, the check that ends the run stops and lists them; see step 2 of [Upgrading a project made by v28](#upgrading-a-project-made-by-v28).
   Later runs need no `REGENERATE_OWNED`.
   If this run is interrupted, the next plain run stops at the files it hadn't reached yet; run the forced run again.
4. The run prints this note, because v27's `mkdocs.yml` names no default audience:

   ```
   [bootstrap] note: mkdocs.yml names no default audience, so a build without MKDOCS_AUDIENCE
     (a plain mkdocs build, or mkdocs gh-deploy) builds the first audience in
     audiences:, which is internal. Add this line under audiences: in the
     audience plugin's settings, indented the same way:
         audience: public
   ```

   Add the line yourself; the script never edits `mkdocs.yml`.
   The plugin's settings then read:

   ```yaml
     - audience:
         audiences: [internal, partner, beta, public]
         audience: public
   ```

5. Optionally, make the rest of `mkdocs.yml` match a new project:
   - For the green logo in the header, replace the two lines `icon:` and `logo: material/layers-triple` under `theme:` with the one line `logo: assets/favicon.svg`.
     Until you do, the header shows Material's layers icon, in white.
   - Remove `- assets/styles/nav-titles.css` from `extra_css`, then delete `docs/assets/styles/nav-titles.css`, which the script reduces to a comment.
   - Add the `exclude_docs` lines shown in [Files other than pages](#files-other-than-pages), and the `untagged: error` line shown in [Page frontmatter](#page-frontmatter), which is also the default without it.

   v27's palette, `primary: teal` and `accent: deep orange`, is already the one a new project has.
6. Your pages keep their v27 text.
   The homepage's internal note and the marker reference page describe v27's coloured frames, and the reference page says a build without `MKDOCS_AUDIENCE` is internal, which step 4 changed, and that untagged pages go to public; edit those sentences.
   If you haven't changed those two pages otherwise, you can delete them and run the script again to get the current versions.

## Platform status

The plugin needs MkDocs 1.x or a fork of it.
As of 2 October 2026:

- **MkDocs 1.x: no longer updated.**
  Its last release, 1.6.1, came out on 2024-08-30.
  It still works, and the project pins it below 2.
- **MkDocs 2.0: can't run this plugin.**
  It has been in pre-release on PyPI since 2026-08-28; the latest pre-release is 2.0.dev6, from 2026-09-15.
  It has no plugin system.
  Its PyPI package declares no licence, though the repository it's developed in, encode/mkdocs, has carried an MIT licence in `docs/LICENSE.md` since 2026-09-11.
  The plugin requires `mkdocs<2`, so `pip install -r requirements.txt` never brings in 2.0.
  A separate `pip install --pre --upgrade mkdocs` would still replace MkDocs with 2.0: pip reports the conflict, starting with a line `ERROR: pip's dependency resolver ...`, but still ends with `Successfully installed`.
  Builds then stop with `Exception: Found mkdocs.yml config, but mkdocs 2.0 pre-release is installed`, so nothing leaks.
- **Material for MkDocs: critical and security fixes only.**
  Its authors committed to that "for at least the next 12 months" from 2025-11-05, so to 2026-11-05.
  The latest release is 9.7.7, from 2026-07-17.
- **ProperDocs: the supported fallback.**
  It's a drop-in fork of MkDocs 1.x by its former maintainer, and this project builds and checks clean with it.
  To switch, install it with `uv pip install properdocs`, or for a project set up without uv, `.venv/bin/pip install properdocs`.
  Then check with `bin/check-leaks.py --builder properdocs`, or build one audience with `MKDOCS_AUDIENCE=public .venv/bin/properdocs build -f mkdocs.yml --site-dir dist/public`.
  Without `-f mkdocs.yml`, ProperDocs prints a notice asking you to rename the file.
  `bin/serve` still runs MkDocs.
- **Zensical: unsafe for this project.**
  Zensical is Material's successor, and it silently ignores plugins it doesn't list.
  A build of this project with Zensical 0.0.67, the latest release, prints "No issues found" and publishes every audience's content, raw markers included.
  Don't use it unless `bin/check-leaks.py --no-build` passes on its output; today it fails.
  Even then, the check reads only the search index MkDocs writes, so it wouldn't see a leak through the one Zensical writes, `search.json`.

## The red warning notice

`mkdocs build`, `mkdocs serve` and `mkdocs gh-deploy` start by printing a notice about MkDocs 2.0, headed "Warning from the Material for MkDocs team", with a red bar down its left side.
It's Material's notice about the situation above, not an error in your project, and your build continues normally.

`bin/serve` and `bin/check-leaks.py` hide it by setting `NO_MKDOCS_2_WARNING=true`.
To hide it for a command you type yourself:

```bash
NO_MKDOCS_2_WARNING=true MKDOCS_AUDIENCE=public .venv/bin/mkdocs build --site-dir dist/public
```

## Working on the plugin

The plugin's source is in `plugins/mkdocs-audience/`, installed in editable mode.
Edits take effect the next time you build; stop and start `bin/serve` to pick them up.
The script owns the plugin's files, so a change you make there stops the next run of the script until you regenerate them; keep lasting changes in the plugin's own repository.

To run its tests, from the project folder:

```bash
uv pip install pytest            # without uv: .venv/bin/python -m pip install pytest
cd plugins/mkdocs-audience
../../.venv/bin/python -m pytest -q tests/
```

Expected output ends with a line like `156 passed in 0.78s`.

To share the plugin later, put `plugins/mkdocs-audience/` in its own Git repository.
Others can then install it with `pip install git+https://github.com/<you>/mkdocs-audience`.

Publishing to PyPI is deliberately not part of this project.
If you do it later:

- PyPI has required two-factor authentication on every account since 2024-01-01.
- Use Trusted Publishing from GitHub Actions rather than a token stored in `~/.pypirc`.

## Troubleshooting

**`run this script with bash: bash bootstrap-docs.sh`**
The script was started with `sh` or another shell.
Run it with `bash`, as the message shows.

**`[bootstrap] error: run bootstrap-docs from its saved file (bash bootstrap-docs.sh), not piped from curl`**
The script was piped into bash rather than run from a file.
Save it, read its CONFIG block, then run it with `bash bootstrap-docs.sh`.

**`[bootstrap] error: PROJECT_DIR (...) is not a folder that exists.`**
Create the folder, or set `PROJECT_DIR` in the CONFIG block to one that exists; see [Where the project goes](#where-the-project-goes).

**`[bootstrap] error: ~/Desktop/audience-docs already exists and was not created by this script.`**
A folder with that name exists, isn't empty and isn't the script's.
Nothing was changed.
Choose another `PROJECT_NAME`, or move the folder yourself.

**`[bootstrap] these files don't match what this script last wrote there`**
You, or another tool, changed a file the script owns, or a run with `REGENERATE_OWNED=true` was interrupted before it reached the file.
See [Edits to the script's files](#edits-to-the-scripts-files).

**`[bootstrap] this project has no .bootstrap-docs.manifest`**
The project was made by v27 or earlier, or it's a copy that lacks the manifest, such as a clone of a repository it was never committed to.
See [Upgrading a project made by v27](#upgrading-a-project-made-by-v27).

**`[bootstrap] note: mkdocs.yml names no default audience`**
Add `audience: public` to the plugin's settings in `mkdocs.yml`, as the note shows.

**`[bootstrap] note: ./audience-docs here is a project made by bootstrap-docs, but this run works`**
You ran the script in a folder that holds a project of the same name, usually one made by v27 or earlier, which put projects in the folder it ran from.
This run works on the project at `PROJECT_DIR/PROJECT_NAME` and leaves that one alone.
To update that project instead, set `PROJECT_DIR` as the note says and run the script again.

**`[bootstrap] error: .venv exists but has no working Python (.venv/bin/python).`**
The project's `.venv` is damaged.
The script won't delete it, so remove it yourself with the `rm -rf` command shown in the message, then run the script again.

**`[bootstrap] missing system packages: python3-venv`, followed by `run it now? (y/N):`**
Python's venv support isn't installed and uv isn't available.
Type `y` or `yes` to let the script run the command it shows, `sudo apt-get install -y python3-venv`; sudo then asks for your password.
Any other answer, including just Enter, stops the script and prints the command to run yourself.
Installing uv avoids this step entirely.

**`[bootstrap] error: installing packages failed`**
MkDocs, Material or hatchling couldn't be downloaded from PyPI.
Check your network and run the script again; it picks up where it stopped.
Ctrl-C at any point just ends the run, and the next run carries on in the same way.

**`[bootstrap] note: couldn't add Charter: couldn't download https://practicaltypography.com/fonts/Charter%20210112.zip (...)`**
The run couldn't reach practicaltypography.com, and the text in brackets says why.
Everything else finished, and the site uses your system's serif font.
Until the font arrives, the live preview prints a line such as `WARNING -  [hh:mm:ss] "GET /assets/fonts/charter_regular.woff2 HTTP/1.1" code 404` for each font file a page asks for; it's harmless.
Run the script again once you have network access; it adds the font, and changes nothing else.
The download goes through the proxy your `https_proxy` setting names, if it names one.
If your network blocks the site, download the file at the address the note shows on a computer that can reach it, copy it across, and give the script its path for one run:

```bash
CHARTER_ZIP="$HOME/Downloads/Charter 210112.zip" bash bootstrap-docs.sh
```

Expected output: `[bootstrap] adding Charter: reading ~/Downloads/Charter 210112.zip, checking and correcting it`, then the four `wrote docs/assets/fonts/...` lines and the licence's, as in the [Quick start](#quick-start).

**`... isn't the file this script expects: its sha256 differs`**
The downloaded file, or the one `CHARTER_ZIP` names, isn't the Charter release the script was written for, so it wasn't used, and no font was added.
For a download, something between you and the site changed the file, or the site now serves another file at that address.
Try again later.
If it persists, compare `CHARTER_URL` and `CHARTER_ZIP_SHA256` in the script with the address and checksum in Homebrew's [`font-charter`](https://github.com/Homebrew/homebrew-cask/blob/master/Casks/font/font-c/font-charter.rb) cask or the AUR's [`ttf-bitstream-charter`](https://aur.archlinux.org/packages/ttf-bitstream-charter) package.
Don't change `CHARTER_ZIP_SHA256` to match the file you got: the checksum is what keeps a changed file out.

**`[bootstrap] note: couldn't install fontTools, which corrects Charter's files (offline?).`**
PyPI couldn't be reached on a run that needed fontTools, such as the first run on a project v28 made, or a run with font files to add.
Run the script again with network access.

**Any other reason after `couldn't add Charter:` or `couldn't correct Charter's files:`**
The fonts failed one of the script's own checks, so none was written, and the site uses your system's serif font.
With the release the checksum names, that would mean a change in fontTools, whose version the script doesn't pin.

**`[bootstrap] error: .venv has no pip, and uv is not installed`**
The project's `.venv` has no pip, and Python's `ensurepip` couldn't add it.
A run stopped while it was making `.venv` usually leaves it like that, and the next run adds pip itself, printing `[bootstrap] .venv had no pip; added it with ensurepip`.
If this error appears instead, remove `.venv` with the `rm -rf` command the message shows, or install uv, then run the script again.

**`[bootstrap] error: the leak check failed (see above), so the preview was not started.`**
`bin/check-leaks.py` found a problem, and the lines above the message name it.
Fix it and run the script again.
To look at the site while you fix it, run `bin/serve` in the project folder.

**`[bootstrap] note: no terminal (input or output is redirected), so the preview was not started`**
The script ran without a terminal, for example from CI or piped through another command.
Everything else finished.
Start the preview with `bin/serve`.

**No browser opened.**
Open the address on the `Serving on` line yourself, or the one on the `[serve]` line for `bin/serve all`.
Without a desktop session, for example over SSH, no graphical browser can open.
If a text-mode browser such as lynx is installed, it opens in the terminal instead, and the live preview doesn't pick up your edits until you quit it.

**`[serve] error: ports 8000 to 8020 are all in use.`**
Other previews or programs hold every port the preview tries.
Stop a preview with Ctrl-C in its terminal, then run `bin/serve` again.

**`[serve] error: .venv/bin/mkdocs not found, so the project isn't installed here.`**
This copy of the project has no environment yet, usually a fresh clone.
Run the commands the message shows; see [On another computer](#on-another-computer).

**`[serve] error: 'bin/serve all' needs bin/check-leaks.py`**
The project was made with `WANT_LEAK_CHECK=false`.
Turn it on in the CONFIG block and run the script again, or preview one build at a time with `bin/serve <audience>`.

**`[serve] error: the leak check failed (see above), so nothing was served.`**
`bin/serve all` serves only checked builds.
Fix what the check lists; meanwhile `bin/serve internal` shows the live site.

**`ERROR   -  mkdocs-audience: audience 'pubic' is not declared.`**
The audience given to `bin/serve` or in `MKDOCS_AUDIENCE` is misspelt, or missing from `audiences:` in `mkdocs.yml`.
The message lists the declared names.

**`ERROR   -  mkdocs-audience:`** about a page's frontmatter or its `audiences:` line
The page's tagging can't be trusted, so the build stopped rather than publish the page to public.
The message names the page and what to fix; see [Page frontmatter](#page-frontmatter).

**`ERROR   -  mkdocs-audience: 2 pages name no audiences`**, or from the check, **`names no audiences`**
Every page has to say who gets it, and these don't.
Add `audiences:` to each page listed, or set `untagged:` in `mkdocs.yml`; see [Page frontmatter](#page-frontmatter).

**`ERROR   -  mkdocs-audience: in ...`** followed by **`looks like an audience marker`**, **`is never closed`**, **`has no opening marker`** or **`opens inside another one`**
A marker on that page is malformed or unpaired, so the build stopped rather than let the text it marks reach every build.
See [Marking content](#marking-content).

**Checker: `page source copied into the build`**
An editor backup, or a page saved with an upper-case extension, reached a build as a plain file.
Delete it, or add the `exclude_docs` lines shown in [Files other than pages](#files-other-than-pages).

**`ERROR   -  mkdocs-audience: the file name of ... looks like the _NAME-page.md convention`**
With `filename_convention: true` in the plugin's settings, which is off by default, a file name such as `_internal_notes.md` is almost a tag; rename it to `_internal-notes.md`, or to a name without a leading `_`.

**`WARNING -  Doc file 'X.md' contains a link 'Y.md', but the target is not found among documentation files.`**
A page links to a page this audience can't see, or to a page that doesn't exist.
When the linking page is in a subfolder of `docs/`, the warning also quotes the docs-relative path it looked for, as in `but the target 'api/nope.md' is not found`.
In the preview, the warning only prints.
In `bin/check-leaks.py`, CI and strict builds, `Aborted with 1 warnings in strict mode!` follows and the build fails.
Fix the link, or move it inside a marker for the audiences that can see the target; see [Linking to restricted pages](#linking-to-restricted-pages).

**`WARNING -  mkdocs_audience: undeclared audience 'X' in ...`**
A marker names an audience that isn't in `audiences:`, as in `undeclared audience 'X' in page.md`, or a page's frontmatter or file name does, as in `undeclared audience 'X' in the frontmatter or file name of page.md`.
Fix the spelling, or add the audience to `mkdocs.yml`.

**`WARNING -  mkdocs_audience: the nav links to ..., but no page in the '...' build links to it`**
An entry under `nav:` points at a file that isn't a page, such as a PDF, and no page in that build links to the file, so the build leaves it out and the entry would be a broken link.
Link to the file from a page that build includes, move the file under `docs/assets/`, or take the entry out of `nav:`; see [Files other than pages](#files-other-than-pages).

**Checker: `file no page in this build links to`**
A partner, beta or public build holds a file from `docs/` that none of its pages or stylesheets uses, such as an image only an internal page shows.
The plugin leaves such files out, so the build tool skipped the plugin, or the file is one a template or script uses; move that kind of file under `docs/assets/`.
See [Files other than pages](#files-other-than-pages).

**Checker: `excluded page was built`**
A page tagged for other audiences ended up in this build.
The build tool skipped the plugin, as Zensical does.

**Checker: `raw audience marker survived`**
A marker has no matching `<!-- /audience -->`, or the build tool skipped the plugin.

**Checker: `link to excluded page` or `search index lists excluded page`**
Something in this build points at a page it shouldn't know about.
The check always builds in strict mode, so MkDocs stops a Markdown link to an excluded page first, as a build failure.
The checker's own messages catch what MkDocs doesn't check, such as a link written in raw HTML, or output checked with `--no-build`.

**`syntax error: unexpected end of file`**, or **`here-document at line ... delimited by end-of-file`**
The script file is incomplete, usually from a download that stopped early.
Nothing was created.
Download the script again.
If only its first few lines arrived, it prints nothing at all; download it again then too.

## What changed in v31

What changed in v30 is listed in the v30 guide.

**Design**

- **The logo has no tile.**
  The header and the menu show the favicon's green bars on the teal itself, at half brightness so they stay visible: 3.2 to 1, where the favicon's own green is 1.4 to 1.
  The browser-tab icon is unchanged.
  In a project made by v27, whose `mkdocs.yml` still names Material's layers icon, the header shows that icon in white, where v29 and v30 showed a blank white square.
- **No grey-blue box behind the copy button in the dark scheme.**
  The copy button on code blocks, and keys written with `<kbd>`, use the theme's own greys in both schemes.
- **The page `bin/serve all` opens has teal links**, orange on hover, as the site does, in place of underlined black.

**Safety**

- **A nav entry for a file a build leaves out fails the build.**
  In v29 and v30, a `nav:` entry pointing at a PDF that no page in a build linked to was a broken link in that build, and nothing said so.
  Now the build logs a warning, which fails strict builds, the check and CI; see [Files other than pages](#files-other-than-pages).
- The plugin is 0.4.1, with 156 tests.

**Smaller changes**

- New projects' `mkdocs.yml` no longer lists `content.heading.links` under `features`.
  Material 9.7 has no such feature; the anchor link beside each heading comes from the `toc` extension's `permalink` setting, which stays.
  In an existing project the line does nothing, and you can delete it.
- The comment at the top of the script names everything the first run installs.
- The guide says what the live preview prints while Charter is missing.

## Known limitations

- **The stylesheet every build shares names the four default audiences** in its colour variables and comments, the public build included.
  It's the same file in every project, whatever audiences the project uses, so it says nothing about yours; an audience you add yourself never appears in it.
- **Any edit to a file the script owns stops the next run,** even a change of whitespace, until you move the edit out or use `REGENERATE_OWNED=true`.
- **The theme depends on Material's class names and colour variables.**
  A Material release that renamed them would spoil parts of the look, though not the filtering or the check.
- **The marker reference page's syntax examples name partner and beta** even in a project without them.
  The plugin's warning about undeclared names catches a copied example.
- **`REPO_URL` puts a link to the repository in the header of every build**, including public.
- **The pin in `requirements.txt` can come out wrong for unusual version numbers.**
  For example, `9.7.0.post1` becomes `~=9.7.0.0`.
  Check the file if a version looks odd.
- **The live preview's free-port check and the server's start are separate steps.**
  If another program takes the port in the moment between them, `bin/serve` stops with `OSError: [Errno 98] Address already in use`, and `bin/serve all` with `[serve] error: can't serve on 127.0.0.1:8000 (Address already in use). Run bin/serve all again.`
  Run the command again.
- **Every build uses `SITE_URL`**, the public site's address, for its canonical links and its sitemap, so the internal, partner and beta builds point there too.
- **The file filter sees links in pages and stylesheets only.**
  A file that only a template, a script or a page's frontmatter uses is left out of the partner, beta and public builds unless it's under `docs/assets/`.
- **A file a host or a search engine needs at the top of the site**, other than `CNAME`, `robots.txt` and `favicon.ico`, such as a verification page, goes only into the builds with a page that links to it.
  Link to it from a public page.
- **Material's deep orange is 2.8 to 1 against white**, under the 4.5 to 1 that body text needs.
  It shows only while the pointer is on a link or a control has focus.
- **The check for tags MkDocs doesn't read looks at the first 60 lines of a page**, outside code; a tag further down isn't caught.
- **The first run depends on practicaltypography.com.**
  If the site is down, blocked from your network or no longer serves that release, no font is added, and the site uses your system's serif font; `CHARTER_ZIP` takes a copy you saved.
  A newer Charter release needs a newer version of the script, because only the release whose checksum the script carries is used.
- **Font files you put in `docs/assets/fonts/` yourself count as edits** to the script's files: the next run stops at them, and a run with `REGENERATE_OWNED=true` replaces them.
  To supply Charter yourself, use `CHARTER_ZIP`.
- **Charter covers Latin script only.**
  Text in other scripts falls back to your system's serif font.
- **Small gaps in the plugin:**
  - Negation with `!` doesn't work in frontmatter; the build stops instead.
  - The plugin recognises code only as a fenced block that starts at the left margin, or inline code in single backticks.
    A marker inside other code, such as a fence in a list item, an admonition or a blockquote, inline code in double backticks, or code indented four spaces, is acted on.
    The builds it doesn't match lose that part of the example, and the internal build shows the marker's HTML in the code.
- **`~/Desktop` may not exist** on a desktop set up in another language, where the folder can have another name.
  Set `PROJECT_DIR` to the folder you want.