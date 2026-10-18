// compositor.c - Thin task-loop wrapper around desktop.c's window manager.
// Runs as its own preemptible kernel task (see task.c).

#include "compositor.h"
#include "desktop.h"
#include "gfx.h"

void compositor_task(void) {
    desktop_init();
    while (1) {
        desktop_update_and_render();
        gfx_swap();
    }
}
