import React, { useEffect, useState } from 'react';
import { Activity, Cpu, CircuitBoard } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const SystemMonitorApp: React.FC<AppProps> = () => {
    const [stats, setStats] = useState<any>(null);
    const [processes, setProcesses] = useState<any[]>([]);

    useEffect(() => {
        const fetchStats = async () => {
            const s = await SystemBridge.getSystemStats();
            const p = await SystemBridge.getProcesses();
            setStats(s);
            setProcesses(p);
        };
        fetchStats();
        const interval = setInterval(fetchStats, 2000);
        return () => clearInterval(interval);
    }, []);

    if (!stats) return <div className="p-4 text-white">Connecting to Kernel...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100">
        <div className="p-4 grid grid-cols-4 gap-4 bg-slate-800/50 border-b border-white/5">
        <div className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 rounded-full bg-blue-500/20 text-blue-400"><Cpu size={24} /></div>
        <div>
        <div className="text-xs text-slate-400">CPU Usage</div>
        <div className="text-xl font-bold">{stats.cpu.toFixed(1)}%</div>
        </div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 rounded-full bg-purple-500/20 text-purple-400"><CircuitBoard size={24} /></div>
        <div>
        <div className="text-xs text-slate-400">Memory</div>
        <div className="text-xl font-bold">{stats.ram.toFixed(1)}%</div>
        </div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-white/5 flex items-center gap-4">
        <div className="p-3 rounded-full bg-green-500/20 text-green-400"><Activity size={24} /></div>
        <div>
        <div className="text-xs text-slate-400">Kernel</div>
        <div className="text-sm font-bold truncate max-w-[100px]">{stats.kernel}</div>
        </div>
        </div>
        </div>

        <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
        <thead className="bg-slate-800 sticky top-0">
        <tr>
        <th className="p-3 font-medium text-slate-400">Name</th>
        <th className="p-3 font-medium text-slate-400">PID</th>
        <th className="p-3 font-medium text-slate-400">CPU</th>
        <th className="p-3 font-medium text-slate-400">Mem</th>
        </tr>
        </thead>
        <tbody>
        {processes.map((p) => (
            <tr key={p.pid} className="border-b border-white/5 hover:bg-white/5">
            <td className="p-3 font-mono text-blue-300">{p.name}</td>
            <td className="p-3 text-slate-500">{p.pid}</td>
            <td className="p-3">{p.cpu.toFixed(1)}%</td>
            <td className="p-3">{(p.memory / 1024 / 1024).toFixed(1)} MB</td>
            </tr>
        ))}
        </tbody>
        </table>
        </div>
        </div>
    );
};

export default SystemMonitorApp;
