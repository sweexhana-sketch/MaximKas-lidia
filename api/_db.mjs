import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;
let schemaReady = false;

export function getSql() {
  if (!databaseUrl) throw new Error('DATABASE_URL belum diatur. Tambahkan koneksi Postgres/Neon di Vercel Environment Variables.');
  return neon(databaseUrl);
}

export async function ensureSchema(sql) {
  if (schemaReady) return;
  await sql`CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    transaction_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_time TIME`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'driver'`;
  schemaReady = true;
}

const tz = () => process.env.APP_TIMEZONE || 'Asia/Jayapura';

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz() }).format(new Date());
}

export function nowTime() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz(), hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
