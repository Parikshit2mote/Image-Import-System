/**
 * Database connection and queries using PostgreSQL
 */
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Create PostgreSQL connection pool
 * Render provides DATABASE_URL automatically
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Initialize database tables
 */
async function initDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS image_metadata (
        id SERIAL PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        google_drive_id VARCHAR(255),
        dropbox_id VARCHAR(255),
        size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        storage_path VARCHAR(1000) UNIQUE NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);
    console.log('Database table initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Get images with optional filtering and pagination
 */
async function getImages({ source = null, limit = 100, offset = 0 }) {
  try {
    let query = 'SELECT * FROM image_metadata';
    const params = [];

    if (source) {
      query += ' WHERE source = $1';
      params.push(source);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) AS total FROM image_metadata';
    const countParams = [];

    if (source) {
      countQuery += ' WHERE source = $1';
      countParams.push(source);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      images: rows,
      total
    };
  } catch (error) {
    console.error('Error getting images:', error);
    throw error;
  }
}

/**
 * Insert image metadata
 */
async function insertImageMetadata(imageData) {
  try {
    const query = `
      INSERT INTO image_metadata
      (name, google_drive_id, dropbox_id, size, mime_type, storage_path, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;

    const params = [
      imageData.name,
      imageData.google_drive_id || null,
      imageData.dropbox_id || null,
      imageData.size,
      imageData.mime_type,
      imageData.storage_path,
      imageData.source
    ];

    const result = await pool.query(query, params);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error inserting image metadata:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initDatabase,
  getImages,
  insertImageMetadata
};
