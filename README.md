# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Status note

An earlier multi-window GUI rewrite caused a startup hang (CI's headless
boot-only smoke test doesn't catch interactive bugs, so it slipped through).
It was reverted. The nScript console has since been re-added on top of the
confirmed-working single-window desktop, as an isolated, contained change,
to avoid repeating that mistake.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- Phase 6a: Preemptive kernel task scheduler (PIT, context switching) ✅
- Phase 6b: Ring 3, TSS, syscalls, flat-binary user program ✅
- Phase 7: Userland Apps (login, notepad, snake, settings) ✅
- **nScript console, added in isolation on the stable single-window desktop** ✅ Current
- Multi-window GUI, File Manager — shelved for now; a future attempt should be split into smaller, independently-verifiable commits rather than one large rewrite

## Apps

- **Login screen** — real text input with backspace and a masked password field; typing `nos` + Enter unlocks the desktop.
- **Notepad** — a real 1KB text buffer driven by actual keystrokes.
- **Snake** — WASD-controlled grid movement, wall/self collision, food via an xorshift PRNG, growing body, live score, game-over/restart (`R`), paced by `pit_get_ticks()`.
- **Settings** — click a color swatch to change the live desktop background color.
- **nScript Console** (`nscript.c`/`.h`) — a small original Lua-inspired interpreter, **not** a port of real Lua (which needs `setjmp`/`longjmp`, floating point, and libc formatting this freestanding kernel doesn't have). Supports integer variables (`a`-`z`), `+ - * / %`, comparisons, `if/then/else/end`, `while/do/end` (capped at 100,000 iterations so a runaway script can't hang the desktop), `print(expr|"string")`, and two OS-control builtins: `setbg(n)` and `launch("appname")`. Statements on one line are separated by `;` (REPL-style). Try:
  ```
  > x=5;print(x*2)
  10
  > i=0;while i<3 do print(i);i=i+1 end
  0
  1
  2
  > setbg(2)
  > launch("snake")
  ```

All apps share one fixed-position window (no dragging/multi-window yet) with a real taskbar + Start menu (click Start, click an app name to open it, click the red X to close it).

**Known limitations, stated plainly:**
- One window at a time, no dragging (the multi-window version that attempted this caused a hang and was reverted).
- The bitmap font (`font.c`) is uppercase-only, so typed text always displays in caps.
- Snake uses WASD, not arrow keys (unparsed extended PS/2 scancodes).
- The login password is a hardcoded plaintext comparison (`nos`), not a security boundary.
- nScript's correctness was verified by careful manual tracing, not automated testing — CI only confirms the OS boots, it can't type into the console for us.

### Try it

```bash
make run
```
Log in with `nos`, click **START**, open **CONSOLE**, try the script above.

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
desktop.c                  Window manager + Login/Notepad/Snake/Settings/Console apps
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
make run           # login screen -> desktop with Notepad/Snake/Settings/Console
make run-serial     # also streams PMM/heap/VFS/task/syscall debug logs
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts. This only verifies the OS *boots* -- it cannot interact with the desktop, which is why GUI/script changes are kept small and isolated rather than bundled into large rewrites.

## License

TBD
