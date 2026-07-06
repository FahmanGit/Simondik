-- =====================================================================
-- E-MONDIK — Skema Database & RLS (Supabase / PostgreSQL)
-- Manajemen Peserta Diklat — PIP Makassar
-- Jalankan di Supabase Studio → SQL Editor.
-- =====================================================================

-- ---------- PROFILES (terhubung ke auth.users) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  email      text,
  role       text not null default 'User' check (role in ('Admin','Manajemen','User')),
  status     text not null default 'Aktif' check (status in ('Aktif','Nonaktif')),
  created_at timestamptz not null default now()
);

-- ---------- PESERTA ----------
create table if not exists public.peserta (
  id             uuid primary key default gen_random_uuid(),
  nit_nik        text,
  nama_peserta   text not null,
  jenis_kelamin  text check (jenis_kelamin in ('Laki-Laki','Perempuan')),
  jenis_diklat   text not null,
  nama_diklat    text not null,
  angkatan_kelas text,
  status         text not null default 'DIKLAT' check (status in ('LULUS','DIKLAT','TIDAK LULUS')),
  created_at     timestamptz not null default now()
);
create index if not exists idx_peserta_jenis on public.peserta (jenis_diklat);
create index if not exists idx_peserta_nama_diklat on public.peserta (nama_diklat);
create index if not exists idx_peserta_status on public.peserta (status);

-- ---------- ACTIVITY LOGS (append-only) ----------
create table if not exists public.activity_logs (
  id             bigint generated always as identity primary key,
  user_name      text not null,
  waktu_kegiatan timestamptz not null default now(),
  jenis_kegiatan text not null,     -- login, logout, tambah, edit, hapus, import
  keterangan     text not null default ''
);
create index if not exists idx_logs_waktu on public.activity_logs (waktu_kegiatan desc);

-- ---------- Helper: role user aktif ----------
create or replace function public.user_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------- Buat profile otomatis saat user baru mendaftar ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), 'User')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.peserta       enable row level security;
alter table public.activity_logs enable row level security;

-- PROFILES: baca sendiri; Admin baca/kelola semua.
drop policy if exists p_profiles_read on public.profiles;
create policy p_profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.user_role() = 'Admin');

drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.user_role() = 'Admin')
  with check (id = auth.uid() or public.user_role() = 'Admin');

drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles for insert to authenticated
  with check (public.user_role() = 'Admin' or id = auth.uid());

-- PESERTA: semua login boleh baca; hanya Admin/Manajemen boleh ubah.
drop policy if exists p_peserta_read on public.peserta;
create policy p_peserta_read on public.peserta for select to authenticated using (true);

drop policy if exists p_peserta_write on public.peserta;
create policy p_peserta_write on public.peserta for all to authenticated
  using (public.user_role() in ('Admin','Manajemen'))
  with check (public.user_role() in ('Admin','Manajemen'));

-- ACTIVITY LOGS: semua login boleh baca & menambah; tak boleh ubah/hapus.
drop policy if exists p_logs_read on public.activity_logs;
create policy p_logs_read on public.activity_logs for select to authenticated using (true);

drop policy if exists p_logs_insert on public.activity_logs;
create policy p_logs_insert on public.activity_logs for insert to authenticated with check (true);

notify pgrst, 'reload schema';

-- =====================================================================
-- CATATAN:
-- 1) Buat user pertama lewat Supabase Auth (Authentication → Users → Add user),
--    lalu ubah role-nya jadi 'Admin' di tabel profiles:
--      update public.profiles set role='Admin' where email='email-anda@contoh.com';
-- 2) Ganti URL & anon key di js/config.js.
-- =====================================================================
