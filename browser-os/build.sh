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

lb build

cp live-image-amd64.hybrid.iso "$OUT"
echo "ISO written to $OUT"
