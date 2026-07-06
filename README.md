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

The script will:
1. Validate both MinIO connections
2. List all buckets from source
3. Copy each bucket and its objects (with metadata & tags)
4. Exit on first connection failure

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

## Testing Locally

To test with local MinIO instances, add them to `docker-compose.yml` using:
```
minio/minio:RELEASE.2025-02-18T16-25-55Z
```

Update `.env` to point to local instances:
```env
OLD_ENDPOINT=http://old-minio:9000
NEW_ENDPOINT=http://new-minio:9000
```

## Environment Variables

### Endpoint Configuration

Two ways to specify endpoints:

**Option 1: Full URL**
```env
OLD_ENDPOINT=http://storagevds:9002
NEW_ENDPOINT=https://rack.avads.live:9002
```

**Option 2: Separate components**
```env
OLD_ENDPOINT=storagevds
OLD_PORT=9002
OLD_USE_SSL=false

NEW_ENDPOINT=rack.avads.live
NEW_PORT=9002
NEW_USE_SSL=true
```

### Credentials

Two ways to specify credentials:

**Option 1: Access Keys (recommended)**
```env
OLD_ACCESS_KEY=FJwPFvrTKsXp9AEphSq6
OLD_SECRET_KEY=ZX9X8TW2gcaxbWWR6jLE5zuR1uQut7BtBv9CVHr7

NEW_ACCESS_KEY=your_access_key
NEW_SECRET_KEY=your_secret_key
```

**Option 2: Root User/Password**
```env
OLD_ROOT_USER=adminio
OLD_ROOT_PASSWORD=adMinio@123

NEW_ROOT_USER=adminio
NEW_ROOT_PASSWORD=adMinio@123
```

### Optional
```env
OLD_REGION=us-east-1          # Default: us-east-1
NEW_REGION=us-east-1          # Default: us-east-1
```

## Configuration Priority

**Endpoints:**
1. Direct URL with protocol: `OLD_ENDPOINT=http://host:port`
2. Separate components: `OLD_ENDPOINT=host` + `OLD_PORT=9000` + `OLD_USE_SSL=false`

**Credentials:**
1. Access keys: `OLD_ACCESS_KEY` + `OLD_SECRET_KEY`
2. Root user: `OLD_ROOT_USER` + `OLD_ROOT_PASSWORD` (fallback if access keys missing)

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
