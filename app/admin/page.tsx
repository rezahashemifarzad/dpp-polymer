'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  Database, 
  FileSpreadsheet, 
  QrCode, 
  CheckCircle2, 
  ArrowLeft 
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [formData, setFormData] = useState({
    gradeName: '',
    polymerType: 'PP',
    pcrPercentage: '50',
    mfi: '',
    density: '',
    supplier: '',
    certifications: 'ISCC PLUS'
  });

  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    
    // شبیه‌سازی ثبت در Neon DB
    setTimeout(() => {
      setStatus('success');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">DPP Admin Console</h1>
            <p className="text-xs text-slate-400">Compounder & Material Data Management</p>
          </div>
        </div>

        <Link 
          href="/" 
          className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Public View
        </Link>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Section */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              Issue New Digital Passport
            </h2>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
              ESPR 2026 Ready
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Grade Trade Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. EcoPolymer PP-503"
                  value={formData.gradeName}
                  onChange={(e) => setFormData({...formData, gradeName: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Base Polymer Type</label>
                <select 
                  value={formData.polymerType}
                  onChange={(e) => setFormData({...formData, polymerType: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                >
                  <option value="PP">PP (Polypropylene)</option>
                  <option value="PE">HDPE / LDPE</option>
                  <option value="ABS">ABS</option>
                  <option value="PC">PC (Polycarbonate)</option>
                  <option value="PET">PET</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">PCR Content (%)</label>
                <input 
                  type="number" 
                  placeholder="50"
                  value={formData.pcrPercentage}
                  onChange={(e) => setFormData({...formData, pcrPercentage: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">MFI (g/10min @ 230°C)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 12"
                  value={formData.mfi}
                  onChange={(e) => setFormData({...formData, mfi: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Density (g/cm³)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 0.905"
                  value={formData.density}
                  onChange={(e) => setFormData({...formData, density: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Primary Recycler / Supplier</label>
              <input 
                type="text" 
                placeholder="e.g. Circular Plastics GmbH"
                value={formData.supplier}
                onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
              />
            </div>

            <button 
              type="submit" 
              disabled={status === 'saving'}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {status === 'saving' ? (
                <span>Publishing to Neon DB...</span>
              ) : status === 'success' ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Passport Published Successfully!
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  Generate & Save Digital Passport
                </>
              )}
            </button>
          </form>
        </div>

        {/* System Status Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Database Connectivity
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Target DB:</span>
                <span className="font-mono text-emerald-400">Neon PostgreSQL</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Region:</span>
                <span className="text-slate-200">eu-central-1 (Frankfurt)</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Compliance Audit:</span>
                <span className="text-emerald-400 font-medium">Active (GDPR)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
              Quick Batch Import
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Upload CoA (Certificate of Analysis) or lab CSV files to generate passports automatically.
            </p>
            <button className="w-full border border-dashed border-slate-700 hover:border-slate-500 text-slate-300 py-3 rounded-lg text-xs font-medium transition-all text-center cursor-pointer">
              + Drag & Drop Lab CSV
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}