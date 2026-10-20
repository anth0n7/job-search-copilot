# =============================================================================
# Dockerfile = a recipe for building an IMAGE (a snapshot of a filesystem +
# metadata). Running an image creates a CONTAINER (a running process).
#
# Analogy: image ≈ class, container ≈ instance.
# =============================================================================

# FROM picks a starting filesystem. node:22-alpine is Node 22 on a tiny Linux.
# Official images live on Docker Hub: https://hub.docker.com/_/node
FROM node:22-alpine

# WORKDIR creates the folder if needed and makes it the default for later
# COPY / RUN / CMD. Paths below are relative to this directory inside the image.
WORKDIR /app

# Copy dependency manifests FIRST, then install. Docker caches each instruction
# as a "layer". If package.json hasn't changed, Docker reuses the cached
# npm ci layer instead of re-downloading everything on every rebuild.
COPY package.json package-lock.json ./

# npm ci = clean install from the lockfile (reproducible, preferred in Docker).
RUN npm ci

# Now copy the rest of the source. Code changes invalidate only this layer
# and anything after it — not the npm ci layer above.
COPY . .

# EXPOSE is documentation for humans/tools: "this process listens on 3001".
# It does NOT publish the port to your machine — that happens in compose
# with "ports:" or via `docker run -p`.
EXPOSE 3001

# CMD is the default process when a container starts from this image.
# `npm start` runs the Express API once (see package.json).
# For live-reload during learning, docker-compose overrides this with `npm run dev`.
CMD ["npm", "start"]
