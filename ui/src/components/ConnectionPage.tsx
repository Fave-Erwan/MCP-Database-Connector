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
        if (!saved) return [];
        try {
            const parsed: DbProfile[] = JSON.parse(saved);
            // déduplication simple basée sur les champs clés
            const seen = new Set<string>();
            const result: DbProfile[] = [];
            for (const p of parsed) {
                const key = p.type === 'sqlite'
                    ? `sqlite:${String(p.filepath || '').trim().toLowerCase()}`
                    : `${p.type}:${String(p.host || '').trim().toLowerCase()}:${String(p.port || '').trim()}:${String(p.user || '').trim().toLowerCase()}:${String(p.database || '').trim().toLowerCase()}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push(p);
                }
            }
            if (result.length !== parsed.length) {
                // enregistrer la liste nettoyée
                localStorage.setItem('mcp_profiles', JSON.stringify(result));
            }
            return result;
        } catch (e) {
            console.error('Failed to parse saved profiles:', e);
            return [];
        }
    });
    const [showForm, setShowForm] = useState(false); // Par défaut: afficher la liste des profils, pas le formulaire

    // Configuration vide réutilisable
    const emptyConfig = {
        host: '',
        port: '',
        user: '',
        password: '',
        database: '',
        filepath: ''
    };

    // 2. Charger la config sauvegardée au démarrage
    const [config, setConfig] = useState(() => {
        // Si il n'y a pas de profils sauvegardés, commencer avec un formulaire vide
        if (profiles.length === 0) return { ...emptyConfig };

        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return parsed;
            } catch (e) {
                console.error('Failed to parse saved config:', e);
            }
        }
        return { ...emptyConfig };
    });

    // États pour le chargement et les messages
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [connectingProfileId, setConnectingProfileId] = useState<string | null>(null);

    // utilitaire pour afficher un message temporaire
    const showStatus = (type: 'success' | 'error' | 'info', text: string, autoHide = true) => {
        setStatusMessage({ type, text });
        if (autoHide) {
            setTimeout(() => setStatusMessage(null), 4000);
        }
    };

    const deleteProfile = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Pour éviter de déclencher la connexion en cliquant sur supprimer
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        localStorage.setItem('mcp_profiles', JSON.stringify(updated));
        showStatus('success', 'Connexion supprimée');
        // Ne pas ouvrir automatiquement le formulaire après suppression — rester sur la liste
    };

    const handleConnect = async (profile?: DbProfile) => {
        const targetConfig = profile || { type: dbType, ...config };

        // Blocage si SQLite et pas de chemin
        if (targetConfig.type === 'sqlite' && !targetConfig.filepath) {
            alert("Veuillez sélectionner un fichier .db avant de vous connecter.");
            return;
        }

        setIsLoading(true);
        setStatusMessage(null);
        if (profile) setConnectingProfileId(profile.id);
        showStatus('info', 'Connexion en cours...', false);

        try {
            const targetConfig = profile ? profile : { type: dbType, ...config };

            const result = await (window as any).api.connectDB(targetConfig);

            if (result && result.success) {
                showStatus('success', 'Connexion réussie');

                if (!profile && rememberMe) {
                    saveProfile(targetConfig);
                }

                onConnect({ ...targetConfig, tables: result.tables });
            } else {
                const errMsg = result?.error || 'Échec inconnu de la connexion';
                showStatus('error', `Échec de la connexion : ${errMsg}`);
            }
        } catch (err: any) {
            console.error('Erreur technique :', err);
            showStatus('error', `Erreur technique : ${err?.message || String(err)}`);
        } finally {
            setIsLoading(false);
            setConnectingProfileId(null);
        }
    };

    const handleSelectFile = async () => {
        const filePath = await (window as any).api.selectFile();
        if (filePath) {
            setConfig({ ...config, filepath: filePath });
        }
    };

    // comparer deux profils (utilisé pour éviter les doublons)
    function profilesEqual(a: DbProfile, b: Partial<DbProfile>) {
        if (a.type !== b.type) return false;
        if (a.type === 'sqlite') {
            return String(a.filepath || '').trim().toLowerCase() === String(b.filepath || '').trim().toLowerCase();
        }
        // Pour les bases réseau: host, port, user, database
        return (
            String(a.host || '').trim().toLowerCase() === String(b.host || '').trim().toLowerCase() &&
            String(a.port || '').trim() === String(b.port || '').trim() &&
            String(a.user || '').trim().toLowerCase() === String(b.user || '').trim().toLowerCase() &&
            String(a.database || '').trim().toLowerCase() === String(b.database || '').trim().toLowerCase()
        );
    }

    // Utilitaires d'affichage pour les profils
    function basename(path?: string) {
        if (!path) return '';
        const parts = path.split(/[/\\\\]/);
        return parts[parts.length - 1] || path;
    }

    function computeProfileName(cfg: any) {
        if (cfg.profileName) return String(cfg.profileName);
        if (cfg.database) return String(cfg.database);
        if (cfg.filepath) return basename(cfg.filepath);
        if (cfg.host) return String(cfg.host);
        return `Connexion ${cfg.type}`;
    }

    function computeProfileSecondary(p: DbProfile) {
        // Pour les bases réseau on affiche uniquement l'hôte (priorité d'information)
        if (p.type === 'sqlite') {
            if (p.filepath) return `${p.filepath} · Fichier local`;
            return 'Fichier local';
        }
        // Pour Postgres/MySQL, afficher uniquement l'hôte (ou localhost par défaut)
        return p.host || 'localhost';
    }

    const saveProfile = (newConfig: any) => {
        const saved = localStorage.getItem('mcp_profiles');
        const existingProfiles: DbProfile[] = saved ? JSON.parse(saved) : [];

        const normalizedNew = {
            type: newConfig.type,
            filepath: newConfig.filepath,
            host: newConfig.host,
            port: newConfig.port,
            user: newConfig.user,
            database: newConfig.database,
        };

        const foundIndex = existingProfiles.findIndex((p) => profilesEqual(p, normalizedNew));
        if (foundIndex !== -1) {
            // mettre à jour le profil existant (conserver l'id)
            const existing = existingProfiles[foundIndex];
            const merged = { ...existing, ...newConfig } as DbProfile;

            // Déterminer le nom: si l'utilisateur a fourni un profileName, l'utiliser. Sinon, si le nom existant semble générique, le remplacer par une valeur plus descriptive.
            if (newConfig.profileName) {
                merged.name = String(newConfig.profileName);
            } else {
                const derived = computeProfileName(newConfig);
                const existingSeemsGeneric = existing.name?.startsWith('Connexion ') || existing.name === computeProfileName(existing);
                if (existingSeemsGeneric) merged.name = derived;
            }

            existingProfiles[foundIndex] = merged;
            setProfiles(existingProfiles);
            localStorage.setItem('mcp_profiles', JSON.stringify(existingProfiles));
            showStatus('info', 'Profil existant mis à jour');
            return;
        }

        const newProfile: DbProfile = {
            id: Date.now().toString(),
            name: computeProfileName(newConfig),
            type: newConfig.type,
            ...newConfig
        };

        const updatedProfiles = [...existingProfiles, newProfile];
        setProfiles(updatedProfiles);
        localStorage.setItem('mcp_profiles', JSON.stringify(updatedProfiles));
        showStatus('success', 'Profil enregistré');
    };

    function getSmartFolderDisplay(p: DbProfile) {
        if (p.type !== 'sqlite' || !p.filepath) {
            return { fileName: 'Nouvelle Base', parentFolder: 'Mémoire' };
        }
        const parts = p.filepath.split(/[\\/]/);
        const fileName = parts[parts.length - 1];
        // Si le fichier est à la racine, parts.length peut être petit
        const parentFolder = parts.length > 1 ? parts[parts.length - 2] : 'Racine';
        return { fileName, parentFolder };
    }

    return (
        <div className="space-y-6">
            {/* Banner globale d'état (visible partout) */}
            {statusMessage && (
                <div role="status" aria-live="polite" className={`mx-auto max-w-2xl mb-2 p-3 rounded ${statusMessage.type === 'success' ? 'bg-green-800 text-green-200' : statusMessage.type === 'error' ? 'bg-red-800 text-red-200' : 'bg-blue-800 text-blue-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {statusMessage.type === 'info' && <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />}
                            <span className="text-sm">{statusMessage.text}</span>
                        </div>
                        <button onClick={() => setStatusMessage(null)} className="text-sm font-medium opacity-80 hover:opacity-100">✕</button>
                    </div>
                </div>
            )}

            {!showForm && (
                <div className="grid grid-cols-1 gap-4">
                    <h3 className="text-gray-400">Vos connexions</h3>

                    {profiles.map((p: DbProfile) => {
                        const fileInfo = getSmartFolderDisplay(p);

                        return (
                            <div key={p.id} className="relative group">
                                <button
                                    onClick={() => handleConnect(p)}
                                    disabled={isLoading}
                                    className={`w-full bg-gray-800 p-4 rounded-xl border border-gray-700 ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-500'
                                        } flex justify-between items-center transition-all`}
                                >
                                    <div className="flex flex-col items-start overflow-hidden">
                                        {/* Nom du Profil (ou nom du fichier par défaut) */}
                                        <span className="font-bold text-gray-100 truncate w-full text-left">
                                            {p.name || (fileInfo ? fileInfo.fileName : 'Sans nom')}
                                        </span>

                                        {/* Infos secondaires dynamiques */}
                                        <div
                                            className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5"
                                            title={p.filepath || p.host}
                                        >
                                            {p.type === 'sqlite' ? (
                                                <>
                                                    <span className="">📁</span>
                                                    <span className="truncate max-w-37.5">
                                                        .../{fileInfo?.parentFolder}/{fileInfo?.fileName}
                                                    </span>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                                                    <span className="leading-none flex items-center justify-center">🌐</span>
                                                    <span className="leading-none">{p.host || 'localhost'}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0 ml-4">
                                        {connectingProfileId === p.id && (
                                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                        )}
                                        <span className="text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded">
                                            {p.type}
                                        </span>
                                    </div>
                                </button>

                                {/* Bouton Supprimer */}
                                <button
                                    onClick={(e) => deleteProfile(p.id, e)}
                                    disabled={isLoading}
                                    className={`absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 ${isLoading ? 'hidden' : ''
                                        }`}
                                    title="Supprimer ce profil"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}

                    <button
                        onClick={() => {
                            setDbType('sqlite');
                            setConfig({ ...emptyConfig });
                            setRememberMe(true);
                            setShowForm(true);
                        }}
                        className="text-blue-400 border border-dashed border-blue-400/30 p-4 rounded-xl hover:bg-blue-400/10"
                    >
                        + Ajouter une nouvelle connexion
                    </button>
                </div>
            )}

            {showForm && (
                <div aria-busy={isLoading} className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-2xl border border-gray-700 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-blue-400">Connexion MCP</h2>
                        <button onClick={() => { setShowForm(false); }} className="text-sm text-gray-400 hover:text-gray-200" disabled={isLoading}>Annuler</button>
                    </div>


                    {/* Menu Déroulant */}
                    <div className="mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Type de Base de Données</label>
                        <select
                            value={dbType}
                            onChange={(e) => setDbType(e.target.value)}
                            disabled={isLoading}
                            className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 appearance-none ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {dbTypes.map(t => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Formulaire conditionnel */}
                    <div className="space-y-4">
                        {dbType === 'sqlite' ? (
                            <>
                                <div className="space-y-2">
                                    <label className="block text-sm text-gray-400">Chemin de la base SQLite</label>
                                    <div
                                        onClick={!isLoading ? handleSelectFile : undefined}
                                        className={`border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-xl p-8 transition-all ${isLoading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'} bg-gray-900/50 group text-center`}
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

                                {/* Option pour se souvenir des paramètres aussi pour SQLite */}
                                <div className="flex items-center gap-2 mt-4 mb-2">
                                    <input
                                        type="checkbox"
                                        id="remember_sqlite"
                                        disabled={isLoading}
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                                    />
                                    <label htmlFor="remember_sqlite" className="text-sm text-gray-400 cursor-pointer">
                                        Se souvenir de ces paramètres
                                    </label>
                                </div>
                            </>

                        ) : (

                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Hôte</label>
                                        <input type="text" value={config.host} disabled={isLoading} className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onChange={(e) => setConfig({ ...config, host: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Port</label>
                                        <input type="text" value={config.port} disabled={isLoading} placeholder={dbType === 'postgres' ? '5432' : '3306'} className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onChange={(e) => setConfig({ ...config, port: e.target.value })} />
                                    </div>
                                </div >
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Nom de la base de données</label>
                                    <input type="text" value={config.database} disabled={isLoading} className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onChange={(e) => setConfig({ ...config, database: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Utilisateur</label>
                                        <input type="text" value={config.user} disabled={isLoading} className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onChange={(e) => setConfig({ ...config, user: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Mot de passe</label>
                                        <input type="password" value={config.password} disabled={isLoading} className={`w-full bg-gray-900 border border-gray-700 p-3 rounded-lg text-white ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`} onChange={(e) => setConfig({ ...config, password: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-4 mb-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        disabled={isLoading}
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
                        disabled={isLoading}
                        className={`w-full bg-blue-600 ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-500'} text-white font-bold py-4 rounded-xl mt-6 transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3`}
                    >
                        {isLoading && <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" />}
                        <span>{isLoading ? 'Connexion...' : 'Tester et Connecter'}</span>
                    </button>
                </div >
            )}
        </div>
    );
}