#ifndef VFS_H
#define VFS_H

#include <stdint.h>
#include "multiboot.h"

// Parses the initrd multiboot module (built by tools/mkinitrd.py) into an
// in-memory file table. Must be called after pmm_init() has reserved the
// module's frames, and before anything else allocates memory that could
// land on top of it.
void vfs_init(struct multiboot_info *mbi);

// Returns a pointer directly into the initrd module's memory (no copy) and
// sets *size_out, or returns NULL if the name isn't found.
const uint8_t *vfs_read(const char *name, uint32_t *size_out);

// Prints every file name + size in the initrd to serial, for debugging.
void vfs_list(void);

#endif
