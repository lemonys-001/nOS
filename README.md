# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- Phase 6a: Preemptive kernel task scheduler (PIT, context switching) ✅
- Phase 6b: Ring 3, TSS, syscalls, flat-binary user program ✅
- Phase 7: Userland Apps (login, notepad, snake, settings) ✅
- **Phase 8: Multi-window GUI, File Manager, nScript interpreter + console** ✅ Current

## Phase 8: Better GUI, File Manager, nScript

**Multi-window GUI upgrade.** Phase 7 showed one fixed-position window at a time. Now:
- Multiple windows can be open simultaneously (up to 8), each independently positioned.
- Drag any window by its title bar.
- Click a window to bring it to the front (proper z-order); clicking its red X closes it.
- Opening an app that's already open just focuses its existing window rather than creating a duplicate.

**File Manager** (`APP_FILES` in `desktop.c`) lists every file in the initrd VFS (via new `vfs_file_count`/`vfs_file_name`/`vfs_file_size`/`vfs_read_index` accessors in `vfs.c`) and shows a live text preview of whichever file you click.

**nScript** (`nscript.c`/`.h`) is a small original Lua-inspired interpreter — explicitly **not** a port of real Lua. Real Lua needs `setjmp`/`longjmp`, floating-point (`libm`), and libc string/number formatting that this freestanding, no-libc kernel doesn't have; porting it without any way to actually compile-and-run it interactively would risk shipping something that looks complete but silently fails the first time someone types a command. nScript instead supports:
- Integer variables, single lowercase letter names (`a`-`z`)
- `+ - * / %`, comparisons (`== != < > <= >=`), parentheses, unary minus
- `if cond then ... [else ...] end`, `while cond do ... end` (loop body re-evaluated from a saved text pointer each iteration — no AST, straightforward tree-walking interpreter; capped at 100,000 iterations so a runaway script can't hang the desktop forever)
- `print(expr)` / `print("string")`
- Two OS-control builtins: `setbg(n)` (0-4, matches the Settings app's swatches) and `launch("appname")` (`notepad`/`snake`/`settings`/`files`/`console`) — so a script can genuinely open apps and change the desktop, not just print numbers.
- Statements on one line are separated by `;` (REPL-style, no multi-line programs)

Run it from the new **Console** window (`APP_CONSOLE`), e.g.:
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

### Try it

```bash
make run
```
Log in with `nos`, click **START**, open a few apps, drag them around, then open **CONSOLE** and try the script above.

## Earlier phases

- **Phase 1** — Multiboot boot into a 1024x768x32 VESA framebuffer.
- **Phase 2** — GDT, IDT, 8259 PIC remap, PS/2 keyboard + mouse drivers, COM1 serial debug output.
- **Phase 3** — Bitmap physical frame allocator (`pmm.c`) and a first-fit kernel heap (`heap.c`).
- **Phase 4** — Double-buffered drawing (`gfx.c`) and a 5x7 bitmap font (`font.c`).
- **Phase 5** — A custom initrd format (`tools/mkinitrd.py`), parsed read-only (`vfs.c`).
- **Phase 6a** — PIT-driven preemption (`pit.c`), an xv6-style context switch (`swtch.s`), round-robin scheduler (`task.c`).
- **Phase 6b** — TSS, `int 0x80` syscall gate, ring-3 privilege transition, a VFS-loaded flat-binary ring-3 demo program.
- **Phase 7** — Login screen, Notepad, Snake, Settings (single fixed window).

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
desktop.c                  Multi-window manager + Login/Notepad/Snake/Settings/Files/Console apps
nscript.c                  Small original Lua-inspired scripting interpreter
vfs.c                      initrd parser / file reader (by-name and by-index)
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
make run           # login screen -> desktop with draggable windows: Notepad/Snake/Settings/Files/Console
make run-serial     # also streams PMM/heap/VFS/task/syscall debug logs
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts. Note: CI only verifies the OS boots — it does not interact with the desktop, so GUI/script logic (like nScript) is verified by careful manual tracing rather than automated testing.

## License

TBD
