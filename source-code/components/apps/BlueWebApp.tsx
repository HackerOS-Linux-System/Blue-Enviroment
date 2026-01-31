import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Search, Lock, Globe, Plus, X, Star, Bookmark } from 'lucide-react';
import { AppProps } from '../../types';

interface Tab {
    id: string;
    url: string;
    title: string;
    history: string[];
    historyIndex: number;
}

const SHORTCUTS = [
    { title: 'Google', url: 'https://www.google.com/webhp?igu=1', color: 'bg-white text-red-500' },
{ title: 'GitHub', url: 'https://github.com', color: 'bg-slate-800 text-white' },
{ title: 'YouTube', url: 'https://youtube.com', color: 'bg-red-600 text-white' },
{ title: 'Wikipedia', url: 'https://wikipedia.org', color: 'bg-slate-200 text-black' },
{ title: 'Reddit', url: 'https://reddit.com', color: 'bg-orange-500 text-white' },
{ title: 'HackerNews', url: 'https://news.ycombinator.com', color: 'bg-orange-600 text-white' },
];

const BlueWebApp: React.FC<AppProps> = () => {
    const [tabs, setTabs] = useState<Tab[]>([{
        id: '1',
        url: 'about:home',
        title: 'New Tab',
        history: ['about:home'],
        historyIndex: 0
    }]);
    const [activeTabId, setActiveTabId] = useState('1');
    const [inputUrl, setInputUrl] = useState('');

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
            historyIndex: newHistory.length - 1,
            title: newUrl === 'about:home' ? 'New Tab' : 'Loading...'
        });
        setInputUrl(newUrl === 'about:home' ? '' : newUrl);
    };

    const handleNavigate = (e: React.FormEvent) => {
        e.preventDefault();
        let target = inputUrl;
        if (!target) return;

        if (target === 'about:home') {
            loadUrl('about:home');
            return;
        }

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
            setInputUrl(newUrl === 'about:home' ? '' : newUrl);
        }
    };

    const goForward = () => {
        if (activeTab.historyIndex < activeTab.history.length - 1) {
            const newIdx = activeTab.historyIndex + 1;
            const newUrl = activeTab.history[newIdx];
            updateTab(activeTabId, { historyIndex: newIdx, url: newUrl });
            setInputUrl(newUrl === 'about:home' ? '' : newUrl);
        }
    };

    const addTab = () => {
        const newId = Date.now().toString();
        const newTab: Tab = {
            id: newId,
            url: 'about:home',
            title: 'New Tab',
            history: ['about:home'],
            historyIndex: 0
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newId);
        setInputUrl('');
    };

    const closeTab = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            const nextTab = newTabs[newTabs.length - 1];
            setActiveTabId(nextTab.id);
            setInputUrl(nextTab.url === 'about:home' ? '' : nextTab.url);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900">
        {/* Tabs */}
        <div className="flex items-center bg-slate-950 pt-2 px-2 gap-1 overflow-x-auto no-scrollbar shrink-0">
        {tabs.map(tab => (
            <div
            key={tab.id}
            onClick={() => { setActiveTabId(tab.id); setInputUrl(tab.url === 'about:home' ? '' : tab.url); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs w-40 max-w-[160px] cursor-pointer group transition-colors border-b-0 relative ${activeTabId === tab.id ? 'bg-slate-800 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-900'}`}
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
        <div className="flex items-center gap-2 p-2 bg-slate-800 border-b border-white/5 shadow-sm z-10 shrink-0">
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

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-slate-900 rounded-full px-4 py-2 border border-white/10 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner group">
        {activeTab.url.startsWith('https') ? <Lock size={12} className="text-green-400 mr-2" /> : <Search size={12} className="text-slate-500 mr-2" />}
        <input
        className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder-slate-600"
        value={inputUrl}
        onChange={e => setInputUrl(e.target.value)}
        placeholder="Search Google or enter a URL"
        />
        <Star size={14} className="text-slate-600 hover:text-yellow-400 cursor-pointer transition-colors" />
        </form>

        <button className="p-2 hover:bg-white/10 rounded-full text-slate-400" onClick={() => loadUrl('about:home')}>
        <Home size={18} />
        </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative bg-slate-100 overflow-hidden">
        {activeTab.url === 'about:home' ? (
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-8">
            <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold text-white mb-2">Blue Web</h1>
            <p className="text-slate-400">Search the web securely</p>
            </div>

            <form onSubmit={handleNavigate} className="w-full max-w-2xl relative mb-12">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
            className="w-full bg-slate-800 border border-white/10 rounded-full py-4 pl-12 pr-6 text-lg text-white focus:outline-none focus:border-blue-500 shadow-xl transition-all"
            placeholder="Search or enter address"
            onChange={e => setInputUrl(e.target.value)}
            autoFocus
            />
            </form>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {SHORTCUTS.map(sc => (
                <button key={sc.title} onClick={() => loadUrl(sc.url)} className="flex flex-col items-center gap-3 group">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-lg group-hover:scale-110 transition-transform ${sc.color}`}>
                {sc.title[0]}
                </div>
                <span className="text-xs text-slate-300 group-hover:text-white">{sc.title}</span>
                </button>
            ))}
            </div>
            </div>
        ) : (
            <iframe
            src={activeTab.url}
            className="w-full h-full border-none bg-white"
            title="browser"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-presentation"
            onLoad={(e) => {
                const newTitle = activeTab.url.includes('google') ? 'Google' : 'Web Page';
                updateTab(activeTabId, { title: newTitle });
            }}
            />
        )}
        </div>
        </div>
    );
};

export default BlueWebApp;
