# Quick Start Guide

Get started in 3 steps!

## Prerequisites

- Docker Desktop installed and running
- (Optional) Google Drive API key for full functionality

## Step 1: Start the System

```bash
docker-compose up --build
```

This will:
- Build all Docker images
- Start MySQL database
- Start Redis queue
- Start MinIO storage
- Start API Gateway service
- Start Image Processor workers (2 instances)
- Start Frontend application

## Step 2: Wait for Services

Wait for all services to be healthy (usually 30-60 seconds). You'll see logs indicating when services are ready.

## Step 3: Access the Application

- **Frontend**: Open http://localhost:3000 in your browser
- **API Service**: http://localhost:8000
- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin`

## Step 4: Import Images

1. Open the frontend at http://localhost:3000
2. Enter a Google Drive folder URL (public folder)
3. Click "Import Images"
4. Wait for processing (check worker logs)
5. View imported images in the list

## Testing with API

### Using cURL

```bash
# Import from Google Drive
curl -X POST "http://localhost:8000/import/google-drive" \
  -H "Content-Type: application/json" \
  -d '{"folder_url": "https://drive.google.com/drive/folders/YOUR_FOLDER_ID"}'

# Get all images
curl "http://localhost:8000/images"

# Get Google Drive images only
curl "http://localhost:8000/images?source=google_drive"
```

### Using Postman

1. Import `postman_collection.json` into Postman
2. Set the `base_url` variable to `http://localhost:8000`
3. Run requests from the collection

## Scaling Workers

To process more images in parallel, scale the workers:

```bash
docker-compose up --scale image-processor=5
```

This will run 5 worker instances.

## Stopping the System

```bash
docker-compose down
```

To remove all data (volumes):

```bash
docker-compose down -v
```

## Troubleshooting

### Services won't start
- Check Docker Desktop is running
- Check ports 3000, 8000, 3306, 6379, 9000, 9001 are not in use
- Check logs: `docker-compose logs [service-name]`

### Images not importing
- Verify Google Drive folder is publicly accessible
- Check worker logs: `docker-compose logs image-processor`
- Verify Google Drive API key is set (if needed)

### Database connection errors
- Wait for PostgreSQL to be fully ready
- Check database logs: `docker-compose logs postgres`

## Next Steps

- Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for API details
- Read [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
- Configure environment variables in `.env` file
- Set up Google Drive API key for better functionality

