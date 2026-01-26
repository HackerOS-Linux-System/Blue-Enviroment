import React from 'react';
import { WindowState, AppId } from '../types';
import { APPS } from '../constants';

interface WindowSwitcherProps {
    windows: WindowState[];
    selectedIndex: number;
    isVisible: boolean;
}

const WindowSwitcher: React.FC<WindowSwitcherProps> = ({ windows, selectedIndex, isVisible }) => {
    if (!isVisible || windows.length === 0) return null;

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-slate-800/90 border border-white/10 p-4 rounded-2xl shadow-2xl flex gap-4 items-center max-w-[90vw] overflow-x-auto">
        {windows.map((win, index) => {
            const AppIcon = APPS[win.appId as AppId]?.icon;
            const isSelected = index === selectedIndex;

            return (
                <div
                key={win.id}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all w-32 ${
                    isSelected
                    ? 'bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/50'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
                >
                <div className="w-12 h-12 flex items-center justify-center">
                {AppIcon ? <AppIcon size={32} /> : <div className="w-8 h-8 bg-slate-500 rounded" />}
                </div>
                <span className="text-xs font-medium truncate w-full text-center">
                {win.title}
                </span>
                {/* Mini Preview Box Representation */}
                <div className={`w-20 h-12 rounded border mt-2 ${isSelected ? 'bg-white/20 border-white/30' : 'bg-black/20 border-white/5'}`}></div>
                </div>
            );
        })}
        </div>
        </div>
    );
};

export default WindowSwitcher;
