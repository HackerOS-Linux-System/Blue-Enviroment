fn main() {
    // Compile the C Backend
    // Note: This requires a C compiler (gcc/clang) installed.

    println!("cargo:rerun-if-changed=../backend/compositor.c");
    println!("cargo:rerun-if-changed=../backend/compositor.h");

    let mut build = cc::Build::new();
    build.file("../backend/compositor.c");
    build.include("../backend");

    // If we were using real wlroots, we would do this:
    // let libs = pkg_config::Config::new().probe("wlroots").unwrap();
    // for path in libs.include_paths { build.include(path); }

    build.compile("blue_backend");

    tauri_build::build()
}
