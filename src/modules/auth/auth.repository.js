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

// Resolves the caller's own pegawai.id from their users.id, mirroring the
// same lookup already duplicated in dokumen/cuti repositories. Used to
// attach `pegawaiId` to /auth/me so the frontend can self-edit the linked
// profile without a separate "find my pegawai id" round trip.
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

module.exports = { findById, updateLastLogin, findPegawaiIdByUserId };
