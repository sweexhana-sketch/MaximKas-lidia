import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET belum diatur di Vercel Environment Variables.');
  return s;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

const sign = payload => createHmac('sha256', secret()).update(payload).digest('base64url');

// Akun: admin dan driver. PIN dibaca dari env (ADMIN_PIN, DRIVER_PIN), tidak disimpan di database.
export function checkCredentials(username, pin) {
  const accounts = { admin: process.env.ADMIN_PIN, driver: process.env.DRIVER_PIN };
  const expected = accounts[username];
  if (!expected || !safeEqual(pin ?? '', expected)) return null;
  return { username, role: username };
}

export function issueToken(user) {
  const payload = Buffer.from(JSON.stringify({ u: user.username, r: user.role, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// Mengembalikan { username, role } atau mengirim 401 dan mengembalikan null.
export function authenticate(req, res) {
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const [payload, sig] = token.split('.');
    if (payload && sig && safeEqual(sig, sign(payload))) {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (data.exp > Date.now() && ['admin', 'driver'].includes(data.r)) return { username: data.u, role: data.r };
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    return null;
  }
  res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  return null;
}
