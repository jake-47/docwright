# Planning

## Simple in theory

To build a good backup system, you need a plan. The plan is simple in theory: create copies, store them safely, restore after a crisis. But the simplicity of the plan disguises complexity of execution. Implementation of a good system (which good backup tools make intuitive and simple), can actually be crazy complex. It's one thing to make backups data but a whole other thing to successfully restore from it in a crisis.

## Principles of a good backup plan

Building a good backup system requires understanding the principles of a quality backup. These are principles, not suggestions. Each one exists for a reason; ignoring one or more of them is why many have failed to restore their data successfully. They are taken from Ross Williams' [Taobackup](http://taobackup.com/), conceived, designed, and implemented in August 1997.

### 1. Back up impartially

Backup everything. When deciding which files are important enough to protect, remember that data that seems trivial can take hours or days to reconstruct: a configuration file, a license key, a single bookmark. Such files maybe individually minor but collectively irreplaceable. The cost of storing an extra gigabyte can be negligible compared to the cost of recreating lost work.

However, there's a caveat to backing up everything. If it's data you never want revealed, maybe don't back it up. Consider privacy by omission rather than obfuscation. Rather than worrying about securely backing up those compromising pictures, for example, consider not taking or securely deleting those pictures. The strongest privacy is simply never creating or retaining the data in the first place.

### 2. Back up frequently

Aim to back up at least once a day, or after every significant work session. The more frequently you back up, the less you lose when something goes wrong. But frequency is only as good as the discipline behind it, and both manual and automated approaches have failure modes.

Manual discipline can fail, not from laziness but from life: work gets busy, routines break, and a task that depends on you remembering it will eventually not get done. On the bright side, if you keep at it, actions become habits and eventually second nature. 

Automation has its perks, but an updated dependency or a system change can break the process and backups can fail silently; and because you are not in the habit of checking them the way you would a manual run, weeks or months can pass before you discover that nothing was being backed up. Until you understand all the moving parts an automated system, keep it simple. The manual approach is the more reliable path.

### 3. Back up resiliently

Keep copies in multiple locations. One backup in the same computer is not a backup; it is a second copy in the same threat environment. A fire, a flood, a theft, a power surge: any of these can take out everything at once. The more copies you have, and the more geographically separated they are, the more resilient your backup system becomes. Two copies in the same building are better than one. Two copies in different cities are better than two in the same building.

Keep at least one copy offline; but aim for more. An online backup is convenient and useful, but any system permanently connected to a network is permanently exposed to network-borne threats. Ransomware, malicious actors, and cloud service failures are all real risks. An offline copy, a drive disconnected from any network when not in use, is immune to these threats.
The offline copy is your last line of defence.

### 5. Back up honourably

Do not delete old backups.
The instinct to prune old backups to save space is understandable but dangerous.
Damage is not always immediately visible.
A virus can quietly corrupt hundreds of files over weeks or months before you notice.
By the time you discover the problem, your most recent backups may already contain the corrupted versions.
An older backup may be the only path back to clean data.
Keep old backups as long as storage allows.

### 5. Backup cautiously

Test your backups regularly. Belief in your backups is not the same as having backups that work. A drive can fail silently. A backup process can produce incomplete or corrupted archives without any obvious error. A restoration tool can behave differently under pressure than it does during a casual test. Go through the full recovery process periodically, not just the backup step but the restore step. Sit down, simulate a failure, and confirm that you can actually get your data back. A broken backup is to have no backups at all. And you don't want to discover that in a crisis.

## Executing the plan

With the principles in mind, you're now better equipped to build.

### 1. Sort your data

Before you can protect your data, you need to know what you have. Make a list of every dataset in your care. Losing your baby photographs and your client database is a different matter entirely from losing your messaging-app history, and the differences decide how each kind should be handled. 

Ask three questions of it. First, how much harm would it do if it were disclosed? Your identity documents, financial records, and medical files are among the most sensitive things you own. What you read, what you write, and who you write to can sometimes reveal more about you than a formal record, and data you hold about other people is more sensitive still, because the harm of exposing it is not yours to discount.
This question decides how carefully a thing is locked and where you are willing to keep it.

Second, how badly would you be hurt if it were lost, and could you ever get it back? Your photographs, your notes, and your letters exist nowhere else; lose them and they are gone. A film collection or your installed software can be downloaded again. The data that needs the most copies, kept in the most places, is the kind you could never recover, not simply the kind you use most. The question sorts your data into three tiers:  
- `High`: data you could never recover and whose loss would be devastating and irreversible; the photographs, records, and work that exist nowhere else.  
- `Medium`: data whose loss would be costly and disruptive but survivable with real effort.  
- `Low`: data whose loss would be a minor inconvenience, including anything you could simply download or reinstall. If you have storage constraints, movies or music files, however much you enjoy it and however often you open it, usually falls in this category, not because it does not matter to you but because losing it costs you a download, not the thing itself.

Third, how often does it change? Files made once and rarely touched -- scanned certificates, old photographs, etc. -- need backing up once and then only protecting; saved correctly, they stay saved. Files you change constantly, working notes, project documents, client files, are harder, because any copy may already be out of date, and a copy of a working file is only useful if the original is sound. This question decides how often a backup runs and how much past history you keep.

The three axes are independent: a thing can be highly sensitive yet easy to replace, or irreplaceable yet harmless if seen. So answer all three rather than collapsing them into one.

Be thorough. It is easy to account for obvious items like project files and photographs, but easy to overlook others: browser bookmarks, application settings, data stored inside cloud services, files maintained by employees or collaborators, and licence keys. These are often the hardest things to reconstruct precisely because they live inside systems rather than in visible folders. Mobile devices are a commonly missed category. Phones hold contacts, messages, photographs, authenticator apps, and application data that most people never think of as data requiring a backup plan. A lost or destroyed phone without a backup can mean losing irreplaceable conversations, years of photos, and the very two-factor codes needed to access accounts on the replacement device. Include your phone in your inventory and make sure it has a backup path.

Do all of this for whole groups of files, not file by file. You are sorting your life into a handful of boxes, not labelling every sheet of paper inside them. Give each box the care its most demanding contents need, and split a box in two only when one part of it genuinely needs different treatment from the rest. You do not need to get this perfect, and you can change it later; a rough sorting you actually finish is worth far more than a flawless scheme you never start.

### 2. Take note of the special category

The one category sits outside the three axes entirely. Your keys and secrets, SSH and GPG keys, two-factor seeds, wallet phrases, are not ordinary data that you merely lose or reveal; they are the keys to everything else. A leak cannot be undone and a loss has no recovery path, so they are kept and protected separately, offline, with more care than any other data you own.

### 3. Make folders

Once your list is made and each group has its three answers, you can turn those answers into something practical: a small set of folders. Do not try to make a folder for all three questions at once. A file can live in only one folder, the same way a sheet of paper can sit in only one box, so trying to sort by sensitivity and value and change all at the same time only ties you in knots. You pick one question to build your folders around, and you let the other two become simple decisions you make about each folder rather than more folders inside it.

The simplest structure is to make folders around the second question (could I get this back if I lost it?) gives you the simplest structure: that gives you three folders at the top level. One holds the things that are truly yours and exist nowhere else, your photographs, documents, notes, and letters; inside it you will still keep your ordinary everyday folders, and the box simply keeps the irreplaceable things together so they are easy to protect well. A second holds the things you could download or reinstall, your films, music, software, and books. And a third, kept separately and with the most care, holds your keys and secrets, for the reasons above. That is the whole structure.

If you've picked the simplest structure, the other two questions do not become folders; they become two decisions you make about each folder you have just made.

The first decision is how carefully to lock it, and where you are willing to keep it. Your most sensitive material, financial records, medical files, anything concerning other people, anything that would do real harm if a stranger read it, gets the strongest protection, and the most sensitive of it is also what you should be least willing to hand to a custodian you do not control. If only part of a folder is that sensitive, you can give that part its own protected sub-folder rather than over-protecting everything else. The rest can be protected more lightly.

The second decision is how often to back it up. The material you change most, the notes and projects you touch most days, gets backed up most often, because that is where you have the most to lose between one backup and the next. The material that sits still, the photo archive and the scanned certificates you never alter, needs backing up far less often; once it is safely copied, it stays safe. Notice that "how often it changes" never became a folder; it became a schedule.

To see all of this in action, consider an ordinary inventory. Say you have a photo archive, scanned certificates, daily project notes that include client material, a film library, and a wallet seed. The photo archive is the obvious case: irreplaceable, rarely changed, so `High`, protected well, and backed up only now and then. The certificates make the independence of the axes sharp, sitting in that same top tier yet earning the lowest backup frequency you have, because how much something matters and how often it changes are different questions. The film library is the same point from the other side: the thing you open most, yet `Low`, because losing it costs a download, not the thing itself. The project notes exercise all three axes at once, `High` because they are irreplaceable, backed up most often because they change daily, and holding client material so sensitive that it gets its own tightly locked sub-folder rather than over-locking the rest. The wallet seed never enters this scheme at all; it goes to secrets, offline. The result is a layout you could draw on a single sheet:

```text
~/
├── irreplaceable/       # High tier: exists nowhere else
│   ├── photos/          # rarely changes  -> backed up now and then
│   ├── certificates/    # never changes   -> lowest frequency of all
│   └── projects/        # changes daily   -> highest frequency
│       └── clients/     # most sensitive  -> own tightly locked sub-folder
└── replaceable/         # Low tier: re-downloadable, backed up rarely
    ├── films/
    ├── music/
    └── software/

# secrets (wallet seed, SSH/GPG keys) are deliberately NOT on this tree:
# kept offline and separate, protected more carefully than anything here
```

### 4. Pick your storage

You need physical drives that you own and control. Cloud storage is not a substitute. This topic has been addressed in the previous post. As for how many drives do you need, a well-regarded framework for thinking about storage is the 3-2-1 rule: maintain three copies of your important data, stored in at least two different physical locations, with at least one of those copies kept offline. Two external drives stored in different places, combined with a local backup, satisfies this standard. The goal is to ensure that no single event can reach all your copies at once. The best long-term strategy, however, is keep all your backup offline. Strong encryption isn't enough for maximum privacy and security. Where your data resides is also important.

### 5. Choose your backup tool

Research the full landscape when you have a stable, working system; do not let the research phase become an indefinite delay. If you're unsure, pick Borg Backup. Borg runs well on Linux and macOS with no dependency complications, and borgmatic makes scheduling and retention policy straightforward to configure. For more details see [Creating passphrase](./creating-passphrase.md).
