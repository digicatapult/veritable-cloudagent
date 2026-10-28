# docker build . -t veritable-cloudagent

# Build stage
FROM node:24.22.1-bookworm@sha256:e2007d1f4e652444f88d9bb196256d2d035269015e3d27a0d47c1d0cb5192a98 AS build

RUN npm install -g npm@12.0.1

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsoa.json tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build


# Node_Modules stage
FROM node:24.22.1-bookworm@sha256:e2007d1f4e652444f88d9bb196256d2d035269015e3d27a0d47c1d0cb5192a98 AS modules

RUN npm install -g npm@12.0.1

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Test stage
FROM build AS test

WORKDIR /app

ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}
COPY tests ./tests
COPY scripts ./scripts


# Production stage
FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS production

RUN npm install -g npm@12.0.1

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN apt-get update && apt-get upgrade -y && apt-get install -y curl openssl
RUN apt-get clean
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /www

COPY knexfile.js ./
COPY --from=build /app/package*.json ./
COPY --from=build /app/build ./build
COPY --from=modules /app/node_modules ./node_modules

EXPOSE 3000 5002 5003

HEALTHCHECK --interval=5s --timeout=3s \
	CMD curl -f http://localhost:3000/health || exit 1

CMD [ "node", "./build/index.js" ]
