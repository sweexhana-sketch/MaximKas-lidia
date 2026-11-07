import { authenticate } from '../_auth.mjs';
import { ensureSchema, getSql } from '../_db.mjs';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const user = authenticate(req, res);
  if (!user) return;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    await sql`DELETE FROM transactions WHERE id = ${req.query.id} AND (${user.role === 'admin'} OR owner = ${user.username})`;
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
