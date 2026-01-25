import React from 'react';
import { AppProps } from '../../types';

const AboutApp: React.FC<AppProps> = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 text-white p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500 mb-4 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
        <span className="text-2xl font-bold">B</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Blue Environment</h1>
        <p className="text-blue-200 text-sm mb-6">Web Desktop Simulation</p>

        <div className="text-xs text-slate-400 space-y-1">
        <p>Version 1.0.0-alpha</p>
        <p>Kernel: React 18 / TypeScript</p>
        <p>&copy; 2025 Blue Systems</p>
        </div>
        </div>
    );
};

export default AboutApp;
