const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-jenissert-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-jenissert-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawai: { email: `qa-jenissert-test-pegawai-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-jenissert-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let jenisAId;
let jenisBId;
const namaJenisA = `QA Jenis A ${runId}`;
const namaJenisB = `QA Jenis B ${runId}`;

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
  await supabaseAdmin.from("jenis_sertifikasi").delete().in("nama_jenis", [namaJenisA, namaJenisB]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/jenis-sertifikasi (list) ---

test("GET /jenis-sertifikasi - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/jenis-sertifikasi");
  assert.equal(res.status, 401);
});

test("GET /jenis-sertifikasi - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/jenis-sertifikasi")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
  }
});

// --- GET /api/v1/jenis-sertifikasi/:id (detail) - error paths before any row exists ---

test("GET /jenis-sertifikasi/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/jenis-sertifikasi/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /jenis-sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/jenis-sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/jenis-sertifikasi ---

test("POST /jenis-sertifikasi - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawai", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/jenis-sertifikasi")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ namaJenis: `Should Not Exist ${runId}` });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /jenis-sertifikasi - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/jenis-sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJenis: "" });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.errors));
});

test("POST /jenis-sertifikasi - admin can create", async () => {
  const res = await request(app)
    .post("/api/v1/jenis-sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJenis: namaJenisA, deskripsi: "Jenis test A" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.namaJenis, namaJenisA);
  jenisAId = res.body.data.id;
});

test("POST /jenis-sertifikasi - hrd can create", async () => {
  const res = await request(app)
    .post("/api/v1/jenis-sertifikasi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ namaJenis: namaJenisB });

  assert.equal(res.status, 201);
  jenisBId = res.body.data.id;
});

test("POST /jenis-sertifikasi - duplicate nama is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/jenis-sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJenis: namaJenisA });
  assert.equal(res.status, 409);
});

// --- GET /api/v1/jenis-sertifikasi/:id (detail, with a real row) ---

test("GET /jenis-sertifikasi/:id - every role can view a jenis (200)", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/jenis-sertifikasi/${jenisAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.equal(res.body.data.id, jenisAId);
  }
});

// --- PATCH /api/v1/jenis-sertifikasi/:id ---

test("PATCH /jenis-sertifikasi/:id - admin can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/jenis-sertifikasi/${jenisAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Updated by admin" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by admin");
});

test("PATCH /jenis-sertifikasi/:id - hrd can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/jenis-sertifikasi/${jenisBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ deskripsi: "Updated by hrd" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.deskripsi, "Updated by hrd");
});

test("PATCH /jenis-sertifikasi/:id - pegawai cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/jenis-sertifikasi/${jenisAId}`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`)
    .send({ deskripsi: "Should not be allowed" });
  assert.equal(res.status, 403);
});

test("PATCH /jenis-sertifikasi/:id - rename to an existing name is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/jenis-sertifikasi/${jenisBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaJenis: namaJenisA });
  assert.equal(res.status, 409);
});

test("PATCH /jenis-sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/jenis-sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ deskripsi: "Ghost" });
  assert.equal(res.status, 404);
});

// --- DELETE /api/v1/jenis-sertifikasi/:id ---

test("DELETE /jenis-sertifikasi/:id - pegawai and pimpinan cannot delete (403)", async () => {
  for (const role of ["pegawai", "pimpinan"]) {
    const res = await request(app)
      .delete(`/api/v1/jenis-sertifikasi/${jenisBId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("DELETE /jenis-sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/jenis-sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /jenis-sertifikasi/:id - admin can delete, then it's hidden from list and detail (404)", async () => {
  const res = await request(app)
    .delete(`/api/v1/jenis-sertifikasi/${jenisBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/jenis-sertifikasi/${jenisBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);

  const listRes = await request(app)
    .get("/api/v1/jenis-sertifikasi?page=1&limit=100")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.ok(!listRes.body.data.some((j) => j.id === jenisBId));
});

test("DELETE /jenis-sertifikasi/:id - deleting an already-deleted jenis returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/jenis-sertifikasi/${jenisBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /jenis-sertifikasi/:id - blocked while still referenced by a sertifikasi row (409)", async () => {
  const { data: pegawaiUser } = await supabaseAdmin
    .from("pegawai")
    .insert({ user_id: accounts.pegawai.id, nip: `JSERT-INUSE-${runId}`, nama_lengkap: "QA In Use" })
    .select("id")
    .single();

  const { data: sertifikasi } = await supabaseAdmin
    .from("sertifikasi")
    .insert({
      pegawai_id: pegawaiUser.id,
      jenis_sertifikasi_id: jenisAId,
      nama_sertifikat: "QA In-Use Cert",
      nama_file_asli: "x.pdf",
      file_path: `${pegawaiUser.id}/x/x.pdf`,
      bucket: "sertifikat",
      mime_type: "application/pdf",
      ukuran_file: 10,
    })
    .select("id")
    .single();

  const res = await request(app)
    .delete(`/api/v1/jenis-sertifikasi/${jenisAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 409);

  await supabaseAdmin.from("sertifikasi").delete().eq("id", sertifikasi.id);
  await supabaseAdmin.from("pegawai").delete().eq("id", pegawaiUser.id);
});
