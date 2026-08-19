import { getCachedUser, logout } from "../api/auth.js";
import { escapeHtml } from "../utils/format.js";

// Menu items mirror the backend permission matrices established in Phase
// 1-6 exactly. This is a UX convenience only — hiding a link here does not
// grant or revoke any access; the API enforces the real rule regardless.
const ALL_ROLES = ["admin", "hrd", "pegawai", "pimpinan"];
const MANAGE_ROLES = ["admin", "hrd"];
const ADMIN_ONLY = ["admin"];

// Sidebar groups mirror the SATU-style reference layout: a short "Beranda"
// group, then role-scoped sections. A group disappears entirely once role
// filtering empties it (e.g. pegawai never sees "Data Kepegawaian").
const NAV_GROUPS = [
  {
    title: "Beranda",
    items: [{ label: "Dashboard", href: "/dashboard", roles: ALL_ROLES, icon: "bi-speedometer2" }],
  },
  {
    title: "Data Kepegawaian",
    items: [
      // Divisi/Jabatan are master data that only admin/hrd manage (create,
      // rename, delete). Pegawai/pimpinan already see their own divisi &
      // jabatan on Profil — GET /divisi and /jabatan stay open to every role
      // at the backend, this only hides the standalone browse/manage page.
      { label: "Divisi", href: "/divisi", roles: MANAGE_ROLES, icon: "bi-diagram-3" },
      { label: "Jabatan", href: "/jabatan", roles: MANAGE_ROLES, icon: "bi-briefcase" },
      // GET /pegawai (list) is admin/hrd-only at the backend.
      { label: "Pegawai", href: "/pegawai", roles: MANAGE_ROLES, icon: "bi-people" },
    ],
  },
  {
    title: "Absensi & Cuti",
    items: [
      // GET /absensi and /cuti are open to every role — visibility (own vs.
      // all) and write access are scoped server-side per role.
      { label: "Absensi", href: "/absensi", roles: ALL_ROLES, icon: "bi-calendar-check" },
      { label: "Cuti", href: "/cuti", roles: ALL_ROLES, icon: "bi-airplane" },
    ],
  },
  {
    title: "Kinerja & Karier",
    items: [
      // GET /kpi, /roadmap-karier, /penelitian, /hki are open to every role
      // and self-scoped server-side; write access differs per role but the
      // link stays visible regardless (write endpoints 403 when disallowed).
      { label: "KPI", href: "/kpi", roles: ALL_ROLES, icon: "bi-graph-up-arrow" },
      { label: "Roadmap Karier", href: "/roadmap-karier", roles: ALL_ROLES, icon: "bi-signpost-split" },
      { label: "Penelitian", href: "/penelitian", roles: ALL_ROLES, icon: "bi-journal-richtext" },
      { label: "HKI", href: "/hki", roles: ALL_ROLES, icon: "bi-patch-check" },
    ],
  },
  {
    title: "Dokumen",
    items: [{ label: "Dokumen", href: "/dokumen", roles: ALL_ROLES, icon: "bi-file-earmark-text" }],
  },
  {
    title: "Administrasi",
    items: [
      // GET /users (list) is admin-only at the backend — even hrd gets 403.
      { label: "Manajemen User", href: "/users", roles: ADMIN_ONLY, icon: "bi-person-gear" },
    ],
  },
];

// Bottom tab bar (mobile only) can't fit the full menu, so it surfaces just
// the handful of sections every role reaches most often. Filtered through
// the exact same role rules as NAV_GROUPS above — never a separate
// permission list — so it can never show a link the sidebar would hide.
// The full list stays reachable on mobile via the sidebar drawer toggle.
const BOTTOM_NAV_HREFS = ["/dashboard", "/kpi", "/roadmap-karier", "/dokumen", "/profile"];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const renderNavbar = (activePath) => {
  const container = document.getElementById("app-navbar");
  if (!container) {
    return;
  }

  document.body.classList.add("app-has-sidebar");

  const user = getCachedUser();
  const visibleGroups = NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => !user || item.roles.includes(user.role)),
  })).filter((group) => group.items.length > 0);

  const allItems = ALL_ITEMS.filter((item) => !user || item.roles.includes(user.role));
  const bottomItems = BOTTOM_NAV_HREFS.map((href) => allItems.find((item) => item.href === href)).filter(
    Boolean,
  );
  const currentItem = allItems.find((item) => item.href === activePath);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "?";

  const groupsHtml = visibleGroups
    .map((group) => {
      const linksHtml = group.items
        .map((item) => {
          const activeClass = item.href === activePath ? " active" : "";
          return `<li>
            <a class="app-sidebar-link${activeClass}" href="${item.href}">
              <i class="bi ${item.icon}"></i><span>${escapeHtml(item.label)}</span>
            </a>
          </li>`;
        })
        .join("");
      return `<div class="app-sidebar-group">
        <div class="app-sidebar-group-title">${escapeHtml(group.title)}</div>
        <ul class="app-sidebar-list">${linksHtml}</ul>
      </div>`;
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
    <aside class="app-sidebar" id="app-sidebar">
      <a class="app-sidebar-brand" href="/dashboard">
        <span class="app-brand-mark"><i class="bi bi-hexagon-fill"></i></span>
        <span class="app-sidebar-brand-text">
          <strong>SimPeg</strong>
          <small>Sistem Kepegawaian</small>
        </span>
      </a>
      <nav class="app-sidebar-nav" aria-label="Navigasi utama">${groupsHtml}</nav>
      <a class="app-sidebar-user" href="/profile">
        <span class="app-user-avatar">${escapeHtml(initials)}</span>
        <span class="app-user-meta">
          <span class="app-user-email">${user ? escapeHtml(user.email) : ""}</span>
          <span class="app-user-role">${user ? escapeHtml(user.role) : ""}</span>
        </span>
      </a>
      <button id="navbar-logout-btn" class="app-sidebar-logout" type="button">
        <i class="bi bi-box-arrow-right"></i> Logout
      </button>
    </aside>
    <div class="app-sidebar-backdrop" id="app-sidebar-backdrop"></div>
    <header class="app-topbar">
      <button
        class="app-sidebar-toggle"
        type="button"
        id="app-sidebar-toggle"
        aria-label="Buka menu"
        aria-controls="app-sidebar"
        aria-expanded="false"
      >
        <i class="bi bi-list"></i>
      </button>
      <a class="app-topbar-brand" href="/dashboard">
        <span class="app-brand-mark"><i class="bi bi-hexagon-fill"></i></span>
      </a>
      <nav class="app-breadcrumb" aria-label="breadcrumb">
        <span class="app-breadcrumb-root">SimPeg</span>
        <i class="bi bi-chevron-right"></i>
        <span class="app-breadcrumb-current">${escapeHtml(currentItem?.label || "")}</span>
      </nav>
    </header>
    <nav class="app-bottomnav d-md-none" aria-label="Navigasi cepat">
      ${bottomHtml}
    </nav>
  `;

  document.getElementById("navbar-logout-btn").addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });

  const sidebar = document.getElementById("app-sidebar");
  const backdrop = document.getElementById("app-sidebar-backdrop");
  const toggleBtn = document.getElementById("app-sidebar-toggle");

  const closeSidebar = () => {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    toggleBtn.setAttribute("aria-expanded", "false");
  };
  const openSidebar = () => {
    sidebar.classList.add("is-open");
    backdrop.classList.add("is-open");
    toggleBtn.setAttribute("aria-expanded", "true");
  };

  toggleBtn.addEventListener("click", () => {
    if (sidebar.classList.contains("is-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
  backdrop.addEventListener("click", closeSidebar);
};
