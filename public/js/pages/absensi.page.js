import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate } from "../utils/format.js";
import { listAbsensi, getAbsensi, createAbsensi, updateAbsensi, deleteAbsensi } from "../api/absensi.js";
import { listPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];

// Only jamMasuk/jamKeluar/keterangan are optional+nullable at the backend;
// blank inputs must be stripped (see the equivalent note in pegawai.page.js)
// rather than sent as "".
const OPTIONAL_KEYS = ["jamMasuk", "jamKeluar", "keterangan"];

const STATUS_VARIANTS = {
  hadir: { color: "success", label: "Hadir" },
  izin: { color: "info", label: "Izin" },
  sakit: { color: "warning", label: "Sakit" },
  alpha: { color: "danger", label: "Alpha" },
  cuti: { color: "secondary", label: "Cuti" },
};

const STATUS_OPTIONS = [
  { value: "hadir", label: "Hadir" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  { value: "alpha", label: "Alpha" },
  { value: "cuti", label: "Cuti" },
];

const tableEl = document.getElementById("absensi-table");
const paginationEl = document.getElementById("absensi-pagination");
const addBtn = document.getElementById("absensi-add-btn");
const todayPanelEl = document.getElementById("absensi-today-panel");
const filterPegawaiWrap = document.getElementById("absensi-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("absensi-filter-pegawai");
const filterTanggalEl = document.getElementById("absensi-filter-tanggal");
const filterStatusEl = document.getElementById("absensi-filter-status");

const state = { page: 1, limit: 10, pegawaiId: undefined, tanggal: undefined, status: undefined };
let currentUser = null;
let pegawaiMap = {};

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
const isPegawai = () => Boolean(currentUser && currentUser.role === "pegawai");

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTimeStr = () => new Date().toTimeString().slice(0, 5);
const trimSeconds = (value) => (value ? value.slice(0, 5) : "-");

const sanitizePayload = (values) => {
  const payload = { ...values };
  OPTIONAL_KEYS.forEach((key) => {
    if (payload[key] === "") {
      delete payload[key];
    }
  });
  return payload;
};

const loadPegawaiLookup = async () => {
  const res = await listPegawai({ page: 1, limit: 100 });
  pegawaiMap = Object.fromEntries(res.data.map((p) => [p.id, `${p.nip} - ${p.namaLengkap}`]));

  filterPegawaiEl.innerHTML =
    `<option value="">Semua Pegawai</option>` +
    res.data
      .map((p) => `<option value="${p.id}">${escapeHtml(`${p.nip} - ${p.namaLengkap}`)}</option>`)
      .join("");
};

const columns = () => {
  const base = [];

  if (canManage()) {
    base.push({
      key: "pegawai",
      label: "Pegawai",
      render: (row) => escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId),
    });
  }

  base.push(
    { key: "tanggal", label: "Tanggal", render: (row) => formatDate(row.tanggal) },
    { key: "jamMasuk", label: "Jam Masuk", render: (row) => trimSeconds(row.jamMasuk) },
    { key: "jamKeluar", label: "Jam Keluar", render: (row) => trimSeconds(row.jamKeluar) },
    { key: "status", label: "Status", render: (row) => renderStatusBadge(row.status, STATUS_VARIANTS) },
    { key: "keterangan", label: "Keterangan", render: (row) => escapeHtml(row.keterangan || "-") },
  );

  if (canManage()) {
    base.push({
      key: "actions",
      label: "",
      render: (row) => `
        <div class="table-actions">
          <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${row.id}" type="button">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(formatDate(row.tanggal))}" type="button">Hapus</button>
        </div>
      `,
    });
  }

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listAbsensi(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data absensi",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data absensi");
  }
};

const renderTodayPanel = async () => {
  todayPanelEl.innerHTML = '<div class="text-muted">Memuat status absensi hari ini...</div>';

  try {
    const res = await listAbsensi({ page: 1, limit: 1, tanggal: todayStr() });
    const row = res.data[0];

    let body;
    if (!row) {
      body = `
        <p class="mb-2">Anda belum absen hari ini.</p>
        <button id="absensi-checkin-btn" class="btn btn-success btn-sm" type="button">Absen Masuk</button>`;
    } else if (!row.jamKeluar) {
      body = `
        <p class="mb-2">Anda sudah absen masuk jam <strong>${trimSeconds(row.jamMasuk)}</strong>.</p>
        <button id="absensi-checkout-btn" class="btn btn-primary btn-sm" type="button">Absen Keluar</button>`;
    } else {
      body = `<p class="mb-0">Absensi hari ini sudah lengkap (masuk <strong>${trimSeconds(row.jamMasuk)}</strong> - keluar <strong>${trimSeconds(row.jamKeluar)}</strong>).</p>`;
    }

    todayPanelEl.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h2 class="h6 mb-2">Absensi Hari Ini (${formatDate(todayStr())})</h2>
          ${body}
        </div>
      </div>`;

    document.getElementById("absensi-checkin-btn")?.addEventListener("click", async () => {
      try {
        await createAbsensi({ tanggal: todayStr(), jamMasuk: nowTimeStr() });
        showToast("Absen masuk berhasil dicatat", "success");
        await renderTodayPanel();
        await load();
      } catch (err) {
        showToast(err.message || "Gagal mencatat absen masuk", "danger");
      }
    });

    document.getElementById("absensi-checkout-btn")?.addEventListener("click", async () => {
      try {
        await createAbsensi({ tanggal: todayStr(), jamKeluar: nowTimeStr() });
        showToast("Absen keluar berhasil dicatat", "success");
        await renderTodayPanel();
        await load();
      } catch (err) {
        showToast(err.message || "Gagal mencatat absen keluar", "danger");
      }
    });
  } catch (err) {
    todayPanelEl.innerHTML = `<div class="alert alert-warning mb-0">${escapeHtml(err.message || "Gagal memuat status absensi hari ini")}</div>`;
  }
};

const formFields = ({ includePegawaiId, values = {} } = {}) => {
  const fields = [];

  if (includePegawaiId) {
    fields.push({
      name: "pegawaiId",
      label: "Pegawai",
      type: "select",
      required: true,
      value: values.pegawaiId,
      options: Object.entries(pegawaiMap).map(([value, label]) => ({ value, label })),
    });
  }

  fields.push(
    { name: "tanggal", label: "Tanggal", type: "date", required: true, value: values.tanggal || todayStr() },
    {
      name: "jamMasuk",
      label: "Jam Masuk",
      type: "time",
      value: values.jamMasuk ? values.jamMasuk.slice(0, 5) : "",
    },
    {
      name: "jamKeluar",
      label: "Jam Keluar",
      type: "time",
      value: values.jamKeluar ? values.jamKeluar.slice(0, 5) : "",
    },
    {
      name: "status",
      label: "Status",
      type: "select",
      value: values.status || "hadir",
      options: STATUS_OPTIONS,
    },
    { name: "keterangan", label: "Keterangan", type: "textarea", value: values.keterangan },
  );

  return fields;
};

const openCreateModal = () => {
  openFormModal({
    title: "Tambah Absensi",
    fields: formFields({ includePegawaiId: true }),
    onSubmit: async (values) => {
      await createAbsensi(sanitizePayload(values));
      showToast("Absensi berhasil ditambahkan", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getAbsensi(id);
    openFormModal({
      title: "Edit Absensi",
      fields: formFields({ includePegawaiId: false, values: res.data }),
      onSubmit: async (values) => {
        await updateAbsensi(id, sanitizePayload(values));
        showToast("Absensi berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat detail absensi", "danger");
  }
};

const handleDelete = async (id, tanggal) => {
  if (!window.confirm(`Hapus data absensi tanggal ${tanggal}? Data akan disembunyikan dari daftar.`)) {
    return;
  }
  try {
    await deleteAbsensi(id);
    showToast("Absensi berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus absensi", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/absensi");

  if (canManage()) {
    filterPegawaiWrap.classList.remove("d-none");
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openCreateModal);
  }

  if (isPegawai()) {
    await renderTodayPanel();
  }

  tableEl.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit']");
    if (editBtn) {
      openEditModal(editBtn.dataset.id);
      return;
    }
    const deleteBtn = event.target.closest("[data-action='delete']");
    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }
  });

  filterPegawaiEl.addEventListener("change", () => {
    state.pegawaiId = filterPegawaiEl.value || undefined;
    state.page = 1;
    load();
  });

  filterTanggalEl.addEventListener("change", () => {
    state.tanggal = filterTanggalEl.value || undefined;
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
