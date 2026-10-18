#ifndef COMPOSITOR_H
#define COMPOSITOR_H

void compositor_render(void);

// Task entry point: runs compositor_render() + gfx_swap() in a loop.
// Intended to be passed to task_create().
void compositor_task(void);

#endif
