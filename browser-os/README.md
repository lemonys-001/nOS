# nOS Browser OS — build system

`build.sh` assembles a Debian 12 (bookworm) live ISO whose entire user
environment is fullscreen Chromium. Layout:

```
live/package-lists/nOS.list.chroot     packages baked into the image
live/includes.chroot/                  files copied verbatim into the image
live/hooks/live/0100-nos.hook.chroot   post-install setup (user, nodm)
build.sh                               live-build wrapper
run-qemu.sh                            boot the built ISO locally
```

Key image files (under `live/includes.chroot/`):

- `etc/nos/xsession` — session script: sets screen power-off off, writes the
  `NOS_X_READY` serial marker, starts Openbox, launches Chromium.
- `etc/nos/nos-browser` — Chromium launch wrapper with serial debug markers.
- `etc/default/nodm` — auto-login of the `nos` user.
- `etc/chromium/policies/managed/nos.json` — homepage, startup pages, search.
- `opt/nos/` — the offline start page and Notes app.

## Build

```bash
sudo bash build.sh            # output: browser-os/nOS-browser-amd64.iso
```

Build directory defaults to `/tmp/nOS-live-build` (override with `BUILD=`).

## Test

```bash
./run-qemu.sh                 # boot in QEMU, needs qemu-system-x86_64
```

CI boot-test looks for the `NOS_X_READY` marker on the serial line, so build a
QEMU with `-serial` reachable, e.g.:

```bash
qemu-system-x86_64 -m 2048 -cdrom nOS-browser-amd64.iso -serial file:serial.log
```

## Session data

The live system is ephemeral. For persistence, put a partition labeled
`persistence` on your USB stick with a `persistence.conf` containing `/home`,
and append `persistence` to the boot command line.
