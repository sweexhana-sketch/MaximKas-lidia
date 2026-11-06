import { ensureSchema, getSql } from '../_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const sql = getSql();
    await ensureSchema(sql);
    await sql`DELETE FROM transactions WHERE id = ${req.query.id}`;
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
