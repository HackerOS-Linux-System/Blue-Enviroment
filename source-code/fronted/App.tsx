import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppId, WindowState, UserConfig, CustomTheme, Notification, DesktopEntry } from './types';
import { APPS, THEMES, WALLPAPER_URL } from './constants';
import { SystemBridge } from './utils/systemBridge';
import Window from './components/Window';
import TopBar from './components/TopBar';
import StartMenu from './components/StartMenu';
import ControlCenter from './components/ControlCenter';
import NotificationPanel from './components/NotificationPanel';
import WindowSwitcher from './components/WindowSwitcher';
import { FileText, Folder, Image, Music, Video, Trash2, Smartphone, ChevronRight, FileCode, X, Box } from 'lucide-react';

interface DesktopItem {
    id: string;
    name: string;
    type: 'file' | 'folder' | 'app' | 'trash';
    x: number;
    y: number;
    icon?: any;
    appId?: string; // If it's a shortcut
    path?: string; // If it's a file
    isDeleted?: boolean;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    targetId?: string;
    targetType?: string;
}

export default function App() {
    const [windows, setWindows] = useState<WindowState[]>([]);
    const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
    const [nextZIndex, setNextZIndex] = useState(10);
    const [currentDesktop, setCurrentDesktop] = useState(0);

    // Snap Assist State
    const [phantomBox, setPhantomBox] = useState<{x:number, y:number, w:number, h:number} | null>(null);

    // Config - Initialize with strong defaults for pinnedApps
    const [userConfig, setUserConfig] = useState<UserConfig>({
        wallpaper: WALLPAPER_URL,
        themeName: 'blue-default',
        accentColor: 'blue',
        displayScale: 1,
        barPosition: 'top',
        disabledApps: [],
        pinnedApps: [AppId.TERMINAL, AppId.EXPLORER, AppId.BLUE_WEB, AppId.SETTINGS]
    });

    const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

    // Notifications
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [toasts, setToasts] = useState<Notification[]>([]);

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
        { id: 'trash', name: 'Trash', type: 'trash', x: 20, y: 60, icon: Trash2 },
        { id: 'home', name: 'Home', type: 'folder', x: 20, y: 140, icon: Folder },
        { id: 'readme', name: 'README.txt', type: 'file', x: 20, y: 220, path: '/home/user/README.txt' },
        { id: 'app-web', name: 'Blue Web', type: 'app', x: 100, y: 60, appId: AppId.BLUE_WEB },
        { id: 'app-connect', name: 'Blue Connect', type: 'app', x: 100, y: 140, appId: AppId.BLUE_CONNECT, icon: Smartphone },
    ]);
    const [trashItems, setTrashItems] = useState<DesktopItem[]>([]);

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<{start: {x:number, y:number}, end: {x:number, y:number}} | null>(null);
    const [draggingItem, setDraggingItem] = useState<{id: string, offsetX: number, offsetY: number} | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

    // Keyboard Shortcuts State
    const lastMetaDownTime = useRef<number>(0);
    const doubleTapTimer = useRef<NodeJS.Timeout | null>(null);
    const isAltPressed = useRef(false);

    const desktopRef = useRef<HTMLDivElement>(null);

    // Load Config & Apply Theme
    useEffect(() => {
        // Start the C backend compositor logic (if running in Tauri)
        // @ts-ignore
        if (window.__TAURI__) {
            // @ts-ignore
            window.__TAURI__.invoke('init_compositor');
        }

        SystemBridge.getCustomThemes().then(setCustomThemes);
        SystemBridge.loadConfig().then((cfg) => {
            if (cfg) {
                // Ensure pinnedApps is not overwritten with undefined if the saved config is old
                const pinnedApps = cfg.pinnedApps && cfg.pinnedApps.length > 0
                ? cfg.pinnedApps
                : [AppId.TERMINAL, AppId.EXPLORER, AppId.BLUE_WEB, AppId.SETTINGS];

                const safeConfig = { ...cfg, pinnedApps };
                setUserConfig(safeConfig);
                applyTheme(safeConfig.themeName);
            }
        });

        addNotification({
            title: "Welcome to Blue Environment",
            message: "System initialized successfully.",
            type: 'success'
        });
    }, []);

    // --- Robust Keyboard Event Listeners ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // --- Alt + Tab Logic ---
            if (e.key === 'Alt') {
                isAltPressed.current = true;
            }
            if (e.key === 'Tab' && isAltPressed.current) {
                e.preventDefault();
                e.stopPropagation();

                setIsSwitcherVisible(true);

                setSwitcherSelectedIndex(prev => {
                    const visibleWindows = windows.filter(w => !w.isMinimized && w.desktopId === currentDesktop);
                    if (visibleWindows.length === 0) return 0;
                    const next = prev + 1;
                    return next >= visibleWindows.length ? 0 : next;
                });
            }

            // --- Win Key (Meta) Tracking ---
            if (e.key === 'Meta' || e.key === 'OS' || e.key === 'Super') {
                e.preventDefault();

                if (e.repeat) return;

                const now = Date.now();
                const timeDiff = now - lastMetaDownTime.current;
                lastMetaDownTime.current = now;

                // Double Tap -> Full Screen Menu
                if (timeDiff < 400) {
                    if (doubleTapTimer.current) clearTimeout(doubleTapTimer.current);
                    setIsStartMenuOpen(false);
                    setIsFullScreenStartOpen(prev => !prev);
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            // --- Alt Release ---
            if (e.key === 'Alt') {
                isAltPressed.current = false;
                if (isSwitcherVisible) {
                    // Commit switch
                    const visibleWindows = windows.filter(w => !w.isMinimized && w.desktopId === currentDesktop);
                    if (visibleWindows[switcherSelectedIndex]) {
                        focusWindow(visibleWindows[switcherSelectedIndex].id);
                    }
                    setIsSwitcherVisible(false);
                    setSwitcherSelectedIndex(0);
                }
            }

            // --- Win Key Release (Single Tap) ---
            if (e.key === 'Meta' || e.key === 'OS' || e.key === 'Super') {
                e.preventDefault();

                if (!isFullScreenStartOpen) {
                    doubleTapTimer.current = setTimeout(() => {
                        setIsStartMenuOpen(prev => !prev);
                    }, 250);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [windows, currentDesktop, isSwitcherVisible, switcherSelectedIndex, isFullScreenStartOpen]);


    const applyTheme = (themeName: string) => {
        if (themeName.startsWith('custom:')) {
            const custom = customThemes.find(t => t.id === themeName);
            if (custom) {
                let styleTag = document.getElementById('custom-theme-style');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'custom-theme-style';
                    document.head.appendChild(styleTag);
                }
                styleTag.innerHTML = custom.cssContent;
                document.documentElement.removeAttribute('data-theme');
                return;
            }
        }
        const styleTag = document.getElementById('custom-theme-style');
        if (styleTag) styleTag.innerHTML = '';
        document.documentElement.setAttribute('data-theme', themeName);
    };

    // --- Notification System ---

    const addNotification = (note: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
        const newNote: Notification = {
            id: Date.now().toString(),
            timestamp: new Date(),
            read: false,
            ...note
        };

        setNotifications(prev => [newNote, ...prev]);
        setToasts(prev => [newNote, ...prev]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== newNote.id));
        }, 5000);
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    // --- Window Management ---

    const openApp = (appId: string, isExternal: boolean = false, exec?: string, props: any = {}) => {
        // Check Disabled
        if (userConfig.disabledApps && userConfig.disabledApps.includes(appId)) {
            addNotification({
                title: "App Disabled",
                message: "This application has been disabled in settings.",
                type: 'warning'
            });
            return;
        }

        if (isExternal && exec) {
            // Launch External App (via Backend)
            SystemBridge.launchApp(exec);

            // Add "Fake" window to track it in taskbar (Simulation of Window Management)
            const fakeWindow: WindowState = {
                id: `ext-${appId}-${Date.now()}`,
                appId: appId,
                title: appId,
                x: 0, y: 0, width: 0, height: 0,
                isMinimized: false,
                isMaximized: false,
                zIndex: 0,
                isExternal: true,
                desktopId: currentDesktop
            };
            setWindows([...windows, fakeWindow]);
            addNotification({ title: "External App", message: `Launched ${appId} externally.`, type: 'info' });

            setIsStartMenuOpen(false);
            setIsFullScreenStartOpen(false);
            return;
        }

        const appDef = APPS[appId as AppId];
        if (!appDef) return;

        // Internal React App
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
            isExternal: false,
            desktopId: currentDesktop, // Open on current desktop
            props // Store passed props
        };

        setWindows([...windows, newWindow]);
        setActiveWindowId(newWindow.id);
        setNextZIndex(nextZIndex + 1);
        setIsStartMenuOpen(false);
        setIsFullScreenStartOpen(false);
    };

    const closeWindow = (id: string) => {
        setWindows(windows.filter(w => w.id !== id));
        if (activeWindowId === id) setActiveWindowId(null);
    };

        const focusWindow = (id: string) => {
            setActiveWindowId(id);
            setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: nextZIndex } : w));
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

        // Optimized: Only checks snap zones, DOES NOT trigger re-render of windows state for position
        const checkWindowSnap = useCallback((id: string, x: number, y: number) => {
            const screenW = window.innerWidth;
            const screenH = window.innerHeight;
            const edgeThreshold = 20;

            let hint = null;
            if (x < edgeThreshold) hint = { x: 0, y: 48, w: screenW/2, h: screenH-48 }; // Left
            else if (x > screenW - edgeThreshold - 100) hint = { x: screenW/2, y: 48, w: screenW/2, h: screenH-48 }; // Right
            else if (y < edgeThreshold) hint = { x: 0, y: 48, w: screenW, h: screenH-48 }; // Top (Max)

        setPhantomBox(prev => {
            if (JSON.stringify(prev) === JSON.stringify(hint)) return prev;
            return hint;
        });
        }, []);

        // Called when drag ends to commit position
        const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
            setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
        }, []);

        const resizeWindow = (id: string, width: number, height: number) => {
            setWindows(prev => prev.map(w => w.id === id ? { ...w, width, height } : w));
        };

        const toggleWindowFromTaskbar = (id: string) => {
            const win = windows.find(w => w.id === id);
            if (!win) return;

            if (win.desktopId !== currentDesktop) {
                setCurrentDesktop(win.desktopId);
            }

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

        // Pin Management
        const togglePin = (appId: string) => {
            if(!userConfig) return;
            const currentPins = userConfig.pinnedApps || [];
            let newPins;
            if (currentPins.includes(appId)) {
                newPins = currentPins.filter(id => id !== appId);
            } else {
                newPins = [...currentPins, appId];
            }
            handleSaveSettings({ pinnedApps: newPins });
        };

        // Global Mouse Up for Snap Assist Commit
        const handleGlobalMouseUp = () => {
            if (phantomBox && activeWindowId) {
                setWindows(prev => prev.map(w => {
                    if (w.id === activeWindowId) {
                        return {
                            ...w,
                            x: phantomBox.x,
                            y: phantomBox.y,
                            width: phantomBox.w,
                            height: phantomBox.h,
                            isMaximized: phantomBox.w === window.innerWidth
                        };
                    }
                    return w;
                }));
            }
            setPhantomBox(null);

            // Also handle desktop items selection
            if (selectionBox) {
                const left = Math.min(selectionBox.start.x, selectionBox.end.x);
                const right = Math.max(selectionBox.start.x, selectionBox.end.x);
                const top = Math.min(selectionBox.start.y, selectionBox.end.y);
                const bottom = Math.max(selectionBox.start.y, selectionBox.end.y);

                const newSelection = desktopItems.filter(item => {
                    const iconCX = item.x + 32;
                    const iconCY = item.y + 32;
                    return iconCX >= left && iconCX <= right && iconCY >= top && iconCY <= bottom;
                }).map(i => i.id);

                setSelectedItems(newSelection);
                setSelectionBox(null);
            }
            setDraggingItem(null);
        };

        // --- Desktop Interaction (Drag & Drop) ---

        const handleDesktopMouseDown = (e: React.MouseEvent) => {
            if (e.target === desktopRef.current || e.target === document.body) {
                setSelectionBox({
                    start: { x: e.clientX, y: e.clientY },
                    end: { x: e.clientX, y: e.clientY }
                });
                setSelectedItems([]);
                setContextMenu({ ...contextMenu, visible: false });
                setActiveSubmenu(null);
                setIsStartMenuOpen(false);
                setIsFullScreenStartOpen(false);
                setIsControlCenterOpen(false);
            }
        };

        const handleDesktopMouseMove = (e: React.MouseEvent) => {
            if (selectionBox) {
                setSelectionBox(prev => prev ? ({ ...prev, end: { x: e.clientX, y: e.clientY } }) : null);
            }
            if (draggingItem) {
                const newX = e.clientX - draggingItem.offsetX;
                const newY = e.clientY - draggingItem.offsetY;
                setDesktopItems(prev => prev.map(item =>
                item.id === draggingItem.id ? { ...item, x: newX, y: newY } : item
                ));
            }
        };

        const handleIconMouseDown = (e: React.MouseEvent, item: DesktopItem) => {
            e.stopPropagation();
            if(e.button === 0) {
                setDraggingItem({
                    id: item.id,
                    offsetX: e.clientX - item.x,
                    offsetY: e.clientY - item.y
                });
                if (!selectedItems.includes(item.id) && !e.ctrlKey) {
                    setSelectedItems([item.id]);
                } else if(e.ctrlKey) {
                    setSelectedItems(prev => prev.includes(item.id) ? prev.filter(i => i !== item.id) : [...prev, item.id]);
                }
            }
        };

        const handleIconDoubleClick = (item: DesktopItem) => {
            if (item.type === 'app' && item.appId) {
                openApp(item.appId);
            } else if (item.type === 'folder') {
                openApp(AppId.EXPLORER);
            } else if (item.type === 'trash') {
                alert(`Trash contains ${trashItems.length} items`);
            } else if (item.type === 'file') {
                openApp(AppId.BLUE_EDIT);
            }
        };

        const handleContextMenu = (e: React.MouseEvent, item?: DesktopItem) => {
            e.preventDefault();
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                targetId: item?.id,
                targetType: item?.type
            });
            setActiveSubmenu(null);
        };

        const handleCreate = (type: 'folder' | 'txt') => {
            const newItem: DesktopItem = {
                id: Date.now().toString(),
                name: type === 'folder' ? 'New Folder' : 'New File.txt',
                type: type === 'folder' ? 'folder' : 'file',
                x: contextMenu.x,
                y: contextMenu.y,
                icon: type === 'folder' ? Folder : FileText
            };
            setDesktopItems(prev => [...prev, newItem]);
            setContextMenu({ ...contextMenu, visible: false });
        };

        const handleSaveSettings = (newConfig: Partial<UserConfig>) => {
            const updated = { ...userConfig, ...newConfig };
            setUserConfig(updated);
            SystemBridge.saveConfig(updated);
            if(newConfig.themeName) applyTheme(newConfig.themeName);
        };

            const isVideoWallpaper = userConfig.wallpaper.endsWith('.mp4') || userConfig.wallpaper.endsWith('.webm');

            return (
                <div
                ref={desktopRef}
                className={`relative w-screen h-screen overflow-hidden bg-cover bg-center select-none theme-text-primary font-sans`}
                style={{
                    backgroundImage: !isVideoWallpaper && userConfig?.wallpaper ? `url(${userConfig.wallpaper})` : 'none',
                    backgroundColor: '#0f172a'
                }}
                onMouseDown={handleDesktopMouseDown}
                onMouseMove={handleDesktopMouseMove}
                onMouseUp={handleGlobalMouseUp}
                onContextMenu={(e) => handleContextMenu(e)}
                >
                {/* Video Wallpaper Layer */}
                {isVideoWallpaper && (
                    <video
                    className="absolute inset-0 w-full h-full object-cover z-[-1]"
                    src={userConfig.wallpaper}
                    autoPlay loop muted playsInline
                    />
                )}

                <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${userConfig?.themeName === 'light-glass' ? 'bg-white/10' : 'bg-slate-900/10'}`} />

                {/* Snap Assist Phantom Box */}
                {phantomBox && (
                    <div
                    className="absolute bg-blue-500/30 border-2 border-blue-400 rounded-lg z-40 transition-all duration-200"
                    style={{
                        left: phantomBox.x,
                        top: phantomBox.y,
                        width: phantomBox.w,
                        height: phantomBox.h
                    }}
                    />
                )}

                {/* Switcher (Alt+Tab) */}
                <WindowSwitcher
                windows={windows.filter(w => !w.isMinimized && w.desktopId === currentDesktop)}
                selectedIndex={switcherSelectedIndex}
                isVisible={isSwitcherVisible}
                />

                {/* Desktop Icons */}
                {desktopItems.map(item => (
                    <div
                    key={item.id}
                    className={`absolute flex flex-col items-center gap-1 p-2 w-24 rounded-lg border border-transparent transition-all hover:bg-white/10 z-0 ${selectedItems.includes(item.id) ? 'bg-blue-600/30 border-blue-500/50 backdrop-blur-sm' : ''}`}
                    style={{ left: item.x, top: item.y }}
                    onMouseDown={(e) => handleIconMouseDown(e, item)}
                    onDoubleClick={() => handleIconDoubleClick(item)}
                    onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, item); }}
                    >
                    <div className="w-12 h-12 flex items-center justify-center text-white drop-shadow-md relative">
                    {item.icon ? <item.icon size={40} /> : <FileText size={40} />}
                    {item.type === 'trash' && trashItems.length > 0 && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-slate-900"></div>
                    )}
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

                {/* Toast Notifications */}
                <div className="absolute bottom-16 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl animate-in slide-in-from-right pointer-events-auto flex items-start gap-3">
                    <div className={`p-2 rounded-full ${toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {toast.type === 'error' ? <X size={16} /> : <div className="w-4 h-4 rounded-full bg-current" />}
                    </div>
                    <div className="flex-1">
                    <h4 className="font-bold text-sm text-white">{toast.title}</h4>
                    <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
                    </div>
                    <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-500 hover:text-white"><X size={14}/></button>
                    </div>
                ))}
                </div>

                {/* Context Menu */}
                {contextMenu.visible && (
                    <div
                    className="absolute w-56 theme-bg-secondary/95 backdrop-blur-xl theme-border border rounded-lg shadow-2xl z-[9999] flex flex-col py-1"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onMouseDown={e => e.stopPropagation()}
                    >
                    <button onClick={() => handleCreate('folder')} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">New Folder</button>
                    <button onClick={() => handleCreate('txt')} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">New Text File</button>
                    <div className="h-px bg-white/10 my-1" />
                    <button onClick={() => openApp(AppId.SETTINGS)} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">Settings</button>
                    </div>
                )}

                {/* Windows (Filtered by Desktop) */}
                {windows.map(window => {
                    // Only show windows for current desktop
                    if (window.desktopId !== currentDesktop && !window.isMinimized) {
                        return null;
                    }

                    const AppComp = APPS[window.appId as AppId]?.component;

                    // Handle External Windows (Tracking Only)
                    if (window.isExternal) {
                        return null;
                    }

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
                        onMove={checkWindowSnap}
                        onDragEnd={updateWindowPosition}
                        onResize={resizeWindow}
                        >
                        {/* Inject props for specific apps that need state access */}
                        {window.appId === AppId.SETTINGS ? (
                            // @ts-ignore - injecting props
                            <AppComp windowId={window.id} config={userConfig} onSave={handleSaveSettings} initialTab={window.props?.initialTab} />
                        ) : (
                            <AppComp windowId={window.id} {...(window.props || {})} />
                        )}
                        </Window>
                    );
                })}

                {/* Panels */}
                <div className="absolute inset-0 pointer-events-none z-50">
                <StartMenu
                isOpen={isStartMenuOpen || isFullScreenStartOpen}
                isFullScreen={isFullScreenStartOpen}
                onOpenApp={openApp}
                onClose={() => { setIsStartMenuOpen(false); setIsFullScreenStartOpen(false); }}
                onToggleFullScreen={() => { setIsStartMenuOpen(false); setIsFullScreenStartOpen(true); }}
                disabledApps={userConfig.disabledApps}
                pinnedApps={userConfig.pinnedApps}
                onTogglePin={togglePin}
                />
                <ControlCenter isOpen={isControlCenterOpen} onOpenSettings={() => openApp(AppId.SETTINGS, false, undefined, { initialTab: 'wifi' })} />
                <NotificationPanel
                isOpen={isNotificationCenterOpen}
                onClose={() => setIsNotificationCenterOpen(false)}
                notifications={notifications}
                onClearAll={() => setNotifications([])}
                onDismiss={removeNotification}
                />
                </div>

                <div className="absolute inset-0 pointer-events-none z-50">
                <TopBar
                position={userConfig.barPosition}
                openWindows={windows.map(w => ({ id: w.id, appId: w.appId as AppId, isMinimized: w.isMinimized, isActive: w.id === activeWindowId, desktopId: w.desktopId }))}
                pinnedApps={userConfig.pinnedApps}
                disabledApps={userConfig.disabledApps}
                onOpenApp={openApp}
                onToggleWindow={toggleWindowFromTaskbar}
                onStartClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
                onStartDoubleClick={() => setIsFullScreenStartOpen(true)}
                onToggleControlCenter={() => setIsControlCenterOpen(!isControlCenterOpen)}
                onToggleNotifications={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
                isStartMenuOpen={isStartMenuOpen || isFullScreenStartOpen}
                unreadNotifications={notifications.filter(n => !n.read).length}
                currentDesktop={currentDesktop}
                onSwitchDesktop={setCurrentDesktop}
                />
                </div>
                </div>
            );
}
