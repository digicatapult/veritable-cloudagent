# docker build . -t veritable-cloudagent

# Build stage
FROM node:26.13.0-bookworm@sha256:a546d3f8acd2af4382668a7e6acd3bc4418e6a27478373e3246f8162f5181509 AS build

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
FROM node:26.13.0-bookworm@sha256:a546d3f8acd2af4382668a7e6acd3bc4418e6a27478373e3246f8162f5181509 AS modules

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
FROM node:26.13.0-bookworm-slim@sha256:add5c17c14752c54d2f3d519ec46a3815684d41c33f198bcb09fb998f7dcbf68 AS production

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
