import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";
import {
  listPenelitian,
  getPenelitian,
  createPenelitian,
  updatePenelitian,
  deletePenelitian,
  createAnggotaPenelitian,
  deleteAnggotaPenelitian,
  createPublikasi,
  updatePublikasi,
  deletePublikasi,
  listPublikasi,
} from "../api/penelitian.js";
import { listPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];

const tableEl = document.getElementById("penelitian-table");
const paginationEl = document.getElementById("penelitian-pagination");
const addBtn = document.getElementById("penelitian-add-btn");
const filterPegawaiWrap = document.getElementById("penelitian-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("penelitian-filter-pegawai");
const filterTahunEl = document.getElementById("penelitian-filter-tahun");

const state = { page: 1, limit: 10, pegawaiId: undefined, tahun: undefined };
let currentUser = null;
let pegawaiMap = {};

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
const isPegawai = () => Boolean(currentUser && currentUser.role === "pegawai");
const isPimpinan = () => Boolean(currentUser && currentUser.role === "pimpinan");
// Anggota/publikasi milik penelitian mana pun yang sedang dibuka pegawai
// selalu milik mereka sendiri — GET /penelitian (list) sudah di-scope backend
// ke baris milik sendiri untuk role pegawai (lihat penelitian.service.js),
// jadi setiap baris yang diklik pegawai di sini pasti penelitian miliknya.
// Sama seperti alasan `isPegawai()` di kpi.page.js.
const canWriteChildren = () => canManage() || isPegawai();

const formatRupiah = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
};

// GET /pegawai (list) is admin/hrd-only at the backend — pimpinan/pegawai get
// 403 there, so this is only ever called for canManage() (same pattern as
// kpi.page.js/roadmapKarier.page.js). The "Pegawai" column still shows for
// pimpinan, it just falls back to the raw pegawaiId.
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

  if (canManage() || isPimpinan()) {
    base.push({
      key: "pegawai",
      label: "Pegawai",
      render: (row) => escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId),
    });
  }

  base.push(
    { key: "judul", label: "Judul" },
    { key: "skema", label: "Skema", render: (row) => escapeHtml(row.skema || "-") },
    { key: "tahun", label: "Tahun" },
    { key: "dana", label: "Dana", render: (row) => formatRupiah(row.dana) },
    {
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>`,
        ];
        if (canWriteChildren()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-secondary me-1" data-action="edit" data-id="${row.id}" type="button">Edit</button>`,
            `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" type="button">Hapus</button>`,
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
    const res = await listPenelitian(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data penelitian",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data penelitian");
  }
};

// --- Tambah / Edit Penelitian (flat fields, modalForm.js) ---

const commonFields = (values = {}) => [
  { name: "judul", label: "Judul Penelitian", required: true, value: values.judul },
  {
    name: "skema",
    label: "Skema Pendanaan",
    value: values.skema,
    helpText: "Opsional — contoh: Hibah Internal, Hibah DIKTI.",
  },
  { name: "dana", label: "Dana (Rp)", type: "number", value: values.dana, helpText: "Opsional." },
  {
    name: "tahun",
    label: "Tahun",
    type: "number",
    required: true,
    value: values.tahun ?? new Date().getFullYear(),
  },
];

const sanitizeCommonPayload = (values) => ({
  judul: values.judul.trim(),
  skema: values.skema ? values.skema.trim() : null,
  dana: values.dana === "" ? null : Number(values.dana),
  tahun: Number(values.tahun),
});

const openCreateModal = () => {
  const fields = canManage()
    ? [
        {
          name: "pegawaiId",
          label: "Pegawai",
          type: "select",
          required: true,
          options: Object.entries(pegawaiMap).map(([value, label]) => ({ value, label })),
        },
        ...commonFields(),
      ]
    : commonFields();

  openFormModal({
    title: "Tambah Penelitian",
    fields,
    onSubmit: async (values) => {
      const payload = sanitizeCommonPayload(values);
      if (canManage()) {
        payload.pegawaiId = values.pegawaiId;
      }
      await createPenelitian(payload);
      showToast("Penelitian berhasil dibuat", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getPenelitian(id);
    const p = res.data;
    const fields = canManage()
      ? [
          {
            name: "pegawaiId",
            label: "Pegawai",
            type: "text",
            value: pegawaiMap[p.pegawaiId] || p.pegawaiId,
          },
          ...commonFields(p),
        ]
      : commonFields(p);

    openFormModal({
      title: "Edit Penelitian",
      fields,
      onSubmit: async (values) => {
        await updatePenelitian(id, sanitizeCommonPayload(values));
        showToast("Penelitian berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data penelitian", "danger");
  }
};

const handleDelete = async (id) => {
  if (!window.confirm("Hapus data penelitian ini? Data akan disembunyikan dari daftar.")) {
    return;
  }
  try {
    await deletePenelitian(id);
    showToast("Penelitian berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus penelitian", "danger");
  }
};

// --- Detail modal: metadata + Anggota Tim + Publikasi ---

let detailModalEl = null;
let currentDetailId = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "penelitian-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail Penelitian</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <dl class="row mb-0" id="penelitian-detail-metadata"></dl>
          <hr />
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Anggota Tim</h6>
            <button id="penelitian-anggota-add-btn" class="btn btn-sm btn-primary d-none" type="button">
              + Tambah Anggota
            </button>
          </div>
          <div id="penelitian-anggota-list" class="mb-4"></div>
          <hr />
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0">Publikasi</h6>
            <button id="penelitian-publikasi-add-btn" class="btn btn-sm btn-primary d-none" type="button">
              + Tambah Publikasi
            </button>
          </div>
          <div id="penelitian-publikasi-list"></div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Tutup</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el);

  document.getElementById("penelitian-anggota-add-btn").addEventListener("click", () => {
    if (currentDetailId) {
      openAnggotaAddModal(currentDetailId);
    }
  });
  document.getElementById("penelitian-anggota-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || !currentDetailId) {
      return;
    }
    const { action, anggotaid } = btn.dataset;
    if (action === "delete-anggota") {
      handleAnggotaDelete(currentDetailId, anggotaid);
    }
  });

  document.getElementById("penelitian-publikasi-add-btn").addEventListener("click", () => {
    if (currentDetailId) {
      openPublikasiCreateModal(currentDetailId);
    }
  });
  document.getElementById("penelitian-publikasi-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn || !currentDetailId) {
      return;
    }
    const { action, publikasiid } = btn.dataset;
    if (action === "edit-publikasi") {
      openPublikasiEditModal(currentDetailId, publikasiid);
    } else if (action === "delete-publikasi") {
      handlePublikasiDelete(currentDetailId, publikasiid);
    }
  });

  return el;
};

const detailRow = (label, value) => `
  <dt class="col-5">${escapeHtml(label)}</dt>
  <dd class="col-7">${value}</dd>`;

const anggotaColumns = () => {
  const cols = [
    {
      key: "pegawai",
      label: "Pegawai",
      render: (row) => escapeHtml(pegawaiMap[row.pegawaiId] || row.pegawaiId),
    },
  ];
  if (canWriteChildren()) {
    cols.push({
      key: "actions",
      label: "",
      render: (row) =>
        `<button class="btn btn-sm btn-outline-danger" data-action="delete-anggota" data-anggotaid="${row.id}" type="button">Hapus</button>`,
    });
  }
  return cols;
};

const publikasiColumns = () => {
  const cols = [
    { key: "judul", label: "Judul" },
    { key: "jurnal", label: "Jurnal", render: (row) => escapeHtml(row.jurnal || "-") },
    {
      key: "terindeks",
      label: "Terindeks",
      render: (row) =>
        row.terindeks
          ? '<span class="badge text-bg-success">Ya</span>'
          : '<span class="badge text-bg-secondary">Tidak</span>',
    },
    { key: "tahun", label: "Tahun" },
  ];
  if (canWriteChildren()) {
    cols.push({
      key: "actions",
      label: "",
      render: (row) =>
        [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="edit-publikasi" data-publikasiid="${row.id}" type="button">Edit</button>`,
          `<button class="btn btn-sm btn-outline-danger" data-action="delete-publikasi" data-publikasiid="${row.id}" type="button">Hapus</button>`,
        ].join(""),
    });
  }
  return cols;
};

const refreshDetailMetadata = async (id) => {
  const res = await getPenelitian(id);
  const p = res.data;

  const rows = [];
  if (canManage() || isPimpinan()) {
    rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[p.pegawaiId] || p.pegawaiId)));
  }
  rows.push(
    detailRow("Judul", escapeHtml(p.judul)),
    detailRow("Skema", escapeHtml(p.skema || "-")),
    detailRow("Dana", formatRupiah(p.dana)),
    detailRow("Tahun", escapeHtml(String(p.tahun))),
    detailRow("Terakhir Diubah", formatDateTime(p.updatedAt)),
  );
  document.getElementById("penelitian-detail-metadata").innerHTML = rows.join("");

  return p;
};

// Response GET /penelitian/:id sudah menyertakan `anggota`/`publikasi`
// (lihat penelitian.service.js#getPenelitianById) — satu request cukup untuk
// mengisi metadata + kedua tabel anak sekaligus, mirip pola kpi.page.js.
const loadDetail = async (id) => {
  const anggotaListEl = document.getElementById("penelitian-anggota-list");
  const publikasiListEl = document.getElementById("penelitian-publikasi-list");
  renderTable(anggotaListEl, { columns: anggotaColumns(), rows: [], loading: true });
  renderTable(publikasiListEl, { columns: publikasiColumns(), rows: [], loading: true });

  const p = await refreshDetailMetadata(id);

  renderTable(anggotaListEl, {
    columns: anggotaColumns(),
    rows: p.anggota,
    emptyMessage: "Belum ada anggota tim",
  });
  renderTable(publikasiListEl, {
    columns: publikasiColumns(),
    rows: p.publikasi,
    emptyMessage: "Belum ada publikasi",
  });

  return p;
};

const openDetailModal = async (id) => {
  try {
    const el = detailModalEl || (detailModalEl = buildDetailModal());
    currentDetailId = id;

    document.getElementById("penelitian-anggota-add-btn").classList.toggle("d-none", !canWriteChildren());
    document.getElementById("penelitian-publikasi-add-btn").classList.toggle("d-none", !canWriteChildren());

    window.bootstrap.Modal.getOrCreateInstance(el).show();
    await loadDetail(id);
  } catch (err) {
    showToast(err.message || "Gagal memuat detail penelitian", "danger");
  }
};

// --- Anggota Tim ---

const openAnggotaAddModal = (penelitianId) => {
  // Admin/HRD punya daftar pegawai lengkap (loadPegawaiLookup); pegawai tidak
  // punya akses ke GET /pegawai (list) sama sekali (403 di backend), jadi
  // tidak ada cara untuk mencari/memilih pegawai lain dari UI — satu-satunya
  // opsi jujur di sini adalah meminta ID pegawai secara langsung, bukan
  // berpura-pura ada pencarian yang sebenarnya tidak tersedia untuk role ini.
  const fields = canManage()
    ? [
        {
          name: "pegawaiId",
          label: "Pegawai",
          type: "select",
          required: true,
          options: Object.entries(pegawaiMap).map(([value, label]) => ({ value, label })),
        },
      ]
    : [
        {
          name: "pegawaiId",
          label: "ID Pegawai (UUID)",
          required: true,
          helpText:
            "Pencarian daftar pegawai belum tersedia untuk role Anda — masukkan ID pegawai rekan tim secara langsung.",
        },
      ];

  openFormModal({
    title: "Tambah Anggota Tim",
    fields,
    onSubmit: async (values) => {
      await createAnggotaPenelitian(penelitianId, { pegawaiId: values.pegawaiId.trim() });
      showToast("Anggota tim berhasil ditambahkan", "success");
      await loadDetail(penelitianId);
    },
  });
};

const handleAnggotaDelete = async (penelitianId, anggotaId) => {
  if (!window.confirm("Hapus anggota ini dari tim penelitian?")) {
    return;
  }
  try {
    await deleteAnggotaPenelitian(penelitianId, anggotaId);
    showToast("Anggota tim berhasil dihapus", "success");
    await loadDetail(penelitianId);
  } catch (err) {
    showToast(err.message || "Gagal menghapus anggota tim", "danger");
  }
};

// --- Publikasi ---

const publikasiFormFields = (values = {}) => [
  { name: "judul", label: "Judul Publikasi", required: true, value: values.judul },
  { name: "jurnal", label: "Jurnal/Prosiding", value: values.jurnal },
  { name: "terindeks", label: "Terindeks", type: "checkbox", value: values.terindeks },
  {
    name: "tahun",
    label: "Tahun",
    type: "number",
    required: true,
    value: values.tahun ?? new Date().getFullYear(),
  },
];

const sanitizePublikasiPayload = (values) => ({
  judul: values.judul.trim(),
  jurnal: values.jurnal ? values.jurnal.trim() : null,
  terindeks: values.terindeks === "true",
  tahun: Number(values.tahun),
});

const openPublikasiCreateModal = (penelitianId) => {
  openFormModal({
    title: "Tambah Publikasi",
    fields: publikasiFormFields(),
    onSubmit: async (values) => {
      await createPublikasi(penelitianId, sanitizePublikasiPayload(values));
      showToast("Publikasi berhasil dibuat", "success");
      await loadDetail(penelitianId);
    },
  });
};

const openPublikasiEditModal = async (penelitianId, publikasiId) => {
  try {
    const res = await listPublikasi(penelitianId);
    const pub = res.data.find((x) => x.id === publikasiId);
    openFormModal({
      title: "Edit Publikasi",
      fields: publikasiFormFields(pub),
      onSubmit: async (values) => {
        await updatePublikasi(penelitianId, publikasiId, sanitizePublikasiPayload(values));
        showToast("Publikasi berhasil diperbarui", "success");
        await loadDetail(penelitianId);
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data publikasi", "danger");
  }
};

const handlePublikasiDelete = async (penelitianId, publikasiId) => {
  if (!window.confirm("Hapus publikasi ini?")) {
    return;
  }
  try {
    await deletePublikasi(penelitianId, publikasiId);
    showToast("Publikasi berhasil dihapus", "success");
    await loadDetail(penelitianId);
  } catch (err) {
    showToast(err.message || "Gagal menghapus publikasi", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/penelitian");

  if (canManage()) {
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
    filterPegawaiWrap.classList.remove("d-none");
  }

  if (canManage() || isPegawai()) {
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

  filterTahunEl.addEventListener("change", () => {
    const val = filterTahunEl.value.trim();
    state.tahun = val ? Number(val) : undefined;
    state.page = 1;
    load();
  });

  await load();
};

init();
