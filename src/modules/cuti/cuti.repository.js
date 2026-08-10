const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, pegawai_id, jenis_cuti, tanggal_mulai, tanggal_selesai, jumlah_hari, alasan, status, " +
  "disetujui_oleh, tanggal_persetujuan, catatan_approval, created_at, updated_at";

const findAll = async ({ page, limit, pegawaiId, status, jenisCuti }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("cuti")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (jenisCuti) {
    query = query.eq("jenis_cuti", jenisCuti);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("cuti")
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

// Overlap: existing row's range intersects [tanggalMulai, tanggalSelesai],
// counting only requests that are still active (diajukan/disetujui).
const findOverlapping = async (pegawaiId, tanggalMulai, tanggalSelesai) => {
  const { data, error } = await supabase
    .from("cuti")
    .select(SELECT_COLUMNS)
    .eq("pegawai_id", pegawaiId)
    .in("status", ["diajukan", "disetujui"])
    .is("deleted_at", null)
    .lte("tanggal_mulai", tanggalSelesai)
    .gte("tanggal_selesai", tanggalMulai);

  if (error) {
    throw error;
  }
  return data;
};

const create = async (payload) => {
  const { data, error } = await supabase.from("cuti").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("cuti")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
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
  findOverlapping,
  create,
  update,
};
