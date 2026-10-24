# GitLab Hosting with a GitHub Mirror

> - **For:** anyone who wants their repository's home on GitLab, with a copy on GitHub that keeps itself up to date.
> - **Before you start:** a git repository, on your computer or on GitHub, and git installed (on Debian or Ubuntu, `sudo apt install git`).
> - **Reading time:** about 14 minutes.
> - **You end with:** the repository hosted on GitLab, every push copied to GitHub within minutes, the GitHub copy set up to behave as a mirror, and a plan for when either side drops you.

Throughout, `GITLAB_USER` and `GITHUB_USER` stand for your usernames on each site, and `REPO` for the repository's name. Put yours in their place wherever they appear, commands included.

## Why host on GitLab and mirror to GitHub

The repository lives on GitLab: that's where you push, review and run CI. GitLab copies every branch, tag and commit to GitHub by itself, so GitHub always has a current copy. What that buys you:

- **Two independent copies, run by two companies.** If one suspends your account, takes a repository down over a complaint, or goes offline, the other still has every branch and tag, and so does your own clone. Moving to the survivor takes minutes, because nothing has to be rebuilt.
- **GitHub's reach, without GitHub as the home.** Most developers already have a GitHub account, and many search there first. The mirror keeps the project findable, starrable and forkable on GitHub, while the work happens on GitLab.
- **A home you can take with you.** GitLab's core is open source under the MIT licence; only the paid tiers' extra code isn't. If gitlab.com stops suiting you, the same software can run on a server of your own. It's a heavy server to run, but the option is there. GitHub's self-hosted product is closed source and sold only as a paid licence.
- **Mirroring is built in and free.** Push mirroring is part of GitLab's free tier. You set it up once, and every push reaches GitHub within five minutes, with no script, server or scheduled job of yours involved.
- **CI and a website on the free tier.** GitLab CI/CD and GitLab Pages come with a free account, with 400 minutes a month of build time on GitLab's machines.
- **Less lock-in.** A project that lives on two forges can't quietly come to depend on one forge's special features, which keeps the next move cheap too.

## What it costs

None of these is hidden, but some catch people out. Weigh them before you start.

- **Contributors still arrive on GitHub.** Issues and pull requests can be opened on the mirror, and you have to bring them over by hand (section 8). Anything merged on GitHub itself is overwritten at the next mirror update.
- **Only git data is mirrored:** branches, tags and commits. Issues, merge requests, wikis, releases and settings stay on the site where they were made.
- **GitLab holds a GitHub token that can write to the mirror.** You scope it to the one repository, give it an expiry, and renew it before it runs out.
- **GitHub lags GitLab** by up to five minutes.
- **Workflows under `.github/workflows/` run on GitHub too,** on every mirrored push. Anything that publishes, such as a package, a website or a release, must run on only one of the two.
- **GitLab's free CI may ask for a phone number or a card** before it runs your jobs. GitLab decides from a risk score, so you can't know in advance.
- **GitHub refuses files over 100 MB,** so a repository that holds one can't be mirrored there unless the file is stored with Git LFS.
- **Both are US companies.** Two copies protect you from one company's decision, not from a legal order that reaches both. If that matters to you, keep a third copy in another jurisdiction, such as Codeberg in Germany, or on a server of your own.

## 1. Accounts and SSH keys

1. Make an account on gitlab.com, and on github.com if you don't have one.
2. Check for an SSH key:

   ```bash
   ls ~/.ssh/id_ed25519.pub
   ```

   It prints the file's path if you have one. `No such file or directory` means you don't, so make one:

   ```bash
   ssh-keygen -t ed25519 -C "you@example.org"
   ```

   It asks where to save the key (press Enter for the default) and for a passphrase, twice. Then it prints the key's fingerprint and a box of symbols, the key's randomart. The box is normal.

3. Add the public key to both sites: on GitLab, avatar → Edit profile → SSH Keys → Add new key; on GitHub, Settings → SSH and GPG keys → New SSH key. Paste the whole of `~/.ssh/id_ed25519.pub`; `cat ~/.ssh/id_ed25519.pub` prints it, one line starting `ssh-ed25519`.
4. Check both:

   ```bash
   ssh -T git@gitlab.com
   ssh -T git@github.com
   ```

   The first time for each, ssh asks whether to trust the host. Answer `yes` only if the ED25519 fingerprint it shows matches: GitLab's is `SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8`, and GitHub's is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. Then GitLab prints `Welcome to GitLab, @GITLAB_USER!`, and GitHub prints `Hi GITHUB_USER! You've successfully authenticated, but GitHub does not provide shell access.` That second message means success, although ssh exits with an error status after it.

## 2. The GitHub repository

If the repository is already on GitHub, it becomes the mirror, with its history as it is: there's nothing to do here.

Otherwise, create an empty one: on GitHub, New repository, name `REPO`, the same visibility you'll give it on GitLab, with no README, .gitignore or licence → Create repository. The mirror fills it.

## 3. Put the repository on GitLab

Pick the case that fits yours.

### 3.1 From your computer

If the repository isn't on any server yet, first create an empty GitLab project: Create new (+) → New project/repository → Create blank project. Name it `REPO`, choose its visibility, untick "Initialize repository with a README" → Create project. An initialised project would reject your first push.

Then, in the repository's folder:

```bash
git remote add origin git@gitlab.com:GITLAB_USER/REPO.git
git push -u origin --all
git push origin --tags
```

The first prints nothing; if it says `remote origin already exists`, use `git remote set-url origin` with the same address instead. The second prints a `* [new branch]` line per branch, and a `branch '…' set up to track 'origin/…'.` line for each. The third prints a `* [new tag]` line per tag, or `Everything up-to-date` if you have none.

### 3.2 From GitHub, code only

This copies every branch and tag, and nothing else. Create the empty GitLab project as in 3.1, then:

```bash
git clone --bare git@github.com:GITHUB_USER/REPO.git
git -C REPO.git push --all git@gitlab.com:GITLAB_USER/REPO.git
git -C REPO.git push --tags git@gitlab.com:GITLAB_USER/REPO.git
rm -rf REPO.git
```

The clone prints `Cloning into bare repository 'REPO.git'...` and some progress lines. The pushes print a `* [new branch]` line per branch, then a `* [new tag]` line per tag. `rm` prints nothing.

Use `--bare`, not `--mirror`. A mirror clone also copies GitHub's `refs/pull/` references, which then clutter GitLab, and which GitHub refuses with `deny updating a hidden ref` when the mirror pushes them back.

### 3.3 From GitHub, with issues and pull requests

GitLab's importer brings the repository along with its issues, pull requests (as merge requests), comments, labels, milestones, wiki and release notes. In GitLab: Create new (+) → New project/repository → Import project → GitHub.

Sign in with GitHub if GitLab offers it. Otherwise it asks for a GitHub token: a classic personal access token with the `repo` scope, plus `read:org` if you use Git LFS or want collaborators imported. That token can reach all your repositories, so delete it on GitHub once the import has finished.

The import also brings branches from forks that have open pull requests. Delete any you don't want copied to GitHub before you set up the mirror in section 5.

## 4. Point your clone at GitLab

In your working clone:

```bash
git remote set-url origin git@gitlab.com:GITLAB_USER/REPO.git
git remote add github git@github.com:GITHUB_USER/REPO.git
git remote set-url --push github no-push
git fetch origin
git remote -v
```

If you started from your computer (3.1), `origin` is GitLab already, so skip the first line. The first three lines print nothing. `git fetch` prints nothing when GitLab has nothing your clone lacks, or a `From gitlab.com:GITLAB_USER/REPO` line followed by what was new. The last prints:

```text
github	git@github.com:GITHUB_USER/REPO.git (fetch)
github	no-push (push)
origin	git@gitlab.com:GITLAB_USER/REPO.git (fetch)
origin	git@gitlab.com:GITLAB_USER/REPO.git (push)
```

`origin` is GitLab now, so `git push` goes there. The `github` remote is for fetching pull requests (section 8). Its push address is a dud on purpose, because anything you push to the mirror directly is overwritten at its next update. If you try, git says `fatal: 'no-push' does not appear to be a git repository`.

## 5. Set up the mirror

GitLab pushes to GitHub over HTTPS, with a token. This is GitLab's documented way to mirror to GitHub, and the only one that also copies Git LFS files. Section 10 covers an SSH key instead, and pushing to both from your own computer.

1. On GitHub, make the token: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Token name: something you'll recognise, such as `gitlab mirror REPO`.
   - Expiration: a year at most. GitHub lets a personal account's token never expire, but that leaves a permanent key to your repository on another company's servers.
   - Repository access: Only select repositories, then `GITHUB_USER/REPO`.
   - Permissions: Contents, Read and write. If the repository has a `.github/workflows/` folder, also Workflows, Read and write: without it, GitHub refuses any push that changes those files. GitHub adds Metadata, Read-only, by itself.
   - Generate token, and copy it: GitHub shows it only once.

   Put the expiry date in your calendar.

2. On GitLab, in the project: Settings → Repository → Mirroring repositories → Add new.
   - Git repository URL: `https://github.com/GITHUB_USER/REPO.git`
   - Mirror direction: Push
   - Authentication method: Username and Password, with `GITHUB_USER` as the username and the token as the password.
   - Leave Keep divergent refs off, so GitLab wins whenever the two differ. That's what makes GitHub a mirror.
   - Optionally, tick Mirror only protected branches, if you want only those (usually just the default branch) on GitHub. Updates then arrive within a minute rather than five.
   - Select Mirror repository.

3. On the new row under Mirrored repositories, select Update now. Shortly after, GitHub shows your branches and tags, and the row shows its last successful update. Update now works at most once every five minutes. From here on, every push to GitLab reaches GitHub by itself, within five minutes.

## 6. Make the GitHub copy behave like a mirror

1. Description: on the repository's GitHub page, use the gear beside About to set something like "Mirror of https://gitlab.com/GITLAB_USER/REPO. Issues and merge requests there."
2. Settings → General → Features: untick Issues and Wikis, so nobody is left talking to a copy. Pull requests can still arrive; section 8 handles them.
3. Settings → Actions → General: if anything in `.github/workflows/` publishes or deploys (a package, a website, a release), make sure it runs on only one host. Either choose Disable actions here and do that work in GitLab CI, or keep it here and leave it out of GitLab CI.
4. Leave GitHub's default branch without rules that block direct pushes, such as requiring pull requests. The mirror pushes directly, so such rules make every update fail.
5. If your GitHub account has "Block command line pushes that expose my email" turned on (Settings → Emails), keep your private email address out of your commits, or the mirror's updates can fail.
6. Say where the project lives in the first lines of the README, so anyone who lands on GitHub knows where to file issues.

## 7. Everyday work

Nothing changes: commit and push as usual.

```bash
git push
```

It prints one `To gitlab.com:GITLAB_USER/REPO.git` block. When you push a new branch, GitLab adds `remote:` lines with a link for creating a merge request; that's an offer, not an error. GitHub follows within five minutes.

To check the mirror, look at Settings → Repository → Mirroring repositories on GitLab. Its row shows the last successful update, or the error that stopped it (section 12).

Now and then, export the GitLab project (Settings → General → Advanced → Export project) and keep the file. It holds the issues, merge requests, wiki and releases, which the mirror doesn't. GitLab deletes the export after 24 hours, and warns that exports aren't a dependable backup, so treat yours as better than nothing rather than as a backup.

## 8. Pull requests that arrive on GitHub

Never merge on GitHub: the next mirror update overwrites GitHub's branch with GitLab's, and the merge disappears from GitHub. Bring the pull request to GitLab instead, with its number in place of `7`:

```bash
git fetch github pull/7/head:pr-7
git push origin pr-7
```

The fetch prints `From github.com:GITHUB_USER/REPO` and `* [new ref]  refs/pull/7/head -> pr-7`. The push prints `* [new branch]  pr-7 -> pr-7`, and GitLab adds a link for creating a merge request from the branch. Open it, then review and merge on GitLab as usual.

When the merge reaches GitHub through the mirror, GitHub marks the pull request merged if its commits arrived unchanged. If you squashed or rebased them, close it by hand, with a link to the merge request.

## 9. CI and a website

GitLab runs CI from a `.gitlab-ci.yml` file at the top of the repository, and GitHub runs `.github/workflows/`. A mirrored repository carries both files, and each site ignores the other's.

On GitLab's free tier, jobs run on GitLab's machines, within 400 compute minutes a month. If a pipeline stops with "Identity verification is required in order to run CI jobs", select Verify my account in the banner, then run the pipeline again. GitLab may ask for a phone number or a card. Its alternative is a runner on a machine of your own, which builds only while that machine is on.

GitLab Pages publishes a website from a job with `pages: true` that leaves the finished site in a folder named `public`. A starting point:

```yaml
pages:
  image: debian:stable-slim          # an image that has your site generator
  script:
    - ./build-site --output public   # your generator's build command
  pages: true
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

Replace the image and the script line with your generator's. Deploy → Pages then shows the address. New projects get a unique address of their own by default, with the site at its root; to use the older `GITLAB_USER.gitlab.io/REPO/` form instead, clear Use unique domain on that page.

Keep the build itself in a script in the repository, and have each CI file call it. Then GitLab, GitHub and your own computer build the same way, and moving CI later is a small change.

## 10. Other ways to keep GitHub in step

### 10.1 An SSH key instead of a token

Pick this if you'd rather not renew a token, and the repository doesn't use Git LFS: GitLab copies LFS files only over HTTPS. The key works for this one repository only, and doesn't expire.

1. In GitLab's Add new mirror form, set Git repository URL to `ssh://github.com/GITHUB_USER/REPO.git` (in this form, not `git@github.com:…`) and Mirror direction to Push, then select Detect host keys. Check that the ED25519 fingerprint it shows is `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`. Set Authentication method to SSH public key and Username to `git`, then select Mirror repository.
2. On the new row, select Copy SSH public key.
3. On GitHub, in the repository: Settings → Deploy keys → Add deploy key. Paste the key, tick Allow write access → Add key.
4. Select Update now on GitLab, and check GitHub as in section 5.

If GitHub ever changes its host key, the mirror fails with a host key error. GitLab's fix is to delete the mirror and add it again.

### 10.2 Push to both from your computer

Pick this if you work alone, always push from one clone, and never merge in GitLab's web interface. No token or key is stored on either site. It misses anything that happens on GitLab's servers, such as a merge request merged in the browser, and it covers only the clones you set it up in. In the clone:

```bash
git remote set-url --add --push origin git@gitlab.com:GITLAB_USER/REPO.git
git remote set-url --add --push origin git@github.com:GITHUB_USER/REPO.git
```

Both print nothing. From then on, each `git push` prints a `To …` block for GitLab, then one for GitHub. The first line is needed because once any push address is set, git pushes only to push addresses. If GitLab can't be reached at all, git stops there without pushing to GitHub; a push GitLab refuses doesn't stop it. Don't combine this with GitLab's mirror.

## 11. When one side drops you

### 11.1 GitHub drops the mirror

Your work carries on: GitLab is the home. Delete the mirror's row on GitLab (Settings → Repository → Mirroring repositories), and update the README if you set up a copy somewhere else.

### 11.2 GitLab drops you

Your clone and the GitHub mirror have every commit up to the last mirror update, and your clone has anything you pushed in the five minutes before. What lived only on GitLab, such as issues, merge requests, the wiki and CI settings, is gone unless you exported it (section 7).

To make GitHub the home:

```bash
git remote set-url origin git@github.com:GITHUB_USER/REPO.git
git remote remove github
git push --all origin
git push --tags origin
```

The first two print nothing. Each push prints `Everything up-to-date` if the mirror was current, or a line for each branch or tag it sends. Then, on GitHub, turn back on what you turned off in section 6, such as Issues, Wikis and Actions, and update the description and the README.

GitHub has no built-in push mirroring, so for a new copy elsewhere, use 10.2 with GitHub's address first.

## 12. When the mirror fails

The mirror's row on GitLab shows the error. The usual ones:

- **Authentication failed:** the token has expired, or was deleted. Make a new one as in section 5, then delete the mirror's row and add it again with the new token.
- **`refusing to allow a Personal Access Token to create or update workflow`:** the token lacks the Workflows permission. Make a new one that has it.
- **`13:Received RST_STREAM with error code 2`:** GitLab's docs give two causes: GitHub blocked a push that exposes your email address (section 6, item 5), or the repository holds a file over GitHub's 100 MB limit.
- **`LFS objects are missing`:** the mirror uses SSH, which doesn't carry LFS files. Use the token method in section 5 instead.
- **A rejection on the default branch:** a protection rule on GitHub blocks direct pushes (section 6, item 4).

## Known gaps

- The steps follow GitLab's and GitHub's documentation as of October 2026, and both sites move their menus around. If a label differs, look for the same words nearby.
- The SSH key method (10.1) isn't in GitLab's GitHub-specific instructions, which show only the token. It combines GitLab's general SSH mirror support with GitHub's deploy keys, and hasn't been tested end to end for this doc.
- GitLab's docs don't say whether deleting a branch on GitLab deletes it on GitHub. Check the first time you delete one.
- The git commands and their output were tested against local repositories standing in for GitLab and GitHub, not against the live sites. Over the network, git adds progress lines, and each site may add `remote:` lines.
