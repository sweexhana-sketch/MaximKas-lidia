import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.PORT || 4173);
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const db = new DatabaseSync(join(ROOT, 'data', 'maxim-finance.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transaction_date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK(amount > 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const total = db.prepare('SELECT COUNT(*) AS count FROM transactions').get().count;
if (total === 0) {
  const seed = db.prepare('INSERT INTO transactions (id, transaction_date, type, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)');
  [
    ['income', 'Trip Maxim', 185000, 'Pendapatan perjalanan hari ini'],
    ['income', 'Bonus', 25000, 'Bonus target harian'],
    ['expense', 'Bensin', 70000, 'Isi bahan bakar'],
    ['expense', 'Makan', 30000, 'Makan siang'],
    ['expense', 'Parkir', 5000, 'Parkir pusat kota'],
  ].forEach(([type, category, amount, note]) => seed.run(randomUUID(), today(), type, category, amount, note));
}

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Jayapura' }).format(new Date()); }
function json(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function getSummary() {
  const sums = db.prepare(`SELECT type, COALESCE(SUM(amount), 0) AS amount FROM transactions WHERE transaction_date = ? GROUP BY type`).all(today());
  const byType = Object.fromEntries(sums.map(x => [x.type, x.amount]));
  const income = byType.income || 0;
  const expense = byType.expense || 0;
  return { income, expense, balance: income - expense, transactionCount: db.prepare('SELECT COUNT(*) AS count FROM transactions WHERE transaction_date = ?').get(today()).count };
}
async function serveStatic(req, res) {
  const raw = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const name = raw.replace(/^\/+/, '');
  if (name.includes('..')) return json(res, 400, { error: 'Invalid path' });
  const file = join(PUBLIC, name);
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': `${mime}; charset=utf-8` });
    res.end(await readFile(file));
  } catch { json(res, 404, { error: 'Not found' }); }
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/transactions')) {
      return json(res, 200, db.prepare('SELECT * FROM transactions ORDER BY transaction_date DESC, created_at DESC LIMIT 100').all());
    }
    if (req.method === 'GET' && req.url === '/api/summary') return json(res, 200, getSummary());
    if (req.method === 'POST' && req.url === '/api/transactions') {
      const data = await body(req);
      const amount = Number(data.amount);
      if (!['income', 'expense'].includes(data.type) || !data.category?.trim() || !Number.isInteger(amount) || amount <= 0 || (data.transaction_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.transaction_date))) return json(res, 422, { error: 'Data transaksi belum lengkap atau nominal tidak valid.' });
      const row = { id: randomUUID(), transaction_date: data.transaction_date || today(), type: data.type, category: data.category.trim(), amount, note: (data.note || '').trim() };
      db.prepare('INSERT INTO transactions (id, transaction_date, type, category, amount, note) VALUES (?, ?, ?, ?, ?, ?)').run(row.id, row.transaction_date, row.type, row.category, row.amount, row.note);
      return json(res, 201, row);
    }
    if (req.method === 'DELETE' && req.url.startsWith('/api/transactions/')) {
      const id = req.url.split('/').pop();
      db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      return json(res, 200, { ok: true });
    }
    return serveStatic(req, res);
  } catch (error) { return json(res, 500, { error: error.message }); }
}).listen(PORT, () => console.log(`Maxim Finance running at http://localhost:${PORT}`));
