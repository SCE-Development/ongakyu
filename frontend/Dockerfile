FROM node:20-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

COPY frontend/package.json ./frontend/
run npm install
copy frontend ./frontend

run npm --workspace frontend run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
