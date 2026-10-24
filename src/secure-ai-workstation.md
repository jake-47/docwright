# Secure AI Workstation Setup Guide

This guide walks you through building a computer that runs AI chat models entirely by itself, with no internet connection, ever. You will get it assembled, install Linux on it, shut off every way it could reach a network, and run large language models on it with a free program called llama.cpp. Your questions, your documents and the model's answers never leave the machine.

It is written for someone who has never done anything like this: never installed Linux, never used a terminal, never built a computer or set up a home server. If you can use a web browser and follow instructions carefully, you can do this. Every new word is explained the first time it appears, every command is shown exactly, and after every command the guide tells you what you should see, including messages that look alarming but are normal.

Prices are Indian street prices seen between July and October 2026. They will change.

## Contents

0. [Before you start](#0-before-you-start)
1. [Basics](#1-basics)
2. [What this protects against](#2-what-this-protects-against)
3. [Hardware](#3-hardware)
4. [The connected machine](#4-the-connected-machine)
5. [Transfer drives and rules](#5-transfer-drives-and-rules)
6. [Firmware settings](#6-firmware-settings)
7. [Install Devuan](#7-install-devuan)
8. [Cut the network for good](#8-cut-the-network-for-good)
9. [Offline package updates](#9-offline-package-updates)
10. [NVIDIA driver and CUDA](#10-nvidia-driver-and-cuda)
11. [Build llama.cpp](#11-build-llamacpp)
12. [Models](#12-models)
13. [Run it](#13-run-it)
14. [Maintenance](#14-maintenance)
15. [Final checks](#15-final-checks)
16. [Troubleshooting](#16-troubleshooting)
- [Appendix A: Make your own GGUF](#appendix-a-make-your-own-gguf)
- [Appendix B: Transfer log](#appendix-b-transfer-log)
- [Appendix C: Rules card](#appendix-c-rules-card)
- [Appendix D: Qubes OS and Whonix variant](#appendix-d-qubes-os-and-whonix-variant)
- [Appendix E: Offline operation and internet access](#appendix-e-offline-operation-and-internet-access)

## 0. Before you start

### 0.1 What you are building

Two computers and two USB drives:

- **The box** is the new computer you will build. It runs the AI. It never connects to any network: not once, not even for a minute. This is called an *air gap*, because there is a gap of air between the box and every network.
- **The connected machine** is a second, ordinary computer that does have internet. An old laptop is fine. It downloads things for the box.
- **The IN drive** is a USB drive that carries downloads from the connected machine to the box.
- **The OUT drive** is a second USB drive that carries small requests from the box back to the connected machine.

```text
     internet
        |
 connected machine  ---- IN drive ---->  the box
   (old laptop)     <--- OUT drive ----  (no network, ever)
```

Everything the box ever gets, it gets on the IN drive, and the box checks every file before it uses it. Doing those checks properly is most of what this guide teaches.

### 0.2 Is this for you

Be honest with yourself about three things.

- **Time.** For a first-timer, expect two or three weekends: one for buying and assembling the hardware, one for installing Linux and cutting off the network, and one for updates, the NVIDIA driver, llama.cpp and your first model. The longest parts are section 9 (updates without internet) and section 11 (building llama.cpp). They are not hard, but they are long and need care.
- **Patience with detail.** Most steps are typing a command exactly and comparing the result with what the guide shows. A wrong letter usually just gives an error that you can fix. A few steps erase a drive; each of those is marked with a warning. Slow down at those.
- **Money.** About ₹45,000 to ₹60,000 for the computer without the graphics card, plus about ₹1,00,000 for a used RTX 3090 graphics card. Section 3 lists every part.

You do not need to know Linux, programming or networking. You do need a computer you already use for web browsing (Windows, Mac or Linux), a smartphone with a web browser, and an old or cheap used laptop for the connected machine (section 4).

### 0.3 How to use this guide

- **Read the whole guide once before you buy anything.** You do not need to understand every command on the first read. You do need to know what is coming.
- **Then work through it in order.** Each section depends on the ones before it.
- **Keep the guide open on another screen.** The box has no internet, so you cannot open this guide on it. Keep it open on the connected machine or your phone, or print sections 5, 8 and 9, which you will use most.
- **On the box you type every command yourself.** You cannot copy and paste from this guide into the box, because the guide is on a different machine. Most commands are short. On the connected machine you can copy and paste.
- **Check after every command.** The guide shows what you should see. If you see something else, stop and look in section 16 before going on.
- **Do not skip the checks.** They are the security. A box built without them is just a computer without Wi-Fi.

## 1. Basics

This section covers the few things everything else depends on. Read it now, and come back to it whenever a later step uses something you have forgotten.

### 1.1 Words used in this guide

Words specific to this build:

- **The box**: the air-gapped AI computer you are building.
- **The connected machine**: the ordinary internet-connected Linux computer that downloads files for the box (section 4).
- **IN drive**: the USB drive that carries files from the connected machine to the box.
- **OUT drive**: the USB drive that carries files from the box to the connected machine.
- **Crossing**: one trip of one drive from one machine to the other.
- **Phone check**: comparing a fingerprint of a file that the box worked out itself (see *checksum* below) with the one the file's publisher shows on their website, opened on your phone. It is the one check a hacked connected machine cannot fake, because the connected machine is not involved: the box computes one side and your phone shows the other.

General computer words:

- **Linux**: a free operating system, like Windows or macOS. **Devuan** is the version of Linux (a *distribution*) this guide uses. **Debian** is a close relative of Devuan; most things that work on one work on the other.
- **Terminal**: a window where you type commands instead of clicking. Section 1.2 shows how to use one.
- **Command**: one instruction you type into the terminal and run by pressing Enter.
- **Root, sudo**: *root* is the all-powerful administrator account. Putting `sudo` in front of a command runs that one command as root. It asks for your password.
- **File, folder, path**: a *path* is the address of a file or folder, like `/home/john/notes.txt`. Folder names are separated by `/`. The sign `~` is short for your own home folder, so for the user john, `~/notes.txt` and `/home/john/notes.txt` are the same file.
- **Drive, partition, filesystem**: a *drive* is a physical storage device, such as a USB stick or an SSD. A *partition* is a section of a drive. A *filesystem* is the way files are organised inside a partition so that a computer can show them as files and folders. The transfer drives in this guide deliberately have no filesystem (section 5).
- **Mount**: to connect a partition's filesystem so that its files show up in the file manager. Normal computers do this by themselves when you plug in a USB stick. The box never does it.
- **Device name**: Linux names drives like `/dev/sda` or `/dev/sdb` (USB drives and ordinary SSDs) and `/dev/nvme0n1` (the fast kind of internal SSD). Partitions get a number added: `/dev/sdb1` is the first partition on `/dev/sdb`.
- **Firmware, BIOS, UEFI**: the small program built into the motherboard that runs the moment you press the power button, before any operating system. Its setup screen is where you switch hardware on and off (section 6). *BIOS* and *UEFI* are two generations of it, and people use the words interchangeably.
- **Driver, kernel, kernel module**: a *driver* is the software that lets the operating system use a piece of hardware. The *kernel* is the core of Linux. Most Linux drivers are *kernel modules*: pieces that get loaded into the kernel when needed.
- **Package, apt, repository, mirror**: Linux software comes in *packages*. *apt* is the tool that installs them. Normally it downloads them from a *repository*, a large online collection run by Devuan. A *mirror* is a copy of a repository. The box gets its own small offline mirror (section 9).
- **Checksum, hash, SHA256**: a string of letters and numbers calculated from a file's contents, like a fingerprint. Change even one byte of the file and the checksum changes completely. SHA256 is the method used in this guide; its checksums are 64 characters long. If your checksum of a file matches the publisher's, you have exactly the file they published.
- **Signature, key, fingerprint**: a digital *signature* proves who published a file. The publisher signs with their secret *key*, and anyone can check the signature with the matching public key. A key's *fingerprint* is a long code that identifies the key. This guide uses one signature check, in section 7.1.
- **Encryption, passphrase**: an encrypted disk looks like random noise to anyone without the passphrase. You type the passphrase each time the box starts.
- **GPU, VRAM**: the *GPU* is the graphics card, here an NVIDIA RTX 3090. It does the AI work. *VRAM* is the graphics card's own memory, 24 GB on the 3090. The AI model has to fit into it.
- **Model, GGUF, quantization**: a *model* is the AI itself: one big file of numbers, usually 5 to 40 GB. *GGUF* is the file format llama.cpp reads. *Quantization* shrinks a model by storing its numbers less precisely, so that a bigger model fits on the card. Names like `Q4_K_M` say how much it was shrunk (section 12).
- **Source code, compile, build**: *source code* is a program written as text by programmers. *Compiling* or *building* turns it into a program the computer can run. You will build llama.cpp on the box in section 11.
- **Git, commit, tag**: *git* is a tool programmers use to keep the full history of their source code. Each saved state is a *commit*, identified by a 40-character code (its hash). A *tag* is a name given to one commit, such as a release version.
- **Localhost, port**: `127.0.0.1`, also called *localhost*, means "this same computer". A *port* is a numbered door on it. The AI's chat page runs at `127.0.0.1:8080`: door 8080 on the box itself, which nothing outside the box can reach.

### 1.2 Using a terminal

**Opening one.** On Devuan's desktop (it is called Xfce), click Applications at the top left of the screen, then Terminal Emulator. On a computer with a different desktop, search the applications menu for "Terminal".

A window opens with a line ending in `$`, for example:

```text
john@airgap:~$
```

This is the *prompt*. It shows your user name, the computer's name and the folder you are in (`~`, your home folder). It means the terminal is waiting for a command.

**Running a command.** Type it exactly, then press Enter. Spelling, capital letters, spaces and punctuation all matter: `ls -l` and `ls -L` are different commands. When the command finishes, the prompt comes back. Some commands print nothing at all when they succeed. That is normal, and the guide says when to expect it.

**Boxes.** Commands, file contents and expected output all appear in boxes like this one:

```sh
ls ~
```

The sentence before each box says which it is: commands to run, text to type into a file, or output to compare with. Type only what is inside the box. Some viewers show a small label such as `sh` or `text` at the top of a box: never type the label, and never type the `$` of the prompt.

When a box holds several lines, run them one at a time, in order, and check each one. Two kinds of box are exceptions and must go in as one piece: a command spread over several lines with a `\` at the end of each line except the last, and a *loop* that starts with `for` or `while` and ends with `done`. Type those line by line, pressing Enter at the end of each line; the terminal shows `>` at the start of each continuation line until the command is complete. On the connected machine you can paste such a box in one go, as long as it contains no placeholders.

**Copy and paste in a terminal** (connected machine only). Copy from the browser as usual with Ctrl+C. Paste into the terminal with **Ctrl+Shift+V**, not Ctrl+V. Inside a terminal, Ctrl+C does not copy: it stops whatever command is running.

**sudo and your password.** The first time you use `sudo` in a terminal window, it asks:

```text
[sudo] password for john:
```

Type your user password and press Enter. **Nothing appears while you type, not even dots.** That is normal and deliberate. If you mistype, press Enter and it asks again. After that, `sudo` remembers your password for a few minutes in that window.

**Placeholders.** Anything in angle brackets, like `<dev>` or `<date>`, is a placeholder. Replace the whole thing, brackets included, with your own value. For example, if the guide says

```sh
lsblk /dev/<dev>
```

and your drive is `sdb`, you type `lsblk /dev/sdb`. Typing the brackets gives an error such as `syntax error near unexpected token`, which only means a placeholder was not replaced.

The two placeholders you will meet most:

- `<date>` is a folder named after the day of a crossing, for example `2026-11-01`. Every crossing gets its own new folder. For a second crossing on the same day, add a letter: `2026-11-01b`.
- `<stamp>` is the name of the folder that `receive` creates on the box for each crossing (section 8.5). `receive` prints it when it runs, for example `2026-11-01_143502`.

**Useful keys.**

- **Tab** finishes a file or folder name you have started typing. Type `cd ~/airg` and press Tab, and it becomes `cd ~/airgap/` if that folder exists. This saves typing and avoids typos.
- **Up arrow** brings back the previous command, so you can run it again or fix a mistake in it.
- **Ctrl+C** stops a running command.
- **q** quits a command that shows text one page at a time, such as `less`.

**Reading the output.** Real errors usually contain one of these: `error`, `Error`, `E:`, `failed`, `No such file or directory`, `Permission denied` or `command not found`. Warnings, often starting with `W:` or `warning:`, are usually harmless, and the guide tells you which ones to expect. Section 16 lists common errors and what they mean.

**Looking around.** You rarely need these, but they help you look before you act:

- `pwd` prints the folder you are in.
- `ls` lists the files in the current folder; `ls ~/airgap` lists another folder.
- `cd <folder>` moves into a folder. `cd` on its own goes back to your home folder.

### 1.3 Editing a file with nano

Some steps ask you to create or change a text file with *nano*, a simple editor that runs inside the terminal. For example:

```sh
sudo nano /etc/modprobe.d/airgap.conf
```

opens that file, or an empty page if the file does not exist yet. Then:

- Type, and move around with the arrow keys. The mouse does not move the cursor.
- **Save** with **Ctrl+O** (the letter O). nano shows the file name at the bottom of the screen; press **Enter** to confirm it.
- **Exit** with **Ctrl+X**. If you try to exit without saving, nano asks whether to save; press Y, then Enter.
- **Ctrl+K** deletes the whole line the cursor is on.

The list of shortcuts at the bottom of nano's screen writes Ctrl as `^`, so `^O` means Ctrl+O.

When you type a file from this guide, copy every character exactly, including quotes, brackets, `#` signs and spaces. For lines that start with spaces, type the spaces with the space bar, not the Tab key. Lines starting with `#` are comments: notes for people, which the computer ignores.

### 1.4 How to read the rest of this guide

- Each step says which machine it runs on: **(box)** or **(connected machine)**. Do not mix them up.
- A box straight after a `nano` command is the contents of the file you are editing, not commands to run.
- On the connected machine, files going to the box are collected in `~/airgap/in/<date>`, and files coming from the box are unpacked into `~/airgap/out/<date>`.
- On the box, `receive` unpacks each crossing into a new folder under `~/in`, and `send` sends whatever you put in `~/out`. Section 8.5 creates both.
- *Expected* after a command says what a correct result looks like. Where the guide says names will differ, the shape of the output should match even if the details do not.
- References such as "(5.3)" point to a numbered section of this guide.

## 2. What this protects against

This section explains what the air gap does and does not do for you. Read it before you build, because it explains why later sections insist on things that look fussy.

### 2.1 What the air gap stops

With no working network hardware, nothing on the box can send data anywhere, and nothing can reach it over a network. That covers:

- a program or library on the box that quietly reports home, now or after some future update;
- attacks over a network on anything running on the box;
- your prompts, documents and the model's answers leaving over a network.

### 2.2 What it does not stop

- **Harmful files you carry in yourself.** This is the main risk, and model files are the biggest part of it. A model file is a large, complicated data file, and the part of llama.cpp that reads model files had serious security bugs in 2024, 2025 and 2026: a specially crafted file could make it run an attacker's code on the box. The rules in section 5 and the checks in sections 9, 11 and 12 exist to keep bad files out.
- **Data you carry out.** Anything you put on the OUT drive leaves the box. Section 5 limits it to plain text you have read.
- **Someone with their hands on the box.** Disk encryption protects a box that is stolen or seized while switched off: without the passphrase, the disk cannot be read. It does not protect against someone tampering with the box and returning it to you without your noticing.
- **Exotic spying methods** that leak data through fan noise, power use or radio emissions. These only work if malware is already on the box. Keeping malware out is the job of the transfer rules.

### 2.3 Why the transfer rules look the way they do

The gap is only as strong as what crosses it. So most of this guide is about crossings:

- **Software updates are checked against Devuan's signature.** apt on the box refuses any package Devuan did not sign, exactly as it would on a normal computer, whatever happened on the connected machine.
- **llama.cpp and models are checked against their publishers' checksums**, using the phone check, so a file changed on the way is caught.
- **The USB drives carry one sealed bundle, a *tar archive*, instead of a normal filesystem, and the box never mounts them.** The part of Linux that reads filesystems is not built to withstand a deliberately broken one, and a booby-trapped USB stick is a known way to attack a computer. A tar archive is far simpler. The box unpacks it with your ordinary user account, which cannot damage the system, and refuses anything strange inside.

Think of a secure office: visitors never walk in; documents arrive in envelopes through a slot, and every envelope is opened with gloves on, its seal checked, and anything suspicious thrown away.

### 2.4 The connected machine is not trusted

Assume the connected machine could be hacked without your knowing. The checks on the box are designed so that this does not matter, with one gap: a hacked connected machine could hold back updates by handing over old but genuine files. Sections 9.2 and 11.1 show how to catch that. Two things cannot be checked on the box at all, because they are needed before it is set up: the BIOS update and the Devuan installer. You check those with your everyday computer and your phone (6.1 and 7.1), so a hacked connected machine cannot slip you a bad one.

One small exposure remains: when you plug a drive into the box, Linux reads the drive's partition table, and the system briefly examines what is on it, before any of your commands run. That is why the drives hold nothing but one partition with one archive.

### 2.5 Why not just leave the network cable out

A computer on a separate network with no route to the internet gets most of the same privacy with less effort. But one software bug or one configuration mistake can connect it. A physical gap cannot be bridged by software.

## 3. Hardware

You need the parts below. If a word is unfamiliar: the *CPU* is the main processor; the *motherboard* is the board everything plugs into; *RAM* is the working memory; the *PSU* (power supply unit) turns wall power into what the parts need; the *SSD* is the storage drive, here the *NVMe* kind, which plugs straight into the motherboard.

| Part | Choice | Why, and what to watch for | Approx. price |
|---|---|---|---|
| GPU | Used NVIDIA RTX 3090, 24 GB | The card that runs the AI. Its 24 GB of VRAM is what lets it hold mid-sized models. Test it before paying (3.1). It needs 2 or 3 PCIe 8-pin power plugs from the PSU, depending on the model; the Founders Edition (NVIDIA's own design) uses a 12-pin adapter fed by two 8-pin cables. | ₹80,000 to 1,20,000 |
| CPU | AMD Ryzen 5 5600, or any AM4 6-core | Plenty for this job, because the GPU does the heavy work. It has no built-in graphics, so the 3090 also drives the monitor. That costs a few hundred MB of VRAM. | ₹6,500 to 7,500 used |
| Motherboard | B550M without Wi-Fi, for example a Gigabyte B550M DS3H (not the AC version) | It must not have Wi-Fi or Bluetooth built in, because those are radios: the model name must not end in WIFI, AX or AC. A used B550 board may need a BIOS update before it accepts a Ryzen 5000 CPU. Ask the seller to confirm it supports the Ryzen 5600, or have the shop update it (3.2). | ~₹7,500 |
| RAM | 16 GB DDR4 | Enough when the model sits entirely in VRAM. Buy 32 GB only if you plan to run models partly on the CPU. | ₹10,000 to 14,000 (shortage pricing) |
| PSU | 750 W, 80 Plus Gold, ATX | The 3090 draws a lot of power in short bursts, and a weak or cheap PSU makes the box switch itself off under load. Use a separate PCIe 8-pin cable for each power socket on the GPU, not one cable with two plugs on it. Buy 1,000 W now if a second 3090 is likely. | ₹6,000 to 9,500 (1,000 W: ~₹11,000) |
| SSD | 1 TB NVMe | Models are 15 to 40 GB each. | ₹8,700 to 12,000 |
| Case | Good airflow, fits a 3-slot card over 30 cm long | The 3090 is huge, and its memory chips run hot. Check the case's maximum graphics card length against your card's. | ~₹4,000 to 6,000 |
| Monitor, keyboard, mouse | Wired only | Wireless keyboards and mice are radios. | - |
| IN drive | USB 3 flash drive or USB SSD, 128 GB or more | Carries downloads to the box. Big enough for one full-precision 27B model if you use Appendix A. | - |
| OUT drive | Small USB flash drive, 16 to 32 GB | Carries requests out. Pick one that looks clearly different from the IN drive, in colour or shape, so you never mix them up. | - |
| Installer stick | Any USB stick, 8 GB or more | A third, separate stick, for the BIOS update and the Devuan installer. | - |

The box without the GPU costs roughly ₹45,000 to ₹60,000.

Plug the monitor into the graphics card, never into the video sockets on the motherboard. The Ryzen 5 5600 has no built-in graphics, so the motherboard's video sockets do nothing, and a monitor plugged into them stays black.

### 3.1 Buy and test the used 3090

New 3090s are no longer made, so you will buy a used one. Buy face to face, somewhere you can test the card in a working PC before paying, such as the seller's home or a shop. As of October 2026 a fair price is around ₹1,00,000, give or take ₹20,000. Listings near ₹60,000 are usually scams. Never pay in advance for a card you have not tested.

Before you go, download two free tools on your everyday computer and copy them onto a USB stick:

- **memtest_vulkan**, which checks the card's memory, the part that most often fails on used cards. Open `https://github.com/GpuZelenograd/memtest_vulkan`, click Releases on the right, and download the Windows `.exe` and the Linux file whose name ends in `_DesktopLinux_X86_64.tar.xz` (not the one marked AARCH64).
- **HWiNFO** (Windows only), which reads the card's temperatures. Get it from its official site, `https://www.hwinfo.com`.

At the seller's:

1. **Inspect the card.** Look at the gold contacts along the bottom edge, the part that plugs into the motherboard: they should not be bent, scratched through or burnt. Check that no screws are missing, which can mean the card has been opened. Make sure the fans spin when the PC is running.
2. **Run memtest_vulkan on the seller's PC, with the card installed.** On Windows, copy the `.exe` from your stick to the desktop and double-click it. If Windows shows "Windows protected your PC", click More info, then Run anyway. On Linux, copy the Linux file into a folder, open a terminal there, unpack it and run the program:

```sh
tar -xf memtest_vulkan-*_DesktopLinux_X86_64.tar.xz
chmod +x ./memtest_vulkan
./memtest_vulkan
```

`tar -xf` unpacks the archive and prints nothing. `chmod +x` marks the unpacked file as a program that may be run, and the last line runs it.

Expected: a header with the project address and version, the line `To finish testing use Ctrl+C`, then a line naming the card, for example:

```text
1: Bus=0x01:00 DevId=0x2204   24GB NVIDIA GeForce RTX 3090
```

If it names a different card, or does not show `24GB`, it is not testing the 3090: ask the seller why. Then progress lines appear. After about five minutes a good card prints:

```text
Standard 5-minute test PASSed! Just press Ctrl+C unless you plan long test run.
```

The test carries on by itself after that. Press Ctrl+C. It ends with:

```text
memtest_vulkan: no any errors, testing PASSed.
  press any key to continue...
```

The odd grammar is the tool's own. `Standard 5-minute test fail - ERRORS FOUND`, or any line starting with `Error found`, means the card's memory is faulty. Do not buy it, whatever the seller says.

3. **Check the memory temperature** if the seller's PC runs Windows. Start HWiNFO while the test runs (choose "Sensors-only" if it asks) and find "GPU Memory Junction Temperature". Around 105 °C or higher means the card's thermal pads, the soft pads that carry heat away from the memory chips, need replacing. That is a cheap repair at a computer shop, but it is a reason to negotiate the price down.

### 3.2 Getting it assembled

If you have never built a computer, have a shop assemble it. Computer shops on SP Road in Bengaluru, and in the computer markets of most cities, do this for a small fee and test the result. Tell them:

1. Assemble the parts. Connect each power socket on the graphics card with its own separate PCIe cable from the PSU. Check that the PC starts and shows the BIOS setup screen.
2. Update the motherboard's BIOS to the newest version if they can. Otherwise you will do it yourself in section 6.
3. Do not install Windows or any other operating system, and do not connect it to the internet. You will install Devuan yourself.
4. Do not fit any Wi-Fi card or Bluetooth adapter.

When you get it home, check three things before going further:

- the monitor cable goes into the graphics card, not the motherboard;
- the box starts, the fans spin, and pressing Del right after switching on opens the BIOS setup screen (on some boards it is F2);
- the setup screen shows the full 16 GB of RAM and the SSD.

If you would rather build it yourself, follow the installation chapter of the motherboard's manual and a step-by-step video for your exact case. The two classic mistakes with this build are feeding the graphics card from one shared power cable, and plugging the monitor into the motherboard.

## 4. The connected machine

The connected machine is an ordinary Linux computer with internet. It does all the downloading for the box (software updates, llama.cpp and models) and it prepares the USB drives.

It does not need to be trustworthy, and you should not treat it as trustworthy. Everything it hands over gets checked on the box, in ways a hacked connected machine cannot fake. The two exceptions, the BIOS update and the Devuan installer, are checked with your everyday computer and your phone instead (2.4). So an old laptop is perfectly good. Do not use it for anything sensitive, and do not keep anything on it you would mind losing.

### 4.1 Choose one

1. **An old or cheap used laptop with Devuan installed (recommended).** Any laptop from the last ten years with 4 GB of RAM or more will do; a refurbished business laptop such as a ThinkPad costs around ₹10,000 to 15,000. Installing Devuan on it (4.2) is also the best practice you can get for installing it on the box in section 7: the steps are nearly the same, and mistakes on the laptop cost nothing.
2. **A laptop already running Debian.** Debian 13 works with every command in this guide.
3. **A disposable qube on Qubes OS (advanced).** Only if you already use Qubes. See 4.5.

Your everyday Windows or Mac computer will not do: the commands in this guide need Linux.

### 4.2 Install Devuan on the laptop

You will download the Devuan installer on your everyday computer, put it on the installer stick, and install Devuan on the laptop. **This erases everything on the laptop.**

1. **Download.** On your everyday computer, open `https://files.devuan.org/`, go into the folder for the current stable release (`devuan_excalibur/` at the time of writing), then into `installer-iso/`. Download the file whose name ends in `_amd64_desktop.iso` (several GB) and the checksum list, `SHA256SUMS.txt` (older releases call it `SHA256SUMS`).

2. **Check the download.** Open `SHA256SUMS.txt` in a text editor and find the line for your `.iso` file. Then work out the checksum of the file you downloaded:
   - **Windows:** open PowerShell from the Start menu, type `cd Downloads` and press Enter, then run `Get-FileHash <file>.iso -Algorithm SHA256` with the real file name. Windows prints the checksum in capital letters and the list uses small letters; that difference does not matter.
   - **Mac:** open Terminal and run `shasum -a 256 ~/Downloads/<file>.iso` with the real file name.
   - **Linux:** run `sha256sum ~/Downloads/<file>.iso`.

   The two checksums must match in every character. If they do not, delete the file and download it again. A tip for comparing long codes: compare them in groups of eight characters, start to finish. The stronger check with Devuan's signature comes later, in section 7.1, for the box's own installer. For the connected machine, this is enough.

3. **Write the installer stick.** This erases the stick. On Windows, use Rufus (`https://rufus.ie`): pick the stick under Device, click Select and choose the `.iso`, then click Start. If Rufus asks whether to write in ISO image mode or DD image mode, choose DD image mode, even though ISO mode is marked Recommended. If Windows then offers to format the stick, click Cancel. On a Mac (or Windows) you can use balenaEtcher instead (`https://etcher.balena.io`): Flash from file, Select target, Flash. Wait until it says it has finished, then unplug the stick.

4. **Start the laptop from the stick.** Plug the stick into the laptop. Switch it on and immediately press the boot menu key repeatedly. It is usually F12, F9, F11, Esc or Enter; the laptop's start-up screen or manual says which. Pick the USB stick in the menu. If the laptop refuses with a message about security or Secure Boot, open its firmware settings, disable Secure Boot, and try again.

5. **Install.** Follow the steps in section 7.3, with these differences, because this machine is allowed online:
   - At the network step, connect to your Wi-Fi or plug in a network cable, and let the installer set up the network. If it finds no Wi-Fi, use a cable.
   - When asked whether to use a network mirror, answer **Yes**, choose India or a nearby country, and accept the suggested mirror.
   - Encryption is optional on this machine. It is still a good idea.
   - Keep the Xfce desktop. Leave the SSH server unticked.
   - At the partitioning and boot loader steps, pick the laptop's own disk, never the USB stick you are installing from. On many laptops the disk is called `sda` rather than `nvme0n1`; its size matches the laptop's disk.

6. **Log in and update.** Open a terminal (1.2) and run:

```sh
sudo apt update
sudo apt upgrade
```

`apt update` downloads the current list of available software. `apt upgrade` installs newer versions of what you already have.

Expected: lines starting with `Get:` or `Hit:`, then `Reading package lists... Done`. `upgrade` may list packages and ask `Do you want to continue? [Y/n]`; press Enter to accept. There must be no line starting with `E:`; if there is one mentioning a `cdrom`, see section 16. Run these two commands every week or so to keep the laptop up to date.

### 4.3 Install the tools

```sh
sudo apt install curl gnupg git parted dosfstools pipx
```

This installs `curl`, which downloads files from the command line; `gnupg`, which checks signatures; `git`, for llama.cpp's source code; `parted` and `dosfstools`, for preparing USB drives; and `pipx`, for the download tool in 4.4.

Expected: apt lists what it will install and asks `Do you want to continue? [Y/n]`; press Enter. It downloads and installs the packages and returns to the prompt with no line starting with `E:`.

### 4.4 Optional: the Hugging Face download tool

Models come from a website called Hugging Face (section 12). You can download them in the browser, or with a command-line tool called `hf`, which can resume a broken download and is handier for big files. To install it:

```sh
pipx install huggingface_hub
```

Expected: pipx reports the installed package and lists `hf` among the commands now available. If it warns that `~/.local/bin` is not on your PATH, run `pipx ensurepath`, then close the terminal and open a new one.

### 4.5 If your connected machine is a Qubes qube

Use a disposable qube based on a Debian 13 template. Run the `apt` commands in that template, and the `pipx` command in the disposable template itself (usually `default-dvm`), so every new disposable has the tools. Attach the IN or OUT drive to the disposable from the Qubes devices widget. Attach the whole drive (for example `sys-usb:sdb`), not one of its partitions.

## 5. Transfer drives and rules

### 5.1 Rules

These rules are the heart of the air gap. Each one closes a specific hole, so each comes with its reason. The short version: each drive has exactly one writer, and neither drive is ever mounted.

1. **The IN drive is written only by the connected machine.** The box only reads it, with `receive`, which makes the drive read-only first. *Why:* if the box could write to the IN drive, malware on the box could use it to smuggle data out.
2. **The OUT drive is written only by the box, with `send`.** The connected machine only reads it. *Why:* the OUT drive is plugged into the box on every trip, so anything the connected machine wrote onto it would ride back in.
3. **Neither drive carries a filesystem.** Each holds one tar archive, replaced on every crossing. *Why:* a filesystem is complicated to read and a known way to attack a computer (2.3); a tar archive is simple.
4. **Never plug either drive into any other computer, and plug in only the drive the step needs.** *Why:* every extra computer is one more chance for something to get onto the drive.
5. **Only these cross on the IN drive:** Devuan package files fetched as section 9 describes, a llama.cpp release with the web interface archive that belongs to it, GGUF model files, and plain text files (`.txt`) that you wrote yourself, or saved from a web page or document and read through before writing the drive. *Why:* packages are checked by apt, llama.cpp and models by a phone check, and plain text is something you have read yourself. Nothing else can be checked.
6. **Never carry in programs from anywhere else, Python or JavaScript packages, or model files in "pickle" formats** (file names ending in `.bin`, `.pt`, `.pth` or `.ckpt`). *Why:* these can run code the moment they are opened or loaded, and none of them can be checked the way packages are.
7. **Only these cross on the OUT drive:** package requests, which are plain text, and plain text you have already read on screen. *Why:* anything else could carry your data out without your knowing.
8. **Check everything on the box before you use it:** packages through apt, everything else with a phone check. Log every crossing (Appendix B). *Why:* the checks are the security, and the log lets you see later what went in and out.
9. **Never plug a phone into the box, not even to charge it.** *Why:* a phone is a computer with radios and its own internet connection.
10. **Never connect a network cable to the box, not even for five minutes.** *Why:* five minutes is enough for anything hiding on the box to send out everything on it.

### 5.2 Prepare both drives (connected machine)

Do this once for each drive. It erases the drive completely and turns it into a transfer drive: one partition, given a name (a *label*) so both machines can recognise it, with no filesystem.

> **Warning:** choosing the wrong drive here erases it, and there is no undo. If the wrong drive is the laptop's own disk, you erase the laptop. Unplug every other USB drive first, and check the size and model before every command that writes.

1. Plug in the drive, then list all drives:

```sh
lsblk -o NAME,SIZE,MODEL,TRAN,MOUNTPOINTS
```

`lsblk` lists Linux's *block devices*, which means drives and partitions. The rest of the line picks which columns to show.

Expected: one line per drive and per partition. Yours will differ, but it looks something like this:

```text
NAME          SIZE MODEL              TRAN   MOUNTPOINTS
sda         238.5G Samsung SSD 860    sata
├─sda1        512M                           /boot/efi
└─sda2        238G                           /
sdb         117.2G SanDisk 3.2Gen1    usb
└─sdb1      117.2G                           /media/john/SANDISK
```

Here `sda` is the laptop's own disk: it says `sata` and has the system mounted on `/`. `sdb` is the USB drive: it says `usb` and its size matches the drive. The name you need is the drive's, without a number: `sdb`, not `sdb1`. A laptop with an NVMe disk shows its own disk as `nvme0n1`; never pick that one.

If the USB drive's line, or a line under it, shows a mount point such as `/media/john/SANDISK`, the laptop has mounted it. Unmount it, typing the mount point shown on your screen:

```sh
sudo umount /media/john/SANDISK
```

Expected: no output. Run the `lsblk` command again: the drive's MOUNTPOINTS column should now be empty. If it had several partitions, unmount each one that shows a mount point.

In a Qubes qube, the attached drive appears as `xvdi`, with an empty TRAN column.

2. Wipe the old signatures, then create one partition named `AIRGAP-IN`, with no filesystem. Replace `<dev>` with the name you noted, for example `sdb`:

```sh
sudo wipefs -a /dev/<dev>
sudo parted --script /dev/<dev> mklabel gpt mkpart AIRGAP-IN 1MiB 100%
sudo wipefs -a /dev/<dev>1
```

What these do: `wipefs` erases the markers that tell computers what a drive holds, so nothing recognises the old contents. `parted` writes a fresh partition table (`gpt` is the modern type) with one partition named `AIRGAP-IN` covering the whole drive. The second `wipefs` makes sure the new partition carries no leftover filesystem marker.

For the OUT drive, use `AIRGAP-OUT` instead of `AIRGAP-IN`.

Expected: each `wipefs` prints one line per marker it erased, such as `/dev/sdb: 8 bytes were erased at offset 0x00000200 (gpt): 45 46 49 20 50 41 52 54`, or nothing if there was none. The first may also print `calling ioctl to re-read partition table: Success`. `parted` prints nothing, or a line saying you may need to update `/etc/fstab`, which you can ignore. If `wipefs` says the device is busy, something on it is still mounted: go back to step 1.

The laptop's desktop may pop up a message about the drive after this. Close it, and do not click on the drive in the file manager.

3. Check the result:

```sh
lsblk -o NAME,SIZE,FSTYPE,PARTLABEL /dev/<dev>
ls -l /dev/disk/by-partlabel/
```

Expected: the partition has an empty FSTYPE column, meaning no filesystem, and `AIRGAP-IN` (or `AIRGAP-OUT`) in the PARTLABEL column. `ls` shows a link with the same name pointing at the partition, for example `AIRGAP-IN -> ../../sdb1`. That link is how both machines find the drive from now on, whatever name Linux happens to give it.

4. Unplug the drive. Write IN on one drive and OUT on the other with a permanent marker.

### 5.3 Crossings on the connected machine

Every crossing works the same way. The rest of the guide refers to these two procedures as "write the IN drive (5.3)" and "read the OUT drive (5.3)".

**Writing the IN drive.** Put everything for the crossing in the folder `~/airgap/in/<date>`; later sections say what goes there. Give files plain names, using only English letters, digits and ordinary keyboard punctuation: `receive` refuses names with accented letters or special symbols (8.5), so rename such files first. Plug in only the IN drive, wait a few seconds, and run:

```sh
tar -cf - -C ~/airgap/in/<date> . | sudo dd of=/dev/disk/by-partlabel/AIRGAP-IN bs=4M conv=fsync,nocreat status=progress
```

What it does: `tar` packs every file in the folder into one archive and passes it through the `|` sign (a *pipe*, which hands one command's output to the next). `dd` writes the archive straight onto the IN drive's partition, found by its label. `conv=fsync` makes sure every byte is on the drive before the command finishes, and `nocreat` makes `dd` stop with an error if the drive is not plugged in, instead of writing a file by mistake.

Expected: a progress line that updates while it writes, then a short summary whose last line looks like:

```text
<bytes> bytes (<size> MB, <size> MiB) copied, <seconds> s, <speed> MB/s
```

`No such file or directory` means the IN drive is not plugged in, or in Qubes not attached. In a Qubes qube, if that path is missing, use `/dev/xvdi1`, which is the same partition. When the prompt comes back, the data is on the drive. Unplug it (in Qubes, detach it from the qube first).

**Reading the OUT drive.** Plug in only the OUT drive and run:

```sh
mkdir -p ~/airgap/out/<date>
sudo cat /dev/disk/by-partlabel/AIRGAP-OUT | tar -xvf - -C ~/airgap/out/<date>
```

`mkdir -p` creates the folder. The second line reads the archive off the drive and unpacks it into that folder.

Expected: `./` followed by the name of each file as tar unpacks it. Unplug the drive.

The box's side of each crossing uses two small programs, `receive` and `send`, which you create in section 8.5.

## 6. Firmware settings

The firmware is the motherboard's built-in setup program (1.1). In this section you update it, switch off every piece of network hardware on the board, and set a few security options. Do it with the box fully assembled, before installing anything.

**Opening the setup screen.** Switch the box on and immediately press Del repeatedly (on some boards F2) until the setup screen appears. If the box shows something else, such as a message that no bootable device was found, switch it off and try again, pressing the key sooner. Many boards open in a simplified "easy mode" first. Switch to the advanced mode, which has all the settings below: on Gigabyte boards press F2, on ASUS and MSI boards F7; the key is usually shown on screen.

Move with the arrow keys and Enter, and go back with Esc. Nothing changes until you save, usually with F10.

Menu names vary by vendor and BIOS version. The examples below are for Gigabyte boards such as the B550M DS3H. On other brands, look for the same words.

### 6.1 Update the firmware

Update first, while the box is still empty. Updates fix bugs, including security fixes for the CPU, which on AMD desktop boards arrive mainly through BIOS updates. If the shop already updated it to the newest version, skip to 6.2.

1. **Find your exact board model and revision.** Both are printed on the motherboard itself, usually near the graphics card slot, for example `B550M DS3H` and `REV: 1.3`. The setup screen's main page also shows the model and the current BIOS version.

Steps 2 to 4 use your everyday computer, not the connected machine. The box has no way to check a BIOS file, so keep the untrusted machine out of it. Letting the shop do the update (3.2) avoids these steps altogether.

2. **Download the BIOS file (everyday computer).** Open the board vendor's support page for your exact model and revision. For Gigabyte, search for the model on `gigabyte.com`, open Support, then BIOS. Download the newest version. It comes as a `.zip` file. If the page publishes a checksum for it, compare it with your file's checksum as in 4.2 step 2. Then extract the zip: on Windows, right-click it and choose Extract All; on a Mac, double-click it.
3. **Format the installer stick (everyday computer).** Use a stick of 32 GB or smaller. This erases it.
   - **Windows:** plug the stick in, open File Explorer, right-click the stick, choose Format, set File system to FAT32, and click Start. If FAT32 is not offered, the stick is larger than 32 GB: use a smaller one.
   - **Mac:** open Disk Utility, choose View, then Show All Devices, and select the stick itself (the top line for it). Click Erase, choose the format MS-DOS (FAT) and the scheme Master Boot Record, and click Erase.
   - **Linux:** find the stick's device name with `lsblk` as in 5.2, unmount it if it shows a mount point, and run the commands below.

> **Warning:** this erases the stick. Check `<dev>` before you run it.

```sh
sudo wipefs -a /dev/<dev>
sudo parted --script /dev/<dev> mklabel msdos mkpart primary fat32 1MiB 100%
sudo mkfs.vfat -F 32 -n BIOS /dev/<dev>1
```

`wipefs` erases the markers of whatever was on the stick before. `parted` makes one partition. `mkfs.vfat` puts a FAT32 filesystem on it, named `BIOS`, which every motherboard can read.

Expected: `wipefs` prints the markers it erased, as in 5.2. `parted` prints nothing. `mkfs.vfat` prints one line naming `mkfs.fat` and its version.

4. **Copy the BIOS file onto the stick (everyday computer).** On Linux, unplug the stick and plug it back in first, so the file manager shows it. Copy the BIOS file itself onto the stick. For Gigabyte it is the file named after the board with an ending such as `.F18`; the other files in the zip are not needed. Then eject the stick before unplugging it: on Windows, right-click it in File Explorer and choose Eject; on a Mac, click the eject symbol next to it in Finder; on Linux, right-click it in the file manager and choose Eject or Unmount.
5. **Flash it (box).** Plug the stick into the box, open the setup screen, and start the board's update tool: Q-Flash on Gigabyte (press F8, or click Q-Flash), EZ Flash on ASUS, M-Flash on MSI. Choose to update the BIOS from a drive, pick the file on the stick, and confirm. **Do not switch off or reset the box while it flashes.** It can take several minutes and may restart by itself more than once. When it is back at the setup screen, the main page shows the new version.

A BIOS update puts every setting back to its default, so make the changes below after updating, not before.

### 6.2 Switch off the network hardware

1. **Disable the onboard network (LAN) controller.** On Gigabyte: Settings, then IO Ports, then Onboard LAN Controller, set to Disabled. On other boards, look under Advanced, Onboard Devices or Peripherals.
2. **Wi-Fi and Bluetooth.** The recommended board has neither. If yours turns out to have them, disable both here, or better, have a shop remove the small Wi-Fi card from its slot.

### 6.3 Boot and security settings

1. **Disable CSM** (Compatibility Support Module, also called legacy boot), so the board only starts systems the modern UEFI way. On Gigabyte: Boot, then CSM Support, set to Disabled. Then save with F10 and open the setup screen again: on Gigabyte boards, the Secure Boot setting can only be changed once CSM is off.
2. **Disable Secure Boot.** On Gigabyte: Boot, then Secure Boot; set it to Disabled if it is not already. *Why:* with Secure Boot on, Linux refuses to load the NVIDIA driver that the box builds for itself in section 10 unless you go through an extra key-signing procedure. And on Devuan, Secure Boot would not cover the whole start-up anyway, because Debian-family systems do not sign the *initramfs*, a small start-up bundle you will meet in section 8.
3. **Boot order.** Put the internal NVMe drive first. Before Devuan is installed it may not be listed yet; that is fine. You will start the installer stick once, from the one-time boot menu, which most boards open with F12 (Gigabyte) or F11 right after switching on.
4. **Set an administrator password.** On Gigabyte: Boot, then Administrator Password; elsewhere it may be called Supervisor Password. With it set, nobody can change these settings without the password. On Gigabyte, Boot, then Security Option decides when the password is asked: Setup asks only when someone opens the setup screen; System asks at every start, which also stops anyone starting the box from another drive without it. System is the safer choice; it means typing this password at every start, before the encryption passphrase. Write the password down and keep it safe: if you forget it, resetting it means opening the box.
5. **Save and exit** with F10, and confirm.

Expected: the box restarts. Open the setup screen again (it now asks for the administrator password) and check that the LAN controller shows as Disabled.

## 7. Install Devuan

Now you install Devuan on the box, with the whole disk encrypted and no network.

### 7.1 Download and verify the installer (connected machine)

This check matters more than any other in the guide. The installer brings the keys that apt uses to check every package the box will ever install, so a tampered installer could fool every later check. Steps 1 to 4 run on the connected machine: a checksum (is this exactly the published file?) and a signature (did a Devuan developer publish it?), with the signer confirmed on your phone. Step 5 then checks the image again on your everyday computer, so that a hacked connected machine cannot fool you by faking what it shows.

1. **Download four files.** On the connected machine, open `https://files.devuan.org/`, go into the folder for the current stable release (`devuan_excalibur/` at the time of writing), then into `installer-iso/`. Download:
   - the amd64 desktop image, the file whose name ends in `_amd64_desktop.iso`. It is the full image that installs without a network. You can reuse the one from 4.2 if you still have it;
   - the checksum list, named `SHA256SUMS.txt` at the time of writing (older releases call it `SHA256SUMS`);
   - its signature, the same name with `.asc` added.

   Also download `devuan-devs.gpg` from the top level of `https://files.devuan.org/`. It holds the Devuan developers' public keys.

   Put all four files in one folder. Open a terminal in that folder: in the file manager, right-click an empty area inside the folder and choose Open Terminal Here. Run `ls` to see the four files. The commands below use the current file names; adjust them if yours differ.

2. **Check the image against the checksum list.**

```sh
sha256sum --ignore-missing -c SHA256SUMS.txt
```

This works out the checksum of each file in the list that you have, and compares it with the list. `--ignore-missing` skips the many images in the list that you did not download.

Expected:

```text
devuan_excalibur_<version>_amd64_desktop.iso: OK
```

`FAILED` means the download is damaged or altered: delete it and download it again.

3. **Check the signature on the checksum list.** This proves that the list was signed with a Devuan developer's key. Name both files: the signature is a separate file, so gpg needs the list it signs.

```sh
gpg --no-default-keyring --keyring ./devuan-devs.gpg --verify SHA256SUMS.txt.asc SHA256SUMS.txt
```

Expected: lines like these, in this order (names, dates and numbers will differ):

```text
gpg: Signature made <date and time>
gpg:                using RSA key <40 letters and digits>
gpg: Good signature from "<a Devuan developer's name and email>" [unknown]
gpg: WARNING: This key is not certified with a trusted signature!
gpg:          There is no indication that the signature belongs to the owner.
Primary key fingerprint: <ten groups of four characters>
```

The words that matter are `Good signature`. The warning is normal here: gpg only means that you have not personally vouched for this key, which is what the next step does instead. `BAD signature` means stop and do not use these files. If gpg says `no signed data`, you left out the second file name. The first time you use gpg it may also print a line saying it created a folder or a keybox, and there may be lines starting `issuer` or `Subkey fingerprint:`. These are normal; the next step uses the line starting `Primary key fingerprint:`.

4. **Confirm who signed it, on your phone.** The keyring file came from the same website as the image, so a fake website could have supplied a fake key too. Devuan's team page is the independent reference. On your phone, open `https://devuan.org/os/team`. It lists each developer with a key ID: `0x` followed by 16 characters.

   Now take the `Primary key fingerprint` line from step 3. It has ten groups of four characters. The key ID is the **last four groups**, joined together without spaces. For example, if the line were

```text
Primary key fingerprint: 4F21 9A0C 77D3 E58B 2B7A  1C3E 8D44 F0E9 5A21 9C6B
```

   the last four groups are `8D44 F0E9 5A21 9C6B`, so the key ID is `8D44F0E95A219C6B`. (These numbers are made up; yours will differ.) Find your key ID on the team page, after a `0x`. It must match one listed developer exactly, all 16 characters. If it does not, stop and do not install.

5. **Cross-check the image on your everyday computer and your phone.** Steps 2 to 4 ran on the connected machine, and a hacked one could fake what they printed. So check the image a second way, without it:
   - On your everyday computer, use the `.iso` you downloaded there in 4.2. If a newer Devuan release has come out since, download the new one there first. Work out its checksum as in 4.2 step 2.
   - On your phone, open `https://files.devuan.org/`, go into the same release folder, then `installer-iso/`, and open `SHA256SUMS.txt`. Find the line for the same `.iso` file name.
   - The two checksums must match in every character. If they do not, stop.

   You will write the box's installer stick from this same file, on the everyday computer (7.2), so the connected machine never touches what the box installs.

### 7.2 Write the installer stick (everyday computer)

Write the `.iso` you checked in 7.1 step 5 onto the installer stick, on your everyday computer, exactly as in 4.2 step 3: Rufus in DD image mode on Windows, or balenaEtcher, which also checks the stick after writing it. This erases the stick, including the BIOS file on it.

If your everyday computer runs Linux, you can use `dd` instead. Open a terminal in the folder that holds the `.iso` (press Tab to complete its long name), find the stick's device name with `lsblk` as in 5.2, and unmount it if it shows a mount point.

> **Warning:** this erases the stick. Check `<dev>` before you run it.

```sh
sudo dd if=<image>.iso of=/dev/<dev> bs=4M status=progress conv=fsync
```

`if=` is the input file, the installer image. `of=` is the output: the whole stick, so use the drive's name without a number (`sdb`, not `sdb1`).

Expected: a progress line that updates as it writes, then a short summary whose last line looks like:

```text
<bytes> bytes (<size> GB, <size> GiB) copied, <seconds> s, <speed> MB/s
```

When it has finished, unplug the stick.

### 7.3 Install

The installer asks a series of questions, one screen at a time. Answer as below. Continue moves on and Go Back undoes a step. If a screen appears that is not listed here, its default answer is fine.

1. Plug the stick into the box, switch on, and press the one-time boot menu key (F12 on Gigabyte) repeatedly. If the box asks for a password first, type the administrator password from 6.3. Pick the entry for the stick that starts with `UEFI:`, for example `UEFI: SanDisk`.
2. Choose `Graphical install`.
3. Choose your language, location and keyboard layout. Choosing India as the location sets the clock to Indian time.
4. **Network:** the installer says it found no network interfaces, because you disabled the LAN. This is expected. Continue. If it does find one, choose "Do not configure the network at this time".
5. **Hostname:** the computer's name. Anything works, for example `airgap`. Leave the domain name empty.
6. **Root password:** leave both fields empty and continue. The installer then lets your own user account use `sudo` (1.1) instead of having a separate root password.
7. **User account:** enter your full name, a short user name in lower case (for example `john`), and a password. You will use this password to log in and for `sudo`, so choose one you can type reliably.
8. **Partitioning,** which divides up and encrypts the disk:
   - Choose "Guided - use entire disk and set up encrypted LVM". *Encrypted LVM* means the whole disk is encrypted, with the system's partitions inside the encrypted part.
   - Pick the NVMe drive. It has `nvme` in its name and the size of your SSD.
   - Choose "All files in one partition".
   - Confirm writing the changes and configuring LVM with Yes.
   - The installer then starts overwriting the disk with random data. On a new SSD you can press Cancel: it takes hours and adds little on an SSD.
   - Enter the encryption passphrase, twice. Use six or more random words, for example picked by opening a dictionary at random. You will type it every time the box starts. **If you lose it, everything on the box is gone for good;** nobody can recover it. Write it down and keep it somewhere safe, away from the box.
   - Keep the suggested amount of the disk to use, which is all of it.
   - On the summary screen, choose to finish partitioning and write the changes to disk, then confirm with Yes.
9. If asked to scan more installation media, answer No.
10. When asked whether to use a network mirror, answer No. A warning that the installation may be incomplete is expected: everything the box needs to start is on the stick, and the rest arrives later through section 9.
11. **Software selection:** keep the Devuan desktop environment, Xfce and the standard system utilities. Untick SSH server, which would let other computers log in over a network, and print server if it is listed.
12. If asked to choose an *init system*, the program that starts everything else, keep sysvinit.
13. **Boot loader:** install the GRUB boot loader, the program that starts Devuan, on the NVMe drive. If asked whether to force GRUB installation to the EFI removable media path, answer Yes. That puts a second copy of the boot loader where every motherboard looks by default, so the box still starts if a later BIOS update forgets Devuan's boot entry.
14. When told, remove the stick and let the box restart.

Expected: before the desktop starts, a text prompt asks for the passphrase, for example:

```text
Please unlock disk nvme0n1p3_crypt:
```

Type the encryption passphrase and press Enter. As with sudo, nothing appears while you type. Then the graphical login screen appears. Log in with your user name and password.

### 7.4 Check the encryption

Open a terminal (1.2) and run:

```sh
lsblk -o NAME,FSTYPE,FSVER,MOUNTPOINTS
```

Expected: the largest NVMe partition shows `crypto_LUKS` (LUKS is Linux's disk encryption), and the part mounted on `/`, which is the system itself, sits inside it. Names will differ, but the shape looks like this:

```text
nvme0n1
├─nvme0n1p1                vfat         FAT32    /boot/efi
├─nvme0n1p2                ext4         1.0      /boot
└─nvme0n1p3                crypto_LUKS  2
  └─nvme0n1p3_crypt        LVM2_member  LVM2 001
    ├─airgap--vg-root      ext4         1.0      /
    └─airgap--vg-swap_1    swap         1        [SWAP]
```

The indentation shows what is inside what: the encrypted partition holds the LVM area, which holds `root`, mounted on `/`, and `swap`. The `2` after `crypto_LUKS` is the LUKS version. If `/` is not under a `crypto_LUKS` entry, the disk is not encrypted: install again.

## 8. Cut the network for good

You disabled the network hardware in the firmware. This section makes sure that, even if a network device were somehow switched back on or plugged in, Linux could not use it. Then it sets up the two small programs that handle every crossing.

From here on, everything happens on the box unless a step says otherwise.

### 8.1 See what network hardware is visible

```sh
lspci -k | grep -i -A3 -E 'ethernet|network'
lsusb
```

`lspci -k` lists the hardware on the motherboard and the driver each piece uses; `grep` keeps only network devices and the three lines after each. `lsusb` lists the USB devices.

Expected: with the LAN disabled in the firmware, the first command prints nothing. If it prints a controller, note the name after `Kernel driver in use:`, for example `r8169`; you need it in 8.2. `lsusb` should list your keyboard, your mouse and lines mentioning "root hub". It may also list the motherboard's lighting controller, often named ITE or Integrated Technology Express. Anything mentioning Bluetooth, Wireless or WLAN is not normal: go back to 6.2. If `lsusb` says `command not found`, run `grep -H . /sys/bus/usb/devices/*/product` instead, which lists the same devices by name.

### 8.2 Block network and Bluetooth drivers

This tells Linux never to load the drivers for network and Bluetooth hardware, so such hardware could not work even if it were present.

```sh
sudo nano /etc/modprobe.d/airgap.conf
```

Type in the following. If 8.1 showed a driver that is not in this list, add a `blacklist` line and an `install` line for it too, in the same pattern.

```text
# A "blacklist" line stops a driver loading automatically.
# An "install <name> /bin/false" line makes every attempt to load it fail.

# Onboard Ethernet
blacklist r8169
install r8169 /bin/false
blacklist igc
install igc /bin/false
blacklist e1000e
install e1000e /bin/false

# USB Ethernet adapters and phone tethering
install usbnet /bin/false
install r8152 /bin/false
install lan78xx /bin/false
install ipheth /bin/false

# Every Wi-Fi driver needs cfg80211
install cfg80211 /bin/false

# Bluetooth
install bluetooth /bin/false
```

The `<name>` in the second comment line is part of the comment; type it as shown.

Save with Ctrl+O and Enter, then exit with Ctrl+X.

Linux loads a small start-up bundle called the *initramfs* at the very beginning, before it unlocks the disk. Rebuild it so the rules apply there too:

```sh
sudo update-initramfs -u
```

Expected:

```text
update-initramfs: Generating /boot/initrd.img-<kernel version>-amd64
```

Restart the box: click Applications, then Log Out, then Restart. Or run `sudo reboot`. Every restart asks for the encryption passphrase.

### 8.3 Remove network services

Some programs installed by default exist only to manage network connections, or to offer services over a network. Remove them.

```sh
dpkg -l | grep -E 'network-manager|connman|wpasupplicant|bluez|avahi-daemon|openssh-server|cups-daemon'
```

`dpkg -l` lists every installed package, and `grep` keeps the ones named. In order, these manage network connections (`network-manager`, `connman`), log in to Wi-Fi (`wpasupplicant`), run Bluetooth (`bluez`), announce the computer on a network (`avahi-daemon`), allow remote logins (`openssh-server`) and run the printing service, which also listens on the network (`cups-daemon`).

Expected: one line starting with `ii` (meaning installed) for each of these that is installed, for example:

```text
ii  network-manager    <version>    amd64    network management framework (daemon and userspace tools)
```

Remove the ones it lists, by name, separated by spaces:

```sh
sudo apt-get purge <package names from the list>
```

Expected: apt-get lists the packages it will remove under `The following packages will be REMOVED:` and asks `Do you want to continue? [Y/n]`. **Read the list before answering.** It may include extra packages that depend on the ones you named. Packages whose names start with `task-` (bundles that pulled in the desktop) and tray icons such as `network-manager-gnome` can go. If the list includes `xfce4` or `xorg`, answer `n`: that would remove the desktop. Then purge the packages one at a time instead, and skip the one whose removal list includes `xfce4` or `xorg`. Otherwise answer `y`. It finishes after lines starting with `Removing` and `Purging configuration files`.

From now on, apt may suggest running `apt autoremove`. **Never run it on this box:** with the `task-` packages gone, it would remove most of the desktop.

### 8.4 Turn off automounting

The transfer drives hold no filesystem. But the connected machine writes them, and a hacked one could add a partition with a filesystem under any name. So the desktop must never mount anything by itself, and USB drives should not even appear in the file manager. The box never needs to mount a USB drive.

1. Click Applications, then Settings, then Removable Drives and Media. On the Storage tab, untick "Mount removable drives when hot-plugged" and "Mount removable media when inserted". Close the window.

2. Hide all USB drives from the desktop. *udev* is the part of Linux that reacts when you plug in hardware; this rule tells it to mark every USB drive as one the desktop must ignore.

```sh
sudo nano /etc/udev/rules.d/90-airgap.rules
```

Type:

```text
# Hide every USB drive from the desktop, so nothing on one can be mounted with a click.
SUBSYSTEM=="block", ENV{ID_BUS}=="usb", ENV{UDISKS_IGNORE}="1"
```

Note the double `==` in the first two parts and the single `=` in the last; they mean different things. Save and exit, then load the rule:

```sh
sudo udevadm control --reload
```

Expected: no output.

3. Check by plugging in the IN drive:

```sh
lsblk -o NAME,FSTYPE,PARTLABEL,MOUNTPOINTS
```

Expected: the drive's partition shows `AIRGAP-IN` in the PARTLABEL column and nothing in the FSTYPE and MOUNTPOINTS columns. No file manager window opens, and the drive does not appear in the file manager's side panel. Unplug the drive.

### 8.5 Transfer helpers

Two short programs, called *scripts*, handle the box's side of every crossing:

- **`receive`** makes the IN drive read-only, so nothing on the box can write to it, then unpacks its archive into a new folder under `~/in`, using your ordinary account rather than root. It keeps nothing at all if tar reports any problem, or if the archive holds anything other than plain files and folders with plain names: no links, no device files, no names that point outside the folder, and no names with anything other than plain English letters, digits and keyboard punctuation. It gives the unpacked files the box's own date and time, so the two machines' clocks do not need to agree.
- **`send`** packs whatever is in `~/out` into one archive, writes it to the OUT drive, and then moves the files to a dated folder under `~/sent`, so you always have a record of exactly what left the box.

You create them by typing them into nano. This is the longest typing job in the guide: allow 20 minutes, and type carefully. The scripts go in `/usr/local/bin`, the folder for programs you add yourself; anything there can be run by name from any folder.

Typing tips:

- Copy every character exactly. Pay special attention to the difference between `(` and `{`, between `'` and `"`, and to spaces around `[` and `]`.
- Indented lines start with four spaces. Type them with the space bar, not the Tab key.
- The line ending in a single `\` continues on the next line. Type the `\`, press Enter, then type the four spaces and the rest.
- Do not leave empty lines at the end.

Create the first script:

```sh
sudo nano /usr/local/bin/receive
```

Type this, then save and exit:

```sh
#!/bin/sh
# Unpack the archive on the IN drive into a new folder under ~/in.
# The drive is made read-only first and is never mounted.
set -eu
link=/dev/disk/by-partlabel/AIRGAP-IN
[ -e "$link" ] || { echo "IN drive not found" >&2; exit 1; }
part=$(readlink -f "$link")
disk=/dev/$(lsblk -no PKNAME "$part")
sudo blockdev --setro "$disk"
sudo blockdev --setro "$part"
mkdir -p "$HOME/in"
dest="$HOME/in/$(date +%Y-%m-%d_%H%M%S)"
mkdir "$dest"
log="$dest.log"
reject() {
    chmod -R u+rwX "$dest" 2>/dev/null || true
    rm -rf "$dest"
    echo "Nothing was kept: $1" >&2
    cat -v "$log" >&2
    rm -f "$log"
    exit 1
}
sudo cat "$part" | tar -x -m -f - -C "$dest" 2>"$log" || reject "tar could not unpack the archive."
if [ -s "$log" ]; then
    reject "tar printed warnings, which a clean archive never causes."
fi
chmod -R u+rwX "$dest"
LC_ALL=C find "$dest" ! -type d \( ! -type f -o -links +1 \) -o -name '*[![:print:]]*' >"$log" 2>&1 \
    || echo "find failed" >>"$log"
if [ -s "$log" ]; then
    reject "the archive holds links, special files or unprintable names:"
fi
rm -f "$log"
echo "Received into $dest:"
cd "$dest"
find . -type f | sed 's|^\./||' | sort
```

Check your typing in two ways. First, ask the shell to read the script for mistakes without running it:

```sh
sh -n /usr/local/bin/receive
```

Expected: no output. If it prints an error, it names a line number. Open the file again with `sudo nano /usr/local/bin/receive`, find that line (press Ctrl+C in nano to see which line the cursor is on), and compare it, and the lines just before it, with the guide.

Then compare the file's checksum with the one below. It matches only if every character is exactly as printed here, including the four spaces at the start of indented lines:

```sh
sha256sum /usr/local/bin/receive
```

Expected:

```text
1f583779c2dda69df988e93e73b6cac39733418650781a0e096c982bb520282a  /usr/local/bin/receive
```

If the checksum differs, at least one character differs. Usual causes: a missing or extra quote mark, `(` instead of `{`, a missing space, a Tab instead of four spaces, or an empty line at the end. Compare line by line until it matches. A script that passes `sh -n` can still contain a mistake that changes what it does, so do not settle for a different checksum.

Create the second script:

```sh
sudo nano /usr/local/bin/send
```

Type this, then save and exit:

```sh
#!/bin/sh
# Write everything in ~/out to the OUT drive as one tar archive,
# then move it to ~/sent as a record of what left the box.
set -eu
link=/dev/disk/by-partlabel/AIRGAP-OUT
[ -e "$link" ] || { echo "OUT drive not found" >&2; exit 1; }
part=$(readlink -f "$link")
cd "$HOME/out"
[ -n "$(ls -A)" ] || { echo "Nothing to send: ~/out is empty" >&2; exit 1; }
archive=$(mktemp "$HOME/.send-XXXXXX")
trap 'rm -f "$archive"' EXIT
tar -c -f "$archive" .
sudo dd if="$archive" of="$part" bs=4M conv=fsync,nocreat status=none
record="$HOME/sent/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$record"
find . -mindepth 1 -maxdepth 1 -exec mv -t "$record" {} +
echo "Sent. Moved to $record:"
ls -l "$record"
```

Check it the same way:

```sh
sh -n /usr/local/bin/send
sha256sum /usr/local/bin/send
```

Expected: `sh -n` prints nothing, and `sha256sum` prints:

```text
200454ec08fc6e7cc22ed7dcf5fb8d7b0d62dc7c4fb6c849e42a4a0aa2af1264  /usr/local/bin/send
```

Make both scripts runnable, and create the folder for outgoing files:

```sh
sudo chmod 755 /usr/local/bin/receive /usr/local/bin/send
mkdir -p ~/out
```

`chmod 755` lets every user run the scripts while only root can change them.

Expected: no output.

How to use them:

- Run `receive` and `send` as yourself, without `sudo` in front. They ask for your password when they need root to read or write the drive itself.
- Unplug each drive as soon as `receive` or `send` has finished.
- If `receive` prints `Nothing was kept`, the archive failed a check, and the lines after it show what failed. If they show a file name containing `M-` sequences, that name has accented letters or special symbols: rename the file on the connected machine and write the IN drive again. Otherwise just write the IN drive again. If it happens twice with plain names, stop trusting the connected machine.
- Text that came off the IN drive can contain hidden control characters that change what the terminal displays. Read such files with `cat -v` or `less`, never with plain `cat`.

**Test both with a first crossing.** On the connected machine:

```sh
mkdir -p ~/airgap/in/<date>
echo "first crossing" > ~/airgap/in/<date>/hello.txt
```

`echo` prints the text, and `>` sends it into a new file instead of the screen.

Expected: no output. Write the IN drive (5.3). Then plug it into the box and run:

```sh
receive
cat -v ~/in/<stamp>/hello.txt
sudo blockdev --getro /dev/disk/by-partlabel/AIRGAP-IN
```

Expected: `receive` prints `Received into /home/<you>/in/<stamp>:` followed by `hello.txt`. That line tells you the `<stamp>` to use in the next command. `cat -v` prints `first crossing`. `blockdev` prints `1`, meaning Linux now refuses to write to the drive. Unplug it.

Now the other direction. Plug the OUT drive into the box:

```sh
echo "reply from the box" > ~/out/reply.txt
send
```

Expected: `Sent. Moved to /home/<you>/sent/<stamp>:` followed by a listing that shows `reply.txt`. Unplug the drive and read it on the connected machine (5.3). Expected there: `./` and `./reply.txt`. Open the file with `cat -v ~/airgap/out/<date>/reply.txt` to see the text.

Both directions work. Every later crossing uses these same steps.

### 8.6 Check

```sh
ip -br link
lsmod | grep -E '^(r8169|igc|e1000e|usbnet|r8152|lan78xx|ipheth|cfg80211|bluetooth) '
```

`ip -br link` lists every network interface Linux knows about. `lsmod` lists the loaded drivers, and `grep` looks for the blocked ones.

Expected: `ip` prints exactly one line, for the *loopback* interface, which is the computer talking to itself and is always there:

```text
lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>
```

`lsmod | grep` prints nothing. If `ip` shows any other line, a network device is still active: check the firmware setting (6.2) and the driver list (8.2).

## 9. Offline package updates

On a normal computer, apt downloads two things from Devuan's servers: the *package lists*, a catalogue of every package available, signed by Devuan; and then the packages you choose. Every package's checksum is in the signed lists, so apt can check each package it downloads.

The box does exactly the same, except that its "server" is a folder on its own disk, `/srv/mirror`, laid out exactly like Devuan's real archive at `deb.devuan.org`. The connected machine downloads files into the same layout, and the IN drive carries them across. apt on the box then checks Devuan's signature on the lists and the checksum of every package, exactly as it would online. So a damaged or tampered file is refused, whatever happened on the connected machine.

There are two kinds of round:

- A **lists round** brings a fresh catalogue. It takes one crossing.
- A **packages round** brings the packages the box asks for. It takes two crossings: the box writes a shopping list of the exact files it needs, which goes out on the OUT drive; the connected machine downloads exactly those files, and they come back on the IN drive.

```text
Lists round (one crossing)
  connected machine: download lists   --- IN --->   box: receive, copy into mirror, apt-get update

Packages round (two crossings)
  box: write the shopping list        --- OUT -->   connected machine: download the files
  connected machine                   --- IN --->   box: receive, copy into mirror, install
```

### 9.1 Point apt at the local mirror (box)

Create the mirror folder and check for extra software sources:

```sh
sudo mkdir -p /srv/mirror
ls /etc/apt/sources.list.d/
```

Expected: `mkdir` prints nothing, and `ls` prints nothing because that folder is empty. If `ls` does list any files, move them out of apt's way:

```sh
sudo mkdir -p /etc/apt/disabled
sudo mv /etc/apt/sources.list.d/* /etc/apt/disabled/
```

Expected: no output.

Then edit apt's main list of sources:

```sh
sudo nano /etc/apt/sources.list
```

The file probably contains a line starting `deb cdrom:` and a few comments. Put a `#` at the start of every line already in the file; this turns them into comments, which apt ignores. Then add these three lines at the end:

```text
deb [target=Packages by-hash=no] file:/srv/mirror/merged excalibur main contrib non-free non-free-firmware
deb [target=Packages by-hash=no] file:/srv/mirror/merged excalibur-updates main contrib non-free non-free-firmware
deb [target=Packages by-hash=no] file:/srv/mirror/merged excalibur-security main contrib non-free non-free-firmware
```

What each part means:

- `deb` says this line is a source of ready-made packages.
- `target=Packages` makes apt read only the package lists, not translations or software-centre extras, so the mirror needs fewer files. `by-hash=no` makes apt look for the lists under their plain names.
- `file:/srv/mirror/merged` is where the packages are: a folder on this box, instead of a web address.
- `excalibur` is the codename of Devuan 6, the release. `excalibur-updates` and `excalibur-security` are its channels for fixes.
- `main contrib non-free non-free-firmware` are the sections of the archive to use. `non-free` is needed for the NVIDIA driver.

If a newer Devuan stable release has replaced Excalibur by the time you read this, use its codename here and in 9.2.

Save and exit. Do not run `apt-get update` yet: the mirror stays empty until the first lists round.

### 9.2 Lists round

Check the box's clock first (9.5).

**On the connected machine**, first create the crossing folder and move into it. Type this, with your date in place of `<date>`:

```sh
mkdir -p ~/airgap/in/<date> && cd ~/airgap/in/<date>
```

Expected: no output. Then download the signed release files and the package lists they name. This loop downloads, for each of the three channels, the signed index file called `InRelease`, reads it to find the names of the package lists for this kind of computer (`amd64`), and downloads those too. You do not need to understand it; paste the whole box at once, in the same terminal:

```sh
for s in excalibur excalibur-updates excalibur-security; do
    curl -fsSL --create-dirs -o "merged/dists/$s/InRelease" "http://deb.devuan.org/merged/dists/$s/InRelease"
    for f in $(awk '/^SHA256:/ {x=1; next} /^[^ ]/ {x=0} x && $3 ~ /^[a-z-]+\/binary-(amd64|all)\/Packages\.(xz|gz)$/ {print $3}' "merged/dists/$s/InRelease"); do
        curl -fsSL --create-dirs -o "merged/dists/$s/$f" "http://deb.devuan.org/merged/dists/$s/$f"
    done
done
find merged -type f | sort
```

The addresses start with `http`, not `https`, on purpose: the files carry Devuan's signature, which apt checks on the box, so the connection itself does not need to be secure.

Expected: nothing while it downloads, then a list of files: an `InRelease` file for each of the three channels, plus `Packages.xz` and `Packages.gz` files for each of their sections. A line starting with `curl:` is a download error: run the whole box again. Then write the IN drive (5.3).

**On the box**, plug in the IN drive and run:

```sh
receive
sudo cp -r --remove-destination ~/in/<stamp>/merged /srv/mirror/
sudo chmod -R a+rX /srv/mirror
sudo apt-get update
```

What these do: `cp` copies the new files into the mirror, replacing older copies. `chmod` makes everything in the mirror readable, because apt reads the mirror with a special low-privilege account. `apt-get update` reads the new lists and checks Devuan's signature on them.

Expected: `receive` lists the files. `cp` and `chmod` print nothing. `apt-get update` prints a `Get:` line for each release file and package list it reads from `file:/srv/mirror/merged`, then `Reading package lists... Done`. There must be no line starting with `Err:`, `W:` or `E:`; section 16 covers them. Lines starting with `N:` are only notices. An `InRelease` line may appear twice, and on later rounds, lists that have not changed show `Hit:` instead of `Get:`. Both are normal.

Check that the lists arrived:

```sh
apt-cache policy nvidia-driver
```

Expected: a `Candidate:` line followed by a version number. `Candidate: (none)` means the lists did not install: read the output of `apt-get update` again and repeat the round.

**Check that the lists are fresh.** Devuan's signature stops tampering, but a hacked connected machine could still hand over old, genuine lists, and so hold back security fixes. Each list file records when Devuan published it:

```sh
grep -H '^Date:' /var/lib/apt/lists/*_InRelease
```

Expected: one `Date:` line per channel, for example:

```text
/var/lib/apt/lists/_srv_mirror_merged_dists_excalibur-security_InRelease:Date: Sun, 01 Nov 2026 08:12:34 UTC
```

Phone check: on your phone, open `http://deb.devuan.org/merged/dists/excalibur-security/InRelease`. Near the top is a `Date:` line. Compare it with the box's line for `excalibur-security`. They should match, or the box's should be at most a day older if Devuan has published since you downloaded. If the box's date is days older, the lists are stale: fetch them again.

### 9.3 Packages round

Check the box's clock first (9.5). Then plug the OUT drive into the box and write the shopping list there. `<packages>` is the list of packages to install in this round (9.4 gives the first one). For routine updates, leave out the second line. Run the lines one at a time.

```sh
sudo apt-get --print-uris -qq full-upgrade > ~/out/uris.txt
sudo apt-get --print-uris -qq install <packages> >> ~/out/uris.txt
sort -u -o ~/out/uris.txt ~/out/uris.txt
wc -l ~/out/uris.txt
send
```

What these do: `--print-uris` makes apt work out every file it would need, and write their addresses into the file `uris.txt` instead of downloading them. The first line asks for everything needed to bring the system fully up to date; the second, for the new packages; `>>` adds to the file instead of replacing it. `sort -u` removes duplicates. `wc -l` counts the lines; if it prints `0`, the box already has everything, so skip `send` and the rest of this round. `send` writes the list to the OUT drive.

Expected: the `apt-get` lines print nothing. `wc` prints the number of files requested and the file name. `send` prints `Sent. Moved to ...` and lists `uris.txt`. `E: Unable to locate package` means the lists are missing or out of date, or a package name is misspelt: check the spelling, or do a lists round first.

**On the connected machine**, read the OUT drive (5.3) and look at the request before using it:

```sh
less ~/airgap/out/<date>/uris.txt
```

Expected: plain text, one line per file. Each line starts with `'file:/srv/mirror/merged/pool/`, followed by a file name, a size and a checksum such as `MD5Sum:...`. Some names contain `%2b` or `%7e`: apt writes `+` and `~` that way in addresses. Press q to quit. If you see anything else, stop and find out why before going on.

Download every file it names. First create a new crossing folder and move into it, and tell the terminal where the request is. Type these two lines, with a new crossing date (1.2) in the first, and the folder you just unpacked the request into in the second:

```sh
mkdir -p ~/airgap/in/<date> && cd ~/airgap/in/<date>
uris=~/airgap/out/<date>/uris.txt
```

The second line stores the request's location under the name `uris`, for the next box. Expected: no output. If you open a new terminal before the next box, type both lines again.

Then paste this whole box, in the same terminal:

```sh
tr -d "'" < "$uris" | while read -r uri rest; do
    enc=${uri#file:/srv/mirror/}
    path=$(printf '%s\n' "$enc" | sed 's/%2[bB]/+/g; s/%7[eE]/~/g; s/%25/%/g')
    curl -fsSL --create-dirs -o "$path" "http://deb.devuan.org/$enc" && echo "ok $path" || echo "FAILED $path"
done
```

The loop reads the list line by line, downloads each file from Devuan, and saves it under its real name, with `+` and `~` written out, because that is the name apt looks for in the mirror.

Expected: one `ok` line per file and no `FAILED` lines. If any failed, run the whole box again. Then write the IN drive (5.3).

**On the box**, plug in the IN drive and install:

```sh
receive
sudo cp -r --remove-destination ~/in/<stamp>/merged /srv/mirror/
sudo chmod -R a+rX /srv/mirror
sudo apt-get full-upgrade
sudo apt-get install <packages>
```

Use the same `<packages>` list as in the request, or leave out the last line for a routine update.

Expected: each `apt-get` command lists what it will change, then a line like `0 upgraded, 12 newly installed, 0 to remove and 0 not upgraded.`, then `Need to get 0 B/<size> of archives.` and `Do you want to continue? [Y/n]`. Answer `y`. It then shows a `Get:` line for each package it reads from `file:/srv/mirror/merged`, and unpacks and sets them up. `Need to get 0 B` means everything it needs is already on the box. If there is nothing to upgrade, `full-upgrade` only reports `0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.`

Problems: a line with `Err:` and `File not found` means a package is missing from the mirror: do another packages round with the same commands. `Hash Sum mismatch` means a package file is damaged or was tampered with, and apt-get refuses it: delete the file named in the message from `/srv/mirror` and fetch it again.

You can delete each received folder once its contents are in the mirror: `rm -r ~/in/<stamp>`.

### 9.4 First packages round: driver, toolkit and build tools

Do a packages round (9.3), using this as `<packages>`:

```text
linux-headers-amd64 nvidia-kernel-dkms nvidia-driver nvidia-smi nvidia-cuda-toolkit nvidia-cuda-toolkit-gcc build-essential cmake git firefox-esr qrencode util-linux-extra
```

This is one long line; type the package names separated by single spaces. Besides the NVIDIA driver and the CUDA toolkit (section 10), it brings `build-essential` and `cmake`, the tools for building llama.cpp; `git`, which the build uses to record its version; `firefox-esr`, the web browser for the chat page; `qrencode`, for getting short text out as QR codes (13.5); and `util-linux-extra`, for `hwclock` (9.5). The download is several GB, most of it the CUDA toolkit, so the IN drive crossing takes a while. Section 10 describes what you will see during the installation.

### 9.5 Clock and expiry

The box has no internet time, so its clock slowly drifts. apt cares about the date: it refuses package lists dated in the future ("not valid yet") and lists past their expiry date ("expired"). Check the clock before every round:

```sh
date
```

Expected: one line with the current date and time, marked `IST` (Indian Standard Time).

If it is more than a few minutes off, set it, typing the current Indian date and time in this format, then save it to the motherboard's clock. Until the first packages round (9.4) has installed `hwclock`, run only the first line, and also set the clock in the firmware setup screen as described below.

```sh
sudo date -s "<YYYY-MM-DD HH:MM>"
sudo hwclock --systohc
```

For example, `sudo date -s "2026-11-01 14:35"` for 2:35 PM on 1 November 2026.

Expected: `date -s` prints the new time. `hwclock` prints nothing.

To set the clock in the firmware setup screen, open it (section 6). On Gigabyte boards, the System Info. tab has System Date and System Time. Set them in UTC, not Indian time: the box keeps the motherboard clock in UTC, which is 5 hours 30 minutes behind Indian time. For example, at 2:35 PM in India, set 09:05. Save with F10.

Run `apt-get update` on the box within a few days of fetching the lists, before they expire.

## 10. NVIDIA driver and CUDA

The *driver* lets Linux use the RTX 3090. *CUDA* is NVIDIA's toolkit for running general calculations, such as AI, on the graphics card; llama.cpp is built with it in section 11. The first packages round (9.4) brought in:

| Package | Purpose |
|---|---|
| `nvidia-driver`, `nvidia-kernel-dkms` | The driver. DKMS builds its kernel module on the box. |
| `linux-headers-amd64` | Files describing your kernel, which DKMS needs to build the module. |
| `nvidia-smi` | A tool that shows the card's status and changes its settings. |
| `nvidia-cuda-toolkit` | The CUDA compiler and libraries, for building llama.cpp. |
| `nvidia-cuda-toolkit-gcc` | The version of the GCC compiler that this CUDA release accepts, available as `cuda-gcc` and `cuda-g++`. |

The firmware that the driver loads onto the card, `firmware-nvidia-gsp`, comes in automatically with them.

*DKMS* builds the part of the driver that goes into the kernel so that it fits your exact kernel. It does this again by itself whenever a kernel update arrives.

During the installation you will see:

- DKMS building the NVIDIA module (Debian calls it `nvidia-current`) for the newest installed kernel. It takes several minutes and must not end with an error. Lines about a signing key or MOK are normal; with Secure Boot off they change nothing. If an older kernel has no headers installed, DKMS says it skipped that kernel. That is fine.
- A full-screen notice titled "Conflicting nouveau kernel module loaded", telling you to restart after the installation. *nouveau* is the free driver Linux uses for NVIDIA cards by default; the NVIDIA driver replaces it, and that needs a restart. This is normal. Press Enter.

Restart the box, then run:

```sh
nvidia-smi
```

Expected: a table describing the card. Look for three things in it: the name `NVIDIA GeForce RTX 3090`, about `24576MiB` as the total memory, and the words `Driver Version` and `CUDA Version`, each followed by a number.

Then check the CUDA compiler and its matching GCC:

```sh
nvcc --version
cuda-g++ --version
```

Expected: `nvcc` prints a few lines, one of them like `Cuda compilation tools, release 12.<n>, V12.<n>.<n>`. `cuda-g++` prints a first line ending in a version number that starts with 13.

### 10.1 Optional: lower the power limit

Generating text is limited by how fast the card's memory is, not by the main GPU chip. Lowering the 3090's power limit from 350 W to 280 W costs little speed and removes a lot of heat and noise.

```sh
sudo nvidia-smi -pm 1
sudo nvidia-smi -pl 280
```

The first command turns on *persistence mode*, which keeps the driver loaded, and its settings applied, even when no program is using the card. The second sets the power limit in watts.

Expected: a line confirming persistence mode is enabled, then:

```text
Power limit for GPU 00000000:<bus id> was set to 280.00 W from <default> W.
All done.
```

`<default>` is your card's stock limit: 350.00 on most 3090s, more on some factory-overclocked models.

The limit goes back to the default at every start. Devuan runs the file `/etc/rc.local` at the end of every start, so put the two commands there:

```sh
sudo nano /etc/rc.local
```

If the file already has content, add the two `nvidia-smi` lines just above its final `exit 0` line. If nano opens an empty file, type all of this:

```sh
#!/bin/sh
nvidia-smi -pm 1
nvidia-smi -pl 280
exit 0
```

Save and exit, then make the file runnable:

```sh
sudo chmod 755 /etc/rc.local
```

Expected: no output. After the next restart, `nvidia-smi -q -d POWER | grep -i 'power limit'` shows `280.00 W` as the current limit.

## 11. Build llama.cpp

*llama.cpp* is the program that loads a model and generates text. It includes a small web server with a chat page, which you open in Firefox on the box. You will build it from its source code on the box itself, so that you can check that the code is exactly what its developers published.

llama.cpp publishes a versioned release every week or two, with a *tag* (1.1) like `v0.7.0`, and a nightly build for every change, with a tag like `b11669`. Use the newest versioned release. The chat page does not come with the source code: it comes as a separate archive attached to the nightly build that matches the release, and the box needs both. Building the chat page yourself would mean running a tool called npm, which pulls in hundreds of JavaScript packages, exactly what rule 6 forbids (5.1).

### 11.1 Get the source and the chat page (connected machine)

1. **On your phone**, open `https://github.com/ggml-org/llama.cpp/releases` and find the release marked Latest. Its tag starts with `v`. Its notes name the matching nightly build, for example `Nightly build: b11669`. Write down both tags. Doing this on the phone means a hacked connected machine cannot steer you to an older release. Read the release notes, and the repository's Security tab, for anything about GGUF files or model loading.

2. **Download the source code and select the release.** `git clone` downloads the whole project with its full history, `git checkout` switches to the release, and the last two commands show which commit you are on:

```sh
mkdir -p ~/airgap && cd ~/airgap
git clone https://github.com/ggml-org/llama.cpp
cd llama.cpp
git checkout <tag>
git log -1 --format='%H %cd'
git tag --points-at HEAD
```

`<tag>` is the release tag you wrote down, starting with `v`.

Expected: `git clone` ends with a line like `Resolving deltas: 100% (...), done.` `git checkout` prints a note about being in "detached HEAD" state; that sounds alarming but is normal when you check out a tag. `git log` prints the full 40-character commit hash and its date. `git tag --points-at HEAD` prints both tags, the nightly one and the release. If you kept the folder from a previous time, skip the `git clone` line, run `cd ~/airgap/llama.cpp && git fetch --tags` instead, and continue with `git checkout`.

3. **Pack the release into one file, a *git bundle*.** It carries the release and its full history, which the build uses to record its version, and it lets the box check every file against the commit hash:

```sh
mkdir -p ~/airgap/in/<date>
git bundle create ~/airgap/in/<date>/llama.cpp-<tag>.bundle <tag>
```

Expected: lines counting, compressing and writing objects, ending with a line that starts with `Total`. The bundle is a few hundred MB.

4. **Download the chat page archive from the nightly build.** `<nightly>` is the nightly tag you wrote down, starting with `b`:

```sh
cd ~/airgap/in/<date>
curl -fLO https://github.com/ggml-org/llama.cpp/releases/download/<nightly>/llama-<nightly>-ui.tar.gz
sha256sum llama-<nightly>-ui.tar.gz
```

Expected: a progress meter, then one line with a 64-character checksum and the file name. Now open the nightly build's release page: tap the nightly tag where the release notes from step 1 mention it, or open `https://github.com/ggml-org/llama.cpp/releases/tag/<nightly>` directly. Under Assets, find `llama-<nightly>-ui.tar.gz`; you may need to click "Show all assets". GitHub shows `sha256:` and a checksum next to it. Every character must match yours.

5. Write the IN drive (5.3).

### 11.2 Check and unpack (box)

Plug in the IN drive:

```sh
receive
sha256sum ~/in/<stamp>/llama-<nightly>-ui.tar.gz
```

Expected: `receive` lists the bundle and the archive. `sha256sum` prints the checksum. Phone check: compare it with the `sha256:` value next to the archive on the nightly build's release page.

If you built llama.cpp before, move the old build aside first: `rm -rf ~/src/llama.cpp.old && mv ~/src/llama.cpp ~/src/llama.cpp.old`. On the first build, skip this.

Now copy the source out of the bundle, without unpacking any files yet:

```sh
mkdir -p ~/src
git clone --no-checkout --branch <tag> ~/in/<stamp>/llama.cpp-<tag>.bundle ~/src/llama.cpp
git -C ~/src/llama.cpp rev-parse HEAD
```

Expected: `git clone` prints `Cloning into '/home/<you>/src/llama.cpp'...`, then lines that count up to 100%. `rev-parse` prints a 40-character commit hash.

Phone check: open the release on GitHub. Next to its tag is a short commit code, seven characters long. Tap it. The commit page shows the full 40-character hash, which is also visible in the page's address. All 40 characters must match the box's. While copying out of the bundle, git recomputes the hash of every file, so a matching commit hash proves every file in the source is exactly what was published. Only then unpack the files:

```sh
git -C ~/src/llama.cpp reset --hard
```

Expected: `HEAD is now at` followed by the short commit code and the commit's title.

Unpack the chat page into the folder where the build looks for it:

```sh
mkdir -p ~/src/llama.cpp/tools/ui/dist
tar -xzf ~/in/<stamp>/llama-<nightly>-ui.tar.gz -C ~/src/llama.cpp/tools/ui/dist --strip-components=1
ls ~/src/llama.cpp/tools/ui/dist
```

Expected: no output from `mkdir` and `tar`, then a list that includes `index.html`, `sw.js`, `manifest.webmanifest`, `build.json`, a folder `_app` and a set of image files.

### 11.3 Build (box)

Building has two steps: *configure*, where the build tool CMake checks your system and decides what to build, and *build*, where the compiler does the work.

Configure:

```sh
cd ~/src/llama.cpp
cmake -B build \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_CUDA=ON \
    -DCMAKE_CUDA_ARCHITECTURES=86 \
    -DCMAKE_CUDA_HOST_COMPILER=/usr/bin/cuda-g++ \
    -DLLAMA_OPENSSL=OFF \
    -DLLAMA_USE_PREBUILT_UI=OFF \
    -DLLAMA_BUILD_IS_DEV=OFF \
    -DCMAKE_INSTALL_RPATH='$ORIGIN' \
    -DCMAKE_BUILD_WITH_INSTALL_RPATH=ON
```

The `cmake` command is one command spread over several lines (1.2). If you prefer, type it as a single line: `cmake -B build` followed by all the `-D...` options, separated by spaces, without the `\` signs.

What the options do:

| Option | Why |
|---|---|
| `GGML_CUDA=ON` | Build the part of llama.cpp that uses the NVIDIA card. |
| `CMAKE_CUDA_ARCHITECTURES=86` | Compile graphics card code only for Ampere, the 3090's generation. Saves a lot of build time. |
| `CMAKE_CUDA_HOST_COMPILER=/usr/bin/cuda-g++` | Use the GCC version that Devuan's CUDA accepts. The default GCC is too new for it. |
| `LLAMA_OPENSSL=OFF` | Build without secure web connections, so the model-download feature cannot work. The box could not use it anyway. Releases before January 2026 used `LLAMA_CURL=OFF` for this. |
| `LLAMA_USE_PREBUILT_UI=OFF` | Never try to download the chat page during the build; use the files from 11.2. |
| `LLAMA_BUILD_IS_DEV=OFF` | Report the release version, for example `0.7.0`, rather than `0.7.0-dev`. Leave it out if you ever build a nightly instead of a release. |
| `CMAKE_INSTALL_RPATH='$ORIGIN'` and `CMAKE_BUILD_WITH_INSTALL_RPATH=ON` | Make each program look for llama.cpp's libraries in its own folder, so a build keeps working after you move or rename it. llama.cpp's own Linux release builds do the same. Keep the single quotes. |

Expected: many lines starting with `--`, including `-- llama.cpp version: <version>` and a line identifying the CUDA compiler as NVIDIA with a 12.x version, ending with lines that start `-- Configuring done` and `-- Generating done`, then `-- Build files have been written to: /home/<you>/src/llama.cpp/build`.

These warnings are harmless: ccache not found; "Manually-specified variables were not used by the project", which only means that this release renamed or dropped one of the options above.

Build:

```sh
cmake --build build --config Release -j 6
```

`-j 6` runs six compile jobs at once, one per CPU core. More jobs can run 16 GB of RAM out of memory.

Expected: early on, a line `-- UI: using pre-built assets from /home/<you>/src/llama.cpp/tools/ui/dist`. Then progress lines such as `[ 23%] Building CUDA object ...`. The graphics card code is slow to compile; allow 10 to 40 minutes. Compiler warnings, which scroll past in large numbers, are normal. Only lines containing `error:` matter, and they stop the build. It finishes with lines like `[100%] Built target llama-server`.

If you see `UI: no assets available - building without an embedded UI` instead, the chat page files are missing: redo the last step of 11.2 and build again. The message names the folder the files belong in, in case a newer release has moved it.

Check:

```sh
ls build/bin
build/bin/llama-server --version
```

Expected: the list includes `llama-server`, `llama-cli`, `llama-bench` and `llama-quantize`. `--version` may first print lines naming the CUDA device, then prints a line like `version: 0.7.0 (build <number>, commit <hash>)` and a line starting `built with GNU`.

## 12. Models

A model is the AI itself: one large file. Its size is given in *parameters*, the numbers inside it: a 27B model has 27 billion. More parameters generally means a more capable model, and a bigger file that needs more VRAM.

To fit bigger models on the card, people publish *quantized* versions, where each number is stored with fewer bits. The name says how much: `Q8_0` is barely shrunk and almost as good as the original; `Q4_K_M` is about a third of the original size and a little worse; lower numbers are smaller still and noticeably worse.

The model also needs room in VRAM for its *context*: the text it keeps in mind at once, meaning your conversation so far plus any document you paste in. Context is measured in *tokens*; a token is roughly three quarters of an English word, so a 16K (16,384-token) context holds roughly 12,000 words.

### 12.1 What fits in 24 GB

The model file must fit in VRAM with 2 to 4 GB left over for the context.

| Model size | Quantization | File size | On one 3090 |
|---|---|---|---|
| 7B to 9B | Q8_0 | 8 to 10 GB | Yes, with long context |
| 14B | Q6_K | about 12 GB | Yes |
| 20B to 32B | Q4_K_M | about 14 to 20 GB | Yes, with 8K to 16K context |
| 70B | Q4_K_M | about 42 GB | No. Needs two 3090s |

**For your first model, pick a 7B to 9B model at Q8_0.** It downloads and crosses quickly, and it lets you test the whole chain, from download to chat, before you move a 20 GB file. Once that works, a 27B to 32B model at Q4_K_M is the usual choice for daily use on one 3090.

### 12.2 Where models come from

Models are published on a website called Hugging Face (`https://huggingface.co`). Each model has a page called a *repository*, and many models come in several repositories: the original from the organisation that made it, and converted or modified versions from other people. To find a GGUF version, search the site for the model's name followed by "GGUF".

In order of trust:

1. GGUF files published by the model's own organisation on Hugging Face.
2. GGUF files from a well-known quantizer with a long record for that model family.
3. Community fine-tunes and merges, including "abliterated" or "uncensored" versions. Someone else changed the model, and you cannot check what they did.

The strongest option is to download the publisher's original model and make the GGUF yourself (Appendix A). That is for later; do not start there.

A matching SHA256 proves you received exactly the file that was published. It does not prove the file is safe.

### 12.3 Download and hash (connected machine)

**In a browser:** open the model's repository and click the "Files and versions" tab. It lists several `.gguf` files, one per quantization, with their sizes; pick one that fits (12.1). Click the file's name. Its page shows a details box headed "Xet Pointer Details" or "Git LFS Details". Note the value labelled **SHA256** (not the one labelled Xet hash). Then click the download button; the file goes to your Downloads folder. When it has finished, move it into the crossing folder:

```sh
mkdir -p ~/airgap/in/<date>
mv ~/Downloads/<file>.gguf ~/airgap/in/<date>/
```

Expected: no output.

**Or with the `hf` command** (4.4). `<org>/<repo>` is the repository's name as shown at the top of its page, and `<file>` is the file's name without `.gguf`:

```sh
mkdir -p ~/airgap/in/<date> && cd ~/airgap/in/<date>
hf download <org>/<repo> <file>.gguf --local-dir .
```

Expected: a progress bar, then the path of the downloaded file. Some models, such as Llama and Gemma, are *gated*: you must first accept the licence on the model's page while logged in to Hugging Face, then log in on the command line with `hf auth login` and an access token from your Hugging Face account settings.

Work out its checksum:

```sh
cd ~/airgap/in/<date>
sha256sum <file>.gguf | tee <file>.gguf.sha256
```

`tee` shows the result on screen and also saves it in a file next to the model, which crosses with it.

Expected: one line, a 64-character checksum followed by the file name. Compare it with the SHA256 on the file's Hugging Face page, in groups of eight characters. Every character must match. If not, delete the file and download it again.

Large models come in parts named like `<name>-00001-of-00003.gguf`. Download, hash and compare every part, and keep the parts together.

`hf` may leave a hidden `.cache` folder in the crossing folder. Remove it whether or not you can see it; the command does nothing if there is none: `rm -rf ~/airgap/in/<date>/.cache`. Then write the IN drive (5.3). A large file takes several minutes.

### 12.4 Bring it in (box)

Plug in the IN drive and run the commands below. `receive` prints nothing for several minutes while it copies a large file; that is normal.

```sh
receive
cd ~/in/<stamp>
sha256sum <file>.gguf
```

Expected: one line, a 64-character checksum followed by the file name. The box computed it from the file itself, so it does not depend on anything the connected machine wrote. Phone check: compare it with the SHA256 on the model's Hugging Face page. Every character must match. For a split model, run `sha256sum` on every part and check each one.

Move it into the models folder. The first two lines create the folder and make you its owner, so you can put files there without `sudo`:

```sh
sudo mkdir -p /srv/models
sudo chown "$USER": /srv/models
mv <file>.gguf <file>.gguf.sha256 /srv/models/
```

Expected: no output. For a split model, move every part, and point llama.cpp at the first part (the file ending `-00001-of-...gguf`); it finds the others.

## 13. Run it

### 13.1 Launcher

A *launcher* is a tiny script that starts llama.cpp's server with the right settings, so you do not have to type them every time. First run `ls /srv/models` and note the model's exact file name: you need it in a moment, and nano cannot complete names with Tab.

```sh
mkdir -p ~/bin
nano ~/bin/ai-server
```

Type this, replacing `<file>` with your model's file name (without the brackets, and keeping `.gguf`), then save and exit:

```sh
#!/bin/sh
# Start llama-server, reachable from this machine only.
MODEL=/srv/models/<file>.gguf
exec "$HOME/src/llama.cpp/build/bin/llama-server" \
    --model "$MODEL" \
    --n-gpu-layers 99 \
    --ctx-size 16384 \
    --host 127.0.0.1 \
    --port 8080
```

What the options do: `--model` names the model file. `--n-gpu-layers 99` puts the whole model on the graphics card (models are built from layers, and 99 is more than any model here has). `--ctx-size 16384` sets the context (section 12). `--host 127.0.0.1` makes the server reachable only from the box itself, and `--port 8080` picks the door number (1.1).

Make it runnable and start it:

```sh
chmod 755 ~/bin/ai-server
~/bin/ai-server
```

Expected: many lines scroll past while the model loads. Among them (the exact wording varies between releases):

```text
ggml_cuda_init: found 1 CUDA devices (Total VRAM: <n> MiB):
  Device 0: NVIDIA GeForce RTX 3090, compute capability 8.6, VMM: yes, VRAM: <n> MiB
load_tensors: offloaded 65/65 layers to GPU
srv          main: listening on http://127.0.0.1:8080
```

The two numbers in `offloaded N/N layers` must be equal; 65 is only an example. If the first is lower, part of the model runs on the CPU and will be slow. The last line means the server is ready.

Recent releases can squeeze a model into VRAM by themselves when you leave out `--n-gpu-layers` and `--ctx-size`, by moving layers to the CPU or shrinking the context. The launcher sets both on purpose: if the model does not fit, the server stops with an out-of-memory error instead of quietly running slower.

These lines are normal:

- a line saying the context is smaller than `n_ctx_train` and that "the full capacity of the model will not be utilized". It only means you chose a shorter context than the model's maximum;
- a warning starting `security: no API key is set and CORS allows all origins`. Only programs on this machine can reach the server.

Do not add `--tools` or `--agent` to the launcher. They let the model read and write files and run commands on the box.

Leave the terminal open while you use the AI; closing it, or pressing Ctrl+C in it, stops the server.

### 13.2 Use it

Open Firefox on the box (Applications, then Internet, then Firefox ESR) and type `http://127.0.0.1:8080` in the address bar. The llama.cpp chat page opens. Type a question at the bottom and press Enter. Bookmark the page (Ctrl+D) so you can open it with one click next time.

### 13.3 Check it listens only on this machine

In a second terminal window:

```sh
ss -ltn
```

`ss -ltn` lists the doors (ports) on which programs are waiting for connections.

Expected: on the line for port 8080, the Local Address column shows `127.0.0.1:8080`. If it shows `0.0.0.0:8080` or `*:8080`, the server would accept connections from other machines: fix the `--host` value in the launcher. Other lines whose Local Address shows `127.0.0.1` or `[::1]` belong to local services and are fine.

### 13.4 Check speed

Stop the server first with Ctrl+C in its terminal, then:

```sh
~/src/llama.cpp/build/bin/llama-bench --model /srv/models/<file>.gguf --n-gpu-layers 99
```

Expected: after a minute or so, a table with a `pp512` row (how fast it reads a prompt) and a `tg128` row (how fast it writes), in tokens per second. For a 27B model at Q4_K_M on a 3090, `tg128` in the 30s is normal. Single-digit numbers mean layers are running on the CPU.

### 13.5 Getting text out

In order of preference:

1. **Read it on the screen.** Nothing leaves.
2. **For short text, use QR codes.** Select the text in the chat page and copy it with Ctrl+C. Open a new file with `nano ~/answer.txt`, paste with Ctrl+Shift+V, then save and exit. Then cut the file into pieces small enough to scan reliably, and show each piece as a QR code:

```sh
cd ~
split -C 500 answer.txt part-
ls part-*
qrencode -t ANSIUTF8 < part-aa
```

`split -C 500` cuts the file into pieces of at most 500 bytes, about 500 letters of English text, named `part-aa`, `part-ab` and so on. A piece can end in the middle of a word, so when you put the pieces back together on the phone, join them without adding spaces. `qrencode` draws a QR code in the terminal.

Expected: `split` prints nothing. `ls` lists the pieces. `qrencode` draws a QR code. Maximise the terminal window, scan the code with your phone's camera, then show the next piece with `qrencode -t ANSIUTF8 < part-ab`, and so on. If the whole square does not fit on the screen, make the terminal text smaller with Ctrl+minus and draw it again. Delete the pieces afterwards with `rm part-*`.

3. **For longer text, use the OUT drive,** and only for plain text you have read first. Plug in the OUT drive:

```sh
cp ~/answer.txt ~/out/
send
```

Expected: `Sent. Moved to ...` and a listing with `answer.txt`. On the connected machine, read the OUT drive (5.3) and open the file with a plain text viewer, for example `less ~/airgap/out/<date>/answer.txt`.

### 13.6 Using it day to day

Each time you want to use the AI:

1. Switch on the box, type the encryption passphrase, and log in.
2. Open a terminal and run `~/bin/ai-server`. Wait for the `listening on` line.
3. Open Firefox and click the bookmark (13.2).

When you are done, press Ctrl+C in the server's terminal, then shut down from Applications, then Log Out, then Shut Down.

To switch to another model, bring it in (12.3 and 12.4), then edit the launcher with `nano ~/bin/ai-server` and change the file name on the `MODEL=` line.

## 14. Maintenance

Once a month, and whenever llama.cpp announces a security fix, spend an evening on these. Allow two to three hours the first few times; it gets quicker.

1. **Check and set the clock** (9.5).
2. **Update the software.** Do a lists round (9.2), then a packages round (9.3) with only the `full-upgrade` line. If a new kernel or NVIDIA driver arrived, restart and check `nvidia-smi` (section 10).
3. **Update llama.cpp.** Build the newest release (section 11). Keep the previous build, `~/src/llama.cpp.old`, until the new one works.
4. **Check for a new BIOS** on the board vendor's page (6.1). A BIOS update resets all its settings: afterwards, redo 6.2 and 6.3, then run the checks in section 15.
5. **Clear out what you no longer need:** received folders (`rm -r ~/in/<stamp>`) and the package files already installed from the mirror (`sudo find /srv/mirror/merged/pool -name '*.deb' -delete`). The mirror's package lists stay.
6. **Log every crossing** (Appendix B).
7. **Update the connected machine** too, every week or so (4.2, step 6).

## 15. Final checks

Run these after setup and after any change. Each one checks a promise this guide makes.

| Check | How | Expected |
|---|---|---|
| Only loopback networking | `ip -br link` | One line, `lo` |
| No network drivers loaded | The `lsmod` command from 8.6 | No output |
| Disk encrypted | `lsblk -o NAME,FSTYPE,FSVER,MOUNTPOINTS` | `/` sits inside `crypto_LUKS` |
| Drives carry no filesystem | Plug in a transfer drive, run `lsblk -o NAME,FSTYPE,PARTLABEL,MOUNTPOINTS` | Empty FSTYPE and MOUNTPOINTS |
| IN drive read-only after `receive` | `sudo blockdev --getro /dev/disk/by-partlabel/AIRGAP-IN` | `1` |
| apt uses only the local mirror | `apt-cache policy` | Every source line names `file:/srv/mirror/merged`; none names `http` |
| GPU ready | `nvidia-smi` | RTX 3090, about 24576MiB |
| Server local only | `ss -ltn` while the server runs | `127.0.0.1:8080` |
| Firmware | Setup screen | LAN off, Secure Boot off, administrator password set |

## 16. Troubleshooting

Find the symptom, then try the fix. If nothing here matches, read the exact error message slowly: it usually names the file or the step that went wrong.

### 16.1 General

| Symptom | Likely cause | Fix |
|---|---|---|
| Typing your password shows nothing | Normal | Type it and press Enter (1.2). |
| `command not found` | A typo in the command's name, or the program is not installed yet | Check the spelling. If it is right, the package may come in a later step. |
| `Permission denied` | The command needs `sudo`, or a script was not made runnable | Put `sudo` in front where the guide does. For the scripts, run the `chmod 755` step again. |
| `No such file or directory` | A wrong path, a placeholder left in, or a drive not plugged in | Check the path with `ls`, one folder at a time. Replace every `<...>`. |
| `syntax error near unexpected token` | A placeholder was typed with its `<` and `>`, or a quote or bracket is missing | Replace placeholders completely (1.2). Compare the command with the guide, character by character. |
| The terminal shows `>` and waits | It is waiting for the rest of a command | If you are in the middle of a loop or a command whose lines end in `\`, keep typing (1.2). Otherwise a closing quote is probably missing: press Ctrl+C and type the command again. |
| The monitor stays black when the box starts | The monitor is plugged into the motherboard, or the BIOS is too old for the CPU | Plug the monitor into the graphics card. If it already is, have a shop update the BIOS (3.2). |
| The boot menu does not show the installer stick | The stick was not written properly | Write it again (7.2), and pick the entry starting with `UEFI:`. |
| Forgot the firmware administrator password | | Resetting it means clearing the motherboard's settings memory (the CMOS), which involves opening the box. See the motherboard manual, or ask a shop. |
| Forgot the encryption passphrase | | Nothing can recover the data. Install again from section 7. |
| Installer finds no network on the box | The LAN is disabled | Expected. Continue. |

### 16.2 Drives and crossings

| Symptom | Likely cause | Fix |
|---|---|---|
| `receive` or `send` says the drive was not found | Wrong drive, or it is not plugged in | `ls /dev/disk/by-partlabel/` should show `AIRGAP-IN` or `AIRGAP-OUT`. If neither appears, prepare the drive again (5.2). |
| `receive` says `Nothing was kept` | A file name with accented letters or symbols, a bad write, or an archive that fails the checks in 8.5 | If the lines after it show a name containing `M-`, rename that file on the connected machine (5.3). Otherwise write the folder to the IN drive again. If it happens again with plain names, stop trusting the connected machine. |
| A checksum on the box does not match the publisher's, or `sha256sum -c` says `FAILED` | Bad copy, bad download or a tampered file | Write the IN drive again. If it still fails, download again on the connected machine. Never use the file anyway. |

### 16.3 Updates

| Symptom | Likely cause | Fix |
|---|---|---|
| `apt-get update` shows an `Err:` line, or a warning about signatures | Damaged, missing or tampered list files | Do the lists round again. Never add `trusted=yes` to the sources or use `--allow-unauthenticated`: they switch off the signature checks that protect the box. |
| The box's `excalibur-security` date is days older than the phone's | The connected machine handed over stale lists | Fetch the lists again. If it keeps happening, stop trusting the connected machine. |
| apt says a release file is expired or not valid yet | Lists too old, or the box's clock is wrong | Fix the clock (9.5) and do the lists round again. |
| `E: Unable to locate package` | Lists missing or out of date, or a misspelt package name | Check the spelling. Otherwise do a lists round first. |
| `apt-get install` shows `Err:` and `File not found` | A package is not in the mirror | Do another packages round with the same commands. |
| `Hash Sum mismatch` | A damaged or tampered package file | Delete the file named in the message from `/srv/mirror` and fetch it again. |

### 16.4 Driver and build

| Symptom | Likely cause | Fix |
|---|---|---|
| Black screen after installing the NVIDIA driver | The module was not built, or nouveau is still in control | Press Ctrl+Alt+F2 for a text login, and log in with your user name and password. Run `dkms status`: it should list the NVIDIA module as installed for your kernel. Check that `linux-headers-amd64` is installed with `dpkg -l linux-headers-amd64`. Then `sudo reboot`. Ctrl+Alt+F7 returns to the graphical screen. Recovery mode also works: in the boot menu that appears for a few seconds at start, choose Advanced options, then the entry ending in `(recovery mode)`. After the passphrase it gives a root prompt without asking for a password; leave out `sudo` there. |
| `nvidia-smi` says it couldn't communicate with the NVIDIA driver | The module is not loaded | `dkms status` should list the NVIDIA module as installed for your kernel. Check that Secure Boot is off (6.3). Restart after any kernel update. |
| Notice "Mismatching nvidia kernel module loaded" after an update | The new driver is installed, the old one is still running | Restart. |
| CMake error "unsupported GNU version" | CUDA host compiler not set | `rm -rf build`, then configure again with the `CMAKE_CUDA_HOST_COMPILER` option (11.3). |
| CMake cannot find CUDA | Toolkit not installed | Install `nvidia-cuda-toolkit` (9.4). |
| Build fails in CUDA files with errors about the CUDA version | This llama.cpp release needs a newer CUDA than Devuan ships | Use the Vulkan backend instead: bring in `libvulkan-dev`, `glslc`, `spirv-headers` and `nvidia-vulkan-icd` with a packages round (check llama.cpp's build documentation for the current list), then configure with `-DGGML_VULKAN=ON` in place of the CUDA options. It is somewhat slower. |
| Build stops with `Killed`, or the box freezes while building | Out of RAM | Build again with `-j 4`, or `-j 2`. |
| Build prints `UI: no assets available` | Chat page files missing | Redo the last step of 11.2. |

### 16.5 Running models

| Symptom | Likely cause | Fix |
|---|---|---|
| Server log shows `cudaMalloc failed: out of memory` | Model plus context does not fit in VRAM | Lower `--ctx-size` in the launcher, or use a smaller quantization (12.1). |
| Very slow replies | Layers running on the CPU | Check `offloaded N/N layers` (13.1). Keep `--n-gpu-layers 99`. |
| Model loads but writes nonsense | llama.cpp is too old for this model | Update llama.cpp (section 11). |
| Firefox says it cannot connect to `127.0.0.1:8080` | The server is not running, or not ready yet | Start `~/bin/ai-server` and wait for the `listening on` line (13.1). |

### 16.6 Connected machine

**apt mentions a `cdrom` or asks you to insert a disc.** The installer did not set up a network mirror (4.2, step 5). Open the list of sources:

```sh
sudo nano /etc/apt/sources.list
```

Put a `#` at the start of the line that mentions `cdrom`, add these three lines at the end, then save and exit:

```text
deb http://deb.devuan.org/merged excalibur main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged excalibur-updates main contrib non-free non-free-firmware
deb http://deb.devuan.org/merged excalibur-security main contrib non-free non-free-firmware
```

Then run `sudo apt update` again. Expected: `Get:` lines and no line starting with `E:`.

## Appendix A: Make your own GGUF

**Advanced. Skip this on your first build,** and come back once everything else works.

Instead of downloading a GGUF file that someone else converted and shrank, you download the model's original files from the organisation that made it, convert them to GGUF yourself, and shrink (quantize) the result on the box. This removes the third-party quantizer from your chain of trust. You then trust the publisher's original model, llama.cpp's converter, the Python packages the converter needs, and the connected machine that runs them. There is no publisher checksum for a file you made yourself, so the phone check does not apply to it. The cost is a much larger download: about 110 GB of free disk on the connected machine for a 27B model, and an IN drive of 128 GB or more.

Your own quantization has no importance matrix (extra data some quantizers use to decide which numbers matter most), so at the same size it is slightly worse than the best published quants. If VRAM allows, use Q5_K_M instead of Q4_K_M to make up for it.

The converter is a Python program, and it needs Python packages, which `pip`, Python's package installer, downloads. That is fine on the connected machine; only the finished GGUF crosses to the box, and rule 6 (5.1) still forbids carrying Python packages in. A *virtual environment* (`venv`) is a separate folder for those packages, so they do not mix with the rest of the system.

On the connected machine, in a disposable qube or a fresh user account, use the llama.cpp folder from 11.1 (download it again if this is a new disposable) and the same `<tag>` as the build on the box:

```sh
cd ~/airgap/llama.cpp && git checkout <tag>
python3 -m venv ~/airgap/venv
. ~/airgap/venv/bin/activate
pip install -r requirements/requirements-convert_hf_to_gguf.txt
```

If `python3 -m venv` complains that venv is not available, install it with `sudo apt install python3-venv` and run that line again.

Expected: pip downloads and installs packages for several minutes and ends with a line starting `Successfully installed`.

Download the original model (its `.safetensors` files, which hold the numbers, plus its configuration and tokenizer files):

```sh
hf download <org>/<model> --local-dir ~/airgap/hf/<model>
```

Expected: progress bars for each file, then the folder path.

Convert it to a full-precision GGUF in the crossing folder, and save its checksum:

```sh
mkdir -p ~/airgap/in/<date>
python convert_hf_to_gguf.py ~/airgap/hf/<model> --outtype bf16 --outfile ~/airgap/in/<date>/<model>-BF16.gguf
cd ~/airgap/in/<date> && sha256sum <model>-BF16.gguf > <model>-BF16.gguf.sha256
```

Expected: many lines starting with `INFO:`, ending with one that says the model was successfully exported to your output file. For a 27B model the file is about 54 GB.

Write the IN drive (5.3). On the box, `receive` it, go into the received folder, and check that the copy matches what the connected machine made:

```sh
cd ~/in/<stamp>
sha256sum -c <model>-BF16.gguf.sha256
```

Expected: `<model>-BF16.gguf: OK`. Move both files to `/srv/models` as in 12.4. Then quantize it:

```sh
cd /srv/models
~/src/llama.cpp/build/bin/llama-quantize <model>-BF16.gguf <model>-Q4_K_M.gguf Q4_K_M
```

Expected: one line per part of the model as it is converted, ending with lines that report the quantize time and the total time. Point the launcher at the new file (13.6), and delete the BF16 file if you need the space.

## Appendix B: Transfer log

Keep this on the connected machine, or on paper next to the box. Write one line per file per crossing. On the box, `~/sent` already holds a copy of everything that went out.

| Date | Drive | Direction | File | SHA256 (first 16 characters) | Source | Checked on the box |
|---|---|---|---|---|---|---|
| | IN | connected machine to box | | | | |
| | OUT | box to connected machine | | | | |

For example, a model crossing might read: `2026-11-01`, `IN`, `connected machine to box`, `<model>-Q4_K_M.gguf`, the first 16 characters of its checksum, `huggingface.co/<org>/<repo>`, `phone check OK`.

## Appendix C: Rules card

Print this and keep it next to the box.

```text
IN   connected machine -> box. Box reads it with receive, read-only. Box never writes it.
OUT  box -> connected machine. Box writes it with send. Connected machine only reads it.
     Neither drive has a filesystem. Neither is ever mounted.

Allowed in:   Devuan package files (section 9), a llama.cpp release and its web
              interface archive, GGUF files, plain .txt files you have read.
Never in:     programs from elsewhere, pip or npm packages, .bin .pt .pth .ckpt files.
Allowed out:  package requests, plain text you have read.

Every file:   checked on the box (apt, or a phone check), one line in the log.
Never:        phones, wireless keyboards or mice, network cables. Not even once.
```

## Appendix D: Qubes OS and Whonix variant

This appendix is not a second build. It is the set of changes you make if you want the same air-gapped AI workstation on Qubes OS with Whonix instead of bare-metal Devuan. Read the main guide first. Everything here assumes you already understand the transfer rules and the llama.cpp build from the main sections.

> **Not for a first build.** Qubes OS is a security-focused operating system that runs everything in separate virtual machines. It has its own learning curve on top of everything in this guide, and the graphics card setup below is the most fragile part of anything described here. Build the main guide's box first. If you want this variant later, use Qubes as your everyday system on another computer for a few weeks before you start.

Qubes words used in this appendix:

- **Qube**: one isolated virtual machine, a computer inside the computer, with its own programs and files.
- **dom0**: the administrator qube that controls all the others and the screen. It has no network. Anything typed in a dom0 terminal can affect the whole machine, so type carefully.
- **Template**: a qube that holds installed software for other qubes. You install programs in the template, and the qubes based on it get them after they restart.
- **App qube**: an ordinary qube based on a template. Only its home folder (and `/usr/local` and `/rw`) survives a restart; everything else comes fresh from the template each time.
- **Disposable**: a qube created fresh for one task and deleted when you close it.
- **netvm**: the qube that gives another qube its network connection. A qube whose netvm is set to none has no network at all.
- **Whonix**: a pair of qubes that sends internet traffic through Tor, a network that hides where the traffic comes from.
- **qrexec, policy**: qrexec is the controlled channel through which qubes ask each other for services, such as copying a file. Its rules are called the policy.
- **PCI passthrough**: handing a piece of hardware, here the graphics card, directly to one qube.

### D.1 Should you do this at all

For the strongest isolation, no. The bare-metal Devuan box with a physical air gap is still the more secure design, and it is simpler. A physical gap cannot be bridged by software. Qubes isolation is enforced by a hypervisor (Xen) and dom0, which are software, and GPU passthrough deliberately pokes a hole through part of that isolation.

What Qubes plus Whonix buys you, concretely:

- **One machine instead of two.** The connected machine from the main guide becomes a disposable qube on the same box. No second computer.
- **Anonymous downloads.** Template and model downloads can go over Tor through Whonix, so your IP is not tied to what you fetch. The physical-gap build gives you privacy on the box; it does nothing to hide what the connected machine downloads.
- **No USB shuffling.** Files move between qubes with `qvm-copy`, not on a drive you plug and unplug.
- **Strong isolation between everything else.** Your browsing, your email, your Bitcoin qube and the AI qube are all walled off from each other, not just the AI box from the world.

What it costs you:

- **A bigger trusted base.** You now trust Xen, dom0, and the whole Qubes stack, not just one kernel.
- **GPU passthrough is fragile and not officially supported.** It breaks between releases, depends on your exact board and firmware, and the procedure below is community knowledge, not a guarantee. Budget a weekend for it to not work the first time.
- **A possible memory limit on the GPU qube** (D.5).
- **Soft isolation, not a gap.** A Xen or dom0 compromise, or a passthrough side channel, can in principle cross between qubes. Rare, but not impossible the way a physical gap is.

Recommendation, by the axis that drives it:

1. **Security first, highest-threat use: stay on the bare-metal Devuan box (main guide).** The physical gap is the stronger guarantee, and you avoid the hypervisor and passthrough attack surface entirely. Pick this if the point is maximum isolation.
2. **You also need anonymity for the downloads and want one machine: Qubes plus Whonix (this appendix).** Pick this if hiding what you fetch, and folding the connected machine into the same box, is worth a larger trusted base and the passthrough headache.
3. **You want convenience over the gap: an ordinary hardened Linux box with the GPU.** Not covered here. Only if the box holds nothing you would mind leaking.

The rest of this appendix is option 2.

### D.2 The qube layout

| Qube | Role | Network |
|---|---|---|
| dom0 | The admin domain. Drives the display on the iGPU or a second GPU, never the 3090. | None, ever (default). |
| sys-net | Holds the network card. | The only qube that touches the wire. |
| sys-firewall | Filters between sys-net and the rest. | Via sys-net. |
| sys-whonix | Whonix gateway. Routes traffic over Tor. | Via sys-firewall. |
| anon-whonix (disposable) | Where you download templates and models over Tor. Replaces the connected machine. | Via sys-whonix. |
| ai-template | A clone of the Debian template. Holds the NVIDIA driver, CUDA and an in-qube kernel. | None; updates go through the UpdatesProxy (D.7). |
| ai-llm | The inference qube. GPU passed through. Builds llama.cpp and runs the model. | None. This is the gap. |
| ai-build (optional) | Compiles llama.cpp if the GPU qube has to run with very little RAM (D.5). No GPU. | None. |

### D.3 Hardware changes

- A CPU and board with VT-x and VT-d (IOMMU), with IOMMU enabled in firmware. Qubes needs it; passthrough doubly so.
- A way for dom0 to drive a display that is not the 3090: a CPU with integrated graphics, or a second cheap GPU. The 3090 is handed to the AI qube, so dom0 cannot use it.
- The 3090 should sit in an IOMMU group by itself, or in a group you can pass whole. Server and workstation boards are better at this than cheap consumer ones.
- More system RAM than the main build. Every running qube takes RAM. 32 GB is a sensible floor, 64 GB comfortable.
- Everything else from section 3 of the main guide stands.

### D.4 What changes, section by section

| Main guide | On Qubes plus Whonix |
|---|---|
| 4. The connected machine | A disposable Whonix qube. Downloads go over Tor. |
| 5. Transfer drives and rules | `qvm-copy` between qubes. No physical media, so no `receive` or `send`. The one-way discipline becomes: files only ever move into ai-llm, never out to a networked qube. |
| 6. Firmware settings | Same, plus enable VT-d and IOMMU. Leave the 3090 alone; dom0 drives the iGPU or second GPU. |
| 7. Install Devuan | Install Qubes OS 4.3 instead. Full-disk encryption is set during install, so the LUKS steps are handled for you. |
| 8. Cut the network for good | The AI qube has its netvm set to none. That is its air gap. dom0 has no network by default. |
| 9. Offline package updates | Template updates go over Tor through sys-whonix (D.7), or you keep them fully offline by copying .deb files into the template with `qvm-copy`. |
| 10. NVIDIA driver and CUDA | Installed in the AI template, plus GPU passthrough and an in-qube kernel (D.6). For the optional power limit (10.1), put the two `nvidia-smi` lines in `/rw/config/rc.local` inside ai-llm, not in `/etc/rc.local`. |
| 11. Build llama.cpp | Built in ai-llm, or in ai-build if ai-llm has very little RAM (D.6 step 7). |
| 12 to 13. Models and run | The same llama.cpp commands, inside ai-llm. Models arrive by `qvm-copy` and live in `~/models`, not `/srv/models`, because only the home folder survives a restart of an app qube. |

### D.5 Memory for the GPU qube

On older Qubes releases, a qube with a graphics card passed through often failed if it was given more than about 3.5 GB of RAM: the card did not start, or memory was corrupted, because of where the card's memory-mapped I/O window lands below the 4 GB line. The fix was an unofficial dom0 patch, which is not part of stock Qubes. Some Qubes 4.3 users report larger amounts working with memory balancing turned off, but this depends on the board and is not guaranteed.

So:

1. **Try 8 GB first (recommended).** That is enough to build llama.cpp inside the AI qube and to run it. D.6 step 4 sets it. If the card works (D.6 step 6), keep it.
2. **If the card fails to start or the qube crashes, fall back to about 3 GB.** Your model sits in VRAM, not system RAM, so about 3 GB is usually enough to run pure-GPU inference where every layer is offloaded, which is why the main guide's `--n-gpu-layers 99` matters even more here. It is not enough to build llama.cpp, so you then build it in a separate ai-build qube (D.6 step 7).
3. **Do not patch dom0.** The unofficial max-ram-below-4g patch would allow more RAM at the cost of modifying dom0, the one component you least want to change.

### D.6 Passing the GPU to the AI qube

Honestly: this is the part that breaks. It is community-supported, version-specific, and depends on your board. Treat the commands as the shape of the procedure, and keep the Qubes community GPU-passthrough guide open for your exact release and card.

Steps, in a dom0 terminal unless stated. To open one, press Alt+F3, type `terminal` and choose Xfce Terminal. A dom0 window's title does not start with a qube name in square brackets; that is how you know it is dom0.

First create the AI template and the AI qube. The first command copies the standard Debian template into a new template for the AI software, the second creates the AI qube from it, and the third removes the AI qube's network:

```sh
qvm-clone debian-13-xfce ai-template
qvm-create --class AppVM --template ai-template --label red ai-llm
qvm-prefs ai-llm netvm ''
```

Expected: the clone takes a minute or two, then no output. If `qvm-clone` says the template does not exist, run `qvm-template list --installed` and use the Debian template's exact name.

1. **Find the card's addresses.** You need two kinds of address for the card, and Qubes 4.3 writes them differently, so read both from the screen rather than converting one into the other. First:

```sh
lspci | grep -i nvidia
```

Expected: two lines, for example:

```text
0a:00.0 VGA compatible controller: NVIDIA Corporation GA102 [GeForce RTX 3090] (rev a1)
0a:00.1 Audio device: NVIDIA Corporation GA102 High Definition Audio Controller (rev a1)
```

The start of each line, here `0a:00.0` and `0a:00.1`, is a *PCI address*: one for the graphics part of the card and one for its audio part. Yours may differ. Note both; steps 2 and 3 use them. Then:

```sh
qvm-pci
```

Expected: a list of devices, each with an ID in the first column and a description. Find the two lines with the same NVIDIA descriptions, and note their IDs exactly as printed. On Qubes 4.3 they can look like `dom0:00_01.1-00_00.0` and `dom0:00_01.1-00_00.1`. Step 5 uses them.

2. **Hide the card from dom0,** so dom0's own driver does not grab it at boot. Open the boot settings:

```sh
sudo nano /etc/default/grub
```

Find the line starting `GRUB_CMDLINE_LINUX=`. Inside its quotes, after what is already there, add a space and this, using your two PCI addresses from step 1:

```text
rd.qubes.hide_pci=0a:00.0,0a:00.1
```

Save and exit, then regenerate the boot configuration:

```sh
sudo grub2-mkconfig -o /boot/grub2/grub.cfg
```

Expected: a few `Found ...` lines and no errors. On Qubes 4.2 and later, this one file serves both older and UEFI systems, so do not write the configuration anywhere else. Restart the computer.

3. **Confirm dom0 is not using the card.** Use your graphics PCI address:

```sh
sudo lspci -nnk -s 0a:00.0
```

Expected: a line reading `Kernel driver in use: pciback`. If it still says `nvidia` or `nouveau`, the hide did not take; recheck step 2.

4. **Give the AI qube a kernel of its own, and its memory.** A passed-through GPU needs the qube to boot its own kernel in HVM mode, not the one Qubes provides. In dom0:

```sh
qvm-prefs ai-llm virt_mode hvm
qvm-prefs ai-llm kernel ''
qvm-prefs ai-llm maxmem 0
qvm-prefs ai-llm memory 8000
```

`kernel ''` means use the kernel inside the qube. `maxmem 0` turns off memory balancing, which passthrough needs. `memory 8000` gives it about 8 GB (D.5). Expected: no output from any of these.

In the AI template, install a real kernel and the boot support, so the qube has something to boot. Open a terminal in ai-template from the Qubes app menu, where it is listed under Templates, and run:

```sh
sudo apt-get install linux-image-amd64 linux-headers-amd64 grub2 qubes-kernel-vm-support
```

Expected: apt-get installs the kernel and grub. If a dialog asks where to install GRUB, select `/dev/xvda` with the Space bar, then press Enter. If no dialog appears, run `sudo grub-install /dev/xvda` afterwards. An error from grub-probe that mentions `/dev/mapper/dmroot` can be ignored.

Then, in the same template terminal, add the `non-free` section that the NVIDIA driver lives in, and install the driver, CUDA and build tools, the same list as 9.4:

```sh
sudo sed -i 's/contrib non-free-firmware/contrib non-free non-free-firmware/' /etc/apt/sources.list
grep non-free /etc/apt/sources.list
sudo apt-get update
sudo apt-get install linux-headers-amd64 nvidia-kernel-dkms nvidia-driver nvidia-smi nvidia-cuda-toolkit nvidia-cuda-toolkit-gcc build-essential cmake git firefox-esr qrencode util-linux-extra
```

Expected: `sed` prints nothing. `grep` prints the archive lines, each now containing `contrib non-free non-free-firmware`; if it prints nothing, the template's sources look different, so add `non-free` by hand with `sudo nano /etc/apt/sources.list`. The install then behaves as section 10 describes. When it finishes, shut the template down from dom0 with `qvm-shutdown --wait ai-template`, so that ai-llm picks up the new software.

5. **Assign the card.** On Qubes 4.3 this uses the device-assignment API. Assign both parts of the card to the same qube, using the IDs exactly as `qvm-pci` printed them in step 1:

```sh
qvm-pci assign --required ai-llm <graphics ID>
qvm-pci assign --required ai-llm <audio ID>
```

`--required` means the qube will not start unless the card is present. Expected: no output. You can do the same in the qube's Settings, Devices tab, which is the easier path on 4.3.

If the qube later fails to start with a PCI reset error, remove the assignment and add it again with an option, trying one option at a time before combining them:

```sh
qvm-pci unassign ai-llm <graphics ID>
qvm-pci assign --required ai-llm <graphics ID> -o no-strict-reset=true
```

and, only if it is still stuck, `-o permissive=true`. Both widen the attack surface, so use the fewest that work. On 4.3 the `nomodeset` boot option is removed automatically when a GPU is attached, so you do not manage that yourself.

6. **Start the qube and check the driver sees the card.** Open a terminal in ai-llm from the Qubes app menu; that starts the qube. In it:

```sh
nvidia-smi
```

Expected: the table from section 10 of the main guide, listing the RTX 3090 and about 24576 MiB. If it reports no device, the card did not pass through; see D.10. If the qube will not start, or crashes, with 8 GB, lower its memory in dom0 with `qvm-prefs ai-llm memory 3000` and try again (D.5).

7. **Build llama.cpp.** Bring the llama.cpp bundle and chat page archive in with `qvm-copy` (D.7), and check and build them as section 11 describes, with one difference: the files arrive in `~/QubesIncoming/<source-qube>/` instead of `~/in/<stamp>`. The phone checks still apply.
   - If ai-llm has 8 GB, do all of this inside ai-llm.
   - If you had to fall back to about 3 GB, build in a separate ai-build qube instead. Create it in dom0:

```sh
qvm-create --class AppVM --template ai-template --label orange ai-build
qvm-prefs ai-build netvm ''
qvm-prefs ai-build maxmem 12000
```

Expected: no output. Build there, then, inside ai-build, send the finished programs to ai-llm:

```sh
qvm-copy ~/src/llama.cpp/build/bin
```

Choose ai-llm in the dialog. Inside ai-llm, move them to where the launcher (13.1) expects them:

```sh
mkdir -p ~/src/llama.cpp/build
mv ~/QubesIncoming/ai-build/bin ~/src/llama.cpp/build/
```

Expected: no output. The binaries are built with an `$ORIGIN` rpath in the main guide, so they run from their new folder.

Then bring in a model and run it as in sections 12 and 13, inside ai-llm, with one change: keep models in your home folder, for example `~/models` (create it with `mkdir -p ~/models`), and write the launcher's model line as `MODEL=$HOME/models/<file>.gguf`. Anything outside the home folder disappears when the qube restarts.

Once the card has been assigned to ai-llm and that qube has run, the card does not return to dom0 on its own. That is intended. Do not try to reattach a GPU to dom0.

### D.7 Updates and downloads

Two paths cross the boundary now, and they are not the same.

**Downloads (models, llama.cpp, template installs): over Tor, into a disposable.** Fetch in a Whonix disposable qube, which routes through sys-whonix over Tor. Then move the file into ai-llm. In the disposable, run `qvm-copy` on the file:

```text
qvm-copy FILENAME
```

Expected: a dialog asking which qube to copy to; choose ai-llm. The file lands in `~/QubesIncoming/<source-qube>/` inside ai-llm. From there, hash it and check it exactly as section 12 of the main guide says. The phone check still applies: the publisher's own checksum, verified on a device that is not this computer.

The one-way rule from section 5 carries over and matters more here, because the drive is now a command: only ever `qvm-copy` into ai-llm. Never copy from ai-llm to a qube that has a network. If you must get output out of ai-llm, such as a benchmark log you have read, treat it with the same suspicion as the OUT drive in the main guide.

**Template updates: over Tor, or fully offline.** To let the AI template update over Tor, install Whonix first. Check the current template version rather than assuming it:

```sh
qvm-template list --available | grep whonix
```

Expected: lines for the current `whonix-gateway` and `whonix-workstation`, each with a version number. Install those exact names, then build the service qubes (replace the version shown):

```text
qvm-template install --enablerepo=qubes-templates-community whonix-gateway-VERSION whonix-workstation-VERSION
sudo qubesctl state.sls qvm.anon-whonix
```

Expected: the templates download through your normal update qube (over Tor only if you chose to update through Whonix when you installed Qubes), then `sys-whonix` and `anon-whonix` are created. To route all template updates through Tor from now on, apply the updates-via-whonix state:

```sh
sudo qubesctl state.sls qvm.updates-via-whonix
```

Expected: it writes a line like the following into `/etc/qubes/policy.d/50-config-updates.policy`, after which template updates go over Tor. This affects every template, not just the AI one.

```text
qubes.UpdatesProxy  *  @type:TemplateVM  @default  allow target=sys-whonix
```

If instead you want the AI template to never touch the network at all, like the main guide, skip Whonix for it: fetch the .deb files in a disposable, `qvm-copy` them into the template, and `apt-get install` them there from the copied files. More work, stronger guarantee.

### D.8 Lock the AI qube down

By default, qubes can ask each other to copy files, open files, and run programs, and the shipped policy allows some of those to a disposable without even prompting. For the one qube whose whole job is to run untrusted model files, shut those doors.

Set its default disposable to none, so a compromised ai-llm cannot spawn a disposable to carry data out:

```sh
qvm-prefs ai-llm default_dispvm ''
```

Expected: no output.

Then create a policy file in dom0 with `sudo nano /etc/qubes/policy.d/30-ai.policy`. The `30` sorts before the `50` default files, so it wins. Type one blunt rule: ai-llm may not call any service in any other qube.

```text
*  *  ai-llm  @anyvm  deny
```

This denies every qrexec call from ai-llm, including file-copy, open-in-VM, open-URL and run-command, to every target. Expected: after you save the file, calls from ai-llm are refused. Test it: from inside ai-llm, a `qvm-copy` should now fail. Copies into ai-llm from your download disposable still work, because the policy keys on the source, and ai-llm is never the source there.

Leave ai-llm with no netvm:

```sh
qvm-prefs ai-llm netvm ''
```

Expected: no output. This is the air gap, enforced by the hypervisor instead of by the absence of a cable.

### D.9 Checks

Add these to the section 15 list when on Qubes:

| Check | Command (in dom0 unless noted) | Expected |
|---|---|---|
| dom0 released the GPU | `sudo lspci -nnk -s <graphics PCI address>` | `Kernel driver in use: pciback` |
| Card reached the qube | `nvidia-smi` in ai-llm | RTX 3090, about 24576 MiB |
| AI qube has no network | `qvm-prefs ai-llm netvm` | empty |
| AI qube cannot call out | `qvm-copy` from inside ai-llm | refused by policy |
| No disposable escape | `qvm-prefs ai-llm default_dispvm` | empty |

### D.10 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `nvidia-smi` in the qube says no devices | The card did not pass through | Check `pciback` in dom0 (D.6 step 3). Check both parts of the card were assigned, with the IDs `qvm-pci` printed. Check the qube is HVM with `kernel ''`. |
| Qube will not start, PCI reset error | Arbitrator too strict for this board | Unassign, then assign again with `-o no-strict-reset=true`, then if needed `-o permissive=true` (D.6 step 5). |
| GPU qube fails to start the card, hangs or corrupts memory | Too much RAM for this board's passthrough | Lower `memory` to about 3000 (D.5). |
| Template cannot find nvidia packages | Sources missing `non-free` | Add `non-free` in `/etc/apt/sources.list` (D.6 step 4). |
| Build killed for lack of RAM | Not enough RAM to compile | Build in an ai-build qube and `qvm-copy` the binaries (D.6 step 7). |
| Models or settings gone after restarting ai-llm | They were stored outside the home folder | Keep models in `~/models` and the power limit in `/rw/config/rc.local` (D.4, D.6). |
| dom0 display dead after hiding the card | dom0 had no other GPU | You need an iGPU or second GPU for dom0 (D.3). Undo by removing `rd.qubes.hide_pci` at the grub edit screen. |

## Appendix E: Offline operation and internet access

### E.1 It already runs with no internet

The model is a file. llama.cpp loads the weights from disk and generates everything locally, on the GPU. Nothing in normal operation needs a network. That is the whole point of the build, and it is why the main guide can cut the network for good in section 8 and lose no function. You can run the box for years, unplugged from everything, and it will answer exactly as well on day one thousand as on day one.

### E.2 What offline costs you

The model knows only what was baked into its weights when it was trained, frozen at a cutoff date. Offline, that has three consequences, and you should design around them:

- **No live facts.** It cannot tell you today's price, today's news, who holds an office now, or anything that happened after its training cutoff. It has no clock and no feed.
- **It will not say it does not know; it will invent.** Asked past what it learned, a model produces a fluent, confident, wrong answer. Offline you have no second source to catch it. Treat every factual claim as unverified.
- **No tools.** It cannot open a URL you paste, fetch a file, or run a search, because none of those reach anywhere.

Two ways to blunt this without breaking the gap:

1. **Carry a reference library in.** Bring a local, offline copy of a reference collection across on the IN drive, look things up in it yourself, and paste what you need into the chat; llama.cpp cannot read it directly. Offline Wikipedia is the usual one: fetch a Wikipedia archive on the connected machine, carry it in, and browse it on the box. The reader, Kiwix (package `kiwix`), is in the Devuan repositories, so it installs through the normal offline-package process in section 9. The archive is a new kind of file under rule 5 (5.1), and like a model file it is read by a program on the box, so download it only from Kiwix's official site, check its checksum against the one published there with a phone check, and add it to your copy of the rules card (Appendix C). Now you have facts to check the model against, on the same box, still with no network.
2. **Feed it the text yourself.** When you have a document you want it to use, save it as a plain `.txt` file with a plain name (5.3), read it through, bring it in on the IN drive, open it on the box with `less`, and paste from there into the prompt. The model reasons over what is in front of it perfectly well; it just cannot go and get it.

### E.3 What if I want it to check a site online

Here is the hard part, stated plainly: you cannot give this box live web access and keep it air-gapped. They are opposites. The moment the box can reach the internet, every protection in this guide is void. A poisoned model file, or a tampered llama.cpp, could then send anything on the box out to anywhere, and the whole design exists to stop exactly that. Letting the AI check a site is not a setting you toggle; it is giving up the gap.

So the real question is which machine does the reaching. Your options, best first:

1. **Keep the box air-gapped; do the lookup on the connected machine and carry the text in (recommended).** When you want the model to work with a web page, open the page on the ordinary connected machine (section 4, or a Whonix disposable on the Qubes build), save its text as a plain `.txt` file with a plain name, read it through, carry it in on the IN drive, open it on the box with `less`, and paste it in. You get the model reading that page with zero packets leaving the box. You already have this pipeline; this is just using it for web pages instead of software.
2. **Run a second, ordinary machine for anything that needs to be online.** Keep this box for everything sensitive, and use a normal networked computer, with a normal model that can browse, when you genuinely need live lookups. Clean separation, two machines. Pick this if you do online lookups often enough that carrying text in by hand is a chore.
3. **Drop the air gap on this box (not recommended).** Give it a network and let the model fetch pages directly. This turns a deliberately air-gapped workstation into an ordinary one. You lose every guarantee the gap gave you, and a bad model file can now phone home. Only if the box holds nothing you would mind leaking, in which case you did not need this guide.

The recommendation, by the axis that drives it: security. Option 1 keeps the gap intact and still answers the real need, so it wins. The inconvenience of carrying a page in by hand is the price of the gap, and it is small. If that price is too high for how you actually work, that is a sign you want option 2, a separate online machine, not a hole in this one.