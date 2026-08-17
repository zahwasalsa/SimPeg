const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-kpi-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-kpi-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-kpi-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-kpi-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-kpi-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let kpiAId; // owned by pegawaiA, no kpi_detail — simple percentage path
let kpiBId; // owned by pegawaiB, weighted kpi_detail path
let kpiCId; // owned by pegawaiA, exercises POST/PATCH details[] bulk support
let kpiDId; // owned by pegawaiB, exercises exact threshold boundaries + target=0 safety
let kpiEId; // owned by pegawaiA, exercises the 99%/>100% boundaries + an isolated single-indicator detail percentage
let detailB1Id;
let detailB2Id;
let detailC1Id;

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA KPI ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `KPI-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `KPI-B-${runId}`);
});

after(async () => {
  await supabaseAdmin
    .from("kpi_detail")
    .delete()
    .in("kpi_id", [kpiAId, kpiBId, kpiCId, kpiDId, kpiEId].filter(Boolean));
  await supabaseAdmin.from("kpi").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/kpi (list) ---

test("GET /kpi - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/kpi");
  assert.equal(res.status, 401);
});

test("GET /kpi - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawaiA", "pimpinan"]) {
    const res = await request(app).get("/api/v1/kpi").set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
  }
});

test("GET /kpi - pegawai gets 200 and empty data before any KPI exists", async () => {
  const res = await request(app).get("/api/v1/kpi").set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- POST /api/v1/kpi ---

test("POST /kpi - pegawai and pimpinan cannot create (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .post("/api/v1/kpi")
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ pegawaiId: pegawaiAId, period: "2026-1", target: 100 });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /kpi - non-existent pegawaiId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: "00000000-0000-0000-0000-000000000000", period: "2026-1", target: 100 });
  assert.equal(res.status, 404);
});

test("POST /kpi - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-1" });
  assert.equal(res.status, 422);
});

test("POST /kpi - admin creates KPI for pegawaiA (201), starts not_started", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-1", target: 100 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.target, 100);
  assert.equal(res.body.data.achievement, 0);
  assert.equal(res.body.data.percentage, 0);
  assert.equal(res.body.data.status, "not_started");
  kpiAId = res.body.data.id;
});

test("POST /kpi - hrd creates KPI for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, period: "2026-1", target: 100 });
  assert.equal(res.status, 201);
  kpiBId = res.body.data.id;
});

test("POST /kpi - duplicate pegawaiId+period is rejected (409)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-1", target: 50 });
  assert.equal(res.status, 409);
});

// --- GET /api/v1/kpi/:id (detail) ---

test("GET /kpi/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/kpi/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /kpi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/kpi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("GET /kpi/:id - admin, hrd, and pimpinan can view any record (200)", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/kpi/${kpiAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /kpi/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /kpi/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /kpi - pegawai list is scoped to their own records only", async () => {
  const res = await request(app).get("/api/v1/kpi").set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

// --- PATCH /api/v1/kpi/:id (pegawai self-input capaian; admin/hrd target/period) ---

test("PATCH /kpi/:id - pimpinan cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ achievement: 10 });
  assert.equal(res.status, 403);
});

test("PATCH /kpi/:id - pegawai cannot update another pegawai's record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 10 });
  assert.equal(res.status, 403);
});

test("PATCH /kpi/:id - pegawai cannot send target (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ target: 200 });
  assert.equal(res.status, 403);
});

test("PATCH /kpi/:id - pegawai inputs achievement=50 (simple path, no kpi_detail): percentage 50, status at_risk", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 50 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.achievement, 50);
  assert.equal(res.body.data.percentage, 50);
  assert.equal(res.body.data.status, "at_risk");
});

test("PATCH /kpi/:id - achievement=80 crosses the on_track threshold (75)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 80 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 80);
  assert.equal(res.body.data.status, "on_track");
});

test("PATCH /kpi/:id - achievement=100 reaches achieved", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 100 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 100);
  assert.equal(res.body.data.status, "achieved");
});

test("PATCH /kpi/:id - admin can correct target, which re-triggers the percentage/status recalculation", async () => {
  // achievement stays 100 from the previous test; target moves 100 -> 120,
  // so percentage/status must be recomputed against the new target, not
  // frozen at whatever they were before (100/120 = 83.33%, still on_track).
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ target: 120 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.target, 120);
  assert.equal(res.body.data.percentage, 83.33);
  assert.equal(res.body.data.status, "on_track");
});

test("PATCH /kpi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/kpi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ target: 10 });
  assert.equal(res.status, 404);
});

// --- kpi_detail: weighted percentage path (kpiB) ---

test("POST /kpi/:id/detail - pegawai and pimpinan cannot create indicators (403)", async () => {
  for (const role of ["pegawaiB", "pimpinan"]) {
    const res = await request(app)
      .post(`/api/v1/kpi/${kpiBId}/detail`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({ indicator: "Publikasi", target: 10, weight: 50 });
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("POST /kpi/:id/detail - hrd adds two weighted indicators (201)", async () => {
  const res1 = await request(app)
    .post(`/api/v1/kpi/${kpiBId}/detail`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ indicator: "Publikasi", target: 10, weight: 50 });
  assert.equal(res1.status, 201);
  assert.equal(res1.body.data.realization, 0);
  detailB1Id = res1.body.data.id;

  const res2 = await request(app)
    .post(`/api/v1/kpi/${kpiBId}/detail`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ indicator: "Pengabdian", target: 20, weight: 50 });
  assert.equal(res2.status, 201);
  detailB2Id = res2.body.data.id;
});

test("kpi.percentage stays 0 / not_started while every kpi_detail.realization is still 0", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(res.body.data.percentage, 0);
  assert.equal(res.body.data.status, "not_started");
});

test("PATCH /kpi/:id/detail/:detailId - pegawai cannot send indicator/target/weight (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiBId}/detail/${detailB1Id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ target: 999 });
  assert.equal(res.status, 403);
});

test("PATCH /kpi/:id/detail/:detailId - pegawai inputs realization on their own indicator, parent kpi recalculates (weighted)", async () => {
  // detail1: 10/10 (ratio 1.0, weight 50); detail2: 0/20 (ratio 0, weight 50)
  // weighted = (1.0*50 + 0*50) / 100 * 100 = 50%
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiBId}/detail/${detailB1Id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ realization: 10 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.realization, 10);

  const kpiRes = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(kpiRes.body.data.percentage, 50);
  assert.equal(kpiRes.body.data.status, "at_risk");
});

test("PATCH /kpi/:id/detail/:detailId - completing the second indicator brings the KPI to achieved", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiBId}/detail/${detailB2Id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ realization: 20 });
  assert.equal(res.status, 200);

  const kpiRes = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(kpiRes.body.data.percentage, 100);
  assert.equal(kpiRes.body.data.status, "achieved");
});

test("PATCH /kpi/:id/detail/:detailId - pegawai cannot update another pegawai's indicator (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiBId}/detail/${detailB1Id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ realization: 5 });
  assert.equal(res.status, 403);
});

test("GET /kpi/:id/detail - lists indicators for a KPI (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiBId}/detail`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
});

test("DELETE /kpi/:id/detail/:detailId - admin/hrd only (pegawai gets 403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/kpi/${kpiBId}/detail/${detailB2Id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /kpi/:id/detail/:detailId - hrd removes an indicator, parent kpi recalculates", async () => {
  const res = await request(app)
    .delete(`/api/v1/kpi/${kpiBId}/detail/${detailB2Id}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(res.status, 200);

  // Only detail1 (10/10, weight 50) remains -> weighted = (1.0*50)/50*100 = 100%
  const kpiRes = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(kpiRes.body.data.percentage, 100);
});

// --- GET /api/v1/kpi/summary ---

test("GET /kpi/summary - pegawai gets own aggregate only", async () => {
  const res = await request(app)
    .get("/api/v1/kpi/summary")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.total, 1);
  // kpiA is on_track at this point (target was corrected to 120 earlier).
  assert.equal(res.body.data.byStatus.on_track, 1);
});

test("GET /kpi/summary - admin/hrd/pimpinan get the org-wide aggregate", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/kpi/summary")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(res.body.data.total >= 2);
  }
});

// --- Filters ---

test("GET /kpi - status filter returns only matching rows", async () => {
  const res = await request(app)
    .get("/api/v1/kpi?status=on_track")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.status === "on_track"));
  assert.ok(res.body.data.some((row) => row.id === kpiAId));
});

test("GET /kpi - period filter works", async () => {
  const res = await request(app)
    .get("/api/v1/kpi?period=2026-1")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.period === "2026-1"));
});

// --- DELETE /api/v1/kpi/:id ---

test("DELETE /kpi/:id - pegawai and pimpinan cannot delete (403)", async () => {
  for (const role of ["pegawaiB", "pimpinan"]) {
    const res = await request(app)
      .delete(`/api/v1/kpi/${kpiBId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("DELETE /kpi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/kpi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /kpi/:id - admin can delete, then it's hidden from list and detail (404)", async () => {
  const res = await request(app)
    .delete(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);
});

test("DELETE /kpi/:id - deleting an already-deleted KPI returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/kpi/${kpiBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const body = JSON.stringify(res.body);
  assert.ok(!body.includes("password_hash"));
  assert.ok(!body.includes("accessToken"));
});

// --- POST/PATCH /kpi with bulk details[], and GET :id embedding details ---

test("POST /kpi - accepts a details[] array, bulk-creating kpi_detail rows atomically with the KPI", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({
      pegawaiId: pegawaiAId,
      period: "2026-3",
      target: 100,
      details: [
        { indicator: "Publikasi", target: 4, weight: 60 },
        { indicator: "Pengabdian", target: 2, weight: 40 },
      ],
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "not_started");
  assert.equal(res.body.data.details.length, 2);
  assert.ok(res.body.data.details.every((d) => d.realization === 0));
  kpiCId = res.body.data.id;
  detailC1Id = res.body.data.details.find((d) => d.indicator === "Publikasi").id;
});

test("GET /kpi/:id - response embeds the details[] array", async () => {
  const res = await request(app)
    .get(`/api/v1/kpi/${kpiCId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.period, "2026-3");
  assert.equal(res.body.data.details.length, 2);
});

test("PATCH /kpi/:id - admin can bulk-update existing details[] (indicator/target/weight) via the top-level endpoint", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiCId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ details: [{ id: detailC1Id, target: 5, weight: 70 }] });
  assert.equal(res.status, 200);
  const updatedDetail = res.body.data.details.find((d) => d.id === detailC1Id);
  assert.equal(updatedDetail.target, 5);
  assert.equal(updatedDetail.weight, 70);
});

test("PATCH /kpi/:id - pegawai can bulk-update realization via details[] on their own KPI", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiCId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ details: [{ id: detailC1Id, realization: 5 }] });
  assert.equal(res.status, 200);
  const updatedDetail = res.body.data.details.find((d) => d.id === detailC1Id);
  assert.equal(updatedDetail.realization, 5);
  // detailC1 now fully realized (5/5, weight 70); detailC2 still 0/2 (weight 40
  // pre-update, unaffected) -> weighted = (1*70 + 0*40)/110*100 ≈ 63.64%
  assert.equal(res.body.data.percentage, 63.64);
  assert.equal(res.body.data.status, "at_risk");
});

test("PATCH /kpi/:id - pegawai sending indicator/target/weight inside details[] is rejected (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiCId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ details: [{ id: detailC1Id, target: 999 }] });
  assert.equal(res.status, 403);
});

test("PATCH /kpi/:id - details[].id belonging to a different KPI is rejected (404)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiCId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ details: [{ id: detailB1Id, target: 1 }] });
  assert.equal(res.status, 404);
});

test("GET /kpi/summary - includes byPeriod breakdown", async () => {
  const res = await request(app)
    .get("/api/v1/kpi/summary")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.byPeriod);
  assert.ok(res.body.data.byPeriod["2026-3"] >= 1);
});

// --- PHASE 4: exact threshold boundaries, target=0 safety, detail<->parent consistency ---

test("PHASE 4 setup - create kpiD (pegawaiB, target=100)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, period: "2026-4", target: 100 });
  assert.equal(res.status, 201);
  kpiDId = res.body.data.id;
});

test("percentage=69 (just below the 70 boundary) -> at_risk", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ achievement: 69 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 69);
  assert.equal(res.body.data.status, "at_risk");
});

test("percentage=70 (exact boundary) -> on_track, not at_risk", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ achievement: 70 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 70);
  assert.equal(res.body.data.status, "on_track");
});

test("percentage=100 (exact boundary) -> achieved, not on_track", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ achievement: 100 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 100);
  assert.equal(res.body.data.status, "achieved");
});

test("target=0 never divides by zero: percentage forced to 0 regardless of achievement, status not_started", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ target: 0 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.target, 0);
  assert.equal(res.body.data.achievement, 100); // untouched, real value preserved
  assert.equal(res.body.data.percentage, 0);
  assert.equal(res.body.data.status, "not_started");
});

test("PHASE 4 setup - restore kpiD.target to 100, add two indicators (one with target=0)", async () => {
  const restore = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ target: 100 });
  assert.equal(restore.status, 200);

  const d1 = await request(app)
    .post(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ indicator: "ZeroTargetIndicator", target: 0, weight: 50 });
  assert.equal(d1.status, 201);

  const d2 = await request(app)
    .post(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ indicator: "NormalIndicator", target: 10, weight: 50 });
  assert.equal(d2.status, 201);

  // Adding details recomputes percentage; both realizations are still 0 so
  // it's back to not_started even though target is now non-zero again.
  const kpiRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(kpiRes.body.data.percentage, 0);
  assert.equal(kpiRes.body.data.status, "not_started");
});

test("detail with target=0 contributes 0 to the weighted percentage regardless of realization sent to it", async () => {
  const detailsRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const zeroTargetDetail = detailsRes.body.data.find((d) => d.indicator === "ZeroTargetIndicator");
  const normalDetail = detailsRes.body.data.find((d) => d.indicator === "NormalIndicator");

  // realization=999 against target=0 must still contribute 0% (never Infinity/NaN)
  const res1 = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}/detail/${zeroTargetDetail.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ realization: 999 });
  assert.equal(res1.status, 200);

  const afterZero = await request(app)
    .get(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(afterZero.body.data.percentage, 0);

  // normalDetail: 5/10 = 50%, weight 50; zeroTargetDetail: forced 0%, weight 50
  // weighted = (0*50 + 50*50) / 100 = 25%
  const res2 = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}/detail/${normalDetail.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ realization: 5 });
  assert.equal(res2.status, 200);

  const afterNormal = await request(app)
    .get(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(afterNormal.body.data.percentage, 25);
  assert.equal(afterNormal.body.data.status, "at_risk");
  // Consistency requirement: achievement/target must reproduce the same
  // percentage even though it was actually driven by kpi_detail.
  assert.equal(afterNormal.body.data.achievement, 25); // 25% of target=100
});

// --- PHASE 13: 99%/>100% boundaries + an isolated single-indicator detail percentage ---

test("PHASE 13 setup - create kpiE (pegawaiA, target=100)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-13a", target: 100 });
  assert.equal(res.status, 201);
  kpiEId = res.body.data.id;
});

test("percentage=99 (just below the 100 boundary) -> on_track, not achieved", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiEId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 99 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.percentage, 99);
  assert.equal(res.body.data.status, "on_track");
});

test("percentage=150 (achievement exceeds target) -> achieved, real value not capped at 100", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiEId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ achievement: 150 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.achievement, 150);
  assert.equal(res.body.data.percentage, 150);
  assert.equal(res.body.data.status, "achieved");
});

test("kpi_detail: a single indicator's realization/target ratio drives the weighted percentage 1:1 when it holds the full weight", async () => {
  const detail = await request(app)
    .post(`/api/v1/kpi/${kpiEId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ indicator: "Indikator Tunggal", target: 20, weight: 100 });
  assert.equal(detail.status, 201);

  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiEId}/detail/${detail.body.data.id}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ realization: 15 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.realization, 15);

  // detail percentage = 15/20*100 = 75%; a single indicator holding the full
  // weight means the KPI's weighted percentage must equal that figure exactly.
  const kpiRes = await request(app)
    .get(`/api/v1/kpi/${kpiEId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(kpiRes.body.data.percentage, 75);
  assert.equal(kpiRes.body.data.status, "on_track");
});

// --- PHASE 5: validation ---

test("POST /kpi - target < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-5", target: -1 });
  assert.equal(res.status, 422);
});

test("POST /kpi - target = 0 is accepted (not negative, just a degenerate value)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-5", target: 0 });
  assert.equal(res.status, 201);
  await request(app)
    .delete(`/api/v1/kpi/${res.body.data.id}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
});

test("POST /kpi - details=[] (empty array) is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-6", target: 100, details: [] });
  assert.equal(res.status, 422);
});

test("POST /kpi - details[] missing indicator is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, period: "2026-6", target: 100, details: [{ target: 5, weight: 10 }] });
  assert.equal(res.status, 422);
});

test("POST /kpi - details[].target < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiAId,
      period: "2026-6",
      target: 100,
      details: [{ indicator: "X", target: -1, weight: 10 }],
    });
  assert.equal(res.status, 422);
});

test("POST /kpi - details[].weight < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/kpi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({
      pegawaiId: pegawaiAId,
      period: "2026-6",
      target: 100,
      details: [{ indicator: "X", target: 5, weight: -10 }],
    });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - achievement < 0 is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ achievement: -5 });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - target < 0 is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ target: -1 });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - details=[] (empty array) is rejected (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ details: [] });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - details[].realization < 0 is rejected (422)", async () => {
  const detailsRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const anyDetailId = detailsRes.body.data[0].id;

  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ details: [{ id: anyDetailId, realization: -1 }] });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - details[].target < 0 is rejected (422)", async () => {
  const detailsRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const anyDetailId = detailsRes.body.data[0].id;

  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ details: [{ id: anyDetailId, target: -1 }] });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id - details[].weight < 0 is rejected (422)", async () => {
  const detailsRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const anyDetailId = detailsRes.body.data[0].id;

  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ details: [{ id: anyDetailId, weight: -1 }] });
  assert.equal(res.status, 422);
});

test("POST /kpi/:id/detail - weight < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ indicator: "Negative Weight Test", target: 5, weight: -1 });
  assert.equal(res.status, 422);
});

test("POST /kpi/:id/detail - target < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ indicator: "Negative Target Test", target: -5 });
  assert.equal(res.status, 422);
});

test("PATCH /kpi/:id/detail/:detailId - realization < 0 is rejected (422)", async () => {
  const detailsRes = await request(app)
    .get(`/api/v1/kpi/${kpiDId}/detail`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const anyDetailId = detailsRes.body.data[0].id;

  const res = await request(app)
    .patch(`/api/v1/kpi/${kpiDId}/detail/${anyDetailId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ realization: -1 });
  assert.equal(res.status, 422);
});
