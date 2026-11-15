// vfs.c - Minimal read-only virtual filesystem backed by a custom initrd
// format loaded as a GRUB multiboot module. See tools/mkinitrd.py for the
// on-disk layout this parses:
//
//   [uint32 file_count]
//   repeated file_count times:
//     [char name[32]]   (NUL padded)
//     [uint32 size]
//   concatenated raw file data, in the same order as the headers

#include <stddef.h>
#include "vfs.h"
#include "serial.h"

#define VFS_MAX_FILES 64
#define VFS_NAME_LEN  32

typedef struct {
    char name[VFS_NAME_LEN];
    uint32_t size;
    uint32_t offset; // relative to data_start
} vfs_entry_t;

static vfs_entry_t entries[VFS_MAX_FILES];
static uint32_t entry_count = 0;
static const uint8_t *data_start = NULL;
static int vfs_ready = 0;

static void k_memcpy(void *dst, const void *src, uint32_t n) {
    uint8_t *d = (uint8_t *)dst;
    const uint8_t *s = (const uint8_t *)src;
    while (n--) *d++ = *s++;
}

static int str_eq(const char *a, const char *b) {
    while (*a && *b) {
        if (*a != *b) return 0;
        a++; b++;
    }
    return *a == *b;
}

void vfs_init(struct multiboot_info *mbi) {
    if (!(mbi->flags & (1 << 3)) || mbi->mods_count == 0) {
        serial_write("[VFS] No initrd module present\n");
        return;
    }

    struct multiboot_module *mods =
        (struct multiboot_module *)(uintptr_t)mbi->mods_addr;
    const uint8_t *p = (const uint8_t *)(uintptr_t)mods[0].mod_start;

    uint32_t count;
    k_memcpy(&count, p, 4);
    p += 4;

    if (count > VFS_MAX_FILES) count = VFS_MAX_FILES;

    uint32_t cumulative = 0;
    for (uint32_t i = 0; i < count; i++) {
        k_memcpy(entries[i].name, p, VFS_NAME_LEN);
        p += VFS_NAME_LEN;

        uint32_t sz;
        k_memcpy(&sz, p, 4);
        p += 4;

        entries[i].size = sz;
        entries[i].offset = cumulative;
        cumulative += sz;
    }

    entry_count = count;
    data_start = p; // file data begins right after the header table
    vfs_ready = 1;

    serial_write("[VFS] initrd parsed, ");
    serial_write_hex(entry_count);
    serial_write(" file(s)\n");
}

const uint8_t *vfs_read(const char *name, uint32_t *size_out) {
    if (!vfs_ready) return NULL;

    for (uint32_t i = 0; i < entry_count; i++) {
        if (str_eq(entries[i].name, name)) {
            if (size_out) *size_out = entries[i].size;
            return data_start + entries[i].offset;
        }
    }
    return NULL;
}

void vfs_list(void) {
    if (!vfs_ready) {
        serial_write("[VFS] not initialized\n");
        return;
    }
    serial_write("[VFS] Files:\n");
    for (uint32_t i = 0; i < entry_count; i++) {
        serial_write("  - ");
        serial_write(entries[i].name);
        serial_write(" (");
        serial_write_hex(entries[i].size);
        serial_write(" bytes)\n");
    }
}
