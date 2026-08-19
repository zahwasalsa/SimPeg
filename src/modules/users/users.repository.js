const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS = "id, email, role, is_active, last_login, created_at, updated_at";

const findAll = async ({ page, limit }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("users")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select(SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

// Looked up so the frontend's Edit User form can show/edit the linked
// pegawai's name from the Manajemen User page — mirrors
// auth.repository.js#findPegawaiIdByUserId but also grabs nama_lengkap.
const findPegawaiByUserId = async (userId) => {
  const { data, error } = await supabase
    .from("pegawai")
    .select("id, nama_lengkap")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }
  return data;
};

// Proactive duplicate check for changeEmail — see users.service.js for why
// this is checked before calling Supabase Auth instead of after.
const findByEmail = async (email) => {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data;
};

// Keeps public.users.email in step with auth.users.email — the two are only
// synced once by the on_auth_user_created trigger (INSERT only, never on
// UPDATE), so every email change must write both sides explicitly. See
// users.service.js#changeEmail for the auth.users half and the rollback
// path if this write fails after that one already succeeded.
const updateEmail = async (id, email) => {
  const { data, error } = await supabase
    .from("users")
    .update({ email })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }
  return data;
};

const updateRole = async (id, role) => {
  const { data, error } = await supabase
    .from("users")
    .update({ role })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }
  return data;
};

const updateStatus = async (id, isActive) => {
  const { data, error } = await supabase
    .from("users")
    .update({ is_active: isActive })
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
    .from("users")
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
  findPegawaiByUserId,
  findByEmail,
  updateEmail,
  updateRole,
  updateStatus,
  softDelete,
};
