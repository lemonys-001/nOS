#ifndef GFX_H
#define GFX_H

#include <stdint.h>

void gfx_init(uint32_t *framebuffer, uint32_t width, uint32_t height);
void gfx_clear(uint32_t color);
void gfx_put_pixel(int x, int y, uint32_t color);
void gfx_fill_rect(int x, int y, int w, int h, uint32_t color);
void gfx_draw_char(int x, int y, char c, uint32_t color);
void gfx_draw_string(int x, int y, const char *str, uint32_t color);
void gfx_swap(void);
uint32_t gfx_width(void);
uint32_t gfx_height(void);

#endif
