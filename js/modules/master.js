import { sb } from "../supabaseClient.js";
import { $, escapeHtml, toast } from "../ui.js";
import { canWrite, logActivity } from "../auth.js";

let jenisList = [];   // [{id, nilai}]
let namaList = [];    // [{id, nilai, parent}]
let activeJenis = ""; // jenis diklat yang sedang dipilih (nilai)

export async function renderMaster() {
  const { data, error } = await sb.from("master_data").select("*").order("nilai", { ascending: true });
  if (error) { $("#master-jenis").innerHTML = `<p class="text-danger">${escapeHtml(error.message)}</p>`; return; }
  jenisList = (data || []).filter((r) => r.kategori === "jenis_diklat");
  namaList = (data || []).filter((r) => r.kategori === "nama_diklat");
  if (activeJenis && !jenisList.some((j) => j.nilai === activeJenis)) activeJenis = "";
  renderJenis();
  renderNama();
}

function renderJenis() {
  const canEdit = canWrite();
  $("#master-jenis").innerHTML = jenisList.map((it) => {
    const active = it.nilai === activeJenis;
    const count = namaList.filter((n) => n.parent === it.nilai).length;
    return `
      <div class="del-item ${active ? "!bg-primary/10 ring-1 ring-primary/40" : ""} cursor-pointer" data-pick-jenis="${escapeHtml(it.nilai)}">
        <span class="text-sm ${active ? "font-semibold text-primary" : ""}">${escapeHtml(it.nilai)}
          <span class="ml-1 text-xs text-muted-foreground">(${count})</span>
        </span>
        ${canEdit ? `<span class="flex shrink-0 items-center gap-2">
          <button class="ui-btn-outline h-8 w-8 justify-center p-0" title="Ubah" data-edit-jenis="${it.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="ui-btn-danger h-8 w-8 justify-center p-0" title="Hapus" data-del-jenis="${it.id}"><i class="fa-solid fa-trash"></i></button>
        </span>` : ""}
      </div>`;
  }).join("") || `<p class="py-4 text-center text-sm text-muted-foreground">Belum ada jenis diklat.</p>`;
}

function renderNama() {
  const canEdit = canWrite();
  const head = $("#master-nama-head");
  const addWrap = $("#master-nama-addwrap");
  if (!activeJenis) {
    head.textContent = "Nama Diklat";
    addWrap.classList.add("hidden");
    $("#master-nama").innerHTML = `<p class="py-8 text-center text-sm text-muted-foreground">Pilih Jenis Diklat di kiri untuk melihat & menambah nama diklat turunannya.</p>`;
    return;
  }
  head.innerHTML = `Nama Diklat &mdash; <span class="text-primary">${escapeHtml(activeJenis)}</span>`;
  addWrap.classList.remove("hidden");
  const items = namaList.filter((n) => n.parent === activeJenis);
  $("#master-nama").innerHTML = items.map((it) => `
    <div class="del-item">
      <span class="text-sm">${escapeHtml(it.nilai)}</span>
      ${canEdit ? `<span class="flex shrink-0 items-center gap-2">
        <button class="ui-btn-outline h-8 w-8 justify-center p-0" title="Ubah" data-edit-nama="${it.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="ui-btn-danger h-8 w-8 justify-center p-0" title="Hapus" data-del-nama="${it.id}"><i class="fa-solid fa-trash"></i></button>
      </span>` : ""}
    </div>`).join("") || `<p class="py-6 text-center text-sm text-muted-foreground">Belum ada nama diklat untuk "${escapeHtml(activeJenis)}".</p>`;
}

// ---------- Jenis Diklat ----------
async function addJenis() {
  const input = $("#master-jenis-input");
  const nilai = input.value.trim();
  if (!nilai) return toast("Isi jenis diklat terlebih dahulu.", "warn");
  const { error } = await sb.from("master_data").insert({ kategori: "jenis_diklat", nilai });
  if (error) return toast(error.code === "23505" ? "Jenis diklat sudah ada." : error.message, "err");
  await logActivity("tambah", `tambah jenis diklat: ${nilai}`);
  input.value = "";
  toast("Jenis diklat ditambahkan.");
  renderMaster();
}
async function editJenis(id) {
  const it = jenisList.find((x) => String(x.id) === String(id)); if (!it) return;
  const v = (prompt("Ubah Jenis Diklat:", it.nilai) || "").trim();
  if (!v || v === it.nilai) return;
  const { error } = await sb.from("master_data").update({ nilai: v }).eq("id", id);
  if (error) return toast(error.code === "23505" ? "Jenis diklat sudah ada." : error.message, "err");
  await sb.from("master_data").update({ parent: v }).eq("kategori", "nama_diklat").eq("parent", it.nilai);
  if (activeJenis === it.nilai) activeJenis = v;
  await logActivity("edit", `edit jenis diklat: ${it.nilai} -> ${v}`);
  toast("Jenis diklat diperbarui.");
  renderMaster();
}
async function delJenis(id) {
  const it = jenisList.find((x) => String(x.id) === String(id)); if (!it) return;
  const kids = namaList.filter((n) => n.parent === it.nilai).length;
  if (!confirm(`Hapus jenis "${it.nilai}"${kids ? ` beserta ${kids} nama diklat turunannya` : ""}?`)) return;
  await sb.from("master_data").delete().eq("kategori", "nama_diklat").eq("parent", it.nilai);
  const { error } = await sb.from("master_data").delete().eq("id", id);
  if (error) return toast(error.message, "err");
  if (activeJenis === it.nilai) activeJenis = "";
  await logActivity("hapus", `hapus jenis diklat: ${it.nilai}${kids ? ` (+${kids} nama)` : ""}`);
  toast("Jenis diklat dihapus.");
  renderMaster();
}

// ---------- Nama Diklat (turunan) ----------
async function addNama() {
  if (!activeJenis) return toast("Pilih Jenis Diklat dulu.", "warn");
  const input = $("#master-nama-input");
  const nilai = input.value.trim();
  if (!nilai) return toast("Isi nama diklat terlebih dahulu.", "warn");
  const { error } = await sb.from("master_data").insert({ kategori: "nama_diklat", nilai, parent: activeJenis });
  if (error) return toast(error.code === "23505" ? "Nama diklat sudah ada di jenis ini." : error.message, "err");
  await logActivity("tambah", `tambah nama diklat: ${nilai} (${activeJenis})`);
  input.value = "";
  toast("Nama diklat ditambahkan.");
  renderMaster();
}
async function editNama(id) {
  const it = namaList.find((x) => String(x.id) === String(id)); if (!it) return;
  const v = (prompt(`Ubah Nama Diklat (${it.parent}):`, it.nilai) || "").trim();
  if (!v || v === it.nilai) return;
  const { error } = await sb.from("master_data").update({ nilai: v }).eq("id", id);
  if (error) return toast(error.code === "23505" ? "Nama diklat sudah ada." : error.message, "err");
  await logActivity("edit", `edit nama diklat: ${it.nilai} -> ${v}`);
  toast("Nama diklat diperbarui.");
  renderMaster();
}
async function delNama(id) {
  const it = namaList.find((x) => String(x.id) === String(id)); if (!it) return;
  if (!confirm(`Hapus nama diklat "${it.nilai}"?`)) return;
  const { error } = await sb.from("master_data").delete().eq("id", id);
  if (error) return toast(error.message, "err");
  await logActivity("hapus", `hapus nama diklat: ${it.nilai}`);
  toast("Nama diklat dihapus.");
  renderMaster();
}

export function initMaster() {
  $("#master-jenis-add")?.addEventListener("click", addJenis);
  $("#master-nama-add")?.addEventListener("click", addNama);
  $("#master-jenis-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addJenis(); } });
  $("#master-nama-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addNama(); } });

  $("#master-jenis")?.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-jenis]");
    const dl = e.target.closest("[data-del-jenis]");
    if (ed) { editJenis(ed.getAttribute("data-edit-jenis")); return; }
    if (dl) { delJenis(dl.getAttribute("data-del-jenis")); return; }
    const pick = e.target.closest("[data-pick-jenis]");
    if (pick) { activeJenis = pick.getAttribute("data-pick-jenis"); renderJenis(); renderNama(); }
  });
  $("#master-nama")?.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-nama]");
    const dl = e.target.closest("[data-del-nama]");
    if (ed) editNama(ed.getAttribute("data-edit-nama"));
    if (dl) delNama(dl.getAttribute("data-del-nama"));
  });
}

// ---------- API untuk modul lain (peserta/dashboard) ----------
export async function getMasterTree() {
  const { data } = await sb.from("master_data").select("*");
  const jenis = (data || []).filter((r) => r.kategori === "jenis_diklat").map((r) => r.nilai).sort();
  const namaByJenis = {};
  (data || []).filter((r) => r.kategori === "nama_diklat").forEach((r) => {
    (namaByJenis[r.parent] = namaByJenis[r.parent] || []).push(r.nilai);
  });
  Object.values(namaByJenis).forEach((a) => a.sort());
  return { jenis, namaByJenis };
}
