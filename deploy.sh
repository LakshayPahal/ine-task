#!/bin/bash

echo "Starting Auction App Deployment..."

# Stop and remove existing containers
echo "Stopping existing containers..."
docker stop auction-app-container 2>/dev/null || true
docker rm auction-app-container 2>/dev/null || true

# Remove old image
echo "Removing old image..."
docker rmi auction-app:latest 2>/dev/null || true

# Build new image
echo "Building new Docker image..."
docker build -t auction-app .

# Run new container
echo "Starting new container..."
docker run -d --name auction-app-container -p 8080:8080 auction-app

# Wait for container to start
echo "Waiting for container to start..."
sleep 5

# Check container status
echo "Container status:"
docker ps | grep auction-app

# Test the application
echo "Testing application..."
if curl -s http://localhost:8080 > /dev/null; then
    echo "Application is running successfully!"
    echo "Frontend: http://localhost:8080"
    echo "API: http://localhost:8080/api/auctions"
else
    echo "Application failed to start"
    echo "Container logs:"
    docker logs auction-app-container
fi

echo "Deployment complete!" 