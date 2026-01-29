import React, { useRef, useEffect } from 'react';
// @ts-ignore
import { Terminal } from 'xterm';
// @ts-ignore
import { FitAddon } from 'xterm-addon-fit';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

// Import via side-effect handled in index.html, but typescript needs to know.
// In a real build, we'd import 'xterm/css/xterm.css'.

const TerminalApp: React.FC<AppProps> = ({ windowId }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", monospace',
            theme: {
                background: '#0f172a', // slate-900
                foreground: '#f1f5f9', // slate-100
                    cursor: '#2563eb',     // blue-600
                    selectionBackground: 'rgba(37, 99, 235, 0.3)',
                                  black: '#0f172a',
                                  red: '#ef4444',
                                  green: '#22c55e',
                                  yellow: '#eab308',
                                  blue: '#3b82f6',
                                  magenta: '#d946ef',
                                  cyan: '#06b6d4',
                                  white: '#f8fafc',
                                  brightBlack: '#64748b',
                                  brightRed: '#f87171',
                                  brightGreen: '#4ade80',
                                  brightYellow: '#fde047',
                                  brightBlue: '#60a5fa',
                                  brightMagenta: '#e879f9',
                                  brightCyan: '#22d3ee',
                                  brightWhite: '#ffffff',
            },
            allowTransparency: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // 1. Spawn PTY on Backend
        SystemBridge.spawnPty(windowId).then(() => {
            // 2. Handle Resize
            fitAddon.fit();
            SystemBridge.resizePty(windowId, term.cols, term.rows);
        });

        // 3. Send Input to PTY
        term.onData((data: string) => {
            SystemBridge.writePty(windowId, data);
        });

        // 4. Listen for Output from PTY (Using Tauri Events)
        // @ts-ignore
        if (window.__TAURI__) {
            // @ts-ignore
            const { listen } = window.__TAURI__.event;
            const unlistenPromise = listen(`pty-data-${windowId}`, (event: any) => {
                term.write(event.payload);
            });

            return () => {
                unlistenPromise.then((unlisten: any) => unlisten());
                term.dispose();
            };
        } else {
            // Fallback for browser-only dev mode (Mock)
            term.write('\r\n\x1b[33m[WARN] Running in Browser Mode. PTY not available.\x1b[0m\r\n');
            term.write('$ ');
            term.onData((d: string) => {
                if(d === '\r') term.write('\r\n$ ');
                else term.write(d);
            });
        }
    }, [windowId]);

    // Handle Window Resize Observer to refit terminal
    useEffect(() => {
        if (!terminalRef.current) return;
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current && xtermRef.current) {
                fitAddonRef.current.fit();
                SystemBridge.resizePty(windowId, xtermRef.current.cols, xtermRef.current.rows);
            }
        });
        resizeObserver.observe(terminalRef.current);
        return () => resizeObserver.disconnect();
    }, [windowId]);

    return (
        <div className="h-full w-full bg-slate-900 p-2 overflow-hidden">
        <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};

export default TerminalApp;
