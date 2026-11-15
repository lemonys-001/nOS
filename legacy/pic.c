// pic.c - Remaps the 8259 PIC so IRQs 0-15 map to interrupts 32-47,
// avoiding conflicts with CPU exception vectors 0-31.

#include "io.h"
#include "pic.h"

#define PIC1        0x20
#define PIC2        0xA0
#define PIC1_DATA   0x21
#define PIC2_DATA   0xA1

#define ICW1_INIT   0x10
#define ICW1_ICW4   0x01
#define ICW4_8086   0x01

void pic_remap(void) {
    uint8_t mask1 = inb(PIC1_DATA);
    uint8_t mask2 = inb(PIC2_DATA);

    outb(PIC1, ICW1_INIT | ICW1_ICW4); io_wait();
    outb(PIC2, ICW1_INIT | ICW1_ICW4); io_wait();

    outb(PIC1_DATA, 0x20); io_wait();  // Master PIC vector offset -> 32
    outb(PIC2_DATA, 0x28); io_wait();  // Slave PIC vector offset -> 40

    outb(PIC1_DATA, 0x04); io_wait();  // Tell master PIC about slave at IRQ2
    outb(PIC2_DATA, 0x02); io_wait();  // Tell slave PIC its cascade identity

    outb(PIC1_DATA, ICW4_8086); io_wait();
    outb(PIC2_DATA, ICW4_8086); io_wait();

    outb(PIC1_DATA, mask1);            // Restore saved masks
    outb(PIC2_DATA, mask2);
}
