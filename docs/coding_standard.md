# Coding Standard
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 1.0

Status : Active

---

# 1. Tujuan

Dokumen ini mendefinisikan standar penulisan kode yang wajib diikuti oleh seluruh developer dan AI Assistant selama proses pengembangan.

Tujuan utama:

- Konsistensi kode
- Kemudahan maintenance
- Kemudahan debugging
- Mempermudah code review
- Mengurangi technical debt

---

# 2. Bahasa Pemrograman

Backend

Node.js

ES2022

Frontend

JavaScript ES6

Tidak diperbolehkan menggunakan syntax yang sudah deprecated.

---

# 3. General Principles

Seluruh kode wajib mengikuti prinsip:

- SOLID
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)
- Separation of Concerns
- Single Responsibility Principle
- Clean Code

---

# 4. File Naming

Gunakan camelCase.

Contoh

pegawaiController.js

pegawaiService.js

pegawaiRepository.js

pegawaiValidation.js

authMiddleware.js

responseHelper.js

Tidak menggunakan spasi.

Tidak menggunakan huruf kapital di awal file.

---

# 5. Folder Naming

Gunakan lowercase.

Contoh

controllers

services

repositories

middlewares

helpers

utils

---

# 6. Variable Naming

Gunakan camelCase.

Benar

employeeName

unitKerjaId

createdAt

Salah

EmployeeName

employee_name

EMPLOYEE_NAME

---

# 7. Function Naming

Gunakan kata kerja.

Contoh

getEmployee()

createEmployee()

updateEmployee()

deleteEmployee()

validateDocument()

sendNotification()

Jangan menggunakan nama umum seperti:

process()

handle()

execute()

doSomething()

---

# 8. Class Naming

Gunakan PascalCase.

Contoh

PegawaiService

DocumentRepository

NotificationService

---

# 9. Constant Naming

Gunakan UPPER_SNAKE_CASE.

Contoh

MAX_FILE_SIZE

JWT_EXPIRES

DEFAULT_PAGE_SIZE

---

# 10. Comment Rules

Komentar digunakan untuk menjelaskan alasan (why), bukan menjelaskan kode (what).

Benar

// Approval harus dilakukan berjenjang sesuai kebijakan institusi

Salah

// Menambahkan data ke database

---

# 11. Import Rules

Import dikelompokkan.

1. Library bawaan

2. Library pihak ketiga

3. Internal Project

Contoh

const fs = require("fs");

const express = require("express");

const pegawaiService = require("../services/pegawaiService");

---

# 12. Async Rules

Seluruh proses asynchronous menggunakan:

async / await

Tidak diperbolehkan menggunakan callback.

Promise chaining (.then()) hanya digunakan jika benar-benar diperlukan.

---

# 13. Error Handling

Gunakan try-catch.

Semua error dilempar ke Global Error Middleware.

Controller tidak boleh mengirim stack trace.

---

# 14. Response Rules

Gunakan Response Helper.

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

Format response harus konsisten di seluruh endpoint.

---

# 15. Controller Rules

Controller hanya bertugas:

- menerima request
- memanggil service
- mengembalikan response

Controller tidak boleh:

- query database
- upload file
- business logic
- perhitungan kompleks

---

# 16. Service Rules

Service bertanggung jawab terhadap seluruh business logic.

Service boleh:

- memanggil repository
- memanggil service lain
- mengirim notifikasi
- menghitung KPI
- menjalankan workflow

Service tidak boleh mengakses Express Request atau Response secara langsung.

---

# 17. Repository Rules

Repository hanya bertugas mengakses database.

Repository hanya berisi:

SELECT

INSERT

UPDATE

DELETE

Tidak boleh:

Business Logic

Validation

HTTP Request

---

# 18. Validation Rules

Seluruh request wajib divalidasi.

Validation dilakukan sebelum Controller dijalankan.

Gunakan middleware validation.

---

# 19. Middleware Rules

Middleware harus reusable.

Contoh

Authentication

Authorization

Validation

Upload

Logging

Error Handler

Middleware tidak boleh mengandung business logic.

---

# 20. Logging Rules

Gunakan Logger Service.

Minimal mencatat:

Login

Logout

Upload

Approval

Delete

Update

Failed Login

Server Error

---

# 21. Database Rules

Seluruh query dilakukan melalui Repository.

Tidak diperbolehkan query database pada:

Controller

Middleware

Helper

Utility

---

# 22. Transaction Rules

Gunakan transaction apabila:

Approval

Upload Dokumen

Pengajuan Layanan

Proses yang mempengaruhi lebih dari satu tabel

Jika salah satu proses gagal,

seluruh transaksi harus di-rollback.

---

# 23. Storage Rules

File disimpan pada Supabase Storage.

Database hanya menyimpan metadata.

Tidak diperbolehkan menyimpan binary file di PostgreSQL.

---

# 24. Authentication Rules

Password menggunakan bcrypt.

JWT menggunakan Access Token.

Seluruh endpoint private wajib menggunakan middleware authentication.

---

# 25. Authorization Rules

Gunakan Role Based Access Control.

Jangan melakukan pengecekan role di Controller.

Gunakan middleware authorization.

---

# 26. Environment Rules

Seluruh credential berada pada:

.env

Tidak diperbolehkan:

Hardcode

JWT Secret

Supabase Key

Email Password

API Key

---

# 27. API Rules

Endpoint menggunakan REST.

Gunakan noun.

Benar

/employees

/documents

/kpis

Salah

/getEmployees

/addEmployee

/updateEmployee

---

# 28. Pagination

Gunakan format:

?page=1&limit=10

Response harus menyertakan:

page

limit

total

totalPages

---

# 29. Search

Gunakan query parameter.

Contoh

/documents?search=sertifikat

/employees?search=andi

---

# 30. Sorting

Gunakan query.

Contoh

?sort=name

?order=asc

---

# 31. Filtering

Gunakan query parameter.

Contoh

?status=approved

?unit=teknik

---

# 32. Soft Delete

Data tidak dihapus permanen.

Gunakan deleted_at.

---

# 33. Date Format

Gunakan ISO 8601.

Contoh

2026-08-04T08:30:00Z

---

# 34. Testing Rules

Setiap endpoint minimal memiliki:

Unit Test

Integration Test

Testing dilakukan sebelum merge ke branch development.

---

# 35. Git Commit

Gunakan Conventional Commit.

feat:

fix:

refactor:

docs:

style:

test:

chore:

Contoh

feat: add employee management module

fix: resolve JWT expiration issue

docs: update API specification

---

# 36. Code Review Checklist

Sebelum merge, pastikan:

✓ Tidak ada console.log()

✓ Tidak ada TODO

✓ Tidak ada hardcode credential

✓ Validation berjalan

✓ Authorization berjalan

✓ Error Handling tersedia

✓ Logging tersedia

✓ Tidak ada duplicate code

✓ Tidak ada warning

---

# 37. AI Assistant Rules

Claude maupun AI Assistant wajib:

- Membaca project_rules.md sebelum membuat kode.
- Mengikuti architecture.md.
- Mengikuti database.md.
- Mengikuti api.md.
- Mengikuti folder_structure.md.

AI Assistant tidak diperbolehkan:

- Mengubah struktur folder.
- Mengubah struktur database.
- Mengubah API tanpa memperbarui api.md.
- Menambahkan dependency baru tanpa persetujuan.
- Membuat business logic di Controller.
- Mengakses database selain melalui Repository.

Jika implementasi memerlukan perubahan arsitektur atau database, AI Assistant harus menjelaskan alasan perubahan sebelum menghasilkan kode.

---

# 38. Definition of Done

Kode dianggap memenuhi standar apabila:

✓ Mengikuti Layered Architecture

✓ Mengikuti Project Rules

✓ Tidak ada business logic di Controller

✓ Menggunakan Repository

✓ Menggunakan Validation

✓ Menggunakan Error Handling

✓ Menggunakan Logging

✓ Menggunakan Authorization

✓ Mudah dibaca

✓ Mudah diuji

✓ Mudah dipelihara