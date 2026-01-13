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
    const [refreshError, setRefreshError] = useState<string | null>(null); // Nouvel état
    const [isDbAlive, setIsDbAlive] = useState(true);
    const [confirmAction, setConfirmAction] = useState<{ tableName: string, type: 'read' | 'delete' } | null>(null);


    const handleRefresh = async () => {
        setIsRefreshing(true);
        setRefreshError(null); // On réinitialise l'erreur au début

        try {
            const result = await (window as any).api.connectDB(dbConfig);

            if (result.success) {
                const tablePerms = result.tables.map((name: string) => ({
                    table_name: name,
                    can_read: false,    // Par défaut, l'IA doit lire pour comprendre
                    can_write: false,  // Écriture bloquée par défaut
                    can_delete: false  // Suppression bloquée par défaut (SÉCURITÉ)
                }));
                setPerms(tablePerms);
                // Si ça réussit, on ferme tout de suite
                setIsDbAlive(true);
                setIsRefreshing(false);
            } else {
                // On ne ferme PAS le loader, on affiche l'erreur dedans
                setIsDbAlive(false);
                setRefreshError(result.error);
            }
        } catch (err) {
            setRefreshError("Erreur de communication avec le système.");
        }
        // Note : On retire le setIsRefreshing(false) du finally pour garder l'erreur affichée
    };

    const handleLogout = () => {
        setIsConnected(false);
        // Optionnel : ne pas vider dbConfig pour que le form soit pré-rempli
    };

    const togglePermission = (tableName: string, type: 'read' | 'write' | 'delete') => {
        // Si on veut activer une permission sensible (passer de false à true)
        const currentPerm = perms.find(p => p.table_name === tableName)?.[`can_${type === 'read' ? 'read' : (type === 'delete' ? 'delete' : 'write')}`];

        if (!currentPerm && (type === 'read' || type === 'delete')) {
            setConfirmAction({ tableName, type });
            return; // On s'arrête là, la modale prend le relais
        }

        // Sinon (écriture ou désactivation), on applique direct
        applyToggle(tableName, type);
    };

    // Fonction séparée pour appliquer réellement le changement
    const applyToggle = (tableName: string, type: string) => {
        setPerms(prev => prev.map(p => p.table_name === tableName
            ? { ...p, [`can_${type}`]: !p[`can_${type}`] }
            : p
        ));
        setConfirmAction(null);
    };

    const applyGlobalPermission = (type: 'read' | 'write' | 'delete', value: boolean) => {
        // Si on essaie d'ACTIVER (true) la lecture ou la suppression globalement
        if (value === true && (type === 'read' || type === 'delete')) {
            setConfirmAction({
                tableName: "TOUTES LES TABLES",
                type: type
            });
            return;
        }

        // Pour l'écriture ou pour désactiver, on applique directement
        executeGlobalToggle(type, value);
    };

    // La fonction qui fait réellement le travail sur l'état
    const executeGlobalToggle = (type: string, value: boolean) => {
        setPerms(prev => prev.map(p => ({
            ...p,
            [`can_${type}`]: value
        })));
        setConfirmAction(null);
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
                            can_read: false,    // Par défaut, l'IA doit lire pour comprendre
                            can_write: false,  // Écriture bloquée par défaut
                            can_delete: false
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
                            <div className={`bg-gray-800 p-6 rounded-xl border shadow-lg ${isDbAlive ? 'border-green-500/30 shadow-green-900/5' : 'border-red-500/30 shadow-red-900/5'}`}>
                                <p className="text-sm text-gray-400 uppercase tracking-wider">Statut de la Connexion</p>
                                <p className={`text-2xl font-bold ${isDbAlive ? 'text-green-400' : 'text-red-400'}`}>
                                    {isDbAlive ? '● Opérationnel' : '○ Hors-ligne'}
                                </p>
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

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-gray-800/40 p-4 rounded-2xl border border-gray-700/50 shadow-inner">
                            {/* LECTURE - BLEU */}
                            <div className="flex items-start gap-3">
                                <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"></div>
                                <div>
                                    <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Lecture (SELECT)</p>
                                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">Accès total au contenu. L'IA peut analyser et citer les données.</p>
                                </div>
                            </div>

                            {/* ÉCRITURE - ORANGE */}
                            <div className="flex items-start gap-3 border-l border-gray-700/50 pl-4">
                                <div className="mt-1 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]"></div>
                                <div>
                                    <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Écriture (INSERT/UPDATE)</p>
                                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">Modification autorisée. L'IA peut ajouter ou éditer des entrées.</p>
                                </div>
                            </div>

                            {/* SUPPRESSION - ROUGE */}
                            <div className="flex items-start gap-3 border-l border-gray-700/50 pl-4">
                                <div className="mt-1 w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse"></div>
                                <div>
                                    <p className="text-xs font-black text-red-500 uppercase tracking-widest">Suppression (DELETE)</p>
                                    <p className="text-[11px] text-gray-400 mt-1 leading-tight">Risque élevé. L'IA peut effacer définitivement des données.</p>
                                </div>
                            </div>
                        </div>


                        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-800/60 rounded-xl border border-blue-500/20">
                            <span className="text-sm font-bold text-blue-400 uppercase tracking-widest mr-2">Actions Globales :</span>

                            {/* Groupe Lecture */}
                            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                <button onClick={() => applyGlobalPermission('read', true)} className="px-3 py-1 text-[10px] font-bold text-blue-400 hover:bg-blue-500/10 rounded-md transition-all">LIRE TOUT</button>
                                <div className="w-px bg-gray-700 mx-1"></div>
                                <button onClick={() => applyGlobalPermission('read', false)} className="px-3 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-700 rounded-md transition-all">BLOQUER TOUT</button>
                            </div>

                            {/* Groupe Écriture */}
                            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                <button onClick={() => applyGlobalPermission('write', true)} className="px-3 py-1 text-[10px] font-bold text-orange-400 hover:bg-orange-500/10 rounded-md transition-all">ÉCRIRE TOUT</button>
                                <div className="w-px bg-gray-700 mx-1"></div>
                                <button onClick={() => applyGlobalPermission('write', false)} className="px-3 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-700 rounded-md transition-all">BLOQUER TOUT</button>
                            </div>

                            {/* Groupe Suppression */}
                            <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                                <button onClick={() => applyGlobalPermission('delete', true)} className="px-3 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded-md transition-all">⚠️ SUPPRIMER TOUT</button>
                                <div className="w-px bg-gray-700 mx-1"></div>
                                <button onClick={() => applyGlobalPermission('delete', false)} className="px-3 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-700 rounded-md transition-all">SÉCURISER TOUT</button>
                            </div>
                        </div>

                        {perms.length === 0 ? (
                            <div className="text-center p-12 border-2 border-dashed border-gray-700 rounded-2xl">
                                <p className="italic text-gray-500">Aucune table trouvée dans cette base de données.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {perms.map(p => (
                                    <div key={p.table_name} className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-blue-500/50 transition-all shadow-lg">
                                        <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                                            <span className="text-blue-500">📊</span> {p.table_name}
                                        </h3>

                                        <div className="flex flex-col gap-3">
                                            {/* Bouton LECTURE */}
                                            <button
                                                onClick={() => togglePermission(p.table_name, 'read')}
                                                className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${p.can_read ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}
                                            >
                                                <span className="text-xs uppercase font-bold tracking-widest">Lecture</span>
                                                <span className="text-sm font-black">{p.can_read ? 'AUTORISÉ' : 'BLOQUÉ'}</span>
                                            </button>

                                            {/* Bouton ÉCRITURE */}
                                            <button
                                                onClick={() => togglePermission(p.table_name, 'write')}
                                                className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${p.can_write ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}
                                            >
                                                <span className="text-xs uppercase font-bold tracking-widest">Écriture</span>
                                                <span className="text-sm font-black">{p.can_write ? 'AUTORISÉ' : 'BLOQUÉ'}</span>
                                            </button>

                                            {/* Bouton SUPPRESSION (Ajouté) */}
                                            <button
                                                onClick={() => togglePermission(p.table_name, 'delete')}
                                                className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${p.can_delete ? 'bg-green-600/20 border-green-500 text-green-400 font-bold' : 'bg-gray-700/50 border-gray-600 text-gray-500'}`}
                                            >
                                                <span className="text-[10px] uppercase tracking-tighter">Suppression (DELETE)</span>
                                                <span className="text-sm">{p.can_delete ? '⚠️ ACTIF' : 'OFF'}</span>
                                            </button>
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

                {/* CONFIRMATION DE DROIT DONNER A L'IA */}
                {confirmAction && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10000 p-4">
                        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-in zoom-in duration-200 text-center">
                            {/* Icône */}
                            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmAction.type === 'delete' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                <span className="text-2xl font-bold">{confirmAction.type === 'delete' ? '⚠️' : 'ℹ️'}</span>
                            </div>

                            {/* Titre Dynamique */}
                            <h3 className="text-xl font-bold text-white mb-2">
                                {confirmAction.tableName === "TOUTES LES TABLES"
                                    ? "Action Globale"
                                    : confirmAction.type === 'delete' ? "Droit de suppression" : "Droit de lecture"
                                }
                            </h3>

                            {/* Description Corrigée */}
                            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                                {confirmAction.tableName === "TOUTES LES TABLES"
                                    ? (confirmAction.type === 'delete'
                                        ? "Vous allez autoriser l'IA de pouvoir supprimer des données sur l'ensemble de la bdd."
                                        : "Vous allez autoriser l'IA de pouvoir lire les données sur l'ensemble de la bdd.")
                                    : `Attention : L'IA aura un accès complet en ${confirmAction.type === 'delete' ? 'SUPPRESSION' : 'LECTURE'} sur la table "${confirmAction.tableName}".`
                                }
                            </p>

                            {/* Boutons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl font-medium transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirmAction.tableName === "TOUTES LES TABLES") {
                                            executeGlobalToggle(confirmAction.type, true);
                                        } else {
                                            applyToggle(confirmAction.tableName, confirmAction.type);
                                        }
                                    }}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}
                                >
                                    {confirmAction.tableName === "TOUTES LES TABLES" ? "Autoriser pour tout" : "Autoriser"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Acutalisation : */}
                {isRefreshing && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-9999 p-4">
                        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 flex flex-col items-center max-w-sm w-full animate-in fade-in zoom-in duration-200">

                            {/* CONDITION : Si on n'a PAS encore d'erreur, on affiche le Spinner */}
                            {!refreshError ? (
                                <div className="flex flex-col items-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/20 border-t-blue-500 mb-4"></div>
                                    <p className="text-blue-400 font-medium text-center italic">
                                        Communication avec la base de données...
                                    </p>
                                </div>
                            ) : (
                                /* CONDITION : Si on A une erreur, le Spinner disparaît et ceci s'affiche */
                                <div className="flex flex-col items-center">
                                    <div className="bg-red-500/20 text-red-500 w-14 h-14 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
                                        <span className="text-2xl font-bold">!</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2 text-center">Échec de synchronisation</h3>
                                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 mb-6">
                                        <p className="text-red-400 text-center text-xs font-mono leading-relaxed">
                                            {refreshError}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsRefreshing(false);
                                            setRefreshError(null);
                                        }}
                                        className="bg-red-600 hover:bg-red-500 text-white px-8 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20 w-full"
                                    >
                                        Réessayer
                                    </button>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}