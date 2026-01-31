// ... existing imports ...
import { DesktopEntry, UserConfig, CustomTheme, SoftwarePackage, WifiNetwork, BluetoothDevice, AppId } from '../types';

// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// @ts-ignore
const invoke = isTauri ? window.__TAURI__.invoke : async (cmd: string) => { console.log(`Mock invoke: ${cmd}`); return null; };

export interface SystemStats {
    cpu_usage: number;
    ram_usage: number;
    total_ram: number;
    cpu_brand: string;
    username: string;
    hostname: string;
    battery: number;
    is_charging: boolean;
    volume: number;
    brightness: number;
    wifi_ssid: string;
    kernel: string;
}

export interface AudioOutput {
    id: string;
    description: string;
    active: boolean;
}

let mockSystemState = {
    volume: 65,
    brightness: 80,
    battery: 74,
    isCharging: false
};

// ... mock data ...
let catalogPackages: SoftwarePackage[] = [
    { id: 'firefox', packageId: 'firefox', source: 'apt', name: 'Firefox', description: 'Fast, private and ethical web browser.', version: 'Latest', category: 'Productivity', installed: false, size: '85 MB', author: 'Mozilla' },
{ id: 'vscode', packageId: 'code', source: 'snap', name: 'Visual Studio Code', description: 'Code editing. Redefined.', version: 'Latest', category: 'Development', installed: false, size: '120 MB', author: 'Microsoft' },
{ id: 'vlc', packageId: 'vlc', source: 'apt', name: 'VLC Media Player', description: 'The ultimate media player.', version: '3.0+', category: 'Multimedia', installed: false, size: '45 MB', author: 'VideoLAN' },
{ id: 'gimp', packageId: 'org.gimp.GIMP', source: 'flatpak', name: 'GIMP', description: 'GNU Image Manipulation Program.', version: '2.10', category: 'Multimedia', installed: false, size: '250 MB', author: 'GIMP Team' },
];

export const SystemBridge = {
    getAllApps: async (): Promise<DesktopEntry[]> => {
        if (isTauri) return await invoke('get_system_apps');
        return [];
    },

    launchApp: async (exec: string) => {
        if (isTauri) await invoke('launch_process', { command: exec });
    },

    getFiles: async (path: string) => {
        if (isTauri) return await invoke('list_files', { path });
        return [];
    },

    getSystemStats: async (): Promise<SystemStats> => {
        if (isTauri) return await invoke('get_system_stats');
        return {
            cpu_usage: 12.5,
            ram_usage: 45,
            total_ram: 16 * 1024 * 1024 * 1024,
            cpu_brand: "Mock Ryzen 9",
            username: "Mock User",
            hostname: "blue-os-dev",
            battery: mockSystemState.battery,
            is_charging: mockSystemState.isCharging,
            wifi_ssid: 'Home Wifi',
            volume: 50,
            brightness: 70,
            kernel: 'Linux 6.5 Mock'
        };
    },

    getProcesses: async () => {
        if (isTauri) return await invoke('get_processes');
        return [];
    },

    readFile: async (path: string) => {
        if (isTauri) return await invoke('read_text_file', { path });
        return "Mock file content...";
    },

    writeFile: async (path: string, content: string) => {
        if (isTauri) await invoke('write_text_file', { path, content });
    },

    takeScreenshot: async () => {
        if (isTauri) await invoke('take_screenshot');
    },

    getWallpapers: async (): Promise<string[]> => {
        if (isTauri) return await invoke('get_wallpapers');
        return ["https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072"];
    },

    getDistroInfo: async () => {
        if (isTauri) return await invoke('load_distro_info');
        return { Name: "HackerOS", Version: "0.2.0-alpha", Copyright: "© 2026 HackerOS Team" };
    },

    powerAction: async (action: string) => {
        if (isTauri) await invoke('system_power', { action });
    },

    saveConfig: async (config: UserConfig) => {
        if (isTauri) await invoke('save_config', { config: JSON.stringify(config) });
        localStorage.setItem('blue_user_config', JSON.stringify(config));
    },

    loadConfig: async (): Promise<UserConfig> => {
        let loaded = null;
        if (isTauri) {
            const raw = await invoke('load_config');
            if (raw && raw !== "{}") loaded = JSON.parse(raw);
        }
        if (!loaded) {
            const local = localStorage.getItem('blue_user_config');
            if (local) loaded = JSON.parse(local);
        }
        return loaded || {
            wallpaper: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop",
            themeName: 'blue-default',
            accentColor: 'blue',
            displayScale: 1,
            barPosition: 'top',
            disabledApps: [],
            pinnedApps: [AppId.TERMINAL, AppId.EXPLORER, AppId.BLUE_SOFTWARE, AppId.SETTINGS]
        };
    },

    getCustomThemes: async (): Promise<CustomTheme[]> => {
        if (isTauri) return [];
        return [];
    },

    getWifiNetworks: async (): Promise<WifiNetwork[]> => {
        if (isTauri) {
            try { return await invoke('get_wifi_networks_real'); } catch(e) { return []; }
        }
        return [];
    },

    connectWifi: async (ssid: string, pass: string) => {
        if (isTauri) return await invoke('connect_wifi_real', { ssid, password: pass });
        return true;
    },

    toggleWifi: async (enabled: boolean) => {
        if (isTauri) await invoke('launch_process', { command: `nmcli radio wifi ${enabled ? 'on' : 'off'}` });
    },

    getBluetoothDevices: async (): Promise<BluetoothDevice[]> => {
        if (isTauri) {
            try { return await invoke('get_bluetooth_devices_real'); } catch(e) { return []; }
        }
        return [];
    },

    setBrightness: async (level: number) => {
        mockSystemState.brightness = level;
        if (isTauri) await invoke('set_system_brightness', { value: level });
    },

    setVolume: async (level: number) => {
        mockSystemState.volume = level;
        if (isTauri) await invoke('launch_process', { command: `amixer set Master ${level}%` });
    },

    getPackagesCatalog: async (): Promise<SoftwarePackage[]> => {
        return [...catalogPackages];
    },

    checkPackageStatus: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try { return await invoke('check_package_installed', { packageId: pkg.packageId, source: pkg.source }); } catch(e) { return false; }
        }
        return false;
    },

    installPackage: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try { await invoke('manage_package', { operation: 'install', packageId: pkg.packageId, source: pkg.source }); return true; } catch (e) { return false; }
        }
        return true;
    },

    uninstallPackage: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try { await invoke('manage_package', { operation: 'remove', packageId: pkg.packageId, source: pkg.source }); return true; } catch (e) { return false; }
        }
        return true;
    },

    // Audio
    getAudioOutputs: async (): Promise<AudioOutput[]> => {
        if (isTauri) return await invoke('get_audio_outputs');
        return [
            { id: '1', description: 'Built-in Audio Analog Stereo', active: true },
            { id: '2', description: 'WH-1000XM4 (Bluetooth)', active: false }
        ];
    },

    setAudioOutput: async (id: string) => {
        if (isTauri) await invoke('set_audio_output', { id });
    },

    // Terminal PTY
    spawnPty: async (id: string) => { if (isTauri) await invoke('spawn_pty', { id }); },
    writePty: async (id: string, data: string) => { if (isTauri) await invoke('write_to_pty', { id, data }); },
    resizePty: async (id: string, cols: number, rows: number) => { if (isTauri) await invoke('resize_pty', { id, cols, rows }); },

    // Compositor Bridge
    updateSurfaceRect: async (appId: string, x: number, y: number, w: number, h: number) => {
        if (isTauri) await invoke('update_surface_rect', { appId, x, y, width: w, height: h });
    }
};
