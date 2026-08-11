import { requireAuth } from "../auth/guard.js";
import { renderNavbar } from "../components/navbar.js";
import { logout } from "../api/auth.js";
import { escapeHtml, formatDateTime } from "../utils/format.js";

const init = async () => {
  const user = await requireAuth();
  if (!user) {
    return;
  }

  renderNavbar("/profile");

  document.getElementById("profile-content").innerHTML = `
    <div class="card profile-card">
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
    </div>
    <button id="logout-btn-page" class="btn btn-outline-danger mt-3" type="button">Logout</button>
  `;

  document.getElementById("logout-btn-page").addEventListener("click", async () => {
    await logout();
    window.location.href = "/login";
  });
};

init();
