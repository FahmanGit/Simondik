export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function openModal(id) { $("#" + id)?.classList.remove("hidden"); }
export function closeModal(id) { $("#" + id)?.classList.add("hidden"); }
export function toast(msg, type = "ok") {
  const t = $("#toast"); if (!t) return;
  t.style.background = type === "err" ? "hsl(0 72% 51%)" : type === "warn" ? "hsl(38 92% 50%)" : "hsl(142 71% 45%)";
  t.style.color = "#fff"; t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._tmr); t._tmr = setTimeout(() => t.classList.add("hidden"), 3200);
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close-modal]");
  if (btn) closeModal(btn.getAttribute("data-close-modal"));
  if (e.target.classList?.contains("ui-modal")) e.target.classList.add("hidden");
});
