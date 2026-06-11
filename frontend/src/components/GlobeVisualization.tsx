'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically load react-globe.gl to prevent SSR document/window errors
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] md:h-[500px] flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
      <div className="w-12 h-12 border-4 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin mb-4" />
      <p className="text-slate-500 text-sm font-medium">Loading 3D Threat Globe...</p>
    </div>
  ),
});

export interface AnomalyIPPoint {
  ip: string;
  reason: string;
  confidence_score: number;
  count: number;
  latitude?: number;
  longitude?: number;
  country?: string;
}

interface GlobeVisualizationProps {
  anomalies: AnomalyIPPoint[];
  onIPClick?: (ip: string) => void;
}

export default function GlobeVisualization({
  anomalies,
  onIPClick,
}: GlobeVisualizationProps) {
  const globeEl = useRef<any>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Filter out anomalies without valid coordinates
  const points = useMemo(() => {
    try {
      return anomalies
        .filter((anom) => anom.latitude !== undefined && anom.longitude !== undefined)
        .map((anom) => {
          // Adjust point size based on confidence score (40-60 smaller, 60-80 medium, 80-100 larger)
          let size = 0.4;
          if (anom.confidence_score >= 80) {
            size = 1.2;
          } else if (anom.confidence_score >= 60) {
            size = 0.8;
          }

          return {
            lat: anom.latitude!,
            lng: anom.longitude!,
            ip: anom.ip,
            reason: anom.reason,
            confidence: anom.confidence_score,
            count: anom.count,
            country: anom.country || 'Unknown',
            size: size,
          };
        });
    } catch (err) {
      console.error('Error parsing globe coordinates:', err);
      setError('Failed to process coordinates for globe display.');
      return [];
    }
  }, [anomalies]);

  // 2. Auto-rotate implementation
  useEffect(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.5; // visible rotation speed
      }
    }
  }, [points]);

  if (error) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-red-50 border border-red-200 rounded-2xl p-6">
        <p className="text-red-700 text-sm font-medium">⚠️ {error}</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
        <div>
          <span className="text-3xl block mb-2">🌍</span>
          <p className="text-slate-500 text-sm font-medium">
            No anomalous IPs with geographic coordinates detected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 animate-slide-up">
      {/* Globe Title Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center border border-red-200">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2m4.618-2.016A11.952 11.952 0 0012 2.944a11.952 11.952 0 00-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Geographic Threat Intelligence</h2>
          <p className="text-xs text-slate-500">Global attack source mapping of anomalies (click nodes to inspect)</p>
        </div>
      </div>

      {/* Main Globe Card container */}
      <div className="relative w-full rounded-2xl bg-slate-950 overflow-hidden shadow-xl border border-slate-800 h-[450px] md:h-[550px] flex items-center justify-center">
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <Globe
            ref={globeEl}
            globeImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png"
            pointsData={points}
            pointColor={() => '#ef4444'} // bright red
            pointAltitude={0.03}
            pointRadius={(d: any) => d.size * 0.3}
            pointsMerge={false}
            onPointClick={(point: any) => {
              if (onIPClick && point?.ip) {
                onIPClick(point.ip);
              }
            }}
            onPointHover={(point) => setHoveredPoint(point)}
            pointLabel={() => ''} // custom tooltip is rendered overlay-style
            onGlobeReady={() => {
              if (globeEl.current) {
                const controls = globeEl.current.controls();
                if (controls) {
                  controls.autoRotate = true;
                  controls.autoRotateSpeed = 1.5;
                }
              }
            }}
            width={750}
            height={500}
          />
        </div>

        {/* Floating Custom HTML Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-4 right-4 z-10 p-4 rounded-xl bg-slate-900/90 border border-slate-700 text-white shadow-2xl max-w-sm backdrop-blur-md animate-fade-in pointer-events-none">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <p className="font-mono text-sm font-bold text-red-400">{hoveredPoint.ip}</p>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 ml-auto border border-slate-700">
                {hoveredPoint.country}
              </span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300">
              <p>
                <strong className="text-slate-400">Reason:</strong> {hoveredPoint.reason}
              </p>
              <div className="flex gap-4 pt-1">
                <p>
                  <strong className="text-slate-400">Confidence:</strong>{' '}
                  <span className={hoveredPoint.confidence >= 80 ? 'text-red-400' : 'text-amber-400'}>
                    {hoveredPoint.confidence}%
                  </span>
                </p>
                <p>
                  <strong className="text-slate-400">Total Requests:</strong>{' '}
                  <span className="text-white font-mono">{hoveredPoint.count}</span>
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2.5 italic border-t border-slate-800 pt-1.5">
              Click node to scroll & highlight details below
            </p>
          </div>
        )}

        {/* Informative overlay */}
        <div className="absolute bottom-4 left-4 z-10 text-[10px] text-slate-500 flex flex-col gap-1">
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Size correlates to AI threat confidence
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            Auto-rotates (drag to pan/zoom)
          </p>
        </div>
      </div>
    </div>
  );
}
