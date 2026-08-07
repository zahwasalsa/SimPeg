CREATE TABLE pegawai (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
    divisi_id UUID REFERENCES divisi (id) ON DELETE SET NULL,
    jabatan_id UUID REFERENCES jabatan (id) ON DELETE SET NULL,
    nip VARCHAR(30) NOT NULL UNIQUE,
    nama_lengkap VARCHAR(200) NOT NULL,
    jenis_kelamin VARCHAR(20) CHECK (jenis_kelamin IN ('Laki-laki', 'Perempuan')),
    tempat_lahir VARCHAR(100),
    tanggal_lahir DATE,
    alamat TEXT,
    no_telepon VARCHAR(30),
    tanggal_masuk DATE,
    status_kepegawaian VARCHAR(30) NOT NULL DEFAULT 'aktif'
        CHECK (status_kepegawaian IN ('aktif', 'nonaktif', 'pensiun')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pegawai_user_id ON pegawai (user_id);
CREATE INDEX idx_pegawai_divisi_id ON pegawai (divisi_id);
CREATE INDEX idx_pegawai_jabatan_id ON pegawai (jabatan_id);
CREATE INDEX idx_pegawai_nip ON pegawai (nip);

CREATE TRIGGER trg_pegawai_updated_at
    BEFORE UPDATE ON pegawai
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
