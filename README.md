# Paint Visualizer — Core MVP

See docs/REQUIREMENTS.md and docs/IMPLEMENTATION.md for the full spec.

## Quick start

### 1. Database
Create a MySQL 8 database and set DATABASE_URL in backend/.env (copy from .env.example).

Then initialize the schema:

```bash
mysql -u root -p < database/setup.sql
```

### 2. Backend
```bash
cd backend
npm install
npm run migrate
npm run dev
```

API runs on http://localhost:4000.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

The app runs on http://localhost:5173 and Vite proxies /api and /uploads to the backend.

## Current implementation
- Color catalog: CRUD, search/filter, bulk delete/deactivate, drawer form, ERP-style table
- Projects: create, rename, delete, card dashboard
- Photo management: upload, thumbnails, selection, delete, bulk delete
- Visualizer canvas: zoom, pan, fit-to-screen, layer rendering
- Surface tracing: click-to-place polygon tool, snap-to-close, vertex editing
- Color application: swatch picker, multiply-style fill, before/after comparison
- Undo/redo: shared history stack for tracing and color actions
- Saved combos: create and switch between color combinations per project

## Notes
- This repository does not use Prisma. The backend uses a custom Node.js + MySQL stack.
- Schema changes are applied with the lightweight migration runner in backend/src/migrate.js.
- Uploaded images are served from /uploads and managed through the backend.

## Not yet built (see docs/IMPLEMENTATION.md "next steps")
- Drag-to-reorder photo thumbnails (API endpoint already exists: PUT /api/photos/reorder)
- Debounced autosave indicator wiring (writes are already persisted per-action; this adds the "Saving…/Saved" UI polish)
- Side-by-side multi-combo comparison view (currently: switch between combos one at a time)
