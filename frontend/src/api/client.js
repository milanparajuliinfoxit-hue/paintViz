import axios from 'axios';

const RETRYABLE_CODES = new Set(['DATABASE_UNAVAILABLE', 'NETWORK_ERROR']);

function normalizeError(err) {
  const apiError = err.response?.data?.error;
  const raw = apiError || { message: err.message || 'An unexpected error occurred.', code: 'NETWORK_ERROR' };

  const status = err.response?.status;
  const isRetryable = RETRYABLE_CODES.has(raw.code) || (status != null && status >= 500);

  return {
    message: raw.message || 'Something went wrong. Please try again.',
    code: raw.code || 'UNKNOWN_ERROR',
    severity: status && status < 500 ? 'warning' : 'error',
    retryable: isRetryable,
  };
}

// Vite dev server proxies /api -> backend (see vite.config.js), so a
// relative baseURL works in dev and in prod behind a reverse proxy.
const client = axios.create({
  baseURL: '/api',
});

client.interceptors.response.use(
  (res) => {
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) {
      if ('pagination' in body) {
        return { data: body.data, pagination: body.pagination };
      }
      return body.data;
    }
    return body;
  },
  (err) => Promise.reject(normalizeError(err)),
);

export default client;
