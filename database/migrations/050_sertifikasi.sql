-- FR-CERT-001/002/003/004: data sertifikasi kompetensi pegawai beserta
-- berkas sertifikat dan tanggal masa berlaku. Adaptasi dari `certifications`
-- pada blueprint §18 (nama tabel & kolom disesuaikan ke konvensi tunggal
-- proyek ini, sama seperti `documents` → `dokumen`).
--
-- Kolom yang TIDAK ada di draft blueprint (§18) dan merupakan keputusan
-- desain eksplisit di sini:
--   - nama_sertifikat: blueprint's `certifications` hanya punya
--     employee_id/certificate_type_id/issuer/issue_date/expired_date, tidak
--     ada judul/nama sertifikat sendiri. Tanpa ini, dua sertifikat dengan
--     jenis yang sama (mis. dua "Kompetensi Dosen" di tahun berbeda) tidak
--     bisa dibedakan di UI/daftar riwayat (FR-CERT-004).
--   - nomor_sertifikat: nullable, mengikuti pola hki.nomor_pendaftaran —
--     identitas resmi yang berguna untuk verifikasi tapi mungkin belum ada.
--   - nama_file_asli/file_path/bucket/mime_type/ukuran_file: blueprint's
--     draft schema untuk `certifications` TIDAK punya kolom berkas sama
--     sekali, padahal FR-CERT-002 eksplisit mensyaratkan upload dokumen
--     sertifikat. Diputuskan sertifikasi punya kolom berkas sendiri (satu
--     berkas per baris, tanpa versioning — FR-CERT tidak pernah menyebut
--     versioning untuk sertifikat, berbeda dari FR-DOC-004 untuk dokumen)
--     alih-alih mereferensikan tabel `dokumen` yang sudah ada, supaya alur
--     "Tambah Sertifikat" tetap satu langkah (create + upload sekaligus,
--     sama seperti pola POST /dokumen) — bukan dua langkah terpisah yang
--     tidak diminta blueprint/roadmap manapun. Berkas diwajibkan saat
--     membuat data (bukan alur "isi metadata dulu, upload nanti"), mengikuti
--     pola POST /dokumen yang sudah ada.
--
-- tanggal_berakhir nullable — tidak semua sertifikat punya masa berlaku
-- (mis. sertifikat kelulusan), mengikuti pola dokumen.tanggal_kedaluwarsa.
-- Tidak ada kolom status (aktif/kedaluwarsa) tersimpan — blueprint §21
-- "Nilai Status (Enum) per Tabel" TIDAK mencantumkan `certifications` sama
-- sekali (berbeda dari kpis/career_roadmaps yang eksplisit didaftar), jadi
-- "Expired" ditafsirkan sebagai status turunan dari tanggal_berakhir <
-- tanggal hari ini, dihitung saat query/tampil — bukan kolom baru. Persis
-- pola yang sudah dipakai untuk `penelitian` (tidak ada kolom status/progress
-- tersimpan, lihat docs/database.md §15).
CREATE TABLE sertifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    jenis_sertifikasi_id UUID REFERENCES jenis_sertifikasi (id) ON DELETE SET NULL,
    nama_sertifikat VARCHAR(300) NOT NULL,
    penerbit VARCHAR(300),
    nomor_sertifikat VARCHAR(150),
    tanggal_terbit DATE,
    tanggal_berakhir DATE,
    nama_file_asli VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    bucket VARCHAR(100) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    ukuran_file BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_sertifikasi_pegawai_id ON sertifikasi (pegawai_id);
CREATE INDEX idx_sertifikasi_jenis_sertifikasi_id ON sertifikasi (jenis_sertifikasi_id);

-- FR-CERT-003: reminder masa berlaku. Partial index (mengikuti pola
-- idx_dokumen_tanggal_kedaluwarsa di 031_dokumen_add_tanggal_kedaluwarsa.sql)
-- menjaga query reminder (WHERE tanggal_berakhir IS NOT NULL AND ... <=
-- threshold) tetap murah tanpa mengindeks kasus NULL yang umum.
CREATE INDEX idx_sertifikasi_tanggal_berakhir
    ON sertifikasi (tanggal_berakhir)
    WHERE tanggal_berakhir IS NOT NULL;

CREATE TRIGGER trg_sertifikasi_updated_at
    BEFORE UPDATE ON sertifikasi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
