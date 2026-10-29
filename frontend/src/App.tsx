import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MetersPage } from './pages/MetersPage';
import { ConsumptionPage } from './pages/ConsumptionPage';
import { NetworkPage } from './pages/NetworkPage';
import { ApiExplorerPage } from './pages/ApiExplorerPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<MetersPage />} />
            <Route path="/consumption" element={<ConsumptionPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/api-explorer" element={<ApiExplorerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
