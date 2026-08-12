CREATE TABLE dokumen_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dokumen_id UUID NOT NULL REFERENCES dokumen (id) ON DELETE CASCADE,
    nomor_versi INTEGER NOT NULL,
    nama_file_asli VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    bucket VARCHAR(100) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    ukuran_file BIGINT NOT NULL,
    diunggah_oleh UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dokumen_version_nomor_versi UNIQUE (dokumen_id, nomor_versi)
);

CREATE INDEX idx_dokumen_version_dokumen_id ON dokumen_version (dokumen_id);

CREATE TRIGGER trg_dokumen_version_updated_at
    BEFORE UPDATE ON dokumen_version
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
