import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | undefined;

function intEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not configured.');
    const sslEnabled = process.env.DATABASE_SSL !== 'false';
    pool = new Pool({
      connectionString,
      max: intEnv('DB_POOL_MAX', 5, 1, 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: sslEnabled ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
      application_name: 'sportabiedrs-netlify',
    });
  }
  return pool;
}

export type DbClient = pg.PoolClient;
