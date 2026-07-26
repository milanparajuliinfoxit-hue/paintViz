import { create } from 'zustand';
import { projectsApi } from '../api/projects';

// Command-pattern undo/redo: every mutating action pushes {type, payload, inverse}
// onto history. Undo pops history, applies inverse, pushes onto future.
// This single stack covers both tracing edits and color-assignment edits (FR-6.8).

const useVisualizerStore = create((set, get) => ({
  project: null,
  photos: [],
  activePhotoId: null,
  surfaces: [], // surfaces for the active photo only
  activeSurfaceId: null,
  combos: [],
  activeComboId: null,
  tool: 'select', // 'select' | 'trace'
  beforeAfter: false,
  saveStatus: 'idle', // 'idle' | 'saving' | 'saved'
  history: [],
  future: [],
  loading: false,
  lockedPhotoIds: [],

  async loadProject(projectId) {
    set({ loading: true });
    const project = await projectsApi.get(projectId);
    const firstPhoto = project.photos[0];
    set({
      project,
      photos: project.photos,
      activePhotoId: firstPhoto ? firstPhoto.id : null,
      surfaces: firstPhoto ? firstPhoto.surfaces : [],
      combos: project.visualizations,
      activeComboId: project.visualizations[0]?.id ?? null,
      loading: false,
      history: [],
      future: [],
    });
  },

  setActivePhoto(photoId) {
    const photo = get().photos.find((p) => p.id === photoId);
    set({
      activePhotoId: photoId,
      surfaces: photo ? photo.surfaces : [],
      activeSurfaceId: null,
      history: [],
      future: [],
    });
  },

  async addPhotos(files, onProgress) {
    const { project } = get();
    const newPhotos = await projectsApi.uploadPhotos(project.id, files, onProgress);
    set((state) => ({
      photos: [...state.photos, ...newPhotos.map((p) => ({ ...p, surfaces: [] }))],
      activePhotoId: state.activePhotoId ?? newPhotos[0]?.id,
    }));
  },

  async deletePhoto(photoId) {
    await projectsApi.deletePhoto(photoId);
    set((state) => {
      const photos = state.photos.filter((p) => p.id !== photoId);
      const wasActive = state.activePhotoId === photoId;
      const nextActive = wasActive ? (photos[0]?.id ?? null) : state.activePhotoId;
      return {
        photos,
        activePhotoId: nextActive,
        surfaces: wasActive ? (photos[0]?.surfaces ?? []) : state.surfaces,
      };
    });
  },

  async bulkDeletePhotos(ids) {
    await projectsApi.bulkDeletePhotos(ids);
    set((state) => {
      const photos = state.photos.filter((p) => !ids.includes(p.id));
      const wasActiveDeleted = ids.includes(state.activePhotoId);
      return {
        photos,
        activePhotoId: wasActiveDeleted ? (photos[0]?.id ?? null) : state.activePhotoId,
        surfaces: wasActiveDeleted ? (photos[0]?.surfaces ?? []) : state.surfaces,
      };
    });
  },

  setTool(tool) {
    set({ tool, activeSurfaceId: null });
  },

  setBeforeAfter(value) {
    set({ beforeAfter: value });
  },

  togglePhotoLock(photoId) {
    set((state) => {
      const locked = state.lockedPhotoIds.includes(photoId);
      return {
        lockedPhotoIds: locked
          ? state.lockedPhotoIds.filter((id) => id !== photoId)
          : [...state.lockedPhotoIds, photoId],
      };
    });
  },

  isPhotoLocked(photoId) {
    return get().lockedPhotoIds.includes(photoId);
  },

  pushHistory(command) {
    set((state) => ({ history: [...state.history, command], future: [] }));
  },

  // --- Surface actions (each is undo-able) ---

  async addSurface(photoId, surfaceInput) {
    const created = await projectsApi.createSurface(photoId, surfaceInput);
    set((state) => ({
      surfaces: [...state.surfaces, created],
      activeSurfaceId: created.id,
    }));
    get().pushHistory({
      type: 'ADD_SURFACE',
      payload: created,
      undo: async () => {
        await projectsApi.deleteSurface(created.id);
        set((state) => ({ surfaces: state.surfaces.filter((s) => s.id !== created.id) }));
      },
      redo: async () => {
        set((state) => ({ surfaces: [...state.surfaces, created] }));
      },
    });
    return created;
  },

  async deleteSurface(surfaceId) {
    const surface = get().surfaces.find((s) => s.id === surfaceId);
    if (!surface) return;
    await projectsApi.deleteSurface(surfaceId);
    set((state) => ({
      surfaces: state.surfaces.filter((s) => s.id !== surfaceId),
      activeSurfaceId: state.activeSurfaceId === surfaceId ? null : state.activeSurfaceId,
    }));
    get().pushHistory({
      type: 'DELETE_SURFACE',
      payload: surface,
      undo: async () => {
        set((state) => ({ surfaces: [...state.surfaces, surface] }));
      },
      redo: async () => {
        await projectsApi.deleteSurface(surfaceId);
        set((state) => ({ surfaces: state.surfaces.filter((s) => s.id !== surfaceId) }));
      },
    });
  },

  selectSurface(surfaceId) {
    set({ activeSurfaceId: surfaceId });
  },

  async assignColor(surfaceId, colorObj) {
    const prevSurface = get().surfaces.find((s) => s.id === surfaceId);
    const prevColor = prevSurface?.color ?? null;
    const updated = await projectsApi.updateSurface(surfaceId, { color_id: colorObj?.id ?? null });
    set((state) => ({
      surfaces: state.surfaces.map((s) => (s.id === surfaceId ? { ...s, ...updated } : s)),
    }));
    get().pushHistory({
      type: 'ASSIGN_COLOR',
      payload: { surfaceId, color: colorObj },
      undo: async () => {
        const reverted = await projectsApi.updateSurface(surfaceId, { color_id: prevColor?.id ?? null });
        set((state) => ({
          surfaces: state.surfaces.map((s) => (s.id === surfaceId ? { ...s, ...reverted } : s)),
        }));
      },
      redo: async () => {
        const reapplied = await projectsApi.updateSurface(surfaceId, { color_id: colorObj?.id ?? null });
        set((state) => ({
          surfaces: state.surfaces.map((s) => (s.id === surfaceId ? { ...s, ...reapplied } : s)),
        }));
      },
    });
  },

  async updateSurfacePolygon(surfaceId, polygonCoords) {
    const updated = await projectsApi.updateSurface(surfaceId, { polygon_coords: polygonCoords });
    set((state) => ({
      surfaces: state.surfaces.map((s) => (s.id === surfaceId ? { ...s, ...updated } : s)),
    }));
  },

  async undo() {
    const { history } = get();
    if (history.length === 0) return;
    const command = history[history.length - 1];
    await command.undo();
    set((state) => ({
      history: state.history.slice(0, -1),
      future: [command, ...state.future],
    }));
  },

  async redo() {
    const { future } = get();
    if (future.length === 0) return;
    const command = future[0];
    await command.redo();
    set((state) => ({
      future: state.future.slice(1),
      history: [...state.history, command],
    }));
  },

  async resetColors() {
    const { surfaces } = get();
    await Promise.all(surfaces.map((s) => projectsApi.updateSurface(s.id, { color_id: null })));
    set((state) => ({
      surfaces: state.surfaces.map((s) => ({ ...s, color: null, colorId: null })),
      history: [],
      future: [],
    }));
  },

  // --- Combos (saved visualizations) ---

  async saveCombo(name) {
    const { project, surfaces } = get();
    const surfaceColorMap = {};
    surfaces.forEach((s) => {
      if (s.color) surfaceColorMap[s.id] = s.color.id;
    });
    const combo = await projectsApi.createCombo(project.id, { name, surface_color_map: surfaceColorMap });
    set((state) => ({ combos: [...state.combos, combo], activeComboId: combo.id }));
    return combo;
  },

  async applyCombo(comboId) {
    const combo = get().combos.find((c) => c.id === comboId);
    if (!combo) return;
    const map = combo.surfaceColorMap || {};
    set({ activeComboId: comboId });
    // Apply without pushing individual undo entries (combo switch is its own action)
    const { surfaces } = get();
    const updates = await Promise.all(
      surfaces.map((s) => projectsApi.updateSurface(s.id, { color_id: map[s.id] ?? null }))
    );
    set((state) => ({
      surfaces: state.surfaces.map((s) => {
        const u = updates.find((up) => up.id === s.id);
        return u ? { ...s, ...u } : s;
      }),
    }));
  },
}));

export default useVisualizerStore;
