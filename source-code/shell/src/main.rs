// src/main.rs

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use adw::{prelude::*, StyleManager};
use chrono::Local;
use gio::prelude::*;
use glib::{clone, timeout_add_local, ControlFlow};
use gtk::glib;
use gtk::prelude::*;
use gtk::{Align, Box, Button, Label, Orientation, Window};
use gtk_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};

use battery::Manager as BatteryManager;
use network_manager::{DeviceType, NetworkManager};
use libpulse_binding::context::{Context, FlagSet};
use libpulse_binding::mainloop::standard::Mainloop;
use libpulse_binding::proplist::Proplist;

// Placeholder for tray
// use statusnotifier::StatusNotifierWatcher;

fn main() -> glib::ExitCode {
    let application = adw::Application::builder()
        .application_id("org.blueenvironment.shell")
        .build();

    application.connect_startup(|app| {
        let style_manager = StyleManager::default();
        style_manager.set_color_scheme(adw::ColorScheme::ForceDark); // Modern dark theme
    });

    application.connect_activate(build_ui);

    application.run()
}

fn build_ui(app: &adw::Application) {
    let window = Window::new();
    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.auto_exclusive_zone_enable();
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);
    window.set_anchor(Edge::Top, true);
    window.set_namespace("blue-shell");
    window.set_keyboard_mode(KeyboardMode::None);

    let main_box = Box::new(Orientation::Horizontal, 0);
    main_box.set_hexpand(true);
    main_box.set_vexpand(false);
    main_box.set_valign(Align::Start);
    main_box.set_css_classes(&["panel"]);

    // Left side: App menu, task list
    let left_box = Box::new(Orientation::Horizontal, 10);
    left_box.set_halign(Align::Start);
    left_box.set_hexpand(true);

    let app_menu_button = Button::builder()
        .label("Apps")
        .css_classes(vec!["flat".to_string()])
        .build();
    // Connect to open launcher when clicked
    app_menu_button.connect_clicked(|_| {
        // Spawn launcher
    });

    let tasks_label = Label::new(Some("Running Apps: Placeholder"));
    // Update with list of running windows/apps

    left_box.append(&app_menu_button);
    left_box.append(&tasks_label);

    // Right side: System icons, clock
    let right_box = Box::new(Orientation::Horizontal, 10);
    right_box.set_halign(Align::End);

    // WiFi icon
    let wifi_label = Label::new(Some("WiFi: ?"));
    update_wifi_status(&wifi_label);

    // Battery icon
    let battery_label = Label::new(Some("Battery: ?%"));
    update_battery_status(&battery_label);

    // Audio icon
    let audio_label = Label::new(Some("Vol: ?%"));
    update_audio_status(&audio_label);

    // Tray placeholder
    let tray_box = Box::new(Orientation::Horizontal, 5);
    // Initialize tray here
    // let watcher = StatusNotifierWatcher::new(...);

    // Clock
    let clock_label = Label::new(Some(&format_time()));
    timeout_add_local(Duration::from_secs(1), clone!(@weak clock_label => @default-return ControlFlow::Break, move || {
        clock_label.set_label(&format_time());
        ControlFlow::Continue
    }));

    right_box.append(&wifi_label);
    right_box.append(&battery_label);
    right_box.append(&audio_label);
    right_box.append(&tray_box);
    right_box.append(&clock_label);

    main_box.append(&left_box);
    main_box.append(&right_box);

    window.set_child(Some(&main_box));
    window.set_application(Some(app));

    window.present();

    // Periodic updates
    timeout_add_local(Duration::from_secs(10), clone!(@weak wifi_label, @weak battery_label, @weak audio_label => @default-return ControlFlow::Break, move || {
        update_wifi_status(&wifi_label);
        update_battery_status(&battery_label);
        update_audio_status(&audio_label);
        ControlFlow::Continue
    }));
}

fn format_time() -> String {
    Local::now().format("%H:%M:%S").to_string()
}

fn update_wifi_status(label: &Label) {
    // Use network_manager
    let nm = NetworkManager::new().unwrap();
    let devices = nm.get_devices().unwrap();
    let mut status = "Disconnected".to_string();
    for device in devices {
        if device.device_type() == DeviceType::Wifi {
            if device.is_connected() {
                status = "Connected".to_string();
                break;
            }
        }
    }
    label.set_label(&format!("WiFi: {}", status));
}

fn update_battery_status(label: &Label) {
    // Use battery crate
    let manager = BatteryManager::new().unwrap();
    let batteries = manager.batteries().unwrap();
    let mut percentage = 0.0;
    for bat in batteries {
        if let Ok(b) = bat {
            percentage = b.state_of_charge().get::<battery::units::ratio::percent>();
            break;
        }
    }
    label.set_label(&format!("Battery: {:.0}%", percentage));
}

fn update_audio_status(label: &Label) {
    // Use pulseaudio
    let mut proplist = Proplist::new().unwrap();
    proplist.set_str(libpulse_binding::proplist::properties::APPLICATION_NAME, "Blue Shell").unwrap();

    let mainloop = Rc::new(RefCell::new(Mainloop::new().unwrap()));
    let context = Rc::new(RefCell::new(Context::new_with_proplist(
        &*mainloop.borrow(),
        "BlueShellContext",
        &proplist,
    ).unwrap()));

    context.borrow_mut().connect(None, FlagSet::NOFLAGS, None).unwrap();

    let mut volume = 0;
    // This is synchronous for simplicity; in real, use callbacks
    // Wait for connection
    loop {
        mainloop.borrow_mut().iterate(true);
        if context.borrow().get_state() == libpulse_binding::context::State::Ready {
            break;
        }
    }

    // Get sink info
    let op = context.borrow_mut().introspect().get_sink_info_by_index(0, move |result| {
        if let libpulse_binding::callbacks::ListResult::Item(info) = result {
            if let Some(vol) = info.volume.avg().0 {
                volume = (vol as f32 / libpulse_binding::volume::Volume::NORMAL.0 as f32 * 100.0) as u32;
            }
        }
    });
    while op.get_state() == libpulse_binding::operation::State::Running {
        mainloop.borrow_mut().iterate(true);
    }

    label.set_label(&format!("Vol: {}%", volume));
}

// Add CSS for styling
// In build_ui, load CSS
// let provider = gtk::CssProvider::new();
// provider.load_from_data(b".panel { background-color: #1e1e1e; color: #dddddd; }"); // Dark theme
// gtk::style_context_add_provider_for_display(&gtk::gdk::Display::default().unwrap(), &provider, gtk::STYLE_PROVIDER_PRIORITY_APPLICATION);

// For icons, use gtk::Image instead of labels, with icon names like "network-wireless-symbolic", "battery-full-symbolic", "audio-volume-high-symbolic"

// For list of running apps, perhaps use dbus to get active windows or something.

// For tray, implement status notifier protocol.

/// Note: This is a basic skeleton. Full implementation would require handling tray properly, updating task list by monitoring wayland surfaces or using kde's task manager protocol, etc.
/// Also, handle quick menu on cursor to bottom, but that's separate.
/// For win key, that's in WM.
