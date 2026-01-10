import { getDatabase } from '../db/client.js';
import { guardQuery } from '../middleware/guards.js';
import { auditLog } from '../services/logger.js';

const MUTATION_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];

/**
 * Outil dédié aux opérations d'écriture (mutations SQL)
 * Vérifie d'abord via guardQuery, puis exécute la requête
 */
export async function execute_write_query(query: string): Promise<unknown> {
  const normalized = query.trim().toUpperCase();
  const containsMutation = MUTATION_KEYWORDS.some((k) => normalized.includes(k));

  if (!containsMutation) {
    throw new Error('execute_write_query accepte uniquement des requêtes de type INSERT/UPDATE/DELETE/CREATE/DROP/etc. Pour les lectures utilisez query_db.');
  }

  const guardResult = await guardQuery(query);
  if (!guardResult.allowed) {
    await auditLog(query, 'BLOCKED');
    throw new Error(guardResult.reason);
  }

  const db = getDatabase();
  try {
    const result = await db.raw(query);
    await auditLog(query, 'OK');

    return {
      success: true,
      affectedRows: result.changes ?? 0,
      message: 'Write query executed successfully',
    };
  } catch (err) {
    await auditLog(query, 'ERROR');
    console.error('Write query error:', err);
    throw err;
  }
}
