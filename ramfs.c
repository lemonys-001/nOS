// ramfs.c - Minimal writable in-memory file store. Statically allocated
// (no kmalloc dependency, no interaction with the PMM/heap machinery used
// elsewhere), so this module is self-contained and low-risk to add.

#include <stdint.h>
#include "ramfs.h"

typedef struct {
    char name[RAMFS_NAME_LEN];
    char data[RAMFS_MAX_SIZE];
    uint32_t size;
    int used;
} ramfs_entry_t;

static ramfs_entry_t files[RAMFS_MAX_FILES];

static int str_eq(const char *a, const char *b) {
    while (*a && *b) { if (*a != *b) return 0; a++; b++; }
    return *a == *b;
}

static void str_copy(char *dst, const char *src, int max_len) {
    int i = 0;
    while (src[i] && i < max_len - 1) { dst[i] = src[i]; i++; }
    dst[i] = '\0';
}

static int find_index(const char *name) {
    for (int i = 0; i < RAMFS_MAX_FILES; i++) {
        if (files[i].used && str_eq(files[i].name, name)) return i;
    }
    return -1;
}

void ramfs_init(void) {
    for (int i = 0; i < RAMFS_MAX_FILES; i++) files[i].used = 0;
}

int ramfs_create(const char *name) {
    if (find_index(name) >= 0) return 0;

    for (int i = 0; i < RAMFS_MAX_FILES; i++) {
        if (!files[i].used) {
            str_copy(files[i].name, name, RAMFS_NAME_LEN);
            files[i].size = 0;
            files[i].used = 1;
            return 1;
        }
    }
    return 0;
}

int ramfs_write(const char *name, const char *data, uint32_t len) {
    if (len > RAMFS_MAX_SIZE) return 0;

    int idx = find_index(name);
    if (idx < 0) {
        if (!ramfs_create(name)) return 0;
        idx = find_index(name);
    }

    for (uint32_t i = 0; i < len; i++) files[idx].data[i] = data[i];
    files[idx].size = len;
    return 1;
}

const char *ramfs_read(const char *name, uint32_t *len_out) {
    int idx = find_index(name);
    if (idx < 0) return NULL;
    if (len_out) *len_out = files[idx].size;
    return files[idx].data;
}

int ramfs_delete(const char *name) {
    int idx = find_index(name);
    if (idx < 0) return 0;
    files[idx].used = 0;
    return 1;
}

uint32_t ramfs_file_count(void) {
    uint32_t count = 0;
    for (int i = 0; i < RAMFS_MAX_FILES; i++) if (files[i].used) count++;
    return count;
}

// Index here means "the Nth used slot", scanned in table order -- stable
// as long as nothing is created/deleted between calls in the same frame,
// which is how the File Manager uses it (re-enumerates fully each frame).
static int nth_used_slot(uint32_t n) {
    uint32_t seen = 0;
    for (int i = 0; i < RAMFS_MAX_FILES; i++) {
        if (files[i].used) {
            if (seen == n) return i;
            seen++;
        }
    }
    return -1;
}

const char *ramfs_file_name(uint32_t index) {
    int idx = nth_used_slot(index);
    return idx < 0 ? "" : files[idx].name;
}

uint32_t ramfs_file_size(uint32_t index) {
    int idx = nth_used_slot(index);
    return idx < 0 ? 0 : files[idx].size;
}
