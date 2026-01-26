import React, { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Search, Lock, Globe } from 'lucide-react';
import { AppProps } from '../../types';

const BlueWebApp: React.FC<AppProps> = () => {
    const [url, setUrl] = useState('https://www.google.com/webhp?igu=1');
    const [inputUrl, setInputUrl] = useState(url);
    const [history, setHistory] = useState<string[]>(['https://www.google.com/webhp?igu=1']);
    const [historyIndex, setHistoryIndex] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const loadUrl = (newUrl: string) => {
        setUrl(newUrl);
        setInputUrl(newUrl);

        // Update history if it's a new entry
        if (newUrl !== history[historyIndex]) {
            const newHistory = history.slice(0, historyIndex + 1);
            newHistory.push(newUrl);
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
        }
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
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setUrl(history[newIndex]);
            setInputUrl(history[newIndex]);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setUrl(history[newIndex]);
            setInputUrl(history[newIndex]);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900">
        <div className="flex items-center gap-2 p-2 bg-slate-800 border-b border-white/5 shadow-sm z-10">
        <div className="flex items-center gap-1">
        <button onClick={goBack} disabled={historyIndex === 0} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ArrowLeft size={16} />
        </button>
        <button onClick={goForward} disabled={historyIndex === history.length - 1} className="p-2 hover:bg-white/10 rounded-full text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
        <ArrowRight size={16} />
        </button>
        <button onClick={() => setUrl(url)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
        <RotateCw size={16} />
        </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-slate-900 rounded-full px-4 py-2 border border-white/10 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
        {url.startsWith('https') ? <Lock size={12} className="text-green-400 mr-2" /> : <Globe size={12} className="text-slate-500 mr-2" />}
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
        ref={iframeRef}
        src={url}
        className="w-full h-full border-none"
        title="browser"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-presentation"
        />
        {/* Overlay to catch clicks if needed for custom context menus, usually not needed for iframe */}
        </div>

        <div className="h-6 bg-slate-800 border-t border-white/5 flex items-center px-3 text-[10px] text-slate-500">
        <span className="mr-auto">{url}</span>
        <span>Blue Web Engine 1.0</span>
        </div>
        </div>
    );
};

export default BlueWebApp;
