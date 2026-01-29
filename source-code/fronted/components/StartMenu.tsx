import React, { useState, useEffect } from 'react';
import { APPS } from '../constants';
import { AppId, DesktopEntry } from '../types';
import { SystemBridge } from '../utils/systemBridge';
import { Search, Power, Grid, User, Box, Terminal as TerminalIcon, LogOut, Moon, RefreshCcw, LayoutGrid, X, Pin, PinOff } from 'lucide-react';

interface StartMenuProps {
    isOpen: boolean;
    isFullScreen: boolean;
    onOpenApp: (appId: string, isExternal?: boolean, exec?: string) => void;
    onClose: () => void;
    onToggleFullScreen: () => void;
    disabledApps?: string[];
    pinnedApps?: string[];
    onTogglePin?: (appId: string) => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, isFullScreen, onOpenApp, onClose, onToggleFullScreen, disabledApps = [], pinnedApps = [], onTogglePin }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [externalApps, setExternalApps] = useState<DesktopEntry[]>([]);
    const [showPowerMenu, setShowPowerMenu] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [username, setUsername] = useState('User');
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, appId: string } | null>(null);

    useEffect(() => {
        // Only fetch apps once on mount
        SystemBridge.getAllApps().then(setExternalApps);

        // Fetch Real Username
        SystemBridge.getSystemStats().then(stats => {
            if(stats.username) setUsername(stats.username);
        });

            // Clock for fullscreen mode
            const timer = setInterval(() => setCurrentTime(new Date()), 60000);
            return () => clearInterval(timer);
    }, []);

    const internalAppsList = Object.values(APPS).filter(app => !disabledApps.includes(app.id));
    const filteredInternal = internalAppsList.filter(app => app.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredExternal = externalApps.filter(app => app.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleLaunch = (appId: string, isExternal: boolean, exec?: string) => {
        onOpenApp(appId, isExternal, exec);
        onClose();
    };

    const handleContextMenu = (e: React.MouseEvent, appId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, appId });
    };

    const handlePinAction = () => {
        if (contextMenu && onTogglePin) {
            onTogglePin(contextMenu.appId);
            setContextMenu(null);
        }
    };

    // Close context menu on click elsewhere
    useEffect(() => {
        const close = () => setContextMenu(null);
        if (contextMenu) window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [contextMenu]);

    const getGreeting = () => {
        const hrs = currentTime.getHours();
        if (hrs < 12) return 'Good Morning';
        if (hrs < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const PowerMenu = () => (
        <div className="absolute bottom-14 left-4 bg-slate-800 border border-white/10 rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-48 z-50 animate-in fade-in slide-in-from-bottom-2">
        <button onClick={() => SystemBridge.powerAction('shutdown')} className="flex items-center gap-3 p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors text-left text-sm text-slate-200">
        <Power size={16} /> Shutdown
        </button>
        <button onClick={() => SystemBridge.powerAction('reboot')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors text-left text-sm text-slate-200">
        <RefreshCcw size={16} /> Restart
        </button>
        <button onClick={() => SystemBridge.powerAction('suspend')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors text-left text-sm text-slate-200">
        <Moon size={16} /> Sleep
        </button>
        <div className="h-px bg-white/10 my-1"></div>
        <button onClick={() => SystemBridge.powerAction('logout')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg transition-colors text-left text-sm text-slate-200">
        <LogOut size={16} /> Log Out
        </button>
        </div>
    );

    const ContextMenu = () => {
        if (!contextMenu) return null;
        const isPinned = pinnedApps.includes(contextMenu.appId);
        return (
            <div
            className="fixed z-[9999] bg-slate-800 border border-white/10 rounded-lg shadow-xl py-1 w-40"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            >
            <button onClick={handlePinAction} className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-blue-600 hover:text-white flex items-center gap-2">
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            {isPinned ? "Unpin" : "Pin to Taskbar"}
            </button>
            </div>
        );
    };

    // FULL SCREEN MODE
    if (isFullScreen) {
        if (!isOpen) return null;
        return (
            <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl z-40 flex flex-col pt-12 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto overflow-hidden"
            onClick={onClose}
            >
            <ContextMenu />
            {/* Explicit Close Button for clarity */}
            <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-red-500 hover:text-white rounded-full transition-colors z-50"
            >
            <X size={24} />
            </button>

            <div className="w-full max-w-6xl mx-auto px-8 h-full flex flex-col" onClick={e => e.stopPropagation()}>

            {/* Header Section */}
            <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-4">
            <div>
            <h1 className="text-4xl font-light text-white mb-1">{currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</h1>
            <p className="text-blue-400 text-lg">{getGreeting()}, {username}</p>
            </div>
            <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
            type="text" placeholder="Search applications, files, and settings..."
            className="w-full bg-slate-900/50 border border-white/10 rounded-full py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 shadow-xl transition-all"
            autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
            </div>
            <button onClick={onToggleFullScreen} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white" title="Switch to Mini Menu">
            <LayoutGrid size={20} />
            </button>
            </div>

            {/* Content Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 pr-2">
            {/* System Apps Section */}
            <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Applications</h2>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {filteredInternal.map((app) => (
                <button
                key={app.id}
                onClick={() => handleLaunch(app.id, false)}
                onContextMenu={(e) => handleContextMenu(e, app.id)}
                className="flex flex-col items-center gap-3 group p-4 rounded-xl hover:bg-white/5 transition-all relative"
                >
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-300">
                {typeof app.icon !== 'string' && <app.icon size={32} className="text-blue-400 group-hover:text-white transition-colors" />}
                </div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white text-center">{app.title}</span>
                {pinnedApps.includes(app.id) && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />}
                </button>
            ))}
            </div>
            </div>

            {/* Installed Apps Section */}
            {filteredExternal.length > 0 && (
                <div>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Installed Applications</h2>
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {filteredExternal.map((app) => (
                    <button
                    key={app.id}
                    onClick={() => handleLaunch(app.id, true, app.exec)}
                    onContextMenu={(e) => handleContextMenu(e, app.id)}
                    className="flex flex-col items-center gap-3 group p-4 rounded-xl hover:bg-white/5 transition-all relative"
                    >
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-300">
                    <Box size={32} className="text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white text-center line-clamp-2">{app.name}</span>
                    {pinnedApps.includes(app.id) && <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </button>
                ))}
                </div>
                </div>
            )}
            </div>
            </div>
            </div>
        );
    }

    // COMPACT MODE
    return (
        <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-14 left-3 w-80 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-3xl shadow-2xl overflow-visible z-50 flex flex-col transition-all duration-200 ease-in-out ${
            isOpen
            ? 'opacity-100 translate-y-0 scale-100 visible pointer-events-auto'
            : 'opacity-0 -translate-y-4 scale-95 invisible pointer-events-none'
        }`}
        >
        <ContextMenu />

        {/* Profile */}
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-800/50">
        <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
        <User size={20} />
        </div>
        <div>
        <div className="text-sm font-bold text-white truncate max-w-[150px]">{username}</div>
        <div className="text-[10px] text-blue-300">Blue Environment</div>
        </div>
        </div>
        <button onClick={onToggleFullScreen} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors" title="Full Screen">
        <Grid size={18} />
        </button>
        </div>

        <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar flex-1">
        {filteredInternal.slice(0, 5).map((app) => (
            <button
            key={app.id}
            onClick={() => handleLaunch(app.id, false)}
            onContextMenu={(e) => handleContextMenu(e, app.id)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group relative"
            >
            <div className="p-2 bg-slate-800 rounded-lg group-hover:scale-105 border border-white/5">
            {typeof app.icon !== 'string' && <app.icon size={18} className="text-blue-400" />}
            </div>
            <span className="text-sm text-slate-200 group-hover:text-white font-medium">{app.title}</span>
            {pinnedApps.includes(app.id) && <Pin size={10} className="ml-auto text-slate-500" />}
            </button>
        ))}
        {filteredExternal.length > 0 && (
            <>
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2">Apps</div>
            {filteredExternal.slice(0, 6).map((app) => (
                <button
                key={app.id}
                onClick={() => handleLaunch(app.id, true, app.exec)}
                onContextMenu={(e) => handleContextMenu(e, app.id)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group relative"
                >
                <div className="p-2 bg-slate-800 rounded-lg group-hover:scale-105 border border-white/5">
                <TerminalIcon size={18} className="text-green-400" />
                </div>
                <span className="text-sm text-slate-200 group-hover:text-white font-medium truncate">{app.name}</span>
                {pinnedApps.includes(app.id) && <Pin size={10} className="ml-auto text-slate-500" />}
                </button>
            ))}
            </>
        )}
        </div>

        <div className="mt-auto p-3 border-t border-white/5 bg-slate-950 flex items-center justify-between relative">
        <div className="relative flex-1 mr-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
        type="text" placeholder="Find..."
        className="w-full bg-slate-900 border border-white/10 rounded-full py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-blue-500/50"
        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />
        </div>
        <button onClick={() => setShowPowerMenu(!showPowerMenu)} className="p-2 rounded-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all">
        <Power size={16} />
        </button>
        {showPowerMenu && <PowerMenu />}
        </div>
        </div>
    );
};

export default StartMenu;
