const multer = require("multer");
const AppError = require("../../shared/exceptions/appError");

// FR-DOC-007 / FR-DOC-008: allowed types and max size for uploaded documents.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError(`Tipe berkas ${file.mimetype} tidak didukung`, 422));
      return;
    }
    cb(null, true);
  },
});

// Wraps multer so its errors (file-too-large, wrong field, rejected mime
// type) surface as the same AppError-shaped JSON response every other
// endpoint uses, instead of falling through to a generic 500.
const uploadSingleFile = (req, res, next) => {
  multerUpload.single("file")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      next(
        new AppError(`Ukuran berkas melebihi batas maksimum (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB)`, 422),
      );
      return;
    }
    if (err instanceof multer.MulterError) {
      next(new AppError(`Gagal mengunggah berkas: ${err.message}`, 422));
      return;
    }
    next(err);
  });
};

module.exports = { uploadSingleFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
