const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');
const { UPLOAD_DIR } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const INFERENCE_SERVICE_URL = process.env.INFERENCE_SERVICE_URL || 'http://localhost:8001';

const PHOTO_COLUMNS = 'id, project_id AS projectId, file_url AS fileUrl, sort_order AS sortOrder, uploaded_at AS uploadedAt, source_photo_id AS sourcePhotoId, is_cleaned_variant AS isCleanedVariant';

async function callInference(endpoint, body) {
  const response = await fetch(`${INFERENCE_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Inference service error (${response.status}): ${text}`);
  }
  return response.json();
}

function validateMaskNonTrivial(maskBase64) {
  // Decode the base64 mask (expected to be a PNG data URL or raw base64)
  let base64Data = maskBase64;
  if (maskBase64.startsWith('data:')) {
    base64Data = maskBase64.split(',')[1];
  }
  const buffer = Buffer.from(base64Data, 'base64');

  // Minimum size check: at least 500 bytes (a trivial mask would be very small)
  if (buffer.length < 500) {
    return false;
  }

  return true;
}

// POST /api/photos/:id/segment-point
async function segmentPoint(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const { x, y } = req.body;

    if (x == null || y == null) {
      throw new ApiError(400, 'x and y coordinates are required.', 'VALIDATION_ERROR');
    }

    const [photos] = await pool.execute(
      `SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?`,
      [photoId],
    );
    if (photos.length === 0) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');

    const photo = photos[0];
    const imagePath = path.join(UPLOAD_DIR, path.basename(photo.fileUrl));
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBase64 = imageBuffer.toString('base64');

    const ext = path.extname(photo.fileUrl).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;

    const result = await callInference('/segment', {
      image: `data:image/${mimeType};base64,${imageBase64}`,
      point: [Math.round(x), Math.round(y)],
    });

    res.json({ data: { maskPreviewUrl: result.mask }, error: null });
  } catch (err) {
    next(err);
  }
}

// POST /api/photos/:id/mask/refine
async function refineMask(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const { maskDataUrl } = req.body;

    if (!maskDataUrl) {
      throw new ApiError(400, 'maskDataUrl is required.', 'VALIDATION_ERROR');
    }

    const [photos] = await pool.execute(
      `SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?`,
      [photoId],
    );
    if (photos.length === 0) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');

    // Store the refined mask and return it as-is (the frontend composites brush strokes)
    res.json({ data: { maskPreviewUrl: maskDataUrl }, error: null });
  } catch (err) {
    next(err);
  }
}

// POST /api/photos/:id/removal-jobs
async function createJob(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const { maskDataUrl } = req.body;
    console.log(`[RemovalJob] Request received photo_id=${photoId} maskDataType=${typeof maskDataUrl}`);

    if (!maskDataUrl || typeof maskDataUrl !== 'string') {
      throw new ApiError(400, 'maskDataUrl is required and must be a string.', 'VALIDATION_ERROR');
    }

    if (!validateMaskNonTrivial(maskDataUrl)) {
      throw new ApiError(400, 'The selection is too small or empty. Please select a larger area.', 'MASK_EMPTY');
    }

    const [photos] = await pool.execute(
      `SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?`,
      [photoId],
    );
    if (photos.length === 0) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');
    console.log(`[RemovalJob] Photo found id=${photoId}`);

    // NFR-10: one active job per photo
    const [activeJobs] = await pool.execute(
      `SELECT id FROM removal_jobs WHERE photo_id = ? AND status IN ('pending', 'processing') LIMIT 1`,
      [photoId],
    );
    if (activeJobs.length > 0) {
      throw new ApiError(409, 'A removal job is already in progress for this photo.', 'JOB_EXISTS');
    }

    // Save mask as a file
    let base64Data = maskDataUrl;
    let ext = 'png';
    if (maskDataUrl.startsWith('data:')) {
      const match = maskDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (match) {
        ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        base64Data = match[2];
      }
    }
    const maskFilename = `mask-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const maskPath = path.join(UPLOAD_DIR, maskFilename);
    fs.writeFileSync(maskPath, Buffer.from(base64Data, 'base64'));

    const maskUrl = `/uploads/${maskFilename}`;
    console.log(`[RemovalJob] Mask saved ${maskPath}`);

    const [result] = await pool.execute(
      `INSERT INTO removal_jobs (photo_id, mask_url, status) VALUES (?, ?, 'pending')`,
      [photoId, maskUrl],
    );

    const jobId = result.insertId;
    console.log(`[RemovalJob] Job created id=${jobId} photo_id=${photoId}`);

    res.status(201).json({
      data: { jobId, status: 'pending' },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/removal-jobs/:jobId
async function getJob(req, res, next) {
  try {
    const jobId = Number(req.params.jobId);

    const [jobs] = await pool.execute(
      `SELECT
        id, photo_id AS photoId, mask_url AS maskUrl, status,
        result_photo_id AS resultPhotoId, error_message AS errorMessage,
        attempts, created_at AS createdAt, updated_at AS updatedAt
       FROM removal_jobs WHERE id = ?`,
      [jobId],
    );
    if (jobs.length === 0) throw new ApiError(404, 'Job not found', 'NOT_FOUND');

    const job = jobs[0];

    let resultPhoto = null;
    if (job.resultPhotoId) {
      const [rows] = await pool.execute(
        `SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?`,
        [job.resultPhotoId],
      );
      resultPhoto = rows[0] || null;
    }

    res.json({
      data: {
        id: job.id,
        status: job.status,
        resultPhoto,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/removal-jobs/:jobId/retry
async function retryJob(req, res, next) {
  try {
    const jobId = Number(req.params.jobId);

    const [jobs] = await pool.execute(
      `SELECT id, photo_id AS photoId, mask_url AS maskUrl, status FROM removal_jobs WHERE id = ?`,
      [jobId],
    );
    if (jobs.length === 0) throw new ApiError(404, 'Job not found', 'NOT_FOUND');

    const job = jobs[0];
    if (job.status !== 'failed') {
      throw new ApiError(400, 'Only failed jobs can be retried.', 'VALIDATION_ERROR');
    }

    // Create a new job row (don't mutate the failed one per spec)
    const [result] = await pool.execute(
      `INSERT INTO removal_jobs (photo_id, mask_url, status) VALUES (?, ?, 'pending')`,
      [job.photoId, job.maskUrl],
    );

    res.status(201).json({
      data: { jobId: result.insertId, status: 'pending' },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/photos/:id/removal-jobs
async function listJobsForPhoto(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const { status } = req.query;

    let query = `SELECT id, status, result_photo_id AS resultPhotoId, created_at AS createdAt FROM removal_jobs WHERE photo_id = ?`;
    const params = [photoId];

    if (status) {
      const statuses = status.split(',');
      query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
      params.push(...statuses);
    }

    query += ' ORDER BY created_at DESC';

    const [jobs] = await pool.execute(query, params);

    res.json({ data: jobs, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  segmentPoint,
  refineMask,
  createJob,
  getJob,
  retryJob,
  listJobsForPhoto,
};
