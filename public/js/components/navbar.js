import { getCachedUser, logout } from "../api/auth.js";
import { escapeHtml } from "../utils/format.js";

// Menu items mirror the backend permission matrices established in Phase
// 1-6 exactly. This is a UX convenience only — hiding a link here does not
// grant or revoke any access; the API enforces the real rule regardless.
const ALL_ROLES = ["admin", "hrd", "pegawai", "pimpinan"];
const MANAGE_ROLES = ["admin", "hrd"];
const ADMIN_ONLY = ["admin"];

const MENU = [
  { label: "Dashboard", href: "/dashboard", roles: ALL_ROLES },
  { label: "Divisi", href: "/divisi", roles: ALL_ROLES },
  { label: "Jabatan", href: "/jabatan", roles: ALL_ROLES },
  // GET /pegawai (list) is admin/hrd-only at the backend (pegawai/pimpinan
  // get 403) — the link is hidden for them rather than leading to a dead end.
  { label: "Pegawai", href: "/pegawai", roles: MANAGE_ROLES },
  // GET /absensi is open to every role — visibility (own vs. all records)
  // and write access are scoped server-side per role, not by hiding the link.
  { label: "Absensi", href: "/absensi", roles: ALL_ROLES },
  // GET /cuti is likewise open to every role and self-scoped server-side;
  // pimpinan cannot submit new requests (POST is 403 for them) but can still
  // view and cancel their own, so the link stays visible for them too.
  { label: "Cuti", href: "/cuti", roles: ALL_ROLES },
  // GET /users (list) is admin-only at the backend — even hrd gets 403,
  // unlike Pegawai's admin+hrd matrix — so this link is stricter than Pegawai.
  { label: "Manajemen User", href: "/users", roles: ADMIN_ONLY },
  { label: "Profil", href: "/profile", roles: ALL_ROLES },
];

export const renderNavbar = (activePath) => {
  const container = document.getElementById("app-navbar");
  if (!container) {
    return;
  }

  const user = getCachedUser();
  const items = MENU.filter((item) => !user || item.roles.includes(user.role));

  const linksHtml = items
    .map((item) => {
      const activeClass = item.href === activePath ? " active" : "";
      return `<li class="nav-item"><a class="nav-link${activeClass}" href="${item.href}">${escapeHtml(item.label)}</a></li>`;
    })
    .join("");

  container.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
      <div class="container-fluid">
        <a class="navbar-brand" href="/dashboard">SimPeg</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMenu"
          aria-controls="navbarMenu" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarMenu">
          <ul class="navbar-nav me-auto mb-2 mb-lg-0">${linksHtml}</ul>
          <span class="navbar-text text-light me-3">${user ? `${escapeHtml(user.email)} (${escapeHtml(user.role)})` : ""}</span>
          <button id="navbar-logout-btn" class="btn btn-outline-light btn-sm" type="button">Logout</button>
        </div>
      </div>
    </nav>
  `;

  document.getElementById("navbar-logout-btn").addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });
};
