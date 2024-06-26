FROM node:21-alpine3.17

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm install
COPY . .

RUN npx nx run insights-app:build

FROM nginx:alpine
COPY --from=build /app/dist/apps/insights-app /usr/share/nginx/html
