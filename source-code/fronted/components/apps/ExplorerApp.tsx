import React, { useState, useEffect } from 'react';
import { Folder, FileText, HardDrive, ArrowLeft, ArrowRight, RefreshCw, Home, Search, ChevronRight } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const ExplorerApp: React.FC<AppProps> = () => {
    const [currentPath, setCurrentPath] = useState('HOME');
    const [files, setFiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<string[]>(['HOME']);
    const [historyIndex, setHistoryIndex] = useState(0);

    const loadFiles = async (path: string, updateHistory = true) => {
        setIsLoading(true);
        try {
            const entries = await SystemBridge.getFiles(path);
            setFiles(entries.sort((a: any, b: any) => (a.is_dir === b.is_dir) ? 0 : a.is_dir ? -1 : 1));
            setCurrentPath(path);

            if (updateHistory && path !== history[historyIndex]) {
                const newHistory = history.slice(0, historyIndex + 1);
                newHistory.push(path);
                setHistory(newHistory);
                setHistoryIndex(newHistory.length - 1);
            }
        } catch (e) {
            console.error("Failed to load files", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFiles('HOME');
    }, []);

    const handleNavigate = (entry: any) => {
        if (entry.is_dir) {
            loadFiles(entry.path);
        } else {
            // File opening logic would go here
        }
    };

    const goBack = () => {
        if (historyIndex > 0) {
            const newIdx = historyIndex - 1;
            setHistoryIndex(newIdx);
            loadFiles(history[newIdx], false);
        }
    };

    const goForward = () => {
        if (historyIndex < history.length - 1) {
            const newIdx = historyIndex + 1;
            setHistoryIndex(newIdx);
            loadFiles(history[newIdx], false);
        }
    };

    const handleUp = () => {
        if (currentPath === 'HOME' || currentPath === '/') return;
        const parts = currentPath.split('/');
        parts.pop();
        const parent = parts.join('/') || '/';
        loadFiles(parent);
    };

    return (
        <div className="flex h-full bg-slate-900 text-slate-100 flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2 bg-slate-800">
        <div className="flex gap-1">
        <button onClick={goBack} disabled={historyIndex === 0} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30"><ArrowLeft size={16} /></button>
        <button onClick={goForward} disabled={historyIndex === history.length - 1} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30"><ArrowRight size={16} /></button>
        <button onClick={() => loadFiles(currentPath, false)} className="p-1.5 hover:bg-white/10 rounded-md"><RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /></button>
        <button onClick={() => handleUp()} className="p-1.5 hover:bg-white/10 rounded-md"><ArrowLeft size={16} className="rotate-90" /></button>
        </div>

        <div className="flex-1 bg-slate-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-300 font-mono flex items-center gap-2 mx-2">
        <Home size={12} className="text-slate-500" />
        {currentPath.replace('HOME', '~').split('/').map((part, i) => (
            <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} className="text-slate-600" />}
            <span>{part}</span>
            </React.Fragment>
        ))}
        </div>

        <div className="relative w-48">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input placeholder="Search" className="w-full bg-slate-900 border border-white/10 rounded-md pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:border-blue-500/50" />
        </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-slate-900/50 border-r border-white/5 p-2 space-y-1">
        <button onClick={() => loadFiles('HOME')} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${currentPath === 'HOME' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-white/5'}`}>
        <Home size={16} /> Home
        </button>
        <button className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-white/5 text-slate-400">
        <FileText size={16} /> Documents
        </button>
        <button className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 hover:bg-white/5 text-slate-400">
        <Folder size={16} /> Downloads
        </button>
        </div>

        {/* File Grid */}
        <div className="flex-1 p-4 overflow-auto bg-slate-950">
        <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {files.map((file, i) => (
            <div
            key={i}
            className="flex flex-col items-center p-3 hover:bg-blue-600/10 hover:ring-1 hover:ring-blue-500/30 rounded-xl cursor-pointer transition-all group"
            onClick={() => handleNavigate(file)}
            >
            <div className="mb-2 transition-transform group-hover:scale-105">
            {file.is_dir ? (
                <Folder size={48} className="text-blue-500 fill-blue-500/20" />
            ) : (
                <FileText size={48} className="text-slate-500 group-hover:text-slate-300" />
            )}
            </div>
            <span className="text-xs text-center break-all line-clamp-2 w-full">{file.name}</span>
            <span className="text-[10px] text-slate-600 mt-1">{file.size}</span>
            </div>
        ))}
        {files.length === 0 && !isLoading && (
            <div className="col-span-full flex flex-col items-center justify-center text-slate-500 mt-20 opacity-50">
            <Folder size={48} className="mb-2" />
            <p>This folder is empty</p>
            </div>
        )}
        </div>
        </div>
        </div>
        </div>
    );
};

export default ExplorerApp;
