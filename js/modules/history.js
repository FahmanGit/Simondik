import { sb } from "../supabaseClient.js";
import { $, escapeHtml } from "../ui.js";

const JENIS_BADGE = {
  login: "badge-diklat", logout: "badge-role", tambah: "badge-lulus",
  import: "badge-lulus", edit: "badge-diklat", hapus: "badge-tidak",
};

export async function renderHistory() {
  const { data, error } = await sb.from("activity_logs").select("*").order("waktu_kegiatan", { ascending: false }).limit(300);
  if (error) { $("#history-table").innerHTML = `<p class="text-danger">${escapeHtml(error.message)}</p>`; return; }
  const rows = (data || []).map((l) => `
    <tr>
      <td class="font-medium">${escapeHtml(l.user_name)}</td>
      <td>${new Date(l.waktu_kegiatan).toLocaleString("id-ID")}</td>
      <td><span class="badge ${JENIS_BADGE[l.jenis_kegiatan] || "badge-role"}">${escapeHtml((l.jenis_kegiatan || "").toUpperCase())}</span></td>
      <td>${escapeHtml(l.keterangan)}</td>
    </tr>`).join("");
  $("#history-table").innerHTML = `
    <table class="ui-table">
      <thead><tr><th>Nama User</th><th>Waktu Kegiatan</th><th>Jenis Kegiatan</th><th>Keterangan</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="py-8 text-center text-muted-foreground">Belum ada aktivitas.</td></tr>`}</tbody>
    </table>`;
}
