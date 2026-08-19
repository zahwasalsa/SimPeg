const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-penelitian-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-penelitian-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-penelitian-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-penelitian-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-penelitian-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let penelitianAId; // owned by pegawaiA
let penelitianBId; // owned by pegawaiB
let anggotaId;
let publikasiId;

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Penelitian ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `PEN-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `PEN-B-${runId}`);
});

after(async () => {
  await supabaseAdmin
    .from("publikasi")
    .delete()
    .in("penelitian_id", [penelitianAId, penelitianBId].filter(Boolean));
  await supabaseAdmin
    .from("anggota_penelitian")
    .delete()
    .in("penelitian_id", [penelitianAId, penelitianBId].filter(Boolean));
  await supabaseAdmin.from("hki").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("penelitian").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/penelitian (list) ---

test("GET /penelitian - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/penelitian");
  assert.equal(res.status, 401);
});

test("GET /penelitian - all roles can list (200)", async () => {
  for (const role of ["admin", "hrd", "pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/penelitian")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data));
  }
});

test("GET /penelitian - pegawai gets 200 and empty data before any penelitian exists", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- POST /api/v1/penelitian ---

test("POST /penelitian - pimpinan cannot create (403)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ pegawaiId: pegawaiAId, judul: "Penelitian X", tahun: 2026 });
  assert.equal(res.status, 403);
});

test("POST /penelitian - admin without pegawaiId is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ judul: "Penelitian X", tahun: 2026 });
  assert.equal(res.status, 422);
});

test("POST /penelitian - pegawai sending pegawaiId is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId, judul: "Penelitian X", tahun: 2026 });
  assert.equal(res.status, 422);
});

test("POST /penelitian - admin, non-existent pegawaiId is rejected (404)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: "00000000-0000-0000-0000-000000000000", judul: "Penelitian X", tahun: 2026 });
  assert.equal(res.status, 404);
});

test("POST /penelitian - rejects invalid input (422)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiAId, tahun: 2026 });
  assert.equal(res.status, 422);
});

test("POST /penelitian - pegawaiA self-reports their own penelitian (201)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Optimasi Basis Data", skema: "Hibah Internal", dana: 5000000, tahun: 2026 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.judul, "Optimasi Basis Data");
  assert.equal(res.body.data.dana, 5000000);
  penelitianAId = res.body.data.id;
});

test("POST /penelitian - hrd creates penelitian for pegawaiB (201)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ pegawaiId: pegawaiBId, judul: "Penelitian Pegawai B", tahun: 2026 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  assert.equal(res.body.data.skema, null);
  assert.equal(res.body.data.dana, null);
  penelitianBId = res.body.data.id;
});

// --- GET /api/v1/penelitian/:id (detail) ---

test("GET /penelitian/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /penelitian/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("GET /penelitian/:id - admin, hrd, and pimpinan can view any record (200)", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/penelitian/${penelitianAId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.ok(Array.isArray(res.body.data.anggota));
    assert.ok(Array.isArray(res.body.data.publikasi));
  }
});

test("GET /penelitian/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /penelitian/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /penelitian - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

// --- PATCH /api/v1/penelitian/:id ---

test("PATCH /penelitian/:id - pimpinan cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ judul: "Updated" });
  assert.equal(res.status, 403);
});

test("PATCH /penelitian/:id - pegawai cannot update another pegawai's record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Updated" });
  assert.equal(res.status, 403);
});

test("PATCH /penelitian/:id - pegawaiId cannot be changed (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 422);
});

test("PATCH /penelitian/:id - pegawai updates their own record (full CRUD, 200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Optimasi Basis Data (Revisi)", dana: 7500000 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.judul, "Optimasi Basis Data (Revisi)");
  assert.equal(res.body.data.dana, 7500000);
});

test("PATCH /penelitian/:id - admin can update any record", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ tahun: 2027 });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.tahun, 2027);
});

test("PATCH /penelitian/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/penelitian/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ judul: "X" });
  assert.equal(res.status, 404);
});

// --- anggota_penelitian ---

test("POST /penelitian/:id/anggota - pimpinan cannot add member (403)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 403);
});

test("POST /penelitian/:id/anggota - pegawai cannot add member to another pegawai's penelitian (403)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianBId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiAId });
  assert.equal(res.status, 403);
});

test("POST /penelitian/:id/anggota - non-existent pegawaiId is rejected (404)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("POST /penelitian/:id/anggota - pegawaiA adds pegawaiB as a member of their own penelitian (201)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.penelitianId, penelitianAId);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  anggotaId = res.body.data.id;
});

test("POST /penelitian/:id/anggota - adding the same member twice is rejected (409)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 409);
});

test("GET /penelitian/:id/anggota - being a member does not grant pegawaiB read access to pegawaiA's penelitian", async () => {
  // Explicit product rule: "Pegawai tidak boleh mengakses atau mengubah data
  // penelitian pegawai lain" — membership in anggota_penelitian is not an
  // access grant, ownership is always penelitian.pegawai_id only.
  const res = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("GET /penelitian/:id/anggota - owner and admin/hrd/pimpinan can list members (200)", async () => {
  for (const role of ["pegawaiA", "admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/penelitian/${penelitianAId}/anggota`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
    assert.equal(res.body.data.length, 1);
  }
});

test("DELETE /penelitian/:id/anggota/:anggotaId - pegawai cannot remove member from another pegawai's penelitian (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}/anggota/${anggotaId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /penelitian/:id/anggota/:anggotaId - owner removes a member (200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}/anggota/${anggotaId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);

  const listRes = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}/anggota`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(listRes.body.data.length, 0);
});

// --- publikasi ---

test("POST /penelitian/:id/publikasi - pimpinan cannot create (403)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/publikasi`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ judul: "Publikasi X", tahun: 2026 });
  assert.equal(res.status, 403);
});

test("POST /penelitian/:id/publikasi - pegawai cannot create publikasi under another pegawai's penelitian (403)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianBId}/publikasi`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Publikasi X", tahun: 2026 });
  assert.equal(res.status, 403);
});

test("POST /penelitian/:id/publikasi - pegawaiA creates a publikasi under their own penelitian (201)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/publikasi`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Jurnal Basis Data Terdistribusi", jurnal: "JIKA", terindeks: true, tahun: 2026 });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.penelitianId, penelitianAId);
  assert.equal(res.body.data.terindeks, true);
  publikasiId = res.body.data.id;
});

test("GET /penelitian/:id - embeds the publikasi[] array", async () => {
  const res = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.publikasi.length, 1);
  assert.equal(res.body.data.publikasi[0].id, publikasiId);
});

test("PATCH /penelitian/:id/publikasi/:publikasiId - pegawai cannot update publikasi under another pegawai's penelitian (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianAId}/publikasi/${publikasiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ terindeks: false });
  assert.equal(res.status, 403);
});

test("PATCH /penelitian/:id/publikasi/:publikasiId - owner updates their publikasi (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianAId}/publikasi/${publikasiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ terindeks: false, jurnal: "JIKA (Revisi)" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.terindeks, false);
  assert.equal(res.body.data.jurnal, "JIKA (Revisi)");
});

test("PATCH /penelitian/:id/publikasi/:publikasiId - publikasiId belonging to a different penelitian is rejected (404)", async () => {
  const res = await request(app)
    .patch(`/api/v1/penelitian/${penelitianBId}/publikasi/${publikasiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ terindeks: true });
  assert.equal(res.status, 404);
});

test("DELETE /penelitian/:id/publikasi/:publikasiId - pegawai cannot delete another pegawai's publikasi (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}/publikasi/${publikasiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /penelitian/:id/publikasi/:publikasiId - owner deletes their publikasi (200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}/publikasi/${publikasiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);

  const detailRes = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(detailRes.body.data.publikasi.length, 0);
});

// --- Filters ---

test("GET /penelitian - tahun filter returns only matching rows", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian?tahun=2026")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.tahun === 2026));
  assert.ok(res.body.data.some((row) => row.id === penelitianAId));
});

test("GET /penelitian - pegawaiId filter works for admin", async () => {
  const res = await request(app)
    .get(`/api/v1/penelitian?pegawaiId=${pegawaiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

// --- Validation edge cases ---

test("POST /penelitian - dana < 0 is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Invalid", dana: -1, tahun: 2026 });
  assert.equal(res.status, 422);
});

test("POST /penelitian - tahun out of range is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Invalid", tahun: 1500 });
  assert.equal(res.status, 422);
});

test("POST /penelitian/:id/publikasi - tahun missing is rejected (422)", async () => {
  const res = await request(app)
    .post(`/api/v1/penelitian/${penelitianAId}/publikasi`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
    .send({ judul: "Publikasi Tanpa Tahun" });
  assert.equal(res.status, 422);
});

// --- DELETE /api/v1/penelitian/:id ---

test("DELETE /penelitian/:id - pimpinan cannot delete (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /penelitian/:id - pegawai cannot delete another pegawai's record (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /penelitian/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/penelitian/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /penelitian/:id - pegawai deletes their own record (full CRUD, 200), then it's hidden from detail (404)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);
});

test("DELETE /penelitian/:id - deleting an already-deleted penelitian returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianAId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /penelitian/:id - admin deletes pegawaiB's record (200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/penelitian/${penelitianBId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
});

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const res = await request(app)
    .get("/api/v1/penelitian")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const body = JSON.stringify(res.body);
  assert.ok(!body.includes("password_hash"));
  assert.ok(!body.includes("accessToken"));
});
