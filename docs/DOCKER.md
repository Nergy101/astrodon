# Docker Setup

This project includes a Docker setup to serve the built application using nginx.

## Quick Start

### Build and Push to Docker Hub

```bash
# Build the image
docker build -t nergy101/astrodon:latest .

# Push to Docker Hub (requires login)
docker push nergy101/astrodon:latest
```

### Run Locally

```bash
# Build the image
docker build -t astrodon .

# Run the container
docker run -p 8080:80 astrodon
```

Then visit `http://localhost:8080` in your browser.

### Pull and Run from Docker Hub

```bash
# Pull the image
docker pull nergy101/astrodon:latest

# Run the container
docker run -p 8080:80 nergy101/astrodon:latest
```

## Docker Commands Reference

- **Build**: `docker build -t nergy101/astrodon:latest .`
- **Push**: `docker push nergy101/astrodon:latest`
- **Pull**: `docker pull nergy101/astrodon:latest`
- **Run**: `docker run -p 8080:80 nergy101/astrodon:latest`
- **Run in background**: `docker run -d -p 8080:80 nergy101/astrodon:latest`
- **Stop container**: `docker stop <container_id>`

## What's Included

- **Base Image**: nginx:alpine (lightweight)
- **Content**: Serves files from the `dist/` folder
- **Port**: Exposes port 80 (mapped to host port 8080)
- **Features**:
  - Gzip compression
  - Static file caching
  - Security headers
  - SPA routing support (fallback to index.html)
