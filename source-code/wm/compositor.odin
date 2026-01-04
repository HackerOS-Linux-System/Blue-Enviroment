package wm

import "core:math/rand"
import "core:math/linalg"
import "core:slice"
import "core:fmt"

import wl "wayland" // Vendor or import the wayland-odin bindings
import xdg "protocols/xdg_shell" // Generated from scanner
import wlshell "protocols/wl_shell" // Generated from scanner

// Assume Point, Size, Rect
Point :: [2]int
Size :: [2]int
Rect :: struct {
    pos: Point,
    size: Size,
}

contains :: proc(r: Rect, p: Point) -> bool {
    return p[0] >= r.pos[0] && p[0] < r.pos[0] + r.size[0] && p[1] >= r.pos[1] && p[1] < r.pos[1] + r.size[1]
}

Origin :: enum {
    TopLeft,
    BottomLeft,
}

View :: struct {
    surface: ^wl.Surface,
    texture: u32,
    pos: Point,
    toplevel: ^xdg.Toplevel,
    shell_surface: ^wlshell.ShellSurface,
    output: ^wl.Output,
    current_buffer: wl.Buffer, // Assume
}

get_texture :: proc "contextless" (v: ^View) -> u32 {
    if advance(v) {
        v.texture = to_opengl_texture(v.current_buffer) // Assume function to convert buffer to GL texture
    }
    return v.texture
}

global_geometry :: proc "contextless" (v: ^View) -> Rect {
    return Rect{v.pos, destination_size(v.surface)}
}

set_global_position :: proc "contextless" (v: ^View, pos: Point) {
    v.pos = pos
}

map_to_local :: proc "contextless" (v: ^View, global_pos: Point) -> Point {
    return global_pos - v.pos
}

size :: proc "contextless" (v: ^View) -> Size {
    if v.surface == nil { return {} }
    return destination_size(v.surface)
}

init_position :: proc "contextless" (v: ^View, screen_size, surface_size: Size) {
    xrange := max(screen_size[0] - surface_size[0], 1)
    yrange := max(screen_size[1] - surface_size[1], 1)
    v.pos = Point{int(rand.int31() % i32(xrange)), int(rand.int31() % i32(yrange))}
}

toplevel :: proc "contextless" (v: ^View) -> ^xdg.Toplevel {
    return v.toplevel
}

set_toplevel :: proc "contextless" (v: ^View, t: ^xdg.Toplevel) {
    v.toplevel = t
}

shell_surface :: proc "contextless" (v: ^View) -> ^wlshell.ShellSurface {
    return v.shell_surface
}

set_shell_surface :: proc "contextless" (v: ^View, s: ^wlshell.ShellSurface) {
    v.shell_surface = s
}

Compositor :: struct {
    window: ^Window,
    display: ^wl.Display,
    xdg_shell: ^xdg.Shell,
    wl_shell: ^wlshell.Shell,
    views: [dynamic]^View,
    mouse_view: ^View,
    grabbed_view: ^View,
    grab_pos: Point,
    tiling: bool,
    alt_pressed: bool,
}

init_compositor :: proc(c: ^Compositor, window: ^Window) {
    c.window = window
}

create :: proc(c: ^Compositor) {
    c.display = wl.display_create()
    output := wl.output_create(c.display, c.window) // Assume
    mode := wl.OutputMode{c.window.size, 60000}
    wl.output_add_mode(output, mode, true)
    wl.compositor_create(c.display) // Assume global creation
    wl.output_set_current_mode(output, mode)
    c.xdg_shell = xdg.shell_create(c.display)
    xdg.set_toplevel_created_callback(c.xdg_shell, on_toplevel_created, c) // Assume callback setup
    c.wl_shell = wlshell.shell_create(c.display)
    wlshell.set_shell_surface_created_callback(c.wl_shell, on_shell_surface_created, c)
    wl.display_add_socket(c.display, "blue-0")
}

view_at :: proc(c: ^Compositor, position: Point) -> ^View {
    for i := len(c.views) - 1; i >= 0; i -= 1 {
        view := c.views[i]
        if contains(global_geometry(view), position) {
            return view
        }
    }
    return nil
}

raise :: proc(c: ^Compositor, view: ^View) {
    for i in 0..<len(c.views) {
        if c.views[i] == view {
            ordered_remove(&c.views, i)
            break
        }
    }
    append(&c.views, view)
    seat := wl.display_default_seat(c.display)
    wl.seat_set_keyboard_focus(seat, view.surface)
    trigger_render(c)
}

handle_mouse_press :: proc(c: ^Compositor, position: Point, button: glfw.MouseButton) {
    if c.mouse_view == nil {
        c.mouse_view = view_at(c, position)
        if c.mouse_view != nil {
            raise(c, c.mouse_view)
        }
    }
    seat := wl.display_default_seat(c.display)
    local_pos := c.mouse_view != nil ? map_to_local(c.mouse_view, position) : position
    wl.seat_send_mouse_move(seat, c.mouse_view, local_pos)
    wl.seat_send_mouse_press(seat, button)
    if button == .Left && c.alt_pressed && c.mouse_view != nil {
        c.grabbed_view = c.mouse_view
        c.grab_pos = position - c.mouse_view.pos
        wl.seat_send_mouse_release(seat, button)
        return
    }
}

handle_mouse_release :: proc(c: ^Compositor, position: Point, button: glfw.MouseButton, buttons: i32) {
    seat := wl.display_default_seat(c.display)
    local_pos := c.mouse_view != nil ? map_to_local(c.mouse_view, position) : position
    wl.seat_send_mouse_move(seat, c.mouse_view, local_pos)
    wl.seat_send_mouse_release(seat, button)
    if c.grabbed_view != nil {
        c.grabbed_view = nil
    }
    if buttons == 0 {
        new_view := view_at(c, position)
        if new_view != c.mouse_view {
            local_pos = new_view != nil ? map_to_local(new_view, position) : position
            wl.seat_send_mouse_move(seat, new_view, local_pos)
        }
        c.mouse_view = nil
    }
}

handle_mouse_move :: proc(c: ^Compositor, position: Point) {
    if c.grabbed_view != nil {
        set_global_position(c.grabbed_view, position - c.grab_pos)
        trigger_render(c)
        return
    }
    view := c.mouse_view != nil ? c.mouse_view : view_at(c, position)
    local_pos := view != nil ? map_to_local(view, position) : position
    wl.seat_send_mouse_move(wl.display_default_seat(c.display), view, local_pos)
}

handle_mouse_wheel :: proc(c: ^Compositor, angle_delta: Point) {
    seat := wl.display_default_seat(c.display)
    if angle_delta[0] != 0 {
        wl.seat_send_mouse_wheel(seat, .Horizontal, angle_delta[0])
    }
    if angle_delta[1] != 0 {
        wl.seat_send_mouse_wheel(seat, .Vertical, angle_delta[1])
    }
}

handle_key_press :: proc(c: ^Compositor, native_scan_code: u32) {
    if native_scan_code == 64 || native_scan_code == 108 {
        c.alt_pressed = true
    }
    wl.seat_send_key_press(wl.display_default_seat(c.display), native_scan_code)
}

handle_key_release :: proc(c: ^Compositor, native_scan_code: u32) {
    if native_scan_code == 64 || native_scan_code == 108 {
        c.alt_pressed = false
    }
    wl.seat_send_key_release(wl.display_default_seat(c.display), native_scan_code)
}

on_toplevel_created :: proc(toplevel: ^xdg.Toplevel, xdg_surface: ^xdg.Surface, userdata: rawptr) {
    c := cast(^Compositor) userdata
    surface := xdg_surface.surface
    view := new(View)
    view.surface = surface
    set_toplevel(view, toplevel)
    view.output = output_for(c, c.window)
    if toplevel.app_id == "terminal" {
        set_global_position(view, {100, 100})
    } else {
        init_position(view, c.window.size, destination_size(surface))
    }
    append(&c.views, view)
    // Connect callbacks
    set_surface_destroyed_callback(view, view_surface_destroyed, c)
    set_redraw_callback(surface, trigger_render, c)
    raise(c, view)
    if c.tiling { arrange(c) }
}

on_shell_surface_created :: proc(shell_surface: ^wlshell.ShellSurface, userdata: rawptr) {
    c := cast(^Compositor) userdata
    view := new(View)
    view.surface = shell_surface.surface
    set_shell_surface(view, shell_surface)
    view.output = output_for(c, c.window)
    init_position(view, c.window.size, destination_size(shell_surface.surface))
    append(&c.views, view)
    set_surface_destroyed_callback(view, view_surface_destroyed, c)
    set_redraw_callback(shell_surface.surface, trigger_render, c)
    raise(c, view)
    if c.tiling { arrange(c) }
}

view_surface_destroyed :: proc(view: ^View, userdata: rawptr) {
    c := cast(^Compositor) userdata
    for i in 0..<len(c.views) {
        if c.views[i] == view {
            ordered_remove(&c.views, i)
            break
        }
    }
    free(view)
    trigger_render(c)
}

trigger_render :: proc(c: ^Compositor) {
    c.window.request_update()
}

start_render :: proc(c: ^Compositor) {
    out := default_output(c)
    if out != nil {
        wl.output_frame_started(out)
    }
}

end_render :: proc(c: ^Compositor) {
    out := default_output(c)
    if out != nil {
        wl.output_send_frame_callbacks(out)
    }
}

toggle_tiling :: proc(c: ^Compositor) {
    c.tiling = !c.tiling
    if c.tiling {
        arrange(c)
    } else {
        for view in c.views {
            init_position(view, c.window.size, size(view))
        }
    }
    trigger_render(c)
}

arrange :: proc(c: ^Compositor) {
    screen_size := c.window.size
    n := len(c.views)
    if n == 0 { return }
    w := screen_size[0] / n
    x := 0
    for view in c.views {
        set_global_position(view, {x, 0})
        new_size := Size{w, screen_size[1]}
        if view.toplevel != nil {
            xdg.toplevel_send_configure(view.toplevel, new_size, {})
        }
        x += w
    }
}

// Assume these functions
advance :: proc(v: ^View) -> bool { /* implement */ return false }
to_opengl_texture :: proc(b: wl.Buffer) -> u32 { /* implement */ return 0 }
destination_size :: proc(s: ^wl.Surface) -> Size { /* implement */ return {} }
output_for :: proc(c: ^Compositor, w: ^Window) -> ^wl.Output { /* implement */ return nil }
default_output :: proc(c: ^Compositor) -> ^wl.Output { /* implement */ return nil }
set_surface_destroyed_callback :: proc(v: ^View, cb: proc(^View, rawptr), userdata: rawptr) { /* implement */ }
set_redraw_callback :: proc(s: ^wl.Surface, cb: proc(^wl.Surface, rawptr), userdata: rawptr) { /* implement */ }

