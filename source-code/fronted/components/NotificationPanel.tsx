import React from 'react';
import { X, MessageSquare, Calendar as CalendarIcon, Mail } from 'lucide-react';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const notifications = [
        { app: 'Blue AI', title: 'Analysis Complete', desc: 'The system scan has finished successfully.', time: '2m ago', icon: MessageSquare, color: 'text-blue-400' },
        { app: 'Mail', title: 'New Job Applicant', desc: 'John Doe has applied for the Senior Dev role.', time: '15m ago', icon: Mail, color: 'text-red-400' },
        { app: 'Calendar', title: 'Team Meeting', desc: 'Sync at 10:00 AM regarding the new UI.', time: '1h ago', icon: CalendarIcon, color: 'text-orange-400' },
    ];

    return (
        <div className="absolute top-16 right-4 bottom-4 w-96 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl z-40 animate-in slide-in-from-right-10 duration-300 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h2 className="font-semibold text-lg text-white">Notifications</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 p-1 rounded-full"><X size={16} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Calendar Widget */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl p-4">
        <div className="flex justify-between items-start mb-2">
        <div>
        <div className="text-3xl font-bold text-white">Monday</div>
        <div className="text-blue-200">October 25</div>
        </div>
        <CalendarIcon className="text-white/50" />
        </div>
        <div className="space-y-2 mt-4">
        <div className="flex gap-3 text-sm items-center">
        <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
        <div>
        <div className="text-white font-medium">Project Review</div>
        <div className="text-white/50 text-xs">10:00 - 11:30 AM</div>
        </div>
        </div>
        </div>
        </div>

        <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent</span>
        <button className="text-xs text-blue-400 hover:text-blue-300">Clear all</button>
        </div>

        <div className="space-y-2">
        {notifications.map((notif, i) => (
            <div key={i} className="bg-slate-800/40 hover:bg-slate-800/60 transition-colors border border-white/5 rounded-2xl p-3 flex gap-3 cursor-pointer group">
            <div className={`p-2 rounded-xl bg-slate-800 ${notif.color}`}>
            <notif.icon size={18} />
            </div>
            <div className="flex-1">
            <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-300">{notif.app}</span>
            <span className="text-[10px] text-slate-500">{notif.time}</span>
            </div>
            <div className="text-sm font-medium text-white mt-0.5 group-hover:text-blue-200 transition-colors">{notif.title}</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">{notif.desc}</div>
            </div>
            </div>
        ))}
        </div>
        </div>
        </div>
    );
};

export default NotificationPanel;
