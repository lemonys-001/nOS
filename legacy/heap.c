// heap.c - Simple first-fit heap allocator backed by the PMM.
//
// Reserves a contiguous run of physical frames up front (safe because this
// runs immediately after pmm_init, before anything else allocates memory)
// and manages it with an explicit free list of headers.

#include <stddef.h>
#include <stdint.h>
#include "heap.h"
#include "pmm.h"
#include "serial.h"

#define FRAME_SIZE 4096
#define HEAP_SIZE  (8 * 1024 * 1024) // 8MB kernel heap

typedef struct block_header {
    size_t size;
    int free;
    struct block_header *next;
} block_header_t;

static uint8_t *heap_start = NULL;
static block_header_t *free_list = NULL;

void heap_init(void) {
    uint32_t frames_needed = HEAP_SIZE / FRAME_SIZE;
    uint32_t first_addr = 0;

    for (uint32_t i = 0; i < frames_needed; i++) {
        uint32_t addr = pmm_alloc_frame();
        if (addr == 0) {
            serial_write("[HEAP] ERROR: out of physical frames during heap_init\n");
            break;
        }
        if (i == 0) first_addr = addr;
        // Frames are assumed contiguous here since heap_init runs before
        // any other allocations take place.
    }

    heap_start = (uint8_t *)first_addr;
    free_list = (block_header_t *)heap_start;
    free_list->size = HEAP_SIZE - sizeof(block_header_t);
    free_list->free = 1;
    free_list->next = NULL;

    serial_write("[HEAP] Initialized ");
    serial_write_hex(HEAP_SIZE);
    serial_write(" bytes at ");
    serial_write_hex(first_addr);
    serial_write("\n");
}

void *kmalloc(size_t size) {
    size = (size + 7) & ~((size_t)7); // 8-byte align

    block_header_t *cur = free_list;
    while (cur) {
        if (cur->free && cur->size >= size) {
            // Split the block if there's enough room left over
            if (cur->size >= size + sizeof(block_header_t) + 8) {
                block_header_t *new_block =
                    (block_header_t *)((uint8_t *)cur + sizeof(block_header_t) + size);
                new_block->size = cur->size - size - sizeof(block_header_t);
                new_block->free = 1;
                new_block->next = cur->next;

                cur->next = new_block;
                cur->size = size;
            }
            cur->free = 0;
            return (void *)((uint8_t *)cur + sizeof(block_header_t));
        }
        cur = cur->next;
    }

    return NULL; // Out of heap memory
}

void kfree(void *ptr) {
    if (!ptr) return;

    block_header_t *hdr = (block_header_t *)((uint8_t *)ptr - sizeof(block_header_t));
    hdr->free = 1;

    // Coalesce with the next block if it's free and adjacent
    if (hdr->next && hdr->next->free &&
        (uint8_t *)hdr + sizeof(block_header_t) + hdr->size == (uint8_t *)hdr->next) {
        hdr->size += sizeof(block_header_t) + hdr->next->size;
        hdr->next = hdr->next->next;
    }
}
