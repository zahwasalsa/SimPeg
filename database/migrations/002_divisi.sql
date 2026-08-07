CREATE TABLE divisi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_divisi VARCHAR(150) NOT NULL UNIQUE,
    deskripsi TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER trg_divisi_updated_at
    BEFORE UPDATE ON divisi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
