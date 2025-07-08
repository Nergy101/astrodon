#!/bin/bash

# Build the Docker image
echo "Building Docker image..."
docker build -t nergy101/astrodon:latest .

# Push to Docker Hub
echo "Pushing to Docker Hub..."
docker push nergy101/astrodon:latest

echo "Done! Image pushed to nergy101/astrodon:latest" 