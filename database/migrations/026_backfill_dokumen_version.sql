-- Backfills version 1 for every existing `dokumen` row (including soft-deleted
-- ones) using the file metadata already stored on that row. No new Storage
-- objects are created — file_path/bucket point at the same physical file
-- that was already uploaded during Stage 4A.
-- Idempotent: safe to re-run, the NOT EXISTS guard skips rows that already
-- have a version 1 record.

INSERT INTO dokumen_version (
    dokumen_id, nomor_versi, nama_file_asli, file_path, bucket, mime_type, ukuran_file, diunggah_oleh, created_at
)
SELECT
    d.id, 1, d.nama_file_asli, d.file_path, d.bucket, d.mime_type, d.ukuran_file, d.diunggah_oleh, d.created_at
FROM dokumen d
WHERE NOT EXISTS (
    SELECT 1 FROM dokumen_version dv WHERE dv.dokumen_id = d.id AND dv.nomor_versi = 1
);

UPDATE dokumen SET versi_aktif = 1 WHERE versi_aktif IS DISTINCT FROM 1;
