// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;
use walkdir::WalkDir;
use regex::Regex;
use glob::glob;

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
    cpu: f32,
    ram: f32,
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

// --- COMMANDS ---

#[tauri::command]
fn get_system_apps() -> Vec<AppEntry> {
    let mut apps = Vec::new();
    let paths = vec!["/usr/share/applications", "/usr/local/share/applications"];
    let name_re = Regex::new(r"Name=(.*)").unwrap();
    let exec_re = Regex::new(r"Exec=(.*)").unwrap();
    let icon_re = Regex::new(r"Icon=(.*)").unwrap();
    let comment_re = Regex::new(r"Comment=(.*)").unwrap();

    let home_apps = dirs::home_dir().unwrap_or(PathBuf::from("/")).join(".local/share/applications");
    let mut all_paths: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    if home_apps.exists() {
        all_paths.push(home_apps);
    }

    for path in all_paths {
        for entry in WalkDir::new(path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
            if entry.path().extension().map_or(false, |ext| ext == "desktop") {
                if let Ok(content) = fs::read_to_string(entry.path()) {
                    let name = name_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let exec = exec_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let icon = icon_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let comment = comment_re.captures(&content).map_or("", |c| c.get(1).unwrap().as_str()).to_string();
                    let clean_exec = exec.split_whitespace().next().unwrap_or("").to_string();

                    if !name.is_empty() && !clean_exec.is_empty() {
                        apps.push(AppEntry {
                            id: entry.file_name().to_string_lossy().to_string(),
                                  name,
                                  comment,
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
        Command::new("sh")
        .arg("-c")
        .arg(format!("{} &", command))
        .spawn()
        .expect("failed to execute process");
    });
}

#[tauri::command]
fn list_files(path: String) -> Vec<FileEntry> {
    let target_path = if path == "HOME" {
        dirs::home_dir().unwrap_or(PathBuf::from("/"))
    } else {
        PathBuf::from(path)
    };

    let mut entries = Vec::new();
    if let Ok(read_dir) = fs::read_dir(target_path) {
        for entry in read_dir.flatten() {
            let metadata = entry.metadata().unwrap();
            let size = if metadata.is_dir() {
                "DIR".to_string()
            } else {
                format!("{:.1} MB", metadata.len() as f64 / 1024.0 / 1024.0)
            };

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
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();

    let volume_output = Command::new("sh").arg("-c").arg("amixer get Master | grep -o '[0-9]*%' | head -1").output();
    let volume = match volume_output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).replace("%", "").trim().parse().unwrap_or(50),
        Err(_) => 50,
    };

    let wifi_output = Command::new("nmcli").arg("-t").arg("-f").arg("active,ssid").arg("dev").arg("wifi").output();
    let wifi_ssid = match wifi_output {
        Ok(o) => {
            let out = String::from_utf8_lossy(&o.stdout);
            out.lines().find(|l| l.starts_with("yes")).map(|l| l.replace("yes:", "")).unwrap_or("Disconnected".to_string())
        },
        Err(_) => "Unknown".to_string()
    };

    let kernel_output = Command::new("uname").arg("-r").output();
    let kernel = match kernel_output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => "Unknown".to_string()
    };

    SystemStats {
        cpu: sys.global_cpu_info().cpu_usage(),
        ram: (sys.used_memory() as f32 / sys.total_memory() as f32) * 100.0,
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
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_processes();

    let mut processes = Vec::new();
    for (pid, process) in sys.processes() {
        processes.push(ProcessEntry {
            pid: pid.to_string(),
                       name: process.name().to_string(),
                       cpu: process.cpu_usage(),
                       memory: process.memory(),
        });
    }
    // Sort by memory usage descending
    processes.sort_by(|a, b| b.memory.cmp(&a.memory));
    processes.truncate(50); // Return top 50
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

    // Try using gnome-screenshot or scrot or spectacle
    // For HackerOS assuming standard linux tools
    let _ = Command::new("sh")
    .arg("-c")
    .arg(format!("scrot '{}' || gnome-screenshot -f '{}' || spectacle -b -o '{}'", path.to_string_lossy(), path.to_string_lossy(), path.to_string_lossy()))
    .spawn();
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
    info.insert("Copyright".to_string(), "© 2026 HackerOS Team".to_string());
    let path = PathBuf::from("/etc/xdg/kcm-about-distrorc");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            for line in content.lines() {
                if let Some((key, value)) = line.split_once('=') {
                    info.insert(key.trim().to_string(), value.trim().to_string());
                }
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
        "hibernate" => "systemctl hibernate",
        _ => return,
    };
    let _ = Command::new("sh").arg("-c").arg(cmd).spawn();
}

#[tauri::command]
fn save_config(config: String) {
    let home = dirs::home_dir().unwrap_or(PathBuf::from("/"));
    let config_dir = home.join(".config/blue-environment");
    if !config_dir.exists() { let _ = fs::create_dir_all(&config_dir); }
    let _ = fs::write(config_dir.join("settings.json"), config);
}

#[tauri::command]
fn load_config() -> String {
    let home = dirs::home_dir().unwrap_or(PathBuf::from("/"));
    let path = home.join(".config/blue-environment/settings.json");
    if path.exists() {
        fs::read_to_string(path).unwrap_or("{}".to_string())
    } else {
        "{}".to_string()
    }
}

// --- NEW NETWORK COMMANDS ---

#[tauri::command]
fn get_wifi_networks_real() -> Vec<WifiNetwork> {
    // nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY dev wifi
    let output = Command::new("nmcli")
    .arg("-t")
    .arg("-f")
    .arg("IN-USE,SSID,SIGNAL,SECURITY")
    .arg("dev")
    .arg("wifi")
    .output();

    let mut networks = Vec::new();

    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        for line in stdout.lines() {
            // Output format: *:HomeWifi:90:WPA2
            // Split by : but handle escapes if any (nmcli escapes colon with backslash)
            // Simplified split:
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 3 {
                let in_use = parts[0] == "*";
                let ssid = parts[1].to_string();
                let signal = parts[2].parse::<u8>().unwrap_or(0);
                let secure = parts.get(3).map(|s| !s.is_empty()).unwrap_or(false);

                if !ssid.is_empty() {
                    networks.push(WifiNetwork { ssid, signal, secure, in_use });
                }
            }
        }
    }
    // De-duplicate by SSID, preferring the active one
    networks.dedup_by(|a, b| a.ssid == b.ssid);
    networks
}

#[tauri::command]
fn connect_wifi_real(ssid: String, password: String) -> Result<String, String> {
    let output = Command::new("nmcli")
    .arg("dev")
    .arg("wifi")
    .arg("connect")
    .arg(&ssid)
    .arg("password")
    .arg(&password)
    .output()
    .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn get_bluetooth_devices_real() -> Vec<BluetoothDevice> {
    // bluetoothctl devices
    // Output: Device XX:XX:XX:XX:XX:XX Name
    let output = Command::new("bluetoothctl")
    .arg("devices")
    .output();

    let mut devices = Vec::new();

    if let Ok(o) = output {
        let stdout = String::from_utf8_lossy(&o.stdout);
        for line in stdout.lines() {
            if line.starts_with("Device") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 {
                    let mac = parts[1].to_string();
                    let name = parts[2..].join(" ");

                    // Check if connected
                    let info_out = Command::new("bluetoothctl").arg("info").arg(&mac).output();
                    let connected = if let Ok(io) = info_out {
                        String::from_utf8_lossy(&io.stdout).contains("Connected: yes")
                    } else {
                        false
                    };

                    devices.push(BluetoothDevice { name, mac, connected });
                }
            }
        }
    }
    devices
}


fn main() {
    tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        get_system_apps,
        launch_process,
        list_files,
        get_system_stats,
        get_processes,
        read_text_file,
        write_text_file,
        take_screenshot,
        get_wallpapers,
        load_distro_info,
        system_power,
        save_config,
        load_config,
        get_wifi_networks_real,
        connect_wifi_real,
        get_bluetooth_devices_real
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
