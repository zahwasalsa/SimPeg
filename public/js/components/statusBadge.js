import { escapeHtml } from "../utils/format.js";

// Generic status -> Bootstrap badge renderer. `variantMap` maps the raw
// status value to a Bootstrap color + display label; unmapped values fall
// back to a neutral badge showing the raw value so nothing is silently hidden.
export const renderStatusBadge = (status, variantMap) => {
  const entry = variantMap[status] || { color: "secondary", label: status || "-" };
  return `<span class="badge text-bg-${entry.color}">${escapeHtml(entry.label)}</span>`;
};
