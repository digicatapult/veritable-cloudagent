#docker build -t afj-rest .

#Build stage
FROM node:lts as builder

RUN apt-get update -y

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
FROM node:lts-slim
# NB Debian bookworm-slim doesn't include OpenSSL

WORKDIR /www
COPY --from=builder ./app .

EXPOSE 3000 5002 5003

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]