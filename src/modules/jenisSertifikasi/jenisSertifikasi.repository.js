const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS = "id, nama_jenis, deskripsi, created_at, updated_at";

// PostgREST filter values are structural for some operators; strip
// characters with special meaning so a search term can't affect the query
// shape.
const sanitizeSearchTerm = (term) => term.replace(/[,()."]/g, "");

const findAll = async ({ page, limit, search }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("jenis_sertifikasi")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (search) {
    const term = sanitizeSearchTerm(search);
    query = query.ilike("nama_jenis", `%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("jenis_sertifikasi")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

const findByNama = async (namaJenis) => {
  const { data, error } = await supabase
    .from("jenis_sertifikasi")
    .select("id")
    .eq("nama_jenis", namaJenis)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

const create = async (payload) => {
  const { data, error } = await supabase
    .from("jenis_sertifikasi")
    .insert(payload)
    .select(SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("jenis_sertifikasi")
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
    .from("jenis_sertifikasi")
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

// Referential-integrity guard for delete: jenis_sertifikasi_id on
// `sertifikasi` is ON DELETE SET NULL, not a blocking FK, so this is
// enforced at the app layer instead — mirrors kategoriDokumen's hasDokumen.
const hasSertifikasi = async (jenisSertifikasiId) => {
  const { count, error } = await supabase
    .from("sertifikasi")
    .select("id", { count: "exact", head: true })
    .eq("jenis_sertifikasi_id", jenisSertifikasiId)
    .is("deleted_at", null);
  if (error) {
    throw error;
  }
  return count > 0;
};

module.exports = { findAll, findById, findByNama, create, update, softDelete, hasSertifikasi };
