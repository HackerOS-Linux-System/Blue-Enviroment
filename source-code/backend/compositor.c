#define _POSIX_C_SOURCE 200809L
#include "compositor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <math.h>
#include <pthread.h>

// Force enable TTY mode as requested
#define BLUE_TTY 1

#ifdef BLUE_TTY
#include <wayland-server-core.h>
#include <wlr/backend.h>
#include <wlr/backend/session.h>
#include <wlr/render/wlr_renderer.h>
#include <wlr/render/allocator.h>
#include <wlr/types/wlr_compositor.h>
#include <wlr/types/wlr_data_device.h>
#include <wlr/types/wlr_xdg_shell.h>
#include <wlr/types/wlr_seat.h>
#include <wlr/types/wlr_scene.h>
#include <wlr/types/wlr_output.h>
#include <wlr/types/wlr_output_layout.h>
#include <wlr/types/wlr_cursor.h>
#include <wlr/types/wlr_xcursor_manager.h>
#include <wlr/types/wlr_input_device.h>
#include <wlr/types/wlr_keyboard.h>
#include <wlr/types/wlr_pointer.h>
#include <wlr/types/wlr_gamma_control_v1.h>
#include <wlr/types/wlr_xdg_decoration_v1.h>
#include <wlr/xwayland.h>
#include <wlr/util/log.h>
#include <xkbcommon/xkbcommon.h>
#endif

/* --- DATA STRUCTURES --- */

struct BlueServer {
    bool running;

    #ifdef BLUE_TTY
    struct wl_display *wl_display;
    struct wlr_backend *backend;
    struct wlr_session *session;
    struct wlr_renderer *renderer;
    struct wlr_allocator *allocator;
    struct wlr_scene *scene;
    struct wlr_output_layout *output_layout;
    struct wlr_compositor *compositor;

    // Seat & Input
    struct wlr_seat *seat;
    struct wlr_cursor *cursor;
    struct wlr_xcursor_manager *cursor_mgr;
    struct wl_list keyboards;

    // Listeners (Persistent to prevent stack segfaults)
    struct wl_listener new_output;
    struct wl_listener new_xdg_surface;
    struct wl_listener new_xwayland_surface;
    struct wl_listener new_input;
    struct wl_listener cursor_motion;
    struct wl_listener cursor_motion_absolute;
    struct wl_listener cursor_button;
    struct wl_listener cursor_axis;
    struct wl_listener cursor_frame;

    // Shells
    struct wlr_xdg_shell *xdg_shell;
    struct wlr_xwayland *xwayland;

    // Lists
    struct wl_list outputs;
    struct wl_list windows;
    #else
    void* _dummy;
    #endif
};

struct BlueOutput {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct wlr_output *wlr_output;
    struct BlueServer *server;
    struct wl_listener frame;
    struct wl_listener destroy;
    #else
    int _dummy;
    #endif
};

struct BlueKeyboard {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct BlueServer *server;
    struct wlr_keyboard *wlr_keyboard;
    struct wl_listener modifiers;
    struct wl_listener key;
    struct wl_listener destroy;
    #else
    int _dummy;
    #endif
};

struct BlueWindow {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct BlueServer *server;
    struct wlr_xdg_toplevel *xdg_toplevel;
    struct wlr_xwayland_surface *xwayland_surface;
    struct wlr_scene_tree *scene_tree;
    struct wl_listener map;
    struct wl_listener unmap;
    struct wl_listener destroy;
    struct wl_listener request_move;
    struct wl_listener request_resize;
    #else
    int _dummy;
    #endif
    char app_id[128];
    int x, y;
    bool mapped;
    bool is_x11;
};

struct BlueServer server = {0};
pthread_mutex_t compositor_lock = PTHREAD_MUTEX_INITIALIZER;

/* --- INPUT HANDLING --- */

#ifdef BLUE_TTY
void server_new_keyboard(struct BlueServer *server, struct wlr_input_device *device) {
    struct BlueKeyboard *keyboard = calloc(1, sizeof(struct BlueKeyboard));
    keyboard->server = server;

    keyboard->wlr_keyboard = wlr_keyboard_from_input_device(device);

    struct xkb_context *context = xkb_context_new(XKB_CONTEXT_NO_FLAGS);
    struct xkb_keymap *keymap = xkb_keymap_new_from_names(context, NULL, XKB_KEYMAP_COMPILE_NO_FLAGS);

    if (keymap) {
        wlr_keyboard_set_keymap(keyboard->wlr_keyboard, keymap);
        xkb_keymap_unref(keymap);
    }
    xkb_context_unref(context);
    wlr_keyboard_set_repeat_info(keyboard->wlr_keyboard, 25, 600);

    wlr_seat_set_keyboard(server->seat, keyboard->wlr_keyboard);
    wl_list_insert(&server->keyboards, &keyboard->link);
}

void server_new_pointer(struct BlueServer *server, struct wlr_input_device *device) {
    wlr_cursor_attach_input_device(server->cursor, device);
}

void server_new_input(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_input_device *device = data;
    switch (device->type) {
        case WLR_INPUT_DEVICE_KEYBOARD:
            server_new_keyboard(&server, device);
            break;
        case WLR_INPUT_DEVICE_POINTER:
            server_new_pointer(&server, device);
            break;
        default:
            break;
    }
    uint32_t caps = WL_SEAT_CAPABILITY_POINTER;
    if (!wl_list_empty(&server.keyboards)) {
        caps |= WL_SEAT_CAPABILITY_KEYBOARD;
    }
    wlr_seat_set_capabilities(server.seat, caps);
}

void server_cursor_motion(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_pointer_motion_event *event = data;
    wlr_cursor_move(server.cursor, &event->pointer->base, event->delta_x, event->delta_y);
}

void server_cursor_motion_absolute(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_pointer_motion_absolute_event *event = data;
    wlr_cursor_warp_absolute(server.cursor, &event->pointer->base, event->x, event->y);
}

void server_cursor_button(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_pointer_button_event *event = data;
    wlr_seat_pointer_notify_button(server.seat, event->time_msec, event->button, event->state);

    double sx, sy;
    struct wlr_scene_node *node = wlr_scene_node_at(&server.scene->tree.node, server.cursor->x, server.cursor->y, &sx, &sy);

    if (event->state == WL_POINTER_BUTTON_STATE_PRESSED && node) {
        if (node->parent) {
            wlr_scene_node_raise_to_top(&node->parent->node);
        } else {
            wlr_scene_node_raise_to_top(node);
        }
    }
}

void server_cursor_axis(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_pointer_axis_event *event = data;
    wlr_seat_pointer_notify_axis(server.seat, event->time_msec, event->orientation, event->delta, event->delta_discrete, event->source, 0);
}

void server_cursor_frame(struct wl_listener *listener, void *data) {
    (void)listener;
    (void)data;
    wlr_seat_pointer_notify_frame(server.seat);
}
#endif

/* --- OUTPUT RENDERING --- */

#ifdef BLUE_TTY
void output_frame(struct wl_listener *listener, void *data) {
    (void)data;
    struct BlueOutput *output = wl_container_of(listener, output, frame);
    if (!output || !output->server || !output->server->scene) return;

    struct wlr_scene *scene = output->server->scene;
    struct wlr_scene_output *scene_output = wlr_scene_get_scene_output(scene, output->wlr_output);

    // CRITICAL FIX: Ensure scene_output exists before committing
    if (!scene_output) return;

    wlr_scene_output_commit(scene_output, NULL);

    struct timespec now;
    clock_gettime(CLOCK_MONOTONIC, &now);
    wlr_scene_output_send_frame_done(scene_output, &now);
}

void server_new_output(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_output *wlr_output = data;

    if (!wlr_output_init_render(wlr_output, server.allocator, server.renderer)) {
        fprintf(stderr, "[Blue Compositor] Failed to init output render\n");
        return;
    }

    struct wlr_output_state state;
    wlr_output_state_init(&state);
    wlr_output_state_set_enabled(&state, true);

    struct wlr_output_mode *mode = wlr_output_preferred_mode(wlr_output);
    if (mode) wlr_output_state_set_mode(&state, mode);

    wlr_output_commit_state(wlr_output, &state);
    wlr_output_state_finish(&state);

    struct BlueOutput *output = calloc(1, sizeof(struct BlueOutput));
    output->wlr_output = wlr_output;
    output->server = &server;

    output->frame.notify = output_frame;
    wl_signal_add(&wlr_output->events.frame, &output->frame);

    wlr_output_layout_add_auto(server.output_layout, wlr_output);
    wl_list_insert(&server.outputs, &output->link);
    printf("[Blue Compositor] Monitor Detected: %s\n", wlr_output->name);
}
#endif

/* --- WINDOW MANAGEMENT --- */

#ifdef BLUE_TTY
void server_new_xdg_surface(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_xdg_surface *xdg_surface = data;
    if (xdg_surface->role != WLR_XDG_SURFACE_ROLE_TOPLEVEL) return;

    struct BlueWindow *window = calloc(1, sizeof(struct BlueWindow));
    window->server = &server;
    window->xdg_toplevel = xdg_surface->toplevel;
    window->is_x11 = false;

    window->scene_tree = wlr_scene_xdg_surface_create(&server.scene->tree, xdg_surface);

    window->x = 50; window->y = 50;
    wlr_scene_node_set_position(&window->scene_tree->node, window->x, window->y);

    if (xdg_surface->toplevel->app_id) {
        strncpy(window->app_id, xdg_surface->toplevel->app_id, 127);
        printf("[Blue Compositor] New Wayland Window: %s\n", window->app_id);
    }

    wl_list_insert(&server.windows, &window->link);
}

void server_new_xwayland_surface(struct wl_listener *listener, void *data) {
    (void)listener;
    struct wlr_xwayland_surface *xsurface = data;
    struct BlueWindow *window = calloc(1, sizeof(struct BlueWindow));
    window->server = &server;
    window->xwayland_surface = xsurface;
    window->is_x11 = true;

    window->scene_tree = wlr_scene_subsurface_tree_create(&server.scene->tree, xsurface->surface);

    if (xsurface->title) {
        strncpy(window->app_id, xsurface->title, 127);
        printf("[Blue Compositor] New X11 Window: %s\n", window->app_id);
    }

    wl_list_insert(&server.windows, &window->link);
}
#endif

/* --- API EXPORTS --- */

void set_output_brightness(float value) {
    #ifdef BLUE_TTY
    struct BlueOutput *output;
    wl_list_for_each(output, &server.outputs, link) {
        size_t size = wlr_output_get_gamma_size(output->wlr_output);
        if (size == 0) continue;
        uint16_t *lut = malloc(size * sizeof(uint16_t) * 3);

        for(size_t i=0; i<size; i++) {
            uint16_t v = (uint16_t)(65535.0 * value * ((float)i / (size-1)));
            lut[i] = v; // R
            lut[i+size] = v; // G
            lut[i+2*size] = v; // B
        }

        struct wlr_output_state state;
        wlr_output_state_init(&state);
        wlr_output_state_set_gamma_lut(&state, size, lut, lut + size, lut + 2 * size);
        wlr_output_commit_state(output->wlr_output, &state);
        wlr_output_state_finish(&state);

        free(lut);
    }
    #endif
}

void move_surface(const char* app_id, int x, int y, int width, int height) {
    #ifdef BLUE_TTY
    struct BlueWindow *window;
    wl_list_for_each(window, &server.windows, link) {
        if (strstr(window->app_id, app_id)) {
            wlr_scene_node_set_position(&window->scene_tree->node, x, y);

            if (!window->is_x11 && window->xdg_toplevel) {
                wlr_xdg_toplevel_set_size(window->xdg_toplevel, width, height);
            } else if (window->is_x11 && window->xwayland_surface) {
                wlr_xwayland_surface_configure(window->xwayland_surface, x, y, width, height);
            }
            return;
        }
    }
    #endif
}

/* --- MAIN ENTRY --- */

void* compositor_thread(void* arg) {
    (void)arg;
    #ifdef BLUE_TTY
    wlr_log_init(WLR_DEBUG, NULL);

    // Force logind backend as requested
    setenv("LIBSEAT_BACKEND", "logind", 1);
    printf("[Blue Compositor] Forcing LIBSEAT_BACKEND=logind\n");

    server.wl_display = wl_display_create();
    if (!server.wl_display) {
        fprintf(stderr, "[Blue Compositor] Failed to create wl_display\n");
        return NULL;
    }

    server.backend = wlr_backend_autocreate(wl_display_get_event_loop(server.wl_display), &server.session);
    if (!server.backend) {
        fprintf(stderr, "[Blue Compositor] Failed to create backend\n");
        wl_display_destroy(server.wl_display);
        return NULL;
    }

    server.renderer = wlr_renderer_autocreate(server.backend);
    if (!server.renderer) {
        fprintf(stderr, "[Blue Compositor] Failed to create renderer\n");
        wlr_backend_destroy(server.backend);
        wl_display_destroy(server.wl_display);
        return NULL;
    }

    wlr_renderer_init_wl_display(server.renderer, server.wl_display);

    server.allocator = wlr_allocator_autocreate(server.backend, server.renderer);
    if (!server.allocator) {
        fprintf(stderr, "[Blue Compositor] Failed to create allocator\n");
        wlr_backend_destroy(server.backend);
        wl_display_destroy(server.wl_display);
        return NULL;
    }

    server.compositor = wlr_compositor_create(server.wl_display, 5, server.renderer);
    server.scene = wlr_scene_create();
    server.output_layout = wlr_output_layout_create(server.wl_display);

    wlr_scene_attach_output_layout(server.scene, server.output_layout);

    wl_list_init(&server.outputs);
    wl_list_init(&server.windows);
    wl_list_init(&server.keyboards);

    server.new_output.notify = server_new_output;
    wl_signal_add(&server.backend->events.new_output, &server.new_output);

    server.xdg_shell = wlr_xdg_shell_create(server.wl_display, 3);
    server.new_xdg_surface.notify = server_new_xdg_surface;
    wl_signal_add(&server.xdg_shell->events.new_surface, &server.new_xdg_surface);

    server.xwayland = wlr_xwayland_create(server.wl_display, server.compositor, true);
    if (server.xwayland) {
        server.new_xwayland_surface.notify = server_new_xwayland_surface;
        wl_signal_add(&server.xwayland->events.new_surface, &server.new_xwayland_surface);
    }

    server.seat = wlr_seat_create(server.wl_display, "seat0");
    server.cursor = wlr_cursor_create();
    wlr_cursor_attach_output_layout(server.cursor, server.output_layout);

    server.cursor_mgr = wlr_xcursor_manager_create(NULL, 24);
    if (server.cursor_mgr) {
        wlr_xcursor_manager_load(server.cursor_mgr, 1);
    }

    server.new_input.notify = server_new_input;
    wl_signal_add(&server.backend->events.new_input, &server.new_input);

    server.cursor_motion.notify = server_cursor_motion;
    wl_signal_add(&server.cursor->events.motion, &server.cursor_motion);

    server.cursor_motion_absolute.notify = server_cursor_motion_absolute;
    wl_signal_add(&server.cursor->events.motion_absolute, &server.cursor_motion_absolute);

    server.cursor_button.notify = server_cursor_button;
    wl_signal_add(&server.cursor->events.button, &server.cursor_button);

    server.cursor_axis.notify = server_cursor_axis;
    wl_signal_add(&server.cursor->events.axis, &server.cursor_axis);

    server.cursor_frame.notify = server_cursor_frame;
    wl_signal_add(&server.cursor->events.frame, &server.cursor_frame);

    if (!wlr_backend_start(server.backend)) {
        fprintf(stderr, "Failed to start backend\n");
        wl_display_destroy(server.wl_display);
        return NULL;
    }

    const char *socket = wl_display_add_socket_auto(server.wl_display);
    if (!socket) {
        wlr_backend_destroy(server.backend);
        return NULL;
    }

    printf("WAYLAND_DISPLAY=%s\n", socket);
    setenv("WAYLAND_DISPLAY", socket, 1);

    wl_display_run(server.wl_display);

    wl_display_destroy_clients(server.wl_display);
    wl_display_destroy(server.wl_display);
    #else
    printf("[Blue Mock] TTY mode disabled. Simulating...\n");
    while(1) sleep(1);
    #endif
    return NULL;
}

int start_compositor(void) {
    pthread_t t;
    pthread_create(&t, NULL, compositor_thread, NULL);
    pthread_detach(t);
    return 0;
}

int get_monitor_count(void) { return 1; }
bool is_app_running(const char* app_id) { return true; }
