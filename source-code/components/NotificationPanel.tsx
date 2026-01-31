import React from 'react';
import { X, Bell, Trash2, Info, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { Notification } from '../types';

interface NotificationPanelProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    onClearAll: () => void;
    onDismiss: (id: string) => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications, onClearAll, onDismiss }) => {
    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch(type) {
            case 'success': return <CheckCircle size={18} className="text-green-400" />;
            case 'warning': return <AlertTriangle size={18} className="text-yellow-400" />;
            case 'error': return <AlertOctagon size={18} className="text-red-400" />;
            default: return <Info size={18} className="text-blue-400" />;
        }
    };

    return (
        <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-16 right-4 bottom-4 w-96 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-40 animate-in slide-in-from-right-10 duration-300 flex flex-col overflow-hidden pointer-events-auto"
        >
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
        <div className="flex items-center gap-2 text-white font-bold">
        <Bell size={18} /> Notifications
        <span className="bg-blue-600 text-xs px-2 py-0.5 rounded-full">{notifications.length}</span>
        </div>
        <div className="flex items-center gap-2">
        {notifications.length > 0 && (
            <button onClick={onClearAll} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-red-400 transition-colors" title="Clear All">
            <Trash2 size={16} />
            </button>
        )}
        <button onClick={onClose} className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full transition-colors"><X size={16} /></button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {notifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
            <Bell size={48} />
            <p>No new notifications</p>
            </div>
        ) : (
            notifications.map(note => (
                <div key={note.id} className="bg-slate-800 border border-white/5 rounded-2xl p-4 flex gap-3 relative group transition-all hover:bg-slate-700/50">
                <div className="mt-1">{getIcon(note.type)}</div>
                <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-white truncate pr-6">{note.title}</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-3">{note.message}</p>
                <span className="text-[10px] text-slate-500 mt-2 block">{note.timestamp.toLocaleTimeString()}</span>

                {note.actionLabel && (
                    <button
                    onClick={() => { note.onAction?.(); onDismiss(note.id); }}
                    className="mt-3 text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg font-bold transition-colors"
                    >
                    {note.actionLabel}
                    </button>
                )}
                </div>
                <button
                onClick={() => onDismiss(note.id)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                <X size={14} />
                </button>
                </div>
            ))
        )}
        </div>
        </div>
    );
};

export default NotificationPanel;
