-- FR-RES-001/002/005: target penelitian, data hibah, dan pemantauan progres
-- penelitian per pegawai. Adaptasi dari `research_projects` pada blueprint
-- §17 (nama tabel disesuaikan ke konvensi tunggal proyek ini, sama seperti
-- `documents` → `dokumen`, `kpis` → `kpi`).
--
-- FR-RES-001 ("menginput target penelitian") tidak diberi kolom `target`
-- terpisah oleh blueprint — draft schema-nya hanya punya title/scheme/
-- funding/year. Ditafsirkan di sini sebagai: proyek penelitian itu sendiri
-- (judul, skema, tahun) ADALAH targetnya, bukan angka target terpisah,
-- karena blueprint tidak memberi indikasi ukuran/satuan target apa pun.
-- Tidak ada kolom `status`/progress numerik untuk FR-RES-005 — blueprint's
-- daftar ENUM per tabel (§21) tidak menyertakan `research_projects`,
-- berbeda dari `kpis`/`career_roadmaps` yang eksplisit didaftar. "Memantau
-- progres" ditafsirkan sebagai kemampuan melihat daftar/riwayat penelitian
-- pegawai dari waktu ke waktu, bukan field status baru yang tidak diminta.
CREATE TABLE penelitian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    judul VARCHAR(300) NOT NULL,
    skema VARCHAR(200),
    dana NUMERIC,
    tahun INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_penelitian_pegawai_id ON penelitian (pegawai_id);
CREATE INDEX idx_penelitian_tahun ON penelitian (tahun);

CREATE TRIGGER trg_penelitian_updated_at
    BEFORE UPDATE ON penelitian
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
