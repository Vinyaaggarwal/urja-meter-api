import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Transformer } from '../types';

export const NetworkPage: React.FC = () => {
  const [dts, setDts] = useState<Transformer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getTransformers(1)
      .then((res) => setDts(res.data || []))
      .catch(() => setDts([]))
      .finally(() => setLoading(false));
  }, []);

  const tiers = ['Zone (Jaipur)', 'Circle (C-01)', 'Division (D-01)', 'Subdivision (SD-01)', 'Substation (SS-01)', 'Feeder (F-001)', 'Distribution Transformer'];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Network Topology & Transformers</h1>
        <p className="text-xs text-slate-500">Distribution network hierarchy discovered from Urja operations</p>
      </div>

      {/* 7-Tier Breadcrumb */}
      <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">7-Tier Grid Topology</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {tiers.map((t, idx) => (
            <React.Fragment key={idx}>
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-900 font-semibold border border-indigo-100">
                {t}
              </span>
              {idx < tiers.length - 1 && <span className="text-slate-300 font-bold">&rarr;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Transformers Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b text-xs font-semibold text-slate-700">
          Distribution Transformers ({dts.length} Units Mapped)
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
            <tr>
              <th className="py-2.5 px-4">DT Code</th>
              <th className="py-2.5 px-4">Transformer Name</th>
              <th className="py-2.5 px-4">Parent Feeder</th>
              <th className="py-2.5 px-4">Nominal Capacity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="py-6 text-center text-slate-400">Loading equipment...</td></tr>
            ) : dts.map((dt) => (
              <tr key={dt.code} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-mono font-bold text-indigo-600">{dt.code}</td>
                <td className="py-2.5 px-4 text-slate-800 font-medium">{dt.name}</td>
                <td className="py-2.5 px-4 font-mono text-slate-600">{dt.feederCode}</td>
                <td className="py-2.5 px-4 text-emerald-600 font-semibold">{dt.capacityKva} kVA</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

