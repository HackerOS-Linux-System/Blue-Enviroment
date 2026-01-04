package wm

import "core:os"
import "core:fmt"
import "vendor:glfw"

main :: proc() {
    w: Window
    init_window(&w)
    c: Compositor
    init_compositor(&c, &w)
    create(&c)
    glfw.SetUserPointer(w.gl_window, &w)
    glfw.SetMouseButtonCallback(w.gl_window, mouse_button_callback)
    glfw.SetCursorPosCallback(w.gl_window, cursor_pos_callback)
    glfw.SetScrollCallback(w.gl_window, scroll_callback)
    glfw.SetKeyCallback(w.gl_window, key_callback)

    // Launch XWayland
    runtime_dir := os.get_env("XDG_RUNTIME_DIR")
    if runtime_dir == "" { runtime_dir = "/tmp" }
    socket_path := runtime_dir + "/blue-0"
    env := os.get_env_map()
    env["WAYLAND_DISPLAY"] = "blue-0"
    // Assume os.exec_command with env, or use proc
    os.exec("XWayland :1 -rootless -terminate", env) // Simplifed, use proper process launch

    for !glfw.WindowShouldClose(w.gl_window) {
        glfw.PollEvents()
        paint_gl(&w)
    }

    glfw.Terminate()
}

mouse_button_callback :: proc "c" (win: glfw.WindowHandle, button: glfw.MouseButton, action: glfw.Action, mods: glfw.Modifiers) {
    context = runtime.default_context()
    w := cast(^Window) glfw.GetUserPointer(win)
    pos_f := glfw.GetCursorPos(win)
    pos := Point{int(pos_f[0]), int(pos_f[1])}
    if action == .Press {
        handle_mouse_press(w.compositor, pos, button)
    } else if action == .Release {
        // Track buttons if needed
        buttons : i32 = 0 // Simplifed
        handle_mouse_release(w.compositor, pos, button, buttons)
    }
}

cursor_pos_callback :: proc "c" (win: glfw.WindowHandle, x, y: f64) {
    context = runtime.default_context()
    w := cast(^Window) glfw.GetUserPointer(win)
    handle_mouse_move(w.compositor, Point{int(x), int(y)})
}

scroll_callback :: proc "c" (win: glfw.WindowHandle, x, y: f64) {
    context = runtime.default_context()
    w := cast(^Window) glfw.GetUserPointer(win)
    handle_mouse_wheel(w.compositor, Point{int(x), int(y)})
}

key_callback :: proc "c" (win: glfw.WindowHandle, key: glfw.Key, scancode: i32, action: glfw.Action, mods: glfw.Modifiers) {
    context = runtime.default_context()
    w := cast(^Window) glfw.GetUserPointer(win)
    if action == .Press {
        if key == .Q && (mods & .Control != 0) {
            glfw.SetWindowShouldClose(win, true)
            return
        } else if key == .T && (mods & .Control != 0) {
            toggle_tiling(w.compositor)
            return
        }
        handle_key_press(w.compositor, u32(scancode))
    } else if action == .Release {
        handle_key_release(w.compositor, u32(scancode))
    }
}

