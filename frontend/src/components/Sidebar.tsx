import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, BarChart3, Code2, Network, Search, Zap } from 'lucide-react';
import { api } from '../services/api';
import { HealthStatus } from '../types';

export const Sidebar: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    api.checkHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const links = [
    { to: '/', label: 'Meters & Overview', icon: Search },
    { to: '/consumption', label: 'Consumption Chart', icon: BarChart3 },
    { to: '/network', label: 'Network Hierarchy', icon: Network },
    { to: '/api-explorer', label: 'API Explorer', icon: Code2 },
  ];

  return (
    <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0 h-screen sticky top-0 border-r border-slate-800 select-none">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold text-white text-sm">Urja Ops Portal</div>
          <div className="text-[11px] text-slate-400">Flock Energy Assignment</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Backend Status */}
      <div className="p-3 m-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`h-2 w-2 rounded-full ${
              health?.status === 'healthy' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold text-slate-200">
            {health?.status === 'healthy' ? 'Backend Connected' : 'Backend Offline'}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          Port: {health ? '3000 (Healthy)' : 'Offline'}
        </div>
      </div>
    </aside>
  );
};
