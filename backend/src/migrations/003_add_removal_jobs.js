/**
 * Migration 003: Add removal_jobs table and photos lineage columns
 * for the AI Object Detection & Removal feature.
 */
exports.up = async function up(pool) {
  await pool.execute(`
    ALTER TABLE photos
      ADD COLUMN source_photo_id INT NULL,
      ADD COLUMN is_cleaned_variant BOOLEAN NOT NULL DEFAULT FALSE,
      ADD CONSTRAINT fk_photos_source
        FOREIGN KEY (source_photo_id) REFERENCES photos(id) ON DELETE CASCADE
  `);

  await pool.execute(`
    CREATE TABLE removal_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      photo_id INT NOT NULL,
      mask_url VARCHAR(500) NOT NULL,
      status ENUM('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
      result_photo_id INT NULL,
      error_message TEXT NULL,
      attempts INT NOT NULL DEFAULT 0,
      locked_at TIMESTAMP NULL,
      locked_by VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
      FOREIGN KEY (result_photo_id) REFERENCES photos(id) ON DELETE SET NULL,
      INDEX idx_status_created (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

exports.down = async function down(pool) {
  await pool.execute('DROP TABLE IF EXISTS removal_jobs');
  await pool.execute(`
    ALTER TABLE photos
      DROP FOREIGN KEY fk_photos_source,
      DROP COLUMN source_photo_id,
      DROP COLUMN is_cleaned_variant
  `);
};
