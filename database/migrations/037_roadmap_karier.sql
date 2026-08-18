-- FR-CAREER-001..005: posisi saat ini, jenjang berikutnya, persyaratan promosi,
-- dan progres pemenuhan persyaratan per pegawai. Adaptasi dari `career_roadmaps`
-- pada blueprint §17 (nama tabel disesuaikan ke konvensi tunggal proyek ini,
-- sama seperti `documents` → `dokumen`, `kpis` → `kpi`). Blueprint hanya
-- mendefinisikan satu tabel untuk modul ini (tidak ada tabel child/detail
-- seperti `kpi_detail`).
CREATE TABLE roadmap_karier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    jabatan_saat_ini_id UUID REFERENCES jabatan (id) ON DELETE SET NULL,
    jabatan_target_id UUID REFERENCES jabatan (id) ON DELETE SET NULL,
    -- FR-CAREER-003: blueprint tidak mendefinisikan kolom terpisah untuk
    -- "persyaratan promosi" pada tabel `career_roadmaps` — hanya field
    -- `progress` (NUMERIC) yang merepresentasikan pemenuhannya (FR-CAREER-004).
    -- Kolom teks bebas ini adalah keputusan desain eksplisit (bukan bagian
    -- draft blueprint) supaya FR-CAREER-003 tetap punya data untuk
    -- ditampilkan, mengikuti pola `catatan_approval` TEXT yang sudah dipakai
    -- di modul lain untuk keterangan bebas — bukan skema persyaratan
    -- terstruktur, karena blueprint tidak merincikannya.
    persyaratan TEXT,
    progress NUMERIC(5,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'eligible', 'promoted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_roadmap_karier_pegawai_id ON roadmap_karier (pegawai_id);
CREATE INDEX idx_roadmap_karier_status ON roadmap_karier (status);
CREATE INDEX idx_roadmap_karier_jabatan_target_id ON roadmap_karier (jabatan_target_id);

CREATE TRIGGER trg_roadmap_karier_updated_at
    BEFORE UPDATE ON roadmap_karier
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
