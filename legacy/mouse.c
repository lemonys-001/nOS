// mouse.c - PS/2 mouse driver (IRQ12, standard 3-byte packets)

#include <stdint.h>
#include "io.h"
#include "isr.h"
#include "mouse.h"
#include "serial.h"

#define MOUSE_PORT   0x60
#define MOUSE_STATUS 0x64
#define MOUSE_ABIT   0x02
#define MOUSE_BBIT   0x01
#define MOUSE_WRITE  0xD4

static int32_t mouse_x = 512;
static int32_t mouse_y = 384;
static uint8_t mouse_buttons = 0;

static uint8_t mouse_cycle = 0;
static int8_t  mouse_packet[3];

static void mouse_wait_write(void) {
    uint32_t timeout = 100000;
    while (timeout--) {
        if ((inb(MOUSE_STATUS) & MOUSE_ABIT) == 0) return;
    }
}

static void mouse_wait_read(void) {
    uint32_t timeout = 100000;
    while (timeout--) {
        if (inb(MOUSE_STATUS) & MOUSE_BBIT) return;
    }
}

static void mouse_write(uint8_t data) {
    mouse_wait_write();
    outb(MOUSE_STATUS, MOUSE_WRITE);
    mouse_wait_write();
    outb(MOUSE_PORT, data);
}

static uint8_t mouse_read(void) {
    mouse_wait_read();
    return inb(MOUSE_PORT);
}

int32_t mouse_get_x(void) { return mouse_x; }
int32_t mouse_get_y(void) { return mouse_y; }
uint8_t mouse_get_buttons(void) { return mouse_buttons; }

static void mouse_callback(struct registers *regs) {
    (void)regs;
    uint8_t data = inb(MOUSE_PORT);

    switch (mouse_cycle) {
        case 0:
            if (!(data & 0x08)) return; // sanity check bit, drop bad packets
            mouse_packet[0] = (int8_t)data;
            mouse_cycle = 1;
            break;
        case 1:
            mouse_packet[1] = (int8_t)data;
            mouse_cycle = 2;
            break;
        case 2:
            mouse_packet[2] = (int8_t)data;
            mouse_cycle = 0;

            mouse_buttons = mouse_packet[0] & 0x07;

            int32_t dx = (int8_t)mouse_packet[1];
            int32_t dy = (int8_t)mouse_packet[2];

            mouse_x += dx;
            mouse_y -= dy; // Y is inverted in PS/2 packets vs screen coords

            if (mouse_x < 0) mouse_x = 0;
            if (mouse_y < 0) mouse_y = 0;
            if (mouse_x > 1023) mouse_x = 1023;
            if (mouse_y > 767)  mouse_y = 767;

            serial_write("[MOUSE] x=");
            serial_write_hex((uint32_t)mouse_x);
            serial_write(" y=");
            serial_write_hex((uint32_t)mouse_y);
            serial_write(" btn=");
            serial_write_hex(mouse_buttons);
            serial_write("\n");
            break;
    }
}

void mouse_init(void) {
    mouse_wait_write();
    outb(MOUSE_STATUS, 0xA8); // Enable auxiliary (mouse) device

    mouse_wait_write();
    outb(MOUSE_STATUS, 0x20); // Get current controller command byte
    uint8_t status = mouse_read();
    status |= 0x02;            // Enable IRQ12
    status &= ~0x20;           // Enable mouse clock

    mouse_wait_write();
    outb(MOUSE_STATUS, 0x60);
    mouse_wait_write();
    outb(MOUSE_PORT, status);

    mouse_write(0xF6);         // Set defaults
    mouse_read();               // ACK

    mouse_write(0xF4);         // Enable data reporting (streaming packets)
    mouse_read();               // ACK

    register_interrupt_handler(44, mouse_callback); // IRQ12 -> vector 44
}
