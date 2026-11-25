# ── Stage 1: Build stage ────────────────────────────────────────────────────
FROM node:20.20.2-alpine3.23 AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build args for frontend API configuration (empty default for relative /api reverse proxy)
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Production web server (Nginx) ──────────────────────────────────
FROM nginx:1.27.5-alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Security: apply latest Alpine security patches and configure unprivileged runtime
RUN apk upgrade --no-cache && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --spider -q http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
