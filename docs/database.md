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

Kolom tambahan

- wajib_approval — BOOLEAN, default FALSE. Menentukan apakah dokumen pada kategori ini
  memerlukan persetujuan admin/HRD sebelum "berlaku" (FR-DOC-010). Diputuskan per-kategori,
  bukan per-dokumen maupun per-role pengunggah — lihat `dokumen.status` di §12.

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
- status — VARCHAR(30), `CHECK (status IN ('menunggu_persetujuan', 'disetujui', 'ditolak'))`,
  nullable. NULL berarti `kategori_dokumen.wajib_approval` untuk dokumen ini FALSE, sehingga
  tidak ada alur approval sama sekali (FR-DOC-010). Dokumen yang diunggah sebelum migrasi ini
  ada tetap NULL walau kategorinya kemudian ditandai wajib approval — tidak ada approval
  retroaktif. Diisi ulang menjadi `menunggu_persetujuan` setiap kali versi baru diunggah pada
  dokumen yang kategorinya wajib approval (perlu ditinjau ulang).
- disetujui_oleh — FK ke `users.id`, `ON DELETE SET NULL`
- tanggal_persetujuan — TIMESTAMPTZ, diisi saat approve/reject
- catatan_approval — TEXT, wajib diisi saat reject, opsional saat approve
- tanggal_kedaluwarsa — DATE, nullable. Dipakai untuk reminder (FR-DOC-009); kebanyakan
  kategori dokumen (mis. ijazah) tidak pernah kedaluwarsa sehingga kolom ini dikosongkan.
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

# 13. KPI

Sesuai `docs/roadmap.md` Phase 6 (dependency: Pegawai — sudah selesai) dan blueprint
FR-KPI-001 s/d FR-KPI-007. Tidak ada alur approval/verifikasi untuk KPI — blueprint tidak
mensyaratkannya (berbeda dari Dokumen/Layanan Administrasi yang eksplisit punya requirement
approval), jadi modul ini murni: HRD/Admin menetapkan target → pegawai menginput capaian →
sistem menghitung persentase & status otomatis.

## kpi

Target dan capaian KPI per pegawai per periode. Adaptasi dari `kpis` pada blueprint §18
(nama tabel disesuaikan ke konvensi tunggal proyek ini, sama seperti `documents` → `dokumen`).

Kolom

- id
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`
- period — VARCHAR(20). Format bebas (blueprint hanya memberi contoh `"2026-1"`/`"2026-2"`,
  bukan aturan format baku), jadi tidak dipaksakan lewat CHECK constraint.
- target — NUMERIC. Ditetapkan oleh HRD/Admin saat membuat record (FR-KPI-001); pegawai tidak
  pernah bisa mengubahnya.
- achievement — NUMERIC, default 0. Diisi pegawai (FR-KPI-002) pada KPI yang tidak memiliki
  rincian indikator (`kpi_detail`). **Saat KPI punya `kpi_detail`, kolom ini menjadi
  turunan/read-only dalam praktik** — setiap kali Service menghitung ulang `percentage` dari
  rincian indikator, `achievement` ditulis ulang mengikuti `percentage / 100 * target` supaya
  tetap konsisten (membaca `achievement`/`target` langsung selalu menghasilkan `percentage` yang
  sama, walau perhitungan sebenarnya berasal dari `kpi_detail`). Nilai yang dikirim manual lewat
  `PATCH` pada KPI semacam ini akan tertimpa oleh perhitungan ulang berikutnya.
- percentage — NUMERIC(5,2), default 0. **Bukan** kolom `GENERATED` SQL — dihitung dan ditulis
  ulang oleh Service layer setiap kali `achievement`, `target`, atau salah satu `kpi_detail`
  miliknya berubah (FR-KPI-004), **tidak pernah dibatasi maksimal 100** (capaian boleh melebihi
  target — nilai aslinya tidak boleh hilang). Formula:
  - Tanpa `kpi_detail`: `achievement / target * 100`, atau `0` jika `target = 0` (bukan division
    by zero).
  - Dengan `kpi_detail`: setiap indikator punya `realization / target * 100` sendiri (`0` jika
    `target` indikator itu `0`), lalu KPI-nya adalah rata-rata tertimbang
    `Σ(detail percentage × weight) / Σ(weight)`, atau `0` jika `Σ(weight) = 0` (guard yang sama
    seperti `target = 0`, bukan aturan tersendiri).

  Formula ini adalah keputusan desain eksplisit (blueprint tidak merincikannya) — dipilih karena
  hanya interpretasi ini yang membuat `kpi_detail.weight` (dari blueprint sendiri) benar-benar
  terpakai.
- status — VARCHAR(20), default `'not_started'`,
  `CHECK (status IN ('not_started', 'on_track', 'at_risk', 'achieved'))` — persis 4 nilai enum
  blueprint §18. Threshold eksplisit (blueprint tidak menetapkan angka apa pun, jadi ini
  didokumentasikan di sini, bukan tersebar di banyak file — lihat `AT_RISK_UPPER_BOUND` di
  `kpi.service.js`):
  - `percentage === 0` → `not_started`
  - `0 < percentage < 70` → `at_risk`
  - `70 <= percentage < 100` → `on_track`
  - `percentage >= 100` → `achieved`
- created_at
- updated_at
- deleted_at

Constraint

- `UNIQUE (pegawai_id, period)` — satu pegawai hanya boleh punya satu record KPI per periode
  (pola yang identik dengan `absensi`'s `UNIQUE(pegawai_id, tanggal)`).

Index

- idx_kpi_pegawai_id
- idx_kpi_status
- idx_kpi_period

---

## kpi_detail

Rincian KPI per indikator (opsional — sebuah `kpi` boleh tidak punya `kpi_detail` sama sekali
dan tetap berfungsi lewat kolom `achievement` di level `kpi`). Adaptasi dari `kpi_details` pada
blueprint §18. Berbeda dari `dokumen_version`, tabel ini **bukan** riwayat immutable — HRD/Admin
dapat menambah, mengubah, dan menghapus baris indikator kapan pun, sehingga tetap memiliki
`deleted_at` (soft delete), bukan hanya `created_at`/`updated_at`.

Kolom

- id
- kpi_id — FK ke `kpi.id`, `ON DELETE CASCADE`
- indicator — VARCHAR(200). Nama indikator, ditetapkan HRD/Admin.
- target — NUMERIC. Ditetapkan HRD/Admin.
- realization — NUMERIC, default 0. Diisi pegawai (FR-KPI-002) — satu-satunya kolom yang boleh
  diubah pegawai pada baris ini.
- weight — NUMERIC, default 0. Bobot indikator dalam perhitungan `kpi.percentage`. Blueprint
  tidak menetapkan skala (mis. 0–1 atau 0–100) atau aturan "total bobot harus 100", sehingga
  tidak ada CHECK constraint terkait ini — perhitungan di Service layer menangani total bobot 0
  dengan fallback ke rata-rata sederhana antar indikator.
- created_at
- updated_at
- deleted_at

Index

- idx_kpi_detail_kpi_id

Relasi

kpi

1

↓

N

kpi_detail

---

# 14. Roadmap Karier

Sesuai `docs/roadmap.md` Phase 7 (dependency: Pegawai, KPI — keduanya sudah selesai) dan
blueprint FR-CAREER-001 s/d FR-CAREER-005. Tidak ada alur approval/verifikasi untuk roadmap
karier — sama seperti KPI, blueprint tidak mensyaratkannya. Berbeda dari KPI, blueprint tidak
pernah menyebut pegawai mengisi/mengubah data roadmap-nya sendiri (hanya "memantau secara
mandiri") — modul ini murni: HRD/Admin menetapkan posisi/target/persyaratan/progres →
pegawai dan pimpinan memantau.

## roadmap_karier

Progres jenjang karier per pegawai. Adaptasi dari `career_roadmaps` pada blueprint §17 (nama
tabel disesuaikan ke konvensi tunggal proyek ini, sama seperti `documents` → `dokumen`,
`kpis` → `kpi`). Blueprint hanya mendefinisikan satu tabel untuk modul ini — tidak ada tabel
child/detail seperti `kpi_detail`.

Kolom

- id
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`
- jabatan_saat_ini_id — FK ke `jabatan.id`, `ON DELETE SET NULL`, nullable. Adaptasi dari
  `current_position` (FR-CAREER-001). `ON DELETE SET NULL` (bukan CASCADE) karena
  penghapusan data master jabatan tidak boleh ikut menghapus riwayat roadmap pegawai.
- jabatan_target_id — FK ke `jabatan.id`, `ON DELETE SET NULL`, nullable. Adaptasi dari
  `target_position` (FR-CAREER-002).
- persyaratan — TEXT, nullable. **Bukan bagian draft blueprint** — blueprint hanya
  menyediakan kolom `progress` (numerik) untuk merepresentasikan pemenuhan persyaratan
  (FR-CAREER-004), tanpa kolom terpisah untuk mendeskripsikan persyaratan itu sendiri
  (FR-CAREER-003). Kolom teks bebas ini adalah keputusan desain eksplisit, mengikuti pola
  `catatan_approval` TEXT yang sudah dipakai di modul lain untuk keterangan bebas — bukan
  skema persyaratan terstruktur, karena blueprint tidak merincikannya.
- progress — NUMERIC(5,2), default 0. **Bukan** kolom terhitung otomatis (`GENERATED`
  ataupun dihitung Service layer) — beda dari `kpi.percentage`. Blueprint tidak memberi
  formula untuk `progress` (tidak ada field `target`/`achievement` yang bisa dibagi seperti
  KPI, dan tidak ada relasi ke tabel `kpi` di draft blueprint), jadi Admin/HRD menetapkannya
  langsung. Divalidasi 0–100 di Validation layer (lihat `docs/api.md` §10) — beda dari
  `kpi.achievement` yang boleh melebihi target, karena "persentase pemenuhan persyaratan"
  secara semantik tidak bisa melebihi 100%.
- status — VARCHAR(20), default `'in_progress'`,
  `CHECK (status IN ('in_progress', 'eligible', 'promoted'))` — persis 3 nilai enum blueprint
  §21. Tidak ada aturan urutan transisi antar status (mis. tidak boleh mundur) — blueprint
  tidak menetapkannya, jadi tidak ditegakkan di sini (Admin/HRD bebas mengubah ke nilai enum
  mana pun).
- created_at
- updated_at
- deleted_at

Constraint

- Tidak ada `UNIQUE` pada `pegawai_id` (atau kombinasi kolom apa pun) — beda dari
  `kpi`'s `UNIQUE(pegawai_id, period)`. Blueprint tidak punya kolom `period` untuk roadmap
  karier dan tidak menyatakan "satu pegawai hanya boleh punya satu roadmap aktif", jadi
  seorang pegawai bisa memiliki lebih dari satu baris `roadmap_karier` (mis. riwayat jenjang
  karier dari waktu ke waktu). Keputusan desain eksplisit — bukan sesuatu yang belum
  dikerjakan.

Index

- idx_roadmap_karier_pegawai_id
- idx_roadmap_karier_status
- idx_roadmap_karier_jabatan_target_id

Relasi

pegawai

1

↓

N

roadmap_karier

N

↓

1

jabatan (dua kali — jabatan_saat_ini_id dan jabatan_target_id)

---

# 15. Penelitian

Sesuai `docs/roadmap.md` Phase 8 (dependency: Pegawai — sudah selesai) dan blueprint
FR-RES-001 s/d FR-RES-005. Tidak ada alur approval/verifikasi — sama seperti KPI dan
Roadmap Karier, blueprint tidak mensyaratkannya. **Berbeda dari KPI/Roadmap Karier**, modul
ini tidak punya pola "admin/HRD menetapkan untuk pegawai" — penelitian pada dasarnya
dilaporkan sendiri oleh penelitinya (FR-RES-001..004 semuanya berbunyi "Pengguna dapat
menginput..."), jadi pegawai punya CRUD penuh atas datanya sendiri, mirip pola kepemilikan
`dokumen` (unggah/kelola milik sendiri) ketimbang pola KPI (hanya mengisi capaian pada baris
yang dibuatkan HRD/Admin). **Ini keputusan desain eksplisit** — blueprint tidak merinci role
per-FR untuk modul ini, jadi ditafsirkan dari kalimat "Pengguna", bukan "HRD/Admin", yang
dipakai konsisten di seluruh FR-RES.

## penelitian

Proyek penelitian pegawai (pengusul). Adaptasi dari `research_projects` pada blueprint §17
(nama tabel disesuaikan ke konvensi tunggal proyek ini, sama seperti `documents` →
`dokumen`).

Kolom

- id
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`. Pengusul/pemilik penelitian.
- judul — VARCHAR(300), wajib
- skema — VARCHAR(200), nullable. Skema/program pendanaan.
- dana — NUMERIC, nullable. Jumlah dana hibah — adaptasi kolom `funding` blueprint,
  memenuhi FR-RES-002 ("menginput data hibah").
- tahun — INTEGER, wajib
- created_at
- updated_at
- deleted_at

**Catatan desain (FR-RES-001 & FR-RES-005):** blueprint tidak memberi kolom `target` terpisah
untuk "target penelitian" — draft schema-nya (`research_projects`) hanya punya
title/scheme/funding/year. Ditafsirkan di sini: proyek penelitian itu sendiri (judul, skema,
tahun) *adalah* targetnya, bukan angka target terpisah. Tabel `penelitian` juga **tidak
punya kolom status/progress** — blueprint's daftar ENUM per tabel (§21) tidak menyertakan
`research_projects` (beda dari `kpis`/`career_roadmaps` yang eksplisit didaftar dengan nilai
ENUM-nya). "Memantau progres" (FR-RES-005) ditafsirkan sebagai kemampuan melihat
daftar/riwayat penelitian pegawai dari waktu ke waktu, bukan field status baru yang tidak
diminta blueprint.

Index

- idx_penelitian_pegawai_id
- idx_penelitian_tahun

---

## anggota_penelitian

Anggota tim tambahan pada suatu penelitian, di luar pengusul (yang sudah tercatat lewat
`penelitian.pegawai_id`). Adaptasi dari `research_members` pada blueprint §17 — tabel
penghubung many-to-many, disebutkan eksplisit di data dictionary blueprint meski tidak
punya FR tersendiri.

Kolom

- id
- penelitian_id — FK ke `penelitian.id`, `ON DELETE CASCADE`
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`
- created_at
- updated_at
- deleted_at

Constraint

- `UNIQUE (penelitian_id, pegawai_id)` — satu pegawai tidak bisa ditambahkan dua kali sebagai
  anggota pada penelitian yang sama.

Index

- idx_anggota_penelitian_penelitian_id
- idx_anggota_penelitian_pegawai_id

---

## publikasi

Luaran publikasi dari suatu penelitian (FR-RES-003). Adaptasi dari `publications` pada
blueprint §17. Selalu terkait ke satu penelitian induk (blueprint: "Proyek Penelitian →
Publikasi, satu-ke-banyak") — tidak ada publikasi tanpa penelitian, `penelitian_id` wajib.

Kolom

- id
- penelitian_id — FK ke `penelitian.id`, `ON DELETE CASCADE`
- judul — VARCHAR(300), wajib
- jurnal — VARCHAR(300), nullable
- terindeks — BOOLEAN, default `false`
- tahun — INTEGER, wajib
- created_at
- updated_at
- deleted_at

Index

- idx_publikasi_penelitian_id
- idx_publikasi_tahun

---

## hki

Hak Kekayaan Intelektual (FR-RES-004). **Blueprint hanya menyebut requirement ini di daftar
FR — tidak ada definisi tabel `hki` sama sekali di data dictionary §17**, berbeda dari
`research_projects`/`publications` yang memang didefinisikan blueprint. Skema di bawah ini
sepenuhnya keputusan desain eksplisit, dibuat seminimal mungkin.

Kolom

- id
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`
- penelitian_id — FK ke `penelitian.id`, `ON DELETE SET NULL`, nullable. **Opsional** — HKI
  tidak selalu lahir dari satu proyek penelitian tercatat, jadi tidak dipaksakan wajib
  terhubung, mengikuti pola nullable FK yang sama seperti
  `roadmap_karier.jabatan_saat_ini_id`/`jabatan_target_id`.
- judul — VARCHAR(300), wajib
- jenis — VARCHAR(100), nullable. Teks bebas (Paten/Hak Cipta/Merek/dst) — **tidak**
  dipaksakan jadi ENUM karena blueprint tidak memberi daftar jenis HKI yang tetap.
- nomor_pendaftaran — VARCHAR(100), nullable. HKI yang baru diajukan mungkin belum punya
  nomor resmi.
- tanggal_pendaftaran — DATE, nullable
- created_at
- updated_at
- deleted_at

Index

- idx_hki_pegawai_id
- idx_hki_penelitian_id

---

# 16. Sertifikasi

Sesuai `docs/roadmap.md` Phase 9 (dependency: Pegawai — sudah selesai) dan blueprint
FR-CERT-001 s/d FR-CERT-005. Tidak ada alur approval/verifikasi — blueprint tidak
mensyaratkannya, sama seperti KPI/Roadmap Karier/Penelitian. Modul ini tidak punya pola
"admin/HRD menetapkan untuk pegawai" — sertifikasi dilaporkan sendiri oleh pemiliknya
(FR-CERT-001 berbunyi "Pengguna dapat menambahkan..."), jadi pegawai punya CRUD penuh atas
datanya sendiri, mirip pola kepemilikan `dokumen`/`penelitian`/`hki`. **Ini keputusan desain
eksplisit** — blueprint tidak merinci role per-FR untuk modul ini.

## jenis_sertifikasi

Data master jenis/tipe sertifikasi (adaptasi dari `certificate_types` pada blueprint §18
Data Master). **Direncanakan sejak Phase 2 (Master Data) di `docs/roadmap.md` tapi belum
pernah dibangun saat itu** — dibuat sekarang karena baru menjadi dependency nyata untuk
`sertifikasi`. Mengikuti pola persis `kategori_dokumen`.

Kolom

- id
- nama_jenis — VARCHAR(150), wajib, unik
- deskripsi — TEXT, nullable
- created_at
- updated_at
- deleted_at

Index: unique constraint pada `nama_jenis` (index otomatis).

---

## sertifikasi

Data sertifikasi kompetensi pegawai beserta berkas sertifikat dan tanggal masa berlaku
(FR-CERT-001/002/003/004). Adaptasi dari `certifications` pada blueprint §18 (nama tabel
disesuaikan ke konvensi tunggal proyek ini, sama seperti `documents` → `dokumen`).

Kolom

- id
- pegawai_id — FK ke `pegawai.id`, `ON DELETE CASCADE`. Pemilik sertifikat.
- jenis_sertifikasi_id — FK ke `jenis_sertifikasi.id`, `ON DELETE SET NULL`, nullable.
  Mengikuti pola nullable FK yang sama seperti `dokumen.kategori_dokumen_id`.
- nama_sertifikat — VARCHAR(300), wajib
- penerbit — VARCHAR(300), nullable (blueprint: issuer)
- nomor_sertifikat — VARCHAR(150), nullable
- tanggal_terbit — DATE, nullable (blueprint: issue_date)
- tanggal_berakhir — DATE, nullable (blueprint: expired_date). Tidak semua sertifikat
  punya masa berlaku (mis. sertifikat kelulusan) — mengikuti pola
  `dokumen.tanggal_kedaluwarsa`.
- nama_file_asli / file_path / bucket / mime_type / ukuran_file — metadata berkas
  sertifikat, satu berkas per baris (tanpa versioning). Berkas disimpan di Supabase
  Storage bucket **`sertifikat`** (privat, limit 10MB, mime types sama seperti bucket
  `documents`).
- created_at
- updated_at
- deleted_at

**Catatan desain (kolom yang tidak ada di draft blueprint §18):** blueprint's tabel
`certifications` hanya punya employee_id/certificate_type_id/issuer/issue_date/expired_date
— tidak ada nama/judul sertifikat, nomor sertifikat, atau kolom berkas sama sekali.
- `nama_sertifikat` ditambahkan karena tanpa ini, dua sertifikat dengan jenis yang sama
  (mis. dua "Kompetensi Dosen" di tahun berbeda) tidak bisa dibedakan di riwayat
  (FR-CERT-004).
- `nomor_sertifikat` ditambahkan mengikuti pola `hki.nomor_pendaftaran` — identitas resmi
  yang berguna untuk verifikasi.
- Kolom berkas ditambahkan karena FR-CERT-002 eksplisit mensyaratkan upload dokumen
  sertifikat. Sertifikasi punya kolom berkas sendiri (bukan FK ke tabel `dokumen` yang
  sudah ada) supaya alur "Tambah Sertifikat" tetap satu langkah (create + upload
  sekaligus, sama seperti `POST /dokumen`), bukan dua langkah terpisah. Berkas wajib
  diunggah saat membuat data — tidak ada alur "isi metadata dulu, upload nanti".
- Tidak ada kolom `status` (aktif/kedaluwarsa) tersimpan — blueprint §21 "Nilai Status
  (Enum) per Tabel" **tidak mencantumkan `certifications` sama sekali** (berbeda dari
  `kpis`/`career_roadmaps` yang eksplisit didaftar). "Expired" (task di `docs/roadmap.md`
  Phase 9) ditafsirkan sebagai status turunan dari `tanggal_berakhir < tanggal hari ini`,
  dihitung saat query/tampil — bukan kolom baru. Persis pola yang sudah dipakai untuk
  `penelitian` (§15).
- FR-CERT-003 "pengingat masa berlaku" ditafsirkan sebagai reminder dalam-aplikasi
  (query filter + banner Dashboard, jendela 30 hari — konstanta yang sama dengan
  `EXPIRY_REMINDER_DAYS` milik dokumen), **bukan** pengiriman notifikasi keluar
  (email/WhatsApp) — modul Notifikasi (FR-NOTIF) belum dibangun sama sekali di proyek
  ini. Persis pola FR-DOC-009 yang sudah ada, diterapkan konsisten, bukan interpretasi
  baru.

Index

- idx_sertifikasi_pegawai_id
- idx_sertifikasi_jenis_sertifikasi_id
- idx_sertifikasi_tanggal_berakhir (partial, `WHERE tanggal_berakhir IS NOT NULL` — sama
  seperti `idx_dokumen_tanggal_kedaluwarsa`)

---

# 17. Pelatihan

## pelatihan

Riwayat pelatihan.

Sertifikat.

Penyelenggara.

Tanggal.

---

# 18. Layanan Administrasi

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

# 19. Notification

## notifications

Notifikasi sistem.

Email.

Reminder.

Approval.

Expired Document.

Expired Certification.

---

# 20. Activity Logs

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

# 21. Relationship

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

kpi

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

kpi

1

↓

N

kpi_detail

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

# 22. Indexing

Seluruh kolom berikut wajib memiliki index.

email

nip

pegawai_id

user_id

role_id

created_at

status

---

# 23. Constraints

Email unik.

NIP unik.

Role wajib ada.

Foreign Key wajib valid.

Dokumen tidak boleh tanpa pegawai.

Approval tidak boleh tanpa pengajuan.

---

# 24. Storage Rules

File fisik berada pada

Supabase Storage.

Database hanya menyimpan

- path
- bucket
- mime_type
- file_size

---

# 25. Migration Rules

Seluruh perubahan database menggunakan migration SQL.

Migration bersifat immutable.

Tidak diperbolehkan mengubah migration lama.

---

# 26. Seed Data

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

# 27. Backup

Backup dilakukan otomatis.

Backup database terpisah dari Storage.

---

# 28. Security

Seluruh tabel menggunakan

Row Level Security (RLS)

sesuai role.

Sensitive data hanya dapat diakses role tertentu.

---

# 29. Future Tables

Penambahan tabel harus memenuhi:

- memiliki Primary Key
- memiliki created_at
- memiliki updated_at
- memiliki Foreign Key bila diperlukan
- terdokumentasi pada database.md

---

# 30. Definition of Done

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
