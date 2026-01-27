import React, { useState, useEffect, useCallback, memo } from 'react';
import { Search, ShoppingBag, Download, Check, Trash2, Box, Star, Grid, List, RefreshCw, Loader2, Package } from 'lucide-react';
import { AppProps, SoftwarePackage } from '../../types';
import { SystemBridge } from '../../utils/systemBridge';

// --- Optimised Card Component (Memoized) ---
// This prevents the entire grid from re-rendering when we update the status of just one package.
const PackageCard = memo(({ pkg, onClick, processing }: { pkg: SoftwarePackage, onClick: (p: SoftwarePackage) => void, processing: boolean }) => {
    return (
        <div
        onClick={() => onClick(pkg)}
        className="bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-blue-500/30 rounded-2xl p-4 cursor-pointer transition-all group flex flex-col gap-3 h-full animate-in fade-in duration-500"
        >
        <div className="flex items-start justify-between">
        <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {pkg.icon ? <pkg.icon size={24} /> : <Box size={24} />}
        </div>
        {pkg.installed && <Check size={16} className="text-green-400" />}
        </div>
        <div className="flex-1">
        <h3 className="font-bold text-base line-clamp-1">{pkg.name}</h3>
        <p className="text-xs text-slate-400 line-clamp-2 mt-1">{pkg.description}</p>
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <span className="text-[10px] bg-slate-900 px-2 py-1 rounded text-slate-500 uppercase font-mono">{pkg.source}</span>
        {processing ? (
            <div className="flex items-center gap-1.5 text-blue-400">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-[10px] font-bold">Working...</span>
            </div>
        ) : (
            <span className={`text-xs font-bold group-hover:underline ${pkg.installed ? 'text-green-400' : 'text-blue-400'}`}>
            {pkg.installed ? 'Installed' : 'Install'}
            </span>
        )}
        </div>
        </div>
    );
});

const BlueSoftwareApp: React.FC<AppProps> = () => {
    const [packages, setPackages] = useState<SoftwarePackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'explore' | 'installed' | 'updates'>('explore');
    const [search, setSearch] = useState('');
    const [processing, setProcessing] = useState<Record<string, string>>({});
    const [selectedPkg, setSelectedPkg] = useState<SoftwarePackage | null>(null);

    // Initial Load Logic - Optimized to prevent freezing
    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            if (!isMounted) return;
            setLoading(true);

            try {
                // 1. Get Static Catalog first (Fast)
                const catalog = await SystemBridge.getPackagesCatalog();
                if (!isMounted) return;
                setPackages(catalog);
                setLoading(false); // Show the UI immediately with default states

                // 2. Check statuses in small chunks (Batches) to avoid IPC flooding/Freezing
                const chunkSize = 2; // Check 2 packages at a time

                for (let i = 0; i < catalog.length; i += chunkSize) {
                    if (!isMounted) break;

                    const chunk = catalog.slice(i, i + chunkSize);

                    // Run checks for this chunk in parallel
                    const results = await Promise.all(chunk.map(async (pkg) => {
                        try {
                            const installed = await SystemBridge.checkPackageStatus(pkg);
                            return { id: pkg.id, installed };
                        } catch (e) {
                            console.warn(`Failed to check ${pkg.id}`, e);
                            return { id: pkg.id, installed: false };
                        }
                    }));

                    if (!isMounted) break;

                    // Update state partially
                    setPackages(prev => prev.map(p => {
                        const res = results.find(r => r.id === p.id);
                        return res ? { ...p, installed: res.installed } : p;
                    }));

                    // CRITICAL: Give the UI thread a moment to breathe between chunks
                    await new Promise(r => setTimeout(r, 50));
                }

            } catch (e) {
                console.error("Software store init error:", e);
                if (isMounted) setLoading(false);
            }
        };

        // Delay execution slightly to allow the window open animation to finish smoothly
        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, []);

    const handleInstall = useCallback(async (pkg: SoftwarePackage) => {
        setProcessing(prev => ({ ...prev, [pkg.id]: 'Installing...' }));

        // Optimistic UI update not recommended for installs, wait for result
        const success = await SystemBridge.installPackage(pkg);

        if (success) {
            setPackages(prev => prev.map(p => p.id === pkg.id ? { ...p, installed: true } : p));
            if (selectedPkg?.id === pkg.id) setSelectedPkg(prev => prev ? ({ ...prev, installed: true }) : null);
        } else {
            // Optional: Show error toast here
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
        if (view === 'installed' && !p.installed) return false;
        if (view === 'updates') return false;
        return p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    });

    const NavBtn = ({ id, icon: Icon, label, count }: any) => (
        <button
        onClick={() => { setView(id); setSelectedPkg(null); }}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${view === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:bg-white/5 text-slate-300'}`}
        >
        <div className="flex items-center gap-3">
        <Icon size={18} />
        <span className="font-medium text-sm">{label}</span>
        </div>
        {count !== undefined && <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">{count}</span>}
        </button>
    );

    return (
        <div className="flex h-full bg-slate-950 text-slate-100">
        {/* Sidebar */}
        <div className="w-64 bg-slate-900 border-r border-white/5 flex flex-col p-4 gap-2">
        <div className="flex items-center gap-3 px-2 mb-6 mt-2">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
        <ShoppingBag size={24} className="text-white" />
        </div>
        <div>
        <h1 className="font-bold text-lg leading-tight">Blue<br/><span className="text-blue-400">Software</span></h1>
        </div>
        </div>

        <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
        className="w-full bg-slate-800 border border-white/5 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        placeholder="Search..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        />
        </div>

        <NavBtn id="explore" icon={Grid} label="Explore" />
        <NavBtn id="installed" icon={Package} label="Installed" count={packages.filter(p => p.installed).length} />
        <NavBtn id="updates" icon={RefreshCw} label="Updates" count={0} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
        {selectedPkg ? (
            // Detail View
            <div className="flex-1 p-8 overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-300">
            <button onClick={() => setSelectedPkg(null)} className="mb-6 text-sm text-slate-400 hover:text-white flex items-center gap-1">← Back</button>

            <div className="flex gap-8 mb-8">
            <div className="w-32 h-32 bg-slate-800 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl shrink-0">
            <Box size={64} className="text-blue-400" />
            </div>
            <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{selectedPkg.name}</h1>
            <p className="text-xl text-slate-400 mb-4">{selectedPkg.description}</p>
            <div className="flex gap-4 items-center text-sm text-slate-500 mb-6">
            <span className="bg-slate-800 px-3 py-1 rounded-full uppercase font-mono text-xs">{selectedPkg.source}</span>
            <span>Ver {selectedPkg.version}</span>
            <span>{selectedPkg.size}</span>
            </div>

            {processing[selectedPkg.id] ? (
                <button disabled className="bg-slate-700 text-slate-300 px-8 py-3 rounded-full font-bold flex items-center gap-2 cursor-wait">
                <Loader2 size={18} className="animate-spin" /> {processing[selectedPkg.id]}
                </button>
            ) : selectedPkg.installed ? (
                <div className="flex gap-4">
                <button disabled className="bg-green-500/10 text-green-400 border border-green-500/20 px-8 py-3 rounded-full font-bold flex items-center gap-2 cursor-default">
                <Check size={18} /> Installed
                </button>
                <button onClick={() => handleUninstall(selectedPkg)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
                <Trash2 size={18} /> Uninstall
                </button>
                </div>
            ) : (
                <button onClick={() => handleInstall(selectedPkg)} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-3 rounded-full font-bold shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2">
                <Download size={18} /> Install ({selectedPkg.source})
                </button>
            )}
            </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
            <div className="bg-slate-900 rounded-2xl p-6 border border-white/5">
            <h3 className="font-bold mb-4">Ratings</h3>
            <div className="flex items-center gap-4 mb-4">
            <span className="text-5xl font-bold">4.8</span>
            <div className="flex flex-col">
            <div className="flex text-yellow-400"><Star fill="currentColor" size={16}/><Star fill="currentColor" size={16}/><Star fill="currentColor" size={16}/><Star fill="currentColor" size={16}/><Star size={16}/></div>
            <span className="text-xs text-slate-500">2,401 ratings</span>
            </div>
            </div>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6 border border-white/5">
            <h3 className="font-bold mb-4">Technical Details</h3>
            <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-slate-500">Package ID</span>
            <span className="font-mono">{selectedPkg.packageId}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-slate-500">Source</span>
            <span className="capitalize">{selectedPkg.source}</span>
            </div>
            <div className="flex justify-between pt-2">
            <span className="text-slate-500">Developer</span>
            <span>{selectedPkg.author}</span>
            </div>
            </div>
            </div>
            </div>
            </div>
        ) : (
            // Grid View
            <div className="flex-1 p-6 overflow-y-auto">
            {loading && packages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 size={32} className="animate-spin text-blue-500" />
                <p>Syncing package repositories...</p>
                </div>
            ) : (
                <>
                {view === 'explore' && !search && (
                    <div className="mb-8">
                    <div className="w-full h-64 rounded-3xl bg-gradient-to-r from-blue-900 to-slate-900 border border-white/10 relative overflow-hidden flex items-center p-10 shadow-2xl">
                    <div className="z-10 max-w-lg">
                    <span className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-2 block">Featured</span>
                    <h2 className="text-4xl font-bold text-white mb-4">Discover Amazing Apps</h2>
                    <p className="text-slate-300 mb-6">Explore the power of open source with thousands of applications ready for HackerOS.</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-blue-500/20 to-transparent"></div>
                    <ShoppingBag size={200} className="absolute -right-10 -bottom-10 text-white/5 rotate-12" />
                    </div>
                    </div>
                )}

                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                {view === 'installed' ? 'Installed Applications' : search ? `Search results for "${search}"` : 'Recommended'}
                </h2>

                {filteredPackages.length === 0 && (
                    <div className="text-slate-500 text-center py-20">No packages found.</div>
                )}

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
