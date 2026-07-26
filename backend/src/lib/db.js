const mysql = require('mysql2/promise');

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '3306', 10),
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
  };
}

const config = parseDatabaseUrl(process.env.DATABASE_URL);

const pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function disconnectPool() {
  try {
    await pool.end();
  } catch (_) {
    // ignore – best-effort shutdown
  }
}

process.on('SIGTERM', disconnectPool);
process.on('SIGINT', disconnectPool);

pool.withTransaction = withTransaction;
module.exports = pool;
