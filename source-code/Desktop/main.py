import sys
import os
import gi

gi.require_version('Gtk', '4.0')
gi.require_version('Gio', '2.0')
gi.require_version('Gdk', '4.0')
gi.require_version('GtkLayerShell', '0.1')  # Assuming the binding is available

from gi.repository import Gtk, Gio, Gdk, GtkLayerShell, GLib

WALLPAPER_DIR = "/usr/share/wallpapers/"
DEFAULT_WALLPAPER = WALLPAPER_DIR + "default_wallpaper.jpg"  # Assume a default wallpaper file

class BlueDesktop(Gtk.Application):
    def __init__(self):
        super().__init__(application_id="org.blueenvironment.desktop", flags=Gio.ApplicationFlags.DEFAULT_FLAGS)
        self.window = None
        self.overlay = None
        self.background_image = None
        self.flow_box = None
        self.app_list = None

    def do_activate(self):
        self.window = Gtk.ApplicationWindow(application=self)
        self.window.set_title("Blue Desktop")
        self.window.fullscreen()

        # Init layer shell
        GtkLayerShell.init_for_window(self.window)
        GtkLayerShell.set_layer(self.window, GtkLayerShell.Layer.BACKGROUND)
        GtkLayerShell.set_namespace(self.window, "blue-desktop")
        GtkLayerShell.set_anchor(self.window, GtkLayerShell.Edge.LEFT, True)
        GtkLayerShell.set_anchor(self.window, GtkLayerShell.Edge.RIGHT, True)
        GtkLayerShell.set_anchor(self.window, GtkLayerShell.Edge.TOP, True)
        GtkLayerShell.set_anchor(self.window, GtkLayerShell.Edge.BOTTOM, True)
        GtkLayerShell.set_keyboard_mode(self.window, GtkLayerShell.KeyboardMode.NONE)

        # Add actions to app
        logout_action = Gio.SimpleAction.new("logout", None)
        logout_action.connect("activate", self.on_logout)
        self.add_action(logout_action)

        shutdown_action = Gio.SimpleAction.new("shutdown", None)
        shutdown_action.connect("activate", self.on_shutdown)
        self.add_action(shutdown_action)

        restart_action = Gio.SimpleAction.new("restart", None)
        restart_action.connect("activate", self.on_restart)
        self.add_action(restart_action)

        # Overlay for background and icons
        self.overlay = Gtk.Overlay()

        # Background image
        self.background_image = Gtk.Picture.new_for_filename(DEFAULT_WALLPAPER)
        self.background_image.set_content_fit(Gtk.ContentFit.COVER)
        self.background_image.set_hexpand(True)
        self.background_image.set_vexpand(True)
        self.overlay.set_child(self.background_image)

        # Flow box for desktop icons (apps)
        self.flow_box = Gtk.FlowBox()
        self.flow_box.set_column_spacing(12)
        self.flow_box.set_row_spacing(12)
        self.flow_box.set_selection_mode(Gtk.SelectionMode.NONE)
        self.flow_box.set_hexpand(True)
        self.flow_box.set_vexpand(True)

        # Load and populate apps
        self.app_list = self.load_apps()
        self.populate_flowbox(self.flow_box, self.app_list)

        # Scrolled window for icons if many
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_child(self.flow_box)
        self.overlay.add_overlay(scrolled)

        self.window.set_child(self.overlay)

        # Handle right click
        gesture = Gtk.GestureClick.new()
        gesture.set_button(3)
        gesture.connect("pressed", self.on_desktop_click_pressed)
        self.overlay.add_controller(gesture)

        # Set dark theme
        settings = Gtk.Settings.get_default()
        settings.set_property("gtk-application-prefer-dark-theme", True)
        settings.set_property("gtk-theme-name", "Adwaita")  # Or custom theme

        self.window.present()

    def launch_app(self, app_info):
        try:
            app_info.launch(None, None)
        except GLib.Error as error:
            print(f"Failed to launch app: {error.message}")

    def on_icon_pressed(self, gesture, n_press, x, y):
        if n_press != 1:
            return
        widget = gesture.get_widget()
        app_info = widget.get_data("app_info")
        if app_info:
            self.launch_app(app_info)

    def populate_flowbox(self, flow_box, model):
        for i in range(model.get_n_items()):
            app_info = model.get_item(i)
            if not app_info:
                continue
            gicon = app_info.get_icon()
            image = Gtk.Image.new_from_gicon(gicon)
            image.set_pixel_size(48)
            label = Gtk.Label(label=app_info.get_display_name())
            label.set_wrap(True)
            label.set_justify(Gtk.Justification.CENTER)
            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            box.append(image)
            box.append(label)
            box.set_margin_start(6)
            box.set_margin_end(6)
            box.set_margin_top(6)
            box.set_margin_bottom(6)
            box.set_halign(Gtk.Align.CENTER)
            box.set_valign(Gtk.Align.CENTER)
            box.set_data("app_info", app_info)
            gesture = Gtk.GestureClick.new()
            gesture.set_button(1)
            gesture.connect("pressed", self.on_icon_pressed)
            box.add_controller(gesture)
            flow_box.append(box)

    def load_apps(self):
        store = Gio.ListStore(item_type=Gio.AppInfo)
        apps = Gio.AppInfo.get_all()
        for app_info in apps:
            if app_info.should_show():
                store.append(app_info)
        return store

    def on_logout(self, action, param):
        os.system("dm-tool switch-to-greeter")

    def on_shutdown(self, action, param):
        os.system("systemctl poweroff")

    def on_restart(self, action, param):
        os.system("systemctl reboot")

    def show_context_menu(self, x, y):
        menu = Gio.Menu()
        menu.append("Logout", "app.logout")
        menu.append("Shutdown", "app.shutdown")
        menu.append("Restart", "app.restart")
        popover = Gtk.PopoverMenu.new_from_model(menu)
        popover.set_parent(self.window)
        point = Gdk.Rectangle()
        point.x = int(x)
        point.y = int(y)
        point.width = 0
        point.height = 0
        popover.set_pointing_to(point)
        popover.popup()

    def on_desktop_click_pressed(self, gesture, n_press, x, y):
        if n_press != 1:
            return
        self.show_context_menu(x, y)

if __name__ == "__main__":
    app = BlueDesktop()
    exit_status = app.run(sys.argv)
    sys.exit(exit_status)
