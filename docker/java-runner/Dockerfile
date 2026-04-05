# docker/java-runner/Dockerfile

# 1. Base image: Alpine with OpenJDK installed (much smaller)
FROM alpine:latest

# Install OpenJDK, bash and coreutils
RUN apk add --no-cache openjdk17 bash coreutils

# 2. Create a working directory in the container
WORKDIR /workspace

# 3. At runtime, we'll mount the host folder containing Main.java and stdin.txt into /workspace.

# 4. We will compile then run using:
#      javac Main.java && timeout 5s java Main < stdin.txt

# No default CMD; command provided via "docker run" command.