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
Browser → React/nginx → Express API → MongoDB Atlas
                              └────→ Redis
```

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop
- MongoDB Atlas cluster

## Environment Variables

Create `backend/.env` for local development:

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN=1d
```

Create `.env` in the project root for Docker Compose:

```env
MONGO_URI=mongodb+srv://USER:PASSWORD@HOST/tripplanner
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
JWT_EXPIRES_IN=1d
FRONTEND_PORT=3000
```

Do not commit either `.env` file.

## Run Locally

Install dependencies:

```bash
npm install
```

Start Redis:

```bash
docker compose up -d redis
```

Start the backend:

```bash
npm run dev -w backend
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
