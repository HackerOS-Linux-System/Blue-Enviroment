import React, { useState, useEffect } from 'react';
import { Monitor, Wifi, Bluetooth, Volume2, Image as ImageIcon, Info, User, Palette, Check, RefreshCw, Lock, Unlock, Loader2, LayoutPanelTop, LayoutPanelLeft, FileCode, AppWindow, ToggleLeft, ToggleRight, Edit3, Cpu, HardDrive, Shield, Hash, Signal } from 'lucide-react';
import { AppProps, UserConfig, CustomTheme, AppId, WifiNetwork, BluetoothDevice } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';
import { THEMES, APPS } from '../../constants';

interface SettingsProps extends AppProps {
    config?: UserConfig;
    onSave?: (cfg: Partial<UserConfig>) => void;
    initialTab?: string;
}

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

const SettingsApp: React.FC<SettingsProps> = ({ config: propConfig, onSave, initialTab }) => {
    const [localConfig, setLocalConfig] = useState<UserConfig | null>(propConfig || null);
    const [wallpapers, setWallpapers] = useState<string[]>([]);
    const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
    const [activeTab, setActiveTab] = useState(initialTab || 'apps');
    const [sysInfo, setSysInfo] = useState<any>(null);
    const [realStats, setRealStats] = useState<any>(null);

    // Wi-Fi State
    const [networks, setNetworks] = useState<WifiNetwork[]>([]);
    const [wifiPassword, setWifiPassword] = useState('');
    const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
    const [isConnectingWifi, setIsConnectingWifi] = useState(false);

    // Bluetooth State
    const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);

    // Theme Editor State
    const [isEditingTheme, setIsEditingTheme] = useState(false);
    const [themeEditValues, setThemeEditValues] = useState({
        bgPrimary: '#0f172a',
        bgSecondary: '#1e293b',
        textPrimary: '#f1f5f9',
        accent: '#2563eb'
    });

    useEffect(() => {
        if(initialTab) setActiveTab(initialTab);
    }, [initialTab]);

        useEffect(() => {
            if(!propConfig) SystemBridge.loadConfig().then(setLocalConfig);
            SystemBridge.getWallpapers().then(setWallpapers);
            SystemBridge.getCustomThemes().then(setCustomThemes);
            SystemBridge.getDistroInfo().then(setSysInfo);
            SystemBridge.getSystemStats().then(setRealStats);

            // Load Connectivity Data
            if (activeTab === 'wifi') SystemBridge.getWifiNetworks().then(setNetworks);
            if (activeTab === 'bluetooth') SystemBridge.getBluetoothDevices().then(setBtDevices);

        }, [propConfig, activeTab]);

            const handleUpdate = (update: Partial<UserConfig>) => {
                if (!localConfig) return;
                const newState = { ...localConfig, ...update };
                setLocalConfig(newState);
                if (onSave) onSave(update);
                else SystemBridge.saveConfig(newState);
            };

                const handleWifiConnect = async () => {
                    if (!selectedNetwork) return;
                    setIsConnectingWifi(true);
                    try {
                        await SystemBridge.connectWifi(selectedNetwork, wifiPassword);
                        alert(`Connected to ${selectedNetwork}`);
                        setWifiPassword('');
                        setSelectedNetwork(null);
                    } catch (e) {
                        alert("Connection Failed");
                    } finally {
                        setIsConnectingWifi(false);
                    }
                };

                const toggleApp = (appId: string) => {
                    if(!localConfig) return;
                    const currentDisabled = localConfig.disabledApps || [];
                    const isDisabled = currentDisabled.includes(appId);

                    let newDisabled;
                    if (isDisabled) {
                        newDisabled = currentDisabled.filter(id => id !== appId);
                    } else {
                        newDisabled = [...currentDisabled, appId];
                    }
                    handleUpdate({ disabledApps: newDisabled });
                };

                const saveCustomTheme = () => {
                    const css = `
                    :root {
                        --bg-primary: ${themeEditValues.bgPrimary};
                        --bg-secondary: ${themeEditValues.bgSecondary};
                        --text-primary: ${themeEditValues.textPrimary};
                        --text-secondary: ${themeEditValues.textPrimary}99;
                        --accent: ${themeEditValues.accent};
                        --accent-hover: ${themeEditValues.accent}dd;
                    }`;

                    const themeName = `Custom ${new Date().toLocaleTimeString()}`;
                    const id = `custom:${Date.now()}`;

                    const newTheme: CustomTheme = { id, name: themeName, cssContent: css };
                    setCustomThemes([...customThemes, newTheme]);
                    handleUpdate({ themeName: id });
                    setIsEditingTheme(false);
                };

                if (!localConfig) return <div className="h-full flex items-center justify-center text-slate-400"><RefreshCw className="animate-spin mr-2" /> Loading...</div>;

                const renderContent = () => {
                    switch(activeTab) {
                        case 'wifi':
                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h2 className="text-2xl font-bold theme-text-primary">Wi-Fi Networks</h2>
                                <div className="theme-bg-secondary rounded-2xl border theme-border overflow-hidden">
                                {networks.map((net, i) => (
                                    <div key={i} className="p-4 border-b theme-border flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                    <Signal size={18} className={net.in_use ? "text-green-400" : "text-slate-400"} />
                                    <span className="font-bold">{net.ssid}</span>
                                    {net.secure && <Lock size={12} className="text-slate-500" />}
                                    </div>
                                    <button
                                    onClick={() => setSelectedNetwork(selectedNetwork === net.ssid ? null : net.ssid)}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${net.in_use ? 'text-green-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                    >
                                    {net.in_use ? 'Connected' : 'Connect'}
                                    </button>
                                    </div>
                                    {selectedNetwork === net.ssid && !net.in_use && (
                                        <div className="flex gap-2 mt-2 animate-in slide-in-from-top-1">
                                        <input
                                        type="password"
                                        placeholder="Password"
                                        className="flex-1 bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm"
                                        value={wifiPassword}
                                        onChange={e => setWifiPassword(e.target.value)}
                                        />
                                        <button onClick={handleWifiConnect} disabled={isConnectingWifi} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">
                                        {isConnectingWifi ? '...' : 'Join'}
                                        </button>
                                        </div>
                                    )}
                                    </div>
                                ))}
                                </div>
                                </div>
                            );
                        case 'bluetooth':
                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h2 className="text-2xl font-bold theme-text-primary">Bluetooth Devices</h2>
                                <div className="theme-bg-secondary rounded-2xl border theme-border overflow-hidden p-4">
                                {btDevices.length === 0 ? <p className="text-slate-400 text-center">Scanning for devices...</p> : (
                                    btDevices.map((dev, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 border-b theme-border last:border-0">
                                        <div className="flex items-center gap-3">
                                        <Bluetooth size={18} className="text-blue-400" />
                                        <span>{dev.name}</span>
                                        </div>
                                        <button className="text-xs text-blue-400 hover:underline">Pair</button>
                                        </div>
                                    ))
                                )}
                                </div>
                                </div>
                            );

                        case 'apps':
                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <h2 className="text-2xl font-bold theme-text-primary">Applications Manager</h2>
                                <div className="theme-bg-secondary p-4 rounded-2xl theme-border border space-y-2">
                                {Object.values(APPS).map(app => (
                                    <div key={app.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                                    {typeof app.icon !== 'string' && <app.icon size={20} className="text-blue-400"/>}
                                    </div>
                                    <div>
                                    <div className="font-bold theme-text-primary">{app.title}</div>
                                    <div className="text-xs text-slate-500">{app.id}</div>
                                    </div>
                                    </div>
                                    <button onClick={() => toggleApp(app.id)} className="text-2xl transition-colors">
                                    {(localConfig.disabledApps || []).includes(app.id)
                                        ? <ToggleLeft className="text-slate-600" size={32} />
                                        : <ToggleRight className="theme-accent-text" size={32} />
                                    }
                                    </button>
                                    </div>
                                ))}
                                </div>
                                </div>
                            );

                        case 'personalization':
                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold theme-text-primary">Personalization</h2>
                                <button onClick={() => setIsEditingTheme(!isEditingTheme)} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors">
                                <Edit3 size={14} /> Theme Editor
                                </button>
                                </div>

                                {isEditingTheme && (
                                    <div className="theme-bg-secondary p-6 rounded-2xl theme-border border animate-in slide-in-from-top-4">
                                    <h3 className="font-bold mb-4">Create Custom Theme</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Background</label>
                                    <div className="flex gap-2">
                                    <input type="color" value={themeEditValues.bgPrimary} onChange={e => setThemeEditValues({...themeEditValues, bgPrimary: e.target.value})} className="h-8 w-12 rounded cursor-pointer" />
                                    <input className="bg-slate-900 border border-white/10 rounded px-2 text-xs w-full" value={themeEditValues.bgPrimary} readOnly />
                                    </div>
                                    </div>
                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Secondary BG</label>
                                    <div className="flex gap-2">
                                    <input type="color" value={themeEditValues.bgSecondary} onChange={e => setThemeEditValues({...themeEditValues, bgSecondary: e.target.value})} className="h-8 w-12 rounded cursor-pointer" />
                                    <input className="bg-slate-900 border border-white/10 rounded px-2 text-xs w-full" value={themeEditValues.bgSecondary} readOnly />
                                    </div>
                                    </div>
                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Text Color</label>
                                    <div className="flex gap-2">
                                    <input type="color" value={themeEditValues.textPrimary} onChange={e => setThemeEditValues({...themeEditValues, textPrimary: e.target.value})} className="h-8 w-12 rounded cursor-pointer" />
                                    <input className="bg-slate-900 border border-white/10 rounded px-2 text-xs w-full" value={themeEditValues.textPrimary} readOnly />
                                    </div>
                                    </div>
                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Accent Color</label>
                                    <div className="flex gap-2">
                                    <input type="color" value={themeEditValues.accent} onChange={e => setThemeEditValues({...themeEditValues, accent: e.target.value})} className="h-8 w-12 rounded cursor-pointer" />
                                    <input className="bg-slate-900 border border-white/10 rounded px-2 text-xs w-full" value={themeEditValues.accent} readOnly />
                                    </div>
                                    </div>
                                    </div>
                                    <button onClick={saveCustomTheme} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold text-sm">Save Custom Theme</button>
                                    </div>
                                )}

                                {/* Standard Themes */}
                                <div className="grid grid-cols-2 gap-4">
                                {Object.entries(THEMES).map(([key, theme]) => (
                                    <button
                                    key={key}
                                    onClick={() => handleUpdate({ themeName: key as any })}
                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${localConfig.themeName === key ? 'bg-blue-600/20 border-blue-500' : 'theme-bg-primary theme-border hover:theme-bg-secondary'}`}
                                    >
                                    <div className={`w-12 h-12 rounded-lg shadow-lg ${theme.bg} border border-white/10`}></div>
                                    <div className="text-left">
                                    <div className="font-bold theme-text-primary">{theme.name}</div>
                                    <div className="text-xs theme-text-secondary">Default</div>
                                    </div>
                                    {localConfig.themeName === key && <Check size={20} className="ml-auto theme-accent-text" />}
                                    </button>
                                ))}
                                {customThemes.map((theme) => (
                                    <button
                                    key={theme.id}
                                    onClick={() => handleUpdate({ themeName: theme.id })}
                                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${localConfig.themeName === theme.id ? 'bg-blue-600/20 border-blue-500' : 'theme-bg-primary theme-border hover:theme-bg-secondary'}`}
                                    >
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-xs font-mono">CSS</div>
                                    <div className="text-left">
                                    <div className="font-bold theme-text-primary">{theme.name}</div>
                                    <div className="text-xs theme-text-secondary">Custom</div>
                                    </div>
                                    {localConfig.themeName === theme.id && <Check size={20} className="ml-auto theme-accent-text" />}
                                    </button>
                                ))}
                                </div>
                                </div>
                            );

                            case 'display':
                                return (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h2 className="text-2xl font-bold theme-text-primary">Display & Wallpaper</h2>
                                    <div className="theme-bg-secondary p-6 rounded-2xl theme-border border">
                                    <label className="block text-sm font-medium theme-text-secondary mb-4 flex items-center gap-2">
                                    <ImageIcon size={16} className="theme-accent-text" /> Wallpapers (Video Supported)
                                    </label>
                                    <div className="grid grid-cols-3 gap-4 max-h-80 overflow-y-auto custom-scrollbar p-1">
                                    {wallpapers.map((wp, idx) => (
                                        <div
                                        key={idx}
                                        className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-105 ${localConfig.wallpaper === wp ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent'}`}
                                        onClick={() => handleUpdate({ wallpaper: wp })}
                                        >
                                        {(wp.endsWith('.mp4') || wp.endsWith('.webm')) ? (
                                            <video src={wp} className="w-full h-full object-cover" muted loop />
                                        ) : (
                                            <img src={wp} className="w-full h-full object-cover" loading="lazy" alt={`Wallpaper ${idx}`} />
                                        )}
                                        </div>
                                    ))}
                                    </div>
                                    </div>
                                    </div>
                                );

                            case 'system':
                                return (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <h2 className="text-2xl font-bold theme-text-primary">System Information</h2>
                                    <div className="theme-bg-secondary p-6 rounded-2xl theme-border border flex items-center gap-6">
                                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl">B</div>
                                    <div>
                                    <h3 className="text-xl font-bold">{sysInfo?.Name || "Blue Environment"}</h3>
                                    <p className="text-slate-400">Version {sysInfo?.Version || "0.2.0-Alpha"}</p>
                                    <p className="text-slate-500 text-sm mt-1">{sysInfo?.Copyright}</p>
                                    </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 theme-bg-secondary rounded-xl border theme-border flex items-center gap-4">
                                    <Cpu size={24} className="text-blue-400" />
                                    <div className="min-w-0">
                                    <div className="text-sm text-slate-500">Processor</div>
                                    <div className="font-medium truncate" title={realStats?.cpu_brand}>{realStats?.cpu_brand || "Loading..."}</div>
                                    </div>
                                    </div>
                                    <div className="p-4 theme-bg-secondary rounded-xl border theme-border flex items-center gap-4">
                                    <HardDrive size={24} className="text-green-400" />
                                    <div>
                                    <div className="text-sm text-slate-500">Memory</div>
                                    <div className="font-medium">
                                    {realStats ? `${(realStats.total_ram / 1024 / 1024 / 1024).toFixed(1)} GB` : "Loading..."}
                                    </div>
                                    </div>
                                    </div>
                                    <div className="p-4 theme-bg-secondary rounded-xl border theme-border flex items-center gap-4">
                                    <Shield size={24} className="text-purple-400" />
                                    <div className="min-w-0">
                                    <div className="text-sm text-slate-500">Kernel</div>
                                    <div className="font-medium truncate" title={realStats?.kernel}>{realStats?.kernel || "Unknown"}</div>
                                    </div>
                                    </div>
                                    <div className="p-4 theme-bg-secondary rounded-xl border theme-border flex items-center gap-4">
                                    <User size={24} className="text-orange-400" />
                                    <div className="min-w-0">
                                    <div className="text-sm text-slate-500">User</div>
                                    <div className="font-medium truncate">{realStats?.username || "Unknown"}</div>
                                    </div>
                                    </div>
                                    <div className="p-4 theme-bg-secondary rounded-xl border theme-border flex items-center gap-4">
                                    <Hash size={24} className="text-cyan-400" />
                                    <div className="min-w-0">
                                    <div className="text-sm text-slate-500">Hostname</div>
                                    <div className="font-medium truncate">{realStats?.hostname || "localhost"}</div>
                                    </div>
                                    </div>
                                    </div>
                                    </div>
                                );

                                default:
                                    return <div className="p-10 text-center text-slate-500">Select a category</div>;
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
                    id="wifi"
                    icon={Wifi}
                    label="Wi-Fi"
                    isActive={activeTab === 'wifi'}
                    onClick={() => setActiveTab('wifi')}
                    />
                    <TabButton
                    id="bluetooth"
                    icon={Bluetooth}
                    label="Bluetooth"
                    isActive={activeTab === 'bluetooth'}
                    onClick={() => setActiveTab('bluetooth')}
                    />
                    <TabButton
                    id="apps"
                    icon={AppWindow}
                    label="Applications"
                    isActive={activeTab === 'apps'}
                    onClick={() => setActiveTab('apps')}
                    />
                    <TabButton
                    id="personalization"
                    icon={Palette}
                    label="Themes"
                    isActive={activeTab === 'personalization'}
                    onClick={() => setActiveTab('personalization')}
                    />
                    <TabButton
                    id="display"
                    icon={Monitor}
                    label="Display"
                    isActive={activeTab === 'display'}
                    onClick={() => setActiveTab('display')}
                    />
                    <TabButton
                    id="system"
                    icon={Info}
                    label="System"
                    isActive={activeTab === 'system'}
                    onClick={() => setActiveTab('system')}
                    />
                    </div>
                    <div className="flex-1 p-8 overflow-y-auto">
                    {renderContent()}
                    </div>
                    </div>
                );
};

export default SettingsApp;
