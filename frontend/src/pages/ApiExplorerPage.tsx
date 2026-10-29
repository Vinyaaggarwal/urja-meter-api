import React, { useState } from 'react';
import { api } from '../services/api';

const ENDPOINTS = [
  { path: '/health', label: 'GET /health — Service health' },
  { path: '/api/meters?page=1', label: 'GET /api/meters — List meters (page 1)' },
  { path: '/api/meters/J100000', label: 'GET /api/meters/J100000 — Meter composite details' },
  { path: '/api/meters/J100000/consumption', label: 'GET /api/meters/J100000/consumption — Telemetry history' },
  { path: '/api/meters/J100000/network', label: 'GET /api/meters/J100000/network — Network hierarchy & GPS' },
  { path: '/api/transformers', label: 'GET /api/transformers — List transformers' },
  { path: '/api/export', label: 'GET /api/export — HMAC-signed export' },
];

export const ApiExplorerPage: React.FC = () => {
  const [selectedPath, setSelectedPath] = useState(ENDPOINTS[0].path);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExecute = async () => {
    setLoading(true);
    const res = await api.executeRaw(selectedPath);
    setResult(res);
    setLoading(false);
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
      alert('Copied JSON to clipboard!');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Interactive API Explorer</h1>
        <p className="text-xs text-slate-500">Test live backend endpoints directly from your browser</p>
      </div>

      {/* Selector & Execute */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Select Endpoint to Test:</label>
          <select
            value={selectedPath}
            onChange={(e) => {
              setSelectedPath(e.target.value);
              setResult(null);
            }}
            className="w-full p-2 border rounded-lg text-xs font-mono bg-slate-50"
          >
            {ENDPOINTS.map((ep) => (
              <option key={ep.path} value={ep.path}>{ep.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">Target URL Path:</label>
          <input
            type="text"
            value={selectedPath}
            onChange={(e) => setSelectedPath(e.target.value)}
            className="w-full p-2 border rounded-lg text-xs font-mono"
          />
        </div>

        <button
          onClick={handleExecute}
          disabled={loading}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Sending Request...' : 'Send GET Request'}
        </button>
      </div>

      {/* Response Box */}
      {result && (
        <div className="p-5 bg-slate-900 rounded-xl text-slate-200 text-xs font-mono space-y-3 shadow-lg">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded font-bold ${result.status === 200 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                HTTP {result.status} {result.statusText}
              </span>
              <span className="text-slate-400">{result.durationMs} ms</span>
            </div>
            <button onClick={handleCopy} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">
              Copy JSON
            </button>
          </div>
          <pre className="max-h-96 overflow-y-auto leading-relaxed text-slate-300">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

