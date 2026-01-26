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
        className={`absolute flex flex-col rounded-lg overflow-hidden shadow-2xl ease-out border theme-bg-primary ${
            isActive
            ? 'border-blue-500/50 shadow-blue-500/20'
            : 'theme-border shadow-black/50'
        }`}
        style={{
            left: window.isMaximized ? 0 : window.x,
            top: window.isMaximized ? 48 : window.y,
            width: window.isMaximized ? '100vw' : window.width,
            height: window.isMaximized ? 'calc(100vh - 48px)' : window.height,
            zIndex: window.zIndex,
            borderRadius: window.isMaximized ? 0 : '0.5rem',
            border: window.isMaximized ? 'none' : undefined,
        }}
        onMouseDown={() => onFocus(window.id)}
        >
        {/* Title Bar */}
        <div
        className={`h-9 flex items-center justify-between px-3 select-none ${
            window.isMaximized ? '' : 'cursor-default'
        } theme-bg-secondary theme-border border-b shrink-0`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onMaximize(window.id)}
        >
        <div className="flex items-center gap-2 text-sm font-medium theme-text-primary">
        <span className="theme-accent-text opacity-80">
        <div className="w-2 h-2 rounded-full theme-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
        </span>
        {window.title}
        </div>
        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
        <button
        onClick={() => onMinimize(window.id)}
        className="p-1 hover:bg-white/10 rounded-md theme-text-secondary hover:text-white transition-colors"
        >
        <Minus size={14} />
        </button>
        <button
        onClick={() => onMaximize(window.id)}
        className="p-1 hover:bg-white/10 rounded-md theme-text-secondary hover:text-white transition-colors"
        >
        {window.isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
        onClick={() => onClose(window.id)}
        className="p-1 hover:bg-red-500/80 rounded-md theme-text-secondary hover:text-white transition-colors group"
        >
        <X size={14} />
        </button>
        </div>
        </div>

        {/* Content Area - Enable text selection here */}
        <div className="flex-1 overflow-auto relative theme-bg-primary theme-text-primary select-text cursor-auto">
        {children}
        </div>
        </div>
    );
};

export default Window;
