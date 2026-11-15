#ifndef TASK_H
#define TASK_H

// Minimal preemptive round-robin scheduler for kernel-mode threads.
// All tasks share the kernel's address space and ring 0 (no process
// isolation yet -- that needs a TSS + ring 3 segments + paging, which
// come later). Still real preemption: the PIT fires scheduler_tick()
// on every timer interrupt and context-switches between tasks.

void tasking_init(void);

// Creates a task running `entry` (which should never return; if it does,
// the task halts). Returns the task id, or -1 if the task table is full.
int task_create(const char *name, void (*entry)(void));

// Switches from the caller's context into task 0 and begins scheduling.
// Must be called after at least one task_create(). Does not return.
void scheduler_start(void);

// Called from the PIT IRQ0 handler: advances to the next ready task.
void scheduler_tick(void);

#endif
