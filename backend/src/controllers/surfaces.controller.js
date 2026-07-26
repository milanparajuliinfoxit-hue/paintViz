const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');

const VALID_LABELS = ['Wall', 'Roof', 'Trim', 'Door', 'Window', 'Ceiling', 'Other'];

const SURFACE_JOIN_COLUMNS = `s.id, s.photo_id AS photoId, s.label, s.custom_name AS customName,
  s.polygon_coords AS polygonCoords, s.color_id AS colorId,
  s.created_at AS createdAt, s.updated_at AS updatedAt,
  c.id AS c_id, c.name AS c_name, c.code AS c_code, c.hex AS c_hex,
  c.brand AS c_brand, c.finish AS c_finish, c.product_flags AS c_productFlags,
  c.is_active AS c_isActive, c.created_at AS c_createdAt, c.updated_at AS c_updatedAt`;

function assembleSurface(row) {
  return {
    id: row.id,
    photoId: row.photoId,
    label: row.label,
    customName: row.customName,
    polygonCoords: typeof row.polygonCoords === 'string' ? JSON.parse(row.polygonCoords) : row.polygonCoords,
    colorId: row.colorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    color: row.c_id != null ? {
      id: row.c_id,
      name: row.c_name,
      code: row.c_code,
      hex: row.c_hex,
      brand: row.c_brand,
      finish: row.c_finish,
      productFlags: typeof row.c_productFlags === 'string' ? JSON.parse(row.c_productFlags) : row.c_productFlags,
      isActive: row.c_isActive,
      createdAt: row.c_createdAt,
      updatedAt: row.c_updatedAt,
    } : null,
  };
}

async function listForPhoto(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT ${SURFACE_JOIN_COLUMNS} FROM surfaces s LEFT JOIN colors c ON c.id = s.color_id WHERE s.photo_id = ? ORDER BY s.created_at ASC`,
      [photoId],
    );
    res.json({ data: rows.map(assembleSurface), error: null });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const photoId = Number(req.params.id);
    const { label, custom_name, polygon_coords, color_id } = req.body;

    if (!label || !VALID_LABELS.includes(label)) {
      throw new ApiError(400, `label must be one of: ${VALID_LABELS.join(', ')}`, 'VALIDATION_ERROR');
    }
    if (!Array.isArray(polygon_coords) || polygon_coords.length < 3) {
      throw new ApiError(400, 'polygon_coords must be an array of at least 3 [x,y] points.', 'VALIDATION_ERROR');
    }

    const [photos] = await pool.execute('SELECT id FROM photos WHERE id = ?', [photoId]);
    if (photos.length === 0) throw new ApiError(404, 'Photo not found', 'NOT_FOUND');

    const [result] = await pool.execute(
      'INSERT INTO surfaces (photo_id, label, custom_name, polygon_coords, color_id) VALUES (?, ?, ?, ?, ?)',
      [photoId, label, custom_name || null, JSON.stringify(polygon_coords), color_id ? Number(color_id) : null],
    );

    const [rows] = await pool.execute(
      `SELECT ${SURFACE_JOIN_COLUMNS} FROM surfaces s LEFT JOIN colors c ON c.id = s.color_id WHERE s.id = ?`,
      [result.insertId],
    );

    res.status(201).json({ data: assembleSurface(rows[0]), error: null });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { label, custom_name, polygon_coords, color_id } = req.body;
    const updates = [];
    const params = [];

    if (label !== undefined) {
      if (!VALID_LABELS.includes(label)) {
        throw new ApiError(400, `label must be one of: ${VALID_LABELS.join(', ')}`, 'VALIDATION_ERROR');
      }
      updates.push('label = ?');
      params.push(label);
    }
    if (custom_name !== undefined) { updates.push('custom_name = ?'); params.push(custom_name); }
    if (polygon_coords !== undefined) {
      if (!Array.isArray(polygon_coords) || polygon_coords.length < 3) {
        throw new ApiError(400, 'polygon_coords must be an array of at least 3 [x,y] points.', 'VALIDATION_ERROR');
      }
      updates.push('polygon_coords = ?');
      params.push(JSON.stringify(polygon_coords));
    }
    if (color_id !== undefined) { updates.push('color_id = ?'); params.push(color_id ? Number(color_id) : null); }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE surfaces SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }

    const [rows] = await pool.execute(
      `SELECT ${SURFACE_JOIN_COLUMNS} FROM surfaces s LEFT JOIN colors c ON c.id = s.color_id WHERE s.id = ?`,
      [id],
    );

    res.json({ data: assembleSurface(rows[0]), error: null });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM surfaces WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }
    res.json({ data: { id }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForPhoto, create, update, remove, VALID_LABELS };
