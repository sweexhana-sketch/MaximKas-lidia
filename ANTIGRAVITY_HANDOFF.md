# Handoff untuk Antigravity

## Menjalankan proyek saat ini

1. Buka folder proyek ini di Antigravity.
2. Pastikan runtime menggunakan Node.js 22 atau lebih baru (aplikasi memakai `node:sqlite`).
3. Jalankan `npm start`.
4. Buka `http://localhost:4173`.

Tidak ada `npm install` karena versi prototipe menggunakan modul bawaan Node.js.

## Struktur

- `public/` — tampilan aplikasi mobile.
- `server.mjs` — web server dan REST API.
- `data/maxim-finance.sqlite` — database demo lokal.
- `README.md` — ringkasan fitur dan endpoint.

## Deploy ke Vercel

Struktur Vercel sudah tersedia di folder `api/`. Buat database Postgres/Neon, lalu tambahkan variabel `DATABASE_URL` dari `.env.example` pada Vercel → Project → Settings → Environment Variables. API otomatis membuat tabel `transactions` saat pertama digunakan.

Jangan unggah database berisi transaksi asli ke GitHub. Berkas `.gitignore` sudah mengecualikan berkas SQLite.
