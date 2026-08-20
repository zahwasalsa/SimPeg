import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderTable, renderErrorState } from "../components/dataTable.js";
import { renderPagination } from "../components/pagination.js";
import { openFormModal } from "../components/modalForm.js";
import { showToast } from "../components/toast.js";
import { escapeHtml, formatDate, formatDateTime } from "../utils/format.js";
import { listHki, getHki, createHki, updateHki, deleteHki } from "../api/hki.js";
import { listPenelitian } from "../api/penelitian.js";
import { listPegawai } from "../api/pegawai.js";

const STAFF_ROLES = ["admin", "hrd"];

const tableEl = document.getElementById("hki-table");
const paginationEl = document.getElementById("hki-pagination");
const addBtn = document.getElementById("hki-add-btn");
const filterPegawaiWrap = document.getElementById("hki-filter-pegawai-wrap");
const filterPegawaiEl = document.getElementById("hki-filter-pegawai");
const filterPenelitianEl = document.getElementById("hki-filter-penelitian");

const state = { page: 1, limit: 10, pegawaiId: undefined, penelitianId: undefined };
let currentUser = null;
let pegawaiMap = {};
let penelitianMap = {};

const canManage = () => Boolean(currentUser && STAFF_ROLES.includes(currentUser.role));
const isPegawai = () => Boolean(currentUser && currentUser.role === "pegawai");
const isPimpinan = () => Boolean(currentUser && currentUser.role === "pimpinan");

// GET /pegawai (list) is admin/hrd-only at the backend — pimpinan/pegawai get
// 403 there, so this is only ever called for canManage() (same pattern as
// kpi.page.js/roadmapKarier.page.js/penelitian.page.js).
const loadPegawaiLookup = async () => {
  const res = await listPegawai({ page: 1, limit: 100 });
  pegawaiMap = Object.fromEntries(res.data.map((p) => [p.id, `${p.nip} - ${p.namaLengkap}`]));

  filterPegawaiEl.innerHTML =
    `<option value="">Semua Pegawai</option>` +
    res.data
      .map((p) => `<option value="${p.id}">${escapeHtml(`${p.nip} - ${p.namaLengkap}`)}</option>`)
      .join("");
};

// GET /penelitian is open to every role and self-scoped server-side: for
// pegawai it returns only their own penelitian (exactly the set they're
// allowed to link an HKI to), for admin/hrd/pimpinan it returns everyone's —
// so this single call works unmodified for every role, unlike the pegawai
// lookup above. Owner name is appended to the label only for canManage()
// (pegawaiMap is only populated for them) so admin/hrd can tell whose
// penelitian they're linking to before submitting.
const loadPenelitianLookup = async () => {
  const res = await listPenelitian({ page: 1, limit: 100 });
  penelitianMap = Object.fromEntries(
    res.data.map((p) => {
      const ownerLabel = canManage() ? ` — ${pegawaiMap[p.pegawaiId] || p.pegawaiId}` : "";
      return [p.id, `${p.judul} (${p.tahun})${ownerLabel}`];
    }),
  );

  filterPenelitianEl.innerHTML =
    `<option value="">Semua Penelitian</option>` +
    Object.entries(penelitianMap)
      .map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`)
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
    { key: "jenis", label: "Jenis", render: (row) => escapeHtml(row.jenis || "-") },
    {
      key: "nomorPendaftaran",
      label: "No. Pendaftaran",
      render: (row) => escapeHtml(row.nomorPendaftaran || "-"),
    },
    {
      key: "tanggalPendaftaran",
      label: "Tanggal Daftar",
      render: (row) => formatDate(row.tanggalPendaftaran),
    },
    {
      key: "penelitian",
      label: "Penelitian",
      render: (row) =>
        escapeHtml(row.penelitianId ? penelitianMap[row.penelitianId] || row.penelitianId : "-"),
    },
    {
      key: "actions",
      label: "",
      render: (row) => {
        const buttons = [
          `<button class="btn btn-sm btn-outline-secondary me-1" data-action="detail" data-id="${row.id}" type="button">Detail</button>`,
        ];
        if (canManage() || isPegawai()) {
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
    const res = await listHki(state);
    renderTable(tableEl, {
      columns: columns(),
      rows: res.data,
      emptyMessage: "Belum ada data HKI",
    });
    renderPagination(paginationEl, res.pagination, (page) => {
      state.page = page;
      load();
    });
  } catch (err) {
    renderErrorState(tableEl, err.message || "Gagal memuat data HKI");
  }
};

// --- Tambah / Edit HKI ---

const commonFields = (values = {}) => [
  { name: "judul", label: "Judul", required: true, value: values.judul },
  {
    name: "jenis",
    label: "Jenis",
    value: values.jenis,
    helpText: "Opsional — contoh: Paten, Hak Cipta, Merek.",
  },
  {
    name: "nomorPendaftaran",
    label: "Nomor Pendaftaran",
    value: values.nomorPendaftaran,
    helpText: "Opsional.",
  },
  {
    name: "tanggalPendaftaran",
    label: "Tanggal Pendaftaran",
    type: "date",
    value: values.tanggalPendaftaran,
    helpText: "Opsional.",
  },
  {
    name: "penelitianId",
    label: "Penelitian Terkait",
    type: "select",
    value: values.penelitianId || "",
    options: [
      { value: "", label: "- Tidak ada -" },
      ...Object.entries(penelitianMap).map(([value, label]) => ({ value, label })),
    ],
    helpText: "Opsional — harus penelitian milik pegawai yang sama dengan HKI ini.",
  },
];

const sanitizeCommonPayload = (values) => ({
  judul: values.judul.trim(),
  jenis: values.jenis ? values.jenis.trim() : null,
  nomorPendaftaran: values.nomorPendaftaran ? values.nomorPendaftaran.trim() : null,
  tanggalPendaftaran: values.tanggalPendaftaran || null,
  penelitianId: values.penelitianId || null,
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
    title: "Tambah HKI",
    fields,
    onSubmit: async (values) => {
      const payload = sanitizeCommonPayload(values);
      if (canManage()) {
        payload.pegawaiId = values.pegawaiId;
      }
      await createHki(payload);
      showToast("HKI berhasil dibuat", "success");
      state.page = 1;
      await load();
    },
  });
};

const openEditModal = async (id) => {
  try {
    const res = await getHki(id);
    const h = res.data;
    const fields = canManage()
      ? [
          {
            name: "pegawaiId",
            label: "Pegawai",
            type: "text",
            value: pegawaiMap[h.pegawaiId] || h.pegawaiId,
          },
          ...commonFields(h),
        ]
      : commonFields(h);

    openFormModal({
      title: "Edit HKI",
      fields,
      onSubmit: async (values) => {
        await updateHki(id, sanitizeCommonPayload(values));
        showToast("HKI berhasil diperbarui", "success");
        await load();
      },
    });
  } catch (err) {
    showToast(err.message || "Gagal memuat data HKI", "danger");
  }
};

const handleDelete = async (id) => {
  if (!window.confirm("Hapus data HKI ini? Data akan disembunyikan dari daftar.")) {
    return;
  }
  try {
    await deleteHki(id);
    showToast("HKI berhasil dihapus", "success");
    await load();
  } catch (err) {
    showToast(err.message || "Gagal menghapus HKI", "danger");
  }
};

// --- Detail modal ---

let detailModalEl = null;

const buildDetailModal = () => {
  const el = document.createElement("div");
  el.id = "hki-detail-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Detail HKI</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
        <div class="modal-body">
          <dl class="row mb-0" id="hki-detail-metadata"></dl>
        </div>
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
    const el = detailModalEl || (detailModalEl = buildDetailModal());
    const res = await getHki(id);
    const h = res.data;

    const rows = [];
    if (canManage() || isPimpinan()) {
      rows.push(detailRow("Pegawai", escapeHtml(pegawaiMap[h.pegawaiId] || h.pegawaiId)));
    }
    rows.push(
      detailRow("Judul", escapeHtml(h.judul)),
      detailRow("Jenis", escapeHtml(h.jenis || "-")),
      detailRow("Nomor Pendaftaran", escapeHtml(h.nomorPendaftaran || "-")),
      detailRow("Tanggal Pendaftaran", formatDate(h.tanggalPendaftaran)),
      detailRow(
        "Penelitian Terkait",
        escapeHtml(h.penelitianId ? penelitianMap[h.penelitianId] || h.penelitianId : "-"),
      ),
      detailRow("Terakhir Diubah", formatDateTime(h.updatedAt)),
    );
    document.getElementById("hki-detail-metadata").innerHTML = rows.join("");

    window.bootstrap.Modal.getOrCreateInstance(el).show();
  } catch (err) {
    showToast(err.message || "Gagal memuat detail HKI", "danger");
  }
};

const init = async () => {
  currentUser = await requireAuth();
  if (!currentUser) {
    return;
  }

  renderNavbar("/hki");

  if (canManage()) {
    try {
      await loadPegawaiLookup();
    } catch {
      showToast("Gagal memuat daftar pegawai", "danger");
    }
    filterPegawaiWrap.classList.remove("d-none");
  }

  try {
    await loadPenelitianLookup();
  } catch {
    showToast("Gagal memuat daftar penelitian", "danger");
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

  filterPenelitianEl.addEventListener("change", () => {
    state.penelitianId = filterPenelitianEl.value || undefined;
    state.page = 1;
    load();
  });

  await load();
};

init();
