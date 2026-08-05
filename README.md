# Sistem Pengembangan Karier dan Kinerja Pegawai

Platform digital pendamping (companion system) untuk pengembangan karier dan pemantauan kinerja
dosen dan tenaga kependidikan. Lihat [`docs/blueprint.pdf`](docs/blueprint.pdf) untuk gambaran bisnis
lengkap dan `docs/*.md` untuk aturan teknis project.

## Tech Stack

- Backend: Node.js, Express.js
- Database: PostgreSQL (Supabase)
- Auth: JWT + Role Based Access Control
- Storage: Supabase Storage
- Frontend: HTML5, CSS3, Bootstrap 5, Vanilla JavaScript (ES6)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env` dan isi kredensial Supabase & JWT:

   ```bash
   cp .env.example .env
   ```

3. Jalankan dalam mode development:

   ```bash
   npm run dev
   ```

4. Cek server berjalan:

   ```bash
   curl http://localhost:3000/health
   ```

## Scripts

| Script          | Fungsi                                |
| --------------- | -------------------------------------- |
| `npm run dev`   | Menjalankan server dengan nodemon      |
| `npm start`     | Menjalankan server (production)        |
| `npm run lint`  | Menjalankan ESLint                     |
| `npm run format`| Menjalankan Prettier (write)           |
| `npm test`      | Menjalankan test suite                 |

## Struktur Project

Struktur folder mengikuti [`docs/folder_structure.md`](docs/folder_structure.md) dan wajib dipatuhi oleh
seluruh kontributor (termasuk AI Assistant). Setiap module bisnis berada di `src/modules/<namaModule>`
dengan layer: routes → validation → controller → service → repository.

Dokumen acuan wajib dibaca sebelum menambah fitur:

1. `docs/blueprint.pdf` — Business Requirement
2. `docs/project_rules.md` — Project Rules
3. `docs/architecture.md` — System Architecture
4. `docs/database.md` — Database Design
5. `docs/api.md` — API Specification
6. `docs/coding_standard.md` — Coding Standard
7. `docs/folder_structure.md` — Folder Structure
8. `docs/roadmap.md` — Development Roadmap
