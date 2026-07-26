# Paint Visualizer — Core MVP Requirements

**Version:** 1.0
**Status:** Approved for implementation
**Scope:** Core visualization function only (Color Catalog + Projects/Photo Visualizer).
Auth, object removal, AI enhancement, and environment/weather simulation are explicitly **out of scope** for this phase — see [Deferred Scope](#deferred-scope).

---

## 1. Overview

The Paint Visualizer is a web application that lets a user:
1. Manage a catalog of paint colors (CRUD).
2. Create a project, upload photos of a house/building.
3. Manually trace paintable surfaces (walls, roof, trim, doors, etc.) on a photo.
4. Apply catalog colors to traced surfaces with a realistic (shadow-preserving) blend.
5. Compare multiple color combinations, undo/redo, and save/reopen the project.

No authentication in this phase — the application is a single shared workspace. The system must be built so auth can be layered in later without a schema rewrite (all entities support an eventual `owner_id`/`user_id` foreign key, currently nullable/unused).

---

## 2. Functional Requirements

### 2.1 Module 1 — Color Catalog (ERP-style dashboard)

| ID | Requirement |
|----|-------------|
| FR-1.1 | Admin can Create, Read, Update, Delete a color entry (name, code, hex/RGB, brand, finish, active flag). |
| FR-1.2 | System prevents duplicate colors — uniqueness enforced on `(brand, code)`. |
| FR-1.3 | Admin can search colors by name or code, and filter by brand / finish / active status. |
| FR-1.4 | Catalog displayed as a sortable data table (not cards) with inline color swatch. |
| FR-1.5 | Add/Edit color opens in a side drawer (no full page navigation). |
| FR-1.6 | Admin can multi-select rows for bulk delete / bulk deactivate. |
| FR-1.7 | Deactivated colors are hidden from the visualizer's color picker but remain in the catalog list (soft-delete pattern via `is_active`). |

### 2.2 Module 2 — Projects

| ID | Requirement |
|----|-------------|
| FR-2.1 | User can create, rename, and delete a project. |
| FR-2.2 | Projects dashboard shows a grid of project cards: thumbnail (first uploaded photo), name, last-edited date. |
| FR-2.3 | Opening a project loads the Visualizer workspace. |

### 2.3 Module 3 — Photo Management (inside a Project)

| ID | Requirement |
|----|-------------|
| FR-3.1 | User can upload multiple photos via drag-and-drop or file picker, with per-file upload progress. |
| FR-3.2 | Invalid files (wrong type/too large) are rejected with an inline error, not a browser alert. |
| FR-3.3 | Uploaded photos appear as a thumbnail strip; user can select a thumbnail to load it into the canvas. |
| FR-3.4 | User can multi-select thumbnails (checkbox / shift-click) and bulk-delete with confirmation. |
| FR-3.5 | User can delete a single photo from its thumbnail (hover action). |
| FR-3.6 | User can drag to reorder photo thumbnails (`sort_order` persisted). |
| FR-3.7 | Deleting the active photo clears the canvas / selects the next available photo. |

### 2.4 Module 4 — Canvas / Zoom / Pan

| ID | Requirement |
|----|-------------|
| FR-4.1 | Mouse scroll wheel zooms in/out, anchored to the cursor position (not canvas center). |
| FR-4.2 | Pinch-to-zoom supported on trackpad/touch. |
| FR-4.3 | Space+drag or middle-mouse-drag pans the canvas. |
| FR-4.4 | Toolbar shows current zoom %, with "Fit to screen" and "100%" quick actions. |
| FR-4.5 | Canvas rendering must remain smooth (GPU-accelerated transforms) at typical photo resolutions (up to ~12MP). |

### 2.5 Module 5 — Surface Tracing

| ID | Requirement |
|----|-------------|
| FR-5.1 | User can trace a surface by clicking to place polygon points (click-to-place, straight edges). |
| FR-5.2 | Live edge preview is shown while placing points. |
| FR-5.3 | Clicking the first point again (or double-click) closes the polygon. |
| FR-5.4 | Points snap to nearby existing points/edges within a pixel threshold, to allow shared edges between adjacent surfaces. |
| FR-5.5 | Each traced surface has a label chosen from a predefined list (Wall, Roof, Trim, Door, Window, Ceiling, Other) and an optional custom name. |
| FR-5.6 | Traced surfaces are listed in a right-hand "Layers" panel: toggle visibility, rename, delete, click-to-select. |
| FR-5.7 | Selecting a surface (on canvas or in the layers list) highlights it and shows editable vertices (drag to adjust). |
| FR-5.8 | `Esc` cancels an in-progress trace. `Delete`/`Backspace` removes the selected surface. `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` undo/redo. |

### 2.6 Module 6 — Color Application

| ID | Requirement |
|----|-------------|
| FR-6.1 | Right panel shows the color catalog (swatch grid) with search/filter, when a surface is selected or generally available. |
| FR-6.2 | User applies a color to a surface by selecting the surface then clicking a swatch, or dragging a swatch onto a surface. |
| FR-6.3 | Color is applied as a realistic blend (multiply/overlay against the underlying pixel luminance) so shadows/texture in the original photo remain visible — not a flat opaque fill. |
| FR-6.4 | User can save the current surface→color mapping as a **named visualization** (a "combo") and create multiple combos per project. |
| FR-6.5 | User can switch between saved combos to compare them. |
| FR-6.6 | Before/after: holding a toggle (or button) shows the original unpainted photo; releasing restores the painted view. |
| FR-6.7 | "Reset" clears all color assignments on the current combo back to the traced-but-unpainted state. |
| FR-6.8 | Undo/redo applies to color assignment actions as well as tracing actions, in a single unified history stack. |

### 2.7 Module 7 — Save / Reopen

| ID | Requirement |
|----|-------------|
| FR-7.1 | Project state (photos, traced surfaces, color combos) autosaves as the user works (debounced), with a "Saved / Saving…" status indicator. |
| FR-7.2 | Reopening a project restores all photos, traced surfaces (with geometry), and saved combos exactly as left. |

---

## 3. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | UI must meet a professional, modern design bar comparable to Figma/Canva — themed components, no default/unstyled library look. |
| NFR-2 | Canvas interactions (zoom, pan, trace, drag-vertex) must feel smooth — target 60fps for standard interactions. |
| NFR-3 | Photo uploads support common formats: JPEG, PNG, WEBP; max file size configurable (default 15MB per photo). |
| NFR-4 | Backend API must be structured so an auth layer (JWT middleware + `owner_id` scoping) can be added later without breaking existing routes/schema. |
| NFR-5 | All destructive actions (delete color, delete project, delete photo, bulk delete) require a confirmation step. |
| NFR-6 | Application must be usable on a modern desktop browser (Chrome, Edge, Firefox, Safari latest 2 versions). Mobile/tablet is not a requirement for this phase. |

---

## 4. Data Model

MySQL 8, JSON columns for polygon geometry and combo snapshots.

```
colors            id, name, code, hex, brand, finish, is_active, created_at, updated_at
projects          id, name, created_at, updated_at
photos            id, project_id (FK), file_url, sort_order, uploaded_at
surfaces          id, photo_id (FK), label, custom_name, polygon_coords (JSON), created_at, updated_at
visualizations    id, project_id (FK), name, surface_color_map (JSON), is_default, created_at, updated_at
```

`surface_color_map` shape: `{ "<surface_id>": "<color_id>", ... }` — snapshot of a combo, independent of the live `surfaces.color_id` convenience field used for the "currently active" state.

See `IMPLEMENTATION.md` for full SQL DDL and API contract.

---

## 5. Screens

1. **Color Catalog Dashboard** — data table, search/filter bar, "Add Color" side drawer, bulk actions toolbar.
2. **Projects Dashboard** — project card grid, "New Project" CTA, rename/delete on card hover.
3. **Visualizer Workspace** — 3-pane layout:
   - Left: photo manager (thumbnails, upload, delete, reorder)
   - Center: canvas (zoom/pan, tracing, vertex editing)
   - Right: contextual panel — Layers (traced surfaces) / Color catalog browser (tabbed)
   - Top toolbar: undo/redo, reset, before/after toggle, combo selector, save status

---

## 6. Deferred Scope

Explicitly **not** part of this implementation phase (tracked for future roadmap):

- Authentication & role-based access control
- Automatic building/surface detection (segmentation model)
- Unwanted object removal / inpainting
- AI sky replacement, relighting, landscaping enhancement
- Environment & weather simulation (time-of-day, weather overlays)
- Excel import/export for the catalog
- PDF export / presentation-ready export
- Revision history beyond named combos
- Predefined 3D house templates / true 3D model generation

---

## 7. Acceptance Criteria (Definition of Done for Core MVP)

- [ ] Admin can fully manage the color catalog (CRUD, search, filter, bulk actions) via the dashboard.
- [ ] User can create a project and upload/manage photos (upload, select, delete, reorder).
- [ ] User can trace surfaces on a photo and manage them via the Layers panel.
- [ ] User can apply catalog colors to traced surfaces with a realistic blend.
- [ ] User can create and switch between multiple saved color combos per project.
- [ ] Undo/redo and before/after work reliably across tracing and coloring actions.
- [ ] Project state persists correctly across reload (autosave + reopen).
- [ ] UI meets the professional design bar (themed components, smooth canvas interactions).
