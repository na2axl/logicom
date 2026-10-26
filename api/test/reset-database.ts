import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sql from 'mssql';
import type { Config } from '../src/config/index.js';

const INIT_SCRIPT = join(
  import.meta.dirname,
  '..',
  '..',
  'database',
  'init.sql',
);

/**
 * Re-runs database/init.sql (drop + create + seed). Batches are split on
 * GO like sqlcmd does, and run on a single connection so USE statements stick.
 */
export async function resetDatabase(config: Config['db']): Promise<void> {
  const batches = readFileSync(INIT_SCRIPT, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);

  const pool = new sql.ConnectionPool({
    server: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'master',
    options: { trustServerCertificate: true },
    pool: { max: 1, min: 1 },
  });
  await pool.connect();
  try {
    for (const batch of batches) {
      await pool.request().batch(batch);
    }
  } finally {
    await pool.close();
  }
}
