import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { formatDateTime } from "../utils/format.js";
import { listJabatan, getJabatan, createJabatan, updateJabatan } from "../api/jabatan.js";

const MANAGE_ROLES = ["admin", "hrd"];

const tableEl = document.getElementById("jabatan-table");
const paginationEl = document.getElementById("jabatan-pagination");
const searchInput = document.getElementById("jabatan-search");
const addBtn = document.getElementById("jabatan-add-btn");

const state = { page: 1, limit: 10, search: "" };
let currentUser = null;

const canManage = () => Boolean(currentUser && MANAGE_ROLES.includes(currentUser.role));

const columns = () => {
  const base = [
    { key: "namaJabatan", label: "Nama Jabatan" },
    { key: "deskripsi", label: "Deskripsi", render: (row) => row.deskripsi || "-" },
    { key: "updatedAt", label: "Terakhir Diubah", render: (row) => formatDateTime(row.updatedAt) },
  ];

  if (canManage()) {
    base.push({
      key: "actions",
      label: "",
      render: (row) =>
        `<button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${row.id}" type="button">Edit</button>`,
    });
  }

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listJabatan({ page: state.page, limit: state.limit, search: state.search });
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: state.search ? "Tidak ada jabatan yang cocok dengan pencarian" : "Belum ada data jabatan",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data jabatan");
  }
};

const openCreateModal = () => {
  openFormModal({
    title: "Tambah Jabatan",
    fields: [
      { name: "namaJabatan", label: "Nama Jabatan", required: true },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
    ],
    onSubmit: async (values) => {
      await createJabatan(values);
      showToast("Jabatan berhasil ditambahkan", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getJabatan(id);
    openFormModal({
      title: "Edit Jabatan",
      fields: [
        { name: "namaJabatan", label: "Nama Jabatan", required: true, value: res.data.namaJabatan },
        { name: "deskripsi", label: "Deskripsi", type: "textarea", value: res.data.deskripsi },
      ],
      onSubmit: async (values) => {
        await updateJabatan(id, values);
        showToast("Jabatan berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat detail jabatan", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/jabatan");

  if (canManage()) {
    addBtn.classList.remove("d-none");
    addBtn.addEventListener("click", openCreateModal);
  }

  tableEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action='edit']");
    if (!btn) {
      return;
    }
    openEditModal(btn.dataset.id);
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

  await load();
};

init();
