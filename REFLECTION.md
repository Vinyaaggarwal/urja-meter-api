# REFLECTION.md — Engineering Reflection

This document answers the five required reflective engineering questions regarding the investigation, architecture, and implementation of the **Urja Meter Operations API** service.

---

### 1. What assumptions did you make?

- **Timezone conversion**: Portal timestamps in `/portal/meters/:id/energy` (such as `23/06/2026 23:30`) lack timezone offsets. Because the utility operates in Rajasthan, India, I assumed they are in Indian Standard Time (IST, UTC+5:30) and converted them to UTC ISO 8601 strings (e.g. `2026-06-23T18:00:00.000Z`).
- **Session expiration**: I did not measure the upstream session lifetime. I assumed the `__Secure-better-auth.session_token` cookie could expire during execution, so I implemented an automatic re-login retry whenever an upstream call returns a `401` or redirects to `/login`.
- **Data consistency between endpoints**: I assumed meter identifiers (`meterId`) are unique across the system and that the inventory in `/portal/export` aligns with the records in `/portal/meters/search`.
- **Cumulative meter registers**: When inspecting the numbers in the energy endpoint, I assumed the values represent monotonic cumulative meter registers rather than discrete 30-minute consumption, because the values increase steadily (e.g. `48438.74` followed by `48439.16`).

---

### 2. Which part was most difficult, and how did you get unstuck?

- **What I tried first**: When I first requested `GET /portal/export?page=1` using an authenticated session cookie, the server returned an HTTP 401/403 error indicating missing signature headers.
- **How I got unstuck**: I knew the portal was able to export records to the browser, so I inspected the network traffic and identified an endpoint at `/portal/keys` returning a dynamic `signingSecret` and an `expiresIn` TTL. By tracing the headers sent with export requests, I saw `x-timestamp` and `x-signature` and reconstructed the canonical message format: `GET\n/portal/export\npage=1\n<timestamp>`. I implemented HMAC-SHA256 signing with this message format, which allowed authenticated access to the full inventory of 403 meters.
- **What I'd do differently**: Rather than probing undocumented endpoints blindly, I would immediately inspect the portal's client-side network calls and key-exchange endpoints when encountering signature-protected resources.

---

### 3. If you had another day, what would you improve?

1. **Short-lived caching for static metadata**: Transformer records (`/portal/dts`) and network hierarchy records change infrequently compared to consumption telemetry, but currently every request hits the upstream portal. I would add an in-memory cache with a 10–15 minute TTL to eliminate redundant upstream round-trips.
2. **Date-range filtering and pagination on consumption**: The `/api/meters/:id/consumption` endpoint currently dumps the entire array of 300+ interval readings at once. I would add `?from=...&to=...&limit=...` query parameters so callers can fetch specific time windows without transferring hundreds of raw entries.
3. **An asynchronous lock on the re-login flow**: In `portalClient.js`, when a session expires under concurrent traffic, multiple in-flight requests can simultaneously detect a `401` and trigger parallel `POST /login` calls. I would add a mutex or pending-promise lock so only one login request executes while others wait for the refreshed session cookie.

---

### 4. What mistake did you make while solving this?

- **What I believed that turned out wrong**: My main mistake was initially assuming that `/portal/meters/:id/energy` returned discrete energy consumption per 30-minute interval. I named the endpoint `/consumption`, mapped the upstream `kwh` field directly to `activeEnergyKwh`, and treated it as interval usage.
- **How I found out**: When reviewing sample records like `48438.74` followed by `48439.16`, I realized the numbers only increased and were far too large to represent single half-hour periods. They were cumulative meter register readings (meter indices), and the actual interval consumption was the difference between consecutive readings (about `0.42 kWh`).
- **What I did**: I updated the normalizer to compute `intervalKwh` as the delta between successive intervals while retaining `activeEnergyKwh` as the cumulative register value, and documented the distinction in both the code and `PROTOCOL.md`.

---

### 5. If reviewing your own submission, what would you criticize?

1. **Composite endpoint fan-out**: `GET /api/meters/:id` executes three simultaneous HTTP requests (`search`, `geo`, and `energy`) via `Promise.allSettled`. While convenient for clients, it triples upstream load and latency for callers who only need basic meter metadata.
2. **No concurrency lock on session renewal**: `portalClient.js` lacks a mutex on `login()`. If the session expires while multiple concurrent requests are in flight, they will all fire separate `POST /login` requests at the same time.
3. **Unfiltered consumption payload**: The consumption endpoint returns all 337 readings in a single payload without pagination or date filtering, which is inefficient for downstream clients interested only in recent readings.
4. **Mocked unit tests cannot detect upstream API drift**: The unit test suite relies on mocked upstream responses. If the legacy portal modifies its payload structures, session cookies, or HMAC signing requirements, the unit tests will continue to pass until the live integration test suite is explicitly run.

---

## Engineering Decisions and Trade-offs

During implementation, I made several decisions to keep the service modular, secure and practical within the assignment scope:

1. **Fastify-based architecture**: Used a modular structure to separate routing, request handling, business logic and portal communication.
2. **Read-only integration**: Kept the service focused on retrieving and exposing existing portal data rather than modifying upstream records.
3. **Centralized portal client**: Isolated authentication and upstream HTTP communication to avoid duplicating integration logic.
4. **Data normalization**: Added a normalization layer to provide consistent response structures to API consumers.
5. **HMAC-based export authentication**: Implemented request signing using the observed portal signing mechanism.
6. **Scope management**: Prioritized the required meter, transformer and export functionality. Features outside the core scope were treated as optional enhancements or future work.

---

## Additional Features: Rationale

The health check, validation, error handling, automated tests and optional frontend were added to improve service usability and maintainability.

These additions were intended to demonstrate how the API could be consumed and operated in a practical environment, rather than simply satisfying the minimum endpoint requirements.

---

## Limitations and Future Improvements

- Add retry and backoff strategies for transient upstream failures.
- Improve session refresh and concurrent authentication handling.
- Add pagination support wherever the upstream API supports it.
- Expand integration testing against actual portal responses.
- Improve monitoring and structured logging.
- Add further API documentation and usage examples.
