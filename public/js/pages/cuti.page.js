import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { renderStatusBadge } from "../components/statusBadge.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import {
  listCuti,
  getCuti,
  createCuti,
  approveCuti,
  rejectCuti,
  cancelCuti,
  deleteCuti,
} from "../api/cuti.js";
import { listPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];
const SUBMIT_ROLES = ["admin", "hrd", "pegawai"]; // pimpinan cannot submit at all

// alasan is the only optional+nullable field on create; empty strings must
// be stripped rather than sent (see the equivalent note in pegawai.page.js).
const OPTIONAL_KEYS = ["alasan"];

const JENIS_CUTI_OPTIONS = [
  { value: "cuti_tahunan", label: "Cuti Tahunan" },
  { value: "cuti_sakit", label: "Cuti Sakit" },
  { value: "cuti_melahirkan", label: "Cuti Melahirkan" },
  { value: "cuti_besar", label: "Cuti Besar" },
  { value: "cuti_alasan_penting", label: "Cuti Alasan Penting" },
];
const JENIS_CUTI_LABELS = Object.fromEntries(JENIS_CUTI_OPTIONS.map((o) => [o.value, o.label]));

const STATUS_VARIANTS = {
  diajukan: { color: "warning", label: "Diajukan" },
  disetujui: { color: "success", label: "Disetujui" },
  ditolak: { color: "danger", label: "Ditolak" },
  dibatalkan: { color: "secondary", label: "Dibatalkan" },
};

const tableEl = document.getElementById("cuti-table");
const paginationEl = document.getElementById("cuti-pagination");
const addBtn = document.getElementById("cuti-add-btn");
const filterPegawaiWrap = document.getElementById("cuti-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("cuti-filter-pegawai");
const filterStatusEl = document.getElementById("cuti-filter-status");
const filterJenisEl = document.getElementById("cuti-filter-jenis");

const state = { page: 1, limit: 10, pegawaiId: undefined, status: undefined, jenisCuti: undefined };
let currentUser = null;
let pegawaiMap = {};

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
const canSubmit = () => Boolean(currentUser && SUBMIT_ROLES.includes(currentUser.role));

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
    {
      key: "jenisCuti",
      label: "Jenis Cuti",
      render: (row) => escapeHtml(JENIS_CUTI_LABELS[row.jenisCuti] || row.jenisCuti),
    },
    { key: "tanggalMulai", label: "Mulai", render: (row) => formatDate(row.tanggalMulai) },
    { key: "tanggalSelesai", label: "Selesai", render: (row) => formatDate(row.tanggalSelesai) },
    { key: "jumlahHari", label: "Jumlah Hari" },
    { key: "status", label: "Status", render: (row) => renderStatusBadge(row.status, STATUS_VARIANTS) },
    {
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>`,
        ];
        if (canManage() && row.status === "diajukan") {
          buttons.push(
            `<button class="btn btn-sm btn-outline-success me-1" data-action="approve" data-id="${row.id}" type="button">Setujui</button>`,
            `<button class="btn btn-sm btn-outline-danger me-1" data-action="reject" data-id="${row.id}" type="button">Tolak</button>`,
          );
        }
        if (row.status === "diajukan") {
          buttons.push(
            `<button class="btn btn-sm btn-outline-dark me-1" data-action="cancel" data-id="${row.id}" type="button">Batalkan</button>`,
          );
        }
        if (canManage()) {
          buttons.push(
            `<button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${row.id}" type="button">Hapus</button>`,
          );
        }
        return buttons.join("");
      },
    },
  );

  return base;
};

const load = async () => {
  renderTable(tableEl, { columns: columns(), rows: [], loading: true });
  paginationEl.innerHTML = "";

  try {
    const res = await listCuti(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data cuti",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data cuti");
  }
};

const formFields = () => {
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
    { name: "jenisCuti", label: "Jenis Cuti", type: "select", required: true, options: JENIS_CUTI_OPTIONS },
    {
      name: "tanggalMulai",
      label: "Tanggal Mulai",
      type: "date",
      required: true,
      helpText: !canManage() ? "Tidak boleh sebelum hari ini, kecuali untuk Cuti Sakit." : undefined,
    },
    { name: "tanggalSelesai", label: "Tanggal Selesai", type: "date", required: true },
    { name: "alasan", label: "Alasan", type: "textarea" },
  );

  return fields;
};

const openCreateModal = () => {
  openFormModal({
    title: "Ajukan Cuti",
    fields: formFields(),
    onSubmit: async (values) => {
      await createCuti(sanitizePayload(values));
      showToast("Pengajuan cuti berhasil dikirim", "success");
      state.page = 1;
      await load();
    },
  });
};

const openApproveModal = (id) => {
  openFormModal({
    title: "Setujui Pengajuan Cuti",
    fields: [{ name: "catatanApproval", label: "Catatan (opsional)", type: "textarea" }],
    submitLabel: "Setujui",
    onSubmit: async (values) => {
      const payload = { ...values };
      if (payload.catatanApproval === "") {
        delete payload.catatanApproval;
      }
      await approveCuti(id, payload);
      showToast("Pengajuan cuti disetujui", "success");
      await load();
    },
  });
};

const openRejectModal = (id) => {
  openFormModal({
    title: "Tolak Pengajuan Cuti",
    fields: [{ name: "catatanApproval", label: "Catatan Penolakan", type: "textarea", required: true }],
    submitLabel: "Tolak",
    onSubmit: async (values) => {
      await rejectCuti(id, values);
      showToast("Pengajuan cuti ditolak", "success");
      await load();
    },
  });
};

const handleCancel = async (id) => {
  try {
    await cancelCuti(id);
    showToast("Pengajuan cuti dibatalkan", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal membatalkan pengajuan cuti", "danger");
  }
};

const handleDelete = async (id) => {
  if (!window.confirm("Hapus data cuti ini? Data akan disembunyikan dari daftar.")) {
    return;
  }
  try {
    await deleteCuti(id);
    showToast("Data cuti berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus data cuti", "danger");
  }
};

let detailModalEl = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "cuti-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail Cuti</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body" id="cuti-detail-body"></div>
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
    const res = await getCuti(id);
    const c = res.data;
    const el = detailModalEl || (detailModalEl = buildDetailModal());

    const rows = [];
    if (canManage()) {
      rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[c.pegawaiId] || c.pegawaiId)));
    }
    rows.push(
      detailRow("Jenis Cuti", escapeHtml(JENIS_CUTI_LABELS[c.jenisCuti] || c.jenisCuti)),
      detailRow("Tanggal Mulai", formatDate(c.tanggalMulai)),
      detailRow("Tanggal Selesai", formatDate(c.tanggalSelesai)),
      detailRow("Jumlah Hari", escapeHtml(String(c.jumlahHari))),
      detailRow("Alasan", escapeHtml(c.alasan || "-")),
      detailRow("Status", renderStatusBadge(c.status, STATUS_VARIANTS)),
      detailRow("Catatan Approval", escapeHtml(c.catatanApproval || "-")),
      detailRow("Tanggal Persetujuan", c.tanggalPersetujuan ? formatDateTime(c.tanggalPersetujuan) : "-"),
      detailRow("Terakhir Diubah", formatDateTime(c.updatedAt)),
    );

    document.getElementById("cuti-detail-body").innerHTML = `<dl class="row mb-0">${rows.join("")}</dl>`;
    window.bootstrap.Modal.getOrCreateInstance(el).show();
  } catch (err) {
    showToast(err.message || "Gagal memuat detail cuti", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/cuti");

  if (canManage()) {
    filterPegawaiWrap.classList.remove("d-none");
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
  }

  if (canSubmit()) {
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
    } else if (action === "approve") {
      openApproveModal(id);
    } else if (action === "reject") {
      openRejectModal(id);
    } else if (action === "cancel") {
      handleCancel(id);
    } else if (action === "delete") {
      handleDelete(id);
    }
  });

  filterPegawaiEl.addEventListener("change", () => {
    state.pegawaiId = filterPegawaiEl.value || undefined;
    state.page = 1;
    load();
  });

  filterStatusEl.addEventListener("change", () => {
    state.status = filterStatusEl.value || undefined;
    state.page = 1;
    load();
  });

  filterJenisEl.addEventListener("change", () => {
    state.jenisCuti = filterJenisEl.value || undefined;
    state.page = 1;
    load();
  });

  await load();
};

init();
