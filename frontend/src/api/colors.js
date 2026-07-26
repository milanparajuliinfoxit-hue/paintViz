import client from './client';

export const colorsApi = {
  list: (params) => client.get('/colors', { params }),
  listBrands: () => client.get('/colors/brands'),
  get: (id) => client.get(`/colors/${id}`),
  create: (payload) => client.post('/colors', payload),
  update: (id, payload) => client.put(`/colors/${id}`, payload),
  remove: (id) => client.delete(`/colors/${id}`),
  bulkDelete: (ids) => client.post('/colors/bulk-delete', { ids }),
  bulkDeactivate: (ids) => client.post('/colors/bulk-deactivate', { ids }),
  importColors: (file, brand) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('brand', brand);
    return client.post('/colors/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
