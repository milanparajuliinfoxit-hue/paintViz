const pool = require('../lib/db');
const fs = require('fs');
const path = require('path');
const { ApiError } = require('../middleware/errorHandler');
const { UPLOAD_DIR } = require('../middleware/upload');

const PHOTO_COLUMNS = 'id, project_id AS projectId, file_url AS fileUrl, sort_order AS sortOrder, uploaded_at AS uploadedAt, source_photo_id AS sourcePhotoId, is_cleaned_variant AS isCleanedVariant';

// POST /api/projects/:id/photos  (multipart, field "photos")
async function upload(req, res, next) {
  try {
    const projectId = Number(req.params.id);
    const [projects] = await pool.execute('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) throw new ApiError(404, 'Project not found', 'NOT_FOUND');

    const files = req.files || [];
    if (files.length === 0) {
      throw new ApiError(400, 'No files uploaded.', 'VALIDATION_ERROR');
    }

    const [orderRows] = await pool.execute(
      'SELECT MAX(sort_order) AS maxSortOrder FROM photos WHERE project_id = ?',
      [projectId],
    );
    let nextOrder = (orderRows[0].maxSortOrder ?? -1) + 1;

    const created = [];
    for (const file of files) {
      const [result] = await pool.execute(
        'INSERT INTO photos (project_id, file_url, sort_order) VALUES (?, ?, ?)',
        [projectId, `/uploads/${file.filename}`, nextOrder++],
      );
      const [rows] = await pool.execute(
        `SELECT ${PHOTO_COLUMNS} FROM photos WHERE id = ?`,
        [result.insertId],
      );
      created.push(rows[0]);
    }

    res.status(201).json({ data: created, error: null });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [photos] = await pool.execute('SELECT id, file_url AS fileUrl FROM photos WHERE id = ?', [id]);
    if (photos.length === 0) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');
    const photo = photos[0];

    await pool.execute('DELETE FROM photos WHERE id = ?', [id]);

    const filePath = path.join(UPLOAD_DIR, path.basename(photo.fileUrl));
    fs.unlink(filePath, () => {});

    res.json({ data: { id }, error: null });
  } catch (err) {
    next(err);
  }
}

async function bulkDelete(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids must be a non-empty array.', 'VALIDATION_ERROR');
    }
    const numericIds = ids.map(Number);
    const [photos] = await pool.execute('SELECT id, file_url AS fileUrl FROM photos WHERE id IN (?)', [numericIds]);

    await pool.execute('DELETE FROM photos WHERE id IN (?)', [numericIds]);

    photos.forEach((photo) => {
      const filePath = path.join(UPLOAD_DIR, path.basename(photo.fileUrl));
      fs.unlink(filePath, () => {});
    });

    res.json({ data: { count: photos.length }, error: null });
  } catch (err) {
    next(err);
  }
}

// PUT /api/photos/reorder { photoIds: [ordered ids] }
async function reorder(req, res, next) {
  try {
    const { photoIds } = req.body;
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw new ApiError(400, 'photoIds must be a non-empty array.', 'VALIDATION_ERROR');
    }
    await pool.withTransaction(async (conn) => {
      for (let i = 0; i < photoIds.length; i++) {
        await conn.execute('UPDATE photos SET sort_order = ? WHERE id = ?', [i, Number(photoIds[i])]);
      }
    });
    res.json({ data: { updated: photoIds.length }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, remove, bulkDelete, reorder };
