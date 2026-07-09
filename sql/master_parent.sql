-- =====================================================================
-- E-MONDIK — Jadikan Nama Diklat sebagai TURUNAN dari Jenis Diklat
-- Menambah kolom "parent" pada master_data. Untuk baris kategori
-- 'nama_diklat', kolom parent berisi NAMA jenis diklat induknya.
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- =====================================================================

alter table public.master_data add column if not exists parent text;

-- Karena satu nama diklat kini terikat ke induknya, keunikan diubah:
-- (kategori + nilai + parent) — sehingga nama sama boleh ada di jenis berbeda
-- jika memang diperlukan, tapi tetap unik dalam satu induk.
alter table public.master_data drop constraint if exists master_data_kategori_nilai_key;
create unique index if not exists master_data_uniq
  on public.master_data (kategori, nilai, coalesce(parent, ''));

notify pgrst, 'reload schema';
