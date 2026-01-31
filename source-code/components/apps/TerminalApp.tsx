import React, { useRef, useEffect } from 'react';
// @ts-ignore
import { Terminal } from 'xterm';
// @ts-ignore
import { FitAddon } from 'xterm-addon-fit';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const TerminalApp: React.FC<AppProps> = ({ windowId }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js with HackerOS theme
        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: 1.2,
            theme: {
                background: '#0f172a', // slate-900
                foreground: '#cbd5e1', // slate-300
                    cursor: '#38bdf8',     // sky-400
                    cursorAccent: '#0f172a',
                    selectionBackground: 'rgba(56, 189, 248, 0.3)',
                                  black: '#0f172a',
                                  red: '#ef4444',
                                  green: '#22c55e',
                                  yellow: '#eab308',
                                  blue: '#3b82f6',
                                  magenta: '#d946ef',
                                  cyan: '#06b6d4',
                                  white: '#f8fafc',
                                  brightBlack: '#475569',
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
            fitAddon.fit();
            SystemBridge.resizePty(windowId, term.cols, term.rows);
        });

        // 2. Send Input to PTY
        term.onData((data: string) => {
            SystemBridge.writePty(windowId, data);
        });

        // 3. Listen for Output from PTY (Using Tauri Events)
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
            term.write('\r\n\x1b[1;34m Blue Environment \x1b[0m\r\n');
            term.write('\x1b[33m[WARN] Browser mode: PTY not active.\x1b[0m\r\n');
            term.write('user@blue:~$ ');
            term.onData((d: string) => {
                if(d === '\r') term.write('\r\nuser@blue:~$ ');
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
        <div className="h-full w-full bg-slate-900 p-1 overflow-hidden" onContextMenu={(e) => { e.preventDefault(); /* Custom menu could go here */ }}>
        <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};

export default TerminalApp;
