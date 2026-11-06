import { timingSafeEqual } from 'node:crypto';

// Jika APP_PIN diatur, semua request API wajib menyertakan header x-app-pin yang cocok.
export function authorized(req, res) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  const given = String(req.headers['x-app-pin'] || '');
  const a = Buffer.from(given), b = Buffer.from(pin);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  res.status(401).json({ error: 'PIN salah atau belum diisi.' });
  return false;
}
