const crypto = require("crypto");
const supabase = require("../../database/supabaseClient");
const AppError = require("../../shared/exceptions/appError");

const BUCKET = "sertifikat";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

// Storage keys are derived server-side (never from client input) to avoid
// path traversal and collisions; the original filename is kept only as a
// metadata column (nama_file_asli), not as part of the storage path.
const sanitizeForPath = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

// Nested under sertifikasiId so each certificate's file lives in its own
// folder — mirrors dokumen.storage.js's layout for easy manual auditing in
// the Storage dashboard.
const buildFilePath = (pegawaiId, sertifikasiId, originalName) => {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
  const safeExt = sanitizeForPath(ext).slice(0, 20);
  return `${pegawaiId}/${sertifikasiId}/${crypto.randomUUID()}${safeExt}`;
};

const uploadFile = async ({ pegawaiId, sertifikasiId, buffer, mimeType, originalName }) => {
  const filePath = buildFilePath(pegawaiId, sertifikasiId, originalName);

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new AppError("Gagal mengunggah berkas ke storage", 502);
  }

  return { bucket: BUCKET, filePath };
};

// Best-effort cleanup for orphaned objects when a DB write fails after the
// Storage upload already succeeded. Never throws — callers log failures
// themselves so the original error remains the one surfaced to the client.
const removeFile = async (filePath) => {
  await supabase.storage.from(BUCKET).remove([filePath]);
};

// `download` triggers Content-Disposition: attachment with the given
// filename; omitting it yields an inline-viewable URL.
const getSignedUrl = async (filePath, { download } = {}) => {
  const options = download ? { download } : undefined;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_EXPIRES_IN_SECONDS, options);

  if (error || !data) {
    throw new AppError("Gagal membuat tautan unduhan", 502);
  }

  return { url: data.signedUrl, expiresIn: SIGNED_URL_EXPIRES_IN_SECONDS };
};

module.exports = { BUCKET, uploadFile, getSignedUrl, removeFile };
