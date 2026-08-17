-- FR-DOC-010: single-step approval by admin/hrd, mirroring cuti's
-- approve/reject pattern exactly (status + disetujui_oleh + tanggal_persetujuan
-- + catatan_approval). `status` is nullable: NULL means the dokumen's
-- kategori is not `wajib_approval`, so no approval workflow applies at all —
-- this also keeps every dokumen uploaded before this migration untouched
-- (no retroactive approval requirement).
ALTER TABLE dokumen
    ADD COLUMN status VARCHAR(30)
        CHECK (status IN ('menunggu_persetujuan', 'disetujui', 'ditolak')),
    ADD COLUMN disetujui_oleh UUID REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN tanggal_persetujuan TIMESTAMPTZ,
    ADD COLUMN catatan_approval TEXT;
