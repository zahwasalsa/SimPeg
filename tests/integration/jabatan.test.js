const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-jabatan-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-jabatan-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawai: { email: `qa-jabatan-test-pegawai-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-jabatan-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let jabatanAId;
let jabatanBId;
const namaJabatanA = `QA Jabatan A ${runId}`;
const namaJabatanB = `QA Jabatan B ${runId}`;

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

before(async () => {
  for (const [key, role] of Object.entries({
    admin: "admin",
    hrd: "hrd",
    pegawai: "pegawai",
    pimpinan: "pimpinan",
  })) {
    accounts[key] = {
      ...accounts[key],
      ...(await createTestAccount(accounts[key].email, accounts[key].password, role)),
    };
  }
});

after(async () => {
  await supabaseAdmin.from("jabatan").delete().in("nama_jabatan", [namaJabatanA, namaJabatanB]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/jabatan (list) ---

test("GET /jabatan - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/jabatan");
  assert.equal(res.status, 401);
});

test("GET /jabatan - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/jabatan")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
  }
});

// --- GET /api/v1/jabatan/:id (detail) - error paths before any row exists ---

test("GET /jabatan/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/jabatan/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /jabatan/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/jabatan/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/jabatan ---

test("POST /jabatan - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawai", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/jabatan")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ namaJabatan: `Should Not Exist ${runId}` });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /jabatan - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/jabatan")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJabatan: "" });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.errors));
});

test("POST /jabatan - admin can create", async () => {
  const res = await request(app)
    .post("/api/v1/jabatan")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJabatan: namaJabatanA, deskripsi: "Jabatan test A" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.namaJabatan, namaJabatanA);
  jabatanAId = res.body.data.id;
});

test("POST /jabatan - hrd can create", async () => {
  const res = await request(app)
    .post("/api/v1/jabatan")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ namaJabatan: namaJabatanB });

  assert.equal(res.status, 201);
  jabatanBId = res.body.data.id;
});

test("POST /jabatan - duplicate nama is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/jabatan")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJabatan: namaJabatanA });
  assert.equal(res.status, 409);
});

// --- GET /api/v1/jabatan/:id (detail, with a real row) ---

test("GET /jabatan/:id - every role can view a jabatan (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/jabatan/${jabatanAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.equal(res.body.data.id, jabatanAId);
  }
});

// --- PATCH /api/v1/jabatan/:id ---

test("PATCH /jabatan/:id - admin can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/jabatan/${jabatanAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Updated by admin" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by admin");
});

test("PATCH /jabatan/:id - hrd can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/jabatan/${jabatanBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ deskripsi: "Updated by hrd" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by hrd");
});

test("PATCH /jabatan/:id - pegawai cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/jabatan/${jabatanAId}`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`)
    .send({ deskripsi: "Should not be allowed" });
  assert.equal(res.status, 403);
});

test("PATCH /jabatan/:id - rename to an existing name is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/jabatan/${jabatanBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJabatan: namaJabatanA });
  assert.equal(res.status, 409);
});

test("PATCH /jabatan/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/jabatan/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Ghost" });
  assert.equal(res.status, 404);
});
