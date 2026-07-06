# E-Mondik — Monitoring Peserta Diklat (Vanilla JS + Supabase)

SPA murni **HTML5 + CSS3 + Vanilla JavaScript (ES6 modules)** dengan backend **Supabase**.
Styling memakai **Tailwind (Play CDN)** + **bahasa desain shadcn** (token warna, kartu, tombol,
input) yang direplikasi sebagai CSS — karena *shadcn/ui asli adalah komponen React* dan tidak
bisa dipakai langsung di Vanilla JS. Hasil akhirnya tetap modern & profesional tanpa React.

## Struktur folder

```
e-mondik/
├─ index.html            # kerangka: sidebar, topbar, semua modul (show/hide via JS), modal
├─ css/
│  └─ app.css            # token bergaya shadcn + kelas komponen (CSS murni)
├─ js/
│  ├─ config.js          # URL & anon key Supabase  ← ISI DI SINI
│  ├─ supabaseClient.js  # inisialisasi client
│  ├─ ui.js              # helper: $, toast, modal, escapeHtml
│  ├─ auth.js            # login/logout/sesi + logActivity + role (Admin/Manajemen/User)
│  ├─ router.js          # navigasi antar-modul (tampil/sembunyi section)
│  ├─ main.js            # entry point: boot, sesi, login, visibilitas role
│  └─ modules/
│     ├─ dashboard.js    # 8 kartu, bar & pie chart (Chart.js), tabel ringkas + cari
│     ├─ peserta.js      # inti: filter, CRUD, unduh template, IMPORT (auto-tag), HAPUS (select-all)
│     ├─ history.js      # log aktivitas
│     └─ akun.js         # manajemen akun (profiles)
├─ sql/
│  └─ schema.sql         # DDL tabel + RLS (jalankan di Supabase SQL Editor)
└─ assets/               # (opsional) logo, dsb.
```

## Cara menjalankan

1. **Buat proyek Supabase** → SQL Editor → jalankan `sql/schema.sql`.
2. Buat user pertama (Authentication → Users → Add user), lalu jadikan Admin:
   `update public.profiles set role='Admin' where email='email-anda@contoh.com';`
3. Isi `js/config.js` dengan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (Settings → API).
4. Jalankan lewat server statis apa pun (perlu http, bukan file://), mis.:
   - `npx serve .`  atau  `python3 -m http.server 5173`
   - lalu buka `http://localhost:5173`.

> Deploy: cukup unggah folder ini ke hosting statis / NGINX (tanpa build step).

## Alur yang di-highlight

- **Import Data (auto-tag)** — modal berisi Jenis Diklat, Nama Diklat, Angkt/Kelas. Nilai form ini
  **menimpa** kolom terkait untuk **semua** baris Excel saat disimpan (lihat `submitImport()` di `peserta.js`).
- **Hapus Data (select-all)** — pilih Jenis Diklat → daftar Nama Diklat (checkbox) muncul → tombol
  **Pilih Semua** mencentang semua → **Hapus** menghapus peserta pada nama-diklat terpilih
  (lihat `openDelete`/`onDelJenisChange`/`submitDelete`).

## Peran (role)

- **Admin**: semua akses + Manajemen Akun.
- **Manajemen**: baca + tulis data peserta (import/hapus/edit).
- **User**: hanya baca.

RLS di `schema.sql` menegakkan ini di sisi database.

## Catatan

- Menambah akun baru dari aplikasi memakai `auth.signUp` (sisi klien) — ini bisa **memindah sesi**
  ke akun baru. Untuk produksi, buat akun lewat **Edge Function** dengan `service_role`, atau via
  Dashboard Supabase. Mengedit role/status akun yang sudah ada berjalan penuh dari aplikasi.
- Kolom `NIT/NIK` opsional (tidak ada di template Excel; bisa diisi lewat form Edit).
- Target pada bar chart masih contoh (placeholder); sambungkan ke tabel target bila diperlukan.
