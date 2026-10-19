# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Status note

Phase 8 (multi-window GUI + nScript interpreter) was reverted after it caused
a startup hang on real hardware/QEMU testing (stuck on a blank blue screen),
which CI's headless boot-only smoke test didn't catch. The repo is currently
back on the last confirmed-working state (Phase 7). Phase 8's source
(`nscript.c`/`.h`) is still in the repo but unused by the Makefile, kept
around to debug and reintroduce carefully rather than thrown away.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- Phase 6a: Preemptive kernel task scheduler (PIT, context switching) ✅
- Phase 6b: Ring 3, TSS, syscalls, flat-binary user program ✅
- **Phase 7: Userland Apps (login, notepad, snake, settings)** ✅ Current (stable)
- Phase 8: Multi-window GUI, File Manager, nScript interpreter ⚠️ Reverted (caused a startup hang) — to be reintroduced after debugging with serial output

## Phase 7: Userland Apps

All four apps requested in the original roadmap, fully interactive:

- **Login screen** (`desktop.c`) — real text input with backspace and a masked password field; typing `nos` + Enter unlocks the desktop, anything else shows an error and clears the field.
- **Notepad** — a real text buffer (1KB) driven by actual keystrokes.
- **Snake** — a real game: WASD-controlled grid movement, wall/self collision detection, food spawning via an xorshift PRNG, a growing body, a live score counter, and a game-over/restart (`R`) state, paced by `pit_get_ticks()`.
- **Settings** — click a color swatch to change the live desktop background color immediately.

A real taskbar + Start menu (click Start, click an app name to launch it, click the red X to close it back to the desktop) with proper click-edge detection.

**Design notes / honest limitations:**
- One fixed-position window at a time (no dragging/multi-window yet — that was Phase 8, reverted).
- The bitmap font (`font.c`) only has uppercase glyphs.
- Snake uses WASD rather than arrow keys (unparsed extended PS/2 scancodes).
- The login password is a hardcoded plaintext comparison (`nos`).

### Try it

```bash
make run
```
Type `nos` and press Enter at the login screen, then click **START** in the taskbar to launch Notepad, Snake, or Settings.

## Earlier phases

- **Phase 1** — Multiboot boot into a 1024x768x32 VESA framebuffer.
- **Phase 2** — GDT, IDT, 8259 PIC remap, PS/2 keyboard + mouse drivers, COM1 serial debug output.
- **Phase 3** — Bitmap physical frame allocator (`pmm.c`) and a first-fit kernel heap (`heap.c`).
- **Phase 4** — Double-buffered drawing (`gfx.c`) and a 5x7 bitmap font (`font.c`).
- **Phase 5** — A custom initrd format (`tools/mkinitrd.py`), parsed read-only (`vfs.c`).
- **Phase 6a** — PIT-driven preemption (`pit.c`), an xv6-style context switch (`swtch.s`), round-robin scheduler (`task.c`).
- **Phase 6b** — TSS, `int 0x80` syscall gate, ring-3 privilege transition, a VFS-loaded flat-binary ring-3 demo program.

### Files

```
boot.s                    Multiboot bootloader
kernel.c                  Kernel entry, init sequence, task creation
gdt.c / gdt_flush.s        GDT + TSS setup
idt.c / idt_flush.s        IDT setup
isr.c / isr_stubs.s        Exception + IRQ + syscall gate handling
pic.c                      8259 PIC remap
keyboard.c                 PS/2 keyboard driver
mouse.c                    PS/2 mouse driver
serial.c                   COM1 debug output
pmm.c                      Physical memory manager (bitmap frame allocator)
heap.c                     Kernel heap (kmalloc/kfree)
gfx.c                      Double-buffered drawing primitives
font.c                     5x7 bitmap font (uppercase only)
compositor.c               Task-loop wrapper around the window manager
desktop.c                  Window manager + Login/Notepad/Snake/Settings apps
vfs.c                      initrd parser / file reader
pit.c                      PIT timer driver (IRQ0) + tick counter
task.c / swtch.s            Round-robin scheduler + context switch
syscall.c                  int 0x80 syscall dispatcher
usermode.s                 Ring0 -> ring3 privilege transition
user_load.c                Loads + runs a flat binary from the VFS in ring 3
hello_user.s                Tiny position-independent ring-3 demo program
tools/mkinitrd.py          Host-side initrd packer (run by the Makefile)
initrd/                    Files packed into initrd.img (hello.bin is generated, not committed)
include/                   Headers for all of the above
linker.ld                  Links the kernel at 1MB
Makefile                   Build system (nasm + gcc -m32 + ld + grub-mkrescue + mkinitrd.py)
nscript.c / include/nscript.h   Phase 8's scripting interpreter -- present but unused, pending debug
```

### Build & Run

```bash
# Ubuntu/Debian dependencies
sudo apt-get install build-essential gcc-multilib nasm xorriso grub-pc-bin qemu-system-x86 python3

make
make run           # login screen -> desktop with working Notepad/Snake/Settings
make run-serial     # also streams PMM/heap/VFS/task/syscall debug logs
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts. Note: this only verifies the OS *boots* -- it does not interact with the desktop, which is exactly how the Phase 8 hang slipped through undetected.

## License

TBD
