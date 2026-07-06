# Open letter to Devuan devs


To the Devuan developers,

First, thank you for Devuan and for keeping a systemd-free, init-flexible base alive.
It is the reason I run it, and this note is meant as constructive feedback from someone who got a setup working but found the path far harder than it needed to be.

I wanted full-disk encryption that includes /boot, not just an encrypted root with /boot left in the clear.
The guided installer handles encrypted root well and easily.
But the moment I wanted /boot encrypted too, there was no guided option, and I was dropped into a long manual procedure: converting LUKS key slots, moving /boot into the encrypted root, enabling GRUB cryptodisk, and embedding a keyfile in the initramfs to avoid being asked for the passphrase twice at boot.
Most of the community documentation I found, including the Debian cryptsetup reference, still tells you to downgrade the container from LUKS2 to LUKS1.
That is a real reduction in security, and on current GRUB it is also unnecessary, since GRUB has unlocked LUKS2 with a PBKDF2 key slot since 2.06.
For someone who is not a cryptsetup expert, this whole path is intimidating and easy to get wrong, with a genuine risk of ending up unable to boot.

Two requests, if they are feasible.

First, could the installer offer encrypted /boot as a clearly labeled option?
Concretely: keep the container as LUKS2, use a PBKDF2 key slot only where GRUB needs it today (or Argon2id once Freia ships GRUB 2.14, which supports it natively), set GRUB_ENABLE_CRYPTODISK, and automatically place a keyfile inside the initramfs so the user enters the passphrase once rather than twice.
The Refracta live installer already gets most of the way there when you encrypt root without a separate /boot; the missing pieces are the single-prompt keyfile step, which currently has to be done by hand, and a plainly documented choice about the key-derivation trade-off.

Second, could the installer collect all user input at the start and then run to completion without stopping to ask more questions?
At present it pauses at several stages, so you have to sit and watch it.
If every decision were gathered up front, the disk, the encryption choice, the passphrase, hostname, user account, timezone, keymap, and package selection, the install could run unattended and the user could step away and come back to a finished system.
Preseeding already does this for experts, but it is not available as a choice in the guided installer.

Neither of these is a complaint about Devuan's core work, which I value.
They are the two places where the experience could become much friendlier for ordinary users without compromising the project's principles.
I am happy to test any changes in this area.

Thank you for your time and for the project.


Best,  
Jake

---