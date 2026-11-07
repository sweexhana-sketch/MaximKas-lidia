import { checkCredentials, issueToken } from './_auth.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { username, pin } = req.body || {};
    const user = checkCredentials(String(username || '').toLowerCase().trim(), String(pin || ''));
    if (!user) return res.status(401).json({ error: 'Username atau PIN salah.' });
    return res.status(200).json({ token: issueToken(user), user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
