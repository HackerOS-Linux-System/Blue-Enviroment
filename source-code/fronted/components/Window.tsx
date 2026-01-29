import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { WindowState } from '../types';
import ExternalAppWrapper from './ExternalAppWrapper';

interface WindowProps {
    window: WindowState;
    isActive: boolean;
    onClose: (id: string) => void;
    onMinimize: (id: string) => void;
    onMaximize: (id: string) => void;
    onFocus: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void; // Used for Snap detection primarily
    onDragEnd: (id: string, x: number, y: number) => void; // Used to commit position
    onResize?: (id: string, width: number, height: number) => void;
    children: React.ReactNode;
}

const Window: React.FC<WindowProps> = ({
    window: winState,
    isActive,
    onClose,
    onMinimize,
    onMaximize,
    onFocus,
    onMove,
    onDragEnd,
    onResize,
    children,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    // Local position state for lag-free dragging
    const [localPos, setLocalPos] = useState({ x: winState.x, y: winState.y });

    const resizeDirection = useRef<string | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const startDim = useRef({ w: 0, h: 0, x: 0, y: 0, mx: 0, my: 0 });

    // Sync props to local state when NOT dragging
    useEffect(() => {
        if (!isDragging) {
            setLocalPos({ x: winState.x, y: winState.y });
        }
    }, [winState.x, winState.y, isDragging]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (winState.isMaximized) return;
        onFocus(winState.id);
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - localPos.x,
            y: e.clientY - localPos.y,
        };
    };

    const initResize = (e: React.MouseEvent, dir: string) => {
        e.stopPropagation();
        e.preventDefault();
        onFocus(winState.id);
        setIsResizing(true);
        resizeDirection.current = dir;
        startDim.current = {
            w: winState.width,
            h: winState.height,
            x: localPos.x,
            y: localPos.y,
            mx: e.clientX,
            my: e.clientY
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Logic for Moving
            if (isDragging) {
                const newX = e.clientX - dragOffset.current.x;
                const newY = e.clientY - dragOffset.current.y;

                // Update local state immediately (no global re-render)
                setLocalPos({ x: newX, y: newY });

                // Notify parent only for snap detection (optional check)
                onMove(winState.id, newX, newY);
            }

            // Logic for Resizing
            if (isResizing && onResize && !winState.isMaximized) {
                const dx = e.clientX - startDim.current.mx;
                const dy = e.clientY - startDim.current.my;
                const dir = resizeDirection.current;

                let newW = startDim.current.w;
                let newH = startDim.current.h;
                let newX = startDim.current.x;
                let newY = startDim.current.y;

                if (dir?.includes('e')) newW = Math.max(300, startDim.current.w + dx);
                if (dir?.includes('s')) newH = Math.max(200, startDim.current.h + dy);
                if (dir?.includes('w')) {
                    const proposedW = Math.max(300, startDim.current.w - dx);
                    newW = proposedW;
                    newX = startDim.current.x + (startDim.current.w - proposedW);
                }
                if (dir?.includes('n')) {
                    const proposedH = Math.max(200, startDim.current.h - dy);
                    newH = proposedH;
                    newY = startDim.current.y + (startDim.current.h - proposedH);
                }

                if (dir?.includes('w') || dir?.includes('n')) {
                    setLocalPos({ x: newX, y: newY });
                    onDragEnd(winState.id, newX, newY);
                }
                onResize(winState.id, newW, newH);
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                setIsDragging(false);
                // Commit final position to global state
                onDragEnd(winState.id, localPos.x, localPos.y);
            }
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, winState.id, onMove, onDragEnd, onResize, winState.isMaximized, localPos]);

    // CSS transition for smooth minimize/restore
    const transitionClass = isDragging || isResizing ? "" : "transition-[transform,opacity,width,height,top,left] duration-300 ease-out";

    const minimizedStyle: React.CSSProperties = {
        opacity: 0,
        transform: 'scale(0.8) translateY(50px)',
        pointerEvents: 'none',
        width: winState.width,
        height: winState.height
    };

    return (
        <div
        className={`absolute flex flex-col rounded-lg overflow-hidden shadow-2xl border theme-bg-primary ${transitionClass} ${
            isActive
            ? 'border-blue-500/50 shadow-blue-500/20'
            : 'theme-border shadow-black/50'
        }`}
        style={winState.isMinimized ? minimizedStyle : {
            left: winState.isMaximized ? 0 : localPos.x,
            top: winState.isMaximized ? 48 : localPos.y,
            width: winState.isMaximized ? '100vw' : winState.width,
            height: winState.isMaximized ? 'calc(100vh - 48px)' : winState.height,
            zIndex: winState.zIndex,
            borderRadius: winState.isMaximized ? 0 : '0.5rem',
            border: winState.isMaximized ? 'none' : undefined,
        }}
        onMouseDown={() => onFocus(winState.id)}
        >
        {/* Title Bar - Always draggable/clickable */}
        <div
        className={`h-9 flex items-center justify-between px-3 select-none ${
            winState.isMaximized ? '' : 'cursor-default'
        } theme-bg-secondary theme-border border-b shrink-0 pointer-events-auto`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onMaximize(winState.id)}
        >
        <div className="flex items-center gap-2 text-sm font-medium theme-text-primary">
        <span className="theme-accent-text opacity-80">
        <div className="w-2 h-2 rounded-full theme-accent shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
        </span>
        {winState.title}
        </div>
        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
        <button
        onClick={() => onMinimize(winState.id)}
        className="p-1 hover:bg-white/10 rounded-md theme-text-secondary hover:text-white transition-colors"
        >
        <Minus size={14} />
        </button>
        <button
        onClick={() => onMaximize(winState.id)}
        className="p-1 hover:bg-white/10 rounded-md theme-text-secondary hover:text-white transition-colors"
        >
        {winState.isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
        </button>
        <button
        onClick={() => onClose(winState.id)}
        className="p-1 hover:bg-red-500/80 rounded-md theme-text-secondary hover:text-white transition-colors group"
        >
        <X size={14} />
        </button>
        </div>
        </div>

        {/* Content Area - Transparent for External Apps (Hole Punching) */}
        <div
        className={`flex-1 overflow-auto relative theme-text-primary select-text cursor-auto ${
            winState.isExternal ? 'bg-transparent' : 'theme-bg-primary'
        }`}
        >
        {winState.isExternal ? (
            // Use the Mapping Wrapper for External Apps
            <ExternalAppWrapper appId={winState.appId} isActive={isActive} />
        ) : (
            children
        )}

        {/* Resize Overlay */}
        {isResizing && <div className="absolute inset-0 z-50 bg-transparent pointer-events-auto" />}
        </div>

        {!winState.isMaximized && (
            <div className="pointer-events-auto">
            <div className="absolute top-0 left-0 w-full h-1 cursor-n-resize hover:bg-blue-500/50 z-20" onMouseDown={(e) => initResize(e, 'n')} />
            <div className="absolute bottom-0 left-0 w-full h-1 cursor-s-resize hover:bg-blue-500/50 z-20" onMouseDown={(e) => initResize(e, 's')} />
            <div className="absolute top-0 left-0 h-full w-1 cursor-w-resize hover:bg-blue-500/50 z-20" onMouseDown={(e) => initResize(e, 'w')} />
            <div className="absolute top-0 right-0 h-full w-1 cursor-e-resize hover:bg-blue-500/50 z-20" onMouseDown={(e) => initResize(e, 'e')} />
            <div className="absolute bottom-right-0 w-4 h-4 cursor-se-resize z-30" style={{ right: 0, bottom: 0 }} onMouseDown={(e) => initResize(e, 'se')} />
            <div className="absolute bottom-left-0 w-4 h-4 cursor-sw-resize z-30" style={{ left: 0, bottom: 0 }} onMouseDown={(e) => initResize(e, 'sw')} />
            </div>
        )}
        </div>
    );
};

export default Window;
