import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { WindowState } from '../types';

interface WindowProps {
    window: WindowState;
    isActive: boolean;
    onClose: (id: string) => void;
    onMinimize: (id: string) => void;
    onMaximize: (id: string) => void;
    onFocus: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    children: React.ReactNode;
}

const Window: React.FC<WindowProps> = ({
    window,
    isActive,
    onClose,
    onMinimize,
    onMaximize,
    onFocus,
    onMove,
    children,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (window.isMaximized) return;
        onFocus(window.id);
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - window.x,
            y: e.clientY - window.y,
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const newX = e.clientX - dragOffset.current.x;
            const newY = e.clientY - dragOffset.current.y;

            onMove(window.id, newX, newY);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, window.id, onMove]);

    if (window.isMinimized) return null;

    return (
        <div
        className={`absolute flex flex-col rounded-lg overflow-hidden shadow-2xl transition-all duration-100 ease-out border ${
            isActive
            ? 'border-blue-500/50 shadow-blue-500/20'
            : 'border-white/10 shadow-black/50'
        } bg-slate-900/90 backdrop-blur-xl`}
        style={{
            left: window.isMaximized ? 0 : window.x,
            top: window.isMaximized ? 0 : window.y,
            width: window.isMaximized ? '100vw' : window.width,
            height: window.isMaximized ? 'calc(100vh - 48px)' : window.height,
            zIndex: window.zIndex,
        }}
        onMouseDown={() => onFocus(window.id)}
        >
        {/* Title Bar */}
        <div
        className={`h-9 flex items-center justify-between px-3 select-none ${
            window.isMaximized ? '' : 'cursor-default'
        } bg-gradient-to-r from-slate-800 to-slate-900 border-b border-white/5`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onMaximize(window.id)}
        >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <span className="text-blue-400 opacity-80">
        {/* Small visual accent */}
        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
        </span>
        {window.title}
        </div>
        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
        <button
        onClick={() => onMinimize(window.id)}
        className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
        >
        <Minus size={14} />
        </button>
        <button
        onClick={() => onMaximize(window.id)}
        className="p-1 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-colors"
        >
        {window.isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
        onClick={() => onClose(window.id)}
        className="p-1 hover:bg-red-500/80 rounded-md text-slate-400 hover:text-white transition-colors group"
        >
        <X size={14} />
        </button>
        </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto relative bg-slate-950/50 text-slate-100">
        {children}
        </div>
        </div>
    );
};

export default Window;
