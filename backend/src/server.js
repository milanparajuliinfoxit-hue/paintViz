const app = require('./app');
const pool = require('./lib/db');

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await pool.execute('SELECT 1');
    console.log('Database connection verified.'); // eslint-disable-line no-console
  } catch (err) {
    console.error('WARNING: Database is not reachable on startup:', err.message); // eslint-disable-line no-console
    console.error('The server will continue to start, but requests may fail until the database is available.'); // eslint-disable-line no-console
  }

  app.listen(PORT, () => {
    console.log(`Paint Visualizer API listening on http://localhost:${PORT}`); // eslint-disable-line no-console
  });
}

start();
