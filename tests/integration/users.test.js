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
  emailTarget: { email: `qa-users-test-emailtarget-${runId}@example.test`, password: "Passw0rd123" },
};

let emailTargetPegawaiId;
const emailTargetNama = `QA Users EmailTarget ${runId}`;

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

const createPegawaiProfile = async (userId, nip, namaLengkap) => {
  const { data, error } = await supabaseAdmin
    .from("pegawai")
    .insert({ user_id: userId, nip, nama_lengkap: namaLengkap })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
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
  accounts.emailTarget = {
    ...accounts.emailTarget,
    ...(await createTestAccount(accounts.emailTarget.email, accounts.emailTarget.password, "pegawai")),
  };
  emailTargetPegawaiId = await createPegawaiProfile(
    accounts.emailTarget.id,
    `USR-EMAIL-${runId}`,
    emailTargetNama,
  );
});

after(async () => {
  await supabaseAdmin.from("pegawai").delete().eq("id", emailTargetPegawaiId);
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

// --- GET /api/v1/users/:id - linked pegawai ---

test("GET /users/:id - includes linked pegawai {id, namaLengkap} when a profile exists", async () => {
  const res = await request(app)
    .get(`/api/v1/users/${accounts.emailTarget.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.pegawai.id, emailTargetPegawaiId);
  assert.equal(res.body.data.pegawai.namaLengkap, emailTargetNama);
});

test("GET /users/:id - pegawai is null when no profile is linked", async () => {
  const res = await request(app)
    .get(`/api/v1/users/${accounts.admin.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.pegawai, null);
});

// --- PATCH /api/v1/users/:id/email ---

const newEmail = `qa-users-test-emailtarget-new-${runId}@example.test`;

test("PATCH /users/:id/email - hrd/pegawai/pimpinan cannot change email (403)", async () => {
  for (const role of ["hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/users/${accounts.emailTarget.id}/email`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ email: newEmail });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /users/:id/email - rejects invalid email (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.emailTarget.id}/email`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ email: "not-an-email" });
  assert.equal(res.status, 422);
});

test("PATCH /users/:id/email - changing to an email already used by another account is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.emailTarget.id}/email`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ email: accounts.admin.email });
  assert.equal(res.status, 409);
});

test("PATCH /users/:id/email - admin changes the email, updating both auth.users and public.users together", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.emailTarget.id}/email`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ email: newEmail });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, newEmail);

  // public.users.email reflects the change immediately.
  const detailRes = await request(app)
    .get(`/api/v1/users/${accounts.emailTarget.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.body.data.email, newEmail);

  // auth.users.email actually changed too — login only works with the new
  // address, proving the two columns never drifted out of sync.
  const loginOld = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: accounts.emailTarget.email, password: accounts.emailTarget.password });
  assert.equal(loginOld.status, 401);

  const loginNew = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: newEmail, password: accounts.emailTarget.password });
  assert.equal(loginNew.status, 200);

  accounts.emailTarget.email = newEmail;
});

test("PATCH /users/:id/email - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/users/00000000-0000-0000-0000-000000000000/email")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ email: `qa-ghost-${runId}@example.test` });
  assert.equal(res.status, 404);
});

// --- PATCH /api/v1/users/:id/password ---

test("PATCH /users/:id/password - hrd/pegawai/pimpinan cannot change password (403)", async () => {
  for (const role of ["hrd", "pegawai", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/users/${accounts.emailTarget.id}/password`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ password: "NewPassw0rd123" });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /users/:id/password - rejects password shorter than 8 characters (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.emailTarget.id}/password`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ password: "short" });
  assert.equal(res.status, 422);
});

test("PATCH /users/:id/password - admin sets a new password; old password stops working, new one logs in", async () => {
  const newPassword = "NewPassw0rd123";
  const res = await request(app)
    .patch(`/api/v1/users/${accounts.emailTarget.id}/password`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ password: newPassword });
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const loginOld = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: accounts.emailTarget.email, password: accounts.emailTarget.password });
  assert.equal(loginOld.status, 401);

  const loginNew = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: accounts.emailTarget.email, password: newPassword });
  assert.equal(loginNew.status, 200);

  accounts.emailTarget.password = newPassword;
});

test("PATCH /users/:id/password - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/users/00000000-0000-0000-0000-000000000000/password")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ password: "SomePassw0rd" });
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

// --- DELETE /api/v1/users/:id ---

test("DELETE /users/:id - hrd/pimpinan cannot delete (403)", async () => {
  for (const role of ["hrd", "pimpinan"]) {
    const res = await request(app)
      .delete(`/api/v1/users/${accounts.pegawai.id}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("DELETE /users/:id - admin cannot delete their own account (400)", async () => {
  const res = await request(app)
    .delete(`/api/v1/users/${accounts.admin.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 400);
});

test("DELETE /users/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/users/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /users/:id - admin can delete another user, then it's hidden from list and detail (404)", async () => {
  // accounts.pegawai was deactivated by the previous test — deleting an
  // already-deactivated user must still work (deleted_at, not is_active, is
  // what softDelete/findById key off of).
  const res = await request(app)
    .delete(`/api/v1/users/${accounts.pegawai.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/users/${accounts.pegawai.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);

  const listRes = await request(app)
    .get("/api/v1/users?page=1&limit=100")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.ok(!listRes.body.data.some((u) => u.id === accounts.pegawai.id));
});

test("DELETE /users/:id - deleting an already-deleted user returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/users/${accounts.pegawai.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});
