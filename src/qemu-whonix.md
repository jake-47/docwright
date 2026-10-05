# QEMU and Whonix Guide

This guide shows you how to install QEMU, the program that runs virtual machines, on Debian 13, with a small [qemu-install] script.sh`. Then it shows you how to set up [Whonix](#whonix) and use it for your anonymous accounts.

Follow the steps in order. Most of the action happens in a terminal. Copy each command from here and paste it into the terminal with Ctrl+Shift+V.

In this guide, text in `code font` is something you type, or exact text you should see. Text in **bold** is something on the screen that you click or choose.

## What you are setting up

A virtual machine is a computer made of software. It runs in a window on your real computer, with its own operating system, files and programs. Your real computer is called the host. The computer in the window is called the guest.

### QEMU

QEMU is the program that runs virtual machines. KVM is the part of Linux that lets QEMU use a feature built into your processor, called hardware virtualization. With it, virtual machines run at nearly full speed. Without it, they are much slower, and some won't start at all.

### Whonix

Whonix is two virtual machines that work as a pair. The Gateway connects to the Tor network. The Workstation is where you browse and work. The Workstation has no direct way out to the internet. Everything it sends goes through the Gateway and over Tor. So programs inside the Workstation can't see your real IP address, even if they try.

### libvirt and Virtual Machine Manager

Whonix's two virtual machines are managed by libvirt, a background service on your computer that starts and stops them and sets up their networking. You control libvirt through Virtual Machine Manager, a program with start and stop buttons for each machine and a window that shows its screen. Some steps also use `virsh`, a command that gives libvirt the same instructions from the terminal.

## What you need

- A 64-bit Intel or AMD computer.
- Debian 13 or Devuan 6.
- A processor with hardware virtualization. Most processors from the last ten years have it, but it is sometimes switched off. Step 1 checks this for you.
- At least 10 GB of free disk space. That is Whonix's minimum. Keeping the download, and each extra Workstation you make, needs several GB more.
- Enough memory. Each Whonix machine is set to use 2 GB, so the pair needs 4 GB on top of what your computer already uses. Whonix suggests a computer with 8 GB of RAM.
- An internet connection. The Whonix download is just over 4 GB.

## 1. Check that your computer can run virtual machines

Use the [script](./qemu-install.md). Download it. It is a plain text file, so you can open it in a text editor and read it before you run it.

Open a terminal and run:

```bash
cd ~/Downloads
bash qemu-install.sh check
```

If it says this, your computer is ready:

```text
hardware acceleration is available
```

If you haven't installed anything yet, it may say this instead. That's fine, because step 2 takes care of it:

```text
/dev/kvm exists but you cannot read and write it
run 'qemu-install.sh install' to join the kvm group, then start a new login session
```

If it starts with `no vmx or svm flag`, [switch on hardware virtualization first](#switch-on-hardware-virtualization). If it says `/dev/kvm is missing`, [load the KVM module first](#load-the-kvm-module). If it says `No such file or directory`, [fix this first](#no-such-file-or-directory).

## 2. Install QEMU

```bash
cd ~/Downloads
bash qemu-install.sh install
```

Here is what happens, in order:

1. It asks for your password, with a line like `[sudo] password for NAME:`. Type your password and press Enter. Nothing shows while you type.

   > If it says you are not in the sudoers file, or that there is no sudo, [set up sudo first](#set-up-sudo).

2. It prints `refreshing package lists...`, followed by apt's messages as it checks for the newest packages.

   > If it then says `apt-get update failed`, [fix the package source first](#refreshing-the-package-lists-failed).

3. It prints `installing or updating qemu...`. Then apt lists the packages it will add and asks `Do you want to continue? [Y/n]`. Type `y` and press Enter.

4. apt downloads and installs the packages. This takes a few minutes.

   > If it stops with `apt could not finish`, [read apt's error first](#apt-could-not-finish).

When it's done, the end of what it prints looks like this, with your user name in place of NAME:

```text
qemu is up to date: QEMU emulator version
adding NAME to kvm...
log out and back in before kvm takes effect
```

The first line also shows which version of QEMU you now have. The other two lines appear only if step 1 said you cannot read and write `/dev/kvm`. They mean the script added you to the kvm group, which lets you use hardware virtualization without being the administrator. That only takes effect when you next log in.

If the last line starts with `qemu is up to date`, you're done here. Go on to step 3.

If the last line says to log out and back in, restart the computer. Logging out and back in usually works too, but restarting always does. Then check again:

```bash
cd ~/Downloads
bash qemu-install.sh check
```

It should say `hardware acceleration is available`. If it says something else, [fix this first](#hardware-acceleration-is-still-not-available).

> If you'd rather type the commands yourself, these do the same job:
>
> ```bash
> sudo apt-get update
> sudo apt-get install --no-install-recommends qemu-system-x86 qemu-system-gui qemu-utils ovmf
> sudo adduser "$(whoami)" kvm
> ```
>
> The first prints lines starting with `Hit:` or `Get:`, and ends with `Reading package lists... Done`. The second lists the packages it will add and asks `Do you want to continue? [Y/n]`. Type `y` and press Enter. The last one says it is adding your user to the group kvm. You only need it if step 1 said you cannot read and write `/dev/kvm`. After it, restart the computer, then run the check above.

## 3. Install the programs Whonix uses

Whonix needs a few more programs on top of QEMU. First refresh the package lists:

```bash
sudo apt update
```

It prints lines starting with `Hit:` or `Get:`. It ends by saying that all packages are up to date, or how many can be upgraded.

Then copy the install command from Whonix's KVM page. It is in the section **Install KVM**, under **Debian**, on the line for **Debian trixie+ on Intel / AMD**:

```bash
sudo apt install --no-install-recommends qemu-system-x86 qemu-system-gui qemu-system-modules-spice qemu-utils libvirt-daemon libvirt-daemon-driver-qemu libvirt-daemon-driver-storage libvirt-clients virt-manager gir1.2-spiceclientgtk-3.0 passt ovmf swtpm swtpm-tools safe-rm xz-utils
```

If the line on their page is different, use theirs.

apt lists what it will add and asks `Do you want to continue? [Y/n]`. Type `y` and press Enter.

This is Whonix's rootless setup. Your virtual machines run under your own account, and no background service runs with administrator rights.

## 4. Download Whonix

Go to Whonix's KVM page: <https://www.whonix.org/wiki/KVM>

Scroll down to **Download Whonix**. Under **GUI**, then **stable LXQt**, click the button that starts with **Download Whonix LXQt (KVM) (stable)**. This is the version with a desktop.

> The CLI version has no desktop, only a text screen. The testers version is for people who help test new releases, so skip it.

The file's name ends in `.Intel_AMD64.qcow2.libvirt.xz`. As the page says, downloading and installing Whonix means you agree to its [Terms of Service](https://www.whonix.org/wiki/Terms_of_Service) and [License Agreement](https://www.whonix.org/wiki/License_Agreement).

Under the download button there is a box with tabs. On the tab called **OpenPGP LXQt stable**, click both buttons:

- **OpenPGP Signature**. It saves a small file with the same name as the big one, plus `.asc` on the end.
- **Download Whonix OpenPGP Key**. It saves a file called `derivative.asc`.

If your browser shows a page of text instead of saving a file, go back. Then right-click the button and choose **Save Link As**.

Save all three files in your Downloads folder. Make sure there are no older Whonix downloads in that folder, because the commands below would pick them up too.

## 5. Check that the download is genuine

This step proves the download really came from the Whonix developers and wasn't changed on the way to you. Whonix calls it optional, but it is worth the few minutes it takes.

It uses a program called gpg, which is usually already installed. If a command below says `gpg: command not found`, install it with `sudo apt install gnupg` and try again.

First, look at the key before you trust it:

```bash
cd ~/Downloads
gpg --keyid-format long --import --import-options show-only --with-fingerprint derivative.asc
```

This only shows the key. It doesn't save it yet. Find the line that starts with `Key fingerprint`. It must read exactly:

```text
Key fingerprint = 916B 8D99 C38E AF5E 8ADC  7A2A 8D66 066A 2EEA CCDA
```

Compare it group by group. If even one character is different, or there is no `Key fingerprint` line at all, [stop and fix this first](#the-key-fingerprint-does-not-match).

The first time you ever use gpg, it may also print lines saying it created a directory and a keybox. That's normal.

When the fingerprint matches, save the key:

```bash
gpg --import derivative.asc
```

You should see:

```text
gpg: key 8D66066A2EEACCDA: public key "Patrick Schleizer <adrelanos@kicksecure.com>" imported
gpg: Total number processed: 1
gpg:               imported: 1
```

Patrick Schleizer is Whonix's lead developer. If you have saved this key before, it says `not changed` instead, which is fine too.

Now check the download itself. This can take a minute:

```bash
gpg --verify-options show-notations --verify Whonix-*.libvirt.xz.asc Whonix-*.libvirt.xz
```

Look for these three things in what it prints:

- A line starting `gpg: Signature notation: file@name=`, followed by the name of your download.
- A line saying `Good signature from "Patrick Schleizer`. This is the one that matters most.
- A line saying `Primary key fingerprint: 916B 8D99 C38E AF5E 8ADC  7A2A 8D66 066A 2EEA CCDA`.

You will also see this warning:

```text
gpg: WARNING: This key is not certified with a trusted signature!
gpg:          There is no indication that the signature belongs to the owner.
```

The warning is normal. gpg is saying that you haven't told it you trust this key. It says nothing about the file. Comparing the fingerprint yourself, as you did above, is how you check the key.

If it says `BAD signature`, don't go on, and [fix this first](#gpg-reports-a-bad-signature). If it says `No public key`, [save the key first](#gpg-cannot-find-the-public-key).

## 6. Unpack Whonix and add it to your computer

### Unpack the download

```bash
cd ~/Downloads
tar -xSvf Whonix*.libvirt.xz
```

Use tar exactly like this, and don't use unxz. Whonix asks for this, and the `S` in `-xSvf` keeps the unpacked disk files small on your drive.

This takes a while. It prints each file name as it unpacks it. Among them are two files ending in `.xml`, two ending in `.qcow2`, and one called `WHONIX_BINARY_LICENSE_AGREEMENT`. Wait until the prompt comes back. If tar says `Not found in archive`, [fix this first](#more-than-one-download-in-the-folder).

Whonix's page then has you make an empty file to record that you accept the licence. Nothing uses that file, so skip it.

### Adjust the libvirt settings

Two things libvirt does by default get in Whonix's way.

First, libvirt tries to raise a limit that only the administrator may raise. When it can't, the machines refuse to start.

Second, if you log out or shut down your computer while Whonix is running, libvirt saves the machines' memory to your disk, and brings them back the next time it starts. Whonix strongly discourages saving, because it upsets Whonix's clock, and the saved memory can hold what you were doing.

Open the settings file in the nano text editor:

```bash
mkdir -p ~/.config/libvirt
nano ~/.config/libvirt/qemu.conf
```

The first command prints nothing, and the second opens nano. Paste these five lines into it:

```text
max_core = 0
max_processes = 0
max_files = 0
auto_shutdown_try_save = "none"
auto_shutdown_restore = 0
```

To save and close, press Ctrl+X, then Y, then Enter.

The first three lines come from Whonix's page, and stop the start-up error. The last two are not on Whonix's page. With them, libvirt asks the machines to shut down instead of saving them, switches them off if they haven't after 30 seconds, and doesn't start them again by itself.

Do this before the next part. libvirt reads this file only when it starts, and the next part is what starts it.

### Add the two machines

```bash
cd ~/Downloads
virsh -c qemu:///session define Whonix-Gateway*.xml
virsh -c qemu:///session define Whonix-Workstation*.xml
```

Each command prints one line, starting like this and ending with the name of the `.xml` file:

```text
Domain 'Whonix-Gateway' defined from
Domain 'Whonix-Workstation' defined from
```

The first command may take a few seconds, because libvirt starts a helper for your account the first time you use it. In these commands, `qemu:///session` means "the virtual machines that belong to my account". If a command says `unexpected data`, [fix this first](#more-than-one-download-in-the-folder). If it says `does not support virt type 'kvm'`, [fix this first](#kvm-is-not-available).

### Move the disk files into place

```bash
cd ~/Downloads
mkdir -p ~/.local/share/images
mv Whonix-Gateway*.qcow2 ~/.local/share/images/Whonix-Gateway.qcow2
mv Whonix-Workstation*.qcow2 ~/.local/share/images/Whonix-Workstation.qcow2
```

These print nothing. Each disk file is labelled as 100 GB, but only takes up the space it really holds. If you ever copy them, use `cp --sparse=always`, as Whonix says, so the copy stays small too.

### Tell libvirt where the disk files are

Whonix's machine settings look for their disk files in a storage pool called `default`. A storage pool is libvirt's name for a folder of disk files. Without this part, the Gateway won't start.

Do this before you open Virtual Machine Manager for the first time. Otherwise Virtual Machine Manager makes its own pool called `default`, in a different folder.

```bash
virsh -c qemu:///session pool-define-as default dir --target ~/.local/share/images
virsh -c qemu:///session pool-start default
virsh -c qemu:///session pool-autostart default
```

These create the pool for that folder, switch it on, and set it to switch on by itself from now on. They print:

```text
Pool default defined
Pool default started
Pool default marked as autostarted
```

If the first one says the pool `default` already exists, [fix this first](#a-storage-pool-called-default-already-exists).

Now check that libvirt sees both disk files:

```bash
virsh -c qemu:///session vol-list default
```

It lists both, with your user name in place of NAME:

```text
 Name                       Path
---------------------------------------------------------------------------------
 Whonix-Gateway.qcow2       /home/NAME/.local/share/images/Whonix-Gateway.qcow2
 Whonix-Workstation.qcow2   /home/NAME/.local/share/images/Whonix-Workstation.qcow2
```

If one is missing, check that both files are in the folder with `ls -l ~/.local/share/images`. Move any missing file there as shown above, then run `virsh -c qemu:///session pool-refresh default` and check again.

### Keep the download

Whonix suggests deleting the download and the leftover files now, or moving them somewhere else, so an old copy can't get mixed up with a newer one later. Move them into a folder of their own. Then you can set up Whonix on another computer without downloading it again.

```bash
cd ~/Downloads
mkdir -p ~/whonix-download
mv Whonix* WHONIX* derivative.asc ~/whonix-download/
```

These print nothing. Your virtual machines don't need these files. Their disk files are now in `~/.local/share/images`.

To set Whonix up on another computer, copy this folder, not the disk files. On most USB sticks, each disk file would take up its full 100 GB, or wouldn't fit at all. Use a USB stick formatted as exFAT or ext4. FAT32, the format many sticks come with, can't hold a file as big as the download.

If you set Whonix up from these files again later, it will be out of date. Update it straight away, as in step 8.

## 7. Start Whonix

### Open Virtual Machine Manager

Open Virtual Machine Manager. It is in your applications menu, usually under **System**. You can also start it by typing `virt-manager` in a terminal.

The first time, its window shows a line called **QEMU/KVM**, which may say **Not Connected**. An error may also pop up, saying it can't connect. That line is for virtual machines set up for the whole computer, and this guide doesn't use it. Close the error. It doesn't come back.

You can leave the **QEMU/KVM** line there. To remove it, first add your own connection below. Then right-click the **QEMU/KVM** line, choose **Delete**, and click **Yes**. That only removes the line from the list.

### Connect to your own virtual machines

1. Click **File**, then **Add Connection**.
2. Set **Hypervisor** to **QEMU/KVM user session**. A note appears, saying the user session is not the default. That's expected.
3. Leave **Autoconnect** ticked. It is ticked already.
4. Click **Connect**.

A new line appears, called **QEMU/KVM User session**. Under it are Whonix-Gateway and Whonix-Workstation, both marked **Shutoff**. Because **Autoconnect** is ticked, Virtual Machine Manager opens this connection by itself from now on. If the two machines aren't there, [fix this first](#the-machines-are-not-in-the-list).

### Using a machine's window

Each machine has its own window. To open it, double-click the machine in Virtual Machine Manager. You see and use the machine there. Read this before you start one, because the window works differently from other windows in a few ways:

- Closing the window doesn't stop the machine. It keeps running. To open the window again, double-click the machine in Virtual Machine Manager. To stop the machine, shut it down, as [Start and stop](#start-and-stop) shows.
- The **Run** button in Virtual Machine Manager's main window also starts a machine, but doesn't open its window. Double-click the machine to see it.
- The machine's screen shrinks or grows to fit its window. To make it bigger or smaller, resize the window, or use the window's maximize button. In the window's **View** menu, under **Scale Display**, keep **Always** chosen and **Auto resize VM with window** unticked. Whonix's [KVM page](https://www.whonix.org/wiki/KVM) suggests this instead of changing the machine's screen resolution.
- Inside the Workstation, don't change the screen resolution or the text size, and don't maximize or resize Tor Browser's window. Whonix's [Screen page](https://www.whonix.org/wiki/Screen) asks you to keep all three at their defaults.
- Full screen fills your whole screen with the machine. To turn it on, click the button at the right end of the window's toolbar, or click **View**, then **Fullscreen**. To leave full screen, move the pointer to the very top of the screen, in the middle. A small bar appears there. Click **Leave Fullscreen** on that bar.
- The machine may keep your mouse pointer after you click inside it. The window's title then says which keys release it, usually the left Ctrl and left Alt keys pressed together. In full screen there is no title, but the same keys work.
- While the pointer is over the machine's screen, your computer's own shortcuts, such as the ones that switch workspaces, go to the machine instead. To go to another workspace on your computer, press and release the left Ctrl and left Alt keys together, then press the shortcut before you move the mouse. In XFCE the shortcut is Ctrl+Alt+Left or Ctrl+Alt+Right, or Ctrl+F1, Ctrl+F2 and so on for a numbered workspace. Moving the mouse over the machine gives it the keys again, so if nothing happens, move the mouse a little and try again. When the machine is in a window, not full screen, you can instead move the pointer off the machine's screen, onto the window's title bar for example, and press the shortcut.
- Copy and paste between your computer and the machine doesn't work, and neither does dragging files into it. Whonix switches both off on purpose. To bring in files, see [Copy files into the Workstation](#copy-files-into-the-workstation).

### Start the Gateway

1. Double-click **Whonix-Gateway**. Its own window opens, saying `Guest is not running`.
2. Click **Run** in that window's toolbar. It is shaped like a triangle, and its tooltip says **Power on the virtual machine**.
3. Some start-up text and a boot menu appear for a few seconds. The boot menu then starts the normal session by itself. Wait for the Gateway's desktop.

If an error appears instead, find its message here:

- `Storage volume not found` or `Storage pool not found`: [fix this first](#storage-volume-not-found).
- `storage pool 'default' ... is not active`: [fix this first](#storage-pool-is-not-active).
- A message starting `cannot limit`: [fix this first](#cannot-limit-core-file-size-or-open-files).
- A message that mentions `KVM_CREATE_VM`: [fix this first](#another-virtualization-program-is-running).
- Any other message that mentions KVM: [fix this first](#kvm-is-not-available).

### Connect to Tor

For safety, Whonix doesn't connect to Tor by itself the first time it starts. Instead, a window called Anon Connection Wizard opens on the Gateway's desktop. If it doesn't appear, [open it yourself](#the-connection-wizard-does-not-appear).

It asks which option best describes your situation:

- **Connect** is already chosen. Choose it if Tor isn't blocked where you are. It works in most places.
- **Configure** is for places where Tor is blocked, or where using it is dangerous or looked on with suspicion. It lets you use bridges, which are entry points to the Tor network that aren't on its public list. Tick the box that says you need bridges, and choose **obfs4**. Whonix suggests trying obfs4 first, and meek only if obfs4 doesn't work. Leave the proxy box unticked, unless your network makes you use a proxy. Bridges help you get past a block, but Whonix says hiding your Tor use from your internet provider isn't possible in practice.

Click **Next** until it starts connecting. When it says `Tor bootstrapping done`, click **Finish**. If it can't connect, [fix this first](#the-gateway-cannot-connect-to-tor).

The Gateway keeps your choice, so later starts connect the same way. To change it, run Anon Connection Wizard again from the Gateway's start menu.

### Start the Workstation

Leave the Gateway running. The Workstation reaches the internet only through it.

Go back to Virtual Machine Manager's main window. Double-click **Whonix-Workstation**, then click **Run**, as you did for the Gateway. Both machines log in by themselves, to an account called `user`.

### Check the connection

In the Workstation, open a terminal from the start menu and run:

```bash
systemcheck
```

It can take a few minutes. Among the lines it prints, you should see:

```text
[INFO] [systemcheck] Connected to Tor.
```

If it reports a problem instead, it names what needs attention. The most common one is a Gateway that isn't connected yet, so [start with this fix](#the-gateway-cannot-connect-to-tor).

If your keyboard types the wrong characters inside Whonix, set the keyboard layout as Whonix's [Post Install Advice](https://www.whonix.org/wiki/Post_Install_Advice) shows.

Whonix is now working. Update both machines next, in step 8.

## 8. Keep Whonix up to date

Whonix keeps everyday use and system changes apart. Your everyday session can't install anything. That job belongs to a separate session called sysmaint, short for system maintenance. So if harmful software ever gets into your browser, it can't change the system.

Update the Gateway first, then the Workstation. The Workstation's updates come in through the Gateway, so keep the Gateway running while the Workstation updates.

For each machine:

1. Restart it. Use the machine's own start menu, or click the small arrow next to **Shut Down** in its window, then **Reboot**.
2. When the boot menu appears, click inside the window. Use the arrow keys to choose the entry with `SYSMAINT` in its name, and press Enter. You have a few seconds before it starts the normal session by itself. If it does, restart and try again.
3. The machine starts a plain desktop with the System Maintenance Panel open. Click **Check for Updates**. A terminal opens and checks for the newest packages.
4. When it has finished, click **Install Updates**. If it asks `Do you want to continue? [Y/n]`, type `y` and press Enter.
5. When that has finished, click **Reboot**. The machine starts its normal session by itself.

If you prefer typing, click **Open Terminal** in the System Maintenance Panel instead, and run:

```bash
sudo apt update && sudo apt full-upgrade
```

Whonix asks you to check for updates regularly and install them promptly.

Tor Browser, inside the Workstation, updates itself. When it offers an update, let it restart.

If `sudo` inside Whonix ever says permission denied, you are in the everyday session. Restart into sysmaint as above.

## 9. Tighten security

### Do these once

**Remove the sound device.** Whonix's hardening checklist recommends removing each machine's virtual sound card. Whonix's settings already leave the microphone out, but the speakers, which can be used to profile you, are still there. Do this for the Gateway, which never needs sound, and for the Workstation, unless you want sound from it:

1. Shut the machine down.
2. In Virtual Machine Manager, double-click the machine to open its window. Click **View**, then **Details**. A list of the machine's parts appears on the left.
3. In that list, click **Sound ich9**.
4. Click **Remove**, then **Yes**.

To see the machine's screen again, click **View**, then **Console**.

**Set Tor Browser to Safest.** In the Workstation, start Tor Browser from the start menu. Open its menu, the three lines at the top right, and choose **Settings**, then **Privacy & Security**. Under **Security Level**, click **Change** if there is such a button. Choose **Safest**, then save and restart Tor Browser when it asks. At Safest, JavaScript is off on every site, and websites only get the features that simple pages need, so some sites won't work. Whonix's advice is to allow JavaScript only sparingly, for sites you trust. Don't save per-site exceptions that last from one session to the next, because they make you easier to recognise.

### Leave these as they are

Whonix switches these off in its machine settings, or advises against them, because they weaken the separation between your computer and Whonix. Leave them off:

- Copy and paste between your computer and Whonix.
- Dragging files between your computer and Whonix.
- 3D graphics.
- Sharing memory between machines, and letting a machine's memory grow and shrink while it runs.
- Passing devices from your computer into Whonix, such as USB sticks, phones or cameras. In a machine's window, don't use **Virtual Machine**, then **Redirect USB device**.
- Shared folders, unless you need one to bring files in. If you do, use the read-only kind that [Copy files into the Workstation](#copy-files-into-the-workstation) shows.

Each machine's settings also carry Whonix's own note: don't change anything unless you understand the consequences.

Inside Whonix, leave these alone too:

- The clock and the time zone. Whonix sets them to UTC, the world's standard time, so your own time zone can't give you away.
- The settings of programs that go online, such as Tor Browser. Whonix's advice is to change them only when you know what the change does.
- Tor Browser's add-ons. The Tor Project strongly discourages adding any, because they can make your browser stand out or leak data.

### Habits that keep you anonymous

Whonix hides your IP address, but what you do can still identify you. Here is Whonix's advice, in short:

- Keep your anonymous life and your normal life apart. Use Tor Browser in the Workstation for one, and your normal browser on your computer for the other, never both for the same thing.
- Don't log in to accounts tied to your real name. Social networks usually know who you are, even under a made-up name.
- Use one identity at a time. Give each identity its own Workstation, as [One Workstation per task](#one-workstation-per-task) shows, and shut one down before you start another.
- Be wary of files and links people send you, even from people you know. Their account could be in someone else's hands.
- Clean files before you share them. Photos and documents carry hidden details that can identify you. In the Workstation, run `mat2` followed by the file's name, such as `mat2 photo.jpg`. It makes a cleaned copy with `.cleaned` in its name, such as `photo.cleaned.jpg`, and leaves the original as it was. If mat2 reports a problem with bubblewrap, run `mat2 --no-sandbox photo.jpg` instead, as Whonix's page shows.
- Don't add a VPN to Whonix, and don't run Tor again inside the Workstation. A VPN is a service that sends your traffic through another company's server. Whonix's checklist strongly recommends against linking a VPN with Tor, and calls Tor over Tor "undefined and potentially unsafe".
- Shut both machines down when you're done, and before you log out, restart or shut down your computer. Don't use **Pause** or **Save** in Virtual Machine Manager, and don't let your computer go to sleep while Whonix runs, for example by closing a laptop's lid. Whonix strongly discourages pause, suspend, save and hibernate, because they upset its clock. If it happened anyway, restart both machines.
- Keep your computer's clock right, to within 30 minutes. If it is more than an hour slow, or more than three hours fast, Tor can't connect.

Whonix's full list is on its page [Tips on Remaining Anonymous](https://www.whonix.org/wiki/Tips_on_Remaining_Anonymous).

### On your own computer

- Keep it up to date, as [Updating later](#updating-later) shows. In this setup the virtual machines run as your own account, so keeping QEMU patched protects your own files too.
- Encrypt its disk. Everything Whonix saves lives in its disk files on your computer, so it is only as private as your computer's disk. Kicksecure, which Whonix is built on, recommends full disk encryption on the host rather than encrypting the machines.
- Whonix's [System Hardening Checklist](https://www.whonix.org/wiki/System_Hardening_Checklist) has more, including changes on your own computer. Examples are hiding your network card's address on networks away from home, and switching off TCP timestamps, which can reveal how long your computer has been running. Work through it once you're comfortable.

## Everyday use

### Start and stop

To start, open Virtual Machine Manager and start the Gateway. Wait for its desktop. It connects to Tor by itself now. Then start the Workstation.

When you're done, shut down the Workstation first, then the Gateway. Use the start menu inside each machine, or click **Shut Down** in its window, and click **Yes** when it asks. **Force Off**, in the menu next to **Shut Down**, is only for a machine that has stopped responding. It is like pulling the plug.

If Virtual Machine Manager ever shows a machine as **Saved**, [fix this before you start it](#a-machine-is-marked-saved).

### Log out and back in

To log out of a machine, open its start menu, choose **Leave**, then **Logout**, and click **Yes**.

A black screen then shows `Login` and `username:`. Type `user` and press Enter. The account has no password, as Whonix's [Default Passwords](https://www.whonix.org/wiki/Default_Passwords) page says. If it asks for one, press Enter without typing anything.

In a sysmaint session, type `sysmaint` instead. Each session only lets in its own account.

The same screen sometimes appears by itself when a machine starts. Log in the same way.

### What Whonix keeps

Whonix saves your work like a normal computer. Files, bookmarks, settings and updates all stay until you delete them. This is Whonix's persistent mode, and it is what the boot menu starts by itself.

Keep your files in folders you make for each project, inside your home folder, rather than loose in it. Tor Browser saves downloads in the Downloads folder. Move them from there into your project folders.

### Dark theme

The script `whonix-dark-super.sh` gives the Workstation a dark desktop. It darkens the panel, the menus, the window borders and the desktop's own programs, such as the file manager. It also makes the Super key, the one with the Windows logo on most keyboards, open a box where you type a program's name to start it.

Run it in Whonix-Workstation before you make copies, as the next part shows, and every copy starts out dark.

1. In the Workstation, open Tor Browser, download the script from the same place you got this guide, and save it in the Downloads folder.
2. Open a terminal from the start menu and run:

   ```bash
   bash ~/Downloads/whonix-dark-super.sh
   ```

   It prints `Done. Log out and back in.` Run it in the normal session, not sysmaint, and without `sudo`, because it changes your own settings.

3. Log out and back in, as [Log out and back in](#log-out-and-back-in) shows, or restart the Workstation.

### One Workstation per task

Whonix recommends a separate Workstation for each identity, or each group of related activities. If one of them is ever compromised, the others stay private.

The simplest way to do this is to keep Whonix-Workstation clean, and only update it. For each task, make a copy of it, and use the copy.

To make a copy:

1. Update Whonix-Workstation, as in step 8, then shut it down.
2. In Virtual Machine Manager, right-click **Whonix-Workstation** and choose **Clone**.
3. In **Name**, type a name for the task, such as `Whonix-Workstation-Research`, and click **Clone**. Copying takes a few minutes. The copy gets its own disk file next to the others, and its own network card address.

Whonix requires each extra Workstation to also have its own address inside Whonix's network. Set it once, in the copy:

1. Start the copy, and choose the entry with `SYSMAINT` in its name in its boot menu, as in step 8.
2. In the System Maintenance Panel, click **Open Terminal**, and run:

   ```bash
   sudoedit /etc/network/interfaces.d/30_non-qubes-whonix
   ```

3. The file opens in a text editor, usually nano. Find the line `address 10.152.152.11` and change the `11` at the end to `12`. Then find the line `address fd19:c33d:88bc::11` and change its `11` to `12` as well.
4. Save and close. In nano, that's Ctrl+X, then Y, then Enter.
5. Check the result:

   ```bash
   cat /etc/network/interfaces.d/30_non-qubes-whonix | grep --invert-match "#"
   ```

   Both address lines should now end in `12`.

6. Click **Reboot** in the System Maintenance Panel. The copy starts its normal session.

For your next copy, use `13` instead of `12`, then `14`, and so on.

Use each copy for its task only. Keep the clean Whonix-Workstation for updating and making copies.

Run one Workstation at a time. In this setup, every Workstation uses the same link to the Gateway, so two running at once would get in each other's way.

Each copy needs its own updates. Update it in sysmaint, like any other machine, as in step 8.

Start fresh from time to time. Whonix suggests deleting and recreating the machines you use for sensitive work every so often. To delete a copy, right-click it and choose **Delete**. Make sure **Delete associated storage files** is ticked, then click **Delete**. When it asks whether to delete the storage, check that the file it lists is the copy's own disk file, then click **Yes**. Then make a new copy from your clean Whonix-Workstation.

### Live mode, for throwaway sessions

Live mode runs a machine without saving your changes to its disk file. When you shut it down, what you did in that session is gone from the machine. To use it on the Workstation, choose the live mode entry in its boot menu.

Three cautions from Whonix and Kicksecure:

- Live mode can make your Tor use look different from other Tor users, which could weaken your anonymity somewhat. Tor runs on the Gateway, so keep the Gateway in its normal mode.
- Your own computer can still keep traces of what happened inside the machine, for example in swap, the part of your disk that Linux uses as extra memory. Live mode alone doesn't make your computer forget.
- Harmful software inside the machine could still write to its disk file. Kicksecure strongly recommends also making the disk read-only for live mode, and its [Live Mode page](https://www.kicksecure.com/wiki/Live_Mode) explains this.

### Copy files into the Workstation

Most of the time you won't need to. Download what you need inside the Workstation, and keep what belongs to an identity inside that identity's Workstation.

To bring in files from your own computer, give the Workstation a shared folder that it can read but not change. Add the folder to the Workstation that needs the files, such as a copy you made for a task. Don't add it to the clean Whonix-Workstation, because every copy you make from it would then share the same folder.

1. On your computer, make a new folder for that Workstation only, such as `whonix-shared-research` for Whonix-Workstation-Research:

   ```bash
   mkdir -p ~/whonix-shared-research
   ```

   This prints nothing.

2. In Virtual Machine Manager, shut down the Workstation that should get the files, such as Whonix-Workstation-Research. Then double-click it. Its window opens.
3. In that window, click **View**, then **Details**. A list of the machine's parts appears on the left.
4. Below that list, click **Add Hardware**. A new window opens.
5. In the new window's list, click **Filesystem**, then fill in the form:
   - **Driver**: choose **virtio-9p**. If a note about shared memory appears, ignore it. It goes away when you choose **virtio-9p**.
   - **Source path**: type the full path to your folder, such as `/home/NAME/whonix-shared-research`, with your user name in place of NAME.
   - **Target path**: type `shared`. Always type `shared`, whatever your folder is called, because that is the name Whonix looks for.
   - Tick **Export filesystem as readonly mount**. This lets the Workstation read the folder but not change it.
6. Click **Finish**. A line called **Filesystem shared** appears in the list.
7. Click **View**, then **Console**, to see the machine's screen again. Then click **Run** to start the Workstation.

To bring a file in, copy it into that folder on your computer. In the Workstation, it appears in the folder `/mnt/shared`. Open it from there, or copy it into your home folder. The Workstation can read everything in the folder, so put in only what it should have.

If `/mnt/shared` shows only a file called `README.md`, the folder isn't shared. Check the steps above. The folder isn't shared in live mode either.

If a file in `/mnt/shared` won't open, make it readable on your computer with chmod, such as `chmod a+r ~/whonix-shared-research/photo.jpg`, then try again.

Files from your computer can carry details about you, such as your name inside a document. Clean them with mat2, as in [Habits that keep you anonymous](#habits-that-keep-you-anonymous), before you share them from the Workstation.

To move files out of the Workstation as well, Whonix's [Shared Folder steps](https://www.whonix.org/wiki/KVM#Shared_Folders) show how to let it write to the folder. Files you then delete in the folder from inside Whonix go to a hidden folder called `.Trash-1000` inside it. Delete that folder on your computer too, so the files can't carry over to another session.

## Updating later

### QEMU

Run the install step again whenever you want the newest QEMU:

```bash
cd ~/Downloads
bash qemu-install.sh install
```

It refreshes the package lists and asks apt for the same packages again. apt only downloads what is new or missing. If everything is current, it says each package is already the newest version, and asks nothing. If there is an update, it lists the packages it will upgrade and asks first. Either way, the script ends with `qemu is up to date:` and the version you now have.

Newest means the newest version your Debian or Devuan release offers.

### Everything else on your computer

Your normal system updates keep QEMU, the programs from step 3 and everything else current:

```bash
sudo apt update && sudo apt upgrade
```

apt lists what it will upgrade and asks first.

### Whonix

Whonix updates from the inside, as in step 8. That includes every Workstation copy you made.

### This script

To see which copy of the script you have, run:

```bash
cd ~/Downloads
bash qemu-install.sh version
```

It prints the script's name and version number, such as `qemu-install, v6`. If the place you got it from has a newer copy, use that one. That matters most after you move to a new Debian or Devuan release, in case package names change.

## Remove Whonix

If you made Workstation copies, delete them first in Virtual Machine Manager, as [One Workstation per task](#one-workstation-per-task) shows.

Then switch off both machines and take them out of Virtual Machine Manager:

```bash
virsh -c qemu:///session destroy Whonix-Gateway
virsh -c qemu:///session destroy Whonix-Workstation
virsh -c qemu:///session undefine --managed-save Whonix-Gateway
virsh -c qemu:///session undefine --managed-save Whonix-Workstation
```

`destroy` sounds alarming, but it only switches a machine off straight away, like pulling the plug. If a machine is already off, you get an error saying the domain is not running. That's fine. `undefine` takes the machine out of the list, and prints a line saying the domain has been undefined. The `--managed-save` part also deletes any saved state libvirt kept for it.

Then delete the disk files. This deletes everything inside Whonix, so copy out anything you want to keep first:

```bash
safe-rm ~/.local/share/images/Whonix-*.qcow2
```

This prints nothing.

If you no longer need the download you kept in step 6, delete it too:

```bash
safe-rm -r ~/whonix-download
```

The storage pool from step 6 can stay. To remove it as well, run these two commands, which leave files alone:

```bash
virsh -c qemu:///session pool-destroy default
virsh -c qemu:///session pool-undefine default
```

If you also want to remove the programs, run:

```bash
sudo apt remove qemu-system-x86 qemu-system-gui qemu-system-modules-spice qemu-utils libvirt-daemon libvirt-daemon-driver-qemu libvirt-daemon-driver-storage libvirt-clients virt-manager gir1.2-spiceclientgtk-3.0 passt ovmf swtpm swtpm-tools safe-rm
sudo apt autoremove
```

If you use QEMU for other virtual machines, leave out qemu-system-x86, qemu-system-gui, qemu-utils and ovmf. xz-utils is left off the list on purpose, because other programs often need it. Both commands show what they will remove before they ask. Read the list before you answer yes.

You can also delete the settings file from step 6, `~/.config/libvirt/qemu.conf`, and any shared folders you made.

## Fixes

Each fix ends with a link back to where you were. For a message that isn't here, see the troubleshooting section of Whonix's KVM page: <https://www.whonix.org/wiki/KVM>

### Set up sudo

sudo lets your account run a command as the administrator, after asking for your password. Some installs don't set it up. For example, if you gave the administrator, called root, its own password while installing Debian, your account doesn't get sudo.

First, find out your user name:

```bash
whoami
```

It prints one word. That is your user name.

Next, become the administrator. Type the root password when it asks:

```bash
su -
```

The dash after `su` matters. Without it, the `adduser` command below may not be found. When it works, the prompt changes and ends with a `#` sign.

Now run these two commands, with your user name in place of NAME:

```bash
apt install sudo
adduser NAME sudo
```

The first one either installs sudo or says that sudo is already the newest version. The second one says it is adding your user to the group sudo.

Restart the computer so the change takes effect:

```bash
reboot
```

Then go back to [step 2](#2-install-qemu).

### Switch on hardware virtualization

The check said:

```text
no vmx or svm flag in /proc/cpuinfo
hardware virtualization is disabled in firmware, or absent from this cpu
enter firmware setup at boot; the key varies by vendor, commonly del, f2, f10 or f1
the setting is usually under security or advanced, named: intel virtualization technology, or vt-x
```

The last line names the setting for your processor. On AMD processors it says `svm mode, or amd-v`. Turn that setting on in your computer's firmware setup, often called the BIOS:

1. Restart the computer.
2. As soon as it starts, press the setup key. It is often Del, F2, F10 or F1, and the start screen usually shows which.
3. Look under **Security**, **Advanced** or **CPU Configuration** for the setting the script named.
4. Turn it on.
5. Save and exit. The key for that is often F10.

Don't confuse VT-x with VT-d. VT-d is a different setting, and it isn't the one you need.

If you'd rather check by hand, this prints a number:

```bash
grep -Ec '(vmx|svm)' /proc/cpuinfo
```

Any number above `0` means the feature is on. A `0` means it is switched off or missing.

Then go back to [step 1](#1-check-that-your-computer-can-run-virtual-machines).

### Load the KVM module

The check said your processor has the feature, but `/dev/kvm` is missing. That means Linux hasn't switched the feature on. Run the two commands the check printed. The first starts with `sudo modprobe` and the second with `sudo dmesg`. If the second one mentions `disabled by bios`, [switch the setting on in your firmware](#switch-on-hardware-virtualization).

Then go back to [step 1](#1-check-that-your-computer-can-run-virtual-machines).

### Refreshing the package lists failed

The lines above the message name the package source that failed. If the address in them contains `debian.org` or `devuan.org`, the problem is your connection or their servers, so try again later. If it is a source that was added for some other program, fix it by following that program's instructions, or switch it off. Those sources are files ending in `.list` or `.sources` in `/etc/apt/sources.list.d/`. To switch one off, move its file out of that folder with `sudo mv`, for example into your home folder. Moving it back switches it on again.

Then go back to [step 2](#2-install-qemu).

### apt could not finish

apt says why in its own messages, above the script's. Look for the line starting with `E:`:

- `Unable to locate package` means this copy of the script is too old for your system. Get a newer copy from the place you got this guide.
- `Could not get lock` means another program is installing or updating software, often your desktop's update tool. Wait for it to finish, then run the script again.
- `Failed to fetch` means a download failed. Check your internet connection, then run the script again.
- `dpkg was interrupted` means an earlier install was cut short. Run the command apt names, `sudo dpkg --configure -a`, then run the script again.

Then go back to [step 2](#2-install-qemu).

### Hardware acceleration is still not available

Run the check again after the restart, and read what it says:

- `you are in the kvm group, but it takes effect only after you log out and back in` means the new login hasn't happened yet. Restart the computer, then check again.
- `you are in the kvm group, but /dev/kvm still does not let you read and write it` means the device has unusual permissions. Run `ls -l /dev/kvm`. Normally the line starts with `crw-rw----` and shows the group kvm. Device permissions are set again each time the computer starts, so restart it and check again.
- If it says anything else, follow the fix linked from [step 1](#1-check-that-your-computer-can-run-virtual-machines).

When the check says `hardware acceleration is available`, go on to [step 3](#3-install-the-programs-whonix-uses).

### No such file or directory

The terminal isn't in the folder with your files, or the file name is different. Run `cd ~/Downloads`, then `ls`, to see the exact names. If the script's name is different, use that name in the command.

Then go back to the step you were on.

### The key fingerprint does not match

Don't save the key.

If gpg printed no fingerprint at all and said `no valid OpenPGP data found`, your browser saved a web page instead of the key. Download it again with **Save Link As**, as step 4 describes.

If it printed a different fingerprint, delete `derivative.asc` and download it again from Whonix's KVM page, with the **Download Whonix OpenPGP Key** button. If the fingerprint is still different, the key you are getting isn't Whonix's. Don't go on, and ask for help on Whonix's forum: <https://forums.whonix.org>

Then go back to [step 5](#5-check-that-the-download-is-genuine).

### gpg cannot find the public key

gpg says `Can't check signature: No public key` when you haven't saved the Whonix key yet. Do the `gpg --import derivative.asc` part of step 5.

Then go back to [step 5](#5-check-that-the-download-is-genuine).

### gpg reports a BAD signature

First, make sure there is only one Whonix download in the folder:

```bash
cd ~/Downloads
ls Whonix*
```

It should list only your download and its `.asc` file. Extra files make the check fail, so move any others out of the folder, into `~/whonix-download` for example. If there was only one download, delete it and its `.asc` file, and download both again. Don't go on until gpg says `Good signature`.

Then go back to [step 5](#5-check-that-the-download-is-genuine).

### More than one download in the folder

When tar says `Not found in archive`, or virsh says `unexpected data`, more than one file matched the name pattern. Run `ls Whonix*` in your Downloads folder to see them. Move the older ones out of the folder, into `~/whonix-download` for example, and run the command again.

Then go back to [step 6](#6-unpack-whonix-and-add-it-to-your-computer).

### A storage pool called default already exists

This happens when Virtual Machine Manager's user session was opened before step 6, or when you made a pool earlier. Check which folder the pool uses:

```bash
virsh -c qemu:///session pool-dumpxml default | grep '<path>'
```

If it prints `<path>/home/NAME/.local/share/images</path>`, with your user name, the pool is already right. Make sure it is on and has seen the disk files:

```bash
virsh -c qemu:///session pool-start default
virsh -c qemu:///session pool-autostart default
virsh -c qemu:///session pool-refresh default
```

If `pool-start` says the pool is already active, that's fine. The other two print `Pool default marked as autostarted` and `Pool default refreshed`. Then go back to where you came from: the vol-list check in [step 6](#tell-libvirt-where-the-disk-files-are), or [Start the Gateway](#start-the-gateway) in step 7.

If it prints any other folder, take the old pool away:

```bash
virsh -c qemu:///session pool-destroy default
virsh -c qemu:///session pool-undefine default
```

They print `Pool default destroyed` and `Pool default has been undefined`. If `pool-destroy` says the pool is not active, that's fine too. Neither command deletes any files. Then run the three pool commands and the vol-list check in [step 6](#tell-libvirt-where-the-disk-files-are). If you came here from step 7, go back to [Start the Gateway](#start-the-gateway) afterwards.

### The machines are not in the list

If you are looking under the **QEMU/KVM** line, add the user session connection as step 7 shows. If the **QEMU/KVM User session** line is there but empty, check what libvirt has:

```bash
virsh -c qemu:///session list --all
```

It should list both machines:

```text
 Id   Name                 State
-------------------------------------
 -    Whonix-Gateway       shut off
 -    Whonix-Workstation   shut off
```

If they are missing, add them again. If you have already moved the download, as step 6 shows, the files are in `~/whonix-download`:

```bash
cd ~/whonix-download
virsh -c qemu:///session define Whonix-Gateway*.xml
virsh -c qemu:///session define Whonix-Workstation*.xml
```

If you haven't moved it yet, run the two `define` commands in `~/Downloads` instead. Each prints a line saying the domain was defined.

Then go back to [step 7](#7-start-whonix).

### Storage volume not found

The Gateway's disk file isn't where libvirt looks for it. Check your pools:

```bash
virsh -c qemu:///session pool-list --all
```

If no pool called `default` is listed, do [Tell libvirt where the disk files are](#tell-libvirt-where-the-disk-files-are) from step 6. If it is listed, follow [A storage pool called default already exists](#a-storage-pool-called-default-already-exists).

Then go back to [step 7](#start-the-gateway) and click **Run** again.

### Storage pool is not active

Switch the pool on, and make it switch on by itself from now on:

```bash
virsh -c qemu:///session pool-start default
virsh -c qemu:///session pool-autostart default
```

They print `Pool default started` and `Pool default marked as autostarted`.

Then go back to [step 7](#start-the-gateway) and click **Run** again.

### Cannot limit core file size or open files

The settings file from step 6 is missing, has a typo, or was made after libvirt's helper started. Open it again:

```bash
nano ~/.config/libvirt/qemu.conf
```

Compare it with the lines in [step 6](#adjust-the-libvirt-settings), fix any difference, and save. Then shut down any machine that is running, close Virtual Machine Manager, wait two minutes, and open it again. libvirt's helper reads this file only when it starts, and it stops by itself two minutes after nothing is using it. Restarting the computer works too.

Then go back to [step 7](#start-the-gateway) and click **Run** again.

### KVM is not available

libvirt says this in one of two ways. In step 6 it says the emulator `does not support virt type 'kvm'`. In step 7 it says `Domain requires KVM, but it is not available`. Either way, libvirt can't use your processor's hardware virtualization. Run the check from step 1 and do what it says:

```bash
cd ~/Downloads
bash qemu-install.sh check
```

When the check says `hardware acceleration is available`, go back to where you were. If libvirt still says the same, restart the computer and try again.

From step 6, run the two `define` commands in [Add the two machines](#add-the-two-machines) again. From step 7, click **Run** again in [Start the Gateway](#start-the-gateway).

### Another virtualization program is running

A message that mentions `KVM_CREATE_VM` means another program, such as VirtualBox, is using your processor's hardware virtualization. Close that program's virtual machines, and the program itself, then try again. If the message comes back, restart the computer, and don't start the other program before Whonix.

Then go back to [Start the Gateway](#start-the-gateway) and click **Run** again.

### The connection wizard does not appear

Open it from the Gateway's start menu: **Applications**, then **System**, then **Anon Connection Wizard**. Or open a terminal on the Gateway and run:

```bash
anon-connection-wizard
```

It runs in the Gateway's normal session.

Then go back to [Connect to Tor](#connect-to-tor).

### The Gateway cannot connect to Tor

Check these, in order:

1. Your computer's own internet connection works.
2. Your computer's clock is right. Tor can't connect if it is more than an hour slow or more than three hours fast. Run `date -u` in a terminal on your computer to see its time in UTC, and compare it with a clock you trust.
3. Tor may be blocked on your network. Run Anon Connection Wizard again, choose **Configure**, and use bridges, as [Connect to Tor](#connect-to-tor) describes.

Then go back to [Connect to Tor](#connect-to-tor).

### A machine is marked Saved

libvirt saved the machine's memory to your disk. That happens if you use **Save**, or if the machine was still running when you logged out or shut down your computer without the settings from [step 6](#adjust-the-libvirt-settings). Don't click **Run**, because that brings the old session back, which Whonix strongly discourages. Delete the saved state instead, using the machine's name:

```bash
virsh -c qemu:///session managedsave-remove Whonix-Gateway
```

It prints `Removed managedsave image for domain 'Whonix-Gateway'`. The machine is now marked **Shutoff**, and starts afresh, as if it had lost power. Do the same for Whonix-Workstation, or any copy, if it is marked **Saved** too.

If the settings from step 6 are missing, add them now. Then shut down any machine that is running, close Virtual Machine Manager, and wait two minutes, so that libvirt reads them when it starts again.

Then go back to [Start and stop](#start-and-stop).

## What Whonix does and doesn't do

Whonix hides your IP address. Programs in the Workstation can only reach the internet through Tor, so they can't reveal where you are, by accident or on purpose.

If you log in to your own accounts, or share details about yourself, Whonix still hides where you are, but not who you are. Read Whonix's warning page about what it can't protect you from before you rely on it: <https://www.whonix.org/wiki/Warning>

In this setup, the virtual machines run under your own account. If harmful software ever broke out of a virtual machine, it would have the same access to your files that you have. Break-outs are rare, but they are a real threat. Updates fix the bugs behind them once they're found, so keep both machines and your own computer up to date. If you need stronger separation, Whonix recommends Qubes-Whonix for computers that can run it: <https://www.whonix.org/wiki/Qubes>

By default, Whonix keeps your work on your computer's disk. If you want nothing left behind when you shut down, [Tails](https://tails.net) starts from a USB stick and forgets everything at shutdown. [Whonix's comparison page](https://www.whonix.org/wiki/Comparison_with_Others) shows what each one protects better.

## Where to read more

- Whonix on KVM, the page this guide follows: <https://www.whonix.org/wiki/KVM>
- What to do after installing: <https://www.whonix.org/wiki/Post_Install_Advice>
- Whonix's hardening checklist: <https://www.whonix.org/wiki/System_Hardening_Checklist>
- Staying anonymous: <https://www.whonix.org/wiki/Tips_on_Remaining_Anonymous>
- Connecting to Tor on first start: <https://www.whonix.org/wiki/Anon_Connection_Wizard>
- The sysmaint session: <https://www.whonix.org/wiki/Sysmaint>
- More than one Workstation: <https://www.whonix.org/wiki/Multiple_Whonix-Workstation>
- Live mode: <https://www.whonix.org/wiki/Live_Mode>
- Why the clock matters: <https://www.whonix.org/wiki/Network_Time_Synchronization>
- Tor Browser in Whonix: <https://www.whonix.org/wiki/Tor_Browser>
- Removing hidden details from files: <https://www.whonix.org/wiki/Metadata>
- Checking downloads on Linux: <https://www.whonix.org/wiki/Verify_the_images_using_Linux>