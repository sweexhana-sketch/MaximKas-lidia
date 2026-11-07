import { authenticate } from './_auth.mjs';
import { ensureSchema, getSql, today } from './_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = authenticate(req, res);
  if (!user) return;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const rows = await sql`
      SELECT owner, type, COALESCE(SUM(amount), 0)::int AS total, COUNT(*)::int AS count
      FROM transactions
      WHERE transaction_date = ${today()} AND (${user.role === 'admin'} OR owner = ${user.username})
      GROUP BY owner, type
    `;
    const byOwner = {};
    let income = 0, expense = 0, transactionCount = 0;
    for (const r of rows) {
      const o = (byOwner[r.owner] ||= { income: 0, expense: 0, count: 0 });
      o[r.type] = r.total;
      o.count += r.count;
      if (r.type === 'income') income += r.total; else expense += r.total;
      transactionCount += r.count;
    }
    for (const o of Object.values(byOwner)) o.balance = o.income - o.expense;
    return res.status(200).json({ income, expense, balance: income - expense, transactionCount, byOwner });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
