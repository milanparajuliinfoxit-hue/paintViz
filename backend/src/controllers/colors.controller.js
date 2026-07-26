const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');
const { importColors } = require('../services/colorImport.service');

const COLOR_COLUMNS = 'id, name, code, hex, r_value AS rValue, g_value AS gValue, b_value AS bValue, brand, finish, product_flags AS productFlags, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt';

const ALLOWED_LIMITS = new Set([25, 50, 100]);
const DEFAULT_LIMIT = 25;

function parsePagination(query) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (!ALLOWED_LIMITS.has(limit)) limit = DEFAULT_LIMIT;
  return { page, limit };
}

function buildWhereClause(query) {
  let sql = ' WHERE 1=1';
  const params = [];

  if (query.search) {
    sql += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(`%${query.search}%`, `%${query.search}%`);
  }
  if (query.brand) {
    sql += ' AND brand = ?';
    params.push(query.brand);
  }
  if (query.finish) {
    sql += ' AND finish = ?';
    params.push(query.finish);
  }
  if (query.is_active !== undefined) {
    sql += ' AND is_active = ?';
    params.push(query.is_active === 'true');
  }

  return { sql, params };
}

// GET /api/colors?page=1&limit=25&search=&brand=&finish=&is_active=
async function list(req, res, next) {
  try {
    const { page, limit } = parsePagination(req.query);
    const { sql: whereClause, params } = buildWhereClause(req.query);
    const offset = (page - 1) * limit;

    const countSql = `SELECT COUNT(*) AS total FROM colors${whereClause}`;
    const dataSql = `SELECT ${COLOR_COLUMNS} FROM colors${whereClause} ORDER BY brand ASC, name ASC LIMIT ${limit} OFFSET ${offset}`;

    const [[{ total }]] = await pool.execute(countSql, params);
    const [rows] = await pool.execute(dataSql, params);
    const totalPages = Math.ceil(total / limit);

    res.json({
      data: rows,
      pagination: {
        page, limit, total, totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/colors/brands — distinct brand values for filter dropdown
async function listBrands(_req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT DISTINCT brand FROM colors ORDER BY brand ASC');
    res.json({ data: rows.map((r) => r.brand), error: null });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
      [id],
    );
    if (rows.length === 0) throw new ApiError(404, 'Color not found', 'NOT_FOUND');
    res.json({ data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
}

function validateColorBody(body) {
  const { name, code, hex, brand } = body;
  if (!name || !code || !hex || !brand) {
    throw new ApiError(400, 'name, code, hex, and brand are required.', 'VALIDATION_ERROR');
  }
  if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new ApiError(400, 'hex must be a valid 6-digit hex color (e.g. #FFAA00).', 'VALIDATION_ERROR');
  }
}

function normalizeHex(hex) {
  return hex.startsWith('#') ? hex.toUpperCase() : `#${hex.toUpperCase()}`;
}

async function create(req, res, next) {
  try {
    validateColorBody(req.body);
    const { name, code, hex, brand, finish, is_active } = req.body;
    const isActive = is_active !== undefined ? Boolean(is_active) : true;
    const finishValue = finish || null;

    const [result] = await pool.execute(
      'INSERT INTO colors (name, code, hex, brand, finish, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [name, code, normalizeHex(hex), brand, finishValue, isActive],
    );

    const [rows] = await pool.execute(
      `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
      [result.insertId],
    );

    res.status(201).json({ data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, code, hex, brand, finish, is_active } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (code !== undefined) { updates.push('code = ?'); params.push(code); }
    if (hex !== undefined) {
      if (!/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
        throw new ApiError(400, 'hex must be a valid 6-digit hex color.', 'VALIDATION_ERROR');
      }
      updates.push('hex = ?');
      params.push(normalizeHex(hex));
    }
    if (brand !== undefined) { updates.push('brand = ?'); params.push(brand); }
    if (finish !== undefined) { updates.push('finish = ?'); params.push(finish); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(Boolean(is_active)); }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE colors SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }

    const [rows] = await pool.execute(
      `SELECT ${COLOR_COLUMNS} FROM colors WHERE id = ?`,
      [id],
    );

    res.json({ data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM colors WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }
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
    const [result] = await pool.execute('DELETE FROM colors WHERE id IN (?)', [numericIds]);
    res.json({ data: { count: result.affectedRows }, error: null });
  } catch (err) {
    next(err);
  }
}

async function bulkDeactivate(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'ids must be a non-empty array.', 'VALIDATION_ERROR');
    }
    const numericIds = ids.map(Number);
    const [result] = await pool.execute('UPDATE colors SET is_active = false WHERE id IN (?)', [numericIds]);
    res.json({ data: { count: result.affectedRows }, error: null });
  } catch (err) {
    next(err);
  }
}

async function importExcel(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded. Please select an Excel file.', 'VALIDATION_ERROR');
    }
    const brand = req.body.brand ? String(req.body.brand).trim() : '';
    if (!brand) {
      throw new ApiError(400, 'Brand is required. Please provide a brand name for the imported colors.', 'VALIDATION_ERROR');
    }
    const result = await importColors(req.file.buffer, brand);
    res.json({ data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listBrands, getOne, create, update, remove, bulkDelete, bulkDeactivate, importExcel };
