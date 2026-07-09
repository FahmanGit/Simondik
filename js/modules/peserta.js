import { sb } from "../supabaseClient.js";
import { $, $$, escapeHtml, openModal, closeModal, toast } from "../ui.js";
import { canWrite, logActivity } from "../auth.js";
import { getMasterTree } from "./master.js";

const TEMPLATE_HEADERS = ["NIT/NIK", "JENIS DIKLAT", "NAMA PESERTA", "NAMA DIKLAT", "ANGKATAN", "KELAS", "STATUS", "JENIS KELAMIN"];
let cache = []; // seluruh peserta (untuk isi filter)
let pPage = 1, pSize = 25; // pagination modul peserta

// Ambil angkatan/kelas dengan fallback ke kolom lama "angkatan_kelas" (dipecah dengan '/').
function getAngkatan(p) {
  if (p.angkatan) return p.angkatan;
  const s = String(p.angkatan_kelas || "");
  return s.includes("/") ? s.split("/")[0].trim() : s.trim();
}
function getKelas(p) {
  if (p.kelas) return p.kelas;
  const s = String(p.angkatan_kelas || "");
  return s.includes("/") ? s.split("/").slice(1).join("/").trim() : "";
}

const badge = (s) =>
  s === "LULUS" ? '<span class="badge badge-lulus">LULUS</span>'
  : s === "TIDAK LULUS" ? '<span class="badge badge-tidak">TIDAK LULUS</span>'
  : '<span class="badge badge-diklat">DIKLAT</span>';

function normStatus(v) {
  const t = String(v || "").trim().toUpperCase();
  if (t.startsWith("LULUS")) return "LULUS";
  if (t.includes("TIDAK") || t.startsWith("TDK") || t.includes("TIDAK LULUS")) return "TIDAK LULUS";
  return "DIKLAT";
}
function normJK(v) {
  const t = String(v || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return t.startsWith("perempuan") || t === "p" || t === "wanita" ? "Perempuan" : "Laki-Laki";
}
function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort(); }

// ---------------------------------------------------------------- render
export async function renderPeserta() {
  const { data, error } = await sb.from("peserta").select("*").order("created_at", { ascending: false });
  if (error) { toast(error.message, "err"); return; }
  cache = data || [];
  renderCards();
  fillFilters();
  renderTable();
}

function renderCards() {
  const c = (st) => cache.filter((p) => p.status === st).length;
  const card = (label, val, cls) => `
    <div class="ui-card p-5">
      <p class="text-sm text-muted-foreground">${label}</p>
      <p class="mt-1 text-3xl font-bold ${cls}">${val}</p>
      <p class="text-xs text-muted-foreground">Peserta</p>
    </div>`;
  $("#peserta-cards").innerHTML =
    card("Peserta LULUS", c("LULUS"), "text-success") +
    card("Peserta DIKLAT", c("DIKLAT"), "text-primary") +
    card("Peserta TIDAK LULUS", c("TIDAK LULUS"), "text-danger");
}

function fillFilters() {
  const set = (id, values, first) => {
    const el = $(id); const cur = el.value;
    el.innerHTML = `<option value="">${first}</option>` + values.map((v) => `<option>${escapeHtml(v)}</option>`).join("");
    el.value = values.includes(cur) ? cur : "";
  };
  set("#f-jenis", uniq(cache.map((p) => p.jenis_diklat)), "Semua Diklat");
  fillNamaByJenis();
  set("#f-angk", uniq(cache.map(getAngkatan)), "Semua Angkatan");
  set("#f-kelas", uniq(cache.map(getKelas)), "Semua Kelas");
}

// Isi dropdown Nama Diklat sesuai Jenis Diklat yang dipilih (turunannya saja).
function fillNamaByJenis() {
  const jenis = $("#f-jenis").value;
  const el = $("#f-nama"); const cur = el.value;
  const src = jenis ? cache.filter((p) => p.jenis_diklat === jenis) : cache;
  const values = uniq(src.map((p) => p.nama_diklat));
  el.innerHTML = `<option value="">Semua Nama</option>` + values.map((v) => `<option>${escapeHtml(v)}</option>`).join("");
  el.value = values.includes(cur) ? cur : "";
}

function filtered() {
  const jenis = $("#f-jenis").value, nama = $("#f-nama").value,
        angk = $("#f-angk").value, kelas = $("#f-kelas").value,
        status = $("#f-status").value, jk = $("#f-jk").value;
  return cache.filter((p) =>
    (!jenis || p.jenis_diklat === jenis) &&
    (!nama || p.nama_diklat === nama) &&
    (!angk || getAngkatan(p) === angk) &&
    (!kelas || getKelas(p) === kelas) &&
    (!status || p.status === status) &&
    (!jk || p.jenis_kelamin === jk));
}

// Bangun HTML kontrol halaman (dipakai bersama oleh peserta & dashboard).
export function buildPager(total, page, size) {
  const pages = Math.max(1, Math.ceil(total / size));
  page = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  // rentang tombol: maksimal 5 nomor di sekitar halaman aktif
  let start = Math.max(1, page - 2), end = Math.min(pages, start + 4);
  start = Math.max(1, end - 4);
  const btn = (p, label = p, dis = false, active = false) =>
    `<button class="ui-btn-outline h-8 px-3 ${active ? "!bg-primary !text-white !border-transparent" : ""}" ${dis ? "disabled" : ""} data-page="${p}">${label}</button>`;
  let nums = "";
  for (let i = start; i <= end; i++) nums += btn(i, i, false, i === page);
  return {
    page,
    summary: `Menampilkan ${from.toLocaleString("id-ID")}–${to.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} data`,
    controls: `
      ${btn(page - 1, "<i class='fa-solid fa-chevron-left'></i>", page <= 1)}
      ${nums}
      ${btn(page + 1, "<i class='fa-solid fa-chevron-right'></i>", page >= pages)}`,
  };
}

function renderTable() {
  const all = filtered();
  const pg = buildPager(all.length, pPage, pSize);
  pPage = pg.page;
  const rows = all.slice((pPage - 1) * pSize, pPage * pSize);
  const admin = canWrite();
  const cb = (id) => admin ? `<td class="w-8"><input type="checkbox" class="row-cb" data-cb="${id}" ${selected.has(String(id)) ? "checked" : ""} /></td>` : "";
  const body = rows.map((p) => `
    <tr data-row="${p.id}" class="cursor-pointer">
      ${cb(p.id)}
      <td>${escapeHtml(p.nit_nik || "-")}</td>
      <td class="font-medium">${escapeHtml(p.nama_peserta)}</td>
      <td>${escapeHtml(p.nama_diklat)}</td>
      <td>${escapeHtml(getAngkatan(p) || "-")}</td>
      <td>${escapeHtml(getKelas(p) || "-")}</td>
      <td>${badge(p.status)}</td>
      <td>${escapeHtml(p.jenis_kelamin || "-")}</td>
      ${admin ? `<td class="text-right whitespace-nowrap">
        <button class="ui-btn-outline h-8 px-2" data-edit="${p.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="ui-btn-danger h-8 px-2" data-del="${p.id}"><i class="fa-solid fa-trash"></i></button>
      </td>` : ""}
    </tr>`).join("");
  const allChecked = rows.length && rows.every((p) => selected.has(String(p.id)));
  $("#peserta-table").innerHTML = `
    <table class="ui-table">
      <thead><tr>
        ${admin ? `<th class="w-8"><input type="checkbox" id="cb-all" ${allChecked ? "checked" : ""} /></th>` : ""}
        <th>NIT/NIK</th><th>Nama Peserta</th><th>Nama Diklat</th><th>Angkatan</th><th>Kelas</th>
        <th>Status</th><th>Jenis Kelamin</th>${admin ? "<th class='text-right'>Aksi</th>" : ""}
      </tr></thead>
      <tbody>${body || `<tr><td colspan="9" class="py-8 text-center text-muted-foreground">Belum ada data.</td></tr>`}</tbody>
    </table>`;
  // ringkasan + kontrol halaman
  const sumEl = $("#p-summary"); if (sumEl) sumEl.textContent = pg.summary;
  const pagerEl = $("#p-pager"); if (pagerEl) pagerEl.innerHTML = pg.controls;
  updateBulkBar();
}

// ---------------------------------------------------------------- seleksi & aksi massal
const selected = new Set();

function updateBulkBar() {
  const bar = $("#bulk-bar"); if (!bar) return;
  if (selected.size > 0) {
    bar.classList.remove("hidden");
    bar.classList.add("flex");
    $("#bulk-count").textContent = `${selected.size} peserta terpilih`;
  } else {
    bar.classList.add("hidden");
    bar.classList.remove("flex");
  }
}

async function bulkDelete() {
  if (selected.size === 0) return;
  if (!confirm(`Hapus ${selected.size} peserta terpilih? Tindakan ini permanen.`)) return;
  const ids = [...selected];
  const { error } = await sb.from("peserta").delete().in("id", ids);
  if (error) return toast(error.message, "err");
  await logActivity("hapus", `hapus massal ${ids.length} peserta`);
  selected.clear();
  toast(`${ids.length} peserta dihapus.`);
  renderPeserta();
}

async function bulkApplyStatus() {
  const status = $("#bulk-status").value;
  const ids = [...selected];
  if (!ids.length) return;
  const { error } = await sb.from("peserta").update({ status }).in("id", ids);
  if (error) return toast(error.message, "err");
  await logActivity("edit", `ubah status massal ${ids.length} peserta → ${status}`);
  closeModal("modal-bulk");
  selected.clear();
  toast(`Status ${ids.length} peserta diperbarui.`);
  renderPeserta();
}

function showDetail(id) {
  const p = cache.find((x) => String(x.id) === String(id));
  if (!p) return;
  const row = (label, val) => `<div class="flex justify-between gap-4 border-b border-border py-1.5"><span class="text-muted-foreground">${label}</span><span class="text-right font-medium">${escapeHtml(val || "-")}</span></div>`;
  $("#detail-body").innerHTML =
    row("NIT/NIK", p.nit_nik) + row("Nama Peserta", p.nama_peserta) + row("Jenis Diklat", p.jenis_diklat) +
    row("Nama Diklat", p.nama_diklat) + row("Angkatan", getAngkatan(p)) + row("Kelas", getKelas(p)) +
    row("Status", p.status) + row("Jenis Kelamin", p.jenis_kelamin) +
    row("Tanggal Input", p.created_at ? new Date(p.created_at).toLocaleString("id-ID") : "-");
  openModal("modal-detail");
}

// ---------------------------------------------------------------- template
// Pilihan dropdown (sesuai sheet DROPDOWN pada template contoh).
const OPT_JENIS = ["Pembentukan", "Peningkatan", "Pemutakhiran", "Teknis", "Revalidasi", "DPM", "Kerjasama (Non STCW)", "Diklat Kepegawaian"];
const OPT_STATUS = ["Diklat", "Lulus", "Tidak Lulus"];
const OPT_JK = ["Laki-Laki", "Perempuan"];

async function downloadTemplate() {
  if (typeof ExcelJS === "undefined") {
    return toast("Library ExcelJS belum termuat. Muat ulang halaman (Ctrl+Shift+R).", "err");
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("TEMPLATE");
  const dd = wb.addWorksheet("DROPDOWN");

  // --- Isi sheet TEMPLATE: header + 1 baris contoh ---
  // Kolom: A=NIT/NIK, B=Jenis Diklat, C=Nama Peserta, D=Nama Diklat, E=Angkatan, F=Kelas, G=Status, H=Jenis Kelamin
  ws.addRow(TEMPLATE_HEADERS);
  ws.addRow(["30322001", "Pembentukan", "FAHMI", "DIPLOMA IV NAUTIKA", "ANGKATAN 33", "KELAS 4B", "Diklat", "Laki-Laki"]);

  // --- Kop tabel: hijau muda + teks hitam tebal + border tipis (mirip contoh) ---
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEDD5" } };
    cell.font = { bold: true, color: { argb: "FF000000" }, size: 12 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });
  [16, 21, 33, 32.5, 16, 14, 21, 19.7].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // --- Sheet DROPDOWN: sumber pilihan (tata letak mengikuti contoh: C12:E20) ---
  dd.getCell("C12").value = "JENIS DIKLAT";
  dd.getCell("D12").value = "STATUS";
  dd.getCell("E12").value = "JENIS KELAMIN";
  ["C12", "D12", "E12"].forEach((c) => (dd.getCell(c).font = { bold: true }));
  OPT_JENIS.forEach((v, i) => (dd.getCell("C" + (13 + i)).value = v));
  OPT_STATUS.forEach((v, i) => (dd.getCell("D" + (13 + i)).value = v));
  OPT_JK.forEach((v, i) => (dd.getCell("E" + (13 + i)).value = v));
  dd.getColumn(3).width = 21.3; dd.getColumn(4).width = 14; dd.getColumn(5).width = 16;

  // --- Dropdown (data validation): Jenis Diklat (B), Status (G), Jenis Kelamin (H) ---
  const jEnd = 13 + OPT_JENIS.length - 1;   // 20
  const sEnd = 13 + OPT_STATUS.length - 1;  // 15
  const kEnd = 13 + OPT_JK.length - 1;      // 14
  const dv = (ref) => ({
    type: "list", allowBlank: true, formulae: [ref],
    showErrorMessage: true, errorStyle: "warning",
    errorTitle: "Input tidak valid", error: "Silakan pilih nilai dari daftar dropdown.",
  });
  for (let r = 2; r <= 1000; r++) {
    ws.getCell("B" + r).dataValidation = dv(`DROPDOWN!$C$13:$C$${jEnd}`);
    ws.getCell("G" + r).dataValidation = dv(`DROPDOWN!$D$13:$D$${sEnd}`);
    ws.getCell("H" + r).dataValidation = dv(`DROPDOWN!$E$13:$E$${kEnd}`);
  }

  // --- Unduh ---
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "TEMPLATE_TAMBAH_PESERTA.xlsx";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------- IMPORT (langsung, tanpa modal)
// Semua kolom dibaca per baris dari file Excel dan dipetakan ke kolom database.
// Tidak ada form auto-tag: Jenis Diklat, Nama Diklat, Angkatan diambil dari isi file.
async function importFromFile(file) {
  if (!file) return;

  let raw;
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    raw = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    return toast("File tidak dapat dibaca. Pastikan format .xlsx.", "err");
  }

  const pick = (r, ...keys) => {
    for (const k of keys) {
      if (r[k] !== undefined && String(r[k]).trim() !== "") return String(r[k]).trim();
    }
    return "";
  };

  const rows = raw
    .map((r) => {
      const namaPeserta = pick(r, "NAMA PESERTA", "Nama Peserta", "nama_peserta");
      const jenisDiklat = pick(r, "JENIS DIKLAT", "Jenis Diklat", "jenis_diklat");
      const namaDiklat  = pick(r, "NAMA DIKLAT", "Nama Diklat", "nama_diklat");
      // baris tanpa nama peserta / jenis / nama diklat dianggap kosong → dilewati
      if (!namaPeserta || !jenisDiklat || !namaDiklat) return null;

      // Angkatan & Kelas: baca kolom terpisah; jika hanya ada kolom gabungan lama, pecah dengan '/'.
      let angkatan = pick(r, "ANGKATAN", "Angkatan", "angkatan");
      let kelas    = pick(r, "KELAS", "Kelas", "kelas");
      if (!angkatan && !kelas) {
        const gab = pick(r, "ANGKT/KELAS", "ANGKATAN/KELAS", "Angkt/Kelas", "angkatan_kelas");
        if (gab.includes("/")) { angkatan = gab.split("/")[0].trim(); kelas = gab.split("/").slice(1).join("/").trim(); }
        else angkatan = gab;
      }

      return {
        nit_nik: pick(r, "NIT/NIK", "NIT", "NIK", "nit_nik") || null,
        nama_peserta: namaPeserta,
        jenis_diklat: jenisDiklat,
        nama_diklat: namaDiklat,
        angkatan: angkatan || null,
        kelas: kelas || null,
        status: normStatus(pick(r, "STATUS", "Status")),
        jenis_kelamin: normJK(pick(r, "JENIS KELAMIN", "Jenis Kelamin", "jenis_kelamin")),
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    return toast("Tidak ada baris valid. Pastikan kolom Nama Peserta, Jenis Diklat, dan Nama Diklat terisi.", "warn");
  }

  // Validasi terhadap data master: Nama Diklat harus turunan dari Jenis Diklat.
  const tree = await getMasterTree();
  if (tree.jenis.length) {
    const norm = (s) => String(s || "").trim().toLowerCase();
    const jenisSet = new Set(tree.jenis.map(norm));
    const mism = [];
    rows.forEach((r, i) => {
      const jOk = jenisSet.has(norm(r.jenis_diklat));
      const kids = (tree.namaByJenis[tree.jenis.find((j) => norm(j) === norm(r.jenis_diklat))] || []).map(norm);
      const nOk = kids.length === 0 || kids.includes(norm(r.nama_diklat));
      if (!jOk || !nOk) mism.push(`Baris ${i + 2}: "${r.nama_diklat}" tidak cocok dengan jenis "${r.jenis_diklat}"`);
    });
    if (mism.length) {
      const preview = mism.slice(0, 5).join("\n");
      const extra = mism.length > 5 ? `\n…dan ${mism.length - 5} baris lain.` : "";
      const ok = confirm(`Ada ${mism.length} baris yang Nama Diklat-nya tidak sesuai Jenis Diklat menurut Data Master:\n\n${preview}${extra}\n\nTetap lanjutkan import?`);
      if (!ok) return toast("Import dibatalkan. Perbaiki file atau lengkapi Data Master.", "warn");
    }
  }

  const { error } = await sb.from("peserta").insert(rows);
  if (error) return toast(error.message, "err");
  await logActivity("import", `import ${rows.length} peserta dari file ${file.name}`);
  toast(`${rows.length} peserta berhasil diimpor.`);
  renderPeserta();
}

// ---------------------------------------------------------------- HAPUS (select-all)
function openDelete() {
  $("#del-jenis").innerHTML = `<option value="">— pilih —</option>` +
    uniq(cache.map((p) => p.jenis_diklat)).map((v) => `<option>${escapeHtml(v)}</option>`).join("");
  $("#del-list-wrap").classList.add("hidden");
  $("#del-list").innerHTML = "";
  $("#del-all").checked = false;
  openModal("modal-delete");
}

function onDelJenisChange() {
  const jenis = $("#del-jenis").value;
  if (!jenis) { $("#del-list-wrap").classList.add("hidden"); return; }
  const namas = uniq(cache.filter((p) => p.jenis_diklat === jenis).map((p) => p.nama_diklat));
  $("#del-list").innerHTML = namas.map((n) => `
    <label class="del-item">
      <span class="text-sm">${escapeHtml(n)}</span>
      <input type="checkbox" class="del-cb" value="${escapeHtml(n)}" />
    </label>`).join("") || `<p class="p-2 text-sm text-muted-foreground">Tidak ada nama diklat.</p>`;
  $("#del-all").checked = false;
  $("#del-list-wrap").classList.remove("hidden");
}

async function submitDelete() {
  const jenis = $("#del-jenis").value;
  const checked = $$(".del-cb").filter((c) => c.checked).map((c) => c.value);
  if (!jenis) return toast("Pilih jenis diklat.", "warn");
  if (!checked.length) return toast("Centang minimal satu nama diklat.", "warn");
  if (!confirm(`Hapus semua peserta pada ${checked.length} nama diklat terpilih? Tindakan ini permanen.`)) return;
  const { error } = await sb.from("peserta").delete().eq("jenis_diklat", jenis).in("nama_diklat", checked);
  if (error) return toast(error.message, "err");
  await logActivity("hapus", `hapus data diklat ${jenis}: ${checked.join(", ")}`);
  closeModal("modal-delete");
  toast("Data terpilih dihapus.");
  renderPeserta();
}

// ---------------------------------------------------------------- edit/hapus baris
function openEdit(id) {
  const p = cache.find((x) => x.id === id); if (!p) return;
  $("#mp-id").value = p.id; $("#mp-nama").value = p.nama_peserta || ""; $("#mp-nit").value = p.nit_nik || "";
  $("#mp-jk").value = p.jenis_kelamin || "Laki-Laki"; $("#mp-jenis").value = p.jenis_diklat || "";
  $("#mp-namadiklat").value = p.nama_diklat || ""; $("#mp-angk").value = getAngkatan(p) || "";
  $("#mp-kelas").value = getKelas(p) || "";
  $("#mp-status").value = p.status || "DIKLAT";
  $("#mp-title").textContent = "Edit Peserta";
  openModal("modal-peserta");
}
async function submitEdit() {
  const id = $("#mp-id").value;
  const payload = {
    nama_peserta: $("#mp-nama").value.trim(), nit_nik: $("#mp-nit").value.trim() || null,
    jenis_kelamin: $("#mp-jk").value, jenis_diklat: $("#mp-jenis").value.trim(),
    nama_diklat: $("#mp-namadiklat").value.trim(),
    angkatan: $("#mp-angk").value.trim() || null,
    kelas: $("#mp-kelas").value.trim() || null,
    status: $("#mp-status").value,
  };
  if (!payload.nama_peserta) return toast("Nama peserta wajib diisi.", "warn");
  const { error } = await sb.from("peserta").update(payload).eq("id", id);
  if (error) return toast(error.message, "err");
  await logActivity("edit", `edit peserta ${payload.nama_peserta} (${payload.nama_diklat})`);
  closeModal("modal-peserta"); toast("Perubahan disimpan."); renderPeserta();
}
async function deleteRow(id) {
  const p = cache.find((x) => x.id === id); if (!p) return;
  if (!confirm(`Hapus peserta "${p.nama_peserta}"?`)) return;
  const { error } = await sb.from("peserta").delete().eq("id", id);
  if (error) return toast(error.message, "err");
  await logActivity("hapus", `hapus peserta ${p.nama_peserta} (${p.nama_diklat})`);
  toast("Peserta dihapus."); renderPeserta();
}

// ---------------------------------------------------------------- init
export function initPeserta() {
  $("#f-jenis").addEventListener("change", () => { fillNamaByJenis(); pPage = 1; renderTable(); });
  ["#f-nama", "#f-angk", "#f-kelas", "#f-status", "#f-jk"].forEach((id) => $(id).addEventListener("change", () => { pPage = 1; renderTable(); }));
  $("#p-size")?.addEventListener("change", (e) => { pSize = parseInt(e.target.value, 10) || 25; pPage = 1; renderTable(); });
  $("#p-pager")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]"); if (!b) return;
    pPage = parseInt(b.getAttribute("data-page"), 10); renderTable();
  });
  $("#btn-template").addEventListener("click", downloadTemplate);
  // Import langsung: klik tombol → buka pemilih file → proses.
  $("#btn-import").addEventListener("click", () => {
    let picker = document.getElementById("imp-file-hidden");
    if (!picker) {
      picker = document.createElement("input");
      picker.type = "file";
      picker.accept = ".xlsx,.xls";
      picker.id = "imp-file-hidden";
      picker.style.display = "none";
      picker.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        e.target.value = ""; // reset agar file sama bisa dipilih lagi
        if (file) await importFromFile(file);
      });
      document.body.appendChild(picker);
    }
    picker.click();
  });
  $("#btn-hapus-semua").addEventListener("click", openDelete);
  $("#del-jenis").addEventListener("change", onDelJenisChange);
  $("#del-all").addEventListener("change", (e) => $$(".del-cb").forEach((c) => (c.checked = e.target.checked)));
  $("#del-submit").addEventListener("click", submitDelete);
  $("#mp-submit").addEventListener("click", submitEdit);
  // delegasi tombol edit/hapus baris
  $("#peserta-table").addEventListener("click", (e) => {
    // checkbox pilih semua
    if (e.target.id === "cb-all") {
      const pageIds = filtered().slice((pPage - 1) * pSize, pPage * pSize).map((p) => String(p.id));
      if (e.target.checked) pageIds.forEach((id) => selected.add(id));
      else pageIds.forEach((id) => selected.delete(id));
      renderTable();
      return;
    }
    // checkbox per baris
    const cb = e.target.closest(".row-cb");
    if (cb) {
      const id = cb.getAttribute("data-cb");
      if (cb.checked) selected.add(id); else selected.delete(id);
      updateBulkBar();
      return;
    }
    // tombol edit / hapus
    const ed = e.target.closest("[data-edit]"); const dl = e.target.closest("[data-del]");
    if (ed) { openEdit(ed.getAttribute("data-edit")); return; }
    if (dl) { deleteRow(dl.getAttribute("data-del")); return; }
    // klik baris → detail (selain area tombol/checkbox)
    const tr = e.target.closest("[data-row]");
    if (tr) showDetail(tr.getAttribute("data-row"));
  });

  // Aksi massal
  $("#bulk-del")?.addEventListener("click", bulkDelete);
  $("#bulk-edit")?.addEventListener("click", () => {
    if (selected.size === 0) return;
    $("#bulk-info").textContent = `${selected.size} peserta akan diubah statusnya.`;
    openModal("modal-bulk");
  });
  $("#bulk-apply")?.addEventListener("click", bulkApplyStatus);
}
