# System Architecture
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 1.0

Status : Active

---

# 1. Tujuan

Dokumen ini menjelaskan arsitektur teknis sistem yang akan digunakan selama proses pengembangan.

Dokumen ini menjadi acuan seluruh developer dalam memahami bagaimana setiap komponen sistem saling berinteraksi.

Seluruh implementasi wajib mengikuti arsitektur yang dijelaskan pada dokumen ini.

---

# 2. Architectural Principles

Sistem dibangun dengan prinsip:

- Modular
- Scalable
- Maintainable
- Secure
- Cloud Native
- RESTful
- Layered Architecture

Setiap modul harus dapat dikembangkan tanpa mempengaruhi modul lain.

---

# 3. High Level Architecture

```
                Client (Browser)

                        │
                        │ HTTPS
                        ▼

                Express REST API

                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼

 Authentication     Business Logic     Storage

        │               │                │

        └───────────────┼────────────────┘
                        │

                Repository Layer

                        │

                Supabase PostgreSQL

                        │

                Supabase Storage
```

---

# 4. System Components

Sistem terdiri dari lima komponen utama.

## Client

Frontend menggunakan:

- HTML5
- Bootstrap 5
- Vanilla JavaScript

Tugas Client:

- Menampilkan UI
- Mengirim Request API
- Menampilkan Response
- Validasi ringan (Client Validation)

Client tidak memiliki business logic.

---

## Backend

Backend menggunakan:

- Node.js
- Express.js

Tugas Backend:

- Authentication
- Authorization
- Validation
- Business Logic
- Logging
- Error Handling
- API Response

Backend menjadi pusat seluruh proses bisnis.

---

## Database

Database menggunakan:

Supabase PostgreSQL

Database menyimpan:

- Data Pegawai
- KPI
- Dokumen
- Sertifikasi
- Pelatihan
- Penelitian
- Roadmap
- Approval
- Notification
- Activity Log

---

## Storage

Menggunakan:

Supabase Storage

Storage hanya menyimpan file.

Database hanya menyimpan metadata.

---

## Authentication

Menggunakan:

JWT Authentication

Role Based Access Control

Setiap request private wajib membawa Access Token.

---

# 5. Layered Architecture

```
Request

↓

Routes

↓

Middlewares

↓

Controller

↓

Service

↓

Repository

↓

Supabase

↓

Response
```

---

## Route Layer

Bertugas:

- Mendefinisikan Endpoint
- Menentukan Middleware
- Memanggil Controller

Tidak diperbolehkan terdapat business logic.

---

## Middleware Layer

Berfungsi untuk:

- Authentication
- Authorization
- Validation
- Upload
- Logging
- Error Handler

Middleware harus reusable.

---

## Controller Layer

Controller bertugas:

- Menerima Request
- Memanggil Service
- Mengembalikan Response

Controller tidak boleh:

- Query Database
- Mengakses Supabase
- Menulis Business Logic

---

## Service Layer

Merupakan pusat Business Logic.

Semua aturan bisnis ditulis pada layer ini.

Contoh:

- Validasi proses approval
- Menghitung KPI
- Mengubah status layanan
- Mengirim notifikasi
- Menentukan workflow

---

## Repository Layer

Repository bertanggung jawab terhadap seluruh komunikasi dengan database.

Repository:

- SELECT
- INSERT
- UPDATE
- DELETE

Repository tidak memiliki business logic.

---

# 6. Request Flow

Contoh Login

```
Browser

↓

POST /login

↓

Route

↓

Validation

↓

Controller

↓

Auth Service

↓

User Repository

↓

Supabase

↓

JWT

↓

Response
```

---

Contoh Upload Dokumen

```
Browser

↓

Upload File

↓

Upload Middleware

↓

Document Controller

↓

Document Service

↓

Supabase Storage

↓

Repository

↓

Supabase PostgreSQL

↓

Response
```

---

# 7. Module Architecture

Setiap module memiliki struktur yang sama.

```
Route

↓

Validation

↓

Controller

↓

Service

↓

Repository

↓

Database
```

Module tidak boleh saling mengakses Repository.

Jika membutuhkan data dari module lain, komunikasi dilakukan melalui Service.

---

# 8. Security Architecture

Authentication

↓

JWT Token

↓

Authorization

↓

Role Validation

↓

Business Process

↓

Database Access

Semua endpoint private wajib melewati proses tersebut.

---

# 9. Authorization

Role yang tersedia:

- Administrator
- Bagian SDM
- Dosen
- Tenaga Kependidikan
- Pimpinan

Authorization dilakukan menggunakan middleware.

Controller tidak diperbolehkan melakukan pengecekan role secara langsung.

---

# 10. File Storage Architecture

```
Browser

↓

Upload

↓

Express

↓

Supabase Storage

↓

File URL

↓

Database
```

File tidak disimpan di PostgreSQL.

Database hanya menyimpan:

- file_name
- original_name
- path
- bucket
- mime_type
- size
- uploaded_by

---

# 11. Notification Architecture

Semua notifikasi diproses melalui Notification Service.

Notification Service dapat mengirim:

- Email
- WhatsApp (Future Development)
- In-App Notification

Module lain tidak boleh mengirim notifikasi secara langsung.

---

# 12. Logging Architecture

Semua aktivitas penting dicatat.

Minimal:

- Login
- Logout
- Upload Dokumen
- Approval
- Delete
- Update
- Error
- Failed Login

Logging dilakukan melalui Logger Service.

---

# 13. Error Handling

Semua exception diproses oleh Global Error Middleware.

Controller tidak boleh mengirim stack trace.

Response Error harus memiliki format yang konsisten.

---

# 14. Database Access

Seluruh akses database melalui Repository.

Tidak diperbolehkan:

Controller → Database

Service → Database

Harus:

Controller

↓

Service

↓

Repository

↓

Supabase

---

# 15. Future Scalability

Arsitektur dirancang agar mudah dikembangkan.

Penambahan module baru tidak boleh mengubah module yang telah ada.

Komunikasi antar module menggunakan Service.

---

# 16. Deployment Architecture

```
Browser

↓

HTTPS

↓

Reverse Proxy (Optional)

↓

Node.js Server

↓

Supabase

├── PostgreSQL

└── Storage
```

Seluruh komunikasi menggunakan HTTPS.

---

# 17. Design Principles

Seluruh pengembangan wajib mengikuti prinsip:

- Single Responsibility Principle (SRP)
- Separation of Concerns (SoC)
- Don't Repeat Yourself (DRY)
- Keep It Simple (KISS)
- RESTful API
- Secure by Default

---

# 18. Technology Decisions

Backend

- Node.js
- Express.js

Database

- PostgreSQL (Supabase)

Authentication

- JWT

Storage

- Supabase Storage

Frontend

- HTML5
- Bootstrap 5
- JavaScript

Deployment

- Railway / VPS

Version Control

- Git

---

# 19. Architecture Rules

Developer maupun AI Assistant tidak diperbolehkan:

❌ Mengakses database langsung dari Controller

❌ Menulis Business Logic di Route

❌ Mengakses Storage dari Controller

❌ Mengubah struktur layer

❌ Menggunakan query SQL di luar Repository

❌ Membuat endpoint tanpa dokumentasi

❌ Mengubah struktur database tanpa migration

---

# 20. Definition of Done

Sebuah fitur dianggap sesuai arsitektur apabila:

✔ Mengikuti Layered Architecture

✔ Menggunakan Repository

✔ Menggunakan Service

✔ Menggunakan Validation

✔ Menggunakan Middleware

✔ Menggunakan Logging

✔ Menggunakan Authorization

✔ Menggunakan Error Handler

✔ Menggunakan Migration

✔ Mengikuti Project Rules