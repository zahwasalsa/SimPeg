CREATE TABLE absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    jam_masuk TIME,
    jam_keluar TIME,
    status VARCHAR(20) NOT NULL DEFAULT 'hadir'
        CHECK (status IN ('hadir', 'izin', 'sakit', 'alpha', 'cuti')),
    keterangan TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_absensi_pegawai_tanggal UNIQUE (pegawai_id, tanggal),
    CONSTRAINT chk_absensi_jam CHECK (jam_keluar IS NULL OR jam_masuk IS NULL OR jam_keluar >= jam_masuk)
);

CREATE INDEX idx_absensi_pegawai_id ON absensi (pegawai_id);
CREATE INDEX idx_absensi_tanggal ON absensi (tanggal);
CREATE INDEX idx_absensi_status ON absensi (status);

CREATE TRIGGER trg_absensi_updated_at
    BEFORE UPDATE ON absensi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
