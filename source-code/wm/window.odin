package wm

import "vendor:glfw"
import "vendor:opengl"

TextureBlitter :: struct {
    // Fields for shaders, VAO, etc.
    program: u32,
    // ...
}

create_blitter :: proc(b: ^TextureBlitter) {
    // Implement creation of shader program for blitting
    // Vertex shader, fragment shader for texture with transform and origin flip
}

bind_blitter :: proc(b: ^TextureBlitter, target: u32) {
    opengl.UseProgram(b.program)
    // Set uniforms if needed
}

blit_blitter :: proc(b: ^TextureBlitter, texture: u32, transform: matrix[4,4]f32, origin: Origin) {
    opengl.ActiveTexture(opengl.TEXTURE0)
    opengl.BindTexture(opengl.TEXTURE_2D, texture)
    // Set transform uniform
    // Flip Y if origin BottomLeft
    if origin == .BottomLeft {
        // Modify transform or texcoord
    }
    // Draw quad
    opengl.DrawArrays(opengl.TRIANGLE_STRIP, 0, 4)
}

release_blitter :: proc(b: ^TextureBlitter) {
    opengl.UseProgram(0)
}

target_transform :: proc(surface_geom: Rect, window_rect: Rect) -> matrix[4,4]f32 {
    // Implement QOpenGLTextureBlitter::targetTransform, orthographic projection with pos
    return linalg.matrix4_translate(f32(surface_geom.pos[0]), f32(surface_geom.pos[1]), 0) * linalg.matrix4_scale(f32(surface_geom.size[0]), f32(surface_geom.size[1]), 1) // Simplifed
}

Window :: struct {
    gl_window: glfw.WindowHandle,
    compositor: ^Compositor,
    texture_blitter: TextureBlitter,
    size: Size,
}

init_window :: proc(w: ^Window) {
    if !glfw.Init() {
        fmt.eprintln("Failed to initialize GLFW")
        os.exit(1)
    }
    glfw.WindowHint(glfw.CONTEXT_VERSION_MAJOR, 3)
    glfw.WindowHint(glfw.CONTEXT_VERSION_MINOR, 3)
    glfw.WindowHint(glfw.OPENGL_PROFILE, glfw.OPENGL_CORE_PROFILE)
    w.gl_window = glfw.CreateWindow(800, 600, "BlueWM", nil, nil)
    if w.gl_window == nil {
        fmt.eprintln("Failed to create GLFW window")
        glfw.Terminate()
        os.exit(1)
    }
    glfw.MakeContextCurrent(w.gl_window)
    opengl.load_up_to(3, 3, glfw.gl_set_proc_address)
    create_blitter(&w.texture_blitter)
    w.size = {800, 600}
}

set_compositor :: proc(w: ^Window, comp: ^Compositor) {
    w.compositor = comp
}

paint_gl :: proc(w: ^Window) {
    c := w.compositor
    start_render(c)
    opengl.ClearColor(0.1, 0.1, 0.1, 1.0)
    opengl.Clear(opengl.COLOR_BUFFER_BIT | opengl.DEPTH_BUFFER_BIT)
    opengl.Enable(opengl.BLEND)
    opengl.BlendFunc(opengl.SRC_ALPHA, opengl.ONE_MINUS_SRC_ALPHA)
    current_target: u32 = opengl.TEXTURE_2D
    bind_blitter(&w.texture_blitter, current_target)
    for view in c.views {
        texture := get_texture(view)
        if texture == 0 { continue }
        if texture_target(view) != current_target { // Assume function
            current_target = texture_target(view)
            bind_blitter(&w.texture_blitter, current_target)
        }
        texture_id := texture
        surface := view.surface
        if surface != nil && has_content(surface) { // Assume
            s := destination_size(surface)
            pos := view.pos
            surface_geometry := Rect{pos, s}
            origin := buffer_origin(view.current_buffer) == wl.OriginTopLeft ? .TopLeft : .BottomLeft
            transform := target_transform(surface_geometry, Rect{{0,0}, w.size})
            blit_blitter(&w.texture_blitter, texture_id, transform, origin)
        }
    }
    release_blitter(&w.texture_blitter)
    end_render(c)
}

request_update :: proc(w: ^Window) {
    glfw.PostEmptyEvent() // To trigger poll
}

// Assume
texture_target :: proc(v: ^View) -> u32 { return opengl.TEXTURE_2D }
has_content :: proc(s: ^wl.Surface) -> bool { /* implement */ return false }
buffer_origin :: proc(b: wl.Buffer) -> wl.Origin { /* implement */ return .TopLeft }

