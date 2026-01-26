import React, { useState, useEffect } from 'react';
import { Monitor, Wifi, Bluetooth, Volume2, Image as ImageIcon, Info, User, Palette, Check, RefreshCw, Lock, Unlock, Loader2 } from 'lucide-react';
import { AppProps, UserConfig } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';
import { THEMES } from '../../constants';

// Moved outside to prevent re-mounting on every render
const TabButton = ({ id, icon: Icon, label, isActive, onClick }: any) => (
    <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
        ? 'theme-accent text-white shadow-lg shadow-blue-500/20 translate-x-1'
        : 'text-slate-400 hover:bg-white/5 hover:theme-text-primary'
    }`}
    >
    <Icon size={18} /> {label}
    </button>
);

const SettingsApp: React.FC<AppProps> = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);
    const [wallpapers, setWallpapers] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState('display');

    // Network State
    const [networks, setNetworks] = useState<any[]>([]);
    const [btDevices, setBtDevices] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);
    const [connectingTo, setConnectingTo] = useState<string | null>(null);

    useEffect(() => {
        SystemBridge.loadConfig().then(setConfig);
        SystemBridge.getWallpapers().then(setWallpapers);
    }, []);

    const handleSave = (newConfig: Partial<UserConfig>) => {
        if (!config) return;
        const updated = { ...config, ...newConfig };
        setConfig(updated);
        SystemBridge.saveConfig(updated);
    };

    const scanNetworks = async () => {
        setScanning(true);
        const nets = await SystemBridge.getWifiNetworks();
        setNetworks(nets);
        setScanning(false);
    };

    const handleConnectWifi = async (ssid: string) => {
        setConnectingTo(ssid);
        try {
            // Pass dummy password for mock
            await SystemBridge.connectWifi(ssid, "password");
            // Re-scan to update UI state (show 'Connected')
            await scanNetworks();
        } catch (e) {
            alert("Connection failed");
        } finally {
            setConnectingTo(null);
        }
    };

    const scanBluetooth = async () => {
        setScanning(true);
        const devs = await SystemBridge.getBluetoothDevices();
        setBtDevices(devs);
        setScanning(false);
    };

    const handleToggleBt = async (mac: string) => {
        // @ts-ignore
        if (SystemBridge.toggleBluetoothDevice) {
            // @ts-ignore
            await SystemBridge.toggleBluetoothDevice(mac);
            scanBluetooth();
        }
    };

    if (!config) return <div className="h-full flex items-center justify-center text-slate-400"><RefreshCw className="animate-spin mr-2" /> Loading system config...</div>;

    const renderContent = () => {
        switch(activeTab) {
            case 'display':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold theme-text-primary">Display & Appearance</h2>

                    {/* Wallpaper Section */}
                    <div className="theme-bg-secondary p-6 rounded-2xl theme-border border">
                    <label className="block text-sm font-medium theme-text-secondary mb-4 flex items-center gap-2">
                    <ImageIcon size={16} className="theme-accent-text" /> Wallpaper
                    </label>
                    <div className="grid grid-cols-3 gap-4 max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {wallpapers.map((wp, idx) => (
                        <div
                        key={idx}
                        className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${config.wallpaper === wp ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent'}`}
                        onClick={() => handleSave({ wallpaper: wp })}
                        >
                        <img src={wp} className="w-full h-full object-cover" loading="lazy" alt={`Wallpaper ${idx}`} />
                        </div>
                    ))}
                    </div>
                    </div>
                    </div>
                );

            case 'personalization':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold theme-text-primary">Personalization</h2>

                    <div className="theme-bg-secondary p-6 rounded-2xl theme-border border">
                    <label className="block text-sm font-medium theme-text-secondary mb-4 flex items-center gap-2">
                    <Palette size={16} className="text-purple-400" /> Color Theme
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                    {Object.entries(THEMES).map(([key, theme]) => (
                        <button
                        key={key}
                        onClick={() => handleSave({ themeName: key as any })}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${config.themeName === key ? 'bg-blue-600/20 border-blue-500' : 'theme-bg-primary theme-border hover:theme-bg-secondary'}`}
                        >
                        <div className={`w-12 h-12 rounded-lg shadow-lg ${theme.bg} border border-white/10`}></div>
                        <div className="text-left">
                        <div className="font-bold theme-text-primary">{theme.name}</div>
                        <div className="text-xs theme-text-secondary">Accent: {theme.accent}</div>
                        </div>
                        {config.themeName === key && <Check size={20} className="ml-auto theme-accent-text" />}
                        </button>
                    ))}
                    </div>
                    </div>
                    </div>
                );

            case 'wifi':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold theme-text-primary">Wi-Fi Networks</h2>
                    <button onClick={scanNetworks} className={`p-2 theme-bg-secondary rounded-full hover:bg-white/10 ${scanning ? 'animate-spin' : ''}`}><RefreshCw size={18}/></button>
                    </div>
                    <div className="theme-bg-secondary theme-border border rounded-2xl overflow-hidden">
                    {networks.length === 0 && !scanning && <div className="p-8 text-center theme-text-secondary">No networks found</div>}
                    {networks.map((net, i) => (
                        <div key={i} className={`flex items-center justify-between p-4 border-b theme-border last:border-0 transition-colors ${net.in_use ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}>
                        <div className="flex items-center gap-3">
                        <Wifi size={20} className={net.signal > 60 ? "text-green-400" : "text-yellow-400"} />
                        <div>
                        <div className="font-medium theme-text-primary flex items-center gap-2">
                        {net.ssid}
                        {net.in_use && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 rounded-full">Connected</span>}
                        </div>
                        <div className="text-xs theme-text-secondary flex items-center gap-1">
                        {net.secure ? <Lock size={10} /> : <Unlock size={10} />}
                        {net.secure ? "Secure" : "Open"} • {net.signal}% Signal
                        </div>
                        </div>
                        </div>
                        {net.in_use ? (
                            <button className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium cursor-default">Connected</button>
                        ) : (
                            <button
                            onClick={() => handleConnectWifi(net.ssid)}
                            disabled={connectingTo !== null}
                            className="px-4 py-2 theme-bg-primary hover:theme-accent hover:text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                            {connectingTo === net.ssid && <Loader2 size={14} className="animate-spin" />}
                            {connectingTo === net.ssid ? 'Connecting...' : 'Connect'}
                            </button>
                        )}
                        </div>
                    ))}
                    </div>
                    </div>
                );

            case 'bluetooth':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold theme-text-primary">Bluetooth</h2>
                    <button onClick={scanBluetooth} className={`p-2 theme-bg-secondary rounded-full hover:bg-white/10 ${scanning ? 'animate-spin' : ''}`}><RefreshCw size={18}/></button>
                    </div>
                    <div className="theme-bg-secondary theme-border border rounded-2xl overflow-hidden">
                    {btDevices.map((dev, i) => (
                        <div key={i} className="flex items-center justify-between p-4 border-b theme-border last:border-0 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                        <Bluetooth size={20} className={dev.connected ? "theme-accent-text" : "theme-text-secondary"} />
                        <div>
                        <div className="font-medium theme-text-primary">{dev.name}</div>
                        <div className="text-xs theme-text-secondary capitalize">{dev.type || 'Unknown'} • {dev.connected ? "Connected" : "Not Connected"}</div>
                        </div>
                        </div>
                        <button
                        onClick={() => handleToggleBt(dev.mac)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${dev.connected ? 'bg-red-500/20 text-red-300 hover:bg-red-500/40' : 'theme-bg-primary hover:theme-accent hover:text-white'}`}
                        >
                        {dev.connected ? "Disconnect" : "Pair"}
                        </button>
                        </div>
                    ))}
                    </div>
                    </div>
                );

            case 'about':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h2 className="text-2xl font-bold theme-text-primary">About System</h2>
                    <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 p-8 rounded-3xl theme-border border flex items-center gap-6">
                    <div className="w-24 h-24 theme-accent rounded-full flex items-center justify-center shadow-2xl text-white">
                    <span className="text-4xl font-bold">B</span>
                    </div>
                    <div>
                    <h3 className="text-2xl font-bold text-white">Blue Environment</h3>
                    <p className="text-blue-200">Version 1.2.0 (Stable)</p>
                    <p className="text-slate-400 text-sm mt-2">Running on HackerOS Linux</p>
                    </div>
                    </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-full theme-bg-primary theme-text-primary selection:bg-blue-500/30">
        <div className="w-64 theme-bg-secondary/50 border-r theme-border p-4 flex flex-col gap-1">
        <h2 className="text-xl font-bold mb-6 px-2 flex items-center gap-2 theme-text-primary">
        <div className="w-6 h-6 theme-accent rounded flex items-center justify-center text-[10px] text-white">B</div>
        Settings
        </h2>
        <TabButton
        id="display"
        icon={Monitor}
        label="Display"
        isActive={activeTab === 'display'}
        onClick={() => setActiveTab('display')}
        />
        <TabButton
        id="personalization"
        icon={Palette}
        label="Personalization"
        isActive={activeTab === 'personalization'}
        onClick={() => setActiveTab('personalization')}
        />
        <TabButton
        id="wifi"
        icon={Wifi}
        label="Wi-Fi"
        isActive={activeTab === 'wifi'}
        onClick={() => { setActiveTab('wifi'); scanNetworks(); }}
        />
        <TabButton
        id="bluetooth"
        icon={Bluetooth}
        label="Bluetooth"
        isActive={activeTab === 'bluetooth'}
        onClick={() => { setActiveTab('bluetooth'); scanBluetooth(); }}
        />
        <TabButton
        id="sound"
        icon={Volume2}
        label="Sound"
        isActive={activeTab === 'sound'}
        onClick={() => setActiveTab('sound')}
        />
        <TabButton
        id="users"
        icon={User}
        label="Users"
        isActive={activeTab === 'users'}
        onClick={() => setActiveTab('users')}
        />
        <div className="my-2 h-px bg-white/5" />
        <TabButton
        id="about"
        icon={Info}
        label="About"
        isActive={activeTab === 'about'}
        onClick={() => setActiveTab('about')}
        />
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
        {renderContent()}
        </div>
        </div>
    );
};

export default SettingsApp;
