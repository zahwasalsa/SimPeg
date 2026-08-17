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
  "data": { "id": "uuid", "email": "...", "role": "pegawai", "isActive": true, "lastLogin": "...",
    "createdAt": "...", "pegawaiId": "uuid atau null" }
}
```

`pegawaiId` adalah id baris `pegawai` yang tertaut ke akun ini (`null` jika akun belum punya profil
pegawai) — dipakai frontend untuk memuat/mengedit profil pegawai milik sendiri lewat
`GET/PATCH /pegawai/{pegawaiId}` tanpa round-trip tambahan.

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

Menonaktifkan pegawai (tanpa menyembunyikannya dari daftar) dilakukan lewat `PATCH /pegawai/{id}`
dengan `{ "statusKepegawaian": "nonaktif" }`. `DELETE /pegawai/{id}` adalah aksi terpisah — soft
delete (mengisi `deleted_at`), menyembunyikan baris dari seluruh query yang ada, **admin/hrd only**
(tidak ada self-delete).

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

Partial update.

- **Admin/HRD**: boleh mengubah profil siapa pun, seluruh field.
- **Pegawai/Pimpinan**: boleh mengubah **profil milik sendiri saja** (dicek lewat
  `pegawai.user_id === req.user.id`, sama seperti `GET /pegawai/{id}`), dan **hanya field personal**:
  `jenisKelamin`, `tempatLahir`, `tanggalLahir`, `alamat`, `noTelepon`. Mengirim field organisasi
  (`nip`, `namaLengkap`, `divisiId`, `jabatanId`, `statusKepegawaian`) sebagai self-editor ditolak `403`
  — field tersebut tetap eksklusif admin/HRD karena memengaruhi catatan resmi kepegawaian, bukan data
  pribadi individu.

`userId` **tidak boleh** dikirim di body sama sekali (request langsung ditolak `422` jika ada) — relasi
ke akun Supabase Auth bersifat permanen setelah dibuat.

Request body (semua field opsional, kirim yang ingin diubah saja)

```json
{ "nip": "...", "namaLengkap": "...", "divisiId": "uuid", "statusKepegawaian": "nonaktif" }
```

Response 200 — objek pegawai

Error: `401`, `403` (bukan admin/HRD dan bukan pemilik profil, **atau** self-editor mengirim field
organisasi), `404` pegawai/divisi/jabatan tidak ditemukan, `409` `nip` sudah dipakai pegawai lain,
`422` field tidak valid atau `userId` disertakan

---

## DELETE /pegawai/{id}

**Admin/HRD only** — soft delete (mengisi `deleted_at`), tidak menghapus baris secara permanen dan
tidak mengubah `statusKepegawaian`. Tidak ada guard dependensi (tabel anak seperti `absensi`/`cuti`/
`dokumen` tetap memiliki riwayatnya, hanya tidak lagi bisa dijangkau lewat pegawai yang sudah
disembunyikan ini).

Response 200

```json
{ "success": true, "message": "Pegawai berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan (termasuk jika sudah dihapus sebelumnya),
`422` id bukan UUID

---

# 7. Unit Kerja (Divisi)

Diimplementasikan pada Phase 4 (Master Data). Path aktual `/divisi` (bukan `/work-units`). Seluruh
endpoint memerlukan `Authorization: Bearer <accessToken>`. Membaca (`GET`) terbuka untuk semua role
terautentikasi; menulis (`POST`/`PATCH`/`DELETE`) **admin/HRD only**.

---

## GET /divisi

Query params: `page` (default 1), `limit` (default 10, maks 100), `search` (cocok ke `nama_divisi`,
`ilike`)

Response 200 (format pagination, lihat Bagian 3). Error: `401` tanpa token

---

## GET /divisi/{id}

Response 200

```json
{
  "success": true,
  "message": "Detail divisi",
  "data": { "id": "uuid", "namaDivisi": "...", "deskripsi": null, "createdAt": "...", "updatedAt": "..." }
}
```

Error: `401`, `404` tidak ditemukan, `422` id bukan UUID

---

## POST /divisi

**Admin/HRD only.**

```json
{ "namaDivisi": "Fakultas Teknik", "deskripsi": "opsional" }
```

Response 201 — objek divisi. Error: `401`, `403` bukan admin/HRD, `409` `namaDivisi` sudah terdaftar,
`422` field tidak valid

---

## PATCH /divisi/{id}

**Admin/HRD only.** Body sebagian (`namaDivisi` dan/atau `deskripsi`).

Response 200. Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` `namaDivisi` bentrok,
`422` field tidak valid

---

## DELETE /divisi/{id}

**Admin/HRD only.** Soft delete (mengisi `deleted_at`). **Diblokir `409`** selama masih ada pegawai
(`deleted_at IS NULL`) yang `divisiId`-nya menunjuk ke divisi ini — pindahkan/kosongkan `divisiId`
pegawai tersebut dulu lewat `PATCH /pegawai/{id}` sebelum menghapus divisinya.

Response 200

```json
{ "success": true, "message": "Divisi berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` masih digunakan oleh pegawai,
`422` id bukan UUID

---

# 8. Jabatan

Diimplementasikan pada Phase 4 (Master Data). Path aktual `/jabatan` (bukan `/positions`). Pola
endpoint, permission, dan perilaku delete **identik** dengan Bagian 7 (Divisi) di atas — hanya nama
tabel/kolom yang berbeda (`jabatan`/`nama_jabatan`, guard dependensi lewat `pegawai.jabatan_id`).

---

## GET /jabatan

Query params: `page`, `limit`, `search` (cocok ke `nama_jabatan`, `ilike`)

Response 200 (format pagination). Error: `401` tanpa token

---

## GET /jabatan/{id}

Response 200

```json
{
  "success": true,
  "message": "Detail jabatan",
  "data": { "id": "uuid", "namaJabatan": "...", "deskripsi": null, "createdAt": "...", "updatedAt": "..." }
}
```

Error: `401`, `404` tidak ditemukan, `422` id bukan UUID

---

## POST /jabatan

**Admin/HRD only.**

```json
{ "namaJabatan": "Dosen", "deskripsi": "opsional" }
```

Response 201 — objek jabatan. Error: `401`, `403` bukan admin/HRD, `409` `namaJabatan` sudah
terdaftar, `422` field tidak valid

---

## PATCH /jabatan/{id}

**Admin/HRD only.** Body sebagian. Response 200. Error: `401`, `403` bukan admin/HRD, `404` tidak
ditemukan, `409` `namaJabatan` bentrok, `422` field tidak valid

---

## DELETE /jabatan/{id}

**Admin/HRD only.** Soft delete. **Diblokir `409`** selama masih ada pegawai yang `jabatanId`-nya
menunjuk ke jabatan ini — sama seperti Divisi.

Response 200

```json
{ "success": true, "message": "Jabatan berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` masih digunakan oleh pegawai,
`422` id bukan UUID

---

# 8a. Absensi

Diimplementasikan pada Phase 5 (Absensi Management). Path aktual `/absensi`. Seluruh endpoint memerlukan
`Authorization: Bearer <accessToken>`. Role tidak pernah dicek di Controller — gate akses ada di
`authMiddleware`/`authorize`/`absensi.authorize.js`, scope data (semua vs milik sendiri) diputuskan di
Service.

`:id` pada endpoint di bawah adalah `absensi.id`, bukan `pegawai.id`.

Koreksi data lewat `PATCH`, penghapusan lewat `DELETE` — keduanya **admin/HRD only**, pegawai tidak
punya akses ke keduanya sama sekali (termasuk untuk data miliknya sendiri).

Response tidak pernah menyertakan data dari tabel `users`/`pegawai` di luar `pegawaiId`, apalagi
password/token/secret.

---

## GET /absensi

Query params: `page`, `limit`, `pegawaiId` (UUID, hanya efektif untuk admin/hrd), `tanggal`
(`YYYY-MM-DD`), `status` (`hadir`\|`izin`\|`sakit`\|`alpha`\|`cuti`)

- **Admin/HRD**: melihat seluruh data, `pegawaiId` di query dipakai sebagai filter opsional.
- **Pegawai/Pimpinan**: parameter `pegawaiId` dari query **diabaikan** — hasil selalu otomatis di-scope
  ke pegawai milik akun yang login. Jika akun belum punya profil pegawai (mis. pimpinan tanpa data
  kepegawaian), hasilnya `200` dengan `data: []`, bukan error.

Response 200 — format pagination standar (lihat Bagian 3).

Error: `401` tanpa token

---

## GET /absensi/{id}

**Admin/HRD** bisa lihat siapa pun. **Pegawai/Pimpinan** hanya bisa lihat miliknya sendiri (dicek lewat
`absensi.pegawai_id` yang dicocokkan ke pegawai milik `req.user.id`, bukan perbandingan `:id` langsung).

Response 200

```json
{
  "success": true,
  "message": "Detail absensi",
  "data": {
    "id": "uuid", "pegawaiId": "uuid", "tanggal": "2026-08-07",
    "jamMasuk": "08:00:00", "jamKeluar": "17:00:00", "status": "hadir",
    "keterangan": null, "createdAt": "...", "updatedAt": "..."
  }
}
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` tidak ditemukan, `422` id bukan UUID

---

## POST /absensi

Perilaku **berbeda tergantung role** — endpoint yang sama, semantik berbeda:

### Sebagai admin/HRD (strict create)

`pegawaiId` **wajib** dikirim di body. Selalu murni membuat baris baru.

```json
{ "pegawaiId": "uuid", "tanggal": "2026-08-07", "jamMasuk": "08:00", "status": "hadir" }
```

Response `201`. Error `409` jika kombinasi `pegawaiId` + `tanggal` sudah ada.

### Sebagai pegawai (check-in / check-out)

`pegawaiId` **tidak boleh dikirim sama sekali** — identitas selalu diresolusi backend dari
`req.user.id` (JWT) → dicocokkan ke `pegawai.user_id` miliknya sendiri. Mengirim `pegawaiId` apa pun
(termasuk milik sendiri) akan ditolak `422` — secara desain pegawai **tidak mungkin** membuat absensi
atas nama pegawai lain.

```json
{ "tanggal": "2026-08-07", "jamMasuk": "08:00" }
```

Perilaku berdasarkan state baris `(pegawai_id, tanggal)` hari itu:

| Kondisi saat ini | Aksi | Response |
|---|---|---|
| Belum ada baris | **Check-in** — buat baris baru | `201` |
| Ada baris, `jamKeluar` masih kosong | **Check-out** — update `jamKeluar` (dan field lain yang dikirim) pada baris yang sama | `200` |
| Ada baris, `jamKeluar` sudah terisi | Absensi hari itu sudah lengkap | `409` |

`pimpinan` selalu `403` untuk POST.

Error umum: `401`, `403` (pimpinan, atau `pegawaiId` tanpa role admin/hrd yang valid), `404` (`pegawaiId`
tidak ditemukan — khusus admin/hrd, atau profil pegawai milik sendiri tidak ditemukan — khusus pegawai),
`422` (input tidak valid, `jamKeluar < jamMasuk`, atau `pegawaiId` dikirim oleh role pegawai)

---

## PATCH /absensi/{id}

**Admin/HRD only** — pegawai tidak punya akses sama sekali ke endpoint ini, termasuk untuk data miliknya
sendiri (`403`).

`pegawaiId` **tidak boleh** dikirim di body (immutable, `422` jika ada). Field lain (`tanggal`,
`jamMasuk`, `jamKeluar`, `status`, `keterangan`) boleh diperbarui sebagian.

```json
{ "status": "sakit", "keterangan": "Surat dokter menyusul" }
```

Response 200 — objek absensi.

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` hasil perubahan `tanggal` bentrok
dengan baris lain milik pegawai yang sama, `422` field tidak valid / `jamKeluar < jamMasuk` /
`pegawaiId` disertakan

---

## DELETE /absensi/{id}

**Admin/HRD only** — sama seperti PATCH, pegawai tidak punya akses sama sekali (`403`), termasuk untuk
data miliknya sendiri. Soft delete (mengisi `deleted_at`), tidak ada guard dependensi.

Response 200

```json
{ "success": true, "message": "Absensi berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `422` id bukan UUID

---

# 8b. Cuti

Diimplementasikan pada Phase 6 (Cuti Management). Path aktual `/cuti`. Seluruh endpoint memerlukan
`Authorization: Bearer <accessToken>`. Role tidak pernah dicek di Controller — gate akses ada di
`authMiddleware`/`authorize`/`cuti.authorize.js`, scope data diputuskan di Service.

`:id` pada endpoint di bawah adalah `cuti.id`, bukan `pegawai.id`.

Tidak ada endpoint `PATCH /cuti/{id}` generik. Approve/reject/cancel adalah *state transition* dengan
efek samping spesifik, sehingga masing-masing punya sub-resource sendiri. Cuti yang sudah
`disetujui`/`ditolak` tidak bisa diedit — kalau ada kesalahan, harus mengajukan baru (audit trail tetap
jelas). `DELETE /cuti/{id}` ada, terpisah dari `cancel` — lihat di bawah.

**Fitur saldo/jatah cuti tidak diimplementasikan** — tidak ada kolom/tabel pendukung di schema saat ini.

---

## GET /cuti

Query params: `page`, `limit`, `pegawaiId` (UUID, hanya efektif untuk admin/hrd), `status`
(`diajukan`\|`disetujui`\|`ditolak`\|`dibatalkan`), `jenisCuti`

- **Admin/HRD**: melihat seluruh data, `pegawaiId` sebagai filter opsional.
- **Pegawai/Pimpinan**: `pegawaiId` dari query **diabaikan** — hasil selalu otomatis di-scope ke pegawai
  milik akun yang login. Jika akun belum punya profil pegawai, hasilnya `200` dengan `data: []`.

Response 200 — format pagination standar. Error: `401` tanpa token.

---

## GET /cuti/{id}

**Admin/HRD** bisa lihat siapa pun. **Pegawai/Pimpinan** hanya bisa lihat miliknya sendiri (dicek lewat
`cuti.pegawai_id` yang dicocokkan ke pegawai milik `req.user.id`).

Response 200

```json
{
  "success": true,
  "message": "Detail cuti",
  "data": {
    "id": "uuid", "pegawaiId": "uuid", "jenisCuti": "cuti_tahunan",
    "tanggalMulai": "2026-09-01", "tanggalSelesai": "2026-09-03", "jumlahHari": 3,
    "alasan": null, "status": "diajukan",
    "disetujuiOleh": null, "tanggalPersetujuan": null, "catatanApproval": null,
    "createdAt": "...", "updatedAt": "..."
  }
}
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` tidak ditemukan, `422` id bukan UUID

---

## POST /cuti

Perilaku berbeda tergantung role — endpoint yang sama, sumber identitas berbeda:

- **Admin/HRD**: `pegawaiId` **wajib** dikirim di body — dapat mengajukan atas nama pegawai mana pun.
  Boleh memasukkan tanggal yang sudah lewat (backdated).
- **Pegawai**: `pegawaiId` **tidak boleh dikirim sama sekali** (422 jika ada) — identitas selalu
  diresolusi dari `req.user.id` → `pegawai.user_id` miliknya sendiri. `tanggalMulai` **tidak boleh**
  sebelum hari ini, **kecuali** `jenisCuti = cuti_sakit`.
- **Pimpinan**: selalu `403`.

`jumlahHari` **tidak boleh dikirim** — kolom generated, dihitung otomatis oleh database.

```json
{
  "jenisCuti": "cuti_tahunan",
  "tanggalMulai": "2026-09-01",
  "tanggalSelesai": "2026-09-03",
  "alasan": "Acara keluarga (opsional)"
}
```

Response `201`, status awal selalu `diajukan`.

**Validasi overlap:** ditolak `409` jika pegawai yang sama sudah punya cuti berstatus `diajukan` atau
`disetujui` dengan rentang tanggal yang beririsan. Cuti berstatus `ditolak`/`dibatalkan` tidak dihitung
sebagai konflik — pengajuan baru untuk tanggal yang sama tetap diperbolehkan.

Error: `401`, `403` (pimpinan, atau `pegawaiId` tanpa role admin/hrd), `404` (`pegawaiId` tidak
ditemukan — admin/hrd, atau profil pegawai sendiri tidak ditemukan — pegawai), `409` (tanggal bentrok),
`422` (input tidak valid, `tanggalSelesai < tanggalMulai`, `jumlahHari` dikirim, `pegawaiId` dikirim
oleh pegawai, atau `tanggalMulai` backdated oleh pegawai non-cuti_sakit)

---

## PATCH /cuti/{id}/approve

**Admin/HRD only.** Hanya valid jika status saat ini `diajukan` (409 jika sudah diproses).

Set `status=disetujui`, `disetujuiOleh=<user yang approve>`, `tanggalPersetujuan=<waktu approve>`.

```json
{ "catatanApproval": "Disetujui, kuota tersedia (opsional)" }
```

Response 200. Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` status bukan `diajukan`

---

## PATCH /cuti/{id}/reject

**Admin/HRD only.** `catatanApproval` **wajib diisi** (alasan penolakan) — `422` jika kosong/tidak ada.

```json
{ "catatanApproval": "Bertabrakan dengan jadwal operasional" }
```

Response 200, `status=ditolak`. Error: `401`, `403`, `404`, `409` status bukan `diajukan`,
`422` `catatanApproval` tidak diisi

---

## PATCH /cuti/{id}/cancel

**Admin/HRD** (siapa pun) **atau pegawai pemilik pengajuan** — hanya valid jika status masih `diajukan`.
Pegawai **tidak bisa** membatalkan pengajuan yang sudah `disetujui`/`ditolak`.

Response 200, `status=dibatalkan`.

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` tidak ditemukan, `409` status bukan
`diajukan`, `422` id bukan UUID

---

## DELETE /cuti/{id}

**Admin/HRD only, tidak ada self-service** — berbeda dari `cancel` di atas, `DELETE` **tidak
mensyaratkan status tertentu**: cuti berstatus `diajukan`, `disetujui`, `ditolak`, maupun `dibatalkan`
semuanya bisa dihapus (soft delete, mengisi `deleted_at`). Ini untuk membersihkan data yang keliru
dari daftar, bukan bagian dari alur approval — pegawai yang ingin membatalkan pengajuan yang masih
`diajukan` tetap memakai `PATCH /cuti/{id}/cancel`.

Response 200

```json
{ "success": true, "message": "Data cuti berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `422` id bukan UUID

---

# 9. Dokumen

Diimplementasikan pada Phase 5 (Document Management), Stage 4A + Stage 4B. Path aktual `/dokumen` dan
`/kategori-dokumen` (bukan `/documents`/`/document-categories`). Seluruh endpoint memerlukan
`Authorization: Bearer <accessToken>`. Role tidak pernah dicek di Controller — gate akses ada di
`authMiddleware`/`authorize`/`dokumen.authorize.js`, scope data diputuskan di Service.

`:id` pada endpoint di bawah adalah `dokumen.id`. Tidak ada endpoint `PATCH`/`DELETE` untuk
`dokumen_version` — riwayat versi bersifat immutable, tidak bisa diedit/dihapus lewat API.
`DELETE /dokumen/{id}` **ada** (soft delete pada baris `dokumen` saja) — lihat di bawah. `dokumen` tidak
punya `PATCH` generik, tapi punya dua endpoint state-transition sempit — `PATCH /dokumen/{id}/approve`
dan `PATCH /dokumen/{id}/reject` (FR-DOC-010) — pola yang identik dengan `approve`/`reject` pada Cuti.

Kolom `dokumen.namaFileAsli`/`bucket`/`mimeType`/`ukuranFile` selalu mencerminkan **versi aktif**
(diperbarui otomatis setiap kali versi baru diunggah) — `GET /dokumen`, `GET /dokumen/{id}`, dan
`GET /dokumen/{id}/download` selalu mengacu ke versi terbaru tanpa perlu memanggil endpoint versi.

**Validasi berkas (FR-DOC-007/008)**, berlaku untuk upload dokumen maupun upload versi baru:
tipe yang diizinkan `application/pdf`, `image/jpeg`, `image/png`, `application/msword`,
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`; ukuran maksimum 10MB.

**Approval per kategori (FR-DOC-010).** Apakah sebuah dokumen memerlukan approval ditentukan oleh
`kategoriDokumen.wajibApproval`, bukan oleh siapa yang mengunggah. Dokumen baru pada kategori
`wajibApproval=true` otomatis berstatus `menunggu_persetujuan`; pada kategori lain, `status` tetap
`null` (tidak ada alur approval sama sekali). Mengunggah versi baru (`POST /dokumen/{id}/versi`) pada
dokumen yang kategorinya wajib approval **mereset** `status` kembali ke `menunggu_persetujuan` dan
menghapus `disetujuiOleh`/`tanggalPersetujuan`/`catatanApproval` sebelumnya — versi baru perlu ditinjau
ulang. Dokumen yang sudah ada sebelum kategorinya ditandai wajib approval **tidak** diminta approval
retroaktif (tetap `status: null`).

**Reminder kedaluwarsa (FR-DOC-009).** `dokumen.tanggalKedaluwarsa` opsional saat upload. Query param
`akanKedaluwarsa=true` pada `GET /dokumen` menyaring dokumen yang tanggal kedaluwarsanya sudah lewat
atau akan lewat dalam 30 hari ke depan — dipakai Dashboard untuk kartu/reminder, murni in-app (tidak
ada pengiriman email/notifikasi).

---

## GET /dokumen

Query params: `page`, `limit`, `pegawaiId` (UUID, hanya efektif untuk admin/hrd), `kategoriDokumenId`
(UUID), `status` (`menunggu_persetujuan`\|`disetujui`\|`ditolak`), `akanKedaluwarsa` (`true`/`false`)

- **Admin/HRD**: melihat seluruh data, `pegawaiId` sebagai filter opsional.
- **Pegawai/Pimpinan**: `pegawaiId` dari query **diabaikan** — hasil selalu otomatis di-scope ke pegawai
  milik akun yang login. Jika akun belum punya profil pegawai, hasilnya `200` dengan `data: []`.

Response 200 — format pagination standar. Error: `401` tanpa token.

---

## GET /dokumen/{id}

**Admin/HRD** bisa lihat siapa pun. **Pegawai/Pimpinan** hanya bisa lihat milik sendiri.

Response 200

```json
{
  "success": true,
  "message": "Detail dokumen",
  "data": {
    "id": "uuid", "pegawaiId": "uuid", "kategoriDokumenId": "uuid",
    "namaDokumen": "Ijazah S1", "namaFileAsli": "ijazah.pdf",
    "bucket": "documents", "mimeType": "application/pdf", "ukuranFile": 204800,
    "diunggahOleh": "uuid",
    "status": "menunggu_persetujuan atau disetujui/ditolak/null",
    "disetujuiOleh": "uuid atau null", "tanggalPersetujuan": "... atau null",
    "catatanApproval": "... atau null", "tanggalKedaluwarsa": "YYYY-MM-DD atau null",
    "createdAt": "...", "updatedAt": "..."
  }
}
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` tidak ditemukan (termasuk soft-deleted),
`422` id bukan UUID

---

## GET /dokumen/{id}/download

Query params: `download` (`1`/`true` untuk attachment; tanpa parameter = inline preview)

Menghasilkan signed URL (berlaku 60 detik) ke file **versi aktif**. Permission sama seperti
`GET /dokumen/{id}`.

Response 200: `{ "success": true, "message": "Tautan dokumen", "data": { "url": "...", "expiresIn": 60 } }`

Error: sama seperti `GET /dokumen/{id}`; `502` gagal membuat signed URL.

---

## POST /dokumen

Perilaku berbeda tergantung role — endpoint yang sama, sumber identitas berbeda:

- **Admin/HRD**: `pegawaiId` **wajib** dikirim di body — dapat mengunggah atas nama pegawai mana pun.
- **Pegawai**: `pegawaiId` **tidak boleh dikirim sama sekali** (422 jika ada) — identitas selalu
  diresolusi dari `req.user.id` → `pegawai.user_id` miliknya sendiri.
- **Pimpinan**: selalu `403`.

`multipart/form-data`: `pegawaiId` (UUID, kondisional), `kategoriDokumenId` (UUID, wajib),
`namaDokumen` (string 1–200, wajib), `tanggalKedaluwarsa` (`YYYY-MM-DD`, opsional, FR-DOC-009),
`file` (wajib).

Response `201`. Dokumen baru otomatis membuat `dokumen_version` nomor 1 (`versiAktif=1`) — jika
langkah ini gagal, dokumen tetap berhasil dibuat (di-log, tidak menggagalkan permintaan) karena tidak
ada transaction lintas tabel di implementasi saat ini. `status` awal ditentukan otomatis dari
`kategoriDokumen.wajibApproval` (lihat catatan approval di atas) — tidak bisa dikirim manual di body.

Error: `401`, `403` (pimpinan, atau `pegawaiId` tanpa role admin/hrd), `404` (`pegawaiId`/
`kategoriDokumenId` tidak ditemukan), `422` (field tidak valid, tipe berkas tidak didukung, berkas
kosong, `tanggalKedaluwarsa` bukan tanggal valid, atau `pegawaiId` dikirim oleh pegawai), `422` ukuran
berkas >10MB

---

## PATCH /dokumen/{id}/approve

*(FR-DOC-010)* **Admin/HRD only**, tidak ada self-service. Hanya valid jika `status` saat ini
`menunggu_persetujuan` — `409` jika dokumen tidak memerlukan approval sama sekali (`status: null`)
maupun jika sudah pernah diputuskan sebelumnya.

Set `status=disetujui`, `disetujuiOleh=<user yang approve>`, `tanggalPersetujuan=<waktu approve>`.

```json
{ "catatanApproval": "Lengkap dan sesuai (opsional)" }
```

Response 200 — objek dokumen. Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` status
bukan `menunggu_persetujuan` (termasuk `null`), `422` id bukan UUID

---

## PATCH /dokumen/{id}/reject

*(FR-DOC-010)* **Admin/HRD only.** `catatanApproval` **wajib diisi** (alasan penolakan) — sama seperti
`PATCH /cuti/{id}/reject`.

```json
{ "catatanApproval": "Berkas kurang jelas, mohon unggah ulang" }
```

Response 200, `status=ditolak`. Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` status
bukan `menunggu_persetujuan`, `422` `catatanApproval` tidak diisi / id bukan UUID

---

## DELETE /dokumen/{id}

**Admin/HRD atau pegawai pemilik dokumen** (sama seperti `GET /dokumen/{id}`/`download`, dicek lewat
`dokumen.pegawai_id`). Soft delete **hanya pada baris `dokumen`** — berkas di Supabase Storage dan
seluruh riwayat `dokumen_version` **tidak ikut terhapus**, tetap dapat dipulihkan lewat akses database
langsung kalau diperlukan.

Response 200

```json
{ "success": true, "message": "Dokumen berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` tidak ditemukan, `422` id bukan UUID

---

## GET /dokumen/{id}/versi

*(Stage 4B — FR-DOC-005)* Riwayat seluruh versi dokumen, urut `nomorVersi` terbaru → terlama.

Query params: `page`, `limit`. Permission sama seperti `GET /dokumen/{id}`.

Response 200

```json
{
  "success": true,
  "message": "Riwayat versi dokumen",
  "data": [
    { "id": "uuid", "dokumenId": "uuid", "nomorVersi": 2, "namaFileAsli": "ijazah_v2.pdf",
      "bucket": "documents", "mimeType": "application/pdf", "ukuranFile": 204800,
      "diunggahOleh": "uuid", "createdAt": "...", "updatedAt": "..." }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 2, "total_pages": 1 }
}
```

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` dokumen tidak ditemukan (termasuk
soft-deleted), `422` id bukan UUID

---

## POST /dokumen/{id}/versi

*(Stage 4B — FR-DOC-004)* Mengunggah versi baru untuk dokumen yang sudah ada. Tidak menghapus versi
sebelumnya — file lama tetap tersimpan permanen di Supabase Storage.

- **Admin/HRD**: boleh mengunggah versi baru untuk dokumen milik pegawai mana pun.
- **Pegawai**: hanya untuk dokumen miliknya sendiri (403 jika bukan pemilik).
- **Pimpinan**: selalu `403` — tidak boleh mengunggah versi, sama seperti `POST /dokumen`.

`multipart/form-data`: `file` (wajib). Tidak ada field lain — `namaDokumen`/`kategoriDokumenId` melekat
pada dokumen induk, bukan per-versi.

Nomor versi dihitung otomatis (`MAX(nomorVersi)+1`). Setelah tersimpan, `dokumen.versiAktif` dan kolom
metadata mirror pada `dokumen` diperbarui mengikuti versi baru ini.

Response `201`

```json
{
  "success": true,
  "message": "Versi baru dokumen berhasil diunggah",
  "data": { "id": "uuid", "dokumenId": "uuid", "nomorVersi": 3, "namaFileAsli": "ijazah_v3.pdf",
    "bucket": "documents", "mimeType": "application/pdf", "ukuranFile": 204800,
    "diunggahOleh": "uuid", "createdAt": "..." }
}
```

Error: `401`, `403` (pimpinan, atau pegawai bukan pemilik dokumen), `404` dokumen tidak ditemukan,
`422` (berkas kosong, tipe tidak didukung, atau >10MB), `409` tabrakan nomor versi akibat dua upload
bersamaan (retryable), `502` gagal mengunggah ke Storage

---

## GET /dokumen/{id}/versi/{versionId}/download

*(Stage 4B — FR-DOC-002/003 diterapkan ke versi tertentu)* Signed URL untuk versi tertentu, termasuk
versi lama yang bukan versi aktif.

Query params: `download` (sama seperti `GET /dokumen/{id}/download`). `versionId` wajib benar-benar
milik `dokumen.id` pada URL yang sama — jika tidak, diperlakukan sebagai `404` (tidak membocorkan
keberadaan versi milik dokumen lain). Permission sama seperti `GET /dokumen/{id}`.

Response 200: `{ "success": true, "message": "Tautan versi dokumen", "data": { "url": "...", "expiresIn": 60 } }`

Error: `401`, `403` bukan admin/HRD dan bukan pemilik, `404` dokumen tidak ditemukan atau versi tidak
ditemukan/tidak cocok dengan dokumen, `422` id/versionId bukan UUID, `502` gagal membuat signed URL

---

## GET /kategori-dokumen

Query params: `page`, `limit`, `search`. Terbuka untuk seluruh role (view-only untuk pegawai/pimpinan).

Response 200 — format pagination standar.

---

## GET /kategori-dokumen/{id}

Response 200: `{ "id", "namaKategori", "deskripsi", "wajibApproval", "createdAt", "updatedAt" }`. Error:
`404`, `422` id bukan UUID.

---

## POST /kategori-dokumen

**Admin/HRD only.** Body:
`{ "namaKategori": "...", "deskripsi": "... (opsional)", "wajibApproval": false (opsional, default false) }`.
`wajibApproval` menentukan apakah dokumen pada kategori ini memerlukan approval admin/HRD sebelum
"berlaku" (FR-DOC-010) — lihat catatan di Bagian 9.

Response `201`. Error: `401`, `403` bukan admin/HRD, `409` `namaKategori` sudah dipakai, `422` field
tidak valid (termasuk `wajibApproval` bukan boolean).

---

## PATCH /kategori-dokumen/{id}

**Admin/HRD only.** Body sebagian (`namaKategori`, `deskripsi`, dan/atau `wajibApproval`).

Response `200`. Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` `namaKategori`
bentrok, `422` field tidak valid (termasuk `wajibApproval` bukan boolean).

---

## DELETE /kategori-dokumen/{id}

**Admin/HRD only.** Soft delete. **Diblokir `409`** selama masih ada dokumen (`deleted_at IS NULL`)
yang `kategoriDokumenId`-nya menunjuk ke kategori ini.

Response 200

```json
{ "success": true, "message": "Kategori dokumen berhasil dihapus", "data": null }
```

Error: `401`, `403` bukan admin/HRD, `404` tidak ditemukan, `409` masih digunakan oleh dokumen,
`422` id bukan UUID

---

# 10. Roadmap Karier

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

# 11. Penelitian

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

# 12. Sertifikasi

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

# 13. Pelatihan

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

# 14. Layanan Administrasi

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

# 15. Approval

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

# 16. Sertifikasi & Pelatihan Reminder

GET

/reminders

---

GET

/reminders/documents

---

GET

/reminders/certifications

---

# 17. Notification

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

# 18. Activity Logs

GET

/activity-logs

Administrator only

---

GET

/activity-logs/{id}

---

# 19. Users

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

## DELETE /users/{id}

**Admin only.** Soft delete (mengisi `deleted_at`) — baris `public.users` langsung tidak lolos lookup
`authMiddleware` pada request berikutnya (`401 Akun pengguna tidak ditemukan`), jadi efeknya setara
menonaktifkan permanen, terlepas dari status `isActive` saat ini. **Menghapus akun sendiri ditolak
`400`** (beda dari `PATCH .../status` yang mengizinkan self-deactivate dengan peringatan) — mencegah
admin tidak sengaja mengunci diri sendiri tanpa jalan kembali lewat UI.

Response 200

```json
{ "success": true, "message": "User berhasil dihapus", "data": null }
```

Error: `400` mencoba menghapus akun sendiri, `401`, `403` bukan admin, `404` tidak ditemukan,
`422` id bukan UUID

---

# 20. Roles

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

# 21. Permissions

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

# 22. Master Data

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

# 23. Upload Rules

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

# 24. Authentication Rules

Public Endpoint

/auth/login

Private Endpoint

Semua endpoint selain login.

Authorization Header

Bearer <access_token>

---

# 25. HTTP Status

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

# 26. API Versioning

Semua endpoint menggunakan

/api/v1/

Perubahan breaking change menggunakan

/api/v2/

---

# 27. Error Code

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

SRV001

Pengajuan Tidak Ditemukan

NOTIF001

Notifikasi Tidak Ditemukan

---

# 28. API Documentation

Seluruh endpoint harus didokumentasikan menggunakan

OpenAPI 3.1

Swagger UI

Perubahan endpoint wajib memperbarui dokumentasi.

---

# 29. Definition of Done

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