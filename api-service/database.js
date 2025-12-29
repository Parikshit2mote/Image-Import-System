/**
 * Database connection and queries using MySQL
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'image_import',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/**
 * Initialize database tables
 */
async function initDatabase() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS image_metadata (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        google_drive_id VARCHAR(255) NULL,
        dropbox_id VARCHAR(255) NULL,
        size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        storage_path VARCHAR(255) NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_google_drive_id (google_drive_id),
        INDEX idx_dropbox_id (dropbox_id),
        INDEX idx_source (source),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.execute(createTableQuery);
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
      query += ' WHERE source = ?';
      params.push(source);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM image_metadata';
    const countParams = [];
    if (source) {
      countQuery += ' WHERE source = ?';
      countParams.push(source);
    }
    const [countRows] = await pool.execute(countQuery, countParams);
    const total = countRows[0].total;

    // Format results
    const images = rows.map(row => ({
      id: row.id,
      name: row.name,
      google_drive_id: row.google_drive_id,
      dropbox_id: row.dropbox_id,
      size: row.size,
      mime_type: row.mime_type,
      storage_path: row.storage_path,
      source: row.source,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null
    }));

    return {
      images,
      total
    };
  } catch (error) {
    console.error('Error getting images:', error);
    throw error;
  }
}

module.exports = {
  pool,
  initDatabase,
  getImages
};







