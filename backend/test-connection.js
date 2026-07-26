require('dotenv').config();
const pool = require('./src/lib/db');

async function test() {
  try {
    console.log('Attempting query: SELECT 1 ...');
    await pool.execute('SELECT 1');
    console.log('SUCCESS - database connection works.');

    console.log('Attempting query: SELECT COUNT(*) FROM colors ...');
    const [rows] = await pool.execute('SELECT COUNT(*) AS cnt FROM colors');
    console.log('SUCCESS - found', rows[0].cnt, 'colors');
  } catch (err) {
    console.error('FAILED:', err.code || err.errno, '-', err.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
