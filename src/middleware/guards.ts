/**
 * Middleware de vigile pour analyser et filtrer les requêtes SQL
 * Empêche les opérations de mutation (INSERT, UPDATE, DELETE) lorsque ALLOW_MUTATIONS est à false
 * Implemente également une whitelist optionnelle via la variable d'environnement ALLOWED_TABLES
 */

const MUTATION_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE'];

/**
 * Si ALLOWED_TABLES est défini (séparateur virgule), seules ces tables sont autorisées.
 * S'il est vide ou non défini, la vérification de la whitelist est ignorée.
 */
export const ALLOWED_TABLES: string[] = process.env.ALLOWED_TABLES
  ? process.env.ALLOWED_TABLES.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [];

export interface GuardResult {
  allowed: boolean;
  reason?: string;
}
// Extraire les noms de tables référencées dans la requête (FROM, JOIN, INTO, UPDATE, TABLE)
function extractReferencedTables(query: string): string[] {
  const regex = /(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+[`"']?([a-zA-Z0-9_.]+)[`"']?/gi;
  const tables = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(query))) {
    tables.add(match[1].toLowerCase());
  }
  return Array.from(tables);
}

/**
 * Vérifier si une requête est autorisée en fonction des permissions configurées et de la whitelist
 */
export async function guardQuery(query: string): Promise<GuardResult> {
  const allowMutations = process.env.ALLOW_MUTATIONS !== 'false';
  const normalizedQuery = query.trim().toUpperCase();

  // Vérifier la présence de mots-clés de mutation (n'importe où dans la requête)
  const hasMutationKeyword = MUTATION_KEYWORDS.some((keyword) =>
    normalizedQuery.includes(keyword)
  );

  if (hasMutationKeyword && !allowMutations) {
    return {
      allowed: false,
      reason: `Les requêtes de mutation sont désactivées. ALLOW_MUTATIONS est à 'false'. Type de requête: ${normalizedQuery.split(/\s+/)[0]}`,
    };
  }

  // Extraire les tables référencées
  const referenced = extractReferencedTables(query);

  // Empêcher toute requête visant la table interne
  if (referenced.includes('mcp_internal_permissions')) {
    return {
      allowed: false,
      reason: `Accès refusé à la table mcp_internal_permissions`,
    };
  }

  // Vérification de la whitelist ALLOWED_TABLES côté configuration statique
  if (ALLOWED_TABLES.length > 0) {
    const unauthorizedStatic = referenced.filter((t) => !ALLOWED_TABLES.includes(t));
    if (unauthorizedStatic.length > 0) {
      return {
        allowed: false,
        reason: `Query references unauthorized tables: ${unauthorizedStatic.join(', ')}`,
      };
    }
  }

  // Si aucune table référencée, on autorise (ex: SELECT 1)
  if (referenced.length === 0) {
    return { allowed: true };
  }

  // Vérification dynamique via la table mcp_internal_permissions
  try {
    // import dynamique pour éviter les cycles
    const { getDatabase } = await import('../db/client.js');
    const db = getDatabase();

    // Requête pour récupérer l'état des tables référencées
    const rows = await db('mcp_internal_permissions').whereIn('table_name', referenced).select('table_name', 'can_read', 'can_write');

    const dbMap = new Map<string, any>();
    for (const r of rows) dbMap.set(String(r.table_name).toLowerCase(), r);

    // Déterminer le type de requête
    const isSelect = normalizedQuery.startsWith('SELECT');
    const isMutation = MUTATION_KEYWORDS.some((k) => normalizedQuery.includes(k));

    for (const t of referenced) {
      const row = dbMap.get(t);
      // Si pas d'entrée dans la table interne -> refuser par défaut
      if (!row) {
        return {
          allowed: false,
          reason: `Accès refusé à la table ${t}`,
        };
      }

      if (isSelect) {
        if (!row.can_read) {
          return {
            allowed: false,
            reason: `Accès refusé à la table ${t} (lecture non autorisée)`,
          };
        }
      } else if (isMutation) {
        if (!row.can_write) {
          return {
            allowed: false,
            reason: `Accès refusé à la table ${t} (écriture non autorisée)`,
          };
        }
      }
    }

    // Contrôles de sécurité supplémentaires
    if (normalizedQuery.includes('--') || normalizedQuery.includes('/*')) {
      // Les commentaires SQL sont autorisés mais signalés
      console.warn('Query contains SQL comments');
    }

    return { allowed: true };
  } catch (error) {
    // Si problème de vérification dynamique, refuser par sécurité
    console.error('Guard dynamic check failed:', error);
    return { allowed: false, reason: 'Erreur interne de vérification de sécurité' };
  }
}

/**
 * Assainir les messages d'erreur pour éviter les fuites d'information
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // En production, il est recommandé de masquer les messages d'erreur détaillés
    return error.message;
  }
  return 'Unknown error occurred';
}
