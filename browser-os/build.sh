#!/bin/sh
# Build the nOS browser-only live ISO (Debian 12 base, Chromium as the whole OS).
# Must run as root (live-build needs root for debootstrap + image assembly).
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
BUILD=${BUILD:-/tmp/nOS-live-build}
OUT=${OUT:-$ROOT/nOS-browser-amd64.iso}

rm -rf "$BUILD"
mkdir -p "$BUILD"
cd "$BUILD"

export LC_ALL=C.UTF-8
export DEBIAN_FRONTEND=noninteractive

lb config \
  --distribution bookworm \
  --architecture amd64 \
  --binary-images iso-hybrid \
  --bootloaders "syslinux,grub-efi" \
  --archive-areas "main contrib non-free non-free-firmware" \
  --apt-recommends false \
  --debian-installer none \
  --iso-application "nOS" \
  --iso-publisher "nOS" \
  --iso-volume "nOS" \
  --bootappend-live "boot=live components quiet loglevel=3 console=tty0 console=ttyS0,115200"

cp -a "$ROOT/live/package-lists" config/
cp -a "$ROOT/live/includes.chroot" config/
cp -a "$ROOT/live/hooks" config/

# isolinux's template waits forever at the boot menu (timeout 0);
# boot the default entry after 3 seconds instead
mkdir -p config/bootloaders/isolinux
printf 'include menu.cfg\ndefault vesamenu.c32\nprompt 0\ntimeout 30\n' \
  > config/bootloaders/isolinux/isolinux.cfg

# bundle the ArtCraft creative suite offline (fetched at build time, ~280 MB)
echo "Fetching ArtCraft suite for offline bundling..."
mkdir -p config/includes.chroot/opt/nos/artcraft
curl -fsSL -o /tmp/artcraft.tar.gz https://codeload.github.com/lemonys-001/artcraft/tar.gz/HEAD
tar -xzf /tmp/artcraft.tar.gz -C /tmp
AC=/tmp/$(tar -tzf /tmp/artcraft.tar.gz | head -1 | cut -d/ -f1)
for app in pdfcraft designcraft effectcraft figcraft cadcraft lightcraft soundcraft; do
  cp -a "$AC/$app" config/includes.chroot/opt/nos/artcraft/
done
cp -a "$AC/index.html" "$AC/README.md" config/includes.chroot/opt/nos/artcraft/ 2>/dev/null || true
rm -rf "$AC" /tmp/artcraft.tar.gz
echo "ArtCraft bundled."

lb build

cp live-image-amd64.hybrid.iso "$OUT"
echo "ISO written to $OUT"
