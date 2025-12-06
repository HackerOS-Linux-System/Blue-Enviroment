cmake_minimum_required(VERSION 3.1)

project(BlueWM)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt5 COMPONENTS Core Gui WaylandCompositor REQUIRED)

add_executable(blue-wm main.cpp compositor.cpp compositor.h window.cpp window.h)

target_link_libraries(blue-wm Qt5::Core Qt5::Gui Qt5::WaylandCompositor)
