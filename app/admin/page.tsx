'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  PlusCircle, 
  Database, 
  FileSpreadsheet, 
  QrCode, 
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Layers
} from 'lucide-react';
import Link from 'next/link';

interface PolymerPassport {
  id: string;
  grade: string;
  polymerType: string;
  recycledContentPercent: number;
  meltFlowIndex: number;
  density: number;
  batchId: string;
  status: string;
  createdAt?: string;
}

export default function AdminDashboard() {
  const [passports, setPassports] = useState<PolymerPassport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    gradeName: '',
    polymerType: 'PP',
    pcrPercentage: '50',
    mfi: '12',
    density: '0.905',
    supplier: 'Circular Plastics GmbH',
  });

  const fetchPassports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/passports');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setPassports(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching passports:', err);
      setPassports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAlertMessage(null);

    try {
      const res = await fetch('/api/passports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const json = await res.json();

      if (json.success) {
        setAlertMessage({ type: 'success', text: `Passport issued successfully! Batch ID: ${json.data.batchId}` });
        setFormData({
          gradeName: '',
          polymerType: 'PP',
          pcrPercentage: '50',
          mfi: '12',
          density: '0.905',
          supplier: 'Circular Plastics GmbH',
        });
        fetchPassports();
      } else {
        throw new Error(json.error || 'Submission failed');
      }
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'Database error occurred' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center pb-6 mb-8 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">DPP Industrial Admin Console</h1>
            <p className="text-xs text-slate-400">Compounder & Material Lifecycle Management (ESPR Compliance)</p>
          </div>
        </div>

        <Link 
          href="/" 
          className="flex items-center gap-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Public View
        </Link>
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                Issue New Digital Passport
              </h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Neon DB Sync
              </span>
            </div>

            {alertMessage && (
              <div className={`p-3.5 rounded-lg mb-5 text-xs font-medium ${
                alertMessage.type === 'success' 
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                {alertMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Grade Trade Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Injection Molding Grade IM-450"
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
                    <option value="PP">PP</option>
                    <option value="HDPE">HDPE</option>
                    <option value="LDPE">LDPE</option>
                    <option value="PET">PET</option>
                    <option value="ABS">ABS</option>
                    <option value="PC">PC</option>
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
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">MFI (g/10min @ ISO 1133)</label>
                  <input 
                    type="text" 
                    placeholder="12"
                    value={formData.mfi}
                    onChange={(e) => setFormData({...formData, mfi: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Density (g/cm³ @ ISO 1183)</label>
                  <input 
                    type="text" 
                    placeholder="0.905"
                    value={formData.density}
                    onChange={(e) => setFormData({...formData, density: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving to Neon DB...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    Save Live & Issue Digital Passport
                  </>
                )}
              </button>
            </form>
          </div>

          {/* System Info */}
          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                PostgreSQL Connectivity
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Database:</span>
                  <span className="font-mono text-emerald-400">Neon Cloud DB</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                  <span className="text-slate-400">Schema Model:</span>
                  <span className="text-slate-200">PolymerPassport</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-400">Compliance Standard:</span>
                  <span className="text-emerald-400 font-medium">EU ESPR 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Material Ledger Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Material Ledger & Active Passports
              </h3>
              <p className="text-xs text-slate-400 mt-1">Live data records synchronized with Neon DB</p>
            </div>
            <button 
              onClick={fetchPassports}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3">Batch ID</th>
                  <th className="p-3">Grade Name</th>
                  <th className="p-3 text-center">Polymer</th>
                  <th className="p-3 text-center">PCR %</th>
                  <th className="p-3 text-center">MFI</th>
                  <th className="p-3 text-center">Density</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Direct Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {passports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center p-6 text-slate-500">
                      {loading ? 'Fetching records from database...' : 'No passports issued yet. Create your first passport above.'}
                    </td>
                  </tr>
                ) : (
                  passports.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-mono font-medium text-emerald-400">{item.batchId}</td>
                      <td className="p-3 font-medium text-slate-100">{item.grade}</td>
                      <td className="p-3 text-center font-semibold">{item.polymerType}</td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                          {item.recycledContentPercent}%
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">{item.meltFlowIndex}</td>
                      <td className="p-3 text-center font-mono">{item.density}</td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link 
                          href={`/passport/${item.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}