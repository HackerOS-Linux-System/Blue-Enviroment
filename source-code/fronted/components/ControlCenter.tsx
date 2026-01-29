import React, { useState, useEffect } from 'react';
import { Wifi, Bluetooth, Volume2, Sun, Moon, Airplay, Signal, BatteryCharging, ChevronRight, Battery, SkipBack, SkipForward, Play, Pause, Lock, Unlock, Speaker, Headphones, Cpu, CircuitBoard, Activity, Music, Smartphone, Monitor } from 'lucide-react';
import { SystemBridge, AudioOutput } from '../utils/systemBridge';
import { WifiNetwork, BluetoothDevice } from '../types';

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
    // Stats
    const [wifiEnabled, setWifiEnabled] = useState(false);
    const [wifiSSID, setWifiSSID] = useState('Disconnected');
    const [networks, setNetworks] = useState<WifiNetwork[]>([]);
    const [showWifiList, setShowWifiList] = useState(false);

    const [btEnabled, setBtEnabled] = useState(false);
    const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
    const [showBtList, setShowBtList] = useState(false);

    const [darkMode, setDarkMode] = useState(true);

    const [brightness, setBrightness] = useState(50);
    const [volume, setVolume] = useState(50);
    const [battery, setBattery] = useState(0);
    const [isCharging, setIsCharging] = useState(false);

    const [cpuUsage, setCpuUsage] = useState(0);
    const [ramUsage, setRamUsage] = useState(0);

    // Audio Outputs
    const [audioOutputs, setAudioOutputs] = useState<AudioOutput[]>([]);
    const [activeOutputId, setActiveOutputId] = useState<string>('');
    const [showAudioList, setShowAudioList] = useState(false);

    // Media
    const [isPlaying, setIsPlaying] = useState(false);
    const [trackProgress, setTrackProgress] = useState(30);

    const syncState = async () => {
        const stats = await SystemBridge.getSystemStats();
        setBattery(stats.battery);
        setIsCharging(stats.is_charging);
        setVolume(stats.volume);
        setBrightness(stats.brightness);

        setCpuUsage(stats.cpu_usage);
        setRamUsage(stats.ram_usage);

        const isWifiOn = stats.wifi_ssid !== 'Off';
        setWifiEnabled(isWifiOn);
        setWifiSSID(isWifiOn ? stats.wifi_ssid : 'Off');
    };

    const fetchNetworks = async () => {
        const nets = await SystemBridge.getWifiNetworks();
        setNetworks(nets);
    };

    const fetchBtDevices = async () => {
        const devs = await SystemBridge.getBluetoothDevices();
        setBtDevices(devs);
    };

    const fetchAudioOutputs = async () => {
        const outputs = await SystemBridge.getAudioOutputs();
        setAudioOutputs(outputs);
        const active = outputs.find(o => o.active);
        if (active) setActiveOutputId(active.id);
        else if (outputs.length > 0) setActiveOutputId(outputs[0].id);
    };

        useEffect(() => {
            if (isOpen) {
                syncState();
                fetchAudioOutputs();

                const hour = new Date().getHours();
                if (hour >= 19 || hour < 7) {
                    setDarkMode(true);
                    document.documentElement.classList.add('dark');
                }

                const interval = setInterval(syncState, 2000);
                return () => clearInterval(interval);
            } else {
                setShowWifiList(false);
                setShowAudioList(false);
                setShowBtList(false);
            }
        }, [isOpen]);

        const toggleWifi = async (e: React.MouseEvent) => {
            e.stopPropagation();
            const newState = !wifiEnabled;
            setWifiEnabled(newState);
            await SystemBridge.toggleWifi(newState);
            syncState();
        };

        const expandWifi = async (e: React.MouseEvent) => {
            e.stopPropagation();
            setShowWifiList(!showWifiList);
            setShowAudioList(false);
            setShowBtList(false);
            if(!showWifiList) fetchNetworks();
        };

            const expandBluetooth = async (e: React.MouseEvent) => {
                e.stopPropagation();
                setShowBtList(!showBtList);
                setShowWifiList(false);
                setShowAudioList(false);
                if (!showBtList) fetchBtDevices();
            };

                const toggleAudioList = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setShowAudioList(!showAudioList);
                    setShowWifiList(false);
                    setShowBtList(false);
                    if(!showAudioList) fetchAudioOutputs();
                };

                    const handleSetOutput = (id: string) => {
                        setActiveOutputId(id);
                        SystemBridge.setAudioOutput(id);
                        setShowAudioList(false);
                    };

                    if (!isOpen) return null;

                    return (
                        <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-16 right-4 w-80 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-5 duration-200 pointer-events-auto flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar"
                        >

                        {/* Toggles Grid */}
                        <div className="grid grid-cols-2 gap-3">
                        <div className="grid grid-rows-2 gap-3">
                        {/* Wi-Fi Widget */}
                        <div className={`col-span-1 p-3 rounded-2xl flex flex-col gap-2 transition-colors cursor-pointer group ${wifiEnabled ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={expandWifi}>
                        <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-full" onClick={toggleWifi}><Wifi size={16} /></div>
                        <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold">Wi-Fi</div>
                        <div className="text-[10px] opacity-70 truncate">{wifiSSID}</div>
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${showWifiList ? 'rotate-90' : ''}`} />
                        </div>
                        </div>

                        {/* Bluetooth Widget */}
                        <div className={`col-span-1 p-3 rounded-2xl flex items-center gap-2 transition-colors cursor-pointer group ${btEnabled ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={expandBluetooth}>
                        <div className="bg-white/20 p-2 rounded-full" onClick={(e) => { e.stopPropagation(); setBtEnabled(!btEnabled); }}><Bluetooth size={16} /></div>
                        <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold">Bluetooth</div>
                        <div className="text-[10px] opacity-70 truncate">{btEnabled ? 'On' : 'Off'}</div>
                        </div>
                        <ChevronRight size={14} className={`transition-transform ${showBtList ? 'rotate-90' : ''}`} />
                        </div>
                        </div>

                        {/* Media / Output Widget */}
                        <div className="bg-slate-800 rounded-2xl p-3 flex flex-col justify-between relative overflow-hidden group">
                        {/* Album Art Background (Blurred) */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20 z-0"></div>

                        <div className="relative z-10 flex items-center justify-between text-slate-300 hover:text-white cursor-pointer mb-2" onClick={toggleAudioList}>
                        <Airplay size={14} />
                        <span className="text-[10px] flex items-center gap-1">Output <ChevronRight size={10} className={showAudioList ? 'rotate-90' : ''} /></span>
                        </div>

                        <div className="relative z-10 flex gap-2 items-center">
                        <div className="w-10 h-10 bg-slate-900 rounded-md flex items-center justify-center shadow-md">
                        <Music size={20} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{isPlaying ? "Blue Wave" : "Not Playing"}</div>
                        <div className="text-[10px] text-slate-400 truncate">HackerOS Beats</div>
                        </div>
                        </div>

                        <div className="relative z-10 mt-2">
                        {/* Progress Bar */}
                        <div className="h-1 bg-slate-700 rounded-full mb-2 overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${trackProgress}%` }}></div>
                        </div>

                        <div className="flex justify-between items-center px-1">
                        <button className="text-slate-300 hover:text-white"><SkipBack size={14} /></button>
                        <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:scale-110 transition-transform">
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                        </button>
                        <button className="text-slate-300 hover:text-white"><SkipForward size={14} /></button>
                        </div>
                        </div>
                        </div>
                        </div>

                        {/* Expanded Lists */}

                        {showAudioList && (
                            <div className="bg-slate-800 rounded-2xl p-2 space-y-1 animate-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-slate-500 px-2 py-1">Select Output</div>
                            {audioOutputs.map((out) => (
                                <div
                                key={out.id}
                                onClick={() => handleSetOutput(out.id)}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${activeOutputId === out.id ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-300'}`}
                                >
                                <div className="flex items-center gap-2 text-sm">
                                {out.description.toLowerCase().includes('headphone') ? <Headphones size={14} /> : <Speaker size={14} />}
                                <span className="truncate max-w-[180px]">{out.description}</span>
                                </div>
                                {activeOutputId === out.id && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                            ))}
                            </div>
                        )}

                        {showWifiList && (
                            <div className="bg-slate-800 rounded-2xl p-2 space-y-1 animate-in slide-in-from-top-2 max-h-48 overflow-y-auto custom-scrollbar">
                            <div className="text-xs font-bold text-slate-500 px-2 py-1">Available Networks</div>
                            {networks.map((net, i) => (
                                <div key={i} className="flex items-center justify-between p-2 hover:bg-white/10 rounded-lg cursor-pointer">
                                <div className="flex items-center gap-2 text-sm text-white">
                                <Wifi size={14} /> {net.ssid}
                                </div>
                                {net.secure && <Lock size={12} className="text-slate-500" />}
                                </div>
                            ))}
                            <div onClick={onOpenSettings} className="text-center text-xs text-blue-400 py-2 hover:underline cursor-pointer">Wi-Fi Settings</div>
                            </div>
                        )}

                        {showBtList && (
                            <div className="bg-slate-800 rounded-2xl p-2 space-y-1 animate-in slide-in-from-top-2 max-h-48 overflow-y-auto custom-scrollbar">
                            <div className="text-xs font-bold text-slate-500 px-2 py-1">Bluetooth Devices</div>
                            {btDevices.length === 0 ? (
                                <div className="text-center text-xs text-slate-500 py-2">Scanning...</div>
                            ) : (
                                btDevices.map((dev, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 hover:bg-white/10 rounded-lg cursor-pointer">
                                    <div className="flex items-center gap-2 text-sm text-white">
                                    {dev.name.toLowerCase().includes('phone') ? <Smartphone size={14} /> : <Bluetooth size={14} />}
                                    {dev.name}
                                    </div>
                                    {dev.connected ? <span className="text-[10px] text-green-400">Connected</span> : <span className="text-[10px] text-blue-400">Pair</span>}
                                    </div>
                                ))
                            )}
                            </div>
                        )}

                        {/* System Stats Row */}
                        <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800 rounded-2xl p-3 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Cpu size={16} /></div>
                        <div className="flex-1">
                        <div className="text-xs text-slate-400">CPU</div>
                        <div className="h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${cpuUsage}%` }}></div>
                        </div>
                        </div>
                        </div>
                        <div className="bg-slate-800 rounded-2xl p-3 flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><CircuitBoard size={16} /></div>
                        <div className="flex-1">
                        <div className="text-xs text-slate-400">RAM</div>
                        <div className="h-1.5 bg-slate-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${ramUsage}%` }}></div>
                        </div>
                        </div>
                        </div>
                        </div>

                        {/* Battery & Theme */}
                        <div className="flex gap-3">
                        <button className={`flex-1 p-3 rounded-2xl flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={() => setDarkMode(!darkMode)}>
                        {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                        <span className="text-xs font-bold">{darkMode ? "Dark" : "Light"}</span>
                        </button>

                        <div className="flex-1 bg-slate-800 rounded-2xl p-3 flex flex-col justify-center gap-1">
                        <div className="text-xs text-slate-400 font-medium">Battery</div>
                        <div className={`text-xl font-bold flex items-center gap-2 ${battery < 20 ? 'text-red-400' : 'text-green-400'}`}>
                        {Math.round(battery)}% {isCharging ? <BatteryCharging size={16} /> : <Battery size={16} />}
                        </div>
                        </div>
                        </div>

                        {/* Sliders */}
                        <div className="space-y-3">
                        <Slider icon={Sun} value={brightness} onChange={(v:number) => {setBrightness(v); SystemBridge.setBrightness(v);}} />
                        <Slider icon={Volume2} value={volume} onChange={(v:number) => {setVolume(v); SystemBridge.setVolume(v);}} />
                        </div>
                        </div>
                    );
};

export default ControlCenter;
