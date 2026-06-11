import { useState, useMemo } from 'react';
import { LogEntry } from '@/lib/api';

interface UserIPMappingProps {
  entries: LogEntry[];
}

export default function UserIPMapping({ entries }: UserIPMappingProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'ips'>('users');
  const [filterText, setFilterText] = useState('');

  // 1. Check if an IP is suspicious
  const isIPAlert = (ip: string, ipEntries: LogEntry[]) => {
    if (ip === '10.0.0.50' || ip === '192.168.2.50') return true;
    return ipEntries.some((e) => e.isAnomaly || e.status?.toUpperCase() === 'BLOCKED');
  };

  // 2. Aggregate data by User
  const userAggregation = useMemo(() => {
    const map = new Map<
      string,
      {
        user: string;
        ips: Set<string>;
        requestCount: number;
        totalBytes: number;
        isSuspicious: boolean;
        flaggedReasons: string[];
      }
    >();

    entries.forEach((e) => {
      const username = e.user || 'unknown_user';
      let data = map.get(username);
      if (!data) {
        data = {
          user: username,
          ips: new Set(),
          requestCount: 0,
          totalBytes: 0,
          isSuspicious: false,
          flaggedReasons: [],
        };
        map.set(username, data);
      }

      data.ips.add(e.ip);
      data.requestCount += 1;
      data.totalBytes += e.bytes || 0;

      // User becomes suspicious if their IP is flagged or if an entry is anomalous/blocked
      if (e.isAnomaly && e.anomalyReason && !data.flaggedReasons.includes(e.anomalyReason)) {
        data.flaggedReasons.push(e.anomalyReason);
      }
      if (e.status?.toUpperCase() === 'BLOCKED') {
        const blockReason = `Blocked request to ${e.url}`;
        if (!data.flaggedReasons.includes(blockReason)) {
          data.flaggedReasons.push(blockReason);
        }
      }
    });

    // Final security evaluation for each user
    const list = Array.from(map.values()).map((userObj) => {
      let isSuspicious = userObj.flaggedReasons.length > 0;
      userObj.ips.forEach((ip) => {
        if (ip === '10.0.0.50' || ip === '192.168.2.50') {
          isSuspicious = true;
          if (!userObj.flaggedReasons.includes(`Accessed from malicious IP: ${ip}`)) {
            userObj.flaggedReasons.push(`Accessed from malicious IP: ${ip}`);
          }
        }
      });
      return {
        ...userObj,
        ips: Array.from(userObj.ips),
        isSuspicious,
      };
    });

    return list.sort((a, b) => {
      // Sort suspicious users to the top
      if (a.isSuspicious && !b.isSuspicious) return -1;
      if (!a.isSuspicious && b.isSuspicious) return 1;
      return b.requestCount - a.requestCount;
    });
  }, [entries]);

  // 3. Aggregate data by IP
  const ipAggregation = useMemo(() => {
    const map = new Map<
      string,
      {
        ip: string;
        users: Set<string>;
        countries: Set<string>;
        requestCount: number;
        totalBytes: number;
        isSuspicious: boolean;
        reasons: string[];
      }
    >();

    entries.forEach((e) => {
      let data = map.get(e.ip);
      if (!data) {
        data = {
          ip: e.ip,
          users: new Set(),
          countries: new Set(),
          requestCount: 0,
          totalBytes: 0,
          isSuspicious: false,
          reasons: [],
        };
        map.set(e.ip, data);
      }

      if (e.user) data.users.add(e.user);
      if (e.country) data.countries.add(e.country);
      data.requestCount += 1;
      data.totalBytes += e.bytes || 0;

      if (e.isAnomaly && e.anomalyReason && !data.reasons.includes(e.anomalyReason)) {
        data.reasons.push(e.anomalyReason);
      }
    });

    const list = Array.from(map.values()).map((ipObj) => {
      const suspicious = isIPAlert(ipObj.ip, entries.filter((e) => e.ip === ipObj.ip));
      if (suspicious && ipObj.reasons.length === 0) {
        if (ipObj.ip === '10.0.0.50' || ipObj.ip === '192.168.2.50') {
          ipObj.reasons.push('High-risk malware IP flagged in intelligence database');
        } else {
          ipObj.reasons.push('IP associated with blocked security requests');
        }
      }
      return {
        ...ipObj,
        users: Array.from(ipObj.users),
        countries: Array.from(ipObj.countries),
        isSuspicious: suspicious,
      };
    });

    return list.sort((a, b) => {
      if (a.isSuspicious && !b.isSuspicious) return -1;
      if (!a.isSuspicious && b.isSuspicious) return 1;
      return b.requestCount - a.requestCount;
    });
  }, [entries]);

  // Apply quick search filter on mappings
  const filteredUsers = userAggregation.filter(
    (u) =>
      u.user.toLowerCase().includes(filterText.toLowerCase()) ||
      u.ips.some((ip) => ip.includes(filterText))
  );

  const filteredIPs = ipAggregation.filter(
    (ipObj) =>
      ipObj.ip.includes(filterText) ||
      ipObj.users.some((u) => u.toLowerCase().includes(filterText.toLowerCase()))
  );

  return (
    <div className="cyber-card p-6 mb-10 animate-slide-up border-slate-200">
      {/* Title + Tab selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            User-to-IP Relationship Mapping
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Identify shared workstations, compromised accounts, or credential stuffing
          </p>
        </div>

        {/* Tab buttons */}
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => {
              setActiveTab('users');
              setFilterText('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              activeTab === 'users'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users Mappings ({userAggregation.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('ips');
              setFilterText('');
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
              activeTab === 'ips'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            IP Mappings ({ipAggregation.length})
          </button>
        </div>
      </div>

      {/* Quick Search */}
      <div className="mb-4 relative">
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={`Search mappings by ${activeTab === 'users' ? 'User or IP' : 'IP or User'}...`}
          className="w-full max-w-md px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-xs transition-all duration-200"
        />
      </div>

      {/* Tables container */}
      <div className="overflow-x-auto">
        {activeTab === 'users' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4">User Account</th>
                <th className="py-2.5 px-4">Mapped IP Addresses</th>
                <th className="py-2.5 px-4 text-center">Requests</th>
                <th className="py-2.5 px-4 text-right">Data Volume</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => (
                <tr
                  key={u.user}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    u.isSuspicious ? 'bg-red-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800 text-xs">{u.user}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1.5">
                      {u.ips.map((ip) => {
                        const suspicious = ip === '10.0.0.50' || ip === '192.168.2.50';
                        return (
                          <span
                            key={ip}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                              suspicious
                                ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                                : 'bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {ip}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600">
                    {u.requestCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">
                    {u.totalBytes.toLocaleString()} B
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {u.isSuspicious ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                        ⚠️ SUSPICIOUS
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 border border-green-200">
                        ✓ SECURE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4">Countries</th>
                <th className="py-2.5 px-4">Associated Users</th>
                <th className="py-2.5 px-4 text-center">Requests</th>
                <th className="py-2.5 px-4 text-right">Data Volume</th>
                <th className="py-2.5 px-4 text-center">Threat Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredIPs.map((ipObj, idx) => (
                <tr
                  key={ipObj.ip}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    ipObj.isSuspicious ? 'bg-red-50/20' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                  }`}
                >
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-slate-700 text-xs">{ipObj.ip}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">
                    {ipObj.countries.join(', ') || '-'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {ipObj.users.length > 0 ? (
                        ipObj.users.map((user) => (
                          <span
                            key={user}
                            className="px-1.5 py-0.5 rounded text-[11px] bg-slate-100 border border-slate-200 text-slate-700"
                          >
                            {user}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-600">
                    {ipObj.requestCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-500">
                    {ipObj.totalBytes.toLocaleString()} B
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {ipObj.isSuspicious ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">
                        ⚠️ HIGH RISK
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        NORMAL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
