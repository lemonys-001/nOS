// syscall.c - Minimal int 0x80 syscall dispatcher.
//
// Calling convention: eax = syscall number, ebx = first argument.
//   0 = write_serial(const char *str in ebx)   -- str is a raw pointer;
//       since there's no paging yet, this is effectively the physical
//       address the caller named. No validation is done. This is fine for
//       a single trusted demo program and explicitly NOT safe for
//       untrusted user code -- real argument validation needs paging.
//   1 = exit() -- minimal stub: halts the calling task in a spin-loop.
//       Does not remove it from the scheduler or free its resources;
//       full process teardown is future work.

#include "syscall.h"
#include "idt.h"
#include "isr.h"
#include "serial.h"

extern void isr128(void); // from isr_stubs.s

void syscall_install(void) {
    // 0xEE = present, DPL=3, 32-bit interrupt gate -- DPL3 so ring-3 code
    // can execute `int 0x80` without taking a general protection fault.
    idt_set_gate(0x80, (uint32_t)isr128, 0x08, 0xEE);
}

void syscall_handler(struct registers *regs) {
    switch (regs->eax) {
        case 0: // sys_write_serial
            serial_write((const char *)regs->ebx);
            break;

        case 1: // sys_exit (minimal stub -- see file header)
            serial_write("[SYSCALL] sys_exit: task halting\n");
            for (;;) { __asm__ volatile ("hlt"); }
            break;

        default:
            serial_write("[SYSCALL] Unknown syscall number: ");
            serial_write_hex(regs->eax);
            serial_write("\n");
    }
}
