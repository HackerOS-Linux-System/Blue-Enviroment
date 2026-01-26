import { ReactNode } from 'react';

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

    EXTERNAL = 'external'
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
}

export interface UserConfig {
    wallpaper: string;
    theme: 'dark' | 'light'; // Deprecated in favor of themeName
    themeName: 'blue-default' | 'cyberpunk' | 'dracula' | 'light-glass';
    accentColor: string;
    displayScale: number;
}

export interface AppProps {
    windowId: string;
}

