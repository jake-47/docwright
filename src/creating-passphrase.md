# Creating passphrases

A few passphrases in your life must not reside in a password manager: the passphrase that unlocks your GPG key and with it your password store, and the passphrase on a backup repository, the passphrase that decrypts your disk at boot.
Each must exist before the tooling that depends on it, each must be reproducible by you from paper or memory, and each is unrecoverable by design if lost.
Every other password you ever need should come from a generator inside your manager; this document is only for the few that cannot.
This is the home for creating such a passphrase and keeping it; the tools that consume them live in their own documents, `using-pass.md` for the password store, `choosing-backup-tools.md` for backups, `devuan-secure-workstation.md` for the disk.

## The stakes, stated plainly

That passphrase is not a small detail; it is the key to everything behind it.
If you lose it, what it protects is as inaccessible as if it did not exist.
No vendor can reset it and no support line can recover it, and that absence of a recovery path is precisely what makes the encryption worth having.

## Write it on paper

Not in a password manager, not in a note on your phone, not in a document on your computer.
Write it on paper.
Make more than one copy.
Store each copy somewhere it would not be found by a casual intruder but would be found by someone who needed it urgently: a sealed envelope in a filing cabinet, a safe-deposit box, a trusted family member's home.
Do not photograph it.
Do not type it into any electronic device for the purpose of storage.

This is exactly how hardware Bitcoin wallets work.
When you set up a hardware wallet, it generates a list of 12 or 24 random words, your seed phrase, and asks you to write them down on paper.
That piece of paper is the only backup of your funds.
It has no remote attack surface.
The security model is entirely physical, which is a trade-off: you are immune to remote attackers and you are vulnerable to fire, flood, and theft.
People who take this seriously make multiple copies and store them in separate locations.
The same logic applies here.

## Do not invent the passphrase yourself

We humans reach for patterns without realising it.
Use Diceware, a method developed in 1995 that lets genuine randomness pick words from a curated list and string them together.
The result looks like this: `verso droopy flair unmasked shrimp oncoming`.
Strange, memorable, and effectively impossible to guess.
There are three ways to run it, in descending order of strength.

## The easy way: let software roll for you

The simplest route is a generator that picks the words for you from the EFF list using your operating system's randomness.
On Devuan or any Debian-based Linux, install it and run it:

```bash
sudo apt install diceware && diceware
```

On Windows or macOS, install Python and then the same tool:

```bash
pip install diceware && diceware
```

KeePassXC's built-in password generator also has a passphrase mode that does the same job through a graphical interface on all three systems.
Six words is the default.
This is fine for almost everyone, with one caveat worth stating plainly: the phrase is generated inside your computer, so you are trusting that the machine's random number generator is sound and that nothing on the machine is watching.

## The strong way: roll the dice yourself

If you would rather trust nothing but physics, generate the phrase by hand and let the computer see only the finished result.
You need two things: one balanced six-sided die, and the EFF long wordlist printed on paper, which has exactly 7,776 entries, that is 6 to the power of 5, and can be printed from the EFF's site.
That list size is the reason five rolls produce exactly one word with nothing wasted.
Roll the die five times and read the results as a five-digit number, for example 4-2-6-1-3.
Find that number, 42613, in the printed list, and the word beside it is your first word.
Repeat five rolls for each further word.
Six words means thirty rolls and about 77 bits, the same strength the software gives, except now no random number generator and no software stood between the dice and your paper.
One rule does the heavy lifting: write down the word you land on every time, even a dull or awkward one, and never re-roll for a nicer result, because a re-roll is your own preference climbing back in and quietly draining the randomness you are there to collect.
Keep the rolls in order, because the sequence is the number.
This is the method to use if you are treating the passphrase as long-term and high-value, and it is the one to default to.

## The weak fallback: pointing into a dictionary

You may be tempted by an offline method that needs neither dice nor an install: hold a thick dictionary closed, open it blind, and drop a finger on the page, taking the nearest whole word.
This is the weakest of the three and is dominated by the dice method, which is also offline but countable.
The same discipline applies, keep the word you land on rather than flipping to a nicer one, but discipline alone does not save it.
A blind finger lands evenly across the area of the page, not evenly across the list of words, so it leans towards long words on crowded pages and silently skips anything you do not recognise, both of which pull the result back towards the familiar.
The deeper cost is that you cannot measure it.
With dice and a fixed list you can state your strength exactly, six words is about 77 bits, because you know how many results the method could have produced; pointing into a dictionary gives you no such number, because your real strength is set by how your finger behaves, not by how many words the book holds.
A phrase that looks as though it came from a quarter of a million words may carry far less, the way a lottery ticket printed with eight digits is not one in a hundred million if only a hundred thousand were ever sold.
So you are left with no provable floor under your password, which is the one thing dice give you and pointing cannot.
If you use it anyway, draw more words than six, eight or more, and treat the strength as a rough margin rather than a measured one; even then it beats any password you would invent unaided.
If the larger vocabulary is what tempts you, the way to actually collect it is not a finger on a page but a longer numbered wordlist with more dice per word, which is simply Diceware widened, still mechanical and still countable.

## On length and numbers

Six words is genuinely enough for the uses this document serves, and it is worth understanding why rather than taking it on faith.
None of these tools feeds your passphrase to the cipher directly.
Borg derives the actual key with PBKDF2-HMAC-SHA256 over a random per-repository salt, LUKS runs your passphrase through PBKDF2 or Argon2id before a single block of the disk opens, and GnuPG keeps the private key on disk behind its own iterated, salted derivation.
A deliberately slow, salted step like that makes every guess expensive and rules out precomputed tables.
Seventy-seven bits behind a slowdown like that is past the reach of any classical attacker, including one who has stolen the drive and is grinding away offline.
The twelve-words-and-numbers instinct comes from a different world: a Bitcoin seed phrase is a raw key with no such slow step in front of it, guarding a more exposed and higher-value asset, so it has to carry the full 128 bits in the entropy itself.
That is a different scheme, the BIP39 2,048-word list, and its word counts do not transfer here.
As for digits and symbols, skip them: a digit in a position an attacker already expects adds only about three bits, where another whole word adds nearly thirteen, so if you want more margin, add a word.
The one reason to go beyond six is if you keep a copy on a network where it could be harvested and you want insurance against a future quantum attacker, who could roughly halve the effective strength; eight to ten words covers that, and an offline drive already blunts most of that concern.

## One more layer, optional

You can add a word or two of your own that you never type anywhere and that exist only in your memory, laid on top of the generated phrase.
Even someone who obtained the generated words would still be missing the ones only you know.
Then write the whole phrase on paper, as above.

