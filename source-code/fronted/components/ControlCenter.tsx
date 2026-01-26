import React, { useState, useEffect } from 'react';
import { Wifi, Bluetooth, Volume2, Sun, Moon, Airplay, Signal, BatteryCharging, ChevronRight } from 'lucide-react';
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
    const [wifi, setWifi] = useState(true);
    const [bluetooth, setBluetooth] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [brightness, setBrightness] = useState(80);
    const [volume, setVolume] = useState(60);
    const [battery, setBattery] = useState(85);

    useEffect(() => {
        if (isOpen) {
            // Poll system stats when open
            SystemBridge.getSystemStats().then(stats => {
                setBattery(stats.battery);
                setBrightness(stats.brightness);
                setVolume(stats.volume);
            });
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

    const toggleWifi = (e: React.MouseEvent) => {
        e.stopPropagation();
        setWifi(!wifi);
        SystemBridge.toggleWifi(!wifi);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute top-16 right-4 w-80 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-5 duration-200">

        {/* Toggles Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="grid grid-rows-2 gap-3">
        <div className={`col-span-1 p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer group ${wifi ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={onOpenSettings}>
        <div className="bg-white/20 p-2 rounded-full" onClick={toggleWifi}><Wifi size={16} /></div>
        <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">Wi-Fi</div>
        <div className="text-[10px] opacity-70 truncate">{wifi ? 'BlueNet 5G' : 'Off'}</div>
        </div>
        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className={`col-span-1 p-3 rounded-2xl flex items-center gap-3 transition-colors cursor-pointer group ${bluetooth ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`} onClick={onOpenSettings}>
        <div className="bg-white/20 p-2 rounded-full" onClick={(e) => { e.stopPropagation(); setBluetooth(!bluetooth); }}><Bluetooth size={16} /></div>
        <div className="flex-1 min-w-0">
        <div className="text-xs font-bold">Bluetooth</div>
        <div className="text-[10px] opacity-70 truncate">{bluetooth ? 'On' : 'Off'}</div>
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
        <div className="text-xl font-bold text-green-400 flex items-center gap-2">
        {battery}% <BatteryCharging size={16} />
        </div>
        <div className="text-[10px] text-slate-500">Estimating...</div>
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
