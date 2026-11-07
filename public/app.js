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
function logout() { session = null; localStorage.removeItem('session'); $('#transactions').innerHTML = ''; if (!loginDialog.open) loginDialog.showModal(); }

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
  $('#userLabel').textContent = `Masuk sebagai ${session.user.username} (${session.user.role})`;
  load();
}
const now = new Date();
$('#todayLabel').textContent = new Intl.DateTimeFormat('id-ID',{weekday:'long',day:'numeric',month:'long'}).format(now);
setForm('income');
if (session) start(); else loginDialog.showModal();
