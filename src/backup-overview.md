# Overview

<p class="mdb-subtitle">This is a series for those who have never seriously thought about backup and digital security.</p>

No level of skill can recover data from a failed disk or stolen laptop. Backups give you a second chance. [Whys of backup](./backup-whys.md) makes the case for making backups, keeping offline copies instead of trusting cloud services, Borg backup, and why you must act today and not procrastinate setting up a reliable backup system.

If you're convinced of keeping offline backups and Borg, then jump to [Getting started with Borg](./getting-started-with-borg.md). It explains the core functions of Borg. Even if you plan to level up and use the Borg-simple script, a wrapper to make the backup process a breeze, it's important to know the fundamentals of interacting with Borg.

Once you've grasped the fundamentals, and you have a working backup system that uses Borg to make backups on an external drive, then see [Planning](./backup-planning.md). It covers topics on decisions the tool won't make for you: what actually needs backing up, how many copies and where they live, how long to keep them and how to prune, how often to verify, and how to rehearse a restore so you know the system works before the day it has to.

Then after you've figured out what you want, stop typing backup commands. [Leveling up, Part 1](./leveling-up-1.md) covers setting all of it up once — sources, exclusions, retention, verification — in a config you write once and rarely touch again, and then you backup with a single command from then on. Backups that require multiple steps eventually tend to be done carelessly. The aim is to spend an hour now so you can spend seconds later. [Leveling up, Part 2](./leveling-up-2.md) covers how you can beef up your security by using GPG, so your passphrase aren't sitting in plain-text.    
