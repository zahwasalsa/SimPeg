# API Specification
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 1.0

Status : Active

Base URL

/api/v1

---

# 1. Tujuan

Dokumen ini mendefinisikan seluruh REST API yang digunakan oleh sistem.

Seluruh komunikasi antara frontend dan backend wajib menggunakan endpoint yang terdokumentasi pada dokumen ini.

Perubahan endpoint harus memperbarui dokumen ini.

---

# 2. General Rules

Protocol

HTTPS

Format

JSON

Authentication

Bearer Token (JWT)

Response Type

application/json

Timezone

UTC

Encoding

UTF-8

---

# 3. Response Format

Success

{
    "success": true,
    "message": "",
    "data": {}
}

Error

{
    "success": false,
    "message": "",
    "errors": {}
}

Pagination

{
    "success": true,
    "message": "",
    "data": [],
    "pagination": {
        "page": 1,
        "limit": 10,
        "total": 100,
        "total_pages": 10
    }
}

---

# 4. Authentication

Diimplementasikan pada Phase 1. Autentikasi menggunakan **Supabase Auth (GoTrue)** sebagai sistem utama —
bukan JWT custom yang ditandatangani backend sendiri. Backend memvalidasi token lewat Supabase Auth API
pada setiap request, lalu mencocokkan `auth.users.id` dengan baris `public.users` untuk mengambil `role`.

Password **tidak pernah** disimpan atau di-hash sendiri oleh backend — sepenuhnya dikelola Supabase Auth
di tabel internal `auth.users`. Kolom `public.users.password_hash` tidak lagi digunakan (nullable, selalu
`NULL` untuk akun baru).

Setiap akun baru (`/auth/register`) selalu dibuat dengan role `pegawai`. Role `admin`/`hrd`/`pimpinan`
hanya bisa diberikan melalui perubahan data manual/administratif — belum ada endpoint publik untuk itu.

---

## POST /auth/register

Registrasi akun baru. Selalu dibuat dengan role `pegawai`.

Request body

```json
{
  "email": "pegawai@kampus.ac.id",
  "password": "minimal8karakter"
}
```

Response 201

```json
{
  "success": true,
  "message": "Registrasi berhasil",
  "data": {
    "id": "uuid",
    "email": "pegawai@kampus.ac.id",
    "role": "pegawai",
    "isActive": true,
    "lastLogin": null,
    "createdAt": "2026-08-07T10:17:07.398194+00:00"
  }
}
```

Error

- `422` — email tidak valid / password kurang dari 8 karakter
- `409` — email sudah terdaftar

---

## POST /auth/login

Request body

```json
{
  "email": "pegawai@kampus.ac.id",
  "password": "minimal8karakter"
}
```

Response 200

```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "user": { "id": "uuid", "email": "...", "role": "pegawai", "isActive": true, "lastLogin": "...", "createdAt": "..." },
    "session": {
      "accessToken": "eyJ...",
      "refreshToken": "...",
      "expiresAt": 1786101438,
      "expiresIn": 3600,
      "tokenType": "bearer"
    }
  }
}
```

`accessToken` dipakai sebagai `Authorization: Bearer <accessToken>` pada endpoint privat. Default masa
berlaku access token mengikuti konfigurasi Supabase Auth project (umumnya 3600 detik).

Error

- `422` — input tidak valid
- `401` — email atau password salah
- `403` — akun dinonaktifkan (`is_active = false`)

---

## POST /auth/logout

Memerlukan header `Authorization: Bearer <accessToken>`. Mencabut (revoke) access token yang sedang
dipakai di sisi Supabase Auth — token tidak bisa dipakai lagi setelah ini walau belum kedaluwarsa.

Response 200

```json
{ "success": true, "message": "Logout berhasil", "data": {} }
```

Error

- `401` — token tidak ada / tidak valid

---

## GET /auth/me

Memerlukan header `Authorization: Bearer <accessToken>`. Mengembalikan profil pengguna yang sedang login.

Response 200

```json
{
  "success": true,
  "message": "OK",
  "data": { "id": "uuid", "email": "...", "role": "pegawai", "isActive": true, "lastLogin": "...", "createdAt": "..." }
}
```

Error

- `401` — token tidak ada, tidak valid, kedaluwarsa, atau akun tidak ditemukan
- `403` — akun dinonaktifkan

---

## POST /auth/refresh

Menukar refresh token dengan access token baru (dipakai saat access token kedaluwarsa).

Request body

```json
{ "refreshToken": "..." }
```

Response 200 — format sama persis dengan field `session` pada `/auth/login`.

Error

- `422` — `refreshToken` tidak dikirim
- `401` — refresh token tidak valid / kedaluwarsa

---

# 5. Dashboard

GET

/dashboard

Dashboard Summary

---

GET

/dashboard/activity

Recent Activity

---

GET

/dashboard/reminders

Reminder

---

GET

/dashboard/statistics

Dashboard Statistics

---

# 6. Pegawai

Diimplementasikan pada Phase 3 (Employee Management). Path aktual adalah `/pegawai` (bukan `/employees`
seperti draft awal) — mengikuti nama tabel `public.pegawai` sesuai konvensi yang sudah dipakai di seluruh
project (lihat catatan penamaan Indonesia di Bagian 20). Seluruh endpoint memerlukan
`Authorization: Bearer <accessToken>` dan diproteksi middleware — role tidak pernah dicek di Controller.

`:id` pada endpoint di bawah adalah `pegawai.id` (primary key tabel `pegawai`), **bukan** `users.id`.

Tidak ada endpoint `DELETE /pegawai/{id}`. Menonaktifkan pegawai dilakukan lewat
`PATCH /pegawai/{id}` dengan `{ "statusKepegawaian": "nonaktif" }`, memakai kolom yang sudah ada —
tidak ada penghapusan data maupun perubahan skema.

Response tidak pernah menyertakan data dari tabel `users` (email, password_hash, dll).

---

## GET /pegawai

Daftar pegawai. **Admin dan HRD only.**

Query params: `page` (default 1), `limit` (default 10, maks 100), `search` (cocok ke `nip`/`nama_lengkap`,
`ilike`), `divisiId` (UUID), `jabatanId` (UUID), `status` (`aktif`\|`nonaktif`\|`pensiun`)

Response 200 (format pagination, lihat Bagian 3)

Error: `401` tanpa token, `403` role pegawai/pimpinan

---

## GET /pegawai/{id}

Detail pegawai. **Admin dan HRD bisa lihat siapa saja. Role lain (termasuk pegawai/pimpinan) hanya bisa
lihat profil miliknya sendiri** (dicek lewat `pegawai.user_id === req.user.id`, bukan perbandingan `:id`
langsung — lihat middleware khusus `pegawai.authorize.js`).

Response 200

```json
{
  "success": true,
  "message": "Detail pegawai",
  "data": {
    "id": "uuid", "userId": "uuid", "divisiId": null, "jabatanId": null,
    "nip": "...", "namaLengkap": "...", "jenisKelamin": "Laki-laki",
    "tempatLahir": null, "tanggalLahir": null, "alamat": null, "noTelepon": null,
    "tanggalMasuk": null, "statusKepegawaian": "aktif",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik profil, `404` tidak ditemukan, `422` id bukan UUID

---

## POST /pegawai

Membuat profil pegawai untuk akun Supabase Auth yang **sudah ada** (dibuat lewat `POST /auth/register`).
**Admin dan HRD only.** Endpoint ini **tidak pernah** membuat akun Supabase Auth baru — hanya
menghubungkan `userId` yang sudah ada ke data kepegawaian.

Request body

```json
{
  "userId": "uuid",
  "nip": "1234567890",
  "namaLengkap": "Nama Pegawai",
  "divisiId": "uuid (opsional)",
  "jabatanId": "uuid (opsional)",
  "jenisKelamin": "Laki-laki (opsional)",
  "tempatLahir": "opsional",
  "tanggalLahir": "YYYY-MM-DD (opsional)",
  "alamat": "opsional",
  "noTelepon": "opsional",
  "tanggalMasuk": "YYYY-MM-DD (opsional)",
  "statusKepegawaian": "aktif (opsional, default aktif)"
}
```

Response 201 — objek pegawai (format sama seperti GET /pegawai/{id})

Error

- `422` — input tidak valid
- `401` / `403` — bukan admin/HRD
- `404` — `userId`, `divisiId`, atau `jabatanId` tidak ditemukan
- `409` — `userId` sudah punya profil pegawai, atau `nip` sudah terdaftar

---

## PATCH /pegawai/{id}

Partial update. **Admin dan HRD only** — tidak ada self-service update, bahkan untuk profil sendiri.

`userId` **tidak boleh** dikirim di body sama sekali (request langsung ditolak `422` jika ada) — relasi
ke akun Supabase Auth bersifat permanen setelah dibuat. Field lain (termasuk `nip`, untuk koreksi data)
boleh diperbarui sebagian.

Request body (semua field opsional, kirim yang ingin diubah saja)

```json
{ "nip": "...", "namaLengkap": "...", "divisiId": "uuid", "statusKepegawaian": "nonaktif" }
```

Response 200 — objek pegawai

Error: `401`, `403` bukan admin/HRD, `404` pegawai/divisi/jabatan tidak ditemukan, `409` `nip` sudah
dipakai pegawai lain, `422` field tidak valid atau `userId` disertakan

---

# 7. Unit Kerja

GET

/work-units

---

POST

/work-units

---

PUT

/work-units/{id}

---

DELETE

/work-units/{id}

---

# 8. Jabatan

GET

/positions

---

POST

/positions

---

PUT

/positions/{id}

---

DELETE

/positions/{id}

---

# 9. Dokumen

GET

/documents

Daftar Dokumen

---

GET

/documents/{id}

Detail Dokumen

---

POST

/documents

Upload Dokumen

---

PUT

/documents/{id}

Update Metadata

---

DELETE

/documents/{id}

Soft Delete

---

GET

/documents/{id}/versions

Riwayat Versi

---

POST

/documents/{id}/versions

Upload Versi Baru

---

GET

/document-categories

Kategori Dokumen

---

# 10. KPI

GET

/kpis

---

GET

/kpis/{id}

---

POST

/kpis

---

PUT

/kpis/{id}

---

DELETE

/kpis/{id}

---

GET

/kpis/{id}/progress

---

POST

/kpis/{id}/progress

---

# 11. Roadmap Karier

GET

/career-roadmaps

---

GET

/career-roadmaps/{id}

---

POST

/career-roadmaps

---

PUT

/career-roadmaps/{id}

---

DELETE

/career-roadmaps/{id}

---

# 12. Penelitian

GET

/research

---

GET

/research/{id}

---

POST

/research

---

PUT

/research/{id}

---

DELETE

/research/{id}

---

GET

/research/{id}/publications

---

POST

/research/{id}/publications

---

GET

/research/{id}/intellectual-properties

---

POST

/research/{id}/intellectual-properties

---

# 13. Sertifikasi

GET

/certifications

---

GET

/certifications/{id}

---

POST

/certifications

---

PUT

/certifications/{id}

---

DELETE

/certifications/{id}

---

# 14. Pelatihan

GET

/trainings

---

GET

/trainings/{id}

---

POST

/trainings

---

PUT

/trainings/{id}

---

DELETE

/trainings/{id}

---

# 15. Layanan Administrasi

GET

/services

Jenis layanan

---

POST

/service-requests

Ajukan layanan

---

GET

/service-requests

Daftar Pengajuan

---

GET

/service-requests/{id}

Detail Pengajuan

---

PUT

/service-requests/{id}

Update Pengajuan

---

DELETE

/service-requests/{id}

Batalkan Pengajuan

---

# 16. Approval

GET

/approvals

---

GET

/approvals/{id}

---

PUT

/approvals/{id}/approve

Approve

---

PUT

/approvals/{id}/reject

Reject

---

# 17. Sertifikasi & Pelatihan Reminder

GET

/reminders

---

GET

/reminders/documents

---

GET

/reminders/certifications

---

# 18. Notification

GET

/notifications

---

PUT

/notifications/{id}/read

---

PUT

/notifications/read-all

---

DELETE

/notifications/{id}

---

# 19. Activity Logs

GET

/activity-logs

Administrator only

---

GET

/activity-logs/{id}

---

# 20. Users

Diimplementasikan pada Phase 2 (Role & User Management). Seluruh endpoint memerlukan
`Authorization: Bearer <accessToken>` (`authMiddleware`) dan diproteksi `authorize`/`authorizeSelfOrRoles`
middleware — role tidak pernah dicek langsung di Controller.

Tidak ada endpoint `POST /users` (pembuatan akun hanya lewat `/auth/register`, selalu role `pegawai`) dan
tidak ada endpoint `DELETE /users/{id}` (admin tidak diperbolehkan menghapus akun secara sembarangan —
gunakan `PATCH /users/{id}/status` untuk menonaktifkan).

Response tidak pernah menyertakan `password_hash`, access token, refresh token, atau secret apa pun.

Modul CRUD untuk tabel `pegawai` (dikelola HRD) **belum diimplementasikan** — direncanakan pada phase
terpisah.

---

## GET /users

Daftar user. **Admin only.**

Query params: `page` (default 1), `limit` (default 10, maksimal 100)

Response 200 (format pagination, lihat Bagian 3)

```json
{
  "success": true,
  "message": "Daftar user",
  "data": [
    { "id": "uuid", "email": "...", "role": "admin", "isActive": true, "lastLogin": "...", "createdAt": "...", "updatedAt": "..." }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5, "total_pages": 1 }
}
```

Error: `401` tanpa token, `403` bukan admin

---

## GET /users/{id}

Detail user. **Admin bisa lihat siapa saja. Role lain hanya bisa lihat dirinya sendiri**
(`authorizeSelfOrRoles`).

Response 200

```json
{
  "success": true,
  "message": "Detail user",
  "data": { "id": "uuid", "email": "...", "role": "pegawai", "isActive": true, "lastLogin": "...", "createdAt": "...", "updatedAt": "..." }
}
```

Error: `401` tanpa token, `403` bukan admin dan bukan `{id}` milik sendiri, `404` tidak ditemukan,
`422` `{id}` bukan UUID valid

---

## PATCH /users/{id}/role

Mengubah role user. **Admin only** — tidak ada jalur self-service, sehingga pegawai tidak mungkin
mengubah role dirinya sendiri.

Request body

```json
{ "role": "hrd" }
```

`role` harus salah satu dari: `admin`, `hrd`, `pegawai`, `pimpinan`.

Response 200 — objek user (format sama seperti GET /users/{id})

Error: `401`, `403` bukan admin, `404` tidak ditemukan, `422` role tidak valid / id bukan UUID

---

## PATCH /users/{id}/status

Mengaktifkan/menonaktifkan user. **Admin only.**

Request body

```json
{ "isActive": false }
```

Response 200 — objek user

Error: `401`, `403` bukan admin, `404` tidak ditemukan, `422` `isActive` bukan boolean / id bukan UUID

---

# 21. Roles

GET

/roles

---

POST

/roles

---

PUT

/roles/{id}

---

DELETE

/roles/{id}

---

# 22. Permissions

GET

/permissions

---

POST

/permissions

---

PUT

/permissions/{id}

---

DELETE

/permissions/{id}

---

# 23. Master Data

GET

/master/document-categories

---

GET

/master/work-units

---

GET

/master/positions

---

GET

/master/employment-status

---

GET

/master/certification-types

---

GET

/master/training-types

---

# 24. Upload Rules

Content-Type

multipart/form-data

Supported

PDF

DOC

DOCX

PNG

JPG

JPEG

Maximum Size

Ditentukan pada konfigurasi backend

Storage

Supabase Storage

---

# 25. Authentication Rules

Public Endpoint

/auth/login

Private Endpoint

Semua endpoint selain login.

Authorization Header

Bearer <access_token>

---

# 26. HTTP Status

200 OK

201 Created

204 No Content

400 Bad Request

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Validation Error

500 Internal Server Error

---

# 27. API Versioning

Semua endpoint menggunakan

/api/v1/

Perubahan breaking change menggunakan

/api/v2/

---

# 28. Error Code

AUTH001

Token Invalid

AUTH002

Token Expired

AUTH003

Unauthorized

EMP001

Pegawai Tidak Ditemukan

DOC001

Dokumen Tidak Ditemukan

KPI001

KPI Tidak Ditemukan

SRV001

Pengajuan Tidak Ditemukan

NOTIF001

Notifikasi Tidak Ditemukan

---

# 29. API Documentation

Seluruh endpoint harus didokumentasikan menggunakan

OpenAPI 3.1

Swagger UI

Perubahan endpoint wajib memperbarui dokumentasi.

---

# 30. Definition of Done

Sebuah endpoint dianggap selesai apabila:

✔ Endpoint tersedia

✔ Request tervalidasi

✔ Response sesuai standar

✔ Error handling tersedia

✔ Authorization tersedia

✔ Logging tersedia

✔ Swagger diperbarui

✔ Unit Test lulus

✔ Integration Test lulus