#include <gtk/gtk.h>
#include <gio/gio.h>
#include <gtk-layer-shell/gtk-layer-shell.h>
#include <stdlib.h>
#include <string.h>

#define WALLPAPER_DIR "/usr/share/wallpapers/"
#define DEFAULT_WALLPAPER WALLPAPER_DIR "default_wallpaper.jpg" // Assume a default wallpaper file

struct DesktopData {
    GtkWidget *window;
    GtkWidget *overlay;
    GtkWidget *background_image;
    GtkWidget *flow_box;
    GListModel *app_list;
};

static void launch_app(GAppInfo *app_info) {
    GError *error = NULL;
    if (!g_app_info_launch(app_info, NULL, NULL, &error)) {
        g_printerr("Failed to launch app: %s\n", error->message);
        g_error_free(error);
    }
}

static void on_icon_pressed(GtkGestureClick *gesture, int n_press, double x, double y, gpointer user_data) {
    GtkEventController *controller = GTK_EVENT_CONTROLLER(gesture);
    GtkWidget *widget = gtk_event_controller_get_widget(controller);
    GAppInfo *app_info = (GAppInfo*)g_object_get_data(G_OBJECT(widget), "app_info");
    if (app_info) {
        launch_app(app_info);
    }
}

static void populate_flowbox(GtkFlowBox *flow_box, GListModel *model) {
    for (guint i = 0; i < g_list_model_get_n_items(model); i++) {
        GAppInfo *app_info = G_APP_INFO(g_list_model_get_object(model, i));
        if (!app_info) continue;
        GIcon *gicon = g_app_info_get_icon(app_info);
        GtkWidget *image = gtk_image_new_from_gicon(gicon);
        gtk_image_set_pixel_size(GTK_IMAGE(image), 48);
        GtkWidget *label = gtk_label_new(g_app_info_get_display_name(app_info));
        gtk_label_set_wrap(GTK_LABEL(label), TRUE);
        gtk_label_set_justify(GTK_LABEL(label), GTK_JUSTIFY_CENTER);
        GtkWidget *box = gtk_box_new(GTK_ORIENTATION_VERTICAL, 6);
        gtk_box_append(GTK_BOX(box), image);
        gtk_box_append(GTK_BOX(box), label);
        gtk_widget_set_margin_start(box, 6);
        gtk_widget_set_margin_end(box, 6);
        gtk_widget_set_margin_top(box, 6);
        gtk_widget_set_margin_bottom(box, 6);
        gtk_widget_set_halign(box, GTK_ALIGN_CENTER);
        gtk_widget_set_valign(box, GTK_ALIGN_CENTER);
        g_object_set_data_full(G_OBJECT(box), "app_info", g_object_ref(app_info), g_object_unref);
        GtkGesture *gesture = gtk_gesture_click_new();
        gtk_gesture_single_set_button(GTK_GESTURE_SINGLE(gesture), 1);
        g_signal_connect(gesture, "pressed", G_CALLBACK(on_icon_pressed), NULL);
        gtk_widget_add_controller(box, GTK_EVENT_CONTROLLER(gesture));
        gtk_flow_box_append(flow_box, box);
        g_object_unref(app_info);
    }
}

static GListModel *load_apps() {
    GListStore *store = g_list_store_new(G_TYPE_APP_INFO);
    GList *apps = g_app_info_get_all();
    for (GList *l = apps; l != NULL; l = l->next) {
        GAppInfo *app_info = G_APP_INFO(l->data);
        if (g_app_info_should_show(app_info)) {
            g_list_store_append(store, app_info);
        }
    }
    g_list_free_full(apps, g_object_unref);
    return G_LIST_MODEL(store);
}

static void on_logout(GSimpleAction *action, GVariant *param, gpointer user_data) {
    system("dm-tool switch-to-greeter");
}

static void on_shutdown(GSimpleAction *action, GVariant *param, gpointer user_data) {
    system("systemctl poweroff");
}

static void on_restart(GSimpleAction *action, GVariant *param, gpointer user_data) {
    system("systemctl reboot");
}

static void show_context_menu(double x, double y, DesktopData *data) {
    GMenu *menu = g_menu_new();
    g_menu_append(menu, "Logout", "app.logout");
    g_menu_append(menu, "Shutdown", "app.shutdown");
    g_menu_append(menu, "Restart", "app.restart");
    GtkWidget *popover = gtk_popover_menu_new_from_model(G_MENU_MODEL(menu));
    gtk_widget_set_parent(popover, data->window);
    GdkRectangle point = { (int)x, (int)y, 0, 0 };
    gtk_popover_set_pointing_to(GTK_POPOVER(popover), &point);
    gtk_popover_popup(GTK_POPOVER(popover));
    g_object_unref(menu);
}

static void on_desktop_click_pressed(GtkGestureClick *gesture, int n_press, double x, double y, gpointer user_data) {
    if (n_press != 1) return;
    show_context_menu(x, y, (DesktopData*)user_data);
}

static void activate(GtkApplication *app, gpointer user_data) {
    DesktopData *data = (DesktopData *)user_data;
    data->window = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(data->window), "Blue Desktop");
    gtk_window_fullscreen(GTK_WINDOW(data->window));

    // Init layer shell
    gtk_layer_init_for_window(GTK_WINDOW(data->window));
    gtk_layer_set_layer(GTK_WINDOW(data->window), GTK_LAYER_SHELL_LAYER_BACKGROUND);
    gtk_layer_set_namespace(GTK_WINDOW(data->window), "blue-desktop");
    gtk_layer_set_anchor(GTK_WINDOW(data->window), GTK_LAYER_SHELL_EDGE_LEFT, TRUE);
    gtk_layer_set_anchor(GTK_WINDOW(data->window), GTK_LAYER_SHELL_EDGE_RIGHT, TRUE);
    gtk_layer_set_anchor(GTK_WINDOW(data->window), GTK_LAYER_SHELL_EDGE_TOP, TRUE);
    gtk_layer_set_anchor(GTK_WINDOW(data->window), GTK_LAYER_SHELL_EDGE_BOTTOM, TRUE);
    gtk_layer_set_keyboard_mode(GTK_WINDOW(data->window), GTK_LAYER_SHELL_KEYBOARD_MODE_NONE);

    // Add actions to app
    GSimpleAction *logout_action = g_simple_action_new("logout", NULL);
    g_signal_connect(logout_action, "activate", G_CALLBACK(on_logout), NULL);
    g_action_map_add_action(G_ACTION_MAP(app), G_ACTION(logout_action));
    g_object_unref(logout_action);

    GSimpleAction *shutdown_action = g_simple_action_new("shutdown", NULL);
    g_signal_connect(shutdown_action, "activate", G_CALLBACK(on_shutdown), NULL);
    g_action_map_add_action(G_ACTION_MAP(app), G_ACTION(shutdown_action));
    g_object_unref(shutdown_action);

    GSimpleAction *restart_action = g_simple_action_new("restart", NULL);
    g_signal_connect(restart_action, "activate", G_CALLBACK(on_restart), NULL);
    g_action_map_add_action(G_ACTION_MAP(app), G_ACTION(restart_action));
    g_object_unref(restart_action);

    // Overlay for background and icons
    data->overlay = gtk_overlay_new();

    // Background image
    data->background_image = gtk_picture_new_for_filename(DEFAULT_WALLPAPER);
    gtk_picture_set_content_fit(GTK_PICTURE(data->background_image), GTK_CONTENT_FIT_COVER);
    gtk_widget_set_hexpand(data->background_image, TRUE);
    gtk_widget_set_vexpand(data->background_image, TRUE);
    gtk_overlay_set_child(GTK_OVERLAY(data->overlay), data->background_image);

    // Flow box for desktop icons (apps)
    data->flow_box = gtk_flow_box_new();
    gtk_flow_box_set_column_spacing(GTK_FLOW_BOX(data->flow_box), 12);
    gtk_flow_box_set_row_spacing(GTK_FLOW_BOX(data->flow_box), 12);
    gtk_flow_box_set_selection_mode(GTK_FLOW_BOX(data->flow_box), GTK_SELECTION_NONE);
    gtk_widget_set_hexpand(data->flow_box, TRUE);
    gtk_widget_set_vexpand(data->flow_box, TRUE);

    // Load and populate apps
    data->app_list = load_apps();
    populate_flowbox(GTK_FLOW_BOX(data->flow_box), data->app_list);

    // Scrolled window for icons if many
    GtkWidget *scrolled = gtk_scrolled_window_new();
    gtk_scrolled_window_set_child(GTK_SCROLLED_WINDOW(scrolled), data->flow_box);
    gtk_overlay_add_overlay(GTK_OVERLAY(data->overlay), scrolled);

    gtk_window_set_child(GTK_WINDOW(data->window), data->overlay);

    // Handle right click
    GtkGesture *gesture = gtk_gesture_click_new();
    gtk_gesture_single_set_button(GTK_GESTURE_SINGLE(gesture), 3);
    g_signal_connect(gesture, "pressed", G_CALLBACK(on_desktop_click_pressed), data);
    gtk_widget_add_controller(data->overlay, GTK_EVENT_CONTROLLER(gesture));

    // Set dark theme
    GtkSettings *settings = gtk_settings_get_default();
    g_object_set(settings, "gtk-application-prefer-dark-theme", TRUE, NULL);
    g_object_set(settings, "gtk-theme-name", "Adwaita", NULL); // Or custom theme

    gtk_widget_set_visible(data->window, TRUE);
}

int main(int argc, char **argv) {
    GtkApplication *app = gtk_application_new("org.blueenvironment.desktop", G_APPLICATION_DEFAULT_FLAGS);
    DesktopData data = {0};
    g_signal_connect(app, "activate", G_CALLBACK(activate), &data);
    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);
    if (data.app_list) {
        g_object_unref(data.app_list);
    }
    return status;
}
