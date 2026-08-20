import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";
import {
  listRoadmapKarier,
  getRoadmapKarier,
  createRoadmapKarier,
  updateRoadmapKarier,
  deleteRoadmapKarier,
} from "../api/roadmapKarier.js";
import { listPegawai } from "../api/pegawai.js";
import { listJabatan } from "../api/jabatan.js";

const STAFF_ROLES = ["admin", "hrd"];

// FR-CAREER-001..004. Label wording ("In Progress"/"Eligible"/"Promoted") is
// used verbatim as given — unlike KPI's status badges, this module was not
// asked to translate them to Indonesian. Colors: secondary (baseline, still
// underway), info (a positive-but-not-final signal — ready), success (done)
// — same vocabulary already used elsewhere (e.g. absensi's "izin").
const STATUS_VARIANTS = {
  in_progress: { color: "secondary", label: "In Progress" },
  eligible: { color: "info", label: "Eligible" },
  promoted: { color: "success", label: "Promoted" },
};

const STATUS_ORDER = ["in_progress", "eligible", "promoted"];

const tableEl = document.getElementById("roadmap-table");
const paginationEl = document.getElementById("roadmap-pagination");
const addBtn = document.getElementById("roadmap-add-btn");
const filterPegawaiWrap = document.getElementById("roadmap-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("roadmap-filter-pegawai");
const filterStatusEl = document.getElementById("roadmap-filter-status");

const state = { page: 1, limit: 10, pegawaiId: undefined, status: undefined };
let currentUser = null;
let pegawaiMap = {};
let jabatanMap = {};
let jabatanOptions = [];

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));

// GET /pegawai (list) is admin/hrd-only at the backend — pimpinan also gets
// 403 here (confirmed live), so unlike KPI's page (which calls this for
// canManage()||pimpinan and silently falls back to a raw UUID for pimpinan),
// this is only ever called for canManage(). The "Pegawai" column is likewise
// hidden for pimpinan below — showing a column pimpinan can never resolve to
// a name isn't a real view of "roadmap pegawai", and calling this endpoint
// for them would just throw an avoidable 403 on every load.
const loadPegawaiLookup = async () => {
  const res = await listPegawai({ page: 1, limit: 100 });
  pegawaiMap = Object.fromEntries(res.data.map((p) => [p.id, `${p.nip} - ${p.namaLengkap}`]));

  filterPegawaiEl.innerHTML =
    `<option value="">Semua Pegawai</option>` +
    res.data
      .map((p) => `<option value="${p.id}">${escapeHtml(`${p.nip} - ${p.namaLengkap}`)}</option>`)
      .join("");
};

// GET /jabatan (list) is open to every role — loaded unconditionally since
// every role sees jabatan names in the table (own row for pegawai).
const loadJabatanLookup = async () => {
  const res = await listJabatan({ page: 1, limit: 100 });
  jabatanMap = Object.fromEntries(res.data.map((j) => [j.id, j.namaJabatan]));
  jabatanOptions = res.data.map((j) => ({ value: j.id, label: j.namaJabatan }));
};

// Width set via JS (element.style.width) after render, never an inline
// `style` attribute — the app's CSP (style-src 'self') blocks the latter
// (same pattern as KPI's progress bars).
const progressBarHtml = (row) => {
  const width = Math.min(Math.max(row.progress, 0), 100);
  const color = STATUS_VARIANTS[row.status]?.color || "secondary";
  return `
    <div class="progress roadmap-progress" role="progressbar" aria-label="Progress Roadmap Karier"
      aria-valuenow="${row.progress}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar bg-${color}" data-width="${width}"></div>
    </div>
    <div class="small text-muted mt-1">${row.progress}%</div>`;
};

const applyProgressBarWidths = (container) => {
  container.querySelectorAll(".progress-bar[data-width]").forEach((el) => {
    el.style.width = `${el.dataset.width}%`;
  });
};

const jabatanLabel = (id) => (id ? jabatanMap[id] || id : "-");

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
    {
      key: "jabatanSaatIni",
      label: "Jabatan Saat Ini",
      render: (row) => escapeHtml(jabatanLabel(row.jabatanSaatIniId)),
    },
    {
      key: "jabatanTarget",
      label: "Target Jabatan",
      render: (row) => escapeHtml(jabatanLabel(row.jabatanTargetId)),
    },
    { key: "progress", label: "Progress", render: (row) => progressBarHtml(row) },
    { key: "status", label: "Status", render: (row) => renderStatusBadge(row.status, STATUS_VARIANTS) },
    {
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button"><i class="bi bi-eye"></i> Detail</button>`,
        ];
        if (canManage()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary me-1" data-action="edit" data-id="${row.id}" type="button"><i class="bi bi-pencil"></i> Edit</button>`,
            `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" type="button"><i class="bi bi-trash"></i> Hapus</button>`,
          );
        }
        return `<div class="table-actions">${buttons.join("")}</div>`;
      },
    },
  );

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listRoadmapKarier(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data roadmap karier",
    });
    applyProgressBarWidths(tableEl);
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data roadmap karier");
  }
};

// --- "+ Tambah Roadmap" / Edit (Admin/HRD) — plain flat fields, so this uses
// the shared modalForm.js component directly (unlike KPI, which needed a
// hand-rolled modal for its repeatable indicator rows — roadmap_karier has
// no such repeatable sub-structure).

const formFields = (values = {}) => [
  {
    name: "pegawaiId",
    label: "Pegawai",
    type: "select",
    required: true,
    value: values.pegawaiId,
    options: Object.entries(pegawaiMap).map(([value, label]) => ({ value, label })),
  },
  {
    name: "jabatanSaatIniId",
    label: "Jabatan Saat Ini",
    type: "select",
    value: values.jabatanSaatIniId,
    options: [{ value: "", label: "- Tidak ada -" }, ...jabatanOptions],
  },
  {
    name: "jabatanTargetId",
    label: "Target Jabatan",
    type: "select",
    value: values.jabatanTargetId,
    options: [{ value: "", label: "- Tidak ada -" }, ...jabatanOptions],
  },
  {
    name: "persyaratan",
    label: "Persyaratan Promosi",
    type: "textarea",
    value: values.persyaratan,
    helpText: "Opsional — deskripsi bebas syarat yang harus dipenuhi pegawai untuk promosi.",
  },
  {
    name: "progress",
    label: "Progress (%)",
    type: "number",
    value: values.progress ?? 0,
    helpText: "0-100, persentase pemenuhan persyaratan.",
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    value: values.status || "in_progress",
    options: STATUS_ORDER.map((value) => ({ value, label: STATUS_VARIANTS[value].label })),
  },
];

const sanitizePayload = (values, { includePegawaiId }) => {
  const payload = {};
  if (includePegawaiId) {
    payload.pegawaiId = values.pegawaiId;
  }
  payload.jabatanSaatIniId = values.jabatanSaatIniId || null;
  payload.jabatanTargetId = values.jabatanTargetId || null;
  payload.persyaratan = values.persyaratan || "";
  payload.progress = Number(values.progress);
  payload.status = values.status;
  return payload;
};

const openCreateModal = () => {
  openFormModal({
    title: "Tambah Roadmap Karier",
    fields: formFields(),
    onSubmit: async (values) => {
      await createRoadmapKarier(sanitizePayload(values, { includePegawaiId: true }));
      showToast("Roadmap karier berhasil dibuat", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getRoadmapKarier(id);
    const r = res.data;
    openFormModal({
      title: "Edit Roadmap Karier",
      fields: formFields(r).map((field) =>
        field.name === "pegawaiId"
          ? { ...field, type: "text", value: pegawaiMap[r.pegawaiId] || r.pegawaiId }
          : field,
      ),
      onSubmit: async (values) => {
        await updateRoadmapKarier(id, sanitizePayload(values, { includePegawaiId: false }));
        showToast("Roadmap karier berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data roadmap karier", "danger");
  }
};

const handleDelete = async (id) => {
  if (!window.confirm("Hapus data roadmap karier ini? Data akan disembunyikan dari daftar.")) {
    return;
  }
  try {
    await deleteRoadmapKarier(id);
    showToast("Roadmap karier berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus roadmap karier", "danger");
  }
};

// --- Detail modal: informasi + visualisasi roadmap (FR-CAREER-005) ---
// A position track (jabatan saat ini -> progress bar -> jabatan target) plus
// a 3-stage stepper (In Progress -> Eligible -> Promoted) highlighting the
// current stage. Pure HTML/CSS (see .roadmap-step* in app.css), no charting
// library — consistent with the rest of the app.

let detailModalEl = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "roadmap-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail Roadmap Karier</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <div id="roadmap-detail-track" class="mb-4"></div>
          <div id="roadmap-detail-stepper" class="mb-4"></div>
          <dl class="row mb-0" id="roadmap-detail-metadata"></dl>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
};

const detailRow = (label, value) => `
  <dt class="col-5">${escapeHtml(label)}</dt>
  <dd class="col-7">${value}</dd>`;

const positionTrackHtml = (row) => {
  const width = Math.min(Math.max(row.progress, 0), 100);
  const color = STATUS_VARIANTS[row.status]?.color || "secondary";
  return `
    <div class="d-flex align-items-center justify-content-between gap-3">
      <div class="text-center">
        <div class="small text-muted">Jabatan Saat Ini</div>
        <div class="fw-semibold">${escapeHtml(jabatanLabel(row.jabatanSaatIniId))}</div>
      </div>
      <div class="flex-grow-1">
        <div class="progress roadmap-progress" role="progressbar" aria-label="Progress Roadmap Karier"
          aria-valuenow="${row.progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar bg-${color}" data-width="${width}"></div>
        </div>
        <div class="small text-muted text-center mt-1">${row.progress}% menuju target</div>
      </div>
      <div class="text-center">
        <div class="small text-muted">Target Jabatan</div>
        <div class="fw-semibold">${escapeHtml(jabatanLabel(row.jabatanTargetId))}</div>
      </div>
    </div>`;
};

const stepperHtml = (row) => {
  const currentIndex = STATUS_ORDER.indexOf(row.status);
  const steps = STATUS_ORDER.map((value, index) => {
    const stateClass = index < currentIndex ? "is-complete" : index === currentIndex ? "is-current" : "";
    return `
      <div class="roadmap-step ${stateClass}">
        <div class="roadmap-step-dot">${index + 1}</div>
        <div class="roadmap-step-label">${escapeHtml(STATUS_VARIANTS[value].label)}</div>
      </div>`;
  });

  const withLines = [];
  steps.forEach((stepHtml, index) => {
    withLines.push(stepHtml);
    if (index < steps.length - 1) {
      const lineState = index < currentIndex ? "is-complete" : "";
      withLines.push(`<div class="roadmap-step-line ${lineState}"></div>`);
    }
  });

  return `<div class="roadmap-stepper">${withLines.join("")}</div>`;
};

const openDetailModal = async (id) => {
  try {
    const el = detailModalEl || (detailModalEl = buildDetailModal());
    const res = await getRoadmapKarier(id);
    const r = res.data;

    document.getElementById("roadmap-detail-track").innerHTML = positionTrackHtml(r);
    document.getElementById("roadmap-detail-stepper").innerHTML = stepperHtml(r);
    applyProgressBarWidths(document.getElementById("roadmap-detail-track"));

    const rows = [];
    if (canManage() || (currentUser && currentUser.role === "pimpinan")) {
      rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[r.pegawaiId] || r.pegawaiId)));
    }
    rows.push(
      detailRow("Persyaratan Promosi", escapeHtml(r.persyaratan || "-")),
      detailRow("Progress", `${r.progress}%`),
      detailRow("Status", renderStatusBadge(r.status, STATUS_VARIANTS)),
      detailRow("Terakhir Diubah", formatDateTime(r.updatedAt)),
    );
    document.getElementById("roadmap-detail-metadata").innerHTML = rows.join("");

    window.bootstrap.Modal.getOrCreateInstance(el).show();
  } catch (err) {
    showToast(err.message || "Gagal memuat detail roadmap karier", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/roadmap-karier");

  try {
    await loadJabatanLookup();
  } catch {
    showToast("Gagal memuat data jabatan", "danger");
  }

  // Pimpinan is intentionally excluded here (see loadPegawaiLookup comment
  // above) — the "Pegawai" column/row still shows for them (requirement:
  // pimpinan can see everyone's roadmap), just falling back to the raw
  // pegawaiId instead of a resolved name, since GET /pegawai 403s for them.
  if (canManage()) {
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
  }

  if (canManage()) {
    filterPegawaiWrap.classList.remove("d-none");
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openCreateModal);
  }

  tableEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) {
      return;
    }
    const { action, id } = btn.dataset;
    if (action === "detail") {
      openDetailModal(id);
    } else if (action === "edit") {
      openEditModal(id);
    } else if (action === "delete") {
      handleDelete(id);
    }
  });

  filterPegawaiEl?.addEventListener("change", () => {
    state.pegawaiId = filterPegawaiEl.value || undefined;
    state.page = 1;
    load();
  });

  filterStatusEl.addEventListener("change", () => {
    state.status = filterStatusEl.value || undefined;
    state.page = 1;
    load();
  });

  await load();
};

init();
