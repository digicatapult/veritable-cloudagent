#Build stage
FROM node:lts AS build

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force

COPY tsoa.json tsconfig*.json ./
COPY bin ./bin
COPY schema ./schema
COPY src ./src
RUN npm run build


# Test stage
FROM build AS test

WORKDIR /app

ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}

COPY .mocharc.json .eslint* ./
COPY tests ./tests

CMD ["npm", "run", "test"]


# Production stage
FROM node:lts-slim AS production
# NB Debian bookworm-slim doesn't include OpenSSL

# Need curl for healthcheck
RUN apt-get update && \
	apt-get install -y curl

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /www

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/bin ./bin
COPY --from=build /app/schema ./schema
COPY --from=build /app/build ./build

RUN npm prune

EXPOSE 3000 5002 5003

HEALTHCHECK --interval=5s --timeout=3s \
	CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]
