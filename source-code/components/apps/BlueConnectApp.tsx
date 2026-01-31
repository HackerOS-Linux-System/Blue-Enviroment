import React, { useState } from 'react';
import { Smartphone, RefreshCw, Share2, Clipboard, Image, Music, Battery, Tablet, Laptop, MoreVertical, Wifi } from 'lucide-react';
import { AppProps } from '../../types';

interface Device {
    id: string;
    name: string;
    type: 'phone' | 'tablet' | 'laptop';
    battery: number;
    status: 'connected' | 'disconnected';
    ip: string;
}

const BlueConnectApp: React.FC<AppProps> = () => {
    const [devices, setDevices] = useState<Device[]>([
        { id: '1', name: "Pixel 8 Pro", type: 'phone', battery: 85, status: 'connected', ip: '192.168.1.45' },
        { id: '2', name: "Galaxy Tab S9", type: 'tablet', battery: 100, status: 'disconnected', ip: '192.168.1.12' },
        { id: '3', name: "MacBook Air", type: 'laptop', battery: 45, status: 'connected', ip: '192.168.1.67' },
    ]);
    const [selectedId, setSelectedId] = useState<string>(devices[0].id);

    const activeDevice = devices.find(d => d.id === selectedId);

    const handleAction = (action: string) => {
        alert(`${action} sent to ${activeDevice?.name}`);
    };

    return (
        <div className="flex h-full bg-slate-900 text-slate-100 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/5 bg-slate-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <span className="font-bold flex items-center gap-2"><Smartphone size={18} className="text-blue-400" /> Devices</span>
        <button className="p-1.5 hover:bg-white/10 rounded-full"><RefreshCw size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {devices.map(dev => (
            <button
            key={dev.id}
            onClick={() => setSelectedId(dev.id)}
            className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${selectedId === dev.id ? 'bg-blue-600 shadow-lg shadow-blue-500/20' : 'hover:bg-white/5'}`}
            >
            <div className={`p-2 rounded-lg ${selectedId === dev.id ? 'bg-white/20' : 'bg-slate-800'}`}>
            {dev.type === 'phone' && <Smartphone size={18} />}
            {dev.type === 'tablet' && <Tablet size={18} />}
            {dev.type === 'laptop' && <Laptop size={18} />}
            </div>
            <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{dev.name}</div>
            <div className="text-[10px] opacity-70 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${dev.status === 'connected' ? 'bg-green-400' : 'bg-slate-500'}`} />
            {dev.status}
            </div>
            </div>
            </button>
        ))}
        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-950 min-w-0">
        {activeDevice ? (
            <>
            {/* Header */}
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/30 shrink-0">
            <div>
            <h2 className="text-2xl font-bold">{activeDevice.name}</h2>
            <span className="text-xs text-slate-400 flex items-center gap-2 mt-1">
            <Wifi size={12} /> {activeDevice.ip}
            </span>
            </div>
            <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-white/5">
            <Battery size={16} className={activeDevice.battery < 20 ? 'text-red-400' : 'text-green-400'} />
            <span className="text-sm font-mono">{activeDevice.battery}%</span>
            </div>
            <button className="p-2 hover:bg-white/10 rounded-full"><MoreVertical size={18} /></button>
            </div>
            </div>

            {/* Grid */}
            <div className="p-8 grid grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar">
            <div className="col-span-full">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Quick Actions</h3>
            </div>

            <button onClick={() => handleAction('Ping')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-4 transition-all group">
            <div className="p-4 bg-blue-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Wifi size={24} /></div>
            <span className="font-medium text-lg">Ping Device</span>
            </button>

            <button onClick={() => handleAction('Clipboard')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-4 transition-all group">
            <div className="p-4 bg-emerald-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Clipboard size={24} /></div>
            <span className="font-medium text-lg">Send Clipboard</span>
            </button>

            <button onClick={() => handleAction('File')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-4 transition-all group">
            <div className="p-4 bg-purple-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Share2 size={24} /></div>
            <span className="font-medium text-lg">Share File</span>
            </button>

            <div className="col-span-full mt-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Multimedia Control</h3>
            </div>

            <div className="col-span-full bg-slate-800/30 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-8">
            <div className="w-24 h-24 bg-slate-800 rounded-2xl flex items-center justify-center shadow-inner">
            <Music size={40} className="text-slate-600" />
            </div>
            <div className="flex-1 text-center sm:text-left">
            <div className="text-xl font-bold">Not Playing</div>
            <div className="text-sm text-slate-500">No media detected on {activeDevice.name}</div>
            <div className="mt-6 flex gap-4 justify-center sm:justify-start">
            <button className="p-3 bg-slate-700 rounded-full hover:bg-white text-slate-300 hover:text-black transition-colors"><Image size={16} className="rotate-180" /></button>
            <button className="p-3 px-8 bg-blue-600 rounded-full hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/20">Play</button>
            <button className="p-3 bg-slate-700 rounded-full hover:bg-white text-slate-300 hover:text-black transition-colors"><Image size={16} /></button>
            </div>
            </div>
            </div>
            </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Smartphone size={64} className="mb-6 opacity-20" />
            <p className="text-lg">Select a device to interact</p>
            </div>
        )}
        </div>
        </div>
    );
};

export default BlueConnectApp;
