// task.c - Round-robin kernel task scheduler.
//
// Context switching follows the classic xv6-style `swtch` pattern: only
// the callee-saved registers (ebp, ebx, esi, edi) plus the return address
// are saved on each task's own stack, and switching is just "save esp,
// load esp, ret". EFLAGS/IF is deliberately not part of the saved context:
// a task resumed mid-interrupt-handler naturally keeps IF=0 until its own
// irq_common_stub epilogue re-enables it before iret, while a brand new
// task is launched through task_trampoline (swtch.s), which explicitly
// executes `sti` before calling the task's entry point. This avoids a
// freshly-started task silently running forever with interrupts disabled.

#include <stddef.h>
#include <stdint.h>
#include "task.h"
#include "heap.h"
#include "serial.h"

#define MAX_TASKS        8
#define TASK_STACK_SIZE  8192

typedef enum { TASK_UNUSED = 0, TASK_READY, TASK_RUNNING } task_state_t;

typedef struct {
    uint32_t *esp;
    uint8_t  *stack_base;
    task_state_t state;
    char name[16];
} task_t;

static task_t tasks[MAX_TASKS];
static int num_tasks = 0;
static int current_task = -1;
static int scheduler_enabled = 0;

// Parking spot for the original kernel_main stack context when it first
// yields control to the scheduler. Never switched back into by this
// simple round-robin design.
static uint32_t *kernel_context_esp = NULL;

extern void swtch(uint32_t **old_esp, uint32_t *new_esp);
extern void task_trampoline(void);

void tasking_init(void) {
    for (int i = 0; i < MAX_TASKS; i++) {
        tasks[i].state = TASK_UNUSED;
    }
    num_tasks = 0;
    current_task = -1;
    scheduler_enabled = 0;
}

int task_create(const char *name, void (*entry)(void)) {
    if (num_tasks >= MAX_TASKS) return -1;

    int id = num_tasks++;

    uint8_t *stack = (uint8_t *)kmalloc(TASK_STACK_SIZE);
    if (!stack) {
        serial_write("[TASK] ERROR: kmalloc failed for task stack\n");
        num_tasks--;
        return -1;
    }

    uint32_t *sp = (uint32_t *)(stack + TASK_STACK_SIZE);

    // Build the initial stack frame so that the first swtch() into this
    // task lands in task_trampoline with `entry` as its only argument.
    *(--sp) = (uint32_t)entry;            // "argument" to task_trampoline
    *(--sp) = (uint32_t)task_trampoline;  // return address swtch's ret jumps to
    *(--sp) = 0; // ebp
    *(--sp) = 0; // ebx
    *(--sp) = 0; // esi
    *(--sp) = 0; // edi

    tasks[id].esp = sp;
    tasks[id].stack_base = stack;
    tasks[id].state = TASK_READY;

    int j = 0;
    while (name[j] && j < 15) { tasks[id].name[j] = name[j]; j++; }
    tasks[id].name[j] = '\0';

    serial_write("[TASK] Created '");
    serial_write(tasks[id].name);
    serial_write("'\n");

    return id;
}

void scheduler_start(void) {
    if (num_tasks == 0) {
        serial_write("[TASK] ERROR: scheduler_start with no tasks\n");
        return;
    }

    scheduler_enabled = 1;
    current_task = 0;
    tasks[0].state = TASK_RUNNING;

    swtch(&kernel_context_esp, tasks[0].esp);
    // Not reached in this design: kernel_main's original context is
    // parked above and this simple round-robin never switches back to it.
}

void scheduler_tick(void) {
    if (!scheduler_enabled || num_tasks < 2) return;

    int prev = current_task;
    int next = (prev + 1) % num_tasks;

    if (next == prev) return;

    tasks[prev].state = TASK_READY;
    tasks[next].state = TASK_RUNNING;
    current_task = next;

    swtch(&tasks[prev].esp, tasks[next].esp);
}
