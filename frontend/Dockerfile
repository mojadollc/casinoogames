FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install && npm cache clean --force
COPY . .
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
RUN npm run build

FROM node:18-alpine
RUN npm install -g serve
WORKDIR /app
COPY --from=builder /app/build ./build
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD wget -qO- http://localhost:3000 || exit 1
CMD ["serve", "-s", "build", "-l", "3000"]
