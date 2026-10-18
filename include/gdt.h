#ifndef GDT_H
#define GDT_H

#include <stdint.h>

struct gdt_entry {
    uint16_t limit_low;
    uint16_t base_low;
    uint8_t  base_middle;
    uint8_t  access;
    uint8_t  granularity;
    uint8_t  base_high;
} __attribute__((packed));

struct gdt_ptr {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

void gdt_install(void);
extern void gdt_flush(uint32_t);

// Updates the TSS's esp0 field -- the kernel stack the CPU switches to
// automatically whenever ring 3 code is interrupted (IRQ, exception, or
// an int 0x80 syscall). Must be called with a valid, sufficiently large
// stack before any ring 3 code runs.
void tss_set_kernel_stack(uint32_t stack_top);

#endif
