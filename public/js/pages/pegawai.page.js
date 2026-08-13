import { requireAuth, requireRole } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import { listPegawai, getPegawai, createPegawai, updatePegawai, deletePegawai } from "../api/pegawai.js";
import { listDivisi } from "../api/divisi.js";
import { listJabatan } from "../api/jabatan.js";

const MANAGE_ROLES = ["admin", "hrd"];

// PATCH rejects a userId key at all; PATCH/POST both treat these as
// optional+nullable, and express-validator's optional({nullable:true}) only
// skips undefined/null, not "" — so blank selects/inputs must be stripped
// before the request is sent.
const OPTIONAL_KEYS = [
  "divisiId",
  "jabatanId",
  "jenisKelamin",
  "tempatLahir",
  "tanggalLahir",
  "alamat",
  "noTelepon",
  "tanggalMasuk",
];

const STATUS_VARIANTS = {
  aktif: { color: "success", label: "Aktif" },
  nonaktif: { color: "secondary", label: "Nonaktif" },
  pensiun: { color: "warning", label: "Pensiun" },
};

const tableEl = document.getElementById("pegawai-table");
const paginationEl = document.getElementById("pegawai-pagination");
const searchInput = document.getElementById("pegawai-search");
const filterDivisiEl = document.getElementById("pegawai-filter-divisi");
const addBtn = document.getElementById("pegawai-add-btn");

const state = { page: 1, limit: 10, search: "", divisiId: "" };
let currentUser = null;
let divisiOptions = [];
let jabatanOptions = [];
let divisiMap = {};
let jabatanMap = {};

const canManage = () => Boolean(currentUser && MANAGE_ROLES.includes(currentUser.role));

const sanitizePayload = (values) => {
  const payload = { ...values };
  OPTIONAL_KEYS.forEach((key) => {
    if (payload[key] === "") {
      delete payload[key];
    }
  });
  return payload;
};

const loadLookups = async () => {
  const [divisiRes, jabatanRes] = await Promise.all([
    listDivisi({ page: 1, limit: 100 }),
    listJabatan({ page: 1, limit: 100 }),
  ]);

  divisiOptions = divisiRes.data.map((d) => ({ value: d.id, label: d.namaDivisi }));
  jabatanOptions = jabatanRes.data.map((j) => ({ value: j.id, label: j.namaJabatan }));
  divisiMap = Object.fromEntries(divisiRes.data.map((d) => [d.id, d.namaDivisi]));
  jabatanMap = Object.fromEntries(jabatanRes.data.map((j) => [j.id, j.namaJabatan]));

  divisiOptions.forEach((opt) => {
    const optionEl = document.createElement("option");
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    filterDivisiEl.appendChild(optionEl);
  });
};

const columns = () => {
  const base = [
    { key: "nip", label: "NIP" },
    { key: "namaLengkap", label: "Nama Lengkap" },
    { key: "divisi", label: "Divisi", render: (row) => escapeHtml(divisiMap[row.divisiId] || "-") },
    { key: "jabatan", label: "Jabatan", render: (row) => escapeHtml(jabatanMap[row.jabatanId] || "-") },
    {
      key: "statusKepegawaian",
      label: "Status",
      render: (row) => renderStatusBadge(row.statusKepegawaian, STATUS_VARIANTS),
    },
    {
      key: "actions",
      label: "",
      render: (row) => `
        <button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>
        ${canManage() ? `<button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${row.id}" type="button">Edit</button>` : ""}
        ${canManage() ? `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(row.namaLengkap)}" type="button">Hapus</button>` : ""}
      `,
    },
  ];

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listPegawai({
      page: state.page,
      limit: state.limit,
      search: state.search,
      divisiId: state.divisiId || undefined,
    });
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage:
        state.search || state.divisiId
          ? "Tidak ada pegawai yang cocok dengan filter"
          : "Belum ada data pegawai",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data pegawai");
  }
};

const formFields = ({ includeUserId, values = {} } = {}) => {
  const fields = [];

  if (includeUserId) {
    fields.push({
      name: "userId",
      label: "User ID (UUID)",
      required: true,
      helpText:
        "ID akun user yang sudah terdaftar (belum memiliki profil pegawai). Didapat dari Manajemen User.",
    });
  }

  fields.push(
    { name: "nip", label: "NIP", required: true, value: values.nip },
    { name: "namaLengkap", label: "Nama Lengkap", required: true, value: values.namaLengkap },
    {
      name: "divisiId",
      label: "Divisi",
      type: "select",
      value: values.divisiId,
      options: [{ value: "", label: "- Tidak ada -" }, ...divisiOptions],
    },
    {
      name: "jabatanId",
      label: "Jabatan",
      type: "select",
      value: values.jabatanId,
      options: [{ value: "", label: "- Tidak ada -" }, ...jabatanOptions],
    },
    {
      name: "jenisKelamin",
      label: "Jenis Kelamin",
      type: "select",
      value: values.jenisKelamin,
      options: [
        { value: "", label: "- Pilih -" },
        { value: "Laki-laki", label: "Laki-laki" },
        { value: "Perempuan", label: "Perempuan" },
      ],
    },
    { name: "tempatLahir", label: "Tempat Lahir", value: values.tempatLahir },
    { name: "tanggalLahir", label: "Tanggal Lahir", type: "date", value: values.tanggalLahir },
    { name: "alamat", label: "Alamat", type: "textarea", value: values.alamat },
    { name: "noTelepon", label: "No Telepon", value: values.noTelepon },
    { name: "tanggalMasuk", label: "Tanggal Masuk", type: "date", value: values.tanggalMasuk },
    {
      name: "statusKepegawaian",
      label: "Status Kepegawaian",
      type: "select",
      value: values.statusKepegawaian || "aktif",
      options: [
        { value: "aktif", label: "Aktif" },
        { value: "nonaktif", label: "Nonaktif" },
        { value: "pensiun", label: "Pensiun" },
      ],
    },
  );

  return fields;
};

const openCreateModal = () => {
  openFormModal({
    title: "Tambah Pegawai",
    fields: formFields({ includeUserId: true }),
    onSubmit: async (values) => {
      await createPegawai(sanitizePayload(values));
      showToast("Pegawai berhasil ditambahkan", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getPegawai(id);
    openFormModal({
      title: "Edit Pegawai",
      fields: formFields({ includeUserId: false, values: res.data }),
      onSubmit: async (values) => {
        await updatePegawai(id, sanitizePayload(values));
        showToast("Pegawai berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat detail pegawai", "danger");
  }
};

const handleDelete = async (id, namaLengkap) => {
  if (!window.confirm(`Hapus pegawai "${namaLengkap}"? Data akan disembunyikan dari daftar.`)) {
    return;
  }
  try {
    await deletePegawai(id);
    showToast("Pegawai berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus pegawai", "danger");
  }
};

let detailModalEl = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "pegawai-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail Pegawai</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body" id="pegawai-detail-body"></div>
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

const openDetailModal = async (id) => {
  try {
    const res = await getPegawai(id);
    const p = res.data;
    const el = detailModalEl || (detailModalEl = buildDetailModal());

    document.getElementById("pegawai-detail-body").innerHTML = `
      <dl class="row mb-0">
        ${detailRow("NIP", escapeHtml(p.nip))}
        ${detailRow("Nama Lengkap", escapeHtml(p.namaLengkap))}
        ${detailRow("Divisi", escapeHtml(divisiMap[p.divisiId] || "-"))}
        ${detailRow("Jabatan", escapeHtml(jabatanMap[p.jabatanId] || "-"))}
        ${detailRow("Jenis Kelamin", escapeHtml(p.jenisKelamin || "-"))}
        ${detailRow("Tempat Lahir", escapeHtml(p.tempatLahir || "-"))}
        ${detailRow("Tanggal Lahir", formatDate(p.tanggalLahir))}
        ${detailRow("Alamat", escapeHtml(p.alamat || "-"))}
        ${detailRow("No Telepon", escapeHtml(p.noTelepon || "-"))}
        ${detailRow("Tanggal Masuk", formatDate(p.tanggalMasuk))}
        ${detailRow("Status", renderStatusBadge(p.statusKepegawaian, STATUS_VARIANTS))}
        ${detailRow("Terakhir Diubah", formatDateTime(p.updatedAt))}
      </dl>`;

    window.bootstrap.Modal.getOrCreateInstance(el).show();
  } catch (err) {
    showToast(err.message || "Gagal memuat detail pegawai", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }
  if (!requireRole(currentUser, MANAGE_ROLES)) {
    return;
  }

  renderNavbar("/pegawai");

  try {
    await loadLookups();
  } catch {
    showToast("Gagal memuat daftar divisi/jabatan", "danger");
  }

  if (canManage()) {
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openCreateModal);
  }

  tableEl.addEventListener("click", (event) => {
    const editBtn = event.target.closest("[data-action='edit']");
    if (editBtn) {
      openEditModal(editBtn.dataset.id);
      return;
    }
    const detailBtn = event.target.closest("[data-action='detail']");
    if (detailBtn) {
      openDetailModal(detailBtn.dataset.id);
      return;
    }
    const deleteBtn = event.target.closest("[data-action='delete']");
    if (deleteBtn) {
      handleDelete(deleteBtn.dataset.id, deleteBtn.dataset.name);
    }
  });

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      state.page = 1;
      load();
    }, 400);
  });

  filterDivisiEl.addEventListener("change", () => {
    state.divisiId = filterDivisiEl.value;
    state.page = 1;
    load();
  });

  await load();
};

init();
