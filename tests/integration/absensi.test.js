const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-absensi-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-absensi-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-absensi-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-absensi-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-absensi-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let absensiCheckinId;
let absensiAdminId;
let absensiHrdId;

const today = new Date().toISOString().slice(0, 10);
const dateAdmin = "2020-01-01";
const dateHrd = "2020-01-02";
const dateInvalidJam = "2020-01-03";
const dateInvalidStatus = "2020-01-04";

const createTestAccount = async (email, password, role) => {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "pegawai" },
  });
  if (error) {
    throw error;
  }

  if (role !== "pegawai") {
    await supabaseAdmin.from("users").update({ role }).eq("id", data.user.id);
  }

  const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Failed to log in test account ${email}: ${JSON.stringify(loginRes.body)}`);
  }

  return { id: data.user.id, token: loginRes.body.data.session.accessToken };
};

const createPegawaiProfile = async (userId, nip) => {
  const { data, error } = await supabaseAdmin
    .from("pegawai")
    .insert({ user_id: userId, nip, nama_lengkap: `QA Absensi ${nip}` })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
};

before(async () => {
  for (const [key, role] of Object.entries({
    admin: "admin",
    hrd: "hrd",
    pegawaiA: "pegawai",
    pegawaiB: "pegawai",
    pimpinan: "pimpinan",
  })) {
    accounts[key] = {
      ...accounts[key],
      ...(await createTestAccount(accounts[key].email, accounts[key].password, role)),
    };
  }

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `ABS-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `ABS-B-${runId}`);
});

after(async () => {
  await supabaseAdmin.from("absensi").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/absensi (list) ---

test("GET /absensi - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/absensi");
  assert.equal(res.status, 401);
});

test("GET /absensi - admin can list (200)", async () => {
  const res = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test("GET /absensi - hrd can list (200)", async () => {
  const res = await request(app).get("/api/v1/absensi").set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(res.status, 200);
});

test("GET /absensi - pimpinan without pegawai profile gets 200 and empty data", async () => {
  const res = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

test("GET /absensi - pegawai gets 200 and empty data before any check-in", async () => {
  const res = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- GET /api/v1/absensi/:id error paths (before any row exists) ---

test("GET /absensi/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/absensi/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /absensi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/absensi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/absensi (admin/hrd, strict create) ---

test("POST /absensi - admin creates for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: dateAdmin, jamMasuk: "08:00", status: "hadir" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  absensiAdminId = res.body.data.id;
});

test("POST /absensi - hrd creates for pegawaiB on a different date (201)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: dateHrd, status: "izin" });
  assert.equal(res.status, 201);
  absensiHrdId = res.body.data.id;
});

test("POST /absensi - duplicate pegawaiId + tanggal is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: dateAdmin });
  assert.equal(res.status, 409);
});

test("POST /absensi - jamKeluar < jamMasuk is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: dateInvalidJam, jamMasuk: "09:00", jamKeluar: "08:00" });
  assert.equal(res.status, 422);
});

test("POST /absensi - invalid status is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: dateInvalidStatus, status: "bolos" });
  assert.equal(res.status, 422);
});

// --- POST /api/v1/absensi (pegawai self-service: check-in / check-out) ---

test("POST /absensi - pegawai sending pegawaiId is rejected (422), proving they cannot target another pegawai", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId, tanggal: today });
  assert.equal(res.status, 422);
});

test("POST /absensi - pegawai check-in creates a new row (201)", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ tanggal: today, jamMasuk: "08:00" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.jamMasuk, "08:00:00");
  assert.equal(res.body.data.jamKeluar, null);
  absensiCheckinId = res.body.data.id;
});

test("POST /absensi - second call the same day checks out (200), updating the same row", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ tanggal: today, jamKeluar: "17:00" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, absensiCheckinId);
  assert.equal(res.body.data.jamKeluar, "17:00:00");
});

test("POST /absensi - third call the same day is rejected (409), covers repeated check-in too", async () => {
  const res = await request(app)
    .post("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ tanggal: today });
  assert.equal(res.status, 409);
});

// --- GET detail (with real rows) ---

test("GET /absensi/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/absensi/${absensiCheckinId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, absensiCheckinId);
});

test("GET /absensi/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/absensi/${absensiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /absensi/:id - admin and hrd can view any record (200)", async () => {
  const asAdmin = await request(app)
    .get(`/api/v1/absensi/${absensiCheckinId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(asAdmin.status, 200);

  const asHrd = await request(app)
    .get(`/api/v1/absensi/${absensiAdminId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(asHrd.status, 200);
});

// --- GET list, scoping with real data present ---

test("GET /absensi - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

test("GET /absensi - admin list includes records from multiple pegawai", async () => {
  const res = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  const pegawaiIds = new Set(res.body.data.map((row) => row.pegawaiId));
  assert.ok(pegawaiIds.has(pegawaiAId));
  assert.ok(pegawaiIds.has(pegawaiBId));
});

// --- PATCH /api/v1/absensi/:id ---

test("PATCH /absensi/:id - pegawai cannot patch at all, even their own record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/absensi/${absensiCheckinId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ keterangan: "Coba edit sendiri" });
  assert.equal(res.status, 403);
});

test("PATCH /absensi/:id - admin can correct any record (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/absensi/${absensiHrdId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ keterangan: "Dikoreksi admin" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.keterangan, "Dikoreksi admin");
});

test("PATCH /absensi/:id - hrd can correct any record (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/absensi/${absensiAdminId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ status: "sakit" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "sakit");
});

test("PATCH /absensi/:id - sending pegawaiId is rejected (422), pegawaiId is immutable", async () => {
  const res = await request(app)
    .patch(`/api/v1/absensi/${absensiAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId });
  assert.equal(res.status, 422);
});

test("PATCH /absensi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/absensi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ keterangan: "Ghost" });
  assert.equal(res.status, 404);
});

// --- Response sanitization ---

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const listRes = await request(app)
    .get("/api/v1/absensi")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const detailRes = await request(app)
    .get(`/api/v1/absensi/${absensiCheckinId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);

  for (const res of [listRes, detailRes]) {
    const body = JSON.stringify(res.body).toLowerCase();
    assert.ok(!body.includes("password"), "response must not contain password fields");
    assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
    assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
    assert.ok(!body.includes("secret"));
  }
});
