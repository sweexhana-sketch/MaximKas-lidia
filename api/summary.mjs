import { authorized } from './_auth.mjs';
import { ensureSchema, getSql, today } from './_db.mjs';

export default async function handler(req, res) {
  if (!authorized(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sql = getSql();
    await ensureSchema(sql);
    const [row] = await sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::int AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::int AS expense,
        COUNT(*)::int AS "transactionCount"
      FROM transactions
      WHERE transaction_date = ${today()}
    `;
    const income = row.income || 0;
    const expense = row.expense || 0;
    return res.status(200).json({ income, expense, balance: income - expense, transactionCount: row.transactionCount || 0 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
