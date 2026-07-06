import { $, $$ } from "./ui.js";
const TITLES = { dashboard: "Monitoring Peserta Diklat", peserta: "Modul Peserta Diklat", history: "History Activity", akun: "Manajemen Akun" };
const onShow = {};
export function onView(view, cb) { onShow[view] = cb; }
export function showView(view) {
  $$(".view").forEach((v) => v.classList.add("hidden"));
  $("#view-" + view)?.classList.remove("hidden");
  $$(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  $("#page-title").textContent = TITLES[view] || "E-Mondik";
  location.hash = view; onShow[view]?.();
}
export function initRouter(defaultView = "dashboard") {
  $$(".nav-link").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); showView(a.dataset.view); }));
  const start = (location.hash || "").replace("#", "") || defaultView;
  showView(TITLES[start] ? start : defaultView);
}
