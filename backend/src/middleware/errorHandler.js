// Central error handler. Controllers throw ApiError or let mysql2 errors bubble up;
// this normalizes everything into the { data: null, error: { message, code } } envelope.
// Internal details (stack traces, mysql2 error codes, driver internals) are logged but never sent to clients.

const INFRASTRUCTURE_ERROR_NUMBERS = new Set([
  1045, // Access denied
  1049, // Unknown database
  2003, // Can't connect to MySQL server
  2006, // MySQL server has gone away
  2013, // Lost connection to MySQL server during query
  2055, // Lost connection to MySQL server
]);

class ApiError extends Error {
  constructor(status, message, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

function isInfrastructureError(err) {
  if (INFRASTRUCTURE_ERROR_NUMBERS.has(err.errno)) return true;
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('pool') && msg.includes('timeout')) return true;
  if (msg.includes('connection') && (msg.includes('refused') || msg.includes('timeout') || msg.includes('lost'))) return true;
  if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('etimedout')) return true;
  return false;
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';

  // --- ApiError (explicit business/validation errors) ---
  if (err instanceof ApiError) {
    // Fall through – status, message, code are already correct.
  }
  // --- MySQL unique constraint violation (errno 1062 = ER_DUP_ENTRY) ---
  else if (err.errno === 1062) {
    status = 409;
    code = 'DUPLICATE';
    message = 'A record with the same value already exists.';
  }
  // --- Infrastructure / database errors ---
  else if (isInfrastructureError(err)) {
    status = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'The database is temporarily unavailable. Please try again shortly.';
  }
  // --- Anything else: generic safe message ---
  else {
    if (status >= 500) {
      status = 500;
      code = 'INTERNAL_ERROR';
      message = 'Something went wrong while processing your request. Please try again.';
    }
  }

  // Log full technical error for 5xx – never send it to the client.
  if (status >= 500) {
    console.error('[API Error]', err); // eslint-disable-line no-console
  }

  res.status(status).json({ data: null, error: { message, code } });
}

module.exports = { ApiError, notFound, errorHandler };
