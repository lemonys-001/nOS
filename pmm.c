// pmm.c - Physical Memory Manager (bitmap frame allocator, 4KB frames)
//
// NOTE: Paging is not yet enabled in nOS, so physical addresses are used
// directly as pointers (identity mapping is implicit). A future phase can
// introduce a virtual memory layer on top of this allocator.

#include <stddef.h>
#include "pmm.h"
#include "multiboot.h"
#include "serial.h"

#define FRAME_SIZE   4096
#define MAX_FRAMES   131072   // 512 MB worth of 4KB frames (bitmap capacity)
#define BITMAP_WORDS (MAX_FRAMES / 32)

static uint32_t frame_bitmap[BITMAP_WORDS];
static uint32_t total_frames = 0;
static uint32_t free_frames = 0;

extern uint32_t _kernel_end;

static void bitmap_set(uint32_t frame) {
    frame_bitmap[frame / 32] |= (1u << (frame % 32));
}

static void bitmap_clear(uint32_t frame) {
    frame_bitmap[frame / 32] &= ~(1u << (frame % 32));
}

static int bitmap_test(uint32_t frame) {
    return (frame_bitmap[frame / 32] & (1u << (frame % 32))) != 0;
}

static void reserve_range(uint32_t start_addr, uint32_t end_addr) {
    uint32_t start_frame = start_addr / FRAME_SIZE;
    uint32_t end_frame = (end_addr + FRAME_SIZE - 1) / FRAME_SIZE;
    for (uint32_t i = start_frame; i < end_frame && i < total_frames; i++) {
        if (!bitmap_test(i)) {
            bitmap_set(i);
            free_frames--;
        }
    }
}

void pmm_init(struct multiboot_info *mbi) {
    // Default assumption if no memory map info is present
    uint32_t total_mem_bytes = 16 * 1024 * 1024;

    if (mbi->flags & 0x1) {
        total_mem_bytes = 0x100000 + (mbi->mem_upper * 1024);
    }

    total_frames = total_mem_bytes / FRAME_SIZE;
    if (total_frames > MAX_FRAMES) total_frames = MAX_FRAMES;

    // Start with everything marked used
    for (uint32_t i = 0; i < BITMAP_WORDS; i++) frame_bitmap[i] = 0xFFFFFFFF;
    free_frames = 0;

    // Free all frames from the 1MB mark onward
    uint32_t first_free_frame = 0x100000 / FRAME_SIZE; // frame 256
    for (uint32_t i = first_free_frame; i < total_frames; i++) {
        bitmap_clear(i);
        free_frames++;
    }

    // Re-reserve the frames occupied by the kernel image itself
    uint32_t kernel_end_addr = (uint32_t)&_kernel_end;
    reserve_range(0x100000, kernel_end_addr);

    // Re-reserve frames occupied by any GRUB-loaded multiboot modules
    // (e.g. the initrd) so the heap allocator can't later hand them out.
    if (mbi->flags & (1 << 3)) {
        struct multiboot_module *mods =
            (struct multiboot_module *)(uintptr_t)mbi->mods_addr;
        for (uint32_t m = 0; m < mbi->mods_count; m++) {
            reserve_range(mods[m].mod_start, mods[m].mod_end);
        }
    }

    serial_write("[PMM] Total frames: ");
    serial_write_hex(total_frames);
    serial_write(" Free frames: ");
    serial_write_hex(free_frames);
    serial_write("\n");
}

uint32_t pmm_alloc_frame(void) {
    for (uint32_t w = 0; w < BITMAP_WORDS; w++) {
        if (frame_bitmap[w] != 0xFFFFFFFF) {
            for (uint32_t b = 0; b < 32; b++) {
                uint32_t frame = w * 32 + b;
                if (frame >= total_frames) return 0;
                if (!bitmap_test(frame)) {
                    bitmap_set(frame);
                    free_frames--;
                    return frame * FRAME_SIZE;
                }
            }
        }
    }
    return 0; // Out of memory
}

void pmm_free_frame(uint32_t addr) {
    uint32_t frame = addr / FRAME_SIZE;
    if (frame < total_frames && bitmap_test(frame)) {
        bitmap_clear(frame);
        free_frames++;
    }
}

uint32_t pmm_get_total_frames(void) { return total_frames; }
uint32_t pmm_get_free_frames(void) { return free_frames; }
