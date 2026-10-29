# PROTOCOL.md — Urja Meter Operations Portal Protocol & Reverse Engineering Report

This document records the empirical investigation, network findings, authentication mechanisms, data structures, and idiosyncrasies discovered while reverse-engineering the **Urja Meter Operations portal** (`https://urja-ops.flockenergy.tech`).

---

## 1. Portal Architecture Overview

- **Host**: `https://urja-ops.flockenergy.tech`
- **Frontend / Framework**: SvelteKit application with Better-Auth session management.
- **Data Rendering**: Hybrid server-driven with client-side JSON endpoint fetches (`/portal/*`).
- **Nature of APIs**: While the portal lacks public API documentation, it serves structured JSON responses over private HTTP endpoints once authenticated with an active session cookie.

---

## 2. Authentication & Session Protocol

### 2.1 The Login Mechanism
- **Path**: `POST /login`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Request Body**:
  ```http
  email=operator%40urja.local&password=<password>
  ```
- **Required Headers**:
  - `x-sveltekit-action: true` (mandatory for SvelteKit form action processing)
  - `Origin: https://urja-ops.flockenergy.tech`
  - `Referer: https://urja-ops.flockenergy.tech/login`
  - `Accept: application/json`

### 2.2 Response and Cookie Handling
- On successful authentication, the server sets a secure HTTP session cookie:
  ```http
  Set-Cookie: __Secure-better-auth.session_token=<token>; Path=/; HttpOnly; Secure; SameSite=Lax
  ```
- **Status Code**: `303 See Other` (redirecting to `/portal` or `/dashboard`) or `200 OK`.
- **Session Duration**: The session cookie persists across requests. If a request is made with an expired or missing cookie, the portal either returns `401 Unauthorized` or redirects to `/login` with `302 / 303`.
- **API Client Strategy**: Our client maintains an in-memory cookie jar. If an endpoint encounters a `401` or redirect to `/login`, it automatically flushes the jar, executes `login()`, and retries the idempotent request once.

---

## 3. Discovered & Verified Upstream Endpoints

### 3.1 Distribution Transformers: `GET /portal/dts`
- **Query Parameters**:
  - `page`: Integer (1-based index)
- **Response Format**:
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
    "page": 1,
    "pageSize": 20,
    "total": 25
  }
  ```
- **Notes**: Links distribution transformers to their parent feeder codes and nominal kVA capacities.

---

### 3.2 Meter Search & Pagination: `GET /portal/meters/search`
- **Query Parameters**:
  - `q`: String (search query matching meter ID, serial number, make, or DT code)
  - `page`: Integer (1-based index)
- **Response Format**:
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
    ],
    "total": 403,
    "page": 1,
    "pageSize": 20
  }
  ```
- **Observations**:
  - Total population in test dataset: 403 meters across 21 pages.
  - An empty query (`q=`) lists all meters in sequential order.
  - When querying a non-existent meter ID, returns `{"data": [], "total": 0, "page": 1, "pageSize": 20}` with HTTP 200.

---

### 3.3 Meter Geolocation: `GET /portal/meters/:meterId/geo`
- **Path Parameter**:
  - `:meterId`: e.g. `J100000`
- **Response Format**:
  ```json
  {
    "data": {
      "latitude": "26.938961002479868",
      "longitude": "75.83095696146852"
    }
  }
  ```
- **Surprising / Noteworthy Behavior**:
  - `latitude` and `longitude` are returned as high-precision **string literals** rather than JSON numbers.
  - Requesting an unknown meter returns `HTTP 404 Not Found` with `{"message": "Meter not found"}`.

---

### 3.4 Meter Energy Telemetry: `GET /portal/meters/:meterId/energy`
- **Path Parameter**:
  - `:meterId`: e.g. `J100000`
- **Response Format**:
  ```json
  {
    "data": [
      {
        "timestamp": "23/06/2026 23:30",
        "kwh": "48438.74",
        "kvah": "52313.84",
        "voltR": "226"
      },
      {
        "timestamp": "24/06/2026 00:00",
        "kwh": "48439.16",
        "kvah": "52314.29",
        "voltR": "229"
      }
    ]
  }
  ```
- **Observations & Data Peculiarities**:
  - Contains chronological 30-minute interval readings (up to 300+ entries per meter).
  - Timestamps are formatted in Indian standard string format: `DD/MM/YYYY HH:mm` (e.g., `23/06/2026 23:30`).
  - Values for `kwh`, `kvah`, and `voltR` are strings, requiring type casting to numeric floats for downstream calculation.
  - In three-phase meters, single voltage phase reading (`voltR`) is provided as representative phase-R voltage.

---

### 3.5 Dynamic Signing Secret: `GET /portal/keys`
- **Response Format**:
  ```json
  {
    "signingSecret": "I3dZPPf5a...",
    "expiresIn": 3600
  }
  ```
- **Purpose**: Provides the active cryptographic secret required to access the `/portal/export` endpoint.
- **Client Strategy**: Cached in memory for 10 minutes to minimize unnecessary network hops.

---

### 3.6 HMAC-Authenticated Export: `GET /portal/export`
- **Query Parameters**:
  - `page`: Integer (1-based index)
- **Required Security Headers**:
  - `x-timestamp`: Unix timestamp in seconds (integer string).
  - `x-signature`: SHA256 HMAC digest in hexadecimal string.
- **Signature Message Algorithm**:
  ```
  METHOD + "\n" + PATH + "\n" + QUERY_STRING + "\n" + TIMESTAMP
  ```
  Example:
  ```
  GET
  /portal/export
  page=1
  1793206000
  ```
- **Response Payload**: Contains all 403 meter records with complete, un-redacted network hierarchy and coordinates:
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
          "lat": 26.938961,
          "lng": 75.830956
        }
      }
    ]
  }
  ```

---

## 4. Summary of Confirmed vs. Uncertain Observations

| Feature / Observation | Status | Verification Evidence |
|-----------------------|--------|-----------------------|
| SvelteKit Form Login (`/login`) | **CONFIRMED** | Returns `__Secure-better-auth.session_token` cookie; authenticated requests succeed. |
| Cookie Session Handling | **CONFIRMED** | Validated via `undici` / `fetch` cookie jar. |
| Meter Search (`/portal/meters/search`) | **CONFIRMED** | Supports pagination, query text filtering, returns 20 items/page. |
| Geo Endpoint (`/portal/meters/:id/geo`) | **CONFIRMED** | Validated coordinates returned for active meters; 404 for nonexistent. |
| Energy Endpoint (`/portal/meters/:id/energy`) | **CONFIRMED** | 337 interval readings returned with `kwh`, `kvah`, `voltR`. |
| Network Hierarchy | **CONFIRMED** | Discovered in `/portal/export` detailing 7-level hierarchy (Zone down to DT). |
| HMAC Signature Header | **CONFIRMED** | Verified against `/portal/export` using secret from `/portal/keys`. |
| Write / Update Capabilities | **READ-ONLY** | As instructed, only read operations were performed; no mutating actions attempted. |

