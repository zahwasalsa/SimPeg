const supabase = require("../../database/supabaseClient");

const toDateString = (date) => date.toISOString().slice(0, 10);

const SELECT_COLUMNS =
  "id, pegawai_id, jenis_sertifikasi_id, nama_sertifikat, penerbit, nomor_sertifikat, " +
  "tanggal_terbit, tanggal_berakhir, nama_file_asli, file_path, bucket, mime_type, " +
  "ukuran_file, created_at, updated_at";

// FR-CERT-003 reminder window — sertifikat yang berakhir dalam N hari ke
// depan (atau sudah lewat) ikut muncul saat `akanBerakhir=true`. Sama persis
// dengan EXPIRY_REMINDER_DAYS di dokumen.repository.js — dipakai ulang, bukan
// angka baru, supaya konsisten di seluruh aplikasi.
const EXPIRY_REMINDER_DAYS = 30;

const findAll = async ({ page, limit, pegawaiId, jenisSertifikasiId, akanBerakhir, kedaluwarsa }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("sertifikasi")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (jenisSertifikasiId) {
    query = query.eq("jenis_sertifikasi_id", jenisSertifikasiId);
  }
  if (akanBerakhir) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + EXPIRY_REMINDER_DAYS);
    query = query.not("tanggal_berakhir", "is", null).lte("tanggal_berakhir", toDateString(threshold));
  }
  if (kedaluwarsa) {
    query = query.not("tanggal_berakhir", "is", null).lt("tanggal_berakhir", toDateString(new Date()));
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return { data, total: count };
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("sertifikasi")
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

const jenisSertifikasiExists = async (jenisSertifikasiId) => {
  const { data, error } = await supabase
    .from("jenis_sertifikasi")
    .select("id")
    .eq("id", jenisSertifikasiId)
    .is("deleted_at", null)
    .maybeSingle();
  return !error && !!data;
};

const create = async (payload) => {
  const { data, error } = await supabase.from("sertifikasi").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("sertifikasi")
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
    .from("sertifikasi")
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
  findPegawaiIdByUserId,
  pegawaiExists,
  jenisSertifikasiExists,
  create,
  update,
  softDelete,
};
