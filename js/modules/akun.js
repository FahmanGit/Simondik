import { sb } from "../supabaseClient.js";
import { SUPABASE_URL } from "../config.js";
import { $, escapeHtml, openModal, closeModal, toast } from "../ui.js";
import { logActivity } from "../auth.js";

export async function renderAkun() {
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) { $("#akun-table").innerHTML = `<p class="text-danger">${escapeHtml(error.message)}</p>`; return; }
  const rows = (data || []).map((u) => `
    <tr>
      <td class="font-medium">${escapeHtml(u.full_name || "-")}</td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td><span class="badge badge-role">${escapeHtml(u.role)}</span></td>
      <td>${u.status === "Aktif" ? '<span class="badge badge-lulus">Aktif</span>' : '<span class="badge badge-tidak">Nonaktif</span>'}</td>
      <td class="text-right whitespace-nowrap">
        <button class="ui-btn-outline h-8 px-2" data-edit-akun="${u.id}"><i class="fa-solid fa-pen"></i> Edit</button>
        <button class="ui-btn-outline h-8 px-2" data-toggle-akun="${u.id}" data-status="${u.status}">
          <i class="fa-solid ${u.status === "Aktif" ? "fa-user-slash" : "fa-user-check"}"></i>
          ${u.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </td>
    </tr>`).join("");
  $("#akun-table").innerHTML = `
    <table class="ui-table">
      <thead><tr><th>Nama Lengkap</th><th>Email</th><th>Role</th><th>Status</th><th class="text-right">Aksi</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="py-8 text-center text-muted-foreground">Belum ada akun.</td></tr>`}</tbody>
    </table>`;
  window.__akun = data || [];
}

function openAdd() {
  $("#ma-id").value = ""; $("#ma-name").value = ""; $("#ma-email").value = "";
  $("#ma-pass").value = ""; $("#ma-role").value = "User"; $("#ma-status").value = "Aktif";
  $("#ma-pass-wrap").classList.remove("hidden"); $("#ma-email").disabled = false;
  $("#ma-title").textContent = "Tambah Akun"; openModal("modal-akun");
}
function openEdit(id) {
  const u = (window.__akun || []).find((x) => x.id === id); if (!u) return;
  $("#ma-id").value = u.id; $("#ma-name").value = u.full_name || ""; $("#ma-email").value = u.email || "";
  $("#ma-role").value = u.role; $("#ma-status").value = u.status;
  $("#ma-pass-wrap").classList.add("hidden"); $("#ma-email").disabled = true;
  $("#ma-title").textContent = "Edit Akun"; openModal("modal-akun");
}

async function submitAkun() {
  const id = $("#ma-id").value;
  const full_name = $("#ma-name").value.trim();
  const role = $("#ma-role").value, status = $("#ma-status").value;
  if (!full_name) return toast("Nama lengkap wajib diisi.", "warn");

  if (id) {
    // EDIT profil (role/status/nama) — cukup lewat client, tidak menyentuh auth.users.
    const { error } = await sb.from("profiles").update({ full_name, role, status }).eq("id", id);
    if (error) return toast(error.message, "err");
    await logActivity("edit", `edit akun ${full_name} → role ${role}, ${status}`);
    closeModal("modal-akun"); toast("Akun diperbarui."); renderAkun();
    return;
  }

  // TAMBAH: lewat Edge Function (service_role) — sesi Admin yang sedang login TIDAK berpindah.
  const email = $("#ma-email").value.trim(), password = $("#ma-pass").value;
  if (!email || !password) return toast("Email dan kata sandi wajib diisi.", "warn");

  const submitBtn = $("#ma-submit");
  submitBtn.disabled = true;
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { toast("Sesi login tidak ditemukan, silakan login ulang.", "err"); return; }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, password, full_name, role, status }),
    });
    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) return toast(result.error || "Gagal membuat akun.", "err");

    await logActivity("tambah", `tambah akun ${full_name} (${email}) role ${role}`);
    closeModal("modal-akun");
    toast("Akun berhasil dibuat.");
    renderAkun();
  } catch (e) {
    toast("Gagal menghubungi server: " + (e.message || e), "err");
  } finally {
    submitBtn.disabled = false;
  }
}

async function toggleStatus(id, currentStatus) {
  const next = currentStatus === "Aktif" ? "Nonaktif" : "Aktif";
  const u = (window.__akun || []).find((x) => x.id === id);
  if (!confirm(`${next === "Nonaktif" ? "Nonaktifkan" : "Aktifkan"} akun "${u?.full_name || ""}"?`)) return;
  const { error } = await sb.from("profiles").update({ status: next }).eq("id", id);
  if (error) return toast(error.message, "err");
  await logActivity("edit", `${next === "Nonaktif" ? "nonaktifkan" : "aktifkan"} akun ${u?.full_name || id}`);
  toast(`Akun ${next === "Nonaktif" ? "dinonaktifkan" : "diaktifkan"}.`);
  renderAkun();
}

export function initAkun() {
  $("#btn-add-akun").addEventListener("click", openAdd);
  $("#ma-submit").addEventListener("click", submitAkun);
  $("#akun-table").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-akun]");
    const tg = e.target.closest("[data-toggle-akun]");
    if (ed) openEdit(ed.getAttribute("data-edit-akun"));
    if (tg) toggleStatus(tg.getAttribute("data-toggle-akun"), tg.getAttribute("data-status"));
  });
}
