import client from './client';

export const removalsApi = {
  segmentPoint: (photoId, x, y) =>
    client.post(`/photos/${photoId}/segment-point`, { x, y }),

  refineMask: (photoId, maskDataUrl) =>
    client.post(`/photos/${photoId}/mask/refine`, { maskDataUrl }),

  createJob: (photoId, maskDataUrl) =>
    client.post(`/photos/${photoId}/removal-jobs`, { maskDataUrl }),

  getJob: (jobId) =>
    client.get(`/removal-jobs/${jobId}`),

  retryJob: (jobId) =>
    client.post(`/removal-jobs/${jobId}/retry`),

  listJobsForPhoto: (photoId, status) => {
    const params = status ? { status } : undefined;
    return client.get(`/photos/${photoId}/removal-jobs`, { params });
  },
};

export async function segmentPoint(photoId, x, y) {
  const result = await removalsApi.segmentPoint(photoId, x, y);
  return result?.maskPreviewUrl ?? result;
}

export async function refineMask(photoId, maskDataUrl) {
  const result = await removalsApi.refineMask(photoId, maskDataUrl);
  return result?.maskPreviewUrl ?? result;
}

export function createRemovalJob(photoId, maskDataUrl) {
  return removalsApi.createJob(photoId, maskDataUrl);
}
