// desktop.c - nOS's window manager and built-in apps.
//
// Everything here runs inside a single event loop (called once per frame
// from compositor_task). There's no per-app process isolation yet -- that
// would need the apps to be separate ring-3 programs with their own
// memory, which isn't built yet (see Phase 6b's scope notes). What's here
// is nonetheless fully interactive and stateful: real keyboard/mouse input
// drives real application logic, not a static mockup.
//
// Note on history: an earlier multi-window, draggable-window rewrite of
// this file caused a startup hang that CI's headless boot-only smoke test
// didn't catch. That rewrite was reverted. This version adds the nScript
// console back in isolation, on top of the confirmed-working single fixed
// window design, specifically to avoid repeating that mistake -- one
// contained change at a time instead of a large rewrite.
//
// Known limitations, stated plainly:
//  - One fixed-position window at a time (no dragging/multi-window).
//  - The bitmap font (font.c) only has uppercase glyphs, so typed text
//    (e.g. in Notepad, or nScript console scrollback) displays in caps.
//  - Snake uses WASD, not arrow keys: arrow keys are extended (0xE0-
//    prefixed) PS/2 scancodes that keyboard.c doesn't parse yet.
//  - The login "password" is a hardcoded literal compared in plaintext;
//    this is a hobby OS demo, not a security boundary.

#include <stdint.h>
#include "desktop.h"
#include "gfx.h"
#include "keyboard.h"
#include "mouse.h"
#include "pit.h"
#include "nscript.h"

#define TASKBAR_HEIGHT 40
#define WIN_X 200
#define WIN_Y 120
#define WIN_W 440
#define WIN_H 320

typedef enum { STATE_LOGIN, STATE_DESKTOP } app_state_t;
typedef enum { APP_NONE, APP_NOTEPAD, APP_SNAKE, APP_SETTINGS, APP_CONSOLE } active_app_t;

static app_state_t app_state = STATE_LOGIN;
static active_app_t active_app = APP_NONE;
static int start_menu_open = 0;
static uint8_t prev_mouse_buttons = 0;
static uint32_t desktop_bg_color = 0x00A2ED;

/* ---------- small helpers ---------- */

static int point_in_rect(int px, int py, int rx, int ry, int rw, int rh) {
    return px >= rx && px < rx + rw && py >= ry && py < ry + rh;
}

static int str_eq(const char *a, const char *b) {
    while (*a && *b) { if (*a != *b) return 0; a++; b++; }
    return *a == *b;
}

static void uint_to_str(uint32_t val, char *out) {
    char tmp[12];
    int i = 0;
    if (val == 0) { out[0] = '0'; out[1] = '\0'; return; }
    while (val > 0 && i < 11) { tmp[i++] = (char)('0' + (val % 10)); val /= 10; }
    int j = 0;
    while (i > 0) out[j++] = tmp[--i];
    out[j] = '\0';
}

static void draw_cursor(int mx, int my) {
    gfx_fill_rect(mx, my, 2, 14, 0xFFFFFF);
    gfx_fill_rect(mx, my, 14, 2, 0xFFFFFF);
    gfx_fill_rect(mx + 1, my + 1, 1, 11, 0x000000);
    gfx_fill_rect(mx + 1, my + 1, 11, 1, 0x000000);
}

// Shared renderer for newline-delimited text blocks (Notepad, Console
// scrollback). Returns the y-coordinate right after the last drawn line.
static int render_text_lines(int x, int y, int max_y, const char *buf, int len, uint32_t color) {
    int line_y = y;
    int line_start = 0;
    char line_tmp[96];

    for (int i = 0; i <= len; i++) {
        if (i == len || buf[i] == '\n') {
            int l = i - line_start;
            if (l > 94) l = 94;
            for (int k = 0; k < l; k++) line_tmp[k] = buf[line_start + k];
            line_tmp[l] = '\0';
            gfx_draw_string(x, line_y, line_tmp, color);
            line_y += 10;
            line_start = i + 1;
            if (line_y > max_y) break;
        }
    }
    return line_y;
}

/* ---------- login screen ---------- */

static char password_buf[32];
static int password_len = 0;
static int login_error = 0;

static void login_handle_key(char c) {
    if (c == '\n') {
        if (password_len == 3 && password_buf[0] == 'n' && password_buf[1] == 'o' && password_buf[2] == 's') {
            app_state = STATE_DESKTOP;
            password_len = 0;
            login_error = 0;
        } else {
            password_len = 0;
            login_error = 1;
        }
    } else if (c == '\b') {
        if (password_len > 0) password_len--;
    } else if (c >= 32 && c < 127 && password_len < 31) {
        password_buf[password_len++] = c;
    }
}

static void login_render(void) {
    gfx_clear(0x00A2ED);

    int cw = 320, ch = 180;
    int cx = (int)(gfx_width() - (uint32_t)cw) / 2;
    int cy = (int)(gfx_height() - (uint32_t)ch) / 2;

    gfx_fill_rect(cx, cy, cw, ch, 0xF0F0F0);
    gfx_fill_rect(cx, cy, cw, 24, 0x0057B8);
    gfx_draw_string(cx + 8, cy + 8, "NOS LOGIN", 0xFFFFFF);

    gfx_draw_string(cx + 16, cy + 40, "PASSWORD:", 0x333333);
    gfx_fill_rect(cx + 16, cy + 56, cw - 32, 18, 0xFFFFFF);

    char stars[32];
    int i;
    for (i = 0; i < password_len && i < 31; i++) stars[i] = '*';
    stars[i] = '\0';
    gfx_draw_string(cx + 20, cy + 60, stars, 0x000000);

    if (login_error) {
        gfx_draw_string(cx + 16, cy + 82, "INCORRECT - TRY AGAIN", 0xE81123);
    }

    gfx_draw_string(cx + 16, cy + 112, "HINT: THE OS NAME, LOWERCASE", 0x666666);
    gfx_draw_string(cx + 16, cy + 130, "PRESS ENTER TO LOG IN", 0x666666);
}

/* ---------- notepad ---------- */

#define NOTEPAD_BUF_SIZE 1024
static char notepad_buf[NOTEPAD_BUF_SIZE];
static int notepad_len = 0;

static void notepad_handle_key(char c) {
    if (c == '\b') {
        if (notepad_len > 0) notepad_len--;
    } else if (c == '\n') {
        if (notepad_len < NOTEPAD_BUF_SIZE - 1) notepad_buf[notepad_len++] = '\n';
    } else if (c >= 32 && c < 127) {
        if (notepad_len < NOTEPAD_BUF_SIZE - 1) notepad_buf[notepad_len++] = c;
    }
}

static void notepad_render(int wx, int wy) {
    gfx_draw_string(wx + 12, wy + 32, "TYPE TO EDIT - CAPS ONLY FONT", 0x888888);
    int end_y = render_text_lines(wx + 12, wy + 50, wy + WIN_H - 20, notepad_buf, notepad_len, 0x000000);
    gfx_fill_rect(wx + 12, end_y, 6, 9, 0x000000);
}

/* ---------- snake ---------- */

#define GRID_W 18
#define GRID_H 10
#define CELL 16
#define SNAKE_MAX 180

typedef struct { int x, y; } point_t;

static point_t snake_body[SNAKE_MAX];
static int snake_len;
static int snake_dir_x, snake_dir_y;
static point_t snake_food;
static int snake_score;
static int snake_game_over;
static uint32_t snake_last_tick;
static uint32_t snake_rng = 2463534242u;

static uint32_t snake_rand(void) {
    snake_rng ^= snake_rng << 13;
    snake_rng ^= snake_rng >> 17;
    snake_rng ^= snake_rng << 5;
    return snake_rng;
}

static void snake_place_food(void) {
    snake_food.x = (int)(snake_rand() % GRID_W);
    snake_food.y = (int)(snake_rand() % GRID_H);
}

static void snake_reset(void) {
    snake_len = 3;
    snake_body[0].x = 5; snake_body[0].y = 5;
    snake_body[1].x = 4; snake_body[1].y = 5;
    snake_body[2].x = 3; snake_body[2].y = 5;
    snake_dir_x = 1; snake_dir_y = 0;
    snake_score = 0;
    snake_game_over = 0;
    snake_place_food();
    snake_last_tick = pit_get_ticks();
}

static void snake_handle_key(char c) {
    if (snake_game_over) {
        if (c == 'r' || c == 'R') snake_reset();
        return;
    }
    switch (c) {
        case 'w': case 'W': if (snake_dir_y != 1)  { snake_dir_x = 0; snake_dir_y = -1; } break;
        case 's': case 'S': if (snake_dir_y != -1) { snake_dir_x = 0; snake_dir_y = 1; }  break;
        case 'a': case 'A': if (snake_dir_x != 1)  { snake_dir_x = -1; snake_dir_y = 0; } break;
        case 'd': case 'D': if (snake_dir_x != -1) { snake_dir_x = 1; snake_dir_y = 0; }  break;
        default: break;
    }
}

static void snake_update(void) {
    if (snake_game_over) return;

    uint32_t now = pit_get_ticks();
    if (now - snake_last_tick < 15) return;
    snake_last_tick = now;

    point_t new_head;
    new_head.x = snake_body[0].x + snake_dir_x;
    new_head.y = snake_body[0].y + snake_dir_y;

    if (new_head.x < 0 || new_head.x >= GRID_W || new_head.y < 0 || new_head.y >= GRID_H) {
        snake_game_over = 1;
        return;
    }
    for (int i = 0; i < snake_len; i++) {
        if (snake_body[i].x == new_head.x && snake_body[i].y == new_head.y) {
            snake_game_over = 1;
            return;
        }
    }

    int ate = (new_head.x == snake_food.x && new_head.y == snake_food.y);
    if (ate) {
        if (snake_len < SNAKE_MAX) snake_len++;
        snake_score += 10;
        snake_place_food();
    }

    for (int i = snake_len - 1; i > 0; i--) snake_body[i] = snake_body[i - 1];
    snake_body[0] = new_head;
}

static void snake_render(int wx, int wy) {
    gfx_draw_string(wx, wy - 14, "USE WASD TO MOVE", 0x888888);

    gfx_fill_rect(wx, wy, GRID_W * CELL, GRID_H * CELL, 0x000000);
    gfx_fill_rect(wx + snake_food.x * CELL, wy + snake_food.y * CELL, CELL - 1, CELL - 1, 0xE81123);

    for (int i = 0; i < snake_len; i++) {
        gfx_fill_rect(wx + snake_body[i].x * CELL, wy + snake_body[i].y * CELL, CELL - 1, CELL - 1, 0x2D7D46);
    }

    char score_str[16];
    uint_to_str((uint32_t)snake_score, score_str);
    char line[32] = "SCORE: ";
    int li = 7;
    for (int i = 0; score_str[i] && li < 31; i++) line[li++] = score_str[i];
    line[li] = '\0';
    gfx_draw_string(wx, wy + GRID_H * CELL + 8, line, 0xFFFFFF);

    if (snake_game_over) {
        gfx_draw_string(wx, wy + GRID_H * CELL + 22, "GAME OVER - PRESS R", 0xE81123);
    }
}

/* ---------- settings ---------- */

typedef struct { uint32_t color; } swatch_t;
static const swatch_t swatches[5] = {
    { 0x00A2ED }, // windows 7 blue
    { 0x2D7D46 }, // green
    { 0x8E24AA }, // purple
    { 0xE81123 }, // red
    { 0x1F1F1F }, // dark
};

static void settings_render(int wx, int wy, int mx, int my, int clicked) {
    gfx_draw_string(wx + 12, wy + 32, "DESKTOP BACKGROUND COLOR:", 0x333333);

    int sx = wx + 12, sy = wy + 50, sw = 48, sh = 32, gap = 10;
    for (int i = 0; i < 5; i++) {
        int rx = sx + i * (sw + gap);
        gfx_fill_rect(rx, sy, sw, sh, swatches[i].color);
        if (desktop_bg_color == swatches[i].color) {
            gfx_fill_rect(rx - 3, sy - 3, sw + 6, 3, 0x000000);
            gfx_fill_rect(rx - 3, sy + sh, sw + 6, 3, 0x000000);
        }
        if (clicked && point_in_rect(mx, my, rx, sy, sw, sh)) {
            desktop_bg_color = swatches[i].color;
        }
    }

    gfx_draw_string(wx + 12, wy + 100, "NOS - A WINDOWS 7 STYLE HOBBY OS", 0x333333);
    gfx_draw_string(wx + 12, wy + 112, "LOGIN NOTEPAD SNAKE SETTINGS CONSOLE", 0x333333);
}

/* ---------- nScript console ---------- */

#define CONSOLE_SCROLLBACK_SIZE 2048
static char console_scrollback[CONSOLE_SCROLLBACK_SIZE];
static int console_scrollback_len = 0;
static char console_input[64];
static int console_input_len = 0;

static void console_append_output(const char *text) {
    int tlen = 0;
    while (text[tlen]) tlen++;

    if (console_scrollback_len + tlen + 1 >= CONSOLE_SCROLLBACK_SIZE) {
        console_scrollback_len = 0; // simple overflow policy: wipe and continue
    }
    for (int i = 0; i < tlen; i++) console_scrollback[console_scrollback_len++] = text[i];
    console_scrollback[console_scrollback_len++] = '\n';
}

static void console_print_cb(const char *text) {
    console_append_output(text);
}

static void console_setbg_cb(int idx) {
    if (idx >= 0 && idx < 5) desktop_bg_color = swatches[idx].color;
}

// Single-window model: "launching" an app just switches the one visible
// window's content, same as clicking a Start menu item.
static void console_launch_cb(const char *name) {
    if (str_eq(name, "notepad")) active_app = APP_NOTEPAD;
    else if (str_eq(name, "snake")) { active_app = APP_SNAKE; snake_reset(); }
    else if (str_eq(name, "settings")) active_app = APP_SETTINGS;
    else if (str_eq(name, "console")) active_app = APP_CONSOLE;
    else console_append_output("UNKNOWN APP");
}

static void console_handle_key(char c) {
    if (c == '\n') {
        console_input[console_input_len] = '\0';

        char echo[70] = "> ";
        int k = 2;
        for (int i = 0; i < console_input_len && k < 69; i++) echo[k++] = console_input[i];
        echo[k] = '\0';
        console_append_output(echo);

        nscript_run_line(console_input);
        console_input_len = 0;
    } else if (c == '\b') {
        if (console_input_len > 0) console_input_len--;
    } else if (c >= 32 && c < 127 && console_input_len < 63) {
        console_input[console_input_len++] = c;
    }
}

static void console_render(int wx, int wy) {
    gfx_draw_string(wx + 12, wy + 32, "NSCRIPT - TRY: x=5;print(x*2)", 0x888888);

    gfx_fill_rect(wx + 10, wy + 44, WIN_W - 20, WIN_H - 80, 0x101010);
    render_text_lines(wx + 14, wy + 48, wy + WIN_H - 34, console_scrollback, console_scrollback_len, 0x33FF33);

    gfx_fill_rect(wx + 10, wy + WIN_H - 28, WIN_W - 20, 18, 0xFFFFFF);
    char input_display[70] = "> ";
    int k = 2;
    for (int i = 0; i < console_input_len && k < 69; i++) input_display[k++] = console_input[i];
    input_display[k] = '\0';
    gfx_draw_string(wx + 14, wy + WIN_H - 24, input_display, 0x000000);
}

/* ---------- top-level desktop/window manager ---------- */

void desktop_init(void) {
    app_state = STATE_LOGIN;
    active_app = APP_NONE;
    start_menu_open = 0;
    password_len = 0;
    login_error = 0;
    notepad_len = 0;
    console_scrollback_len = 0;
    console_input_len = 0;

    nscript_init(console_print_cb, console_setbg_cb, console_launch_cb);
}

void desktop_update_and_render(void) {
    char c;
    while ((c = keyboard_getchar()) != 0) {
        if (app_state == STATE_LOGIN) {
            login_handle_key(c);
        } else if (active_app == APP_NOTEPAD) {
            notepad_handle_key(c);
        } else if (active_app == APP_SNAKE) {
            snake_handle_key(c);
        } else if (active_app == APP_CONSOLE) {
            console_handle_key(c);
        }
    }

    int mx = mouse_get_x();
    int my = mouse_get_y();
    uint8_t buttons = mouse_get_buttons();
    int clicked = (buttons & 1) && !(prev_mouse_buttons & 1);
    prev_mouse_buttons = buttons;

    if (app_state == STATE_LOGIN) {
        login_render();
        draw_cursor(mx, my);
        return;
    }

    if (active_app == APP_SNAKE) {
        snake_update();
    }

    gfx_clear(desktop_bg_color);

    if (active_app != APP_NONE) {
        gfx_fill_rect(WIN_X, WIN_Y, WIN_W, WIN_H, 0xF0F0F0);
        gfx_fill_rect(WIN_X, WIN_Y, WIN_W, 24, 0x0057B8);

        const char *title = "WINDOW";
        if (active_app == APP_NOTEPAD) title = "NOTEPAD";
        else if (active_app == APP_SNAKE) title = "SNAKE";
        else if (active_app == APP_SETTINGS) title = "SETTINGS";
        else if (active_app == APP_CONSOLE) title = "NSCRIPT CONSOLE";
        gfx_draw_string(WIN_X + 8, WIN_Y + 8, title, 0xFFFFFF);

        gfx_fill_rect(WIN_X + WIN_W - 24, WIN_Y, 24, 24, 0xE81123);
        gfx_draw_string(WIN_X + WIN_W - 18, WIN_Y + 8, "X", 0xFFFFFF);
        if (clicked && point_in_rect(mx, my, WIN_X + WIN_W - 24, WIN_Y, 24, 24)) {
            active_app = APP_NONE;
        }

        if (active_app == APP_NOTEPAD) {
            notepad_render(WIN_X, WIN_Y);
        } else if (active_app == APP_SNAKE) {
            snake_render(WIN_X + 20, WIN_Y + 50);
        } else if (active_app == APP_SETTINGS) {
            settings_render(WIN_X, WIN_Y, mx, my, clicked);
        } else if (active_app == APP_CONSOLE) {
            console_render(WIN_X, WIN_Y);
        }
    }

    uint32_t w = gfx_width();
    uint32_t h = gfx_height();
    int bar_y = (int)h - TASKBAR_HEIGHT;

    gfx_fill_rect(0, bar_y, (int)w, TASKBAR_HEIGHT, 0x1F1F1F);
    gfx_fill_rect(4, bar_y + 4, 90, TASKBAR_HEIGHT - 8, 0x2D7D46);
    gfx_draw_string(16, bar_y + 14, "START", 0xFFFFFF);

    if (clicked && point_in_rect(mx, my, 4, bar_y + 4, 90, TASKBAR_HEIGHT - 8)) {
        start_menu_open = !start_menu_open;
    }

    if (start_menu_open) {
        int mx0 = 4, mw = 150, item_h = 26, mh = item_h * 4;
        int my0 = bar_y - mh - 4;

        gfx_fill_rect(mx0, my0, mw, mh, 0x2B2B2B);
        const char *items[4] = { "NOTEPAD", "SNAKE", "SETTINGS", "CONSOLE" };
        active_app_t apps[4] = { APP_NOTEPAD, APP_SNAKE, APP_SETTINGS, APP_CONSOLE };

        for (int i = 0; i < 4; i++) {
            int iy = my0 + i * item_h;
            int hover = point_in_rect(mx, my, mx0, iy, mw, item_h);
            gfx_fill_rect(mx0, iy, mw, item_h, hover ? 0x3D7D46 : 0x2B2B2B);
            gfx_draw_string(mx0 + 8, iy + 8, items[i], 0xFFFFFF);

            if (clicked && hover) {
                active_app = apps[i];
                start_menu_open = 0;
                if (active_app == APP_SNAKE) snake_reset();
            }
        }
    }

    draw_cursor(mx, my);
}
