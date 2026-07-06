import { sb } from "../supabaseClient.js";
import { $, escapeHtml } from "../ui.js";

let barChart = null, pieChart = null, all = [];
const PALETTE = ["#22c55e", "#f59e0b", "#8b5cf6", "#3b82f6", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];

const ICONS = {
  Pembentukan: "fa-graduation-cap", Peningkatan: "fa-arrow-trend-up", Pemutakhiran: "fa-rotate",
  "Diklat Teknis": "fa-microchip", Revalidasi: "fa-award", DPM: "fa-shield-halved",
  "Diklat Kerjasama": "fa-people-group", "Diklat Kepegawaian": "fa-book-open",
};

export async function renderDashboard() {
  const { data } = await sb.from("peserta").select("*");
  const tahun = $("#filter-tahun")?.value;
  const bulan = $("#filter-bulan")?.value; // "" = semua
  all = (data || []).filter((p) => {
    const d = new Date(p.created_at);
    if (tahun && String(d.getFullYear()) !== String(tahun)) return false;
    if (bulan && String(d.getMonth() + 1) !== String(bulan)) return false;
    return true;
  });
  renderCards();
  renderBar();
  renderPie();
  renderQuick("");
}

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = x[key] || "Lainnya"; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

function renderCards() {
  const g = groupBy(all, "jenis_diklat");
  const entries = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  $("#dash-cards").innerHTML = entries.map(([nama, jml], i) => {
    const icon = ICONS[nama] || "fa-users";
    return `
      <div class="stat-card">
        <div class="flex items-start justify-between">
          <p class="text-sm text-muted-foreground">Total Peserta ${escapeHtml(nama)}</p>
          <span class="stat-icon" style="background:${PALETTE[i % PALETTE.length]}22;color:${PALETTE[i % PALETTE.length]}"><i class="fa-solid ${icon}"></i></span>
        </div>
        <p class="val">${jml.toLocaleString("id-ID")} <span class="text-base font-medium text-muted-foreground">Peserta</span></p>
      </div>`;
  }).join("") || `<p class="text-muted-foreground">Belum ada data peserta.</p>`;
}

function renderBar() {
  // Realisasi per bulan (dari created_at) vs target contoh (placeholder).
  const real = Array(12).fill(0);
  for (const p of all) { const m = new Date(p.created_at).getMonth(); if (m >= 0 && m < 12) real[m]++; }
  const target = real.map((v, i) => Math.max(v, Math.round((i + 1) * (all.length / 12) * 1.2))); // contoh
  const labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  barChart?.destroy();
  barChart = new Chart($("#chart-bar"), {
    type: "bar",
    data: { labels, datasets: [
      { label: "Realisasi per Bulan", data: real, backgroundColor: "#22c55e" },
      { label: "Target per Bulan", data: target, backgroundColor: "#3b82f6" },
    ] },
    options: { responsive: true, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } },
  });
}

function renderPie() {
  const g = groupBy(all, "jenis_diklat");
  const labels = [...g.keys()], data = [...g.values()];
  pieChart?.destroy();
  pieChart = new Chart($("#chart-pie"), {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]) }] },
    options: { responsive: true, cutout: "62%", plugins: { legend: { position: "bottom" } } },
  });
}

function renderQuick(q) {
  const term = q.trim().toLowerCase();
  const rows = all
    .filter((p) => !term || (p.nama_peserta || "").toLowerCase().includes(term) || (p.nit_nik || "").toLowerCase().includes(term))
    .slice(0, 12);
  const badge = (s) => s === "LULUS" ? '<span class="badge badge-lulus">LULUS</span>'
    : s === "TIDAK LULUS" ? '<span class="badge badge-tidak">TIDAK LULUS</span>' : '<span class="badge badge-diklat">DIKLAT</span>';
  $("#dash-table").innerHTML = `
    <table class="ui-table">
      <thead><tr><th>NIT/NIK</th><th>Nama Peserta</th><th>Nama Diklat</th><th>Angk/Kelas</th><th>Status</th><th>Jenis Kelamin</th></tr></thead>
      <tbody>${rows.map((p) => `<tr>
        <td>${escapeHtml(p.nit_nik || "-")}</td><td class="font-medium">${escapeHtml(p.nama_peserta)}</td>
        <td>${escapeHtml(p.nama_diklat)}</td><td>${escapeHtml(p.angkatan_kelas || "-")}</td>
        <td>${badge(p.status)}</td><td>${escapeHtml(p.jenis_kelamin || "-")}</td></tr>`).join("")
        || `<tr><td colspan="6" class="py-8 text-center text-muted-foreground">Belum ada data.</td></tr>`}</tbody>
    </table>`;
}

export function initDashboard() {
  $("#dash-search").addEventListener("input", (e) => renderQuick(e.target.value));
}
