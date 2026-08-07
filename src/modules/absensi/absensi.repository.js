const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, pegawai_id, tanggal, jam_masuk, jam_keluar, status, keterangan, created_at, updated_at";

const findAll = async ({ page, limit, pegawaiId, tanggal, status }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("absensi")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("tanggal", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (tanggal) {
    query = query.eq("tanggal", tanggal);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("absensi")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

const findByPegawaiAndTanggal = async (pegawaiId, tanggal) => {
  const { data, error } = await supabase
    .from("absensi")
    .select(SELECT_COLUMNS)
    .eq("pegawai_id", pegawaiId)
    .eq("tanggal", tanggal)
    .is("deleted_at", null)
    .maybeSingle();

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

const create = async (payload) => {
  const { data, error } = await supabase.from("absensi").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("absensi")
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
  findByPegawaiAndTanggal,
  findPegawaiIdByUserId,
  pegawaiExists,
  create,
  update,
};
