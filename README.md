# Urja Meter Operations API Service

A production-ready Fastify REST API service and intelligent proxy for the **Urja Meter Operations** platform (`https://urja-ops.flockenergy.tech`).

---

## ⚡ Highlights

- **Automated SvelteKit Session Management**: Transparently handles login, cookie jar storage, CSRF headers (`Origin`, `Referer`, `x-sveltekit-action`), and auto-reauthentication on session expiry.
- **Dynamic HMAC-SHA256 Signing**: Automatically retrieves the signing secret from `/portal/keys`, generates timestamps, and crafts the required `x-timestamp` and `x-signature` headers to access the protected `/portal/export` endpoint without manual intervention.
- **Composite Meter Profiles**: Aggregates base metadata, GPS geolocation coordinates, and historical telemetry energy readings into a single `/meters/:meterId` endpoint.
- **OpenAPI & Swagger UI Documentation**: Fully documented interactive API explorer available at `/docs`.
- **Dual Routing**: All routes are accessible via root paths (e.g. `/meters`) as well as versioned paths (e.g. `/api/v1/meters`).

---

## 🏗️ Architecture & Security Workflow

```
┌─────────────────────────────────┐
│     Client / Developer / UI     │
└───────────────┬─────────────────┘
                │ HTTP Requests (e.g., GET /export?page=1)
                ▼
┌────────────────────────────────────────────────────────┐
│              Fastify Service (Port 3000)               │
│                                                        │
│  • Swagger UI at /docs                                 │
│  • Route validation & error handling                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                UrjaClient (lib/)                 │  │
│  │  1. Manages Better-Auth session tokens           │  │
│  │  2. Resolves secrets from /portal/keys           │  │
│  │  3. Computes HMAC-SHA256 for export queries:     │  │
│  │     `GET\n/portal/export\npage=1\n${timestamp}`  │  │
│  │  4. Injects x-timestamp and x-signature headers  │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────┘
                            │ Authenticated Proxied Requests
                            ▼
           ┌───────────────────────────────────┐
           │   Urja Meter Operations Portal    │
           │ (https://urja-ops.flockenergy.tech)│
           └───────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Requirements
- Node.js >= 18.0.0 (v20+ recommended)
- npm or pnpm

### 2. Installation
```bash
git clone <repo-url>
cd urja-api
npm install
```

### 3. Configuration
Copy `.env.example` to `.env` and review credentials:
```env
PORT=3000
HOST=0.0.0.0
URJA_BASE_URL=https://urja-ops.flockenergy.tech
URJA_EMAIL=operator@urja.local
URJA_PASSWORD=<password>
```

### 4. Run Tests
Execute the end-to-end integration test suite against the live portal:
```bash
npm test
```

### 5. Start the Server
```bash
npm start
```
The server will start at:
- **API Base**: `http://localhost:3000`
- **Swagger Documentation**: `http://localhost:3000/docs`

---

## 📖 API Reference

### 1. Health Check
- **`GET /health`**
- Returns the service health status, server timestamp, and connected Urja portal URL.

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-28T16:15:00.000Z",
  "portal": "https://urja-ops.flockenergy.tech"
}
```

---

### 2. Distribution Transformers (DTs)
- **`GET /transformers?page=1`** (or `/api/v1/transformers`)
- Returns paginated list of distribution transformers.

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | `integer` | `1` | Page number |

**Example Response:**
```json
{
  "data": [
    {
      "code": "DT-001",
      "name": "Malviya Nagar DT 1",
      "feederCode": "F-001",
      "capacityKva": 250
    }
  ],
  "page": 1,
  "totalPages": 5
}
```

---

### 3. Smart Meters Search & Listing
- **`GET /meters?page=1&q=`** (or `/api/v1/meters`)
- Search and list smart meters with optional filtering by meter ID, serial number, make, or DT code.

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | `string` | `""` | Search query string |
| `page` | `integer` | `1` | Page number |

**Example Response:**
```json
{
  "data": [
    {
      "meterId": "J100000",
      "serialNo": "SE33962",
      "make": "HPL",
      "phaseType": "single",
      "installStatus": "Decommissioned",
      "dtCode": "DT-001"
    }
  ]
}
```

---

### 4. Composite Meter Profile
- **`GET /meters/:meterId`** (or `/api/v1/meters/:meterId`)
- Retrieves a rich, consolidated view of a meter including its metadata, GPS coordinates, and historical energy telemetry readings.

**Example Response:**
```json
{
  "meterId": "J100000",
  "serialNo": "SE33962",
  "make": "HPL",
  "phaseType": "single",
  "installStatus": "Decommissioned",
  "dtCode": "DT-001",
  "geo": {
    "latitude": "26.938961002479868",
    "longitude": "75.83095696146852"
  },
  "energy": [
    {
      "timestamp": "2026-03-01T00:00:00.000Z",
      "kwh": 412.35,
      "kvah": 435.12,
      "voltR": 231.4
    }
  ]
}
```

---

### 5. Dedicated Meter Geolocation
- **`GET /meters/:meterId/geo`** (or `/api/v1/meters/:meterId/geo`)
- Returns the exact GPS coordinates for the specified meter.

**Example Response:**
```json
{
  "data": {
    "latitude": "26.938961002479868",
    "longitude": "75.83095696146852"
  }
}
```

---

### 6. Dedicated Meter Energy Telemetry
- **`GET /meters/:meterId/energy`** (or `/api/v1/meters/:meterId/energy`)
- Returns historical energy consumption time-series (kWh, kVAh, and voltage).

**Example Response:**
```json
{
  "data": [
    {
      "timestamp": "2026-03-01T00:00:00.000Z",
      "kwh": 412.35,
      "kvah": 435.12,
      "voltR": 231.4
    }
  ]
}
```

---

### 7. Signed Data Export (with HMAC-SHA256)
- **`GET /export?page=1`** (or `/api/v1/export`)
- Downloads comprehensive meter export data with full administrative hierarchy (Zone, Circle, Division, Subdivision, Substation, Feeder, DT) and GPS coordinates.
- **Behind the Scenes**: Automatically obtains the signing secret, calculates `HMAC-SHA256(secret, "GET\n/portal/export\npage=1\n<timestamp>")`, and transmits the required `x-timestamp` and `x-signature` headers.

**Example Response:**
```json
{
  "data": [
    {
      "meterId": "J100000",
      "serialNo": "SE33962",
      "make": "HPL",
      "phaseType": "single",
      "installStatus": "Decommissioned",
      "installType": "Whole Current",
      "build": "legacy",
      "dtCode": "DT-001",
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
        "lat": 26.938961002479868,
        "lng": 75.83095696146852
      }
    }
  ]
}
```

---

## 🔒 HMAC Signing Specification

When requesting `/portal/export`, the upstream portal requires cryptographic verification:

1. **Algorithm**: HMAC-SHA256
2. **Key**: Retrieved dynamically from `GET /portal/keys` (`signingSecret`).
3. **Payload Message Format**:
   ```
   GET\n/portal/export\npage={page}\n{unix_epoch_seconds}
   ```
4. **Headers Sent to Upstream**:
   - `x-timestamp`: `{unix_epoch_seconds}`
   - `x-signature`: `{hex_encoded_hmac}`

This service abstracts this entire process so that callers can access `/export` directly like any standard REST endpoint.
