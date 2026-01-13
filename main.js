import { app, BrowserWindow, screen, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import knex from 'knex';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let dbConnection = null;

ipcMain.handle('db:connect', async (event, config) => {
    try {
        // Si une connexion existe déjà, on la ferme
        if (dbConnection) await dbConnection.destroy();

        let knexConfig = {};

        if (config.type === 'sqlite') {
            knexConfig = {
                client: 'sqlite3',
                connection: { filename: config.filepath },
                useNullAsDefault: true
            };
        } else {
            // PostgreSQL ou MySQL
            knexConfig = {
                client: config.type === 'postgres' ? 'pg' : 'mysql2',
                connection: {
                    host: config.host,
                    port: Number(config.port),
                    user: config.user,
                    password: config.password,
                    database: config.database,
                }
            };
        }

        dbConnection = knex(knexConfig);

        // TEST : On essaie de lister les tables pour vérifier que ça marche
        let tables = [];
        if (config.type === 'sqlite') {
            const res = await dbConnection.raw("SELECT name FROM sqlite_master WHERE type='table'");
            tables = res.map(r => r.name);
        } else {
            // Requête universelle pour Postgres/MySQL
            const res = await dbConnection.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' OR table_schema = ?", [config.database]);
            tables = res.rows ? res.rows.map(r => r.table_name) : res[0].map(r => r.table_name);
        }

        console.log("Connexion réussie ! Tables trouvées :", tables);
        return { success: true, tables };

    } catch (error) {
        console.error("Erreur de connexion :", error);
        return { success: false, error: error.message };
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