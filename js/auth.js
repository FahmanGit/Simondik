import { sb } from "./supabaseClient.js";
export let me = null;

export async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await loadProfile();
  if (me?.status === "Nonaktif") {
    await sb.auth.signOut();
    me = null;
    throw new Error("Akun Anda telah dinonaktifkan. Hubungi Admin.");
  }
  await logActivity("login", `${me?.full_name || email} masuk ke aplikasi`);
}
export async function logout() {
  if (me) await logActivity("logout", `${me.full_name} keluar dari aplikasi`);
  await sb.auth.signOut(); me = null;
}
export async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { me = null; return null; }
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  me = data || { id: user.id, full_name: user.email, email: user.email, role: "User", status: "Aktif" };
  return me;
}
export function isAdmin()  { return me?.role === "Admin"; }
export function canWrite() { return me?.role === "Admin" || me?.role === "Manajemen"; }
export async function logActivity(jenis, keterangan) {
  try {
    await sb.from("activity_logs").insert({ user_name: me?.full_name || "sistem", jenis_kegiatan: jenis, keterangan });
  } catch {}
}
