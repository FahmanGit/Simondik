// supabase/functions/admin-create-user/index.ts
// Membuat akun user baru memakai service_role, dipanggil dari akun.js.
// Tujuannya: menghindari bug client-side auth.signUp() yang memindahkan sesi
// login ke akun baru (lihat catatan di README.md).
//
// Deploy: supabase functions deploy admin-create-user
// (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY sudah otomatis
//  tersedia sebagai env var bawaan Edge Functions, tidak perlu diset manual)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method tidak didukung." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // 1) Verifikasi pemanggil lewat token miliknya sendiri (bukan service_role).
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: "Sesi tidak valid. Silakan login ulang." }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles").select("role").eq("id", caller.id).maybeSingle();
    if (callerProfile?.role !== "Admin") {
      return json({ error: "Hanya Admin yang boleh menambah akun." }, 403);
    }

    // 2) Validasi payload.
    const { email, password, full_name, role, status } = await req.json();
    if (!email || !password || !full_name) {
      return json({ error: "Email, kata sandi, dan nama lengkap wajib diisi." }, 400);
    }
    if (String(password).length < 6) {
      return json({ error: "Kata sandi minimal 6 karakter." }, 400);
    }

    // 3) Buat user dengan service_role — TIDAK memengaruhi sesi admin yang login.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    // 4) Trigger handle_new_user() sudah membuat baris di profiles (role default 'User').
    //    Timpa dengan role/status sesuai pilihan Admin di form.
    const { error: profErr } = await adminClient
      .from("profiles")
      .update({ full_name, role: role || "User", status: status || "Aktif" })
      .eq("id", created.user.id);
    if (profErr) return json({ error: profErr.message }, 400);

    return json({ ok: true, id: created.user.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
