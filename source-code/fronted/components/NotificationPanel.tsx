import React, { useEffect, useState } from 'react';
import { X, Cpu, Battery, Wifi } from 'lucide-react';
import { SystemBridge } from '../utils/systemBridge';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if(isOpen) {
            SystemBridge.getSystemStats().then(setStats);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="absolute top-16 right-4 bottom-4 w-96 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-40 animate-in slide-in-from-right-10 duration-300 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-lg text-white">System Status</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 p-1 rounded-full"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {stats && (
            <>
            {stats.cpu > 80 && (
                <div className="bg-slate-800 border border-red-500/20 rounded-2xl p-3 flex gap-3">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400"><Cpu size={18} /></div>
                <div>
                <div className="text-sm font-bold text-white">High CPU Usage</div>
                <div className="text-xs text-slate-400">Processor load is at {stats.cpu.toFixed(1)}%</div>
                </div>
                </div>
            )}

            <div className="bg-slate-800 border border-white/5 rounded-2xl p-3 flex gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400"><Wifi size={18} /></div>
            <div>
            <div className="text-sm font-bold text-white">Network</div>
            <div className="text-xs text-slate-400">Connected to {stats.wifi_ssid}</div>
            </div>
            </div>

            <div className="bg-slate-800 border border-white/5 rounded-2xl p-3 flex gap-3">
            <div className="p-2 rounded-xl bg-green-500/20 text-green-400"><Battery size={18} /></div>
            <div>
            <div className="text-sm font-bold text-white">Battery</div>
            <div className="text-xs text-slate-400">{stats.battery}% remaining</div>
            </div>
            </div>
            </>
        )}
        {!stats && <div className="text-center text-slate-500">Loading system stats...</div>}
        </div>
        </div>
    );
};

export default NotificationPanel;
