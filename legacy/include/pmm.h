#ifndef PMM_H
#define PMM_H

#include <stdint.h>
#include "multiboot.h"

void pmm_init(struct multiboot_info *mbi);
uint32_t pmm_alloc_frame(void);
void pmm_free_frame(uint32_t addr);
uint32_t pmm_get_total_frames(void);
uint32_t pmm_get_free_frames(void);

#endif
