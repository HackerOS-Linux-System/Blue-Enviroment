import { DesktopEntry, UserConfig } from '../types';

// @ts-ignore
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

// @ts-ignore
const invoke = isTauri ? window.__TAURI__.invoke : async (cmd: string) => { console.log(`Mock invoke: ${cmd}`); return null; };

// --- Stateful Mock Storage ---
let mockWifiState = {
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
        return {
            cpu: 15,
            ram: 45,
            battery: 82,
            isCharging: false,
            wifiSSID: mockWifiState.connectedSSID || 'Disconnected',
            volume: 60,
            brightness: 80,
            kernel: 'WebKernel 1.0'
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
            theme: 'dark',
            themeName: 'blue-default',
            accentColor: 'blue',
            displayScale: 1
        };
    },

    // --- Networking & Bluetooth (Hybrid Real/Mock) ---

    getWifiNetworks: async () => {
        if (isTauri) {
            try {
                return await invoke('get_wifi_networks_real');
            } catch(e) {
                console.warn("Failed to get real wifi, falling back to empty");
                return [];
            }
        }

        // Simulate scanning delay and stateful connection
        await new Promise(r => setTimeout(r, 500));
        return mockWifiState.networks.map(n => ({
            ...n,
            in_use: n.ssid === mockWifiState.connectedSSID
        }));
    },

    connectWifi: async (ssid: string, pass: string) => {
        if (isTauri) return await invoke('connect_wifi_real', { ssid, password: pass });

        // Mock connection logic
        console.log(`Simulating connection to ${ssid}`);
        await new Promise(r => setTimeout(r, 1500)); // Fake connection delay
        mockWifiState.connectedSSID = ssid;
        return true;
    },

    getBluetoothDevices: async () => {
        if (isTauri) {
            try {
                return await invoke('get_bluetooth_devices_real');
            } catch(e) {
                return [];
            }
        }

        await new Promise(r => setTimeout(r, 600));
        return mockBtDevices;
    },

    toggleBluetoothDevice: async (mac: string) => {
        // In web mode, toggle the mock state
        const dev = mockBtDevices.find(d => d.mac === mac);
        if(dev) {
            dev.connected = !dev.connected;
            return true;
        }
        return false;
    },

    setBrightness: async (level: number) => {},
    setVolume: async (level: number) => {
        if (isTauri) await invoke('launch_process', { command: `amixer set Master ${level}%` });
    },
    toggleWifi: async (enabled: boolean) => {
        if (isTauri) await invoke('launch_process', { command: `nmcli radio wifi ${enabled ? 'on' : 'off'}` });
        else {
            if (!enabled) mockWifiState.connectedSSID = '';
        }
    },
};
