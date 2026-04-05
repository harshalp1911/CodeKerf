#!/bin/bash

# Build Docker runner images for CodeKerf
# This script builds the Alpine-based Docker images for C++, Python, and Java execution

set -e

echo "🐳 Building Docker runner images..."

# Build C++ runner
echo "📦 Building C++ runner (gcc:13-alpine)..."
cd docker/cpp-runner
docker build -t cpp-runner:latest .
cd ../..

# Build Python runner
echo "📦 Building Python runner (python:3.11-alpine)..."
cd docker/python-runner
docker build -t python-runner:latest .
cd ../..

# Build Java runner
echo "📦 Building Java runner (openjdk:17-alpine)..."
cd docker/java-runner
docker build -t java-runner:latest .
cd ../..

echo "✅ All Docker runner images built successfully!"
echo ""
echo "Images created:"
docker images | grep -E "cpp-runner|python-runner|java-runner"
