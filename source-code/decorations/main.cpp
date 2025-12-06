// main.cpp

#include <glib.h>
#include <gio/gio.h>
#include <iostream>
#include <fstream>
#include <string>
#include <cstdlib> // for system()

// Placeholder for animations; assuming handled in WM
void apply_animations() {
    // To integrate Wayfire-like animations, this would require extending the WM/compositor.
    // For now, placeholder.
    std::cout << "Applying window animations (placeholder: configure in WM)" << std::endl;
    // Example: system("wayfire-config --set animation open 'fade'"); but since not using Wayfire.
}

void apply_gtk_theme(const std::string& theme_name, const std::string& icon_theme) {
    // Use GSettings for GNOME-like settings
    GSettings* settings = g_settings_new("org.gnome.desktop.interface");
    if (settings) {
        g_settings_set_string(settings, "gtk-theme", theme_name.c_str());
        g_settings_set_string(settings, "icon-theme", icon_theme.c_str());
        g_settings_apply(settings);
        g_settings_sync();
        g_object_unref(settings);
    } else {
        std::cerr << "Failed to create GSettings object." << std::endl;
    }

    // Also write to ~/.config/gtk-3.0/settings.ini for broader compatibility
    std::string home = std::getenv("HOME");
    std::string gtk3_dir = home + "/.config/gtk-3.0/";
    std::string gtk3_file = gtk3_dir + "settings.ini";
    system(("mkdir -p " + gtk3_dir).c_str());

    std::ofstream out(gtk3_file);
    if (out.is_open()) {
        out << "[Settings]\n";
        out << "gtk-theme-name = " << theme_name << "\n";
        out << "gtk-icon-theme-name = " << icon_theme << "\n";
        out << "gtk-application-prefer-dark-theme = true\n";
        out.close();
    } else {
        std::cerr << "Failed to write GTK3 settings.ini" << std::endl;
    }

    // For GTK4
    std::string gtk4_dir = home + "/.config/gtk-4.0/";
    std::string gtk4_file = gtk4_dir + "settings.ini";
    system(("mkdir -p " + gtk4_dir).c_str());

    std::ofstream out4(gtk4_file);
    if (out4.is_open()) {
        out4 << "[Settings]\n";
        out4 << "gtk-theme-name = " << theme_name << "\n";
        out4 << "gtk-icon-theme-name = " << icon_theme << "\n";
        out4 << "gtk-application-prefer-dark-theme = true\n";
        out4.close();
    } else {
        std::cerr << "Failed to write GTK4 settings.ini" << std::endl;
    }
}

void apply_qt_theme(const std::string& theme_name) {
    // For Qt, assuming using qt5ct or similar; set QT_STYLE_OVERRIDE
    // But to set properly, write to qt5ct.conf or use environment (but binary sets for session)
    // Here, placeholder: set via system or config
    std::string home = std::getenv("HOME");
    std::string qt_dir = home + "/.config/qt5ct/";
    std::string qt_file = qt_dir + "qt5ct.conf";
    system(("mkdir -p " + qt_dir).c_str());

    std::ofstream out(qt_file);
    if (out.is_open()) {
        out << "[Appearance]\n";
        out << "style = gtk2\n"; // To follow GTK theme
        out << "icon_theme = Papirus-Dark\n"; // Match icon theme
        out.close();
    } else {
        std::cerr << "Failed to write qt5ct.conf" << std::endl;
    }

    // For dark theme, set QT_QPA_PLATFORMTHEME=qt5ct in environment, but since binary, assume set in startup script.
    std::cout << "Set QT_QPA_PLATFORMTHEME=qt5ct in your session startup." << std::endl;
}

void apply_wm_theme(const std::string& wm_theme) {
    GSettings* wm_settings = g_settings_new("org.gnome.desktop.wm.preferences");
    if (wm_settings) {
        g_settings_set_string(wm_settings, "theme", wm_theme.c_str());
        g_settings_apply(wm_settings);
        g_settings_sync();
        g_object_unref(wm_settings);
    } else {
        std::cerr << "Failed to create WM GSettings object." << std::endl;
    }
}

int main() {
    // Default modern dark themes
    std::string gtk_theme = "Adwaita-dark";
    std::string icon_theme = "Papirus-Dark"; // Assume installed
    std::string qt_theme = "Adwaita-dark"; // But using gtk2 style
    std::string wm_theme = "Adwaita";

    apply_gtk_theme(gtk_theme, icon_theme);
    apply_qt_theme(qt_theme);
    apply_wm_theme(wm_theme);
    apply_animations();

    std::cout << "Themes applied: GTK=" << gtk_theme << ", Icons=" << icon_theme << ", Qt follows GTK, WM=" << wm_theme << std::endl;

    return 0;
}
