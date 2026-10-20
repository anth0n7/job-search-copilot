# Learning Docker with Job Search Copilot

This guide walks through Docker using **this** app (React + Express + Postgres), not a toy example. Read a section, run the commands, then peek at the matching file.

## Mental model (5 minutes)

| Term | What it is | In this project |
|------|------------|-----------------|
| **Image** | Immutable snapshot (filesystem + default command) | Built from `server/Dockerfile` / `client/Dockerfile`, or pulled (`postgres:16-alpine`) |
| **Container** | A running process started from an image | `jsc-server`, `jsc-client`, `jsc-db` |
| **Dockerfile** | Recipe that builds an image | `server/Dockerfile`, `client/Dockerfile` |
| **Compose** | YAML that runs several containers together | `docker-compose.yml` |
| **Volume** | Storage that outlives a container | `pgdata` keeps your Postgres data |
| **Network** | Private network Compose creates | `server` reaches Postgres at hostname `db` |

**Image ≈ class, container ≈ instance.** You build (or pull) an image once; you can start many containers from it.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or Docker Engine + Compose plugin (Linux)
- API keys from Clerk, Anthropic, and Voyage (same as non-Docker local setup)

Check that Docker is working:

```bash
docker version
docker compose version
```

## Lesson 1 — Run Postgres alone (no Dockerfile)

You do not need a custom Dockerfile for every service. Official images on Docker Hub are enough for databases.

```bash
docker pull postgres:16-alpine
docker run --name learn-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jobtracker \
  -p 5432:5432 \
  -d postgres:16-alpine
```

What just happened:

1. `pull` downloaded the image layers
2. `run` created a **container** from that image
3. `-e` set environment variables the image documents
4. `-p 5432:5432` published container port 5432 on your laptop
5. `-d` ran it in the background

Inspect and clean up:

```bash
docker ps                    # running containers
docker logs learn-pg         # what the process printed
docker exec -it learn-pg psql -U postgres -d jobtracker   # shell into the container
docker stop learn-pg && docker rm learn-pg
```

Compose will do this for you next — this was just to feel the raw commands.

## Lesson 2 — Build and run the API image

Open `server/Dockerfile` and read the comments top to bottom. Then:

```bash
cd server
docker build -t jsc-server .
```

`-t jsc-server` tags the image with a memorable name. `.` is the **build context** (files sent to Docker; filtered by `.dockerignore`).

Try running it alone (it will fail to talk to Postgres — that is expected):

```bash
docker run --rm -p 3001:3001 --env-file ../.env jsc-server
```

`--rm` deletes the container when it exits. The failure teaches something important: **inside a container, `localhost` is the container itself**, not your laptop and not another container. The API needs a hostname for Postgres — Compose provides that as `db`.

## Lesson 3 — Compose: three services, one command

1. Create env file at the **repo root**:

```bash
cp .env.example .env
# edit .env with your real keys
```

2. Start everything:

```bash
docker compose up --build
```

| Flag | Meaning |
|------|---------|
| `up` | Create networks/volumes, build images if needed, start containers |
| `--build` | Rebuild images even if they exist (use after Dockerfile changes) |

Open http://localhost:5173 — same app, but Postgres + API + Vite all run in containers.

Useful companions:

```bash
docker compose ps              # status
docker compose logs -f server  # follow API logs
docker compose down            # stop and remove containers (keeps pgdata volume)
docker compose down -v         # also delete volumes (wipes the database)
```

### The networking “aha”

In `docker-compose.yml`, the API’s `DATABASE_URL` host is **`db`**, not `localhost`:

```text
postgresql://postgres:postgres@db:5432/jobtracker
                 service name ──┘
```

Compose puts services on a shared network and DNS-resolves each service name. Your **browser** still uses `http://localhost:3001` because the browser is not inside that network — it hits the published port on your machine.

### Hot reload while learning

Compose bind-mounts `./server` and `./client` into the containers and runs `npm run dev` / Vite. Edit code on your machine; the processes inside the containers pick up changes. The anonymous `/app/node_modules` volumes keep Linux `node_modules` from being overwritten by your host folder.

## Lesson 4 — Layers and why copy order matters

In both Dockerfiles we do:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

Each instruction creates a **layer**. If only your source changes, Docker reuses the cached `npm ci` layer. If we copied everything before `npm ci`, every code change would reinstall dependencies. That ordering is the most common Dockerfile performance tip.

## Lesson 5 — Multi-stage client build (production-shaped)

`client/Dockerfile` has three stages: `development`, `build`, `production`.

Compose uses `target: development` (Vite). To build the nginx production image yourself:

```bash
cd client
docker build \
  --target production \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_test_... \
  --build-arg VITE_API_URL=http://localhost:3001 \
  -t jsc-client:prod .
docker run --rm -p 8080:80 jsc-client:prod
```

Open http://localhost:8080. You are now serving static files with nginx — no Node process for the frontend. Multi-stage builds keep the final image small: only `dist/` + nginx, not `node_modules`.

## Quick reference

```bash
# everyday
docker compose up --build
docker compose down

# rebuild one service
docker compose build server
docker compose up server

# debug
docker compose logs -f
docker compose exec server sh          # shell in the API container
docker compose exec db psql -U postgres -d jobtracker

# images & cleanup
docker images
docker system prune                    # remove unused data (ask before -a)
```

## How this maps to files

| File | Role |
|------|------|
| `docker-compose.yml` | Wires `db` + `server` + `client` |
| `server/Dockerfile` | Recipe for the API image |
| `client/Dockerfile` | Dev / build / nginx production stages |
| `client/nginx.conf` | SPA routing for React Router in production |
| `*/.dockerignore` | Keep secrets and junk out of the build context |
| `.env.example` | Template for secrets and config |

## What to try next (when you are ready)

- Add a **production** Compose override that uses `client` `target: production` and `server` `npm start` (no bind mounts)
- Push images to a registry and run them on a VPS or AWS ECS/Fargate (your README “what I’d add next” item)
- Add a healthcheck endpoint on the API and a Compose `healthcheck` for `server`
