# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- Phase 6a: Preemptive kernel task scheduler (PIT, context switching) ✅
- **Phase 6b: Ring 3, TSS, syscalls, flat-binary user program** ✅ Current
- Phase 7: Userland Apps (login, notepad, snake, settings) — not yet started

## Phase 6b: Ring 3, TSS, Syscalls

- **`gdt.c`** now also builds a TSS and loads it with `ltr`. Its only real job is `esp0`/`ss0`: the stack the CPU automatically switches to whenever ring-3 code is interrupted (by an IRQ, an exception, or `int 0x80`). GDT entries 3/4 (user code/data, DPL 3) were already prepared back in Phase 3.
- **`syscall.c`** installs a DPL-3-accessible `int 0x80` gate (so ring-3 code can call it without faulting) and dispatches on `eax`: `0` = write a string to serial (`ebx` = pointer), `1` = exit (minimal spin-halt stub).
- **`usermode.s`** (`enter_usermode`) performs the actual ring0->ring3 transition by building the 5-value `iret` stack frame by hand.
- **`hello_user.s`** is a tiny, fully position-independent ring-3 demo program (no paging means no fixed/known load address, so it can't use absolute references — it uses the classic `call`/`pop` trick to find its own string at runtime). It's assembled as a raw flat binary by the same `nasm` toolchain as everything else and packed into the initrd as `hello.bin`.
- **`user_load.c`** reads `hello.bin` from the VFS, copies it into freshly-allocated PMM frames, allocates a small stack the same way, and calls `enter_usermode`. It runs as its own scheduler task (`userland`), alongside `compositor` and `monitor` from Phase 6a.

**Scope / limitations, stated plainly:**
- **No paging** → no real memory isolation between kernel and "userland". The privilege ring enforcement is real and CPU-verified (ring-3 code faults if it tries `cli`, port I/O, etc.), but a buggy or malicious ring-3 program can still read/write any physical address, since pointers are unchecked physical addresses.
- **Only one ring-3 task at a time** is supported, because there's a single shared TSS/kernel-stack for privilege transitions. This is safe under this project's strict round-robin scheduler (a task's privilege-transition stack is only ever "in use" between its own interrupt-entry and its own matching `iret`, which fully unwinds before the scheduler can resume anything else into it) — but it would need per-task kernel stacks to support multiple concurrent ring-3 tasks.
- `sys_exit` doesn't free the task's resources or remove it from the scheduler, it just halts it in place.

### Try it

`make run-serial` and watch for:
```
[USER] Loaded 'hello.bin' at 0x..., entering ring 3...
HELLO FROM RING 3 USERLAND!
```
interleaved with the `[MONITOR]` heartbeats from Phase 6a — three independently scheduled contexts (one of them genuinely running in ring 3) sharing the CPU.

## Earlier phases

- **Phase 1** — Multiboot boot into a 1024x768x32 VESA framebuffer.
- **Phase 2** — GDT, IDT, 8259 PIC remap, PS/2 keyboard + mouse drivers, COM1 serial debug output.
- **Phase 3** — Bitmap physical frame allocator (`pmm.c`) and a first-fit kernel heap (`heap.c`).
- **Phase 4** — Double-buffered drawing (`gfx.c`), a 5x7 bitmap font (`font.c`), and a desktop compositor (`compositor.c`).
- **Phase 5** — A custom initrd format (`tools/mkinitrd.py`) loaded as a GRUB multiboot module, parsed read-only (`vfs.c`).
- **Phase 6a** — PIT-driven preemption (`pit.c`), an xv6-style context switch (`swtch.s`), and a round-robin scheduler (`task.c`).

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
font.c                     5x7 bitmap font
compositor.c               Desktop rendering task
vfs.c                      initrd parser / file reader
pit.c                      PIT timer driver (IRQ0)
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
make run           # graphical desktop, still responsive while monitor + userland tasks run
make run-serial     # watch [MONITOR] heartbeats and the ring-3 program's output interleave live
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd (including assembling `hello.bin`), boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts.

## License

TBD
