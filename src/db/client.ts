import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: ReturnType<typeof knex>;

/**
 * Initialiser le client de base de données
 */
export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL || 'sqlite:database.db';

  if (databaseUrl.startsWith('sqlite:')) {
    const dbPath = databaseUrl.replace('sqlite:', '');
    const resolvedPath = path.isAbsolute(dbPath)
      ? dbPath
      : path.resolve(__dirname, '..', '..', dbPath);

    db = knex({
      client: 'sqlite3',
      connection: {
        filename: resolvedPath,
      },
      useNullAsDefault: true,
    });

    console.error(`Connected to SQLite database: ${resolvedPath}`);
  } else if (databaseUrl.startsWith('postgresql://')) {
    db = knex({
      client: 'pg',
      connection: databaseUrl,
    });

    console.error('Connected to PostgreSQL database');
  } else {
    throw new Error(
      `Unsupported DATABASE_URL format: ${databaseUrl}. Use sqlite:path or postgresql://...`
    );
  }

  // Tester la connexion
  try {
    await db.raw('SELECT 1');
    console.error('Database connection test successful');

    // Créer la table interne de permissions si besoin
    const has = await db.schema.hasTable('mcp_internal_permissions');

    if (!has) {
      await db.schema.createTable('mcp_internal_permissions', (t) => {
        t.text('table_name').primary();
        // Lecture par défaut autorisée, écriture par défaut désactivée
        t.boolean('can_read').notNullable().defaultTo(true);
        t.boolean('can_write').notNullable().defaultTo(false);
      });
      console.error('Created internal permissions table: mcp_internal_permissions');
    } else {
      // Migration de l'ancien schéma (is_allowed) vers can_read / can_write si nécessaire
      try {
        const info = await db('mcp_internal_permissions').columnInfo();
        if (info && 'is_allowed' in info && (!('can_read' in info) || !('can_write' in info))) {
          console.error('Detected legacy column is_allowed, migrating to can_read / can_write');
          // Ajouter les nouvelles colonnes si manquantes
          await db.schema.table('mcp_internal_permissions', (t) => {
            if (!('can_read' in info)) t.boolean('can_read').notNullable().defaultTo(true);
            if (!('can_write' in info)) t.boolean('can_write').notNullable().defaultTo(false);
          });

          // Copier les valeurs existantes : is_allowed -> can_read et can_write
          await db.raw('UPDATE mcp_internal_permissions SET can_read = is_allowed, can_write = is_allowed');
          console.error('Migration complete: is_allowed values copied to can_read and can_write');
        }
      } catch (mErr) {
        console.error('Migration check/attempt failed:', mErr);
      }
    }

    // Synchroniser : lister les tables existantes et insérer celles qui manquent avec can_read=true, can_write=false
    let userTables: string[] = [];
    try {
      const clientName = (db.client && (db.client.config?.client || db.client.constructor?.name)) || '';
      if (String(clientName).toLowerCase().includes('sqlite') || String(clientName).includes('')) {
        const rows = await db.raw("SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        userTables = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : (rows && rows.map ? rows.map((r: any) => r.table_name) : []);
      } else if (String(clientName).toLowerCase().includes('pg') || String(clientName).toLowerCase().includes('postgres')) {
        const rows = await db.raw("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';");
        userTables = Array.isArray(rows) ? rows.map((r: any) => r.table_name) : (rows && rows.rows ? rows.rows.map((r: any) => r.table_name) : []);
      }

      // Exclure la table interne
      userTables = userTables.map((t) => String(t).toLowerCase()).filter((t) => t !== 'mcp_internal_permissions');

      for (const tbl of userTables) {
        const normalized = String(tbl).trim().toLowerCase();
        const exists = await db('mcp_internal_permissions').where({ table_name: normalized }).first();
        if (!exists) {
          // can_read=true (lecture autorisée par défaut), can_write=false (écriture désactivée par défaut)
          await db('mcp_internal_permissions').insert({ table_name: normalized, can_read: true, can_write: false });
          console.error(`Added internal permission record for table: ${normalized}`);
        }
      }

      // Nettoyage : supprimer les entrées obsolètes de mcp_internal_permissions en utilisant une requête SQL directe
      try {
        await db.raw("DELETE FROM mcp_internal_permissions WHERE table_name NOT IN (SELECT name FROM sqlite_master WHERE type='table')");
        console.error('Cleaned up stale permission records via DELETE ... NOT IN (sqlite_master)');
      } catch (cleanupErr) {
        console.error('Failed to cleanup stale permissions:', cleanupErr);
      }
    } catch (err) {
      console.error('Failed to sync internal permissions:', err);
    }

  } catch (error) {
    console.error('Database connection test failed:', error);
    throw error;
  }
}

/**
 * Récupérer le client de base de données
 */
export function getDatabase(): ReturnType<typeof knex> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Fermer la connexion à la base de données
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy();
    console.error('Database connection closed');
  }
}
