-- FR-KPI-001..005: target/capaian KPI per pegawai per periode. `percentage`
-- dan `status` BUKAN generated column — dihitung dan ditulis oleh Service
-- layer (bukan SQL), karena blueprint tidak menetapkan ambang batas numerik
-- untuk status on_track/at_risk/achieved (lihat docs/database.md).
CREATE TABLE kpi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pegawai_id UUID NOT NULL REFERENCES pegawai (id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL,
    target NUMERIC NOT NULL,
    achievement NUMERIC NOT NULL DEFAULT 0,
    percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'on_track', 'at_risk', 'achieved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_kpi_pegawai_period UNIQUE (pegawai_id, period)
);

CREATE INDEX idx_kpi_pegawai_id ON kpi (pegawai_id);
CREATE INDEX idx_kpi_status ON kpi (status);
CREATE INDEX idx_kpi_period ON kpi (period);

CREATE TRIGGER trg_kpi_updated_at
    BEFORE UPDATE ON kpi
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
