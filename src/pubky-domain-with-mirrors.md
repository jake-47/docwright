# Pubky Domain with Mirrors

> - **For:** anyone with a Start9 box and a static site on GitLab, mirrored to GitHub, who wants an address for it that no registrar can take, with a copy for every kind of browser.
> - **Before you start:** the site on GitLab Pages, mirrored to GitHub (gitlab-hosting-github-mirror covers that), a Start9 box on StartOS 0.4, and a domain you've bought.
> - **Reading time:** about 15 minutes.
> - **You end with:** the site at four addresses (your domain, a GitHub copy, an onion copy on your Start9, and a Pubky domain for Pubky's browser), the words to tell readers which opens where, and a plan for when any one of them goes.

Throughout, `example.org` stands for your domain, `GITLAB_USER` and `GITHUB_USER` for your usernames, `REPO` for the repository, `KEY` for your Pubky domain (your public key), `ONION` for your onion address, and `VPS_USER` and `VPS_IP` for the account and address of a small server. Put yours in their place wherever they appear, commands included.

## The four addresses

A static site is a folder of files, so the same build can be served from anywhere. Each address below covers a different way of losing the others.

| Address | Opens in | Served by | Covers you when |
|---|---|---|---|
| `https://www.example.org/` | any browser | GitLab Pages | the normal case |
| `https://GITHUB_USER.github.io/REPO/` | any browser | GitHub Pages | GitLab drops you |
| `http://ONION.onion/` | Tor Browser | your Start9 box | the domain is seized, or both hosts drop you |
| `http://KEY./` | Pubky's browser, or a browser set to a PKDNS resolver | a small VPS now, a Pubky homeserver later | the domain is seized, for readers without Tor |

The GitHub address exists only if the repository's GitHub workflows build a Pages site. If yours don't, the GitHub copy is the code alone, and the other three addresses carry the site.

A Pubky domain is a name made of your own Ed25519 public key, 52 characters long; Pubky's documentation calls these Public Key Domains. You sign its records and publish them to BitTorrent's Mainline DHT, so no registrar or court order against a registrar can take it away. It's Pubky's system, from Synonym. Its costs are on the reader's side: an ordinary browser can't resolve it, and today it's served over plain HTTP. That's why it sits beside the other addresses instead of replacing them.

Build the site to work from the root of an address, with relative links wherever your generator allows. Every address here serves it at the root except GitHub's project address, which serves it under `/REPO/`.

## 1. Your domain on GitLab

The mirror is set up as in gitlab-hosting-github-mirror. To put your domain in front of GitLab Pages:

1. Deploy → Pages → New Domain: domain `www.example.org`, with "Automatic certificate management using Let's Encrypt" off for now → create. Do the same for `example.org`. GitLab shows a verification record for each.
2. At your DNS host, add these, with a TTL of 300 seconds or the lowest it allows, so a later move reaches readers in minutes:

   ```text
   www                                  CNAME  GITLAB_USER.gitlab.io.
   @                                    A      35.185.44.232
   _gitlab-pages-verification-code.www  TXT    gitlab-pages-verification-code=…
   _gitlab-pages-verification-code      TXT    gitlab-pages-verification-code=…
   ```

   Each TXT value is the one GitLab showed for that domain. Give the apex no AAAA record: GitLab's Let's Encrypt notes ask for a single A record and no AAAA record. Add no wildcard records.

3. Once the TTL has passed, check:

   ```bash
   dig +short www.example.org
   ```

   It prints `GITLAB_USER.gitlab.io.` and then `35.185.44.232`. No output means the records haven't propagated yet, which can take up to 24 hours. If `dig` isn't installed, `sudo apt install bind9-dnsutils` installs it and ends with a `Setting up bind9-dnsutils` line.

4. In Deploy → Pages → Domains & settings, open each domain with Edit, and select Retry verification until it shows as verified. Keep the TXT records: GitLab re-checks them.
5. Turn on "Automatic certificate management using Let's Encrypt" for both domains. GitLab says the certificate can take up to an hour.
6. On Deploy → Pages, set Primary domain to `www.example.org`, so the apex and the gitlab.io name redirect to it.
7. `curl -sI https://www.example.org/ | head -1` prints a status line ending in `200`.
8. Verify the domain on your GitHub account too, so no other GitHub repository can claim it if you ever move it there (6.1): profile Settings → Pages → Add a domain → `example.org`. Add the TXT record GitHub shows, named `_github-pages-challenge-GITHUB_USER`, select Verify, and keep the record. `dig +short TXT _github-pages-challenge-GITHUB_USER.example.org` prints its value in double quotes.

## 2. The onion copy on your Start9

This assumes StartOS 0.4, where Tor is a service you install.

1. Marketplace → NextExplorer → Install. Run its Set Admin Password action, store the email and password it shows in your password manager, start it, open its Web UI and sign in.
2. Under Locations → Files, create a folder named `site`.
3. Get the built site: on GitLab, Build → Jobs → the latest `pages` job → Download, under Job artifacts, saves `artifacts.zip`. Unpack it, and it holds a `public` folder. A build from your own computer works too.
4. Open `site` in NextExplorer and drag in everything inside `public`, so `index.html` sits directly in `site`.
5. Marketplace → Start9 Pages → Install. Its task "Add your first website!" opens Manage Websites → Add: Name `Site`, Source NextExplorer, Folder Location `Files/site` → Save. Its two health checks, Hosting and Website Folders, go green.
6. Marketplace → Tor → Install. On the Site interface page, select Add onion service, or use Tor → Actions → Manage Onion Services. You get an http and an https `.onion` address.
7. Open the http one in Tor Browser, and publish that one. Onion connections are already encrypted end to end, and the https address is signed by your server's own certificate authority, so readers would get a certificate warning.

An onion address is a public-key name too: it's an Ed25519 key, and Tor Browser checks that the server holds it. No port is opened on your router, your home IP stays hidden, and it works behind CGNAT. It's down whenever the box is.

## 3. The Pubky domain

There are two ways to serve it. Both use your key, and moving from the first to the second keeps the address only if the same key carries over (3.4).

- **A small VPS, working now.** The key's A record points at a VPS running nginx, and a cron job on the VPS republishes the record every hour. Pubky's browser opens it over plain HTTP.
- **A Pubky homeserver, coming.** The site sits in your storage on a Pubky homeserver, and Pubky's browser opens it at `https://KEY/`, encrypted and checked against your key, with no server of yours to run. The homeserver gained this on 21 October 2026, but it isn't in a release yet. Section 3.4 has what to watch for.

If you can wait, wait for the homeserver. It removes the VPS, the hourly job and the secret kept on the VPS, and it gives readers HTTPS checked against your key. Take the VPS route only if you want the Pubky domain live now. Its costs are a VPS of a few dollars a month, an hourly job, your key's secret on that VPS, and plain HTTP: over HTTP the connection is neither encrypted nor proven to come from you, because the signed record proves only where the name points.

Your Start9 box isn't used for this address. StartOS runs only packaged services, and no package for publishing these records turned up in Start9's repositories as of October 2026. A box behind CGNAT, as many home connections are, also can't take inbound connections without a tunnel.

### 3.1 Make the key

Do this on your own computer, where the seed's backup will live.

1. From the pkdns releases page on GitHub (github.com/pubky/pkdns, under Releases), download the newest release's file ending `-linux-amd64.tar.gz`, or `-linux-arm64.tar.gz` for an ARM machine. The release lists no checksums of its own; GitHub shows each file's SHA-256 digest beside it. Check yours matches:

   ```bash
   sha256sum pkdns-v*-linux-amd64.tar.gz
   ```

   It prints a 64-character digest and the file's name. If the digest isn't the one GitHub shows, delete the file and download it again.

2. Unpack it and install the command-line tool:

   ```bash
   tar -xzf pkdns-v*-linux-amd64.tar.gz
   sudo install -m 755 pkdns-v*-linux-amd64/pkdns-cli /usr/local/bin/
   pkdns-cli --version
   ```

   The first two print nothing; the folder they leave holds `pkdns` and `pkdns-cli`. The last prints `pkdns-cli` and the version, such as `pkdns-cli 0.7.1`.

3. Make the seed, the secret your domain is derived from:

   ```bash
   mkdir -p -m 700 ~/pkdns
   pkdns-cli generate > ~/pkdns/seed.txt
   chmod 600 ~/pkdns/seed.txt
   pkdns-cli publickey ~/pkdns/seed.txt
   ```

   The first three print nothing. The last prints your public key, 52 characters: that's `KEY`, your domain. The seed is 52 characters too, so take care never to paste the wrong one anywhere.

4. Back up `seed.txt` now, in your password manager and in your encrypted backups. Whoever holds the seed controls the domain, and there's no registrar to appeal to: a lost seed is a lost address, and a leaked one is an address someone else can repoint.

### 3.2 Serve it from a VPS

1. Rent a small VPS running Debian 13, with your SSH key for login. If your provider has a firewall, allow ports 22 (SSH) and 80 (HTTP).
2. Log in to the VPS as an account that can use sudo. The first time, ssh asks whether to trust the VPS's host key: compare the fingerprint with the one your provider's console shows, if it shows one, before answering `yes`. Install the web server, rsync, cron and curl, and hand the web folder to your account:

   ```bash
   sudo apt install nginx rsync cron curl
   sudo chown -R VPS_USER: /var/www/html
   curl -sI http://localhost/ | head -1
   ```

   The install ends with `Setting up nginx` lines, or says each is already the newest version. The `chown` prints nothing. The `curl` prints `HTTP/1.1 200 OK`: nginx is serving its welcome page. Debian's nginx serves `/var/www/html` to every name that reaches it, so it needs no configuration for your key.

3. Lock the VPS down before your seed goes on it. Anyone who takes it over can repoint your domain, so it has to refuse password logins and install security updates by itself. On the VPS:

   ```bash
   sudo sshd -T | grep -i '^passwordauthentication'
   apt-config dump APT::Periodic::Unattended-Upgrade
   ```

   The first should print `passwordauthentication no`. If it prints `yes`, turn password logins off and run the check again:

   ```bash
   echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/00-no-passwords.conf
   sudo systemctl restart ssh
   ```

   `tee` prints the line it wrote; the restart prints nothing. The `00-` keeps the file ahead of any your provider added, such as `50-cloud-init.conf`, since ssh takes the first value it reads. Keep your session open until a second terminal logs in with your key.

   The second check should print `APT::Periodic::Unattended-Upgrade "1";`. If it prints nothing, run `sudo apt install unattended-upgrades`, then `sudo dpkg-reconfigure -plow unattended-upgrades`, and answer Yes when it asks whether to download and install stable updates automatically.

4. From your computer, copy the built site (the `public` folder from 2.3) over, replacing the welcome page:

   ```bash
   rsync -a --delete public/ VPS_USER@VPS_IP:/var/www/html/
   ```

   It prints nothing. Run the `rsync` line again after each release.

5. From your computer, copy the archive from 3.1 and the seed to the VPS, the seed into a private folder; the hourly job signs with it:

   ```bash
   scp pkdns-v*-linux-amd64.tar.gz VPS_USER@VPS_IP:
   ssh VPS_USER@VPS_IP 'mkdir -m 700 -p ~/pkdns'
   scp ~/pkdns/seed.txt VPS_USER@VPS_IP:pkdns/seed.txt
   ```

   Each `scp` prints a progress line for its file; the `ssh` line prints nothing. If the VPS is ARM, download its `-linux-arm64.tar.gz` file for it instead. Then, on the VPS, run 3.1's step 2 to install `pkdns-cli` there.

6. On the VPS, write the zone, a DNS zone file without the SOA record, as `~/pkdns/pkarr.zone` in any editor:

   ```text
   $TTL 60
   @      IN    A      VPS_IP
   ```

7. Publish it:

   ```bash
   pkdns-cli publish ~/pkdns/seed.txt ~/pkdns/pkarr.zone
   ```

   It prints `Packet KEY`, a `Name TTL Type Data` heading, your A record, and then, after a few seconds of `Hang on...`, a timestamp and `Successfully announced.` A line starting `Error` means it failed, even though the command still exits with success, so read the output.

8. Republish every hour, since the DHT forgets records within hours. On the VPS, run `crontab -e`, choose an editor if it asks, and add this line. Cron needs full paths, so it uses `$HOME`:

   ```text
   17 * * * * /usr/local/bin/pkdns-cli publish $HOME/pkdns/seed.txt $HOME/pkdns/pkarr.zone >> $HOME/pkdns/publish.log 2>&1
   ```

   `crontab -l` then prints the line back. Each hour, `publish.log` gains the publish output, ending in a `Successfully announced.` line; check it now and then.

9. Check from your computer:

   ```bash
   pkdns-cli resolve KEY
   nslookup KEY 34.65.109.99
   curl -sI --resolve KEY:80:VPS_IP http://KEY/ | head -1
   ```

   The first prints `Resolve dns records of pk:KEY`, your A record, and `Last updated at:` with a time; `Failed to find the packet.` means it isn't visible yet, so wait a minute and try again. The second asks one of Pubky's public PKDNS resolvers, and prints a `Name:` line with your key and an `Address:` line with `VPS_IP`. The third asks nginx for the site under your key's name and prints `HTTP/1.1 200 OK`. Resolvers cache these records for five minutes or more, so changes take a while to show.

10. Open `http://KEY./` in Pubky's browser. Keep the trailing dot, or the browser may search for the key instead of opening it.

### 3.3 What readers do

Readers have two ways to open the Pubky domain:

- **Pubky's browser.** It's Chromium with PKDNS DNS-over-HTTPS on by default, and its builds come from github.com/pubky/pubky-chromium. They type `http://KEY./`. It's new, and it hasn't yet shown it keeps pace with Chrome's security fixes, so offer it rather than press it.
- **Their own browser, with a PKDNS resolver.** They set the browser's secure DNS (DNS over HTTPS) to a custom provider, `https://pkdns.pubky.org/dns-query`, and type the same address. In Chrome that's Settings → Privacy and security → Security → Use secure DNS; in Firefox, the DNS over HTTPS setting under Privacy & Security. The resolver then sees every name they look up, and passes ordinary names on to another resolver, so this suits a second browser better than a main one.

### 3.4 Moving it to a Pubky homeserver

When this ships, it replaces the VPS. As of 24 October 2026:

- **The homeserver.** Website serving was merged on 21 October 2026, after the latest release (v0.16.2, of 15 October). Wait for a release that lists it.
- **An account.** Homeservers need a signup token from their operator by default, unless you run your own. The homeserver republishes its users' records every four hours by default, which replaces your cron job.
- **Uploading.** The site goes into your storage under `/pub/website/_/`, through the storage API. Each file needs its content type set at upload, because the homeserver serves the type it stored, so a site of many files needs a script for this.
- **The records.** You sign two: one routing your key to the homeserver, and one naming the key its TLS must prove. The homeserver's docs say the SDK has no helper for them yet, and `pkdns-cli` writes only A, AAAA, TXT, CNAME and MX records, so it can't write them.
- **The browser.** On 16 October 2026, Pubky's browser didn't yet follow those records.
- **Your key.** Moving needs the same key, or the address changes. Pubky Ring, Pubky's key manager, imports a recovery phrase, an encrypted file or a QR code. Whether it takes a seed made with `pkdns-cli` isn't documented, so check before you count on keeping the address.

Once all of that is in place: upload the site, publish the two records, check the address opens as `https://KEY/` in Pubky's browser, then remove the cron job and the seed from the VPS, and close the VPS.

## 4. Tell readers where to find it

Put the addresses on the site's About page and in the repository's README now, while readers can still reach you to learn them. For example:

```markdown
This site lives at four addresses, all serving the same pages:

- https://www.example.org/ opens in any browser.
- https://GITHUB_USER.github.io/REPO/ is a copy on GitHub.
- http://ONION.onion/ opens in Tor Browser.
- http://KEY./ opens in Pubky's browser, or in a browser set to a PKDNS resolver.
```

Leave out the GitHub line if the GitHub copy has no Pages site.

## 5. Each release

1. Push to GitLab. GitLab rebuilds `www.example.org`, the mirror carries the commit to GitHub within five minutes, and GitHub rebuilds its copy if it has a Pages workflow.
2. Download the new `artifacts.zip` from GitLab's `pages` job and unpack it.
3. Onion copy: in NextExplorer, delete everything inside `Files/site` and drag the new `public` contents in. Expect a few seconds of 404s in between.
4. Pubky domain: `rsync -a --delete public/ VPS_USER@VPS_IP:/var/www/html/`, which prints nothing.

## 6. When something is taken down

| What's gone | What readers see | What you do |
|---|---|---|
| GitHub | nothing changes | remove the mirror, as gitlab-hosting-github-mirror says, and drop the GitHub line from the About page |
| GitLab | your domain stops serving the site | 6.1 |
| The domain | ordinary browsers lose the main address | 6.2 |
| The VPS | the Pubky domain stops answering | 6.3 |
| Pubky's public resolvers | Pubky-browser readers who rely on them can't resolve the key | 6.4 |
| Your Start9 box | the onion copy is down | bring the box back; nothing else is affected |
| The seed leaks | someone else can repoint the Pubky domain | 6.5 |

### 6.1 GitLab drops you

Your clone and the GitHub mirror have every commit. Make GitHub the home as gitlab-hosting-github-mirror describes, and if the GitHub copy has a Pages site, move the domain to it:

1. On GitHub: Settings → Pages → Custom domain → `www.example.org` → Save.
2. At your DNS host, point `www` at GitHub and give the apex GitHub's addresses in place of GitLab's A record:

   ```text
   www  CNAME  GITHUB_USER.github.io.
   @    A      185.199.108.153
   @    A      185.199.109.153
   @    A      185.199.110.153
   @    A      185.199.111.153
   @    AAAA   2606:50c0:8000::153
   @    AAAA   2606:50c0:8001::153
   @    AAAA   2606:50c0:8002::153
   @    AAAA   2606:50c0:8003::153
   ```

3. After the TTL, `dig +short www.example.org` prints `GITHUB_USER.github.io.` and four `185.199.x.153` lines. GitHub says HTTPS can take up to an hour, and its Enforce HTTPS box up to 24 hours to become available; tick it when it does.

Section 1, step 8, verified the domain on your GitHub account, so no other GitHub repository can claim it in those minutes. From now on, refresh the onion and Pubky copies from a build on your own computer, since GitLab's job artifacts are gone.

### 6.2 The domain is seized or lapses

1. Readers who know the other addresses carry on: they're on the About page.
2. On GitLab, clear Primary domain, so the gitlab.io name serves the site again instead of redirecting to the lost domain.
3. Buy a new domain, repeat section 1 with it, and update the About page and README.

### 6.3 The VPS is gone

The Pubky domain lives on: only its record points at a dead server. Rent another VPS, repeat 3.2 with the same seed and the new IP in `pkarr.zone`, and publish. Readers keep the same address; resolvers catch up within minutes.

### 6.4 Pubky's public resolvers go

Pubky's browser and the DoH setting in 3.3 use resolvers that Pubky runs. If they stop, the Pubky domain still exists on the DHT, but those readers can't look it up. A reader, or you, can run `pkdns` as a resolver of their own: it's the other program in the release archive, and its README covers running it.

### 6.5 The seed leaks

There's no recovery. Make a new key as in 3.1, publish it from a fresh VPS, put the new address on the About page and README, and say plainly there that the old one is no longer yours.

## Known gaps

- `pkdns-cli`'s output here is read from its source at release v0.7.1, not from running it. Builds of its newer, unreleased code write the seed as 64 hexadecimal characters, which that code's `publickey` command can't read. Use a release.
- The homeserver route in 3.4 is as Pubky's repositories describe it on 24 October 2026, and parts of it are days old.
- The Start9 steps follow Start9's documentation for StartOS 0.4, and the GitLab and GitHub steps follow those sites' documentation as of October 2026. Menus move.
- Pubky's censorship-resistance claims for the DHT come from the project's own write-ups, not from independent study.
- The search for a StartOS package that publishes these records covered Start9's own repositories only.