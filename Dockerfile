FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY db ./db
COPY README.md ./README.md

RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=base /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]