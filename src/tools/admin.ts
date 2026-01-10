import { getDatabase } from '../db/client.js';
import { auditLog } from '../services/logger.js';

/**
 * Nettoie le nom de la table (enlève guillemets, espaces, et met en minuscule)
 */
function cleanTableName(name: string): string {
  // On ne garde QUE les lettres, chiffres et underscores
  const sanitized = name.replace(/[^a-zA-Z0-9_]/g, '').trim().toLowerCase();
  
  // Si après nettoyage le nom est vide ou trop différent, on bloque
  if (!sanitized || sanitized !== name.trim().toLowerCase().replace(/['"`]/g, '')) {
     throw new Error("Caractères interdits détectés dans le nom de la table.");
  }
  return sanitized;
}

/**
 * Retourne la liste des permissions (table_name, can_read, can_write)
 */
export async function admin_list_permissions(): Promise<Array<{ table_name: string; can_read: boolean; can_write: boolean }>> {
  const db = getDatabase();
  const rows = await db('mcp_internal_permissions').select('table_name', 'can_read', 'can_write');
  await auditLog('ADMIN_LIST_PERMISSIONS', 'OK');
  return rows.map((r: any) => ({ 
    table_name: r.table_name, 
    can_read: Boolean(r.can_read),
    can_write: Boolean(r.can_write),
  }));
}

/**
 * Basculer la permission d'une table (read ou write) avec validation stricte
 * permission_type: 'read' | 'write'
 */
export async function admin_toggle_permission(table_name: string, permission_type: 'read' | 'write', status: boolean): Promise<{ success: boolean; table_name: string; permission_type: 'read' | 'write'; enabled: boolean }> {
  const db = getDatabase();
  const name = cleanTableName(table_name);

  // 1. Vérification stricte de l'existence réelle
  const realTables = await db('sqlite_master')
    .where({ type: 'table' })
    .whereNot('name', 'like', 'sqlite_%')
    .select('name');
  
  const existsInDb = realTables.some(r => r.name.toLowerCase() === name);

  if (!existsInDb) {
    await auditLog(`ADMIN_TOGGLE_PERMISSION FAILED: ${name} non-existent`, 'BLOCKED');
    throw new Error(`Sécurité : La table "${name}" n'existe pas dans la base de données. Action annulée.`);
  }

  // 2. Mise à jour ou Insertion sans toucher à l'autre colonne
  const existingPermission = await db('mcp_internal_permissions')
    .where({ table_name: name })
    .first();

  const updateObj: any = {};
  if (permission_type === 'read') updateObj.can_read = status ? 1 : 0;
  else updateObj.can_write = status ? 1 : 0;

  if (existingPermission) {
    await db('mcp_internal_permissions')
      .where({ table_name: name })
      .update(updateObj);
  } else {
    const insertObj: any = { table_name: name, can_read: true, can_write: false };
    if (permission_type === 'read') insertObj.can_read = status ? 1 : 0;
    else insertObj.can_write = status ? 1 : 0;
    await db('mcp_internal_permissions')
      .insert(insertObj);
  }

  await auditLog(`ADMIN_TOGGLE_PERMISSION ${name} ${permission_type}=${status}`, 'OK');
  return { success: true, table_name: name, permission_type, enabled: status };
}