import React, { useState } from 'react';
import { Save, FolderOpen, FilePlus } from 'lucide-react';
import { AppProps } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const BlueEditApp: React.FC<AppProps> = () => {
    const [content, setContent] = useState('');
    const [filePath, setFilePath] = useState('');

    const handleSave = async () => {
        let path = filePath;
        if (!path) {
            path = prompt("Save as (full path):", "/home/user/document.txt") || "";
            if(!path) return;
            setFilePath(path);
        }
        await SystemBridge.writeFile(path, content);
    };

    const handleOpen = async () => {
        const path = prompt("Open file (full path):", "/home/user/document.txt");
        if(path) {
            const text = await SystemBridge.readFile(path);
            setContent(text);
            setFilePath(path);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
        <div className="h-10 bg-slate-800 border-b border-white/5 flex items-center px-2 gap-1">
        <button className="p-1.5 hover:bg-white/10 rounded flex items-center gap-2 text-xs" onClick={() => {setContent(''); setFilePath('')}}>
        <FilePlus size={14} /> New
        </button>
        <button className="p-1.5 hover:bg-white/10 rounded flex items-center gap-2 text-xs" onClick={handleOpen}>
        <FolderOpen size={14} /> Open
        </button>
        <button className="p-1.5 hover:bg-white/10 rounded flex items-center gap-2 text-xs" onClick={handleSave}>
        <Save size={14} /> Save
        </button>
        <span className="ml-auto text-xs text-slate-500 px-2">{filePath || "Untitled"}</span>
        </div>
        <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers Mock */}
        <div className="w-10 bg-slate-950 text-slate-600 text-xs text-right pr-2 pt-2 select-none border-r border-white/5 font-mono">
        {content.split('\n').map((_, i) => <div key={i}>{i+1}</div>)}
        </div>
        <textarea
        className="flex-1 bg-slate-900 text-slate-200 p-2 focus:outline-none resize-none font-mono text-sm leading-6"
        value={content}
        onChange={e => setContent(e.target.value)}
        spellCheck={false}
        />
        </div>
        </div>
    );
};

export default BlueEditApp;
