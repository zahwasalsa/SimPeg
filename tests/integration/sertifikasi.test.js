const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-sertifikasi-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-sertifikasi-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-sertifikasi-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-sertifikasi-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-sertifikasi-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let jenisId;
let sertifikasiAdminId; // owned by pegawaiA, created by admin
let sertifikasiPegawaiId; // owned by pegawaiB, self-created
let sertifikasiExpiringSoonId;
let sertifikasiExpiredId;

const PDF_BUFFER = Buffer.from("%PDF-1.4\nQA integration test content\n");
const attachPdf = (req, filename = "qa-test.pdf") =>
  req.attach("file", PDF_BUFFER, { filename, contentType: "application/pdf" });

const isoDaysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Sertifikasi ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `SERT-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `SERT-B-${runId}`);

  const { data: jenis, error } = await supabaseAdmin
    .from("jenis_sertifikasi")
    .insert({ nama_jenis: `QA Jenis Sertifikasi ${runId}` })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  jenisId = jenis.id;
});

after(async () => {
  const { data: rows } = await supabaseAdmin
    .from("sertifikasi")
    .select("file_path")
    .in("pegawai_id", [pegawaiAId, pegawaiBId]);

  if (rows && rows.length > 0) {
    await supabaseAdmin.storage.from("sertifikat").remove(rows.map((r) => r.file_path));
  }

  await supabaseAdmin.from("sertifikasi").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("jenis_sertifikasi").delete().eq("id", jenisId);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/sertifikasi (list) ---

test("GET /sertifikasi - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/sertifikasi");
  assert.equal(res.status, 401);
});

test("GET /sertifikasi - all roles can list (200), including pimpinan", async () => {
  for (const role of ["admin", "hrd", "pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .get("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /sertifikasi - pegawai gets 200 and empty data before any upload", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- GET /api/v1/sertifikasi/:id error paths (before any row exists) ---

test("GET /sertifikasi/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/sertifikasi (admin/hrd, explicit pegawaiId) ---

test("POST /sertifikasi - admin uploads for pegawaiA (201)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("jenisSertifikasiId", jenisId)
      .field("namaSertifikat", "Sertifikat Kompetensi QA")
      .field("penerbit", "LSP QA")
      .field("nomorSertifikat", "CERT-001")
      .field("tanggalTerbit", "2026-01-01")
      .field("tanggalBerakhir", isoDaysFromNow(365)),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.namaSertifikat, "Sertifikat Kompetensi QA");
  assert.equal(res.body.data.mimeType, "application/pdf");
  assert.equal(res.body.data.namaFileAsli, "qa-test.pdf");
  assert.ok(res.body.data.ukuranFile > 0);
  sertifikasiAdminId = res.body.data.id;
});

test("POST /sertifikasi - hrd uploads for pegawaiB without jenisSertifikasiId (201, null)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.hrd.token}`)
      .field("pegawaiId", pegawaiBId)
      .field("namaSertifikat", "Sertifikat Tanpa Jenis"),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.jenisSertifikasiId, null);
});

test("POST /sertifikasi - non-existent pegawaiId is rejected (404)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", "00000000-0000-0000-0000-000000000000")
      .field("namaSertifikat", "Ghost pegawai"),
  );
  assert.equal(res.status, 404);
});

test("POST /sertifikasi - non-existent jenisSertifikasiId is rejected (404)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("jenisSertifikasiId", "00000000-0000-0000-0000-000000000000")
      .field("namaSertifikat", "Ghost jenis"),
  );
  assert.equal(res.status, 404);
});

test("POST /sertifikasi - missing file is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("namaSertifikat", "No file attached");
  assert.equal(res.status, 422);
});

test("POST /sertifikasi - missing namaSertifikat is rejected (422)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId),
  );
  assert.equal(res.status, 422);
});

test("POST /sertifikasi - unsupported mime type is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("namaSertifikat", "Bad mime")
    .attach("file", Buffer.from("plain text"), { filename: "qa-test.txt", contentType: "text/plain" });
  assert.equal(res.status, 422);
});

test("POST /sertifikasi - file exceeding max size is rejected (422)", async () => {
  const oversized = Buffer.alloc(11 * 1024 * 1024, "a");
  const res = await request(app)
    .post("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("namaSertifikat", "Too big")
    .attach("file", oversized, { filename: "qa-big.pdf", contentType: "application/pdf" });
  assert.equal(res.status, 422);
});

// --- POST /api/v1/sertifikasi (pegawai self-service) ---

test("POST /sertifikasi - pegawai sending pegawaiId is rejected (422)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
      .field("pegawaiId", pegawaiBId)
      .field("namaSertifikat", "Should not be allowed"),
  );
  assert.equal(res.status, 422);
});

test("POST /sertifikasi - pegawai uploads for themselves (201)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
      .field("namaSertifikat", "Sertifikat Pribadi"),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  sertifikasiPegawaiId = res.body.data.id;
});

test("POST /sertifikasi - pimpinan cannot upload (403)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
      .field("namaSertifikat", "Should not be allowed"),
  );
  assert.equal(res.status, 403);
});

// --- GET detail & download (with real rows) ---

test("GET /sertifikasi/:id - admin, hrd, and pimpinan can view any record (200)", async () => {
  for (const role of ["admin", "hrd", "pimpinan"]) {
    const res = await request(app)
      .get(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /sertifikasi/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /sertifikasi/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /sertifikasi - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

test("GET /sertifikasi/:id/download - owner gets a signed URL (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiAdminId}/download`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.url.startsWith("http"));
  assert.ok(res.body.data.expiresIn > 0);
});

test("GET /sertifikasi/:id/download - non-owner pegawai is rejected (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiPegawaiId}/download`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /sertifikasi/:id/download - pimpinan gets a signed URL for any record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiPegawaiId}/download`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 200);
});

test("GET /sertifikasi/:id/download - download=1 returns a URL with the original filename attached", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiAdminId}/download?download=1`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.url.includes("download="));
});

test("GET /sertifikasi/:id/download - the signed URL actually serves the uploaded bytes", async () => {
  const signRes = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiAdminId}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(signRes.status, 200);

  const fileRes = await fetch(signRes.body.data.url);
  assert.equal(fileRes.status, 200);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(bytes.equals(PDF_BUFFER));
});

// --- PATCH /api/v1/sertifikasi/:id (metadata only, full CRUD for pegawai) ---

test("PATCH /sertifikasi/:id - admin can update metadata", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ penerbit: "LSP QA (Revisi)" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.penerbit, "LSP QA (Revisi)");
});

test("PATCH /sertifikasi/:id - pegawai can update their own record (full CRUD, 200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ namaSertifikat: "Sertifikat Pribadi (Revisi)", nomorSertifikat: "CERT-B-001" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.namaSertifikat, "Sertifikat Pribadi (Revisi)");
  assert.equal(res.body.data.nomorSertifikat, "CERT-B-001");
});

test("PATCH /sertifikasi/:id - pegawai cannot update another pegawai's record (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
    .send({ penerbit: "Should not be allowed" });
  assert.equal(res.status, 403);
});

test("PATCH /sertifikasi/:id - pimpinan cannot update (403)", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
    .send({ penerbit: "Should not be allowed" });
  assert.equal(res.status, 403);
});

test("PATCH /sertifikasi/:id - pegawaiId cannot be changed (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ pegawaiId: pegawaiBId });
  assert.equal(res.status, 422);
});

test("PATCH /sertifikasi/:id - non-existent jenisSertifikasiId is rejected (404)", async () => {
  const res = await request(app)
    .patch(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ jenisSertifikasiId: "00000000-0000-0000-0000-000000000000" });
  assert.equal(res.status, 404);
});

test("PATCH /sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .patch("/api/v1/sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ penerbit: "Ghost" });
  assert.equal(res.status, 404);
});

// --- Filters ---

test("GET /sertifikasi - jenisSertifikasiId filter returns only matching rows", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi?jenisSertifikasiId=${jenisId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((s) => s.id === sertifikasiAdminId));
  assert.ok(res.body.data.every((s) => s.jenisSertifikasiId === jenisId));
});

test("GET /sertifikasi - pegawaiId filter works for admin", async () => {
  const res = await request(app)
    .get(`/api/v1/sertifikasi?pegawaiId=${pegawaiAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.every((s) => s.pegawaiId === pegawaiAId));
});

// --- FR-CERT-003: Reminder (akanBerakhir) & Expired (kedaluwarsa) filters ---

test("Reminder/Expired setup - create a soon-expiring and an already-expired sertifikasi", async () => {
  const soonRes = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("namaSertifikat", "Sertifikat Segera Berakhir")
      .field("tanggalBerakhir", isoDaysFromNow(10)),
  );
  assert.equal(soonRes.status, 201);
  sertifikasiExpiringSoonId = soonRes.body.data.id;

  const expiredRes = await attachPdf(
    request(app)
      .post("/api/v1/sertifikasi")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("namaSertifikat", "Sertifikat Sudah Kedaluwarsa")
      .field("tanggalBerakhir", isoDaysFromNow(-30)),
  );
  assert.equal(expiredRes.status, 201);
  sertifikasiExpiredId = expiredRes.body.data.id;
});

test("GET /sertifikasi - akanBerakhir includes soon-expiring and already-expired, excludes no-expiry rows", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi?akanBerakhir=true")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((s) => s.id === sertifikasiExpiringSoonId));
  assert.ok(res.body.data.some((s) => s.id === sertifikasiExpiredId));
  // sertifikasiAdminId punya tanggalBerakhir 365 hari lagi — di luar window 30 hari.
  assert.ok(!res.body.data.some((s) => s.id === sertifikasiAdminId));
});

test("GET /sertifikasi - kedaluwarsa only includes rows whose tanggalBerakhir already passed", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi?kedaluwarsa=true")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((s) => s.id === sertifikasiExpiredId));
  assert.ok(!res.body.data.some((s) => s.id === sertifikasiExpiringSoonId));
  assert.ok(!res.body.data.some((s) => s.id === sertifikasiAdminId));
});

// --- DELETE /api/v1/sertifikasi/:id ---

test("DELETE /sertifikasi/:id - pimpinan cannot delete (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /sertifikasi/:id - non-owner pegawai cannot delete another pegawai's record (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/sertifikasi/${sertifikasiAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /sertifikasi/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/sertifikasi/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /sertifikasi/:id - owning pegawai can delete their own record (full CRUD, 200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/sertifikasi/${sertifikasiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/sertifikasi/${sertifikasiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);

  const listRes = await request(app)
    .get("/api/v1/sertifikasi?page=1&limit=100")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.ok(!listRes.body.data.some((s) => s.id === sertifikasiPegawaiId));
});

test("DELETE /sertifikasi/:id - deleting an already-deleted record returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/sertifikasi/${sertifikasiPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /sertifikasi/:id - admin deletes remaining QA rows (200)", async () => {
  for (const id of [sertifikasiAdminId, sertifikasiExpiringSoonId, sertifikasiExpiredId]) {
    const res = await request(app)
      .delete(`/api/v1/sertifikasi/${id}`)
      .set("Authorization", `Bearer ${accounts.admin.token}`);
    assert.equal(res.status, 200);
  }
});

// --- Response sanitization ---

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const res = await request(app)
    .get("/api/v1/sertifikasi")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const body = JSON.stringify(res.body).toLowerCase();
  assert.ok(!body.includes("password"));
  assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
  assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
  assert.ok(!body.includes("service_role"));
});
