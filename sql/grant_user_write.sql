-- =====================================================================
-- E-MONDIK — Beri hak tulis (insert/update/delete) untuk role 'User'
-- pada tabel PESERTA dan DIKLAT_TARGETS, setara Admin/Manajemen.
-- Jalankan di Supabase Studio → SQL Editor.
-- =====================================================================

-- PESERTA: semua login boleh baca; Admin/Manajemen/User boleh ubah.
drop policy if exists p_peserta_write on public.peserta;
create policy p_peserta_write on public.peserta
  for all to authenticated
  using      (public.user_role() in ('Admin','Manajemen','User'))
  with check (public.user_role() in ('Admin','Manajemen','User'));

-- DIKLAT_TARGETS: target juga boleh diubah oleh User.
drop policy if exists p_targets_write on public.diklat_targets;
create policy p_targets_write on public.diklat_targets
  for all to authenticated
  using      (public.user_role() in ('Admin','Manajemen','User'))
  with check (public.user_role() in ('Admin','Manajemen','User'));

notify pgrst, 'reload schema';
