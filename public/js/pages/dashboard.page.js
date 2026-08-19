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
import { getKpiSummary } from "../api/kpi.js";
import { listRoadmapKarier } from "../api/roadmapKarier.js";

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

// FR-DASH-003: "Sistem menampilkan progres karier." No dedicated backend
// summary endpoint exists for roadmap_karier (unlike KPI's getKpiSummary) —
// per Tahap 3 scope this stays frontend-only and reuses the existing
// GET /api/v1/roadmap-karier list endpoint (already self-scoped for pegawai,
// org-wide otherwise). limit=100 is the same "good enough at this scale"
// single-page fetch already used elsewhere for lookups (e.g. listPegawai
// limit=100) — not a full pagination loop, since this is a lightweight
// dashboard glance, not a report that must be exhaustive.
const roadmapProgressSummary = async () => {
  const res = await listRoadmapKarier({ page: 1, limit: 100 });
  const rows = res.data;
  if (rows.length === 0) {
    return { total: 0, averageProgress: 0 };
  }
  const sum = rows.reduce((acc, row) => acc + Number(row.progress), 0);
  return { total: rows.length, averageProgress: Math.round((sum / rows.length) * 100) / 100 };
};

const statCard = (label, value, href, icon = "bi-bar-chart", variant = "primary") => `
  <div class="col-6 col-md-3">
    <a href="${href}" class="text-decoration-none">
      <div class="card stat-tile stat-tile-${variant} h-100">
        <div class="card-body">
          <div class="stat-tile-icon"><i class="bi ${icon}"></i></div>
          <div class="stat-tile-value">${value}</div>
          <div class="stat-tile-label">${escapeHtml(label)}</div>
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
  const [
    divisiRes,
    jabatanRes,
    cutiPendingRes,
    pegawaiRes,
    dokumenPendingRes,
    dokumenExpiringRes,
    kpiSummaryRes,
    roadmapSummaryRes,
  ] = await Promise.allSettled([
    listDivisi({ page: 1, limit: 1 }),
    listJabatan({ page: 1, limit: 1 }),
    listCuti({ page: 1, limit: 1, status: "diajukan" }),
    listPegawai({ page: 1, limit: 1, status: "aktif" }),
    listDokumen({ page: 1, limit: 1, status: "menunggu_persetujuan" }),
    listDokumen({ page: 1, limit: 1, akanKedaluwarsa: true }),
    getKpiSummary(),
    roadmapProgressSummary(),
  ]);

  const cards = [];
  if (pegawaiRes.status === "fulfilled") {
    cards.push(statCard("Pegawai Aktif", pegawaiRes.value.pagination.total, "/pegawai", "bi-people"));
  }
  if (divisiRes.status === "fulfilled") {
    cards.push(statCard("Total Divisi", divisiRes.value.pagination.total, "/divisi", "bi-diagram-3", "info"));
  }
  if (jabatanRes.status === "fulfilled") {
    cards.push(
      statCard("Total Jabatan", jabatanRes.value.pagination.total, "/jabatan", "bi-briefcase", "info"),
    );
  }
  if (cutiPendingRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Cuti Menunggu Persetujuan",
        cutiPendingRes.value.pagination.total,
        "/cuti",
        "bi-airplane",
        "warning",
      ),
    );
  }
  if (dokumenPendingRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Dokumen Menunggu Persetujuan",
        dokumenPendingRes.value.pagination.total,
        "/dokumen",
        "bi-file-earmark-text",
        "warning",
      ),
    );
  }
  if (dokumenExpiringRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Dokumen Akan Kedaluwarsa",
        dokumenExpiringRes.value.pagination.total,
        "/dokumen",
        "bi-exclamation-triangle",
        "danger",
      ),
    );
  }
  // FR-DASH-002: KPI Summary. Org-wide across all pegawai (getKpiSummary is
  // only self-scoped for role "pegawai" — admin/hrd get the full aggregate).
  if (kpiSummaryRes.status === "fulfilled") {
    const kpiSummary = kpiSummaryRes.value.data;
    cards.push(statCard("Total KPI Pegawai", kpiSummary.total, "/kpi", "bi-graph-up-arrow"));
    cards.push(
      statCard("Rata-rata Progress KPI", `${kpiSummary.averagePercentage}%`, "/kpi", "bi-speedometer2"),
    );
    cards.push(statCard("KPI Achieved", kpiSummary.byStatus.achieved, "/kpi", "bi-trophy", "success"));
    cards.push(
      statCard("KPI On Track", kpiSummary.byStatus.on_track, "/kpi", "bi-arrow-up-right-circle", "warning"),
    );
    cards.push(
      statCard("KPI At Risk", kpiSummary.byStatus.at_risk, "/kpi", "bi-exclamation-triangle", "danger"),
    );
  }
  // FR-DASH-003: progres karier, rata-rata seluruh pegawai.
  if (roadmapSummaryRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Rata-rata Progress Karier",
        `${roadmapSummaryRes.value.averageProgress}%`,
        "/roadmap-karier",
        "bi-signpost-split",
      ),
    );
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

      cards.push(statCard("Divisi Anda", escapeHtml(divisiName), "/profile", "bi-diagram-3", "info"));
      cards.push(statCard("Jabatan Anda", escapeHtml(jabatanName), "/profile", "bi-briefcase", "info"));
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

  const [absensiRes, cutiRes, dokumenExpiringRes, kpiSummaryRes, roadmapSummaryRes] =
    await Promise.allSettled([
      listAbsensi({ page: 1, limit: 1, tanggal: todayStr() }),
      listCuti({ page: 1, limit: 1, status: "diajukan" }),
      listDokumen({ page: 1, limit: 1, akanKedaluwarsa: true }),
      // getKpiSummary self-scopes for role "pegawai" and returns the org-wide
      // aggregate for pimpinan (matches "Pimpinan: memantau KPI" — a monitoring
      // role, not a personal-record view).
      getKpiSummary(),
      // roadmapProgressSummary uses GET /roadmap-karier, which is likewise
      // self-scoped for pegawai and org-wide for pimpinan.
      roadmapProgressSummary(),
    ]);

  if (absensiRes.status === "fulfilled") {
    const row = absensiRes.value.data[0];
    cards.push(
      statCard(
        "Absensi Hari Ini",
        row ? "Sudah Absen" : "Belum Absen",
        "/absensi",
        "bi-calendar-check",
        row ? "success" : "warning",
      ),
    );
  }
  if (cutiRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Cuti Menunggu Persetujuan",
        cutiRes.value.pagination.total,
        "/cuti",
        "bi-airplane",
        "warning",
      ),
    );
  }
  if (dokumenExpiringRes.status === "fulfilled") {
    cards.push(
      statCard(
        "Dokumen Anda Akan Kedaluwarsa",
        dokumenExpiringRes.value.pagination.total,
        "/dokumen",
        "bi-exclamation-triangle",
        "danger",
      ),
    );
  }
  // FR-DASH-002: KPI Summary — self-scoped for pegawai ("KPI saya"), org-wide
  // for pimpinan (getKpiSummary only self-scopes role "pegawai").
  if (kpiSummaryRes.status === "fulfilled") {
    const kpiSummary = kpiSummaryRes.value.data;
    const suffix = user.role === "pimpinan" ? " (Semua Pegawai)" : " Anda";
    cards.push(statCard(`Total KPI${suffix}`, kpiSummary.total, "/kpi", "bi-graph-up-arrow"));
    cards.push(
      statCard(
        `Rata-rata Progress KPI${suffix}`,
        `${kpiSummary.averagePercentage}%`,
        "/kpi",
        "bi-speedometer2",
      ),
    );
    cards.push(
      statCard(`KPI Achieved${suffix}`, kpiSummary.byStatus.achieved, "/kpi", "bi-trophy", "success"),
    );
    cards.push(
      statCard(
        `KPI On Track${suffix}`,
        kpiSummary.byStatus.on_track,
        "/kpi",
        "bi-arrow-up-right-circle",
        "warning",
      ),
    );
    cards.push(
      statCard(
        `KPI At Risk${suffix}`,
        kpiSummary.byStatus.at_risk,
        "/kpi",
        "bi-exclamation-triangle",
        "danger",
      ),
    );
  }
  // FR-DASH-003: progres karier.
  if (roadmapSummaryRes.status === "fulfilled") {
    const roadmapSuffix = user.role === "pimpinan" ? " (Semua Pegawai)" : " Anda";
    cards.push(
      statCard(
        `Progress Karier${roadmapSuffix}`,
        `${roadmapSummaryRes.value.averageProgress}%`,
        "/roadmap-karier",
        "bi-signpost-split",
      ),
    );
  }

  statsEl.innerHTML = cards.join("");
};

const loadStats = async (user) =>
  MANAGE_ROLES.includes(user.role) ? loadManageStats() : loadOwnDivisiJabatan(user);

// --- Reminder ---

const reminderAlert = (variant, message, href, ctaLabel, icon = "bi-bell") => `
  <div class="alert alert-${variant} d-flex justify-content-between align-items-center gap-2 mb-2">
    <span class="d-flex align-items-center gap-2"><i class="bi ${icon}"></i> ${message}</span>
    <a href="${href}" class="btn btn-sm btn-${variant} flex-shrink-0">${escapeHtml(ctaLabel)}</a>
  </div>`;

const loadReminders = async (user) => {
  const el = document.getElementById("dashboard-reminders");
  el.innerHTML = "";

  const alerts = [];

  try {
    if (MANAGE_ROLES.includes(user.role)) {
      const [cutiRes, dokumenPendingRes] = await Promise.all([
        listCuti({ page: 1, limit: 1, status: "diajukan" }),
        listDokumen({ page: 1, limit: 1, status: "menunggu_persetujuan" }),
      ]);
      if (cutiRes.pagination.total > 0) {
        alerts.push(
          reminderAlert(
            "warning",
            `Ada <strong>${cutiRes.pagination.total}</strong> pengajuan cuti yang menunggu persetujuan Anda.`,
            "/cuti",
            "Tinjau Sekarang",
            "bi-airplane",
          ),
        );
      }
      if (dokumenPendingRes.pagination.total > 0) {
        alerts.push(
          reminderAlert(
            "warning",
            `Ada <strong>${dokumenPendingRes.pagination.total}</strong> dokumen yang menunggu persetujuan Anda.`,
            "/dokumen",
            "Tinjau Sekarang",
            "bi-file-earmark-text",
          ),
        );
      }
    } else if (SELF_SERVICE_ROLES.includes(user.role)) {
      const res = await listAbsensi({ page: 1, limit: 1, tanggal: todayStr() });
      if (res.data.length === 0) {
        alerts.push(
          reminderAlert(
            "info",
            "Anda belum absen hari ini.",
            "/absensi",
            "Absen Sekarang",
            "bi-calendar-check",
          ),
        );
      }
    }

    // Expiring-document reminder applies to every role — self-scoped for
    // pegawai/pimpinan (the Service always self-scopes non-manager roles),
    // org-wide for admin/hrd.
    const dokumenExpiringRes = await listDokumen({ page: 1, limit: 1, akanKedaluwarsa: true });
    if (dokumenExpiringRes.pagination.total > 0) {
      const subject = MANAGE_ROLES.includes(user.role) ? "" : "Anda ";
      alerts.push(
        reminderAlert(
          "info",
          `Ada <strong>${dokumenExpiringRes.pagination.total}</strong> dokumen ${subject}yang akan/sudah kedaluwarsa.`,
          "/dokumen",
          "Lihat Dokumen",
          "bi-exclamation-triangle",
        ),
      );
    }

    el.innerHTML = alerts.join("");
  } catch {
    // Reminder is a convenience, not critical — fail silently rather than
    // showing an alert about the alert itself.
  }
};

// --- Quick Menu ---

const quickMenuBtn = (label, href, icon, variant = "outline-primary") =>
  `<div class="col-6 col-md-auto">
     <a href="${href}" class="btn btn-${variant} btn-sm app-quickmenu-btn">
       <i class="bi ${icon}"></i> ${escapeHtml(label)}
     </a>
   </div>`;

const loadQuickMenu = (user) => {
  const el = document.getElementById("dashboard-quickmenu");

  let buttons;
  if (MANAGE_ROLES.includes(user.role)) {
    buttons = [
      quickMenuBtn("Tambah Pegawai", "/pegawai", "bi-person-plus", "primary"),
      quickMenuBtn("Tambah Divisi", "/divisi", "bi-diagram-3"),
      quickMenuBtn("Kelola Cuti", "/cuti", "bi-airplane"),
      quickMenuBtn("Kelola Dokumen", "/dokumen", "bi-file-earmark-text"),
    ];
  } else if (SELF_SERVICE_ROLES.includes(user.role)) {
    buttons = [
      quickMenuBtn("Absen Masuk/Keluar", "/absensi", "bi-calendar-check", "primary"),
      quickMenuBtn("Ajukan Cuti", "/cuti", "bi-airplane"),
      quickMenuBtn("Unggah Dokumen", "/dokumen", "bi-cloud-upload"),
    ];
  } else {
    // Pimpinan: read-only across Absensi/Cuti/Dokumen (POST is 403 for
    // them), so their quick menu only offers navigation, not actions.
    buttons = [
      quickMenuBtn("Lihat Absensi", "/absensi", "bi-calendar-check"),
      quickMenuBtn("Lihat Cuti", "/cuti", "bi-airplane"),
      quickMenuBtn("Lihat Dokumen", "/dokumen", "bi-file-earmark-text"),
    ];
  }

  el.innerHTML = buttons.join("");
};

// --- Recent Activity ---

const activityCard = (title, bodyHtml, icon = "bi-clock-history") => `
  <div class="col-12 col-lg-6">
    <div class="card h-100">
      <div class="card-header d-flex align-items-center gap-2">
        <i class="bi ${icon} text-primary"></i> ${escapeHtml(title)}
      </div>
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

const DOKUMEN_STATUS_VARIANTS = {
  menunggu_persetujuan: { color: "warning", label: "Menunggu Persetujuan" },
  disetujui: { color: "success", label: "Disetujui" },
  ditolak: { color: "danger", label: "Ditolak" },
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
          <span class="d-flex align-items-center gap-2">
            ${row.status ? renderStatusBadge(row.status, DOKUMEN_STATUS_VARIANTS) : ""}
            <span class="text-muted small">${formatDateTime(row.createdAt)}</span>
          </span>
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
        activityCard("Pengajuan Cuti Terbaru", cutiActivityList(cutiRes.data, pegawaiMap), "bi-airplane"),
        activityCard(
          "Dokumen Terbaru",
          dokumenActivityList(dokumenRes.data, pegawaiMap),
          "bi-file-earmark-text",
        ),
      ].join("");
      return;
    }

    const [absensiRes, cutiRes] = await Promise.all([
      listAbsensi({ page: 1, limit: 5 }),
      listCuti({ page: 1, limit: 5 }),
    ]);

    el.innerHTML = [
      activityCard("Absensi Terbaru Anda", absensiActivityList(absensiRes.data), "bi-calendar-check"),
      activityCard("Cuti Terbaru Anda", cutiActivityList(cutiRes.data, null), "bi-airplane"),
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
    <div class="card app-welcome-card">
      <div class="card-body d-flex align-items-center gap-3">
        <span class="app-user-avatar app-welcome-avatar">${escapeHtml(user.email.slice(0, 2).toUpperCase())}</span>
        <div>
          <h2 class="h5 mb-1">Selamat datang, ${escapeHtml(user.email)}</h2>
          <span class="badge text-bg-primary text-capitalize">${escapeHtml(user.role)}</span>
        </div>
      </div>
    </div>
  `;

  await Promise.all([loadReminders(user), loadStats(user), loadActivity(user)]);
  loadQuickMenu(user);
};

init();
