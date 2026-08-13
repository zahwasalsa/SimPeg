import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { escapeHtml } from "../utils/format.js";
import { listDivisi, getDivisi } from "../api/divisi.js";
import { listJabatan, getJabatan } from "../api/jabatan.js";
import { getPegawai } from "../api/pegawai.js";

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

// Admin/HRD manage Divisi & Jabatan org-wide, so they see counts linking to
// the full browse/manage pages. Everyone else already has their own divisi &
// jabatan fixed on their profile — showing them an org-wide "Total Divisi"
// count with no reason to browse the rest is confusing, so they get a
// personalized card instead (see loadOwnDivisiJabatan below).
const loadManageStats = async () => {
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
  linksEl.innerHTML =
    '<p class="text-muted mb-0">Anda dapat menambah dan mengubah data Divisi dan Jabatan.</p>';
};

const loadOwnDivisiJabatan = async (user) => {
  const statsEl = document.getElementById("dashboard-stats");
  statsEl.innerHTML = '<div class="col-12 text-muted">Memuat data kepegawaian...</div>';

  const linksEl = document.getElementById("dashboard-links");
  linksEl.innerHTML =
    '<p class="text-muted mb-0">Divisi &amp; jabatan Anda ditampilkan di bawah. Untuk detail lengkap, buka halaman Profil.</p>';

  if (!user.pegawaiId) {
    statsEl.innerHTML =
      '<div class="col-12"><div class="alert alert-warning mb-0">Profil pegawai Anda belum diisi — hubungi admin/HRD.</div></div>';
    return;
  }

  try {
    const pegawaiRes = await getPegawai(user.pegawaiId);
    const pegawai = pegawaiRes.data;

    const [divisiName, jabatanName] = await Promise.all([
      pegawai.divisiId
        ? getDivisi(pegawai.divisiId)
            .then((r) => r.data.namaDivisi)
            .catch(() => "-")
        : Promise.resolve("-"),
      pegawai.jabatanId
        ? getJabatan(pegawai.jabatanId)
            .then((r) => r.data.namaJabatan)
            .catch(() => "-")
        : Promise.resolve("-"),
    ]);

    statsEl.innerHTML = [
      statCard("Divisi Anda", escapeHtml(divisiName), "/profile"),
      statCard("Jabatan Anda", escapeHtml(jabatanName), "/profile"),
    ].join("");
  } catch {
    statsEl.innerHTML =
      '<div class="col-12"><div class="alert alert-warning mb-0">Data kepegawaian belum bisa dimuat saat ini.</div></div>';
  }
};

const loadStats = async (user) =>
  MANAGE_ROLES.includes(user.role) ? loadManageStats() : loadOwnDivisiJabatan(user);

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
