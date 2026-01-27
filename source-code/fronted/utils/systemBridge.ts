import { DesktopEntry, UserConfig, CustomTheme, SoftwarePackage, WifiNetwork, BluetoothDevice } from '../types';

// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// @ts-ignore
const invoke = isTauri ? window.__TAURI__.invoke : async (cmd: string) => { console.log(`Mock invoke: ${cmd}`); return null; };

// --- Stateful Mock Storage ---
let mockWifiState = {
    enabled: true,
    connectedSSID: '',
    networks: [
        { ssid: "Home Network 5G", signal: 95, secure: true },
        { ssid: "Blue Guest", signal: 60, secure: true },
        { ssid: "Free Wifi", signal: 40, secure: false },
        { ssid: "Starlink", signal: 80, secure: true },
        { ssid: "Neighbor WiFi", signal: 20, secure: true },
    ]
};

let mockBtDevices = [
    { name: "Sony WH-1000XM4", type: "headphone", mac: "00:11:22:33:44", connected: true },
{ name: "Logitech MX Master", type: "mouse", mac: "AA:BB:CC:DD:EE", connected: true },
{ name: "iPhone 15 Pro", type: "phone", mac: "11:22:33:44:55", connected: false },
];

let mockSystemState = {
    volume: 65,
    brightness: 80,
    battery: 74,
    isCharging: false
};

// Mock Package Database (Catalog)
// The backend "check_package_installed" will verify these against the real system.
let catalogPackages: SoftwarePackage[] = [
    { id: 'firefox', packageId: 'firefox', source: 'apt', name: 'Firefox', description: 'Fast, private and ethical web browser.', version: 'Latest', category: 'Productivity', installed: false, size: '85 MB', author: 'Mozilla' },
{ id: 'vscode', packageId: 'code', source: 'snap', name: 'Visual Studio Code', description: 'Code editing. Redefined.', version: 'Latest', category: 'Development', installed: false, size: '120 MB', author: 'Microsoft' },
{ id: 'vlc', packageId: 'vlc', source: 'apt', name: 'VLC Media Player', description: 'The ultimate media player.', version: '3.0+', category: 'Multimedia', installed: false, size: '45 MB', author: 'VideoLAN' },
{ id: 'gimp', packageId: 'org.gimp.GIMP', source: 'flatpak', name: 'GIMP', description: 'GNU Image Manipulation Program.', version: '2.10', category: 'Multimedia', installed: false, size: '250 MB', author: 'GIMP Team' },
{ id: 'steam', packageId: 'steam', source: 'apt', name: 'Steam', description: 'Ultimate destination for playing games.', version: '1.0', category: 'Games', installed: false, size: '15 MB', author: 'Valve' },
{ id: 'obs', packageId: 'com.obsproject.Studio', source: 'flatpak', name: 'OBS Studio', description: 'Free software for video recording.', version: '30.0', category: 'Multimedia', installed: false, size: '150 MB', author: 'OBS Project' },
{ id: 'discord', packageId: 'discord', source: 'snap', name: 'Discord', description: 'Talk, chat, hang out.', version: 'Latest', category: 'Productivity', installed: false, size: '90 MB', author: 'Discord Inc.' },
{ id: 'python', packageId: 'python3', source: 'apt', name: 'Python 3', description: 'High-level programming language.', version: '3.12', category: 'Development', installed: false, size: '40 MB', author: 'Python Foundation' },
{ id: 'btop', packageId: 'btop', source: 'brew', name: 'Btop', description: 'Resource monitor that shows usage and stats.', version: '1.3', category: 'System', installed: false, size: '2 MB', author: 'Aristocratos' },
{ id: 'blender', packageId: 'org.blender.Blender', source: 'flatpak', name: 'Blender', description: '3D creation suite.', version: '4.0', category: 'Multimedia', installed: false, size: '300 MB', author: 'Blender Foundation' },
];

// Battery Drain Simulation
setInterval(() => {
    if (!mockSystemState.isCharging && mockSystemState.battery > 5) {
        mockSystemState.battery -= 1;
    } else if (mockSystemState.isCharging && mockSystemState.battery < 100) {
        mockSystemState.battery += 5;
    }
}, 30000);

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

    getSystemStats: async () => {
        if (isTauri) return await invoke('get_system_stats');

        // Use shared mock state
        return {
            cpu: Math.random() * 20 + 5, // fluctuate
            ram: 45,
            battery: mockSystemState.battery,
            isCharging: mockSystemState.isCharging,
            wifi_ssid: mockWifiState.enabled ? (mockWifiState.connectedSSID || 'Disconnected') : 'Off',
            volume: mockSystemState.volume,
            brightness: mockSystemState.brightness,
            kernel: 'HackerOS Kernel 6.6'
        };
    },

    getProcesses: async () => {
        if (isTauri) return await invoke('get_processes');
        return [
            { pid: "1234", name: "firefox", cpu: 12.5, memory: 400000000 },
            { pid: "5678", name: "blue-env", cpu: 5.2, memory: 150000000 }
        ];
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
        else alert("Screenshot taken (Mock)");
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
        else console.log(`Power action: ${action}`);
    },

    // --- Configuration & Theming ---

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
            barPosition: 'top'
        };
    },

    getCustomThemes: async (): Promise<CustomTheme[]> => {
        if (isTauri) return [];
        return [
            {
                id: 'custom:red-alert',
                name: 'Red Alert (Custom)',
                cssContent: `:root { --bg-primary: #1a0000; --bg-secondary: #330000; --text-primary: #ffcccc; --text-secondary: #cc8888; --accent: #ff0000; --accent-hover: #cc0000; }`
            },
            {
                id: 'custom:matrix',
                name: 'Matrix (Custom)',
                cssContent: `:root { --bg-primary: #000000; --bg-secondary: #0a1f0a; --text-primary: #00ff00; --text-secondary: #008f00; --accent: #00ff00; --accent-hover: #00cc00; } body { font-family: 'JetBrains Mono', monospace; }`
            }
        ];
    },

    // --- Networking & Bluetooth ---

    getWifiNetworks: async (): Promise<WifiNetwork[]> => {
        if (isTauri) {
            try { return await invoke('get_wifi_networks_real'); } catch(e) { return []; }
        }

        await new Promise(r => setTimeout(r, 500));
        if (!mockWifiState.enabled) return [];

        return mockWifiState.networks.map(n => ({
            ...n,
            in_use: n.ssid === mockWifiState.connectedSSID
        }));
    },

    connectWifi: async (ssid: string, pass: string) => {
        if (isTauri) return await invoke('connect_wifi_real', { ssid, password: pass });

        console.log(`Simulating connection to ${ssid}`);
        await new Promise(r => setTimeout(r, 1000));
        mockWifiState.connectedSSID = ssid;
        return true;
    },

    toggleWifi: async (enabled: boolean) => {
        if (isTauri) await invoke('launch_process', { command: `nmcli radio wifi ${enabled ? 'on' : 'off'}` });
        else {
            mockWifiState.enabled = enabled;
            if (!enabled) mockWifiState.connectedSSID = '';
        }
    },

    getBluetoothDevices: async (): Promise<BluetoothDevice[]> => {
        if (isTauri) {
            try { return await invoke('get_bluetooth_devices_real'); } catch(e) { return []; }
        }
        await new Promise(r => setTimeout(r, 600));
        return mockBtDevices;
    },

    toggleBluetoothDevice: async (mac: string) => {
        const dev = mockBtDevices.find(d => d.mac === mac);
        if(dev) {
            dev.connected = !dev.connected;
            return true;
        }
        return false;
    },

    setBluetoothState: async (enabled: boolean) => {
        // Simplification for mock: if disabled, disconnect all
        if (!enabled) {
            mockBtDevices.forEach(d => d.connected = false);
        }
        return true;
    },

    // --- Hardware Control ---
    setBrightness: async (level: number) => {
        mockSystemState.brightness = level;
        // In real backend call brightnessctl or xrandr
    },

    setVolume: async (level: number) => {
        mockSystemState.volume = level;
        if (isTauri) await invoke('launch_process', { command: `amixer set Master ${level}%` });
    },

    // --- Package Management (Blue Software) ---

    getPackagesCatalog: async (): Promise<SoftwarePackage[]> => {
        // Returns the static catalog definition.
        // The status (installed) will be updated by checkPackageStatus
        return [...catalogPackages];
    },

    checkPackageStatus: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try {
                return await invoke('check_package_installed', { packageId: pkg.packageId, source: pkg.source });
            } catch(e) {
                console.error("Failed to check status", e);
                return false;
            }
        }
        // Mock logic
        return pkg.installed;
    },

    installPackage: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try {
                await invoke('manage_package', { operation: 'install', packageId: pkg.packageId, source: pkg.source });
                return true;
            } catch (e) {
                console.error("Install failed", e);
                return false;
            }
        }
        // Mock
        await new Promise(r => setTimeout(r, 2000));
        pkg.installed = true;
        return true;
    },

    uninstallPackage: async (pkg: SoftwarePackage): Promise<boolean> => {
        if (isTauri) {
            try {
                await invoke('manage_package', { operation: 'remove', packageId: pkg.packageId, source: pkg.source });
                return true;
            } catch (e) {
                console.error("Remove failed", e);
                return false;
            }
        }
        // Mock
        await new Promise(r => setTimeout(r, 1500));
        pkg.installed = false;
        return true;
    }
};
