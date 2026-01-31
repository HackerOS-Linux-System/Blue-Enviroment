import React, { useState, useEffect, useRef } from 'react';
import { AppId } from '../types';
import { APPS } from '../constants';
import { Search, Wifi, Bell, Command, CloudSun, Battery, BatteryCharging, Calendar, ChevronLeft, ChevronRight, Layout, Maximize2, Minimize2, Box } from 'lucide-react';
import { SystemBridge } from '../utils/systemBridge';

interface TopBarProps {
    openWindows: { id: string; appId: AppId; isMinimized: boolean; isActive: boolean; desktopId?: number }[];
    onOpenApp: (appId: AppId) => void;
    onToggleWindow: (windowId: string) => void;
    onStartClick: () => void;
    onStartDoubleClick: () => void;
    onToggleControlCenter: () => void;
    onToggleNotifications: () => void;
    isStartMenuOpen: boolean;
    position?: 'top' | 'bottom';
    unreadNotifications?: number;
    currentDesktop?: number;
    onSwitchDesktop?: (id: number) => void;
    pinnedApps?: string[];
    disabledApps?: string[];
}

const CalendarWidget = () => {
    const [date, setDate] = useState(new Date());
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Simple calendar logic
    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const startDay = getFirstDay(currentYear, currentMonth);
    const today = new Date().getDate();

    const changeMonth = (delta: number) => {
        setDate(new Date(currentYear, currentMonth + delta, 1));
    };

    return (
        <div className="absolute top-14 right-16 bg-slate-800 border border-white/10 p-4 rounded-2xl shadow-2xl w-72 animate-in slide-in-from-top-2 z-[60]">
        <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-lg">{date.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <div className="flex gap-1">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={16} /></button>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={16} /></button>
        </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-slate-400">
        {days.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const isToday = d === today && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
            return (
                <div key={d} className={`w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white font-bold' : 'hover:bg-white/10'}`}>
                {d}
                </div>
            );
        })}
        </div>
        </div>
    );
};

// --- Window Preview Component ---
const WindowPreview = ({ appId, title, isMinimized }: { appId: string, title: string, isMinimized: boolean }) => {
    return (
        <div className="absolute top-14 bg-slate-800/90 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-2xl z-[70] flex flex-col gap-2 w-48 animate-in fade-in zoom-in-95 duration-200 pointer-events-none transform -translate-x-1/2 left-1/2">
        <div className="flex items-center gap-2 px-1 border-b border-white/5 pb-1">
        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
        <span className="text-xs font-bold text-white truncate flex-1">{title}</span>
        {isMinimized ? <Minimize2 size={10} className="text-slate-500"/> : <Maximize2 size={10} className="text-slate-500"/>}
        </div>
        {/* Simulated Content Snapshot */}
        <div className="w-full h-24 bg-slate-950 rounded-lg flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-50 bg-gradient-to-br from-blue-500/10 to-transparent"></div>
        <span className="text-[10px] text-slate-500 font-mono truncate px-2">{appId}</span>
        </div>
        </div>
    );
};


const TopBar: React.FC<TopBarProps> = ({
    openWindows,
    onOpenApp,
    onToggleWindow,
    onStartClick,
    onStartDoubleClick,
    onToggleControlCenter,
    onToggleNotifications,
    isStartMenuOpen,
    unreadNotifications = 0,
    currentDesktop = 0,
    onSwitchDesktop,
    pinnedApps,
    disabledApps = []
}) => {
    const [time, setTime] = useState(new Date());
    const [weather, setWeather] = useState({ temp: '--', condition: 'Loading' });
    const [battery, setBattery] = useState({ level: 100, isCharging: false });
    const [wifiConnected, setWifiConnected] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);

    // Hover state for taskbar items
    const [hoveredAppId, setHoveredAppId] = useState<string | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Default apps if configuration is missing or empty
    const DEFAULT_PINS = [AppId.TERMINAL, AppId.EXPLORER, AppId.BLUE_WEB, AppId.SETTINGS];
    const effectivePinnedApps = (pinnedApps && pinnedApps.length > 0) ? pinnedApps : DEFAULT_PINS;

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());

            // Poll System Stats
            SystemBridge.getSystemStats().then(stats => {
                setBattery({ level: stats.battery, isCharging: stats.is_charging });
                setWifiConnected(stats.wifi_ssid !== 'Disconnected' && stats.wifi_ssid !== 'Off');
            });

        }, 2000);

        SystemBridge.getSystemStats().then(stats => {
            setBattery({ level: stats.battery, isCharging: stats.is_charging });
            setWifiConnected(stats.wifi_ssid !== 'Disconnected' && stats.wifi_ssid !== 'Off');
        });

        // Mock Weather
        fetch('https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true')
        .then(r => r.json())
        .then(data => {
            if(data.current_weather) {
                setWeather({
                    temp: data.current_weather.temperature + '°C',
                    condition: 'Clear'
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

        const handleMouseEnter = (appId: string) => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = setTimeout(() => {
                setHoveredAppId(appId);
            }, 300); // 300ms delay before showing preview
        };

        const handleMouseLeave = () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setHoveredAppId(null);
        };

        // Merge Pinned and Open Windows (unique IDs)
        const taskbarItems = Array.from(new Set([
            ...effectivePinnedApps,
            ...openWindows.map(w => w.appId)
        ])).filter(id => !disabledApps.includes(id));

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

            {/* Virtual Desktops */}
            <div className="hidden lg:flex bg-slate-800 rounded-lg p-0.5 border border-white/5">
            <button onClick={() => onSwitchDesktop && onSwitchDesktop(0)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${currentDesktop === 0 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>1</button>
            <button onClick={() => onSwitchDesktop && onSwitchDesktop(1)} className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${currentDesktop === 1 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>2</button>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-full px-3 py-1 text-xs text-slate-400 cursor-text transition-colors w-32" onClick={onStartClick}>
            <Search size={12} />
            <span>Search...</span>
            </div>
            </div>

            <div className="flex items-center justify-center w-1/3">
            <div className="flex items-center gap-1 bg-slate-800 border border-white/5 rounded-2xl px-3 py-1 shadow-lg shadow-black/20 relative">
            {taskbarItems.map((appId) => {
                const app = APPS[appId as AppId];
                // If app is not in APPS (e.g. dynamic external), fallback
                const appTitle = app ? app.title : appId;
                const AppIcon = app ? app.icon : Box;

                // Check if open instance exists
                const openInstance = openWindows.find(w => w.appId === appId && (w.desktopId === currentDesktop || w.isMinimized));
                const isOpen = !!openInstance;
                const isActive = openWindows.some(w => w.appId === appId && w.isActive && !w.isMinimized && w.desktopId === currentDesktop);

                return (
                    <div key={appId} className="relative">
                    <button
                    onClick={() => {
                        if (openInstance) onToggleWindow(openInstance.id);
                        else onOpenApp(appId as AppId);
                    }}
                    onMouseEnter={() => isOpen && handleMouseEnter(appId)}
                    onMouseLeave={handleMouseLeave}
                    className="relative group p-2 rounded-xl transition-all"
                    >
                    <AppIcon size={20} className={`transition-all duration-300 ${isOpen ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'} ${isActive ? 'scale-110' : ''}`} />
                    {isOpen && <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isActive ? 'bg-blue-400 w-3' : 'bg-slate-500'} transition-all`} />}
                    </button>

                    {/* Live Preview Tooltip */}
                    {hoveredAppId === appId && isOpen && openInstance && (
                        <WindowPreview
                        appId={appTitle}
                        title={appTitle}
                        isMinimized={openInstance.isMinimized}
                        />
                    )}
                    </div>
                );
            })}
            </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-1/3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white/5 cursor-pointer transition-colors">
            <CloudSun size={16} className="text-yellow-200" />
            <span className="text-xs font-medium text-slate-200">{weather.temp}</span>
            </div>

            <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-transparent hover:border-white/5"
            >
            <Wifi size={14} className={wifiConnected ? "text-slate-200" : "text-slate-500"} />
            <div className="flex flex-col items-end">
            <span className="text-xs font-medium text-slate-200 leading-none">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="flex items-center gap-1">
            <span className={`text-[9px] ${battery.level < 20 ? 'text-red-400' : 'text-slate-400'}`}>{Math.round(battery.level)}%</span>
            {battery.isCharging ? <BatteryCharging size={10} className="text-green-400" /> : <Battery size={10} className="text-slate-500" />}
            </div>
            </div>
            </button>

            {showCalendar && (
                <>
                <div className="fixed inset-0 z-50 bg-transparent" onClick={() => setShowCalendar(false)} />
                <CalendarWidget />
                </>
            )}

            <button onClick={onToggleControlCenter} className="relative p-2 rounded-full hover:bg-white/10 transition-colors group">
            <Layout size={16} className="text-slate-300 group-hover:text-white" />
            </button>

            <button onClick={onToggleNotifications} className="relative p-2 rounded-full hover:bg-white/10 transition-colors group">
            <Bell size={16} className="text-slate-300 group-hover:text-white" />
            {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 border border-slate-900 rounded-full"></span>
            )}
            </button>
            </div>
            </div>
        );
};

export default TopBar;
