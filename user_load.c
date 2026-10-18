// user_load.c - Loads a flat binary from the initrd VFS into fresh PMM
// frames and transitions to ring 3 to run it.
//
// Important limitations (see README): no paging means no real memory
// isolation between kernel and "userland" here -- only the CPU's
// privilege-ring enforcement is real (ring 3 code genuinely cannot
// execute privileged instructions). Only one ring-3 task is supported at
// a time, since there's a single shared TSS/kernel-stack for privilege
// transitions (see gdt.c and the Phase 6b README section for why that's
// safe under this project's strict round-robin scheduler).

#include <stdint.h>
#include "user_load.h"
#include "vfs.h"
#include "pmm.h"
#include "serial.h"

#define USER_PROGRAM_MAX_FRAMES 4   // 16KB max flat binary size
#define USER_STACK_FRAMES       2   // 8KB user stack

extern void enter_usermode(uint32_t entry, uint32_t user_stack_top);

void run_user_program(const char *name) {
    uint32_t size = 0;
    const uint8_t *bin = vfs_read(name, &size);
    if (!bin) {
        serial_write("[USER] program not found: ");
        serial_write(name);
        serial_write("\n");
        return;
    }

    uint32_t frames_needed = (size + 4095) / 4096;
    if (frames_needed == 0) frames_needed = 1;
    if (frames_needed > USER_PROGRAM_MAX_FRAMES) {
        serial_write("[USER] program too large\n");
        return;
    }

    uint32_t code_base = 0;
    for (uint32_t i = 0; i < frames_needed; i++) {
        uint32_t f = pmm_alloc_frame();
        if (f == 0) {
            serial_write("[USER] out of memory loading program\n");
            return;
        }
        if (i == 0) code_base = f;
    }

    uint8_t *dst = (uint8_t *)code_base;
    for (uint32_t i = 0; i < size; i++) dst[i] = bin[i];

    uint32_t stack_base = 0;
    for (uint32_t i = 0; i < USER_STACK_FRAMES; i++) {
        uint32_t f = pmm_alloc_frame();
        if (f == 0) {
            serial_write("[USER] out of memory allocating user stack\n");
            return;
        }
        if (i == 0) stack_base = f;
    }
    uint32_t stack_top = stack_base + (USER_STACK_FRAMES * 4096);

    serial_write("[USER] Loaded '");
    serial_write(name);
    serial_write("' at ");
    serial_write_hex(code_base);
    serial_write(", entering ring 3...\n");

    enter_usermode(code_base, stack_top);
    // Not reached: the demo program loops forever after its syscall.
}

void user_task_entry(void) {
    run_user_program("hello.bin");

    // Only reached if loading failed (e.g. initrd missing the file).
    serial_write("[USER] user_task_entry falling back to halt\n");
    for (;;) { __asm__ volatile ("hlt"); }
}
