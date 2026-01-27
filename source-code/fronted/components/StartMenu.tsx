import React, { useState, useEffect } from 'react';
import { APPS } from '../constants';
import { AppId, DesktopEntry } from '../types';
import { SystemBridge } from '../utils/systemBridge';
import { Search, Power, Grid, User, Box, Terminal as TerminalIcon, LogOut, Moon, RefreshCcw } from 'lucide-react';

interface StartMenuProps {
    isOpen: boolean;
    isFullScreen: boolean;
    onOpenApp: (appId: string, isExternal?: boolean, exec?: string) => void;
    onClose: () => void;
    onToggleFullScreen: () => void;
}

const StartMenu: React.FC<StartMenuProps> = ({ isOpen, isFullScreen, onOpenApp, onClose, onToggleFullScreen }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [externalApps, setExternalApps] = useState<DesktopEntry[]>([]);
    const [showPowerMenu, setShowPowerMenu] = useState(false);

    useEffect(() => {
        // Only fetch apps once on mount, not every time the menu opens
        SystemBridge.getAllApps().then(setExternalApps);
    }, []);

    const internalAppsList = Object.values(APPS);
    const filteredInternal = internalAppsList.filter(app => app.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredExternal = externalApps.filter(app => app.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleLaunch = (appId: string, isExternal: boolean, exec?: string) => {
        onOpenApp(appId, isExternal, exec);
        onClose();
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

    // FULL SCREEN MODE
    if (isFullScreen) {
        if (!isOpen) return null;
        return (
            <div
            className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl z-40 flex flex-col items-center justify-start pt-24 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto"
            onClick={onClose}
            >
            <div className="w-full max-w-4xl px-4" onClick={e => e.stopPropagation()}>
            <div className="relative mb-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
            <input
            type="text" placeholder="Search system applications..."
            className="w-full bg-slate-800 border border-white/10 rounded-2xl py-4 pl-14 pr-4 text-xl text-white focus:outline-none focus:border-blue-500 shadow-2xl"
            autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
            </div>
            <div className="h-[60vh] overflow-y-auto custom-scrollbar pb-20">
            <div className="grid grid-cols-6 gap-6">
            {filteredInternal.map((app) => (
                <button key={app.id} onClick={() => handleLaunch(app.id, false)} className="flex flex-col items-center gap-3 group">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/10 flex items-center justify-center group-hover:bg-blue-600 transition-all shadow-xl">
                {typeof app.icon !== 'string' && <app.icon size={32} className="text-blue-400 group-hover:text-white" />}
                </div>
                <span className="text-sm font-medium text-slate-200 group-hover:text-white">{app.title}</span>
                </button>
            ))}
            {filteredExternal.map((app) => (
                <button key={app.id} onClick={() => handleLaunch(app.id, true, app.exec)} className="flex flex-col items-center gap-3 group">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-white/10 flex items-center justify-center group-hover:bg-green-600 transition-all shadow-xl">
                <Box size={32} className="text-slate-400 group-hover:text-white" />
                </div>
                <span className="text-sm font-medium text-slate-200 group-hover:text-white text-center line-clamp-2">{app.name}</span>
                </button>
            ))}
            </div>
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

        {/* Profile */}
        <div className="p-4 flex items-center justify-between border-b border-white/5 bg-slate-800/50">
        <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
        <User size={20} />
        </div>
        <div>
        <div className="text-sm font-bold text-white">Debian User</div>
        <div className="text-[10px] text-blue-300">Blue Environment</div>
        </div>
        </div>
        <button onClick={onToggleFullScreen} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
        <Grid size={18} />
        </button>
        </div>

        <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar flex-1">
        {filteredInternal.slice(0, 5).map((app) => (
            <button key={app.id} onClick={() => handleLaunch(app.id, false)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
            <div className="p-2 bg-slate-800 rounded-lg group-hover:scale-105 border border-white/5">
            {typeof app.icon !== 'string' && <app.icon size={18} className="text-blue-400" />}
            </div>
            <span className="text-sm text-slate-200 group-hover:text-white font-medium">{app.title}</span>
            </button>
        ))}
        {filteredExternal.length > 0 && (
            <>
            <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2">Apps</div>
            {filteredExternal.slice(0, 6).map((app) => (
                <button key={app.id} onClick={() => handleLaunch(app.id, true, app.exec)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
                <div className="p-2 bg-slate-800 rounded-lg group-hover:scale-105 border border-white/5">
                <TerminalIcon size={18} className="text-green-400" />
                </div>
                <span className="text-sm text-slate-200 group-hover:text-white font-medium truncate">{app.name}</span>
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
