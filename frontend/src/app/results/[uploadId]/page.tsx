'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/lib/auth';
import { getResults, AnalysisResults, LogEntry } from '@/lib/api';
import Navbar from '@/components/Navbar';
import GlobeVisualization from '@/components/GlobeVisualization';
import FilterSearch from '@/components/FilterSearch';
import UserIPMapping from '@/components/UserIPMapping';
import RecommendationsPanel from '@/components/RecommendationsPanel';
import ExportReport from '@/components/ExportReport';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ===================== Sub-Components =====================

function StatCard({
  icon,
  label,
  value,
  accent = 'green',
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: 'green' | 'red' | 'blue' | 'amber' | 'purple';
  delay?: number;
}) {
  const accentMap = {
    green: 'border-slate-200 hover:border-cyber-green/50 shadow-sm hover:shadow-md',
    red: 'border-slate-200 hover:border-cyber-red/50 shadow-sm hover:shadow-md',
    blue: 'border-slate-200 hover:border-cyber-blue/50 shadow-sm hover:shadow-md',
    amber: 'border-slate-200 hover:border-cyber-amber/50 shadow-sm hover:shadow-md',
    purple: 'border-slate-200 hover:border-cyber-purple/50 shadow-sm hover:shadow-md',
  };

  const iconBgMap = {
    green: 'bg-green-50',
    red: 'bg-red-50',
    blue: 'bg-blue-50',
    amber: 'bg-amber-50',
    purple: 'bg-purple-50',
  };

  return (
    <div
      className={`cyber-card p-5 ${accentMap[accent]} transition-all duration-300 hover:transform hover:scale-[1.02] animate-slide-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-800 font-mono">{value}</p>
        </div>
        <div
          className={`w-10 h-10 rounded-lg ${iconBgMap[accent]} flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: 'low' | 'medium' | 'high' | 'critical';
}) {
  const map = {
    low: 'bg-blue-50 text-blue-700 border-blue-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-red-50 text-red-700 border-red-200',
    critical: 'bg-red-100 text-red-800 border-red-300 animate-pulse',
  };
  return (
    <span className={`cyber-badge border ${map[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  let color: string;
  if (score >= 80) color = 'bg-red-50 text-red-700 border-red-200';
  else if (score >= 50)
    color = 'bg-amber-50 text-amber-700 border-amber-200';
  else color = 'bg-green-50 text-green-700 border-green-200';

  return (
    <span className={`cyber-badge border ${color}`}>
      {score.toFixed(0)}% confidence
    </span>
  );
}

// ===================== Chart Wrappers =====================

function RequestsPerHourChart({
  data,
}: {
  data: { hour: number; count: number }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartSkeleton />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="hour"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickFormatter={(v: number) => `${v}:00`}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#0f172a',
          }}
          labelFormatter={(v: number) => `${v}:00`}
        />
        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopDomainsChart({
  data,
}: {
  data: { domain: string; count: number }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartSkeleton />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          stroke="#64748b"
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          dataKey="domain"
          type="category"
          stroke="#64748b"
          tick={{ fill: '#475569', fontSize: 11 }}
          width={120}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#0f172a',
          }}
        />
        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StatusPieChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <ChartSkeleton />;

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={4}
          dataKey="value"
          stroke="none"
        >
          {data.map((_entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            color: '#0f172a',
          }}
        />
        <Legend
          wrapperStyle={{ color: '#475569', fontSize: '13px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[300px] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin" />
    </div>
  );
}

// ===================== Log Table =====================

function LogTable({ entries, highlightedIP }: { entries: LogEntry[]; highlightedIP?: string | null }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(100);

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const visibleEntries = entries.slice(0, visibleCount);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cyber-border">
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider">
                Time
              </th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider">
                IP Address
              </th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider hidden md:table-cell">
                User
              </th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider">
                URL
              </th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider">
                Status
              </th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider hidden lg:table-cell">
                Bytes
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry, index) => (
              <LogRow
                key={index}
                entry={entry}
                index={index}
                isExpanded={expandedRows.has(index)}
                onToggle={() => toggleRow(index)}
                isHighlighted={highlightedIP === entry.ip}
              />
            ))}
          </tbody>
        </table>
      </div>

      {entries.length > visibleCount && (
        <div className="text-center py-6">
          <button
            onClick={() => setVisibleCount((prev) => prev + 100)}
            className="px-6 py-2.5 text-sm text-slate-600 hover:text-slate-800
                       border border-cyber-border hover:border-slate-400
                       rounded-lg transition-all duration-300"
          >
            Show More ({entries.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function LogRow({
  entry,
  index,
  isExpanded,
  onToggle,
  isHighlighted,
}: {
  entry: LogEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  isHighlighted?: boolean;
}) {
  const isAnomaly = entry.isAnomaly;
  const isBlocked =
    entry.status?.toUpperCase() === 'BLOCKED' ||
    entry.status?.toUpperCase() === 'DENIED';

  const rowBg = isAnomaly
    ? isHighlighted
      ? 'bg-indigo-100/70 hover:bg-indigo-200/50 border-l-2 border-l-cyber-blue font-semibold'
      : 'bg-red-50 hover:bg-red-100/70 border-l-2 border-l-cyber-red'
    : isHighlighted
    ? 'bg-indigo-50/85 hover:bg-indigo-200/30 border-l-2 border-l-cyber-blue font-semibold'
    : index % 2 === 0
    ? 'bg-transparent hover:bg-slate-100/50'
    : 'bg-slate-50/60 hover:bg-slate-100/50';

  return (
    <>
      <tr
        className={`${rowBg} cursor-pointer transition-colors duration-200 border-b border-cyber-border/30`}
        onClick={isAnomaly ? onToggle : undefined}
      >
        <td className="py-3 px-4 text-slate-500 font-mono text-xs whitespace-nowrap">
          {entry.timestamp}
        </td>
        <td className="py-3 px-4 text-slate-700 font-mono text-xs">
          {entry.ip}
        </td>
        <td className="py-3 px-4 text-slate-600 text-xs hidden md:table-cell">
          {entry.user || '-'}
        </td>
        <td className="py-3 px-4 text-slate-700 text-xs max-w-[200px] truncate">
          {entry.url}
        </td>
        <td className="py-3 px-4">
          {isBlocked ? (
            <span className="status-blocked">BLOCKED</span>
          ) : (
            <span className="status-allowed">ALLOWED</span>
          )}
        </td>
        <td className="py-3 px-4 text-slate-500 font-mono text-xs hidden lg:table-cell">
          {entry.bytes?.toLocaleString() || '0'}
        </td>
      </tr>

      {/* Expanded anomaly details */}
      {isAnomaly && isExpanded && (
        <tr className="bg-red-50/30">
          <td colSpan={6} className="px-4 py-4">
            <div className="ml-4 pl-4 border-l-2 border-cyber-red/30 space-y-2 animate-fade-in">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  ⚠️ Anomaly Detected
                </span>
                {entry.confidence !== undefined && (
                  <ConfidenceBadge score={entry.confidence} />
                )}
              </div>
              {entry.anomalyReason && (
                <p className="text-sm text-slate-700">
                  <span className="text-slate-500 font-semibold">Reason:</span>{' '}
                  {entry.anomalyReason}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ===================== Main Results Page =====================

function ResultsPageContent() {
  const params = useParams();
  const router = useRouter();
  const uploadId = params.uploadId as string;

  const [data, setData] = useState<AnalysisResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [highlightedIP, setHighlightedIP] = useState<string | null>(null);
  const [filteredEntries, setFilteredEntries] = useState<LogEntry[]>([]);

  const globeAnomalies = useMemo(() => {
    if (!data || !data.entries) return [];
    const groups = new Map<string, any>();
    for (const e of data.entries) {
      if (e.isAnomaly) {
        const existing = groups.get(e.ip);
        if (existing) {
          existing.count += 1;
          if ((e.confidence || 0) > existing.confidence_score) {
            existing.confidence_score = e.confidence || 0;
            existing.reason = e.anomalyReason || 'Unknown anomaly';
          }
        } else {
          groups.set(e.ip, {
            ip: e.ip,
            reason: e.anomalyReason || 'Unknown anomaly',
            confidence_score: e.confidence || 0,
            count: 1,
            latitude: e.latitude,
            longitude: e.longitude,
            country: e.country,
          });
        }
      }
    }
    return Array.from(groups.values());
  }, [data]);

  const anomaliesList = useMemo(() => {
    if (!data || !data.entries) return [];
    return data.entries.filter((e) => e.isAnomaly);
  }, [data]);

  const handleIPClick = (ip: string) => {
    setHighlightedIP(ip);
    const tableEl = document.getElementById('log-entries-table-section');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    if (uploadId) {
      fetchResults();
    }
  }, [uploadId]);

  const fetchResults = async () => {
    try {
      const results = await getResults(uploadId);
      setData(results);
      setFilteredEntries(results.entries);
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosError.response?.status === 404) {
        setError('Analysis not found. The upload may still be processing.');
      } else {
        setError(
          axiosError.response?.data?.error ||
            'Failed to load results. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-darker flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin" />
          </div>
          <p className="text-slate-600 text-sm font-medium">Decrypting analysis data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-cyber-darker cyber-grid-bg">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
          <div className="cyber-card p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-100 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-cyber-red"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-slate-800">
              {error || 'Results Not Available'}
            </h2>
            <p className="text-gray-500 mb-6">
              Please check the upload ID or try again later.
            </p>
            <button
              onClick={() => router.push('/upload')}
              className="cyber-btn"
            >
              ← Back to Uploads
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-darker cyber-grid-bg">
      <Navbar />

      <main id="dashboard-content" className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/upload')}
                className="text-gray-500 hover:text-slate-800 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-3xl font-bold">
                <span className="text-cyber-green">Security</span> Analysis Dashboard
              </h1>
            </div>
            <ExportReport
              filename={data.filename}
              entries={data.entries}
              anomalies={anomaliesList}
            />
          </div>
          <p className="text-gray-500 text-sm ml-8 mt-1">
            Analysis of{' '}
            <span className="text-slate-700 font-semibold font-mono">
              {data.filename}
            </span>
          </p>
        </div>

        {/* ==================== Section 1: Summary Cards ==================== */}
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={
                <svg
                  className="w-5 h-5 text-cyber-green"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              }
              label="Total Entries"
              value={data.summary.totalEntries.toLocaleString()}
              accent="green"
              delay={0}
            />
            <StatCard
              icon={
                <svg
                  className="w-5 h-5 text-cyber-red"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              }
              label="Total Anomalies"
              value={data.summary.totalAnomalies}
              accent={data.summary.totalAnomalies > 0 ? 'red' : 'green'}
              delay={100}
            />
            <StatCard
              icon={
                <svg
                  className="w-5 h-5 text-cyber-amber"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
              label="Blocked Requests"
              value={data.summary.blockedRequests}
              accent="amber"
              delay={200}
            />
            <StatCard
              icon={
                <svg
                  className="w-5 h-5 text-cyber-purple"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              }
              label="Top IP"
              value={data.summary.topIP || 'N/A'}
              accent="purple"
              delay={300}
            />
          </div>

          {/* Top IPs */}
          {data.summary.topIPs && data.summary.topIPs.length > 0 && (
            <div className="cyber-card p-5 animate-slide-up" style={{ animationDelay: '400ms' }}>
              <h3 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Top 5 Most Active IPs
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {data.summary.topIPs.slice(0, 5).map((ipData, i) => (
                  <div
                    key={ipData.ip}
                    className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2 border border-cyber-border/50"
                  >
                    <span className="text-xs font-bold text-slate-400 w-5">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-slate-700 truncate">
                        {ipData.ip}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ipData.count} requests
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Actionable Recommendations Panel */}
        <RecommendationsPanel uploadId={data.uploadId} anomalies={anomaliesList} />

        {/* ==================== Section 2: Charts ==================== */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 animate-fade-in">
            <svg
              className="w-5 h-5 text-cyber-blue"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Analytics Overview
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Requests per Hour */}
            <div className="cyber-card p-5 animate-slide-up">
              <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Requests Per Hour
              </h3>
              <RequestsPerHourChart
                data={data.charts.requestsPerHour}
              />
            </div>

            {/* Top Domains */}
            <div className="cyber-card p-5 animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Top 10 Domains
              </h3>
              <TopDomainsChart data={data.charts.topDomains} />
            </div>
          </div>

          {/* 3D Threat Globe Map */}
          <div className="mb-10 cyber-card p-6 animate-slide-up">
            <GlobeVisualization
              anomalies={globeAnomalies}
              onIPClick={handleIPClick}
            />
          </div>

          {/* Pie Chart - Status Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="cyber-card p-5 animate-slide-up" style={{ animationDelay: '200ms' }}>
              <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Request Status Breakdown
              </h3>
              <StatusPieChart data={data.charts.statusBreakdown} />
            </div>

            {/* Quick stats sidebar */}
            <div className="lg:col-span-2 cyber-card p-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
              <h3 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Quick Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 border border-cyber-border/50">
                  <p className="text-xs text-slate-500 mb-1">Anomaly Rate</p>
                  <p className="text-2xl font-bold font-mono text-cyber-red">
                    {data.summary.totalEntries > 0
                      ? (
                          (data.summary.totalAnomalies /
                            data.summary.totalEntries) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-cyber-border/50">
                  <p className="text-xs text-slate-500 mb-1">Block Rate</p>
                  <p className="text-2xl font-bold font-mono text-cyber-amber">
                    {data.summary.totalEntries > 0
                      ? (
                          (data.summary.blockedRequests /
                            data.summary.totalEntries) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-cyber-border/50">
                  <p className="text-xs text-slate-500 mb-1">Clean Entries</p>
                  <p className="text-2xl font-bold font-mono text-cyber-green">
                    {(
                      data.summary.totalEntries - data.summary.totalAnomalies
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 border border-cyber-border/50">
                  <p className="text-xs text-slate-500 mb-1">Unique IPs</p>
                  <p className="text-2xl font-bold font-mono text-cyber-blue">
                    {data.summary.topIPs?.length || 0}+
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== Section 3: SOC Timeline ==================== */}
        {data.socTimeline && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 animate-fade-in">
              <svg
                className="w-5 h-5 text-cyber-amber"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              SOC Intelligence Report
            </h2>

            {/* AI Narrative */}
            {data.socTimeline.narrative && (
              <div className="cyber-card p-6 mb-6 animate-slide-up border-l-4 border-l-cyber-amber bg-amber-50/30">
                <div className="flex items-start gap-3">
                  <img src="/ai-avatar.jpg" alt="AI Avatar" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-cyber-amber mb-2">
                      AI Security Narrative
                    </h4>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                      {data.socTimeline.narrative}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timeline Events */}
            {data.socTimeline.events && data.socTimeline.events.length > 0 && (
              <div className="cyber-card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <h4 className="text-sm font-semibold text-slate-500 mb-5">
                  Anomalous Event Timeline
                </h4>
                <div className="space-y-0">
                  {data.socTimeline.events.map((event, i) => (
                    <div key={i} className="flex gap-4 group">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${
                            event.severity === 'critical'
                              ? 'bg-red-500 animate-pulse'
                              : event.severity === 'high'
                              ? 'bg-cyber-red'
                              : event.severity === 'medium'
                              ? 'bg-cyber-amber'
                              : 'bg-cyber-blue'
                          }`}
                        />
                        {i < data.socTimeline.events.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 min-h-[40px]" />
                        )}
                      </div>
                      {/* Event content */}
                      <div className="pb-6 flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="text-xs font-mono text-slate-500">
                            {event.time}
                          </span>
                          <SeverityBadge severity={event.severity} />
                        </div>
                        <p className="text-sm text-slate-600">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* User-to-IP Relationship Mapping Section */}
        <UserIPMapping entries={data.entries} />

        {/* ==================== Section 4: Log Entries Table ==================== */}
        <section id="log-entries-table-section">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 animate-fade-in">
            <svg
              className="w-5 h-5 text-cyber-green"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
              />
            </svg>
            Log Entries
            <span className="text-sm text-gray-500 font-normal ml-2">
              ({filteredEntries.length} filtered / {data.entries.length} total, click anomalous rows to expand)
            </span>
          </h2>

          {/* Filter Search controls */}
          <FilterSearch entries={data.entries} onFilterChange={setFilteredEntries} />

          <div className="cyber-card overflow-hidden animate-slide-up">
            <LogTable entries={filteredEntries} highlightedIP={highlightedIP} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <ProtectedRoute>
      <ResultsPageContent />
    </ProtectedRoute>
  );
}
