const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const testEmail = `qa-auth-test-${Date.now()}@example.test`;
const testPassword = "Passw0rd123";

let accessToken;
let refreshToken;
let createdUserId;

after(async () => {
  // Always clean up the test account, even if an assertion above failed.
  if (createdUserId) {
    await supabaseAdmin.from("users").delete().eq("id", createdUserId);
    await supabaseAdmin.auth.admin.deleteUser(createdUserId);
  }
});

test("POST /api/v1/auth/register - creates a new pegawai account", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: testEmail, password: testPassword });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.email, testEmail);
  assert.equal(res.body.data.role, "pegawai");
  createdUserId = res.body.data.id;
});

test("POST /api/v1/auth/register - rejects duplicate email with 409", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: testEmail, password: testPassword });

  assert.equal(res.status, 409);
  assert.equal(res.body.success, false);
});

test("POST /api/v1/auth/register - rejects invalid input with 422", async () => {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ email: "not-an-email", password: "short" });

  assert.equal(res.status, 422);
  assert.equal(res.body.success, false);
  assert.ok(Array.isArray(res.body.errors));
});

test("POST /api/v1/auth/login - rejects wrong password with 401", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: testEmail, password: "wrong-password" });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("POST /api/v1/auth/login - succeeds and returns a session", async () => {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: testEmail, password: testPassword });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.email, testEmail);
  assert.ok(res.body.data.session.accessToken);
  assert.ok(res.body.data.session.refreshToken);

  accessToken = res.body.data.session.accessToken;
  refreshToken = res.body.data.session.refreshToken;
});

test("GET /api/v1/auth/me - rejects request without token with 401", async () => {
  const res = await request(app).get("/api/v1/auth/me");

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test("GET /api/v1/auth/me - returns the logged-in user's profile", async () => {
  const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, testEmail);
  assert.equal(res.body.data.role, "pegawai");
  // This account was created via /auth/register only — no linked pegawai
  // row exists, so pegawaiId must resolve to null (not omitted, not 404).
  assert.equal(res.body.data.pegawaiId, null);
});

test("POST /api/v1/auth/refresh - exchanges refresh token for a new session", async () => {
  const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });

  assert.equal(res.status, 200);
  assert.ok(res.body.data.accessToken);
  assert.ok(res.body.data.refreshToken);
});

test("POST /api/v1/auth/logout - revokes the access token", async () => {
  const logoutRes = await request(app)
    .post("/api/v1/auth/logout")
    .set("Authorization", `Bearer ${accessToken}`);

  assert.equal(logoutRes.status, 200);
  assert.equal(logoutRes.body.success, true);

  const meRes = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${accessToken}`);

  assert.equal(meRes.status, 401);
});
