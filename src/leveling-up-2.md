# Leveling up: Part 2


```
# gpg-setup.sh
# Creates an ed25519 [SC] primary key (never expires) plus a cv25519 [E]
# encryption subkey (1-year expiry), then copies the secret-key export
# and the auto-generated revocation certificate to your chosen destinations.
#
# Configuration precedence:
#   1. Variables defined in ~/.backup-config (if it exists) win.
#   2. Anything left empty there falls back to the in-script toggles below.
#
# Example ~/.backup-config entries this script reads:
#   NAME="Your Name"
#   EMAIL="you@example.com"
#   PRIVATE_KEY_DEST="/media/usb-primary/gpg"
#   REV_CERT_DEST="/media/usb-primary/gpg"
# Destinations must be existing directories; the script will not create them.

# In-script toggles. Edit these only if you are not using ~/.backup-config.
NAME=""
EMAIL=""
PRIVATE_KEY_DEST=""
REV_CERT_DEST=""

set -e

# Pull shared config if present. Values set there win over the toggles above.
[ -f "$HOME/.bc" ] && . "$HOME/.bc"

# Refuse to run unless every value is set somewhere.
: "${NAME:?Set NAME in ~/.backup-config or in this script}"
: "${EMAIL:?Set EMAIL in ~/.backup-config or in this script}"
: "${PRIVATE_KEY_DEST:?Set PRIVATE_KEY_DEST in ~/.backup-config or in this script}"
: "${REV_CERT_DEST:?Set REV_CERT_DEST in ~/.backup-config or in this script}"

# Destinations must already exist. We do not mkdir, because doing so on an
# unmounted USB path would silently write to the mount point on local disk
# and you would not notice until restore time.
[ -d "$PRIVATE_KEY_DEST" ] || { echo "PRIVATE_KEY_DEST does not exist: $PRIVATE_KEY_DEST" >&2; exit 1; }
[ -d "$REV_CERT_DEST" ] || { echo "REV_CERT_DEST does not exist: $REV_CERT_DEST" >&2; exit 1; }

gpg --quick-generate-key "$NAME <$EMAIL>" ed25519 sign,cert never

FPR=$(gpg --list-secret-keys --with-colons "$EMAIL" | awk -F: '/^fpr:/ {print $10; exit}')

gpg --quick-add-key "$FPR" cv25519 encr 1y

gpg --export-secret-keys --armor "$EMAIL" > "$PRIVATE_KEY_DEST/my-private-key.asc"
chmod 600 "$PRIVATE_KEY_DEST/my-private-key.asc"
cp "$HOME/.gnupg/openpgp-revocs.d/$FPR.rev" "$REV_CERT_DEST/"

cat <<EOF

Key created. Fingerprint: $FPR

Files written:
  $PRIVATE_KEY_DEST/my-private-key.asc
  $REV_CERT_DEST/$FPR.rev

Make a second offline copy of both files in a different physical location.
Write your passphrase on paper.

The encryption subkey expires in 1 year. To rotate:
  gpg --quick-add-key "$FPR" cv25519 encr 1y
EOF
```