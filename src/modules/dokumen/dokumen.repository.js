const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, pegawai_id, kategori_dokumen_id, nama_dokumen, nama_file_asli, file_path, bucket, " +
  "mime_type, ukuran_file, diunggah_oleh, created_at, updated_at";

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

module.exports = {
  findAll,
  findById,
  findPegawaiIdByUserId,
  pegawaiExists,
  kategoriDokumenExists,
  create,
};
