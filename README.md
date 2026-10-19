# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Status note

An earlier multi-window GUI rewrite caused a startup hang (CI's headless
boot-only smoke test doesn't catch interactive bugs). It was reverted.
Features are now added incrementally and in isolation: the nScript console
was re-added on its own, and this round adds real window chrome
(minimize/maximize/close) and resizing to the same confirmed-working
single-window design, without reintroducing multiple simultaneous windows.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- Phase 6a: Preemptive kernel task scheduler (PIT, context switching) ✅
- Phase 6b: Ring 3, TSS, syscalls, flat-binary user program ✅
- Phase 7: Userland Apps (login, notepad, snake, settings) ✅
- nScript console, added in isolation on the stable single-window desktop ✅
- **Window chrome (minimize/maximize/close) + resizing, single window** ✅ Current
- Planned, in isolated steps: writable file manager (create/edit scripts), ATA disk driver + HDD install (self-tested write/readback, boot success unverified by me)
- Multiple simultaneous windows — deliberately deferred pending more cautious design

## Window chrome + resizing

The single window now has real title bar controls:
- **-** minimize — hides the window; a "MINIMIZED" indicator appears in the taskbar, click it (or reopen the app from Start) to restore.
- **O** maximize/restore — toggles between the normal size and a near-fullscreen size (small margin above the taskbar); remembers the pre-maximize position/size.
- **X** close — unchanged from before.
- **Resize grip** (bottom-right corner) — drag to resize the window (clamped to a sane minimum and to the screen bounds); disabled while maximized.

This deliberately stays within the single-window model (no window array, no z-order, no reordering) that's been stable since the Phase 8 revert — only the one window's position/size became mutable, plus one new resize-drag interaction. Snake's grid and Settings' layout don't reflow with the window size; Notepad and the Console do (their text area's visible height follows the window height).

## Apps

- **Login screen** — real text input, masked password field, `nos` + Enter to unlock.
- **Notepad** — real 1KB text buffer, live keystrokes.
- **Snake** — WASD grid movement, collisions, food, score, game-over/restart, PIT-paced.
- **Settings** — click a swatch to change the live desktop background color.
- **nScript Console** — a small original Lua-inspired interpreter (not real Lua — see `nscript.c` for why). Variables, `if/while`, `print()`, `setbg()`, `launch()`.

### Try it

```bash
make run
```
Log in with `nos`, open any app, then try the minimize/maximize/close buttons and drag the bottom-right corner to resize.

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
desktop.c                  Window manager (chrome, resize) + Login/Notepad/Snake/Settings/Console apps
nscript.c                  Small original Lua-inspired scripting interpreter
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
```

### Build & Run

```bash
# Ubuntu/Debian dependencies
sudo apt-get install build-essential gcc-multilib nasm xorriso grub-pc-bin qemu-system-x86 python3

make
make run           # login screen -> desktop with resizable/minimizable/maximizable windows
make run-serial     # also streams PMM/heap/VFS/task/syscall debug logs
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts. This only verifies the OS *boots* -- it cannot interact with the desktop, which is why GUI changes are kept small and isolated rather than bundled into large rewrites.

## License

TBD
