CREATE TABLE jabatan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_jabatan VARCHAR(150) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_jabatan_updated_at
    BEFORE UPDATE ON jabatan
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
