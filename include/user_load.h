#ifndef USER_LOAD_H
#define USER_LOAD_H

// Reads a flat binary named `name` out of the initrd, copies it into
// freshly-allocated physical frames (identity-mapped, no paging yet),
// allocates a small user stack the same way, and transitions to ring 3
// at the program's first byte. Never returns on success.
void run_user_program(const char *name);

// Task entry point suitable for task_create(): runs "hello.bin".
void user_task_entry(void);

#endif
