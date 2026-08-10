const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-cuti-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-cuti-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-cuti-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-cuti-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-cuti-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let cutiAdminId;
let cutiHrdId;
let cutiSakitId;
let cutiPegawaiId;
let cutiAdminBackdatedId;

const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Cuti ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `CUTI-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `CUTI-B-${runId}`);
});

after(async () => {
  await supabaseAdmin.from("cuti").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/cuti (list) ---

test("GET /cuti - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/cuti");
  assert.equal(res.status, 401);
});

test("GET /cuti - admin and hrd can list (200)", async () => {
  for (const role of ["admin", "hrd"]) {
    const res = await request(app).get("/api/v1/cuti").set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /cuti - pimpinan without pegawai profile gets 200 and empty data", async () => {
  const res = await request(app)
    .get("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

test("GET /cuti - pegawai gets 200 and empty data before any submission", async () => {
  const res = await request(app)
    .get("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- GET /api/v1/cuti/:id error paths (before any row exists) ---

test("GET /cuti/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/cuti/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /cuti/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/cuti/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/cuti (admin/hrd, explicit pegawaiId) ---

test("POST /cuti - admin creates for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(10),
      tanggalSelesai: addDays(12),
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  assert.equal(res.body.data.status, "diajukan");
  assert.equal(res.body.data.jumlahHari, 3);
  cutiAdminId = res.body.data.id;
});

test("POST /cuti - hrd creates for pegawaiB on non-overlapping dates (201)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(30),
      tanggalSelesai: addDays(32),
    });
  assert.equal(res.status, 201);
  cutiHrdId = res.body.data.id;
});

test("POST /cuti - overlapping date range for same pegawai is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(11),
      tanggalSelesai: addDays(13),
    });
  assert.equal(res.status, 409);
});

test("POST /cuti - tanggalSelesai before tanggalMulai is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(50),
      tanggalSelesai: addDays(48),
    });
  assert.equal(res.status, 422);
});

test("POST /cuti - invalid jenisCuti is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_liburan",
      tanggalMulai: addDays(60),
      tanggalSelesai: addDays(61),
    });
  assert.equal(res.status, 422);
});

test("POST /cuti - sending jumlahHari is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(70),
      tanggalSelesai: addDays(71),
      jumlahHari: 2,
    });
  assert.equal(res.status, 422);
});

test("POST /cuti - admin/hrd can submit backdated dates (201)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(-20),
      tanggalSelesai: addDays(-18),
    });
  assert.equal(res.status, 201);
  cutiAdminBackdatedId = res.body.data.id;
});

// --- POST /api/v1/cuti (pegawai self-service) ---

test("POST /cuti - pegawai sending pegawaiId is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({
      pegawaiId: pegawaiBId,
      jenisCuti: "cuti_tahunan",
      tanggalMulai: addDays(10),
      tanggalSelesai: addDays(12),
    });
  assert.equal(res.status, 422);
});

test("POST /cuti - pegawai backdated non-sakit is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ jenisCuti: "cuti_tahunan", tanggalMulai: addDays(-5), tanggalSelesai: addDays(-3) });
  assert.equal(res.status, 422);
});

test("POST /cuti - pegawai backdated cuti_sakit is allowed (201)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ jenisCuti: "cuti_sakit", tanggalMulai: addDays(-5), tanggalSelesai: addDays(-3) });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  cutiSakitId = res.body.data.id;
});

test("POST /cuti - pegawai submits for themselves (201)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ jenisCuti: "cuti_tahunan", tanggalMulai: addDays(10), tanggalSelesai: addDays(12) });
  assert.equal(res.status, 201);
  cutiPegawaiId = res.body.data.id;
});

test("POST /cuti - pegawai overlapping their own existing request is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ jenisCuti: "cuti_tahunan", tanggalMulai: addDays(11), tanggalSelesai: addDays(13) });
  assert.equal(res.status, 409);
});

test("POST /cuti - pimpinan cannot submit (403)", async () => {
  const res = await request(app)
    .post("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ jenisCuti: "cuti_tahunan", tanggalMulai: addDays(90), tanggalSelesai: addDays(91) });
  assert.equal(res.status, 403);
});

// --- GET detail (with real rows) ---

test("GET /cuti/:id - admin and hrd can view any record (200)", async () => {
  const asAdmin = await request(app)
    .get(`/api/v1/cuti/${cutiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(asAdmin.status, 200);

  const asHrd = await request(app)
    .get(`/api/v1/cuti/${cutiAdminId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(asHrd.status, 200);
});

test("GET /cuti/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/cuti/${cutiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /cuti/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/cuti/${cutiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /cuti - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

// --- PATCH /api/v1/cuti/:id/approve & /reject ---

test("PATCH /cuti/:id/approve - pegawai and pimpinan cannot approve (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/cuti/${cutiPegawaiId}/approve`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({});
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /cuti/:id/reject - rejects without catatanApproval (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiHrdId}/reject`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({});
  assert.equal(res.status, 422);
});

test("PATCH /cuti/:id/approve - admin can approve (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiPegawaiId}/approve`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ catatanApproval: "Disetujui, kuota tersedia" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "disetujui");
  assert.equal(res.body.data.disetujuiOleh, accounts.admin.id);
  assert.ok(res.body.data.tanggalPersetujuan);
});

test("PATCH /cuti/:id/approve - approving an already-processed request is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiPegawaiId}/approve`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({});
  assert.equal(res.status, 409);
});

test("PATCH /cuti/:id/reject - hrd can reject with catatanApproval (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiHrdId}/reject`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ catatanApproval: "Bertabrakan dengan jadwal operasional" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "ditolak");
  assert.equal(res.body.data.catatanApproval, "Bertabrakan dengan jadwal operasional");
});

// --- PATCH /api/v1/cuti/:id/cancel ---

test("PATCH /cuti/:id/cancel - pegawai can cancel their own pending request (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiSakitId}/cancel`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "dibatalkan");
});

test("PATCH /cuti/:id/cancel - cancelling an already-processed request is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiPegawaiId}/cancel`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 409);
});

test("PATCH /cuti/:id/cancel - pegawai cannot cancel another pegawai's request (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiAdminId}/cancel`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("PATCH /cuti/:id/cancel - admin can cancel any pending request (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/cuti/${cutiAdminBackdatedId}/cancel`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "dibatalkan");
});

// --- Response sanitization ---

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const listRes = await request(app)
    .get("/api/v1/cuti")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const detailRes = await request(app)
    .get(`/api/v1/cuti/${cutiAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);

  for (const res of [listRes, detailRes]) {
    const body = JSON.stringify(res.body).toLowerCase();
    assert.ok(!body.includes("password"), "response must not contain password fields");
    assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
    assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
    assert.ok(!body.includes("secret"));
  }
});
