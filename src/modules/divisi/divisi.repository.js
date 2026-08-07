const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS = "id, nama_divisi, deskripsi, created_at, updated_at";

// PostgREST filter values are structural for some operators; strip
// characters with special meaning so a search term can't affect the query
// shape.
const sanitizeSearchTerm = (term) => term.replace(/[,()."]/g, "");

const findAll = async ({ page, limit, search }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("divisi")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (search) {
    const term = sanitizeSearchTerm(search);
    query = query.ilike("nama_divisi", `%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("divisi")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

const findByNama = async (namaDivisi) => {
  const { data, error } = await supabase
    .from("divisi")
    .select("id")
    .eq("nama_divisi", namaDivisi)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

const create = async (payload) => {
  const { data, error } = await supabase.from("divisi").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("divisi")
    .update(payload)
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

module.exports = { findAll, findById, findByNama, create, update };
