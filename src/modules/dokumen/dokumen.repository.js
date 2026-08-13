const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, pegawai_id, kategori_dokumen_id, nama_dokumen, nama_file_asli, file_path, bucket, " +
  "mime_type, ukuran_file, diunggah_oleh, versi_aktif, created_at, updated_at";

const VERSION_SELECT_COLUMNS =
  "id, dokumen_id, nomor_versi, nama_file_asli, file_path, bucket, mime_type, ukuran_file, " +
  "diunggah_oleh, created_at, updated_at";

const findAll = async ({ page, limit, pegawaiId, kategoriDokumenId }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("dokumen")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (kategoriDokumenId) {
    query = query.eq("kategori_dokumen_id", kategoriDokumenId);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("dokumen")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

// Resolves the caller's own pegawai.id from their users.id (JWT identity).
// Never derived from client input.
const findPegawaiIdByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data.id;
};

const pegawaiExists = async (pegawaiId) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select("id")
    .eq("id", pegawaiId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const kategoriDokumenExists = async (kategoriDokumenId) => {
  const { data, error } = await supabase
    .from("kategori_dokumen")
    .select("id")
    .eq("id", kategoriDokumenId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const create = async (payload) => {
  const { data, error } = await supabase.from("dokumen").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const findVersionsByDokumenId = async ({ dokumenId, page, limit }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("dokumen_version")
    .select(VERSION_SELECT_COLUMNS, { count: "exact" })
    .eq("dokumen_id", dokumenId)
    .order("nomor_versi", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findVersionById = async (id) => {
  const { data, error } = await supabase
    .from("dokumen_version")
    .select(VERSION_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data;
};

// Scoped lookup used on the download endpoint: :versionId must actually
// belong to :id, not just exist somewhere in the table.
const findVersionByDokumenIdAndId = async (dokumenId, versionId) => {
  const { data, error } = await supabase
    .from("dokumen_version")
    .select(VERSION_SELECT_COLUMNS)
    .eq("dokumen_id", dokumenId)
    .eq("id", versionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data;
};

const getNextVersionNumber = async (dokumenId) => {
  const { data, error } = await supabase
    .from("dokumen_version")
    .select("nomor_versi")
    .eq("dokumen_id", dokumenId)
    .order("nomor_versi", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return (data?.nomor_versi || 0) + 1;
};

const createVersion = async (payload) => {
  const { data, error } = await supabase
    .from("dokumen_version")
    .insert(payload)
    .select(VERSION_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

// Best-effort compensation when a later step (mirror update) fails after the
// version row was already inserted — see dokumen.service.js.
const deleteVersionById = async (id) => {
  const { error } = await supabase.from("dokumen_version").delete().eq("id", id);
  if (error) {
    throw error;
  }
};

// Mirrors the newly-active version's file metadata onto the parent `dokumen`
// row so existing endpoints (GET /dokumen/:id, GET /dokumen/:id/download)
// keep working unchanged and always resolve to the latest version.
const updateDokumenActiveVersion = async (dokumenId, versionRow) => {
  const { data, error } = await supabase
    .from("dokumen")
    .update({
      versi_aktif: versionRow.nomor_versi,
      nama_file_asli: versionRow.nama_file_asli,
      file_path: versionRow.file_path,
      bucket: versionRow.bucket,
      mime_type: versionRow.mime_type,
      ukuran_file: versionRow.ukuran_file,
    })
    .eq("id", dokumenId)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }
  return data;
};

const softDelete = async (id) => {
  const { data, error } = await supabase
    .from("dokumen")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(SELECT_COLUMNS)
    .single();
  if (error) {
    return null;
  }
  return data;
};

module.exports = {
  findAll,
  findById,
  findPegawaiIdByUserId,
  pegawaiExists,
  kategoriDokumenExists,
  create,
  findVersionsByDokumenId,
  findVersionById,
  findVersionByDokumenIdAndId,
  getNextVersionNumber,
  createVersion,
  deleteVersionById,
  updateDokumenActiveVersion,
  softDelete,
};
