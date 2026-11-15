/* linker.ld - Linker script for nOS kernel */

/* Entry point of the kernel */
ENTRY(_start)

/* Define the sections */
SECTIONS
{
    /* The kernel will be loaded at 1MB (0x100000) */
    . = 1M;

    /* Multiboot header must be at the very beginning */
    .multiboot : ALIGN(4K)
    {
        *(.multiboot)
    }

    /* Read-only data (code) */
    .text : ALIGN(4K)
    {
        *(.text)
    }

    /* Read-only data */
    .rodata : ALIGN(4K)
    {
        *(.rodata)
    }

    /* Initialized data */
    .data : ALIGN(4K)
    {
        *(.data)
    }

    /* Uninitialized data (BSS) */
    .bss : ALIGN(4K)
    {
        *(COMMON)
        *(.bss)
    }

    /* Mark the end of the kernel */
    _kernel_end = .;
}
