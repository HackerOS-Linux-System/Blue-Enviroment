#include <gtk/gtk.h>
#include <gio/gio.h>
#include <gio/gdesktopappinfo.h>
#include <gtk-layer-shell/gtk-layer-shell.h>
#include <stdlib.h>
#include <string.h>

#define APP_DIR "/usr/share/applications/"
#define WALLPAPER_DIR "/usr/share/wallpapers/"
#define DEFAULT_WALLPAPER WALLPAPER_DIR "default_wallpaper.jpg" // Assume a default wallpaper file

typedef struct {
    GtkWidget *window;
    GtkWidget *overlay;
    GtkWidget *background_image;
    GtkWidget *icon_view;
    GListModel *app_list;
} DesktopData;

static void launch_app(GtkWidget *widget, gpointer user_data) {
    GAppInfo *app_info = G_APP_INFO(user_data);
    GError *error = NULL;
    if (!g_app_info_launch(app_info, NULL, NULL, &error)) {
        g_printerr("Failed to launch app: %s\n", error->message);
        g_error_free(error);
    }
}

static void populate_icons(GtkIconView *icon_view, GListModel *model) {
    gtk_icon_view_set_model(icon_view, GTK_TREE_MODEL(model));
    gtk_icon_view_set_pixbuf_column(icon_view, 0);
    gtk_icon_view_set_text_column(icon_view, 1);
    gtk_icon_view_set_activate_on_single_click(icon_view, TRUE);
    g_signal_connect(icon_view, "item-activated", G_CALLBACK(launch_app), NULL);
}

static GListModel *load_apps() {
    GListStore *store = g_list_store_new(G_TYPE_APP_INFO);
    GDir *dir = g_dir_open(APP_DIR, 0, NULL);
    if (dir) {
        const gchar *filename;
        while ((filename = g_dir_read_name(dir)) != NULL) {
            if (g_str_has_suffix(filename, ".desktop")) {
                gchar *path = g_build_filename(APP_DIR, filename, NULL);
                GDesktopAppInfo *app_info = g_desktop_app_info_new_from_filename(path);
                if (app_info && g_app_info_should_show(G_APP_INFO(app_info))) {
                    g_list_store_append(store, app_info);
                    g_object_unref(app_info);
                }
                g_free(path);
            }
        }
        g_dir_close(dir);
    }
    return G_LIST_MODEL(store);
}

static gboolean on_button_press(GtkWidget *widget, GdkEventButton *event, gpointer user_data) {
    if (event->button == 3) { // Right click
        GtkWidget *menu = gtk_menu_new();
        GtkWidget *item_logout = gtk_menu_item_new_with_label("Logout");
        GtkWidget *item_shutdown = gtk_menu_item_new_with_label("Shutdown");
        GtkWidget *item_restart = gtk_menu_item_new_with_label("Restart");

        // Connect signals (placeholders, implement actual commands)
        g_signal_connect(item_logout, "activate", G_CALLBACK(system), (gpointer)"dm-tool switch-to-greeter"); // Example
        g_signal_connect(item_shutdown, "activate", G_CALLBACK(system), (gpointer)"systemctl poweroff");
        g_signal_connect(item_restart, "activate", G_CALLBACK(system), (gpointer)"systemctl reboot");

        gtk_menu_shell_append(GTK_MENU_SHELL(menu), item_logout);
        gtk_menu_shell_append(GTK_MENU_SHELL(menu), item_shutdown);
        gtk_menu_shell_append(GTK_MENU_SHELL(menu), item_restart);

        gtk_widget_show_all(menu);
        gtk_menu_popup_at_pointer(GTK_MENU(menu), (GdkEvent*)event);
        return TRUE;
    }
    return FALSE;
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

    // Overlay for background and icons
    data->overlay = gtk_overlay_new();

    // Background image
    data->background_image = gtk_image_new_from_file(DEFAULT_WALLPAPER);
    gtk_widget_set_hexpand(data->background_image, TRUE);
    gtk_widget_set_vexpand(data->background_image, TRUE);
    gtk_image_set_pixel_size(GTK_IMAGE(data->background_image), -1); // Scale to fit
    gtk_overlay_add_overlay(GTK_OVERLAY(data->overlay), data->background_image);

    // Icon view for desktop icons (apps)
    data->icon_view = gtk_icon_view_new();
    gtk_widget_set_hexpand(data->icon_view, TRUE);
    gtk_widget_set_vexpand(data->icon_view, TRUE);
    gtk_icon_view_set_item_orientation(GTK_ICON_VIEW(data->icon_view), GTK_ORIENTATION_VERTICAL);
    gtk_icon_view_set_columns(GTK_ICON_VIEW(data->icon_view), -1);
    gtk_icon_view_set_spacing(GTK_ICON_VIEW(data->icon_view), 12);
    gtk_icon_view_set_item_padding(GTK_ICON_VIEW(data->icon_view), 6);

    // Load and populate apps
    data->app_list = load_apps();
    populate_icons(GTK_ICON_VIEW(data->icon_view), data->app_list);

    // Scrolled window for icons if many
    GtkWidget *scrolled = gtk_scrolled_window_new(NULL, NULL);
    gtk_container_add(GTK_CONTAINER(scrolled), data->icon_view);
    gtk_overlay_add_overlay(GTK_OVERLAY(data->overlay), scrolled);

    gtk_container_add(GTK_CONTAINER(data->window), data->overlay);

    // Handle right click
    gtk_widget_add_events(data->window, GDK_BUTTON_PRESS_MASK);
    g_signal_connect(data->window, "button-press-event", G_CALLBACK(on_button_press), NULL);

    // Set dark theme
    GtkSettings *settings = gtk_settings_get_default();
    g_object_set(settings, "gtk-application-prefer-dark-theme", TRUE, NULL);
    g_object_set(settings, "gtk-theme-name", "Adwaita", NULL); // Or custom theme

    gtk_widget_show_all(data->window);
}

int main(int argc, char **argv) {
    GtkApplication *app = gtk_application_new("org.blueenvironment.desktop", G_APPLICATION_FLAGS_NONE);
    DesktopData data = {0};

    g_signal_connect(app, "activate", G_CALLBACK(activate), &data);

    int status = g_application_run(G_APPLICATION(app), argc, argv);
    g_object_unref(app);

    if (data.app_list) {
        g_object_unref(data.app_list);
    }

    return status;
}
