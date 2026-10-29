import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Search, Zap } from 'lucide-react';
import { api } from '../services/api';
import { Meter, MeterComposite, PaginationMeta } from '../types';

export const MetersPage: React.FC = () => {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<MeterComposite | null>(null);

  // Load meters from backend
  const loadMeters = async (q: string, p: number) => {
    setLoading(true);
    try {
      const res = await api.getMeters({ q, page: p });
      setMeters(res.data || []);
      setMeta(res.meta || null);
    } catch (err: any) {
      alert(err.message || 'Failed to load meters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeters(search, page);
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadMeters(search, 1);
  };

  const handleSelectMeter = async (meterId: string) => {
    try {
      const res = await api.getMeterDetails(meterId);
      setSelectedMeter(res.data);
    } catch (err: any) {
      alert(err.message || 'Failed to load meter details');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Smart Meters Explorer</h1>
        <p className="text-xs text-slate-500">Search and inspect smart meters across the Jaipur Discom grid</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by Meter ID (e.g. J100000), Serial, or DT Code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Search
        </button>
      </form>

      {/* Meters Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600 font-semibold uppercase">
            <tr>
              <th className="py-3 px-4">Meter ID</th>
              <th className="py-3 px-4">Serial Number</th>
              <th className="py-3 px-4">Manufacturer</th>
              <th className="py-3 px-4">Phase</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">DT Code</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">Loading meters...</td>
              </tr>
            ) : meters.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">No meters found</td>
              </tr>
            ) : (
              meters.map((m) => (
                <tr
                  key={m.meterId}
                  onClick={() => handleSelectMeter(m.meterId)}
                  className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-indigo-600">{m.meterId}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{m.serialNumber || 'N/A'}</td>
                  <td className="py-3 px-4 text-slate-800">{m.manufacturer || 'Unknown'}</td>
                  <td className="py-3 px-4 capitalize text-slate-600">{m.phaseType || 'single'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                      {m.installationStatus || 'Standard'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">{m.distributionTransformerCode || 'N/A'}</td>
                  <td className="py-3 px-4 text-right text-indigo-600 font-medium">Inspect</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Page {meta.page} of {meta.totalPages} ({meta.total} meters)</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= meta.totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Meter Details Panel */}
      {selectedMeter && (
        <div className="p-5 bg-white border border-indigo-200 rounded-xl shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-bold text-slate-900 text-sm">
              Meter Details: <span className="font-mono text-indigo-600">{selectedMeter.meterId}</span>
            </h3>
            <button onClick={() => setSelectedMeter(null)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block">Manufacturer:</span>
              <span className="font-semibold text-slate-800">{selectedMeter.manufacturer || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Distribution Transformer:</span>
              <span className="font-mono font-semibold text-slate-800">{selectedMeter.distributionTransformerCode || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">GPS Coordinates:</span>
              <span className="font-mono text-slate-800">
                {selectedMeter.geo?.latitude ? `${selectedMeter.geo.latitude.toFixed(4)}, ${selectedMeter.geo.longitude?.toFixed(4)}` : 'Not available'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Latest Active Reading:</span>
              <span className="font-semibold text-emerald-600">
                {selectedMeter.latestReading?.activeEnergyKwh ? `${selectedMeter.latestReading.activeEnergyKwh} kWh` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

