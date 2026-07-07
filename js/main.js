import { sb } from "./supabaseClient.js";
import { $, $$, toast } from "./ui.js";
import { me, login, logout, loadProfile, isAdmin, canWrite } from "./auth.js";
import { initRouter, onView } from "./router.js";
import { renderDashboard, initDashboard } from "./modules/dashboard.js";
import { renderPeserta, initPeserta } from "./modules/peserta.js";
import { renderHistory } from "./modules/history.js";
import { renderAkun, initAkun } from "./modules/akun.js";

const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fillPeriode() {
  const now = new Date().getFullYear();
  $("#filter-tahun").innerHTML = [now + 1, now, now - 1, now - 2].map((y) => `<option>${y}</option>`).join("");
  $("#filter-tahun").value = String(now);
  $("#filter-bulan").innerHTML = `<option value="">Semua Bulan</option>` + BULAN.map((b, i) => `<option value="${i + 1}">${b}</option>`).join("");
  $("#tahun-label").textContent = String(now);
}

function applyRole() {
  $$("[data-admin]").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  $$("[data-write]").forEach((el) => el.classList.toggle("hidden", !canWrite()));
}

function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#me-name").textContent = me?.full_name || "-";
  $("#me-role").textContent = me?.role || "-";
  applyRole();
}
function showLogin() {
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
}

async function boot() {
  fillPeriode();

  // Inisialisasi handler modul sekali.
  initDashboard(); initPeserta(); initAkun();
  onView("dashboard", renderDashboard);
  onView("peserta", renderPeserta);
  onView("history", renderHistory);
  onView("akun", renderAkun);

  // Filter periode → segarkan dashboard.
  $("#filter-tahun").addEventListener("change", (e) => { $("#tahun-label").textContent = e.target.value; renderDashboard(); });
  $("#filter-bulan").addEventListener("change", renderDashboard);

  // Login.
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#login-error").classList.add("hidden");
    try {
      await login($("#login-email").value.trim(), $("#login-password").value);
      showApp(); initRouter("dashboard");
    } catch (err) {
      $("#login-error").textContent = err.message || "Gagal masuk.";
      $("#login-error").classList.remove("hidden");
    }
  });

  // Logout.
  $("#btn-logout").addEventListener("click", async () => { await logout(); showLogin(); });

  // Sesi tersimpan?
  await loadProfile();
  if (me && me.status === "Nonaktif") {
    await logout();
    showLogin();
    $("#login-error").textContent = "Akun Anda telah dinonaktifkan. Hubungi Admin.";
    $("#login-error").classList.remove("hidden");
  } else if (me) {
    showApp(); initRouter("dashboard");
  } else {
    showLogin();
  }
}

boot().catch((e) => { console.error(e); toast("Gagal memuat aplikasi: " + e.message, "err"); });
