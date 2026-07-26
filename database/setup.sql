-- =============================================================
-- Paint Visualizer – Database Setup
-- Run this file to bootstrap a fresh development database.
--
--   mysql -u root -p < database/setup.sql
--
-- After setup, run migrations to apply incremental changes:
--   node backend/src/migrate.js up
-- =============================================================

CREATE DATABASE IF NOT EXISTS paint_visualizer
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE paint_visualizer;

-- -----------------------------------------------------------
-- colors
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS colors (
  id            INT           NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100)  NOT NULL,
  code          VARCHAR(50)   NOT NULL,
  hex           VARCHAR(7)    NOT NULL,
  r_value       SMALLINT UNSIGNED NULL,
  g_value       SMALLINT UNSIGNED NULL,
  b_value       SMALLINT UNSIGNED NULL,
  brand         VARCHAR(100)  NOT NULL,
  finish        VARCHAR(50)   NULL,
  product_flags JSON          NULL,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_colors_brand_code (brand, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- projects
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id         INT          NOT NULL AUTO_INCREMENT,
  name       VARCHAR(150) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- photos
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS photos (
  id          INT          NOT NULL AUTO_INCREMENT,
  project_id  INT          NOT NULL,
  file_url    VARCHAR(500) NOT NULL,
  sort_order  INT          NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_photos_project (project_id),
  CONSTRAINT fk_photos_project FOREIGN KEY (project_id)
    REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- surfaces
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS surfaces (
  id              INT          NOT NULL AUTO_INCREMENT,
  photo_id        INT          NOT NULL,
  label           VARCHAR(50)  NOT NULL,
  custom_name     VARCHAR(100) NULL,
  polygon_coords  JSON         NOT NULL,
  color_id        INT          NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_surfaces_photo  (photo_id),
  KEY idx_surfaces_color  (color_id),
  CONSTRAINT fk_surfaces_photo FOREIGN KEY (photo_id)
    REFERENCES photos (id) ON DELETE CASCADE,
  CONSTRAINT fk_surfaces_color FOREIGN KEY (color_id)
    REFERENCES colors (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- visualizations
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS visualizations (
  id                 INT          NOT NULL AUTO_INCREMENT,
  project_id         INT          NOT NULL,
  name               VARCHAR(150) NOT NULL,
  surface_color_map  JSON         NOT NULL,
  is_default         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_visualizations_project (project_id),
  CONSTRAINT fk_visualizations_project FOREIGN KEY (project_id)
    REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -----------------------------------------------------------
-- schema_migrations  (managed by node backend/src/migrate.js)
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    VARCHAR(10)  NOT NULL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
