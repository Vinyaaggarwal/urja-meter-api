# Flock Urja Ops — Frontend Dashboard

A modern, responsive React + TypeScript dashboard built with Vite, Tailwind CSS, Lucide icons, and Recharts for inspecting smart meter telemetry and demonstrating the Flock Energy assignment.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment (Optional)
If running against a backend on a custom port, create `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```
*(By default, Vite dev server proxies `/api`, `/health`, `/meters`, `/transformers`, and `/export` to `http://localhost:3000`)*

### 3. Start Development Server
```bash
npm run dev
```
Dashboard will be available at: **http://localhost:5173**

### 4. Build for Production
```bash
npm run build
```

---

## 📑 Pages Included

1. **Overview (`/`)**: High-level telemetry stats (403 meters, 25 transformers), live backend connection indicator, recent meters table, and 24-hr active energy preview chart.
2. **Meter Explorer (`/meters`)**: Searchable meter table with manufacturer & status filters, server-side pagination, and row-click inspection.
3. **Meter Details (`/meters/:id`)**: Comprehensive profile displaying coordinates, status, 7-tier distribution network hierarchy, 30-min interval readings chart, and raw JSON inspector.
4. **Consumption Analytics (`/consumption`)**: Interactive multi-axis Recharts line chart showing Active Energy (kWh) and Line Voltage (V) across 30-min interval readings.
5. **Network Topology Explorer (`/network`)**: 7-tier distribution hierarchy visualizer (Zone to DT) and Distribution Transformers equipment table.
6. **Interactive API Explorer (`/api-explorer`)**: Live tester for all 7 backend endpoints with parameter inputs, response duration, HTTP status code, and copyable formatted JSON.
7. **Architecture & Docs (`/architecture`)**: Visual pipeline diagram from the Urja legacy portal to the Fastify API and React dashboard.

