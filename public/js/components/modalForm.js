import { showToast } from "./toast.js";
import { escapeHtml } from "../utils/format.js";

// Generic create/edit form modal built on a single Bootstrap modal instance
// reused across calls. `fields`: [{ name, label, type?, required?, value?,
// options? }]. `onSubmit(values)` should call the API and throw on failure —
// validation errors (422 with `errors: [{path, msg}]`, matching our backend
// format) are automatically mapped onto the matching field.
let modalEl = null;
let currentFields = [];
let currentOnSubmit = null;

const clearFieldErrors = () => {
  currentFields.forEach((field) => {
    const input = document.getElementById(`field-${field.name}`);
    if (input) {
      input.classList.remove("is-invalid");
    }
  });
  document.querySelectorAll("#app-form-modal-body .invalid-feedback").forEach((el) => el.remove());
};

const applyFieldErrors = (errors) => {
  errors.forEach((error) => {
    const input = document.getElementById(`field-${error.path}`);
    if (!input) {
      return;
    }
    input.classList.add("is-invalid");
    const feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    feedback.textContent = error.msg;
    input.insertAdjacentElement("afterend", feedback);
  });
};

const helpHtml = (field) =>
  field.helpText ? `<div class="form-text">${escapeHtml(field.helpText)}</div>` : "";

const renderField = (field) => {
  const value = field.value !== undefined && field.value !== null ? String(field.value) : "";
  const requiredAttr = field.required ? "required" : "";

  if (field.type === "textarea") {
    return `
      <div class="mb-3">
        <label class="form-label" for="field-${field.name}">${escapeHtml(field.label)}</label>
        <textarea class="form-control" id="field-${field.name}" name="${field.name}" rows="3" ${requiredAttr}>${escapeHtml(value)}</textarea>
        ${helpHtml(field)}
      </div>`;
  }

  if (field.type === "checkbox") {
    const checked = field.value ? "checked" : "";
    return `
      <div class="mb-3 form-check">
        <input type="checkbox" class="form-check-input" id="field-${field.name}" name="${field.name}" value="true" ${checked} />
        <label class="form-check-label" for="field-${field.name}">${escapeHtml(field.label)}</label>
        ${helpHtml(field)}
      </div>`;
  }

  if (field.type === "select") {
    const options = (field.options || [])
      .map(
        (opt) =>
          `<option value="${escapeHtml(opt.value)}" ${String(opt.value) === value ? "selected" : ""}>${escapeHtml(opt.label)}</option>`,
      )
      .join("");
    return `
      <div class="mb-3">
        <label class="form-label" for="field-${field.name}">${escapeHtml(field.label)}</label>
        <select class="form-select" id="field-${field.name}" name="${field.name}" ${requiredAttr}>${options}</select>
        ${helpHtml(field)}
      </div>`;
  }

  return `
    <div class="mb-3">
      <label class="form-label" for="field-${field.name}">${escapeHtml(field.label)}</label>
      <input type="${field.type || "text"}" class="form-control" id="field-${field.name}" name="${field.name}"
        value="${escapeHtml(value)}" ${requiredAttr} />
      ${helpHtml(field)}
    </div>`;
};

const buildModal = () => {
  const el = document.createElement("div");
  el.id = "app-form-modal";
  el.className = "modal fade";
  el.tabIndex = -1;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <form id="app-form-modal-form" novalidate>
          <div class="modal-header">
            <h5 class="modal-title" id="app-form-modal-title"></h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
          </div>
          <div class="modal-body" id="app-form-modal-body"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
            <button type="submit" class="btn btn-primary" id="app-form-modal-submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector("#app-form-modal-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentOnSubmit) {
      return;
    }

    const formData = new FormData(event.target);
    const values = {};
    currentFields.forEach((field) => {
      values[field.name] = formData.get(field.name);
    });

    clearFieldErrors();

    const submitBtn = document.getElementById("app-form-modal-submit");
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Menyimpan...";

    try {
      await currentOnSubmit(values);
      window.bootstrap.Modal.getOrCreateInstance(el).hide();
    } catch (err) {
      if (err.status === 422 && Array.isArray(err.errors)) {
        applyFieldErrors(err.errors);
      }
      showToast(err.message || "Gagal menyimpan data", "danger");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  return el;
};

export const openFormModal = ({ title, fields, submitLabel = "Simpan", onSubmit }) => {
  const el = modalEl || (modalEl = buildModal());

  currentFields = fields;
  currentOnSubmit = onSubmit;

  document.getElementById("app-form-modal-title").textContent = title;
  document.getElementById("app-form-modal-body").innerHTML = fields.map(renderField).join("");
  document.getElementById("app-form-modal-submit").textContent = submitLabel;

  window.bootstrap.Modal.getOrCreateInstance(el).show();
};
