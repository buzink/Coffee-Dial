# Cloud Run image for the Coffee Dial MCP server. Cloud Run sets PORT (8080).
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

USER node
EXPOSE 8080
CMD ["node", "src/server.js"]
