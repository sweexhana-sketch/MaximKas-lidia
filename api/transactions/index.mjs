import { randomUUID } from 'node:crypto';
import { ensureSchema, getSql, today } from '../_db.mjs';

export default async function handler(req, res) {
  try {
    const sql = getSql();
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 100`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { type, category, amount: rawAmount, note = '', transaction_date: rawDate } = req.body || {};
      const amount = Number(rawAmount);
      if (!['income', 'expense'].includes(type) || !category?.trim() || !Number.isInteger(amount) || amount <= 0 || (rawDate && !/^\d{4}-\d{2}-\d{2}$/.test(rawDate))) {
        return res.status(422).json({ error: 'Data transaksi belum lengkap atau nominal tidak valid.' });
      }
      const row = { id: randomUUID(), transaction_date: rawDate || today(), type, category: category.trim(), amount, note: note.trim() };
      await sql`INSERT INTO transactions (id, transaction_date, type, category, amount, note)
        VALUES (${row.id}, ${row.transaction_date}, ${row.type}, ${row.category}, ${row.amount}, ${row.note})`;
      return res.status(201).json(row);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
