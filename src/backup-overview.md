# Overview

<p class="mdb-subtitle">This is a series for those who have never seriously thought about backup and digital security.</p>

Backups give you a second chance. If a copy doesn't exist when the disk fails or laptop stolen, no amount of skill can recover it. [Why make backups](./backup-whys.md) makes the case for backing up, keeping offline copies instead of trusting cloud services, using Borg, and why you mustn't procrastinate setting up a reliable backup system.

If you're convinced of Borg, then [Getting started with Borg](./getting-started-with-borg.md) explains how to use Borg.
Even if you plan to use the Borg-simple script, a wrapper to make the backup process a breeze, it's important to know the fundamentals of interacting with Borg.

If you plan to upgrade your backup system -- from a simple bring-all-your-data-into-one-place and backup using Borg on an external drive, to a sophisticated well-thought-out system, then see [Planning for leveling up](./backup-planning.md); it covers topics on decisions the tool won't make for you: what actually needs backing up, how many copies and where they live, how long to keep them and how to prune, how often to verify, and how to rehearse a restore so you know the system works before the day it has to.

Once you know what you want, stop typing it out by hand. [Leveling up, Part 1](./leveling-up-1.md) covers setting all of it up once — sources, exclusions, retention, verification — in a config you write on day one and rarely touch again, driven by a single command from then on. Backups you have to remember to do carefully are backups you'll eventually do carelessly. The aim is to spend an hour now so that this costs you nothing later. [Leveling up, Part 2](./leveling-up-2.md) covers how you can beef up your security by using GPG, so your passphrase is not in plain-text.    
