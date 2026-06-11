'use client';

import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-cyber-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <button
            onClick={() => router.push('/upload')}
            className="flex items-center gap-2.5 group"
          >
            <img src="/logo.jpg" alt="Logo" className="w-7 h-7 object-contain rounded group-hover:animate-pulse" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-cyber-green group-hover:text-cyber-green/80 transition-colors">
                Log
              </span>
              <span className="text-slate-800">Guard</span>
            </span>
          </button>

          {/* Right: User info + Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-slate-600">
                Signed in as{' '}
                <span className="text-slate-800 font-semibold">
                  {user?.username || 'User'}
                </span>
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         text-sm text-slate-600 hover:text-red-700
                         bg-white hover:bg-red-50
                         border border-cyber-border hover:border-red-200
                         transition-all duration-300"
            >
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
