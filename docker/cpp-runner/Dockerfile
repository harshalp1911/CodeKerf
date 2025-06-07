# docker/cpp-runner/Dockerfile

# 1. Base image: official GCC toolchain on a slim Debian
FROM gcc:latest

# 2. Create a working directory inside the container
WORKDIR /workspace

# 3. Copy whatever code and stdin file we mount from the host into /workspace
#    (We will mount a host directory at runtime—no COPY commands needed here.)

# 4. Compile and run instructions will be provided as the container's entrypoint.
#    For flexibility, we'll rely on "bash -c" at runtime rather than hardcoding an ENTRYPOINT.

# By default, no CMD is set here. We'll pass commands when we run the container.
