import { Terminal, Bot, FolderOpen, Settings, Info, Box, Globe, FileEdit, Image as ImageIcon, Video, Music, Calculator, Activity, Monitor, Smartphone, ShoppingBag } from 'lucide-react';
import { AppDefinition, AppId } from './types';

import GeminiAssistantApp from './components/apps/GeminiAssistantApp';
import ExplorerApp from './components/apps/ExplorerApp';
import SettingsApp from './components/apps/SettingsApp';
import AboutApp from './components/apps/AboutApp';
import BlueWebApp from './components/apps/BlueWebApp';
import BlueEditApp from './components/apps/BlueEditApp';
import CalculatorApp from './components/apps/CalculatorApp';
import SystemMonitorApp from './components/apps/SystemMonitorApp';
import BlueScreenApp from './components/apps/BlueScreenApp';
import BlueMediaApp from './components/apps/BlueMediaApp';
import BlueConnectApp from './components/apps/BlueConnectApp';
import BlueSoftwareApp from './components/apps/BlueSoftwareApp';
import TerminalApp from './components/apps/TerminalApp';

export const WALLPAPER_URL = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";

export const THEMES = {
    'blue-default': { name: 'Blue Glass', bg: 'bg-slate-900', accent: 'blue' },
    'cyberpunk': { name: 'Cyberpunk', bg: 'bg-zinc-950', accent: 'yellow' },
    'dracula': { name: 'Dracula', bg: 'bg-[#282a36]', accent: 'purple' },
    'light-glass': { name: 'Light Glass', bg: 'bg-slate-200', accent: 'blue' },
};

export const APPS: Record<AppId, AppDefinition> = {
    [AppId.TERMINAL]: {
        id: AppId.TERMINAL,
        title: 'Blue Terminal',
        icon: Terminal,
        component: TerminalApp,
        defaultWidth: 700,
            defaultHeight: 500,
    },
    [AppId.BLUE_SOFTWARE]: {
        id: AppId.BLUE_SOFTWARE,
        title: 'Blue Software',
        icon: ShoppingBag,
        component: BlueSoftwareApp,
        defaultWidth: 900,
            defaultHeight: 650
    },
    [AppId.BLUE_WEB]: {
        id: AppId.BLUE_WEB,
        title: 'Blue Web',
        icon: Globe,
        component: BlueWebApp,
        defaultWidth: 1000,
            defaultHeight: 700,
    },
    [AppId.BLUE_EDIT]: {
        id: AppId.BLUE_EDIT,
        title: 'Blue Edit',
        icon: FileEdit,
        component: BlueEditApp,
        defaultWidth: 800,
            defaultHeight: 600,
    },
    [AppId.EXPLORER]: {
        id: AppId.EXPLORER,
        title: 'Files',
        icon: FolderOpen,
        component: ExplorerApp,
        defaultWidth: 800,
            defaultHeight: 550,
    },
    [AppId.BLUE_IMAGES]: {
        id: AppId.BLUE_IMAGES,
        title: 'Blue Images',
        icon: ImageIcon,
        component: (props) => <BlueMediaApp {...props} type="image" />,
        defaultWidth: 800,
            defaultHeight: 600,
    },
    [AppId.BLUE_VIDEOS]: {
        id: AppId.BLUE_VIDEOS,
        title: 'Blue Videos',
        icon: Video,
        component: (props) => <BlueMediaApp {...props} type="video" />,
        defaultWidth: 800,
            defaultHeight: 600,
    },
    [AppId.BLUE_MUSIC]: {
        id: AppId.BLUE_MUSIC,
        title: 'Blue Music',
        icon: Music,
        component: (props) => <BlueMediaApp {...props} type="audio" />,
        defaultWidth: 400,
            defaultHeight: 500,
    },
    [AppId.CALCULATOR]: {
        id: AppId.CALCULATOR,
        title: 'Calculator',
        icon: Calculator,
        component: CalculatorApp,
        defaultWidth: 320,
            defaultHeight: 450,
    },
    [AppId.SYSTEM_MONITOR]: {
        id: AppId.SYSTEM_MONITOR,
        title: 'System Monitor',
        icon: Activity,
        component: SystemMonitorApp,
        defaultWidth: 800,
            defaultHeight: 600,
    },
    [AppId.BLUE_SCREEN]: {
        id: AppId.BLUE_SCREEN,
        title: 'Blue Screen',
        icon: Monitor,
        component: BlueScreenApp,
        defaultWidth: 400,
            defaultHeight: 250,
    },
    [AppId.BLUE_CONNECT]: {
        id: AppId.BLUE_CONNECT,
        title: 'Blue Connect',
        icon: Smartphone,
        component: BlueConnectApp,
        defaultWidth: 750,
            defaultHeight: 550,
    },
    [AppId.AI_ASSISTANT]: {
        id: AppId.AI_ASSISTANT,
        title: 'Blue AI',
        icon: Bot,
        component: GeminiAssistantApp,
        defaultWidth: 450,
            defaultHeight: 650,
    },
    [AppId.SETTINGS]: {
        id: AppId.SETTINGS,
        title: 'Settings',
        icon: Settings,
        component: SettingsApp,
        defaultWidth: 850,
            defaultHeight: 600,
    },
    [AppId.ABOUT]: {
        id: AppId.ABOUT,
        title: 'About Blue',
        icon: Info,
        component: AboutApp,
        defaultWidth: 400,
            defaultHeight: 350,
    },
};
