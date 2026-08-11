// Renders Bootstrap pagination controls and wires click handlers. Safe to
// call repeatedly — each call fully replaces the previous markup+listeners.
// Accepts the `pagination` object exactly as returned by the backend
// (api.md §3): { page, limit, total, total_pages } — snake_case, not a
// frontend convention choice.
export const renderPagination = (container, { page, total_pages: totalPages }, onPageChange) => {
  if (!totalPages || totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  const pageItem = (label, targetPage, { disabled = false, active = false } = {}) => `
    <li class="page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}">
      <button class="page-link" type="button" data-page="${targetPage}" ${disabled ? "disabled" : ""}>${label}</button>
    </li>`;

  const items = [pageItem("&laquo;", page - 1, { disabled: page <= 1 })];
  for (let p = 1; p <= totalPages; p += 1) {
    items.push(pageItem(String(p), p, { active: p === page }));
  }
  items.push(pageItem("&raquo;", page + 1, { disabled: page >= totalPages }));

  container.innerHTML = `<ul class="pagination pagination-sm justify-content-center flex-wrap mb-0">${items.join("")}</ul>`;

  container.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetPage = Number(btn.dataset.page);
      if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
        onPageChange(targetPage);
      }
    });
  });
};
