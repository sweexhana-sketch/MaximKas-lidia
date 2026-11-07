// Kirim notifikasi ke Telegram. Aman dipanggil tanpa konfigurasi (tidak melakukan apa-apa) dan tidak pernah melempar error.
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');

export async function notifyTelegram(tx) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const income = tx.type === 'income';
  const lines = [
    `${income ? '?? <b>Pemasukan</b>' : '?? <b>Pengeluaran</b>'} dari <b>${esc(tx.owner)}</b>`,
    `${esc(tx.category)}: <b>${rupiah(tx.amount)}</b>`,
    `?? ${esc(tx.transaction_date)} ${esc(String(tx.transaction_time).slice(0, 5))}`,
  ];
  if (tx.latitude != null) lines.push(`?? <a href="https://www.google.com/maps?q=${tx.latitude},${tx.longitude}">${esc(tx.location || 'Lihat di peta')}</a>`);
  else if (tx.location) lines.push(`?? ${esc(tx.location)}`);
  if (tx.note) lines.push(`?? ${esc(tx.note)}`);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* notifikasi gagal tidak boleh menggagalkan transaksi */ }
}
