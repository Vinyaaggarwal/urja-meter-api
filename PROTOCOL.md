# PROTOCOL.md — Urja Meter Operations Portal Protocol & Reverse Engineering Report

This document records the empirical investigation, network findings, authentication mechanisms, data structures, and edge cases discovered while reverse-engineering the **Urja Meter Operations portal** (`https://urja-ops.flockenergy.tech`).

---

## 1. Portal Investigation: What I Investigated and Discovered

To build an API over the legacy Urja Meter Operations portal (`https://urja-ops.flockenergy.tech`), I conducted an empirical reverse-engineering investigation across its frontend code, network requests, session lifecycle, and cryptographic safeguards.

### Summary of Key Discoveries:
1. **How Authentication Works**:
   - The portal runs SvelteKit with `better-auth`.
   - Login uses `POST /login` with `x-sveltekit-action: true` and credentials submitted as `application/x-www-form-urlencoded`.
   - On success, the portal responds with HTTP 200, a redirect body `{"type":"redirect","status":303,"location":"/meters"}`, and sets a session cookie `__Secure-better-auth.session_token` with `Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax`.
   - API endpoints (`/portal/*`) accessed without a valid cookie return HTTP 401 `{"error":"unauthorized","message":"A valid session is required."}`.

2. **Which Upstream Endpoints Were Inspected**:
   - `POST /login` — SvelteKit form action for session creation.
   - `GET /portal/meters/search?q=&page=1` — Meter directory listing with substring search.
   - `GET /portal/meters/:id/geo` — Meter geolocation coordinates.
   - `GET /portal/meters/:id/energy` — 30-minute interval telemetry records.
   - `GET /portal/dts?page=1` — Distribution transformer inventory.
   - `GET /portal/keys` — Dynamic HMAC signing key provider.
   - `GET /portal/export?page=1` — HMAC-signed full meter inventory export.

3. **What Response Formats Were Observed**:
   - Pure JSON payloads across all `/portal/*` endpoints.
   - **Coordinate string encoding**: `/portal/meters/:id/geo` returns coordinates as high-precision string literals (`"26.938961002479868"`), whereas `/portal/export` returns 6-decimal numbers (`26.938961`).
   - **Date formats**: Telemetry timestamps use Indian format `DD/MM/YYYY HH:mm` without timezone designations.
   - **Energy fields**: `kwh`, `kvah`, and `voltR` are returned as strings, requiring numeric parsing.
   - **Register behavior**: Telemetry `kwh` values represent a cumulative meter register index rather than discrete interval usage.

4. **How Pagination Behaves**:
   - `/portal/meters/search`: Fully paginated (20 items/page, 403 total meters across 21 pages).
   - `/portal/dts`: Paginated (20 items/page, 40 total transformers across 2 pages).
   - `/portal/export`: **Ignores pagination entirely**. Querying `page=1`, `page=2`, or `page=999` returns the identical complete payload of 403 meters (`total: 403`).
   - `/portal/meters/:id/energy`: Unpaginated; returns all interval readings (e.g. 337 readings for J100000, 8 readings for J100050).

5. **How the Export Signature is Generated and Validated**:
   - Identified in frontend bundle `/_app/immutable/nodes/4.2Bgc2kUI.js`.
   - A secret key is fetched via `GET /portal/keys` (`data.signingSecret`).
   - A canonical request string is constructed: `METHOD\nPATH\nQUERY_STRING\nTIMESTAMP` (e.g., `GET\n/portal/export\npage=1\n<timestamp>`).
   - The signature is calculated as `HMAC-SHA256(canonicalString, secret)` in lowercase hexadecimal and passed in `x-signature` along with `x-timestamp`.
   - The upstream portal enforces an empirical clock-skew window of $\pm$300 seconds (5 minutes). Tampered or expired signatures return HTTP 401 `{"error":"signature_invalid",...}`.

6. **Which Behaviors Remain Assumptions Rather Than Confirmed Facts**:
   - **Timezone**: Assumed Indian Standard Time (IST, UTC+5:30) because the utility is in Rajasthan; the portal does not state timezone explicitly.
   - **Idle Session Timeout**: `Max-Age=3600` is declared on the cookie, but whether the server terminates inactive sessions prior to 1 hour was not measured.
   - **Rate Limits**: No rate limit headers or 429 status codes were observed, but threshold limits under heavy load were not tested to avoid disrupting the service.
   - **Signing Secret Rotation Frequency**: The portal does not provide TTL or expiration for keys returned by `/portal/keys`.

---

## 2. Investigation Methodology: How I Investigated

1. **Initial Network Inspection**:
   - I started by logging into `https://urja-ops.flockenergy.tech` through a desktop browser and monitoring DevTools (Network and Application tabs).
   - The login form submitted via `POST /login` with `Content-Type: application/x-www-form-urlencoded`. Examining the request headers revealed a required custom header: `x-sveltekit-action: true`.
2. **Endpoint Discovery**:
   - Browsing the `/meters` and `/transformers` pages surfaced internal JSON calls to `/portal/meters/search?q=&page=1` and `/portal/dts?page=1`.
   - Navigating to an individual meter detail view (`/meters/J100000`) revealed parallel calls to `/portal/meters/J100000/geo` and `/portal/meters/J100000/energy`.
3. **Discovering the HMAC Export Flow**:
   - On the Transformers page (`/transformers`), there was an "Export all meters" button.
   - Clicking the button triggered an authenticated request to `GET /portal/export?page=1` with two unexpected headers: `x-timestamp` and `x-signature`.
   - In DevTools Sources, I traced the loaded SvelteKit component script `/_app/immutable/nodes/4.2Bgc2kUI.js`.
   - Inside the click handler `F()`, I found:
     1. A fetch to `/portal/keys` returning `data.signingSecret`.
     2. A signing routine calling Web Crypto (`crypto.subtle.importKey` and `crypto.subtle.sign("HMAC", ...)` with SHA-256).
     3. A message format joining method, path, query string, and timestamp with newline characters (`\n`).
4. **Command-Line Verification**:
   - I replicated each flow using `curl.exe` and standalone Node.js scripts, capturing exact status codes, headers, clock-skew tolerances, and payload edge cases.

---

## 3. Authentication & Session Protocol

### 2.1 The Login Mechanism
- **Path**: `POST /login`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Required Headers**:
  - `x-sveltekit-action: true` (mandatory for SvelteKit form action processing)
  - `Origin: https://urja-ops.flockenergy.tech`
  - `Referer: https://urja-ops.flockenergy.tech/login`
  - `Accept: application/json`
- **Request Body**:
  ```http
  email=operator%40urja.local&password=<password>
  ```
- **Observed Response**:
  - **Status Code**: `HTTP/1.1 200 OK`
  - **Content-Type**: `application/json`
  - **Body**:
    ```json
    {"type":"redirect","status":303,"location":"/meters"}
    ```
  - **Set-Cookie Header**:
    ```http
    Set-Cookie: __Secure-better-auth.session_token=...; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax
    ```

### 2.2 Session Duration & Lifecycle
- **Cookie Lifetime**: The `Set-Cookie` header specifies `Max-Age=3600` (1 hour). Unused/idle session timeout was not measured beyond this header value.
- **Unauthenticated / Expired Requests to `/portal/*`**:
  - Requesting `/portal/dts` without a session cookie returns `HTTP/1.1 401 Unauthorized` with:
    ```json
    {"error":"unauthorized","message":"A valid session is required."}
    ```
  - (Note: Visiting frontend HTML routes like `/meters` in a browser returns a 302/303 redirect to `/login`, but API endpoints under `/portal/*` return a direct JSON 401).
- **Client Strategy**: The API client maintains an in-memory cookie jar. If an endpoint returns 401, it automatically calls `login()` and retries the failed request once.

---

## 4. Discovered & Empirically Verified Upstream Endpoints

### 3.1 Distribution Transformers: `GET /portal/dts`
- **Query Parameters**:
  - `page`: Integer (1-based index)
- **Observed Response**:
  - **Status Code**: `200 OK`
  - **Payload Structure**:
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
      "total": 40
    }
    ```
- **Findings**: The network contains 40 distribution transformers (`DT-001` through `DT-040`). Page 1 returns DT-001 to DT-020; page 2 returns DT-021 to DT-040.

---

### 3.2 Meter Search & Pagination: `GET /portal/meters/search`
- **Query Parameters**:
  - `q`: String (search term filter matching meter ID, serial number, make, or DT code)
  - `page`: Integer (1-based index)
- **Observed Response**:
  - **Status Code**: `200 OK`
  - **Payload Structure**:
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
- **Findings**: The portal holds a total of 403 meters across 21 pages. An empty query (`q=`) lists all meters sequentially. Non-existent queries return `{"data": [], "total": 0, "page": 1, "pageSize": 20}` with HTTP 200.

---

### 3.3 Meter Geolocation: `GET /portal/meters/:meterId/geo`
- **Path Parameter**: `:meterId` (e.g. `J100000`)
- **Observed Response**:
  - **Status Code**: `200 OK`
  - **Payload Structure**:
    ```json
    {
      "data": {
        "latitude": "26.938961002479868",
        "longitude": "75.83095696146852"
      }
    }
    ```
- **Findings**:
  - Latitude and longitude are returned as high-precision string literals (15 decimal digits).
  - Requesting an unknown meter returns `HTTP/1.1 404 Not Found` with `{"message": "Meter not found"}`.

---

### 3.4 Meter Energy Telemetry: `GET /portal/meters/:meterId/energy`
- **Path Parameter**: `:meterId` (e.g. `J100000`)
- **Observed Response**:
  - **Status Code**: `200 OK`
  - **Payload Structure**:
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
- **Findings & Quirks**:
  - **Cumulative Registers vs Interval Delta**: Values like `48438.74` followed by `48439.16` represent a monotonically increasing meter index register, not interval consumption. The incremental consumption for that 30-minute block is the difference (`0.42 kWh`).
  - **Variable Sampling Density**: Reading counts vary by meter. Meter `J100000` has 337 readings (30-minute intervals over 7 days). Meter `J100050` has only 8 readings (daily midnight index readings at `00:00`).
  - **Indian Standard Time (IST)**: Timestamps are formatted as `DD/MM/YYYY HH:mm` without timezone offsets. Because the discom operates in Jaipur, India, these represent IST (UTC+5:30). Converting to UTC requires subtracting 330 minutes (`23/06/2026 23:30` IST -> `2026-06-23T18:00:00.000Z` UTC).
  - **Single Phase Voltage on 3-Phase Meters**: Even when a meter is marked `phaseType: "three"`, the energy endpoint reports only `voltR` (Phase R voltage).
  - **String Formats**: Values for `kwh`, `kvah`, and `voltR` are strings, requiring numerical float conversion.

---

### 3.5 Dynamic Signing Secret: `GET /portal/keys`
- **Required Header**: Valid session cookie
- **Observed Response**:
  - **Status Code**: `HTTP/1.1 200 OK`
  - **Payload**:
    ```json
    {"data":{"signingSecret":"I3dZPPf5CgTp7JyGNMI8i6z8LFR7TmSR"}}
    ```
- **Findings**: The secret is retrieved dynamically over HTTP. The response does not return an `expiresIn` field in the JSON payload, so the client caches it in memory for 10 minutes.

---

### 3.6 HMAC-Authenticated Export: `GET /portal/export`
- **Query Parameter**: `page=1` (required for signature canonical string, but ignored in data slicing)
- **Required Headers**:
  - `x-timestamp`: Unix timestamp in seconds (integer string).
  - `x-signature`: SHA256 HMAC hexadecimal digest.
- **Canonical Message Format**:
  ```text
  METHOD\nPATH\nQUERY_STRING\nTIMESTAMP
  ```
  Example:
  ```text
  GET
  /portal/export
  page=1
  1793327600
  ```
- **Observed Behavior on Querying Pages**:
  - `GET /portal/export?page=1`: Returns all 403 meter records in one payload (`{ data: [...], total: 403 }`).
  - `GET /portal/export?page=2`: Returns the exact same 403 records.
  - `GET /portal/export?page=999`: Returns the exact same 403 records.
  - The upstream backend does not paginate the export; it returns the entire meter fleet at once.
- **Clock-Skew Tolerance**:
  - Tested with varying timestamp offsets against the live portal:
    - Offset $\le$ 300 seconds: `HTTP/1.1 200 OK` (Accepted).
    - Offset $\ge$ 305 seconds: `HTTP/1.1 401 Unauthorized` with `{"error":"signature_invalid","message":"Missing or invalid request signature."}`.
  - The portal enforces a strict clock-skew tolerance window of **$\pm$300 seconds (5 minutes)**.
- **Invalid / Missing Signature**:
  - Omitted headers or invalid hexadecimal hashes return `HTTP/1.1 401 Unauthorized` with:
    ```json
    {"error":"signature_invalid","message":"Missing or invalid request signature."}
    ```

---

## 5. Security Findings & Architectural Flaws

1. **Client-Side Secret Exposure**:
   - The signing secret required for `/portal/export` is fetched dynamically via `GET /portal/keys` by any authenticated session.
   - Because any logged-in user can query `/portal/keys` with their session cookie, the HMAC signature provides no client-side secret confidentiality.
   - In practice, the HMAC mechanism functions only as replay and tamper protection within the 5-minute timestamp window, not as a privileged access barrier.
2. **Missing Rate Limiting**:
   - The upstream endpoints do not return `429 Too Many Requests` or rate-limiting headers (`RateLimit-Limit`, `RateLimit-Remaining`).

---

## 6. Empirical Data Quirks & Edge Cases

1. **Distribution Transformer Mappings**:
   - 40 unique DT codes exist across the 403 meters (`DT-001` to `DT-040`).
   - `/portal/dts?page=1` only returns 20 transformers; callers must query page 2 to see `DT-021` through `DT-040`.
2. **Coordinate Precision Divergence**:
   - `/portal/meters/:id/geo` returns coordinates as high-precision strings (`"26.938961002479868"`).
   - `/portal/export` returns coordinates as 6-decimal numbers (`26.938961`).
3. **Synthetic Hierarchy Names**:
   - In `/portal/export`, organizational levels repeat placeholder labels (`Zone 1`, `Circle 1`, `Division 1`, `Subdivision 1`, `Substation 1`, `Feeder 1`), indicating seeded test data in the upstream database.
4. **No Duplicate Meter IDs**:
   - All 403 meter IDs in the test dataset are distinct (`J100000` through `J100402`).

---

## 7. Empirical Verification Summary

### Confirmed Observations

| Item | Measured Status | Evidence / Verification Method |
|------|-----------------|--------------------------------|
| Login Form Submission | **CONFIRMED** | `POST /login` with `x-sveltekit-action: true` returns HTTP 200 with `{"type":"redirect","status":303,"location":"/meters"}`. |
| Cookie Attributes | **CONFIRMED** | `Set-Cookie: __Secure-better-auth.session_token=...; Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax`. |
| Unauthenticated Access | **CONFIRMED** | `GET /portal/dts` without cookie returns HTTP 401 `{"error":"unauthorized","message":"A valid session is required."}`. |
| Meter Fleet Size | **CONFIRMED** | `/portal/meters/search` returns `total: 403`, `pageSize: 20` across 21 pages. |
| Export Payload | **CONFIRMED** | `/portal/export?page=1` returns all 403 meters in a single payload. |
| Export Clock-Skew Tolerance | **CONFIRMED** | Tested offsets: $\le$300s returns 200 OK; $\ge$305s returns 401 `{"error":"signature_invalid",...}`. |
| Invalid Signature Response | **CONFIRMED** | Tampered signature returns HTTP 401 `{"error":"signature_invalid","message":"Missing or invalid request signature."}`. |
| Dynamic Signing Keys | **CONFIRMED** | `GET /portal/keys` returns `{"data":{"signingSecret":"..."}}`. |
| Cumulative Readings | **CONFIRMED** | Sequential telemetry values (`48438.74`, `48439.16`) confirm cumulative meter registers. |

### Unverified / Not Tested

| Item | Status | Reason / Current Understanding |
|------|--------|--------------------------------|
| Server-Side Idle Session Timeout | **NOT VERIFIED** | `Max-Age=3600` is declared on the cookie, but whether the server terminates inactive sessions prior to 1 hour was not measured. |
| Upstream Rate Limits | **NOT VERIFIED** | No `429 Too Many Requests` or rate-limiting headers were observed during testing. |
| Signing Secret Rotation Frequency | **NOT VERIFIED** | `/portal/keys` returns `signingSecret` without an `expiresIn` timestamp; rotation interval was not observed. |
| Mutation Endpoints | **NOT TESTED** | As required by the read-only mandate, no write or update actions were attempted. |
