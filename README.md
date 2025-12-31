# Image Import System – Internship Assignment

A Dockerized, multi-service system for importing images from Google Drive, processing them asynchronously, and storing them in object storage (S3/MinIO) with metadata persisted in MySQL.

This project demonstrates microservice architecture, queue-based processing, and scalable background workers.

---
## 🚀Live Deployment (Working URLs)

Frontend (React UI):
👉 https://image-frontend-19yu.onrender.com/

Backend API (Express):
👉 https://image-api-22tu.onrender.com/

## Architecture Overview

### Core Services (Node.js)

1. **API Service**
   - Express-based REST API
   - Accepts import requests from the frontend
   - Enqueues folder import jobs into Redis

2. **Import Service**
   - Consumes folder jobs from Redis
   - Lists images from Google Drive folders
   - Enqueues individual image processing tasks

3. **Worker Service**
   - Consumes image tasks from Redis
   - Downloads images
   - Uploads images to S3-compatible storage (MinIO)
   - Stores metadata in MySQL

**Supporting Services:**
- MySQL - Stores metadata
- Redis - Job queue
- MinIO/S3 - Image storage
- React Frontend - UI

## System Flow

```
1. Frontend → API Service (enqueue folder job)
2. Import Service → Lists folder → Enqueues image tasks
3. Worker Service → Downloads → Uploads to S3 → Saves to MySQL
```

## Quick Start

```bash
docker-compose up --build
```

Access:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

## Project Structure

```
frontend/          # React app
api-service/       # Express API
import-service/    # Lists Google Drive folders
worker-service/    # Downloads/uploads images
docker-compose.yml # All services
```

## API Endpoints

**POST /import/google-drive**
```json
{ "folder_url": "https://drive.google.com/drive/folders/FOLDER_ID" }
```

**GET /images**
- Query params: `?source=google_drive&limit=100&offset=0`

## Features

✅ Multi-service architecture  
✅ Queue-based async processing  
✅ Retry logic (exponential backoff)  
✅ Horizontal scaling support  
✅ MySQL for metadata  
✅ S3/MinIO for storage  

## Deployment Note

Due to Render free-tier limitations (background workers require paid plans),
the import-service and worker-service are merged into the API service at runtime
for demo purposes.

The system remains logically multi-service and can be deployed as fully
independent services on paid infrastructure or Kubernetes.


