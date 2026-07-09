# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps reproducibly from the committed lockfile.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the SPA.
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine AS serve

# SPA fallback + /api and /ws proxy to the gateway.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
