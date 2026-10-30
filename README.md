# Urja Meter Operations REST API

> A RESTful API service and reverse-engineered integration layer built on top of the legacy **Urja Meter Operations** portal (`https://urja-ops.flockenergy.tech`).

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture & Data Flow](#-architecture--data-flow)
- [Project Structure](#-project-structure)
- [Prerequisites & Installation](#-prerequisites--installation)
- [Configuration (.env)](#-configuration-env)
- [Running the Services](#-running-the-services)
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
- [Assumptions](#-assumptions)
- [Design Decisions & Trade-offs](#-design-decisions--trade-offs)
- [What I Intentionally Skipped](#️-what-i-intentionally-skipped)
- [How I Built This](#-how-i-built-this)
- [Security Considerations](#-security-considerations)
- [Known Limitations & Future Improvements](#-known-limitations--future-improvements)
- [Supporting Documents](#-supporting-documents)

---

## 🌟 Overview

The **Urja Meter Operations** portal is an internal utility operations dashboard used for monitoring smart electricity meters, distribution network hierarchy, and 30-minute interval consumption telemetry. The portal does not have a documented public API.

This project delivers a REST API that interfaces with the portal to retrieve, normalize, and expose structured JSON data suitable for downstream applications, dashboards, and analytics pipelines.

---

## ✨ Key Features

- **Automated SvelteKit Session Management**: Authenticates using form actions, manages `__Secure-better-auth.session_token` cookies, and refreshes sessions automatically upon expiry.
- **Dynamic HMAC-SHA256 Signing**: Computes message digests using dynamic signing secrets fetched from `/portal/keys` to access protected export data.
- **Data Normalization & Conversion**:
  - Converts string-encoded coordinates into floating-point numbers (`{ latitude, longitude }`).
  - Converts Indian standard date strings (`DD/MM/YYYY HH:mm` in IST, UTC+5:30) into standardized UTC ISO 8601 timestamps (`2026-06-23T18:00:00.000Z`).
  - Standardizes numeric consumption metrics (`activeEnergyKwh`, `apparentEnergyKvah`, `voltageR`).
  - Computes `intervalKwh` incremental usage between consecutive 30-minute interval readings.
- **Composite Meter Profiles**: Aggregates base metadata, GPS coordinates, and latest interval telemetry into a single profile.
- **Automated Testing**: 21 unit tests run with mocked upstream responses, paired with a live read-only integration suite.
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
│  │ Controllers & Services (src/controllers, etc.)   │  │
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
│   │   └── meterController.js   # HTTP controllers for meters, DTs, and export
│   ├── services/
│   │   └── meterService.js      # Aggregation, composite meters & business logic
│   ├── routes/
│   │   ├── index.js             # Route aggregator
│   │   └── meterRoutes.js       # Fastify route registrations
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
├── frontend/                    # React/Vite visual dashboard
│   ├── src/
│   │   └── App.tsx              # Main dashboard UI (Recharts, search, API Explorer)
│   └── vite.config.ts           # Dev server proxy → localhost:3000
├── .env.example                 # Environment variable templates (placeholders only)
├── .gitignore                   # Complete git ignore rules (excludes secrets/node_modules)
├── openapi.json                 # Exported OpenAPI 3.0 specification file
├── package.json                 # Scripts and dependencies
├── PROTOCOL.md                  # Reverse-engineering report
├── REFLECTION.md                # Engineering reflection
├── server.js                    # Root server entry point forwarder
└── README.md                    # Project documentation
```

---

## 💻 Prerequisites & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm** or **pnpm**

### Installation
```bash
git clone https://github.com/Vinyaaggarwal/urja-meter-api.git
cd urja-meter-api
npm install
cp .env.example .env   # then fill in the portal credentials
npm start
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
PORTAL_PASSWORD=<see assignment email>
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

*(Note: Defaults to port 3000, configurable via `PORT` in `.env` if port 3000 is occupied, e.g. `PORT=3001`.)*

### 2. Start the Frontend Visual Dashboard (Optional)
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

The dashboard connects to the Fastify backend at `http://localhost:3000`, displaying live metrics, search tables, Recharts interval waveforms, 7-tier distribution hierarchy, and an interactive API Explorer.

---

## 🧪 Running Tests

The test suite is organized into fast unit tests (using mocked upstream dependencies) and live integration tests:

### 1. Run Automated Unit Tests (Offline / Mocked)
```bash
npm test
```
*Executes all 21 unit tests verifying data normalization, IST timezone conversion, interval delta calculation, gap and rollover detection, 400 validations, 404 missing records, and 502/504 error handling.*

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

- **`GET /health`**

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

- **`GET /api/meters?page=1&q=HPL`**

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

- **`GET /api/meters/:meterId`**

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
      "timestamp": "2026-06-23T18:00:00.000Z",
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
Retrieves chronological 30-minute interval readings with timestamps converted from IST to UTC, cumulative active energy register values (`activeEnergyKwh`), and calculated incremental consumption (`intervalKwh`).

- **`GET /api/meters/:meterId/consumption`**

```bash
curl -X GET http://localhost:3000/api/meters/J100000/consumption
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "timestamp": "2026-06-23T18:00:00.000Z",
      "rawTimestamp": "23/06/2026 23:30",
      "activeEnergyKwh": 48438.74,
      "intervalKwh": null,
      "apparentEnergyKvah": 52313.84,
      "voltageR": 226
    },
    {
      "timestamp": "2026-06-23T18:30:00.000Z",
      "rawTimestamp": "24/06/2026 00:00",
      "activeEnergyKwh": 48439.16,
      "intervalKwh": 0.42,
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

> **Note on Telemetry Register Values**: The upstream portal's `kwh` values represent a cumulative meter register index that increases over time (appears monotonic in the meters I checked, but this was not verified across all 403). The API exposes `activeEnergyKwh` (cumulative register reading) and computes `intervalKwh` (incremental consumption for that 30-minute window, e.g. 0.42 kWh between 23:30 and 00:00 IST). `intervalKwh` is `null` for the first reading (no baseline), when consecutive timestamps are more than 30 minutes apart (gap in telemetry), or when the register decreased (meter replacement or rollover).

---

### 5. Meter Network Hierarchy & Location
Retrieves the full distribution hierarchy (Zone, Circle, Division, Subdivision, Substation, Feeder, DT) and GPS coordinates.

- **`GET /api/meters/:meterId/network`**

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

- **`GET /api/transformers?page=1`**

```bash
curl -X GET "http://localhost:3000/api/transformers?page=1"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "code": "DT-001",
      "name": "Malviya Nagar DT 1",
      "feederCode": "F-001",
      "capacityKva": 100
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 40,
    "totalPages": 2
  }
}
```

---

### 7. Signed Export Proxy
Retrieves bulk meter inventory authenticated via dynamic HMAC-SHA256 headers, normalized to standard property names and formats.

> **Note on export pagination**: the upstream portal ignores the `page` parameter and returns all 403 meters in a single response. The API forwards this as-is with `totalPages: 1`.

- **`GET /api/export?page=1`**

```bash
curl -X GET "http://localhost:3000/api/export?page=1"
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
      "installationType": "Whole Current",
      "build": "legacy",
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
      "geo": {
        "latitude": 26.938961002479868,
        "longitude": 75.83095696146852
      }
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 403,
    "total": 403,
    "totalPages": 1,
    "signatureMethod": "HMAC-SHA256"
  }
}
```

---

## 📖 OpenAPI & Documentation

- **Interactive Swagger UI**: Navigate to `http://localhost:3000/docs` in your browser.
- **Specification File**: An OpenAPI 3.0 specification is available at [openapi.json](./openapi.json) and dynamically at `http://localhost:3000/docs/json`.

---

## 📐 Assumptions

- Portal timestamps (`DD/MM/YYYY HH:mm`) are in Indian Standard Time (IST, UTC+5:30) and are converted to UTC.
- Coordinates are WGS84 latitude/longitude, returned by the portal as strings.
- One shared portal login serves all callers of this API.

---

## 📐 Design Decisions & Trade-offs

1. **Plain HTTP instead of browser automation.** The portal returns JSON once logged in, so native `fetch` is sufficient and avoids headless browser overhead.
2. **Consistent response envelope** `{ data, meta }` ensures callers receive uniform pagination metadata across all list endpoints (`page`, `pageSize`, `total`, `totalPages`).
3. **Canonical `/api/` routing.** All resource endpoints are organized under the `/api/` namespace (`/api/meters`, `/api/transformers`, `/api/export`), with `/health` at root for standard monitoring.
4. **Active energy register vs interval usage.** The portal reports cumulative meter index registers (`kwh`); the API retains this as `activeEnergyKwh` while adding a computed `intervalKwh` delta field.

---

## ⏭️ What I Intentionally Skipped

- Caching: every request goes to the portal, to keep the code simple.
- Authentication on this API: it is intended to run locally for evaluation.
- Date-range filtering and pagination on consumption: returns the portal's chronological interval readings directly.
- A local database or search index: not needed for ~403 meters.

---

## 🤖 How I Built This

I used an AI coding agent to generate the initial project structure and boilerplate. I then tested and inspected the portal's network requests, authenticated endpoints, and HMAC signatures, validated the payload structures against the API responses, resolved date parsing and the cumulative register interpretation of the meter readings, and reviewed and corrected the automated test suite. The protocol analysis in [PROTOCOL.md](./PROTOCOL.md) reflects my findings and verification.

---

## 🛡️ Security Considerations

- **Credential Redaction**: The global error handler in `src/middleware/errorHandler.js` strips emails, passwords, and session cookies from response bodies and logs.
- **Environment Isolation**: No credentials or private tokens are hard-coded in the repository.
- **Read-Only Guarantee**: Only non-destructive HTTP requests are made against the upstream portal (GET only, apart from the initial login POST).

---

## 🔮 Known Limitations & Future Improvements

- **Re-login concurrency**: `portalClient.js` has no mutex on `login()`; if several requests arrive while the session is expired, they will all trigger a parallel re-login. A lock or promise-coalescing pattern would fix this.
- **`intervalKwh` gap and reset handling**: `null` is returned when the register decreases or when consecutive timestamps are more than 30 minutes apart. Readings for meter J100050 arrive at daily midnight only (not every 30 minutes), so most of its `intervalKwh` values will be `null`.
- **No date-range filter on consumption**: `GET /api/meters/:id/consumption` returns every reading the portal holds (up to 337 per meter) with no `?from=`/`?to=` query parameters.
- **Export is not paginated upstream**: the portal ignores the `page` query parameter on `/portal/export` and returns all 403 records in one call. The API reflects this with `totalPages: 1`.

---

## 📚 Supporting Documents

- [PROTOCOL.md](./PROTOCOL.md) — Reverse-engineering report.
- [REFLECTION.md](./REFLECTION.md) — Engineering reflection.
- [openapi.json](./openapi.json) — OpenAPI 3.0 specification.
