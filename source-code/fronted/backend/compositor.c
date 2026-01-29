#include "compositor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <pthread.h>
#include <math.h>

// If compiling for real TTY, these headers would be needed.
// For compatibility with standard dev environments, we guard them.
// #define BLUE_TTY 1

#ifdef BLUE_TTY
#include <wayland-server.h>
#include <wlr/backend.h>
#include <wlr/render/wlr_renderer.h>
#include <wlr/types/wlr_compositor.h>
#include <wlr/types/wlr_data_device.h>
#include <wlr/types/wlr_xdg_shell.h>
#include <wlr/types/wlr_seat.h>
#include <wlr/types/wlr_scene.h>
#include <wlr/types/wlr_output.h>
#include <wlr/types/wlr_output_layout.h>
#include <wlr/types/wlr_gamma_control_v1.h>
#include <wlr/util/log.h>
// Protocols
#include <wlr/types/wlr_xdg_decoration_v1.h>
#include <wlr/types/wlr_layer_shell_v1.h>
// XWayland (Legacy X11 Support)
#include <wlr/xwayland.h>
#endif

/* --- DATA STRUCTURES --- */

typedef struct {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct wlr_xdg_toplevel *toplevel;
    struct wlr_xwayland_surface *xwayland_surface; // For X11 apps
    struct wlr_scene_tree *scene_tree;
    struct wl_listener map;
    struct wl_listener unmap;
    struct wl_listener request_move;
    struct wl_listener request_resize;
    struct wl_listener destroy;
    #else
    int _dummy;
    #endif
    char app_id[64];
    int x, y, w, h;
    bool mapped;
    bool is_x11;
} BlueWindow;

typedef struct {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct wlr_layer_surface_v1 *layer_surface;
    struct wlr_scene_layer_surface_v1 *scene_layer;
    struct wl_listener map;
    struct wl_listener unmap;
    struct wl_listener surface_commit;
    #else
    int _dummy;
    #endif
    int layer_idx;
} BlueLayer;

#define MAX_SURFACES 50
BlueWindow windows[MAX_SURFACES];
pthread_mutex_t surface_lock = PTHREAD_MUTEX_INITIALIZER;

struct BlueOutput {
    #ifdef BLUE_TTY
    struct wl_list link;
    struct wlr_output *wlr_output;
    struct wl_listener frame;
    struct wl_listener destroy;
    #else
    int _dummy;
    #endif
};

struct BlueServer {
    bool running;

    #ifdef BLUE_TTY
    struct wl_display *wl_display;
    struct wlr_backend *backend;
    struct wlr_renderer *renderer;
    struct wlr_allocator *allocator;
    struct wlr_scene *scene;
    struct wlr_output_layout *output_layout;

    struct wlr_xdg_shell *xdg_shell;
    struct wlr_layer_shell_v1 *layer_shell;
    struct wlr_xdg_decoration_manager_v1 *decoration_manager;
    struct wlr_gamma_control_manager_v1 *gamma_control;

    // XWayland
    struct wlr_xwayland *xwayland;

    struct wl_list outputs;
    struct wl_list xdg_windows;
    struct wl_list layers;
    #else
    void* outputs_placeholder;
    #endif
};

struct BlueServer server = {0};

/* --- 1. BRIGHTNESS / GAMMA CONTROL --- */

void set_output_brightness(float value) {
    if (value < 0.1f) value = 0.1f;
    if (value > 1.0f) value = 1.0f;

    printf("[Blue Compositor] Setting brightness to %.2f\n", value);

    #ifdef BLUE_TTY
    struct BlueOutput *output;
    wl_list_for_each(output, &server.outputs, link) {
        struct wlr_output *wlr_output = output->wlr_output;
        size_t gamma_size = wlr_output_get_gamma_size(wlr_output);
        if (gamma_size == 0) continue;

        uint16_t *r = malloc(gamma_size * sizeof(uint16_t));
        uint16_t *g = malloc(gamma_size * sizeof(uint16_t));
        uint16_t *b = malloc(gamma_size * sizeof(uint16_t));

        for (size_t i = 0; i < gamma_size; i++) {
            // Apply linear dimming
            uint16_t val = (uint16_t)(65535.0f * (float)i / (float)(gamma_size - 1) * value);
            r[i] = val;
            g[i] = val;
            b[i] = val;
        }

        wlr_output_set_gamma(wlr_output, gamma_size, r, g, b);
        wlr_output_commit(wlr_output);

        free(r); free(g); free(b);
    }
    #endif
}

/* --- 2. XDG SHELL & DECORATIONS --- */

#ifdef BLUE_TTY
void handle_xdg_decoration_request(struct wl_listener *listener, void *data) {
    struct wlr_xdg_toplevel_decoration_v1 *decoration = data;
    wlr_xdg_toplevel_decoration_v1_set_mode(decoration, WLR_XDG_TOPLEVEL_DECORATION_V1_MODE_SERVER_SIDE);
}

void xdg_surface_map(struct wl_listener *listener, void *data) {
    struct BlueWindow *window = wl_container_of(listener, window, map);
    window->mapped = true;
}

void xdg_surface_unmap(struct wl_listener *listener, void *data) {
    struct BlueWindow *window = wl_container_of(listener, window, unmap);
    window->mapped = false;
}

void server_new_xdg_surface(struct wl_listener *listener, void *data) {
    struct wlr_xdg_surface *xdg_surface = data;
    if (xdg_surface->role != WLR_XDG_SURFACE_ROLE_TOPLEVEL) return;

    struct BlueWindow *window = calloc(1, sizeof(struct BlueWindow));
    window->toplevel = xdg_surface->toplevel;
    window->is_x11 = false;

    const char *app_id = xdg_surface->toplevel->app_id;
    strncpy(window->app_id, app_id ? app_id : "unknown", 63);

    window->scene_tree = wlr_scene_xdg_surface_create(server.scene->tree, xdg_surface);

    window->map.notify = xdg_surface_map;
    wl_signal_add(&xdg_surface->events.map, &window->map);
    window->unmap.notify = xdg_surface_unmap;
    wl_signal_add(&xdg_surface->events.unmap, &window->unmap);

    printf("[Blue Compositor] New Wayland Surface: %s\n", window->app_id);
}
#endif

/* --- 3. XWAYLAND (Legacy X11 Apps) --- */

#ifdef BLUE_TTY
void xwayland_surface_map(struct wl_listener *listener, void *data) {
    struct BlueWindow *window = wl_container_of(listener, window, map);
    window->mapped = true;
    printf("[Blue Compositor] X11 Window Mapped: %s\n", window->app_id);
}

void xwayland_surface_unmap(struct wl_listener *listener, void *data) {
    struct BlueWindow *window = wl_container_of(listener, window, unmap);
    window->mapped = false;
}

void server_new_xwayland_surface(struct wl_listener *listener, void *data) {
    struct wlr_xwayland_surface *xsurface = data;

    struct BlueWindow *window = calloc(1, sizeof(struct BlueWindow));
    window->xwayland_surface = xsurface;
    window->is_x11 = true;

    // Wait for X11 to tell us the class name
    const char *title = xsurface->title;
    strncpy(window->app_id, title ? title : "X11-App", 63);

    // Create scene node for XWayland
    // wlr_scene_subsurface_tree_create(server.scene->tree, xsurface->surface);

    window->map.notify = xwayland_surface_map;
    wl_signal_add(&xsurface->events.map, &window->map);
    window->unmap.notify = xwayland_surface_unmap;
    wl_signal_add(&xsurface->events.unmap, &window->unmap);

    printf("[Blue Compositor] New XWayland Surface detected.\n");
}

void xwayland_ready(struct wl_listener *listener, void *data) {
    printf("[Blue Compositor] XWayland Server is READY.\n");
    // Set XWayland Cursor/Seat info here if needed
}
#endif

/* --- 4. OUTPUTS & LAYERS --- */

#ifdef BLUE_TTY
void server_new_output(struct wl_listener *listener, void *data) {
    struct wlr_output *wlr_output = data;
    wlr_output_init_render(wlr_output, server.allocator, server.renderer);

    struct wlr_output_state state;
    wlr_output_state_init(&state);
    wlr_output_state_set_enabled(&state, true);

    struct wlr_output_mode *mode = wlr_output_preferred_mode(wlr_output);
    if (mode) wlr_output_state_set_mode(&state, mode);

    wlr_output_commit_state(wlr_output, &state);
    wlr_output_state_finish(&state);

    struct BlueOutput *output = calloc(1, sizeof(struct BlueOutput));
    output->wlr_output = wlr_output;

    wlr_output_layout_add_auto(server.output_layout, wlr_output);
    wl_list_insert(&server.outputs, &output->link);
}

void server_new_layer_surface(struct wl_listener *listener, void *data) {
    struct wlr_layer_surface_v1 *layer_surface = data;
    if (!layer_surface->output) {
        layer_surface->output = wlr_output_layout_output_at(server.output_layout, 0, 0);
    }

    struct wlr_scene_tree *parent = server.scene->tree;
    struct wlr_scene_layer_surface_v1 *scene_layer = wlr_scene_layer_surface_v1_create(parent, layer_surface);
    wlr_layer_surface_v1_configure(layer_surface, layer_surface->pending.desired_width, layer_surface->pending.desired_height);
}
#endif

/* --- MAIN LOOP --- */

void* wayland_event_loop(void* arg) {
    (void)arg;
    printf("[Blue Compositor] Starting Wayland Server Thread...\n");

    #ifdef BLUE_TTY
    server.wl_display = wl_display_create();
    server.backend = wlr_backend_autocreate(server.wl_display, NULL);
    server.renderer = wlr_renderer_autocreate(server.backend);
    wlr_renderer_init_wl_display(server.renderer, server.wl_display);
    server.allocator = wlr_allocator_autocreate(server.backend, server.renderer);

    server.scene = wlr_scene_create();
    server.output_layout = wlr_output_layout_create();
    wlr_scene_attach_output_layout(server.scene, server.output_layout);

    wl_list_init(&server.outputs);
    wl_list_init(&server.xdg_windows);
    wl_list_init(&server.layers);

    // Outputs
    struct wl_listener new_output_listener;
    new_output_listener.notify = server_new_output;
    wl_signal_add(&server.backend->events.new_output, &new_output_listener);

    // XDG Shell
    server.xdg_shell = wlr_xdg_shell_create(server.wl_display, 3);
    struct wl_listener new_xdg_surface_listener;
    new_xdg_surface_listener.notify = server_new_xdg_surface;
    wl_signal_add(&server.xdg_shell->events.new_surface, &new_xdg_surface_listener);

    // Layer Shell
    server.layer_shell = wlr_layer_shell_v1_create(server.wl_display, 3);
    struct wl_listener new_layer_surface_listener;
    new_layer_surface_listener.notify = server_new_layer_surface;
    wl_signal_add(&server.layer_shell->events.new_surface, &new_layer_surface_listener);

    // Decorations (SSD)
    server.decoration_manager = wlr_xdg_decoration_manager_v1_create(server.wl_display);
    struct wl_listener decoration_listener;
    decoration_listener.notify = handle_xdg_decoration_request;
    wl_signal_add(&server.decoration_manager->events.new_toplevel_decoration, &decoration_listener);

    // Gamma Control (Brightness)
    server.gamma_control = wlr_gamma_control_manager_v1_create(server.wl_display);

    // XWayland Initialization
    server.xwayland = wlr_xwayland_create(server.wl_display, server.compositor, true);
    if (server.xwayland) {
        struct wl_listener new_xwayland_surface_listener;
        new_xwayland_surface_listener.notify = server_new_xwayland_surface;
        wl_signal_add(&server.xwayland->events.new_surface, &new_xwayland_surface_listener);

        struct wl_listener xwayland_ready_listener;
        xwayland_ready_listener.notify = xwayland_ready;
        wl_signal_add(&server.xwayland->events.ready, &xwayland_ready_listener);
    } else {
        fprintf(stderr, "Failed to start XWayland\n");
    }

    if (!wlr_backend_start(server.backend)) {
        wl_display_destroy(server.wl_display);
        return NULL;
    }

    wl_display_run(server.wl_display);

    #else
    printf("[Blue Compositor] Running in mock/windowed mode.\n");
    printf("[Blue Compositor]  [+] XDG Shell & XWayland (Simulated)\n");
    printf("[Blue Compositor]  [+] Hardware Brightness (Simulated via Gamma)\n");

    server.running = true;
    while(server.running) {
        sleep(1);
    }
    #endif

    return NULL;
}

int start_compositor(void) {
    printf("[Backend-C] Initializing Blue Environment Compositor...\n");

    for(int i=0; i<MAX_SURFACES; i++) {
        windows[i].mapped = false;
        strncpy(windows[i].app_id, "", 63);
    }

    pthread_t thread_id;
    if (pthread_create(&thread_id, NULL, wayland_event_loop, NULL) != 0) {
        perror("Failed to create compositor thread");
        return -1;
    }
    pthread_detach(thread_id);

    return 0;
}

void move_surface(const char* app_id, int x, int y, int width, int height) {
    pthread_mutex_lock(&surface_lock);

    #ifdef BLUE_TTY
    /* Real Logic: Find surface by app_id in xdg_windows OR xwayland list and move scene node */
    #else
    // Mock Logic
    bool found = false;
    for(int i=0; i<MAX_SURFACES; i++) {
        if(windows[i].mapped && strstr(windows[i].app_id, app_id)) {
            windows[i].x = x; windows[i].y = y; windows[i].w = width; windows[i].h = height;
            found = true;
            break;
        }
    }
    if (!found) {
        for(int i=0; i<MAX_SURFACES; i++) {
            if(!windows[i].mapped) {
                strncpy(windows[i].app_id, app_id, 63);
                windows[i].x = x; windows[i].y = y; windows[i].w = width; windows[i].h = height;
                windows[i].mapped = true;
                break;
            }
        }
    }
    #endif

    pthread_mutex_unlock(&surface_lock);
}

int get_monitor_count(void) {
    #ifdef BLUE_TTY
    return wl_list_length(&server.outputs);
    #else
    return 1;
    #endif
}

bool is_app_running(const char* app_id) {
    (void)app_id;
    return true;
}
