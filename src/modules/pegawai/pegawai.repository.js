const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, user_id, divisi_id, jabatan_id, nip, nama_lengkap, jenis_kelamin, tempat_lahir, " +
  "tanggal_lahir, alamat, no_telepon, tanggal_masuk, status_kepegawaian, created_at, updated_at";

// PostgREST .or() filter strings are structural — strip characters that have
// special meaning there so a search term can never inject extra clauses.
const sanitizeSearchTerm = (term) => term.replace(/[,()."]/g, "");

const findAll = async ({ page, limit, search, divisiId, jabatanId, status }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("pegawai")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (search) {
    const term = sanitizeSearchTerm(search);
    query = query.or(`nama_lengkap.ilike.%${term}%,nip.ilike.%${term}%`);
  }
  if (divisiId) {
    query = query.eq("divisi_id", divisiId);
  }
  if (jabatanId) {
    query = query.eq("jabatan_id", jabatanId);
  }
  if (status) {
    query = query.eq("status_kepegawaian", status);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

const findByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select(SELECT_COLUMNS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

const findByNip = async (nip) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select("id")
    .eq("nip", nip)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

const userExists = async (userId) => {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const divisiExists = async (divisiId) => {
  const { data, error } = await supabase
    .from("divisi")
    .select("id")
    .eq("id", divisiId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const jabatanExists = async (jabatanId) => {
  const { data, error } = await supabase
    .from("jabatan")
    .select("id")
    .eq("id", jabatanId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const create = async (payload) => {
  const { data, error } = await supabase.from("pegawai").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("pegawai")
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
  findByUserId,
  findByNip,
  userExists,
  divisiExists,
  jabatanExists,
  create,
  update,
};
