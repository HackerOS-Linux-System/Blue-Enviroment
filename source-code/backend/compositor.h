#ifndef BLUE_COMPOSITOR_H
#define BLUE_COMPOSITOR_H

#include <stdbool.h>
#include <stdint.h>

// Initialize the Wayland Compositor (Server)
int start_compositor(void);

// Logic to move a specific surface (window) to absolute screen coordinates
void move_surface(const char* app_id, int x, int y, int width, int height);

// Adjust output brightness (via Gamma or Hardware)
// value: 0.0 (black) to 1.0 (full brightness)
void set_output_brightness(float value);

// Check if a client is running
bool is_app_running(const char* app_id);

// Get number of connected monitors (Simulated or Real)
int get_monitor_count(void);

#endif
