# docker/python-runner/Dockerfile

# 1. Base image: Alpine-based Python 3 (much smaller)
FROM python:3.11-alpine

# Install bash and coreutils for timeout command
RUN apk add --no-cache bash coreutils

# Programs run as this user, not root, so they can't change the compilers or the system
RUN adduser -D -u 1000 runner && mkdir -p /workspace && chown runner:runner /workspace

# 2. Set working directory inside container
WORKDIR /workspace
USER runner

# (No files are copied at build time; we'll mount at runtime)

# 3. No ENTRYPOINT or CMD; compile/run commands passed at run-time
