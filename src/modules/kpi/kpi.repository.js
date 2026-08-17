const supabase = require("../../database/supabaseClient");

const SELECT_COLUMNS =
  "id, pegawai_id, period, target, achievement, percentage, status, created_at, updated_at";
const DETAIL_SELECT_COLUMNS = "id, kpi_id, indicator, target, realization, weight, created_at, updated_at";

const findAll = async ({ page, limit, pegawaiId, period, status }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("kpi")
    .select(SELECT_COLUMNS, { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (period) {
    query = query.eq("period", period);
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

// Unpaginated fetch used for KPI Summary aggregation (FR-KPI-006) — only the
// columns needed for the aggregation, same style as cuti's findOverlapping.
const findForSummary = async ({ pegawaiId, period }) => {
  let query = supabase.from("kpi").select("status, percentage, period").is("deleted_at", null);

  if (pegawaiId) {
    query = query.eq("pegawai_id", pegawaiId);
  }
  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data;
};

const findById = async (id) => {
  const { data, error } = await supabase
    .from("kpi")
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
  const { data, error } = await supabase.from("kpi").insert(payload).select(SELECT_COLUMNS).single();
  if (error) {
    throw error;
  }
  return data;
};

const update = async (id, payload) => {
  const { data, error } = await supabase
    .from("kpi")
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
    .from("kpi")
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

// --- kpi_detail ---

const findDetailsByKpiId = async (kpiId) => {
  const { data, error } = await supabase
    .from("kpi_detail")
    .select(DETAIL_SELECT_COLUMNS)
    .eq("kpi_id", kpiId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return data;
};

const findDetailById = async (id) => {
  const { data, error } = await supabase
    .from("kpi_detail")
    .select(DETAIL_SELECT_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error) {
    return null;
  }
  return data;
};

const createDetail = async (payload) => {
  const { data, error } = await supabase
    .from("kpi_detail")
    .insert(payload)
    .select(DETAIL_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

// Bulk variant used by POST /kpi when `details` is sent alongside the KPI
// itself — single round-trip instead of one insert per indicator.
const createDetailsBulk = async (payloads) => {
  const { data, error } = await supabase.from("kpi_detail").insert(payloads).select(DETAIL_SELECT_COLUMNS);
  if (error) {
    throw error;
  }
  return data;
};

const updateDetail = async (id, payload) => {
  const { data, error } = await supabase
    .from("kpi_detail")
    .update(payload)
    .eq("id", id)
    .select(DETAIL_SELECT_COLUMNS)
    .single();
  if (error) {
    throw error;
  }
  return data;
};

const softDeleteDetail = async (id) => {
  const { data, error } = await supabase
    .from("kpi_detail")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(DETAIL_SELECT_COLUMNS)
    .single();
  if (error) {
    return null;
  }
  return data;
};

module.exports = {
  findAll,
  findForSummary,
  findById,
  findPegawaiIdByUserId,
  pegawaiExists,
  create,
  update,
  softDelete,
  findDetailsByKpiId,
  findDetailById,
  createDetail,
  createDetailsBulk,
  updateDetail,
  softDeleteDetail,
};
