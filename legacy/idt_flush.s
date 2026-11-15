; idt_flush.s - Loads the IDT

global idt_flush

idt_flush:
    mov eax, [esp+4]   ; pointer to idt_ptr, passed as parameter
    lidt [eax]          ; load the new IDT
    ret
