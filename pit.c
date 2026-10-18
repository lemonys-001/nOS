// pit.c - Programmable Interval Timer driver (IRQ0). Drives the scheduler
// and exposes a monotonic tick counter as a real time base for app pacing.

#include "io.h"
#include "isr.h"
#include "pit.h"
#include "task.h"

#define PIT_CHANNEL0  0x40
#define PIT_COMMAND   0x43
#define PIT_BASE_FREQ 1193180

static volatile uint32_t pit_ticks = 0;

static void pit_callback(struct registers *regs) {
    (void)regs;
    pit_ticks++;
    scheduler_tick();
}

void pit_init(uint32_t freq) {
    uint32_t divisor = PIT_BASE_FREQ / freq;

    outb(PIT_COMMAND, 0x36); // channel 0, lobyte/hibyte, mode 3 (square wave), binary
    outb(PIT_CHANNEL0, (uint8_t)(divisor & 0xFF));
    outb(PIT_CHANNEL0, (uint8_t)((divisor >> 8) & 0xFF));
}

void pit_install(void) {
    register_interrupt_handler(32, pit_callback); // IRQ0 -> vector 32
}

uint32_t pit_get_ticks(void) {
    return pit_ticks;
}
