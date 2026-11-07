import { randomUUID } from 'node:crypto';
import { authenticate } from '../_auth.mjs';
import { ensureSchema, getSql, nowTime, today } from '../_db.mjs';

const num = v => (v === null || v === undefined || v === '' ? null : Number(v));

export default async function handler(req, res) {
  const user = authenticate(req, res);
  if (!user) return;
  try {
    const sql = getSql();
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, transaction_date::text AS transaction_date, transaction_time::text AS transaction_time,
               type, category, amount, note, location, latitude, longitude, owner, created_at
        FROM transactions
        WHERE ${user.role === 'admin'} OR owner = ${user.username}
        ORDER BY transaction_date DESC, transaction_time DESC NULLS LAST, created_at DESC LIMIT 100`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { type, category, amount: rawAmount, note = '', transaction_date: rawDate, transaction_time: rawTime, location = '', latitude, longitude } = req.body || {};
      const amount = Number(rawAmount);
      const lat = num(latitude), lng = num(longitude);
      const validDate = !rawDate || /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
      const validTime = !rawTime || /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime);
      const validGeo = (lat === null && lng === null) || (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
      if (!['income', 'expense'].includes(type) || !category?.trim() || !Number.isInteger(amount) || amount <= 0 || !validDate || !validTime || !validGeo) {
        return res.status(422).json({ error: 'Data transaksi belum lengkap atau tidak valid.' });
      }
      const row = {
        id: randomUUID(), transaction_date: rawDate || today(), transaction_time: rawTime || nowTime(), type,
        category: category.trim(), amount, note: String(note).trim(), location: String(location).trim().slice(0, 200),
        latitude: lat, longitude: lng, owner: user.username,
      };
      await sql`INSERT INTO transactions (id, transaction_date, transaction_time, type, category, amount, note, location, latitude, longitude, owner)
        VALUES (${row.id}, ${row.transaction_date}, ${row.transaction_time}, ${row.type}, ${row.category}, ${row.amount}, ${row.note}, ${row.location}, ${row.latitude}, ${row.longitude}, ${row.owner})`;
      return res.status(201).json(row);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
