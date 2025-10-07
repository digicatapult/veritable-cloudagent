# Copilot Coding Agent Onboarding: veritable-cloudagent

## Repository Summary
- **Purpose:** **Credo TS (formerly Aries Framework JavaScript)** based REST API for Self-Sovereign Identity (SSI). Provides credential issuance, proof verification, DIDComm messaging, and supply chain trust network onboarding. Built on Hyperledger Aries protocols with AnonCreds support.
- **Core Technology:** **Credo TS v0.5.17** - TypeScript framework for SSI agents, DIDComm protocols, credential exchange, and proof verification. Uses Aries Askar for secure storage and Hyperledger AnonCreds for privacy-preserving credentials.
- **Architecture:** REST API wrapper around Credo TS Agent, with OpenAPI/TSOA for spec generation, IPFS integration for schema storage, and WebSocket/webhook event streaming.
- **Type:** Node.js service, TypeScript, Dockerized, with REST API endpoints.
- **Size:** Medium-large, ~20 top-level folders, extensive source, test, and infra files.
- **Languages/Frameworks:** TypeScript, Node.js (>=20), **Credo TS** (https://credo.js.org/guides/getting-started), TSOA, Express, Aries Askar, Hyperledger AnonCreds, Docker, Mocha, ESLint, Prettier.

## Build, Test, and Validation Instructions
- **Always run `npm install` before building.** If `npm i` fails due to `node-gyp`:
  - **On macOS:** Ensure XCode is installed via App Store and accept license via `sudo xcodebuild -license accept`, then delete `node_modules` (`rm -rf node_modules`)
  - **On Linux (arm64/x64):** Install build essentials: `sudo apt-get install build-essential` (Ubuntu/Debian) or equivalent for your distro
  - **On any OS:** Delete `node_modules` and retry: `rm -rf node_modules && npm install`
- **Build:**
  - Clean: `npm run clean`
  - Build: `npm run build` (runs clean + tsoa:build + swc compilation)
  - TSOA only: `npm run tsoa:build` (generates routes + swagger spec)
- **Dev Server:**
  - `npm run dev` (generates OpenAPI spec/routes, compiles, starts REST server)
- **Lint/Format/Types:**
  - Lint: `npm run lint` (also `npm run lint:fix` to auto-fix)
  - Type-check: `npm run check` (builds TSOA spec + TypeScript check)
  - Depcheck: `npm run depcheck` (dependency analysis)
- **Unit Tests:** `npm run test:unit` (Mocha, tests/unit)
- **Integration Tests:**
  - **Requires certificates first:** `mkcert -install && export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem" && mkcert alice localhost && mkcert bob localhost && mkcert charlie localhost`
  - **If testnet running:** `docker build --target test -t veritable-cloudagent-integration-tests . && docker run -it --network=testnet -e ALICE_BASE_URL=http://alice:3000 -e BOB_BASE_URL=http://bob:3000 -e CHARLIE_BASE_URL=http://charlie:3000 veritable-cloudagent-integration-tests`
  - **Full stack with tests:** `docker-compose -f docker-compose-testnet.yml -f docker-compose-integration-tests.yml up --build --exit-code-from integration-tests`
  - **Individual test run:** `npm run test:integration` (after testnet setup)
- **Demo:**
  - Start demo: `docker-compose -f docker-compose-testnet.yml up --build -d`
  - API docs: `http://localhost:3000/api-docs` (Alice), `:3001` (Bob), `:3002` (Charlie)
- **DID:web Server & SSL Certificates:**
  - **Critical for DID Resolution:** `did:web` method requires HTTPS resolution per W3C spec. Agent runs optional did:web server on port 8443.
  - **Development Setup:** Requires mkcert for local HTTPS: `mkcert -install && mkcert alice localhost && export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`
  - **Certificate Files:** Creates `alice+1.pem`/`alice+1-key.pem`, mounted as `alice.pem`/`alice-key.pem` in containers
  - **Auto-generation:** When enabled (`DID_WEB_ENABLED=true`), auto-creates DID document, registers with agent, serves at `https://domain:8443/did.json`
  - **Production:** Uses HTTP only (`DID_WEB_USE_DEV_CERT=false`), HTTPS handled by ingress/load balancer
  - **Integration Tests:** Require certificates for all personas (alice, bob, charlie) to test DID:web resolution
- **Environment Variables:**
  - **Defined in `src/env.ts` with envalid validation.** Most have defaults. For arrays, use comma-separated strings in Docker Compose.
  - **Credo TS Agent Config:** LABEL, WALLET_ID, WALLET_KEY (secure storage), ENDPOINT (agent URLs), STORAGE_TYPE (postgres/sqlite)
  - **DIDComm Transport:** INBOUND_TRANSPORT (JSON), OUTBOUND_TRANSPORT, AUTO_ACCEPT_* settings
  - **DID:web Server:** DID_WEB_ENABLED, DID_WEB_PORT (8443), DID_WEB_DOMAIN (e.g., "localhost%3A8443"), DID_WEB_SERVICE_ENDPOINT
  - **DID:web Certificates:** DID_WEB_USE_DEV_CERT, DID_WEB_DEV_CERT_PATH, DID_WEB_DEV_KEY_PATH (for development HTTPS)
  - **Other DID Methods:** USE_DID_KEY_IN_PROTOCOLS, USE_DID_SOV_PREFIX_WHERE_ALLOWED
  - **Integrations:** WEBHOOK_URL, IPFS_ORIGIN (schema storage), VERIFIED_DRPC_OPTIONS_* (proof verification)
  - **Database:** POSTGRES_HOST/PORT/USERNAME/PASSWORD (when STORAGE_TYPE=postgres)

## Project Layout & Key Files
- **Root Files:**
  - `README.md`, `Dockerfile`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `tsoa.json`, `knexfile.js`, `docker-compose*.yml`
- **Source:** `src/` (main code: index.ts, server.ts, agent.ts, env.ts, controllers/, routes/, modules/verified-drpc/, anoncreds/, ipfs/, didweb/, utils/)
  - **Credo TS Integration:** `agent.ts` (Credo TS agent setup), `modules/` (custom Credo modules), `anoncreds/` (credential registry)
  - **DID:web Server:** `didweb/server.ts` (HTTPS server), `didweb/db.ts` (DID document storage), `utils/didWebGenerator.ts` (auto-generation)
  - **REST Controllers:** `controllers/v1/` (connections, credentials, proofs, schemas, DIDs, DRPC)
  - **WebSocket/Events:** `events/` (Credo TS event handlers), `server.ts` (WebSocket setup)
- **Build Output:** `build/` (compiled JS + auto-generated TSOA routes/swagger from controllers)
- **Tests:** `tests/unit/`, `tests/integration/`, `tests/test.env`
- **Samples:** `samples/` (sample agent configs, usage)
- **Schema:** `scripts/schemas/makeAuthorisation.json` (example credential schema)
- **Scripts:** `scripts/` (check-version.sh for CI version checks)
- **Docker Compose:**
  - `docker-compose.yml` (single agent)
  - `docker-compose-agent-ipfs.yml` (agent + IPFS + OPA)
  - `docker-compose-testnet.yml` (3 agents + 3 IPFS nodes)
  - `docker-compose-integration-tests.yml` (integration test orchestration)
- **CI/CD:**
  - GitHub Actions: `.github/workflows/test.yml`, `.github/workflows/release.yml` (run lint, type-check, tests, build Docker images, check version, publish)
  - Always run lint, type-check, and tests before PR/commit.

## Validation & Troubleshooting

### **Common Issues by OS/Architecture**

#### **macOS (Intel/Apple Silicon)**
- **`npm i` fails with node-gyp errors:**
  - Install XCode: App Store → XCode → Install
  - Accept license: `sudo xcodebuild -license accept`
  - Install Command Line Tools: `xcode-select --install`
  - Clear and retry: `rm -rf node_modules package-lock.json && npm install`
- **Certificate issues for did:web:**
  - Install mkcert: `brew install mkcert` 
  - Setup: `mkcert -install && mkcert alice localhost bob localhost charlie localhost`
  - Export CA: `export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`
- **Docker permission issues:** Add user to docker group or use Docker Desktop
- **Port conflicts:** Check for services on 3000-3002, 5002-5003, 8080, 8443: `lsof -i :PORT`

#### **Linux (Ubuntu/Debian)**
- **`npm i` fails with node-gyp errors:**
  - Install build tools: `sudo apt-get update && sudo apt-get install build-essential python3-dev`
  - For ARM64: `sudo apt-get install gcc-aarch64-linux-gnu`
  - Clear and retry: `rm -rf node_modules package-lock.json && npm install`
- **Certificate issues for did:web:**
  - Install mkcert: `curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64" && chmod +x mkcert-* && sudo mv mkcert-* /usr/local/bin/mkcert`
  - Setup: `mkcert -install && mkcert alice localhost bob localhost charlie localhost`
  - Export CA: `export NODE_EXTRA_CA_CERTS="$(mkcert -CAROOT)/rootCA.pem"`
- **Docker permission issues:** `sudo usermod -aG docker $USER && newgrp docker`
- **Port conflicts:** Check ports: `sudo netstat -tulpn | grep :PORT`

#### **Linux (RHEL/CentOS/Fedora)**
- **`npm i` fails with node-gyp errors:**
  - Install build tools: `sudo dnf groupinstall "Development Tools" && sudo dnf install python3-devel`
  - For ARM64: `sudo dnf install gcc-aarch64-linux-gnu`
  - Clear and retry: `rm -rf node_modules package-lock.json && npm install`
- **Certificate setup:** Similar to Ubuntu, or use package manager if available

#### **Windows (WSL2 Recommended)**
- **Use WSL2 + Ubuntu** for best compatibility, then follow Linux Ubuntu instructions
- **Native Windows:** Install Visual Studio Build Tools, use PowerShell as Administrator
- **Docker:** Use Docker Desktop with WSL2 backend

### **Environment-Specific Issues**
- **Integration tests failing:**
  - Testnet not running: `docker-compose -f docker-compose-testnet.yml up -d`
  - Wrong network: Ensure containers on `testnet` network
  - Certificate issues: Regenerate with `mkcert alice localhost bob localhost charlie localhost`
  - Port conflicts: Check Alice (3000), Bob (3001), Charlie (3002), IPFS (8080)
- **IPFS connection errors:**
  - Check IPFS_ORIGIN env points to correct container/host
  - Verify IPFS container healthy: `docker-compose logs ipfs0`
- **Database connection issues:**
  - PostgreSQL not ready: Wait for container health check
  - Wrong credentials: Check POSTGRES_* environment variables
  - Migration failures: Run `npm run db:migrate` manually

### **Explicit Validation Steps**
- **Pre-commit checks:**
  1. `npm run lint` (fix with `npm run lint:fix`)
  2. `npm run check` (TypeScript + TSOA spec generation)
  3. `npm run depcheck` (dependency analysis)
  4. `npm run test:unit`
  5. Integration tests (if testnet available): `npm run test:integration`
- **CI/CD Validation:**
  - All lint, type-check, format, unit/integration tests, Docker build, version check must pass
  - Integration tests require certificate setup in CI environment

## Credo TS Development Guidance
- **Trust these instructions** for build, test, and validation. Only search if information is missing or errors occur.
- **Credo TS Patterns:** Follow established patterns in `src/agent.ts` for module configuration, `controllers/` for REST endpoints, `events/` for agent event handling.
- **For new features:** Update/add tests in `tests/unit/` (controller logic) or `tests/integration/` (full DIDComm flows). Test against multi-agent testnet.
- **Environment/config changes:** Update `src/env.ts` (envalid validation) and document in README.md if needed.
- **API changes:** Controllers auto-generate OpenAPI spec via TSOA annotations. Validate with Swagger UI at `/api-docs`.
- **Credo TS upgrades:** Check `patches/` for any needed compatibility patches, update dependency overrides in package.json.

## Copilot PR Review Instructions
You are reviewing as a **critical software engineering peer**. Read the PR description, the diff, and repository docs/configs. Think step‑by‑step, cite file paths/lines, and propose concrete fixes or commits. Assume a human will validate before merge.

### Repository guard‑rails & constraints
- **Language/stack standards:** TypeScript, Node.js (>=20), **Credo TS v0.5.17**, TSOA, Aries Askar, Hyperledger AnonCreds. See `/README.md`, `/package.json`.
- **Credo TS Framework:** Follow established patterns for agent modules, protocol handlers, event listeners. Validate against Credo TS breaking changes.
- **Style/lint rules:** enforced by CI (`npm run lint`, ESLint, Prettier, TypeScript `npm run check`). Treat violations as issues.
- **SSI Security baseline:** Wallet key management, DIDComm message validation, credential verification flows, proof timeouts. Standard OWASP + SSI-specific threats.
- **Testing thresholds:** **unit/integration tests required** for DIDComm flows; regression below current coverage is a **Must‑Fix**. Multi-agent testnet integration required.
- **Performance budgets:** DIDComm message processing, credential issuance/verification latency must not worsen by >10% without justification.
- **Backwards compatibility:** OpenAPI endpoints, Credo TS agent storage schema, credential/proof formats required unless explicitly stated.

### What to inspect (exhaustive checklist)
1. **Correctness & API contracts** — DIDComm protocol compliance, credential/proof format validation, edge cases, error handling, idempotency. Check OpenAPI spec auto-generation (`/build/routes/swagger.json` from TSOA controllers).
2. **Credo TS Integration** — Agent module configuration (`src/agent.ts`), event handler patterns (`events/`), protocol version compatibility, storage schema changes.
3. **SSI Security** — Wallet key management, DIDComm message validation, credential verification flows, proof request/response security, **DID:web resolution safety** (HTTPS enforcement, certificate validation). Validate env usage (`src/env.ts` with envalid).
4. **Data & schema** — Aries Askar storage migrations, credential schema compatibility (`scripts/schemas/`), IPFS schema storage, wallet data integrity.
5. **DIDComm Reliability** — Message timeouts (VERIFIED_DRPC_OPTIONS_*), connection state management, proof request lifecycles, WebSocket stability.
6. **Performance** — Credential issuance/verification latency, IPFS interaction overhead, wallet operations, agent startup time.
7. **Testing** — Unit tests for controllers/modules, **integration tests for complete DIDComm flows** (3-agent testnet), credential exchange scenarios, proof verification paths. See `tests/unit/`, `tests/integration/`.
8. **Observability** — Credo TS agent logs, DIDComm message tracing, credential state logging (no PII), meaningful SSI error messages. See Pino usage.
9. **Dependencies** — Credo TS version compatibility, AnonCreds/Askar updates, patches in `patches/`, dependency overrides for compatibility.
10. **Infrastructure** — Docker multi-agent setup, testnet orchestration, certificate management for did:web, IPFS integration.

### Scoring rubric (weightings)
- Correctness 30%
- Security 20%
- Testing 15%
- Maintainability 15%
- Performance 10%
- Integration/Infra 10%

Provide a **score out of 10** and a short reason per category. Flag any **Must‑Fix** items (blockers) vs **Should‑Fix** (non‑blocking) vs **Nice‑to‑Have**.

### Required output format
1. **Executive summary (≤10 lines):** what changed, key risks, merge recommendation.
2. **Blockers (Must‑Fix):** bullet list with file:line and rationale.
3. **Targeted suggestions:** concrete patches or pseudo‑diffs.
4. **Test gap analysis:** missing cases and suggested test names.
5. **Integration risks:** API/DB/infra implications, rollout/rollback notes.
6. **Scores:** rubric table with /10 per category + overall.
7. **Release notes draft:** 3–6 bullets for CHANGELOG.

### Additional context you can use
- Repo docs: `/docs`, `/README_VERITABLE.md`, `/README.md`, `/ARCHITECTURE.md`
- CI logs and coverage report artefacts
- Service contracts: OpenAPI spec (`/build/swagger.json`, `/tsoa.json`), Helm values, K8s manifests

**Be strict** if coverage drops, performance budgets are breached, security posture weakens, or backwards compatibility breaks without justification. Always suggest the minimal change that resolves the issue.

---
For further details, see `README.md` for complete setup and development instructions. Use the provided Docker Compose files for multi-agent orchestration and DIDComm testing. All major Credo TS agent commands and validation steps are documented above for efficient SSI development onboarding.
