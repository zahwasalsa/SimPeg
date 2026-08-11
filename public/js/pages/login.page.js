import { login } from "../api/auth.js";
import { redirectIfAuthenticated } from "../auth/guard.js";
import { showToast } from "../components/toast.js";

redirectIfAuthenticated();

const form = document.getElementById("login-form");
const submitBtn = document.getElementById("login-submit");

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
