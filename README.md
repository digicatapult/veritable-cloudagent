# openapi-ts-template

## Description

A `Node.js` typescript template with open api implementation

## Configuration

Use a `.env` at root of the repository to set values for the environment variables defined in `.env` file.

| variable        | required |        default         | description                                                                          |
| :-------------- | :------: | :--------------------: | :----------------------------------------------------------------------------------- |
| PORT            |    N     |         `3000`         | The port for the API to listen on                                                    |
| LOG_LEVEL       |    N     |        `debug`         | Logging level. Valid values are [`trace`, `debug`, `info`, `warn`, `error`, `fatal`] |
| ENVIRONMENT_VAR |    N     |       `example`        | An environment specific variable                                                     |
| DB_PORT         |    N     |         `5432`         | The port for the database                                                            |
| DB_HOST         |    N     |      `localhost`       | The database hostname / host                                                         |
| DB_NAME         |    N     | `openapi-ts-template ` | The database name                                                                    |
| DB_USERNAME     |    N     |       `postgres`       | The database username                                                                |
| DB_PASSWORD     |    N     |       `postgres`       | The database password                                                                |

## Getting started

```sh
# start dependencies
docker compose up -d
# install packages
npm i
# run migrations
npm run db:migrate
# start service in dev mode. In order to start in full - npm start"
npm run dev
```

View OpenAPI documentation for all routes with Swagger:

```
localhost:3000/swagger/
```

## Tests

Integration tests are executed by calling:

```sh
npm run test
```

Unit tests are executed by calling:

```sh
npm run test:unit
```
