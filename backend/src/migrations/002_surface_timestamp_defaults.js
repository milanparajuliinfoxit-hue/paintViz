/**
 * Migration 002: Ensure surfaces.updated_at has a default so inserts
 * from the canvas tracing flow succeed.
 */
exports.up = async function up(pool) {
  await pool.execute(`
    ALTER TABLE surfaces
      MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ON UPDATE CURRENT_TIMESTAMP(3)
  `);
};

exports.down = async function down(pool) {
  await pool.execute(`
    ALTER TABLE surfaces
      MODIFY COLUMN updated_at DATETIME(3) NOT NULL
  `);
};
