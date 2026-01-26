import React, { useState } from 'react';
import { Image as ImageIcon, Video, Music, FolderOpen } from 'lucide-react';
import { AppProps } from '../../types';

// @ts-ignore
import { convertFileSrc } from '@tauri-apps/api/tauri';
// @ts-ignore
import { open } from '@tauri-apps/api/dialog';

interface BlueMediaAppProps extends AppProps {
    type: 'image' | 'video' | 'audio';
}

const BlueMediaApp: React.FC<BlueMediaAppProps> = ({ type }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleOpenFile = async () => {
        try {
            let filters = [];
            if (type === 'image') filters.push({ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] });
            if (type === 'video') filters.push({ name: 'Videos', extensions: ['mp4', 'mkv', 'webm', 'mov'] });
            if (type === 'audio') filters.push({ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] });

            // Check if running in Tauri
            if (typeof window !== 'undefined' && (window as any).__TAURI__) {
                const selected = await open({
                    multiple: false,
                    filters: filters
                });

                if (typeof selected === 'string') {
                    const url = convertFileSrc(selected);
                    setSrc(url);
                    setFileName(selected.split(/[\\/]/).pop() || 'Unknown');
                    setError('');
                }
            } else {
                // Web fallback (Browser mode)
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
                input.onchange = (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                        const url = URL.createObjectURL(file);
                        setSrc(url);
                        setFileName(file.name);
                        setError('');
                    }
                };
                input.click();
            }
        } catch (e) {
            console.error(e);
            setError('Failed to open file');
        }
    };

    const Icon = type === 'image' ? ImageIcon : type === 'video' ? Video : Music;

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-100">
        {/* Toolbar */}
        <div className="h-12 bg-slate-900 border-b border-white/5 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2 font-medium text-sm">
        <Icon size={18} className="text-blue-400" />
        <span>{fileName || `Blue ${type === 'image' ? 'Viewer' : type === 'video' ? 'Player' : 'Audio'}`}</span>
        </div>
        <button
        onClick={handleOpenFile}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
        <FolderOpen size={14} /> Open File
        </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-hidden bg-black/50 relative">
        {!src && (
            <div className="text-center text-slate-500">
            <Icon size={48} className="mx-auto mb-2 opacity-20" />
            <p>No media selected</p>
            <button onClick={handleOpenFile} className="mt-4 text-blue-400 text-sm hover:underline">Choose a file from disk</button>
            </div>
        )}

        {src && type === 'image' && (
            <img src={src} className="max-w-full max-h-full object-contain" alt="Content" />
        )}

        {src && type === 'video' && (
            <video src={src} controls className="max-w-full max-h-full" autoPlay />
        )}

        {src && type === 'audio' && (
            <div className="flex flex-col items-center gap-8 bg-slate-900/50 p-12 rounded-3xl border border-white/5 backdrop-blur-md">
            <div className="w-48 h-48 bg-gradient-to-br from-blue-900 to-slate-900 rounded-full flex items-center justify-center shadow-2xl border border-white/10 animate-pulse">
            <Music size={64} className="text-white drop-shadow-lg" />
            </div>
            <div className="text-center">
            <h2 className="text-xl font-bold mb-1">{fileName}</h2>
            <span className="text-blue-400 text-xs uppercase tracking-wider">Now Playing</span>
            </div>
            <audio src={src} controls className="w-80" autoPlay />
            </div>
        )}

        {error && <div className="absolute bottom-4 bg-red-500/20 text-red-200 px-4 py-2 rounded-lg border border-red-500/50">{error}</div>}
        </div>
        </div>
    );
};

export default BlueMediaApp;
