#!/usr/bin/env node
/**
 * Removal Job Worker
 *
 * Separate Node process that polls the removal_jobs table, claims pending
 * jobs using row-level locking, calls the Python inference service for
 * inpainting, and writes the result back to the database.
 *
 * Usage:
 *   node backend/src/worker.js
 *
 * Environment variables:
 *   DATABASE_URL          – MySQL connection string (required)
 *   INFERENCE_SERVICE_URL – Python inference service base URL (default: http://localhost:8000)
 *   WORKER_ID            – Unique identifier for this worker instance
 *   POLL_INTERVAL_MS     – How often to poll for new jobs (default: 2000)
 *   STUCK_JOB_TIMEOUT_MS – Max time a job can stay in 'processing' (default: 300000 = 5 min)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// --- Config ---
const INFERENCE_SERVICE_URL = process.env.INFERENCE_SERVICE_URL || 'http://localhost:8001';
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const STUCK_JOB_TIMEOUT_MS = Number(process.env.STUCK_JOB_TIMEOUT_MS || 300000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// --- Database ---
function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '3306', 10),
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
  };
}

const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 3,
  queueLimit: 0,
});

// --- Inference service calls ---
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

// --- Job processing ---
async function processJob(job) {
  console.log(`[${WORKER_ID}] Job ${job.id} started | photo_id=${job.photoId}`);

  // 1. Read the source photo
  const [photos] = await pool.execute(
    'SELECT id, file_url AS fileUrl FROM photos WHERE id = ?',
    [job.photoId],
  );
  if (photos.length === 0) throw new Error(`Photo ${job.photoId} not found`);

  const photo = photos[0];
  const imagePath = path.join(UPLOAD_DIR, path.basename(photo.fileUrl));
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');
  console.log(`[${WORKER_ID}] Job ${job.id} | Source photo ${job.photoId} loaded`);

  const ext = path.extname(photo.fileUrl).toLowerCase().replace('.', '');
  const mimeType = ext === 'jpg' ? 'jpeg' : ext;

  // 2. Read the mask file
  const maskPath = path.join(UPLOAD_DIR, path.basename(job.maskUrl));
  const maskBuffer = fs.readFileSync(maskPath);
  const maskBase64 = maskBuffer.toString('base64');
  console.log(`[${WORKER_ID}] Job ${job.id} | Mask loaded`);

  const maskExt = path.extname(job.maskUrl).toLowerCase().replace('.', '');
  const maskMime = maskExt === 'jpg' ? 'jpeg' : maskExt;

  // 3. Call the inpainting service
  console.log(`[${WORKER_ID}] Job ${job.id} | Calling /inpaint`);
  const result = await callInference('/inpaint', {
    image: `data:image/${mimeType};base64,${imageBase64}`,
    mask: `data:image/${maskMime};base64,${maskBase64}`,
  });
  console.log(`[${WORKER_ID}] Job ${job.id} | Inpainting completed`);

  // 4. Save the result image
  const resultBase64 = result.result.replace(/^data:image\/\w+;base64,/, '');
  const resultFilename = `cleaned-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.png`;
  const resultPath = path.join(UPLOAD_DIR, resultFilename);
  fs.writeFileSync(resultPath, Buffer.from(resultBase64, 'base64'));
  console.log(`[${WORKER_ID}] Job ${job.id} | Result saved to ${resultFilename}`);

  // 5. Create a new photo record for the result
  console.log(`[${WORKER_ID}] Job ${job.id} | Creating result photo`);
  const [projectRows] = await pool.execute(
    'SELECT project_id AS projectId FROM photos WHERE id = ?',
    [job.photoId],
  );
  if (projectRows.length === 0) throw new Error(`Photo ${job.photoId} has no project`);
  const projectId = projectRows[0].projectId;

  const [orderRows] = await pool.execute(
    'SELECT MAX(sort_order) AS maxSortOrder FROM photos WHERE project_id = ?',
    [projectId],
  );
  const nextOrder = (orderRows[0].maxSortOrder ?? -1) + 1;

  const [photoResult] = await pool.execute(
    'INSERT INTO photos (project_id, file_url, sort_order, source_photo_id, is_cleaned_variant) VALUES (?, ?, ?, ?, TRUE)',
    [projectId, `/uploads/${resultFilename}`, nextOrder, job.photoId],
  );

  const resultPhotoId = photoResult.insertId;
  console.log(`[${WORKER_ID}] Job ${job.id} | Result photo id=${resultPhotoId}`);

  // 6. Update the job as done
  await pool.execute(
    `UPDATE removal_jobs SET status = 'done', result_photo_id = ?, attempts = attempts + 1, updated_at = NOW() WHERE id = ?`,
    [resultPhotoId, job.id],
  );

  console.log(`[${WORKER_ID}] Job ${job.id} completed | result_photo_id=${resultPhotoId}`);
}

// --- Job claiming (row-level locking) ---
async function claimAndProcessNext() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, photo_id AS photoId, mask_url AS maskUrl
       FROM removal_jobs
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );

    if (rows.length === 0) {
      await connection.commit();
      return false;
    }

    const job = rows[0];

    await connection.execute(
      `UPDATE removal_jobs SET status = 'processing', locked_at = NOW(), locked_by = ?, attempts = attempts + 1 WHERE id = ?`,
      [WORKER_ID, job.id],
    );

    await connection.commit();

    // Process outside the transaction so slow inference doesn't hold the lock
    try {
      await processJob(job);
    } catch (err) {
      console.error(`[${WORKER_ID}] Job ${job.id} failed:`, err.message);
      await pool.execute(
        `UPDATE removal_jobs SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [err.message.substring(0, 500), job.id],
      );
    }

    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// --- Stuck job sweep ---
async function sweepStuckJobs() {
  const timeoutSeconds = Math.floor(STUCK_JOB_TIMEOUT_MS / 1000);
  const [result] = await pool.execute(
    `UPDATE removal_jobs
     SET status = 'failed', error_message = 'Job timed out — processing took too long.', updated_at = NOW()
     WHERE status = 'processing'
       AND locked_at < DATE_SUB(NOW(), INTERVAL ? SECOND)`,
    [timeoutSeconds],
  );
  if (result.affectedRows > 0) {
    console.log(`[${WORKER_ID}] Marked ${result.affectedRows} stuck job(s) as failed`);
  }
}

// --- Main loop ---
let running = true;

async function loop() {
  console.log(`[${WORKER_ID}] Job worker started. Polling every ${POLL_INTERVAL_MS}ms.`);

  let lastSweep = Date.now();
  const SWEEP_INTERVAL_MS = 60000; // sweep every 60 seconds

  while (running) {
    try {
      const processed = await claimAndProcessNext();
      if (!processed) {
        // Nothing to do — sleep before next poll
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      // Periodic stuck-job sweep
      if (Date.now() - lastSweep > SWEEP_INTERVAL_MS) {
        await sweepStuckJobs();
        lastSweep = Date.now();
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] Worker loop error:`, err.message);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    }
  }
}

// --- Graceful shutdown ---
function shutdown(signal) {
  console.log(`[${WORKER_ID}] received ${signal}, shutting down...`);
  running = false;
  setTimeout(async () => {
    await pool.end();
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Start ---
loop().catch(async (err) => {
  console.error(`[${WORKER_ID}] Fatal error:`, err);
  await pool.end();
  process.exit(1);
});
