# Project Rules
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 1.0
Status  : Active
Last Update : August 2026

---

# 1. Tujuan Dokumen

Dokumen ini menjadi pedoman utama seluruh proses pengembangan aplikasi.

Semua implementasi backend, frontend, database, API, dan deployment WAJIB mengikuti aturan pada dokumen ini.

Blueprint Sistem menjadi sumber kebutuhan bisnis (Business Requirement), sedangkan dokumen ini menjadi sumber aturan teknis (Technical Rules).

Tidak diperbolehkan membuat implementasi yang bertentangan dengan dokumen ini tanpa persetujuan project owner.

---

# 2. Technology Stack

Backend
- Node.js
- Express.js

Database
- PostgreSQL (Supabase)

Authentication
- JWT Authentication
- Role Based Access Control (RBAC)

Storage
- Supabase Storage

Frontend
- HTML5
- CSS3
- Bootstrap 5
- Vanilla JavaScript (ES6)

Version Control
- Git

Package Manager
- npm

Deployment
- Backend : Railway / VPS
- Database : Supabase

---

# 3. Development Principles

Project menggunakan arsitektur modular.

Business Logic TIDAK boleh berada di Controller.

Seluruh akses database hanya dilakukan melalui Repository Layer.

Controller hanya menerima request dan mengembalikan response.

Service bertanggung jawab terhadap seluruh business logic.

Repository hanya berkomunikasi dengan database.

Tidak diperbolehkan query database langsung di Controller.

---

# 4. Architecture Pattern

Project menggunakan pola:

Request

↓

Route

↓

Middleware

↓

Controller

↓

Service

↓

Repository

↓

Supabase PostgreSQL

↓

Response

Semua module wajib mengikuti pola tersebut.

---

# 5. Folder Rules

Setiap module wajib dipisahkan berdasarkan tanggung jawab.

Tidak diperbolehkan membuat file di root project selain file konfigurasi.

Semua fitur baru harus mengikuti struktur folder yang telah ditentukan.

---

# 6. Database Rules

Seluruh database menggunakan PostgreSQL pada Supabase.

Tidak diperbolehkan membuat tabel secara manual melalui Dashboard Supabase.

Semua perubahan database dilakukan menggunakan migration SQL.

Seluruh tabel wajib memiliki:

- id
- created_at
- updated_at

Apabila diperlukan:

- deleted_at (Soft Delete)

Foreign Key wajib digunakan apabila terdapat relasi.

Tidak diperbolehkan menyimpan data yang sama pada dua tabel berbeda tanpa alasan yang jelas.

---

# 7. Naming Convention

Table

snake_case

Contoh

pegawai

unit_kerja

roadmap_penelitian

Column

snake_case

Contoh

full_name

birth_date

created_at

API

kebab-case

Contoh

/api/master-data

/api/user-profile

Variable

camelCase

Function

camelCase

Class

PascalCase

File

camelCase.js

---

# 8. Coding Rules

Gunakan async/await.

Tidak menggunakan callback.

Gunakan try-catch pada seluruh asynchronous process.

Tidak menggunakan nested callback.

Tidak menggunakan any apabila tidak diperlukan.

Semua function maksimal memiliki satu tanggung jawab (Single Responsibility Principle).

---

# 9. Error Handling

Seluruh error harus memiliki format yang sama.

Response Error

{
    "success": false,
    "message": "",
    "errors": null
}

Response Success

{
    "success": true,
    "message": "",
    "data": {}
}

HTTP Status wajib mengikuti REST API Standard.

---

# 10. Validation Rules

Semua input wajib divalidasi.

Validation dilakukan sebelum masuk Service.

Tidak diperbolehkan menyimpan data yang belum lolos validasi.

Gunakan Validator Middleware.

---

# 11. Authentication Rules

Login menggunakan JWT.

Endpoint tertentu wajib menggunakan middleware authentication.

Seluruh endpoint private harus memvalidasi token.

---

# 12. Authorization Rules

Menggunakan Role Based Access Control.

Role:

Administrator

Bagian SDM

Dosen

Tenaga Kependidikan

Pimpinan

Role tidak boleh dicek langsung di Controller.

Gunakan Authorization Middleware.

---

# 13. API Rules

Semua endpoint menggunakan REST API.

Format JSON.

Versioning

/api/v1/

Contoh

GET /api/v1/pegawai

POST /api/v1/pegawai

PUT /api/v1/pegawai/:id

DELETE /api/v1/pegawai/:id

---

# 14. Storage Rules

Seluruh dokumen disimpan pada Supabase Storage.

Database hanya menyimpan metadata.

Database tidak menyimpan file binary.

---

# 15. Security Rules

Password wajib di-hash menggunakan bcrypt.

JWT Secret tidak boleh di-hardcode.

Gunakan environment variable.

Jangan pernah menyimpan credential di repository Git.

Seluruh endpoint menggunakan HTTPS.

---

# 16. Logging

Semua aktivitas penting dicatat.

Minimal:

Login

Logout

Upload Dokumen

Approval

Delete Data

Update Data

Error

---

# 17. Git Rules

Branch utama

main

Development

development

Fitur baru

feature/nama-fitur

Bug

bugfix/nama-bug

---

# 18. Documentation Rules

Setiap module harus memiliki:

- API
- Database
- Business Flow

Perubahan struktur database harus memperbarui:

database.md

Perubahan endpoint harus memperbarui:

api.md

---

# 19. AI Development Rules

Claude digunakan sebagai AI Software Engineer.

Claude WAJIB membaca dokumen berikut sebelum membuat kode:

1. Blueprint
2. project_rules.md
3. architecture.md
4. database.md
5. api.md
6. coding_standard.md

Claude tidak diperbolehkan:

- Mengubah struktur folder
- Mengubah struktur database
- Membuat endpoint baru tanpa dokumentasi
- Mengubah flow bisnis
- Menghapus komentar penting
- Mengganti stack teknologi

Jika membutuhkan perubahan arsitektur, Claude harus memberikan alasan terlebih dahulu sebelum mengimplementasikan perubahan.

---

# 20. Definition of Done

Sebuah fitur dianggap selesai apabila:

✔ Requirement sesuai Blueprint

✔ Database sudah sesuai

✔ API selesai

✔ Validasi selesai

✔ Error handling selesai

✔ Authorization selesai

✔ Logging selesai

✔ Dokumentasi diperbarui

✔ Tidak ada warning

✔ Tidak ada error

✔ Siap untuk testing