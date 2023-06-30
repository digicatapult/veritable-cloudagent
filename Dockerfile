FROM ubuntu:18.04 as base

ENV DEBIAN_FRONTEND noninteractive

# due to bad request, apt kicks offs and terminates build. [More](https://askubuntu.com/questions/786334/proxy-problems-after-upgrade-to-ubuntu-16-04-apt-1-2)
# on 18.04 it does not say proxy stuff, just trips, maybe shared cache did not have time to fully investigate this anomaly
RUN echo "Acquire::http::No-Cache true;" >> /etc/apt/apt.conf
RUN echo "Acquire::http::Pipeline-Depth 0;" >> /etc/apt/apt.conf

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
COPY package-lock.json package-lock.json
RUN npm ci 

COPY build ./build

ENTRYPOINT [ "./bin/afj-rest.js", "start" ]
