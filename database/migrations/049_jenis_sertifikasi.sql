-- Data master "Jenis Sertifikasi" (FR-CERT §16.9, referensi certificate_types
-- pada blueprint §18/§18 Data Master). Direncanakan sejak Phase 2 (Master
-- Data) di docs/roadmap.md tapi belum pernah dibangun saat itu — dibuat
-- sekarang karena baru menjadi dependency nyata untuk `sertifikasi`.
-- Mengikuti pola persis kategori_dokumen (019_kategori_dokumen.sql).
CREATE TABLE jenis_sertifikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_jenis VARCHAR(150) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_jenis_sertifikasi_updated_at
    BEFORE UPDATE ON jenis_sertifikasi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
