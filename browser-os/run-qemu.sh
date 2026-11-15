#!/bin/sh
# Boot the built nOS ISO in QEMU (BIOS mode). Requires qemu-system-x86_64.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec qemu-system-x86_64 -machine q35 -cpu max -m 2048 -smp 2 \
  -cdrom "$ROOT/nOS-browser-amd64.iso" "$@"
