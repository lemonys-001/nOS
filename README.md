# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- **Phase 5: Filesystem (initrd VFS)** ✅ Current
- Phase 6: Multitasking & User Space (syscalls, ELF loading, scheduler) — not yet started
- Phase 7: Userland Apps (login, notepad, snake, settings) — not yet started

> Phases 6-7 involve a real preemptive scheduler with hand-written
> context-switch assembly, syscalls, and ELF loading — these are being built
> incrementally and tested in isolation, since a single mistake there tends
> to produce silent stack corruption or triple-fault reboots that are hard
> to debug from CI logs alone.

## Phase 1: Boot & Graphics

Boots via Multiboot into a 1024x768x32 VESA framebuffer mode.

## Phase 2: Interrupts & Input

GDT, IDT, 8259 PIC remap, PS/2 keyboard + mouse drivers, COM1 serial debug output.

## Phase 3: Memory Management

- **`pmm.c`** — bitmap-based physical frame allocator (4KB frames), reserving the kernel image and any GRUB-loaded modules at boot.
- **`heap.c`** — an 8MB kernel heap managed as an explicit first-fit free list.

## Phase 4: GUI Engine

- **`gfx.c`** / **`font.c`** — double-buffered drawing primitives and a 5x7 bitmap font.
- **`compositor.c`** — renders the desktop every frame: background, a demo window, a taskbar with a Start button, and a live PS/2-driven cursor.

## Phase 5: Filesystem (initrd VFS)

- **`tools/mkinitrd.py`** — host-side tool that packs the `initrd/` directory into a small custom binary format (file count, then a `{name[32], size}` header table, then concatenated raw file bytes).
- The Makefile builds `initrd.img` from that and passes it to GRUB as a multiboot module.
- **`vfs.c`** — parses the module in-kernel (`vfs_init`), and exposes `vfs_read(name, &size)` / `vfs_list()`. Read-only, no directories yet — flat file list.
- `pmm.c` now also reserves the frames occupied by any multiboot module, so the heap can never clobber initrd data.
- At boot, the kernel lists the initrd contents and prints `config.txt` / `logo.txt` to the serial console as a smoke test.

### Files

```
boot.s                    Multiboot bootloader
kernel.c                  Kernel entry, init sequence, compositor render loop
gdt.c / gdt_flush.s        GDT setup
idt.c / idt_flush.s        IDT setup
isr.c / isr_stubs.s        Exception + IRQ handling
pic.c                      8259 PIC remap
keyboard.c                 PS/2 keyboard driver
mouse.c                    PS/2 mouse driver
serial.c                   COM1 debug output
pmm.c                      Physical memory manager (bitmap frame allocator)
heap.c                     Kernel heap (kmalloc/kfree)
gfx.c                      Double-buffered drawing primitives
font.c                     5x7 bitmap font
compositor.c               Desktop rendering: taskbar, Start button, window, cursor
vfs.c                      initrd parser / file reader
tools/mkinitrd.py          Host-side initrd packer (run by the Makefile)
initrd/                    Files that get packed into initrd.img
include/                   Headers for all of the above
linker.ld                  Links the kernel at 1MB
Makefile                   Build system (nasm + gcc -m32 + ld + grub-mkrescue + mkinitrd.py)
```

### Build & Run

```bash
# Ubuntu/Debian dependencies
sudo apt-get install build-essential gcc-multilib nasm xorriso grub-pc-bin qemu-system-x86 python3

make
make run           # graphical desktop: taskbar, Start button, demo window, live cursor
make run-serial     # also prints PMM/heap/VFS/keyboard/mouse debug output to your terminal
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log (which now includes the VFS file listing and file contents) as workflow artifacts.

## License

TBD
