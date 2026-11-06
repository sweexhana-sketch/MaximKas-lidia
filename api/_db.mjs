import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL;

export function getSql() {
  if (!databaseUrl) throw new Error('DATABASE_URL belum diatur. Tambahkan koneksi Postgres/Neon di Vercel Environment Variables.');
  return neon(databaseUrl);
}

export async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    transaction_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Jayapura' }).format(new Date());
}
