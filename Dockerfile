# docker build . -t veritable-cloudagent

# Build stage
FROM node:24-bookworm AS build

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@latest
RUN npm ci

COPY tsoa.json tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build


# Node_Modules stage
FROM node:24-bookworm AS modules

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm install -g npm@latest
RUN npm ci --omit=dev

# Test stage
FROM build AS test

WORKDIR /app

ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}
COPY tests ./tests
COPY scripts ./scripts


# Production stage
FROM node:24-bookworm-slim AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN npm install -g npm@latest
RUN apt-get update && apt-get install -y curl openssl
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
