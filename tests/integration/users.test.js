const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-users-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-users-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawai: { email: `qa-users-test-pegawai-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-users-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
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

  // Promote to the target role directly via the DB (test setup only — never
  // via the endpoint under test).
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
  accounts.admin = {
    ...accounts.admin,
    ...(await createTestAccount(accounts.admin.email, accounts.admin.password, "admin")),
  };
  accounts.hrd = {
    ...accounts.hrd,
    ...(await createTestAccount(accounts.hrd.email, accounts.hrd.password, "hrd")),
  };
  accounts.pegawai = {
    ...accounts.pegawai,
    ...(await createTestAccount(accounts.pegawai.email, accounts.pegawai.password, "pegawai")),
  };
  accounts.pimpinan = {
    ...accounts.pimpinan,
    ...(await createTestAccount(accounts.pimpinan.email, accounts.pimpinan.password, "pimpinan")),
  };
});

after(async () => {
  // Deleting the auth.users row cascades to public.users (migration 018).
  await Promise.all(
    Object.values(accounts)
      .filter((acc) => acc.id)
      .map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)),
  );
});

// --- GET /api/v1/users (list) ---

test("GET /users - admin can list users", async () => {
  const res = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.pagination);
});

test("GET /users - hrd/pegawai/pimpinan are forbidden (403)", async () => {
  for (const role of ["hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("GET /users - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/users");
  assert.equal(res.status, 401);
});

// --- GET /api/v1/users/:id (detail) ---

test("GET /users/:id - every role can view their own profile", async () => {
  for (const role of ["admin", "hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/users/${accounts[role].id}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role} viewing self`);
    assert.equal(res.body.data.id, accounts[role].id);
  }
});

test("GET /users/:id - admin can view any user", async () => {
  const res = await request(app)
    .get(`/api/v1/users/${accounts.pegawai.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.id, accounts.pegawai.id);
});

test("GET /users/:id - non-admin cannot view another user's profile (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/users/${accounts.admin.id}`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`);
  assert.equal(res.status, 403);
});

test("GET /users/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/users/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /users/:id - non-existent user returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/users/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- PATCH /api/v1/users/:id/role ---

test("PATCH /users/:id/role - pegawai cannot change their own role (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.pegawai.id}/role`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`)
    .send({ role: "admin" });
  assert.equal(res.status, 403);
});

test("PATCH /users/:id/role - hrd/pimpinan cannot change roles (403)", async () => {
  for (const role of ["hrd", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/users/${accounts.pegawai.id}/role`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ role: "hrd" });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /users/:id/role - admin can change a user's role", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.pegawai.id}/role`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ role: "hrd" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.role, "hrd");

  // Revert so later tests still treat this account as 'pegawai'.
  const revert = await request(app)
    .patch(`/api/v1/users/${accounts.pegawai.id}/role`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ role: "pegawai" });
  assert.equal(revert.status, 200);
  assert.equal(revert.body.data.role, "pegawai");
});

test("PATCH /users/:id/role - rejects invalid role value (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.pegawai.id}/role`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ role: "superuser" });
  assert.equal(res.status, 422);
});

// --- PATCH /api/v1/users/:id/status ---

test("PATCH /users/:id/status - hrd/pegawai/pimpinan cannot change status (403)", async () => {
  for (const role of ["hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/users/${accounts.pimpinan.id}/status`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ isActive: false });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /users/:id/status - rejects non-boolean isActive (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.pimpinan.id}/status`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ isActive: "not-a-boolean" });
  assert.equal(res.status, 422);
});

test("PATCH /users/:id/status - admin can deactivate a user, and that user is immediately locked out", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.pegawai.id}/status`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ isActive: false });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.isActive, false);

  const meRes = await request(app)
    .get(`/api/v1/users/${accounts.pegawai.id}`)
    .set("Authorization", `Bearer ${accounts.pegawai.token}`);
  assert.equal(meRes.status, 403);
});
