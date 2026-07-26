/**
 * Migration 001: Add r_value, g_value, b_value columns to colors table.
 * Backfills existing rows by deriving RGB from hex.
 */
exports.up = async function up(pool) {
  await pool.execute(`
    ALTER TABLE colors
      ADD COLUMN r_value SMALLINT UNSIGNED NULL AFTER hex,
      ADD COLUMN g_value SMALLINT UNSIGNED NULL AFTER r_value,
      ADD COLUMN b_value SMALLINT UNSIGNED NULL AFTER g_value
  `);

  // Backfill RGB from hex for all existing rows
  await pool.execute(`
    UPDATE colors
    SET
      r_value = CONV(SUBSTRING(hex, 2, 2), 16, 10),
      g_value = CONV(SUBSTRING(hex, 4, 2), 16, 10),
      b_value = CONV(SUBSTRING(hex, 6, 2), 16, 10)
    WHERE r_value IS NULL
  `);
};

exports.down = async function down(pool) {
  await pool.execute(`
    ALTER TABLE colors
      DROP COLUMN r_value,
      DROP COLUMN g_value,
      DROP COLUMN b_value
  `);
};
