// compositor.c - Draws the desktop: background, a demo window, the taskbar
// with a Start button, and a live PS/2-driven mouse cursor. Runs as its own
// preemptible kernel task (see task.c) so it no longer monopolizes the CPU.

#include "compositor.h"
#include "gfx.h"
#include "mouse.h"

#define WIN7_BLUE     0x00A2ED
#define TASKBAR_COLOR 0x1F1F1F
#define START_COLOR   0x2D7D46
#define TITLEBAR_BLUE 0x0057B8
#define WINDOW_BODY   0xF0F0F0
#define CLOSE_RED     0xE81123
#define WHITE         0xFFFFFF

#define TASKBAR_HEIGHT 40

static void draw_demo_window(void) {
    int wx = 200, wy = 150, ww = 420, wh = 300;

    gfx_fill_rect(wx, wy, ww, wh, WINDOW_BODY);       // window body
    gfx_fill_rect(wx, wy, ww, 24, TITLEBAR_BLUE);     // title bar
    gfx_draw_string(wx + 8, wy + 8, "NOS - DEMO WINDOW", WHITE);

    // close button
    gfx_fill_rect(wx + ww - 24, wy, 24, 24, CLOSE_RED);
    gfx_draw_string(wx + ww - 18, wy + 8, "X", WHITE);

    gfx_draw_string(wx + 12, wy + 40, "PHASE 6: PREEMPTIVE SCHEDULER ONLINE", 0x333333);
    gfx_draw_string(wx + 12, wy + 56, "MOVE THE MOUSE - CHECK SERIAL FOR TASK LOG", 0x333333);
}

static void draw_taskbar(void) {
    uint32_t w = gfx_width();
    uint32_t h = gfx_height();
    int bar_y = (int)h - TASKBAR_HEIGHT;

    gfx_fill_rect(0, bar_y, (int)w, TASKBAR_HEIGHT, TASKBAR_COLOR);

    gfx_fill_rect(4, bar_y + 4, 90, TASKBAR_HEIGHT - 8, START_COLOR);
    gfx_draw_string(16, bar_y + 14, "START", WHITE);
}

static void draw_cursor(void) {
    int mx = mouse_get_x();
    int my = mouse_get_y();

    gfx_fill_rect(mx, my, 2, 14, WHITE);
    gfx_fill_rect(mx, my, 14, 2, WHITE);
    gfx_fill_rect(mx + 1, my + 1, 1, 11, 0x000000);
    gfx_fill_rect(mx + 1, my + 1, 11, 1, 0x000000);
}

void compositor_render(void) {
    gfx_clear(WIN7_BLUE);
    draw_demo_window();
    draw_taskbar();
    draw_cursor();
}

void compositor_task(void) {
    while (1) {
        compositor_render();
        gfx_swap();
    }
}
