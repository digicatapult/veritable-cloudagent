#docker build -t afj-rest .

# Build stage
FROM node:lts-alpine as builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 py3-pip make g++
RUN npm install --global husky@^8.0.3
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build
RUN npm prune --production

# Runtime stage
FROM node:lts-alpine

WORKDIR /www
COPY --from=builder ./app .

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]