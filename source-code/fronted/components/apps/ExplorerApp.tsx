import React from 'react';
import { Folder, FileText, Music, Image, Video, HardDrive } from 'lucide-react';
import { AppProps } from '../../types';

const ExplorerApp: React.FC<AppProps> = () => {
    const sidebarItems = [
        { icon: HardDrive, label: 'Root', active: false },
        { icon: Folder, label: 'Desktop', active: false },
        { icon: FileText, label: 'Documents', active: true },
        { icon: Image, label: 'Pictures', active: false },
        { icon: Music, label: 'Music', active: false },
        { icon: Video, label: 'Videos', active: false },
    ];

    const files = [
        { name: 'Project_Alpha_Specs.pdf', type: 'PDF Document', size: '2.4 MB' },
        { name: 'Budget_2025.xlsx', type: 'Spreadsheet', size: '14 KB' },
        { name: 'Notes.txt', type: 'Text File', size: '2 KB' },
        { name: 'Vacation_Photo.jpg', type: 'Image', size: '4.1 MB' },
        { name: 'resume_final.pdf', type: 'PDF Document', size: '1.2 MB' },
        { name: 'main.tsx', type: 'TypeScript', size: '45 KB' },
    ];

    return (
        <div className="flex h-full bg-slate-900 text-slate-100">
        {/* Sidebar */}
        <div className="w-48 bg-slate-950/50 border-r border-white/5 p-2 flex flex-col gap-1">
        <div className="text-xs font-semibold text-slate-500 px-3 py-2 uppercase tracking-wider">Places</div>
        {sidebarItems.map((item, i) => (
            <button
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                item.active
                ? 'bg-blue-600/20 text-blue-300'
                : 'hover:bg-white/5 text-slate-400 hover:text-white'
            }`}
            >
            <item.icon size={16} />
            {item.label}
            </button>
        ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 gap-4 bg-slate-900/50">
        <div className="flex gap-2">
        <button className="text-slate-500 hover:text-white">&larr;</button>
        <button className="text-slate-500 hover:text-white">&rarr;</button>
        </div>
        <div className="flex-1 bg-slate-950/50 border border-white/10 rounded px-3 py-1 text-sm text-slate-400">
        /home/user/Documents
        </div>
        </div>

        {/* File Grid */}
        <div className="flex-1 p-4 overflow-auto">
        <table className="w-full text-left border-collapse">
        <thead>
        <tr className="text-xs text-slate-500 border-b border-white/5">
        <th className="font-medium py-2 pl-2">Name</th>
        <th className="font-medium py-2">Type</th>
        <th className="font-medium py-2">Size</th>
        </tr>
        </thead>
        <tbody>
        {files.map((file, i) => (
            <tr key={i} className="group hover:bg-blue-600/10 transition-colors text-sm cursor-default">
            <td className="py-2 pl-2 flex items-center gap-3 text-slate-200 group-hover:text-blue-200">
            <FileText size={16} className="text-blue-400" />
            {file.name}
            </td>
            <td className="py-2 text-slate-500">{file.type}</td>
            <td className="py-2 text-slate-500">{file.size}</td>
            </tr>
        ))}
        </tbody>
        </table>
        </div>
        </div>
        </div>
    );
};

export default ExplorerApp;
