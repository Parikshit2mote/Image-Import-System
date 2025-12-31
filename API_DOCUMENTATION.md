# API Documentation

## Base URL

- Local: `http://localhost:8000`
- Production: `{YOUR_DEPLOYED_URL}`

## Endpoints

### 1. Import Images from Google Drive

**POST** `/import/google-drive`

Import images from a public Google Drive folder.

**Request Body:**
```json
{
  "folder_url": "https://drive.google.com/drive/folders/FOLDER_ID"
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "folder_url": "https://drive.google.com/drive/folders/FOLDER_ID"
}
```

**Status Codes:**
- `200 OK`: Job queued successfully
- `400 Bad Request`: Invalid folder URL
- `500 Internal Server Error`: Failed to enqueue job

---

### 2. Import Images from Dropbox (Bonus)

**POST** `/import/dropbox`

Import images from a Dropbox public folder.

**Request Body:**
```json
{
  "folder_url": "https://www.dropbox.com/sh/xxxxx/yyyyy"
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "folder_url": "https://www.dropbox.com/sh/xxxxx/yyyyy"
}
```

**Status Codes:**
- `200 OK`: Job queued successfully
- `400 Bad Request`: Invalid folder URL
- `500 Internal Server Error`: Failed to enqueue job

---

### 3. Get Imported Images

**GET** `/images`

Retrieve list of all imported images with metadata.

**Query Parameters:**
- `source` (optional): Filter by source (`google_drive` or `dropbox`)
- `limit` (optional): Number of results per page (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)

**Example Requests:**
```bash
# Get all images
GET /images

# Get Google Drive images only
GET /images?source=google_drive

# Paginated request
GET /images?limit=50&offset=0
```

**Response:**
```json
{
  "images": [
    {
      "id": 1,
      "name": "photo.jpg",
      "google_drive_id": "1abc123def456",
      "size": 2048576,
      "mime_type": "image/jpeg",
      "storage_path": "s3://images/images/google_drive/1abc123def456/photo.jpg",
      "source": "google_drive",
      "created_at": "2024-01-01T12:00:00Z"
    }
  ],
  "total": 150,
  "limit": 100,
  "offset": 0
}
```

**Status Codes:**
- `200 OK`: Success
- `500 Internal Server Error`: Database error

---

### 4. Health Check

**GET** `/health`

Check API Gateway service health.

**Response:**
```json
{
  "status": "healthy",
  "service": "api-gateway"
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service is unhealthy

---

## cURL Examples

### Import from Google Drive
```bash
curl -X POST "http://localhost:8000/import/google-drive" \
  -H "Content-Type: application/json" \
  -d '{
    "folder_url": "https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
  }'
```

### Import from Dropbox
```bash
curl -X POST "http://localhost:8000/import/dropbox" \
  -H "Content-Type: application/json" \
  -d '{
    "folder_url": "https://www.dropbox.com/sh/YOUR_FOLDER_ID"
  }'
```

### Get All Images
```bash
curl "http://localhost:8000/images"
```

### Get Images with Filter
```bash
curl "http://localhost:8000/images?source=google_drive&limit=50&offset=0"
```

---

## Postman Collection

A Postman collection is available at `postman_collection.json`. Import it into Postman to test all endpoints.

---

## Notes

1. **Async Processing**: Import requests are processed asynchronously. The API returns immediately with a job ID. Images are processed in the background by worker services.

2. **Google Drive API Key**: For full functionality with Google Drive, set the `GOOGLE_DRIVE_API_KEY` environment variable. Without it, some features may be limited.

3. **Pagination**: Use `limit` and `offset` parameters for pagination. The response includes `total` count for building pagination UI.

4. **Filtering**: Use the `source` parameter to filter images by their origin (google_drive, dropbox).

5. **Rate Limiting**: In production, implement rate limiting to prevent abuse.

6. **Authentication**: In production, add authentication/authorization to protect endpoints.










