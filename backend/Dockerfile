FROM node:18-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production --legacy-peer-deps && npm cache clean --force
COPY backend/ .
COPY game-engine/ ../game-engine/
EXPOSE 3020
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3020/health || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
