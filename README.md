# TripPlanner

TripPlanner is a web application for creating and managing personal travel plans.
Users can register, sign in, and organize trips by destination, date, notes, and
status.

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB Atlas
- **Cache:** Redis
- **Authentication:** JWT and bcrypt
- **Testing:** Vitest and Supertest
- **Containers:** Docker, Docker Compose, nginx

## Architecture

```text
Browser
  → React/nginx
    ├─ /api/auth  → Auth Service ─┬→ MongoDB Atlas
    │                             └→ Redis
    └─ /api/trips → Trip Service ─┬→ MongoDB Atlas
                                  └→ Redis
```

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop
- MongoDB Atlas cluster

## Environment Variables

Create service environment files for local development:

```env
NODE_ENV=development
PORT=5001
AUTH_MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner_auth
REDIS_URL=redis://127.0.0.1:6379
JWT_PRIVATE_KEY_BASE64=base64-encoded-rsa-private-key
JWT_EXPIRES_IN=1d
```

```env
NODE_ENV=development
PORT=5002
TRIP_MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner_trips
REDIS_URL=redis://127.0.0.1:6379
JWT_PUBLIC_KEY_BASE64=base64-encoded-rsa-public-key
```

Create `.env` in the project root for Docker Compose:

```env
AUTH_MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner_auth
TRIP_MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner_trips
JWT_PRIVATE_KEY_BASE64=base64-encoded-rsa-private-key
JWT_PUBLIC_KEY_BASE64=base64-encoded-rsa-public-key
JWT_KEY_ID=local
JWT_EXPIRES_IN=1d
FRONTEND_PORT=3000
```

Do not commit `.env` files or private key files.

Generate local JWT keys with OpenSSL:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
base64 -w 0 jwt-private.pem
base64 -w 0 jwt-public.pem
```

On Windows PowerShell, use:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("jwt-private.pem"))
[Convert]::ToBase64String([IO.File]::ReadAllBytes("jwt-public.pem"))
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start Redis:

```bash
docker compose up -d redis
```

Start the services:

```bash
npm run dev:services
```

Start the frontend in another terminal:

```bash
npm run dev -w frontend
```

Open http://localhost:5173.

## Run with Docker Compose

```bash
docker compose up --build
```

Open http://localhost:3000.

Stop all containers:

```bash
docker compose down
```

## Checks and Tests

```bash
npm run check
npm test
npm run test:coverage
npm run build
```

Coverage is generated at `backend/coverage/lcov.info`.

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/trips` | List trips |
| `POST` | `/api/trips` | Create a trip |
| `PUT` | `/api/trips/:id` | Update a trip |
| `DELETE` | `/api/trips/:id` | Delete a trip |
| `GET` | `/healthz` | Liveness check |
| `GET` | `/readyz` | MongoDB and Redis readiness |
| `GET` | `/metrics` | Prometheus metrics |

Trip endpoints require:

```http
Authorization: Bearer <token>
```

## Common Issues

- **MongoDB connection fails:** check the Atlas URI and IP access list.
- **Redis connection fails:** start Redis and use
  `REDIS_URL=redis://127.0.0.1:6379` locally.
- **Docker pipe not found:** start Docker Desktop and wait for its engine to run.
