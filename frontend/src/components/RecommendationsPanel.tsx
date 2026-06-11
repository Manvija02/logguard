import { useState, useEffect } from 'react';
import { getRecommendations, Recommendation } from '@/lib/api';

interface RecommendationsPanelProps {
  uploadId: string;
  anomalies: any[];
}

export default function RecommendationsPanel({ uploadId, anomalies }: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [completedActions, setCompletedActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    async function loadRecommendations() {
      try {
        setLoading(true);
        if (anomalies && anomalies.length > 0) {
          const recs = await getRecommendations(uploadId, anomalies);
          setRecommendations(recs);
        } else {
          // If no anomalies, return default secure recommendation
          setRecommendations([]);
        }
      } catch (err) {
        console.error('Failed to load recommendations:', err);
      } finally {
        setLoading(false);
      }
    }

    if (uploadId) {
      loadRecommendations();
    }
  }, [uploadId, anomalies]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedText((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleMarkDone = (actionText: string) => {
    setCompletedActions((prev) => [...prev, actionText]);
  };

  // Get matching action icon based on keywords
  const getActionIcon = (action: string) => {
    const text = action.toLowerCase();
    if (text.includes('block') || text.includes('deny') || text.includes('firewall')) {
      return (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      );
    }
    if (text.includes('review') || text.includes('audit') || text.includes('user')) {
      return (
        <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
    if (text.includes('monitor') || text.includes('observe') || text.includes('watch')) {
      return (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      );
    }
    if (text.includes('investigate') || text.includes('query') || text.includes('search')) {
      return (
        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
    }
    // Default fallback icon
    return (
      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    );
  };

  // Style mappings for urgency level
  const urgencyStyles = {
    CRITICAL: {
      card: 'bg-red-50/75 border-red-200 border-l-red-600 hover:bg-red-50/90 text-red-900',
      badge: 'bg-red-100 text-red-800 border-red-200',
    },
    HIGH: {
      card: 'bg-orange-50/75 border-orange-200 border-l-orange-500 hover:bg-orange-50/90 text-orange-950',
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
    },
    MEDIUM: {
      card: 'bg-yellow-50/75 border-yellow-200 border-l-yellow-500 hover:bg-yellow-50/90 text-yellow-950',
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    },
    LOW: {
      card: 'bg-blue-50/75 border-blue-200 border-l-blue-500 hover:bg-blue-50/90 text-blue-950',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  };

  const activeRecommendations = recommendations.filter((r) => !completedActions.includes(r.action));

  if (loading) {
    return (
      <div className="cyber-card p-6 mb-8 border-slate-200">
        <h2 className="text-sm font-semibold text-slate-500 mb-4 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          Analyzing log anomalies & compiling response recommendations...
        </h2>
        <div className="space-y-3">
          <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-fade-in">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        Actionable Threat Recommendations
      </h2>

      {activeRecommendations.length === 0 ? (
        <div className="cyber-card p-6 text-center border-emerald-200 bg-emerald-50/20">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-emerald-800">System Secure & Clean</h3>
          <p className="text-xs text-emerald-600 mt-1 max-w-md mx-auto">
            No active threat recommendations required. All monitored host transactions fit baseline security patterns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeRecommendations.map((rec) => {
            const style = urgencyStyles[rec.urgency] || urgencyStyles.LOW;
            return (
              <div
                key={rec.action}
                className={`flex flex-col justify-between p-5 border border-l-4 rounded-xl shadow-sm transition-all duration-300 transform hover:scale-[1.01] ${style.card} animate-fade-in`}
              >
                <div>
                  {/* Badge + Urgency */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                      {rec.urgency === 'CRITICAL' && '⚠️'}
                      {rec.urgency === 'HIGH' && '⚡'}
                      {rec.urgency === 'MEDIUM' && '🔍'}
                      {rec.urgency === 'LOW' && '⚙️'}
                      {rec.urgency}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${style.badge}`}>
                      {rec.urgency}
                    </span>
                  </div>

                  {/* Header Title */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className="mt-0.5 flex-shrink-0">{getActionIcon(rec.action)}</div>
                    <h3 className="font-bold text-sm leading-snug">{rec.action}</h3>
                  </div>

                  {/* Description / Reason */}
                  <p className="text-xs opacity-80 leading-relaxed mb-4">{rec.reason}</p>
                </div>

                {/* Footer copy and action triggers */}
                <div className="flex items-center justify-between border-t border-slate-200/40 pt-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Copy IP button */}
                    {rec.affectedIPs && rec.affectedIPs.length > 0 && (
                      <button
                        onClick={() => handleCopy(rec.affectedIPs[0], `ip-${rec.action}`)}
                        className="px-2.5 py-1 bg-white/70 hover:bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[10px] font-semibold rounded-md transition-all duration-150 flex items-center gap-1"
                      >
                        {copiedText[`ip-${rec.action}`] ? 'Copied!' : 'Copy IP'}
                      </button>
                    )}
                    {/* Copy User button */}
                    {rec.affectedUsers && rec.affectedUsers.length > 0 && (
                      <button
                        onClick={() => handleCopy(rec.affectedUsers[0], `user-${rec.action}`)}
                        className="px-2.5 py-1 bg-white/70 hover:bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-[10px] font-semibold rounded-md transition-all duration-150 flex items-center gap-1"
                      >
                        {copiedText[`user-${rec.action}`] ? 'Copied!' : 'Copy User'}
                      </button>
                    )}
                  </div>

                  {/* Mark as Done button */}
                  <button
                    onClick={() => handleMarkDone(rec.action)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 border border-slate-850 hover:border-slate-950 text-white text-[10px] font-bold rounded-md transition-all duration-150 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    Mark as Done
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
