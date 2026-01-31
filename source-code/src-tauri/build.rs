use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-changed=../backend/compositor.c");
    println!("cargo:rerun-if-changed=../backend/compositor.h");

    let mut build = cc::Build::new();

    // Enable Unstable wlroots features
    build.define("WLR_USE_UNSTABLE", "1");
    build.define("BLUE_TTY", "1");

    build.file("../backend/compositor.c");
    build.include("../backend");

    // Generate Wayland Protocol Headers
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    build.include(&out_dir);

    // 1. XDG Shell Protocol
    let xdg_paths = vec![
        "/usr/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml",
        "/usr/local/share/wayland-protocols/stable/xdg-shell/xdg-shell.xml",
        "/usr/share/wayland/protocols/stable/xdg-shell/xdg-shell.xml"
    ];
    generate_protocol("xdg-shell", &xdg_paths, &out_dir);

    // Link system libraries
    // Prioritize wlroots-0.18
    let libs = vec!["wlroots-0.18", "wlroots", "wayland-server", "xkbcommon", "libinput", "pixman-1"];

    for lib in libs {
        match pkg_config::Config::new().probe(lib) {
            Ok(library) => {
                for path in library.include_paths {
                    build.include(path);
                }
            },
            Err(_) => {
                // Be silent on failure, try next
            }
        }
    }

    build.compile("blue_backend");

    tauri_build::build()
}

fn generate_protocol(name: &str, paths: &[&str], out_dir: &PathBuf) {
    let mut found = false;
    for xml_path in paths {
        let src_path = std::path::Path::new(xml_path);
        if src_path.exists() {
            let header_path = out_dir.join(format!("{}-protocol.h", name));
            let status = Command::new("wayland-scanner")
            .arg("server-header")
            .arg(src_path)
            .arg(&header_path)
            .status();

            match status {
                Ok(s) if s.success() => {
                    println!("cargo:warning=Generated header for {}", name);
                    found = true;
                    break;
                },
                _ => println!("cargo:warning=Failed to run wayland-scanner on {}", xml_path),
            }
        }
    }
    if !found {
        println!("cargo:warning=Could not find XML for protocol: {}", name);
    }
}
