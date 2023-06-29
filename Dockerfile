# syntax=docker/dockerfile:1.4
FROM node:lts-alpine as builder

WORKDIR /veritable-cloudagent

# Install base dependencies
RUN npm install -g npm@latest

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci
COPY . .
RUN npm run build

# service 
FROM node:lts-alpine as service

WORKDIR /veritable-cloudagent

RUN npm -g install npm@9.x.x

COPY package*.json ./
RUN npm ci --production
COPY --from=builder /veritable-cloudagent/build .

EXPOSE 80
CMD [ "node", "./index.js" ]