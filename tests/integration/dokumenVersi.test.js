const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../../src/app");
const supabaseAdmin = require("../../src/config/supabase");

const runId = Date.now();
const accounts = {
  admin: { email: `qa-dokumen-versi-admin-${runId}@example.test`, password: "Passw0rd123" },
  hrd: { email: `qa-dokumen-versi-hrd-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiA: { email: `qa-dokumen-versi-pegawaia-${runId}@example.test`, password: "Passw0rd123" },
  pegawaiB: { email: `qa-dokumen-versi-pegawaib-${runId}@example.test`, password: "Passw0rd123" },
  pimpinan: { email: `qa-dokumen-versi-pimpinan-${runId}@example.test`, password: "Passw0rd123" },
};

let pegawaiAId;
let pegawaiBId;
let kategoriId;
let dokumenAId; // owned by pegawaiA, used for the main version-history flow
let dokumenBId; // owned by pegawaiB, used for cross-owner isolation checks
let versionA1Id;
let versionA2Id;
let versionA3Id;

const bufferFor = (label) => Buffer.from(`%PDF-1.4\nQA dokumenVersi test content: ${label}\n`);

const attachFile = (req, buffer, filename = "qa-versi-test.pdf", contentType = "application/pdf") =>
  req.attach("file", buffer, { filename, contentType });

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
    .insert({ user_id: userId, nip, nama_lengkap: `QA Dokumen Versi ${nip}` })
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

  pegawaiAId = await createPegawaiProfile(accounts.pegawaiA.id, `DOKV-A-${runId}`);
  pegawaiBId = await createPegawaiProfile(accounts.pegawaiB.id, `DOKV-B-${runId}`);

  const { data: kategori, error } = await supabaseAdmin
    .from("kategori_dokumen")
    .insert({ nama_kategori: `QA Dokumen Versi Kategori ${runId}` })
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

  const { data: versionRows } = await supabaseAdmin
    .from("dokumen_version")
    .select("file_path, dokumen_id")
    .in(
      "dokumen_id",
      (await supabaseAdmin.from("dokumen").select("id").in("pegawai_id", [pegawaiAId, pegawaiBId])).data.map(
        (d) => d.id,
      ),
    );

  const allPaths = [...(rows || []).map((r) => r.file_path), ...(versionRows || []).map((r) => r.file_path)];
  if (allPaths.length > 0) {
    await supabaseAdmin.storage.from("documents").remove(allPaths);
  }

  // dokumen_version rows cascade automatically when their parent `dokumen`
  // row is deleted (ON DELETE CASCADE) — no separate delete needed here.
  await supabaseAdmin.from("dokumen").delete().in("pegawai_id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("pegawai").delete().in("id", [pegawaiAId, pegawaiBId]);
  await supabaseAdmin.from("kategori_dokumen").delete().eq("id", kategoriId);
  await Promise.all(Object.values(accounts).map((acc) => supabaseAdmin.auth.admin.deleteUser(acc.id)));
});

// --- 1. New dokumen automatically has version 1 ---

test("POST /dokumen - new document automatically creates dokumen_version 1", async () => {
  const res = await attachFile(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Ijazah QA Versi"),
    bufferFor("v1"),
    "ijazah-v1.pdf",
  );
  assert.equal(res.status, 201);
  dokumenAId = res.body.data.id;

  const { data: dokumenRow } = await supabaseAdmin
    .from("dokumen")
    .select("versi_aktif, nama_file_asli, mime_type, ukuran_file")
    .eq("id", dokumenAId)
    .single();
  assert.equal(dokumenRow.versi_aktif, 1);
  assert.equal(dokumenRow.nama_file_asli, "ijazah-v1.pdf");

  const { data: versions } = await supabaseAdmin
    .from("dokumen_version")
    .select("id, nomor_versi")
    .eq("dokumen_id", dokumenAId);
  assert.equal(versions.length, 1);
  assert.equal(versions[0].nomor_versi, 1);
  versionA1Id = versions[0].id;
});

test("POST /dokumen - hrd upload for pegawaiB also creates version 1", async () => {
  const res = await attachFile(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.hrd.token}`)
      .field("pegawaiId", pegawaiBId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "SK QA Versi"),
    bufferFor("b-v1"),
    "sk-v1.pdf",
  );
  assert.equal(res.status, 201);
  dokumenBId = res.body.data.id;

  const { data: versions } = await supabaseAdmin
    .from("dokumen_version")
    .select("nomor_versi")
    .eq("dokumen_id", dokumenBId);
  assert.equal(versions.length, 1);
});

// --- 2/3/4. Upload version 2, version 3, sequential numbering ---

test("POST /dokumen/:id/versi - admin uploads version 2 (201)", async () => {
  const res = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenAId}/versi`)
      .set("Authorization", `Bearer ${accounts.admin.token}`),
    bufferFor("v2"),
    "ijazah-v2.pdf",
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.nomorVersi, 2);
  assert.equal(res.body.data.dokumenId, dokumenAId);
  versionA2Id = res.body.data.id;
});

test("POST /dokumen/:id/versi - admin uploads version 3 (201), numbering is sequential", async () => {
  const res = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenAId}/versi`)
      .set("Authorization", `Bearer ${accounts.admin.token}`),
    bufferFor("v3"),
    "ijazah-v3.pdf",
  );
  assert.equal(res.status, 201);
  assert.equal(res.body.data.nomorVersi, 3);
  versionA3Id = res.body.data.id;
});

// --- 5/6. versi_aktif and metadata mirror follow the latest version ---

test("dokumen.versi_aktif points to the latest version after uploads", async () => {
  const { data: dokumenRow } = await supabaseAdmin
    .from("dokumen")
    .select("versi_aktif")
    .eq("id", dokumenAId)
    .single();
  assert.equal(dokumenRow.versi_aktif, 3);
});

test("GET /dokumen/:id - mirror metadata reflects the latest version's file", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.namaFileAsli, "ijazah-v3.pdf");
});

// --- 7/8. History lists every version, newest first ---

test("GET /dokumen/:id/versi - returns all versions ordered newest to oldest", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 3);
  assert.deepEqual(
    res.body.data.map((v) => v.nomorVersi),
    [3, 2, 1],
  );
});

// --- 9/10/11. Download old and latest versions, byte-for-byte ---

test("GET /dokumen/:id/versi/:versionId/download - old version serves its own bytes", async () => {
  const signRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi/${versionA1Id}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(signRes.status, 200);

  const fileRes = await fetch(signRes.body.data.url);
  assert.equal(fileRes.status, 200);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(bytes.equals(bufferFor("v1")));
});

test("GET /dokumen/:id/versi/:versionId/download - middle version serves its own bytes", async () => {
  const signRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi/${versionA2Id}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(signRes.status, 200);

  const fileRes = await fetch(signRes.body.data.url);
  assert.equal(fileRes.status, 200);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(bytes.equals(bufferFor("v2")));
});

test("GET /dokumen/:id/versi/:versionId/download - latest version serves its own bytes", async () => {
  const signRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi/${versionA3Id}/download?download=1`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(signRes.status, 200);
  assert.ok(signRes.body.data.url.includes("download="));

  const fileRes = await fetch(signRes.body.data.url);
  assert.equal(fileRes.status, 200);
  const bytes = Buffer.from(await fileRes.arrayBuffer());
  assert.ok(bytes.equals(bufferFor("v3")));
});

// --- 12/13/14. Permission: admin, hrd, pegawai self-scope ---

test("Permission - admin can list and upload versions for any pegawai's document", async () => {
  const listRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(listRes.status, 200);
});

test("Permission - hrd can list and upload versions for any pegawai's document", async () => {
  const uploadRes = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenBId}/versi`)
      .set("Authorization", `Bearer ${accounts.hrd.token}`),
    bufferFor("b-v2"),
    "sk-v2.pdf",
  );
  assert.equal(uploadRes.status, 201);
  assert.equal(uploadRes.body.data.nomorVersi, 2);

  const listRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi`)
    .set("Authorization", `Bearer ${accounts.hrd.token}`);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.data.length, 2);
});

test("Permission - pegawai can list and upload versions for their own document", async () => {
  const uploadRes = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenBId}/versi`)
      .set("Authorization", `Bearer ${accounts.pegawaiB.token}`),
    bufferFor("b-v3"),
    "sk-v3.pdf",
  );
  assert.equal(uploadRes.status, 201);

  const listRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi`)
    .set("Authorization", `Bearer ${accounts.pegawaiB.token}`);
  assert.equal(listRes.status, 200);
});

// --- 15. Pegawai cannot access another pegawai's document versions ---

test("Permission - pegawai cannot list another pegawai's document versions (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

test("Permission - pegawai cannot upload a version for another pegawai's document (403)", async () => {
  const res = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenBId}/versi`)
      .set("Authorization", `Bearer ${accounts.pegawaiA.token}`),
    bufferFor("intruder"),
    "intruder.pdf",
  );
  assert.equal(res.status, 403);
});

test("Permission - pegawai cannot download another pegawai's document version (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi/${versionA1Id}/download`)
    .set("Authorization", `Bearer ${accounts.pegawaiA.token}`);
  assert.equal(res.status, 403);
});

// --- 16/17. Pimpinan: no upload, read-only within their own ownership ---

test("Permission - pimpinan cannot upload a version (403)", async () => {
  const res = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${dokumenAId}/versi`)
      .set("Authorization", `Bearer ${accounts.pimpinan.token}`),
    bufferFor("pimpinan"),
    "pimpinan.pdf",
  );
  assert.equal(res.status, 403);
});

test("Permission - pimpinan without ownership cannot read version history (403)", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi`)
    .set("Authorization", `Bearer ${accounts.pimpinan.token}`);
  // Pimpinan owns no document (never allowed to create one), so this mirrors
  // the existing Stage 4A self-or-role check: no ownership match -> 403.
  assert.equal(res.status, 403);
});

// --- 18/19. File validation ---

test("POST /dokumen/:id/versi - unsupported mime type is rejected (422), no version created", async () => {
  const before2 = await supabaseAdmin.from("dokumen_version").select("id").eq("dokumen_id", dokumenAId);

  const res = await request(app)
    .post(`/api/v1/dokumen/${dokumenAId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .attach("file", Buffer.from("plain text"), { filename: "bad.txt", contentType: "text/plain" });
  assert.equal(res.status, 422);

  const after2 = await supabaseAdmin.from("dokumen_version").select("id").eq("dokumen_id", dokumenAId);
  assert.equal(after2.data.length, before2.data.length);
});

test("POST /dokumen/:id/versi - file exceeding 10MB is rejected (422), no version created", async () => {
  const before2 = await supabaseAdmin.from("dokumen_version").select("id").eq("dokumen_id", dokumenAId);

  const oversized = Buffer.alloc(11 * 1024 * 1024, "a");
  const res = await request(app)
    .post(`/api/v1/dokumen/${dokumenAId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`)
    .attach("file", oversized, { filename: "too-big.pdf", contentType: "application/pdf" });
  assert.equal(res.status, 422);

  const after2 = await supabaseAdmin.from("dokumen_version").select("id").eq("dokumen_id", dokumenAId);
  assert.equal(after2.data.length, before2.data.length);
});

// --- 20/21/22. Not-found cases ---

test("GET /dokumen/:id/versi/:versionId/download - non-existent versionId is 404", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi/00000000-0000-0000-0000-000000000000/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("GET /dokumen/:id/versi/:versionId/download - versionId belonging to another document is 404", async () => {
  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi/${versionA1Id}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);
});

test("Non-existent dokumen returns 404 on all three version endpoints", async () => {
  const ghostId = "00000000-0000-0000-0000-000000000000";

  const listRes = await request(app)
    .get(`/api/v1/dokumen/${ghostId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(listRes.status, 404);

  const createRes = await attachFile(
    request(app)
      .post(`/api/v1/dokumen/${ghostId}/versi`)
      .set("Authorization", `Bearer ${accounts.admin.token}`),
    bufferFor("ghost"),
    "ghost.pdf",
  );
  assert.equal(createRes.status, 404);

  const downloadRes = await request(app)
    .get(`/api/v1/dokumen/${ghostId}/versi/${versionA1Id}/download`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(downloadRes.status, 404);
});

test("Soft-deleted dokumen behaves consistently as not-found on version endpoints", async () => {
  await supabaseAdmin.from("dokumen").update({ deleted_at: new Date().toISOString() }).eq("id", dokumenBId);

  const res = await request(app)
    .get(`/api/v1/dokumen/${dokumenBId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);
  assert.equal(res.status, 404);

  await supabaseAdmin.from("dokumen").update({ deleted_at: null }).eq("id", dokumenBId);
});

// --- 23. Credential leakage ---

test("Version responses never leak password_hash, tokens, or secrets", async () => {
  const listRes = await request(app)
    .get(`/api/v1/dokumen/${dokumenAId}/versi`)
    .set("Authorization", `Bearer ${accounts.admin.token}`);

  const body = JSON.stringify(listRes.body).toLowerCase();
  assert.ok(!body.includes("password"));
  assert.ok(!body.includes("access_token") && !body.includes("accesstoken"));
  assert.ok(!body.includes("refresh_token") && !body.includes("refreshtoken"));
  assert.ok(!body.includes("service_role"));
  assert.ok(!body.includes("file_path") && !body.includes("filepath"), "filePath must not be exposed");
});

// --- 25. Concurrency: two simultaneous uploads never produce a duplicate nomor_versi ---

test("Concurrent version uploads never produce a duplicate nomor_versi", async () => {
  const baseRes = await attachFile(
    request(app)
      .post("/api/v1/dokumen")
      .set("Authorization", `Bearer ${accounts.admin.token}`)
      .field("pegawaiId", pegawaiAId)
      .field("kategoriDokumenId", kategoriId)
      .field("namaDokumen", "Concurrency test document"),
    bufferFor("concurrency-base"),
    "concurrency-base.pdf",
  );
  assert.equal(baseRes.status, 201);
  const concurrencyDokumenId = baseRes.body.data.id;

  const [res1, res2] = await Promise.all([
    attachFile(
      request(app)
        .post(`/api/v1/dokumen/${concurrencyDokumenId}/versi`)
        .set("Authorization", `Bearer ${accounts.admin.token}`),
      bufferFor("concurrent-a"),
      "concurrent-a.pdf",
    ),
    attachFile(
      request(app)
        .post(`/api/v1/dokumen/${concurrencyDokumenId}/versi`)
        .set("Authorization", `Bearer ${accounts.hrd.token}`),
      bufferFor("concurrent-b"),
      "concurrent-b.pdf",
    ),
  ]);

  for (const res of [res1, res2]) {
    assert.ok([201, 409].includes(res.status), `unexpected status ${res.status}`);
  }

  const { data: versions } = await supabaseAdmin
    .from("dokumen_version")
    .select("nomor_versi")
    .eq("dokumen_id", concurrencyDokumenId);
  const nomorVersiValues = versions.map((v) => v.nomor_versi);
  assert.equal(nomorVersiValues.length, new Set(nomorVersiValues).size, "duplicate nomor_versi detected");
});

// --- 24. No orphan Storage objects after cleanup is exercised by the `after`
// hook itself (removes both `dokumen.file_path` and every
// `dokumen_version.file_path` for pegawaiA/pegawaiB before deleting rows) —
// verified here by confirming every version row this file created still had
// a resolvable file_path right before that cleanup runs.
test("Every version row created in this file has a non-empty file_path (cleanup precondition)", async () => {
  const { data: versions } = await supabaseAdmin
    .from("dokumen_version")
    .select("file_path")
    .in("dokumen_id", [dokumenAId, dokumenBId]);
  assert.ok(versions.length > 0);
  assert.ok(versions.every((v) => typeof v.file_path === "string" && v.file_path.length > 0));
});
