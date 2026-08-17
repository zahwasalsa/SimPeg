const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-dokumen-test-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-dokumen-test-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-dokumen-test-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-dokumen-test-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-dokumen-test-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let kategoriId;
let kategoriApprovalId;
let dokumenAdminId;
let dokumenPegawaiId;
let dokumenApprovalId;

const PDF_BUFFER = Buffer.from("%PDF-1.4\nQA integration test content\n");
const attachPdf = (req, filename = "qa-test.pdf") =>
  req.attach("file", PDF_BUFFER, { filename, contentType: "application/pdf" });

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Dokumen ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `DOK-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `DOK-B-${runId}`);

  const { data: kategori, error } = await supabaseAdmin
    .from("kategori_dokumen")
    .insert({ nama_kategori: `QA Dokumen Kategori ${runId}` })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  kategoriId = kategori.id;

  const { data: kategoriApproval, error: kategoriApprovalErr } = await supabaseAdmin
    .from("kategori_dokumen")
    .insert({ nama_kategori: `QA Dokumen Kategori Approval ${runId}`, wajib_approval: true })
    .select("id")
    .single();
  if (kategoriApprovalErr) {
    throw kategoriApprovalErr;
  }
  kategoriApprovalId = kategoriApproval.id;
});

after(async () => {
  const { data: rows } = await supabaseAdmin
    .from("dokumen")
    .select("file_path")
    .in("pegawai_id", [pegawaiAId, pegawaiBId]);

  if (rows && rows.length > 0) {
    await supabaseAdmin.storage.from("documents").remove(rows.map((r) => r.file_path));
  }

  await supabaseAdmin.from("dokumen").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("kategori_dokumen").delete().in("id", [kategoriId, kategoriApprovalId]);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- GET /api/v1/dokumen (list) ---

test("GET /dokumen - rejects request without token (401)", async () => {
  const res = await request(app).get("/api/v1/dokumen");
  assert.equal(res.status, 401);
});

test("GET /dokumen - admin and hrd can list (200)", async () => {
  for (const role of ["admin", "hrd"]) {
    const res = await request(app)
      .get("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts[role].token}`);
    assert.equal(res.status, 200, `expected 200 for role ${role}`);
  }
});

test("GET /dokumen - pegawai gets 200 and empty data before any upload", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

// --- GET /api/v1/dokumen/:id error paths (before any row exists) ---

test("GET /dokumen/:id - invalid UUID returns 422", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen/not-a-uuid")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 422);
});

test("GET /dokumen/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- POST /api/v1/dokumen (admin/hrd, explicit pegawaiId) ---

test("POST /dokumen - admin uploads for pegawaiA (201)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Ijazah QA"),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiAId);
  assert.equal(res.body.data.namaDokumen, "Ijazah QA");
  assert.equal(res.body.data.mimeType, "application/pdf");
  assert.equal(res.body.data.namaFileAsli, "qa-test.pdf");
  assert.ok(res.body.data.ukuranFile > 0);
  dokumenAdminId = res.body.data.id;
});

test("POST /dokumen - hrd uploads for pegawaiB (201)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.hrd.token}`)
      .field("pegawaiId", pegawaiBId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "SK QA"),
  );
  assert.equal(res.status, 201);
});

test("POST /dokumen - non-existent pegawaiId is rejected (404)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", "00000000-0000-0000-0000-000000000000")
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Ghost pegawai"),
  );
  assert.equal(res.status, 404);
});

test("POST /dokumen - non-existent kategoriDokumenId is rejected (404)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("kategoriDokumenId", "00000000-0000-0000-0000-000000000000")
      .field("namaDokumen", "Ghost kategori"),
  );
  assert.equal(res.status, 404);
});

test("POST /dokumen - missing file is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("kategoriDokumenId", kategoriId)
    .field("namaDokumen", "No file attached");
  assert.equal(res.status, 422);
});

test("POST /dokumen - unsupported mime type is rejected (422)", async () => {
  const res = await request(app)
    .post("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("kategoriDokumenId", kategoriId)
    .field("namaDokumen", "Bad mime")
    .attach("file", Buffer.from("plain text"), { filename: "qa-test.txt", contentType: "text/plain" });
  assert.equal(res.status, 422);
});

test("POST /dokumen - file exceeding max size is rejected (422)", async () => {
  const oversized = Buffer.alloc(11 * 1024 * 1024, "a");
  const res = await request(app)
    .post("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .field("pegawaiId", pegawaiAId)
    .field("kategoriDokumenId", kategoriId)
    .field("namaDokumen", "Too big")
    .attach("file", oversized, { filename: "qa-big.pdf", contentType: "application/pdf" });
  assert.equal(res.status, 422);
});

// --- POST /api/v1/dokumen (pegawai self-service) ---

test("POST /dokumen - pegawai sending pegawaiId is rejected (422)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.pegawaiA.token}`)
      .field("pegawaiId", pegawaiBId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Should not be allowed"),
  );
  assert.equal(res.status, 422);
});

test("POST /dokumen - pegawai uploads for themselves (201)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.pegawaiB.token}`)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Sertifikat Pribadi"),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.pegawaiId, pegawaiBId);
  dokumenPegawaiId = res.body.data.id;
});

test("POST /dokumen - pimpinan cannot upload (403)", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.pimpinan.token}`)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Should not be allowed"),
  );
  assert.equal(res.status, 403);
});

// --- GET detail & download (with real rows) ---

test("GET /dokumen/:id - admin and hrd can view any record (200)", async () => {
  const asAdmin = await request(app)
    .get(`/api/v1/dokumen/${dokumenPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(asAdmin.status, 200);

  const asHrd = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(asHrd.status, 200);
});

test("GET /dokumen/:id - pegawai can view their own record (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
});

test("GET /dokumen/:id - pegawai cannot view another pegawai's record (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /dokumen - pegawai list is scoped to their own records only", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 1);
  assert.ok(res.body.data.every((row) => row.pegawaiId === pegawaiAId));
});

test("GET /dokumen/:id/download - owner gets a signed URL (200)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}/download`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.url.startsWith("http"));
  assert.ok(res.body.data.expiresIn > 0);
});

test("GET /dokumen/:id/download - non-owner pegawai is rejected (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenPegawaiId}/download`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("GET /dokumen/:id/download - download=1 returns a URL with the original filename attached", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}/download?download=1`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.url.includes("download="));
});

test("GET /dokumen/:id/download - the signed URL actually serves the uploaded bytes", async () => {
  const signRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(signRes.status, 200);

  const fileRes = await fetch(signRes.body.data.url);
  assert.equal(fileRes.status, 200);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(bytes.equals(PDF_BUFFER));
});

// --- FR-DOC-010: Approval (per-kategori wajib_approval) ---

test("POST /dokumen - upload to a non-wajib_approval kategori has status null", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, null);
});

test("POST /dokumen - upload to a wajib_approval kategori starts menunggu_persetujuan", async () => {
  const res = await attachPdf(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("kategoriDokumenId", kategoriApprovalId)
      .field("namaDokumen", "SK Pengangkatan QA")
      .field("tanggalKedaluwarsa", "2020-01-01"),
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.status, "menunggu_persetujuan");
  assert.equal(res.body.data.tanggalKedaluwarsa, "2020-01-01");
  dokumenApprovalId = res.body.data.id;
});

test("PATCH /dokumen/:id/approve - pegawai and pimpinan cannot approve (403)", async () => {
  for (const role of ["pegawaiA", "pimpinan"]) {
    const res = await request(app)
      .patch(`/api/v1/dokumen/${dokumenApprovalId}/approve`)
      .set("Authorization", `Bearer ${accounts[role].token}`)
      .send({});
    assert.equal(res.status, 403, `expected 403 for role ${role}`);
  }
});

test("PATCH /dokumen/:id/approve - a dokumen whose kategori isn't wajib_approval is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/dokumen/${dokumenAdminId}/approve`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({});
  assert.equal(res.status, 409);
});

test("PATCH /dokumen/:id/reject - rejects without catatanApproval (422)", async () => {
  const res = await request(app)
    .patch(`/api/v1/dokumen/${dokumenApprovalId}/reject`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({});
  assert.equal(res.status, 422);
});

test("PATCH /dokumen/:id/approve - admin can approve (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/dokumen/${dokumenApprovalId}/approve`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({ catatanApproval: "Lengkap dan sesuai" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "disetujui");
  assert.equal(res.body.data.disetujuiOleh, accounts.admin.id);
  assert.ok(res.body.data.tanggalPersetujuan);
});

test("PATCH /dokumen/:id/approve - approving an already-processed dokumen is rejected (409)", async () => {
  const res = await request(app)
    .patch(`/api/v1/dokumen/${dokumenApprovalId}/approve`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .send({});
  assert.equal(res.status, 409);
});

test("POST /dokumen/:id/versi - uploading a new version resets an approved dokumen back to menunggu_persetujuan", async () => {
  const res = await attachPdf(
    request(app)
      .post(`/api/v1/dokumen/${dokumenApprovalId}/versi`)
      .set("Authorization", `Bearer ${accounts.admin.token}`),
    "qa-test-v2.pdf",
  );
  assert.equal(res.status, 201);

  const detailRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenApprovalId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.body.data.status, "menunggu_persetujuan");
  assert.equal(detailRes.body.data.disetujuiOleh, null);
  assert.equal(detailRes.body.data.catatanApproval, null);
});

test("PATCH /dokumen/:id/reject - hrd can reject with catatanApproval (200)", async () => {
  const res = await request(app)
    .patch(`/api/v1/dokumen/${dokumenApprovalId}/reject`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`)
    .send({ catatanApproval: "Berkas kurang jelas, mohon unggah ulang" });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, "ditolak");
  assert.equal(res.body.data.catatanApproval, "Berkas kurang jelas, mohon unggah ulang");
});

test("GET /dokumen - status filter returns only matching rows", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen?status=ditolak")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.data.some((d) => d.id === dokumenApprovalId));
  assert.ok(res.body.data.every((d) => d.status === "ditolak"));
});

// --- FR-DOC-009: Reminder (akanKedaluwarsa filter) ---

test("GET /dokumen - akanKedaluwarsa filter includes expired/expiring documents only", async () => {
  const res = await request(app)
    .get("/api/v1/dokumen?akanKedaluwarsa=true")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  // dokumenApprovalId was uploaded with tanggalKedaluwarsa 2020-01-01 (long expired).
  assert.ok(res.body.data.some((d) => d.id === dokumenApprovalId));
  // dokumenAdminId has no tanggalKedaluwarsa at all — must never match.
  assert.ok(!res.body.data.some((d) => d.id === dokumenAdminId));
});

// --- DELETE /api/v1/dokumen/:id ---

test("DELETE /dokumen/:id - non-owner pegawai cannot delete another pegawai's document (403)", async () => {
  const res = await request(app)
    .delete(`/api/v1/dokumen/${dokumenAdminId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 403);
});

test("DELETE /dokumen/:id - non-existent id returns 404", async () => {
  const res = await request(app)
    .delete("/api/v1/dokumen/00000000-0000-0000-0000-000000000000")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("DELETE /dokumen/:id - owning pegawai can delete their own document (200)", async () => {
  const res = await request(app)
    .delete(`/api/v1/dokumen/${dokumenPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data, null);

  const detailRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(detailRes.status, 404);

  const listRes = await request(app)
    .get("/api/v1/dokumen?page=1&limit=100")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.ok(!listRes.body.data.some((d) => d.id === dokumenPegawaiId));
});

test("DELETE /dokumen/:id - deleting an already-deleted document returns 404", async () => {
  const res = await request(app)
    .delete(`/api/v1/dokumen/${dokumenPegawaiId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

// --- Response sanitization ---

test("Responses never leak password_hash, tokens, or secrets", async () => {
  const listRes = await request(app)
    .get("/api/v1/dokumen")
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  const detailRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAdminId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);

  for (const res of [listRes, detailRes]) {
    const body = JSON.stringify(res.body).toLowerCase();
    assert.ok(!body.includes("password"), "response must not contain password fields");
    assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
    assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
    assert.ok(!body.includes("service_role"));
  }
});
