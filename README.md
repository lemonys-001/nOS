# nOS

**nOS is a browser-only operating system.** The ISO boots straight into fullscreen Chromium. There is no desktop, no taskbar, no native app layer — the browser is the entire OS, and every app is a website. Think ChromeOS, minus the Chrome: just the browser page.

Inspired by ChromeOS and [LemonOS](https://github.com/lemonys-001/lemonos).

## Download

The latest ISO is published automatically by GitHub Actions:

- **[nOS Browser OS (latest) — release](https://github.com/lemonys-001/nOS/releases/tag/browser-os-latest)**
- Direct: <https://github.com/lemonys-001/nOS/releases/latest/download/nOS-browser-amd64.iso>
- Verify: `sha256sum -c SHA256SUMS` (from the same release)

~1 GB, amd64 (64-bit PCs). Built from a Debian 12 live base.

## What boots

1. The machine boots the live ISO (BIOS or UEFI).
2. `nodm` auto-logs in the `nos` user and starts X + Openbox.
3. Chromium opens fullscreen on the built-in nOS start page — search, web-app tiles, clock. **The start page and the built-in Notes app work with no internet at all.**

There is nothing else. No window manager chrome, no menus, no file manager. You live in tabs.

## Controls

| Action | How |
|---|---|
| Address bar | `Ctrl+L` |
| New tab / close tab | `Ctrl+T` / `Ctrl+W` |
| Home (nOS start page) | `Alt+Home` |
| Network setup | `Ctrl+Alt+F2`, log in `nos` / `nos`, run `sudo nmtui`, then `Ctrl+Alt+F7` back to the browser |
| Shut down | Press the physical power button |
| If Chromium dies | It restarts automatically (`nodm` relaunches the session) |

Ethernet works out of the box (DHCP via NetworkManager). Wi-Fi needs one-time setup through `nmtui` (saved networks auto-connect after that).

## Notes and limitations

- **Session data is ephemeral** by default — a live ISO resets on reboot. To persist the home directory, create a second partition labeled `persistence` on the USB stick containing a `persistence.conf` file with the line `/home`, and add `persistence` to the kernel boot line at the GRUB menu.
- No Secure Boot support; disable it in firmware settings.
- amd64 only. No auto-updates — rebuild or re-download the ISO for a newer Chromium.
- Chromium keeps its normal security sandbox; the session user `nos` has no special privileges (root is locked; `sudo` from a TTY asks for the `nos` password).
- Power button shuts down; lid close is ignored (a kiosk shouldn't suspend).

## Build it yourself

```bash
sudo bash browser-os/build.sh
browser-os/run-qemu.sh          # boot it in QEMU
```

Requires a Debian/Ubuntu host with `live-build`, `xorriso`, `squashfs-tools`. CI does the same thing: every push touching `browser-os/**` builds the ISO, boot-tests it headlessly in QEMU, and updates the rolling release.

## Legacy: the 32-bit kernel

nOS started as a from-scratch 32-bit graphical kernel (multiboot, GDT/IDT, PS/2 drivers, PMM/heap, scheduler, ring 3, a Windows 7-style desktop). It can't run a real browser — no 64-bit mode, no network stack, no POSIX — so it's retired to [`legacy/`](legacy/README.md) and still builds in its own workflow ([Build legacy nOS kernel](https://github.com/lemonys-001/nOS/actions/workflows/build-kernel.yml)).

## Layout

```
browser-os/          live-build config: packages, Chromium session, start page, CI hooks
.github/workflows/
  browser-os.yml     build + QEMU boot-test + rolling release
  build-kernel.yml   legacy 32-bit kernel build
legacy/              the original 32-bit kernel source
```
