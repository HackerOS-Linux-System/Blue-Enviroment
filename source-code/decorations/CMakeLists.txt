cmake_minimum_required(VERSION 3.10)

project(BlueDecorations)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)

find_package(PkgConfig REQUIRED)
pkg_check_modules(GLIB REQUIRED glib-2.0 gio-2.0)

add_executable(decorations main.cpp)

target_include_directories(decorations PRIVATE ${GLIB_INCLUDE_DIRS})
target_link_libraries(decorations PRIVATE ${GLIB_LIBRARIES})
