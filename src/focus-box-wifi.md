# Focus box with wifi

If you don’t need the internet at all while you work, [turn the radios off](./focus-box.md) and be done. But if you need say a dictionary or a an AI, then the solution is a laptop that reaches only those sites and no others.
Everything else is dropped before it leaves the machine, by the kernel, not by a browser extension you can switch off.
Undoing it takes three passwords that live on a sheet of paper outside the house.
The rest of the laptop stays an ordinary Devuan desktop: LibreOffice, the file manager, all of it.

Already running Devuan XFCE? Do section 1, skip section 2, and carry on from section 3.

The paper gets three lines, in the order the build produces them:

1. Firmware supervisor password (section 1)
2. GRUB password (section 9)
3. Root password (section 10)

The disk encryption passphrase does not go on the paper; you type it at every boot.

Do the sections in order. Everything root does, do on the text console: press Ctrl+Alt+F1, log in as `root`. If root has no password yet because the installer never asked for one, log in there as your own user, run `sudo -i`, then `passwd` to give root a temporary one. Ctrl+Alt+F7 returns to the desktop.

## 0. What you need

- The ThinkPad with Devuan XFCE on it, or a USB stick of 4 GB or more and another Linux computer to write the installer with.
- Your Wi-Fi passphrase.
- A sheet of paper and a pen. Nothing goes in a password manager.

## 1. Firmware, first visit

Generate the supervisor password on a computer first:

```sh
tr -dc 'a-km-z2-9' </dev/urandom | head -c 12; echo
```

Expected: 12 lowercase letters and digits with no `0`, `1` or `l`, so nothing is ambiguous on paper. Write it on the paper as line 1.

Power on the ThinkPad and press F1 at the logo. Menu names vary a little between generations; if an item is missing, use the nearest one.

1. Security → Password → Supervisor Password: set it to line 1. If the firmware rejects the length, shorten it to what it accepts.
2. Security → I/O Port Access: leave Wireless LAN enabled; set Wireless WAN and Bluetooth to Disabled. Leave USB Port enabled; a keyboard needs it. (To tie the box to a cable instead, set Wireless LAN to Disabled too; nothing else in this document changes.)
3. Leave the Startup menu alone for now; USB boot stays on until section 11.
4. F10, save, exit.

## 2. Install Devuan

Skip this section if Devuan is already on the machine.

On the other computer:

1. Open https://www.devuan.org/get-devuan and follow it to the `desktop-live` directory of the current stable release. Download three files: the amd64 ISO with `desktop-live` in its name, `SHA256SUMS`, and `SHA256SUMS.asc`.

2. Check the download:

   ```sh
   sha256sum -c SHA256SUMS 2>/dev/null | grep desktop-live
   ```

   Expected: one line ending in `: OK`. `FAILED` means download it again.

   If that machine is Devuan, also check the signature:

   ```sh
   gpg --no-default-keyring --keyring /usr/share/keyrings/devuan-keyring.gpg --verify SHA256SUMS.asc SHA256SUMS
   ```

   Expected: a line beginning `gpg: Good signature from "Devuan`. A `WARNING: This key is not certified with a trusted signature!` after it is normal. `BAD signature` means stop. `No public key` means the signing key is not in that keyring; the checksum match above is then the check you have.

3. Find the stick:

   ```sh
   lsblk -d -o NAME,SIZE,MODEL
   ```

   Expected: one line per disk. The stick is the one with the matching size and model; note its name, for example `sdb`. The next command destroys whatever is on the device you name, and naming your own disk destroys your system.

4. Write it, with `sdX` replaced:

   ```sh
   sudo dd if=devuan_*desktop-live.iso of=/dev/sdX bs=4M status=progress oflag=sync
   ```

   Expected: a progress line that updates, then three lines ending in `copied`. Remove the stick.

On the ThinkPad:

5. Power on, press F12 at the logo, choose the stick. It boots to a live XFCE desktop. Join your Wi-Fi from the network icon in the panel, then start the installer from its desktop icon.

6. Take the defaults, and when it asks:
   - Disk: the whole internal disk, with encryption if it offers it. The passphrase protects the notes on the disk if the laptop is lost; it plays no part in the focus control, so make it one you can type every morning.
   - Root password: a temporary one you can type easily. Section 10 replaces it.
   - User: your name, username `john`, the password you'll use daily.
   - Hostname: `focus`.

7. Reboot when asked and remove the stick. Expected: the passphrase prompt if you chose encryption, then the LightDM login screen. Log in as john once, join your Wi-Fi from the panel icon so the box remembers it, and log out.

## 3. Packages

On the console as root:

```sh
apt update
```

Expected: lines beginning `Get:` and `Hit:`, then `Reading package lists... Done`. If every line is an error, the box isn't online; log in to the desktop and check the network icon.

See whether a time daemon is already running:

```sh
ps -eo user,comm | grep -E 'ntp|chrony'
```

Expected: either a line like `ntpsec   ntpd` or `_chrony  chronyd`, or nothing. If a line appears, note the user name in its first column, you need it in section 5, and leave `chrony` out of the next command.

```sh
apt install squid nftables chrony curl
```

Expected: a package list, `Do you want to continue? [Y/n]`, Enter, then lines beginning `Processing triggers`. A package that is already installed just gets a line saying it is already the newest version. `curl` is only for the tests in sections 4 and 5.

Check the service users the firewall will name:

```sh
id proxy; id _chrony
```

Expected: two lines beginning `uid=`, the first containing `(proxy)`, the second `(_chrony)`. If you kept an existing time daemon instead, run `id` on its user name.

## 4. The proxy and the allowlist

Put Squid's shipped config aside:

```sh
mv /etc/squid/squid.conf /etc/squid/squid.conf.shipped
```

Expected: nothing.

Create the allowlist:

```sh
vi /etc/squid/allowlist
```

```text
.lsbible.org
.merriam-webster.com
.claude.ai
.anthropic.com
challenges.cloudflare.com
```

A leading dot means the domain and everything under it. `challenges.cloudflare.com` is the human-check that claude.ai's login uses.

Create the config:

```sh
vi /etc/squid/squid.conf
```

```text
# Focus box proxy. Listens on loopback only.
http_port 127.0.0.1:3128

acl allowed dstdomain "/etc/squid/allowlist"
acl SSL_ports port 443
acl Safe_ports port 80 443
acl CONNECT method CONNECT

http_access deny !Safe_ports
http_access deny CONNECT !SSL_ports
http_access allow localhost allowed
http_access deny all

cache deny all
via off
forwarded_for delete
```

Check that it parses:

```sh
squid -k parse
```

Expected: a run of lines containing `Processing:`, one per line of the config, and no line containing `FATAL` or `ERROR`. Lines with `WARNING` are fine.

Restart it:

```sh
service squid restart
```

Expected: a line with `[ ok ]` ending in `squid.`.

Test a listed site and an unlisted one through the proxy:

```sh
curl -sI -x http://127.0.0.1:3128 https://read.lsbible.org | head -n 1
curl -sI -x http://127.0.0.1:3128 https://x.com | head -n 1
```

Expected: first `HTTP/1.1 200 Connection established`, second `HTTP/1.1 403 Forbidden`. The 200 is Squid opening the tunnel, which is what is being tested here; the site's own reply comes after it.

## 5. The firewall

Create the ruleset. If section 3 found an existing time daemon, put its user name in place of `_chrony`.

```sh
vi /etc/nftables.conf
```

```text
#!/usr/sbin/nft -f
flush ruleset

table inet focus {
    chain output {
        type filter hook output priority 0; policy drop;

        # Local traffic, including the browser talking to the proxy.
        oifname "lo" accept

        # Packets on connections already allowed below.
        ct state established,related accept

        # The proxy may look up names and reach web ports.
        meta skuid "proxy" meta l4proto { tcp, udp } th dport 53 accept
        meta skuid "proxy" tcp dport { 80, 443 } accept

        # The clock may look up names and reach time servers.
        meta skuid "_chrony" meta l4proto { tcp, udp } th dport { 53, 123 } accept

        # Root: apt, the nightly update and NetworkManager. Root's password
        # lives on the paper.
        meta skuid "root" accept
    }
}
```

Load it:

```sh
nft -f /etc/nftables.conf
```

Expected: nothing. Any output is an error; the usual one names a user that doesn't exist, which means section 3 didn't finish.

Look at it:

```sh
nft list ruleset
```

Expected: the table printed back, with `policy drop` on the chain line. The user names may come back as numbers; either is fine.

Make it load at boot, before any interface comes up:

```sh
vi /etc/network/if-pre-up.d/nftables
```

```sh
#!/bin/sh
# Load the focus firewall before any network interface comes up.
# If this fails, the interface stays down: no rules means no network.
exec /usr/sbin/nft -f /etc/nftables.conf
```

```sh
chmod 755 /etc/network/if-pre-up.d/nftables
```

Expected: nothing. The file name must contain no dot, or `run-parts` skips it. The hook runs when the loopback interface comes up at boot, which happens before NetworkManager starts the Wi-Fi, so the rules are in the kernel before the radio is.

Test it. First as root:

```sh
ping -c 1 -W 2 1.1.1.1
```

Expected: `1 packets transmitted, 1 received, 0% packet loss`. Root is allowed out.

Now as john:

```sh
su - john
ping -c 1 -W 2 1.1.1.1
```

Expected: `1 packets transmitted, 0 received, 100% packet loss`. That loss is the firewall working: john's packets are dropped.

```sh
curl -sS -m 5 https://read.lsbible.org
```

Expected: an error containing `timed out` or `Could not resolve host`, and no page. John cannot even look up a name.

```sh
curl -sI -m 10 -x http://127.0.0.1:3128 https://read.lsbible.org | head -n 1
exit
```

Expected: `HTTP/1.1 200 Connection established`. Through the proxy, john reaches listed sites and nothing else.

Reboot. At the login screen press Ctrl+Alt+F1, log in as root, and run `nft list ruleset` again. Expected: the table. If it prints nothing, the hook didn't run; `ls -l /etc/network/if-pre-up.d/` should show the file with `-rwxr-xr-x`.

## 6. Firefox

One system-wide policy file: proxy fixed, DNS-over-HTTPS off, Firefox's own phone-home off, autoplay off.

```sh
mkdir -p /usr/lib/firefox-esr/distribution
vi /usr/lib/firefox-esr/distribution/policies.json
```

```json
{
  "policies": {
    "Proxy": {
      "Mode": "manual",
      "HTTPProxy": "127.0.0.1:3128",
      "UseHTTPProxyForAllProtocols": true,
      "Locked": true
    },
    "DNSOverHTTPS": { "Enabled": false, "Locked": true },
    "CaptivePortal": false,
    "NetworkPrediction": false,
    "DisableTelemetry": true,
    "DisableFirefoxStudies": true,
    "DisablePocket": true,
    "Preferences": {
      "media.autoplay.default": { "Value": 5, "Status": "locked" },
      "network.connectivity-service.enabled": { "Value": false, "Status": "locked" }
    }
  }
}
```

Check the JSON, since one wrong comma makes Firefox ignore the whole file:

```sh
python3 -m json.tool /usr/lib/firefox-esr/distribution/policies.json >/dev/null && echo OK
```

Expected: `OK`. Anything else names the bad line.

Ctrl+Alt+F7, log in as john, open Firefox and go to `about:policies`. Expected: a table headed Active listing Proxy, DNSOverHTTPS and the rest. If it says the policy service is inactive, move the file as root to `/etc/firefox/policies/policies.json` (`mkdir -p /etc/firefox/policies` first), restart Firefox and look again.

## 7. Check the sites, add what they need

As john, use each site for a minute: open a chapter, look up a word, log in to claude.ai with the emailed code (not with Google: accounts.google.com is not on the list) and send a message.

If a site works, it is done, even with a logo or an ad missing. If something is broken, see what Squid refused. On the console as root:

```sh
grep TCP_DENIED /var/log/squid/access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -n 30
```

Expected: a count and a host per line, most frequent first, like `     14 www.google-analytics.com:443`. Hosts under `mozilla.com`, `mozilla.net` and `firefox.com` are Firefox phoning home. Hosts with `ads`, `analytics`, `tracking`, `pixel` or `doubleclick` in the name are what this box exists to drop. Add a host only when the site cannot work without it, as a dotted line in `/etc/squid/allowlist`, then:

```sh
squid -k reconfigure
```

Expected: nothing. Reload the page.

## 8. Nightly updates

Root may reach the network, so a root cron job keeps the box patched without you.

```sh
vi /etc/cron.daily/upgrade
```

```sh
#!/bin/sh
# Nightly security updates. Root is the only account that reaches the
# network directly, and root's password lives on the paper.
export DEBIAN_FRONTEND=noninteractive
{
    apt-get -qq update
    apt-get -qq -y -o Dpkg::Options::=--force-confold upgrade
} >>/var/log/nightly-upgrade.log 2>&1
```

```sh
chmod 755 /etc/cron.daily/upgrade
run-parts --test /etc/cron.daily
```

Expected: a list of paths that includes `/etc/cron.daily/upgrade`. `--force-confold` keeps your edited config files when a package ships a new version.

The desktop install includes `anacron`, which runs the job at the next boot when the laptop was off at the scheduled hour. Confirm:

```sh
dpkg -l anacron | grep ^ii
```

Expected: one line beginning `ii  anacron`. If nothing prints, `apt install anacron`. A kernel update takes effect at the next reboot, so reboot now and then.

## 9. Lock the bootloader

Without this, anyone at the keyboard presses `e` at the GRUB menu, adds `init=/bin/sh`, and has a root shell in a minute.

Generate the GRUB password and write it on the paper as line 2:

```sh
tr -dc 'a-km-z2-9' </dev/urandom | head -c 20; echo
```

Expected: 20 characters.

```sh
grub-mkpasswd-pbkdf2 | tee /root/grub-hash
```

Expected: `Enter password:` and `Reenter password:` (type line 2 twice; nothing echoes), then one long line beginning `PBKDF2 hash of your password is grub.pbkdf2.sha512.`, which is also saved to `/root/grub-hash`.

```sh
{ echo 'set superusers="admin"'; echo "password_pbkdf2 admin $(grep -o 'grub\.pbkdf2\..*' /root/grub-hash)"; } >> /etc/grub.d/40_custom
rm /root/grub-hash
tail -n 2 /etc/grub.d/40_custom
```

Expected: the two lines, the second ending in the long hash.

Turn off the recovery entry, which would otherwise offer a root shell without a password. Open `/etc/default/grub`, find `#GRUB_DISABLE_RECOVERY="true"` and remove the `#`. Then:

```sh
grep ^GRUB_DISABLE_RECOVERY /etc/default/grub
```

Expected: `GRUB_DISABLE_RECOVERY="true"`.

Mark the normal entry as bootable without a password, so a normal boot asks nothing and only editing asks:

```sh
sed -i 's/^CLASS="--class gnu-linux/CLASS="--unrestricted --class gnu-linux/' /etc/grub.d/10_linux
grep '^CLASS=' /etc/grub.d/10_linux
```

Expected: `CLASS="--unrestricted --class gnu-linux --class gnu --class os"`.

```sh
update-grub
```

Expected: `Generating grub configuration file ...`, `Found linux image:`, `Found initrd image:`, `done`. A line saying os-prober will not be executed is normal.

```sh
grep -c -- --unrestricted /boot/grub/grub.cfg
```

Expected: `1` or more.

Reboot. The menu appears and boots by itself after a few seconds. To see the lock, reboot once more and press `e` on the entry: expected `Enter username:`. Press Esc and let it boot.

## 10. Seal

In order, on the console as root.

1. Last chance for packages: `apt install` anything still missing.

2. Remove sudo and take john out of the sudo group. A desktop install usually has both.

   ```sh
   apt purge sudo
   deluser john sudo
   groups john
   ```

   Expected: apt removes sudo (or says it is not installed); `deluser` prints `Removing user 'john' from group 'sudo' ...` (or that john is not a member); `groups` prints `john : john` followed by groups like `cdrom audio video plugdev netdev`, with no `sudo`.

3. Make the config files immutable:

   ```sh
   chattr +i /etc/nftables.conf /etc/network/if-pre-up.d/nftables /etc/squid/squid.conf /etc/squid/allowlist /etc/grub.d/40_custom
   lsattr /etc/squid/allowlist
   ```

   Expected: an attribute string containing `i`, like `----i---------e------- /etc/squid/allowlist`. Root must now `chattr -i` a file before editing it: no accidental edits, no quick ones.

4. Replace root's password. Generate it, write it on the paper as line 3, then set it:

   ```sh
   tr -dc 'a-km-z2-9' </dev/urandom | head -c 32; echo
   passwd
   ```

   Expected: `New password:`, `Retype new password:`, `passwd: password updated successfully`.

5. Prove the paper works before it leaves. `exit`, then log in as root from line 3. Expected: a root prompt. Reboot, press `e` at the GRUB menu, enter username `admin` and line 2. Expected: the entry opens for editing; press Esc and let it boot. If either fails, fix it now; after section 11 a failure means a screwdriver.

6. From now on you log in only as john at the LightDM screen.

## 11. Firmware, second visit

Reboot, F1, enter line 1.

1. Startup → Boot: in the boot priority order, exclude every USB and network entry (highlight it, press the key the screen names for exclude, usually `x`) so only the internal drive remains. If there is a `Boot Order Lock` item, set it On.
2. Startup → `Boot Device List F12 Option`: Off.
3. F10, save.

The machine now boots only its own disk. The firmware opens with line 1, GRUB editing with line 2, root with line 3.

## 12. The paper

Fold it, seal it in an envelope, and give it to the person or the place you chose. The whole build is worth exactly the distance to this envelope.

## 13. Daily use

Log in as john. The three sites load; every other address shows Squid's Access Denied page, which is the normal face of this box. Missing images, broken ads and an empty new-tab page are normal too. Wi-Fi networks are joined from the panel icon as usual; the firewall doesn't care which network the box is on.

### Adding a site later

Needs the envelope. On the console as root:

```sh
chattr -i /etc/squid/allowlist
echo '.example.org' >> /etc/squid/allowlist
chattr +i /etc/squid/allowlist
squid -k reconfigure
```

Expected: nothing from each command. Keep a `wishlist` file in your home where you note sites as you miss them, so the envelope trip happens once in a while and not per site.

### What still gets through

- claude.ai is the one listed site that shows other people's content: asked to, it fetches and summarises pages. Turn web search off in its settings, or accept that.
- Pulling the drive and editing it in another computer. An hour of deliberate work; that is the floor on hardware you own.
- The envelope. Everything above it is near-certain; the distance to it is the result.

## 14. If something is off

- No site loads: the panel icon shows whether the box is on a network. If it is, `service squid status` as root should say running; `service squid start` if not.
- Certificate errors on every site: the clock is wrong. `date` as john shows it. As root, `chronyc tracking` should show `Leap status : Normal` (for ntpsec, `ntpq -p` should list servers with a `*` on one line); if not, the time daemon's rule in section 5 isn't loaded or names the wrong user.
- A site that used to work breaks after an update: `squid -k parse` and `nft -f /etc/nftables.conf` as root; both print no errors when the configs are intact.