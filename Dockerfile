# Динамика — продовый образ.
# Код в /usr/src/app: Bothost монтирует /app с исходниками, и node_modules
# из образа иначе были бы скрыты. Данные — в /app/data.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/app/data/dinamika.db

WORKDIR /usr/src/app

COPY . .

RUN echo "--- build context ---" && ls -la && node --version && npm --version

RUN npm ci --omit=dev || npm install --omit=dev

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "server/index.js"]
