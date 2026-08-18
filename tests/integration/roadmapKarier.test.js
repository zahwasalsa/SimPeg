const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-roadmap-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-roadmap-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-roadmap-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-roadmap-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-roadmap-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let jabatanCurrentId; // "current" jabatan used as jabatanSaatIniId across fixtures
let jabatanTargetId; // "next" jabatan used as jabatanTargetId across fixtures
let roadmapAId; // owned by pegawaiA
let roadmapBId; // owned by pegawaiB

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Roadmap ${nip}` })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
};

const createJabatan = async (namaJabatan) => {
  const { data, error } = await supabaseAdmin
    .from("jabatan")
    .insert({ nama_jabatan: namaJabatan })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `RK-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `RK-B-${runId}`);
  jabatanCurrentId = await createJabatan(`QA Jabatan Saat Ini ${runId}`);
  jabatanTargetId = await createJabatan(`QA Jabatan Target ${runId}`);
});

after(async () => {
  await supabaseAdmin.from("roadmap_karier").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("jabatan").delete().in("id", [jabatanCurrentId, jabatanTargetId].filter(Boolean));
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/roadmap-karier (list) ---

test("GET /roadmap-karier - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/roadmap-karier");
  assert.equal(res.status, 401);
});

test("GET /roadmap-karier - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/roadmap-karier")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /roadmap-karier - pegawai gets 200 and empty data before any roadmap exists", async () => {
  const res = await request(app)
    .get("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- POST /api/v1/roadmap-karier ---

test("POST /roadmap-karier - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/roadmap-karier")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ pegawaiId: pegawaiAId });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /roadmap-karier - non-existent pegawaiId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("POST /roadmap-karier - non-existent jabatanSaatIniId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, jabatanSaatIniId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("POST /roadmap-karier - non-existent jabatanTargetId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, jabatanTargetId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("POST /roadmap-karier - rejects invalid pegawaiId (422)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: "not-a-uuid" });
  assert.equal(res.status, 422);
});

test("POST /roadmap-karier - admin creates roadmap for pegawaiA (201), defaults to in_progress/0", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiAId,
      jabatanSaatIniId: jabatanCurrentId,
      jabatanTargetId: jabatanTargetId,
      persyaratan: "Minimal 2 tahun menjabat dan menyelesaikan pelatihan kepemimpinan",
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.jabatanSaatIniId, jabatanCurrentId);
  assert.equal(res.body.data.jabatanTargetId, jabatanTargetId);
  assert.equal(res.body.data.progress, 0);
  assert.equal(res.body.data.status, "in_progress");
  roadmapAId = res.body.data.id;
});

test("POST /roadmap-karier - hrd creates roadmap for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, progress: 40, status: "eligible" });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.progress, 40);
  assert.equal(res.body.data.status, "eligible");
  roadmapBId = res.body.data.id;
});

test("POST /roadmap-karier - progress > 100 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, progress: 150 });
  assert.equal(res.status, 422);
});

test("POST /roadmap-karier - progress < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, progress: -1 });
  assert.equal(res.status, 422);
});

test("POST /roadmap-karier - invalid status enum is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, status: "done" });
  assert.equal(res.status, 422);
});

// Regression: the frontend's "- Tidak ada -" option sends `null` (not an
// omitted field) for an unset jabatan — `.optional()` alone only skips
// `undefined`, not `null`, so this must be accepted via
// `.optional({ nullable: true })` (same pattern as pegawai.validation.js's
// divisiId/jabatanId) or every roadmap without both jabatan filled in would
// be un-creatable/un-editable from the UI.
test("POST /roadmap-karier - null jabatanSaatIniId/jabatanTargetId is accepted (201)", async () => {
  const res = await request(app)
    .post("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, jabatanSaatIniId: null, jabatanTargetId: null });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.jabatanSaatIniId, null);
  assert.equal(res.body.data.jabatanTargetId, null);

  const del = await request(app)
    .delete(`/api/v1/roadmap-karier/${res.body.data.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(del.status, 200);
});

test("PATCH /roadmap-karier/:id - null jabatanSaatIniId/jabatanTargetId is accepted (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ jabatanSaatIniId: null, jabatanTargetId: null });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.jabatanSaatIniId, null);
  assert.equal(res.body.data.jabatanTargetId, null);
});

// --- GET /api/v1/roadmap-karier/:id (detail) ---

test("GET /roadmap-karier/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/roadmap-karier/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /roadmap-karier/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/roadmap-karier/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("GET /roadmap-karier/:id - admin, hrd, and pimpinan can view any record (200)", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/roadmap-karier/${roadmapAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /roadmap-karier/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /roadmap-karier/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/roadmap-karier/${roadmapBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /roadmap-karier - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/roadmap-karier")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

test("GET /roadmap-karier - status filter returns only matching rows", async () => {
  const res = await request(app)
    .get("/api/v1/roadmap-karier?status=eligible")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.status === "eligible"));
  assert.ok(res.body.data.some((row) => row.id === roadmapBId));
});

test("GET /roadmap-karier - pegawaiId filter works for admin/hrd", async () => {
  const res = await request(app)
    .get(`/api/v1/roadmap-karier?pegawaiId=${pegawaiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiBId));
});

// --- PATCH /api/v1/roadmap-karier/:id ---

test("PATCH /roadmap-karier/:id - pegawai cannot update even their own record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ progress: 10 });
  assert.equal(res.status, 403);
});

test("PATCH /roadmap-karier/:id - pimpinan cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ progress: 10 });
  assert.equal(res.status, 403);
});

test("PATCH /roadmap-karier/:id - pegawaiId cannot be changed (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 422);
});

test("PATCH /roadmap-karier/:id - admin updates progress and status (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ progress: 65, status: "eligible" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.progress, 65);
  assert.equal(res.body.data.status, "eligible");
});

test("PATCH /roadmap-karier/:id - hrd promotes pegawaiA to promoted (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ progress: 100, status: "promoted" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.progress, 100);
  assert.equal(res.body.data.status, "promoted");
});

test("PATCH /roadmap-karier/:id - progress > 100 is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ progress: 101 });
  assert.equal(res.status, 422);
});

test("PATCH /roadmap-karier/:id - invalid status enum is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ status: "rejected" });
  assert.equal(res.status, 422);
});

test("PATCH /roadmap-karier/:id - non-existent jabatanTargetId is rejected (404)", async () => {
  const res = await request(app)
    .patch(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ jabatanTargetId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("PATCH /roadmap-karier/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/roadmap-karier/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ progress: 10 });
  assert.equal(res.status, 404);
});

// --- DELETE /api/v1/roadmap-karier/:id ---

test("DELETE /roadmap-karier/:id - pegawai and pimpinan cannot delete (403)", async () => {
  for (const role of ["pegawaiB", "pimpinan"]) {
    const res = await request(app)
      .delete(`/api/v1/roadmap-karier/${roadmapBId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("DELETE /roadmap-karier/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/roadmap-karier/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /roadmap-karier/:id - admin can delete, then it's hidden from list and detail (404)", async () => {
  const del = await request(app)
    .delete(`/api/v1/roadmap-karier/${roadmapBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(del.status, 200);

  const getRes = await request(app)
    .get(`/api/v1/roadmap-karier/${roadmapBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(getRes.status, 404);
});

test("DELETE /roadmap-karier/:id - deleting an already-deleted roadmap returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/roadmap-karier/${roadmapBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const res = await request(app)
    .get(`/api/v1/roadmap-karier/${roadmapAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes("password"));
  assert.ok(!raw.includes("service_role"));
});
