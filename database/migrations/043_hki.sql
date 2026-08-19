-- FR-RES-004: menginput kekayaan intelektual (HKI). Blueprint hanya
-- menyebut requirement ini di daftar FR — TIDAK ADA definisi tabel `hki`
-- sama sekali di data dictionary §17 (beda dari `research_projects`/
-- `publications` yang memang didefinisikan blueprint). Skema di bawah ini
-- sepenuhnya keputusan desain eksplisit, dibuat seminimal mungkin:
--   - judul, jenis (teks bebas — Paten/Hak Cipta/Merek/dst, tidak dipaksakan
--     jadi ENUM karena blueprint tidak memberi daftar tetap)
--   - nomor_pendaftaran, tanggal_pendaftaran (nullable — HKI yang baru
--     diajukan mungkin belum punya nomor resmi)
--   - penelitian_id nullable (opsional) — HKI tidak selalu lahir dari satu
--     proyek penelitian tercatat, jadi tidak dipaksakan wajib terhubung,
--     mengikuti pola nullable FK yang sama seperti
--     roadmap_karier.jabatan_saat_ini_id/jabatan_target_id.
CREATE TABLE hki (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    penelitian_id UUID REFERENCES penelitian (id) ON DELETE SET NULL,
    judul VARCHAR(300) NOT NULL,
    jenis VARCHAR(100),
    nomor_pendaftaran VARCHAR(100),
    tanggal_pendaftaran DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_hki_pegawai_id ON hki (pegawai_id);
CREATE INDEX idx_hki_penelitian_id ON hki (penelitian_id);

CREATE TRIGGER trg_hki_updated_at
    BEFORE UPDATE ON hki
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
