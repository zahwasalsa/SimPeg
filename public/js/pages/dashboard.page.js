import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import { listDivisi, getDivisi } from "../api/divisi.js";
import { listJabatan, getJabatan } from "../api/jabatan.js";
import { getPegawai, listPegawai } from "../api/pegawai.js";
import { listCuti } from "../api/cuti.js";
import { listAbsensi } from "../api/absensi.js";
import { listDokumen } from "../api/dokumen.js";

const MANAGE_ROLES = ["admin", "hrd"];
// Pimpinan can view absensi/cuti but not submit either (POST is 403 for them
// at the backend) — quick actions and the "belum absen" reminder only make
// sense for pegawai.
const SELF_SERVICE_ROLES = ["pegawai"];

const CUTI_STATUS_VARIANTS = {
  diajukan: { color: "warning", label: "Diajukan" },
  disetujui: { color: "success", label: "Disetujui" },
  ditolak: { color: "danger", label: "Ditolak" },
  dibatalkan: { color: "secondary", label: "Dibatalkan" },
};

const ABSENSI_STATUS_VARIANTS = {
  hadir: { color: "success", label: "Hadir" },
  izin: { color: "info", label: "Izin" },
  sakit: { color: "warning", label: "Sakit" },
  alpha: { color: "danger", label: "Alpha" },
  cuti: { color: "secondary", label: "Cuti" },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

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

// --- Statistics ---
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
  const [divisiRes, jabatanRes, cutiPendingRes, pegawaiRes] = await Promise.allSettled([
    listDivisi({ page: 1, limit: 1 }),
    listJabatan({ page: 1, limit: 1 }),
    listCuti({ page: 1, limit: 1, status: "diajukan" }),
    listPegawai({ page: 1, limit: 1, status: "aktif" }),
  ]);

  const cards = [];
  if (pegawaiRes.status === "fulfilled") {
    cards.push(statCard("Pegawai Aktif", pegawaiRes.value.pagination.total, "/pegawai"));
  }
  if (divisiRes.status === "fulfilled") {
    cards.push(statCard("Total Divisi", divisiRes.value.pagination.total, "/divisi"));
  }
  if (jabatanRes.status === "fulfilled") {
    cards.push(statCard("Total Jabatan", jabatanRes.value.pagination.total, "/jabatan"));
  }
  if (cutiPendingRes.status === "fulfilled") {
    cards.push(statCard("Cuti Menunggu Persetujuan", cutiPendingRes.value.pagination.total, "/cuti"));
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

  const cards = [];

  if (user.pegawaiId) {
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

      cards.push(statCard("Divisi Anda", escapeHtml(divisiName), "/profile"));
      cards.push(statCard("Jabatan Anda", escapeHtml(jabatanName), "/profile"));
    } catch {
      cards.push(
        '<div class="col-12"><div class="alert alert-warning mb-0">Data kepegawaian belum bisa dimuat saat ini.</div></div>',
      );
    }
  } else {
    cards.push(
      '<div class="col-12"><div class="alert alert-warning mb-0">Profil pegawai Anda belum diisi — hubungi admin/HRD.</div></div>',
    );
  }

  const [absensiRes, cutiRes] = await Promise.allSettled([
    listAbsensi({ page: 1, limit: 1, tanggal: todayStr() }),
    listCuti({ page: 1, limit: 1, status: "diajukan" }),
  ]);

  if (absensiRes.status === "fulfilled") {
    const row = absensiRes.value.data[0];
    cards.push(statCard("Absensi Hari Ini", row ? "Sudah Absen" : "Belum Absen", "/absensi"));
  }
  if (cutiRes.status === "fulfilled") {
    cards.push(statCard("Cuti Menunggu Persetujuan", cutiRes.value.pagination.total, "/cuti"));
  }

  statsEl.innerHTML = cards.join("");
};

const loadStats = async (user) =>
  MANAGE_ROLES.includes(user.role) ? loadManageStats() : loadOwnDivisiJabatan(user);

// --- Reminder ---

const loadReminders = async (user) => {
  const el = document.getElementById("dashboard-reminders");
  el.innerHTML = "";

  try {
    if (MANAGE_ROLES.includes(user.role)) {
      const res = await listCuti({ page: 1, limit: 1, status: "diajukan" });
      const total = res.pagination.total;
      if (total > 0) {
        el.innerHTML = `
          <div class="alert alert-warning d-flex justify-content-between align-items-center mb-0">
            <span>Ada <strong>${total}</strong> pengajuan cuti yang menunggu persetujuan Anda.</span>
            <a href="/cuti" class="btn btn-sm btn-warning">Tinjau Sekarang</a>
          </div>`;
      }
      return;
    }

    if (SELF_SERVICE_ROLES.includes(user.role)) {
      const res = await listAbsensi({ page: 1, limit: 1, tanggal: todayStr() });
      if (res.data.length === 0) {
        el.innerHTML = `
          <div class="alert alert-info d-flex justify-content-between align-items-center mb-0">
            <span>Anda belum absen hari ini.</span>
            <a href="/absensi" class="btn btn-sm btn-info">Absen Sekarang</a>
          </div>`;
      }
    }
  } catch {
    // Reminder is a convenience, not critical — fail silently rather than
    // showing an alert about the alert itself.
  }
};

// --- Quick Menu ---

const quickMenuBtn = (label, href, variant = "outline-primary") =>
  `<div class="col-auto"><a href="${href}" class="btn btn-${variant} btn-sm">${escapeHtml(label)}</a></div>`;

const loadQuickMenu = (user) => {
  const el = document.getElementById("dashboard-quickmenu");

  let buttons;
  if (MANAGE_ROLES.includes(user.role)) {
    buttons = [
      quickMenuBtn("+ Tambah Pegawai", "/pegawai", "primary"),
      quickMenuBtn("+ Tambah Divisi", "/divisi"),
      quickMenuBtn("Kelola Cuti", "/cuti"),
      quickMenuBtn("Kelola Dokumen", "/dokumen"),
    ];
  } else if (SELF_SERVICE_ROLES.includes(user.role)) {
    buttons = [
      quickMenuBtn("Absen Masuk/Keluar", "/absensi", "primary"),
      quickMenuBtn("Ajukan Cuti", "/cuti"),
      quickMenuBtn("Unggah Dokumen", "/dokumen"),
    ];
  } else {
    // Pimpinan: read-only across Absensi/Cuti/Dokumen (POST is 403 for
    // them), so their quick menu only offers navigation, not actions.
    buttons = [
      quickMenuBtn("Lihat Absensi", "/absensi"),
      quickMenuBtn("Lihat Cuti", "/cuti"),
      quickMenuBtn("Lihat Dokumen", "/dokumen"),
    ];
  }

  el.innerHTML = buttons.join("");
};

// --- Recent Activity ---

const activityCard = (title, bodyHtml) => `
  <div class="col-12 col-lg-6">
    <div class="card h-100">
      <div class="card-header">${escapeHtml(title)}</div>
      <div class="card-body p-0">${bodyHtml}</div>
    </div>
  </div>`;

const emptyActivity = (message) => `<p class="text-muted mb-0 p-3">${escapeHtml(message)}</p>`;

const cutiActivityList = (rows, pegawaiMap) => {
  if (rows.length === 0) {
    return emptyActivity("Belum ada pengajuan cuti.");
  }
  const items = rows
    .map((row) => {
      const who = pegawaiMap ? escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId) : null;
      return `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>
            ${who ? `<strong>${who}</strong> — ` : ""}${formatDate(row.tanggalMulai)} s/d ${formatDate(row.tanggalSelesai)}
          </span>
          ${renderStatusBadge(row.status, CUTI_STATUS_VARIANTS)}
        </li>`;
    })
    .join("");
  return `<ul class="list-group list-group-flush">${items}</ul>`;
};

const dokumenActivityList = (rows, pegawaiMap) => {
  if (rows.length === 0) {
    return emptyActivity("Belum ada dokumen diunggah.");
  }
  const items = rows
    .map((row) => {
      const who = pegawaiMap ? escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId) : null;
      return `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${who ? `<strong>${who}</strong> — ` : ""}${escapeHtml(row.namaDokumen)}</span>
          <span class="text-muted small">${formatDateTime(row.createdAt)}</span>
        </li>`;
    })
    .join("");
  return `<ul class="list-group list-group-flush">${items}</ul>`;
};

const absensiActivityList = (rows) => {
  if (rows.length === 0) {
    return emptyActivity("Belum ada riwayat absensi.");
  }
  const items = rows
    .map(
      (row) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <span>${formatDate(row.tanggal)}</span>
          ${renderStatusBadge(row.status, ABSENSI_STATUS_VARIANTS)}
        </li>`,
    )
    .join("");
  return `<ul class="list-group list-group-flush">${items}</ul>`;
};

const loadActivity = async (user) => {
  const el = document.getElementById("dashboard-activity");
  el.innerHTML = '<div class="col-12 text-muted">Memuat aktivitas terbaru...</div>';

  try {
    if (MANAGE_ROLES.includes(user.role)) {
      const [cutiRes, dokumenRes, pegawaiRes] = await Promise.all([
        listCuti({ page: 1, limit: 5 }),
        listDokumen({ page: 1, limit: 5 }),
        listPegawai({ page: 1, limit: 100 }),
      ]);
      const pegawaiMap = Object.fromEntries(pegawaiRes.data.map((p) => [p.id, p.namaLengkap]));

      el.innerHTML = [
        activityCard("Pengajuan Cuti Terbaru", cutiActivityList(cutiRes.data, pegawaiMap)),
        activityCard("Dokumen Terbaru", dokumenActivityList(dokumenRes.data, pegawaiMap)),
      ].join("");
      return;
    }

    const [absensiRes, cutiRes] = await Promise.all([
      listAbsensi({ page: 1, limit: 5 }),
      listCuti({ page: 1, limit: 5 }),
    ]);

    el.innerHTML = [
      activityCard("Absensi Terbaru Anda", absensiActivityList(absensiRes.data)),
      activityCard("Cuti Terbaru Anda", cutiActivityList(cutiRes.data, null)),
    ].join("");
  } catch {
    el.innerHTML =
      '<div class="col-12"><div class="alert alert-warning mb-0">Aktivitas terbaru belum bisa dimuat saat ini.</div></div>';
  }
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

  await Promise.all([loadReminders(user), loadStats(user), loadActivity(user)]);
  loadQuickMenu(user);
};

init();
