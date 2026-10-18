# Makefile for nOS - Phase 5

# Compiler and tools
AS = nasm
CC = gcc
LD = ld
PYTHON = python3

# Flags
ASFLAGS = -f elf32
CFLAGS = -m32 -ffreestanding -O2 -Wall -Wextra -fno-exceptions -fno-stack-protector -nostdlib -nostartfiles -Iinclude
LDFLAGS = -m elf_i386 -T linker.ld

# Source files (boot.s must link first so the Multiboot header lands early).
# NOTE: assembly ISR stubs live in isr_stubs.s (not isr.s) so they don't
# collide with isr.c -> isr.o during compilation.
ASM_SRC = boot.s gdt_flush.s idt_flush.s isr_stubs.s
C_SRC = kernel.c gdt.c idt.c isr.c pic.c keyboard.c mouse.c serial.c pmm.c heap.c gfx.c font.c compositor.c vfs.c

# Object files
ASM_OBJ = $(ASM_SRC:.s=.o)
C_OBJ = $(C_SRC:.c=.o)
OBJS = $(ASM_OBJ) $(C_OBJ)

# Output
KERNEL = nOS.bin
ISO = nOS.iso
ISODIR = isodir
INITRD = initrd.img

# Default target
all: $(ISO)

# Assemble .s files
%.o: %.s
	$(AS) $(ASFLAGS) $< -o $@

# Compile .c files
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# Link kernel
$(KERNEL): $(OBJS)
	$(LD) $(LDFLAGS) -o $@ $(OBJS)

# Pack the initrd/ directory into the custom initrd format
$(INITRD): tools/mkinitrd.py $(wildcard initrd/*)
	$(PYTHON) tools/mkinitrd.py initrd $(INITRD)

# Create bootable ISO (kernel + initrd module)
$(ISO): $(KERNEL) $(INITRD)
	mkdir -p $(ISODIR)/boot/grub
	cp $(KERNEL) $(ISODIR)/boot/$(KERNEL)
	cp $(INITRD) $(ISODIR)/boot/$(INITRD)
	echo 'menuentry "nOS" {' > $(ISODIR)/boot/grub/grub.cfg
	echo '    multiboot /boot/$(KERNEL)' >> $(ISODIR)/boot/grub/grub.cfg
	echo '    module /boot/$(INITRD)' >> $(ISODIR)/boot/grub/grub.cfg
	echo '    boot' >> $(ISODIR)/boot/grub/grub.cfg
	echo '}' >> $(ISODIR)/boot/grub/grub.cfg
	grub-mkrescue -o $(ISO) $(ISODIR)

# Run in QEMU
run: $(ISO)
	qemu-system-i386 -cdrom $(ISO) -m 128M

# Run in QEMU with serial output visible in the terminal (see PMM/heap/VFS/keyboard/mouse debug logs)
run-serial: $(ISO)
	qemu-system-i386 -cdrom $(ISO) -m 128M -serial stdio

# Run in QEMU with specific graphics
run-vga: $(ISO)
	qemu-system-i386 -cdrom $(ISO) -m 128M -vga std

# Clean build artifacts
clean:
	rm -f $(OBJS) $(KERNEL) $(INITRD)
	rm -rf $(ISODIR)

# Clean everything including ISO
distclean: clean
	rm -f $(ISO)

# Debug info
debug:
	@echo "ASM Objects: $(ASM_OBJ)"
	@echo "C Objects: $(C_OBJ)"
	@echo "All Objects: $(OBJS)"
	@echo "Kernel: $(KERNEL)"
	@echo "Initrd: $(INITRD)"
	@echo "ISO: $(ISO)"

.PHONY: all run run-serial run-vga clean distclean debug
