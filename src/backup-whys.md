# Whys

*TLDR:
Get a working backup running today.
Someday a life could depend on it.
Borg is the best backup tool so far.
Start simple. 
Iterate later.
Bring your data into a single folder, get a couple of USB sticks, and proceed to the next article*

## Why backup?
---
It's the first thing every serious knowledge-worker should do, for failure is inevitable.
If you're convinced you need to backup immediately, skip to the [Why offline](#why-offline) or [Why Borg](#why-borg) section.

### Failure is inevitable

There are two kinds of people, as an old saying goes, those who have lost important data and those who will.
Drives fail.
Devices get stolen.
Mistakes happen.
Malware corrupts or locks what you have.
The question is not whether you will face data loss, but whether you will be prepared for it.

### Recovery is a pain

Recovery without a backup is painful and time-consuming.
The asymmetry between the effort of setting up and running a good backup system and the stress of recovering lost data without one, is vast.
And to keep a backup system going costs almost nothing.
The hard part is the work to set it up, negligible effort compared to regret of finding yourself without a backup in an crisis event.

### Someone's life may depend on it

Data is not a luxury.
It shapes how you work, how you remember, how you prove who you are and what you have done.
For most people, the loss of important data is a serious inconvenience.
For some it can be catastrophic: a doctor whose patient records vanish, a journalist whose source files are wiped, a small business owner whose client database disappears overnight.
And once in a while the right file at the right moment is the difference between life and death: a medical history in an emergency room, the evidence that clears someone, the records that locate a missing person.

### It's a way to honour time

Even if the stakes may not be as dramatic, it's prudent to honour your time.
The data you accumulate represents time, your most finite and non-renewable resource.
Every file created, every note written, every photograph you have taken, is time spent.
To be careless with it is to dishonour your time.
A backup plan is, among other things, an act of respect for your own labour and time.

## Why offline?
---

Don't upload your data to Google Drive or One Drive or some other storage service.
That's a bad idea, even if it's encrypted.
Take responsibility for what's yours.
Don't be a wuss.

### Who says it's encrypted?

Most consumer cloud is not end-to-end encrypted at all.
"Encrypted at rest" means the provider keeps a key and can read your files whenever it chooses.
There is nothing for an attacker to break, because the provider can already decrypt, and so can anyone who breaches them, buys them, or compels them.
Even the services that are genuinely end-to-end write and ship the software that does the encrypting.
A single update can lift your key, or your files, before they are ever encrypted, and you cannot audit every release.

### Your custodian is a moving target

The company can be breached, sold, merged, subpoenaed, served a foreign warrant, or simply shut down.
It can change its terms or close your account on a morning you had no reason to expect.
Furthermore providers consolidate, so the entity holding your data next year may not be the one you chose this year.
Legal demands on them rise rather than fall.
Their incentive to mine what you store, to train models on it, or to sell access to it, climbs every quarter.

### The stored copy only gets easier to open

Then there is the long game.
An attacker does not even have to break your encryption now.
He copies your encrypted files out of the cloud today and simply waits.
Computers keep getting stronger, and the quantum kind is expected to break some if not all encryption algorithms.
When that day arrives, the attacker unlocks the copy he took years before.
Every encrypted file you leave in someone else's hands is a break-in postponed.

### Offline removes the remote attack surface

Now an offline drive, one that is never connected to a network, has no remote attack surface to speak of, no account to phish, no client to backdoor, no provider to compel, no stored blob to harvest.
Your threat model shrinks to the physical: fire, flood, theft.
You answer that the ordinary way, with more than one copy kept in more than one place.
And physical risk does not scale the way network risks do.
Breaching one server affects a million people at once, but how do you burgle a million drawers? 
And the attacker cannot reach the drive in your home and the drive at a friend's house on the same afternoon.

### Ownership and endgoal

Ownership gives you a boundary you can see, inspect, and defend.
Later, when a drawer of drives is not enough and you want a copy that lives somewhere else, the answer is still hardware you own, a small home server such as StartOS, which is a self-hosted machine you run yourself, rather than a company's cloud.
Setting one up is a subject for another day.


## Why today?
---

The perfect backup system is worth striving for, but it's unlikely you're going to build it all in one day.
And the perfect system will always be worse than a working one that's running today.
A single working encrypted backup on an external drive and a password written on paper, is much better than the perfect system you get to eventually.
Moreover the perfect backup system is a moving target, because the bad guys will never stop trying to find ways to undermine your privacy and sovereignty.
And significant improvements in security and resilience does not need the perfect setup; it needs a setup that actually runs today.

So start simple.
Iterate later.
For now all you need is bring your data into a single folder, and use Borg to back it up on to a USB
These series of posts help you do just that.
Use dummy data with Borg if you're not convinced.
Get a feel of how easy the backup process with Borg really is.
A few simple commands in your terminal and you have an encrypted, compressed backup.
And when you're convinced that Borg is the best, you can repeat the steps with your actual data.

## Why Borg?
---

Borg is the best backup-program available today.
Don't take my word for it; do your research, but here are some facts.

Nobody bases a product on a backup engine they do not trust.
BorgBase is a hosting service specialised for BorgBackup and offers append-only repositories and two-factor authentication, and it funds development of the surrounding tooling.
Hetzner added native Borg support to its Storage Box product, with an extended SSH service, official documentation, append-only mode, and per-version remote-path pinning.
Rsync.net, a longest-standing offsite-storage providers, supports Borg natively as well.
On the desktop, Pika Backup, a GNOME application, is powered by BorgBackup, and Vorta provides a Qt front-end over the same Borg backend, while borgmatic wraps it for scheduling and retention policy.
A whole ecosystem of CLIs, Docker servers, and web UIs have grown around the engine.

Borg's headline accomplishment is reach.
The main repository carries roughly 10.9k stars and 739 forks, at the time of this writing.
Borg ships as a packaged tool in the Debian, Fedora, and Arch repositories among others, meaning distribution maintainers vetted and adopted it independently rather than leaving it to users.
That's saying a lot.
These are evidences that experts use it rather than just star it.
Furthermore, [Open Source Everything](https://github.com/An-anonymous-coder/Open-Source-Everything) list names it as the backup tool.

On reliability it has earned trust the hard way.
Borg deliberately reuses the system SSH client and links only OpenSSL's libcrypto rather than implementing its own network crypto protocol, and it publishes an explicit threat model spelling out that an attacker cannot modify, rename, remove, or add an archive without the client detecting it.
It has run in production for about a decade, descending from Attic, which was accepted into Debian in August 2013 before being forked as Borg in 2015, and it is still actively maintained: lead developer Thomas Waldmann and the project run on community funding through GitHub Sponsors and Open Collective. 
Across that decade it has had one notable cryptographic flaw, CVE-2023-36811, an archive-forgery issue disclosed and fixed in version 1.2.5 with a documented upgrade procedure, which is the responsible-handling record that matters more than any clean-sheet claim.

Borg uses a technique called deduplication, which means, after the first backup, it only stores the changes of the files being backed up, making it suitable for daily, hourly, and even secondly backups. 
It supports compression and authenticated encryption, which makes it suitable for storing backups in untrusted locations. 

To learn more, read [the official docs](https://borgbackup.readthedocs.io/en/stable/index.html); and verify for yourself if it fits your need.

