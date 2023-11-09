#docker build -t afj-rest .

#Build stage
FROM node:lts-bookworm as builder

RUN apt-get update -y
RUN npm install --global husky@^8.0.3

WORKDIR /app

COPY package.json ./package.json
COPY package-lock.json ./package-lock.json
COPY tsoa.json ./tsoa.json
COPY tsconfig.build.json ./tsconfig.build.json
COPY bin ./bin
COPY src ./src

RUN npm ci && npm cache clean --force
RUN npm run --omit=dev build

# Runtime stage
FROM node:lts-bookworm-slim

WORKDIR /www
COPY --from=builder ./app .

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]