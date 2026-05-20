# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
# In case there's no lock file, just run npm install
RUN npm install

COPY . .

RUN npm run build

# Stage 2: Serve the compiled frontend via NGINX
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback configuration
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
