import React, { useState, useEffect } from 'react';
import { Wifi, Bluetooth, Volume2, Sun, Moon, Airplay, Signal, BatteryCharging, ChevronRight, Battery } from 'lucide-react';
import { SystemBridge } from '../utils/systemBridge';

interface ControlCenterProps {
    isOpen: boolean;
    onOpenSettings: () => void;
}

const Slider = ({ icon: Icon, value, onChange }: any) => (
    <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-2xl border border-white/5">
    <Icon size={18} className="text-slate-400" />
    <input
    type="range"
    min="0"
    max="100"
    value={value}
    onChange={(e) => onChange(parseInt(e.target.value))}
    className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
    />
    </div>
);

const ControlCenter: React.FC<ControlCenterProps> = ({ isOpen, onOpenSettings }) => {
    // Local state that reflects system state
    const [wifiEnabled, setWifiEnabled] = useState(false);
    const [wifiSSID, setWifiSSID] = useState('Disconnected');

    const [btEnabled, setBtEnabled] = useState(false);
    const [btConnectedDevice, setBtConnectedDevice] = useState<string | null>(null);

    const [darkMode, setDarkMode] = useState(true);

    // Real stats
    const [brightness, setBrightness] = useState(50);
    const [volume, setVolume] = useState(50);
    const [battery, setBattery] = useState(0);
    const [isCharging, setIsCharging] = useState(false);

    const syncState = async () => {
        // 1. Get General Stats
        const stats = await SystemBridge.getSystemStats();
        setBattery(stats.battery);
        setIsCharging(stats.is_charging);
        setVolume(stats.volume);
        setBrightness(stats.brightness);

        // 2. Determine Wifi State
        const nets = await SystemBridge.getWifiNetworks();
        // If we have networks and stats say we have an SSID or are just enabled
        const isWifiOn = stats.wifi_ssid !== 'Off';
        setWifiEnabled(isWifiOn);
        setWifiSSID(isWifiOn ? stats.wifi_ssid : 'Off');

        // 3. Determine Bluetooth State
        const devices = await SystemBridge.getBluetoothDevices();
        const connected = devices.find(d => d.connected);
        setBtEnabled(true); // Simplified: assume BT radio is on if we can scan
        setBtConnectedDevice(connected ? connected.name : null);
    };

    useEffect(() => {
        if (isOpen) {
            syncState();
            // Poll for updates while open
            const interval = setInterval(syncState, 2000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const handleBrightness = (val: number) => {
        setBrightness(val);
        SystemBridge.setBrightness(val);
    };

    const handleVolume = (val: number) => {
        setVolume(val);
        SystemBridge.setVolume(val);
    };

    const toggleWifi = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !wifiEnabled;
        setWifiEnabled(newState);
        setWifiSSID(newState ? 'Searching...' : 'Off');
        await SystemBridge.toggleWifi(newState);
        syncState();
    };

    const toggleBt = async (e: React.MouseEvent) => {
        e.stopPropagation();
        // In this mock, toggling BT button just toggles connection state of first device as a demo
        // or conceptually toggles the radio
        setBtEnabled(!btEnabled);
        // await SystemBridge.setBluetoothState(!btEnabled);
    };

    if (!isOpen) return null;

    return (
        <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-16 right-4 w-80 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-5 duration-200 pointer-events-auto"
        >

        {/* Toggles Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="grid grid-rows-2 gap-3">
        <div className={`col-span-1 p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer group ${wifiEnabled ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={onOpenSettings}>
        <div className="bg-white/20 p-2 rounded-full" onClick={toggleWifi}><Wifi size={16} /></div>
        <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">Wi-Fi</div>
        <div className="text-[10px] opacity-70 truncate">{wifiSSID}</div>
        </div>
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className={`col-span-1 p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer group ${btEnabled ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={onOpenSettings}>
        <div className="bg-white/20 p-2 rounded-full" onClick={toggleBt}><Bluetooth size={16} /></div>
        <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">Bluetooth</div>
        <div className="text-[10px] opacity-70 truncate">{btConnectedDevice || (btEnabled ? 'On' : 'Off')}</div>
        </div>
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
        <Airplay size={16} />
        <span className="text-[10px]">Media</span>
        </div>
        <div className="text-center">
        <div className="text-xs font-medium text-white">Not Playing</div>
        </div>
        <div className="flex justify-center gap-2">
        <button className="text-slate-400 hover:text-white"><Volume2 size={14} /></button>
        </div>
        </div>
        </div>

        <div className="flex gap-3 mb-4">
        <button className={`flex-1 p-3 rounded-2xl flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={() => setDarkMode(!darkMode)}>
        {darkMode ? <Moon size={16} /> : <Sun size={16} />}
        <span className="text-xs font-bold">{darkMode ? "Dark" : "Light"}</span>
        </button>

        <div className="flex-1 bg-slate-800 rounded-2xl p-3 flex flex-col justify-center gap-1">
        <div className="text-xs text-slate-400 font-medium">Battery</div>
        <div className={`text-xl font-bold flex items-center gap-2 ${battery < 20 ? 'text-red-400' : 'text-green-400'}`}>
        {Math.round(battery)}% {isCharging ? <BatteryCharging size={16} /> : <Battery size={16} />}
        </div>
        <div className="text-[10px] text-slate-500">{isCharging ? 'Charging' : 'Discharging'}</div>
        </div>
        </div>

        {/* Sliders */}
        <div className="space-y-3">
        <Slider icon={Sun} value={brightness} onChange={handleBrightness} />
        <Slider icon={Volume2} value={volume} onChange={handleVolume} />
        </div>
        </div>
    );
};

export default ControlCenter;
