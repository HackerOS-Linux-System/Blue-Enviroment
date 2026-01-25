import { DesktopEntry, UserConfig } from '../types';

// This simulates the Tauri Invoke calls.
// In the built AppImage, these would call the Rust backend.

const DEFAULT_WALLPAPER = '/usr/share/wallpapers/default_wallpaper.png';
const USER_CONFIG_PATH = '.config/blue-environment/settings.json';

// Mock data for browser preview, replaced by Rust backend in production
const MOCK_LINUX_APPS: DesktopEntry[] = [
    { id: 'hacker-term', name: 'Hacker Term', comment: 'Advanced Terminal', icon: 'terminal', exec: 'hacker-term', categories: ['System'] },
{ id: 'firefox', name: 'Firefox', comment: 'Web Browser', icon: 'firefox', exec: 'firefox', categories: ['Network'] },
{ id: 'vlc', name: 'VLC Media Player', comment: 'Play media', icon: 'vlc', exec: 'vlc', categories: ['AudioVideo'] },
{ id: 'gimp', name: 'GIMP', comment: 'Image Editor', icon: 'gimp', exec: 'gimp', categories: ['Graphics'] },
];

export const SystemBridge = {
    // Get all .desktop files from /usr/share/applications
    getAllApps: async (): Promise<DesktopEntry[]> => {
        // In Tauri: return await invoke('get_system_apps');
        // Using mock for web preview
        return MOCK_LINUX_APPS;
    },

    launchApp: async (exec: string) => {
        console.log(`[System] Launching process: ${exec}`);
        // In Tauri: await invoke('launch_process', { command: exec });
    },

    getSystemStats: async () => {
        // In Tauri: await invoke('get_system_stats');
        return {
            cpu: 12,
            ram: 40,
            battery: 85,
            isCharging: false,
            wifiSSID: 'BlueNet 5G',
            volume: 60,
            brightness: 80
        };
    },

    saveConfig: async (config: UserConfig) => {
        console.log(`[System] Saving config to ${USER_CONFIG_PATH}`, config);
        localStorage.setItem('blue_user_config', JSON.stringify(config));
        // In Tauri: await invoke('save_config', { config });
    },

    loadConfig: async (): Promise<UserConfig> => {
        // In Tauri: await invoke('load_config');
        const saved = localStorage.getItem('blue_user_config');
        if (saved) return JSON.parse(saved);
        return {
            wallpaper: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop", // Fallback for web
            theme: 'dark',
            accentColor: 'blue',
            displayScale: 1
        };
    },

    setBrightness: async (level: number) => {
        // In Tauri: await invoke('set_screen_brightness', { level });
        console.log(`[Hardware] Brightness set to ${level}%`);
    },

    setVolume: async (level: number) => {
        // In Tauri: await invoke('set_system_volume', { level });
        console.log(`[Hardware] Volume set to ${level}%`);
    },

    toggleWifi: async (enabled: boolean) => {
        // In Tauri: await invoke('toggle_wifi', { enabled });
        console.log(`[Hardware] WiFi ${enabled ? 'Enabled' : 'Disabled'}`);
    },

    shutdown: async () => {
        // In Tauri: await invoke('system_shutdown');
        console.log('System Shutdown Initiated');
    }
};
