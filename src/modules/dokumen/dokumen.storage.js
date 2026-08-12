const crypto = require("crypto");
const supabase = require("../../database/supabaseClient");
const AppError = require("../../shared/exceptions/appError");

const BUCKET = "documents";
const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

// Storage keys are derived server-side (never from client input) to avoid
// path traversal and collisions; the original filename is kept only as a
// metadata column (nama_file_asli), not as part of the storage path.
const sanitizeForPath = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

const buildFilePath = (pegawaiId, originalName) => {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
  const safeExt = sanitizeForPath(ext).slice(0, 20);
  return `${pegawaiId}/${crypto.randomUUID()}${safeExt}`;
};

const uploadFile = async ({ pegawaiId, buffer, mimeType, originalName }) => {
  const filePath = buildFilePath(pegawaiId, originalName);

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new AppError("Gagal mengunggah berkas ke storage", 502);
  }

  return { bucket: BUCKET, filePath };
};

// `download` triggers Content-Disposition: attachment with the given
// filename (FR-DOC-003); omitting it yields an inline-viewable URL (FR-DOC-002).
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

module.exports = { BUCKET, uploadFile, getSignedUrl };
