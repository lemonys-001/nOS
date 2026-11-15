; boot.s - Multiboot compliant bootloader for nOS
; Requests VESA framebuffer mode and sets up kernel entry

MBALIGN  equ  1 << 0              ; align loaded modules on page boundaries
MEMINFO  equ  1 << 1              ; provide memory map
VIDMODE  equ  1 << 2              ; request video mode
FLAGS    equ  MBALIGN | MEMINFO | VIDMODE
MAGIC    equ  0x1BADB002          ; Multiboot magic number
CHECKSUM equ -(MAGIC + FLAGS)     ; checksum of above

; Multiboot header
section .multiboot
align 4
    dd MAGIC
    dd FLAGS
    dd CHECKSUM
    dd 0, 0, 0, 0, 0              ; unused fields for a.out kludge
    dd 0                          ; 0 = set graphics mode
    dd 1024                       ; width
    dd 768                        ; height
    dd 32                         ; depth (bits per pixel)

; Reserve stack space
section .bss
align 16
stack_bottom:
    resb 16384                    ; 16 KB stack
stack_top:

; Kernel entry point
section .text
global _start
extern kernel_main

_start:
    ; Set up stack pointer
    mov esp, stack_top

    ; Push Multiboot info structure pointer and magic value
    ; These will be passed as arguments to kernel_main
    push ebx                      ; Multiboot info structure
    push eax                      ; Multiboot magic number

    ; Call the kernel main function
    call kernel_main

    ; If kernel_main returns, hang the system
    cli                           ; Disable interrupts
.hang:
    hlt                           ; Halt the CPU
    jmp .hang                     ; Jump back in case of NMI
