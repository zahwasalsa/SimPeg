import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";
import {
  listDokumen,
  getDokumen,
  createDokumen,
  getDokumenUrl,
  listDokumenVersi,
  createDokumenVersi,
  getDokumenVersiUrl,
  deleteDokumen,
} from "../api/dokumen.js";
import {
  listKategoriDokumen,
  createKategoriDokumen,
  updateKategoriDokumen,
  deleteKategoriDokumen,
} from "../api/kategoriDokumen.js";
import { listPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];
const SUBMIT_ROLES = ["admin", "hrd", "pegawai"]; // pimpinan cannot upload at all

// FR-DOC-007 / FR-DOC-008 client-side mirror of dokumen.upload.js — a quick
// UX check only; the backend re-validates both regardless.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MIME_LABELS = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

const tableEl = document.getElementById("dokumen-table");
const paginationEl = document.getElementById("dokumen-pagination");
const addBtn = document.getElementById("dokumen-add-btn");
const kategoriBtn = document.getElementById("dokumen-kategori-btn");
const filterPegawaiWrap = document.getElementById("dokumen-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("dokumen-filter-pegawai");
const filterKategoriEl = document.getElementById("dokumen-filter-kategori");

const state = { page: 1, limit: 10, pegawaiId: undefined, kategoriDokumenId: undefined };
let currentUser = null;
let pegawaiMap = {};
let kategoriMap = {};
let kategoriOptions = [];

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
const canSubmit = () => Boolean(currentUser && SUBMIT_ROLES.includes(currentUser.role));

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const loadKategoriLookup = async () => {
  const res = await listKategoriDokumen({ page: 1, limit: 100 });
  kategoriMap = Object.fromEntries(res.data.map((k) => [k.id, k.namaKategori]));
  kategoriOptions = res.data.map((k) => ({ value: k.id, label: k.namaKategori }));

  filterKategoriEl.innerHTML =
    `<option value="">Semua Kategori</option>` +
    res.data.map((k) => `<option value="${k.id}">${escapeHtml(k.namaKategori)}</option>`).join("");
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
    { key: "namaDokumen", label: "Nama Dokumen" },
    {
      key: "kategoriDokumenId",
      label: "Kategori",
      render: (row) => escapeHtml(kategoriMap[row.kategoriDokumenId] || "-"),
    },
    {
      key: "mimeType",
      label: "Tipe",
      render: (row) => escapeHtml(MIME_LABELS[row.mimeType] || row.mimeType),
    },
    { key: "ukuranFile", label: "Ukuran", render: (row) => formatFileSize(row.ukuranFile) },
    { key: "createdAt", label: "Diunggah", render: (row) => formatDateTime(row.createdAt) },
    {
      key: "actions",
      label: "",
      render: (row) => `
        <button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>
        <button class="btn btn-sm btn-outline-primary me-1" data-action="preview" data-id="${row.id}" type="button">Preview</button>
        <button class="btn btn-sm btn-outline-dark me-1" data-action="download" data-id="${row.id}" type="button">Unduh</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(row.namaDokumen)}" type="button">Hapus</button>
      `,
    },
  );

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listDokumen(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada dokumen",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data dokumen");
  }
};

// Opens a blank tab synchronously (inside the click handler) so the browser
// doesn't treat the later async navigation as a blocked popup, then points
// it at the signed URL once the backend responds.
const openUrlInNewTab = async (fetchUrl) => {
  const win = window.open("", "_blank");
  try {
    const res = await fetchUrl();
    if (win) {
      win.location.href = res.data.url;
    } else {
      showToast("Popup diblokir oleh browser. Izinkan popup untuk membuka dokumen.", "warning");
    }
  } catch (err) {
    if (win) {
      win.close();
    }
    showToast(err.message || "Gagal membuka dokumen", "danger");
  }
};

const openSignedUrlInNewTab = (id, { download } = {}) =>
  openUrlInNewTab(() => getDokumenUrl(id, { download }));

const openVersiUrlInNewTab = (dokumenId, versionId, { download } = {}) =>
  openUrlInNewTab(() => getDokumenVersiUrl(dokumenId, versionId, { download }));

const handleDelete = async (id, namaDokumen) => {
  if (!window.confirm(`Hapus dokumen "${namaDokumen}"? Data akan disembunyikan dari daftar.`)) {
    return;
  }
  try {
    await deleteDokumen(id);
    showToast("Dokumen berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus dokumen", "danger");
  }
};

let detailModalEl = null;
let currentDetailDokumenId = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "dokumen-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail Dokumen</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <dl class="row mb-0" id="dokumen-detail-metadata"></dl>
          <hr />
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Riwayat Versi</h6>
            <button id="dokumen-versi-upload-btn" class="btn btn-sm btn-primary d-none" type="button">
              + Unggah Versi Baru
            </button>
          </div>
          <div id="dokumen-versi-list"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("dokumen-versi-upload-btn").addEventListener("click", () => {
    if (currentDetailDokumenId) {
      openUploadVersiModal(currentDetailDokumenId);
    }
  });

  document.getElementById("dokumen-versi-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || !currentDetailDokumenId) {
      return;
    }
    const { action, versionid } = btn.dataset;
    if (action === "preview-versi") {
      openVersiUrlInNewTab(currentDetailDokumenId, versionid);
    } else if (action === "download-versi") {
      openVersiUrlInNewTab(currentDetailDokumenId, versionid, { download: true });
    }
  });

  return el;
};

const detailRow = (label, value) => `
  <dt class="col-5">${escapeHtml(label)}</dt>
  <dd class="col-7">${value}</dd>`;

// `activeNomorVersi` highlights the currently active row — derived from the
// list itself (the highest nomorVersi returned), since the API deliberately
// doesn't expose `dokumen.versiAktif` to keep POST /dokumen's response shape
// unchanged.
const versiColumns = (activeNomorVersi) => [
  {
    key: "nomorVersi",
    label: "Versi",
    render: (row) =>
      row.nomorVersi === activeNomorVersi
        ? `#${row.nomorVersi} <span class="badge text-bg-success">Aktif</span>`
        : `#${row.nomorVersi}`,
  },
  { key: "namaFileAsli", label: "Nama Berkas" },
  { key: "ukuranFile", label: "Ukuran", render: (row) => formatFileSize(row.ukuranFile) },
  { key: "createdAt", label: "Diunggah", render: (row) => formatDateTime(row.createdAt) },
  {
    key: "actions",
    label: "",
    render: (row) => `
      <button class="btn btn-sm btn-outline-primary me-1" data-action="preview-versi" data-versionid="${row.id}" type="button">Preview</button>
      <button class="btn btn-sm btn-outline-dark" data-action="download-versi" data-versionid="${row.id}" type="button">Unduh</button>
    `,
  },
];

const loadVersiList = async (dokumenId) => {
  const listEl = document.getElementById("dokumen-versi-list");
  renderTable(listEl, { columns: versiColumns(0), rows: [], loading: true });

  try {
    const res = await listDokumenVersi(dokumenId);
    const activeNomorVersi = res.data.length > 0 ? Math.max(...res.data.map((v) => v.nomorVersi)) : 0;
    renderTable(listEl, {
      columns: versiColumns(activeNomorVersi),
      rows: res.data,
      emptyMessage: "Belum ada riwayat versi",
    });
  } catch (err) {
    renderErrorState(listEl, err.message || "Gagal memuat riwayat versi");
  }
};

// Re-fetches and re-renders just the metadata block — used both on initial
// open and after a new version upload, since the mirror-on-write columns
// (namaFileAsli/mimeType/ukuranFile) on `dokumen` change with every version.
const refreshDetailMetadata = async (id) => {
  const res = await getDokumen(id);
  const d = res.data;

  const rows = [];
  if (canManage()) {
    rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[d.pegawaiId] || d.pegawaiId)));
  }
  rows.push(
    detailRow("Nama Dokumen", escapeHtml(d.namaDokumen)),
    detailRow("Kategori", escapeHtml(kategoriMap[d.kategoriDokumenId] || "-")),
    detailRow("Nama Berkas Asli (Versi Aktif)", escapeHtml(d.namaFileAsli)),
    detailRow("Tipe Berkas", escapeHtml(MIME_LABELS[d.mimeType] || d.mimeType)),
    detailRow("Ukuran Berkas", formatFileSize(d.ukuranFile)),
    detailRow("Diunggah Pada", formatDateTime(d.createdAt)),
    detailRow("Terakhir Diubah", formatDateTime(d.updatedAt)),
  );

  document.getElementById("dokumen-detail-metadata").innerHTML = rows.join("");
};

const openDetailModal = async (id) => {
  try {
    const el = detailModalEl || (detailModalEl = buildDetailModal());
    currentDetailDokumenId = id;

    await refreshDetailMetadata(id);
    document.getElementById("dokumen-versi-upload-btn").classList.toggle("d-none", !canSubmit());

    window.bootstrap.Modal.getOrCreateInstance(el).show();
    await loadVersiList(id);
  } catch (err) {
    showToast(err.message || "Gagal memuat detail dokumen", "danger");
  }
};

const openUploadVersiModal = (dokumenId) => {
  openFormModal({
    title: "Unggah Versi Baru",
    submitLabel: "Unggah",
    fields: [
      {
        name: "file",
        label: "Berkas",
        type: "file",
        required: true,
        helpText: "Tipe yang didukung: PDF, JPG, PNG, DOC, DOCX. Ukuran maksimum 10MB.",
      },
    ],
    onSubmit: async (values) => {
      const file = values.file;
      if (!file || file.size === 0) {
        throw new Error("Berkas wajib diunggah");
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error("Tipe berkas tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.");
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error("Ukuran berkas melebihi batas maksimum (10MB)");
      }

      const formData = new FormData();
      formData.append("file", file);

      await createDokumenVersi(dokumenId, formData);
      showToast("Versi baru berhasil diunggah", "success");
      await loadVersiList(dokumenId);
      // Mirror metadata (nama berkas/tipe/ukuran) on the parent document
      // changed — refresh both the still-open detail modal and the main
      // table so they reflect the new active version too.
      await refreshDetailMetadata(dokumenId);
      await load();
    },
  });
};

const uploadFormFields = () => {
  const fields = [];

  if (canManage()) {
    fields.push({
      name: "pegawaiId",
      label: "Pegawai",
      type: "select",
      required: true,
      options: Object.entries(pegawaiMap).map(([value, label]) => ({ value, label })),
    });
  }

  fields.push(
    {
      name: "kategoriDokumenId",
      label: "Kategori Dokumen",
      type: "select",
      required: true,
      options: kategoriOptions,
    },
    { name: "namaDokumen", label: "Nama Dokumen", required: true },
    {
      name: "file",
      label: "Berkas",
      type: "file",
      required: true,
      helpText: "Tipe yang didukung: PDF, JPG, PNG, DOC, DOCX. Ukuran maksimum 10MB.",
    },
  );

  return fields;
};

const openUploadModal = () => {
  openFormModal({
    title: "Unggah Dokumen",
    submitLabel: "Unggah",
    fields: uploadFormFields(),
    onSubmit: async (values) => {
      if (canManage() && !values.pegawaiId) {
        throw new Error("Pilih pegawai terlebih dahulu");
      }
      if (!values.kategoriDokumenId) {
        throw new Error(
          "Kategori dokumen wajib dipilih (belum ada kategori? gunakan tombol Kelola Kategori)",
        );
      }
      const file = values.file;
      if (!file || file.size === 0) {
        throw new Error("Berkas wajib diunggah");
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(`Tipe berkas tidak didukung. Gunakan PDF, JPG, PNG, DOC, atau DOCX.`);
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error("Ukuran berkas melebihi batas maksimum (10MB)");
      }

      const formData = new FormData();
      if (canManage()) {
        formData.append("pegawaiId", values.pegawaiId);
      }
      formData.append("kategoriDokumenId", values.kategoriDokumenId);
      formData.append("namaDokumen", values.namaDokumen);
      formData.append("file", file);

      await createDokumen(formData);
      showToast("Dokumen berhasil diunggah", "success");
      state.page = 1;
      await load();
    },
  });
};

// --- Kategori Dokumen management (admin/hrd only) ---

let kategoriModalEl = null;

const buildKategoriModal = () => {
  const el = document.createElement("div");
  el.id = "dokumen-kategori-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Kelola Kategori Dokumen</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <div class="d-flex justify-content-end mb-2">
            <button id="dokumen-kategori-add-btn" class="btn btn-sm btn-primary" type="button">+ Tambah Kategori</button>
          </div>
          <div id="dokumen-kategori-list"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("dokumen-kategori-add-btn").addEventListener("click", openKategoriCreateModal);

  document.getElementById("dokumen-kategori-list").addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit']");
    if (editBtn) {
      openKategoriEditModal(editBtn.dataset.id);
      return;
    }
    const deleteBtn = event.target.closest("[data-action='delete']");
    if (deleteBtn) {
      handleKategoriDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }
  });

  return el;
};

const kategoriColumns = () => [
  { key: "namaKategori", label: "Nama Kategori" },
  { key: "deskripsi", label: "Deskripsi", render: (row) => escapeHtml(row.deskripsi || "-") },
  {
    key: "actions",
    label: "",
    render: (row) => `
      <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${row.id}" type="button">Edit</button>
      <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(row.namaKategori)}" type="button">Hapus</button>
    `,
  },
];

const handleKategoriDelete = async (id, namaKategori) => {
  if (!window.confirm(`Hapus kategori "${namaKategori}"? Data akan disembunyikan dari daftar.`)) {
    return;
  }
  try {
    await deleteKategoriDokumen(id);
    showToast("Kategori dokumen berhasil dihapus", "success");
    await loadKategoriList();
    await loadKategoriLookup();
  } catch (err) {
    showToast(err.message || "Gagal menghapus kategori dokumen", "danger");
  }
};

const loadKategoriList = async () => {
  const listEl = document.getElementById("dokumen-kategori-list");
  renderTable(listEl, { columns: kategoriColumns(), rows: [], loading: true });

  try {
    const res = await listKategoriDokumen({ page: 1, limit: 100 });
    renderTable(listEl, {
      columns: kategoriColumns(),
      rows: res.data,
      emptyMessage: "Belum ada kategori dokumen",
    });
  } catch (err) {
    renderErrorState(listEl, err.message || "Gagal memuat kategori dokumen");
  }
};

const openKategoriManageModal = async () => {
  const el = kategoriModalEl || (kategoriModalEl = buildKategoriModal());
  window.bootstrap.Modal.getOrCreateInstance(el).show();
  await loadKategoriList();
};

const openKategoriCreateModal = () => {
  openFormModal({
    title: "Tambah Kategori Dokumen",
    fields: [
      { name: "namaKategori", label: "Nama Kategori", required: true },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
    ],
    onSubmit: async (values) => {
      const payload = { ...values };
      if (payload.deskripsi === "") {
        delete payload.deskripsi;
      }
      await createKategoriDokumen(payload);
      showToast("Kategori dokumen berhasil ditambahkan", "success");
      await loadKategoriList();
      await loadKategoriLookup();
    },
  });
};

const openKategoriEditModal = async (id) => {
  try {
    const res = await listKategoriDokumen({ page: 1, limit: 100 });
    const kategori = res.data.find((k) => k.id === id);
    openFormModal({
      title: "Edit Kategori Dokumen",
      fields: [
        { name: "namaKategori", label: "Nama Kategori", required: true, value: kategori?.namaKategori },
        { name: "deskripsi", label: "Deskripsi", type: "textarea", value: kategori?.deskripsi },
      ],
      onSubmit: async (values) => {
        const payload = { ...values };
        if (payload.deskripsi === "") {
          delete payload.deskripsi;
        }
        await updateKategoriDokumen(id, payload);
        showToast("Kategori dokumen berhasil diperbarui", "success");
        await loadKategoriList();
        await loadKategoriLookup();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data kategori", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/dokumen");

  try {
    await loadKategoriLookup();
  } catch {
    showToast("Gagal memuat daftar kategori dokumen", "danger");
  }

  if (canManage()) {
    filterPegawaiWrap.classList.remove("d-none");
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
    kategoriBtn.classList.remove("d-none");
    kategoriBtn.addEventListener("click", openKategoriManageModal);
  }

  if (canSubmit()) {
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openUploadModal);
  }

  tableEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) {
      return;
    }
    const { action, id } = btn.dataset;
    if (action === "detail") {
      openDetailModal(id);
    } else if (action === "preview") {
      openSignedUrlInNewTab(id);
    } else if (action === "download") {
      openSignedUrlInNewTab(id, { download: true });
    } else if (action === "delete") {
      handleDelete(id, btn.dataset.name);
    }
  });

  filterPegawaiEl.addEventListener("change", () => {
    state.pegawaiId = filterPegawaiEl.value || undefined;
    state.page = 1;
    load();
  });

  filterKategoriEl.addEventListener("change", () => {
    state.kategoriDokumenId = filterKategoriEl.value || undefined;
    state.page = 1;
    load();
  });

  await load();
};

init();
