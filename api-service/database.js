const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS image_metadata (
      id SERIAL PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      google_drive_id VARCHAR(255),
      dropbox_id VARCHAR(255),
      size BIGINT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      storage_path TEXT UNIQUE NOT NULL,
      source VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getImages({ source, limit, offset }) {
  const params = [];
  let where = '';

  if (source) {
    params.push(source);
    where = `WHERE source = $${params.length}`;
  }

  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT * FROM image_metadata ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const count = await pool.query(
    `SELECT COUNT(*) FROM image_metadata ${where}`,
    source ? [source] : []
  );

  return { images: rows, total: count.rows[0].count };
}

async function insertImageMetadata(data) {
  await pool.query(
    `INSERT INTO image_metadata 
     (name, google_drive_id, dropbox_id, size, mime_type, storage_path, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      data.name,
      data.google_drive_id,
      data.dropbox_id,
      data.size,
      data.mime_type,
      data.storage_path,
      data.source
    ]
  );
}

module.exports = { initDatabase, getImages, insertImageMetadata };


