-- FR-DOC-009: reminder for documents nearing expiry. Nullable — most
-- document categories (e.g. ijazah) never expire; only set when the
-- uploader provides it. Partial index keeps the reminder query
-- (WHERE tanggal_kedaluwarsa IS NOT NULL AND ... <= threshold) cheap without
-- indexing the common NULL case.
ALTER TABLE dokumen
    ADD COLUMN tanggal_kedaluwarsa DATE;

CREATE INDEX idx_dokumen_tanggal_kedaluwarsa
    ON dokumen (tanggal_kedaluwarsa)
    WHERE tanggal_kedaluwarsa IS NOT NULL;
