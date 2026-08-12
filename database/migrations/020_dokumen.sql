CREATE TABLE dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    kategori_dokumen_id UUID REFERENCES kategori_dokumen (id) ON DELETE SET NULL,
    nama_dokumen VARCHAR(200) NOT NULL,
    nama_file_asli VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    bucket VARCHAR(100) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    ukuran_file BIGINT NOT NULL,
    diunggah_oleh UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_dokumen_pegawai_id ON dokumen (pegawai_id);
CREATE INDEX idx_dokumen_kategori_dokumen_id ON dokumen (kategori_dokumen_id);

CREATE TRIGGER trg_dokumen_updated_at
    BEFORE UPDATE ON dokumen
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
