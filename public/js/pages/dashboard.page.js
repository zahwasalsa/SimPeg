import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHtml } from "../utils/format.js";
import { listDivisi } from "../api/divisi.js";
import { listJabatan } from "../api/jabatan.js";

const MANAGE_ROLES = ["admin", "hrd"];

const statCard = (label, value, href) => `
  <div class="col-6 col-md-3">
    <a href="${href}" class="text-decoration-none">
      <div class="card h-100">
        <div class="card-body">
          <div class="text-muted small">${escapeHtml(label)}</div>
          <div class="h3 mb-0">${value}</div>
        </div>
      </div>
    </a>
  </div>`;

const loadStats = async (user) => {
  const statsEl = document.getElementById("dashboard-stats");
  statsEl.innerHTML = '<div class="col-12 text-muted">Memuat statistik...</div>';

  // limit=1 keeps the payload minimal — we only need `pagination.total`,
  // which every list endpoint already returns (no new backend work).
  const [divisiRes, jabatanRes] = await Promise.allSettled([
    listDivisi({ page: 1, limit: 1 }),
    listJabatan({ page: 1, limit: 1 }),
  ]);

  const cards = [];
  if (divisiRes.status === "fulfilled") {
    cards.push(statCard("Total Divisi", divisiRes.value.pagination.total, "/divisi"));
  }
  if (jabatanRes.status === "fulfilled") {
    cards.push(statCard("Total Jabatan", jabatanRes.value.pagination.total, "/jabatan"));
  }

  statsEl.innerHTML =
    cards.join("") ||
    '<div class="col-12"><div class="alert alert-warning mb-0">Statistik belum bisa dimuat saat ini.</div></div>';

  const linksEl = document.getElementById("dashboard-links");
  const manageNote = MANAGE_ROLES.includes(user.role)
    ? "Anda dapat menambah dan mengubah data Divisi dan Jabatan."
    : "Anda dapat melihat data Divisi dan Jabatan.";
  linksEl.innerHTML = `<p class="text-muted mb-0">${escapeHtml(manageNote)} Menu lain (Pegawai, Absensi, Cuti, Manajemen User) akan ditambahkan pada tahap berikutnya.</p>`;
};

const init = async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  renderNavbar("/dashboard");

  document.getElementById("dashboard-welcome").innerHTML = `
    <div class="card">
      <div class="card-body">
        <h2 class="h5 mb-1">Selamat datang, ${escapeHtml(user.email)}</h2>
        <span class="badge text-bg-primary">${escapeHtml(user.role)}</span>
      </div>
    </div>
  `;

  await loadStats(user);
};

init();
