-- FR-RES-003: menginput publikasi hasil penelitian. Adaptasi dari
-- `publications` pada blueprint §17. Selalu terkait ke satu penelitian
-- (blueprint: "Proyek Penelitian → Publikasi, satu-ke-banyak") — tidak ada
-- publikasi tanpa penelitian induk, jadi `penelitian_id` wajib diisi.
CREATE TABLE publikasi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penelitian_id UUID NOT NULL REFERENCES penelitian (id) ON DELETE CASCADE,
    judul VARCHAR(300) NOT NULL,
    jurnal VARCHAR(300),
    terindeks BOOLEAN NOT NULL DEFAULT false,
    tahun INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_publikasi_penelitian_id ON publikasi (penelitian_id);
CREATE INDEX idx_publikasi_tahun ON publikasi (tahun);

CREATE TRIGGER trg_publikasi_updated_at
    BEFORE UPDATE ON publikasi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
