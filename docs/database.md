# Database Design
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 1.0

Status : Active

Database :
PostgreSQL (Supabase)

---

# 1. Tujuan

Dokumen ini menjadi acuan resmi seluruh desain database.

Seluruh perubahan struktur database harus mengacu pada dokumen ini.

Developer maupun AI Assistant tidak diperbolehkan membuat tabel baru tanpa memperbarui dokumen ini.

---

# 2. Database Engine

Database menggunakan

PostgreSQL

yang dikelola melalui

Supabase.

Seluruh tabel menggunakan UTF-8.

Timezone menggunakan UTC.

---

# 3. Design Principles

Database dirancang berdasarkan prinsip:

- Third Normal Form (3NF)
- Referential Integrity
- Soft Delete
- Audit Trail
- Consistent Naming
- Scalability

Tidak diperbolehkan melakukan denormalisasi tanpa alasan yang jelas.

---

# 4. Naming Convention

Table

snake_case

Contoh

pegawai

unit_kerja

roadmap_karier

dokumen_version

Column

snake_case

Contoh

full_name

created_at

updated_at

Foreign Key

nama_tabel_id

Contoh

pegawai_id

jabatan_id

role_id

---

# 5. Standard Columns

Setiap tabel wajib memiliki

id

created_at

updated_at

Apabila diperlukan

deleted_at

created_by

updated_by

deleted_by

---

# 6. Primary Keys

Seluruh Primary Key menggunakan

UUID

Contoh

id UUID PRIMARY KEY

---

# 7. Foreign Keys

Semua relasi wajib menggunakan Foreign Key.

Tidak diperbolehkan menyimpan relasi dalam bentuk text.

---

# 8. Soft Delete

Data tidak dihapus permanen.

Gunakan

deleted_at

untuk menandai data yang telah dihapus.

---

# 9. Audit Trail

Aktivitas penting disimpan pada

activity_logs

Minimal mencatat

- Login
- Logout
- Insert
- Update
- Delete
- Approval

---

# 10. Master Tables

Master data relatif jarang berubah.

## roles

Menyimpan role pengguna.

Contoh

Administrator

Bagian SDM

Dosen

Tenaga Kependidikan

Pimpinan

---

## permissions

Hak akses sistem.

---

## role_permissions

Relasi role dan permission.

---

## unit_kerja

Daftar unit kerja.

---

## jabatan

Daftar jabatan.

---

## status_kepegawaian

Status pegawai.

---

## kategori_dokumen

Kategori dokumen.

---

## jenis_sertifikasi

Master sertifikasi.

---

## jenis_pelatihan

Master pelatihan.

---

# 11. Core Tables

## users

Digunakan untuk autentikasi.

Kolom

- id
- email
- password_hash
- role_id
- is_active
- last_login
- created_at
- updated_at

---

## pegawai

Menyimpan identitas pegawai.

Kolom

- id
- user_id
- nip
- nama
- tempat_lahir
- tanggal_lahir
- jenis_kelamin
- alamat
- telepon
- unit_kerja_id
- jabatan_id
- status_kepegawaian_id
- created_at
- updated_at

---

## profil_pendidikan

Riwayat pendidikan.

---

## riwayat_jabatan

Riwayat jabatan pegawai.

---

# 12. Document Management

## dokumen

Metadata dokumen. Kolom `nama_file_asli`, `file_path`, `bucket`, `mime_type`, `ukuran_file`
selalu mencerminkan (mirror) versi yang sedang aktif — diperbarui setiap kali versi baru
diunggah melalui `dokumen_version` (lihat di bawah). Ini memungkinkan endpoint yang sudah ada
(`GET /dokumen`, `GET /dokumen/:id`, `GET /dokumen/:id/download`) selalu menunjuk versi
terbaru tanpa perlu join ke `dokumen_version`.

Kolom

- id
- pegawai_id
- kategori_dokumen_id
- nama_dokumen
- nama_file_asli
- file_path
- bucket
- mime_type
- ukuran_file
- diunggah_oleh
- versi_aktif — nomor versi yang sedang aktif, mengacu ke `dokumen_version.nomor_versi`
- created_at
- updated_at
- deleted_at

---

## dokumen_version

Riwayat versi dokumen (FR-DOC-004, FR-DOC-005). Setiap kali dokumen diunggah pertama kali
maupun saat versi baru diunggah, satu baris ditambahkan ke tabel ini — bersifat immutable,
tidak ada endpoint update/delete untuk baris versi.

Kolom

- id
- dokumen_id — FK ke `dokumen.id`, `ON DELETE CASCADE`
- nomor_versi — integer berurutan mulai dari 1, unik per `dokumen_id` (`UNIQUE(dokumen_id, nomor_versi)`)
- nama_file_asli
- file_path — path fisik di Supabase Storage khusus versi ini; file versi lama tetap disimpan permanen, tidak pernah dihapus/ditimpa
- bucket
- mime_type
- ukuran_file
- diunggah_oleh — FK ke `users.id`, `ON DELETE SET NULL`
- created_at
- updated_at

Tidak memiliki `deleted_at` — riwayat versi bersifat permanen (bukan entitas yang bisa
dihapus lewat API), konsisten dengan tujuan FR-DOC-005.

Relasi

dokumen

1

↓

N

dokumen_version

---

# 13. Roadmap Karier

## roadmap_karier

Posisi saat ini.

Target jabatan.

Target promosi.

Deadline.

Status.

---

# 14. Penelitian

## penelitian

Target penelitian.

---

## publikasi

Publikasi penelitian.

---

## hki

Hak Kekayaan Intelektual.

---

# 15. Sertifikasi

## sertifikasi

Data sertifikat.

Tanggal berlaku.

Tanggal berakhir.

Reminder.

---

# 16. Pelatihan

## pelatihan

Riwayat pelatihan.

Sertifikat.

Penyelenggara.

Tanggal.

---

# 17. Layanan Administrasi

## layanan

Jenis layanan.

---

## pengajuan_layanan

Data pengajuan.

Status.

Tanggal.

Lampiran.

---

## approval

Approval berjenjang.

Level.

Status.

Approver.

Tanggal.

Catatan.

---

# 18. Notification

## notifications

Notifikasi sistem.

Email.

Reminder.

Approval.

Expired Document.

Expired Certification.

---

# 19. Activity Logs

## activity_logs

Audit Trail.

User.

Action.

Table.

Record ID.

IP Address.

User Agent.

Timestamp.

---

# 20. Relationship

users

1

↓

1

pegawai

pegawai

1

↓

N

dokumen

pegawai

1

↓

N

sertifikasi

pegawai

1

↓

N

pelatihan

pegawai

1

↓

N

penelitian

pegawai

1

↓

N

roadmap_karier

pegawai

1

↓

N

pengajuan_layanan

pengajuan_layanan

1

↓

N

approval

dokumen

1

↓

N

dokumen_version

roles

1

↓

N

users

roles

N

↓

N

permissions

---

# 21. Indexing

Seluruh kolom berikut wajib memiliki index.

email

nip

pegawai_id

user_id

role_id

created_at

status

---

# 22. Constraints

Email unik.

NIP unik.

Role wajib ada.

Foreign Key wajib valid.

Dokumen tidak boleh tanpa pegawai.

Approval tidak boleh tanpa pengajuan.

---

# 23. Storage Rules

File fisik berada pada

Supabase Storage.

Database hanya menyimpan

- path
- bucket
- mime_type
- file_size

---

# 24. Migration Rules

Seluruh perubahan database menggunakan migration SQL.

Migration bersifat immutable.

Tidak diperbolehkan mengubah migration lama.

---

# 25. Seed Data

Seed minimal

Roles

Permissions

Unit Kerja

Jabatan

Kategori Dokumen

Jenis Sertifikasi

Jenis Pelatihan

Administrator

---

# 26. Backup

Backup dilakukan otomatis.

Backup database terpisah dari Storage.

---

# 27. Security

Seluruh tabel menggunakan

Row Level Security (RLS)

sesuai role.

Sensitive data hanya dapat diakses role tertentu.

---

# 28. Future Tables

Penambahan tabel harus memenuhi:

- memiliki Primary Key
- memiliki created_at
- memiliki updated_at
- memiliki Foreign Key bila diperlukan
- terdokumentasi pada database.md

---

# 29. Definition of Done

Database dianggap selesai apabila:

✔ Seluruh tabel terdokumentasi

✔ Seluruh relasi terdokumentasi

✔ Migration tersedia

✔ Seed tersedia

✔ Foreign Key lengkap

✔ Index lengkap

✔ Constraint lengkap

✔ RLS diterapkan

✔ Tidak ada duplikasi data