import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import knex from 'knex';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let dbConnection = null;

ipcMain.handle('db:connect', async (event, config) => {
    try {
        if (dbConnection) await dbConnection.destroy();

        const knexConfig = {
            client: config.type === 'sqlite' ? 'sqlite3' : (config.type === 'postgres' ? 'pg' : 'mysql2'),
            connection: config.type === 'sqlite'
                ? { filename: config.filepath }
                : {
                    host: config.host,
                    port: Number(config.port),
                    user: config.user,
                    password: config.password,
                    database: config.database,
                },
            useNullAsDefault: config.type === 'sqlite',
            // On réduit le timeout pour ne pas attendre 30 secondes en cas d'erreur
            acquireConnectionTimeout: 5000
        };

        dbConnection = knex(knexConfig);

        // TEST DE CONNEXION RÉEL
        let tables = [];
        if (config.type === 'sqlite') {
            const res = await dbConnection.raw("SELECT name FROM sqlite_master WHERE type='table'");
            tables = res.map(r => r.name);
        } else {
            // Pour Postgres/MySQL, on interroge le schéma
            const schema = config.type === 'postgres' ? 'public' : config.database;
            const res = await dbConnection.raw(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
                [schema]
            );
            // Ajustement selon le driver (pg renvoie .rows, mysql renvoie un array)
            const rows = res.rows || res[0];
            tables = rows.map(r => r.table_name || r.TABLE_NAME);
        }

        return { success: true, tables };

    } catch (err) {
        console.log("ERREUR DÉTECTÉE :", err.code); // Pour voir le code exact

        let friendlyMessage = "Échec de la connexion.";

        // On vérifie err.code OU err.nativeError.code (parfois Knex encapsule l'erreur)
        const errorCode = err.code || (err.nativeError && err.nativeError.code);

        if (errorCode === 'ECONNREFUSED') {
            friendlyMessage = "Le serveur est éteint ou refuse la connexion (Vérifiez le service PostgreSQL).";
        } else if (errorCode === '28P01' || errorCode === 'ER_ACCESS_DENIED_ERROR') {
            friendlyMessage = "Identifiants incorrects (Utilisateur ou Mot de passe).";
        } else if (errorCode === '3D000' || errorCode === 'ER_BAD_DB_ERROR') {
            friendlyMessage = "La base de données spécifiée n'existe pas.";
        } else if (err.message.includes('ENOENT')) {
            friendlyMessage = "Le fichier SQLite est introuvable au chemin indiqué.";
        } else {
            friendlyMessage = err.message; // Message par défaut si inconnu
        }

        return { success: false, error: friendlyMessage };
    }
});

ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
            { name: 'Bases de données', extensions: ['db', 'sqlite', 'sqlite3'] }
        ]
    });
    if (!canceled) {
        return filePaths[0]; // Renvoie le chemin complet vers React
    }
    return null;
});


// Importe ta fonction qui lit les tables SQLite ici

ipcMain.handle('admin:list-permissions', async () => {
    try {
        // Remplace par ton vrai appel DB qui fait "SELECT table_name FROM permissions"
        // const tables = db.prepare('SELECT * FROM permissions').all();
        // return tables;
        return [
            { table_name: 'users', can_read: true, can_write: false },
            { table_name: 'orders', can_read: true, can_write: true }
        ]; // Exemple temporaire pour tester l'affichage
    } catch (error) {
        console.error("Erreur DB:", error);
        return [];
    }
});

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const win = new BrowserWindow({
        // Taille "Pro" (80% de l'écran)
        width: Math.floor(width * 0.8),
        height: Math.floor(height * 0.8),
        minWidth: 1000,
        minHeight: 700,

        show: false, // On cache jusqu'à ce que ce soit prêt
        backgroundColor: '#0f172a', // Couleur de ton Dashboard

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Éviter le flash blanc au démarrage
    win.once('ready-to-show', () => {
        win.show();
    });

    // On charge l'URL de Vite
    win.loadURL('http://localhost:5173');
}

// Gestion du démarrage
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});