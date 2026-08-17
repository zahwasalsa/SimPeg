import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";
import {
  listKpi,
  getKpi,
  createKpi,
  updateKpi,
  deleteKpi,
  listKpiDetail,
  createKpiDetail,
  updateKpiDetail,
  deleteKpiDetail,
  getKpiSummary,
} from "../api/kpi.js";
import { listPegawai, getPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];

// dokumentasi keputusan ambang batas ada di docs/database.md (blueprint
// tidak menetapkan angka ini — hanya label status yang dipakai di sini).
// Warna mengikuti konvensi traffic-light: abu-abu (belum mulai), merah
// (berisiko), kuning (berjalan, belum selesai), hijau (tercapai) — dipakai
// bersama oleh badge status dan progress bar supaya konsisten.
const STATUS_VARIANTS = {
  not_started: { color: "secondary", label: "Belum Mulai" },
  at_risk: { color: "danger", label: "Berisiko" },
  on_track: { color: "warning", label: "On Track" },
  achieved: { color: "success", label: "Tercapai" },
};

const tableEl = document.getElementById("kpi-table");
const paginationEl = document.getElementById("kpi-pagination");
const summaryCardsEl = document.getElementById("kpi-summary-cards");
const addBtn = document.getElementById("kpi-add-btn");
const exportBtn = document.getElementById("kpi-export-btn");
const filterPegawaiWrap = document.getElementById("kpi-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("kpi-filter-pegawai");
const filterPeriodEl = document.getElementById("kpi-filter-period");
const filterStatusEl = document.getElementById("kpi-filter-status");

const state = { page: 1, limit: 10, pegawaiId: undefined, period: undefined, status: undefined };
let currentUser = null;
let pegawaiMap = {};

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
// Backend already scopes the list to the caller's own records for role
// "pegawai" (see kpi.service.js#listKpi) — so every row a pegawai sees here
// is inherently their own, no client-side ownership check is needed.
const isPegawai = () => Boolean(currentUser && currentUser.role === "pegawai");

const loadPegawaiLookup = async () => {
  const res = await listPegawai({ page: 1, limit: 100 });
  pegawaiMap = Object.fromEntries(res.data.map((p) => [p.id, `${p.nip} - ${p.namaLengkap}`]));

  filterPegawaiEl.innerHTML =
    `<option value="">Semua Pegawai</option>` +
    res.data
      .map((p) => `<option value="${p.id}">${escapeHtml(`${p.nip} - ${p.namaLengkap}`)}</option>`)
      .join("");
};

// Bar width is clamped to 100% (a bar can't visually exceed its container),
// but the printed label always shows the real, uncapped percentage — capaian
// yang sesungguhnya tidak boleh hilang meski progress bar-nya penuh. Width
// is carried via `data-width` and applied through `element.style.width` in
// JS (see applyProgressBarWidths) rather than an inline `style` HTML
// attribute — the app's CSP (style-src 'self') blocks the latter.
const progressBarHtml = (row) => {
  const width = Math.min(Math.max(row.percentage, 0), 100);
  const color = STATUS_VARIANTS[row.status]?.color || "secondary";
  return `
    <div class="progress kpi-progress" role="progressbar" aria-label="Progress KPI"
      aria-valuenow="${row.percentage}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar bg-${color}" data-width="${width}">${row.percentage}%</div>
    </div>`;
};

// Per-indicator progress, purely a display convenience computed from data
// the API already returns (realization/target) — it does NOT recompute or
// override the parent KPI's authoritative percentage/status, which always
// comes from the backend (see kpi.service.js#calculatePercentage). Uses the
// same round2(realization/target*100), 0-if-target-0 formula as the backend
// so the bar's number always matches what the backend would show for this
// one indicator in isolation.
const detailPercentage = (row) => {
  const target = Number(row.target);
  if (target === 0) {
    return 0;
  }
  return Math.round((Number(row.realization) / target) * 100 * 100) / 100;
};

// Same 4-bucket thresholds as the KPI-level status (not_started/at_risk/
// on_track/achieved, see docs/database.md §13) applied to a single
// indicator's own percentage — for color-coding only, kpi_detail rows don't
// have their own `status` column.
const colorForPercentage = (pct) => {
  if (pct === 0) {
    return "secondary";
  }
  if (pct < 70) {
    return "danger";
  }
  if (pct < 100) {
    return "warning";
  }
  return "success";
};

const indicatorProgressBarHtml = (row) => {
  const pct = detailPercentage(row);
  const width = Math.min(Math.max(pct, 0), 100);
  const color = colorForPercentage(pct);
  return `
    <div class="progress kpi-progress" role="progressbar" aria-label="Progress Indikator"
      aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar bg-${color}" data-width="${width}">${pct}%</div>
    </div>`;
};

const applyProgressBarWidths = (container) => {
  container.querySelectorAll(".progress-bar[data-width]").forEach((el) => {
    el.style.width = `${el.dataset.width}%`;
  });
};

const columns = () => {
  const base = [];

  if (canManage() || (currentUser && currentUser.role === "pimpinan")) {
    base.push({
      key: "pegawai",
      label: "Pegawai",
      render: (row) => escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId),
    });
  }

  base.push(
    { key: "period", label: "Periode" },
    { key: "target", label: "Target" },
    { key: "achievement", label: "Capaian" },
    { key: "progress", label: "Progress", render: (row) => progressBarHtml(row) },
    { key: "status", label: "Status", render: (row) => renderStatusBadge(row.status, STATUS_VARIANTS) },
    {
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>`,
        ];
        if (isPegawai()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-primary me-1" data-action="input-capaian" data-id="${row.id}" type="button">Input Capaian</button>`,
          );
        }
        if (canManage()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-target" data-id="${row.id}" type="button">Edit Target</button>`,
            `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" type="button">Hapus</button>`,
          );
        }
        return buttons.join("");
      },
    },
  );

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listKpi(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data KPI",
    });
    applyProgressBarWidths(tableEl);
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data KPI");
  }
};

// Summary cards double as status shortcuts — clicking one sets the Status
// filter and reloads the table, same data source as the badges/progress
// bars below so the numbers always agree with what's in the table.
const summaryCardHtml = (label, value, statusValue, colorClass) => `
  <div class="col-6 col-md-4 col-lg">
    <button type="button" class="btn btn-outline-secondary border w-100 h-100 text-start kpi-summary-card"
      data-status="${statusValue}">
      <div class="text-muted small">${escapeHtml(label)}</div>
      <div class="h4 mb-0 ${colorClass}">${value}</div>
    </button>
  </div>`;

const loadSummary = async () => {
  try {
    const res = await getKpiSummary({ pegawaiId: state.pegawaiId, period: state.period });
    const s = res.data;
    summaryCardsEl.innerHTML = [
      summaryCardHtml("Total KPI", s.total, "", ""),
      summaryCardHtml("Belum Mulai", s.byStatus.not_started, "not_started", "text-secondary"),
      summaryCardHtml("Berisiko", s.byStatus.at_risk, "at_risk", "text-danger"),
      summaryCardHtml("On Track", s.byStatus.on_track, "on_track", "text-warning"),
      summaryCardHtml("Tercapai", s.byStatus.achieved, "achieved", "text-success"),
    ].join("");
  } catch {
    summaryCardsEl.innerHTML =
      '<div class="col-12"><div class="alert alert-warning mb-0">Ringkasan KPI belum bisa dimuat.</div></div>';
  }
};

// --- "+ Tambah KPI" (Admin/HRD) — hand-rolled modal, not openFormModal ---
// The shared modalForm.js component only renders a flat field list; this
// form needs a repeatable "add another indicator" group (Indikator/Target
// Indikator/Bobot per row), which is specific enough to this one form that
// extending the shared component wasn't worth the added complexity there —
// same reasoning as the existing hand-rolled Detail modal in this file.

let createModalEl = null;
let indicatorRowSeq = 0;

const indicatorRowHtml = (rowId) => `
  <div class="row g-2 mb-2 align-items-end kpi-indicator-row" data-row-id="${rowId}">
    <div class="col-sm-5">
      <label class="form-label small mb-1">Indikator</label>
      <input type="text" class="form-control form-control-sm kpi-row-indicator" placeholder="Contoh: Publikasi" required />
    </div>
    <div class="col-sm-3">
      <label class="form-label small mb-1">Target Indikator</label>
      <input type="number" class="form-control form-control-sm kpi-row-target" placeholder="Contoh: 4" required />
    </div>
    <div class="col-sm-3">
      <label class="form-label small mb-1">Bobot</label>
      <input type="number" class="form-control form-control-sm kpi-row-weight" placeholder="Contoh: 40" />
    </div>
    <div class="col-sm-1">
      <button type="button" class="btn btn-sm btn-outline-danger w-100" data-action="remove-row"
        title="Hapus indikator ini">&times;</button>
    </div>
  </div>`;

const addIndicatorRow = () => {
  indicatorRowSeq += 1;
  document
    .getElementById("kpi-create-rows")
    .insertAdjacentHTML("beforeend", indicatorRowHtml(indicatorRowSeq));
};

const buildCreateModal = () => {
  const el = document.createElement("div");
  el.id = "kpi-create-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <form id="kpi-create-form" novalidate>
          <div class="modal-header">
            <h5 class="modal-title">Tambah KPI</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label" for="kpi-create-pegawai">Pegawai</label>
              <select class="form-select" id="kpi-create-pegawai" required></select>
            </div>
            <div class="row g-2 mb-3">
              <div class="col-sm-6">
                <label class="form-label" for="kpi-create-period">Periode</label>
                <input type="text" class="form-control" id="kpi-create-period" placeholder="Contoh: 2026-1" required />
              </div>
              <div class="col-sm-6">
                <label class="form-label" for="kpi-create-target">Target KPI</label>
                <input type="number" class="form-control" id="kpi-create-target" required />
              </div>
            </div>
            <hr />
            <div class="d-flex justify-content-between align-items-center mb-1">
              <h6 class="mb-0">Indikator</h6>
              <button type="button" class="btn btn-sm btn-outline-primary" id="kpi-create-add-row-btn">
                + Tambah Indikator
              </button>
            </div>
            <p class="form-text mb-2">
              Opsional — boleh menambahkan beberapa indikator sekaligus (contoh: Publikasi target 4
              bobot 40, Penelitian target 2 bobot 30, Pengajaran target 100 bobot 30). Kosongkan
              seluruhnya jika KPI ini cukup memakai Target KPI di atas saja, tanpa rincian.
            </p>
            <div id="kpi-create-rows"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="submit" class="btn btn-primary" id="kpi-create-submit-btn">Simpan</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("kpi-create-add-row-btn").addEventListener("click", addIndicatorRow);

  document.getElementById("kpi-create-rows").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='remove-row']");
    if (btn) {
      btn.closest(".kpi-indicator-row").remove();
    }
  });

  document.getElementById("kpi-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitCreateForm(el);
  });

  return el;
};

const resetCreateForm = () => {
  document.getElementById("kpi-create-form").reset();
  document.getElementById("kpi-create-rows").innerHTML = "";
  document.getElementById("kpi-create-pegawai").innerHTML = Object.entries(pegawaiMap)
    .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
    .join("");
};

const submitCreateForm = async (modalEl) => {
  const pegawaiId = document.getElementById("kpi-create-pegawai").value;
  const period = document.getElementById("kpi-create-period").value.trim();
  const target = Number(document.getElementById("kpi-create-target").value);

  const rows = Array.from(document.querySelectorAll("#kpi-create-rows .kpi-indicator-row"));
  const details = rows.map((row) => {
    const weightInput = row.querySelector(".kpi-row-weight").value;
    return {
      indicator: row.querySelector(".kpi-row-indicator").value.trim(),
      target: Number(row.querySelector(".kpi-row-target").value),
      ...(weightInput === "" ? {} : { weight: Number(weightInput) }),
    };
  });

  const submitBtn = document.getElementById("kpi-create-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";

  try {
    const payload = { pegawaiId, period, target };
    if (details.length > 0) {
      payload.details = details;
    }
    await createKpi(payload);
    showToast("KPI berhasil dibuat", "success");
    window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    state.page = 1;
    await Promise.all([load(), loadSummary()]);
  } catch (err) {
    showToast(err.message || "Gagal menyimpan KPI", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan";
  }
};

const openCreateModal = () => {
  const el = createModalEl || (createModalEl = buildCreateModal());
  resetCreateForm();
  window.bootstrap.Modal.getOrCreateInstance(el).show();
};

const openEditTargetModal = async (id) => {
  try {
    const res = await getKpi(id);
    const k = res.data;
    openFormModal({
      title: "Edit Target KPI",
      fields: [
        { name: "period", label: "Periode", required: true, value: k.period },
        { name: "target", label: "Target", type: "number", required: true, value: k.target },
      ],
      onSubmit: async (values) => {
        await updateKpi(id, { period: values.period, target: Number(values.target) });
        showToast("Target KPI berhasil diperbarui", "success");
        await Promise.all([load(), loadSummary()]);
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data KPI", "danger");
  }
};

const openInputCapaianModal = async (id) => {
  try {
    const res = await getKpi(id);
    const k = res.data;
    openFormModal({
      title: "Input Capaian KPI",
      fields: [
        { name: "achievement", label: "Capaian", type: "number", required: true, value: k.achievement },
      ],
      submitLabel: "Simpan",
      onSubmit: async (values) => {
        await updateKpi(id, { achievement: Number(values.achievement) });
        showToast("Capaian KPI berhasil disimpan", "success");
        await Promise.all([load(), loadSummary()]);
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data KPI", "danger");
  }
};

const handleDelete = async (id) => {
  if (!window.confirm("Hapus data KPI ini? Data akan disembunyikan dari daftar.")) {
    return;
  }
  try {
    await deleteKpi(id);
    showToast("Data KPI berhasil dihapus", "success");
    await Promise.all([load(), loadSummary()]);
  } catch (err) {
    showToast(err.message || "Gagal menghapus data KPI", "danger");
  }
};

// --- Detail modal + rincian indikator (kpi_detail) ---

let detailModalEl = null;
let currentDetailKpiId = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "kpi-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail KPI</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <dl class="row mb-0" id="kpi-detail-metadata"></dl>
          <hr />
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Rincian Indikator</h6>
            <button id="kpi-indicator-add-btn" class="btn btn-sm btn-primary d-none" type="button">
              + Tambah Indikator
            </button>
          </div>
          <div id="kpi-indicator-list"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("kpi-indicator-add-btn").addEventListener("click", () => {
    if (currentDetailKpiId) {
      openIndicatorCreateModal(currentDetailKpiId);
    }
  });

  document.getElementById("kpi-indicator-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || !currentDetailKpiId) {
      return;
    }
    const { action, detailid } = btn.dataset;
    if (action === "edit-indicator") {
      openIndicatorEditModal(currentDetailKpiId, detailid);
    } else if (action === "input-realisasi") {
      openIndicatorRealisasiModal(currentDetailKpiId, detailid);
    } else if (action === "delete-indicator") {
      handleIndicatorDelete(currentDetailKpiId, detailid);
    }
  });

  return el;
};

const detailRow = (label, value) => `
  <dt class="col-5">${escapeHtml(label)}</dt>
  <dd class="col-7">${value}</dd>`;

const indicatorColumns = () => {
  const cols = [
    { key: "indicator", label: "Indikator" },
    { key: "target", label: "Target" },
    { key: "realization", label: "Realisasi" },
    { key: "weight", label: "Bobot" },
    { key: "progress", label: "Progress", render: (row) => indicatorProgressBarHtml(row) },
  ];

  if (canManage() || isPegawai()) {
    cols.push({
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [];
        if (isPegawai()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-primary me-1" data-action="input-realisasi" data-detailid="${row.id}" type="button">Input Realisasi</button>`,
          );
        }
        if (canManage()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-indicator" data-detailid="${row.id}" type="button">Edit</button>`,
            `<button class="btn btn-sm btn-outline-danger" data-action="delete-indicator" data-detailid="${row.id}" type="button">Hapus</button>`,
          );
        }
        return buttons.join("");
      },
    });
  }

  return cols;
};

const loadIndicatorList = async (kpiId) => {
  const listEl = document.getElementById("kpi-indicator-list");
  renderTable(listEl, { columns: indicatorColumns(), rows: [], loading: true });

  try {
    const res = await listKpiDetail(kpiId);
    renderTable(listEl, {
      columns: indicatorColumns(),
      rows: res.data,
      emptyMessage: "Belum ada indikator",
    });
    applyProgressBarWidths(listEl);
  } catch (err) {
    renderErrorState(listEl, err.message || "Gagal memuat indikator KPI");
  }
};

const refreshDetailMetadata = async (id) => {
  const res = await getKpi(id);
  const k = res.data;

  const rows = [];
  if (canManage() || (currentUser && currentUser.role === "pimpinan")) {
    rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[k.pegawaiId] || k.pegawaiId)));
  }
  rows.push(
    detailRow("Periode", escapeHtml(k.period)),
    detailRow("Target", escapeHtml(String(k.target))),
    detailRow("Capaian", escapeHtml(String(k.achievement))),
    detailRow("Persentase", `${k.percentage}%`),
    detailRow("Status", renderStatusBadge(k.status, STATUS_VARIANTS)),
    detailRow("Terakhir Diubah", formatDateTime(k.updatedAt)),
  );

  document.getElementById("kpi-detail-metadata").innerHTML = rows.join("");
};

const openDetailModal = async (id) => {
  try {
    const el = detailModalEl || (detailModalEl = buildDetailModal());
    currentDetailKpiId = id;

    await refreshDetailMetadata(id);
    document.getElementById("kpi-indicator-add-btn").classList.toggle("d-none", !canManage());

    window.bootstrap.Modal.getOrCreateInstance(el).show();
    await loadIndicatorList(id);
  } catch (err) {
    showToast(err.message || "Gagal memuat detail KPI", "danger");
  }
};

const openIndicatorCreateModal = (kpiId) => {
  openFormModal({
    title: "Tambah Indikator",
    fields: [
      { name: "indicator", label: "Indikator", required: true },
      { name: "target", label: "Target", type: "number", required: true },
      { name: "weight", label: "Bobot", type: "number", helpText: "Opsional, default 0" },
    ],
    onSubmit: async (values) => {
      const payload = { indicator: values.indicator, target: Number(values.target) };
      if (values.weight !== "") {
        payload.weight = Number(values.weight);
      }
      await createKpiDetail(kpiId, payload);
      showToast("Indikator berhasil ditambahkan", "success");
      await loadIndicatorList(kpiId);
      await refreshDetailMetadata(kpiId);
      await Promise.all([load(), loadSummary()]);
    },
  });
};

const openIndicatorEditModal = async (kpiId, detailId) => {
  try {
    const res = await listKpiDetail(kpiId);
    const detail = res.data.find((d) => d.id === detailId);
    openFormModal({
      title: "Edit Indikator",
      fields: [
        { name: "indicator", label: "Indikator", required: true, value: detail?.indicator },
        { name: "target", label: "Target", type: "number", required: true, value: detail?.target },
        { name: "weight", label: "Bobot", type: "number", value: detail?.weight },
      ],
      onSubmit: async (values) => {
        await updateKpiDetail(kpiId, detailId, {
          indicator: values.indicator,
          target: Number(values.target),
          weight: Number(values.weight),
        });
        showToast("Indikator berhasil diperbarui", "success");
        await loadIndicatorList(kpiId);
        await refreshDetailMetadata(kpiId);
        await Promise.all([load(), loadSummary()]);
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data indikator", "danger");
  }
};

const openIndicatorRealisasiModal = async (kpiId, detailId) => {
  try {
    const res = await listKpiDetail(kpiId);
    const detail = res.data.find((d) => d.id === detailId);
    openFormModal({
      title: "Input Realisasi Indikator",
      fields: [
        {
          name: "realization",
          label: "Realisasi",
          type: "number",
          required: true,
          value: detail?.realization,
        },
      ],
      submitLabel: "Simpan",
      onSubmit: async (values) => {
        await updateKpiDetail(kpiId, detailId, { realization: Number(values.realization) });
        showToast("Realisasi berhasil disimpan", "success");
        await loadIndicatorList(kpiId);
        await refreshDetailMetadata(kpiId);
        await Promise.all([load(), loadSummary()]);
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data indikator", "danger");
  }
};

const handleIndicatorDelete = async (kpiId, detailId) => {
  if (!window.confirm("Hapus indikator ini?")) {
    return;
  }
  try {
    await deleteKpiDetail(kpiId, detailId);
    showToast("Indikator berhasil dihapus", "success");
    await loadIndicatorList(kpiId);
    await refreshDetailMetadata(kpiId);
    await Promise.all([load(), loadSummary()]);
  } catch (err) {
    showToast(err.message || "Gagal menghapus indikator", "danger");
  }
};

// FR-KPI-007: client-side CSV export of the currently filtered list (all
// matching rows across every page, not just the current page) — no dedicated
// backend export endpoint was added since the existing GET /kpi already
// returns everything needed for a flat report. Fetched in pages of 100
// (kpi.validation.js caps `limit` at 100) rather than one large request.
const EXPORT_PAGE_SIZE = 100;

const fetchAllKpiForExport = async () => {
  const first = await listKpi({ ...state, page: 1, limit: EXPORT_PAGE_SIZE });
  const rows = [...first.data];
  const totalPages = first.pagination.total_pages;
  for (let page = 2; page <= totalPages; page += 1) {
    const res = await listKpi({ ...state, page, limit: EXPORT_PAGE_SIZE });
    rows.push(...res.data);
  }
  return rows;
};

// Pegawai only ever sees/exports their own KPI (backend-scoped), so their
// own name is resolved once instead of loading the full pegawai lookup.
const resolvePegawaiName = async (row) => {
  if (pegawaiMap[row.pegawaiId]) {
    return pegawaiMap[row.pegawaiId];
  }
  if (currentUser && currentUser.pegawaiId === row.pegawaiId) {
    try {
      const res = await getPegawai(row.pegawaiId);
      pegawaiMap[row.pegawaiId] = `${res.data.nip} - ${res.data.namaLengkap}`;
      return pegawaiMap[row.pegawaiId];
    } catch {
      return row.pegawaiId;
    }
  }
  return row.pegawaiId;
};

const handleExport = async () => {
  try {
    const rows = await fetchAllKpiForExport();
    const header = ["Pegawai", "Periode", "Target", "Achievement", "Percentage", "Status"];
    const csvEscape = (value) => `"${String(value).replace(/"/g, '""')}"`;
    const lines = [header.map(csvEscape).join(",")];
    for (const row of rows) {
      const cells = [
        await resolvePegawaiName(row),
        row.period,
        row.target,
        row.achievement,
        `${row.percentage}%`,
        STATUS_VARIANTS[row.status]?.label || row.status,
      ];
      lines.push(cells.map(csvEscape).join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan-kpi-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast(err.message || "Gagal mengekspor laporan KPI", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/kpi");

  // Pegawai lookup is needed for the "Pegawai" table column (admin/hrd/
  // pimpinan all see multi-pegawai rows), but the filter dropdown itself is
  // admin/HRD only per the approved design — pimpinan monitors everyone
  // without a per-pegawai narrowing control.
  if (canManage() || currentUser.role === "pimpinan") {
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
  }
  if (canManage()) {
    filterPegawaiWrap.classList.remove("d-none");
  }

  if (canManage()) {
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openCreateModal);
  }

  exportBtn.addEventListener("click", handleExport);

  tableEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) {
      return;
    }
    const { action, id } = btn.dataset;
    if (action === "detail") {
      openDetailModal(id);
    } else if (action === "input-capaian") {
      openInputCapaianModal(id);
    } else if (action === "edit-target") {
      openEditTargetModal(id);
    } else if (action === "delete") {
      handleDelete(id);
    }
  });

  summaryCardsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-status]");
    if (!btn) {
      return;
    }
    state.status = btn.dataset.status || undefined;
    filterStatusEl.value = btn.dataset.status || "";
    state.page = 1;
    load();
  });

  filterPegawaiEl?.addEventListener("change", () => {
    state.pegawaiId = filterPegawaiEl.value || undefined;
    state.page = 1;
    load();
    loadSummary();
  });

  filterPeriodEl.addEventListener("change", () => {
    state.period = filterPeriodEl.value.trim() || undefined;
    state.page = 1;
    load();
    loadSummary();
  });

  filterStatusEl.addEventListener("change", () => {
    state.status = filterStatusEl.value || undefined;
    state.page = 1;
    load();
  });

  await Promise.all([load(), loadSummary()]);
};

init();
