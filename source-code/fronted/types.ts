import { ReactNode } from 'react';

// Internal Apps (React Components)
export enum AppId {
    TERMINAL = 'terminal',
    AI_ASSISTANT = 'ai_assistant',
    EXPLORER = 'explorer',
    SETTINGS = 'settings',
    ABOUT = 'about',
    // External app placeholder
    EXTERNAL = 'external'
}

// Represents a Linux .desktop entry
export interface DesktopEntry {
    id: string;
    name: string;
    comment: string;
    icon: string; // Path to icon or icon name
    exec: string;
    categories: string[];
}

export interface AppDefinition {
    id: AppId | string;
    title: string;
    icon: React.ComponentType<any> | string; // Component or URL/Path
    component?: React.ComponentType<any>; // Only for internal apps
    isExternal?: boolean; // True if it launches a Linux process
    defaultWidth?: number;
    defaultHeight?: number;
}

export interface WindowState {
    id: string;
    appId: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isMinimized: boolean;
    isMaximized: boolean;
    zIndex: number;
    isExternal: boolean; // If true, this is a wrapper for a Wayland surface
}

export interface UserConfig {
    wallpaper: string;
    theme: 'dark' | 'light';
    accentColor: string;
    displayScale: number;
}

export interface SystemState {
    windows: WindowState[];
    activeWindowId: string | null;
    nextZIndex: number;
    isStartMenuOpen: boolean;
    isFullScreenStartOpen: boolean;
    isControlCenterOpen: boolean;
    isNotificationCenterOpen: boolean;
}

export interface AppProps {
    windowId: string;
}
