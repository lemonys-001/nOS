// gfx.c - Double-buffered drawing primitives on top of the framebuffer.
// A backbuffer (allocated from the kernel heap) is drawn into, then
// gfx_swap() blits it to the real framebuffer to avoid flicker.

#include <stddef.h>
#include "gfx.h"
#include "font.h"
#include "heap.h"

static uint32_t *framebuffer_ptr = NULL;
static uint32_t *backbuffer = NULL;
static uint32_t fb_w = 0;
static uint32_t fb_h = 0;

void gfx_init(uint32_t *framebuffer, uint32_t width, uint32_t height) {
    framebuffer_ptr = framebuffer;
    fb_w = width;
    fb_h = height;
    backbuffer = (uint32_t *)kmalloc(width * height * sizeof(uint32_t));
}

uint32_t gfx_width(void)  { return fb_w; }
uint32_t gfx_height(void) { return fb_h; }

void gfx_clear(uint32_t color) {
    if (!backbuffer) return;
    uint32_t count = fb_w * fb_h;
    for (uint32_t i = 0; i < count; i++) backbuffer[i] = color;
}

void gfx_put_pixel(int x, int y, uint32_t color) {
    if (!backbuffer) return;
    if (x < 0 || y < 0 || (uint32_t)x >= fb_w || (uint32_t)y >= fb_h) return;
    backbuffer[(uint32_t)y * fb_w + (uint32_t)x] = color;
}

void gfx_fill_rect(int x, int y, int w, int h, uint32_t color) {
    for (int row = 0; row < h; row++) {
        for (int col = 0; col < w; col++) {
            gfx_put_pixel(x + col, y + row, color);
        }
    }
}

void gfx_draw_char(int x, int y, char c, uint32_t color) {
    const uint8_t *glyph = font_get_glyph(c);
    if (!glyph) return; // unsupported char -> leave blank (acts like space)

    for (int row = 0; row < FONT_HEIGHT; row++) {
        uint8_t bits = glyph[row];
        for (int col = 0; col < FONT_WIDTH; col++) {
            if (bits & (1 << (FONT_WIDTH - 1 - col))) {
                gfx_put_pixel(x + col, y + row, color);
            }
        }
    }
}

void gfx_draw_string(int x, int y, const char *str, uint32_t color) {
    int cursor_x = x;
    while (*str) {
        gfx_draw_char(cursor_x, y, *str, color);
        cursor_x += FONT_WIDTH + 1; // 1px letter spacing
        str++;
    }
}

void gfx_swap(void) {
    if (!framebuffer_ptr || !backbuffer) return;
    uint32_t count = fb_w * fb_h;
    for (uint32_t i = 0; i < count; i++) framebuffer_ptr[i] = backbuffer[i];
}
