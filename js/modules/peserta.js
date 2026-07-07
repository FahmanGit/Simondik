import { sb } from "../supabaseClient.js";
import { $, $$, escapeHtml, openModal, closeModal, toast } from "../ui.js";
import { canWrite, logActivity } from "../auth.js";

const TEMPLATE_HEADERS = ["NIT/NIK", "JENIS DIKLAT", "NAMA PESERTA", "NAMA DIKLAT", "ANGKT/KELAS", "STATUS", "JENIS KELAMIN"];
let cache = []; // seluruh peserta (untuk isi filter)

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
    el.value = cur;
  };
  set("#f-jenis", uniq(cache.map((p) => p.jenis_diklat)), "Semua Diklat");
  set("#f-nama", uniq(cache.map((p) => p.nama_diklat)), "Semua Nama");
  set("#f-angk", uniq(cache.map((p) => p.angkatan_kelas)), "Semua ANGKT/KLS");
}

function filtered() {
  const jenis = $("#f-jenis").value, nama = $("#f-nama").value, angk = $("#f-angk").value,
        status = $("#f-status").value, jk = $("#f-jk").value;
  return cache.filter((p) =>
    (!jenis || p.jenis_diklat === jenis) &&
    (!nama || p.nama_diklat === nama) &&
    (!angk || p.angkatan_kelas === angk) &&
    (!status || p.status === status) &&
    (!jk || p.jenis_kelamin === jk));
}

function renderTable() {
  const rows = filtered();
  const admin = canWrite();
  const body = rows.map((p) => `
    <tr>
      <td>${escapeHtml(p.nit_nik || "-")}</td>
      <td class="font-medium">${escapeHtml(p.nama_peserta)}</td>
      <td>${escapeHtml(p.nama_diklat)}</td>
      <td>${escapeHtml(p.angkatan_kelas || "-")}</td>
      <td>${badge(p.status)}</td>
      <td>${escapeHtml(p.jenis_kelamin || "-")}</td>
      ${admin ? `<td class="text-right whitespace-nowrap">
        <button class="ui-btn-outline h-8 px-2" data-edit="${p.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="ui-btn-danger h-8 px-2" data-del="${p.id}"><i class="fa-solid fa-trash"></i></button>
      </td>` : ""}
    </tr>`).join("");
  $("#peserta-table").innerHTML = `
    <table class="ui-table">
      <thead><tr>
        <th>NIT/NIK</th><th>Nama Peserta</th><th>Nama Diklat</th><th>Angk/Kelas</th>
        <th>Status</th><th>Jenis Kelamin</th>${admin ? "<th class='text-right'>Aksi</th>" : ""}
      </tr></thead>
      <tbody>${body || `<tr><td colspan="7" class="py-8 text-center text-muted-foreground">Belum ada data.</td></tr>`}</tbody>
    </table>`;
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
  // Kolom: A=NIT/NIK, B=Jenis Diklat, C=Nama Peserta, D=Nama Diklat, E=Angk/Kelas, F=Status, G=Jenis Kelamin
  ws.addRow(TEMPLATE_HEADERS);
  ws.addRow(["30322001", "Pembentukan", "FAHMI", "DIPLOMA IV NAUTIKA", "ANGKATAN 33/KELAS 4B", "Diklat", "Laki-Laki"]);

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
  [16, 21, 33, 32.5, 24, 21, 19.7].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // --- Sheet DROPDOWN: sumber pilihan (tata letak mengikuti contoh: C12:E20) ---
  dd.getCell("C12").value = "JENIS DIKLAT";
  dd.getCell("D12").value = "STATUS";
  dd.getCell("E12").value = "JENIS KELAMIN";
  ["C12", "D12", "E12"].forEach((c) => (dd.getCell(c).font = { bold: true }));
  OPT_JENIS.forEach((v, i) => (dd.getCell("C" + (13 + i)).value = v));
  OPT_STATUS.forEach((v, i) => (dd.getCell("D" + (13 + i)).value = v));
  OPT_JK.forEach((v, i) => (dd.getCell("E" + (13 + i)).value = v));
  dd.getColumn(3).width = 21.3; dd.getColumn(4).width = 14; dd.getColumn(5).width = 16;

  // --- Dropdown (data validation): Jenis Diklat (B), Status (F), Jenis Kelamin (G) ---
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
    ws.getCell("F" + r).dataValidation = dv(`DROPDOWN!$D$13:$D$${sEnd}`);
    ws.getCell("G" + r).dataValidation = dv(`DROPDOWN!$E$13:$E$${kEnd}`);
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
      return {
        nit_nik: pick(r, "NIT/NIK", "NIT", "NIK", "nit_nik") || null,
        nama_peserta: namaPeserta,
        jenis_diklat: jenisDiklat,
        nama_diklat: namaDiklat,
        angkatan_kelas: pick(r, "ANGKT/KELAS", "ANGKATAN/KELAS", "Angkt/Kelas", "angkatan_kelas") || null,
        status: normStatus(pick(r, "STATUS", "Status")),
        jenis_kelamin: normJK(pick(r, "JENIS KELAMIN", "Jenis Kelamin", "jenis_kelamin")),
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    return toast("Tidak ada baris valid. Pastikan kolom Nama Peserta, Jenis Diklat, dan Nama Diklat terisi.", "warn");
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
  $("#mp-namadiklat").value = p.nama_diklat || ""; $("#mp-angk").value = p.angkatan_kelas || "";
  $("#mp-status").value = p.status || "DIKLAT";
  $("#mp-title").textContent = "Edit Peserta";
  openModal("modal-peserta");
}
async function submitEdit() {
  const id = $("#mp-id").value;
  const payload = {
    nama_peserta: $("#mp-nama").value.trim(), nit_nik: $("#mp-nit").value.trim() || null,
    jenis_kelamin: $("#mp-jk").value, jenis_diklat: $("#mp-jenis").value.trim(),
    nama_diklat: $("#mp-namadiklat").value.trim(), angkatan_kelas: $("#mp-angk").value.trim(),
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
  ["#f-jenis", "#f-nama", "#f-angk", "#f-status", "#f-jk"].forEach((id) => $(id).addEventListener("change", renderTable));
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
    const ed = e.target.closest("[data-edit]"); const dl = e.target.closest("[data-del]");
    if (ed) openEdit(ed.getAttribute("data-edit"));
    if (dl) deleteRow(dl.getAttribute("data-del"));
  });
}
