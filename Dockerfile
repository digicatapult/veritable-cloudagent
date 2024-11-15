#Build stage
FROM node:lts AS build

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsoa.json tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build


# Test stage
FROM build AS test

WORKDIR /app

ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}

COPY .swcrc .eslint* ./
COPY tests ./tests

CMD ["npm", "run", "test"]


# Production stage
FROM node:lts-bookworm-slim AS production

# # Need curl for healthcheck
RUN apt-get update && apt-get install -y curl

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /www

COPY --from=build /app/package*.json ./
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev

EXPOSE 3000 5002 5003

HEALTHCHECK --interval=5s --timeout=3s \
	CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT [ "node", "./build/index.js" ]
