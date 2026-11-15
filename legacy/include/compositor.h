#ifndef COMPOSITOR_H
#define COMPOSITOR_H

// Task entry point (see task.c / task_create): runs the desktop's
// init-once-then-loop-forever render/input cycle.
void compositor_task(void);

#endif
