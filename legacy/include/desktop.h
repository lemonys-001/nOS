#ifndef DESKTOP_H
#define DESKTOP_H

// The desktop/window manager: owns the login screen, taskbar, Start menu,
// and the three built-in apps (Notepad, Snake, Settings). Drains keyboard
// input and polls the mouse every frame, dispatching to whichever
// screen/app is currently active, then draws everything.

void desktop_init(void);
void desktop_update_and_render(void);

#endif
