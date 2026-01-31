import React, { useState, useEffect } from 'react';
import { Folder, FileText, HardDrive, ArrowLeft, ArrowRight, RefreshCw, Home, Search, ChevronRight, LayoutGrid, List as ListIcon, Clock, Star, Download, Image, Music, Video, File } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const ExplorerApp: React.FC<AppProps> = () => {
    const [currentPath, setCurrentPath] = useState('HOME');
    const [files, setFiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<string[]>(['HOME']);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'name' | 'size'>('name');

    const loadFiles = async (path: string, updateHistory = true) => {
        setIsLoading(true);
        try {
            const entries = await SystemBridge.getFiles(path);
            setFiles(entries);
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

    const sortedFiles = [...files].sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        // Mock size sort (real size parsing needed for production)
        return a.name.length - b.name.length;
    });

    const getIcon = (name: string, isDir: boolean) => {
        if (isDir) return <Folder size={viewMode === 'grid' ? 48 : 20} className="text-blue-500 fill-blue-500/20" />;
        if (name.endsWith('.png') || name.endsWith('.jpg')) return <Image size={viewMode === 'grid' ? 48 : 20} className="text-purple-400" />;
        if (name.endsWith('.mp4')) return <Video size={viewMode === 'grid' ? 48 : 20} className="text-red-400" />;
        if (name.endsWith('.mp3')) return <Music size={viewMode === 'grid' ? 48 : 20} className="text-yellow-400" />;
        return <FileText size={viewMode === 'grid' ? 48 : 20} className="text-slate-400" />;
    };

    const SidebarItem = ({ icon: Icon, label, path, active }: any) => (
        <button
        onClick={() => path && loadFiles(path)}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 transition-colors ${active ? 'bg-blue-600/20 text-blue-400 font-medium' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200'}`}
        >
        <Icon size={16} /> {label}
        </button>
    );

    return (
        <div className="flex h-full bg-slate-900 text-slate-100 flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 gap-3 bg-slate-800 shrink-0">
        <div className="flex gap-1">
        <button onClick={goBack} disabled={historyIndex === 0} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30 transition-colors"><ArrowLeft size={16} /></button>
        <button onClick={goForward} disabled={historyIndex === history.length - 1} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30 transition-colors"><ArrowRight size={16} /></button>
        <button onClick={() => handleUp()} className="p-1.5 hover:bg-white/10 rounded-md transition-colors"><ArrowLeft size={16} className="rotate-90" /></button>
        </div>

        <div className="flex-1 bg-slate-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-slate-300 font-mono flex items-center gap-2 mx-2 overflow-hidden shadow-inner">
        <Home size={12} className="text-slate-500 shrink-0" />
        <div className="flex items-center gap-1 truncate">
        {currentPath.replace('HOME', '~').split('/').map((part, i) => (
            <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={10} className="text-slate-600" />}
            <span className="hover:text-white cursor-pointer transition-colors">{part}</span>
            </React.Fragment>
        ))}
        </div>
        </div>

        <div className="relative w-48 hidden md:block">
        <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
        <input placeholder="Search" className="w-full bg-slate-900 border border-white/10 rounded-md pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-600" />
        </div>

        <div className="flex bg-slate-900 rounded-md p-0.5 border border-white/10">
        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={14} /></button>
        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}><ListIcon size={14} /></button>
        </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-slate-900/50 border-r border-white/5 p-3 flex flex-col gap-6 shrink-0">
        <div>
        <div className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Favorites</div>
        <SidebarItem icon={Home} label="Home" path="HOME" active={currentPath === 'HOME'} />
        <SidebarItem icon={FileText} label="Documents" />
        <SidebarItem icon={Download} label="Downloads" />
        <SidebarItem icon={Star} label="Starred" />
        </div>
        <div>
        <div className="px-3 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Locations</div>
        <SidebarItem icon={HardDrive} label="Root" path="/" active={currentPath === '/'} />
        <SidebarItem icon={Clock} label="Recent" />
        </div>
        </div>

        {/* File View */}
        <div className="flex-1 p-4 overflow-auto bg-slate-950/50 custom-scrollbar" onClick={() => {}}>
        {files.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
            <Folder size={64} className="mb-4" />
            <p className="text-lg">This folder is empty</p>
            </div>
        ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {sortedFiles.map((file, i) => (
                <div
                key={i}
                className="flex flex-col items-center p-4 hover:bg-white/5 hover:ring-1 hover:ring-blue-500/30 rounded-xl cursor-pointer transition-all group"
                onClick={() => handleNavigate(file)}
                >
                <div className="mb-3 transition-transform group-hover:scale-105 filter drop-shadow-lg">
                {getIcon(file.name, file.is_dir)}
                </div>
                <span className="text-xs text-center break-all line-clamp-2 w-full text-slate-300 group-hover:text-white transition-colors">{file.name}</span>
                </div>
            ))}
            </div>
        ) : (
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase border-b border-white/5">
            <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium w-24">Size</th>
            <th className="px-4 py-2 font-medium w-32">Type</th>
            </tr>
            </thead>
            <tbody>
            {sortedFiles.map((file, i) => (
                <tr key={i} onClick={() => handleNavigate(file)} className="hover:bg-white/5 cursor-pointer group transition-colors border-b border-white/5 last:border-0">
                <td className="px-4 py-2 flex items-center gap-3">
                {getIcon(file.name, file.is_dir)}
                <span className="text-slate-300 group-hover:text-white">{file.name}</span>
                </td>
                <td className="px-4 py-2 text-slate-500">{file.size}</td>
                <td className="px-4 py-2 text-slate-500">{file.is_dir ? 'Folder' : 'File'}</td>
                </tr>
            ))}
            </tbody>
            </table>
        )}
        </div>
        </div>
        </div>
    );
};

export default ExplorerApp;
