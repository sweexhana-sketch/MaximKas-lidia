const rupiah = value => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const formatDate = date => new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${String(date).slice(0,10)}T00:00:00`));
const $ = s => document.querySelector(s);
const dialog = $('#entryDialog');
const loginDialog = $('#loginDialog');
const categories = {income:['Trip Maxim','Bonus','Tip pelanggan','Lainnya'],expense:['Bensin','Makan','Parkir','Servis kendaraan','Cicilan','Lainnya']};
let activeType = 'income';
let session = JSON.parse(localStorage.getItem('session') || 'null');

const _fetch = window.fetch.bind(window);
async function api(url, opts = {}) {
  const res = await _fetch(url, {...opts, headers: {...(opts.headers || {}), authorization: `Bearer ${session?.token || ''}`}});
  if (res.status === 401 && !url.includes('/api/login')) { logout(); throw new Error('Sesi berakhir, silakan login.'); }
  return res;
}
function logout() { session = null; document.body.classList.add('locked'); $('#ownerSummary').hidden = true; ['#balance','#income','#expense'].forEach(s => $(s).textContent = 'Rp0'); localStorage.removeItem('session'); $('#transactions').innerHTML = ''; if (!loginDialog.open) loginDialog.showModal(); }

const nowDate = () => new Intl.DateTimeFormat('en-CA').format(new Date());
const nowTime = () => new Date().toTimeString().slice(0,5);

function setForm(type) {
  activeType = type;
  $('#type').value = type;
  $('#formKicker').textContent = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  $('#formTitle').textContent = type === 'income' ? 'Catat uang masuk' : 'Catat uang keluar';
  $('#category').innerHTML = categories[type].map(x => `<option>${x}</option>`).join('');
  document.querySelector('.submit').style.background = type === 'income' ? 'var(--green)' : '#dc7f25';
}
function openForm(type) {
  setForm(type);
  $('#date').value = nowDate(); $('#time').value = nowTime();
  $('#lat').value = ''; $('#lng').value = ''; $('#gpsStatus').textContent = '';
  dialog.showModal();
}

async function load() {
  if (!session) return;
  try {
    const [summary, items] = await Promise.all([api('/api/summary').then(r => r.json()), api('/api/transactions').then(r => r.json())]);
    if (summary.error || !Array.isArray(items)) throw new Error(summary.error || items.error);
    $('#balance').textContent = rupiah(summary.balance);
    $('#income').textContent = rupiah(summary.income);
    $('#expense').textContent = rupiah(summary.expense);
    $('#count').textContent = `${summary.transactionCount} transaksi hari ini`;
    const box = $('#ownerSummary');
    if (session.user.role === 'admin') {
      box.hidden = false;
      box.innerHTML = Object.entries(summary.byOwner || {}).map(([o, v]) => `<div><b>${o}</b> · masuk ${rupiah(v.income)} · keluar ${rupiah(v.expense)} · saldo ${rupiah(v.balance)}</div>`).join('') || 'Belum ada transaksi hari ini.';
    } else box.hidden = true;
    render(items);
    if (session.user.role === 'admin') loadReport();
  } catch (err) { $('#count').textContent = 'Gagal memuat data: ' + err.message; }
}

function render(items) {
  const list = $('#transactions'), tpl = $('#transactionTemplate');
  list.innerHTML = '';
  if (!items.length) { list.innerHTML = '<p style="padding:18px;color:#6d7679;text-align:center">Belum ada transaksi.</p>'; return; }
  items.forEach(item => {
    const node = tpl.content.cloneNode(true);
    node.querySelector('article').classList.add(item.type);
    const title = node.querySelector('.transaction-info b');
    title.textContent = item.category;
    if (session.user.role === 'admin') { const b = document.createElement('span'); b.className = 'badge'; b.textContent = item.owner; title.append(b); }
    const info = node.querySelector('.transaction-info span');
    const time = item.transaction_time ? item.transaction_time.slice(0,5) : '';
    info.textContent = `${formatDate(item.transaction_date)}${time ? ` · ${time}` : ''}${item.note ? ` · ${item.note}` : ''}`;
    if (item.location || item.latitude != null) {
      const div = document.createElement('div');
      div.textContent = '?? ';
      if (item.latitude != null) {
        const a = document.createElement('a'); a.target = '_blank'; a.rel = 'noopener';
        a.href = `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
        a.textContent = item.location || `${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`;
        div.append(a);
      } else div.append(item.location);
      node.querySelector('.transaction-info').append(div);
    }
    node.querySelector('.transaction-amount strong').textContent = `${item.type === 'income' ? '+' : '-'}${rupiah(item.amount)}`;
    node.querySelector('button').onclick = async () => { if (confirm('Hapus transaksi ini?')) { await api(`/api/transactions/${item.id}`, {method:'DELETE'}); load(); } };
    list.append(node);
  });
}

$('#gpsBtn').onclick = () => {
  const status = $('#gpsStatus');
  if (!navigator.geolocation) { status.textContent = 'Perangkat tidak mendukung GPS.'; return; }
  status.textContent = 'Mencari lokasi…';
  navigator.geolocation.getCurrentPosition(pos => {
    $('#lat').value = pos.coords.latitude; $('#lng').value = pos.coords.longitude;
    status.textContent = `Lokasi terkunci (±${Math.round(pos.coords.accuracy)} m): ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
  }, err => { status.textContent = 'Gagal ambil lokasi: ' + err.message; }, {enableHighAccuracy: true, timeout: 15000});
};

document.querySelectorAll('[data-type]').forEach(button => button.onclick = () => openForm(button.dataset.type));
document.querySelector('nav a[href="#form"]').onclick = e => { e.preventDefault(); openForm('income'); };
$('#logoutBtn').onclick = logout;

$('#entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {type: activeType, transaction_date: $('#date').value, transaction_time: $('#time').value, category: $('#category').value, amount: $('#amount').value, note: $('#note').value, location: $('#location').value, latitude: $('#lat').value, longitude: $('#lng').value};
  const res = await api('/api/transactions', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload)});
  if (!res.ok) return alert((await res.json()).error);
  dialog.close(); e.target.reset(); load();
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginError').textContent = '';
  const res = await _fetch('/api/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username: $('#loginUser').value, pin: $('#loginPin').value})});
  const data = await res.json();
  if (!res.ok) { $('#loginError').textContent = data.error; return; }
  session = data; localStorage.setItem('session', JSON.stringify(data));
  $('#loginPin').value = ''; loginDialog.close(); start();
});
loginDialog.addEventListener('cancel', e => e.preventDefault());

function start() {
  document.body.classList.remove('locked');
  $('#adminDash').hidden = session.user.role !== 'admin';
  $('#userLabel').textContent = `Masuk sebagai ${session.user.username} (${session.user.role})`;
  load();
}
const now = new Date();
$('#todayLabel').textContent = new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(now);
setForm('income');
if (session) start(); else loginDialog.showModal();

// ---- Dashboard admin ----
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let lastReport = null;
function reportQuery() {
  const p = new URLSearchParams();
  [['from','#fFrom'],['to','#fTo'],['owner','#fOwner'],['type','#fType']].forEach(([k, s]) => { if ($(s).value) p.set(k, $(s).value); });
  return p.toString();
}
async function loadReport() {
  try {
    const res = await api('/api/report?' + reportQuery());
    const r = await res.json();
    if (!res.ok) throw new Error(r.error);
    lastReport = r;
    if (!$('#fFrom').value) $('#fFrom').value = r.from;
    if (!$('#fTo').value) $('#fTo').value = r.to;
    $('#reportCards').innerHTML =
      `<div class="rc in"><small>Pemasukan</small><b>${rupiah(r.totals.income)}</b></div>` +
      `<div class="rc out"><small>Pengeluaran</small><b>${rupiah(r.totals.expense)}</b></div>` +
      `<div class="rc"><small>Saldo bersih</small><b>${rupiah(r.totals.balance)}</b></div>` +
      `<div class="rc"><small>Jumlah transaksi</small><b>${r.totals.count}</b></div>`;
    const owners = Object.entries(r.byOwner).map(([o, v]) => `<tr><td>${esc(o)}</td><td class="n">${rupiah(v.income)}</td><td class="n">${rupiah(v.expense)}</td><td class="n">${v.count}</td></tr>`).join('');
    const cats = r.byCategory.map(c => `<tr><td>${esc(c.category)}</td><td>${c.type === 'income' ? 'Masuk' : 'Keluar'}</td><td class="n">${rupiah(c.total)}</td><td class="n">${c.count}</td></tr>`).join('');
    const days = r.byDay.map(d => `<tr><td>${formatDate(d.date)}</td><td class="n">${rupiah(d.income)}</td><td class="n">${rupiah(d.expense)}</td><td class="n">${rupiah(d.income - d.expense)}</td></tr>`).join('');
    const all = r.rows.map(t => {
      const map = t.latitude != null ? `<a href="https://www.google.com/maps?q=${t.latitude},${t.longitude}" target="_blank" rel="noopener">${esc(t.location || 'Peta')}</a>` : esc(t.location);
      return `<tr><td>${formatDate(t.transaction_date)}</td><td>${esc((t.transaction_time || '').slice(0,5))}</td><td>${esc(t.owner)}</td><td>${esc(t.category)}</td><td class="n">${t.type === 'income' ? '+' : '-'}${rupiah(t.amount)}</td><td>${map}</td><td>${esc(t.note)}</td></tr>`;
    }).join('');
    const empty = '<tr><td colspan="7">Tidak ada data.</td></tr>';
    $('#reportTables').innerHTML =
      `<table class="rtable"><caption>Per akun</caption><tr><th>Akun</th><th class="n">Masuk</th><th class="n">Keluar</th><th class="n">Trx</th></tr>${owners || empty}</table>` +
      `<table class="rtable"><caption>Per kategori</caption><tr><th>Kategori</th><th>Jenis</th><th class="n">Total</th><th class="n">Trx</th></tr>${cats || empty}</table>` +
      `<table class="rtable"><caption>Per hari</caption><tr><th>Tanggal</th><th class="n">Masuk</th><th class="n">Keluar</th><th class="n">Bersih</th></tr>${days || empty}</table>` +
      `<div class="tscroll"><table class="rtable"><caption>Semua transaksi</caption><tr><th>Tanggal</th><th>Jam</th><th>Akun</th><th>Kategori</th><th class="n">Nominal</th><th>Lokasi</th><th>Catatan</th></tr>${all || empty}</table></div>`;
  } catch (err) { $('#reportCards').textContent = 'Gagal memuat laporan: ' + err.message; }
}
$('#reportFilter').addEventListener('submit', e => { e.preventDefault(); loadReport(); });
$('#csvBtn').onclick = () => {
  if (!lastReport) return;
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Tanggal','Jam','Akun','Jenis','Kategori','Nominal','Lokasi','Latitude','Longitude','Catatan'].join(',')]
    .concat(lastReport.rows.map(t => [t.transaction_date, (t.transaction_time || '').slice(0,5), t.owner, t.type, t.category, t.amount, t.location, t.latitude, t.longitude, t.note].map(cell).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], {type: 'text/csv;charset=utf-8'}));
  a.download = `maximkas-${lastReport.from}_${lastReport.to}.csv`;
  a.click();
};