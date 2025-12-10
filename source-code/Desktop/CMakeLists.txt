cmake_minimum_required(VERSION 3.10)
project(BlueDesktop)

find_package(PkgConfig REQUIRED)

pkg_check_modules(GTK4 REQUIRED gtk4)
pkg_check_modules(GIO REQUIRED gio-2.0)
pkg_check_modules(LAYERSHELL REQUIRED gtk-layer-shell-0)

add_executable(blue-desktop main.cpp)

target_include_directories(blue-desktop PRIVATE
    ${GTK4_INCLUDE_DIRS}
    ${GIO_INCLUDE_DIRS}
    ${LAYERSHELL_INCLUDE_DIRS}
)

target_link_libraries(blue-desktop PRIVATE
    ${GTK4_LIBRARIES}
    ${GIO_LIBRARIES}
    ${LAYERSHELL_LIBRARIES}
)

target_compile_features(blue-desktop PRIVATE cxx_std_11)
