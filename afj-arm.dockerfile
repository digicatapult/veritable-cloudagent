# docker build -t afj-rest .
FROM --platform=linux/amd64 ubuntu:18.04 as base

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update -y && apt-get install -y \
    software-properties-common \
    apt-transport-https \
    curl \
    # Only needed to build indy-sdk
    build-essential 

# libindy
RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys CE7709D068DB5E88
RUN add-apt-repository "deb https://repo.sovrin.org/sdk/deb bionic stable"

# nodejs
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash

# install depdencies
RUN apt-get update -y && apt-get install -y --allow-unauthenticated \
    libindy \
    nodejs

# AFJ specifc setup
WORKDIR /www

COPY bin ./bin
COPY package.json package.json
RUN npm install --global husky@^8.0.3
RUN npm install --omit=dev

COPY build ./build

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]
