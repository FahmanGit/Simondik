import { sb } from "../supabaseClient.js";
import { $, escapeHtml, toast } from "../ui.js";
import { canWrite, logActivity } from "../auth.js";

const LABELS = { jenis_diklat: "Jenis Diklat", nama_diklat: "Nama Diklat" };
let master = { jenis_diklat: [], nama_diklat: [] };

export async function renderMaster() {
  const { data, error } = await sb.from("master_data").select("*").order("nilai", { ascending: true });
  if (error) { $("#master-jenis").innerHTML = `<p class="text-danger">${escapeHtml(error.message)}</p>`; return; }
  master = { jenis_diklat: [], nama_diklat: [] };
  (data || []).forEach((r) => { if (master[r.kategori]) master[r.kategori].push(r); });
  renderList("jenis_diklat");
  renderList("nama_diklat");
}

function renderList(kategori) {
  const canEdit = canWrite();
  const items = master[kategori];
  const rows = items.map((it) => `
    <div class="del-item">
      <span class="text-sm">${escapeHtml(it.nilai)}</span>
      ${canEdit ? `<span class="flex shrink-0 items-center gap-2">
        <button class="ui-btn-outline h-8 w-8 justify-center p-0" title="Ubah" data-edit-master="${it.id}" data-kat="${kategori}"><i class="fa-solid fa-pen"></i></button>
        <button class="ui-btn-danger h-8 w-8 justify-center p-0" title="Hapus" data-del-master="${it.id}" data-kat="${kategori}"><i class="fa-solid fa-trash"></i></button>
      </span>` : ""}
    </div>`).join("");
  const el = $("#master-" + (kategori === "jenis_diklat" ? "jenis" : "nama"));
  el.innerHTML = rows || `<p class="py-4 text-center text-sm text-muted-foreground">Belum ada data.</p>`;
}

async function addItem(kategori) {
  const input = $(kategori === "jenis_diklat" ? "#master-jenis-input" : "#master-nama-input");
  const nilai = input.value.trim();
  if (!nilai) return toast("Isi nilai terlebih dahulu.", "warn");
  const { error } = await sb.from("master_data").insert({ kategori, nilai });
  if (error) return toast(error.code === "23505" ? "Data sudah ada." : error.message, "err");
  await logActivity("tambah", `tambah master ${LABELS[kategori]}: ${nilai}`);
  input.value = "";
  toast("Data ditambahkan.");
  renderMaster();
}

async function editItem(id, kategori) {
  const it = master[kategori].find((x) => String(x.id) === String(id));
  if (!it) return;
  const nilai = prompt(`Ubah ${LABELS[kategori]}:`, it.nilai);
  if (nilai === null) return;
  const v = nilai.trim();
  if (!v) return toast("Nilai tidak boleh kosong.", "warn");
  const { error } = await sb.from("master_data").update({ nilai: v }).eq("id", id);
  if (error) return toast(error.code === "23505" ? "Data sudah ada." : error.message, "err");
  await logActivity("edit", `edit master ${LABELS[kategori]}: ${it.nilai} → ${v}`);
  toast("Data diperbarui.");
  renderMaster();
}

async function delItem(id, kategori) {
  const it = master[kategori].find((x) => String(x.id) === String(id));
  if (!it) return;
  if (!confirm(`Hapus "${it.nilai}" dari ${LABELS[kategori]}?`)) return;
  const { error } = await sb.from("master_data").delete().eq("id", id);
  if (error) return toast(error.message, "err");
  await logActivity("hapus", `hapus master ${LABELS[kategori]}: ${it.nilai}`);
  toast("Data dihapus.");
  renderMaster();
}

export function initMaster() {
  $("#master-jenis-add")?.addEventListener("click", () => addItem("jenis_diklat"));
  $("#master-nama-add")?.addEventListener("click", () => addItem("nama_diklat"));
  ["#master-jenis-input", "#master-nama-input"].forEach((id) =>
    $(id)?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addItem(id.includes("jenis") ? "jenis_diklat" : "nama_diklat"); } }));

  document.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-master]");
    const dl = e.target.closest("[data-del-master]");
    if (ed) editItem(ed.getAttribute("data-edit-master"), ed.getAttribute("data-kat"));
    if (dl) delItem(dl.getAttribute("data-del-master"), dl.getAttribute("data-kat"));
  });
}

// Dipakai modul lain (mis. peserta) untuk mengambil nilai master.
export async function getMasterValues(kategori) {
  const { data } = await sb.from("master_data").select("nilai").eq("kategori", kategori).order("nilai");
  return (data || []).map((r) => r.nilai);
}
