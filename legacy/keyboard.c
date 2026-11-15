// keyboard.c - PS/2 keyboard driver (IRQ1, scancode set 1, US layout)

#include <stdint.h>
#include "io.h"
#include "isr.h"
#include "keyboard.h"
#include "serial.h"

#define KBD_BUFFER_SIZE 256

static char kbd_buffer[KBD_BUFFER_SIZE];
static uint16_t kbd_head = 0;
static uint16_t kbd_tail = 0;
static int shift_pressed = 0;

static const char scancode_ascii[128] = {
    0,  27, '1','2','3','4','5','6','7','8','9','0','-','=','\b',
    '\t','q','w','e','r','t','y','u','i','o','p','[',']','\n',
    0, 'a','s','d','f','g','h','j','k','l',';','\'','`',
    0, '\\','z','x','c','v','b','n','m',',','.','/', 0,
    '*', 0, ' ', 0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
};

static const char scancode_ascii_shift[128] = {
    0,  27, '!','@','#','$','%','^','&','*','(',')','_','+','\b',
    '\t','Q','W','E','R','T','Y','U','I','O','P','{','}','\n',
    0, 'A','S','D','F','G','H','J','K','L',':','"','~',
    0, '|','Z','X','C','V','B','N','M','<','>','?', 0,
    '*', 0, ' ', 0,
    0,0,0,0,0,0,0,0,0,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
};

static void kbd_buffer_push(char c) {
    uint16_t next = (kbd_head + 1) % KBD_BUFFER_SIZE;
    if (next == kbd_tail) return; // buffer full, drop
    kbd_buffer[kbd_head] = c;
    kbd_head = next;
}

char keyboard_getchar(void) {
    if (kbd_head == kbd_tail) return 0;
    char c = kbd_buffer[kbd_tail];
    kbd_tail = (kbd_tail + 1) % KBD_BUFFER_SIZE;
    return c;
}

static void keyboard_callback(struct registers *regs) {
    (void)regs;
    uint8_t scancode = inb(0x60);

    if (scancode == 0x2A || scancode == 0x36) {        // Shift pressed
        shift_pressed = 1;
        return;
    }
    if (scancode == 0xAA || scancode == 0xB6) {        // Shift released
        shift_pressed = 0;
        return;
    }

    if (scancode & 0x80) return; // key release, ignore for now

    if (scancode < 128) {
        char c = shift_pressed ? scancode_ascii_shift[scancode] : scancode_ascii[scancode];
        if (c) {
            kbd_buffer_push(c);
            serial_write_char(c); // immediate echo to serial for visibility
        }
    }
}

void keyboard_init(void) {
    register_interrupt_handler(33, keyboard_callback); // IRQ1 -> vector 33
}
