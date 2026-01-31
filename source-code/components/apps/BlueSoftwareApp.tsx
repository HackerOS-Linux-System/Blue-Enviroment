import React, { useState, useEffect, useCallback, memo } from 'react';
import { Search, ShoppingBag, Download, Check, Trash2, Box, Star, Grid, List, RefreshCw, Loader2, Package, Tag, Layers, Gamepad2, Code, Terminal, Monitor, Video, Music, ArrowRight } from 'lucide-react';
import { AppProps, SoftwarePackage } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

const CATEGORIES = [
    { id: 'all', label: 'All Apps', icon: Grid },
{ id: 'Development', label: 'Development', icon: Code },
{ id: 'Productivity', label: 'Productivity', icon: Layers },
{ id: 'Multimedia', label: 'Multimedia', icon: Video },
{ id: 'System', label: 'System', icon: Monitor },
{ id: 'Games', label: 'Games', icon: Gamepad2 },
];

const PackageCard = memo(({ pkg, onClick, processing }: { pkg: SoftwarePackage, onClick: (p: SoftwarePackage) => void, processing: boolean }) => {
    return (
        <div
        onClick={() => onClick(pkg)}
        className="bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-blue-500/30 rounded-2xl p-4 cursor-pointer transition-all group flex flex-col gap-3 h-full animate-in fade-in duration-500 shadow-sm hover:shadow-xl"
        >
        <div className="flex items-start justify-between">
        <div className="w-14 h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-inner">
        {pkg.icon ? <pkg.icon size={28} /> : <Box size={28} />}
        </div>
        {pkg.installed && <div className="bg-green-500/20 text-green-400 p-1 rounded-full"><Check size={14} /></div>}
        </div>
        <div className="flex-1">
        <h3 className="font-bold text-base line-clamp-1 group-hover:text-blue-300 transition-colors">{pkg.name}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">{pkg.description}</p>
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <div className="flex items-center gap-2">
        <Star size={12} className="text-yellow-500 fill-yellow-500" />
        <span className="text-xs text-slate-300 font-medium">4.5</span>
        </div>
        {processing ? (
            <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px] font-bold">Working...</span>
            </div>
        ) : (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${pkg.installed ? 'text-green-400' : 'text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md group-hover:bg-blue-500 group-hover:text-white transition-colors'}`}>
            {pkg.installed ? 'Installed' : 'Get'}
            </span>
        )}
        </div>
        </div>
    );
});

const BlueSoftwareApp: React.FC<AppProps> = () => {
    const [packages, setPackages] = useState<SoftwarePackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<Record<string, string>>({});
    const [selectedPkg, setSelectedPkg] = useState<SoftwarePackage | null>(null);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            if (!isMounted) return;
            setLoading(true);
            try {
                const catalog = await SystemBridge.getPackagesCatalog();
                if (!isMounted) return;
                setPackages(catalog);
                setLoading(false);

                const chunkSize = 2;
                for (let i = 0; i < catalog.length; i += chunkSize) {
                    if (!isMounted) break;
                    const chunk = catalog.slice(i, i + chunkSize);
                    const results = await Promise.all(chunk.map(async (pkg) => {
                        try {
                            const installed = await SystemBridge.checkPackageStatus(pkg);
                            return { id: pkg.id, installed };
                        } catch (e) { return { id: pkg.id, installed: false }; }
                    }));
                    if (!isMounted) break;
                    setPackages(prev => prev.map(p => {
                        const res = results.find(r => r.id === p.id);
                        return res ? { ...p, installed: res.installed } : p;
                    }));
                    await new Promise(r => setTimeout(r, 50));
                }
            } catch (e) {
                if (isMounted) setLoading(false);
            }
        };
        const timer = setTimeout(init, 300);
        return () => { isMounted = false; clearTimeout(timer); };
    }, []);

    const handleInstall = useCallback(async (pkg: SoftwarePackage) => {
        setProcessing(prev => ({ ...prev, [pkg.id]: 'Installing...' }));
        const success = await SystemBridge.installPackage(pkg);
        if (success) {
            setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, installed: true } : p));
            if (selectedPkg?.id === pkg.id) setSelectedPkg(prev => prev ? ({ ...prev, installed: true }) : null);
        }
        setProcessing(prev => { const n = {...prev}; delete n[pkg.id]; return n; });
    }, [selectedPkg]);

    const handleUninstall = useCallback(async (pkg: SoftwarePackage) => {
        if (!confirm(`Are you sure you want to uninstall ${pkg.name}?`)) return;
        setProcessing(prev => ({ ...prev, [pkg.id]: 'Removing...' }));
        const success = await SystemBridge.uninstallPackage(pkg);
        if (success) {
            setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, installed: false } : p));
            if (selectedPkg?.id === pkg.id) setSelectedPkg(prev => prev ? ({ ...prev, installed: false }) : null);
        }
        setProcessing(prev => { const n = {...prev}; delete n[pkg.id]; return n; });
    }, [selectedPkg]);

    const filteredPackages = packages.filter(p => {
        const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const NavBtn = ({ id, icon: Icon, label }: any) => (
        <button
        onClick={() => { setActiveCategory(id); setSelectedPkg(null); }}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all ${activeCategory === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
        >
        <div className="flex items-center gap-3">
        <Icon size={18} />
        <span className="font-medium text-sm">{label}</span>
        </div>
        </button>
    );

    return (
        <div className="flex h-full bg-slate-950 text-slate-100 font-sans">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-white/5 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-3 px-2 mb-6 mt-2">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
        <ShoppingBag size={24} className="text-white" />
        </div>
        <div>
        <h1 className="font-bold text-lg leading-none">Blue<br/><span className="text-blue-400">Store</span></h1>
        </div>
        </div>

        <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
        className="w-full bg-slate-800 border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors placeholder-slate-600"
        placeholder="Search apps..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        />
        </div>

        <div className="space-y-1">
        <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2">Discover</div>
        {CATEGORIES.map(cat => <NavBtn key={cat.id} {...cat} />)}
        </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-br from-slate-950 to-slate-900">
        {selectedPkg ? (
            // Detail View
            <div className="flex-1 p-8 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setSelectedPkg(null)} className="mb-6 text-sm text-slate-400 hover:text-white flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors w-fit">
            <ArrowRight className="rotate-180" size={16} /> Back to Store
            </button>

            <div className="flex gap-8 mb-8">
            <div className="w-32 h-32 bg-slate-800 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl shrink-0">
            {selectedPkg.icon ? <selectedPkg.icon size={64} className="text-blue-400" /> : <Box size={64} className="text-blue-400" />}
            </div>
            <div className="flex-1 pt-2">
            <h1 className="text-4xl font-bold mb-2">{selectedPkg.name}</h1>
            <p className="text-lg text-slate-400 mb-6 max-w-2xl">{selectedPkg.description}</p>

            <div className="flex gap-4">
            {processing[selectedPkg.id] ? (
                <button disabled className="bg-slate-700 text-slate-300 px-8 py-3 rounded-full font-bold flex items-center gap-2 cursor-wait">
                <Loader2 size={18} className="animate-spin" /> {processing[selectedPkg.id]}
                </button>
            ) : selectedPkg.installed ? (
                <>
                <button disabled className="bg-green-500/10 text-green-400 border border-green-500/20 px-8 py-3 rounded-full font-bold flex items-center gap-2 cursor-default">
                <Check size={18} /> Installed
                </button>
                <button onClick={() => handleUninstall(selectedPkg)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
                <Trash2 size={18} /> Uninstall
                </button>
                </>
            ) : (
                <button onClick={() => handleInstall(selectedPkg)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-full font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2">
                <Download size={18} /> Install App
                </button>
            )}
            </div>
            </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Rating</div>
            <div className="flex items-center gap-2 text-2xl font-bold">
            4.8 <Star className="text-yellow-500 fill-yellow-500" size={20} />
            </div>
            <div className="text-xs text-slate-500 mt-1">Based on 1.2k reviews</div>
            </div>
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Size</div>
            <div className="text-2xl font-bold">{selectedPkg.size}</div>
            <div className="text-xs text-slate-500 mt-1">Compressed download</div>
            </div>
            <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5">
            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Version</div>
            <div className="text-2xl font-bold">{selectedPkg.version}</div>
            <div className="text-xs text-slate-500 mt-1">Latest stable release</div>
            </div>
            </div>
            </div>
        ) : (
            // Grid View
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {loading && packages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <p>Syncing package repositories...</p>
                </div>
            ) : (
                <>
                {activeCategory === 'all' && !search && (
                    <div className="mb-8 relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 group h-64">
                    <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2070" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 p-8">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">Featured</span>
                    <h2 className="text-4xl font-bold text-white mb-2">Unlock Your Potential</h2>
                    <p className="text-slate-200 max-w-lg">Discover powerful tools for development, design, and productivity selected by our editors.</p>
                    </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">{CATEGORIES.find(c => c.id === activeCategory)?.label}</h2>
                <span className="text-xs text-slate-500">{filteredPackages.length} apps found</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                {filteredPackages.map(pkg => (
                    <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onClick={setSelectedPkg}
                    processing={!!processing[pkg.id]}
                    />
                ))}
                </div>
                </>
            )}
            </div>
        )}
        </div>
        </div>
    );
};

export default BlueSoftwareApp;
