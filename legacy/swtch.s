; swtch.s - Minimal context switch (xv6-style) + fresh-task trampoline.
;
; swtch(uint32_t **old_esp, uint32_t *new_esp):
;   Saves the caller's callee-saved registers on its own stack, stores the
;   resulting ESP into *old_esp, then loads ESP from new_esp and restores
;   that task's callee-saved registers before returning (via `ret`) into
;   wherever that task's stack says to resume.
;
; EFLAGS/IF is intentionally not part of this saved context -- see the
; comment in task.c for why that's safe here.

global swtch
global task_trampoline

swtch:
    mov eax, [esp+4]    ; eax = &old_esp
    mov edx, [esp+8]    ; edx = new_esp value

    push ebp
    push ebx
    push esi
    push edi

    mov [eax], esp       ; *old_esp = current esp
    mov esp, edx          ; switch stacks

    pop edi
    pop esi
    pop ebx
    pop ebp
    ret

; Entry point for a task's very first run. task_create() arranges the
; initial stack so that swtch's `ret` lands here with the task's entry
; function pointer sitting at [esp] (as if task_trampoline had been
; `call`ed with one cdecl argument).
task_trampoline:
    pop eax              ; eax = entry function pointer
    sti                  ; safe to enable interrupts now that this task is live
    call eax
.trampoline_halt:         ; entry functions are expected to loop forever;
    cli                   ; if one ever returns, halt rather than run wild
    hlt
    jmp .trampoline_halt
