# Paint Visualizer — Implementation Plan

Companion to `REQUIREMENTS.md`. Describes tech stack, architecture, API contract, schema DDL, folder structure, and phased build plan for the core MVP.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite) + Tailwind CSS + MUI (themed) |
| Canvas / tracing engine | Konva.js (`react-konva`) |
| State management | Zustand (lightweight, good fit for canvas/undo-redo state) |
| Backend | Node.js + Express |
| ORM | Prisma (MySQL connector) |
| Database | MySQL 8 |
| File storage | Local disk (dev) via `multer` → swappable for S3-compatible storage later behind a storage-service interface |
| API style | REST, JSON |

No auth, no queue, no external AI API in this phase — kept out per current scope.

---

## 2. Monorepo Structure

```
paint-visualizer/
├── docs/
│   ├── REQUIREMENTS.md
│   └── IMPLEMENTATION.md
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   │   ├── colors.routes.js
│   │   │   ├── projects.routes.js
│   │   │   ├── photos.routes.js
│   │   │   ├── surfaces.routes.js
│   │   │   └── visualizations.routes.js
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   │   ├── errorHandler.js
│   │   │   └── upload.js
│   │   ├── lib/
│   │   │   └── prisma.js
│   │   └── app.js
│   ├── uploads/            (dev file storage, gitignored)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/             (axios client + endpoint wrappers)
    │   ├── components/
    │   │   ├── catalog/
    │   │   ├── projects/
    │   │   └── visualizer/
    │   │       ├── CanvasStage.jsx
    │   │       ├── PhotoPanel.jsx
    │   │       ├── LayersPanel.jsx
    │   │       ├── ColorPanel.jsx
    │   │       └── Toolbar.jsx
    │   ├── pages/
    │   │   ├── CatalogPage.jsx
    │   │   ├── ProjectsPage.jsx
    │   │   └── VisualizerPage.jsx
    │   ├── store/
    │   │   └── visualizerStore.js   (Zustand: surfaces, history, active combo)
    │   ├── theme/
    │   │   └── theme.js             (MUI theme overrides)
    │   ├── App.jsx
    │   └── main.jsx
    ├── tailwind.config.js
    └── package.json
```

---

## 3. Database Schema (Prisma / MySQL DDL)

```sql
CREATE TABLE colors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  hex VARCHAR(7) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  finish VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_brand_code (brand, code)
);

CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE surfaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  photo_id INT NOT NULL,
  label VARCHAR(50) NOT NULL,
  custom_name VARCHAR(100),
  polygon_coords JSON NOT NULL,
  color_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id) REFERENCES colors(id) ON DELETE SET NULL
);

CREATE TABLE visualizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  surface_color_map JSON NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

---

## 4. API Contract

### Colors
```
GET    /api/colors            ?search=&brand=&finish=&is_active=
POST   /api/colors            { name, code, hex, brand, finish }
GET    /api/colors/:id
PUT    /api/colors/:id
DELETE /api/colors/:id
POST   /api/colors/bulk-delete       { ids: [] }
POST   /api/colors/bulk-deactivate   { ids: [] }
```

### Projects
```
GET    /api/projects
POST   /api/projects          { name }
GET    /api/projects/:id      (includes photos + surfaces + visualizations, nested)
PUT    /api/projects/:id      { name }
DELETE /api/projects/:id
```

### Photos
```
POST   /api/projects/:id/photos     multipart/form-data, field "photos" (multiple)
DELETE /api/photos/:id
POST   /api/photos/bulk-delete      { ids: [] }
PUT    /api/photos/reorder          { photoIds: [ordered ids] }
```

### Surfaces
```
GET    /api/photos/:id/surfaces
POST   /api/photos/:id/surfaces     { label, custom_name, polygon_coords, color_id? }
PUT    /api/surfaces/:id            { label?, custom_name?, polygon_coords?, color_id? }
DELETE /api/surfaces/:id
```

### Visualizations (combos)
```
GET    /api/projects/:id/visualizations
POST   /api/projects/:id/visualizations   { name, surface_color_map }
PUT    /api/visualizations/:id            { name?, surface_color_map? }
DELETE /api/visualizations/:id
```

All responses: `{ data, error }` envelope. Errors return `{ data: null, error: { message, code } }` with appropriate HTTP status.

---

## 5. Frontend State Model (Zustand store, Visualizer)

```js
{
  activePhotoId,
  photos: [],
  surfaces: [],              // for active photo
  activeSurfaceId,
  activeCombo: { id, name, surface_color_map },
  combos: [],
  history: [],                // undo stack of {type, payload}
  future: [],                  // redo stack
  zoom, pan,
  tool: 'select' | 'trace',
  beforeAfter: false,
}
```

Undo/redo implemented as a single command stack covering both tracing edits and color-assignment edits (per FR-6.8), using a command-pattern approach (`{type: 'ADD_SURFACE'|'DELETE_SURFACE'|'EDIT_POLYGON'|'ASSIGN_COLOR', payload, inverse}`).

---

## 6. Color Blend Rendering Approach

To satisfy FR-6.3 (realistic blend, not flat fill):
1. Render the traced polygon as a clipping mask on an offscreen canvas.
2. Fill the mask with the target color at a `multiply` (or `hard-light`) Konva composite operation against the underlying photo pixels within the mask bounds.
3. Cache the composited layer per surface; re-composite only the affected surface on color change (not the whole canvas) for performance.

---

## 7. Phased Build Plan

| Phase | Deliverable | Notes |
|---|---|---|
| 0 | Repo scaffold, Prisma schema + migration, Express app skeleton, Vite+Tailwind+MUI frontend skeleton, theme setup | Foundation |
| 1 | Color Catalog: backend CRUD + frontend dashboard (data table, drawer form, search/filter, bulk actions) | |
| 2 | Projects: backend CRUD + frontend dashboard (card grid) + photo upload/list/delete/reorder (backend + PhotoPanel UI) | |
| 3 | Canvas: CanvasStage with zoom/pan (cursor-anchored), photo rendering, Konva stage wiring | |
| 4 | Surface tracing: click-to-place polygon tool, snapping, LayersPanel, vertex editing, keyboard shortcuts, undo/redo command stack | |
| 5 | Color application: ColorPanel (catalog browser), assign-color interaction, blend rendering, combos (create/switch/save), before/after toggle, reset | |
| 6 | Persistence: autosave (debounced PUT/PATCH calls), reopen project (hydrate store from `GET /projects/:id`), save-status indicator | |

This matches the estimates previously agreed (~11.5–14 weeks for a small team); phases above are the execution breakdown of that plan.

---

## 8. Environment Variables (backend `.env`)

```
DATABASE_URL="mysql://user:password@localhost:3306/paint_visualizer"
PORT=4000
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=15
CORS_ORIGIN=http://localhost:5173
```

---

## 9. What Was Actually Scaffolded in This Pass

- Backend: Express app, Prisma schema matching the DDL above, full CRUD routes/controllers for Colors, Projects, Photos (upload via multer), Surfaces, Visualizations.
- Frontend: Vite React app with Tailwind + MUI theme, routing for the 3 pages, Catalog dashboard (data table + drawer form, wired to API), Projects dashboard (card grid, wired to API), Visualizer workspace scaffold (3-pane layout, Konva canvas with zoom/pan + polygon tracing + layers panel + color panel wired end-to-end).
- Not yet implemented in this pass (flagged as immediate next steps): drag-reorder of photo thumbnails, autosave debounce wiring, multi-combo compare UI polish, vertex-drag editing after a polygon is closed. These are straightforward extensions of the scaffolded patterns.
