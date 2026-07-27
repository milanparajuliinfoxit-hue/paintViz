#!/usr/bin/env node
/**
 * Retention Job – purges old masks and intermediate artifacts.
 *
 * Run on a schedule (e.g. daily cron). Masks are retained for
 * RETENTION_DAYS (default 30) after job completion, then the
 * mask_url is nulled out and the file is deleted.
 *
 * Usage:
 *   node backend/src/retention.js
 *
 * Environment:
 *   DATABASE_URL   – MySQL connection string
 *   UPLOAD_DIR     – Upload directory (default: ./uploads)
 *   RETENTION_DAYS – Days to keep masks (default: 30)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./lib/db');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 30);

async function purgeOldMasks() {
  console.log(`[retention] Purging masks older than ${RETENTION_DAYS} days...`);

  const [rows] = await pool.execute(
    `SELECT id, mask_url AS maskUrl
     FROM removal_jobs
     WHERE status IN ('done', 'failed')
       AND mask_url IS NOT NULL
       AND updated_at < DATE_SUB(NOW(), INTERVAL ? DAY)
     LIMIT 100`,
    [RETENTION_DAYS],
  );

  if (rows.length === 0) {
    console.log('[retention] No old masks to purge.');
    return;
  }

  let purged = 0;
  for (const row of rows) {
    try {
      const filePath = path.join(UPLOAD_DIR, path.basename(row.maskUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await pool.execute(
        'UPDATE removal_jobs SET mask_url = NULL WHERE id = ?',
        [row.id],
      );
      purged++;
    } catch (err) {
      console.error(`[retention] Failed to purge mask for job ${row.id}:`, err.message);
    }
  }

  console.log(`[retention] Purged ${purged} old mask(s).`);
}

async function main() {
  try {
    await purgeOldMasks();
  } catch (err) {
    console.error('[retention] Fatal error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
