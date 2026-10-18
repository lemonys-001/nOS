// kernel.c - nOS Kernel Entry Point (Phase 6a)
// Adds a PIT-driven preemptive round-robin scheduler. The GUI compositor
// now runs as its own kernel task, alongside a second "monitor" task that
// proves real preemption is happening via a serial heartbeat.

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
#include "pit.h"
#include "task.h"

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

// Second kernel task: proves the scheduler is really preempting by
// printing a heartbeat to serial independently of the compositor task.
static void monitor_task(void) {
    uint32_t tick = 0;
    while (1) {
        serial_write("[MONITOR] heartbeat #");
        serial_write_hex(tick++);
        serial_write(" free_frames=");
        serial_write_hex(pmm_get_free_frames());
        serial_write("\n");

        for (volatile uint32_t i = 0; i < 20000000; i++) { }
    }
}

void kernel_main(uint32_t magic, struct multiboot_info *mbi) {
    if (magic != MULTIBOOT_MAGIC) {
        while (1) { __asm__ volatile ("hlt"); }
    }

    if (framebuffer_init(mbi) != 0) {
        while (1) { __asm__ volatile ("hlt"); }
    }

    clear_screen(WIN7_BLUE);

    serial_init();
    serial_write("\n=== nOS Phase 6a: Preemptive Kernel Task Scheduler ===\n");

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

    pit_install();
    serial_write("[OK] PIT handler registered on IRQ0\n");

    __asm__ volatile ("sti");
    serial_write("[OK] Interrupts enabled\n");

    pit_init(100);
    serial_write("[OK] PIT running at 100Hz\n");

    tasking_init();
    task_create("compositor", compositor_task);
    task_create("monitor", monitor_task);

    serial_write("[OK] Starting preemptive scheduler\n\n");
    scheduler_start();

    // Not reached: scheduler_start() hands control to the task threads above.
    while (1) { __asm__ volatile ("hlt"); }
}
