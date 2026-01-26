import React, { useState, useEffect } from 'react';
import { Folder, FileText, HardDrive, ArrowLeft, RefreshCw } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const ExplorerApp: React.FC<AppProps> = () => {
    const [currentPath, setCurrentPath] = useState('HOME');
    const [files, setFiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const loadFiles = async (path: string) => {
        setIsLoading(true);
        try {
            const entries = await SystemBridge.getFiles(path);
            setFiles(entries.sort((a: any, b: any) => (a.is_dir === b.is_dir) ? 0 : a.is_dir ? -1 : 1));
            setCurrentPath(path);
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
            // In a real OS, this would open the file
            console.log("Open file:", entry.path);
            // SystemBridge.launchApp(`xdg-open "${entry.path}"`);
        }
    };

    const handleUp = () => {
        // Simple parent detection
        if (currentPath === 'HOME' || currentPath === '/') return;
        const parts = currentPath.split('/');
        parts.pop();
        const parent = parts.join('/') || '/';
        loadFiles(parent);
    };

    return (
        <div className="flex h-full bg-slate-900 text-slate-100 flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 gap-4 bg-slate-800">
        <button onClick={handleUp} className="p-1 hover:bg-white/10 rounded"><ArrowLeft size={18} /></button>
        <button onClick={() => loadFiles(currentPath)} className="p-1 hover:bg-white/10 rounded"><RefreshCw size={18} className={isLoading ? "animate-spin" : ""} /></button>
        <div className="flex-1 bg-slate-900 border border-white/10 rounded px-3 py-1 text-sm text-slate-300 font-mono">
        {currentPath}
        </div>
        </div>

        {/* File Grid */}
        <div className="flex-1 p-2 overflow-auto">
        <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
        {files.map((file, i) => (
            <div
            key={i}
            className="flex flex-col items-center p-2 hover:bg-blue-600/20 rounded-lg cursor-pointer transition-colors group"
            onClick={() => handleNavigate(file)}
            >
            <div className="mb-2">
            {file.is_dir ? (
                <Folder size={48} className="text-blue-400 fill-blue-400/20" />
            ) : (
                <FileText size={48} className="text-slate-500 group-hover:text-slate-300" />
            )}
            </div>
            <span className="text-xs text-center break-all line-clamp-2">{file.name}</span>
            <span className="text-[10px] text-slate-500">{file.size}</span>
            </div>
        ))}
        {files.length === 0 && !isLoading && (
            <div className="col-span-full text-center text-slate-500 mt-10">Empty directory</div>
        )}
        </div>
        </div>
        </div>
    );
};

export default ExplorerApp;
