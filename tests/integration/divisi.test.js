const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-divisi-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-divisi-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawai: { email: `qa-divisi-test-pegawai-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-divisi-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let divisiAId;
let divisiBId;
const namaDivisiA = `QA Divisi A ${runId}`;
const namaDivisiB = `QA Divisi B ${runId}`;

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
  await supabaseAdmin.from("divisi").delete().in("nama_divisi", [namaDivisiA, namaDivisiB]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/divisi (list) ---

test("GET /divisi - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/divisi");
  assert.equal(res.status, 401);
});

test("GET /divisi - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/divisi")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
  }
});

// --- GET /api/v1/divisi/:id (detail) - error paths before any row exists ---

test("GET /divisi/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/divisi/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /divisi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/divisi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/divisi ---

test("POST /divisi - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawai", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/divisi")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ namaDivisi: `Should Not Exist ${runId}` });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /divisi - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/divisi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaDivisi: "" });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.errors));
});

test("POST /divisi - admin can create", async () => {
  const res = await request(app)
    .post("/api/v1/divisi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaDivisi: namaDivisiA, deskripsi: "Divisi test A" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.namaDivisi, namaDivisiA);
  divisiAId = res.body.data.id;
});

test("POST /divisi - hrd can create", async () => {
  const res = await request(app)
    .post("/api/v1/divisi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ namaDivisi: namaDivisiB });

  assert.equal(res.status, 201);
  divisiBId = res.body.data.id;
});

test("POST /divisi - duplicate nama is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/divisi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaDivisi: namaDivisiA });
  assert.equal(res.status, 409);
});

// --- GET /api/v1/divisi/:id (detail, with a real row) ---

test("GET /divisi/:id - every role can view a divisi (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/divisi/${divisiAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.equal(res.body.data.id, divisiAId);
  }
});

// --- PATCH /api/v1/divisi/:id ---

test("PATCH /divisi/:id - admin can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/divisi/${divisiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Updated by admin" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by admin");
});

test("PATCH /divisi/:id - hrd can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/divisi/${divisiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ deskripsi: "Updated by hrd" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by hrd");
});

test("PATCH /divisi/:id - pegawai cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/divisi/${divisiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`)
    .send({ deskripsi: "Should not be allowed" });
  assert.equal(res.status, 403);
});

test("PATCH /divisi/:id - rename to an existing name is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/divisi/${divisiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaDivisi: namaDivisiA });
  assert.equal(res.status, 409);
});

test("PATCH /divisi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/divisi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Ghost" });
  assert.equal(res.status, 404);
});

// --- DELETE /api/v1/divisi/:id ---

test("DELETE /divisi/:id - pegawai and pimpinan cannot delete (403)", async () => {
  for (const role of ["pegawai", "pimpinan"]) {
    const res = await request(app)
      .delete(`/api/v1/divisi/${divisiBId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("DELETE /divisi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/divisi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /divisi/:id - admin can delete, then it's hidden from list and detail (404)", async () => {
  const res = await request(app)
    .delete(`/api/v1/divisi/${divisiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/divisi/${divisiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);

  const listRes = await request(app)
    .get("/api/v1/divisi?page=1&limit=100")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.ok(!listRes.body.data.some((d) => d.id === divisiBId));
});

test("DELETE /divisi/:id - deleting an already-deleted divisi returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/divisi/${divisiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});
