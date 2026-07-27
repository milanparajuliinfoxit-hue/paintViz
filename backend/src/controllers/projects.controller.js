const pool = require('../lib/db');
const { ApiError } = require('../middleware/errorHandler');

const PROJECT_COLUMNS = 'id, name, created_at AS createdAt, updated_at AS updatedAt';

// GET /api/projects -> list with first photo as thumbnail + last updated
async function list(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT ${PROJECT_COLUMNS}, (SELECT file_url FROM photos WHERE project_id = p.id ORDER BY sort_order ASC LIMIT 1) AS thumbnailUrl FROM projects p ORDER BY updated_at DESC`,
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id -> full nested detail for the Visualizer
async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);

    const [projects] = await pool.execute(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`,
      [id],
    );
    if (projects.length === 0) throw new ApiError(404, 'Project not found', 'NOT_FOUND');
    const project = projects[0];

    const [photos] = await pool.execute(
      'SELECT id, project_id AS projectId, file_url AS fileUrl, sort_order AS sortOrder, uploaded_at AS uploadedAt, source_photo_id AS sourcePhotoId, is_cleaned_variant AS isCleanedVariant FROM photos WHERE project_id = ? ORDER BY sort_order ASC',
      [id],
    );

    if (photos.length > 0) {
      const photoIds = photos.map((p) => p.id);
      const [surfaces] = await pool.execute(
        `SELECT s.id, s.photo_id AS photoId, s.label, s.custom_name AS customName,
          s.polygon_coords AS polygonCoords, s.color_id AS colorId,
          s.created_at AS createdAt, s.updated_at AS updatedAt,
          c.id AS c_id, c.name AS c_name, c.code AS c_code, c.hex AS c_hex,
          c.brand AS c_brand, c.finish AS c_finish, c.product_flags AS c_productFlags,
          c.is_active AS c_isActive, c.created_at AS c_createdAt, c.updated_at AS c_updatedAt
         FROM surfaces s
         LEFT JOIN colors c ON c.id = s.color_id
         WHERE s.photo_id IN (?)
         ORDER BY s.created_at ASC`,
        [photoIds],
      );

      const surfacesByPhoto = {};
      for (const s of surfaces) {
        if (!surfacesByPhoto[s.photoId]) surfacesByPhoto[s.photoId] = [];
        surfacesByPhoto[s.photoId].push({
          id: s.id,
          photoId: s.photoId,
          label: s.label,
          customName: s.customName,
          polygonCoords: typeof s.polygonCoords === 'string' ? JSON.parse(s.polygonCoords) : s.polygonCoords,
          colorId: s.colorId,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          color: s.c_id != null ? {
            id: s.c_id,
            name: s.c_name,
            code: s.c_code,
            hex: s.c_hex,
            brand: s.c_brand,
            finish: s.c_finish,
            productFlags: typeof s.c_productFlags === 'string' ? JSON.parse(s.c_productFlags) : s.c_productFlags,
            isActive: s.c_isActive,
            createdAt: s.c_createdAt,
            updatedAt: s.c_updatedAt,
          } : null,
        });
      }

      for (const photo of photos) {
        photo.surfaces = surfacesByPhoto[photo.id] || [];
      }
    } else {
      for (const photo of photos) {
        photo.surfaces = [];
      }
    }

    const [visualizations] = await pool.execute(
      'SELECT id, project_id AS projectId, name, surface_color_map AS surfaceColorMap, is_default AS isDefault, created_at AS createdAt, updated_at AS updatedAt FROM visualizations WHERE project_id = ? ORDER BY created_at ASC',
      [id],
    );

    for (const viz of visualizations) {
      if (typeof viz.surfaceColorMap === 'string') {
        viz.surfaceColorMap = JSON.parse(viz.surfaceColorMap);
      }
    }

    project.photos = photos;
    project.visualizations = visualizations;

    res.json({ data: project, error: null });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) throw new ApiError(400, 'name is required.', 'VALIDATION_ERROR');
    const [result] = await pool.execute('INSERT INTO projects (name) VALUES (?)', [name]);
    const [rows] = await pool.execute(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`,
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
    const { name } = req.body;
    const [result] = await pool.execute('UPDATE projects SET name = ? WHERE id = ?', [name, id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }
    const [rows] = await pool.execute(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = ?`,
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
    const [result] = await pool.execute('DELETE FROM projects WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new ApiError(404, 'Record not found', 'NOT_FOUND');
    }
    res.json({ data: { id }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
