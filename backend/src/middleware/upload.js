const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ApiError } = require('./errorHandler');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 15);

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXCEL_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    cb(new ApiError(400, `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP.`, 'INVALID_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

function excelFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.xlsx', '.xls'].includes(ext)) {
    cb(new ApiError(400, `Unsupported file type: ${ext}. Allowed: .xlsx, .xls.`, 'INVALID_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: excelFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR, excelUpload };
