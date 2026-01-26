import React, { useState, useEffect, useRef } from 'react';
import { AppId, WindowState, UserConfig } from './types';
import { APPS, THEMES } from './constants';
import { SystemBridge } from './utils/systemBridge';
import Window from './components/Window';
import TopBar from './components/TopBar';
import StartMenu from './components/StartMenu';
import ControlCenter from './components/ControlCenter';
import NotificationPanel from './components/NotificationPanel';
import WindowSwitcher from './components/WindowSwitcher';
import { FileText, Folder, Image, Music, Video, Trash2, Monitor, Smartphone } from 'lucide-react';

interface DesktopItem {
    id: string;
    name: string;
    type: 'file' | 'folder' | 'app';
    x: number;
    y: number;
    icon?: any;
    appId?: string; // If it's a shortcut
    path?: string; // If it's a file
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    targetId?: string;
}

export default function App() {
    const [windows, setWindows] = useState<WindowState[]>([]);
    const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
    const [nextZIndex, setNextZIndex] = useState(10);
    const [userConfig, setUserConfig] = useState<UserConfig | null>(null);

    // UI Panels
    const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
    const [isFullScreenStartOpen, setIsFullScreenStartOpen] = useState(false);
    const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
    const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);

    // Window Switcher State (Alt+Tab)
    const [isSwitcherVisible, setIsSwitcherVisible] = useState(false);
    const [switcherSelectedIndex, setSwitcherSelectedIndex] = useState(0);

    // Desktop State
    const [desktopItems, setDesktopItems] = useState<DesktopItem[]>([
        { id: 'trash', name: 'Trash', type: 'folder', x: 20, y: 60, icon: Trash2 },
        { id: 'home', name: 'Home', type: 'folder', x: 20, y: 140, icon: Folder },
        { id: 'readme', name: 'README.txt', type: 'file', x: 20, y: 220, path: '/home/user/README.txt' },
        { id: 'app-web', name: 'Blue Web', type: 'app', x: 100, y: 60, appId: AppId.BLUE_WEB },
        { id: 'app-connect', name: 'Blue Connect', type: 'app', x: 100, y: 140, appId: AppId.BLUE_CONNECT, icon: Smartphone },
    ]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{start: {x:number, y:number}, end: {x:number, y:number}} | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
    const desktopRef = useRef<HTMLDivElement>(null);

    // Load Config & Apply Theme
    useEffect(() => {
        SystemBridge.loadConfig().then((cfg) => {
            setUserConfig(cfg);
            applyTheme(cfg.themeName);
        });

        // Config polling to detect changes from other windows/apps
        const interval = setInterval(() => {
            SystemBridge.loadConfig().then(cfg => {
                setUserConfig(current => {
                    if (!current || cfg.themeName !== current.themeName || cfg.wallpaper !== current.wallpaper) {
                        applyTheme(cfg.themeName);
                        return cfg;
                    }
                    return current;
                });
            });
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const applyTheme = (themeName: string) => {
        document.documentElement.setAttribute('data-theme', themeName);
    };

    // --- Window Manager (WM) Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt + Tab Logic
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault(); // Try to prevent browser default
                if (windows.length > 0) {
                    if (!isSwitcherVisible) {
                        setIsSwitcherVisible(true);
                        setSwitcherSelectedIndex((prev) => {
                            // Find current active window index and start from there + 1
                            const currentIndex = windows.findIndex(w => w.id === activeWindowId);
                            return (currentIndex + 1) % windows.length;
                        });
                    } else {
                        setSwitcherSelectedIndex(prev => (prev + 1) % windows.length);
                    }
                }
            }

            // Win + Tab (Task View simulation) - just opens switcher for now but keeps it open
            if (e.metaKey && e.key === 'Tab') {
                e.preventDefault();
                // Simple toggle for now, in a real WM this would layout windows
                setIsSwitcherVisible(prev => !prev);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt' && isSwitcherVisible) {
                // Commit selection
                const selectedWindow = windows[switcherSelectedIndex];
                if (selectedWindow) {
                    focusWindow(selectedWindow.id);
                    // Also un-minimize if needed
                    if (selectedWindow.isMinimized) {
                        toggleWindowFromTaskbar(selectedWindow.id);
                    }
                }
                setIsSwitcherVisible(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [windows, activeWindowId, isSwitcherVisible, switcherSelectedIndex]);


    // --- Window Management ---

    const openApp = (appId: string, isExternal: boolean = false, exec?: string) => {
        if (isExternal && exec) {
            SystemBridge.launchApp(exec);
            return;
        }

        if (appId === AppId.TERMINAL) {
            SystemBridge.launchApp("/usr/share/HackerOS/Scripts/HackerOS-Apps/Hacker-Term.AppImage");
            return;
        }

        const appDef = APPS[appId as AppId];
        if (!appDef) return;

        if (appDef.isExternal) return;

        const newWindow: WindowState = {
            id: `${appId}-${Date.now()}`,
            appId,
            title: appDef.title,
            x: 150 + (windows.length * 30),
            y: 100 + (windows.length * 30),
            width: appDef.defaultWidth || 800,
            height: appDef.defaultHeight || 600,
            isMinimized: false,
            isMaximized: false,
            zIndex: nextZIndex,
            isExternal: false
        };

        setWindows([...windows, newWindow]);
        setActiveWindowId(newWindow.id);
        setNextZIndex(nextZIndex + 1);

        setIsStartMenuOpen(false);
        setIsFullScreenStartOpen(false);
        setIsControlCenterOpen(false);
        setIsNotificationCenterOpen(false);
    };

    const closeWindow = (id: string) => {
        setWindows(windows.filter(w => w.id !== id));
        if (activeWindowId === id) setActiveWindowId(null);
    };

        const focusWindow = (id: string) => {
            setActiveWindowId(id);
            setWindows(prev => prev.map(w =>
            w.id === id ? { ...w, zIndex: nextZIndex } : w
            ));
            setNextZIndex(prev => prev + 1);
        };

        const minimizeWindow = (id: string) => {
            setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
            setActiveWindowId(null);
        };

        const maximizeWindow = (id: string) => {
            setWindows(prev => prev.map(w => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
            focusWindow(id);
        };

        const moveWindow = (id: string, x: number, y: number) => {
            setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
        };

        const toggleWindowFromTaskbar = (id: string) => {
            const win = windows.find(w => w.id === id);
            if (!win) return;
            if (win.isMinimized) {
                setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false, zIndex: nextZIndex } : w));
                setNextZIndex(prev => prev + 1);
                setActiveWindowId(id);
            } else if (activeWindowId === id) {
                minimizeWindow(id);
            } else {
                focusWindow(id);
            }
        };

        // --- Desktop Interaction ---

        const handleDesktopMouseDown = (e: React.MouseEvent) => {
            // If clicking directly on desktop (not a window/icon), start selection
            if (e.target === desktopRef.current || e.target === document.body) {
                setSelectionBox({
                    start: { x: e.clientX, y: e.clientY },
                    end: { x: e.clientX, y: e.clientY }
                });
                setSelectedItems([]);
                setContextMenu({ ...contextMenu, visible: false });
                setIsStartMenuOpen(false);
                setIsControlCenterOpen(false);
            }
        };

        const handleDesktopMouseMove = (e: React.MouseEvent) => {
            if (selectionBox) {
                setSelectionBox({
                    ...selectionBox,
                    end: { x: e.clientX, y: e.clientY }
                });
            }
        };

        const handleDesktopMouseUp = () => {
            if (selectionBox) {
                // Calculate selection intersection
                const left = Math.min(selectionBox.start.x, selectionBox.end.x);
                const right = Math.max(selectionBox.start.x, selectionBox.end.x);
                const top = Math.min(selectionBox.start.y, selectionBox.end.y);
                const bottom = Math.max(selectionBox.start.y, selectionBox.end.y);

                const newSelection = desktopItems.filter(item => {
                    // Simple collision detection (center of icon)
                    const iconCX = item.x + 32;
                    const iconCY = item.y + 32;
                    return iconCX >= left && iconCX <= right && iconCY >= top && iconCY <= bottom;
                }).map(i => i.id);

                setSelectedItems(newSelection);
                setSelectionBox(null);
            }
        };

        const handleIconClick = (e: React.MouseEvent, id: string) => {
            e.stopPropagation();
            if (e.ctrlKey) {
                setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
            } else {
                setSelectedItems([id]);
            }
        };

        const handleIconDoubleClick = (item: DesktopItem) => {
            if (item.type === 'app' && item.appId) {
                openApp(item.appId);
            } else if (item.type === 'folder') {
                openApp(AppId.EXPLORER);
            } else if (item.type === 'file') {
                openApp(AppId.BLUE_EDIT); // Default text opener
            }
        };

        const handleContextMenu = (e: React.MouseEvent, itemId?: string) => {
            e.preventDefault();
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                targetId: itemId
            });
        };

        const handleOpenWith = (appId: string) => {
            openApp(appId);
            setContextMenu({ ...contextMenu, visible: false });
        };

        return (
            <div
            ref={desktopRef}
            className={`relative w-screen h-screen overflow-hidden bg-cover bg-center select-none theme-text-primary font-sans`}
            style={{ backgroundImage: `url(${userConfig?.wallpaper})` }}
            onMouseDown={handleDesktopMouseDown}
            onMouseMove={handleDesktopMouseMove}
            onMouseUp={handleDesktopMouseUp}
            onContextMenu={(e) => handleContextMenu(e)}
            >
            <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${userConfig?.themeName === 'light-glass' ? 'bg-white/10' : 'bg-slate-900/10'}`} />

            {/* Alt+Tab Switcher Overlay */}
            <WindowSwitcher
            windows={windows}
            selectedIndex={switcherSelectedIndex}
            isVisible={isSwitcherVisible}
            />

            {/* Desktop Icons */}
            {desktopItems.map(item => (
                <div
                key={item.id}
                className={`absolute flex flex-col items-center gap-1 p-2 w-24 rounded-lg border border-transparent transition-all hover:bg-white/10 ${selectedItems.includes(item.id) ? 'bg-blue-600/30 border-blue-500/50 backdrop-blur-sm' : ''}`}
                style={{ left: item.x, top: item.y }}
                onMouseDown={(e) => handleIconClick(e, item.id)}
                onDoubleClick={() => handleIconDoubleClick(item)}
                onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, item.id); }}
                >
                <div className="w-12 h-12 flex items-center justify-center text-white drop-shadow-md">
                {item.icon ? <item.icon size={40} /> : <FileText size={40} />}
                </div>
                <span className="text-xs text-center text-white font-medium drop-shadow-md line-clamp-2 leading-tight px-1 bg-black/20 rounded">
                {item.name}
                </span>
                </div>
            ))}

            {/* Selection Box */}
            {selectionBox && (
                <div
                className="absolute bg-blue-500/20 border border-blue-400/50 z-10 pointer-events-none"
                style={{
                    left: Math.min(selectionBox.start.x, selectionBox.end.x),
                              top: Math.min(selectionBox.start.y, selectionBox.end.y),
                              width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                              height: Math.abs(selectionBox.end.y - selectionBox.start.y)
                }}
                />
            )}

            {/* Context Menu */}
            {contextMenu.visible && (
                <div
                className="absolute w-48 theme-bg-secondary/90 backdrop-blur-xl theme-border border rounded-lg shadow-2xl z-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onMouseDown={e => e.stopPropagation()}
                >
                {contextMenu.targetId ? (
                    <>
                    <div className="px-3 py-1 text-xs font-bold theme-text-secondary uppercase">Open With</div>
                    <button onClick={() => handleOpenWith(AppId.BLUE_EDIT)} className="flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><FileText size={14} /> Blue Edit</button>
                    <button onClick={() => handleOpenWith(AppId.BLUE_IMAGES)} className="flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Image size={14} /> Blue Images</button>
                    <button onClick={() => handleOpenWith(AppId.BLUE_MUSIC)} className="flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Music size={14} /> Blue Music</button>
                    <button onClick={() => handleOpenWith(AppId.BLUE_VIDEOS)} className="flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Video size={14} /> Blue Videos</button>
                    <button onClick={() => handleOpenWith(AppId.BLUE_WEB)} className="flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Monitor size={14} /> Blue Web</button>
                    <div className="h-px bg-white/10 my-1" />
                    <button className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/50 text-sm text-left"><Trash2 size={14} /> Delete</button>
                    </>
                ) : (
                    <>
                    <button onClick={() => openApp(AppId.SETTINGS)} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left rounded-t-lg">Personalization</button>
                    <button onClick={() => openApp(AppId.TERMINAL)} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">Open Terminal</button>
                    <div className="h-px bg-white/10 my-1" />
                    <button onClick={() => setDesktopItems([...desktopItems, { id: Date.now().toString(), name: 'New Folder', type: 'folder', x: contextMenu.x - 20, y: contextMenu.y - 20, icon: Folder }])} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">New Folder</button>
                    </>
                )}
                </div>
            )}

            {/* Windows */}
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

            {/* Overlays */}
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
            <ControlCenter isOpen={isControlCenterOpen} onOpenSettings={() => openApp(AppId.SETTINGS)} />
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
