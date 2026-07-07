-- =====================================================================
-- E-MONDIK — Pisahkan kolom ANGKT/KELAS menjadi dua: angkatan & kelas
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- =====================================================================

alter table public.peserta add column if not exists angkatan text;
alter table public.peserta add column if not exists kelas    text;

-- Migrasi data lama: pecah "angkatan_kelas" berdasarkan pemisah '/'.
-- Contoh "ANGKATAN 33/KELAS 4B" → angkatan="ANGKATAN 33", kelas="KELAS 4B".
update public.peserta
set
  angkatan = coalesce(angkatan, nullif(trim(split_part(angkatan_kelas, '/', 1)), '')),
  kelas    = coalesce(kelas,    nullif(trim(split_part(angkatan_kelas, '/', 2)), ''))
where angkatan_kelas is not null
  and (angkatan is null or kelas is null);

create index if not exists idx_peserta_angkatan on public.peserta (angkatan);
create index if not exists idx_peserta_kelas    on public.peserta (kelas);

notify pgrst, 'reload schema';
