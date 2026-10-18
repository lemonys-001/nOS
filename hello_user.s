; hello_user.s - Tiny ring-3 demo program, assembled standalone as a flat
; binary (`nasm -f bin`) and loaded from the initrd at runtime. Since it's
; loaded at a physical address only known at boot time (no paging, no
; fixed load address), it must be fully position-independent: no absolute
; label references, only short/relative jumps and the classic call/pop
; trick to find its own string's runtime address.
;
; Behavior: prints a line via syscall 0 (write_serial), then spins forever.

BITS 32

start:
    jmp short setup

get_msg:
    pop ebx            ; ebx = runtime address of the string (see setup:)
    mov eax, 0          ; syscall 0 = write_serial
    int 0x80
hang:
    jmp hang

setup:
    call get_msg          ; pushes the address of the very next byte (msg)
msg: db "HELLO FROM RING 3 USERLAND!", 0x0A, 0
