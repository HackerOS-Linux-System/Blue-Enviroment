import React, { useState, useEffect } from 'react';
import { AppId, WindowState, UserConfig } from './types';
import { APPS } from './constants';
import { SystemBridge } from './utils/systemBridge';
import Window from './components/Window';
import TopBar from './components/TopBar';
import StartMenu from './components/StartMenu';
import ControlCenter from './components/ControlCenter';
import NotificationPanel from './components/NotificationPanel';

export default function App() {
    const [windows, setWindows] = useState<WindowState[]>([]);
    const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
    const [nextZIndex, setNextZIndex] = useState(10);
    const [userConfig, setUserConfig] = useState<UserConfig | null>(null);

    // UI State
    const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
    const [isFullScreenStartOpen, setIsFullScreenStartOpen] = useState(false);
    const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

    useEffect(() => {
        // Load config on boot
        SystemBridge.loadConfig().then(setUserConfig);

        // Poll for changes in config every few seconds (simulation for multi-process)
        const interval = setInterval(() => {
            SystemBridge.loadConfig().then(cfg => {
                if (JSON.stringify(cfg) !== JSON.stringify(userConfig)) {
                    setUserConfig(cfg);
                }
            });
        }, 5000);
        return () => clearInterval(interval);
    }, [userConfig]);

    const openApp = (appId: string, isExternal: boolean = false, exec?: string) => {
        if (isExternal && exec) {
            // Launch Linux Process via Rust Bridge
            SystemBridge.launchApp(exec);
            return; // We don't create a React Window for external X11/Wayland apps (simulated here)
        }

        const appDef = APPS[appId as AppId];
        if (!appDef) return;

        const newWindow: WindowState = {
            id: `${appId}-${Date.now()}`,
            appId,
            title: appDef.title,
            x: 100 + (windows.length * 30),
            y: 100 + (windows.length * 30),
            width: appDef.defaultWidth || 600,
            height: appDef.defaultHeight || 400,
            isMinimized: false,
            isMaximized: false,
            zIndex: nextZIndex,
            isExternal: false
        };

        setWindows([...windows, newWindow]);
        setActiveWindowId(newWindow.id);
        setNextZIndex(nextZIndex + 1);

        // Close overlays
        setIsStartMenuOpen(false);
        setIsFullScreenStartOpen(false);
        setIsControlCenterOpen(false);
        setIsNotificationCenterOpen(false);
    };

    const closeWindow = (id: string) => {
        setWindows(windows.filter(w => w.id !== id));
        if (activeWindowId === id) {
            setActiveWindowId(null);
        }
    };

    const focusWindow = (id: string) => {
        setActiveWindowId(id);
        setWindows(prev => prev.map(w =>
        w.id === id ? { ...w, zIndex: nextZIndex } : w
        ));
        setNextZIndex(prev => prev + 1);
    };

    const minimizeWindow = (id: string) => {
        setWindows(prev => prev.map(w =>
        w.id === id ? { ...w, isMinimized: true } : w
        ));
        setActiveWindowId(null);
    };

    const maximizeWindow = (id: string) => {
        setWindows(prev => prev.map(w =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
        ));
        focusWindow(id);
    };

    const moveWindow = (id: string, x: number, y: number) => {
        setWindows(prev => prev.map(w =>
        w.id === id ? { ...w, x, y } : w
        ));
    };

    const toggleWindowFromTaskbar = (id: string) => {
        const win = windows.find(w => w.id === id);
        if (!win) return;

        if (win.isMinimized) {
            setWindows(prev => prev.map(w =>
            w.id === id ? { ...w, isMinimized: false, zIndex: nextZIndex } : w
            ));
            setNextZIndex(prev => prev + 1);
            setActiveWindowId(id);
        } else if (activeWindowId === id) {
            minimizeWindow(id);
        } else {
            focusWindow(id);
        }
    };

    const handleBackgroundClick = () => {
        setIsStartMenuOpen(false);
        setIsFullScreenStartOpen(false);
        setIsControlCenterOpen(false);
        setIsNotificationCenterOpen(false);
    };

    return (
        <div
        className="relative w-screen h-screen overflow-hidden bg-cover bg-center select-none text-slate-100 font-sans"
        style={{ backgroundImage: `url(${userConfig?.wallpaper || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072"})` }}
        onClick={handleBackgroundClick}
        >
        <div className="absolute inset-0 bg-slate-900/10 pointer-events-none" />

        {windows.map(window => {
            const AppComp = APPS[window.appId as AppId]?.component;
            if (!AppComp) return null;

            return (
                <Window
                key={window.id}
                window={window}
                isActive={activeWindowId === window.id}
                onClose={closeWindow}
                onMinimize={minimizeWindow}
                onMaximize={maximizeWindow}
                onFocus={focusWindow}
                onMove={moveWindow}
                >
                <AppComp windowId={window.id} />
                </Window>
            );
        })}

        <div onClick={e => e.stopPropagation()}>
        <StartMenu
        isOpen={isStartMenuOpen || isFullScreenStartOpen}
        isFullScreen={isFullScreenStartOpen}
        onOpenApp={openApp}
        onClose={() => {
            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(false);
        }}
        onToggleFullScreen={() => {
            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(true);
        }}
        />
        <ControlCenter isOpen={isControlCenterOpen} />
        <NotificationPanel isOpen={isNotificationCenterOpen} onClose={() => setIsNotificationCenterOpen(false)} />
        </div>

        <div onClick={e => e.stopPropagation()}>
        <TopBar
        openWindows={windows.map(w => ({
            id: w.id,
            appId: w.appId as AppId,
            isMinimized: w.isMinimized,
            isActive: w.id === activeWindowId
        }))}
        onOpenApp={(id) => openApp(id)}
        onToggleWindow={toggleWindowFromTaskbar}
        onStartClick={() => {
            setIsControlCenterOpen(false);
            setIsNotificationCenterOpen(false);
            if (isFullScreenStartOpen) {
                setIsFullScreenStartOpen(false);
                setIsStartMenuOpen(false);
            } else {
                setIsStartMenuOpen(!isStartMenuOpen);
            }
        }}
        onStartDoubleClick={() => {
            setIsControlCenterOpen(false);
            setIsNotificationCenterOpen(false);
            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(true);
        }}
        onToggleControlCenter={() => {
            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(false);
            setIsNotificationCenterOpen(false);
            setIsControlCenterOpen(!isControlCenterOpen);
        }}
        onToggleNotifications={() => {
            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(false);
            setIsControlCenterOpen(false);
            setIsNotificationCenterOpen(!isNotificationCenterOpen);
        }}
        isStartMenuOpen={isStartMenuOpen || isFullScreenStartOpen}
        />
        </div>
        </div>
    );
}
