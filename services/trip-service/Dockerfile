FROM node:22-alpine AS dependencies
WORKDIR /app

COPY package*.json ./
COPY frontend/package.json ./frontend/package.json
COPY services/auth-service/package.json ./services/auth-service/package.json
COPY services/trip-service/package.json ./services/trip-service/package.json
RUN npm ci --omit=dev --workspace @tripplanner/trip-service && npm cache clean --force

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node services/trip-service/package.json ./services/trip-service/package.json
COPY --chown=node:node services/trip-service/src ./services/trip-service/src

USER node
EXPOSE 5002
CMD ["node", "services/trip-service/src/server.js"]
