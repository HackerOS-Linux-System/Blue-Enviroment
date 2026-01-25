import React, { useState, useEffect } from 'react';
import { AppId } from '../types';
import { APPS } from '../constants';
import { Search, Wifi, Bell, Command, CloudSun } from 'lucide-react';

interface TopBarProps {
    openWindows: { id: string; appId: AppId; isMinimized: boolean; isActive: boolean }[];
    onOpenApp: (appId: AppId) => void;
    onToggleWindow: (windowId: string) => void;
    onStartClick: () => void;
    onStartDoubleClick: () => void;
    onToggleControlCenter: () => void;
    onToggleNotifications: () => void;
    isStartMenuOpen: boolean;
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

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Handle single vs double click for Start Button
    const handleStartClick = (e: React.MouseEvent) => {
        if (e.detail === 1) {
            onStartClick();
        } else if (e.detail === 2) {
            onStartDoubleClick();
        }
    };

    const pinnedApps = [AppId.TERMINAL, AppId.EXPLORER, AppId.AI_ASSISTANT, AppId.SETTINGS];

    return (
        <div className="absolute top-0 left-0 right-0 h-12 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-3 z-50 select-none shadow-sm">

        {/* Left: Start & Branding */}
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

        {/* Global Search Trigger */}
        <div className="hidden md:flex items-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-white/5 rounded-full px-3 py-1 text-xs text-slate-400 cursor-text transition-colors w-48">
        <Search size={12} />
        <span>Search apps & files...</span>
        </div>
        </div>

        {/* Center: Active Apps Dock */}
        <div className="flex items-center justify-center w-1/3">
        <div className="flex items-center gap-1 bg-slate-800/30 border border-white/5 rounded-2xl px-3 py-1 backdrop-blur-md shadow-lg shadow-black/20">
        {pinnedApps.map((appId) => {
            const app = APPS[appId];
            const isOpen = openWindows.some(w => w.appId === appId);
            const isActive = openWindows.some(w => w.appId === appId && w.isActive && !w.isMinimized);

            return (
                <button
                key={appId}
                onClick={() => {
                    const openInstance = openWindows.find(w => w.appId === appId);
                    if (openInstance) {
                        onToggleWindow(openInstance.id);
                    } else {
                        onOpenApp(appId);
                    }
                }}
                className="relative group p-2 rounded-xl transition-all"
                >
                <app.icon
                size={20}
                className={`transition-all duration-300 ${isOpen ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
                />
                {/* Dot Indicator */}
                {isOpen && (
                    <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isActive ? 'bg-blue-400 w-3' : 'bg-slate-500'} transition-all`} />
                )}
                {/* Tooltip */}
                <div className="absolute top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 border border-white/10 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {app.title}
                </div>
                </button>
            );
        })}
        </div>
        </div>

        {/* Right: System Tray */}
        <div className="flex items-center justify-end gap-3 w-1/3">
        {/* Weather Widget */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full hover:bg-white/5 cursor-pointer transition-colors">
        <CloudSun size={16} className="text-yellow-200" />
        <span className="text-xs font-medium text-slate-200">18°C</span>
        </div>

        {/* Status Group */}
        <button
        onClick={onToggleControlCenter}
        className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors border border-transparent hover:border-white/5"
        >
        <Wifi size={14} className="text-slate-200" />
        <span className="text-xs font-medium text-slate-200">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        </button>

        {/* Notifications */}
        <button
        onClick={onToggleNotifications}
        className="relative p-2 rounded-full hover:bg-white/10 transition-colors group"
        >
        <Bell size={16} className="text-slate-300 group-hover:text-white" />
        <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 border border-slate-900 rounded-full"></span>
        </button>
        </div>
        </div>
    );
};

export default TopBar;
