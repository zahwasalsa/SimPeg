-- Tabel penghubung many-to-many antara penelitian dan anggota tim. Adaptasi
-- dari `research_members` pada blueprint §17 (nama tabel disesuaikan ke
-- konvensi tunggal proyek ini). Pemilik/pengusul penelitian sudah tercatat
-- lewat `penelitian.pegawai_id` — tabel ini untuk anggota TAMBAHAN di luar
-- pengusul (rekan tim), sehingga satu penelitian bisa dikerjakan lebih dari
-- satu pegawai.
CREATE TABLE anggota_penelitian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penelitian_id UUID NOT NULL REFERENCES penelitian (id) ON DELETE CASCADE,
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_anggota_penelitian_penelitian_pegawai UNIQUE (penelitian_id, pegawai_id)
);

CREATE INDEX idx_anggota_penelitian_penelitian_id ON anggota_penelitian (penelitian_id);
CREATE INDEX idx_anggota_penelitian_pegawai_id ON anggota_penelitian (pegawai_id);

CREATE TRIGGER trg_anggota_penelitian_updated_at
    BEFORE UPDATE ON anggota_penelitian
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
