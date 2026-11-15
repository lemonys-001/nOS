#ifndef RAMFS_H
#define RAMFS_H

#include <stdint.h>

// A small writable, in-memory (RAM-only, not persisted to disk) file
// store. Separate from the read-only initrd VFS (vfs.c). This is what
// lets the File Manager "make apps": since there's no on-OS compiler,
// what you actually create here are nScript (.ns) text scripts, run from
// the Console via the content you save.

#define RAMFS_MAX_FILES 16
#define RAMFS_NAME_LEN  32
#define RAMFS_MAX_SIZE  2048

void ramfs_init(void);

// Creates an empty file. Returns 1 on success, 0 if the name already
// exists or the table is full.
int ramfs_create(const char *name);

// Overwrites a file's content (creating it if it doesn't exist). Returns
// 1 on success, 0 if the table is full (new file) or data is too large.
int ramfs_write(const char *name, const char *data, uint32_t len);

// Returns a pointer to the file's content and sets *len_out, or NULL if
// the file doesn't exist.
const char *ramfs_read(const char *name, uint32_t *len_out);

int ramfs_delete(const char *name);

uint32_t ramfs_file_count(void);
const char *ramfs_file_name(uint32_t index);
uint32_t ramfs_file_size(uint32_t index);

#endif
