import React from 'react';

// Internal Apps (React Components)
export enum AppId {
    TERMINAL = 'terminal',
    AI_ASSISTANT = 'ai_assistant',
    EXPLORER = 'explorer',
    SETTINGS = 'settings',
    ABOUT = 'about',

    // New Apps
    BLUE_WEB = 'blue_web',
    BLUE_EDIT = 'blue_edit',
    BLUE_IMAGES = 'blue_images',
    BLUE_VIDEOS = 'blue_videos',
    BLUE_MUSIC = 'blue_music',
    CALCULATOR = 'calculator',
    SYSTEM_MONITOR = 'system_monitor',
    BLUE_SCREEN = 'blue_screen',
    BLUE_CONNECT = 'blue_connect',
    BLUE_SOFTWARE = 'blue_software'
}

export interface DesktopEntry {
    id: string;
    name: string;
    comment: string;
    icon: string;
    exec: string;
    categories: string[];
}

export interface AppDefinition {
    id: AppId | string;
    title: string;
    icon: React.ComponentType<any> | string;
    component?: React.ComponentType<any>;
    isExternal?: boolean;
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
    isExternal: boolean;
    desktopId: number; // For Virtual Desktops (0, 1, 2...)
    props?: any; // Extra props to pass to the component
}

export interface CustomTheme {
    id: string;
    name: string;
    cssContent: string; // The raw CSS string
    path?: string; // File path on disk
}

export interface UserConfig {
    wallpaper: string;
    themeName: 'blue-default' | 'cyberpunk' | 'dracula' | 'light-glass' | string;
    accentColor: string;
    displayScale: number;
    barPosition: 'top' | 'bottom';
    disabledApps: string[]; // List of AppIds that are hidden
    pinnedApps: string[]; // List of AppIds pinned to the taskbar
}

export interface AppProps {
    windowId: string;
}

export type PackageSource = 'apt' | 'flatpak' | 'snap' | 'brew' | 'manual';

export interface SoftwarePackage {
    id: string;
    packageId: string;
    source: PackageSource;
    name: string;
    description: string;
    version: string;
    category: 'Development' | 'Productivity' | 'Multimedia' | 'System' | 'Games';
    icon?: any;
    installed: boolean;
    size: string;
    author: string;
}

export interface WifiNetwork {
    ssid: string;
    signal: number;
    secure: boolean;
    in_use: boolean;
}

export interface BluetoothDevice {
    name: string;
    type?: string;
    mac: string;
    connected: boolean;
}

export interface Notification {
    id: string;
    title: string;
    message: string;
    timestamp: Date;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    actionLabel?: string;
    onAction?: () => void;
}
