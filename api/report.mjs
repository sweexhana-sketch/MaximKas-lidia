import { authenticate } from './_auth.mjs';
import { ensureSchema, getSql, today } from './_db.mjs';

const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
function daysAgo(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Laporan lengkap untuk admin: total, per akun, per kategori, per hari, dan seluruh transaksi pada rentang tanggal.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = authenticate(req, res);
  if (!user) return;
  if (user.role !== 'admin') return res.status(403).json({ error: 'Hanya admin yang dapat melihat laporan.' });
  try {
    const q = req.query || {};
    const to = isDate(q.to) ? q.to : today();
    const from = isDate(q.from) ? q.from : daysAgo(to, 6);
    const owner = ['admin', 'driver'].includes(q.owner) ? q.owner : null;
    const type = ['income', 'expense'].includes(q.type) ? q.type : null;
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT id, transaction_date::text AS transaction_date, transaction_time::text AS transaction_time,
             type, category, amount, note, location, latitude, longitude, owner
      FROM transactions
      WHERE transaction_date BETWEEN ${from} AND ${to}
        AND (${owner}::text IS NULL OR owner = ${owner})
        AND (${type}::text IS NULL OR type = ${type})
      ORDER BY transaction_date DESC, transaction_time DESC NULLS LAST, created_at DESC
      LIMIT 2000`;
    const totals = { income: 0, expense: 0, balance: 0, count: rows.length };
    const byOwner = {}, byCategory = {}, byDay = {};
    for (const r of rows) {
      const sign = r.type === 'income' ? 'income' : 'expense';
      totals[sign] += r.amount;
      const o = (byOwner[r.owner] ||= { income: 0, expense: 0, count: 0 }); o[sign] += r.amount; o.count++;
      const c = (byCategory[`${r.type}|${r.category}`] ||= { type: r.type, category: r.category, total: 0, count: 0 }); c.total += r.amount; c.count++;
      const d = (byDay[r.transaction_date] ||= { date: r.transaction_date, income: 0, expense: 0 }); d[sign] += r.amount;
    }
    totals.balance = totals.income - totals.expense;
    return res.status(200).json({
      from, to, totals, byOwner,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      byDay: Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date)),
      rows,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
