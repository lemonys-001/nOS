#ifndef FONT_H
#define FONT_H

#include <stdint.h>

#define FONT_WIDTH  5
#define FONT_HEIGHT 7

// Returns a pointer to 7 bytes (one per row, low 5 bits = pixels left-to-right),
// or NULL if the character isn't in the supported set (space/blank is drawn).
const uint8_t *font_get_glyph(char c);

#endif
