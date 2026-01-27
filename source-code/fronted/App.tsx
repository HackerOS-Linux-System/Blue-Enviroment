import React, { useState, useEffect, useRef } from 'react';
import { AppId, WindowState, UserConfig, CustomTheme } from './types';
import { APPS, THEMES, WALLPAPER_URL } from './constants';
import { SystemBridge } from './utils/systemBridge';
import Window from './components/Window';
import TopBar from './components/TopBar';
import StartMenu from './components/StartMenu';
import ControlCenter from './components/ControlCenter';
import NotificationPanel from './components/NotificationPanel';
import WindowSwitcher from './components/WindowSwitcher';
import { FileText, Folder, Image, Music, Video, Trash2, Monitor, Smartphone, ChevronRight, FileCode, File } from 'lucide-react';

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

    // Initialize with default config to prevent "undefined" URL errors
    const [userConfig, setUserConfig] = useState<UserConfig>({
        wallpaper: WALLPAPER_URL,
        themeName: 'blue-default',
        accentColor: 'blue',
        displayScale: 1,
        barPosition: 'top'
    });

    const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

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

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null); // 'open-with', 'new'

    const desktopRef = useRef<HTMLDivElement>(null);

    // Load Config & Apply Theme
    useEffect(() => {
        // Initial load
        SystemBridge.getCustomThemes().then(setCustomThemes);
        SystemBridge.loadConfig().then((cfg) => {
            if (cfg) {
                setUserConfig(cfg);
                applyTheme(cfg.themeName);
            }
        });

        // Config polling - checks for external changes
        const interval = setInterval(() => {
            SystemBridge.loadConfig().then(cfg => {
                setUserConfig(current => {
                    // Deep comparison simplified to avoid unnecessary re-renders
                    if (JSON.stringify(current) !== JSON.stringify(cfg)) {
                        if (current.themeName !== cfg.themeName) applyTheme(cfg.themeName);
                        return cfg;
                    }
                    return current;
                });
            });
        }, 5000);
        return () => clearInterval(interval);
    }, []); // Empty dependency array to prevent infinite loops!

    const applyTheme = (themeName: string) => {
        // Check if it's a custom theme
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

        // Standard theme
        const styleTag = document.getElementById('custom-theme-style');
        if (styleTag) styleTag.innerHTML = '';
        document.documentElement.setAttribute('data-theme', themeName);
    };

    // --- Window Manager Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'Tab') {
                e.preventDefault();
                if (windows.length > 0) {
                    if (!isSwitcherVisible) {
                        setIsSwitcherVisible(true);
                        setSwitcherSelectedIndex((prev) => {
                            const currentIndex = windows.findIndex(w => w.id === activeWindowId);
                            return (currentIndex + 1) % windows.length;
                        });
                    } else {
                        setSwitcherSelectedIndex(prev => (prev + 1) % windows.length);
                    }
                }
            }
            if (e.metaKey && e.key === 'Tab') {
                e.preventDefault();
                setIsSwitcherVisible(prev => !prev);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt' && isSwitcherVisible) {
                const selectedWindow = windows[switcherSelectedIndex];
                if (selectedWindow) {
                    focusWindow(selectedWindow.id);
                    if (selectedWindow.isMinimized) toggleWindowFromTaskbar(selectedWindow.id);
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
            // Allow passing through clicks to overlays if they are not the target
            if (e.target === desktopRef.current || e.target === document.body) {
                setSelectionBox({
                    start: { x: e.clientX, y: e.clientY },
                    end: { x: e.clientX, y: e.clientY }
                });
                setSelectedItems([]);
                setContextMenu({ ...contextMenu, visible: false });
                setActiveSubmenu(null);
                setIsStartMenuOpen(false);
                setIsControlCenterOpen(false);
            }
        };

        const handleDesktopMouseMove = (e: React.MouseEvent) => {
            if (selectionBox) {
                setSelectionBox(prev => prev ? ({ ...prev, end: { x: e.clientX, y: e.clientY } }) : null);
            }
        };

        const handleDesktopMouseUp = () => {
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
            } else if (item.type === 'trash') {
                // Open Trash logic - simplified: just show alert or open explorer to trash path
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

        const handleOpenWith = (appId: string) => {
            openApp(appId);
            setContextMenu({ ...contextMenu, visible: false });
        };

        const handleDelete = () => {
            if (contextMenu.targetId) {
                const item = desktopItems.find(i => i.id === contextMenu.targetId);
                if (item && item.id !== 'trash' && item.id !== 'home') {
                    setDesktopItems(prev => prev.filter(i => i.id !== item.id));
                    setTrashItems(prev => [...prev, item]);
                }
            }
            setContextMenu({ ...contextMenu, visible: false });
        };

        const handleEmptyTrash = () => {
            setTrashItems([]);
            alert("Trash emptied.");
            setContextMenu({ ...contextMenu, visible: false });
        };

        const handleCreate = (type: 'folder' | 'txt' | 'js' | 'py') => {
            const x = contextMenu.x;
            const y = contextMenu.y;

            let newItem: DesktopItem;
            const id = Date.now().toString();

            if (type === 'folder') {
                newItem = { id, name: 'New Folder', type: 'folder', x, y, icon: Folder };
            } else if (type === 'txt') {
                newItem = { id, name: 'New Document.txt', type: 'file', x, y };
            } else if (type === 'js') {
                newItem = { id, name: 'script.js', type: 'file', x, y, icon: FileCode };
            } else {
                newItem = { id, name: 'main.py', type: 'file', x, y, icon: FileCode };
            }

            setDesktopItems(prev => [...prev, newItem]);
            setContextMenu({ ...contextMenu, visible: false });
        };

        return (
            <div
            ref={desktopRef}
            className={`relative w-screen h-screen overflow-hidden bg-cover bg-center select-none theme-text-primary font-sans`}
            style={{ backgroundImage: userConfig?.wallpaper ? `url(${userConfig.wallpaper})` : 'none', backgroundColor: '#0f172a' }}
            onMouseDown={handleDesktopMouseDown}
            onMouseMove={handleDesktopMouseMove}
            onMouseUp={handleDesktopMouseUp}
            onContextMenu={(e) => handleContextMenu(e)}
            >
            <div className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${userConfig?.themeName === 'light-glass' ? 'bg-white/10' : 'bg-slate-900/10'}`} />

            {/* Switcher */}
            <WindowSwitcher windows={windows} selectedIndex={switcherSelectedIndex} isVisible={isSwitcherVisible} />

            {/* Desktop Icons */}
            {desktopItems.map(item => (
                <div
                key={item.id}
                className={`absolute flex flex-col items-center gap-1 p-2 w-24 rounded-lg border border-transparent transition-all hover:bg-white/10 z-0 ${selectedItems.includes(item.id) ? 'bg-blue-600/30 border-blue-500/50 backdrop-blur-sm' : ''}`}
                style={{ left: item.x, top: item.y }}
                onMouseDown={(e) => handleIconClick(e, item.id)}
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

            {/* Context Menu (Nested) */}
            {contextMenu.visible && (
                <div
                className="absolute w-56 theme-bg-secondary/95 backdrop-blur-xl theme-border border rounded-lg shadow-2xl z-[9999] flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100"
                style={{ left: contextMenu.x, top: contextMenu.y }}
                onMouseDown={e => e.stopPropagation()}
                >
                {contextMenu.targetId ? (
                    <>
                    {/* Item Actions */}
                    <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu('open-with')}
                    onMouseLeave={() => setActiveSubmenu(null)}
                    >
                    <button className="w-full flex items-center justify-between px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">
                    <span>Open With...</span>
                    <ChevronRight size={14} />
                    </button>
                    {activeSubmenu === 'open-with' && (
                        <div className="absolute left-full top-0 w-48 theme-bg-secondary/95 backdrop-blur-xl theme-border border rounded-lg shadow-xl ml-1 py-1">
                        <button onClick={() => handleOpenWith(AppId.BLUE_EDIT)} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><FileText size={14} /> Blue Edit</button>
                        <button onClick={() => handleOpenWith(AppId.BLUE_IMAGES)} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Image size={14} /> Blue Images</button>
                        <button onClick={() => handleOpenWith(AppId.BLUE_MUSIC)} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Music size={14} /> Blue Music</button>
                        <button onClick={() => handleOpenWith(AppId.BLUE_VIDEOS)} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Video size={14} /> Blue Videos</button>
                        <button onClick={() => handleOpenWith(AppId.BLUE_WEB)} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Monitor size={14} /> Blue Web</button>
                        </div>
                    )}
                    </div>

                    <button className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">Rename</button>
                    <div className="h-px bg-white/10 my-1" />

                    {contextMenu.targetType === 'trash' ? (
                        <button onClick={handleEmptyTrash} className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/50 text-sm text-left"><Trash2 size={14} /> Empty Trash</button>
                    ) : (
                        <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/50 text-sm text-left"><Trash2 size={14} /> Delete</button>
                    )}
                    </>
                ) : (
                    <>
                    {/* Desktop Actions */}
                    <button onClick={() => openApp(AppId.SETTINGS)} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left rounded-t-lg">Personalization</button>
                    <button onClick={() => openApp(AppId.TERMINAL)} className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">Open Terminal</button>

                    <div className="h-px bg-white/10 my-1" />

                    <div
                    className="relative"
                    onMouseEnter={() => setActiveSubmenu('new')}
                    onMouseLeave={() => setActiveSubmenu(null)}
                    >
                    <button className="w-full flex items-center justify-between px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">
                    <span>Create New</span>
                    <ChevronRight size={14} />
                    </button>
                    {activeSubmenu === 'new' && (
                        <div className="absolute left-full top-0 w-48 theme-bg-secondary/95 backdrop-blur-xl theme-border border rounded-lg shadow-xl ml-1 py-1">
                        <button onClick={() => handleCreate('folder')} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><Folder size={14} /> Folder</button>
                        <button onClick={() => handleCreate('txt')} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><FileText size={14} /> Text File</button>
                        <button onClick={() => handleCreate('js')} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><FileCode size={14} /> JS Script</button>
                        <button onClick={() => handleCreate('py')} className="w-full flex items-center gap-2 px-3 py-2 hover:theme-accent hover:text-white text-sm text-left"><FileCode size={14} /> Python Script</button>
                        </div>
                    )}
                    </div>

                    <button className="px-3 py-2 hover:theme-accent hover:text-white text-sm text-left">Paste</button>
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

            {/* Overlays Wrapper - POINTER EVENTS NONE to avoid blocking desktop */}
            <div className="absolute inset-0 pointer-events-none z-50">
            {/* Children must have pointer-events-auto */}
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

            <div className="absolute inset-0 pointer-events-none z-50">
            <TopBar
            position={userConfig.barPosition}
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
