import { sb } from "../supabaseClient.js";
import { $, escapeHtml, toast } from "../ui.js";
import { canWrite, logActivity } from "../auth.js";

let barChart = null, pieChart = null, all = [], targets = {};
const PALETTE = ["#22c55e", "#f59e0b", "#8b5cf6", "#3b82f6", "#ef4444", "#ec4899", "#14b8a6", "#6366f1"];

// 8 jenis diklat tetap untuk kartu dashboard. Tiap jenis punya:
//  - label   : nama yang tampil di kartu
//  - icon    : ikon FontAwesome
//  - aliases : variasi penulisan jenis_diklat pada data peserta yang dianggap sama
const JENIS_CARDS = [
  { label: "Pembentukan",        icon: "fa-graduation-cap", aliases: ["pembentukan"] },
  { label: "Peningkatan",        icon: "fa-arrow-trend-up", aliases: ["peningkatan", "penjenjangan"] },
  { label: "Pemutakhiran",       icon: "fa-rotate",         aliases: ["pemutakhiran"] },
  { label: "Diklat Teknis",      icon: "fa-microchip",      aliases: ["diklat teknis", "teknis"] },
  { label: "Revalidasi",         icon: "fa-award",          aliases: ["revalidasi"] },
  { label: "DPM",                icon: "fa-shield-halved",  aliases: ["dpm"] },
  { label: "Diklat Kerjasama",   icon: "fa-people-group",   aliases: ["diklat kerjasama", "kerjasama", "kerjasama (non stcw)"] },
  { label: "Diklat Kepegawaian", icon: "fa-book-open",      aliases: ["diklat kepegawaian", "kepegawaian"] },
];

export async function renderDashboard() {
  const [{ data }, { data: tdata }] = await Promise.all([
    sb.from("peserta").select("*"),
    sb.from("diklat_targets").select("*"),
  ]);
  targets = {};
  (tdata || []).forEach((t) => (targets[t.jenis_diklat] = t.target));

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

// Hitung jumlah peserta untuk satu kartu (cocokkan lewat aliases).
function countFor(card) {
  return all.filter((p) => {
    const j = String(p.jenis_diklat || "").trim().toLowerCase();
    return card.aliases.includes(j);
  }).length;
}

function groupBy(arr, key) {
  const m = new Map();
  for (const x of arr) { const k = x[key] || "Lainnya"; m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

function renderCards() {
  const admin = canWrite();
  $("#dash-cards").innerHTML = JENIS_CARDS.map((card, i) => {
    const jml = countFor(card);
    const tgt = targets[card.label] ?? 0;
    const color = PALETTE[i % PALETTE.length];
    const editBtn = admin
      ? `<button class="dash-edit-target text-xs text-primary hover:underline" data-jenis="${escapeHtml(card.label)}" title="Ubah target"><i class="fa-solid fa-pen-to-square"></i></button>`
      : "";
    return `
      <div class="stat-card">
        <div class="flex items-start justify-between">
          <p class="text-sm text-muted-foreground">Total Peserta ${escapeHtml(card.label)}</p>
          <span class="stat-icon" style="background:${color}22;color:${color}"><i class="fa-solid ${card.icon}"></i></span>
        </div>
        <p class="val">${jml.toLocaleString("id-ID")} <span class="text-base font-medium text-muted-foreground">Peserta</span></p>
        <p class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Target Peserta ${escapeHtml(card.label)} = ${tgt.toLocaleString("id-ID")}</span>
          ${editBtn}
        </p>
      </div>`;
  }).join("");
}

// Edit target: klik ikon pensil → prompt angka baru → simpan ke DB.
async function editTarget(jenis) {
  const current = targets[jenis] ?? 0;
  const input = prompt(`Target peserta untuk "${jenis}":`, String(current));
  if (input === null) return; // batal
  const val = parseInt(String(input).replace(/[^\d]/g, ""), 10);
  if (isNaN(val) || val < 0) return toast("Masukkan angka yang valid.", "warn");

  const { error } = await sb
    .from("diklat_targets")
    .upsert({ jenis_diklat: jenis, target: val, updated_at: new Date().toISOString() }, { onConflict: "jenis_diklat" });
  if (error) return toast(error.message, "err");

  targets[jenis] = val;
  await logActivity("edit", `ubah target ${jenis} = ${val}`);
  toast("Target diperbarui.");
  renderCards();
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
  $("#dash-cards").addEventListener("click", (e) => {
    const btn = e.target.closest(".dash-edit-target");
    if (btn) editTarget(btn.getAttribute("data-jenis"));
  });
}
