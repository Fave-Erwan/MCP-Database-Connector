import { app, BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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