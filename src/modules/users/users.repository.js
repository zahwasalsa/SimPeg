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

module.exports = { findAll, findById, updateRole, updateStatus, softDelete };
