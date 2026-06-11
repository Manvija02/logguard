import { useState, useEffect, useMemo } from 'react';
import { LogEntry } from '@/lib/api';

interface FilterSearchProps {
  entries: LogEntry[];
  onFilterChange: (filtered: LogEntry[]) => void;
}

export default function FilterSearch({ entries, onFilterChange }: FilterSearchProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);

  // Dynamically extract unique countries for the select dropdown
  const countries = useMemo(() => {
    const list = new Set<string>();
    entries.forEach((e) => {
      if (e.country) {
        list.add(e.country);
      }
    });
    return Array.from(list).sort();
  }, [entries]);

  // Apply filters whenever search state or input lists change
  useEffect(() => {
    const filtered = entries.filter((entry) => {
      // 1. Search query filter (matches IP, User, URL, Country, or Anomaly Reason)
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesIP = entry.ip?.toLowerCase().includes(query);
        const matchesUser = entry.user?.toLowerCase().includes(query);
        const matchesURL = entry.url?.toLowerCase().includes(query);
        const matchesCountry = entry.country?.toLowerCase().includes(query);
        const matchesReason = entry.anomalyReason?.toLowerCase().includes(query);

        if (!matchesIP && !matchesUser && !matchesURL && !matchesCountry && !matchesReason) {
          return false;
        }
      }

      // 2. Status filter
      if (status !== 'ALL') {
        if (entry.status?.toUpperCase() !== status) {
          return false;
        }
      }

      // 3. Country filter
      if (country !== 'ALL') {
        if (entry.country !== country) {
          return false;
        }
      }

      // 4. Anomalies Only filter
      if (anomaliesOnly) {
        if (!entry.isAnomaly) {
          return false;
        }
      }

      return true;
    });

    onFilterChange(filtered);
  }, [search, status, country, anomaliesOnly, entries, onFilterChange]);

  const handleReset = () => {
    setSearch('');
    setStatus('ALL');
    setCountry('ALL');
    setAnomaliesOnly(false);
  };

  return (
    <div className="cyber-card p-5 mb-8 animate-fade-in border-slate-200">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyber-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Filter & Search Logs
          </h3>
          {(search || status !== 'ALL' || country !== 'ALL' || anomaliesOnly) && (
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Text Search */}
          <div className="md:col-span-2 relative">
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Search Text / IP / User / URL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Enter query..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-sm transition-all duration-300"
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Traffic Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500 text-sm transition-all duration-300"
            >
              <option value="ALL">All Events</option>
              <option value="ALLOWED">ALLOWED</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          {/* Country Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Origin Country
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500 text-sm transition-all duration-300"
            >
              <option value="ALL">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Extra Toggles */}
        <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={anomaliesOnly}
              onChange={(e) => setAnomaliesOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            <span className="ml-3 text-xs font-medium text-slate-600 flex items-center gap-1.5">
              ⚠️ Anomalies Only
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
