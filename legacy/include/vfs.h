#ifndef VFS_H
#define VFS_H

#include <stdint.h>
#include "multiboot.h"

void vfs_init(struct multiboot_info *mbi);
const uint8_t *vfs_read(const char *name, uint32_t *size_out);
void vfs_list(void);

#endif
