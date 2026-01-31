import React, { useState } from 'react';
import { Monitor, Camera, Clock } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const BlueScreenApp: React.FC<AppProps> = () => {
    const [delay, setDelay] = useState(0);

    const handleCapture = () => {
        setTimeout(() => {
            SystemBridge.takeScreenshot();
        }, delay * 1000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 p-6 items-center justify-center space-y-6">
        <div className="text-center">
        <Monitor size={48} className="mx-auto text-blue-400 mb-2" />
        <h2 className="text-xl font-bold text-white">Blue Screen</h2>
        <p className="text-sm text-slate-400">Spectacle-inspired capture tool</p>
        </div>

        <div className="w-full max-w-xs bg-slate-800 p-4 rounded-xl border border-white/5">
        <label className="flex items-center justify-between text-sm text-slate-300 mb-2">
        <span className="flex items-center gap-2"><Clock size={16} /> Delay (seconds)</span>
        <span className="font-mono bg-slate-900 px-2 rounded">{delay}s</span>
        </label>
        <input
        type="range" min="0" max="10" value={delay} onChange={e => setDelay(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
        />
        </div>

        <button
        onClick={handleCapture}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-semibold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
        <Camera size={20} />
        Capture Fullscreen
        </button>
        <p className="text-xs text-slate-500">Saves to ~/Pictures</p>
        </div>
    );
};

export default BlueScreenApp;
