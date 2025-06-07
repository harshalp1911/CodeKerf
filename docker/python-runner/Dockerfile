# docker/python-runner/Dockerfile

# 1. Base image: official Python 3
FROM python:3

# 2. Set working directory inside container
WORKDIR /workspace

# (No files are copied at build time; we'll mount at runtime)

# 3. No ENTRYPOINT or CMD; compile/run commands passed at run-time
