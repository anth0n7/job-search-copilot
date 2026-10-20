# =============================================================================
# Multi-stage build: one Dockerfile, several images built in sequence.
# Only the final stage becomes the image you run — earlier stages are helpers.
#
# Stages used here:
#   development → Vite dev server (hot reload), for learning / local compose
#   build       → compiles the React app into static files in /app/dist
#   production  → nginx serving those static files (small, production-like)
# =============================================================================

# ----- Stage: development ----------------------------------------------------
FROM node:22-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 is also set in vite.config.ts; kept here so the CMD is explicit.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# ----- Stage: build ----------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes VITE_* variables into the JS bundle at build time.
# Pass them as build args from compose / `docker build --build-arg ...`.
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_API_URL=http://localhost:3001
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ----- Stage: production -----------------------------------------------------
FROM nginx:alpine AS production

# Replace the default nginx site with ours (SPA fallback for React Router).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ONLY the built assets from the build stage — not node_modules or source.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
