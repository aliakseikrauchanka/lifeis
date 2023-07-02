FROM node:20-alpine3.17

WORKDIR /app

COPY . .

RUN npm install

# CMD ["npm", "run", "start", "app-1"]