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

  // A wide table forces horizontal scrolling to reach the last column
  // (conventionally actions) on narrow screens, so mobile gets a second,
  // CSS-toggled rendering of the same columns/rows as stacked cards
  // instead — same data, no scrolling required to find the buttons. A
  // column with no label (the actions column, by convention across every
  // page) renders without a label prefix, in its own row at the bottom.
  const cardsHtml = rows
    .map((row) => {
      const fieldsHtml = columns
        .filter((col) => col.label)
        .map((col) => {
          const content = col.render ? col.render(row) : escapeHtml(row[col.key] ?? "-");
          return `<div class="data-card-row">
            <span class="data-card-label">${escapeHtml(col.label)}</span>
            <span class="data-card-value">${content}</span>
          </div>`;
        })
        .join("");
      const actionsCol = columns.find((col) => !col.label);
      const actionsHtml = actionsCol
        ? `<div class="data-card-actions">${actionsCol.render ? actionsCol.render(row) : ""}</div>`
        : "";
      return `<div class="data-card">${fieldsHtml}${actionsHtml}</div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="table-responsive d-none d-md-block">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light"><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    <div class="data-cards d-md-none">${cardsHtml}</div>`;
};

export const renderErrorState = (container, message) => {
  container.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(message)}</div>`;
};
