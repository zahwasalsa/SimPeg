-- FR-DOC-010: some documents require approval before being valid. Whether a
-- category requires approval is decided per-category (design decision:
-- Document Approval & Reminder, approved 2026-08), not per individual
-- document or per uploader role.
ALTER TABLE kategori_dokumen
    ADD COLUMN wajib_approval BOOLEAN NOT NULL DEFAULT FALSE;
