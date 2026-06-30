FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package*.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/auth-service/package.json ./backend/auth-service/package.json
COPY backend/trip-service/package.json ./backend/trip-service/package.json
RUN npm ci --omit=dev --workspace @tripplanner/auth-service && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node backend/auth-service/package.json ./backend/auth-service/package.json
COPY --chown=node:node backend/auth-service/src ./backend/auth-service/src

USER node
EXPOSE 5001
CMD ["node", "backend/auth-service/src/server.js"]
