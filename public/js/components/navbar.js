import { getCachedUser, logout } from "../api/auth.js";
import { escapeHtml } from "../utils/format.js";

// Menu items mirror the backend permission matrices established in Phase
// 1-6 exactly. This is a UX convenience only — hiding a link here does not
// grant or revoke any access; the API enforces the real rule regardless.
const ALL_ROLES = ["admin", "hrd", "pegawai", "pimpinan"];
const MANAGE_ROLES = ["admin", "hrd"];
const ADMIN_ONLY = ["admin"];

const MENU = [
  { label: "Dashboard", href: "/dashboard", roles: ALL_ROLES, icon: "bi-speedometer2" },
  // Divisi/Jabatan are master data that only admin/hrd manage (create, rename,
  // delete). Pegawai/pimpinan already see their own divisi & jabatan on their
  // Profil page — they never need to browse the full org-wide list, so the
  // link is hidden for them. GET /divisi and /jabatan stay open to every role
  // at the backend (other pages, e.g. Pegawai's divisi/jabatan dropdowns,
  // still rely on that) — this only hides the standalone browse/manage page.
  { label: "Divisi", href: "/divisi", roles: MANAGE_ROLES, icon: "bi-diagram-3" },
  { label: "Jabatan", href: "/jabatan", roles: MANAGE_ROLES, icon: "bi-briefcase" },
  // GET /pegawai (list) is admin/hrd-only at the backend (pegawai/pimpinan
  // get 403) — the link is hidden for them rather than leading to a dead end.
  { label: "Pegawai", href: "/pegawai", roles: MANAGE_ROLES, icon: "bi-people" },
  // GET /absensi is open to every role — visibility (own vs. all records)
  // and write access are scoped server-side per role, not by hiding the link.
  { label: "Absensi", href: "/absensi", roles: ALL_ROLES, icon: "bi-calendar-check" },
  // GET /cuti is likewise open to every role and self-scoped server-side;
  // pimpinan cannot submit new requests (POST is 403 for them) but can still
  // view and cancel their own, so the link stays visible for them too.
  { label: "Cuti", href: "/cuti", roles: ALL_ROLES, icon: "bi-airplane" },
  // GET /dokumen is likewise open to every role and self-scoped server-side;
  // pimpinan cannot upload (POST is 403 for them) but can still view/download
  // their own, so the link stays visible for them too — same pattern as Cuti.
  { label: "Dokumen", href: "/dokumen", roles: ALL_ROLES, icon: "bi-file-earmark-text" },
  // GET /kpi is open to every role and self-scoped server-side (pegawai only
  // ever sees their own records); pegawai/hrd/admin can write, pimpinan is
  // view-only (write endpoints 403 for them) but the link stays visible.
  { label: "KPI", href: "/kpi", roles: ALL_ROLES, icon: "bi-graph-up-arrow" },
  // GET /roadmap-karier is open to every role and self-scoped server-side
  // (pegawai only ever sees their own records); admin/hrd can write,
  // pegawai/pimpinan are both view-only (write endpoints 403 for them) but
  // the link stays visible for everyone — same pattern as KPI.
  { label: "Roadmap Karier", href: "/roadmap-karier", roles: ALL_ROLES, icon: "bi-signpost-split" },
  // GET /penelitian is open to every role and self-scoped server-side
  // (pegawai only ever sees their own records); pegawai/admin/hrd can write
  // (pegawai has full CRUD on their own, unlike KPI/Roadmap Karier), pimpinan
  // is view-only (write endpoints 403 for them) but the link stays visible.
  { label: "Penelitian", href: "/penelitian", roles: ALL_ROLES, icon: "bi-journal-richtext" },
  // GET /hki is likewise open to every role and self-scoped server-side —
  // same permission shape as Penelitian.
  { label: "HKI", href: "/hki", roles: ALL_ROLES, icon: "bi-patch-check" },
  // GET /users (list) is admin-only at the backend — even hrd gets 403,
  // unlike Pegawai's admin+hrd matrix — so this link is stricter than Pegawai.
  { label: "Manajemen User", href: "/users", roles: ADMIN_ONLY, icon: "bi-person-gear" },
  { label: "Profil", href: "/profile", roles: ALL_ROLES, icon: "bi-person-circle" },
];

// Bottom tab bar (mobile only) can't fit the full menu, so it surfaces just
// the handful of sections every role reaches most often. Filtered through
// the exact same role rules as MENU above — never a separate permission
// list — so it can never show a link MENU itself would hide. The full list
// (including admin-only pages like Manajemen User) stays reachable on mobile
// via the hamburger collapse.
const BOTTOM_NAV_HREFS = ["/dashboard", "/kpi", "/roadmap-karier", "/dokumen", "/profile"];

export const renderNavbar = (activePath) => {
  const container = document.getElementById("app-navbar");
  if (!container) {
    return;
  }

  const user = getCachedUser();
  const items = MENU.filter((item) => !user || item.roles.includes(user.role));
  const bottomItems = BOTTOM_NAV_HREFS.map((href) => items.find((item) => item.href === href)).filter(
    Boolean,
  );

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "?";

  const linksHtml = items
    .map((item) => {
      const activeClass = item.href === activePath ? " active" : "";
      return `<li class="nav-item">
        <a class="nav-link app-nav-link${activeClass}" href="${item.href}">
          <i class="bi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>
        </a>
      </li>`;
    })
    .join("");

  const bottomHtml = bottomItems
    .map((item) => {
      const activeClass = item.href === activePath ? " active" : "";
      return `<a class="app-bottomnav-link${activeClass}" href="${item.href}">
        <i class="bi ${item.icon}"></i>
        <span>${escapeHtml(item.label)}</span>
      </a>`;
    })
    .join("");

  container.innerHTML = `
    <nav class="navbar navbar-expand-md app-topnav">
      <div class="container-fluid">
        <a class="navbar-brand app-brand" href="/dashboard">
          <span class="app-brand-mark"><i class="bi bi-hexagon-fill"></i></span>
          SimPeg
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMenu"
          aria-controls="navbarMenu" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarMenu">
          <ul class="navbar-nav me-auto mb-2 mb-md-0">${linksHtml}</ul>
          <div class="app-user-chip">
            <span class="app-user-avatar">${escapeHtml(initials)}</span>
            <span class="app-user-meta">
              <span class="app-user-email">${user ? escapeHtml(user.email) : ""}</span>
              <span class="app-user-role">${user ? escapeHtml(user.role) : ""}</span>
            </span>
            <button id="navbar-logout-btn" class="btn btn-outline-secondary btn-sm app-logout-btn" type="button" title="Logout" aria-label="Logout">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    </nav>
    <nav class="app-bottomnav d-md-none" aria-label="Navigasi utama">
      ${bottomHtml}
    </nav>
  `;

  document.getElementById("navbar-logout-btn").addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });
};
