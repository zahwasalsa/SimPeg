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
let dokumenAdminId;
let dokumenPegawaiId;

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
  await supabaseAdmin.from("kategori_dokumen").delete().eq("id", kategoriId);
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
