'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/upload');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-darker cyber-grid-bg">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyber-green/30 border-t-cyber-green rounded-full animate-spin" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-b-cyber-blue/50 rounded-full animate-spin-slow" />
        </div>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Logo" className="w-8 h-8 object-contain rounded" />
          <h1 className="text-2xl font-bold">
            <span className="text-cyber-green">Log</span>
            <span className="text-slate-800">Guard</span>
          </h1>
        </div>
        <p className="text-gray-500 text-sm">Initializing security systems...</p>
      </div>
    </div>
  );
}
