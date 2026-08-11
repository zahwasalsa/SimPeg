import { escapeHtml } from "../utils/format.js";

// Generic table renderer. `columns` is [{ key, label, render? }] — if
// `render` is provided it receives the row and returns raw HTML (used for
// action buttons); otherwise the value at `key` is escaped and shown as
// plain text. Caller owns click handling via event delegation on
// `container` (buttons carry data-action/data-id attributes).
export const renderTable = (
  container,
  { columns, rows, emptyMessage = "Tidak ada data", loading = false },
) => {
  if (loading) {
    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
        Memuat...
      </div>`;
    return;
  }

  if (!rows || rows.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-5">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const thead = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");
  const tbody = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const content = col.render ? col.render(row) : escapeHtml(row[col.key] ?? "-");
          return `<td>${content}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light"><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
};

export const renderErrorState = (container, message) => {
  container.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(message)}</div>`;
};
