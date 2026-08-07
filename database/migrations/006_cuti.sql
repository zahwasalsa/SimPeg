CREATE TABLE cuti (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    jenis_cuti VARCHAR(50) NOT NULL
        CHECK (jenis_cuti IN ('cuti_tahunan', 'cuti_sakit', 'cuti_melahirkan', 'cuti_besar', 'cuti_alasan_penting')),
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    jumlah_hari INTEGER GENERATED ALWAYS AS ((tanggal_selesai - tanggal_mulai) + 1) STORED,
    alasan TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'diajukan'
        CHECK (status IN ('diajukan', 'disetujui', 'ditolak', 'dibatalkan')),
    disetujui_oleh UUID REFERENCES users (id) ON DELETE SET NULL,
    tanggal_persetujuan TIMESTAMPTZ,
    catatan_approval TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_cuti_tanggal CHECK (tanggal_selesai >= tanggal_mulai)
);

CREATE INDEX idx_cuti_pegawai_id ON cuti (pegawai_id);
CREATE INDEX idx_cuti_status ON cuti (status);

CREATE TRIGGER trg_cuti_updated_at
    BEFORE UPDATE ON cuti
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
