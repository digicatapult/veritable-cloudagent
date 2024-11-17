# docker build -t agent -f ./Dockerfile .

# RHEL Minimal
FROM redhat/ubi9-minimal:9.5 AS rhel

ENV NODEJS_VERSION=20

RUN echo -e "[nodejs]\nname=nodejs\nstream=${NODEJS_VERSION}\nprofiles=\nstate=enabled\n" > /etc/dnf/modules.d/nodejs.module
RUN microdnf install -y nodejs && microdnf remove -y nodejs-full-i18n npm nodejs-docs && microdnf clean -y all
RUN microdnf install -y npm && microdnf remove -y nodejs-docs && microdnf clean -y all


# Build stage
FROM node:lts-bookworm AS build

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsoa.json tsconfig.json .swcrc ./
COPY src ./src
RUN npm run build


# Node_Modules stage
FROM node:lts-bookworm AS modules

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev


# Test stage
FROM build AS test

WORKDIR /app

ARG NODE_ENV=test
ENV NODE_ENV=${NODE_ENV}

COPY .swcrc .eslint* ./
COPY tests ./tests

CMD ["npm", "run", "test"]


# Production stage
FROM rhel AS production

RUN microdnf install -y openssl && microdnf clean -y all
RUN npm install -g npm@10.x.x && npm cache clean --force

WORKDIR /www

COPY --from=build /app/package*.json ./
COPY --from=build /app/build ./build
COPY --from=modules /app/node_modules ./node_modules

EXPOSE 3000 5002 5003

HEALTHCHECK --interval=5s --timeout=3s \
	CMD curl -f http://localhost:3000/ || exit 1

ENTRYPOINT [ "node", "./build/index.js" ]
