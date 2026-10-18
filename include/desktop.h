#ifndef DESKTOP_H
#define DESKTOP_H

// The desktop/window manager: owns the login screen, taskbar, Start menu,
// a real multi-window system (draggable, z-ordered), and the five built-in
// apps (Notepad, Snake, Settings, File Manager, nScript Console). Drains
// keyboard input and polls the mouse every frame, dispatching to whichever
// window/app is active, then draws everything.

void desktop_init(void);
void desktop_update_and_render(void);

#endif
