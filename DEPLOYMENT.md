# Deployment Guide

> **Note:** This is a simplified deployment guide. For production, add authentication, monitoring, and proper security measures.

## Local Development

### Prerequisites

- Docker and Docker Compose installed
- (Optional) Google Drive API key for full functionality

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Backend Assignment"
   ```

2. **Set up environment variables** (optional)
   ```bash
   # Copy example environment file
   # Create .env file with your configurations
   ```

3. **Start all services**
   ```bash
   docker-compose up --build
   ```

4. **Access services**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - MinIO Console: http://localhost:9001
     - Username: minioadmin
     - Password: minioadmin

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DATABASE=image_import

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# MinIO/S3
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=images

# AWS S3 (if using instead of MinIO)
USE_AWS_S3=false
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Google Drive API (optional but recommended)
GOOGLE_DRIVE_API_KEY=your_api_key_here

# Frontend
API_BASE_URL=http://localhost:8000
```

### Scaling Workers

To scale the image processing workers:

```bash
docker-compose up --scale image-processor=5
```

This will run 5 worker instances processing jobs in parallel.

---

## Production Deployment

### Cloud Deployment Options

#### Option 1: Kubernetes

1. **Create Kubernetes manifests**
   - Deployments for each service
   - Services for internal/external communication
   - ConfigMaps for configuration
   - Secrets for sensitive data
   - Ingress for external access

2. **Deploy MySQL**
   ```bash
   kubectl apply -f k8s/mysql-deployment.yaml
   kubectl apply -f k8s/mysql-service.yaml
   ```

3. **Deploy Redis**
   ```bash
   kubectl apply -f k8s/redis-deployment.yaml
   kubectl apply -f k8s/redis-service.yaml
   ```

4. **Deploy MinIO/S3**
   ```bash
   # Or use managed S3 service
   kubectl apply -f k8s/minio-deployment.yaml
   ```

5. **Deploy API Gateway**
   ```bash
   kubectl apply -f k8s/api-gateway-deployment.yaml
   kubectl apply -f k8s/api-gateway-service.yaml
   ```

6. **Deploy Workers**
   ```bash
   kubectl apply -f k8s/image-processor-deployment.yaml
   # Scale workers
   kubectl scale deployment image-processor --replicas=10
   ```

7. **Deploy Frontend**
   ```bash
   kubectl apply -f k8s/frontend-deployment.yaml
   kubectl apply -f k8s/frontend-service.yaml
   ```

#### Option 2: AWS ECS

1. **Build and push Docker images to ECR**
   ```bash
   aws ecr create-repository --repository-name image-import-api-gateway
   aws ecr create-repository --repository-name image-import-worker
   aws ecr create-repository --repository-name image-import-frontend
   
   # Build and push
   docker build -t image-import-api-gateway ./api-gateway
   docker tag image-import-api-gateway:latest YOUR_ECR_URL/image-import-api-gateway:latest
   docker push YOUR_ECR_URL/image-import-api-gateway:latest
   ```

2. **Create ECS Task Definitions** for each service

3. **Create ECS Services** with desired capacity

4. **Configure Application Load Balancer** for API Gateway and Frontend

5. **Use RDS for MySQL** and **ElastiCache for Redis**

6. **Use S3** for object storage

#### Option 3: Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Create overlay network
docker network create --driver overlay image-import-network

# Deploy stack
docker stack deploy -c docker-compose.prod.yml image-import

# Scale services
docker service scale image-import_image-processor=10
```

#### Option 4: Serverless (AWS Lambda + API Gateway)

1. **Package API Gateway as Lambda function**
2. **Use SQS** instead of Redis for queue
3. **Use Lambda workers** triggered by SQS
4. **Use RDS Proxy** for database connections
5. **Use S3** for storage
6. **Use CloudFront + S3** for frontend

---

## Production Considerations

### Database

- Use **managed MySQL** (RDS, Cloud SQL, etc.)
- Set up **connection pooling** (PgBouncer)
- Configure **backup and replication**
- Use **read replicas** for read-heavy workloads

### Queue

- Use **managed Redis** (ElastiCache, Memorystore, etc.)
- Consider **Redis Cluster** for high availability
- Set up **monitoring and alerting**

### Storage

- Use **S3** or equivalent cloud storage
- Configure **lifecycle policies**
- Set up **CDN** for image delivery
- Implement **versioning** if needed

### Monitoring

- Set up **application monitoring** (Datadog, New Relic, etc.)
- Configure **logging aggregation** (CloudWatch, ELK stack)
- Set up **health checks** and **alerts**
- Monitor **queue depth** and **processing times**

### Security

- Use **secrets management** (AWS Secrets Manager, HashiCorp Vault)
- Enable **HTTPS/TLS** everywhere
- Implement **authentication/authorization**
- Use **VPC** for network isolation
- Regular **security updates**

### Scaling

- **API Gateway**: Horizontal scaling (load balancer)
- **Workers**: Scale based on queue depth
- **Database**: Connection pooling + read replicas
- **Storage**: Cloud storage is inherently scalable

### High Availability

- Deploy across **multiple availability zones**
- Use **load balancers** with health checks
- Implement **circuit breakers** and **retries**
- Set up **database replication**
- Use **Redis Sentinel** or cluster mode

---

## Performance Optimization

1. **Batch Processing**: Process multiple images in parallel within each worker
2. **Connection Pooling**: Reuse database connections
3. **Caching**: Cache frequently accessed metadata
4. **CDN**: Use CDN for image delivery
5. **Compression**: Compress images during upload
6. **Async Operations**: All heavy operations are already async

---

## Troubleshooting

### Workers not processing jobs

1. Check Redis connection
2. Check queue name matches
3. Check worker logs
4. Verify job format in queue

### Database connection errors

1. Check MySQL credentials
2. Verify network connectivity
3. Check connection pool settings
4. Verify MySQL is running
5. Ensure MySQL uses native password authentication

### Storage upload failures

1. Check storage credentials
2. Verify bucket exists
3. Check network connectivity
4. Verify IAM permissions (for AWS S3)

### Google Drive import fails

1. Verify API key is set
2. Check folder is publicly accessible
3. Check API quotas
4. Review error logs

