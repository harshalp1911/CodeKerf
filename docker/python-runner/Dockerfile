# docker/python-runner/Dockerfile

# 1. Base image: Alpine-based Python 3 (much smaller)
FROM python:3.11-alpine

# Install bash and coreutils for timeout command
RUN apk add --no-cache bash coreutils

# 2. Set working directory inside container
WORKDIR /workspace

# (No files are copied at build time; we'll mount at runtime)

# 3. No ENTRYPOINT or CMD; compile/run commands passed at run-time
