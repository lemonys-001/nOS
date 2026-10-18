# nOS

A 32-bit graphical operating system built from scratch, mimicking the aesthetic of Windows 7.

## Roadmap

- Phase 1: Foundation (Boot & Graphics) ✅
- Phase 2: Interrupts & Input (GDT, IDT, PS/2 keyboard/mouse) ✅
- Phase 3: Memory Management (PMM, heap) ✅
- Phase 4: GUI Engine (compositor, taskbar, cursor) ✅
- Phase 5: Filesystem (initrd VFS) ✅
- **Phase 6a: Preemptive kernel task scheduler (PIT, context switching)** ✅ Current
- Phase 6b: User-mode processes (TSS, ring 3, syscalls, ELF loading) — not yet started
- Phase 7: Userland Apps (login, notepad, snake, settings) — not yet started

> Phase 6 was split in two on purpose. 6a (this commit) gets real preemptive
> multitasking working between *kernel-mode* threads — already a correctness-
> sensitive piece of hand-written assembly. True user-mode isolation (6b) adds
> a TSS, ring 3 segments, a syscall gate, and ELF loading on top of that, and
> is safer to build once 6a is confirmed solid under CI rather than bundled
> into the same commit.

## Phase 1: Boot & Graphics

Boots via Multiboot into a 1024x768x32 VESA framebuffer mode.

## Phase 2: Interrupts & Input

GDT, IDT, 8259 PIC remap, PS/2 keyboard + mouse drivers, COM1 serial debug output.

## Phase 3: Memory Management

Bitmap physical frame allocator (`pmm.c`) and a first-fit kernel heap (`heap.c`).

## Phase 4: GUI Engine

Double-buffered drawing (`gfx.c`), a 5x7 bitmap font (`font.c`), and a desktop compositor (`compositor.c`) with a taskbar, Start button, demo window, and live cursor.

## Phase 5: Filesystem (initrd VFS)

A custom initrd format (`tools/mkinitrd.py`) loaded as a GRUB multiboot module and parsed read-only at boot (`vfs.c`).

## Phase 6a: Preemptive Kernel Task Scheduler

- **`pit.c`** — configures the 8253/8254 Programmable Interval Timer on IRQ0 (100Hz) to drive preemption.
- **`swtch.s`** — a minimal xv6-style context switch: saves the callee-saved registers (ebp/ebx/esi/edi) on the current task's stack, swaps ESP, and `ret`s into the next task. A small `task_trampoline` handles the first-ever run of a task, explicitly re-enabling interrupts before calling its entry point (since IF isn't part of the saved context).
- **`task.c`** — a tiny round-robin scheduler (`task_create`, `scheduler_start`, `scheduler_tick`) over a fixed task table.
- The GUI compositor now runs as its own task (`compositor_task` in `compositor.c`) alongside a second `monitor` task that prints a serial heartbeat — proof that two independent loops are really being preempted and interleaved by the timer, not just one big loop.

**Important scope note:** these are kernel-mode threads sharing one address space and ring 0 — not isolated user processes. There's no memory protection between them yet. Process isolation (ring 3, syscalls, ELF loading) is Phase 6b.

### Files

```
boot.s                    Multiboot bootloader
kernel.c                  Kernel entry, init sequence, task creation
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
compositor.c               Desktop rendering, now its own task
vfs.c                      initrd parser / file reader
pit.c                      PIT timer driver (IRQ0)
task.c / swtch.s            Round-robin scheduler + context switch
tools/mkinitrd.py          Host-side initrd packer (run by the Makefile)
initrd/                    Files packed into initrd.img
include/                   Headers for all of the above
linker.ld                  Links the kernel at 1MB
Makefile                   Build system (nasm + gcc -m32 + ld + grub-mkrescue + mkinitrd.py)
```

### Build & Run

```bash
# Ubuntu/Debian dependencies
sudo apt-get install build-essential gcc-multilib nasm xorriso grub-pc-bin qemu-system-x86 python3

make
make run           # graphical desktop, still responsive while the monitor task runs in the background
make run-serial     # watch [MONITOR] heartbeats interleave with the rest of the boot log in real time
```

## CI

Every push to `main` triggers a GitHub Actions build that compiles the kernel, builds the initrd, boots it headlessly in QEMU as a smoke test, and uploads `nOS.bin`, `nOS.iso`, and the serial debug log as workflow artifacts.

## License

TBD
