import axios, { AxiosProgressEvent } from 'axios';

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('logguard_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: redirect on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !window.location.pathname.includes('/login')
    ) {
      localStorage.removeItem('logguard_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ---- Type Definitions ----

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export interface UploadResponse {
  uploadId: string;
  totalEntries: number;
  totalAnomalies: number;
  warnings: string[];
}

export interface UploadRecord {
  id: string;
  user_id: number;
  filename: string;
  uploaded_at: string;
  status: string;
  total_entries?: number;
  totalEntries?: number;
  // Alias for UI compatibility
  createdAt?: string;
}

export interface LogEntry {
  timestamp: string;
  ip: string;
  user: string;
  url: string;
  status: string;
  bytes: number;
  isAnomaly: boolean;
  anomalyReason?: string;
  confidence?: number;
  latitude?: number;
  longitude?: number;
  country?: string;
}

export interface AnalysisResults {
  uploadId: string;
  filename: string;
  summary: {
    totalEntries: number;
    totalAnomalies: number;
    blockedRequests: number;
    topIP: string;
    topIPs: { ip: string; count: number }[];
  };
  charts: {
    requestsPerHour: { hour: number; count: number }[];
    topDomains: { domain: string; count: number }[];
    statusBreakdown: { name: string; value: number }[];
  };
  socTimeline: {
    narrative: string;
    events: {
      time: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
    }[];
  };
  entries: LogEntry[];
}

// ---- Raw backend response types ----

interface RawLogEntry {
  id: number;
  upload_id: number;
  timestamp: string;
  ip_address: string;
  username: string;
  url: string;
  status: string;
  bytes: number;
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null;
}

interface RawAnomaly {
  anomaly_id: number;
  log_entry_id: number;
  reason: string;
  confidence_score: number;
  timestamp: string;
  ip_address: string;
  username: string;
  url: string;
  status: string;
  bytes: number;
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null;
}

interface RawResultsResponse {
  upload: {
    id: number;
    user_id: number;
    filename: string;
    uploaded_at: string;
    status: string;
  };
  entries: RawLogEntry[];
  anomalies: RawAnomaly[];
}

// ---- Data Transformation ----
// The backend returns raw { upload, entries, anomalies }.
// The frontend dashboard expects a fully structured AnalysisResults object.
// This function bridges the gap by computing all derived data client-side.

function transformResults(raw: RawResultsResponse): AnalysisResults {
  // Build a set of anomalous log_entry_ids for quick lookup
  const anomalyMap = new Map<number, RawAnomaly>();
  for (const a of raw.anomalies) {
    // Keep the highest-confidence anomaly per entry if duplicates exist
    const existing = anomalyMap.get(a.log_entry_id);
    if (!existing || a.confidence_score > existing.confidence_score) {
      anomalyMap.set(a.log_entry_id, a);
    }
  }

  // Transform entries, marking anomalous ones
  const entries: LogEntry[] = raw.entries.map((e) => {
    const anomaly = anomalyMap.get(e.id);
    return {
      timestamp: e.timestamp,
      ip: e.ip_address,
      user: e.username,
      url: e.url,
      status: e.status,
      bytes: e.bytes,
      isAnomaly: !!anomaly,
      anomalyReason: anomaly?.reason,
      confidence: anomaly?.confidence_score,
      latitude: e.latitude || anomaly?.latitude || undefined,
      longitude: e.longitude || anomaly?.longitude || undefined,
      country: e.country || anomaly?.country || undefined,
    };
  });

  // Count blocked requests
  const blockedRequests = raw.entries.filter(
    (e) => e.status?.toUpperCase() === 'BLOCKED'
  ).length;

  // Count unique anomalous IPs (not total anomaly records)
  const anomalousIPs = new Set(raw.anomalies.map((a) => a.ip_address));
  const totalAnomalies = anomalousIPs.size;

  // Compute IP request counts for top IPs
  const ipCounts = new Map<string, number>();
  for (const e of raw.entries) {
    ipCounts.set(e.ip_address, (ipCounts.get(e.ip_address) || 0) + 1);
  }
  const topIPs = Array.from(ipCounts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topIP = topIPs.length > 0 ? topIPs[0].ip : 'N/A';

  // Compute requests per hour
  const hourCounts = new Map<number, number>();
  for (const e of raw.entries) {
    try {
      let hourStr: string | undefined;
      if (e.timestamp && e.timestamp.includes('T')) {
        hourStr = e.timestamp.split('T')[1]?.split(':')[0];
      } else if (e.timestamp) {
        hourStr = e.timestamp.split(' ')[1]?.split(':')[0];
      }
      if (hourStr) {
        const hour = parseInt(hourStr, 10);
        if (!isNaN(hour)) {
          hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }
      }
    } catch {
      // skip malformed timestamps
    }
  }
  // Fill in all 24 hours for a complete chart
  const requestsPerHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourCounts.get(i) || 0,
  }));

  // Compute top domains
  const domainCounts = new Map<string, number>();
  for (const e of raw.entries) {
    if (e.url) {
      domainCounts.set(e.url, (domainCounts.get(e.url) || 0) + 1);
    }
  }
  const topDomains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Status breakdown for pie chart
  const allowedCount = raw.entries.filter(
    (e) => e.status?.toUpperCase() === 'ALLOWED'
  ).length;
  const statusBreakdown = [
    { name: 'ALLOWED', value: allowedCount },
    { name: 'BLOCKED', value: blockedRequests },
  ];

  // Build SOC timeline from anomalies
  const socEvents = raw.anomalies
    .filter((a, i, arr) => {
      // Deduplicate: only keep one anomaly per unique IP
      return arr.findIndex((x) => x.ip_address === a.ip_address) === i;
    })
    .map((a) => {
      let severity: 'low' | 'medium' | 'high' | 'critical';
      if (a.confidence_score >= 90) severity = 'critical';
      else if (a.confidence_score >= 70) severity = 'high';
      else if (a.confidence_score >= 40) severity = 'medium';
      else severity = 'low';

      return {
        time: a.timestamp || 'N/A',
        severity,
        description: `${a.ip_address}: ${a.reason}`,
      };
    })
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  // Build SOC narrative
  let narrative = '';
  if (raw.anomalies.length === 0) {
    narrative =
      'No security anomalies were detected in this log file. All traffic appears to be within normal parameters. Continue routine monitoring.';
  } else {
    const uniqueAnomalousIPs = Array.from(anomalousIPs);
    narrative = `Security analysis identified ${totalAnomalies} anomalous IP${totalAnomalies > 1 ? 's' : ''} `;
    narrative += `across ${raw.entries.length} total log entries. `;
    if (blockedRequests > 0) {
      narrative += `${blockedRequests} requests were blocked by the proxy. `;
    }
    narrative += `Flagged IPs: ${uniqueAnomalousIPs.join(', ')}. `;
    narrative += `Immediate investigation is recommended for any IPs with confidence scores above 80%.`;
  }

  return {
    uploadId: String(raw.upload.id),
    filename: raw.upload.filename,
    summary: {
      totalEntries: raw.entries.length,
      totalAnomalies,
      blockedRequests,
      topIP,
      topIPs,
    },
    charts: {
      requestsPerHour,
      topDomains,
      statusBreakdown,
    },
    socTimeline: {
      narrative,
      events: socEvents,
    },
    entries,
  };
}

// ---- API Helper Functions ----

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', {
    username,
    password,
  });
  return response.data;
}

export async function register(
  username: string,
  password: string
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/register', {
    username,
    password,
  });
  return response.data;
}

export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<UploadResponse>('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percent);
      }
    },
  });
  return response.data;
}

export async function getResults(
  uploadId: string
): Promise<AnalysisResults> {
  const response = await api.get<RawResultsResponse>(`/api/results/${uploadId}`);
  // Transform the raw backend response into the structured format
  // the dashboard expects (summary stats, charts, SOC timeline, etc.)
  return transformResults(response.data);
}

export async function getUploads(): Promise<UploadRecord[]> {
  const response = await api.get<any[]>('/api/uploads');
  // Map backend field names to frontend-friendly names
  return response.data.map((u) => ({
    ...u,
    createdAt: u.uploaded_at || u.createdAt || '',
    totalEntries: u.total_entries !== undefined ? u.total_entries : u.totalEntries,
  }));
}

export interface Recommendation {
  action: string;
  reason: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedIPs: string[];
  affectedUsers: string[];
}

export async function getRecommendations(
  uploadId: string,
  anomalies: any[]
): Promise<Recommendation[]> {
  const response = await api.post<{ recommendations: Recommendation[] }>(
    '/api/recommendations',
    {
      uploadId,
      anomalies: anomalies.map((a) => ({
        ip: a.ip_address || a.ip,
        reason: a.reason || a.anomalyReason,
        confidence_score: a.confidence_score !== undefined ? a.confidence_score : a.confidence,
      })),
    }
  );
  return response.data.recommendations;
}

export default api;
