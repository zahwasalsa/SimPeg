const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-hki-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-hki-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-hki-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-hki-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-hki-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let penelitianAId; // owned by pegawaiA — used to test the optional penelitian_id link
let penelitianBId; // owned by pegawaiB — used to prove cross-ownership is rejected
let hkiAId; // owned by pegawaiA
let hkiBId; // owned by pegawaiB

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA HKI ${nip}` })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
};

const createPenelitian = async (pegawaiId, judul) => {
  const { data, error } = await supabaseAdmin
    .from("penelitian")
    .insert({ pegawai_id: pegawaiId, judul, tahun: 2026 })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `HKI-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `HKI-B-${runId}`);
  penelitianAId = await createPenelitian(pegawaiAId, `Penelitian HKI A ${runId}`);
  penelitianBId = await createPenelitian(pegawaiBId, `Penelitian HKI B ${runId}`);
});

after(async () => {
  await supabaseAdmin.from("hki").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("penelitian").delete().in("id", [penelitianAId, penelitianBId].filter(Boolean));
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/hki (list) ---

test("GET /hki - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/hki");
  assert.equal(res.status, 401);
});

test("GET /hki - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawaiA", "pimpinan"]) {
    const res = await request(app).get("/api/v1/hki").set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
  }
});

test("GET /hki - pegawai gets 200 and empty data before any HKI exists", async () => {
  const res = await request(app).get("/api/v1/hki").set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- POST /api/v1/hki ---

test("POST /hki - pimpinan cannot create (403)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ pegawaiId: pegawaiAId, judul: "Paten X" });
  assert.equal(res.status, 403);
});

test("POST /hki - admin without pegawaiId is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ judul: "Paten X" });
  assert.equal(res.status, 422);
});

test("POST /hki - pegawai sending pegawaiId is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId, judul: "Paten X" });
  assert.equal(res.status, 422);
});

test("POST /hki - admin, non-existent pegawaiId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: "00000000-0000-0000-0000-000000000000", judul: "Paten X" });
  assert.equal(res.status, 404);
});

test("POST /hki - rejects invalid input, missing judul (422)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId });
  assert.equal(res.status, 422);
});

test("POST /hki - pegawai self-reports HKI without a penelitian link (201)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Hak Cipta Aplikasi SimPeg", jenis: "Hak Cipta" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.penelitianId, null);
  assert.equal(res.body.data.jenis, "Hak Cipta");
  hkiAId = res.body.data.id;
});

test("POST /hki - pegawai links HKI to their own penelitian (201)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({
      judul: "Paten Algoritma Optimasi",
      jenis: "Paten",
      penelitianId: penelitianAId,
      nomorPendaftaran: "P-001",
      tanggalPendaftaran: "2026-01-15",
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.penelitianId, penelitianAId);
  assert.equal(res.body.data.nomorPendaftaran, "P-001");
});

test("POST /hki - pegawai linking to another pegawai's penelitian is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Paten Tidak Sah", penelitianId: penelitianBId });
  assert.equal(res.status, 404);
});

test("POST /hki - hrd creates HKI for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, judul: "Merek Dagang Y" });
  assert.equal(res.status, 201);
  hkiBId = res.body.data.id;
});

test("POST /hki - admin linking penelitianId that belongs to a different pegawai than the target is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId, judul: "Paten Salah Kaitan", penelitianId: penelitianAId });
  assert.equal(res.status, 404);
});

// --- GET /api/v1/hki/:id (detail) ---

test("GET /hki/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/hki/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /hki/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/hki/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("GET /hki/:id - admin, hrd, and pimpinan can view any record (200)", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/hki/${hkiAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /hki/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /hki/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /hki - pegawai list is scoped to their own records only", async () => {
  const res = await request(app).get("/api/v1/hki").set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

// --- PATCH /api/v1/hki/:id ---

test("PATCH /hki/:id - pimpinan cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ judul: "Updated" });
  assert.equal(res.status, 403);
});

test("PATCH /hki/:id - pegawai cannot update another pegawai's record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Updated" });
  assert.equal(res.status, 403);
});

test("PATCH /hki/:id - pegawaiId cannot be changed (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 422);
});

test("PATCH /hki/:id - pegawai updates their own record (full CRUD, 200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Hak Cipta Aplikasi SimPeg (Revisi)", nomorPendaftaran: "HC-002" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.judul, "Hak Cipta Aplikasi SimPeg (Revisi)");
  assert.equal(res.body.data.nomorPendaftaran, "HC-002");
});

test("PATCH /hki/:id - linking to another pegawai's penelitian is rejected (404)", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ penelitianId: penelitianBId });
  assert.equal(res.status, 404);
});

test("PATCH /hki/:id - admin can update any record", async () => {
  const res = await request(app)
    .patch(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ jenis: "Merek" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.jenis, "Merek");
});

test("PATCH /hki/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/hki/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ judul: "X" });
  assert.equal(res.status, 404);
});

// --- Filters ---

test("GET /hki - pegawaiId filter works for admin", async () => {
  const res = await request(app)
    .get(`/api/v1/hki?pegawaiId=${pegawaiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

test("GET /hki - penelitianId filter works", async () => {
  const res = await request(app)
    .get(`/api/v1/hki?penelitianId=${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.penelitianId === penelitianAId));
  assert.ok(res.body.data.length >= 1);
});

// --- Validation edge cases ---

test("POST /hki - invalid tanggalPendaftaran is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Invalid", tanggalPendaftaran: "not-a-date" });
  assert.equal(res.status, 422);
});

test("POST /hki - invalid penelitianId format is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/hki")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Invalid", penelitianId: "not-a-uuid" });
  assert.equal(res.status, 422);
});

// --- DELETE /api/v1/hki/:id ---

test("DELETE /hki/:id - pimpinan cannot delete (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /hki/:id - pegawai cannot delete another pegawai's record (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /hki/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/hki/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /hki/:id - pegawai deletes their own record (full CRUD, 200), then it's hidden from detail (404)", async () => {
  const res = await request(app)
    .delete(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);
});

test("DELETE /hki/:id - deleting an already-deleted HKI returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/hki/${hkiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /hki/:id - admin deletes pegawaiB's record (200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/hki/${hkiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
});

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const res = await request(app).get("/api/v1/hki").set("Authorization", `Bearer ${accounts.admin.token}`);
  const body = JSON.stringify(res.body);
  assert.ok(!body.includes("password_hash"));
  assert.ok(!body.includes("accessToken"));
});
