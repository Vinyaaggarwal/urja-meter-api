import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import { ConsumptionReading } from '../types';

export const ConsumptionPage: React.FC = () => {
  const [meterId, setMeterId] = useState('J100000');
  const [inputVal, setInputVal] = useState('J100000');
  const [readings, setReadings] = useState<ConsumptionReading[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReadings = async (id: string) => {
    setLoading(true);
    try {
      const res = await api.getMeterConsumption(id);
      setReadings(res.data || []);
      setMeterId(id);
    } catch (err: any) {
      alert(err.message || 'No readings found');
      setReadings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadings(meterId);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">30-Minute Interval Consumption</h1>
        <p className="text-xs text-slate-500">Historical electricity telemetry readings (kWh)</p>
      </div>

      {/* Meter Input Form */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-700">Meter ID:</label>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-xs font-mono w-40"
        />
        <button
          onClick={() => fetchReadings(inputVal.trim())}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
        >
          {loading ? 'Loading...' : 'Load Telemetry'}
        </button>
      </div>

      {/* Chart */}
      {readings.length > 0 ? (
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-sm">
            Telemetry Waveform for <span className="font-mono text-indigo-600">{meterId}</span> ({readings.length} total points)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={readings.slice(0, 48)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="rawTimestamp" stroke="#94a3b8" fontSize={10} interval={4} />
                <YAxis stroke="#94a3b8" fontSize={10} domain={['dataMin - 1', 'dataMax + 1']} unit=" kWh" />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '6px' }} />
                <Line type="monotone" dataKey="activeEnergyKwh" name="kWh" stroke="#4F46E5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white border rounded-xl text-slate-400 text-xs">
          No consumption readings loaded
        </div>
      )}

      {/* Readings Table */}
      {readings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 border-b text-xs font-semibold text-slate-600">
            Recent Telemetry Intervals (Showing first 15)
          </div>
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-500 uppercase">
              <tr>
                <th className="py-2.5 px-4">Local Timestamp</th>
                <th className="py-2.5 px-4">ISO 8601 UTC</th>
                <th className="py-2.5 px-4">Active kWh</th>
                <th className="py-2.5 px-4">Phase Voltage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readings.slice(0, 15).map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 px-4 text-slate-700">{r.rawTimestamp}</td>
                  <td className="py-2 px-4 text-indigo-600">{r.timestamp}</td>
                  <td className="py-2 px-4 font-semibold text-slate-900">{r.activeEnergyKwh}</td>
                  <td className="py-2 px-4 text-amber-600">{r.voltageR} V</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

