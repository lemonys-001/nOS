#ifndef SYSCALL_H
#define SYSCALL_H

// Installs the int 0x80 syscall gate (DPL 3, so ring-3 code may invoke it
// directly without faulting). Call once after idt_install().
void syscall_install(void);

#endif
