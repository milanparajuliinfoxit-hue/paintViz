#!/usr/bin/env node
/**
 * Lightweight migration runner.
 *
 * Usage:
 *   node src/migrate.js up      – run all pending migrations
 *   node src/migrate.js down    – rollback the last migration
 *   node src/migrate.js status  – show migration state
 *
 * Migrations live in src/migrations/ as NNN_name.js files exporting
 * up(pool) and down(pool) async functions.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./lib/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort();
}

async function ensureMetaTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   VARCHAR(10)  NOT NULL PRIMARY KEY,
      name      VARCHAR(255) NOT NULL,
      applied_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function getApplied(connection) {
  const [rows] = await connection.execute(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  );
  return new Set(rows.map((r) => r.version));
}

function parseVersion(filename) {
  return filename.split('_')[0];
}

function parseName(filename) {
  return filename.replace(/\.js$/, '').replace(/^\d+_/, '');
}

async function runUp() {
  const connection = await pool.getConnection();
  try {
    await ensureMetaTable(connection);
    const applied = await getApplied(connection);
    const files = getMigrationFiles();
    let count = 0;

    for (const file of files) {
      const version = parseVersion(file);
      if (applied.has(version)) continue;

      const migration = require(path.join(MIGRATIONS_DIR, file));
      console.log(`  Applying ${file} ...`);
      await migration.up(connection);
      await connection.execute(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
        [version, parseName(file)],
      );
      count++;
    }

    if (count === 0) {
      console.log('  Nothing to apply – database is up to date.');
    } else {
      console.log(`  Applied ${count} migration(s).`);
    }
  } finally {
    connection.release();
  }
}

async function runDown() {
  const connection = await pool.getConnection();
  try {
    await ensureMetaTable(connection);
    const applied = await getApplied(connection);
    if (applied.size === 0) {
      console.log('  Nothing to rollback.');
      return;
    }

    const files = getMigrationFiles();
    const lastApplied = [...applied].sort().pop();
    const file = files.find((f) => parseVersion(f) === lastApplied);
    if (!file) {
      console.error(`  Migration file for version ${lastApplied} not found.`);
      process.exit(1);
    }

    const migration = require(path.join(MIGRATIONS_DIR, file));
    console.log(`  Rolling back ${file} ...`);
    await migration.down(connection);
    await connection.execute(
      'DELETE FROM schema_migrations WHERE version = ?',
      [lastApplied],
    );
    console.log('  Rolled back 1 migration.');
  } finally {
    connection.release();
  }
}

async function runStatus() {
  const connection = await pool.getConnection();
  try {
    await ensureMetaTable(connection);
    const applied = await getApplied(connection);
    const files = getMigrationFiles();

    console.log('  Migration Status:');
    for (const file of files) {
      const version = parseVersion(file);
      const mark = applied.has(version) ? '[applied]' : '[pending] ';
      console.log(`    ${mark} ${file}`);
    }

    if (files.length === 0) {
      console.log('    (no migrations found)');
    }
  } finally {
    connection.release();
  }
}

const command = process.argv[2];
const commands = { up: runUp, down: runDown, status: runStatus };

if (!commands[command]) {
  console.error('Usage: node src/migrate.js <up|down|status>');
  process.exit(1);
}

commands[command]()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  });
