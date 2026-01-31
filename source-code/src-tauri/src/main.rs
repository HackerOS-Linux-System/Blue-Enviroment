// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{Manager, State, Window};
use walkdir::WalkDir;
use regex::Regex;
use glob::glob;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::io::{Read, Write};
use sysinfo::System;
use std::ffi::{CString, c_float};

// --- FFI TO C BACKEND ---
#[link(name = "blue_backend", kind = "static")]
extern "C" {
    fn start_compositor() ->  libc::c_int;
    fn move_surface(app_id: *const libc::c_char, x: libc::c_int, y: libc::c_int, width: libc::c_int, height: libc::c_int);
    fn set_output_brightness(value: c_float);
}

// --- PTY STATE MANAGEMENT ---

struct PtyState {
    writers: Arc<Mutex<HashMap<String, Box<dyn Write + Send>>>>,
}

// --- COMPOSITOR COMMANDS ---

#[tauri::command]
fn init_compositor() {
    unsafe {
        std::thread::spawn(|| {
            start_compositor();
        });
    }
}

#[tauri::command]
fn update_surface_rect(app_id: String, x: i32, y: i32, width: i32, height: i32) {
    let c_app_id = CString::new(app_id).expect("CString::new failed");
    unsafe {
        move_surface(c_app_id.as_ptr(), x, y, width, height);
    }
}

#[tauri::command]
fn set_system_brightness(value: f32) {
    // Value is 0-100 from frontend, normalize to 0.0-1.0
    let normalized = value / 100.0;
    unsafe {
        set_output_brightness(normalized);
    }
}

// --- PTY COMMANDS ---

#[tauri::command]
fn spawn_pty(window: Window, id: String, state: State<'_, PtyState>) -> Result<(), String> {
    let pty_system = native_pty_system();
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "bash".to_string());

    let pair = pty_system.openpty(PtySize { rows: 24, cols: 80, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new(shell);
    cmd.cwd(dirs::home_dir().unwrap_or(PathBuf::from("/")));

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    state.writers.lock().unwrap().insert(id.clone(), writer);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let window_clone = window.clone();
    let id_clone = id.clone();

    std::thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        loop {
            match reader.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                    let _ = window_clone.emit(&format!("pty-data-{}", id_clone), data);
                }
                Ok(_) => break,
                       Err(_) => break,
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn write_to_pty(id: String, data: String, state: State<'_, PtyState>) {
    if let Some(writer) = state.writers.lock().unwrap().get_mut(&id) {
        let _ = write!(writer, "{}", data);
    }
}

#[tauri::command]
fn resize_pty(_id: String, _cols: u16, _rows: u16) {
    // Placeholder - prefixed with underscore to suppress unused warning
}

// --- DATA STRUCTS ---

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct AppEntry {
    id: String,
    name: String,
    comment: String,
    icon: String,
    exec: String,
    categories: Vec<String>,
}

#[derive(serde::Serialize, Clone)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: String,
}

#[derive(serde::Serialize, Clone)]
struct SystemStats {
    cpu_usage: f32,
    ram_usage: f32,
    total_ram: u64,
    cpu_brand: String,
    username: String,
    hostname: String,
    battery: f32,
    is_charging: bool,
    volume: i32,
    brightness: i32,
    wifi_ssid: String,
    kernel: String,
}

#[derive(serde::Serialize, Clone)]
struct ProcessEntry {
    pid: String,
    name: String,
    cpu: f32,
    memory: u64,
}

#[derive(serde::Serialize, Clone)]
struct WifiNetwork {
    ssid: String,
    signal: u8,
    secure: bool,
    in_use: bool,
}

#[derive(serde::Serialize, Clone)]
struct BluetoothDevice {
    name: String,
    mac: String,
    connected: bool,
}

#[derive(serde::Serialize, Clone)]
struct AudioOutput {
    id: String,
    description: String,
    active: bool,
}

// --- SYSTEM COMMANDS ---

#[tauri::command]
fn get_system_apps() -> Vec<AppEntry> {
    let mut apps = Vec::new();
    let paths = vec!["/usr/share/applications", "/usr/local/share/applications"];
    let name_re = Regex::new(r"Name=(.*)").unwrap();
    let exec_re = Regex::new(r"Exec=(.*)").unwrap();
    let icon_re = Regex::new(r"Icon=(.*)").unwrap();

    let home_apps = dirs::home_dir().unwrap_or(PathBuf::from("/")).join(".local/share/applications");
    let mut all_paths: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    if home_apps.exists() { all_paths.push(home_apps); }

    for path in all_paths {
        for entry in WalkDir::new(path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "desktop") {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let name = name_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let exec = exec_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let icon = icon_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let clean_exec = exec.split_whitespace().next().unwrap_or("").to_string();

                    if !name.is_empty() && !clean_exec.is_empty() {
                        apps.push(AppEntry {
                            id: entry.file_name().to_string_lossy().to_string(),
                                  name,
                                  comment: "".to_string(),
                                  icon,
                                  exec: clean_exec,
                                  categories: vec!["System".to_string()],
                        });
                    }
                }
            }
        }
    }
    apps
}

#[tauri::command]
fn launch_process(command: String) {
    std::thread::spawn(move || {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() { return; }

        let cmd = parts[0];
        let args = &parts[1..];

        let mut child = Command::new(cmd)
        .args(args)
        .env("GDK_BACKEND", "wayland")
        .env("QT_QPA_PLATFORM", "wayland")
        .env("SDL_VIDEODRIVER", "wayland")
        .env("CLUTTER_BACKEND", "wayland")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();

        match child {
            Ok(_) => println!("Launched embedded process: {}", command),
                       Err(e) => eprintln!("Failed to launch process {}: {}", command, e),
        }
    });
}

#[tauri::command]
fn list_files(path: String) -> Vec<FileEntry> {
    let target_path = if path == "HOME" { dirs::home_dir().unwrap_or(PathBuf::from("/")) } else { PathBuf::from(path) };
    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(target_path) {
        for entry in read_dir.flatten() {
            let metadata = entry.metadata().unwrap();
            let size = if metadata.is_dir() { "DIR".to_string() } else { format!("{:.1} MB", metadata.len() as f64 / 1024.0 / 1024.0) };
            entries.push(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                         path: entry.path().to_string_lossy().to_string(),
                         is_dir: metadata.is_dir(),
                         size,
            });
        }
    }
    entries
}

#[tauri::command]
fn get_system_stats() -> SystemStats {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let total_ram = sys.total_memory();
    let used_ram = sys.used_memory();
    let ram_usage = (used_ram as f32 / total_ram as f32) * 100.0;

    let cpu_brand = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or("Generic CPU".to_string());
    let username = whoami::username();
    let hostname = hostname::get().unwrap_or_default().to_string_lossy().to_string();
    let kernel = System::kernel_version().unwrap_or("Unknown".to_string());

    let volume_output = Command::new("sh").arg("-c").arg("amixer get Master | grep -o '[0-9]*%' | head -1").output();
    let volume = match volume_output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).replace("%", "").trim().parse().unwrap_or(50),
        Err(_) => 50,
    };

    let wifi_output = Command::new("nmcli").arg("-t").arg("-f").arg("active,ssid").arg("dev").arg("wifi").output();
    let wifi_ssid = match wifi_output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).lines().find(|l| l.starts_with("yes")).map(|l| l.replace("yes:", "")).unwrap_or("Disconnected".to_string()),
        Err(_) => "Unknown".to_string()
    };

    SystemStats {
        cpu_usage,
        ram_usage,
        total_ram,
        cpu_brand,
        username,
        hostname,
        battery: 80.0,
        is_charging: false,
        volume,
        brightness: 70,
        wifi_ssid,
        kernel,
    }
}

#[tauri::command]
fn get_processes() -> Vec<ProcessEntry> {
    let mut sys = System::new_all();
    sys.refresh_processes();
    let mut processes: Vec<ProcessEntry> = sys.processes().iter().map(|(pid, process)| ProcessEntry {
        pid: pid.to_string(),
                                                                      name: process.name().to_string(),
                                                                      cpu: process.cpu_usage(),
                                                                      memory: process.memory(),
    }).collect();
    processes.sort_by(|a, b| b.memory.cmp(&a.memory));
    processes.truncate(50);
    processes
}

#[tauri::command]
fn read_text_file(path: String) -> String {
    fs::read_to_string(path).unwrap_or_else(|e| format!("Error reading file: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn take_screenshot() {
    let home = dirs::home_dir().unwrap_or(PathBuf::from("/"));
    let pictures = home.join("Pictures");
    if !pictures.exists() { let _ = fs::create_dir(&pictures); }
    let filename = format!("screenshot-{}.png", chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let path = pictures.join(filename);
    let _ = Command::new("sh").arg("-c").arg(format!("scrot '{}' || gnome-screenshot -f '{}'", path.to_string_lossy(), path.to_string_lossy())).spawn();
}

#[tauri::command]
fn get_wallpapers() -> Vec<String> {
    let mut wallpapers = Vec::new();
    wallpapers.push("https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072".to_string());
    if let Ok(entries) = glob("/usr/share/wallpapers/*.{jpg,png,jpeg}") {
        for entry in entries.filter_map(Result::ok) {
            wallpapers.push(format!("file://{}", entry.to_string_lossy()));
        }
    }
    wallpapers
}

#[tauri::command]
fn load_distro_info() -> std::collections::HashMap<String, String> {
    let mut info = std::collections::HashMap::new();
    info.insert("Name".to_string(), "HackerOS".to_string());
    info.insert("Version".to_string(), "0.2.0-alpha".to_string());
    if let Ok(content) = fs::read_to_string("/etc/os-release") {
        for line in content.lines() {
            if let Some((key, value)) = line.split_once('=') {
                info.insert(key.to_string(), value.replace("\"", "").to_string());
            }
        }
    }
    info
}

#[tauri::command]
fn system_power(action: String) {
    let cmd = match action.as_str() {
        "shutdown" => "shutdown -h now",
        "reboot" => "reboot",
        "logout" => "pkill -u $(whoami)",
        "suspend" => "systemctl suspend",
        _ => return,
    };
    let _ = Command::new("sh").arg("-c").arg(cmd).spawn();
}

#[tauri::command]
fn save_config(config: String) {
    let home = dirs::home_dir().unwrap_or(PathBuf::from("/"));
    let _ = fs::create_dir_all(home.join(".config/blue-environment"));
    let _ = fs::write(home.join(".config/blue-environment/settings.json"), config);
}

#[tauri::command]
fn load_config() -> String {
    let home = dirs::home_dir().unwrap_or(PathBuf::from("/"));
    fs::read_to_string(home.join(".config/blue-environment/settings.json")).unwrap_or("{}".to_string())
}

#[tauri::command]
fn get_wifi_networks_real() -> Vec<WifiNetwork> {
    let output = Command::new("nmcli").arg("-t").arg("-f").arg("IN-USE,SSID,SIGNAL,SECURITY").arg("dev").arg("wifi").output();
    let mut networks = Vec::new();
    if let Ok(o) = output {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 3 && !parts[1].is_empty() {
                networks.push(WifiNetwork {
                    ssid: parts[1].to_string(),
                              signal: parts[2].parse().unwrap_or(0),
                              secure: parts.get(3).map(|s| !s.is_empty()).unwrap_or(false),
                              in_use: parts[0] == "*"
                });
            }
        }
    }
    networks.dedup_by(|a, b| a.ssid == b.ssid);
    networks
}

#[tauri::command]
fn connect_wifi_real(ssid: String, password: String) -> Result<String, String> {
    let output = Command::new("nmcli").arg("dev").arg("wifi").arg("connect").arg(&ssid).arg("password").arg(&password).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(String::from_utf8_lossy(&output.stdout).to_string()) } else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn get_bluetooth_devices_real() -> Vec<BluetoothDevice> {
    let output = Command::new("bluetoothctl").arg("devices").output();
    let mut devices = Vec::new();
    if let Ok(o) = output {
        for line in String::from_utf8_lossy(&o.stdout).lines() {
            if line.starts_with("Device") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    devices.push(BluetoothDevice {
                        name: parts[2..].join(" "),
                                 mac: parts[1].to_string(),
                                 connected: false // Simplifying for speed
                    });
                }
            }
        }
    }
    devices
}

#[tauri::command]
fn check_package_installed(package_id: String, source: String) -> bool {
    let cmd = match source.as_str() {
        "apt" => Command::new("dpkg").arg("-s").arg(&package_id).output(),
        "flatpak" => Command::new("sh").arg("-c").arg(format!("flatpak list --app | grep {}", package_id)).output(),
        "snap" => Command::new("snap").arg("list").arg(&package_id).output(),
        "brew" => Command::new("brew").arg("list").arg(&package_id).output(),
        _ => return false,
    };
    match cmd { Ok(o) => o.status.success(), Err(_) => false }
}

#[tauri::command]
fn manage_package(operation: String, package_id: String, source: String) -> Result<String, String> {
    let cmd_str = match (source.as_str(), operation.as_str()) {
        ("apt", "install") => format!("pkexec apt-get install -y {}", package_id),
        ("apt", "remove") => format!("pkexec apt-get remove -y {}", package_id),
        ("flatpak", "install") => format!("flatpak install -y flathub {}", package_id),
        ("flatpak", "remove") => format!("flatpak uninstall -y {}", package_id),
        _ => return Err("Unsupported".to_string()),
    };
    let output = Command::new("sh").arg("-c").arg(&cmd_str).output().map_err(|e| e.to_string())?;
    if output.status.success() { Ok(String::from_utf8_lossy(&output.stdout).to_string()) } else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

#[tauri::command]
fn get_audio_outputs() -> Vec<AudioOutput> {
    let output = Command::new("pactl").arg("list").arg("sinks").arg("short").output();
    let mut sinks = Vec::new();
    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[1].to_string();
                sinks.push(AudioOutput {
                    id: parts[0].to_string(),
                           description: name.replace("alsa_output.", "").replace(".analog-stereo", "").replace("_", " "),
                           active: false,
                });
            }
        }
    }
    if sinks.is_empty() {
        sinks.push(AudioOutput { id: "0".to_string(), description: "Default Output (Mock)".to_string(), active: true });
    }
    sinks
}

#[tauri::command]
fn set_audio_output(id: String) {
    let _ = Command::new("pactl").arg("set-default-sink").arg(id).spawn();
}

fn main() {
    tauri::Builder::default()
    .manage(PtyState { writers: Arc::new(Mutex::new(HashMap::new())) })
    .invoke_handler(tauri::generate_handler![
        get_system_apps, launch_process, list_files, get_system_stats, get_processes,
        read_text_file, write_text_file, take_screenshot, get_wallpapers, load_distro_info,
        system_power, save_config, load_config, get_wifi_networks_real, connect_wifi_real,
        get_bluetooth_devices_real, check_package_installed, manage_package,
        spawn_pty, write_to_pty, resize_pty, get_audio_outputs, set_audio_output,
        init_compositor, update_surface_rect, set_system_brightness // ADDED
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
