-- =====================================================================
-- E-MONDIK — Tabel MASTER DATA (Jenis Diklat & Nama Diklat)
-- Aman dijalankan berulang. Jalankan di Supabase SQL Editor.
-- =====================================================================

create table if not exists public.master_data (
  id         bigint generated always as identity primary key,
  kategori   text not null check (kategori in ('jenis_diklat','nama_diklat')),
  nilai      text not null,
  created_at timestamptz not null default now(),
  unique (kategori, nilai)
);

-- Seed jenis diklat standar (opsional; abaikan jika sudah ada).
insert into public.master_data (kategori, nilai) values
  ('jenis_diklat','Pembentukan'),
  ('jenis_diklat','Peningkatan'),
  ('jenis_diklat','Pemutakhiran'),
  ('jenis_diklat','Diklat Teknis'),
  ('jenis_diklat','Revalidasi'),
  ('jenis_diklat','DPM'),
  ('jenis_diklat','Diklat Kerjasama'),
  ('jenis_diklat','Diklat Kepegawaian')
on conflict (kategori, nilai) do nothing;

alter table public.master_data enable row level security;

drop policy if exists p_master_read on public.master_data;
create policy p_master_read on public.master_data
  for select to authenticated using (true);

drop policy if exists p_master_write on public.master_data;
create policy p_master_write on public.master_data
  for all to authenticated
  using      (public.user_role() in ('Admin','Manajemen','User'))
  with check (public.user_role() in ('Admin','Manajemen','User'));

notify pgrst, 'reload schema';
