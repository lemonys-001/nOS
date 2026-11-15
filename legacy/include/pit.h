#ifndef PIT_H
#define PIT_H

#include <stdint.h>

void pit_init(uint32_t freq);
void pit_install(void);

// Monotonic tick counter incremented on every PIT interrupt (100Hz by
// default). Used as a real hardware time base for pacing things like the
// Snake game loop, independent of how fast the render loop itself spins.
uint32_t pit_get_ticks(void);

#endif
