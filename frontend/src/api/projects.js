import client from './client';

export const projectsApi = {
  list: () => client.get('/projects'),
  get: (id) => client.get(`/projects/${id}`),
  create: (payload) => client.post('/projects', payload),
  update: (id, payload) => client.put(`/projects/${id}`, payload),
  remove: (id) => client.delete(`/projects/${id}`),

  uploadPhotos: (projectId, files, onProgress) => {
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append('photos', file));
    return client.post(`/projects/${projectId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress) onProgress(Math.round((evt.loaded * 100) / evt.total));
      },
    });
  },
  deletePhoto: (photoId) => client.delete(`/photos/${photoId}`),
  bulkDeletePhotos: (ids) => client.post('/photos/bulk-delete', { ids }),
  reorderPhotos: (photoIds) => client.put('/photos/reorder', { photoIds }),

  listSurfaces: (photoId) => client.get(`/photos/${photoId}/surfaces`),
  createSurface: (photoId, payload) => client.post(`/photos/${photoId}/surfaces`, payload),
  updateSurface: (surfaceId, payload) => client.put(`/surfaces/${surfaceId}`, payload),
  deleteSurface: (surfaceId) => client.delete(`/surfaces/${surfaceId}`),

  listCombos: (projectId) => client.get(`/projects/${projectId}/visualizations`),
  createCombo: (projectId, payload) => client.post(`/projects/${projectId}/visualizations`, payload),
  updateCombo: (comboId, payload) => client.put(`/visualizations/${comboId}`, payload),
  deleteCombo: (comboId) => client.delete(`/visualizations/${comboId}`),
};
