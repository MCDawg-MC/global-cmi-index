import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CountryDetail from './pages/CountryDetail';
import Compare from './pages/Compare';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/country/:code" element={<CountryDetail />} />
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </div>
  );
}
