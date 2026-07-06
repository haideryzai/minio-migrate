# MinIO Migration Tool

Migrate data between MinIO instances with full metadata and tagging preservation.

## Quick Start (Docker)

1. Copy `.env.example` to `.env` and update with remote MinIO endpoints:
```bash
cp .env.example .env
```

2. Run migration:
```bash
docker-compose up
```

## Using with Existing MinIO Instances

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your MinIO endpoints and credentials

3. Run with Docker:
```bash
docker build -t minio-migrate .
docker run --env-file .env minio-migrate
```

Or run locally with Node.js:
```bash
npm install
npm start
```

## Environment Variables

```env
OLD_ENDPOINT=http://old-minio:9000       # Source MinIO endpoint
OLD_REGION=us-east-1                     # Source region
OLD_ACCESS_KEY=minioadmin                # Source access key
OLD_SECRET_KEY=minioadmin                # Source secret key

NEW_ENDPOINT=http://new-minio:9000       # Target MinIO endpoint
NEW_REGION=us-east-1                     # Target region
NEW_ACCESS_KEY=minioadmin                # Target access key
NEW_SECRET_KEY=minioadmin                # Target secret key
```

## What Gets Migrated

- All buckets and objects
- Object metadata (ContentType, ContentEncoding, etc.)
- Object tags
- Cache headers
- Custom metadata

## Docker

### Image

Base: `node:18-alpine` (~150MB)

### Running

```bash
# With docker-compose (recommended)
docker-compose up

# Manual docker run
docker build -t minio-migrate .
docker run --env-file .env minio-migrate
```
