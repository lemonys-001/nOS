; usermode.s - Performs the ring0 -> ring3 privilege transition.
;
; enter_usermode(uint32_t entry, uint32_t user_stack_top) -- cdecl.
; Builds the 5-value iret frame (SS, ESP, EFLAGS, CS, ESP... err EIP)
; needed for a privilege-level change and jumps there. Never returns.

global enter_usermode

enter_usermode:
    mov eax, [esp+4]    ; entry point
    mov ebx, [esp+8]    ; user stack top

    cli                   ; clean transition; EFLAGS pushed below re-enables IF

    mov cx, 0x23          ; user data selector = GDT index 4 (0x20) | RPL 3
    mov ds, cx
    mov es, cx
    mov fs, cx
    mov gs, cx

    push dword 0x23        ; SS  (user data selector)
    push ebx                 ; ESP (user stack pointer)
    push dword 0x202          ; EFLAGS (IF=1)
    push dword 0x1B            ; CS  (user code selector = GDT index 3 (0x18) | RPL 3)
    push eax                     ; EIP (entry point)
    iret
