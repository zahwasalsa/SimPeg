const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS = "id, pegawai_id, judul, skema, dana, tahun, created_at, updated_at";
const ANGGOTA_SELECT_COLUMNS = "id, penelitian_id, pegawai_id, created_at, updated_at";
const PUBLIKASI_SELECT_COLUMNS = "id, penelitian_id, judul, jurnal, terindeks, tahun, created_at, updated_at";

const findAll = async ({ page, limit, pegawaiId, tahun }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("penelitian")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (tahun) {
    query = query.eq("tahun", tahun);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("penelitian")
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

const create = async (payload) => {
  const { data, error } = await supabase.from("penelitian").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("penelitian")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const softDelete = async (id) => {
  const { data, error } = await supabase
    .from("penelitian")
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

// --- anggota_penelitian ---

const findAnggotaByPenelitianId = async (penelitianId) => {
  const { data, error } = await supabase
    .from("anggota_penelitian")
    .select(ANGGOTA_SELECT_COLUMNS)
    .eq("penelitian_id", penelitianId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return data;
};

const findAnggotaById = async (id) => {
  const { data, error } = await supabase
    .from("anggota_penelitian")
    .select(ANGGOTA_SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) {
    return null;
  }
  return data;
};

const createAnggota = async (payload) => {
  const { data, error } = await supabase
    .from("anggota_penelitian")
    .insert(payload)
    .select(ANGGOTA_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const softDeleteAnggota = async (id) => {
  const { data, error } = await supabase
    .from("anggota_penelitian")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(ANGGOTA_SELECT_COLUMNS)
    .single();
  if (error) {
    return null;
  }
  return data;
};

// --- publikasi ---

const findPublikasiByPenelitianId = async (penelitianId) => {
  const { data, error } = await supabase
    .from("publikasi")
    .select(PUBLIKASI_SELECT_COLUMNS)
    .eq("penelitian_id", penelitianId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return data;
};

const findPublikasiById = async (id) => {
  const { data, error } = await supabase
    .from("publikasi")
    .select(PUBLIKASI_SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) {
    return null;
  }
  return data;
};

const createPublikasi = async (payload) => {
  const { data, error } = await supabase
    .from("publikasi")
    .insert(payload)
    .select(PUBLIKASI_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const updatePublikasi = async (id, payload) => {
  const { data, error } = await supabase
    .from("publikasi")
    .update(payload)
    .eq("id", id)
    .select(PUBLIKASI_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const softDeletePublikasi = async (id) => {
  const { data, error } = await supabase
    .from("publikasi")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(PUBLIKASI_SELECT_COLUMNS)
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
  create,
  update,
  softDelete,
  findAnggotaByPenelitianId,
  findAnggotaById,
  createAnggota,
  softDeleteAnggota,
  findPublikasiByPenelitianId,
  findPublikasiById,
  createPublikasi,
  updatePublikasi,
  softDeletePublikasi,
};
