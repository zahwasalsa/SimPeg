import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";
import { listDivisi, getDivisi, createDivisi, updateDivisi, deleteDivisi } from "../api/divisi.js";

const MANAGE_ROLES = ["admin", "hrd"];

const tableEl = document.getElementById("divisi-table");
const paginationEl = document.getElementById("divisi-pagination");
const searchInput = document.getElementById("divisi-search");
const addBtn = document.getElementById("divisi-add-btn");

const state = { page: 1, limit: 10, search: "" };
let currentUser = null;

const canManage = () => Boolean(currentUser && MANAGE_ROLES.includes(currentUser.role));

const columns = () => {
  const base = [
    { key: "namaDivisi", label: "Nama Divisi" },
    { key: "deskripsi", label: "Deskripsi", render: (row) => row.deskripsi || "-" },
    { key: "updatedAt", label: "Terakhir Diubah", render: (row) => formatDateTime(row.updatedAt) },
  ];

  if (canManage()) {
    base.push({
      key: "actions",
      label: "",
      render: (row) => `
        <button class="btn btn-sm btn-outline-secondary me-1" data-action="edit" data-id="${row.id}" type="button">Edit</button>
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-name="${escapeHtml(row.namaDivisi)}" type="button">Hapus</button>
      `,
    });
  }

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listDivisi({ page: state.page, limit: state.limit, search: state.search });
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: state.search ? "Tidak ada divisi yang cocok dengan pencarian" : "Belum ada data divisi",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data divisi");
  }
};

const openCreateModal = () => {
  openFormModal({
    title: "Tambah Divisi",
    fields: [
      { name: "namaDivisi", label: "Nama Divisi", required: true },
      { name: "deskripsi", label: "Deskripsi", type: "textarea" },
    ],
    onSubmit: async (values) => {
      await createDivisi(values);
      showToast("Divisi berhasil ditambahkan", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getDivisi(id);
    openFormModal({
      title: "Edit Divisi",
      fields: [
        { name: "namaDivisi", label: "Nama Divisi", required: true, value: res.data.namaDivisi },
        { name: "deskripsi", label: "Deskripsi", type: "textarea", value: res.data.deskripsi },
      ],
      onSubmit: async (values) => {
        await updateDivisi(id, values);
        showToast("Divisi berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat detail divisi", "danger");
  }
};

const handleDelete = async (id, namaDivisi) => {
  if (!window.confirm(`Hapus divisi "${namaDivisi}"? Data akan disembunyikan dari daftar.`)) {
    return;
  }
  try {
    await deleteDivisi(id);
    showToast("Divisi berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus divisi", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/divisi");

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

  await load();
};

init();
