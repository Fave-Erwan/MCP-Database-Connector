import { getDatabase } from '../db/client.js';
import { guardQuery } from '../middleware/guards.js';
import { auditLog } from '../services/logger.js';

/**
 * Gestionnaire pour l'outil `query_db`
 * Exécute des requêtes SQL via le vigile et enregistre chaque tentative
 */
export async function queryDatabaseTool(query: string): Promise<unknown> {
  // Vigile : vérifier si la requête est autorisée
  const guardResult = await guardQuery(query);
  if (!guardResult.allowed) {
    // Enregistrer la tentative bloquée
    await auditLog(query, 'BLOCKED');
    throw new Error(guardResult.reason);
  }

  // Récupérer le client de base de données
  const db = getDatabase();

  try {
    // Exécuter la requête brute (raw)
    const result = await db.raw(query);

    // Enregistrer l'exécution réussie
    await auditLog(query, 'OK');

    // Formater le résultat selon le type de requête
    const normalizedQuery = query.trim().toUpperCase();

    if (
      normalizedQuery.startsWith('INSERT') ||
      normalizedQuery.startsWith('UPDATE') ||
      normalizedQuery.startsWith('DELETE')
    ) {
      // Pour les mutations, retourner le nombre de lignes affectées
      return {
        success: true,
        affectedRows: result.changes ?? 0,
        message: `Query executed successfully`,
      };
    } else {
      // Pour les SELECT ou autres requêtes, retourner les données
      return {
        success: true,
        data: result,
        rowCount: Array.isArray(result) ? result.length : 0,
      };
    }
  } catch (error) {
    // Enregistrer l'erreur
    await auditLog(query, 'ERROR');
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Lister les tables présentes dans la base de données connectée
 */
export async function listTables(): Promise<string[]> {
  const db = getDatabase();
  const clientName = (db.client && (db.client.config?.client || db.client.constructor?.name)) || '';

  if (String(clientName).includes('sqlite3') || String(clientName).toLowerCase().includes('sqlite')) {
    const rows = await db.raw("SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const names = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : (rows && rows.map ? rows.map((r: any) => r.table_name) : []);
    await auditLog('LIST_TABLES', 'OK');
    return names;
  }

  if (String(clientName).includes('pg') || String(clientName).toLowerCase().includes('postgres')) {
    const rows = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';");
    const names = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : (rows && rows.rows ? rows.rows.map((r: any) => r.table_name) : []);
    await auditLog('LIST_TABLES', 'OK');
    return names;
  }

  // Repli : tenter d'interroger sqlite_master si nécessaire
  try {
    const rows = await db.raw("SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const names = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : (rows && rows.map ? rows.map((r: any) => r.table_name) : []);
    await auditLog('LIST_TABLES', 'OK');
    return names;
  } catch (err) {
    await auditLog('LIST_TABLES', 'ERROR');
    throw err;
  }
}

