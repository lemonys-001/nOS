#ifndef VFS_H
#define VFS_H

#include <stdint.h>
#include "multiboot.h"

void vfs_init(struct multiboot_info *mbi);
const uint8_t *vfs_read(const char *name, uint32_t *size_out);
void vfs_list(void);

// Index-based accessors, for apps (like the file manager) that want to
// enumerate the initrd's contents rather than look up a file by name.
uint32_t vfs_file_count(void);
const char *vfs_file_name(uint32_t index);
uint32_t vfs_file_size(uint32_t index);
const uint8_t *vfs_read_index(uint32_t index, uint32_t *size_out);

#endif
