-- FR-KPI-002..004: rincian KPI per indikator (kpi.percentage dihitung Service
-- layer dari data di tabel ini bila kpi_detail tersedia untuk kpi tersebut).
CREATE TABLE kpi_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES kpi (id) ON DELETE CASCADE,
    indicator VARCHAR(200) NOT NULL,
    target NUMERIC NOT NULL,
    realization NUMERIC NOT NULL DEFAULT 0,
    weight NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_kpi_detail_kpi_id ON kpi_detail (kpi_id);

CREATE TRIGGER trg_kpi_detail_updated_at
    BEFORE UPDATE ON kpi_detail
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
