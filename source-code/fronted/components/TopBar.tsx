import React, { useState, useEffect } from 'react';
import { AppId } from '../types';
import { APPS } from '../constants';
import { Search, Wifi, Bell, Command, CloudSun, Battery, BatteryCharging } from 'lucide-react';
import { SystemBridge } from '../utils/systemBridge';

interface TopBarProps {
    openWindows: { id: string; appId: AppId; isMinimized: boolean; isActive: boolean }[];
    onOpenApp: (appId: AppId) => void;
    onToggleWindow: (windowId: string) => void;
    onStartClick: () => void;
    onStartDoubleClick: () => void;
    onToggleControlCenter: () => void;
    onToggleNotifications: () => void;
    isStartMenuOpen: boolean;
    position?: 'top' | 'bottom';
}

const TopBar: React.FC<TopBarProps> = ({
    openWindows,
    onOpenApp,
    onToggleWindow,
    onStartClick,
    onStartDoubleClick,
    onToggleControlCenter,
    onToggleNotifications,
    isStartMenuOpen
}) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState({ temp: '--', condition: 'Loading' });
    const [battery, setBattery] = useState({ level: 100, isCharging: false });
    const [wifiConnected, setWifiConnected] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());

            // Poll System Stats
            SystemBridge.getSystemStats().then(stats => {
                setBattery({ level: stats.battery, isCharging: stats.is_charging });
                setWifiConnected(stats.wifi_ssid !== 'Disconnected' && stats.wifi_ssid !== 'Off');
            });

        }, 2000);

        // Initial fetch
        SystemBridge.getSystemStats().then(stats => {
            setBattery({ level: stats.battery, isCharging: stats.is_charging });
            setWifiConnected(stats.wifi_ssid !== 'Disconnected' && stats.wifi_ssid !== 'Off');
        });

        // Simple weather fetch based on IP
        fetch('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true')
        .then(r => r.json())
        .then(data => {
            if(data.current_weather) {
                setWeather({
                    temp: data.current_weather.temperature + '°C',
                    condition: 'Clear' // Simplified
                });
            }
        })
        .catch(e => console.log("Weather fetch failed", e));

        return () => clearInterval(timer);
    }, []);

    const handleStartClick = (e: React.MouseEvent) => {
        if (e.detail === 1) onStartClick();
        else if (e.detail === 2) onStartDoubleClick();
    };

        const pinnedApps = [AppId.TERMINAL, AppId.EXPLORER, AppId.BLUE_SOFTWARE, AppId.SETTINGS];

        return (
            <div className="absolute top-0 left-0 right-0 h-12 bg-slate-900 border-b border-white/5 flex items-center justify-between px-3 z-50 select-none shadow-sm pointer-events-auto">
            <div className="flex items-center gap-4 w-1/3">
            <button
            onClick={handleStartClick}
            className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 group ${
                isStartMenuOpen ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5 text-slate-300 hover:text-white'
            }`}
            >
            <div className="relative">
            <Command size={18} className="group-hover:rotate-12 transition-transform" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-sm tracking-tight hidden sm:block">Blue</span>
            </button>

            <div className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-full px-3 py-1 text-xs text-slate-400 cursor-text transition-colors w-48" onClick={onStartClick}>
            <Search size={12} />
            <span>Search apps & files...</span>
            </div>
            </div>

            <div className="flex items-center justify-center w-1/3">
            <div className="flex items-center gap-1 bg-slate-800 border border-white/5 rounded-2xl px-3 py-1 shadow-lg shadow-black/20">
            {pinnedApps.map((appId) => {
                const app = APPS[appId];
                const isOpen = openWindows.some(w => w.appId === appId);
                const isActive = openWindows.some(w => w.appId === appId && w.isActive && !w.isMinimized);
                return (
                    <button
                    key={appId}
                    onClick={() => {
                        const openInstance = openWindows.find(w => w.appId === appId);
                        if (openInstance) onToggleWindow(openInstance.id);
                        else onOpenApp(appId);
                    }}
                    className="relative group p-2 rounded-xl transition-all"
                    >
                    <app.icon size={20} className={`transition-all duration-300 ${isOpen ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`} />
                    {isOpen && <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isActive ? 'bg-blue-400 w-3' : 'bg-slate-500'} transition-all`} />}
                    </button>
                );
            })}
            </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-1/3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white/5 cursor-pointer transition-colors">
            <CloudSun size={16} className="text-yellow-200" />
            <span className="text-xs font-medium text-slate-200">{weather.temp}</span>
            </div>

            <button onClick={onToggleControlCenter} className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-transparent hover:border-white/5">
            <Wifi size={14} className={wifiConnected ? "text-slate-200" : "text-slate-500"} />
            <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-slate-200 leading-none">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex items-center gap-1">
            <span className={`text-[9px] ${battery.level < 20 ? 'text-red-400' : 'text-slate-400'}`}>{Math.round(battery.level)}%</span>
            {battery.isCharging ? <BatteryCharging size={10} className="text-green-400" /> : <Battery size={10} className="text-slate-500" />}
            </div>
            </div>
            </button>

            <button onClick={onToggleNotifications} className="relative p-2 rounded-full hover:bg-white/10 transition-colors group">
            <Bell size={16} className="text-slate-300 group-hover:text-white" />
            <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 border border-slate-900 rounded-full"></span>
            </button>
            </div>
            </div>
        );
};

export default TopBar;
