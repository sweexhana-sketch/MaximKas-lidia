# MaximKas

Prototipe aplikasi pencatatan pemasukan dan pengeluaran untuk driver Maxim.

## Fitur versi awal

- Dashboard saldo, pemasukan, dan pengeluaran hari ini.
- Catat pemasukan (trip, bonus, tip) dan pengeluaran (bensin, makan, parkir, servis, cicilan).
- Riwayat transaksi serta penghapusan transaksi.
- API REST sederhana dan database SQLite lokal.
- Antarmuka responsif untuk layar ponsel.

## Jalankan lokal

```bash
npm start
```

Lalu buka `http://localhost:4173`.

## API

- `GET /api/summary` — ringkasan hari ini.
- `GET /api/transactions` — daftar transaksi.
- `POST /api/transactions` — tambah transaksi.
- `DELETE /api/transactions/:id` — hapus transaksi.

Database dibuat otomatis di `data/maxim-finance.sqlite`; berkas ini sengaja tidak dilacak Git karena memuat data keuangan pengguna.

## Catatan hosting

Preview OpenClaw bersifat sementara dan berakhir saat Gateway dihidupkan ulang. Untuk hosting permanen di Hostinger, sambungkan lebih dulu lewat hPanel → OpenClaw → Settings → Hostinger MCP → Connect, lalu aplikasi dapat dipindahkan ke layanan hosting/VPS yang dipilih.

## Deploy ke Vercel

Versi ini mendukung Vercel melalui fungsi di folder `api/` dan database PostgreSQL cloud.

1. Unggah proyek ke repository GitHub (jangan unggah berkas di `data/` bila berisi transaksi asli).
2. Di Vercel pilih **Add New → Project**, lalu impor repository tersebut.
3. Buat database Postgres/Neon dan salin connection string-nya.
4. Tambahkan `DATABASE_URL` di **Vercel → Project → Settings → Environment Variables**.
5. Deploy ulang. Tabel `transactions` dibuat otomatis saat API pertama kali dipanggil.

Mode lokal (`npm start`) tetap memakai SQLite; mode Vercel memakai PostgreSQL lewat `DATABASE_URL`.
