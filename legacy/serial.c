// serial.c - Minimal COM1 serial driver for debug output

#include <stdint.h>
#include "io.h"
#include "serial.h"

#define COM1 0x3F8

void serial_init(void) {
    outb(COM1 + 1, 0x00);    // Disable interrupts
    outb(COM1 + 3, 0x80);    // Enable DLAB
    outb(COM1 + 0, 0x03);    // Divisor low byte (38400 baud)
    outb(COM1 + 1, 0x00);    // Divisor high byte
    outb(COM1 + 3, 0x03);    // 8 bits, no parity, one stop bit
    outb(COM1 + 2, 0xC7);    // Enable FIFO, clear, 14-byte threshold
    outb(COM1 + 4, 0x0B);    // IRQs enabled, RTS/DSR set
}

static int serial_transmit_empty(void) {
    return inb(COM1 + 5) & 0x20;
}

void serial_write_char(char c) {
    while (!serial_transmit_empty());
    outb(COM1, (uint8_t)c);
}

void serial_write(const char *str) {
    while (*str) {
        if (*str == '\n') serial_write_char('\r');
        serial_write_char(*str++);
    }
}

void serial_write_hex(uint32_t n) {
    const char *hex = "0123456789ABCDEF";
    serial_write("0x");
    for (int i = 28; i >= 0; i -= 4) {
        serial_write_char(hex[(n >> i) & 0xF]);
    }
}
