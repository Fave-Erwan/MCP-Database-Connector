import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ConnectionPage from './components/ConnectionPage'

export default function App() {
    // États de l'application
    const [page, setPage] = useState('dashboard')
    const [perms, setPerms] = useState<any[]>([])
    const [logs, setLogs] = useState<string[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [dbConfig, setDbConfig] = useState<any>(null)
    const [isRefreshing, setIsRefreshing] = useState(false);


    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // On relance la fonction de connexion avec la config actuelle
            const result = await (window as any).api.connectDB({ type: dbConfig.type, ...dbConfig });
            if (result.success) {
                // Mise à jour des tables au cas où elles auraient changé en base
                const tablePerms = result.tables.map((name: string) => ({
                    table_name: name,
                    can_read: true,
                    can_write: false
                }));
                setPerms(tablePerms);
            }
        } finally {
            // On attend 1s pour que l'utilisateur voit le chargement (plus propre)
            setTimeout(() => setIsRefreshing(false), 800);
        }
    };

    const handleLogout = () => {
        setIsConnected(false);
        // Optionnel : ne pas vider dbConfig pour que le form soit pré-rempli
    };


    // --- 1. ÉCRAN DE CONNEXION ---
    if (!isConnected) {
        return (
            <div className="h-screen bg-gray-900 flex items-center justify-center p-4">
                <ConnectionPage onConnect={(data) => {
                    setDbConfig(data);

                    // Si Electron nous a renvoyé des tables lors de la connexion
                    if (data.tables && data.tables.length > 0) {
                        const tablePerms = data.tables.map((name: string) => ({
                            table_name: name,
                            can_read: true,
                            can_write: false
                        }));
                        setPerms(tablePerms);
                    } else {
                        setPerms([]); // Aucune table trouvée
                    }

                    setIsConnected(true);
                }} />
            </div>
        )
    }

    // --- 2. INTERFACE PRINCIPALE (Une fois connecté) ---
    return (
        <div className="h-screen w-screen flex bg-gray-900 text-gray-100 overflow-hidden">
            {/* Sidebar avec gestion de la page active */}
            <Sidebar setPage={setPage} currentPage={page} />

            <div className="flex-1 p-8 overflow-y-auto">

                {/* PAGE : DASHBOARD */}
                {page === 'dashboard' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h1 className="text-3xl font-bold">Dashboard</h1>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleRefresh}
                                    className={`bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={isRefreshing}
                                >
                                    {isRefreshing ? '⌛ Sync...' : '🔄 Actualiser'}
                                </button>

                                <button
                                    onClick={handleLogout}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 transition"
                                >
                                    🚪 Déconnexion
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-gray-800 p-6 rounded-xl border border-green-500/30 shadow-lg shadow-green-900/5">
                                <p className="text-sm text-gray-400 uppercase tracking-wider">Statut</p>
                                <p className="text-2xl font-bold text-green-400">Opérationnel</p>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
                                <p className="text-sm text-gray-400 uppercase tracking-wider">Structure</p>
                                <p className="text-2xl font-bold">{perms.length} Tables Détectées</p>
                            </div>
                        </div>

                        <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800/50">
                            <h2 className="text-xl font-semibold mb-2 text-blue-300">MCP-Database-Connector v1.0</h2>
                            <p className="text-gray-300 leading-relaxed">
                                Connecté à : <span className="font-mono text-white">{dbConfig?.database || dbConfig?.filepath}</span>.
                                L'agent IA peut maintenant accéder aux tables configurées.
                            </p>
                        </div>

                        {isRefreshing && (
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                                <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-700 flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
                                    <p className="text-blue-400 font-medium italic">Synchronisation avec la base de données...</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PAGE : PERMISSIONS */}
                {page === 'permissions' && (
                    <div className="animate-in fade-in duration-500">
                        <h1 className="text-2xl font-bold mb-6">Gestion des Accès IA</h1>
                        {perms.length === 0 ? (
                            <div className="text-center p-12 border-2 border-dashed border-gray-700 rounded-2xl">
                                <p className="italic text-gray-500">Aucune table trouvée dans cette base de données.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {perms.map(p => (
                                    <div key={p.table_name} className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-colors">
                                        <h3 className="font-bold text-blue-300 mb-2">{p.table_name}</h3>
                                        <div className="flex gap-4 text-sm font-medium">
                                            <span className={p.can_read ? "text-green-400" : "text-red-400"}>
                                                Lecture: {p.can_read ? 'OUI' : 'NON'}
                                            </span>
                                            <span className={p.can_write ? "text-green-400" : "text-red-400"}>
                                                Écriture: {p.can_write ? 'OUI' : 'NON'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PAGE : LOGS */}
                {page === 'logs' && (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-2xl font-bold mb-4">Journal d'Audit Temps Réel</h1>
                        <div className="bg-black/80 p-6 rounded-2xl font-mono text-sm h-125 overflow-auto border border-gray-700 text-green-400 shadow-2xl">
                            {logs.length > 0 ? (
                                logs.map((l, i) => <div key={i} className="mb-1"><span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span> {'>'} {l}</div>)
                            ) : (
                                <div className="text-gray-600 italic">En attente d'activité de l'IA...</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}