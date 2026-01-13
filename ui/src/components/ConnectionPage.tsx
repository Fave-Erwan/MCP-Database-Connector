import React, { useState } from 'react';

interface DbProfile {
    id: string;
    name: string;
    type: 'sqlite' | 'postgres' | 'mysql';
    host?: string;
    port?: string;
    user?: string;
    password?: string;
    database?: string;
    filepath?: string;
}

const STORAGE_KEY = 'mcp_saved_config';

// Liste des types supportés
const dbTypes = [
    { id: 'sqlite', label: 'SQLite (Fichier local)' },
    { id: 'postgres', label: 'PostgreSQL' },
    { id: 'mysql', label: 'MySQL / MariaDB' },
];

export default function ConnectionPage({ onConnect }: { onConnect: (config: any) => void }) {
    const [dbType, setDbType] = useState('sqlite');
    const [rememberMe, setRememberMe] = useState(true); // Coché par défaut
    const [profiles, setProfiles] = useState<DbProfile[]>(() => {
        const saved = localStorage.getItem('mcp_profiles');
        return saved ? JSON.parse(saved) : [];
    });
    const [showForm, setShowForm] = useState(profiles.length === 0);


    // 2. Charger la config sauvegardée au démarrage
    const [config, setConfig] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // On peut optionnellement changer le dbType ici aussi
            return parsed;
        }
        return {
            host: 'localhost',
            port: '',
            user: '',
            password: '',
            database: '',
            filepath: ''
        };
    });

    const deleteProfile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Pour éviter de déclencher la connexion en cliquant sur supprimer
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        localStorage.setItem('mcp_profiles', JSON.stringify(updated));
    };

    const handleConnect = async (profile?: DbProfile) => {

        const isProfile = profile && (profile as DbProfile).id;
        const targetConfig = isProfile ? profile : { type: dbType, ...config };
        try {
            // On choisit soit le profil cliqué, soit ce qui est dans le formulaire
            const targetConfig = profile || { type: dbType, ...config };

            // 1. On appelle le moteur Electron
            const result = await (window as any).api.connectDB(targetConfig);

            if (result.success) {
                console.log("Connecté avec succès !");

                // 2. Si c'est une nouvelle connexion (pas un profil existant), on sauvegarde
                if (!profile && rememberMe) {
                    saveProfile(targetConfig);
                }

                // 3. On transmet au parent App.tsx
                onConnect({ ...targetConfig, tables: result.tables });
            } else {
                alert("Échec de la connexion : " + result.error);
            }
        } catch (err) {
            console.error("Erreur technique :", err);
        }
    };

    const handleSelectFile = async () => {
        const filePath = await (window as any).api.selectFile();
        if (filePath) {
            setConfig({ ...config, filepath: filePath });
        }
    };

    const saveProfile = (newConfig: any) => {
        const saved = localStorage.getItem('mcp_profiles');
        const existingProfiles: DbProfile[] = saved ? JSON.parse(saved) : [];

        const newProfile: DbProfile = {
            id: Date.now().toString(),
            name: newConfig.profileName || `Connexion ${newConfig.type}`,
            type: newConfig.type,
            ...newConfig
        };

        const updatedProfiles = [...existingProfiles, newProfile];
        setProfiles(updatedProfiles);
        localStorage.setItem('mcp_profiles', JSON.stringify(updatedProfiles));
    };

    return (
        <div className="space-y-6">
            {!showForm && (
                <div className="grid grid-cols-1 gap-4">
                    <h3 className="text-gray-400">Vos connexions</h3>
                    {profiles.map((p: DbProfile) => (
                        <div key={p.id} className="relative group">
                            <button
                                key={p.id}
                                onClick={() => handleConnect(p)}
                                className="w-full bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-blue-500 flex justify-between items-center transition-all"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="font-bold text-gray-100">{p.name}</span>
                                    <span className="text-xs text-gray-500">{p.host || 'Fichier local'}</span>
                                </div>
                                <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded">
                                    {p.type}
                                </span>
                            </button>

                            {/* Bouton Supprimer qui apparaît au survol */}
                            <button
                                onClick={(e) => deleteProfile(p.id, e)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                title="Supprimer ce profil"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => setShowForm(true)}
                        className="text-blue-400 border border-dashed border-blue-400/30 p-4 rounded-xl hover:bg-blue-400/10"
                    >
                        + Ajouter une nouvelle connexion
                    </button>
                </div>
            )}

            {showForm && (
                <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
                    <h2 className="text-2xl font-bold mb-6 text-blue-400 text-center">Connexion MCP</h2>

                    {/* Menu Déroulant */}
                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Type de Base de Données</label>
                        <select
                            value={dbType}
                            onChange={(e) => setDbType(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 appearance-none"
                        >
                            {dbTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Formulaire conditionnel */}
                    <div className="space-y-4">
                        {dbType === 'sqlite' ? (
                            <div className="space-y-2">
                                <label className="block text-sm text-gray-400">Chemin de la base SQLite</label>
                                <div
                                    onClick={handleSelectFile}
                                    className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-8 transition-all cursor-pointer bg-gray-900/50 group text-center"
                                >
                                    {config.filepath ? (
                                        <p className="text-blue-400 font-mono text-sm break-all">{config.filepath}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-gray-300 font-medium group-hover:text-blue-400">Cliquez pour choisir le fichier .db</p>
                                            <p className="text-xs text-gray-500 italic">L'explorateur Windows va s'ouvrir</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (

                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Hôte</label>
                                        <input type="text" value={config.host} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white" onChange={(e) => setConfig({ ...config, host: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Port</label>
                                        <input type="text" value={config.port} placeholder={dbType === 'postgres' ? '5432' : '3306'} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white" onChange={(e) => setConfig({ ...config, port: e.target.value })} />
                                    </div>
                                </div >
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nom de la base de données</label>
                                    <input type="text" value={config.database} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white" onChange={(e) => setConfig({ ...config, database: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Utilisateur</label>
                                        <input type="text" value={config.user} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white" onChange={(e) => setConfig({ ...config, user: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
                                        <input type="password" value={config.password} className="w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white" onChange={(e) => setConfig({ ...config, password: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 mb-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="remember" className="text-sm text-gray-400 cursor-pointer">
                                        Se souvenir de ces paramètres
                                    </label>
                                </div>
                            </>
                        )}
                    </div>


                    {/* Bouton de connexion */}
                    <button
                        onClick={() => handleConnect()}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-6 transition-all shadow-lg shadow-blue-900/20"
                    >
                        Tester et Connecter
                    </button>
                </div >
            )}
        </div>
    );
}