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
        <div className="flex h-full bg-slate-900 text-slate-100">
        {/* Sidebar */}
        <div className="w-64 border-r border-white/5 bg-slate-900/50 flex flex-col">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <span className="font-bold flex items-center gap-2"><Smartphone size={18} className="text-blue-400" /> Devices</span>
        <button className="p-1.5 hover:bg-white/10 rounded-full"><RefreshCw size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
        <div className="p-4 border-t border-white/5 text-xs text-slate-500 text-center">
        Pair new device via Blue Connect Android App
        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-slate-950">
        {activeDevice ? (
            <>
            {/* Header */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/30">
            <div>
            <h2 className="text-xl font-bold">{activeDevice.name}</h2>
            <span className="text-xs text-slate-400 flex items-center gap-2">
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
            <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto">
            <div className="col-span-full mb-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
            </div>

            <button onClick={() => handleAction('Ping')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-3 transition-all group">
            <div className="p-3 bg-blue-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Wifi size={24} /></div>
            <span className="font-medium">Ping Device</span>
            </button>

            <button onClick={() => handleAction('Clipboard')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-3 transition-all group">
            <div className="p-3 bg-emerald-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Clipboard size={24} /></div>
            <span className="font-medium">Send Clipboard</span>
            </button>

            <button onClick={() => handleAction('File')} className="bg-slate-800/50 hover:bg-blue-600/20 hover:border-blue-500/50 border border-white/5 p-4 rounded-2xl flex flex-col items-center gap-3 transition-all group">
            <div className="p-3 bg-purple-500 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Share2 size={24} /></div>
            <span className="font-medium">Share File</span>
            </button>

            <div className="col-span-full mt-4 mb-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Multimedia Control</h3>
            </div>

            <div className="col-span-full bg-slate-800/30 border border-white/5 rounded-2xl p-6 flex items-center gap-6">
            <div className="w-20 h-20 bg-slate-800 rounded-xl flex items-center justify-center">
            <Music size={32} className="text-slate-600" />
            </div>
            <div className="flex-1">
            <div className="text-lg font-bold">Not Playing</div>
            <div className="text-sm text-slate-500">No media detected on {activeDevice.name}</div>
            <div className="mt-4 flex gap-4">
            <button className="p-2 bg-slate-700 rounded-full hover:bg-white text-slate-300 hover:text-black transition-colors">Prev</button>
            <button className="p-2 px-6 bg-blue-600 rounded-full hover:bg-blue-500 text-white transition-colors">Play</button>
            <button className="p-2 bg-slate-700 rounded-full hover:bg-white text-slate-300 hover:text-black transition-colors">Next</button>
            </div>
            </div>
            </div>

            <div className="col-span-full mt-4 mb-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Remote Input</h3>
            </div>

            <button className="col-span-1 p-4 bg-slate-800/50 border border-white/5 rounded-xl text-left hover:bg-white/5">
            <span className="font-bold block">Remote Keyboard</span>
            <span className="text-xs text-slate-400">Type on your device from here</span>
            </button>
            <button className="col-span-1 p-4 bg-slate-800/50 border border-white/5 rounded-xl text-left hover:bg-white/5">
            <span className="font-bold block">Presentation Mode</span>
            <span className="text-xs text-slate-400">Control slides</span>
            </button>

            </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Smartphone size={48} className="mb-4 opacity-20" />
            <p>Select a device to interact</p>
            </div>
        )}
        </div>
        </div>
    );
};

export default BlueConnectApp;
