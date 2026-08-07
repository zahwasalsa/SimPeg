const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-pegawai-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-pegawai-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-pegawai-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-pegawai-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-pegawai-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAProfileId;
let pegawaiBProfileId;

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
    pegawaiA: "pegawai",
    pegawaiB: "pegawai",
    pimpinan: "pimpinan",
  })) {
    accounts[key] = {
      ...accounts[key],
      ...(await createTestAccount(accounts[key].email, accounts[key].password, role)),
    };
  }
});

after(async () => {
  // pegawai.user_id -> users.id is ON DELETE RESTRICT, so pegawai rows must
  // be removed before the owning auth user, or the user delete will fail.
  await supabaseAdmin.from("pegawai").delete().in("user_id", [accounts.pegawaiA.id, accounts.pegawaiB.id]);

  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/pegawai (list) ---

test("GET /pegawai - admin and hrd can list", async () => {
  for (const role of ["admin", "hrd"]) {
    const res = await request(app)
      .get("/api/v1/pegawai")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.pagination);
  }
});

test("GET /pegawai - pegawai and pimpinan are forbidden (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/pegawai")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("GET /pegawai - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/pegawai");
  assert.equal(res.status, 401);
});

// --- POST /api/v1/pegawai ---

test("POST /pegawai - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/pegawai")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ userId: accounts.pegawaiA.id, nip: `NIP-${runId}-X`, namaLengkap: "Test" });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /pegawai - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ userId: "not-a-uuid", namaLengkap: "" });
  assert.equal(res.status, 422);
  assert.ok(Array.isArray(res.body.errors));
});

test("POST /pegawai - userId not found (404)", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      userId: "00000000-0000-0000-0000-000000000000",
      nip: `NIP-${runId}-GHOST`,
      namaLengkap: "Ghost",
    });
  assert.equal(res.status, 404);
});

test("POST /pegawai - divisiId not found (404)", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      userId: accounts.pegawaiA.id,
      nip: `NIP-${runId}-DIVCHECK`,
      namaLengkap: "Div Check",
      divisiId: "00000000-0000-0000-0000-000000000000",
    });
  assert.equal(res.status, 404);
});

test("POST /pegawai - admin can create a pegawai profile", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ userId: accounts.pegawaiA.id, nip: `NIP-${runId}-A`, namaLengkap: "Pegawai A" });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.userId, accounts.pegawaiA.id);
  assert.equal(res.body.data.nip, `NIP-${runId}-A`);
  pegawaiAProfileId = res.body.data.id;
});

test("POST /pegawai - hrd can create a pegawai profile", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ userId: accounts.pegawaiB.id, nip: `NIP-${runId}-B`, namaLengkap: "Pegawai B" });

  assert.equal(res.status, 201);
  pegawaiBProfileId = res.body.data.id;
});

test("POST /pegawai - duplicate userId is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ userId: accounts.pegawaiA.id, nip: `NIP-${runId}-DUPUSER`, namaLengkap: "Duplicate" });
  assert.equal(res.status, 409);
});

test("POST /pegawai - duplicate NIP is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ userId: accounts.pimpinan.id, nip: `NIP-${runId}-A`, namaLengkap: "Duplicate NIP" });
  assert.equal(res.status, 409);
});

// --- GET /api/v1/pegawai/:id (detail) ---

test("GET /pegawai/:id - admin and hrd can view any profile", async () => {
  const asAdmin = await request(app)
    .get(`/api/v1/pegawai/${pegawaiBProfileId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(asAdmin.status, 200);

  const asHrd = await request(app)
    .get(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(asHrd.status, 200);
});

test("GET /pegawai/:id - pegawai can view their own profile", async () => {
  const res = await request(app)
    .get(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.userId, accounts.pegawaiA.id);
});

test("GET /pegawai/:id - pegawai cannot view another pegawai's profile (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/pegawai/${pegawaiBProfileId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /pegawai/:id - pimpinan cannot view another pegawai's profile (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 403);
});

test("GET /pegawai/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/pegawai/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /pegawai/:id - non-existent pegawai returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/pegawai/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- PATCH /api/v1/pegawai/:id ---

test("PATCH /pegawai/:id - admin can update, including NIP correction", async () => {
  const res = await request(app)
    .patch(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ nip: `NIP-${runId}-A-FIXED`, namaLengkap: "Pegawai A Updated" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.nip, `NIP-${runId}-A-FIXED`);
  assert.equal(res.body.data.namaLengkap, "Pegawai A Updated");
});

test("PATCH /pegawai/:id - hrd can update", async () => {
  const res = await request(app)
    .patch(`/api/v1/pegawai/${pegawaiBProfileId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ statusKepegawaian: "nonaktif" });

  assert.equal(res.status, 200);
  assert.equal(res.body.data.statusKepegawaian, "nonaktif");
});

test("PATCH /pegawai/:id - pegawai cannot update, even their own profile (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ namaLengkap: "Self Edit Attempt" });
  assert.equal(res.status, 403);
});

test("PATCH /pegawai/:id - userId in body is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ userId: accounts.pegawaiB.id });
  assert.equal(res.status, 422);
});

test("PATCH /pegawai/:id - invalid field value is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ jenisKelamin: "Tidak Diketahui" });
  assert.equal(res.status, 422);
});

test("PATCH /pegawai/:id - non-existent pegawai returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/pegawai/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ namaLengkap: "Ghost" });
  assert.equal(res.status, 404);
});

// --- Response sanitization ---

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const listRes = await request(app)
    .get("/api/v1/pegawai")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const detailRes = await request(app)
    .get(`/api/v1/pegawai/${pegawaiAProfileId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);

  for (const res of [listRes, detailRes]) {
    const body = JSON.stringify(res.body).toLowerCase();
    assert.ok(!body.includes("password"), "response must not contain password fields");
    assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
    assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
    assert.ok(!body.includes("secret"));
  }
});
