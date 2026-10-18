// kernel.c - nOS Kernel Entry Point (Phase 5)
// Adds a minimal read-only VFS backed by a custom initrd format, loaded as
// a GRUB multiboot module and parsed in vfs.c.

#include <stdint.h>
#include <stddef.h>
#include "multiboot.h"
#include "gdt.h"
#include "idt.h"
#include "isr.h"
#include "keyboard.h"
#include "mouse.h"
#include "serial.h"
#include "pmm.h"
#include "heap.h"
#include "gfx.h"
#include "compositor.h"
#include "vfs.h"

#define MULTIBOOT_MAGIC 0x2BADB002
#define WIN7_BLUE 0x00A2ED

static uint32_t *framebuffer = NULL;
static uint32_t fb_width = 0;
static uint32_t fb_height = 0;
static uint32_t fb_pitch = 0;
static uint8_t fb_bpp = 0;

void *memset(void *dst, int c, size_t n) {
    uint8_t *d = (uint8_t *)dst;
    while (n-- > 0) {
        *d++ = (uint8_t)c;
    }
    return dst;
}

int framebuffer_init(struct multiboot_info *mbi) {
    if (!(mbi->flags & (1 << 12))) {
        return -1;
    }

    framebuffer = (uint32_t *)(uintptr_t)mbi->framebuffer_addr;
    fb_width = mbi->framebuffer_width;
    fb_height = mbi->framebuffer_height;
    fb_pitch = mbi->framebuffer_pitch;
    fb_bpp = mbi->framebuffer_bpp;

    if (framebuffer == NULL || fb_width == 0 || fb_height == 0) {
        return -1;
    }

    return 0;
}

static void clear_screen(uint32_t color) {
    if (framebuffer == NULL) return;
    uint32_t pixel_count = fb_width * fb_height;
    for (uint32_t i = 0; i < pixel_count; i++) {
        framebuffer[i] = color;
    }
}

static void print_file_to_serial(const char *name) {
    uint32_t size = 0;
    const uint8_t *data = vfs_read(name, &size);
    serial_write("[VFS] ");
    serial_write(name);
    if (!data) {
        serial_write(" -> not found\n");
        return;
    }
    serial_write(" -> \n--------------------\n");
    for (uint32_t i = 0; i < size; i++) {
        serial_write_char((char)data[i]);
    }
    serial_write("--------------------\n");
}

void kernel_main(uint32_t magic, struct multiboot_info *mbi) {
    if (magic != MULTIBOOT_MAGIC) {
        while (1) { __asm__ volatile ("hlt"); }
    }

    if (framebuffer_init(mbi) != 0) {
        while (1) { __asm__ volatile ("hlt"); }
    }

    clear_screen(WIN7_BLUE); // immediate visual feedback before the GUI engine spins up

    serial_init();
    serial_write("\n=== nOS Phase 5: Virtual Filesystem ===\n");

    gdt_install();
    serial_write("[OK] GDT installed\n");

    idt_install();
    serial_write("[OK] IDT installed\n");

    isr_install();
    serial_write("[OK] ISRs/IRQs installed, PIC remapped\n");

    keyboard_init();
    serial_write("[OK] Keyboard driver initialized (IRQ1)\n");

    mouse_init();
    serial_write("[OK] Mouse driver initialized (IRQ12)\n");

    __asm__ volatile ("sti");
    serial_write("[OK] Interrupts enabled\n");

    pmm_init(mbi);
    serial_write("[OK] Physical memory manager initialized\n");

    heap_init();
    serial_write("[OK] Kernel heap initialized\n");

    vfs_init(mbi);
    vfs_list();
    print_file_to_serial("config.txt");
    print_file_to_serial("logo.txt");

    gfx_init(framebuffer, fb_width, fb_height);
    serial_write("[OK] GFX double buffer allocated\n");

    serial_write("[OK] Entering compositor render loop\n\n");

    while (1) {
        compositor_render();
        gfx_swap();
    }
}
