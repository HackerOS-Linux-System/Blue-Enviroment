import os
import sys
import subprocess
from gi.repository import Gio

# Placeholder for animations; assuming handled in WM
def apply_animations():
    # To integrate Wayfire-like animations, this would require extending the WM/compositor.
    # For now, placeholder.
    print("Applying window animations (placeholder: configure in WM)")
    # Example: subprocess.call(["wayfire-config", "--set", "animation", "open", "'fade'"]); but since not using Wayfire.

def apply_gtk_theme(theme_name, icon_theme):
    # Use GSettings for GNOME-like settings
    settings = Gio.Settings.new("org.gnome.desktop.interface")
    if settings:
        settings.set_string("gtk-theme", theme_name)
        settings.set_string("icon-theme", icon_theme)
        settings.apply()
        Gio.Settings.sync()
    else:
        print("Failed to create GSettings object.", file=sys.stderr)

    # Also write to ~/.config/gtk-3.0/settings.ini for broader compatibility
    home = os.environ['HOME']
    gtk3_dir = os.path.join(home, ".config", "gtk-3.0")
    gtk3_file = os.path.join(gtk3_dir, "settings.ini")
    os.makedirs(gtk3_dir, exist_ok=True)
    try:
        with open(gtk3_file, 'w') as out:
            out.write("[Settings]\n")
            out.write(f"gtk-theme-name = {theme_name}\n")
            out.write(f"gtk-icon-theme-name = {icon_theme}\n")
            out.write("gtk-application-prefer-dark-theme = true\n")
    except IOError:
        print("Failed to write GTK3 settings.ini", file=sys.stderr)

    # For GTK4
    gtk4_dir = os.path.join(home, ".config", "gtk-4.0")
    gtk4_file = os.path.join(gtk4_dir, "settings.ini")
    os.makedirs(gtk4_dir, exist_ok=True)
    try:
        with open(gtk4_file, 'w') as out:
            out.write("[Settings]\n")
            out.write(f"gtk-theme-name = {theme_name}\n")
            out.write(f"gtk-icon-theme-name = {icon_theme}\n")
            out.write("gtk-application-prefer-dark-theme = true\n")
    except IOError:
        print("Failed to write GTK4 settings.ini", file=sys.stderr)

def apply_qt_theme(theme_name):
    # For Qt, assuming using qt5ct or similar; set QT_STYLE_OVERRIDE
    # But to set properly, write to qt5ct.conf or use environment (but binary sets for session)
    # Here, placeholder: set via system or config
    home = os.environ['HOME']
    qt_dir = os.path.join(home, ".config", "qt5ct")
    qt_file = os.path.join(qt_dir, "qt5ct.conf")
    os.makedirs(qt_dir, exist_ok=True)
    try:
        with open(qt_file, 'w') as out:
            out.write("[Appearance]\n")
            out.write("style = gtk2\n")  # To follow GTK theme
            out.write("icon_theme = Papirus-Dark\n")  # Match icon theme
    except IOError:
        print("Failed to write qt5ct.conf", file=sys.stderr)

    # For dark theme, set QT_QPA_PLATFORMTHEME=qt5ct in environment, but since binary, assume set in startup script.
    print("Set QT_QPA_PLATFORMTHEME=qt5ct in your session startup.")

def apply_wm_theme(wm_theme):
    wm_settings = Gio.Settings.new("org.gnome.desktop.wm.preferences")
    if wm_settings:
        wm_settings.set_string("theme", wm_theme)
        wm_settings.apply()
        Gio.Settings.sync()
    else:
        print("Failed to create WM GSettings object.", file=sys.stderr)

if __name__ == "__main__":
    # Default modern dark themes
    gtk_theme = "Adwaita-dark"
    icon_theme = "Papirus-Dark"  # Assume installed
    qt_theme = "Adwaita-dark"  # But using gtk2 style
    wm_theme = "Adwaita"

    apply_gtk_theme(gtk_theme, icon_theme)
    apply_qt_theme(qt_theme)
    apply_wm_theme(wm_theme)
    apply_animations()

    print(f"Themes applied: GTK={gtk_theme}, Icons={icon_theme}, Qt follows GTK, WM={wm_theme}")
