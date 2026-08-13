import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { logout } from "../api/auth.js";
import { getPegawai, updatePegawai } from "../api/pegawai.js";
import { getDivisi } from "../api/divisi.js";
import { getJabatan } from "../api/jabatan.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";

const JENIS_KELAMIN_OPTIONS = [
  { value: "Laki-laki", label: "Laki-laki" },
  { value: "Perempuan", label: "Perempuan" },
];

let currentPegawaiId = null;

const detailRow = (label, value) => `
  <dt class="col-sm-4">${escapeHtml(label)}</dt>
  <dd class="col-sm-8">${value}</dd>`;

const renderAccountCard = (user) => `
  <div class="card profile-card mb-3">
    <div class="card-body">
      <dl class="row mb-0">
        <dt class="col-sm-4">Email</dt>
        <dd class="col-sm-8">${escapeHtml(user.email)}</dd>
        <dt class="col-sm-4">Role</dt>
        <dd class="col-sm-8"><span class="badge text-bg-primary">${escapeHtml(user.role)}</span></dd>
        <dt class="col-sm-4">Status</dt>
        <dd class="col-sm-8">${user.isActive ? "Aktif" : "Nonaktif"}</dd>
        <dt class="col-sm-4">Login terakhir</dt>
        <dd class="col-sm-8">${formatDateTime(user.lastLogin)}</dd>
      </dl>
    </div>
  </div>`;

// Personal fields only — nip/namaLengkap/divisiId/jabatanId/statusKepegawaian
// stay admin/HRD-only, mirroring the backend restriction in
// pegawai.service.js exactly (self-editors get 403 if they send those).
const openEditPegawaiModal = (pegawai) => {
  openFormModal({
    title: "Edit Profil Pegawai",
    fields: [
      {
        name: "jenisKelamin",
        label: "Jenis Kelamin",
        type: "select",
        options: JENIS_KELAMIN_OPTIONS,
        value: pegawai.jenisKelamin,
      },
      { name: "tempatLahir", label: "Tempat Lahir", value: pegawai.tempatLahir },
      { name: "tanggalLahir", label: "Tanggal Lahir", type: "date", value: pegawai.tanggalLahir },
      { name: "alamat", label: "Alamat", type: "textarea", value: pegawai.alamat },
      { name: "noTelepon", label: "No. Telepon", value: pegawai.noTelepon },
    ],
    onSubmit: async (values) => {
      const payload = { ...values };
      Object.keys(payload).forEach((key) => {
        if (payload[key] === "") {
          payload[key] = null;
        }
      });
      await updatePegawai(currentPegawaiId, payload);
      showToast("Profil berhasil diperbarui", "success");
      await loadPegawaiProfile();
    },
  });
};

const loadPegawaiProfile = async () => {
  const container = document.getElementById("profile-pegawai");
  if (!container) {
    return;
  }

  try {
    const res = await getPegawai(currentPegawaiId);
    const pegawai = res.data;

    const [divisiName, jabatanName] = await Promise.all([
      pegawai.divisiId
        ? getDivisi(pegawai.divisiId)
            .then((r) => r.data.namaDivisi)
            .catch(() => "-")
        : Promise.resolve("-"),
      pegawai.jabatanId
        ? getJabatan(pegawai.jabatanId)
            .then((r) => r.data.namaJabatan)
            .catch(() => "-")
        : Promise.resolve("-"),
    ]);

    const rows = [
      detailRow("NIP", escapeHtml(pegawai.nip)),
      detailRow("Nama Lengkap", escapeHtml(pegawai.namaLengkap)),
      detailRow("Divisi", escapeHtml(divisiName)),
      detailRow("Jabatan", escapeHtml(jabatanName)),
      detailRow("Status Kepegawaian", escapeHtml(pegawai.statusKepegawaian)),
      detailRow("Jenis Kelamin", escapeHtml(pegawai.jenisKelamin || "-")),
      detailRow("Tempat Lahir", escapeHtml(pegawai.tempatLahir || "-")),
      detailRow("Tanggal Lahir", pegawai.tanggalLahir ? formatDate(pegawai.tanggalLahir) : "-"),
      detailRow("Alamat", escapeHtml(pegawai.alamat || "-")),
      detailRow("No. Telepon", escapeHtml(pegawai.noTelepon || "-")),
    ];

    container.innerHTML = `
      <div class="card profile-card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h5 mb-0">Data Kepegawaian</h2>
            <button id="profile-edit-btn" class="btn btn-sm btn-outline-primary" type="button">
              Edit Profil
            </button>
          </div>
          <p class="text-muted small">
            Anda hanya dapat mengubah data pribadi (jenis kelamin, tempat/tanggal lahir, alamat, no.
            telepon). NIP, nama, divisi, jabatan, dan status kepegawaian hanya dapat diubah oleh admin/HRD.
          </p>
          <dl class="row mb-0">${rows.join("")}</dl>
        </div>
      </div>`;

    document
      .getElementById("profile-edit-btn")
      .addEventListener("click", () => openEditPegawaiModal(pegawai));
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(err.message || "Gagal memuat data kepegawaian")}</div>`;
  }
};

const init = async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  renderNavbar("/profile");
  currentPegawaiId = user.pegawaiId || null;

  document.getElementById("profile-content").innerHTML = `
    ${renderAccountCard(user)}
    ${currentPegawaiId ? '<div id="profile-pegawai"><div class="text-muted">Memuat data kepegawaian...</div></div>' : ""}
    <button id="logout-btn-page" class="btn btn-outline-danger mt-3" type="button">Logout</button>
  `;

  document.getElementById("logout-btn-page").addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });

  if (currentPegawaiId) {
    await loadPegawaiProfile();
  }
};

init();
