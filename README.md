# Urja Meter Operations REST API

> A production-minded RESTful API service and reverse-engineered integration layer built on top of the legacy **Urja Meter Operations** portal (`https://urja-ops.flockenergy.tech`).

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Data Flow](#-architecture--data-flow)
- [Project Structure](#-project-structure)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Configuration (.env)](#-configuration-env)
- [Running the Service](#-running-the-service)
- [Running Tests](#-running-tests)
- [API Reference & Sample Requests](#-api-reference--sample-requests)
  - [1. Health Check](#1-health-check)
  - [2. Search & List Meters](#2-search--list-meters)
  - [3. Meter Details (Composite)](#3-meter-details-composite)
  - [4. Meter Consumption History](#4-meter-consumption-history)
  - [5. Meter Network Hierarchy & Location](#5-meter-network-hierarchy--location)
  - [6. Distribution Transformers](#6-distribution-transformers)
  - [7. Signed Export Proxy](#7-signed-export-proxy)
- [OpenAPI & Documentation](#-openapi--documentation)
- [Assumptions & Design Decisions](#-assumptions--design-decisions)
- [Security Considerations](#-security-considerations)
- [Known Limitations & Future Improvements](#-known-limitations--future-improvements)
- [Supporting Documents](#-supporting-documents)

---

## 🌟 Overview

The **Urja Meter Operations** portal is an internal utility operations dashboard used for monitoring smart electricity meters, distribution network hierarchy, and 30-minute interval consumption telemetry. The portal does not have a documented public API.

This project delivers a robust, secure, and fully documented REST API that interfaces with the portal to retrieve, normalize, and expose structured JSON data suitable for downstream applications, dashboards, and analytics pipelines.

---

## ✨ Key Features

- **Automated SvelteKit Session Management**: Transparently authenticates using form actions, manages `__Secure-better-auth.session_token` cookies, and refreshes sessions automatically upon expiry.
- **Dynamic HMAC-SHA256 Signing**: Computes message digests using dynamic signing secrets fetched from `/portal/keys` to access protected export data.
- **Data Normalization**:
  - Converts string-encoded coordinates into IEEE 754 floating-point numbers (`{ latitude, longitude }`).
  - Converts Indian date strings (`DD/MM/YYYY HH:mm`) into standardized ISO 8601 UTC timestamps (`2026-06-23T23:30:00.000Z`).
  - Standardizes numeric consumption metrics (`activeEnergyKwh`, `apparentEnergyKvah`, `voltageR`).
- **Composite Meter Profiles**: Aggregates base metadata, GPS coordinates, and latest interval telemetry into a single profile.
- **Deterministic Automated Testing**: 100% offline-capable unit tests with mocked upstream responses, paired with a dedicated live read-only integration suite.
- **Interactive Swagger UI & OpenAPI 3.0**: Embedded interactive documentation at `/docs` and exported standalone [openapi.json](./openapi.json).

---

## 🏗️ Architecture & Data Flow

```
┌───────────────────────────────────────────────┐
│              Client / Caller                  │
└───────────────────────┬───────────────────────┘
                        │ HTTP / JSON
                        ▼
┌────────────────────────────────────────────────────────┐
│                   Fastify Service                      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Routes & Schemas (src/routes, src/schemas)       │  │
│  │ • Validates inputs, params, and response shapes  │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Controllers & Services (src/controllers, src/...)│  │
│  │ • Business logic & data normalization            │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ PortalClient (src/clients/portalClient.js)       │  │
│  │ • In-memory Cookie Jar (better-auth session)     │  │
│  │ • Request timeout control (AbortSignal)          │  │
│  │ • Auto-retry on session expiration (401/303)     │  │
│  │ • Dynamic HMAC-SHA256 signature generator        │  │
│  └──────────────────────────┬───────────────────────┘  │
└─────────────────────────────┼──────────────────────────┘
                              │ Proxied Authenticated HTTPS
                              ▼
             ┌───────────────────────────────────┐
             │   Urja Meter Operations Portal    │
             │ (https://urja-ops.flockenergy.tech)│
             └───────────────────────────────────┘
```

---

## 📁 Project Structure

```text
├── src/
│   ├── app.js                   # Fastify application setup & route registration
│   ├── server.js                # Server entry point listening on PORT & HOST
│   ├── clients/
│   │   └── portalClient.js      # Session management, timeouts, retries, HMAC signing
│   ├── controllers/
│   │   ├── healthController.js
│   │   ├── meterController.js
│   │   ├── transformerController.js
│   │   └── exportController.js
│   ├── services/
│   │   ├── meterService.js      # Aggregation, composite meters & business logic
│   │   ├── transformerService.js
│   │   └── exportService.js
│   ├── routes/
│   │   ├── healthRoutes.js
│   │   ├── meterRoutes.js
│   │   ├── transformerRoutes.js
│   │   ├── exportRoutes.js
│   │   └── index.js
│   ├── schemas/
│   │   └── meterSchemas.js      # OpenAPI JSON schemas & route validation rules
│   ├── middleware/
│   │   └── errorHandler.js      # Sanitized error handler (no secret leakage)
│   └── utils/
│       ├── normalizer.js        # ISO timestamps, float parsing, data cleansing
│       └── hmac.js              # Cryptographic HMAC-SHA256 generator
├── tests/
│   ├── normalizer.test.js       # Data normalization & date parsing tests
│   ├── health.test.js           # Health check endpoint tests
│   ├── meters.test.js           # Meter search, pagination, composite & 404 tests
│   ├── consumption.test.js      # Interval energy consumption tests
│   ├── network.test.js          # Network hierarchy & location tests
│   ├── errors.test.js           # 502/504 timeout & credential sanitization tests
│   └── integration.test.js      # Live portal read-only integration test suite
├── .env.example                 # Environment variable templates (placeholders only)
├── .gitignore                   # Complete git ignore rules (excludes secrets/node_modules)
├── openapi.json                 # Exported OpenAPI 3.0 specification file
├── package.json                 # Scripts and dependencies
├── PROTOCOL.md                  # Comprehensive portal reverse-engineering report
├── REFLECTION.md                # 5-question engineering reflection
├── server.js                    # Root server forwarder
└── README.md                    # Project documentation
```

---

## 💻 Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ / v22+ recommended)
- **npm** or **pnpm**

### Installation
```bash
git clone https://github.com/your-username/urja-ops-api.git
cd urja-ops-api
npm install
```

---

## ⚙️ Configuration (.env)

Create your `.env` file by copying `.env.example`:

```bash
cp .env.example .env
```

Configure your credentials:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Upstream Portal Configuration (Read-Only)
PORTAL_URL=https://urja-ops.flockenergy.tech
PORTAL_USERNAME=operator@urja.local
PORTAL_PASSWORD=<password>
PORTAL_TIMEOUT_MS=10000
```

> **Security Note:** `.env` is ignored by git and will never be committed to public repositories. `.env.example` contains only placeholder values.

---

## 🚀 Running the Services

### 1. Start the Backend API Server
```bash
npm start
```
- **Backend API**: `http://localhost:3000`
- **Interactive Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI Specification**: `http://localhost:3000/docs/json`

### 2. Start the Frontend Visual Dashboard
In a second terminal window:
```bash
npm run frontend:dev
```
Or directly from the `frontend/` directory:
```bash
cd frontend
npm run dev
```
- **Dashboard URL**: `http://localhost:5173`

The dashboard automatically connects to the local Fastify backend, displaying live metrics, search tables, Recharts interval waveforms, 7-tier distribution hierarchy, and an interactive API Explorer.

---

## 🧪 Running Tests

The test suite is organized into fast, deterministic unit tests (using mocked upstream dependencies) and live integration tests:

### 1. Run Automated Unit Tests (Offline / Mocked)
```bash
npm test
```
*Executes all 17 unit tests verifying data normalization, 400 validations, 404 missing records, and 502/504 error handling in < 2 seconds.*

### 2. Run Live Portal Integration Tests
```bash
npm run test:integration
```
*Executes read-only integration tests against `https://urja-ops.flockenergy.tech` to verify real cookie acquisition, meter search, telemetry readings, and HMAC signatures.*

### 3. Run All Tests
```bash
npm run test:all
```

---

## 📡 API Reference & Sample Requests

### 1. Health Check
Checks service availability and upstream portal target.

- **`GET /health`** (or `/api/health`)

```bash
curl -X GET http://localhost:3000/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-28T16:30:00.000Z",
  "portal": "https://urja-ops.flockenergy.tech"
}
```

---

### 2. Search & List Meters
Search and paginate smart meters with query filtering.

- **`GET /api/meters?page=1&q=HPL`** (or `/meters`)

```bash
curl -X GET "http://localhost:3000/api/meters?page=1&q=HPL"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "meterId": "J100000",
      "serialNumber": "SE33962",
      "manufacturer": "HPL",
      "phaseType": "single",
      "installationStatus": "Decommissioned",
      "distributionTransformerCode": "DT-001"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 403,
    "totalPages": 21
  }
}
```

---

### 3. Meter Details (Composite)
Retrieves meter identity, parsed coordinates, and latest interval reading.

- **`GET /api/meters/:meterId`** (or `/meters/:meterId`)

```bash
curl -X GET http://localhost:3000/api/meters/J100000
```

**Response (200 OK):**
```json
{
  "data": {
    "meterId": "J100000",
    "serialNumber": "SE33962",
    "manufacturer": "HPL",
    "phaseType": "single",
    "installationStatus": "Decommissioned",
    "distributionTransformerCode": "DT-001",
    "geo": {
      "latitude": 26.938961002479868,
      "longitude": 75.83095696146852
    },
    "latestReading": {
      "timestamp": "2026-06-23T23:30:00.000Z",
      "rawTimestamp": "23/06/2026 23:30",
      "activeEnergyKwh": 48438.74,
      "apparentEnergyKvah": 52313.84,
      "voltageR": 226
    }
  }
}
```

---

### 4. Meter Consumption History
Retrieves chronological 30-minute interval readings normalized into ISO 8601 timestamps and numeric values.

- **`GET /api/meters/:meterId/consumption`** (or `/meters/:meterId/energy`)

```bash
curl -X GET http://localhost:3000/api/meters/J100000/consumption
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "timestamp": "2026-06-23T23:30:00.000Z",
      "rawTimestamp": "23/06/2026 23:30",
      "activeEnergyKwh": 48438.74,
      "apparentEnergyKvah": 52313.84,
      "voltageR": 226
    },
    {
      "timestamp": "2026-06-24T00:00:00.000Z",
      "rawTimestamp": "24/06/2026 00:00",
      "activeEnergyKwh": 48439.16,
      "apparentEnergyKvah": 52314.29,
      "voltageR": 229
    }
  ],
  "meta": {
    "meterId": "J100000",
    "count": 337,
    "unit": "kWh"
  }
}
```

---

### 5. Meter Network Hierarchy & Location
Retrieves the full distribution hierarchy (Zone, Circle, Division, Feeder, DT) and GPS coordinates.

- **`GET /api/meters/:meterId/network`** (or `/meters/:meterId/network`)

```bash
curl -X GET http://localhost:3000/api/meters/J100000/network
```

**Response (200 OK):**
```json
{
  "data": {
    "meterId": "J100000",
    "distributionTransformerCode": "DT-001",
    "hierarchy": {
      "zone": { "name": "Jaipur Zone 1", "code": "Z-01" },
      "circle": { "name": "Circle 1", "code": "C-01" },
      "division": { "name": "Division 1", "code": "D-01" },
      "subdivision": { "name": "Subdivision 1", "code": "SD-01" },
      "substation": { "name": "Substation 1", "code": "SS-01" },
      "feeder": { "name": "Feeder 1", "code": "F-001" },
      "dt": { "name": "Malviya Nagar DT 1", "code": "DT-001" }
    },
    "coordinates": {
      "latitude": 26.938961002479868,
      "longitude": 75.83095696146852
    }
  }
}
```

---

### 6. Distribution Transformers
List all Distribution Transformers (DTs) with feeder mappings and nominal capacities.

- **`GET /api/transformers?page=1`** (or `/transformers`)

```bash
curl -X GET "http://localhost:3000/api/transformers?page=1"
```

---

### 7. Signed Export Proxy
Retrieves bulk meter inventory authenticated via dynamic HMAC-SHA256 headers.

- **`GET /api/export?page=1`** (or `/export`)

```bash
curl -X GET "http://localhost:3000/api/export?page=1"
```

---

## 📖 OpenAPI & Documentation

- **Interactive Swagger UI**: Navigate to `http://localhost:3000/docs` in your browser.
- **Specification File**: A full, valid OpenAPI 3.0 specification is available at [openapi.json](./openapi.json) and dynamically at `http://localhost:3000/docs/json`.

---

## 📐 Assumptions & Design Decisions

1. **Direct HTTP Integration vs Playwright**:
   - Because the portal's SvelteKit endpoints return clean JSON once authenticated, we used native HTTP requests (`fetch`) rather than heavy browser automation (Playwright/Puppeteer). This keeps memory usage low, eliminates headless browser dependencies, and yields sub-100ms response times.
2. **Dual Route Compatibility**:
   - Both `/api/meters` and root `/meters` routes are exposed simultaneously to satisfy strict REST conventions while preserving backward compatibility.
3. **Structured Response Envelopes**:
   - Endpoints follow the standard `{ "data": [...], "meta": {...} }` pattern, avoiding redundant nested layers while giving callers exact pagination and record count context.

---

## 🛡️ Security Considerations

- **Credential Redaction**: The global error handler in `src/middleware/errorHandler.js` strips emails, passwords, and session cookies from response bodies and logs.
- **Environment Isolation**: No credentials or private tokens are hard-coded in the repository.
- **Read-Only Guarantee**: Only non-destructive HTTP `GET` queries are executed against the upstream portal.

---

## 🔮 Known Limitations & Future Improvements

- **Upstream Caching**: Adding an in-memory LRU or Redis cache for static transformers and network hierarchy would reduce portal load.
- **Concurrent Ingestion**: An offline synchronization worker could pull all 403 meters into a local SQLite/PostgreSQL store for instant analytical aggregation.

---

## 📚 Supporting Documents

- [PROTOCOL.md](./PROTOCOL.md) — Comprehensive technical reverse-engineering report.
- [REFLECTION.md](./REFLECTION.md) — 5-question engineering reflection.
- [openapi.json](./openapi.json) — OpenAPI 3.0 specification.
