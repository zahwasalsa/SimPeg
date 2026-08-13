import { login } from "../api/auth.js";
import { redirectIfAuthenticated } from "../auth/guard.js";
import { showToast } from "../components/toast.js";

redirectIfAuthenticated();

const form = document.getElementById("login-form");
const submitBtn = document.getElementById("login-submit");
const passwordInput = document.getElementById("password");
const togglePasswordBtn = document.getElementById("toggle-password");

togglePasswordBtn.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";
  passwordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "Sembunyikan" : "Tampilkan";
  togglePasswordBtn.setAttribute("aria-label", isHidden ? "Sembunyikan password" : "Tampilkan password");
  togglePasswordBtn.setAttribute("aria-pressed", String(isHidden));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Memproses...";

  try {
    await login(email, password);
    window.location.href = "/dashboard";
  } catch (err) {
    showToast(err.message || "Login gagal", "danger");
    submitBtn.disabled = false;
    submitBtn.textContent = "Masuk";
  }
});
