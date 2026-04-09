FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/env-config.template.json /usr/share/nginx/html/env-config.template.json
COPY nginx/docker-entrypoint.sh /docker-entrypoint.d/40-generate-env-config.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
