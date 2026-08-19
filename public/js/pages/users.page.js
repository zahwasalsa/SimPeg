import { requireAuth, requireRole } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import { listUsers, getUser, updateUserRole, updateUserStatus, deleteUser } from "../api/users.js";

const ADMIN_ONLY = ["admin"];

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "hrd", label: "HRD" },
  { value: "pegawai", label: "Pegawai" },
  { value: "pimpinan", label: "Pimpinan" },
];
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_VARIANTS = {
  aktif: { color: "success", label: "Aktif" },
  nonaktif: { color: "secondary", label: "Nonaktif" },
};

const tableEl = document.getElementById("users-table");
const paginationEl = document.getElementById("users-pagination");

const state = { page: 1, limit: 10 };
let currentUser = null;

const isSelf = (id) => Boolean(currentUser && id === currentUser.id);

const columns = () => [
  { key: "email", label: "Email" },
  { key: "role", label: "Role", render: (row) => escapeHtml(ROLE_LABELS[row.role] || row.role) },
  {
    key: "isActive",
    label: "Status",
    render: (row) => renderStatusBadge(row.isActive ? "aktif" : "nonaktif", STATUS_VARIANTS),
  },
  { key: "createdAt", label: "Dibuat", render: (row) => formatDate(row.createdAt) },
  {
    key: "lastLogin",
    label: "Login Terakhir",
    render: (row) => (row.lastLogin ? formatDateTime(row.lastLogin) : "-"),
  },
  {
    key: "actions",
    label: "",
    render: (row) => `
      <button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>
      <button class="btn btn-sm btn-outline-primary me-1" data-action="edit" data-id="${row.id}" type="button">Edit</button>
      ${
        isSelf(row.id)
          ? ""
          : `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-email="${escapeHtml(row.email)}" type="button">Hapus</button>`
      }
    `,
  },
];

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listUsers(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data user",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data user");
  }
};

let detailModalEl = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "user-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail User</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body" id="user-detail-body"></div>
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
    const res = await getUser(id);
    const u = res.data;
    const el = detailModalEl || (detailModalEl = buildDetailModal());

    document.getElementById("user-detail-body").innerHTML = `
      <dl class="row mb-0">
        ${detailRow("Email", escapeHtml(u.email))}
        ${detailRow("Role", escapeHtml(ROLE_LABELS[u.role] || u.role))}
        ${detailRow("Status", renderStatusBadge(u.isActive ? "aktif" : "nonaktif", STATUS_VARIANTS))}
        ${detailRow("Dibuat", formatDateTime(u.createdAt))}
        ${detailRow("Terakhir Diubah", formatDateTime(u.updatedAt))}
        ${detailRow("Login Terakhir", u.lastLogin ? formatDateTime(u.lastLogin) : "-")}
      </dl>`;

    window.bootstrap.Modal.getOrCreateInstance(el).show();
  } catch (err) {
    showToast(err.message || "Gagal memuat detail user", "danger");
  }
};

// Satu form gabungan untuk role + status, menggantikan dua tombol/modal
// terpisah yang ada sebelumnya ("Ubah Role" / "Ubah Status") — backend tetap
// dua endpoint terpisah (PATCH /users/:id/role dan /:id/status, tidak ada
// endpoint update gabungan), jadi onSubmit hanya memanggil endpoint yang
// nilainya benar-benar berubah, bukan selalu memanggil keduanya.
const openEditModal = async (id) => {
  try {
    const res = await getUser(id);
    const u = res.data;
    const selfNote = isSelf(id) ? " Ini adalah akun Anda sendiri." : "";

    openFormModal({
      title: `Edit User - ${u.email}`,
      submitLabel: "Simpan",
      fields: [
        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          value: u.role,
          options: ROLE_OPTIONS,
          helpText: `Role saat ini: ${ROLE_LABELS[u.role] || u.role}.${selfNote}`,
        },
        {
          name: "isActive",
          label: "Status",
          type: "select",
          required: true,
          value: String(u.isActive),
          options: [
            { value: "true", label: "Aktif" },
            { value: "false", label: "Nonaktif" },
          ],
          helpText: isSelf(id)
            ? "Peringatan: menonaktifkan akun sendiri akan langsung mengunci Anda dari sesi saat ini."
            : undefined,
        },
      ],
      onSubmit: async (values) => {
        const nextIsActive = values.isActive === "true";
        const tasks = [];
        if (values.role !== u.role) {
          tasks.push(updateUserRole(id, { role: values.role }));
        }
        if (nextIsActive !== u.isActive) {
          tasks.push(updateUserStatus(id, { isActive: nextIsActive }));
        }

        if (tasks.length === 0) {
          showToast("Tidak ada perubahan untuk disimpan", "info");
          return;
        }

        await Promise.all(tasks);
        showToast("User berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data user", "danger");
  }
};

const handleDelete = async (id, email) => {
  if (!window.confirm(`Hapus user "${email}"? Akun ini tidak akan bisa login lagi setelah dihapus.`)) {
    return;
  }
  try {
    await deleteUser(id);
    showToast("User berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus user", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }
  if (!requireRole(currentUser, ADMIN_ONLY)) {
    return;
  }

  renderNavbar("/users");

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
      handleDelete(id, btn.dataset.email);
    }
  });

  await load();
};

init();
