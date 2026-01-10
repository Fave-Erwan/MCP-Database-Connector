import { appendFile } from 'fs/promises';
import path from 'path';

const AUDIT_LOG = path.join(process.cwd(), 'audit.log');

export type AuditStatus = 'OK' | 'BLOCKED' | 'ERROR';

export async function auditLog(query: string, status: AuditStatus): Promise<void> {
  const timestamp = new Date().toISOString();
  const safeQuery = (query || '').replace(/\r?\n/g, ' ');
  const line = `[${timestamp}] [Status: ${status}] [${safeQuery}]`;

  try {
    await appendFile(AUDIT_LOG, line + '\n', { encoding: 'utf8' });
  } catch (err) {
    // Ne pas lancer d'exception pour éviter de casser le flux principal ; écrire dans stderr
    console.error('Failed to write audit log:', err);
  }
}
