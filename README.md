# Paint Visualizer — Core MVP

See `docs/REQUIREMENTS.md` and `docs/IMPLEMENTATION.md` for the full spec.

## Quick start

### 1. Database
Create a MySQL 8 database, then set `DATABASE_URL` in `backend/.env` (copy from `.env.example`).

### 2. Backend
```
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
API runs on http://localhost:4000

### 3. Frontend
```
cd frontend
npm install
npm run dev
```
App runs on http://localhost:5173 (proxies /api and /uploads to the backend)

## What's implemented
- Color Catalog: full CRUD, search/filter, bulk delete/deactivate, side-drawer form, ERP-style data table
- Projects: create/rename/delete, card grid dashboard
- Photo management: drag-and-drop upload, thumbnails, select, delete, bulk delete
- Visualizer canvas: cursor-anchored zoom, pan, fit-to-screen
- Surface tracing: click-to-place polygon tool, snap-to-close, layers panel, vertex editing
- Color application: catalog swatch picker, realistic multiply-blend fill, before/after hold-to-compare
- Undo/redo: unified command stack across tracing and color actions
- Saved combos: name and switch between multiple color combinations per project

## Known environment limitation
`npx prisma generate` requires downloading engine binaries from the internet.
If you're running this in a network-restricted environment, ensure `binaries.prisma.sh`
(or your configured Prisma engine mirror) is reachable, or configure `PRISMA_QUERY_ENGINE_LIBRARY`
etc. per Prisma's docs for offline/air-gapped setups.

## Not yet built (see docs/IMPLEMENTATION.md "next steps")
- Drag-to-reorder photo thumbnails (API endpoint already exists: PUT /api/photos/reorder)
- Debounced autosave indicator wiring (writes are already persisted per-action; this adds the "Saving…/Saved" UI polish)
- Side-by-side multi-combo comparison view (currently: switch between combos one at a time)
