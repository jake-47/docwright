# Minimal Zola Blog on GitHub Pages

The [zola-blog-setup.sh](./bootstrap-zola.md) script makes a small, fast blog on your computer and sets it up so GitHub publishes it for free. You write each post as a plain text file. A program called Zola turns those files into web pages, and GitHub puts the pages online each time you send in your changes.

## What you get

- A home page that lists your posts, numbered, in the order you choose, or newest first (see "Ordering posts"). Also an About page, tags, an RSS feed, and search.
- A plain, readable design. It is dark by default, and you can add a light version for readers whose computer is set to light mode.
- Nothing loaded from other websites: no tracking, no adverts, and no fonts or scripts from other companies. Every page carries a security policy that makes the reader's browser enforce this.
- One small script, for the search box. Search is on by default, so by default the site does run JavaScript: this one file, loaded from your own site and nowhere else. Turn search off (`ENABLE_SEARCH=false`) and the blog's pages run no JavaScript at all. The one exception is the address `/attachments/`, which Zola publishes as a redirect to the home page: one line of Zola's own script, on a page without the security policy.
- Automatic publishing. Each time you push your changes to GitHub, it rebuilds the site and puts it online, usually within a couple of minutes.
- Optional email updates for readers, through a newsletter service that sends them each new post from your feed (see "Email subscription").

The preview on your own computer adds a script of its own, which reloads the page when you save a file. It is part of Zola's preview and is never published. The preview also shows your drafts, marked "(draft)", and they aren't published either.

It costs nothing, unless you want your own domain name (roughly 10 to 20 US dollars a year; see "Custom domain"). GitHub's address, hosting and HTTPS are free at the size a personal blog runs at.

The script runs on Linux, macOS, and Windows (in Git Bash). It uses Zola 0.23, any 0.23.x release, and installs one for you if you don't have it. It won't install a newer Zola than that, because the blog's templates are written for 0.23 and a later version may not build them. If the Zola already on your computer isn't a 0.23 release, the script installs one into `~/.local/bin` and says so; your other Zola sites may then build with that one too.

## Words used in this guide

- **Zola**: the program that turns your text files into web pages. The script installs it.
- **Static site**: a website made of finished files. No program runs on the server, so there's little that can go wrong or be attacked, and it's cheap to host.
- **GitHub**: the website that stores your blog's files. A **repository** (repo) is one project's folder there.
- **GitHub Pages**: GitHub's free web hosting. **GitHub Actions** is GitHub's build service, and a **workflow** is the file that tells it what to do. Yours is `.github/workflows/deploy.yml`.
- **git**: the program on your computer that keeps track of changes and sends them to GitHub. A **commit** is a saved snapshot of your changes. To **push** is to send your commits to GitHub.
- **Terminal**: the window where you type commands.
- **Markdown**: the simple text format you write posts in. `**bold**` becomes **bold**, and a line starting `## ` becomes a heading.
- **Front matter**: the block of settings at the top of each post, between two lines of `+++`.
- **Attachments**: the folder `content/attachments/`, where pictures, GIFs and videos go, for any post or page.
- **Draft**: a post with `draft = true` in its front matter. The preview shows it; the published site doesn't.
- **Post**: a page in the list on the home page. A **hidden page**, such as the About page, is published but kept out of every list; see "Pages that aren't posts". A **section** is a folder with an `_index.md` file in it. It's listed like a post, and its page lists the pages inside it, its **child pages**; see "Child pages".
- **Preview**: a private copy of the site on your computer, at `http://127.0.0.1:1111`, that updates each time you save a file. Only you can see it.
- **Build**: making the finished site files, which go into a folder called `public/`.
- **The configuration block**: the list of settings at the top of the script.
- **Re-run**: running the script again after changing a setting. That's how every change to a setting is applied.
- **Script-owned files**: files the script writes again on every run, so changes you make to them directly don't last. Everything in `content/` and most of `static/` is yours instead, and the script never touches it after the first run. So is `README.md`, once you edit it. See "How changes work".
- **`render_` functions**: the parts of the script that write each generated file. `render_base_html`, for example, writes `templates/base.html`. "How changes work" says how to find one.
- **Feed** (RSS or Atom): a list of your posts, in a format that feed reader apps and email services check for new posts.
- **Tags**: labels you give posts. Each tag gets a page listing the posts that carry it.
- **Masthead**: the strip at the top of every page, with the blog's name on the left and the menu on the right.
- **Favicon**: the small icon in the browser tab.
- **Base URL**: the address the published site lives at, such as `https://John.github.io/notes`. The script works it out from your repository's address.
- **Checksum** (sha256): a fingerprint of a file. Change one byte of the file and the fingerprint changes.
- **Security policy** (CSP, Content-Security-Policy): a list of rules in each page that tells the reader's browser what the page may load and run.

## Your first blog

### Before you start

You need:

- A computer running Linux, macOS, or Windows with Git Bash (it comes with Git for Windows).
- A terminal. On Linux it's usually called Terminal (in XFCE, Terminal Emulator). On a Mac, it's Terminal, in Applications, then Utilities. On Windows, use Git Bash.
- git, and curl or wget. To check for git, run `git --version`. It should print something like `git version 2.47.2`. If it prints `command not found`, install it; on Debian, Devuan or Ubuntu, `sudo apt install git curl` installs both.
- A plain-text editor, for changing the script's settings: Mousepad, gedit, Kate, nano, VS Code, or similar. Don't use a word processor. It may change straight quotes into curly ones, which breaks the script.
- A GitHub account, if you want the blog online. It's free; sign up at github.com.

You don't need to install Zola first, and the script never needs administrator rights. It checks for the other small tools it uses and tells you by name if any are missing.

### Step 1: tell git who you are

git stamps every commit with a name and an email address, and on a public blog anyone can read both in the history, permanently. So pick them before your first run. The first run saves your first commit for you, but only if git already knows your name and email.

You don't have to publish your real email address. GitHub gives you a private one: on github.com, click your profile picture (top right), then Settings, then Emails. Tick "Keep my email addresses private", and copy the address shown there, which ends in `@users.noreply.github.com`.

Then, in a terminal:

```bash
git config --global user.name "Your Name"
git config --global user.email "Your Email"
```

Put your own name and the address you copied in place of `Your Name` and `Your Email`, and keep the quotes. Neither command prints anything. To check, run `git config --global user.email`; it prints the address back.

`--global` sets this for every git project on your computer. To use a different name or address for the blog only, run the same two commands inside the blog folder, without `--global`.

### Step 2: save the script and read it

Open the page for [zola-blog-setup.sh](./bootstrap-zola.md) and copy the whole script (on a code block, the copy button at its top right copies all of it). Paste it into a new file in your text editor, and save that file as `zola-blog-setup.sh` in your Downloads folder. Any other folder works too, but this guide assumes Downloads. Where you keep the script doesn't decide where the blog goes: the settings do, and by default it's a folder called `myblog` on your Desktop.

Read the script before you run it, or have someone you trust read it: it downloads a program and connects your blog to GitHub. If you don't read shell scripts, paste it into an AI model you trust and ask what it does. About half of the script is the text of the files it writes. It downloads only from GitHub, installs nothing outside your home folder, and never asks for your password.

### Step 3: change the settings

Open the script in your text editor (on XFCE, for example, `mousepad zola-blog-setup.sh`) and search for `user configuration`. The lines below it are the configuration block, one setting per line, like these:

```bash
readonly SITE_TITLE="Myblog"
readonly SITE_DESCRIPTION="one-line description"   # "" for none
readonly LIGHT_THEME=false        # true: light for readers whose OS asks for it
```

The name in capitals is the setting; what follows the `=` is its value. Everything after a `#`, on a line of its own or at the end of a setting's line, is a note, and the script ignores it. The block ends at the line `derived from the block above (do not edit)`.

Rules for changing a value:

- Change the setting's own line; don't add a second line for the same setting. A second line stops the script with an error such as `line 82: GIT_REPO_URL: readonly variable`.
- Change only what comes after the `=`. Leave everything before it alone, and don't put spaces around the `=`.
- Text goes inside double quotes: `readonly SITE_TITLE="John's Notes"`. An apostrophe inside double quotes is fine.
- Inside the quotes, put a backslash before any `$`, `"` or `` ` ``: `readonly SITE_DESCRIPTION="Notes on \$5 gadgets"`, or `readonly FOOTER_TEXT="Motto: \"ora et labora\""`. Without it the script stops with an error such as `line 89: $5: unbound variable`, or, for a `"` or `` ` ``, `line 117: FOOTER_TEXT isn't quoted as the script needs`. The one exception is `$HOME` in `PROJECT_DIR`'s default, which is meant to be read as your home folder.
- `true` and `false` have no quotes. If one is wrong, the script stops with a message such as `SHOW_TOC must be true or false (unquoted), got: 'yes'`.
- An empty value is two quotes with nothing between them: `readonly SITE_DESCRIPTION=""`.

For a first try you can change nothing at all. You'll get a blog called "Myblog" in `~/Desktop/myblog`, with two example posts, and nothing is published until you set up GitHub.

For your real blog, set these now (each is explained under "Settings, one by one"):

- `SITE_TITLE`: the blog's name.
- `SITE_DESCRIPTION`: one line about the blog, shown under its name on the home page.
- `SITE_AUTHOR`: your name, as it appears in the feed.
- `BLOG_NAME`: the name of the blog's folder on your computer. Letters, numbers, dashes and underscores; no spaces.
- `PROJECT_DIR`: the folder the blog's folder goes in. The default is your Desktop.

If you already have an empty GitHub repository for the blog, you can also set `GIT_REPO_URL` now (see "Putting it online"). It's fine to add it later.

Save the script when you've made your changes.

### Step 4: run it

In the terminal, go to the folder where you saved the script and run it. If you saved it in Downloads:

```bash
cd ~/Downloads
bash zola-blog-setup.sh
```

The first run downloads Zola, which takes a moment. You should see something like this. Your folder names will be different, and the version number and checksum may be too:

```
zola not found; installing 0.23.6...
downloading zola v0.23.6...
sha256 of the downloaded archive: 8f5132b3522412d04e395e0b25f6d68613ad272a873e54a2b3ebf664873024a4
installing to /home/you/.local/bin...
installed: zola 0.23.6

creating /home/you/Desktop/myblog ...
wrote the script-owned files (config.toml, templates/, serve, build, new, attach, README.md, .gitignore)
wrote content/ (yours from here; a re-run will not touch it)
blog created in /home/you/Desktop/myblog

initialised git repo on branch: main
made initial commit

starting the live preview (your browser will open). Ctrl+C to stop.
to start it again later, from anywhere: /home/you/Desktop/myblog/serve
```

If you already have Zola 0.23, the lines about installing it are replaced by one line, `zola 0.23.x present (inside the supported band >= 0.23, < 0.24); using it.`

Then Zola starts the preview:

```
Building site...
-> Creating 3 pages (0 orphan) and 1 sections
Done in 64ms.

Listening for changes in /home/you/Desktop/myblog/{config.toml,content,static,templates}
Press Ctrl+C to stop

Web server is available at http://127.0.0.1:1111 (bound to 127.0.0.1:1111)
```

Your browser opens the preview at `http://127.0.0.1:1111`. (If another preview is already running, the new one uses a different address, such as `http://127.0.0.1:1024`, and prints it.) Only you can see it, and it updates by itself whenever you save a file in the blog folder. While the preview runs, the terminal stays busy: press Ctrl+C in it to stop the preview, or open a second terminal window for other commands.

Some lines look alarming but are normal:

- `sha256 of the downloaded archive` is the fingerprint of the Zola download, printed for your records. See "What the checksum proves".
- If `~/.local/bin`, where Zola goes, isn't yet among the folders your terminal looks in for programs (your `PATH`), a note after `installed: zola 0.23.6` says so. The preview this run starts works anyway; the note is about the next terminal you open. Log out and back in, and see "Zola not found after installing" if that isn't enough.
- If git didn't know your name and email yet, you see `(git user.name/user.email not configured - initial commit skipped)` instead of `made initial commit`. The blog is fine. Do step 1 above, then make the first commit yourself. In a second terminal window (the preview is using this one), go into the blog folder, the one named after `blog created in`, with a command such as `cd ~/Desktop/myblog`. Then run `git add -A`, which prints nothing, and `git commit -m "First commit"`, which prints a line starting `[main (root-commit)`.
- If you set `GIT_REPO_URL`, you also see three lines about pinning Zola into the workflow, which means recording the exact Zola version GitHub will use, and `added remote 'origin': git@github.com:you/yourrepo.git`. That's the link to GitHub being set up.
- If you set `GIT_REPO_URL` and some settings still have the values the script came with, a line starting `still the examples the script came with` names them. It's a reminder, not an error; see "Before you publish".

If a first run stops with an error instead, it deletes the folder it was creating, so fix what the message names and run it again. Troubleshooting lists the messages.

To start the preview again later, from any folder:

```bash
~/Desktop/myblog/serve
```

If that says `zola: command not found`, see "Zola not found after installing" in Troubleshooting.

### Step 5: find your way around

The blog folder now holds:

- `content/`: your writing. Each post is a `.md` file here, and `content/attachments/` holds the pictures, GIFs and videos for any post or page. `content/about.md` is the About page, and `content/_index.md` holds any text you want at the top of the home page. The two example posts, `hello-world.md` and `second-post.md`, show how things look, and `hello-world.md` doubles as a Markdown cheat sheet; its picture is `content/attachments/demo.svg`.
- `static/`: files published exactly as they are, such as fonts and the About page's placeholder picture.
- `config.toml` and `templates/`: generated by the script from its settings. Don't edit these directly; see "How changes work".
- `serve` and `build`: shortcuts. From inside the blog folder, `./serve` starts the preview and `./build` makes the finished site in `public/`, the same way GitHub will, so a problem that would stop GitHub's build stops it here first, with a message.
- `new` and `attach`: helpers for writing. `./new` starts a post with its front matter filled in (see "A new post"), and `./attach` copies a picture or video into `content/attachments/` with its hidden data removed (see "Pictures, GIFs and video").
- `README.md`: a short note for the repository's page on GitHub, written by the script until you edit it; after that it's yours (see "The hand-edit check").
- `.gitignore`, `.zola-blog-setup.manifest` and, once you set up publishing, `.github/workflows/deploy.yml`. `.gitignore` tells git what not to commit, such as the built site in `public/`; the manifest is the script's record of the files it wrote (see "The hand-edit check"); and `deploy.yml` tells GitHub how to build and publish the site. Names starting with a dot are hidden in most file managers; Ctrl+H shows them.

From here on, this guide writes the blog folder as `~/Desktop/myblog` and the script as `~/Downloads/zola-blog-setup.sh`, the defaults. If yours are somewhere else, use your own paths in their place.

Replace the example posts with your own when you're ready. Delete both together, or `hello-world.md` first: it links to `second-post.md`, so deleting only `second-post.md` stops the build with a broken-link error. Delete `content/attachments/demo.svg` along with them.

## Putting it online

### Before you publish

Whatever is in the blog when you push goes online, so replace the placeholders first:

- `SITE_TITLE` ("Myblog"), `SITE_DESCRIPTION` ("one-line description") and `SITE_AUTHOR` ("your name").
- `FOOTER_LINKS`. It starts with example addresses for X, Nostr and GitHub that lead nowhere. Put in your own, delete the ones you don't want, or set it to `""` for none; see "Footer text and links".
- The About page, `content/about.md`, which starts with placeholder text and the address `you@yourdomain.com`.
- The two example posts, unless you want them published. "Step 5: find your way around" says which to delete first.

While `GIT_REPO_URL` is set, each run lists any of the settings above, and the About page, that still have their example values, in a line starting `still the examples the script came with`.

On a free GitHub account the repository has to be public, and everything you commit is in it for anyone to read, including the history of every change, posts marked as drafts, and the original files of any photos. Don't commit anything you wouldn't publish.

### Step 1: make an SSH key (once per computer)

When you push, GitHub has to know it's you. The script sets the blog up to prove that with an SSH key: a pair of files on your computer, a private one that never leaves it and a public one you give to GitHub. If you've pushed to GitHub from this computer before, you probably have one already. To check, run `ls ~/.ssh/id_ed25519.pub`: it prints the file's name if the key exists, or `No such file or directory` if it doesn't. (A key with another name, such as `id_rsa.pub`, works too; use its name in the steps below.)

To make one:

```bash
ssh-keygen -t ed25519 -C "laptop"
```

The text after `-C` is only a label, to help you recognise the key later. The command asks three things. Press Enter at the first, to save the key in the usual place (`~/.ssh/id_ed25519`). Then it asks for a passphrase, twice. A passphrase protects the key if someone copies your files; type one, or press Enter both times for none. Nothing appears on screen while you type it, which is normal. It finishes by printing the key's fingerprint and a small box of symbols called randomart. You don't need to keep either.

Show the public half:

```bash
cat ~/.ssh/id_ed25519.pub
```

It prints one long line starting with `ssh-ed25519` and ending with your label. Copy the whole line. On github.com, go to Settings, then SSH and GPG keys, then New SSH key (or open `github.com/settings/keys`). Paste the line into the Key box, give it a title such as "laptop", and click Add SSH key.

Check that it works:

```bash
ssh -T git@github.com
```

The first time, ssh asks whether to trust the server, with something like this:

```
The authenticity of host 'github.com (IP ADDRESS)' can't be established.
ED25519 key fingerprint is SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Check that the fingerprint matches the one above, which is the one GitHub publishes, then type `yes` and press Enter. (If ssh shows a different type of key, compare it with GitHub's list: search the web for "GitHub's SSH key fingerprints", and use the page on docs.github.com.) You should see:

```
Hi yourname! You've successfully authenticated, but GitHub does not provide shell access.
```

That means it worked, even though it sounds like a refusal. If you see `Permission denied (publickey)` instead, see Troubleshooting.

### Step 2: make an empty repository on GitHub

On github.com, click the + at the top right, then New repository.

- The repository's name becomes part of your blog's address. A repository called `notes` on the account `John` is published at `https://John.github.io/notes/`. If you call it exactly `yourname.github.io`, with your username in lower case (GitHub requires lower case here, even for a username with capitals), the blog is published at `https://yourname.github.io/` with nothing after it.
- Choose Public. GitHub Pages is free for public repositories; private ones need a paid plan.
- Leave the options to add a README, a .gitignore and a licence turned off. The repository has to be empty: your computer already has the first commit, and a file added on GitHub would give the repository a different first commit that clashes with it.

Click Create repository. GitHub then shows some setup commands; you don't need them, because the script does that part.

### Step 3: connect the blog to the repository

Skip this step if you set `GIT_REPO_URL` before your first run.

Copy the repository's address from your browser's address bar while you're on its main page. It looks like `https://github.com/John/notes`: `https://github.com/`, your username, the repository's name, and nothing after that. An address copied from further inside the repository, such as one ending in `/tree/main`, stops the script with a message asking for the main page's address.

In the configuration block, find the line that starts `readonly GIT_REPO_URL=""` and put the address between its quotes, so that it reads:

```bash
readonly GIT_REPO_URL="https://github.com/John/notes"          # https://github.com/user/repo; "" = local only
```

Save the script, then run it again from the folder it's in:

```bash
cd ~/Downloads
START_PREVIEW=false bash zola-blog-setup.sh
```

`START_PREVIEW=false` in front of the command skips the preview, for this run only. You should see:

```
found an existing blog in /home/you/Desktop/myblog
updating the script-owned files; content/ is left untouched.

zola 0.23.6 present (inside the supported band >= 0.23, < 0.24); using it.
pinning zola 0.23.6 into the workflow (same build as this machine)
hashing the linux zola 0.23.6 build to pin it into the workflow...
pinned the zola builder digest into the workflow
wrote the script-owned files (config.toml, templates/, serve, build, new, attach, README.md, .gitignore)
added remote 'origin': git@github.com:John/notes.git

updated.

skipping the live preview. start it any time, from anywhere:
    /home/you/Desktop/myblog/serve
```

If some settings still have the values the script came with, you also see a line starting `still the examples the script came with` that names them; see "Before you publish".

This wrote `.github/workflows/deploy.yml`, the instructions GitHub follows to build and publish the site. It set the site's address to `https://John.github.io/notes`, and told git where to push (a link called `origin`). The "hashing" line is a second download of Zola, the Linux copy GitHub will use; the script records its fingerprint so that GitHub can check it later. See "What the checksum proves".

A re-run doesn't commit anything, so commit the new files yourself, from inside the blog folder:

```bash
cd ~/Desktop/myblog
git add -A
git commit -m "Set up publishing"
```

`git add -A` prints nothing. `git commit` prints a line such as `[main 1a2b3c4] Set up publishing` and how many files changed.

### Step 4: push

From inside the blog folder:

```bash
git push -u origin main
```

The first time, ssh may ask you to trust GitHub's fingerprint (as in step 1), and asks for your key's passphrase if you set one. git then prints some progress lines, ending with:

```
To github.com:John/notes.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

After this first time, `git push` on its own is enough. If git asks for a username and password, or says `src refspec main does not match any`, see Troubleshooting.

### Step 5: switch on GitHub Pages

Your push started a run of the workflow on GitHub. If Pages isn't switched on yet, that run fails at its deploy step, with an error that includes `Ensure GitHub Pages has been enabled`. That's expected the first time. Switch it on:

1. On the repository's page, click Settings, then Pages in the list on the left.
2. Under "Build and deployment", set Source to "GitHub Actions". Not "Deploy from a branch": with that, GitHub builds the repository its own way, with a tool called Jekyll that doesn't understand this blog.
3. Click the Actions tab, click "Deploy to GitHub Pages" in the list on the left, then Run workflow, and Run workflow again in the box that opens. (Or open the failed run and choose to re-run its jobs.)

The run takes a minute or two. When it finishes with a green tick, your blog is live at `https://John.github.io/notes/`, with your username and repository name in place of these. The deploy step shows the address too.

Other guides sometimes say to set Settings, Actions, General, Workflow permissions to "Read and write". Don't. This workflow already asks for exactly the permissions it needs, only in the part that needs them; that setting would give every workflow in the repository, including any you add later, permission to change it.

### Publishing changes from now on

Each time you want the live site to catch up with your computer, run these from inside the blog folder:

```bash
./build
git add -A
git commit -m "New post about tea"
git push
```

`./build` isn't required, but it builds the site the way GitHub does, so a mistake shows up in seconds on your computer instead of as a failed run on GitHub. It should end with `Done in ...`. The words after `-m` are a note to yourself about what changed. GitHub rebuilds and republishes in a minute or two; the Actions tab shows the progress.

`git status` tells you where you are. `nothing to commit, working tree clean` means every change is committed. If it also says `Your branch is ahead of 'origin/main'`, you have commits that aren't on GitHub yet, so run `git push`.

## Making it yours

### How changes work

There are three kinds of change, and each has its own place:

1. **Your writing and pictures**, in `content/` and `static/`, except `static/favicon.svg` and `static/search.js`, which are script-owned (see below). Edit these files directly, whenever you like. The script writes them once, when it creates the blog, and never touches them again.
2. **Settings**, in the configuration block at the top of the script. Change a value, then run the script again with `START_PREVIEW=false bash zola-blog-setup.sh`. The run rewrites the generated files to match.
3. **The design and the page layouts**, which also live in the script: each generated file is written by one `render_` function. `render_base_html` writes `templates/base.html`, which holds the whole stylesheet; `render_site_config` writes `config.toml`; `render_page_html` writes the layout of a post. Change the text inside the function, then run the script again. A function starts with a line such as `render_page_html() {`, and the file's text runs from the line after the one ending `<< 'EOF'` (in some functions, `<< EOF`) to the next line that is just `EOF`. You rarely need to find one by name, though: the sections below each give a piece of text to search for, which takes you to the line to change.

Run the script from the folder it's saved in (`cd ~/Downloads` first), or from anywhere with its full path: `START_PREVIEW=false bash ~/Downloads/zola-blog-setup.sh`. From any other folder, plain `bash zola-blog-setup.sh` stops with `No such file or directory`. When the run finishes, a preview that's already running reloads its page by itself; if none is running, start one with `~/Desktop/myblog/serve`.

The generated files are script-owned: `config.toml`, everything in `templates/`, `serve`, `build`, `new`, `attach`, `.gitignore`, `static/favicon.svg`, `static/search.js`, and `.github/workflows/deploy.yml`. Every run writes them again from the script, so a change made to one of them directly lasts only until the next run. So that such a change isn't lost without you noticing, a run stops before writing anything if one of them was edited by hand, and names the file. The script writes `README.md` too, but editing it doesn't stop a run: the file becomes yours instead. See "The hand-edit check".

A re-run changes files but doesn't commit them. After it, check the preview, then commit and push as in "Publishing changes from now on".

If you have a blog made with this script but don't have the script itself, none of this rewriting happens, and you can edit `config.toml` and `templates/` directly.

### Settings, one by one

Each setting is one line in the configuration block. After changing one, run the script again. The defaults are the values the script comes with.

#### Where the blog lives

**`PROJECT_DIR`**: the folder that your blog's folder goes in. Default: `"$HOME/Desktop"`, your Desktop. You can start it with `~` for your home folder, as in `PROJECT_DIR="~/blogs"`. A path that starts with neither `/` nor `~` counts from the folder you run the script in.

**`BLOG_NAME`**: the name of the blog's own folder. Default: `"myblog"`. Use letters, numbers, dashes and underscores; no spaces or slashes. The blog is at `PROJECT_DIR/BLOG_NAME`, for example `~/Desktop/myblog`. Readers never see this name; they see `SITE_TITLE`.

The script finds your blog by these two settings. If you change either one after the blog exists, the next run doesn't move the blog: it makes a second, new blog in the new place. To move or rename the blog, move or rename its folder as well.

#### Publishing

**`GIT_REPO_URL`**: your GitHub repository's address, such as `"https://github.com/John/notes"`. Default: `""`, empty, which gives a blog that lives only on your computer. Setting it does four things: it sets the site's address (here `https://John.github.io/notes`), writes the workflow that publishes the site, connects git to the repository, and fills in the optional "View history" and "Suggest an edit" links on each post. It must be the `https://github.com/` address of the repository's main page, as described in "Putting it online"; a `/` or `.git` on the end is fine, and anything else after the repository's name stops the run. Clearing it again removes the workflow; see "Turning something off removes its file".

**`CUSTOM_DOMAIN`**: your own domain, once you have one pointed at GitHub Pages, such as `"https://blog.example.com"`. Default: `""`. It changes the site's address and nothing else, and it must start with `https://`. See "Custom domain".

#### Your name and your words

**`SITE_TITLE`**: the blog's name. It appears at the top left of every page, in the browser tab, and in feed readers, and the favicon's letter comes from it. Default: `"Myblog"`, a placeholder.

**`SITE_DESCRIPTION`**: one line about the blog. It appears in small italics under the blog's name, on the home page only. It is also the feed's subtitle, and the description search engines and link previews show for any page that doesn't have its own `description` (see "A new post"). Default: `"one-line description"`, a placeholder. Set it to `""` for none.

**`SITE_AUTHOR`**: your name as it appears in the feed. Default: `"your name"`. Always set it to something: the feed format requires an author, and without one the feed isn't valid.

**`SITE_LANGUAGE`**: the language you write in, as a short code: `"en"` for English, `"hi"` for Hindi, `"ta"` for Tamil, `"fr"` for French, and so on. Default: `"en"`. Browsers, screen readers and search engines use it to handle your text correctly.

#### How it looks

**`LIGHT_THEME`**: `false` (the default) makes the site dark for every reader. `true` adds a light version, which readers see when their computer or browser is set to light mode; readers set to dark still get the dark one. There's no switch on the page for readers to change it themselves. See "Dark by default".

The About page's placeholder picture, `static/avatar.svg`, is drawn once, to suit this setting as it was when the blog was made. If you change `LIGHT_THEME` later, replace the placeholder with your own photo, which you'll want to do anyway.

**`MASTHEAD`**: what shows at the top left of every page.

- `"text"` (the default): the blog's name in bold, in the same typeface as the text.
- `"none"`: nothing, so the top of the page shows only the menu. The name at the top left is normally also the link back to the home page, so with `"none"` the menu starts with a Home link instead.
- `"image"`: a logo you supply, as `static/logo.svg`. See "Using a logo".

**`FAVICON_TEXT`**: what the favicon, the small icon in the browser tab, shows.

- `"auto"` (the default): the first letter or digit of `SITE_TITLE`, as a capital. Only the letters A to Z and the digits 0 to 9 count, so a title with none of those (one written entirely in Devanagari, say) gets no favicon, with a warning, unless you set `FAVICON_TEXT` yourself.
- Any one to three characters, such as `"AN"`, drawn as you typed them. Anything longer is cut to three characters, with a warning.
- `""`: the script draws no favicon, and you can supply your own. See "Using your own favicon".

**`LIGHT_CODE_THEME`** and **`DARK_CODE_THEME`**: the colour schemes for code examples in posts. Defaults: `"github-light"` and `"github-dark"`. Other pairs include `"solarized-light"` and `"solarized-dark"`, `"gruvbox-light-medium"` and `"gruvbox-dark-medium"`, or `"one-light"` and `"one-dark-pro"`. The full list is in the "Themes" part of the README of Giallo, Zola's highlighter, at github.com/getzola/giallo, and textmate-grammars-themes.netlify.app shows what each one looks like. A name that isn't on the list stops the build with ``Theme `...` does not exist``. With `LIGHT_THEME=false`, readers only ever see the dark one.

#### What's on the pages

**`SHOW_TOC`**: `true` (the default) puts a Contents box at the top of every post that has a date and at least two headings (or one heading with sub-headings under it), listing the headings as links. It starts folded, as one line, "▸ Contents", with a thin line under it, and opens when the reader clicks it. A page without a date, such as About, gets one only if it asks for it with `toc = true`; see "Adding a page to the menu". `false` leaves them all out.

**`SHOW_BREADCRUMBS`**: `true` (the default) puts a line above the title of a page in a folder: Home, then each folder above the page, all of them links, so a page in `content/projects/suite/` shows Home › Projects › Suite, and that folder's own page shows Home › Projects. Posts and other pages at the top of `content/` show nothing, and so do the pages of folders at the top, such as `content/projects/_index.md`, and pages in a folder with `transparent = true`, which are listed as posts. `false` leaves them all out. See "Child pages".

**`SHOW_READING_TIME`**: `true` (the default) shows an estimated reading time, such as "3 min read", on each post's date line. Zola works it out from the number of words. `false` leaves it out.

**`DATE_FORMAT`**: how dates are written on the date line. Default: `"%Y-%m-%d"`, which gives `2026-09-22`. `"%-d %B %Y"` gives `22 September 2026`, and `"%d %b %Y"` gives `22 Sep 2026`. `%d` is the day (`%-d` without a leading zero), `%B` the month's name, `%b` its first three letters, `%m` its number, and `%Y` the year. The value must have at least one `%` code, or the run stops. Browsers and search engines still get the date year-month-day, whatever this shows. For month names in another language, see "Changing the fixed words".

**`ENABLE_TAGS`**: `true` (the default) turns on tags. Tags show on posts and in lists, the menu gets a Tags link, and each tag gets a page listing its posts. `false` turns all of that off. Posts that still have tags in their front matter keep working; the tags are ignored.

**`ENABLE_SEARCH`**: `true` (the default) puts a Search button at the start of the menu, which opens a search box over the page. This is the only script on the blog's pages. `false` removes the button, the script and the search index, and the pages then run no JavaScript at all. See "Search".

**`GENERATE_FEEDS`**: `true` (the default) publishes your feed at `/atom.xml`, a list of your posts that feed reader apps and email services check for new ones. While tags are on, each tag also gets a feed of its own. `false` publishes no feeds and removes the RSS link. Email updates need the feed; see "Email subscription".

**`SHOW_RSS_LINK`**: `true` (the default) puts an RSS link in the menu. `false` removes just the link. The feed is still published, and feed readers still find it, because every page names it in its HTML head, the part of the page that browsers read but readers don't see. It has no effect when `GENERATE_FEEDS` is `false`.

**`SHOW_HISTORY_LINK`**: `false` (the default). `true` adds a "View history" link to each post's date line, leading to the list of commits that changed that post on GitHub. It needs `GIT_REPO_URL`. That list shows the name and email on each commit, which is one more reason to choose them with care (see "Your first blog", step 1).

**`SHOW_SUGGEST_EDIT`**: `false` (the default). `true` adds a "Suggest an edit" link to each post's date line, leading to the post's file on GitHub, where a reader with a GitHub account can propose a change. It needs `GIT_REPO_URL`.

#### The menu

**`MENU_PAGES`**: the pages in the menu at the top of every page, by their file names in `content/` without `.md`, separated by spaces, in the order the menu shows them. Default: `"about"`. Each link is labelled with that page's title. Search comes before them, and Tags and RSS after them, as their settings allow. See "Adding a page to the menu".

#### The footer

**`FOOTER_LINKS`**: the links at the bottom of every page, each written as a label, `=`, and an address, with a space between one link and the next. Default: `"X=https://x.com/yourhandle Nostr=https://nostr.com/npub1yourkeyhere GitHub=https://github.com/yourhandle/yourrepo"`, example addresses that lead nowhere. Put in your own addresses (for GitHub, the blog's repository), delete the pairs you don't want, or set it to `""` for none. See "Footer text and links".

**`FOOTER_TEXT`**: one line of plain text under the links, in smaller, fainter type, such as `"© 2026 John"`. Default: `""`, none.

#### Settings for a single run

These two are easiest to set for one run only, by putting them in front of the command rather than changing the file:

**`START_PREVIEW`**: `true` (the default) starts the preview when the run ends. For one run without it: `START_PREVIEW=false bash zola-blog-setup.sh`. The preview is also skipped when the script's output isn't going to a terminal, for example when another script runs it.

**`REGENERATE_TEMPLATES`**: `false` (the default). `true` lets a run overwrite script-owned files even if they were edited by hand, and a `README.md` you've edited. For one run: `REGENERATE_TEMPLATES=true bash zola-blog-setup.sh`. See "The hand-edit check".

One more, `ZOLA_VERSION_OVERRIDE`, is for the day a Zola newer than 0.23 comes out: the run stops then, and its message says how to use it.

#### Leave these alone

Further down the script, below the configuration block, `ZOLA_MIN_VERSION` and `ZOLA_MAX_VERSION` (`"0.23"` and `"0.24"`) set which Zola versions the script accepts. The templates only work with Zola 0.23.x, so changing these without rewriting the templates gives you a blog that doesn't build.

### The home page and the About page

**Home page text.** Anything you write in `content/_index.md`, below its closing `+++`, appears on the home page above the list of posts. Leave it empty for just the list.

**About page.** Edit `content/about.md`. It's an ordinary Markdown file with a title at the top. The round picture is set in its front matter; see "Your photo". Like any menu page, it can have a subtitle and a Contents box; see "Adding a page to the menu".

### Adding a page to the menu

The menu at the top of each page shows Search, then the pages named in `MENU_PAGES`, then Tags and RSS, depending on your settings. `MENU_PAGES` starts as `"about"`. To add a page of your own, such as a "Now" page:

1. **Make the page.** In the blog folder, save a new file in `content/` called `now.md`, containing:

   ```markdown
   +++
   title = "Now"
   hidden = true
   +++

   What I'm working on this month.
   ```

   The file's name becomes the page's address, so `content/now.md` is published at `/now/`. The title is the word the menu shows. `hidden = true` keeps the page out of the list on the home page, the feed, search and `sitemap.xml`, so the menu is how readers reach it.

2. **Add it to the menu.** In the script's configuration block, find the `MENU_PAGES` line and add the page's name, without `.md`, inside the quotes, after a space:

   ```bash
   readonly MENU_PAGES="about now"       # pages in content/, by name, in menu order
   ```

   The menu follows this order, so Now comes after About. Save the script.

3. **Apply it.** From the folder where the script is saved, run it again:

   ```bash
   START_PREVIEW=false bash zola-blog-setup.sh
   ```

   It prints `updated.`, then a note that it skipped the preview. If the preview is already running, its page reloads by itself, and with the default settings the menu then reads Search, About, Now, Tags, RSS. If the preview isn't running, start it with `~/Desktop/myblog/serve`.

If the page isn't there, because step 1 was skipped or the name is misspelt, the run stops before changing anything:

```
MENU_PAGES names nwo, but there's no content/nwo.md. make that page first (guide: "Adding a page to the menu"), or take nwo out of MENU_PAGES. nothing has been changed.
```

It stops the same way, naming the page, if the page doesn't say `hidden = true`. Without it the page counts as a post: listed on the home page if it has a `weight`, and left out of the site if it hasn't, so `./build` fails with a message about pages that produced no HTML.

On a new blog, the first run makes a starter page for each name in `MENU_PAGES` other than `about`: with `MENU_PAGES="about now"` set before the first run, you get `content/now.md`, titled "Now", ready to fill in.

To take a page out of the menu, delete its name from `MENU_PAGES` and run the script again. The page itself stays, at its address. `MENU_PAGES=""` leaves only Search, Tags and RSS.

The menu shows only the blog's own pages. A link to another site goes in the footer instead; see "Footer text and links". A menu page with pages of its own under it is a folder instead, `content/projects/_index.md`, without `hidden = true`, and `MENU_PAGES` takes it by the same name, `projects`; "Child pages" says how to make one, or turn a menu page into one. A folder in the menu isn't also listed on the home page. Don't keep both `projects.md` and `projects/_index.md`: Zola won't build two pages at one address, and the run stops and says so.

**A subtitle and a Contents box.** A menu page can have both, as a post can. For a subtitle under the title, add a `description` line to its front matter. For a Contents box listing the page's headings, add `toc = true` under an `[extra]` line. Keep `[extra]` below `title`, `description` and `hidden`, because everything written after it counts as part of it:

```markdown
+++
title = "Now"
description = "What I'm working on this month"
hidden = true
[extra]
toc = true
+++
```

If the front matter already has an `[extra]` line, as the About page's does, put `toc = true` under that one instead: a second `[extra]` line stops the build with `Error when parsing front matter of page`. The box appears only while `SHOW_TOC` is on, and only if the page has at least two headings, or one with sub-headings under it. The subtitle is also what search engines and link previews show for the page.

### Footer text and links

The footer shows links, from `FOOTER_LINKS`, and under them a line of small print, from `FOOTER_TEXT`. Either can be empty; with both empty, there's no footer.

Each link is a label, an `=`, and an address, and a space separates one link from the next. The script starts you with example links for X, Nostr and GitHub, the GitHub one for the blog's repository. To drop a link, delete its pair. This keeps X and GitHub and drops Nostr:

```bash
readonly FOOTER_LINKS="X=https://x.com/John GitHub=https://github.com/John/notes"
```

To add a link, add a pair where you want it to appear. This adds Mastodon after X:

```bash
readonly FOOTER_LINKS="X=https://x.com/John Mastodon=https://mastodon.social/@John GitHub=https://github.com/John/notes"
```

`FOOTER_LINKS=""` drops every link. Save the script and run it again after each change. Each label is one word. Each address must start with `https://`, `http://` or `mailto:` (for an email link, `Email=mailto:you@example.com`); anything else stops the run with a message that names the link, because an address without one would lead to a page inside your own blog.

The small print is one line, such as a copyright notice, shown under the links in smaller, fainter type:

```bash
readonly FOOTER_TEXT="© 2026 John"
```

It's shown as plain text: HTML in it appears as those characters, so type a sign such as © itself, not `&copy;`. The year doesn't change by itself.

To show a straight quote, `"`, put a backslash before it, as anywhere in the configuration block. Doubling it, `""`, doesn't work:

```bash
readonly FOOTER_TEXT="© 2026 John · \"Soli Deo Gloria\""
```

Curly quotes, “ and ”, need no backslash.

### Your photo

The About page shows a round placeholder picture. To use a photo of yourself instead:

1. **Copy the photo into the blog, without its hidden data.** From inside the blog folder, with your photo's path in place of `~/Pictures/me.jpg`:

   ```bash
   ./attach ~/Pictures/me.jpg me
   ```

   It prints `copied to content/attachments/me.jpg, without its location and camera data. in a post, write:` and a line for posts, which you don't need here. Your original file isn't changed.

   Photos from phones and cameras carry hidden data called EXIF, which often includes where and when the photo was taken, and the phone or camera model. Everything you commit is published, in your public repository and on the site, so `./attach` removes that data on the way in. It keeps only the tag that says which way up the photo goes, so the photo isn't shown sideways. It needs exiftool (on Debian, Devuan or Ubuntu, `sudo apt install libimage-exiftool-perl`; on a Mac, `brew install exiftool`); without it, `./attach` says how to install it and copies nothing.

2. **Name the photo in the About page.** In `content/about.md`, find `avatar_photo = ""` in the `[extra]` part and change it to:

   ```toml
   avatar_photo = "attachments/me.jpg"
   ```

   The path starts from the `content` folder, so a bare `"me.jpg"` isn't found and the build stops with `` `resize_image`: Cannot find file: me.jpg ``.

When it builds the site, Zola makes a small square copy of the photo (240 by 240 pixels, shown at 120), so readers download a small file. The original is published too, at `/attachments/me.jpg`, which is why step 1 cleans it first.

**Without `./attach`.** The same cleaning is one exiftool command, run from inside the blog folder. It writes a cleaned copy into the attachments folder and leaves your original as it was:

```bash
exiftool -all= -tagsfromfile @ -orientation -o content/attachments/me.jpg ~/Pictures/me.jpg
```

It prints `1 image files created`. To check the copy, run `exiftool content/attachments/me.jpg`: no line in its output should start with GPS, Make, Camera Model Name, or Date/Time Original.

The other key, `avatar = "avatar.svg"`, is the placeholder. It names a file in `static/`, which is shown as it is, without being shrunk. Use it for an SVG drawing (a picture made of shapes rather than dots, which most drawing programs can save), because Zola can't shrink those. If both keys are set, `avatar_photo` wins.

### Pictures, GIFs and video

Pictures, GIFs and videos all go in one folder, `content/attachments/`, and any post or page can use them.

To put a picture in a post, add it with the blog's `attach` helper, from inside the blog folder, giving the picture's path and a new name for it:

```bash
./attach ~/Pictures/IMG_0001.jpg tea-hills
```

It prints:

```
copied to content/attachments/tea-hills.jpg, without its location and camera data. in a post, write:
![what it shows](@/attachments/tea-hills.jpg)
```

Paste the second line into the post, and replace "what it shows" with a description of the picture:

```markdown
![Hills at sunrise, seen from the ridge](@/attachments/tea-hills.jpg)
```

The helper removes the photo's hidden data (see "Your photo", step 1), keeps the tag that says which way up it goes, and leaves your original as it was. The file keeps its own extension, in lower case. Every file shares this one folder, so two files can't have the same name: `IMG_0001.jpg` from two phones would clash, which is why you give each a new name, after its post, in lowercase with dashes. The helper refuses a name that's taken, and refuses HEIC pictures, which most browsers can't show; export those as JPEG first. It needs exiftool; if it isn't installed, `./attach` says how to install it. To do it without the helper, use the exiftool command at the end of "Your photo", with the picture's path and its new name.

An SVG drawing is the one kind of picture that neither `./attach` nor exiftool can clean, so `./attach` says so and copies nothing. Save the drawing as a plain SVG instead (in Inkscape, File, then Save As, with Plain SVG as the type), which leaves out Inkscape's own notes, such as the file's name and a folder on your computer. Then copy it into `content/attachments/` yourself, under a new name, and link to it as above.

The words in square brackets describe the picture for readers who can't see it, including blind readers using screen readers, so always fill them in. `@/` means "starting from the `content` folder". Zola turns the path into the picture's full address, so it works at any site address and in feed readers, and if the name is wrong, the build stops with `Broken relative link` instead of publishing a missing picture. A picture never shows wider than the text column, or taller than 85% of the window; a big photo is shrunk to fit.

A GIF goes in the same way, as a picture. A video needs a line of its own, because Markdown has no way to show one:

```
{{<video src="attachments/tea-bus.mp4" />}}
```

That shows the video with its play button and controls. `./attach` works for MP4 and MOV videos too, and prints this line for them; it can't clean WebM videos, because exiftool can't write them. To have a video play by itself, silently and on a loop, like a GIF, add `loop="yes"`:

```
{{<video src="attachments/tea-bus.mp4" loop="yes" />}}
```

Here the path starts from the `content` folder without `@/`. If the file isn't there, the build stops with `` `get_url`: could not resolve URL for link `@/attachments/tea-bus.mp4` not found ``. The same clip is usually much smaller as a video file than as a GIF, so for anything longer than a moment, use a video with `loop="yes"`. A looping video still has its controls, which show when the reader points at it or taps it, so anyone distracted by the movement can pause it. A GIF can't be paused in any browser, which is one more reason to use a video for anything that loops for more than a few seconds.

**Mind the size of videos.** The blog lives in its GitHub repository, every version of every file. GitHub warns about any file over 50 MiB and refuses one over 100 MiB. It recommends keeping a repository under 1 GB, and won't publish a site over 1 GB. git also keeps every file you've committed in the repository's history, so deleting a video later doesn't give the space back. Short clips are fine. A long video belongs on a video site, and showing it in a page from there means loosening the security policy; see "The security policy".

**What makes the folder work.** `content/attachments/_index.md`, which the script writes for a new blog, tells Zola to publish the folder. Its `redirect_to = "/"` sends anyone who opens `/attachments/` to the home page, and `in_search_index = false` keeps it out of search. The address `/attachments/` still appears in `sitemap.xml`, the list of pages that search engines read, as a redirect: Zola can't leave one folder out of the sitemap. That's harmless. Don't add `render = false` to that file: Zola then publishes nothing in the folder, and every `@/attachments/` link stops the build.

If `content/attachments/_index.md` goes missing, each run warns you, and every `@/attachments/` link stops the build. To put it back, save this in the folder as `_index.md`:

```markdown
+++
title = "Attachments"
sort_by = "none"
in_search_index = false
redirect_to = "/"
+++
```

Don't put pictures in `static/` and refer to them with a path starting with `/`, such as `/hills.jpg`. A path like that points at the root of your web address, and on an address such as `John.github.io/notes` the root is `John.github.io`, outside your blog, so the picture shows in the preview but not on the published site.

### Fonts

The design uses a typeface called Charter. It doesn't come with the script; you download it yourself, and until you do, readers see the first of several similar typefaces that their own computer has. That fallback can look quite different. In the text column, Charter fits about 79 characters to a line, Palatino 76 and DejaVu Serif 68. A Times-like typeface such as Liberation Serif, common on Linux, fits about 85, which is too many for comfortable reading. So install Charter:

1. Download it from practicaltypography.com/charter.html. It's free, including for commercial use. The download is a zip file with several formats in it. Open it (double-click it in your file manager) and find the four files whose names end in `.woff2`.
2. Copy the four `.woff2` files (regular, italic, bold, and bold italic) into your blog's `static/fonts/` folder, named exactly:

   ```
   charter_regular.woff2
   charter_italic.woff2
   charter_bold.woff2
   charter_bold_italic.woff2
   ```

   Rename them if they're called something else.

3. Reload the page in your browser (F5). The text should change typeface.

`static/fonts/` is yours, so re-runs never touch these files. `static/fonts/README.txt` is published along with everything else in `static/`, at `/fonts/README.txt`. It's harmless, but you can delete it once the fonts are in.

Don't load fonts from a font service such as Google Fonts. Each reader's browser would then contact that service, which would learn their IP address and which page they were reading. The site's security policy blocks this anyway, unless you change the policy.

### Colours, sizes and typefaces

The whole stylesheet is in `templates/base.html`, which the script writes from `render_base_html`. So make design changes in the script, in `render_base_html`, not in `templates/base.html`. Its first part, between the comments `YOUR DESIGN` and `END DESIGN`, holds the settings you're likely to want. The rest, marked `STRUCTURE`, is the layout, which reads those settings; leave it alone unless you know CSS.

The settings are called custom properties, lines like `--accent: #ffb454;`. Colours are written as hex codes (`#ffb454` is an orange); any colour picker shows the code for a colour. Sizes use `rem`, which is relative to the reader's standard text size (usually 16 pixels, so `1.2rem` is about 19 pixels), and `em`, which is relative to the text around it.

| Setting | What it controls | Dark value | Light value |
|---|---|---|---|
| `--bg` | Page background | `#111` | `#fffff8` |
| `--fg` | Text | `#e8e6da` | `#111` |
| `--muted` | Quieter text: dates, menu, footer, notes | `#aaa8a0` | `#57564e` |
| `--link` | Links in your text, once the reader has followed them. Until then a link takes the colour of the text around it; either way it's underlined. Footnote numbers, which have no underline, have this colour whether followed or not. The links the site adds by itself, such as its lists of posts, child pages, tags and search results, the menu, Previous and Next, and the footer, keep their own colours, followed or not | `#94b9dc` | `#295a8e` |
| `--accent` | Code words in sentences, the outline around the search box while you type in it, and the "(draft)" label | `#ffb454` | `#9d4909` |
| `--surface` | Table header rows | `#242420` | `#f4f2e8` |
| `--inline-bg`, `--inline-border` | Background and border of code words in sentences | `#2b281f`, `#3a382f` | `#ece3cd`, `#e0d8c2` |
| `--border` | Thin lines around tables, quotes, code examples and boxes | `#2c2c28` | `#e5e3d7` |
| `--border-strong` | The lines under titles and under the Contents box, and dividers | `#42423c` | `#c2bda4` |
| `--control-border` | The search box's border, dark enough to see (3:1 against the page, as accessibility guidelines ask) | `#6e6c64` | `#8a8676` |
| `--hairline` | The style of those lines; `none` removes them all | `1px solid var(--border-strong)` | |
| `--measure` | Width of the text column | `42rem` | |
| `--wide` | Widest a wide page or wide element can go | `62rem` | |
| `--body-size`, `--body-leading` | Text size and line spacing | `1.2rem`, `1.55` | |
| `--wordmark-size` | Size of the blog's name at the top left | `1.5em` | |
| `--h1-size`, `--h2-size`, `--h3-size` | Heading sizes. On screens narrower than 576 pixels, `--h1-size` is `1.9rem`, set just below the light list | `2.25rem`, `1.7rem`, `1.35rem` | |
| `--serif`, `--mono` | Typefaces for text and for code, first choice first | Charter, …; system monospace, … | |

The dark values come first in the block. The light values, used only when `LIGHT_THEME=true`, are in a second list just below it, headed `@media (prefers-color-scheme: light)`. With the light version on, change a colour in both lists.

For example, to make the accent colour teal:

1. Open the script and search for `--accent: #ffb454`.
2. Change it to `--accent: #4fd1c5;` and save.
3. Run the script again with `START_PREVIEW=false bash zola-blog-setup.sh`. If the preview is running, it reloads by itself; if not, start it with `~/Desktop/myblog/serve`. Code words in the example post are now teal.

Keep `--wordmark-size` between about `1.45em` and `1.85em`. Below that, headings inside posts are bigger than the blog's name; above it, the name is bigger than each post's title. If you make `--h2-size` bigger, the lower limit goes up with it: the name has to stay bigger than an `h2`.

For a bigger redesign, copy everything from `YOUR DESIGN` to `END DESIGN`, give it to an AI model with a request such as "restyle this to look like an old typewritten letter, and leave everything inside `{{ }}` and `{% %}` exactly as it is", and paste the result back in place of the original. That last part matters: the block has template code in it, in the font lines and around the light colours, and changing that breaks the fonts or the build. Code examples don't follow these colours; they use `LIGHT_CODE_THEME` and `DARK_CODE_THEME`.

### Using a logo

With `MASTHEAD="image"`, the top left shows `static/logo.svg`, which you supply. The logo is used as a stencil: its shape is filled with the text colour, so the same file works on dark and light pages. Make it a flat shape, such as a monogram, on a transparent background, and save it as an SVG file. Any background in the file counts as part of the shape, so the whole box comes out solid. If the file is missing, the top left shows an empty space, and each run warns you about it. The logo's size follows `--wordmark-size`.

### Using your own favicon

The script draws `static/favicon.svg` from `FAVICON_TEXT`, and draws it again on every run, so change the setting, not the file. The letter is dark, and turns light when the reader's browser or computer is in dark mode, because the tab bar it sits in follows that setting even when your site is dark for everyone.

To use a favicon of your own, set `FAVICON_TEXT=""`, put your file in place as `static/favicon.svg`, and run the script. The run deletes the favicon only if it's still exactly the one the script drew, so your own file is safe, and from then on the script doesn't write, check or delete it. Don't swap the file while `FAVICON_TEXT` is still set: the run then stops at the hand-edit check, and `REGENERATE_TEMPLATES=true` would draw over your file.

A favicon can't use Charter or any other web font, because browsers load it as an image, and images can't load fonts. The drawn one uses Palatino, Georgia or another serif typeface, depending on what the reader's computer has.

### Dark by default

With `LIGHT_THEME=false` the site is dark for every reader, whatever their computer is set to. With `true`, a reader whose computer or browser is set to light mode gets the light version, and everyone else gets the dark one. There is no switch on the page: that would need a script on every page, or a cookie.

Code examples follow the same rule. The highlighter writes both a light and a dark colour into every code example, and with `LIGHT_THEME=false` the stylesheet forces the dark ones, so a reader in light mode doesn't get pale code on a dark page.

If dark mode looks wrong on your own computer but right on others, suspect your desktop's settings rather than the blog. On some Linux desktops, including XFCE, the browser can't always tell whether you prefer dark and guesses from your desktop theme. To test the light version, use the browser's developer tools, which can pretend the computer prefers light or dark.

### Changing the fixed words

The words the site shows by itself, such as "All posts" or "min read", are written into the templates. To change them, for example to write your blog in another language, search the script for the text in the right-hand column, change the words on that line, and run the script again. Each search finds one line, except where the table says otherwise.

| Words on the site | Search the script for |
|---|---|
| The names of your pages in the menu | Each page's `title`, in its file in `content/` |
| Tags, RSS (the menu), and Home (the menu's first link with `MASTHEAD="none"`, and the first link above the title of a page in a folder) | `>Tags</a>`, `>RSS</a>`, `>Home</a>`, which finds three lines: the menu's, the one above the title, and the one on the "page not found" page |
| The footer's link labels and small print | The `FOOTER_LINKS` and `FOOTER_TEXT` settings |
| Search (the button), and the empty search box's grey hint | `>Search</button>` and `placeholder="Search"` |
| nothing matches, search is unavailable | The words themselves |
| 1 result, results (read out to screen readers as you search) | `1 result`, the line with both |
| Contents, Updated, min read, View history, Suggest an edit | `>Contents<`, `Updated <time`, `min read<`, `>View history<`, `>Suggest an edit<` |
| (draft) | `>(draft)<`, which finds two lines: a row in a list, and a post's own title |
| Tags:, Previous, All posts, Next (at the bottom of a post; the last three also under a folder's list) | `>Tags:`, `Previous<`, `>All posts<`, `>Next<` |
| Tags (the heading of the tags page, and its name in the browser tab) | `>Tags</h1>` and `title %}Tags` |
| Posts tagged:, post, posts, All tags | `Posts tagged:`, which finds two lines (change both), `post{% if`, `All tags` |
| The "page not found" page | `Page not found` for its title, `This page isn't here` for its text |
| Site, Previous and next, Breadcrumb, contents, Search (the names screen readers give the three menus, the Contents box and the search box) | `aria-label="Site"`, `aria-label="Previous and next"`, `aria-label="Breadcrumb"`, `aria-label="contents"`, `aria-label="Search"` |

Change only the words, not the `{{ }}` or `{% %}` parts around them, and keep any quotes in place. For example, to change the grey hint in the search box, search for `placeholder="Search"`, which finds this line:

```html
<input type="search" aria-label="Search this site" placeholder="Search" autocomplete="off">
```

Change the text after `placeholder=`, like this:

```html
<input type="search" aria-label="Search this site" placeholder="Search the notes" autocomplete="off">
```

`aria-label` is what a screen reader announces for the box; change it too if it no longer fits. Don't use a `"` inside either value.

Dates follow the `DATE_FORMAT` setting. For month names in another language, search the script for `date(format=config.extra.date_format)`, which finds two lines, and change it in both to:

```
date(format="d MMMM y", locale="hi_IN")
```

That shows `22 सितंबर 2026`; use `ta_IN` for Tamil, `fr_FR` for French, and so on. With a locale, the format is written this other way, `d MMMM y`, not with `%` codes, and `DATE_FORMAT` no longer applies. The `locale` option needs Zola 0.23.5 or later: on 0.23.4 and earlier the date comes out as the letters `d MMMM y`, with no error. `zola --version` shows which you have, and "Moving to a newer Zola" says how to move on.

## Writing posts

### A new post

A post is one Markdown file in `content/`. The file's name, without `.md`, becomes the post's address, so `content/tea-in-the-hills.md` is published at `/tea-in-the-hills/`. Use lowercase letters, numbers and dashes in file names.

Every post starts with its front matter, between two lines of `+++`:

```markdown
+++
title = "Tea in the hills"
description = "Notes from a week above the clouds"
weight = 30
date = 2026-09-22
[taxonomies]
tags = ["travel", "tea"]
+++

The first paragraph of the post.
```

Save the file, and the preview shows the new post in the list on the home page.

- **`title`**: the post's title, in quotes. It can only go here: Zola doesn't take a title from a `#` heading in the text, and a post without a `title` shows up in the list as a number with nothing after it.
- **`description`** (optional): a subtitle, shown under the title in quieter italic. It's also what search engines and link previews show for the post, in place of `SITE_DESCRIPTION`.
- **`weight`**: where the post goes in the list, as a whole number without quotes; lower numbers come first. Every post needs one. A post without a weight is left out of the site, and `./build` stops with a message saying so. See "Ordering posts".
- **`date`**: the date shown under the title, written year-month-day. The feed needs it too: a post without a date isn't in the feed, so it never reaches feed readers or email subscribers. A post without a date also has no date line, no reading time and no Contents box, but it's still in the list on the home page, with Previous and Next links. Give every post a date unless you have a reason not to.
- **`updated`** (optional): when you last changed the post, in the same format. If it's different from `date`, the post shows both. It doesn't move the post in the list.
- **`[taxonomies]`** and **`tags`** (optional): the post's tags, in quotes, separated by commas. Keep these two lines last in the front matter, because everything written after `[taxonomies]` counts as part of it. A `tags` line without `[taxonomies]` above it is ignored, with no error, and the post has no tags.

Text goes in quotes, like the title; numbers, dates, `true` and `false` go without. A slip here stops the build with `Error when parsing front matter`; see Troubleshooting.

The date line also shows an estimated reading time, which Zola works out from the text. `SHOW_READING_TIME=false` leaves it out.

Two more front matter lines can be useful. Put them above `[taxonomies]`:

- **`draft = true`** leaves the post out of the published site. The preview still shows it, with "(draft)" after its title in the list and on the post, and counts it in the numbering and in the Previous and Next links, which the published site won't. Once committed, the file is still in your repository, which is public, so a draft isn't secret.
- **`slug = "tea"`** changes the post's address to `/tea/` without renaming the file.

**The quick way to start a post.** The blog's `new` helper writes the front matter for you. From inside the blog folder, give it the post's file name, without `.md`:

```bash
./new tea-in-the-hills
```

On a new blog, where the two example posts have the weights 10 and 20, it prints:

```
made content/tea-in-the-hills.md, a draft at weight 30: ./serve shows it, and deleting its draft line publishes it.
```

The file has a title made from the name, "Tea in the hills", the next free weight, which puts the post at the end of the list, today's date, and `draft = true`. Change the title as you like, add a `description` or tags if you want them, and write the post below the block. When it's ready, delete the `draft = true` line and change `date` to that day. Until you do, the date is the day you started the post, and an email service can skip a post whose date is more than a day old; see "How a new post reaches subscribers". The name takes lowercase letters, digits and dashes, and the helper refuses one that's already taken.

### Ordering posts

The home page lists posts by `weight`, lightest first, and numbers them 1, 2, 3 in that order. Nothing else changes the order: editing a post, or adding an `updated` date, doesn't move it. A folder with child pages is numbered among the posts by the `weight` in its `_index.md`, the same way; see "Child pages".

Number the weights 10, 20, 30 rather than 1, 2, 3. Then a post that belongs between two others can have 15, and no other file needs changing. Readers never see the weights, only the position in the list, so gaps don't show, and deleting a post renumbers the rest. Addresses come from file names, so reordering never changes them. `./new` works this way too: it gives a new post a weight 10 more than the heaviest post or folder, so the post goes at the end of the list.

The Previous and Next links at the bottom of each post follow the same order, and go through folders too: Next from the entry above a folder leads to the folder's page, then down the folder's own list, into any folders inside it, and from the end of that list on to the entry after the folder. Previous goes back the same way. So from the first entry, Next after Next reads everything in the order the lists show it, to the end. The first entry's Previous is the home page, and every other post, child page and folder's page has an All posts link back to it.

To list posts by date instead, newest first, open `content/_index.md` (it's yours, so edit it directly) and change `sort_by = "weight"` to `sort_by = "date"`. Every post then needs a `date`, and weights are ignored, except a folder's: a folder has no date, so the folders come first, in the order of their weights. `sort_by = "update_date"` does the same but uses `updated` when a post has one, so a post you give a newer `updated` date moves back to the top. Posts stay numbered; to show bullets instead, change `<ol class="post-list">` and its closing `</ol>` to `<ul class="post-list">` and `</ul>` in `render_components` in the script, and run it again.

### Markdown in brief

The most common things you'll write:

| You type | You get |
|---|---|
| `## Heading` | A heading. Use `##` and `###`; the post's title is already the top heading. |
| `**bold**`, `*italic*` | **bold**, *italic* |
| `[link text](https://example.com)` | A link |
| `https://example.com`, or `<https://example.com>` | A link that shows the address itself |
| `- item` | A bulleted list |
| `1. item` | A numbered list |
| `> quoted text` | A quotation |
| `---` on a line of its own, with a blank line above it | A dividing line; straight after a heading, a line under the heading |
| A blank line | A new paragraph |

The example post, `content/hello-world.md`, shows all of these and more: tables, code, footnotes, notes, and pictures. Open it in your editor next to its page in the preview to see how each part is written.

### Links

**To another post**, write `@/` and the file's path inside `content/`: `[the second post](@/second-post.md)`. The link comes out right whatever your site's address, and if the file doesn't exist the build stops with `Broken relative link`, so a typo can't reach the published site.

**Not like this:** `[the second post](second-post.md)` or `[the second post](./second-post.md)`. Zola doesn't turn a path to a `.md` file into the address of its page, so the link points at a file that isn't published, and readers get a "page not found". It isn't checked when the site is built either. Links to your own pages start with `@/`, Zola's own sign for "find this file and link to its page", and the path after it starts from the `content` folder, wherever the page with the link is.

**To a folder's page**, name its `_index.md`: `[the projects](@/projects/_index.md)`.

**To a heading.** Every heading gets an id made from its text, so `## Ingredients and tools` gets `#ingredients-and-tools`. Link to it in the same post with `[the ingredients](#ingredients-and-tools)`, or in another post with `[the method](@/recipes/sourdough.md#method)`. The build also stops if a heading named in an `@/` link doesn't exist. If you might reword a heading later, give it a fixed id so links to it keep working:

```markdown
## Ingredients and tools {#ingredients}
```

**To other websites**, write ordinary links. They open in a new tab, and Zola adds `rel="noopener nofollow noreferrer external"` to each one. That stops the other site learning which of your pages the reader came from, and tells search engines the link isn't an endorsement.

**An address on its own is a link too.** `https://example.com`, pasted into a sentence as it is, becomes a link that shows the address, the same as `<https://example.com>`, and opens in a new tab like other links to other sites. A full stop, comma or closing bracket straight after it stays outside the link, unless the bracket belongs to the address, as in some Wikipedia addresses. It needs the `https://` or `http://` at the front: for `example.com` alone, write `<https://example.com>`, or give it words, as in `[the dictionary entry](https://example.com)`. An address in code, between backticks or in a code example, stays plain text.

Headings don't have link symbols beside them. To get a link to a section, open the post's Contents box, right-click the heading there, and copy the link.

### Code examples

Put code between two lines of three backticks, with the language's name after the first ones, and it gets coloured:

````markdown
```python
def greet(name):
    print(f"hello, {name}")
```
````

Without a language name, the code is shown plain, without colours. You can add options after the language name, separated by commas:

- `linenos` numbers the lines, and `linenostart=20` starts the numbering at 20.
- `hl_lines=2 4-5` highlights lines 2, 4 and 5 with a background colour from the code theme.
- `hide_lines=3` leaves line 3 out.

For example, ```` ```python,linenos,hl_lines=2 ````.

There's no copy button; readers select code the usual way, and can select part of a line.

**Text that looks like template code.** Zola 0.23 reads posts as templates, so `{{` and `{%` have a special meaning in a post, even inside a code example, and so does `{#` in any post that has either of them. A post showing a GitHub Actions setting such as `${{ steps.deployment.outputs.page_url }}` stops the build with an error like ``Variable `steps` is not defined``, and other template markers can quietly be replaced by something else. To show such text as it is, put `{% raw %}` on a line before it and `{% endraw %}` on a line after:

````markdown
{% raw %}
```yaml
url: ${{ steps.deployment.outputs.page_url }}
```
{% endraw %}
````

For a post with a lot of such text, you can switch this off for the whole file instead. Search the script for `build_search_index =`, add this line directly below that one, naming the file from `content/`, and run the script again:

```toml
skip_content_templating = ["actions-notes.md"]
```

Zola then reads that post as plain Markdown, and `{{`, `{%` and `{#` in it are shown as they are.

### Notes, fold-away sections, and wide items

Four extras, all written as small pieces of HTML in the post:

```markdown
<aside>

A smaller, quieter passage, with a line down its left side.

</aside>

<details>
<summary>Show the working</summary>

Hidden until the reader clicks "Show the working".

</details>
```

The blank lines matter. Without them, the Markdown inside isn't read as Markdown, and asterisks and brackets show up on the page as they are. So this doesn't work:

```markdown
<aside>
A note with *emphasis*.
</aside>
```

For more width:

- `<div class="wide" hidden></div>`, anywhere in a post, makes that whole post wider, running text included. It's for posts with big tables or pictures throughout.
- `class="bleed"` on a single element lets just that element use the extra width, while the text stays at its normal width. Put it on a `<figure>` or a `<div>` at the top level of the post (not inside a list or quote). For a Markdown table, wrap it in `<div class="bleed">` and `</div>`, with a blank line after the opening tag and another before the closing one.

If a post uses both, `bleed` wins and the text stays at its normal width. The text column is `--measure` (42rem) wide, and the extra width goes up to `--wide` (62rem).

### Numbered outlines

To number a list as 1, 1.1, 1.2, 1.2.1, 2 and so on, number each level the ordinary way, `1.`, `2.`, `3.`, and indent each level under the one above:

```markdown
1. First
    1. Sub one
    2. Sub two
        1. Detail
2. Second
```

This shows as 1, 1.1, 1.2, 1.2.1, 2. The numbers are worked out for you, so adding or removing an item renumbers everything after it. The same text shows as an ordinary nested list anywhere else, such as on GitHub.

Don't type `1.1` yourself. Markdown doesn't know it as a list number, so a line starting `1.1` is joined onto the item above it as ordinary text. This list, for example, comes out as two items, the first reading "First 1.1 Sub one 1.2 Sub two":

```markdown
1. First
    1.1 Sub one
    1.2 Sub two
2. Second
```

Indent each level by four spaces or one tab. Two spaces isn't enough for a numbered list, even though it is for a bulleted one: the line becomes the next item at the same level instead of a sub-item, so this shows as 1 and 2, not 1 and 1.1:

```markdown
1. First
  1. Sub one
```

If your editor's Tab key puts in two spaces, set it to four for Markdown files, or type four spaces.

A numbered list is broken by anything that isn't indented under it, such as a code example or a paragraph at the left margin. When the list carries on after the break, its sub-items are numbered plainly (1, 2) rather than as 3.1, 3.2, because the numbering can't see where the list restarted. Indent the code or paragraph under its list item to keep the list in one piece.

### Footnotes

Write `text[^1]` where the note belongs and `[^1]: The note.` on a line of its own, anywhere in the post. The notes are collected at the bottom of the post, each with a link back to where it was mentioned.

### Child pages

A child page sits under another page, its parent, which lists it: `/projects/` listing `/projects/tool-a/` and `/projects/tool-b/`, for example. The parent is a section, a folder with an `_index.md` in it, and its children are the pages in that folder:

```
content/projects/_index.md          the parent, published at /projects/
content/projects/tool-a.md          a child, at /projects/tool-a/
content/projects/tool-b.md          another child, at /projects/tool-b/
```

You write the files, and the parent makes the list by itself, under its own text. Only a page with pages under it needs a folder. Every other page, menu pages included, is a single `.md` file.

To make that Projects page:

1. **Make the parent.** In the blog's `content/` folder, make a folder called `projects`, and save a file in it called `_index.md`, with the underscore, containing:

   ```markdown
   +++
   title = "Projects"
   sort_by = "weight"
   +++

   Things I have built.
   ```

   The folder's name becomes the page's address, `/projects/`, and the text below the closing `+++` is shown above the list. `sort_by = "weight"` lets you choose the order of the list. Leave out `hidden = true`, which a menu page has: in a parent, it empties the list; see "When the list doesn't appear" below.

2. **Add the children.** Save each child in the same folder, written like a post, with a `title` and a `weight`:

   ```markdown
   +++
   title = "Tool A"
   weight = 10
   +++

   What Tool A does.
   ```

   Saved as `content/projects/tool-a.md`, it's published at `/projects/tool-a/`. Save `tool-b.md` beside it the same way, with `weight = 20`. Lighter weights come first, as on the home page; see "Ordering posts". `./new` makes only posts, so write a child's file yourself.

3. **Look at it.** With the preview running, open `http://127.0.0.1:1111/projects/`. It shows the title and your text, then a numbered list: Tool A first, Tool B second. Each title opens its page. Above each child's title is Home › Projects, links to the home page and back to this page. At the bottom of each child are Previous and Next links, and the All posts link, which goes to the home page. The Projects page has Previous and Next links too, under its list. They read the list in order: Projects, Tool A, Tool B, then on to whatever follows Projects on the home page.

The home page lists the parent by itself, with no link to write, numbered among your posts by the `weight` in its `_index.md`: with `weight = 25`, Projects comes between the posts weighing 20 and 30. On an equal weight the folder comes first, and a folder without a weight comes before every post. Child pages aren't in the home page's list; their parent's page lists them. To keep a parent off the home page, put it in the menu instead, by adding `projects` to `MENU_PAGES`: a folder in the menu isn't in the list, and the Previous and Next links of its pages stay within its own list. See "Adding a page to the menu".

**What the list shows.** Every page in the parent's folder, with any folders inside it numbered among them by weight, as on the home page, except:

- a page with `hidden = true`, which is published but listed nowhere; see "Pages that aren't posts";
- a draft, which only the preview lists, marked "(draft)";
- a page without a `weight`, while the parent sorts by weight: Zola leaves it out of the site, and `./build` stops with a message naming it.

**When the list doesn't appear.** One of three slips:

- **The parent's `_index.md` says `hidden = true`.** Its children take it on: the parent lists none of them, they lose their Previous and Next links, and they drop out of search, the feed and `sitemap.xml`, though they're still published. Delete the line.
- **The file is `index.md`, without the underscore.** A folder with `index.md` is just one page, with any files beside it, and it can't have children: a Markdown file put beside its `index.md` is published, but nothing lists it. Rename it `_index.md`.
- **The folder has no `_index.md`.** Its pages are still published at their addresses, but nothing lists them, and `/projects/` itself is "page not found".

**Turning a menu page into a parent.** A menu page such as `content/projects.md` is a single file, and a single file can't have children. To give it some:

1. **Move it into a folder.** Make the folder `content/projects/`, move `projects.md` into it, and rename it `_index.md`.
2. **Make it a parent.** In that file, delete the `hidden = true` line, and add `sort_by = "weight"` below the title.
3. **Apply it.** From the folder where the script is saved, run it again with `START_PREVIEW=false bash zola-blog-setup.sh`. It prints `updated.`, then a note that it skipped the preview. `MENU_PAGES` keeps the name `projects`, and the run points the menu at the folder. Until it does, the preview and `./build` fail with ``Page `projects.md` not found``.
4. **Add the children**, as in step 2 above.

**Order.** `sort_by` goes in the parent's `_index.md` only; in a child it does nothing. Without it, children need no weight, but Zola doesn't promise any order for the list, and before Zola 0.23.4 the order can change from one build to the next. Any folders come first, and Previous and Next follow the list as it comes out. The parent takes no `date`: a section's front matter doesn't have one, and a `date` line in an `_index.md` stops the build with `` unknown field `date` ``.

**Links to children.** Don't type a list of the children into the parent's text. The parent's own list is already there, and a typed one only repeats it. To link to one child from the parent's text or anywhere else, use its path from `content/`: `[tool A](@/projects/tool-a.md)`. A link written as `(tool-a.md)` or `(./tool-a.md)` leads to "page not found"; see "Links".

In every other way a child is like a post: tags and search work the same, and a child with a `date` gets the date line, the Contents box if it has two or more headings, and a place in your feed, so feed readers and email subscribers get it. Leave the date off a child page you don't want sent out.

Two variations:

- **Children of a child.** Make the child a folder with an `_index.md` too, such as `content/projects/suite/_index.md`, and put its own children in that folder. The parent's list numbers it among the parent's own child pages by the `weight` in its `_index.md`, as the home page does, and Previous and Next go through its children before going on. Its children show both folders above their titles, after Home: Home › Projects › Suite.
- **A folder of posts.** To show a folder's pages in the home page's list as well, as posts, add `transparent = true` to the folder's `_index.md`. They're then numbered among the posts by their weights, their Previous and Next links follow the home page's order, and the folder's own page still lists them. The folder itself isn't in the home page's list then, since its pages are. Nor is a folder inside it; that inner folder's pages get Previous and Next links within its own list only. Like posts, its pages show nothing above their titles, not even Home.

### Pages that aren't posts

For a page that should exist and be linkable, but not appear in the home page list, the feed, search or `sitemap.xml` (a colophon, say, or a page for a talk), add `hidden = true` to its front matter:

```markdown
+++
title = "Colophon"
hidden = true
+++
```

Saved as `content/colophon.md`, it's published at `/colophon/`. It needs no weight or date. It gets no Previous, Next or All posts links at the bottom. Without a date, its title is set like a section's, with a line under it, and it gets a Contents box only if it asks with `toc = true` under `[extra]`, as a menu page does. Link to it from anywhere with `[colophon](@/colophon.md)`. The About page is a hidden page too.

Hidden doesn't mean private. Anyone who has the page's address can read it, and the file is in your public repository. Only `draft = true` keeps a page off the site, and even then the file is in your repository.

Don't leave a page with neither `weight` nor `hidden = true` at the top of `content/`. Zola leaves it out of the site, with only a warning, but still lists its address in `sitemap.xml`, so search engines would be sent to a missing page:

```
WARN  1 page(s) ignored (missing date or weight in a sorted section):
WARN  - /home/you/Desktop/myblog/content/colophon.md
```

So `./build`, and the build on GitHub, stop with an error when that happens. Give the page a weight, or add `hidden = true`.

### Bringing in notes from elsewhere

Notes written in another app can become posts, but each needs a few changes first, because Zola reads a file only in its own format. Work on copies, and keep the originals.

1. **Put a front matter block at the very top, with the title in it.** Zola won't build a file without one: it stops with `Couldn't find front matter`. It also doesn't take the title from a `# heading`. A note that has its title only as a heading still builds, but it shows up on the home page as an empty numbered line, with no title in the browser tab or the feed. So move the heading's text into `title` and delete the heading line:

   ```markdown
   +++
   title = "The note's title"
   weight = 40
   date = 2026-09-26
   +++
   ```

   Give it the next free weight (see "Ordering posts"); a note without one is left out, and `./build` stops.

2. **A block between two `---` lines works too.** Many note apps write their settings that way (it's called YAML), and Zola reads it, with `title: The note's title` in place of `title = "The note's title"`. Check its keys:
   - `title`, `weight` and `date` are needed, as above: `title: ...`, `weight: 40`, `date: 2026-09-26`.
   - `tags:` on a line of its own is ignored. Put the tags under `taxonomies:` instead:

     ```yaml
     taxonomies:
       tags: [tea, travel]
     ```

   - Delete `aliases:`. In a note app an alias is another name for the note, but Zola treats each alias as an address and publishes a page there that sends readers on: `aliases: [x]` makes a page at `/x/`.
   - Other keys, such as `created:`, are ignored, so they can stay.

3. **Change the note app's own links, embeds and pictures.** Zola shows the `[[...]]` forms as plain text, and the others break on the site:

   | In the note | Write instead |
   |---|---|
   | `[[Other note]]` | `[Other note](@/other-note.md)`, naming the other post's file |
   | `[Other note](other-note.md)` or `(./other-note.md)` | `[Other note](@/other-note.md)`: without `@/` the link leads to "page not found" |
   | `![[photo.jpg]]` | `![What the photo shows](@/attachments/photo.jpg)`, with the file added by `./attach` |
   | `![photo](https://...)`, a picture from another site | The same, after downloading the picture and adding it with `./attach`: the security policy blocks pictures from other sites |
   | `> [!note]` and the lines under it | An `<aside>`, as in "Notes, fold-away sections, and wide items" |

4. **Save it in `content/`** with a lowercase, dashed file name, which becomes its address, add its pictures with `./attach`, and run `./build`. If the build stops with `Error when parsing front matter`, see Troubleshooting.

## Search

The Search button at the start of the menu opens a search box over the page you're on. Type one or more words, and the pages that contain all of them are listed under the box, with pages whose titles match first. Under each title is a short piece of the page's text around the first match, with your words in bold. Click a result to go to that page. Esc, or a click on the darkened page around the box, closes it and leaves you where you were.

How words are matched:

- Each word you type must match the start of a word on the page. `micro` finds "microwave" and "Microscopes", but `wave` doesn't find "microwave", and `ear` doesn't find "search".
- Capital letters don't matter, but accents do: `CAFÉ` finds "café", and `cafe` doesn't.
- Symbols work: `c++` finds "C++".
- In writing that uses vowel signs, such as Hindi or Tamil, a match can also start just after a vowel sign in the middle of a word.

How it works:

- When the site is built, Zola writes a search index, `search_index.en.json` (the `en` is your `SITE_LANGUAGE`), holding the title and full text of every post and section.
- `static/search.js`, which the script writes, is loaded by every page. The first time someone types in the box, it fetches the index from your site and searches it in the reader's browser. There's no search service and no code from anywhere else.
- The box is a standard browser dialog: the page behind it is dimmed, the keyboard stays inside the box while it's open, and when it closes the keyboard goes back to the Search button. Enter opens the first result, and a screen reader hears how many results there are, or "nothing matches".
- Results are shown as plain text, so code in a post, such as `<img src=x>`, appears in the results as those characters and is never run.
- The Search button starts out hidden, and the script shows it. So a reader with JavaScript turned off sees no Search button, rather than a button that does nothing.
- If the index fails to load, the box says `search is unavailable: the index did not load`, and the next letter typed tries again.

Posts and any sections are in the index. Hidden pages, the About page and other menu pages among them, aren't, and `in_search_index = true` doesn't bring one back. Nor are tag pages, or drafts (except in the preview). The home page is in the index too, but it's left out of the results.

The index holds the full text of every post, and a reader's browser downloads all of it the first time they search, so it grows with the blog. If it ever gets too big, search the script for `index_format = "fuse_json"`, add `truncate_content_length = 500` on a new line below it, and run the script again. That keeps only the first 500 characters of each page, so words further in can't be found.

Search is the only script on the blog's pages. While it's on, every page's security policy allows scripts from your own site (`script-src 'self'`), because the box can open on any page. On a `yourname.github.io/notes` address, "your own site" means everything at `yourname.github.io`, which includes any other GitHub Pages sites you have; with a custom domain it means just this blog. With `ENABLE_SEARCH=false`, the next run deletes `static/search.js`, the site is built without the index or the button, and every page's policy goes back to `script-src 'none'`, which blocks all scripts.

## Email subscription

A static site can't send email, but a newsletter service can do it for you. Readers sign up on the service's own sign-up page, and the service emails them each new post it finds in your feed. Nothing on your site collects addresses.

To set it up:

1. Make an account with a newsletter service that can email new posts from an RSS feed, often called RSS-to-email, such as Buttondown (see below), and create a list.
2. Link to the service's sign-up page for your list from the footer: add a link such as `Newsletter=https://...` to `FOOTER_LINKS`, with the page's address in place of `https://...`, and run the script again. See "Footer text and links".
3. Give the service the address of your feed, as in "How a new post reaches subscribers".

If you'd rather not use a service, your feed at `/atom.xml` already lets readers follow the blog, and it costs them nothing.

### How a new post reaches subscribers

Nothing on your site sends email, and neither does pushing to GitHub. The service sends it, through its RSS-to-email feature. You give the service the address of your feed, `https://yourname.github.io/notes/atom.xml` (or the same on your own domain), and it checks the feed regularly and emails your subscribers when a new post appears in it.

That also keeps you from emailing people by accident. Each post appears in the feed once, identified by its address. Fixing a typo, pushing again or rebuilding the site doesn't add anything new, so nobody gets an email. Two things to know: a post needs a `date` to be in the feed at all, so a post without one never reaches subscribers; and renaming a post's file changes its address, which makes it look like a new post.

All of this needs `GENERATE_FEEDS` on. If you don't want an RSS link on the site, set `SHOW_RSS_LINK=false`: the link goes, the feed stays, and email keeps working.

Buttondown is one service that does this. According to its documentation, as of September 2026:

- It checks your feed every thirty minutes, so emails aren't instant.
- It can email each new post as it appears, or collect posts into a weekly or monthly email, or make each new post a draft that goes out only when you press send. Use drafts if you want to choose which posts are emailed.
- When you first connect a feed that already has posts in it, turn on its "skip old items" setting. It then skips items dated more than a day before it found them, so subscribers don't get your whole back catalogue at once. It goes on doing that for every new post, and a post's date counts from midnight UTC, so give each post the day you publish it as its date: a post still carrying the day `./new` started it can be skipped.
- RSS-to-email is listed as a feature of its Basic plan, so check that your plan includes it.

Buttondown's sign-up page is `https://buttondown.com/yourusername`, with your Buttondown username in place of `yourusername`, so the footer link is `Newsletter=https://buttondown.com/yourusername`. After setting it up, subscribe with an address of your own, to see what your readers will see.

## Custom domain

Optional, and the only part that costs money: a domain name costs roughly 10 to 20 US dollars a year from a registrar, a company that sells domain names. HTTPS on it is still free; GitHub arranges the certificate for you.

1. In the repository, go to Settings, then Pages, then Custom domain. Enter your domain (for example `blog.example.com`) and click Save. Do this before the next step: GitHub advises adding the domain here first, so nobody else can claim it.
2. At your registrar, add the DNS records, the settings that tell browsers which server your domain lives on:
   - For a subdomain such as `blog.example.com` or `www.example.com`: a CNAME record pointing it at `yourname.github.io`.
   - For a bare domain such as `example.com`: four A records, pointing it at `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`. If you want IPv6 too, add four AAAA records, pointing at `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153` and `2606:50c0:8003::153`. These are GitHub's published addresses.
   - Don't use a wildcard record such as `*.example.com`; GitHub warns that it lets others take over your subdomains.
3. In the configuration block, change the existing `CUSTOM_DOMAIN` line to `readonly CUSTOM_DOMAIN="https://blog.example.com"`, then save the script, run it again, commit, and push.
4. When GitHub has the certificate ready, tick "Enforce HTTPS" in Settings, then Pages. DNS changes and the certificate can each take up to 24 hours, though usually it's much quicker.

Step 3 is needed. Links, the stylesheet's fonts, the favicon and the feed all use the site's address, so without it your site loads at the new domain but still points readers back at `github.io` for all of those.

Set it in the script, not in `config.toml`, which is rewritten on every run. `CUSTOM_DOMAIN` changes the site's address and nothing else; the "View history" and "Suggest an edit" links still point at the repository, where the files are.

You don't need a `CNAME` file in the repository. GitHub's documentation says that when a site is published by an Actions workflow, as this one is, a `CNAME` file isn't created, and one that exists is ignored. The domain is kept in the repository's Pages settings.

GitHub also recommends verifying your domain in your account's Pages settings, which stops anyone else's repository from using it.

## Reference

The rest of this guide is for looking things up.

### Running the script again

Running the script again is how every change to a setting is applied; there's nothing else to learn. It finds the existing blog, rewrites the script-owned files from the current settings, and leaves `content/`, the rest of `static/` and a `README.md` you've edited alone. It doesn't make a new folder, and it only uses the network when it has to: to install Zola, if yours is outside the supported range, or to record a new Zola version in the workflow, including the first time you set `GIT_REPO_URL`.

Your own files, in `content/` and `static/`, are written once, on the first run, and never touched again. Delete the example posts, replace `avatar.svg`, add fonts: nothing a re-run does will undo it.

#### Turning something off removes its file

Clearing a setting that produced a file removes the file, rather than leaving it behind:

- `FAVICON_TEXT=""` removes the favicon the script drew.
- `ENABLE_SEARCH=false` removes `static/search.js`.
- An empty `GIT_REPO_URL` removes `.github/workflows/deploy.yml`, and the run tells you to commit the deletion. Do commit it. Otherwise the workflow stays in the repository and goes on publishing on every push, and since the site's address has gone back to a placeholder (`https://yourusername.github.io`), what it publishes has links to an address that isn't yours.

In each case the file is removed only if it's exactly as the script last wrote it. A file you edited, or one the script has no record of writing, is left where it is. For the workflow, the run also warns you when it leaves it, because a leftover workflow goes on publishing.

#### The hand-edit check

If a script-owned file has been changed since the script last wrote it, a run stops before changing anything and names the file:

```
these files have been changed since this script last wrote them, and a re-run
would overwrite them:
  - templates/base.html

they are script-owned: change the matching render_* function or a configuration
variable rather than the file. to overwrite them anyway, run once with
    REGENERATE_TEMPLATES=true bash zola-blog-setup.sh
nothing has been changed.
```

This is so a change you made directly to a generated file isn't lost without you noticing. You have two ways forward:

- Keep the change: make it again in the script, in the `render_` function that writes that file (here `render_base_html`), and then run once with `REGENERATE_TEMPLATES=true bash zola-blog-setup.sh`. To see what you changed, run `git diff templates/base.html` from inside the blog folder; it shows the change if you committed after the last run.
- Throw the change away: run once with `REGENERATE_TEMPLATES=true bash zola-blog-setup.sh`.

The script compares each file with what the last run left, as recorded in `.zola-blog-setup.manifest`, not with what this run would write. So changing a setting never trips the check, even though it changes `config.toml`; only an edit made outside the script does. A blog without its `.zola-blog-setup.manifest`, because it was deleted, trips it for every script-owned file, and the message says so; one run with `REGENERATE_TEMPLATES=true` fixes that for good. If your computer has neither `sha256sum` nor `shasum`, the check can't work, so it says so and lets the run carry on.

`README.md` is the exception. It's the page GitHub shows for your repository, and nothing on the site is built from it, so editing it doesn't stop a run, whether you edit it on your computer or on GitHub and then pull the change. The first run after the edit leaves the file as it is and says:

```
README.md was edited, so it's yours now: runs leave it alone (delete it to get the script's back)
```

From then on runs don't touch it, so it no longer changes when `GIT_REPO_URL` or `CUSTOM_DOMAIN` does. To have the script write it again, delete it and run the script, or run once with `REGENERATE_TEMPLATES=true`.

#### Upgrading to a new version of the script

Your settings live in the script, so a new copy of the script starts with the default settings. Before running it, copy your settings across: every line you changed in the old script's configuration block, and any changes you made inside `render_` functions, such as colours in `YOUR DESIGN`. To find them, keep the old copy under another name, such as `zola-blog-setup-old.sh`, and run `diff zola-blog-setup-old.sh zola-blog-setup.sh`. It lists every line that differs, the new version's own changes included, so look for the lines you recognise. If you skip this, the run applies the defaults: the title goes back to "Myblog", and with an empty `GIT_REPO_URL` it removes your workflow.

Then run the new script against the blog's folder, with the same `PROJECT_DIR` and `BLOG_NAME`. It rewrites the script-owned files, and stops first if you edited one of them by hand; see "The hand-edit check".

This guide covers upgrading a blog made with v100 or v101, which make the same pages. A blog made with v28 to v35, or with v96 to v99, upgrades the same way, since nothing those versions rely on has been removed, but what the versions since then changed is listed in the guides that came with them. The numbers jump from v35 to v96 because they now also count the versions from before the script's numbering was restarted: v96 is the version that came after v35. For a blog made with an older version, run v28's script against it first, and follow the notes in v28's guide for the version the blog was made with.

What changes:

- **An edited `README.md` no longer stops a run.** Before, editing it stopped every run at the hand-edit check, like an edit to any script-owned file. Now the run keeps your README, says once that it's yours, and carries on; see "The hand-edit check". If the old version stopped on `README.md` for you, just run this one.
- An unedited `README.md` gets one new sentence, saying it becomes yours once you edit it, so the first run changes it. Commit it with the rest.

#### Looking at one generated file

You can see what the script would write for one file without touching the blog, because loading the script with `source` doesn't run it. From the folder holding the script:

```bash
bash -c 'source zola-blog-setup.sh; render_base_html' | less
```

Press q to leave `less`. `render_page_html`, `render_components`, `render_site_config`, `render_readme` and the other `render_` functions work the same way. Some of them use values the script normally works out first, and print empty ones when run this way; `render_site_config` is one. The `# Vars:` note above each function says what it uses. `render_base_html` uses nothing, so it's always safe.

If you write a file out this way into the blog, the manifest no longer matches it, so the next run treats it as edited by hand, as it should; see "The hand-edit check".

### Moving to a newer Zola

From the folder holding the script:

```bash
bash zola-blog-setup.sh update-zola
```

This installs the newest Zola release, as long as it's a 0.23 release, prints its checksum, and reminds you that blogs keep the version their workflow names. It ends like this:

```
zola is now at 0.23.6.
existing blogs keep the version their workflow pins. re-run zola-blog-setup
against a blog to re-pin it to this version, then commit and push.
```

So after updating, run the setup script again for each blog, then commit and push, to move that blog's workflow to the new version. If your Zola is already the newest release, it says `zola 0.23.6 is already the latest (0.23.6).` and does nothing.

### What the checksum proves

Zola doesn't publish checksums alongside its downloads, so there's nothing independent to compare a download with when the script installs Zola. The script therefore prints the checksum of what it downloaded, rather than checking it against anything. You can compare it with someone else's copy, or one from another computer. What it rests on is the secure (HTTPS) connection to GitHub, the same thing that got you the script.

The workflow's checksum is a real check. When you first set up publishing, the script downloads the Linux copy of Zola once, works out its checksum, and writes that number into `deploy.yml`. Every build on GitHub then checks its download against it before using it. A release's version number names a file, not its contents; if the file behind that name were ever swapped, the build would fail instead of publishing. There is no way for the workflow to skip the check.

### Publishing and permissions

The workflow runs on every push to `main` (or `master`), and when you start it by hand from the Actions tab. It has two parts, called jobs:

- **build** gets the files and Zola, checks Zola's checksum, and builds the site. It can read the repository but not change it, and it doesn't keep git's access key once it has the files, because it runs code from your repository.
- **deploy** publishes the built site. It's the only part with permission to publish (`pages: write` and `id-token: write`, which GitHub's own publishing action needs). It never changes the repository.

Everything the workflow depends on is fixed: the three GitHub actions it uses (by their commit code, a string of 40 letters and digits), the kind of machine it runs on (`ubuntu-24.04`, rather than whichever Ubuntu GitHub currently calls the latest), Zola's version, and Zola's checksum. That makes it much less likely that a change somewhere else breaks a build that worked before. The actions are `actions/checkout` v7.0.1, `actions/upload-pages-artifact` v5.0.0 and `actions/deploy-pages` v5.0.1, which run on Node 24. GitHub set 23 September 2026 as the date its build machines drop the older Node 20.

To add a licence to the repository, do it after the first push, so that it arrives as an ordinary commit. Then, before you next push, bring that commit to your computer: from inside the blog folder, run `git pull --rebase`. It prints `Fast-forward` and the licence's file name, or, if you've committed since, `Successfully rebased and updated refs/heads/main.` Plain `git pull` refuses in that second case, with `You have divergent branches`.

### The security policy

Every published page tells the reader's browser what it may load, with a security policy (a Content-Security-Policy, in a `<meta>` tag in `templates/base.html`):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'
```

It's one line in the page; here it's split over two. In plain words:

- `default-src 'self'`: anything the other rules don't cover, such as fonts, videos, frames and the search index, comes only from your own site.
- `script-src 'self'`: scripts only from your own site, and only while search is on. With search off it's `script-src 'none'`: no scripts at all.
- `style-src 'self' 'unsafe-inline'`: styles may be written into the page itself. The code highlighter writes a `style` attribute onto every coloured part of every code example, and the policy has to allow that. So moving the stylesheet into a separate file wouldn't make the policy any stricter.
- `img-src 'self' data:`: pictures only from your own site, or written into the page itself. A picture from another site is blocked before the browser asks for it, so no other company ever sees your readers' addresses.
- `form-action 'none'`: no form on the site can send what readers type anywhere. It has to be spelled out, because unlike most rules it has no default.
- `object-src 'none'` and `base-uri 'self'` block two old ways of running outside code.

There's no `frame-ancestors`, the rule that would stop other sites showing yours inside a frame. Browsers ignore it in a `<meta>` tag, and GitHub Pages doesn't let you set the server headers where it would work, so on this host there's no way to add that protection.

Embedding a YouTube video, a picture from another site, or a comments service means loosening this policy, and loosening it lets whoever you embedded see your readers. Decide that deliberately.

The preview gets the same policy, with one difference: it also allows scripts written into the page, because Zola's preview adds two scripts of its own, which reload the page when you save. So a picture or video from another site fails in the preview, just as it will on the published site, instead of only after you publish. The template tells the two apart by the address: the preview's starts with `http://`, and a published site's always starts with `https://`, because the script only accepts `https://` addresses for `GIT_REPO_URL` and `CUSTOM_DOMAIN`. Open the preview at the address `zola serve` prints; at any other address, the policy counts the preview's own fonts and pictures as coming from somewhere else and blocks them.

To see the policy at work, open your browser's developer tools (F12), then the Console tab. The policy reports there anything it blocks, and a site you haven't changed should show nothing from it. Until you add Charter (see "Fonts"), the console also lists the font files as not found (404), which is expected. Serving `public/` from your own computer doesn't work as a test: every link in it points at your real address, so the policy blocks the fonts, the favicon and the search script, and the page looks broken.

### What's private, and what isn't

- **Your repository is public**, on a free account. Everything you've committed, every earlier version of it, drafts included, can be read by anyone.
- **Commits show a name and an email.** Use GitHub's private address (see "Your first blog", step 1).
- **Photos carry hidden location and camera data** until you remove it, and the original file is published. See "Your photo".
- **Hidden pages are public.** `hidden = true` keeps a page off the lists, the feed, search and the sitemap, but anyone with its address can read it, and its file is in your repository. Only a draft stays off the site.
- **HTML comments aren't hidden.** A note written in a post as `<!-- ... -->` doesn't show on the page, but it's in your repository, and in the feed, `atom.xml`, which carries the full text of every post with a date.
- **Nothing on the site loads from other companies**, and the security policy enforces that.
- **GitHub sees your readers.** GitHub Pages logs visitors' IP addresses, whatever the site does. The policy above keeps other companies out; it can't do anything about the host itself.
- **No referrer.** Pages tell the browser not to pass on which page a reader came from when they follow a link to another site.

### Troubleshooting

#### Running the script

**`unknown command: ...`** Everything is set in the configuration block at the top of the script. The only words the script accepts after its name are `help` and `update-zola`.

**`run this script with bash: bash zola-blog-setup.sh`.** You ran it with `sh` (or with `zsh`), which can't run it. Type `bash` in front, as in `bash zola-blog-setup.sh`.

**`bash: zola-blog-setup.sh: No such file or directory`.** You're not in the folder where you saved the script. Run `cd ~/Downloads` (or wherever it is) first, or give its full path: `bash ~/Downloads/zola-blog-setup.sh`.

**`line 82: GIT_REPO_URL: readonly variable`, or the same about another setting.** The configuration block has two lines for that setting, because a line was added instead of the existing one being changed. Delete one of them.

**`line 89: $5: unbound variable`, or another line number and name.** A setting contains a `$` without a backslash in front of it. Write `\$`, and likewise `\"` and `` \` ``.

**`line 117: FOOTER_TEXT isn't quoted as the script needs`, or the same about another setting.** A `"` or `` ` `` inside the value has no backslash before it, or the value's closing `"` is missing. Put a backslash before each `"` or `` ` `` that should be shown, as in `readonly FOOTER_TEXT="Motto: \"ora et labora\""`; a doubled `""` doesn't work. Nothing was changed.

**`SHOW_TOC must be true or false (unquoted), got: 'yes'`, or a similar message about another setting.** `true` and `false` go without quotes. Messages about `MASTHEAD`, `BLOG_NAME`, `GIT_REPO_URL`, `CUSTOM_DOMAIN`, `MENU_PAGES`, `FOOTER_LINKS` or `DATE_FORMAT` say what's allowed.

**`MENU_PAGES names now, but there's no content/now.md`.** Make the page first, as in "Adding a page to the menu", step 1, or take the name out of `MENU_PAGES`. Check the spelling: the name must match the file's, without `.md`. Nothing was changed.

**`MENU_PAGES names now, but content/now.md doesn't say hidden = true`.** Add `hidden = true` on the line after the page's `title`. Without it the page counts as a post; see "Adding a page to the menu". Nothing was changed.

**`MENU_PAGES names now, but there's both content/now.md and content/now/_index.md`.** Keep one: the file for a single page, or the folder for a page with pages under it. Nothing was changed.

**`still the examples the script came with, and GIT_REPO_URL will publish them: ...`.** A reminder, not an error: the run finished. The settings it names, or the About page, still have the values the script came with. Change them before you push; see "Before you publish".

**`missing required tools:`** followed by a list. Install what it names. On Debian, Devuan or Ubuntu, `sudo apt install curl tar` covers both of the usual ones.

**`not a git repo; remote not updated`, or `git init failed - run manually later`.** The blog folder has no git repository of its own, usually because git wasn't installed when the blog was made. Make one: from inside the blog folder, run `git init -b main`, which prints `Initialized empty Git repository in` and the folder's path. Then, once git knows your name and email (see "Your first blog", step 1), run `git add -A` and `git commit -m "First commit"`, and run the script again. With `GIT_REPO_URL` set, it prints `added remote 'origin':` and the repository's address.

**`'...' exists but holds no config.toml; move it aside or point BLOG_NAME somewhere else.`** A folder with that name is already there, and it isn't a blog made by this script, so the script won't write into it. Rename that folder, or choose another `BLOG_NAME`.

**The blog appeared somewhere unexpected, or a second blog appeared.** `PROJECT_DIR` is your Desktop unless you change it, whatever folder you run the script from. And changing `PROJECT_DIR` or `BLOG_NAME` after the blog exists makes a new blog in the new place; the old one stays where it was.

**The run stops and lists files it would overwrite.** That's the hand-edit check; see "The hand-edit check". Either `.zola-blog-setup.manifest` is missing (one run with `REGENERATE_TEMPLATES=true` fixes it), or a script-owned file was edited directly.

**`zola 0.24.0 is the latest release, but this script supports >= 0.23 and < 0.24.`** A newer Zola is out than the script's templates were written for. Nothing was changed. Use a newer version of the script if there is one, or name a 0.23 release for this run: find the newest release whose name starts with `v0.23.` on github.com/getzola/zola/releases, and run `ZOLA_VERSION_OVERRIDE=<that name> bash zola-blog-setup.sh`.

**`could not resolve the latest zola release from GitHub (network?)`** The script couldn't reach GitHub to find the newest Zola. Check your internet connection and run it again.

**`could not download zola ...`.** The download of Zola itself failed. Check your internet connection, and, if you named a release with `ZOLA_VERSION_OVERRIDE`, that the name is exactly as it appears on github.com/getzola/zola/releases, such as `v0.23.6`. Nothing was changed.

**`could not hash the linux zola ... build, which the workflow pins`.** The script couldn't download the Linux copy of Zola to work out its checksum. On a first run, it's usually the network, or a release name that doesn't exist. A re-run with the same Zola version doesn't need the download at all, so seeing this on a re-run means the version changed.

**Zola not found after installing: `zola: command not found`.** The script puts Zola in `~/.local/bin`, and your terminal doesn't look there yet. On Debian, Devuan and Ubuntu, logging out and back in usually fixes it, because the standard `~/.profile` adds `~/.local/bin` once that folder exists. Otherwise, add this line to `~/.profile`, then log out and back in: `~/.profile` is read when you log in, not by each new terminal. On a Mac, add it to `~/.zprofile` instead, and open a new terminal:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

**Two Zolas.** If Zola was already installed some other way, for example with Homebrew or Snap, the one in `~/.local/bin` is a second copy, and the order of folders in your `PATH` decides which runs. That's how a site ends up building on your computer but failing on GitHub, or the other way round. `command -v zola` shows which one runs. Keep one: remove the other, or remove `~/.local/bin/zola` and keep yours inside the supported range.

#### Previewing and building

**`./build` fails with "the page(s) named above produced no HTML".** A page at the top of `content/`, or a child page whose parent sorts by weight, has no `weight`, so Zola left it out while still listing its address in the sitemap. Give it a weight, or add `hidden = true` if it shouldn't be listed, as a page in the menu shouldn't; see "Pages that aren't posts".

**``Page `now.md` not found`` or ``Section `projects/_index.md` not found``, pointing at `base.html`.** A page in the menu was moved, renamed or deleted after the script last ran, and the menu still points at its old place. Run the script again, which finds where the page is now. If the page is gone, take its name out of `MENU_PAGES` first.

**`` Broken relative link `@/...` ``, or `Found 1 broken internal anchor link(s)`.** An `@/` link names a file or heading that doesn't exist. Fix the link; the check is there to stop broken links reaching your site. Deleting `second-post.md` but keeping `hello-world.md`, which links to it, causes this too. For a picture, `@/attachments/...`, check that the file is in `content/attachments/` with exactly that name (capital letters count), and that `content/attachments/_index.md` is there and doesn't say `render = false`.

**``Variable `...` is not defined``, or ``Closing comment tag `#}` not found``, in a post.** The post contains `{{`, `{%` or `{#`, which Zola reads as template code. Wrap that part in `{% raw %}` and `{% endraw %}`; see "Code examples".

**`` `resize_image`: Cannot find file: me.jpg ``.** The photo's path counts from the `content` folder, not from the page's own folder. Write `attachments/me.jpg`, not `me.jpg`.

**`` `get_url`: could not resolve URL for link `@/attachments/...` not found ``.** A video line names a file that isn't in `content/attachments/`, or spells it differently. The path in `src` starts from the `content` folder, without `@/`: `src="attachments/tea-bus.mp4"`.

**A link to one of your own pages leads to "page not found".** It's written as a path to a `.md` file, such as `[child A](./child-a.md)`. Zola doesn't turn that into the page's address, so the link points at a file that isn't on the site. Write it with `@/` and the path from the `content` folder: `[child A](@/test/child-a.md)`. See "Links".

**`` unknown field `date` ``, about an `_index.md`.** A section's front matter, in an `_index.md`, doesn't take a `date`. Delete that line. Its children are the pages that have dates; see "Child pages".

**A parent page doesn't list its children.** Its `_index.md` says `hidden = true`, which the children take on: delete that line. Or the file is `index.md`, without the underscore, which makes it an ordinary page: rename it `_index.md`. If the parent's own address is "page not found" while its children's pages work, the folder has no `_index.md` at all. See "Child pages".

**In the preview, the fonts, pictures or favicon are missing, and the browser's console says `Refused to load`.** The preview is open at an address other than the one `zola serve` printed, such as your computer's network address when it printed `127.0.0.1`. The security policy then counts the preview's own files as coming from elsewhere. Open the address it printed. To preview on another device, start the preview from inside the blog folder with `zola serve --drafts -i 0.0.0.0 -u` and your computer's network address, such as `zola serve --drafts -i 0.0.0.0 -u 192.168.1.5`, and open the address it prints, `http://192.168.1.5:1111`, on every device, this computer included. While it runs, anyone on the same network can open it too, drafts included, so leave out `--drafts` unless you trust the network, and stop it with Ctrl+C when you're done.

**`Couldn't find front matter`, naming a file.** A file in `content/` has no front matter block at its top. Give it one; see "Bringing in notes from elsewhere".

**``Theme `...` does not exist``.** `LIGHT_CODE_THEME` or `DARK_CODE_THEME` isn't a name from Zola's list; see "Settings, one by one".

**`` unknown field `...` `` about `config.toml`.** A line was added in the wrong place in `render_site_config`, or directly to `config.toml`. Zola rejects settings it doesn't know.

**`TOML parse error at line ...`.** A line you added in `render_site_config` in the script, such as `skip_content_templating`, has a slip: a missing quote or comma, curly quotes, or a line in the wrong place. The line number is in `config.toml`, which the script writes; fix the same line in the script and run it again.

**`Error when parsing front matter of page`, naming a post or page.** The block between its `+++` lines has a slip, and Zola doesn't say which. The usual ones are quotes around a number (`weight = "30"` instead of `weight = 30`), a missing or curly quote, a line written below `[taxonomies]` that isn't `tags`, and a second `[extra]` line.

**A post's tags don't show, and there's no error.** Its `tags` line isn't under `[taxonomies]`. Zola ignores a `tags` line anywhere else, without a message. In a block between `---` lines, `tags:` goes indented under `taxonomies:`; see "Bringing in notes from elsewhere".

**`./serve: Permission denied`.** The file lost its permission to run, usually by being copied or archived. From inside the blog folder, run `chmod +x serve build new attach`.

**Markdown inside `<aside>` or `<details>` shows up as asterisks and brackets.** It needs a blank line after the opening tag and another before the closing one; see "Notes, fold-away sections, and wide items".

**Numbered sub-items come out joined onto one line, or as the next number instead of a sub-item.** Number each level the ordinary way, `1.`, `2.`, not `1.1`, and indent each level four spaces or one tab; see "Numbered outlines".

**A paragraph turned into a heading.** A line of `---` directly under a line of text makes that text a heading. Leave a blank line above the `---`.

#### Appearance

**Some links in a post are blue, and others aren't.** The blue ones have been followed: the browser has their addresses in its history. A link that hasn't been followed takes the colour of the text around it, underlined; see `--link` in "Colours, sizes and typefaces". Chrome counts a link to another site as followed only if it was followed from your own site, so an address visited some other way stays the colour of the text.

**The favicon shows the wrong letter.** With `"auto"`, it's the first letter or digit of `SITE_TITLE`, not of `BLOG_NAME`, shown as a capital.

**The top left shows an empty space.** `MASTHEAD="image"`, and `static/logo.svg` is missing.

**The logo is a solid block.** The logo is used as a stencil, so a background in `logo.svg` fills the whole box. Use a flat shape on a transparent background.

**Dark mode looks wrong on your computer but right on others.** Your desktop may not be telling the browser whether you prefer dark; see "Dark by default". Test with the browser's developer tools.

**The About page's placeholder picture is a pale square on a dark page, or a dark one on a light page.** `static/avatar.svg` was drawn for a different `LIGHT_THEME` setting. It's yours, not script-owned, so re-running won't redraw it; replace it with your photo (see "Your photo"), or edit its colours.

**A `---` meant as a dividing line sits right under a heading.** A `---` straight after a heading underlines that heading. To divide the page there, put the `---` above the heading instead.

**Code examples ignore the colours in `YOUR DESIGN`.** They always will: the highlighter writes each example's colours into the example itself, and those win over the stylesheet. Change `LIGHT_CODE_THEME` and `DARK_CODE_THEME` instead.

**A picture in a post shows in the preview but not on the published site.** Its path starts with `/`, which on a `yourname.github.io/notes` address points outside your blog. Put the picture in `content/attachments/` and refer to it with `@/attachments/`; see "Pictures, GIFs and video".

**A picture from another site doesn't show, in the preview or on the published site.** The security policy only lets pictures come from your own site; see "The security policy". The preview blocks them too, so you find out before publishing. Download the picture, add it with `./attach`, and link to it with `@/attachments/`.

**A photo shows on its side.** The tag that says which way up it goes was removed along with its other hidden data. Rotate the picture itself in an image editor and save it, or clean the original again with the command in "Your photo", which keeps that tag.

#### Getting it online

**`Permission denied (publickey)`** from `ssh -T` or `git push`. GitHub doesn't have your public key, or ssh is offering a different key. Check that `~/.ssh/id_ed25519.pub` exists and that the same line is in your GitHub SSH keys. `ssh -vT git@github.com` shows which key ssh tried.

**`git push` asks for a username and password.** The link to GitHub uses an `https://` address instead of SSH. GitHub doesn't accept account passwords for git; switch it to SSH, with your username and repository name in place of these:

```bash
git remote set-url origin git@github.com:yourname/notes.git
```

**`error: src refspec main does not match any`.** There are no commits yet, usually because git didn't know your name and email during the first run. Set them (see "Your first blog", step 1), then run `git add -A` and `git commit -m "First commit"`, and push again.

**The push is rejected, with a hint beginning "Updates were rejected because the remote contains work".** On the first push, the repository wasn't empty: something such as a README or licence was added when it was created. If it has nothing else in it, the simplest fix is to delete the repository on GitHub (at the bottom of its Settings page), create it again with nothing added, and push again. On a later push, something was committed on GitHub since your last one, such as a licence: from inside the blog folder, run `git pull --rebase`, then `git push`; see "Publishing and permissions".

**The workflow fails at its deploy step, with `Ensure GitHub Pages has been enabled`.** Pages isn't switched on. In Settings, then Pages, set Source to "GitHub Actions", then run the workflow again from the Actions tab.

**The published address shows your README, or something that isn't your blog.** Settings, then Pages, then Source is set to "Deploy from a branch", so GitHub is building the repository its own way instead of using your workflow. Set it to "GitHub Actions" and run the workflow again.

**The site is up, but links go to the wrong place, or the fonts or favicon are missing.** The site's address doesn't match where it's published. The script works the address out from `GIT_REPO_URL` (and `CUSTOM_DOMAIN`), so check those, especially after renaming the repository, then re-run, commit and push.

**`CUSTOM_DOMAIN` had no effect.** Check that the run finished (the hand-edit check stops a run before anything is written), that you set it in the script and not in `config.toml`, and that you committed and pushed afterwards.

**The build on GitHub uses a different Zola from your computer.** The workflow keeps the version it named when the script last ran against this blog. If you've changed Zola since, with `update-zola` or another way, run the script again, then commit and push, to move the workflow to it. It also differs when your Zola isn't a published release, which the run says, and when another Zola comes first in your `PATH` (see "Two Zolas"). The version named in the workflow is the one that counts for the published site.

**The build on GitHub fails with `zola.tar.gz: FAILED` and `WARNING: 1 computed checksum did NOT match`.** The Zola file GitHub downloaded isn't the one whose checksum was recorded. That can mean the file behind that release was replaced, and that's exactly what the check is for, so don't just record a new checksum. Find out why first: look at Zola's release page and announcements, and, from inside the blog folder, run `git log -p .github/workflows/deploy.yml`, which lists every change made to the workflow, the checksum line included. Once you're satisfied the new file is genuine, delete `.github/workflows/deploy.yml` and run the script again: it downloads Zola, records the checksum afresh, and writes the workflow back. Then commit and push.

#### Search

**There's no Search button.** `ENABLE_SEARCH` is `false`, or JavaScript is turned off in that browser; the script is what shows the button.

**Search doesn't find a word that's on the page.** Words have to be typed from their start: `wave` doesn't find "microwave". Accents count too: `cafe` doesn't find "café".

**The search box says "search is unavailable: the index did not load".** The page was built with search on, but the index file isn't there. Build again with `./build`, or push to rebuild the published site. If it was a network hiccup, typing another letter tries again.

### Command reference

From the folder holding the script:

| Command | What it does |
|---|---|
| `bash zola-blog-setup.sh` | Creates the blog at `PROJECT_DIR/BLOG_NAME`, or updates it if it's already there, from the configuration block. |
| `bash zola-blog-setup.sh update-zola` | Installs the newest Zola release, if it's inside the supported range. |
| `bash zola-blog-setup.sh help` | Lists the commands. `-h` and `--help` work too. |

Everything else is a setting in the configuration block; see "Settings, one by one".

Settings for a single run, put in front of the command:

| Setting | What it does |
|---|---|
| `START_PREVIEW=false` | Don't start the preview at the end of this run. |
| `REGENERATE_TEMPLATES=true` | Overwrite script-owned files that were edited by hand, and a `README.md` you've edited. |
| `ZOLA_VERSION_OVERRIDE=<release>` | Use this Zola release (its name on github.com/getzola/zola/releases, such as `v0.23.6`) wherever the script would otherwise look up the newest one. |

Inside the blog folder:

| Command | What it does |
|---|---|
| `./serve` | The preview, at `http://127.0.0.1:1111`, updating as you save, with drafts marked "(draft)". Ctrl+C stops it. |
| `./build` | Builds the finished site into `public/`, without drafts, and stops with a message if something is wrong that would also stop GitHub's build. |
| `./new name-of-post` | Starts `content/name-of-post.md`, a draft at the end of the list, with its front matter filled in and a title made from the name. |
| `./attach path/to/file new-name` | Copies a picture or video into `content/attachments/` without its hidden data, and prints the line to put in a post. Not for SVG drawings; see "Pictures, GIFs and video". |
| `git status` | Shows what has changed since your last commit. |
| `git add -A` then `git commit -m "..."` | Saves a snapshot of every change. |
| `git push` | Sends your commits to GitHub, which then publishes the site. |

### Other computers and hosts

On a Mac, the script installs Zola into `~/.local/bin`. On Windows, in Git Bash, it installs it into `~/bin`, and needs `unzip` rather than `tar`. There's no Zola for Windows on ARM, so there the script stops and asks you to install Zola yourself, then run it again. The workflow always runs on GitHub's Linux machines, whatever computer you use.

To publish somewhere other than GitHub Pages, the finished site is just the `public/` folder that `./build` makes, and any host for static sites can serve it. What you'd give up is the workflow, with its fixed versions and checksum check, which you'd have to rebuild for that host.