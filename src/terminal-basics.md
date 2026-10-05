# Terminal basics

> - **For:** someone who has never opened a terminal.
> - **Before you start:** nothing.
> - **Reading time:** about 3 minutes.
> - **You end with:** enough commands to follow every guide on this site.

*If you've never used a terminal, here's what you need to know.*

## The terminal

The terminal or CLI (Command Line Interface) is just a text window where you type commands and the computer runs them. You type one line, press <kbd>Enter</kbd>, see what happens, then type the next. That's the whole loop. It's an alternative way of interacting with your computer, instead of clicking buttons in a graphical interface.

## Opening the terminal

**On macOS**, press <kbd>Cmd+Space</kbd> to open Spotlight, type "Terminal", press <kbd>Return</kbd>.

**On Windows**, you'll need Git Bash, which provides a Linux-like terminal. Download the Git for Windows installer from [git-scm.com](https://git-scm.com/) and run it. After installation, search for "Git Bash" in the Start menu. Don't use the regular Windows Command Prompt or PowerShell for this guide; they handle these commands differently and some will fail.

**On Linux** (Ubuntu, Debian, Devuan, most distributions), it's <kbd>Ctrl+Alt+T</kbd>, or find "Terminal" in your applications menu. But if you're on Linux, you likely know that already.

## Getting around

Once the terminal is open, a few commands are enough to get around:

- `pwd` prints the current directory (where you are right now in the file system).
- `ls` lists the files in it.
- `cd Downloads` moves into the Downloads folder.
- `cd ..` moves up one level.
- `cd ~` takes you to your home directory, if you ever get lost.

**Note**: Commands are case-sensitive on Linux, so `Ls` won't work where `ls` does. macOS mostly forgives the case, but type everything lowercase anyway and you'll never meet the difference.

## Working with files

Once you can move around, a handful more commands let you create files, look at them, and tidy up:

- `mkdir notes` makes a new folder called notes.
- `cat notes.txt` prints a file's contents to the screen, which is how you check that a file looks right after you create or edit it.
- `cp a.txt b.txt` copies a file; to copy a whole folder and everything in it, add `-r`, as in `cp -r olddir newdir`.
- `mv notes.txt Downloads/` moves a file into the Downloads folder, and `mv old.txt new.txt` renames it; either way `mv` overwrites the destination without asking, so check the name before you press <kbd>Enter</kbd>.
- `echo hello` prints whatever text you give it, and in guides you'll usually see it used to write a line into a file, which the guide will spell out when it happens.
- `rm a.txt` deletes a file.

**There is no recycle bin in the terminal**, so `rm` is permanent and the file is gone the instant you press <kbd>Enter</kbd>; never run `rm` on something you don't recognise, and be especially careful when it appears next to `sudo` or with `-rf`. The `-r` removes all nested files and subfolders; without it, `rm` can only delete files, not folders. And `-f` means do not ask for confirmation, overriding any warnings.

## Keys that get you unstuck

A few keystrokes make the terminal far less tedious and pull you out of trouble. The <kbd>Tab</kbd> key autocompletes a file or folder name once you've typed enough of it to be unique, and pressing it twice lists the choices when more than one matches. The <kbd>↑</kbd> arrow brings back your previous command so you don't have to retype it, and pressing it again walks further back through your history; the <kbd>↓</kbd> arrow takes you the other way. <kbd>Ctrl+C</kbd> stops a command that's running or stuck and hands you back the prompt. The `clear` command wipes the visible text from your terminal screen, though nothing is actually deleted; your command history is still there (you can scroll up or use the arrow keys).

## Running commands as administrator

Some commands change system-wide settings and need administrator rights, which you get by putting `sudo` in front of the command. The terminal will then ask for your password. The password stays completely invisible as you type it, with no dots or stars to show progress; that's normal and not a frozen screen, so just keep typing and press <kbd>Enter</kbd>.

## Reading multi-line commands

When a command on this site spans multiple lines connected by `\` at the end of each line, that's one long command; paste the whole block at once. When multiple lines look separate, run them one at a time.

That's everything the guides assume. If you came here from another chapter, go back to it; if you're starting fresh, [Whys of backup](./backup-whys.md) is first.