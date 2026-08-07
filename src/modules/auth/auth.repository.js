const supabase = require("../../database/supabaseClient");

const findById = async (id) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, is_active, last_login, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    return null;
  }
  return data;
};

const updateLastLogin = async (id) => {
  await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", id);
};

module.exports = { findById, updateLastLogin };
