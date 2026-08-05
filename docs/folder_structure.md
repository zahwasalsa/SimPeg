# Folder Structure
## Sistem Pengembangan Karier dan Kinerja Pegawai

Version : 2.0

Status : Active

---

# 1. Tujuan

Dokumen ini menjelaskan struktur folder resmi project.

Seluruh source code wajib mengikuti struktur ini.

Developer maupun AI Assistant tidak diperbolehkan mengubah struktur tanpa persetujuan Project Owner.

---

# 2. Root Structure

```
career-management-system/

│
├── docs/
├── src/
├── database/
├── public/
├── tests/
├── scripts/
├── logs/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

# 3. Folder docs

```
docs/

blueprint.pdf

project_rules.md

folder_structure.md

architecture.md

database.md

api.md

coding_standard.md

roadmap.md

prompt.md
```

Folder ini hanya berisi dokumentasi.

Tidak boleh menyimpan source code.

---

# 4. Folder src

```
src/

app.js

server.js

modules/

shared/

config/

routes/

database/

storage/
```

---

# 5. Modules

Seluruh business feature berada di folder modules.

Setiap module berdiri sendiri.

```
modules/

auth/

dashboard/

pegawai/

unitKerja/

jabatan/

dokumen/

kpi/

roadmapKarier/

penelitian/

sertifikasi/

pelatihan/

layanan/

approval/

notification/

masterData/

users/
```

---

# 6. Struktur Module

Seluruh module memiliki struktur yang sama.

```
pegawai/

pegawai.controller.js

pegawai.service.js

pegawai.repository.js

pegawai.validation.js

pegawai.routes.js

pegawai.mapper.js

pegawai.constants.js

pegawai.docs.js
```

Jika module memiliki logic kompleks:

```
pegawai/

controllers/

services/

repositories/

validators/

routes/

constants/

mappers/

dto/
```

---

# 7. Shared Folder

Semua kode yang digunakan bersama disimpan pada folder shared.

```
shared/

middlewares/

helpers/

utils/

constants/

validators/

logger/

responses/

exceptions/

enums/
```

---

# 8. Config

Seluruh konfigurasi project.

```
config/

supabase.js

jwt.js

storage.js

mailer.js

logger.js

environment.js
```

Tidak boleh terdapat business logic.

---

# 9. Database Folder

```
database/

migrations/

seeders/

functions/

views/

policies/

sql/
```

---

# 10. Migration

```
migrations/

001_roles.sql

002_permissions.sql

003_users.sql

004_unit_kerja.sql

005_jabatan.sql

006_pegawai.sql

007_dokumen.sql

008_dokumen_version.sql

009_kpi.sql

010_roadmap_karier.sql

011_penelitian.sql

012_publikasi.sql

013_hki.sql

014_sertifikasi.sql

015_pelatihan.sql

016_layanan.sql

017_pengajuan.sql

018_approval.sql

019_notifications.sql

020_activity_logs.sql
```

Migration bersifat immutable.

---

# 11. Seeders

```
seeders/

roles.sql

permissions.sql

jabatan.sql

unit_kerja.sql

kategori_dokumen.sql

jenis_sertifikasi.sql

jenis_pelatihan.sql
```

---

# 12. Public Folder

```
public/

images/

icons/

css/

js/

fonts/
```

---

# 13. Storage

```
storage/

uploads/

avatars/

documents/

temp/
```

Catatan:

File produksi tetap berada di Supabase Storage.

Folder ini hanya digunakan untuk upload sementara (temporary upload) sebelum dipindahkan ke Supabase.

---

# 14. Tests

```
tests/

unit/

integration/

api/

fixtures/
```

---

# 15. Scripts

Berisi script otomatis.

```
scripts/

createAdmin.js

seedDatabase.js

backupDatabase.js

cleanupStorage.js
```

---

# 16. Logs

```
logs/

application.log

error.log
```

Folder ini tidak di-commit ke Git.

---

# 17. Naming Rules

Folder

camelCase

Contoh

masterData

roadmapKarier

unitKerja

File

camelCase

Contoh

pegawai.controller.js

pegawai.service.js

pegawai.repository.js

Variable

camelCase

Class

PascalCase

Constant

UPPER_SNAKE_CASE

---

# 18. Module Dependency

Module hanya boleh mengakses:

Shared

↓

Config

↓

Repository

↓

Database

Tidak boleh mengakses Repository milik module lain.

Jika membutuhkan data module lain,

gunakan Service.

Contoh:

Dokumen membutuhkan data Pegawai.

Benar:

DocumentService

↓

PegawaiService

Salah:

DocumentRepository

↓

PegawaiRepository

---

# 19. Layer Dependency

```
Routes

↓

Validation

↓

Controller

↓

Service

↓

Repository

↓

Supabase
```

Tidak boleh melompati layer.

---

# 20. Yang Tidak Diperbolehkan

❌ Query database di Controller

❌ Query database di Middleware

❌ Business Logic di Route

❌ Business Logic di Repository

❌ Hardcode credential

❌ Hardcode URL

❌ Folder baru tanpa dokumentasi

❌ Module saling bergantung langsung

---

# 21. AI Assistant Rules

AI Assistant wajib:

✓ Mengikuti struktur folder ini

✓ Menempatkan file pada module yang benar

✓ Tidak membuat folder baru tanpa alasan

✓ Tidak mengubah struktur project

✓ Menggunakan naming convention yang telah ditentukan

Jika terdapat perubahan struktur,

AI Assistant wajib memberikan alasan terlebih dahulu.

---

# 22. Definition of Done

Sebuah module dianggap selesai apabila memiliki:

✓ Route

✓ Validation

✓ Controller

✓ Service

✓ Repository

✓ Mapper

✓ Constant

✓ API Documentation

✓ Unit Test

✓ Integration Test