import React from 'react';
import { WindowState, AppId } from '../types';
import { APPS } from '../constants';
import { Monitor } from 'lucide-react';

interface WindowSwitcherProps {
    windows: WindowState[];
    selectedIndex: number;
    isVisible: boolean;
}

const WindowSwitcher: React.FC<WindowSwitcherProps> = ({ windows, selectedIndex, isVisible }) => {
    if (!isVisible || windows.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xl animate-in fade-in duration-100">
        <div className="flex flex-col items-center gap-8 w-full max-w-5xl">
        <div className="text-white text-2xl font-light tracking-widest uppercase">Switch Window</div>

        <div className="flex gap-8 items-center justify-center flex-wrap px-10">
        {windows.map((win, index) => {
            const AppIcon = APPS[win.appId as AppId]?.icon || Monitor;
            const isSelected = index === selectedIndex;

            return (
                <div
                key={win.id}
                className={`relative flex flex-col items-center gap-4 p-6 rounded-3xl transition-all duration-200 ${
                    isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-blue-800 shadow-[0_0_50px_rgba(37,99,235,0.5)] scale-110 border-2 border-white/20'
                    : 'bg-slate-800/40 border border-white/5 opacity-60 scale-95'
                }`}
                style={{ width: '220px', height: '220px' }}
                >
                <div className={`w-24 h-24 flex items-center justify-center rounded-2xl shadow-xl ${isSelected ? 'bg-white/10' : 'bg-slate-900/50'}`}>
                {win.isExternal ? (
                    <Monitor size={48} className={isSelected ? 'text-white' : 'text-slate-400'} />
                ) : (
                    <AppIcon size={48} className={isSelected ? 'text-white' : 'text-slate-400'} />
                )}
                </div>

                <div className="flex flex-col items-center w-full">
                <span className={`text-lg font-bold truncate w-full text-center ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                {APPS[win.appId as AppId]?.title || win.title}
                </span>
                <span className="text-xs text-slate-400 font-mono truncate w-full text-center mt-1">
                {win.isExternal ? 'Running Externally' : 'Blue Application'}
                </span>
                </div>

                {isSelected && (
                    <div className="absolute -bottom-3 w-16 h-1 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                )}
                </div>
            );
        })}
        </div>
        </div>
        </div>
    );
};

export default WindowSwitcher;
