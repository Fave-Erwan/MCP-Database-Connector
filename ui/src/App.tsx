import React, { useEffect, useState } from 'react'

// --- Composants annexes ---
function Sidebar({ setPage }: { setPage: (p: string) => void }) {
    return (
        <div className="w-64 bg-gray-800 p-4 h-full border-r border-gray-700">
            <h2 className="text-xl font-bold mb-6 text-blue-400">MCP - UI</h2>
            <ul className="space-y-2">
                <li><button className="w-full text-left p-2 hover:bg-gray-700 rounded transition" onClick={() => setPage('dashboard')}>🏠 Dashboard</button></li>
                <li><button className="w-full text-left p-2 hover:bg-gray-700 rounded transition" onClick={() => setPage('permissions')}>🛡️ Permissions</button></li>
                <li><button className="w-full text-left p-2 hover:bg-gray-700 rounded transition" onClick={() => setPage('logs')}>📜 Audit Logs</button></li>
            </ul>
        </div>
    )
}

// --- Composant Principal ---
export default function App() {
    const [page, setPage] = useState('dashboard')
    const [perms, setPerms] = useState<any[]>([])
    const [logs, setLogs] = useState<string[]>([])

    // Gestion du chargement initial
    useEffect(() => {
        const fetchData = async () => {
            try {
                // On vérifie si l'API Electron est disponible
                if (window && (window as any).api) {
                    const list = await (window as any).api.adminListPermissions()
                    setPerms(list || [])
                } else {
                    console.warn("L'API Electron n'est pas détectée (mode navigateur ?)");
                }
            } catch (e) {
                console.error("Erreur de communication avec le moteur MCP:", e)
                setPerms([])
            }
        }
        fetchData()
    }, [])

    return (
        <div className="h-screen w-screen flex bg-gray-900 text-gray-100 overflow-hidden">
            <Sidebar setPage={setPage} />

            <div className="flex-1 p-8 overflow-y-auto">
                {/* PAGE : DASHBOARD */}
                {page === 'dashboard' && (
                    <div className="space-y-6">
                        <h1 className="text-3xl font-bold">Dashboard</h1>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition"
                        >
                            🔄 Actualiser
                        </button>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-gray-800 p-6 rounded-xl border border-green-500/30">
                                <p className="text-sm text-gray-400 uppercase">Statut</p>
                                <p className="text-2xl font-bold text-green-400">Opérationnel</p>
                            </div>
                            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                                <p className="text-sm text-gray-400 uppercase">Base SQLite</p>
                                <p className="text-2xl font-bold">{perms.length} Tables</p>
                            </div>
                        </div>
                        <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-800">
                            <h2 className="text-xl font-semibold mb-2">MCP-Database-Connector v1.0</h2>
                            <p className="text-gray-300">Bienvenue dans votre interface de gestion. Tout est prêt pour connecter votre IA à SQLite.</p>
                        </div>
                    </div>
                )}

                {/* PAGE : PERMISSIONS */}
                {page === 'permissions' && (
                    <div>
                        <h1 className="text-2xl font-bold mb-6">Gestion des Accès</h1>
                        {perms.length === 0 ? (
                            <p className="italic text-gray-500">Chargement des tables ou base vide...</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {perms.map(p => (
                                    <div key={p.table_name} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                                        <h3 className="font-bold text-blue-300">{p.table_name}</h3>
                                        <p className="text-sm text-gray-400">Lecture: {p.can_read ? '✅' : '❌'} | Écriture: {p.can_write ? '✅' : '❌'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PAGE : LOGS */}
                {page === 'logs' && (
                    <div>
                        <h1 className="text-2xl font-bold mb-4">Journal d'Audit</h1>
                        <div className="bg-black/50 p-4 rounded-lg font-mono text-sm h-125 overflow-auto border border-gray-700 text-green-400">
                            {logs.length > 0 ? logs.map((l, i) => <div key={i}>{'>'} {l}</div>) : "Aucun log pour le moment."}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}