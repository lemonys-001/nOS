// gdt.c - Global Descriptor Table + Task State Segment setup.
//
// Layout: 0=null, 1=kernel code, 2=kernel data, 3=user code (DPL3),
// 4=user data (DPL3), 5=TSS. Entries 3/4 were already prepared back in
// Phase 3 in anticipation of this phase. The TSS here is only used for
// its esp0/ss0 fields (the stack the CPU switches to on a ring3->ring0
// privilege change) -- we never perform a hardware task switch via it.

#include <stdint.h>
#include "gdt.h"

struct gdt_entry gdt[6];
struct gdt_ptr   gdt_p;

struct tss_entry {
    uint32_t prev_tss;
    uint32_t esp0;
    uint32_t ss0;
    uint32_t esp1;
    uint32_t ss1;
    uint32_t esp2;
    uint32_t ss2;
    uint32_t cr3;
    uint32_t eip;
    uint32_t eflags;
    uint32_t eax, ecx, edx, ebx;
    uint32_t esp, ebp, esi, edi;
    uint32_t es, cs, ss, ds, fs, gs;
    uint32_t ldt;
    uint16_t trap;
    uint16_t iomap_base;
} __attribute__((packed));

// Zero-initialized by the C runtime (BSS) -- no explicit memset needed.
static struct tss_entry tss;

static void gdt_set_gate(int32_t num, uint32_t base, uint32_t limit,
                          uint8_t access, uint8_t gran) {
    gdt[num].base_low    = (base & 0xFFFF);
    gdt[num].base_middle  = (base >> 16) & 0xFF;
    gdt[num].base_high    = (base >> 24) & 0xFF;

    gdt[num].limit_low    = (limit & 0xFFFF);
    gdt[num].granularity  = (limit >> 16) & 0x0F;

    gdt[num].granularity |= gran & 0xF0;
    gdt[num].access       = access;
}

void gdt_install(void) {
    gdt_p.limit = (sizeof(struct gdt_entry) * 6) - 1;
    gdt_p.base  = (uint32_t)&gdt;

    gdt_set_gate(0, 0, 0, 0, 0);                        // Null segment
    gdt_set_gate(1, 0, 0xFFFFFFFF, 0x9A, 0xCF);          // Kernel code (ring 0)
    gdt_set_gate(2, 0, 0xFFFFFFFF, 0x92, 0xCF);          // Kernel data (ring 0)
    gdt_set_gate(3, 0, 0xFFFFFFFF, 0xFA, 0xCF);          // User code   (ring 3)
    gdt_set_gate(4, 0, 0xFFFFFFFF, 0xF2, 0xCF);          // User data   (ring 3)
    gdt_set_gate(5, (uint32_t)&tss, sizeof(tss) - 1, 0x89, 0x00); // TSS

    gdt_flush((uint32_t)&gdt_p);

    tss.ss0 = 0x10;           // kernel data selector
    tss.esp0 = 0;             // set later via tss_set_kernel_stack(), once the heap exists
    tss.iomap_base = sizeof(tss); // no I/O permission bitmap

    __asm__ volatile ("ltr %%ax" :: "a"((uint16_t)0x28)); // selector = index 5 * 8
}

void tss_set_kernel_stack(uint32_t stack_top) {
    tss.esp0 = stack_top;
}
