; gdt_flush.s - Loads the GDT and reloads segment registers

global gdt_flush

gdt_flush:
    mov eax, [esp+4]   ; pointer to gdt_ptr, passed as parameter
    lgdt [eax]          ; load the new GDT

    mov ax, 0x10        ; 0x10 = offset of kernel data segment
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    mov ss, ax

    jmp 0x08:.flush      ; 0x08 = offset of kernel code segment, far jump
.flush:
    ret
