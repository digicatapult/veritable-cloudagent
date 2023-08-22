# docker build -t afj-rest .
FROM ubuntu:23.04 as base

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update -y && apt-get install -y \
    software-properties-common \
    apt-transport-https \
    curl \
    build-essential

# nodejs
RUN curl -sL https://deb.nodesource.com/setup_18.x | bash

# install depdencies
RUN apt-get update -y && apt-get install -y --allow-unauthenticated \
	nodejs


# AFJ specifc setup
WORKDIR /www

COPY bin ./bin
COPY package.json package.json
RUN npm install --global husky@^8.0.3
RUN npm install
# RUN npm install --omit=dev

COPY tsoa.json ./tsoa.json
COPY tsconfig.build.json ./tsconfig.build.json
COPY src ./src

# COPY build ./build

RUN npm run build

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]
