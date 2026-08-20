import { requireAuth, requireRole } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import {
  listUsers,
  getUser,
  updateUserEmail,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} from "../api/users.js";
import { updatePegawai } from "../api/pegawai.js";

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
  {
    key: "email",
    label: "Email",
    render: (row) =>
      `<span class="table-cell-truncate" title="${escapeHtml(row.email)}">${escapeHtml(row.email)}</span>`,
  },
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
      <div class="table-actions">
        <button class="btn btn-sm btn-outline-secondary" data-action="detail" data-id="${row.id}" type="button">Detail</button>
        <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${row.id}" type="button">Edit</button>
        ${
          isSelf(row.id)
            ? ""
            : `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" data-email="${escapeHtml(row.email)}" type="button">Hapus</button>`
        }
      </div>
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
        ${detailRow("Nama Lengkap", u.pegawai ? escapeHtml(u.pegawai.namaLengkap) : "-")}
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

// Satu form gabungan untuk email, nama (lewat profil pegawai terkait), role,
// status, dan password — menggantikan tombol "Ubah Role"/"Ubah Status" yang
// terpisah sebelumnya. Backend tetap beberapa endpoint granular terpisah
// (PATCH /users/:id/email, /password, /role, /status, plus PATCH
// /pegawai/:id yang sudah ada untuk nama — tidak ada endpoint update
// gabungan baru), jadi onSubmit hanya memanggil endpoint yang nilainya
// benar-benar berubah.
//
// Email sengaja tidak dianggap "milik" modul ini — mengubahnya menulis ke
// auth.users (sumber kebenaran untuk login) DAN public.users sekaligus di
// backend (lihat users.service.js#changeEmail), supaya keduanya tidak
// pernah berbeda. Nama tersimpan di pegawai.nama_lengkap, bukan di users
// sama sekali, jadi field ini hanya muncul kalau akun sudah punya profil
// pegawai (tidak setiap user punya satu — registrasi hanya membuat baris
// users, bukan pegawai).
const openEditModal = async (id) => {
  try {
    const res = await getUser(id);
    const u = res.data;
    const selfNote = isSelf(id) ? " Ini adalah akun Anda sendiri." : "";

    const fields = [
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        value: u.email,
        helpText: u.pegawai
          ? undefined
          : "Akun ini belum memiliki profil pegawai — nama tidak dapat diedit di sini.",
      },
    ];

    if (u.pegawai) {
      fields.push({
        name: "namaLengkap",
        label: "Nama Lengkap",
        required: true,
        value: u.pegawai.namaLengkap,
      });
    }

    fields.push(
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
      {
        name: "password",
        label: "Password Baru",
        type: "password",
        helpText: "Opsional — kosongkan jika tidak ingin mengubah password. Minimal 8 karakter.",
      },
    );

    openFormModal({
      title: `Edit User - ${u.email}`,
      submitLabel: "Simpan",
      fields,
      onSubmit: async (values) => {
        if (values.password && values.password.length < 8) {
          throw new Error("Password baru minimal 8 karakter");
        }

        const nextIsActive = values.isActive === "true";
        const tasks = [];

        if (values.email !== u.email) {
          tasks.push(updateUserEmail(id, { email: values.email }));
        }
        if (u.pegawai && values.namaLengkap !== u.pegawai.namaLengkap) {
          tasks.push(updatePegawai(u.pegawai.id, { namaLengkap: values.namaLengkap }));
        }
        if (values.role !== u.role) {
          tasks.push(updateUserRole(id, { role: values.role }));
        }
        if (nextIsActive !== u.isActive) {
          tasks.push(updateUserStatus(id, { isActive: nextIsActive }));
        }
        if (values.password) {
          tasks.push(updateUserPassword(id, { password: values.password }));
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
