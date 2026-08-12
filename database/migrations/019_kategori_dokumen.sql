CREATE TABLE kategori_dokumen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kategori VARCHAR(150) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_kategori_dokumen_updated_at
    BEFORE UPDATE ON kategori_dokumen
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
