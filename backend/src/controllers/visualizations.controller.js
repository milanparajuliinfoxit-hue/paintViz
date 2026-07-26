const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');

const VIZ_COLUMNS = 'id, project_id AS projectId, name, surface_color_map AS surfaceColorMap, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt';

function parseViz(row) {
  if (typeof row.surfaceColorMap === 'string') {
    row.surfaceColorMap = JSON.parse(row.surfaceColorMap);
  }
  return row;
}

async function listForProject(req, res, next) {
  try {
    const projectId = Number(req.params.id);
    const [rows] = await pool.execute(
      `SELECT ${VIZ_COLUMNS} FROM visualizations WHERE project_id = ? ORDER BY created_at ASC`,
      [projectId],
    );
    res.json({ data: rows.map(parseViz), error: null });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const projectId = Number(req.params.id);
    const { name, surface_color_map } = req.body;
    if (!name) throw new ApiError(400, 'name is required.', 'VALIDATION_ERROR');

    const [projects] = await pool.execute('SELECT id FROM projects WHERE id = ?', [projectId]);
    if (projects.length === 0) throw new ApiError(404, 'Project not found', 'NOT_FOUND');

    const [result] = await pool.execute(
      'INSERT INTO visualizations (project_id, name, surface_color_map) VALUES (?, ?, ?)',
      [projectId, name, JSON.stringify(surface_color_map || {})],
    );

    const [rows] = await pool.execute(
      `SELECT ${VIZ_COLUMNS} FROM visualizations WHERE id = ?`,
      [result.insertId],
    );

    res.status(201).json({ data: parseViz(rows[0]), error: null });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { name, surface_color_map } = req.body;
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (surface_color_map !== undefined) { updates.push('surface_color_map = ?'); params.push(JSON.stringify(surface_color_map)); }

    if (updates.length === 0) {
      throw new ApiError(400, 'No fields to update.', 'VALIDATION_ERROR');
    }

    params.push(id);
    const [result] = await pool.execute(
      `UPDATE visualizations SET ${updates.join(', ')} WHERE id = ?`,
      params,
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }

    const [rows] = await pool.execute(
      `SELECT ${VIZ_COLUMNS} FROM visualizations WHERE id = ?`,
      [id],
    );

    res.json({ data: parseViz(rows[0]), error: null });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [result] = await pool.execute('DELETE FROM visualizations WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }
    res.json({ data: { id }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForProject, create, update, remove };
