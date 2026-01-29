import React, { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Search, Lock, Globe, Plus, X } from 'lucide-react';
import { AppProps } from '../../types';

interface Tab {
    id: string;
    url: string;
    title: string;
    history: string[];
    historyIndex: number;
}

const BlueWebApp: React.FC<AppProps> = () => {
    const [tabs, setTabs] = useState<Tab[]>([{
        id: '1',
        url: 'https://www.google.com/webhp?igu=1',
        title: 'New Tab',
        history: ['https://www.google.com/webhp?igu=1'],
        historyIndex: 0
    }]);
    const [activeTabId, setActiveTabId] = useState('1');
    const [inputUrl, setInputUrl] = useState('https://www.google.com/webhp?igu=1');

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

    const updateTab = (id: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const loadUrl = (newUrl: string) => {
        const currentHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        const newHistory = [...currentHistory, newUrl];

        updateTab(activeTabId, {
            url: newUrl,
            history: newHistory,
            historyIndex: newHistory.length - 1
        });
        setInputUrl(newUrl);
    };

    const handleNavigate = (e: React.FormEvent) => {
        e.preventDefault();
        let target = inputUrl;
        if (!target.startsWith('http')) {
            if (target.includes('.') && !target.includes(' ')) {
                target = 'https://' + target;
            } else {
                target = `https://www.google.com/search?q=${encodeURIComponent(target)}&igu=1`;
            }
        }
        loadUrl(target);
    };

    const goBack = () => {
        if (activeTab.historyIndex > 0) {
            const newIdx = activeTab.historyIndex - 1;
            const newUrl = activeTab.history[newIdx];
            updateTab(activeTabId, { historyIndex: newIdx, url: newUrl });
            setInputUrl(newUrl);
        }
    };

    const goForward = () => {
        if (activeTab.historyIndex < activeTab.history.length - 1) {
            const newIdx = activeTab.historyIndex + 1;
            const newUrl = activeTab.history[newIdx];
            updateTab(activeTabId, { historyIndex: newIdx, url: newUrl });
            setInputUrl(newUrl);
        }
    };

    const addTab = () => {
        const newId = Date.now().toString();
        const newTab: Tab = {
            id: newId,
            url: 'https://www.google.com/webhp?igu=1',
            title: 'New Tab',
            history: ['https://www.google.com/webhp?igu=1'],
            historyIndex: 0
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
        setInputUrl(newTab.url);
    };

    const closeTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
            setInputUrl(newTabs[newTabs.length - 1].url);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900">
        {/* Tabs */}
        <div className="flex items-center bg-slate-950 pt-2 px-2 gap-1 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
            <div
            key={tab.id}
            onClick={() => { setActiveTabId(tab.id); setInputUrl(tab.url); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs max-w-[150px] cursor-pointer group transition-colors ${activeTabId === tab.id ? 'bg-slate-800 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-900'}`}
            >
            <Globe size={12} className={activeTabId === tab.id ? 'text-blue-400' : ''} />
            <span className="truncate flex-1">{tab.title || 'New Tab'}</span>
            <button onClick={(e) => closeTab(e, tab.id)} className="p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
            <X size={10} />
            </button>
            </div>
        ))}
        <button onClick={addTab} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
        <Plus size={14} />
        </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 bg-slate-800 border-b border-white/5 shadow-sm z-10">
        <div className="flex items-center gap-1">
        <button onClick={goBack} disabled={activeTab.historyIndex === 0} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ArrowLeft size={16} />
        </button>
        <button onClick={goForward} disabled={activeTab.historyIndex === activeTab.history.length - 1} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ArrowRight size={16} />
        </button>
        <button onClick={() => loadUrl(activeTab.url)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
        <RotateCw size={16} />
        </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-slate-900 rounded-full px-4 py-2 border border-white/10 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
        {activeTab.url.startsWith('https') ? <Lock size={12} className="text-green-400 mr-2" /> : <Globe size={12} className="text-slate-500 mr-2" />}
        <input
        className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-slate-600"
        value={inputUrl}
        onChange={e => setInputUrl(e.target.value)}
        placeholder="Search Google or enter a URL"
        />
        </form>

        <button className="p-2 hover:bg-white/10 rounded-full text-slate-400" onClick={() => loadUrl('https://www.google.com/webhp?igu=1')}>
        <Home size={18} />
        </button>
        </div>

        <div className="flex-1 relative bg-white">
        <iframe
        src={activeTab.url}
        className="w-full h-full border-none"
        title="browser"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-presentation"
        onLoad={(e) => {
            // Cannot access title of cross-origin iframe due to security, so we simulate title
            // In a real Tauri app with Webview, we'd get the actual title event.
            const newTitle = activeTab.url.includes('google') ? 'Google' : 'Web Page';
            updateTab(activeTabId, { title: newTitle });
        }}
        />
        </div>
        </div>
    );
};

export default BlueWebApp;
