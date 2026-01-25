import React, { useState, useEffect } from 'react';
import { Monitor, Lock, Wifi, Bluetooth, Battery, Volume2, Image as ImageIcon } from 'lucide-react';
import { AppProps, UserConfig } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const SettingsApp: React.FC<AppProps> = () => {
    const [config, setConfig] = useState<UserConfig | null>(null);

    useEffect(() => {
        SystemBridge.loadConfig().then(setConfig);
    }, []);

    const handleSave = (newConfig: Partial<UserConfig>) => {
        if (!config) return;
        const updated = { ...config, ...newConfig };
        setConfig(updated);
        SystemBridge.saveConfig(updated);
    };

    if (!config) return <div className="p-4 text-white">Loading system config...</div>;

    return (
        <div className="flex h-full bg-slate-900 text-slate-100">
        <div className="w-1/3 bg-slate-950/50 border-r border-white/5 p-4 space-y-2">
        <h2 className="text-xl font-bold mb-6 px-2">Settings</h2>
        <div className="flex items-center gap-3 p-2 rounded-lg bg-blue-600 text-white">
        <Monitor size={18} /> Display & Wallpaper
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer">
        <Wifi size={18} /> Network
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer">
        <Bluetooth size={18} /> Bluetooth
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer">
        <Lock size={18} /> Privacy
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer">
        <Battery size={18} /> Power
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer">
        <Volume2 size={18} /> Sound
        </div>
        </div>
        <div className="flex-1 p-8 overflow-y-auto">
        <h3 className="text-lg font-medium mb-4">Display & Appearance</h3>

        <div className="space-y-6">

        {/* Wallpaper Selector */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5">
        <label className="block text-sm text-slate-400 mb-3 flex items-center gap-2">
        <ImageIcon size={16} /> Wallpaper
        </label>
        <div className="grid grid-cols-3 gap-2">
        <img
        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=300"
        className={`rounded-lg cursor-pointer border-2 ${config.wallpaper.includes('1451187') ? 'border-blue-500' : 'border-transparent'}`}
        onClick={() => handleSave({ wallpaper: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072" })}
        />
        <img
        src="https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=300"
        className={`rounded-lg cursor-pointer border-2 ${config.wallpaper.includes('14773') ? 'border-blue-500' : 'border-transparent'}`}
        onClick={() => handleSave({ wallpaper: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=2072" })}
        />
        <div className="rounded-lg bg-slate-700 flex items-center justify-center text-xs text-slate-400 cursor-pointer hover:bg-slate-600 transition-colors">
        Load from /usr/share...
        </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Current: {config.wallpaper.substring(0, 30)}...</p>
        </div>

        <div>
        <label className="block text-sm text-slate-400 mb-2">Resolution</label>
        <select className="w-full bg-slate-800 border border-white/10 rounded p-2 text-sm text-white focus:border-blue-500 outline-none">
        <option>1920 x 1080 (Recommended)</option>
        <option>2560 x 1440</option>
        <option>3840 x 2160</option>
        </select>
        </div>

        <div>
        <label className="block text-sm text-slate-400 mb-2">Scale</label>
        <div className="flex items-center gap-4">
        <input
        type="range" min="50" max="200" value={config.displayScale * 100}
        onChange={(e) => handleSave({ displayScale: parseInt(e.target.value) / 100 })}
        className="flex-1"
        />
        <span className="text-sm">{Math.round(config.displayScale * 100)}%</span>
        </div>
        </div>

        <div className="flex items-center justify-between">
        <span className="text-sm">Night Light</span>
        <div className="w-10 h-6 bg-slate-700 rounded-full p-1 cursor-pointer">
        <div className="w-4 h-4 bg-white rounded-full"></div>
        </div>
        </div>
        </div>
        </div>
        </div>
    );
};

export default SettingsApp;
