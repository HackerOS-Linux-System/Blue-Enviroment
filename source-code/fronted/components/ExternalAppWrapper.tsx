import React, { useRef, useEffect } from 'react';
import { SystemBridge } from '../utils/systemBridge';

interface ExternalAppWrapperProps {
    appId: string;
    isActive: boolean;
}

/**
 * ExternalAppWrapper
 *
 * This component is responsible for "Window Swallowing" on the frontend side.
 * It renders a transparent placeholder div and constantly reports its
 * absolute screen coordinates to the C backend.
 */
const ExternalAppWrapper: React.FC<ExternalAppWrapperProps> = ({ appId, isActive }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>(0);
    const previousRect = useRef({ x: 0, y: 0, w: 0, h: 0 });

    const updatePosition = () => {
        if (!containerRef.current) return;

        // Get absolute coordinates relative to the viewport
        const rect = containerRef.current.getBoundingClientRect();

        // Round to integers for pixel-perfect Wayland positioning
        const x = Math.round(rect.left);
        const y = Math.round(rect.top);
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);

        // Optimization: Only talk to Rust/C if pixels changed
        if (
            x !== previousRect.current.x ||
            y !== previousRect.current.y ||
            w !== previousRect.current.w ||
            h !== previousRect.current.h
        ) {
            // Send to C Backend
            // @ts-ignore
            if (window.__TAURI__) {
                SystemBridge.updateSurfaceRect(appId, x, y, w, h);
            } else {
                // Debug log for browser development
                console.debug(`[SurfaceMap] ${appId} -> ${x},${y} ${w}x${h}`);
            }

            previousRect.current = { x, y, w, h };
        }

        // Keep syncing if window is active (for animations, drags)
        if (isActive) {
            requestRef.current = requestAnimationFrame(updatePosition);
        }
    };

    useEffect(() => {
        // Start tracking
        updatePosition();

        // Also observe resizes specifically
        const observer = new ResizeObserver(() => {
            updatePosition();
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            observer.disconnect();
        };
    }, [appId, isActive]);

    return (
        <div
        ref={containerRef}
        className="w-full h-full bg-transparent relative"
        style={{
            // Ensure mouse events pass through to the native window below
            // unless we are in "move window" mode (handled by parent)
            pointerEvents: 'none'
        }}
        >
        {/*
            This div is visually empty.
            The backend will render the 'Alacritty' or 'Firefox' surface
            directly into the screen pixels occupied by this div.
            */}
            </div>
    );
};

export default ExternalAppWrapper;
