-- =====================================================================
-- E-MONDIK — Tabel TARGET per Jenis Diklat (untuk kartu dashboard)
-- Jalankan di Supabase Studio → SQL Editor.
-- =====================================================================

create table if not exists public.diklat_targets (
  jenis_diklat text primary key,
  target       integer not null default 0,
  updated_at   timestamptz not null default now()
);

-- Seed 8 jenis diklat (target awal = 0, silakan ubah lewat aplikasi).
insert into public.diklat_targets (jenis_diklat, target) values
  ('Pembentukan', 0),
  ('Peningkatan', 0),
  ('Pemutakhiran', 0),
  ('Diklat Teknis', 0),
  ('Revalidasi', 0),
  ('DPM', 0),
  ('Diklat Kerjasama', 0),
  ('Diklat Kepegawaian', 0)
on conflict (jenis_diklat) do nothing;

-- ---------- RLS ----------
alter table public.diklat_targets enable row level security;

-- Semua yang login boleh baca.
drop policy if exists p_targets_read on public.diklat_targets;
create policy p_targets_read on public.diklat_targets
  for select to authenticated using (true);

-- Hanya Admin/Manajemen boleh ubah target.
drop policy if exists p_targets_write on public.diklat_targets;
create policy p_targets_write on public.diklat_targets
  for all to authenticated
  using (public.user_role() in ('Admin','Manajemen'))
  with check (public.user_role() in ('Admin','Manajemen'));

notify pgrst, 'reload schema';
