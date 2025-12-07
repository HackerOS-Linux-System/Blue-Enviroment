use std::cell::RefCell;
use std::rc::Rc;
use std::time::{Duration, Instant};
use adw::{prelude::*, StyleManager};
use gdk::Key;
use gio::prelude::*;
use glib::{MainContext, Propagation};
use gtk::prelude::*;
use gtk::{Align, ApplicationWindow, Box as GtkBox, Entry, EventControllerKey, FlowBox, GestureClick, Image, Label, Orientation, ScrolledWindow};

const APP_DIR: &str = "/usr/share/applications/";
const DOUBLE_PRESS_TIMEOUT: u64 = 500; // milliseconds

fn main() {
    let application = adw::Application::builder()
    .application_id("org.blueenvironment.launcher")
    .build();
    application.connect_startup(|_app| {
        let style_manager = StyleManager::default();
        style_manager.set_color_scheme(adw::ColorScheme::ForceDark); // Modern dark theme
    });
    application.connect_activate(build_ui);
    std::process::exit(application.run().into());
}

fn build_ui(app: &adw::Application) {
    let window = ApplicationWindow::builder()
    .application(app)
    .build();
    window.fullscreen();
    let main_box = GtkBox::new(Orientation::Vertical, 10);
    main_box.set_margin_top(20);
    main_box.set_margin_bottom(20);
    main_box.set_margin_start(20);
    main_box.set_margin_end(20);
    main_box.set_vexpand(true);
    main_box.set_hexpand(true);
    // Search entry
    let search_entry = Entry::builder()
    .placeholder_text("Search applications...")
    .hexpand(true)
    .build();
    // App grid
    let flow_box = FlowBox::new();
    flow_box.set_homogeneous(false);
    flow_box.set_halign(Align::Center);
    flow_box.set_valign(Align::Start);
    flow_box.set_column_spacing(12);
    flow_box.set_row_spacing(12);
    flow_box.set_min_children_per_line(6);
    flow_box.set_max_children_per_line(8);
    flow_box.set_selection_mode(gtk::SelectionMode::None);
    let scrolled_window = ScrolledWindow::builder()
    .vexpand(true)
    .child(&flow_box)
    .build();
    // Load apps
    let apps = load_apps();
    populate_apps(&flow_box, &apps);
    // Filter on search
    search_entry.connect_changed({
        let flow_box_weak = flow_box.downgrade();
        let apps = apps.clone();
        move |entry| {
            let Some(flow_box) = flow_box_weak.upgrade() else { return; };
            let text = entry.text().to_lowercase();
            while let Some(child) = flow_box.first_child() {
                flow_box.remove(&child);
            }
            let filtered = if text.is_empty() {
                apps.clone()
            } else {
                apps.iter().filter(|app| app.name().to_lowercase().contains(&text) || app.description().unwrap_or_default().to_lowercase().contains(&text)).cloned().collect()
            };
            populate_apps(&flow_box, &filtered);
        }
    });
    main_box.append(&search_entry);
    main_box.append(&scrolled_window);
    window.set_child(Some(&main_box));
    // Handle double Super key press to close
    let last_press: Rc<RefCell<Option<Instant>>> = Rc::new(RefCell::new(None));
    let controller = EventControllerKey::new();
    controller.connect_key_pressed({
        let window_weak = window.downgrade();
        let last_press_weak = Rc::downgrade(&last_press);
        move |_, key, _, _| {
            let Some(window) = window_weak.upgrade() else { return Propagation::Proceed; };
            let Some(last_press) = last_press_weak.upgrade() else { return Propagation::Proceed; };
            if key == Key::Super_L || key == Key::Super_R {
                let now = Instant::now();
                let mut last = last_press.borrow_mut();
                if let Some(prev) = *last {
                    if now.duration_since(prev) < Duration::from_millis(DOUBLE_PRESS_TIMEOUT) {
                        window.close();
                        return Propagation::Stop;
                    }
                }
                *last = Some(now);
                // Start a timeout to reset if no second press
                let last_clone = last_press.clone();
                MainContext::default().spawn_local(async move {
                    glib::timeout_future(Duration::from_millis(DOUBLE_PRESS_TIMEOUT)).await;
                    *last_clone.borrow_mut() = None;
                });
                return Propagation::Stop;
            }
            Propagation::Proceed
        }
    });
    window.add_controller(controller);
    window.present();
}

#[derive(Clone)]
struct AppEntry {
    app_info: gio::DesktopAppInfo,
}

impl AppEntry {
    fn name(&self) -> String {
        self.app_info.name().to_string()
    }
    fn description(&self) -> Option<String> {
        self.app_info.description().map(|s| s.to_string())
    }
    fn icon(&self) -> Option<gio::Icon> {
        self.app_info.icon()
    }
}

fn load_apps() -> Vec<AppEntry> {
    let mut apps = Vec::new();
    if let Ok(dir) = std::fs::read_dir(APP_DIR) {
        for entry in dir {
            if let Ok(entry) = entry {
                if entry.path().extension().and_then(|s| s.to_str()) == Some("desktop") {
                    if let Some(app_info) = gio::DesktopAppInfo::from_filename(entry.path()) {
                        if app_info.should_show() {
                            apps.push(AppEntry { app_info });
                        }
                    }
                }
            }
        }
    }
    apps.sort_by(|a, b| a.name().cmp(&b.name()));
    apps
}

fn populate_apps(flow_box: &FlowBox, apps: &[AppEntry]) {
    for app in apps {
        let box_ = GtkBox::new(Orientation::Vertical, 6);
        box_.set_halign(Align::Center);
        box_.set_valign(Align::Center);
        box_.set_tooltip_text(Some(&app.name()));
        let icon = if let Some(gicon) = app.icon() {
            Image::builder()
            .gicon(&gicon)
            .pixel_size(48)
            .build()
        } else {
            let img = Image::from_icon_name("application-x-executable");
            img.set_pixel_size(48);
            img
        };
        let label = Label::new(Some(&app.name()));
        label.set_wrap(true);
        label.set_max_width_chars(12);
        label.set_ellipsize(gtk::pango::EllipsizeMode::End);
        box_.append(&icon);
        box_.append(&label);
        let app_clone = app.clone();
        let gesture = GestureClick::new();
        gesture.connect_pressed({
            let app_clone = app_clone.clone();
            move |_, _n_press, _x, _y| {
                if let Err(err) = app_clone.app_info.launch(&[], None::<&gio::AppLaunchContext>) {
                    eprintln!("Failed to launch app: {}", err);
                }
            }
        });
        box_.add_controller(gesture);
        flow_box.insert(&box_, -1);
    }
}
