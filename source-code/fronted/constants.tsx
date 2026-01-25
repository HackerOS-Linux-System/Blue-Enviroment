import { Terminal, Bot, FolderOpen, Settings, Info, Box } from 'lucide-react';
import { AppDefinition, AppId } from './types';
import TerminalApp from './components/apps/TerminalApp';
import GeminiAssistantApp from './components/apps/GeminiAssistantApp';
import ExplorerApp from './components/apps/ExplorerApp';
import SettingsApp from './components/apps/SettingsApp';
import AboutApp from './components/apps/AboutApp';

export const WALLPAPER_URL = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";

export const APPS: Record<AppId, AppDefinition> = {
    [AppId.TERMINAL]: {
        id: AppId.TERMINAL,
        title: 'Terminal',
        icon: Terminal,
        component: TerminalApp,
        defaultWidth: 700,
            defaultHeight: 500,
    },
    [AppId.AI_ASSISTANT]: {
        id: AppId.AI_ASSISTANT,
        title: 'Blue AI',
        icon: Bot,
        component: GeminiAssistantApp,
        defaultWidth: 450,
            defaultHeight: 650,
    },
    [AppId.EXPLORER]: {
        id: AppId.EXPLORER,
        title: 'Files',
        icon: FolderOpen,
        component: ExplorerApp,
        defaultWidth: 800,
            defaultHeight: 550,
    },
    [AppId.SETTINGS]: {
        id: AppId.SETTINGS,
        title: 'Settings',
        icon: Settings,
        component: SettingsApp,
        defaultWidth: 600,
            defaultHeight: 400,
    },
    [AppId.ABOUT]: {
        id: AppId.ABOUT,
        title: 'About Blue',
        icon: Info,
        component: AboutApp,
        defaultWidth: 400,
            defaultHeight: 300,
    },
    [AppId.EXTERNAL]: {
        id: AppId.EXTERNAL,
        title: 'External App',
        icon: Box,
        isExternal: true,
    },
};
